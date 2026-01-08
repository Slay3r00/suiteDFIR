from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse, Response
import asyncio
from typing import Optional

from core.models import FilePathResponse
from core.config import TOOLS_CONFIG
from core.state import plugin_loaders, available_modules, event_clients
from services.system_manager import system_manager
from services.spatial_manager import spatial_manager


router = APIRouter()


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

@router.post("/api/browse-files", response_model=FilePathResponse)
async def browse_files():
    """Open native file dialog to select forensic files."""
    result = await system_manager.open_file_dialog()
    return FilePathResponse(**result)


@router.post("/api/browse-folders", response_model=FilePathResponse)
async def browse_folders():
    """Open native folder dialog to select output directory."""
    result = await system_manager.open_folder_dialog()
    return FilePathResponse(**result)


# --- System Metrics ---

@router.get("/api/system/health")
async def get_system_health():
    return await system_manager.get_health_metrics()


@router.get("/api/system/storage")
async def get_storage_usage(case_id: Optional[int] = None):
    return await system_manager.get_storage_usage(case_id)


# --- Dashboard ---

@router.get("/api/dashboard/activity")
async def get_recent_activity(case_id: Optional[int] = None):
    return await system_manager.get_recent_activity(case_id)


# --- SSE Streaming (Keep Inline - Tightly coupled to FastAPI) ---

@router.get("/api/stream")
async def stream_events():
    """Unified SSE endpoint for real-time updates"""
    async def event_generator():
        queue = asyncio.Queue()
        event_clients.add(queue)
        
        try:
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            event_clients.remove(queue)
            
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


# --- Spatial / KML ---

@router.get("/api/spatial/kml-files")
async def get_kml_files(case_id: Optional[int] = None):
    """Scan reports directory for KML files, optionally filtered by case_id."""
    return await spatial_manager.get_kml_files(case_id)


@router.get("/api/spatial/kml-data")
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Shutdown (Trivial - Keep Inline) ---

@router.post("/shutdown")
async def shutdown():
    """Gracefully shutdown the backend server"""
    import signal
    import os

    print("Shutdown requested via API")
    os.kill(os.getpid(), signal.SIGINT)

    return {"message": "Shutting down..."}
