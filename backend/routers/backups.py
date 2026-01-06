import os
import asyncio
import logging
import platform
import subprocess
from typing import Optional
from config import BACKUPS_DIR
from state import backup_tasks
from backup_manager import backup_manager
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from models import BackupRequest, ValidateBackupRequest

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
    if not os.path.exists(request.input_path):
        raise HTTPException(status_code=400, detail="Input path does not exist")

    try:
        from utils import check_backup_encryption
        
        # Run the check in a thread pool to avoid blocking the event loop
        # since it does file I/O and imports
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, check_backup_encryption, request.input_path)
        
        if "error" in result:
             # Instead of failing, return unknown status so processing can proceed
             logger.warning(f"Validation error: {result['error']}")
             return result
            
    except Exception as e:
        print(f"Validation exception: {e}")
        return {
             "encrypted": False
        }

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

    async def event_generator():
        # Check if task still exists at start
        if backup_id not in backup_tasks:
            return
            
        queue = backup_tasks[backup_id]["queue"]
        
        while True:
            # Check if task still exists and get status
            if backup_id not in backup_tasks:
                break
                
            # Check status
            if backup_tasks[backup_id]["status"] in ["completed", "failed", "cancelled"] and queue.empty():
                break
                
            try:
                # Wait for message with timeout to check status periodically
                message = await asyncio.wait_for(queue.get(), timeout=1.0)
                yield f"data: {message}\n\n"
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                yield f"data: Error reading log: {str(e)}\n\n"
                break

        # Send final status if task still exists
        if backup_id in backup_tasks:
            final_status = backup_tasks[backup_id]["status"]
            yield f"data: Backup {final_status}\n\n"
            yield f"event: close\ndata: Stream ended\n\n"
            
            # Give client time to process close event
            await asyncio.sleep(0.5)
            
            # Cleanup
            del backup_tasks[backup_id]

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
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
    # Security check: ensure path is within BACKUPS_DIR
    if not os.path.abspath(path).startswith(os.path.abspath(BACKUPS_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Backup not found")

    try:
        if platform.system() == "Darwin":  # macOS
            subprocess.run(["open", path])
        elif platform.system() == "Windows":
            os.startfile(path)
        else:  # Linux
            subprocess.run(["xdg-open", path])
        return {"message": "Backup opened successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open backup: {str(e)}")
