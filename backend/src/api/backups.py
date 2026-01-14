import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException

from core.config import BACKUPS_DIR
from core.models import (
    BackupInfo,
    BackupRequest,
    BackupStarted,
    BackupValidation,
    DeviceInfo,
    MessageResponse,
    ValidateBackupRequest,
)
from core.state import backup_tasks
from services.backup_manager import backup_manager
from utils.sse import create_task_sse_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/backups",
    tags=["backups"]
)

# =============================================================================
# iOS Device Operations
# =============================================================================

@router.get("/devices", response_model=list[DeviceInfo])
async def list_devices():
    """List connected iOS devices"""
    return await backup_manager.get_devices()

@router.post("/validate", response_model=BackupValidation)
async def validate_backup(request: ValidateBackupRequest):
    """Validate iOS backup path and check for encryption status."""
    try:
        return await backup_manager.validate_backup(request.input_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail="Validation failed")

# =============================================================================
# Backup Operations
# =============================================================================

@router.post("", response_model=BackupStarted)
async def start_backup(request: BackupRequest, background_tasks: BackgroundTasks):
    """Start an iOS backup process for a specific device and case."""
    try:
        result = await backup_manager.start_backup(request, background_tasks)
        return {"message": "Backup started", "backup_id": result.get("backup_id")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{backup_id}/stream")
async def stream_backup_logs(backup_id: int):
    """Stream real-time backup logs and progress via SSE."""
    if backup_id not in backup_tasks:
        raise HTTPException(status_code=404, detail="Backup task not found")

    return create_task_sse_response(
        task_id=backup_id,
        task_dict=backup_tasks,
        terminal_statuses=["completed", "failed", "cancelled"],
        cleanup=True
    )

@router.post("/{backup_id}/stop", response_model=MessageResponse)
async def stop_backup(backup_id: int):
    """Stop an active backup process and update status."""
    try:
        result = await backup_manager.stop_backup(backup_id)
        return {"message": result.get("message")}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# Backup Management
# =============================================================================

@router.get("", response_model=list[BackupInfo])
async def get_backups(case_id: Optional[int] = None):
    """Retrieve a list of backups associated with a specific case."""
    return await backup_manager.get_backups(case_id)

@router.delete("/{backup_id}", response_model=MessageResponse)
async def delete_backup(backup_id: int):
    """Delete a backup record and its associated files from disk."""
    try:
        await backup_manager.delete_backup_by_id(backup_id)
        return {"message": "Backup deleted"}
    except (FileNotFoundError, ValueError):
        raise HTTPException(status_code=404, detail="Backup not found")

@router.post("/open", response_model=MessageResponse)
async def open_backup_location(path: str):
    """Open the backup directory in the system file explorer."""
    from utils.helpers import handle_open_path_request
    return handle_open_path_request(path, BACKUPS_DIR, "Backup")
