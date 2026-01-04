import asyncio
import os
import logging
import shutil
import sqlite3
import subprocess
import platform
from datetime import datetime
from typing import List, Optional
from models import BackupRequest, ValidateBackupRequest
from config import BACKUPS_DIR
from database import DB_PATH, db_execute, db_fetch_one
from state import backup_tasks, active_backups
from utils import broadcast_event, get_connected_devices, get_binary_path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api",
    tags=["backups"]
)

os.makedirs(BACKUPS_DIR, exist_ok=True)

@router.get("/ios/devices")
async def list_devices():
    """List connected iOS devices"""
    return await get_connected_devices()

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

async def run_backup_process(backup_id: int, udid: str, backup_path: str, password: Optional[str] = None):
    idevice_backup_cmd = get_binary_path("idevicebackup2")
    cmd = [idevice_backup_cmd, 'backup', backup_path, '-u', udid]

    try:
        if password:
            # Enable encryption
            enc_cmd = [idevice_backup_cmd, 'encryption', 'on', password, '-u', udid]
            enc_proc = await asyncio.create_subprocess_exec(
                *enc_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await enc_proc.communicate()
            if enc_proc.returncode != 0:
                # Failed to enable encryption
                error_msg = f"Failed to enable encryption: {stderr.decode()}"
                print(error_msg)
                if backup_id in backup_tasks:
                    await backup_tasks[backup_id]["queue"].put(error_msg)
                    backup_tasks[backup_id]["status"] = "failed"
                
                await db_execute("UPDATE backups SET status = 'failed' WHERE id = ?", (backup_id,))
                return

        # Create subprocess with increased stream limit to handle \r progress bars
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            limit=1024 * 1024  # 1MB
        )
        
        # Store process handle
        active_backups[backup_id] = process
        backup_tasks[backup_id]["process"] = process
        
        # Broadcast start
        await broadcast_event("backup_update", {"id": backup_id, "status": "in_progress"})
        
        # Stream output line by line
        while True:
            try:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=60.0)
                if not line:
                    break
                
                line_text = line.decode().strip()
                if line_text:
                    if "*** Waiting for passcode to be entered on the device ***" in line_text:
                        continue

                    if backup_id in backup_tasks:
                        await backup_tasks[backup_id]["queue"].put(line_text)
            except asyncio.TimeoutError:
                if process.returncode is not None:
                    break
                continue
            except Exception as e:
                print(f"Error reading backup output: {e}")
                break

        await process.wait()
        
        status = 'failed'
        
        if process.returncode == 0:
            status = 'completed'
            if backup_id in backup_tasks:
                await backup_tasks[backup_id]["queue"].put("Backup completed successfully")
            await broadcast_event("backup_update", {"id": backup_id, "status": "completed"})
        else:
            row = await db_fetch_one("SELECT status FROM backups WHERE id = ?", (backup_id,))
            current_status = row['status'] if row else 'failed'
            
            if current_status == 'cancelled':
                status = 'cancelled'
                if backup_id in backup_tasks:
                    await backup_tasks[backup_id]["queue"].put("Backup cancelled by user")
            else:
                status = 'failed'
                if backup_id in backup_tasks:
                    await backup_tasks[backup_id]["queue"].put(f"Backup failed with exit code {process.returncode}")
        
        if backup_id in backup_tasks:
            backup_tasks[backup_id]["status"] = status
        
        if status == 'completed':
            await db_execute("UPDATE backups SET status = ?, progress = 100 WHERE id = ?", (status, backup_id))
            
            try:
                loop = asyncio.get_running_loop()
                def calc_size():
                    total_size = 0
                    for dirpath, dirnames, filenames in os.walk(backup_path):
                        for f in filenames:
                            fp = os.path.join(dirpath, f)
                            if not os.path.islink(fp):
                                total_size += os.path.getsize(fp)
                    return total_size

                total_size = await loop.run_in_executor(None, calc_size)
                size_str = f"{total_size / (1024*1024*1024):.2f} GB"
                await db_execute("UPDATE backups SET size = ? WHERE id = ?", (size_str, backup_id))
            except Exception as e:
                print(f"Error calculating size: {e}")
        else:
            print(f"DEBUG: Backup {status}. Cleaning up...")
            await db_execute("DELETE FROM backups WHERE id = ?", (backup_id,))
            print(f"DEBUG: Deleted backup record {backup_id} from DB")
            
            if os.path.exists(backup_path):
                try:
                    loop = asyncio.get_running_loop()
                    await loop.run_in_executor(None, shutil.rmtree, backup_path)
                    print(f"DEBUG: Deleted backup directory {backup_path}")
                except Exception as e:
                    print(f"Error deleting backup files: {e}")

    except Exception as e:
        print(f"Backup error: {e}")
        try:
            await db_execute("UPDATE backups SET status = 'failed' WHERE id = ?", (backup_id,))
        except Exception as db_e:
            print(f"Failed to update status on error: {db_e}")
            
        if backup_id in backup_tasks:
            await backup_tasks[backup_id]["queue"].put(f"Backup error: {str(e)}")
            backup_tasks[backup_id]["status"] = "failed"
            
    finally:
        if backup_id in active_backups:
            del active_backups[backup_id]
        # Note: We don't delete from backup_tasks here to allow the stream to finish sending logs
@router.post("/ios/backup")
async def start_backup(request: BackupRequest, background_tasks: BackgroundTasks):
    """Start iOS backup"""
    # Check if device is still connected
    devices = await get_connected_devices()
    device = next((d for d in devices if d['udid'] == request.udid), None)
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # Create backup directory
    backup_path = os.path.join(BACKUPS_DIR, f"{request.name}_{request.udid}_{int(datetime.now().timestamp())}")
    os.makedirs(backup_path, exist_ok=True)
    
    # Create DB entry
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO backups (name, device_udid, device_name, path, status, password, case_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (request.name, request.udid, device['name'], backup_path, 'in_progress', request.password, request.case_id)
    )
    backup_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Initialize task queue BEFORE starting async task
    # This prevents race condition where frontend connects to stream before task exists
    backup_tasks[backup_id] = {
        "queue": asyncio.Queue(),
        "status": "in_progress",
        "process": None
    }
    
    background_tasks.add_task(run_backup_process, backup_id, request.udid, backup_path, request.password)
    
    # This async function is just a placeholder to return the response quickly
    async def run_backup_placeholder():
        # Wait a bit for response to be sent
        await asyncio.sleep(0.1)
        # Actual process is started in background_tasks.add_task
        pass
        
    asyncio.create_task(run_backup_placeholder())
    
    return {"message": "Backup started", "backup_id": backup_id}

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
    
    # Update status IMMEDIATELY to give feedback
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE backups SET status = 'cancelled' WHERE id = ?", (backup_id,))
    conn.commit()
    conn.close()
    
    if backup_id in backup_tasks:
        backup_tasks[backup_id]["status"] = "cancelled"
        await backup_tasks[backup_id]["queue"].put("Stopping backup...")

    if backup_id in active_backups and active_backups[backup_id] is not None:
        process = active_backups[backup_id]
        try:
            # Send SIGTERM
            process.terminate()
            
            # We don't wait here, run_backup_process will handle the exit
            
        except Exception as e:
            print(f"Error stopping backup process: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to stop backup: {str(e)}")
            
    return {"message": "Backup stop requested"}

@router.get("/backups")
async def get_backups(case_id: Optional[int] = None):
    """Get list of backups"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if case_id:
        cursor.execute("SELECT id, name, device_udid, device_name, path, created_at, status, size, progress, type FROM backups WHERE case_id = ? ORDER BY created_at DESC", (case_id,))
    else:
        cursor.execute("SELECT id, name, device_udid, device_name, path, created_at, status, size, progress, type FROM backups ORDER BY created_at DESC")
    
    backups = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return backups

@router.delete("/backups/{backup_id}")
async def delete_backup(backup_id: int):
    """Delete backup"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get path
    cursor.execute("SELECT path FROM backups WHERE id = ?", (backup_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Backup not found")
        
    path = row[0]
    
    # Delete from DB
    cursor.execute("DELETE FROM backups WHERE id = ?", (backup_id,))
    conn.commit()
    conn.close()
    
    # Delete from filesystem
    if os.path.exists(path):
        try:
            # Run blocking I/O in thread pool
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, shutil.rmtree, path)
        except Exception as e:
            print(f"Error deleting backup files: {e}")
            
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


