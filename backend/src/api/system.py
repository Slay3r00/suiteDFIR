import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from core.config import TOOLS_CONFIG
from core.models import FilePathResponse
from core.state import available_modules, event_clients, plugin_loaders
from services.spatial_manager import spatial_manager
from services.system_manager import system_manager
from utils.sse import create_client_sse_response, create_sse_response

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/api",
    tags=["system"]
)


# --- Root & Health ---

@router.get("/")
async def root():
    total_modules = sum(len(modules) for modules in available_modules.values())
    return {
        "message": "Forensic Tools Web API is running",
        "tools": list(TOOLS_CONFIG.keys()),
        "modules_loaded": total_modules
    }


@router.get("/health")
async def health_check():
    tools_status = {tool: len(plugin_loaders.get(tool, {}) or {}) > 0 for tool in TOOLS_CONFIG.keys()}
    return {
        "status": "healthy",
        "tools_initialized": tools_status
    }


# --- File Dialogs ---

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


# --- System Metrics ---

@router.get("/system/health")
async def get_system_health():
    return await system_manager.get_health_metrics()


@router.get("/system/storage")
async def get_storage_usage(case_id: Optional[int] = None):
    return await system_manager.get_storage_usage(case_id)


# --- SSE Streaming ---

@router.get("/stream")
async def stream_events():
    """Unified SSE endpoint for real-time updates"""
    return create_client_sse_response(event_clients)


# --- Spatial / KML ---

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


# --- Shutdown ---

@router.post("/shutdown")
async def shutdown():
    """Gracefully shutdown the backend server"""
    return await system_manager.shutdown_backend()
