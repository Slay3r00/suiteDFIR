
import asyncio
import os
import logging
import shutil
import time
from typing import Optional, List, Dict, Any

from core.config import BACKUPS_DIR
from core.database import db_execute, db_fetch_one, db_fetch_all, db_execute_return_id
from core.state import active_backups, backup_tasks
from utils.helpers import broadcast_event, get_connected_devices, get_binary_path, check_backup_encryption

logger = logging.getLogger(__name__)

class BackupManager:
    """Manages iOS backup processes and their state."""

    def __init__(self):
        os.makedirs(BACKUPS_DIR, exist_ok=True)

    async def get_devices(self) -> List[Dict[str, Any]]:
        """List connected iOS devices."""
        return await get_connected_devices()

    async def get_backups(self, case_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get list of backups for a specific case."""
        if not case_id:
            return []
        return await db_fetch_all(
            "SELECT id, name, device_udid as udid, device_name, path, created_at, status, size, progress, type, case_id FROM backups WHERE case_id = ? ORDER BY created_at DESC",
            (case_id,)
        )

    async def delete_backup_by_id(self, backup_id: int) -> Dict[str, Any]:
        """Delete a backup by ID from DB and filesystem."""
        row = await db_fetch_one("SELECT path FROM backups WHERE id = ?", (backup_id,))
        
        if not row:
            raise ValueError("Backup record not found")
        
        path = row['path']
        
        # Delete from DB
        await db_execute("DELETE FROM backups WHERE id = ?", (backup_id,))
        
        # Delete from filesystem
        await self.cleanup_backup_files(path)
        
        return {"success": True, "message": "Backup deleted"}

    async def start_backup(self, request: Any, background_tasks: Any) -> Dict[str, Any]:
        """Start an iOS backup process."""
        # Check if device is still connected
        devices = await self.get_devices()
        device = next((d for d in devices if d['udid'] == request.udid), None)
        
        if not device:
            raise ValueError("Device not found or not connected")
            
        # Create backup directory
        backup_path = os.path.join(BACKUPS_DIR, f"{request.name}_{request.udid}_{int(time.time())}")
        os.makedirs(backup_path, exist_ok=True)
        
        # Create DB entry
        backup_id = await db_execute_return_id(
            "INSERT INTO backups (name, device_udid, device_name, path, status, password, case_id, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (request.name, request.udid, device['name'], backup_path, 'in_progress', request.password, request.case_id, 'ios')
        )

        # Initialize task queue for SSE streaming (maxsize prevents unbounded memory growth)
        backup_tasks[backup_id] = {
            "queue": asyncio.Queue(maxsize=1000),
            "status": "in_progress",
            "process": None
        }

        # Start background task
        background_tasks.add_task(self._run_backup_loop, backup_id, request.udid, backup_path, request.password)

        return {"success": True, "backup_id": backup_id, "message": "Backup started"}

    async def stop_backup(self, backup_id: int) -> Dict[str, Any]:
        """Stop an active backup process."""
        # Update status immediately to give feedback
        await db_execute("UPDATE backups SET status = 'cancelled' WHERE id = ?", (backup_id,))

        if backup_id in active_backups and active_backups[backup_id] is not None:
            process = active_backups[backup_id]
            try:
                process.terminate()
                return {"success": True, "message": "Backup stop requested"}
            except Exception as e:
                logger.error(f"Error stopping backup process {backup_id}: {e}")
                raise RuntimeError(f"Failed to stop backup process: {e}")

        return {"success": True, "message": "Backup not active or already stopped"}

    async def _run_backup_loop(self, backup_id: int, udid: str, backup_path: str, password: Optional[str] = None):
        """Internal loop to handle the backup subprocess and log streaming."""
        try:
            # Setup Encryption if needed
            if password:
                success = await self._setup_encryption(backup_id, udid, password, backup_path)
                if not success:
                    return

            # Start Subprocess
            idevice_backup_cmd = get_binary_path("idevicebackup2")
            cmd = [idevice_backup_cmd, 'backup', backup_path, '-u', udid]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                limit=1024 * 1024  # 1MB
            )
            
            # Store process handle
            active_backups[backup_id] = process
            
            # Broadcast start
            await broadcast_event("backup_update", {"id": backup_id, "status": "in_progress"})
            
            # Stream Output
            await self._stream_output(backup_id, process)

            # Wait for Completion
            return_code = await process.wait()
            
            # Finalize Status and DB
            await self._finalize_backup(backup_id, return_code, backup_path)

        except Exception as e:
            logger.error(f"Backup error for {backup_id}: {e}", exc_info=True)
            await self._handle_loop_error(backup_id, e)
                
        finally:
            if backup_id in active_backups:
                del active_backups[backup_id]

    async def _setup_encryption(self, backup_id: int, udid: str, password: str, backup_path: str) -> bool:
        """Enable encryption on the device before backup."""
        idevice_backup_cmd = get_binary_path("idevicebackup2")
        enc_cmd = [idevice_backup_cmd, 'encryption', 'on', password, '-u', udid]

        enc_proc = await asyncio.create_subprocess_exec(
            *enc_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await enc_proc.communicate()

        if enc_proc.returncode != 0:
            error_msg = f"Failed to enable encryption: {stderr.decode()}"
            logger.error(error_msg)

            # Update database status
            await db_execute("UPDATE backups SET status = 'failed' WHERE id = ?", (backup_id,))

            # Broadcast failure event
            await broadcast_event("backup_update", {"id": backup_id, "status": "failed"})
            
            if backup_id in backup_tasks:
                await backup_tasks[backup_id]["queue"].put(error_msg)
                backup_tasks[backup_id]["status"] = "failed"

            # Clean up files
            await self.cleanup_backup_files(backup_path)

            return False
        return True

    async def _stream_output(self, backup_id: int, process: asyncio.subprocess.Process):
        """Read and log subprocess output."""
        while True:
            try:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=60.0)
                if not line:
                    break

                line_text = line.decode().strip()
                if line_text:
                    # Skip common noisy lines
                    if "*** Waiting for passcode to be entered on the device ***" in line_text:
                        continue
                    # Stream to queue
                    if backup_id in backup_tasks:
                        await backup_tasks[backup_id]["queue"].put(line_text)
                    
                    # Parse progress
                    if '%' in line_text:
                        try:
                            parts = line_text.split('%')[0].split()
                            if parts:
                                percentage = None
                                for part in parts:
                                    if part.endswith('%'):
                                        try:
                                            percentage = int(part[:-1])
                                            break
                                        except ValueError:
                                            continue
                                            
                                if percentage is not None:
                                    # Throttle DB updates - only update every 5% or if 100%
                                    if percentage % 5 == 0 or percentage == 100:
                                        await db_execute(
                                            "UPDATE backups SET progress = ? WHERE id = ?",
                                            (percentage, backup_id)
                                        )
                        except Exception as e:
                            logger.error(f"Error parsing progress: {e}")
                    logger.info(f"Backup {backup_id}: {line_text}")

            except asyncio.TimeoutError:
                if process.returncode is not None:
                    break
                continue
            except Exception as e:
                logger.error(f"Error reading backup output for {backup_id}: {e}")
                if backup_id in backup_tasks:
                    await backup_tasks[backup_id]["queue"].put(f"Error reading log: {str(e)}")
                break

    async def _finalize_backup(self, backup_id: int, return_code: int, backup_path: str):
        """Update DB and perform cleanup based on the process exit code."""
        # Determine final status - check if user cancelled first
        row = await db_fetch_one("SELECT status FROM backups WHERE id = ?", (backup_id,))
        current_status = row['status'] if row else None

        if current_status == "cancelled":
            status = 'cancelled'
        elif return_code == 0:
            status = 'completed'
            if backup_id in backup_tasks:
                await backup_tasks[backup_id]["queue"].put("Backup completed successfully")
            await broadcast_event("backup_update", {"id": backup_id, "status": "completed"})
        else:
            status = 'failed'
            if backup_id in backup_tasks:
                 await backup_tasks[backup_id]["queue"].put(f"Backup failed with exit code {return_code}")

        if status == 'completed':
            try:
                total_size = await self.calc_backup_size(backup_path)
                size_str = f"{total_size / (1024*1024*1024):.2f} GB"
                await db_execute("UPDATE backups SET status = ?, progress = 100, size = ? WHERE id = ?",
                               (status, size_str, backup_id))
            except Exception as e:
                logger.error(f"Error calculating size for {backup_id}: {e}")
                await db_execute("UPDATE backups SET status = ?, progress = 100 WHERE id = ?", (status, backup_id))
        else:
            logger.info(f"Backup {backup_id} {status}. Cleaning up files...")
            await db_execute("UPDATE backups SET status = ? WHERE id = ?", (status, backup_id))
            await self.cleanup_backup_files(backup_path)
            
        if backup_id in backup_tasks:
            backup_tasks[backup_id]["status"] = status

    async def _handle_loop_error(self, backup_id: int, error: Exception):
        """Centralized error handling for the backup loop."""
        try:
            # Get backup path for cleanup
            row = await db_fetch_one("SELECT path FROM backups WHERE id = ?", (backup_id,))
            backup_path = row['path'] if row else None

            await db_execute("UPDATE backups SET status = 'failed' WHERE id = ?", (backup_id,))

            # Clean up files
            if backup_path:
                await self.cleanup_backup_files(backup_path)
                
            if backup_id in backup_tasks:
                await backup_tasks[backup_id]["queue"].put(f"Backup error: {str(error)}")
                backup_tasks[backup_id]["status"] = "failed"
        except Exception as db_e:
            logger.error(f"Failed to update status on error for {backup_id}: {db_e}")

    async def calc_backup_size(self, backup_path: str) -> int:
        """Calculate total size of a backup folder asynchronously."""
        def _calc():
            total_size = 0
            if not os.path.exists(backup_path):
                return 0
            for dirpath, dirnames, filenames in os.walk(backup_path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if not os.path.islink(fp):
                        try:
                            total_size += os.path.getsize(fp)
                        except OSError:
                            pass 
            return total_size

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _calc)

    async def cleanup_backup_files(self, backup_path: str):
        """Delete backup files from disk asynchronously."""
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, shutil.rmtree, backup_path)
            logger.info(f"Deleted backup directory {backup_path}")
        except FileNotFoundError:
            # Path doesn't exist, nothing to clean up
            pass
        except Exception as e:
            logger.error(f"Error deleting backup files: {e}")

    async def validate_backup(self, input_path: str) -> dict:
        """Validate an iOS backup path and check if it's encrypted."""
        # Path existence check (moved from API layer)
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Backup path not found: {input_path}")

        try:
            result = check_backup_encryption(input_path)

            if "error" in result:
                logger.warning(f"Validation error: {result['error']}")
                return {
                    "encrypted": False,
                    "error": result['error'],
                    "valid": False
                }

            return {
                "encrypted": result.get("encrypted", False),
                "valid": True
            }
        except Exception as e:
            logger.warning(f"Validation exception: {e}")
            return {
                "encrypted": False,
                "error": str(e),
                "valid": False
            }


# Global instance
backup_manager = BackupManager()
