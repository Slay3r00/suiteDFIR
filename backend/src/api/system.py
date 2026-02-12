import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from core.config import TOOLS_CONFIG
from core.models import FilePathResponse, HealthResponse, MessageResponse, RootResponse, StorageUsage, SystemHealthMetrics
from core.state import event_clients
from services.spatial_manager import spatial_manager
from services.system_manager import system_manager
from utils.sse import create_client_sse_response, create_sse_response

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/api",
    tags=["system"]
)


# Root & Health

@router.get("/", response_model=RootResponse)
async def root():
    return RootResponse.model_validate(await system_manager.get_root_info())


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse.model_validate(await system_manager.get_health_check())


# File Dialogs

@router.post("/browse-files", response_model=FilePathResponse)
async def browse_files():
    """Open native file dialog to select forensic files."""
    result = await system_manager.open_file_dialog()
    return FilePathResponse(**result)


@router.post("/browse-folders", response_model=FilePathResponse)
async def browse_folders():
    """Open native folder dialog to select output directory."""
    result = await system_manager.open_folder_dialog()
    return FilePathResponse(**result)


# System Metrics

@router.get("/system/health", response_model=SystemHealthMetrics)
async def get_system_health():
    return SystemHealthMetrics.model_validate(await system_manager.get_health_metrics())


@router.get("/system/storage", response_model=StorageUsage)
async def get_storage_usage(case_id: Optional[int] = None):
    return StorageUsage.model_validate(await system_manager.get_storage_usage(case_id))


# SSE Streaming

@router.get("/stream")
async def stream_events():
    """Unified SSE endpoint for real-time updates"""
    return create_client_sse_response(event_clients)


# Spatial / KML

@router.get("/spatial/kml-files")
async def get_kml_files(case_id: Optional[int] = None):
    """Scan reports directory for KML files, optionally filtered by case_id."""
    return await spatial_manager.get_kml_files(case_id)


@router.get("/spatial/kml-data")
async def get_kml_data(path: str):
    """Fetch and enrich KML data with TSV content."""
    try:
        kml_bytes = await spatial_manager.get_kml_data(path)
        return Response(
            content=kml_bytes,
            media_type="application/vnd.google-earth.kml+xml"
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="KML file not found")


@router.get("/spatial/search")
async def search_location(q: str):
    """Proxy Google Geocoding API search."""
    from services.settings_manager import settings_manager

    api_key = await settings_manager.get_setting("google_maps_api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="Google Maps API key not configured. Set it in Settings.")

    try:
        import httpx
    except ImportError:
        logger.error("httpx is not installed")
        raise HTTPException(status_code=500, detail="Search dependency missing")

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": q,
        "key": api_key,
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()

            if data.get("status") != "OK" or not data.get("results"):
                return []

            # Transform to match existing frontend contract: [{ lat, lon, display_name }]
            results = []
            for result in data["results"][:5]:
                loc = result["geometry"]["location"]
                results.append({
                    "lat": str(loc["lat"]),
                    "lon": str(loc["lng"]),
                    "display_name": result.get("formatted_address", ""),
                })
            return results
        except httpx.HTTPStatusError as e:
            logger.error(f"Google Geocoding API error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=502, detail="Location search service error")
        except Exception as e:
            logger.error(f"Search proxy failed: {e}")
            raise HTTPException(status_code=500, detail="Location search failed")


# Shutdown

@router.post("/shutdown", response_model=MessageResponse)
async def shutdown():
    """Gracefully shutdown the backend server"""
    return MessageResponse.model_validate(await system_manager.shutdown_backend())
