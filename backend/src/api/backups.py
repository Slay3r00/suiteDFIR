import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException

from core.config import BACKUPS_DIR
from core.models import BackupRequest, ValidateBackupRequest
from core.state import backup_tasks
from services.backup_manager import backup_manager
from utils.sse import create_task_sse_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api",
    tags=["backups"]
)

@router.get("/ios/devices")
async def list_devices():
    """List connected iOS devices"""
    return await backup_manager.get_devices()

@router.post("/ios/validate-backup")
async def validate_backup(request: ValidateBackupRequest):
    """Check if an iOS backup is encrypted."""
    result = await backup_manager.validate_backup(request.input_path)
    
    if "error" in result:
        raise HTTPException(status_code=result.get("status_code", 400), detail=result["error"])
    
    return result

@router.post("/ios/backup")
async def start_backup(request: BackupRequest, background_tasks: BackgroundTasks):
    """Start iOS backup"""
    result = await backup_manager.start_backup(request, background_tasks)
    
    if not result.get("success"):
        raise HTTPException(status_code=result.get("status_code", 400), detail=result.get("error"))
        
    return {"message": "Backup started", "backup_id": result.get("backup_id")}

@router.get("/ios/backup/stream/{backup_id}")
async def stream_backup_logs(backup_id: int):
    """SSE endpoint for real-time backup logs."""
    if backup_id not in backup_tasks:
        raise HTTPException(status_code=404, detail="Backup task not found")

    return create_task_sse_response(
        task_id=backup_id,
        task_dict=backup_tasks,
        terminal_statuses=["completed", "failed", "cancelled"],
        cleanup=True
    )

@router.post("/ios/backup/{backup_id}/stop")
async def stop_backup(backup_id: int):
    """Stop an active backup"""
    result = await backup_manager.stop_backup(backup_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=result.get("status_code", 400), detail=result.get("error"))
            
    return {"message": result.get("message")}

@router.get("/backups")
async def get_backups(case_id: Optional[int] = None):
    """Get list of backups"""
    return await backup_manager.get_backups(case_id)

@router.delete("/backups/{backup_id}")
async def delete_backup(backup_id: int):
    """Delete backup"""
    result = await backup_manager.delete_backup_by_id(backup_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=result.get("status_code", 404), detail=result.get("error"))
    
    return {"message": "Backup deleted"}

@router.post("/ios/backup/open")
async def open_backup_location(path: str):
    """Open backup folder in system file explorer"""
    from utils.helpers import handle_open_path_request
    return handle_open_path_request(path, BACKUPS_DIR, "Backup")
