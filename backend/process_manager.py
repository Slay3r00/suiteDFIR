import asyncio
import os
import logging
import uuid
import json
import sys
import tempfile
import shutil
from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import HTTPException

from config import TOOLS_CONFIG, REPORTS_DIR
from database import db_execute
from state import processing_tasks, available_modules
from utils import broadcast_event
from tool_manager import tool_manager

logger = logging.getLogger(__name__)

class ProcessManager:
    """Manages processing jobs for forensic tools."""

    async def start_process(self, request: Any, background_tasks: Any) -> Dict[str, Any]:
        """Start a processing job."""
        tool = request.tool.value
        if tool not in TOOLS_CONFIG:
            raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
            
        config = TOOLS_CONFIG[tool]
        
        # Verify input path
        if not os.path.exists(request.input_path):
            raise HTTPException(status_code=400, detail="Input path does not exist")
            
        # Create output directory
        output_dir = os.path.join(REPORTS_DIR, f"{tool}-reports", request.case_name)
        os.makedirs(output_dir, exist_ok=True)
        
        # Module Selection Logic
        modules_to_run = request.selected_modules
        if not modules_to_run and tool in available_modules:
            # Fallback to state if request list is empty
            for module_name, module_data in available_modules[tool].items():
                if module_data.get("selected", False):
                    modules_to_run.append(module_name)
        
        profile_path = None
        if modules_to_run:
            try:
                # Create temp file
                fd, profile_path = tempfile.mkstemp(suffix=config["profile_ext"], text=True)
                with os.fdopen(fd, 'w') as f:
                    json.dump({
                        "leapp": tool,
                        "format_version": 1,
                        "plugins": modules_to_run
                    }, f)
                logger.debug(f"Created temp profile at {profile_path} with {len(modules_to_run)} modules")
            except Exception as e:
                logger.error(f"Error creating temp profile: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to create processing profile: {e}")

        # Construct command
        tool_path = tool_manager.get_tool_path(tool)
        if not tool_path:
            # Fallback to config path (development)
            tool_script_path = os.path.join(config["path"], config["script"])
        else:
            tool_script_path = os.path.join(str(tool_path), config["script"])

        is_bundled = getattr(sys, 'frozen', False)
        
        if is_bundled:
            cmd = [
                sys.executable,
                "--wrapper",
                tool_script_path,
                "--input_path", request.input_path,
                "--output_path", output_dir
            ]
        else:
            # Development: Run main.py with wrapper flag (assuming main.py is in parent of parent of current file in original structure, 
            # but ProcessManager is in backend/, so main.py is in backend/)
            # processing.py was in backend/routers, so os.path.dirname(os.path.dirname(__file__)) -> backend/
            # Here ProcessManager is in backend/, so os.path.dirname(__file__) -> backend/
            # main.py is in backend/main.py
            main_py_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")
            cmd = [
                sys.executable,
                "-u",
                main_py_path,
                "--wrapper",
                tool_script_path,
                "--input_path", request.input_path,
                "--output_path", output_dir
            ]
        
        if profile_path:
            cmd.extend(["-m", profile_path])

        # determine input type
        input_type = self._determine_input_type(request.input_path, tool)
        cmd.extend(["-t", input_type])
        
        logger.info(f"Executing {tool} command: {' '.join(cmd)}")

        if request.password:
            cmd.extend(["--itunes_password", request.password])
        
        # Generate Task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task state
        processing_tasks[task_id] = {
            "queue": asyncio.Queue(),
            "status": "in_progress",
            "tool": tool,
            "case": request.case_name
        }
        
        # Start background task
        background_tasks.add_task(
            self._run_job, 
            task_id, cmd, tool, request.case_name, output_dir, request.case_id, profile_path, request.report_name
        )
        
        return {"message": f"Started {config['name']} processing", "case": request.case_name, "task_id": task_id}

    async def stop_process(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """Stop a processing job."""
        # If no task_id provided, try to find the most recent active task
        if not task_id:
            active_tasks = [tid for tid, t in processing_tasks.items() if t["status"] == "in_progress"]
            if active_tasks:
                task_id = active_tasks[-1]
        
        if not task_id or task_id not in processing_tasks:
            raise HTTPException(status_code=404, detail="No active task found to stop")
            
        task = processing_tasks[task_id]
        
        if task["status"] != "in_progress":
            return {"message": "Task is not in progress"}
            
        task["status"] = "cancelled"
        
        if "process" in task and task["process"]:
            try:
                task["process"].terminate()
                logger.debug(f"Terminated process for task {task_id}")
            except Exception as e:
                logger.error(f"Error terminating process: {e}")
                
        return {"message": "Processing stop requested", "task_id": task_id}

    async def _run_job(self, task_id, cmd, tool, case_name, output_dir, case_id, profile_path=None, user_report_name=None):
        """Internal runner for the processing subprocess."""
        existing_dirs = set()
        if os.path.exists(output_dir):
            existing_dirs = set(os.listdir(output_dir))

        try:
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            env["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            if task_id in processing_tasks:
                processing_tasks[task_id]["process"] = process
            
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                
                log_message = line.decode().strip()
                
                await broadcast_event("log", {
                    "tool": tool,
                    "case": case_name,
                    "message": log_message
                })
                
                if task_id in processing_tasks:
                    await processing_tasks[task_id]["queue"].put(log_message)
                
            await process.wait()
            
            is_cancelled = False
            if task_id in processing_tasks and processing_tasks[task_id]["status"] == "cancelled":
                is_cancelled = True

            status = "success" if process.returncode == 0 and not is_cancelled else "error"
            if is_cancelled:
                status = "cancelled"

            error_msg = None
            if status == "error":
                stderr_data = await process.stderr.read()
                error_msg = stderr_data.decode()
                logger.error(f"Execution failed for {tool} on {case_name}: {error_msg}")
            
            # Post-processing (identify new report)
            await self._handle_post_processing(output_dir, existing_dirs, status, tool, case_id, user_report_name, case_name)

            # Notify completion
            if task_id in processing_tasks:
                await processing_tasks[task_id]["queue"].put(f"Processing {status}")
                processing_tasks[task_id]["status"] = status
                
            await broadcast_event("complete", {
                "tool": tool,
                "case": case_name,
                "status": status,
                "error": error_msg
            })
                
        except Exception as e:
            logger.error(f"Error running processing job: {e}")
            if task_id in processing_tasks:
                await processing_tasks[task_id]["queue"].put(f"Error: {str(e)}")
                processing_tasks[task_id]["status"] = "error"
                
            await broadcast_event("complete", {
                "tool": tool,
                "case": case_name,
                "status": "error",
                "error": str(e)
            })
        finally:
            if profile_path and os.path.exists(profile_path):
                try:
                    os.remove(profile_path)
                    logger.debug(f"Removed temp profile {profile_path}")
                except Exception as e:
                    logger.error(f"Error removing temp profile {profile_path}: {e}")

    async def _handle_post_processing(self, output_dir, existing_dirs, status, tool, case_id, user_report_name, case_name):
        """Handle report identification and database/filesystem cleanup."""
        # Check for new dirs
        new_report_path = None
        if os.path.exists(output_dir):
            current_dirs = set(os.listdir(output_dir))
            new_dirs = current_dirs - existing_dirs
            new_dirs = [d for d in new_dirs if os.path.isdir(os.path.join(output_dir, d))]
            if new_dirs:
                new_report_path = os.path.join(output_dir, max(new_dirs, key=lambda d: os.path.getmtime(os.path.join(output_dir, d))))

        if status == "success":
            if new_report_path:
                report_name = user_report_name if user_report_name else os.path.basename(new_report_path)
                try:
                    await db_execute(
                        'INSERT INTO reports (name, path, tool, case_id) VALUES (?, ?, ?, ?)',
                        (report_name, new_report_path, tool, case_id)
                    )
                    logger.debug(f"Saved report {report_name} to database")
                except Exception as e:
                    logger.debug(f"Persistence error for report {report_name}: {e}")
            else:
                logger.debug("No new report directory found after success")
        
        elif status in ["cancelled", "error"]:
            if new_report_path and os.path.exists(new_report_path):
                try:
                    await asyncio.to_thread(shutil.rmtree, new_report_path)
                    logger.debug(f"Removed partial report directory: {new_report_path}")
                except Exception as e:
                    logger.error(f"Error removing partial report {new_report_path}: {e}")
            
            if os.path.exists(output_dir) and not os.listdir(output_dir):
                try:
                    os.rmdir(output_dir)
                    logger.debug(f"Removed empty case directory: {output_dir}")
                except Exception as e:
                    logger.error(f"Error removing empty case directory {output_dir}: {e}")

    def _determine_input_type(self, input_path: str, tool: str) -> str:
        """Determine the input type for the tool command."""
        input_type = "fs"
        if os.path.isfile(input_path):
            lower_path = input_path.lower()
            if lower_path.endswith(".zip"):
                input_type = "zip"
            elif lower_path.endswith(".tar"):
                input_type = "tar"
            elif lower_path.endswith(".gz"):
                input_type = "gz"
            else:
                if tool == "ileapp":
                    input_type = "file"
        elif os.path.isdir(input_path):
            if tool == "ileapp":
                if os.path.exists(os.path.join(input_path, "Manifest.plist")) or \
                   os.path.exists(os.path.join(input_path, "Manifest.db")):
                    input_type = "itunes"
        return input_type

# Global instance
process_manager = ProcessManager()
