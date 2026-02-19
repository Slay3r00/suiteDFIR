import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, List, Optional

import httpx
from fastapi import HTTPException

from core.models import GeocodeResult, PlaceSuggestion, TileSessionRequest
from services.settings_manager import settings_manager

logger = logging.getLogger(__name__)

# Constants
MAX_SESSIONS = 10
EXPIRY_SAFETY_BUFFER = 3600
MAX_AUTOCOMPLETE_RESULTS = 5
MAX_GEOCODE_RESULTS = 5


@dataclass
class CachedSession:
    """Cached tile session with expiry tracking."""
    session: str
    key: str
    expiry: int
    map_type: str
    tile_width: int
    tile_height: int


class TileManager:
    """Manages Google Maps Tile API sessions, caching, and location search."""

    def __init__(self):
        # In-memory LRU cache
        self._session_cache: OrderedDict[str, CachedSession] = OrderedDict()
        self._cache_lock = threading.Lock()
        
        # Shared HTTP client for connection pooling
        self._http_client: Optional[httpx.AsyncClient] = None

    def get_http_client(self) -> httpx.AsyncClient:
        """Get or create the shared HTTP client."""
        if self._http_client is None:
            with self._cache_lock:
                if self._http_client is None:
                    self._http_client = httpx.AsyncClient(
                        timeout=httpx.Timeout(10.0, connect=5.0),
                        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
                    )
        return self._http_client

    async def close_http_client(self):
        """Close the shared HTTP client."""
        if self._http_client is not None:
            await self._http_client.aclose()
            self._http_client = None
            logger.debug("TileManager HTTP client closed")

    def sync_close_on_exit(self):
        """Synchronous wrapper for clean up."""
        if self._http_client is not None:
            self._http_client = None

    def _get_cache_key(self, request: TileSessionRequest) -> str:
        """Generate cache key from session configuration parameters."""
        layer_types_str = ",".join(sorted(request.layerTypes)) if request.layerTypes else ""
        overlay_str = str(request.overlay) if request.overlay is not None else ""
        return f"{request.mapType}:{request.language}:{request.region}:{layer_types_str}:{overlay_str}"

    def _is_session_valid(self, cached: CachedSession) -> bool:
        """Check if cached session is still valid."""
        current_time = int(time.time())
        return current_time < (int(cached.expiry) - EXPIRY_SAFETY_BUFFER)

    def _cleanup_expired(self):
        """Remove expired sessions from cache."""
        expired_keys = [k for k, v in self._session_cache.items() if not self._is_session_valid(v)]
        for key in expired_keys:
            self._session_cache.pop(key, None)
        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired tile sessions")

    def _evict_if_needed(self):
        """LRU eviction: remove oldest entries when cache is full."""
        evicted = 0
        while len(self._session_cache) >= MAX_SESSIONS:
            # popitem(last=False) removes the first inserted (oldest) item
            self._session_cache.popitem(last=False)
            evicted += 1
        if evicted:
            logger.debug(f"LRU evicted {evicted} tile sessions")

    async def create_tile_session(self, request: TileSessionRequest) -> dict:
        """Create or return a cached Google Maps Tile session."""
        cache_key = self._get_cache_key(request)

        # 1. Check Cache
        with self._cache_lock:
            self._cleanup_expired()
            if cache_key in self._session_cache:
                cached = self._session_cache[cache_key]
                if self._is_session_valid(cached):
                    self._session_cache.move_to_end(cache_key) # Mark as recently used
                    logger.debug(f"Returning cached tile session for {cache_key}")
                    return {
                        "session": cached.session,
                        "expiry": cached.expiry,
                        "key": cached.key,
                        "tileWidth": cached.tile_width,
                        "tileHeight": cached.tile_height,
                    }

        # 2. Fetch API Key
        api_key = await settings_manager.get_setting("google_maps_api_key")
        if not api_key:
            raise HTTPException(status_code=400, detail="Google Maps API key not configured. Set it in Settings.")

        # 3. Request New Session
        url = f"https://tile.googleapis.com/v1/createSession?key={api_key}"
        payload = {
            "mapType": request.mapType,
            "language": request.language,
            "region": request.region,
        }
        if request.layerTypes:
            payload["layerTypes"] = request.layerTypes
        if request.overlay is not None:
            payload["overlay"] = request.overlay

        client = self.get_http_client()
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

            # Ensure expiry exists and is valid
            try:
                session_expiry = int(data.get("expiry", time.time() + 86400)) # Default 24h
            except (ValueError, TypeError):
                session_expiry = int(time.time() + 86400)

            tile_width = data.get("tileWidth", 256)
            tile_height = data.get("tileHeight", 256)
            session_token = data.get("session")

            if not session_token:
                raise ValueError("Response missing session token")

            cached_session = CachedSession(
                session=session_token,
                key=api_key,
                expiry=session_expiry,
                map_type=request.mapType,
                tile_width=tile_width,
                tile_height=tile_height,
            )

            # 4. Store in Cache
            with self._cache_lock:
                self._evict_if_needed()
                self._session_cache[cache_key] = cached_session
                self._session_cache.move_to_end(cache_key)

            logger.info(f"Cached new tile session for {cache_key}, expiry: {session_expiry}")

            return {
                "session": session_token,
                "expiry": session_expiry,
                "key": api_key,
                "tileWidth": tile_width,
                "tileHeight": tile_height,
            }

        except httpx.HTTPStatusError as e:
            logger.error(f"Google Tile API error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=502, detail="Google Maps Tile API error")
        except Exception as e:
            logger.error(f"Tile session creation failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to create tile session")

    async def invalidate_tile_session(self, request: TileSessionRequest) -> dict:
        """Invalidate a specific cached session."""
        cache_key = self._get_cache_key(request)

        with self._cache_lock:
            if cache_key in self._session_cache:
                del self._session_cache[cache_key]
                logger.info(f"Invalidated tile session for {cache_key}")
                return {"message": "Session invalidated", "cacheKey": cache_key}

        return {"message": "No cached session found", "cacheKey": cache_key}

    async def get_tile_session_status(self) -> dict:
        """Get diagnostic status of cached sessions."""
        current_time = int(time.time())

        with self._cache_lock:
            self._cleanup_expired()
            cache_snapshot = dict(self._session_cache)
            cache_count = len(self._session_cache)

        status = {}
        for cache_key, cached in cache_snapshot.items():
            remaining_seconds = cached.expiry - current_time
            status[cache_key] = {
                "mapType": cached.map_type,
                "expiry": cached.expiry,
                "remainingSeconds": remaining_seconds,
                "isValid": self._is_session_valid(cached),
            }

        return {
            "cachedSessions": cache_count,
            "maxSessions": MAX_SESSIONS,
            "sessions": status,
        }

    async def autocomplete_places(self, query: str) -> List[PlaceSuggestion]:
        """Proxy Google Places Autocomplete (New) API for suggestions."""
        if len(query.strip()) < 2:
            return []

        api_key = await settings_manager.get_setting("google_maps_api_key")
        if not api_key:
            raise HTTPException(status_code=400, detail="Google Maps API key not configured. Set it in Settings.")

        url = "https://places.googleapis.com/v1/places:autocomplete"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat"
        }
        body = {"input": query}

        client = self.get_http_client()
        try:
            response = await client.post(url, headers=headers, json=body)
            response.raise_for_status()
            data = response.json()

            suggestions = []
            for s in data.get("suggestions", [])[:MAX_AUTOCOMPLETE_RESULTS]:
                pred = s.get("placePrediction", {})
                fmt = pred.get("structuredFormat", {})
                suggestions.append(PlaceSuggestion(
                    placeId=pred.get("placeId", ""),
                    mainText=fmt.get("mainText", {}).get("text", ""),
                    secondaryText=fmt.get("secondaryText", {}).get("text", ""),
                ))
            return suggestions
        except httpx.HTTPStatusError as e:
            logger.error(f"Google Places Autocomplete API error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=502, detail="Places autocomplete service error")
        except Exception as e:
            logger.error(f"Autocomplete request failed: {e}")
            raise HTTPException(status_code=500, detail="Autocomplete request failed")

    async def search_location(self, query: str) -> List[GeocodeResult]:
        """Proxy Google Geocoding API search."""
        api_key = await settings_manager.get_setting("google_maps_api_key")
        if not api_key:
            raise HTTPException(status_code=400, detail="Google Maps API key not configured. Set it in Settings.")

        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": query,
            "key": api_key,
        }

        client = self.get_http_client()
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("status") != "OK" or not data.get("results"):
                return []

            results = []
            for result in data["results"][:MAX_GEOCODE_RESULTS]:
                loc = result["geometry"]["location"]
                results.append(GeocodeResult(
                    lat=str(loc["lat"]),
                    lon=str(loc["lng"]),
                    display_name=result.get("formatted_address", ""),
                ))
            return results
        except httpx.HTTPStatusError as e:
            logger.error(f"Google Geocoding API error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=502, detail="Location search service error")
        except Exception as e:
            logger.error(f"Search proxy failed: {e}")
            raise HTTPException(status_code=500, detail="Location search failed")

# Export singleton instance
tile_manager = TileManager()
