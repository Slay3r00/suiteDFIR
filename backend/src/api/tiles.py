import logging

from fastapi import APIRouter, HTTPException

from core.models import TileSessionRequest
from services.settings_manager import settings_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/spatial",
    tags=["spatial"]
)


@router.post("/tile-session")
async def create_tile_session(body: TileSessionRequest):
    """Proxy Google Maps Tile API session creation. Keeps API key server-side."""
    api_key = await settings_manager.get_setting("google_maps_api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="Google Maps API key not configured")

    try:
        import httpx
    except ImportError:
        raise HTTPException(status_code=500, detail="httpx dependency missing")

    url = f"https://tile.googleapis.com/v1/createSession?key={api_key}"

    payload = {
        "mapType": body.mapType,
        "language": body.language,
        "region": body.region,
    }
    if body.layerTypes:
        payload["layerTypes"] = body.layerTypes
    if body.overlay is not None:
        payload["overlay"] = body.overlay

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            # Return session token, expiry, and the API key (needed in tile URLs)
            return {
                "session": data["session"],
                "expiry": data["expiry"],
                "key": api_key,
                "tileWidth": data.get("tileWidth", 256),
                "tileHeight": data.get("tileHeight", 256),
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Google Tile API error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=502, detail="Google Maps Tile API error")
        except Exception as e:
            logger.error(f"Tile session creation failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to create tile session")
