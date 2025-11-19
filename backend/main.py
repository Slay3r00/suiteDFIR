from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from contextlib import asynccontextmanager
import uvicorn
import os
import sys
import asyncio
import subprocess
import platform

# Add iLEAPP to Python path
ILEAPP_PATH = os.path.join(os.path.dirname(__file__), "forensic-tools", "leapp-tools", "iLEAPP")
if os.path.exists(ILEAPP_PATH):
    sys.path.insert(0, ILEAPP_PATH)
    # Set up iLEAPP environment
    os.chdir(ILEAPP_PATH)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize iLEAPP plugins on startup"""
    global plugin_loader, available_modules
    try:
        # Import iLEAPP modules
        import scripts.plugin_loader as plugin_loader_module
        import scripts.ilapfuncs as ilapfuncs
        import scripts.modules_to_exclude as modules_to_exclude

        plugin_loader = plugin_loader_module.PluginLoader()

        # Load modules with simplified logic
        excluded_modules = {'iTunesBackupInfo', 'last_build', 'logarchive'}
        plugins_list = list(plugin_loader.plugins)

        for plugin in plugins_list:
            if plugin.module_name in excluded_modules:
                continue

            plugin_enabled = plugin.module_name not in modules_to_exclude.modules_to_exclude
            plugin_module_name = plugin.artifact_info.get('name', plugin.name) if hasattr(plugin, 'artifact_info') else plugin.name

            available_modules[plugin.name] = {
                'category': plugin.category,
                'display_name': plugin_module_name,
                'module_name': plugin.module_name,
                'enabled': plugin_enabled,
                'selected': plugin_enabled
            }

        print(f"Loaded {len(available_modules)} iLEAPP modules")

    except Exception as e:
        print(f"Failed to initialize iLEAPP plugins: {e}")

    yield

    # Cleanup on shutdown (if needed)
    print("Shutting down iLEAPP server...")

app = FastAPI(
    title="iLEAPP Web API",
    description="iOS Logs, Events, And Plist Parser Web Interface",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response

class FilePathResponse(BaseModel):
    file_path: str
    success: bool
    message: str

class ProcessRequest(BaseModel):
    input_path: str
    output_folder: str
    selected_modules: List[str]
    timezone_offset: str = "UTC"


# Unified task management
tasks = {}

# Global variables for plugin management
plugin_loader = None
available_modules = {}

@app.get("/")
async def root():
    return {"message": "iLEAPP Web API is running", "modules_loaded": len(available_modules)}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "ileapp_initialized": plugin_loader is not None}

@app.get("/api/modules")
async def get_modules():
    """Get list of available iLEAPP modules"""
    if not available_modules:
        raise HTTPException(status_code=503, detail="iLEAPP modules not loaded")

    # Convert to format expected by frontend
    modules_list = []
    for name, info in available_modules.items():
        modules_list.append({
            'name': name,
            'category': info['category'],
            'display_name': info['display_name'],
            'module_name': info['module_name'],
            'enabled': info['enabled'],
            'selected': info['selected']
        })

    return {"modules": modules_list, "total": len(modules_list)}

@app.post("/api/modules/select")
async def select_modules(module_selections: Dict[str, bool]):
    """Update module selection state"""
    global available_modules

    for module_name, selected in module_selections.items():
        if module_name in available_modules:
            available_modules[module_name]['selected'] = selected

    selected_count = sum(1 for info in available_modules.values() if info['selected'])
    return {"message": f"Updated selections: {selected_count} modules selected"}

@app.post("/api/browse-files", response_model=FilePathResponse)
async def browse_files():
    """
    Open native macOS file dialog to select forensic files.
    Returns the absolute path of the selected file.
    """
    try:
        if platform.system() != "Darwin":
            raise HTTPException(
                status_code=400,
                detail="This feature is only available on macOS"
            )

        # Minimal osascript for macOS file dialog (no type restrictions)
        script = '''
        tell application "System Events"
            activate
            set filePath to choose file with prompt "Select iLEAPP input file"
            return POSIX path of filePath
        end tell
        '''

        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            file_path = result.stdout.strip()
            return FilePathResponse(
                file_path=file_path,
                success=True,
                message="File selected successfully"
            )

        # Handle all error cases
        if result.returncode == 1 and "-128" in result.stderr:
            return FilePathResponse("", False, "User cancelled file selection")
        return FilePathResponse("", False, f"File dialog error: {result.stderr}")

    except subprocess.TimeoutExpired:
        return FilePathResponse("", False, "File dialog timed out")
    except Exception as e:
        return FilePathResponse("", False, f"Failed to open file dialog: {str(e)}")

@app.post("/api/browse-folders", response_model=FilePathResponse)
async def browse_folders():
    """
    Open native macOS folder dialog to select output directory.
    Returns the absolute path of the selected folder.
    """
    try:
        if platform.system() != "Darwin":
            raise HTTPException(
                status_code=400,
                detail="This feature is only available on macOS"
            )

        # Minimal osascript for macOS folder dialog
        script = '''
        tell application "System Events"
            activate
            set folderPath to choose folder with prompt "Select iLEAPP output folder"
            return POSIX path of folderPath
        end tell
        '''

        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            folder_path = result.stdout.strip()
            return FilePathResponse(
                file_path=folder_path,
                success=True,
                message="Folder selected successfully"
            )

        # Handle all error cases
        if result.returncode == 1 and "-128" in result.stderr:
            return FilePathResponse("", False, "User cancelled folder selection")
        return FilePathResponse("", False, f"Folder dialog error: {result.stderr}")

    except subprocess.TimeoutExpired:
        return FilePathResponse("", False, "Folder dialog timed out")
    except Exception as e:
        return FilePathResponse("", False, f"Failed to open folder dialog: {str(e)}")

@app.post("/api/process")
async def start_processing(request: ProcessRequest):
    """Start iLEAPP processing with simplified architecture."""
    try:
        # Validate input file exists
        if not os.path.exists(request.input_path):
            raise HTTPException(
                status_code=400,
                detail=f"Input file not found: {request.input_path}"
            )

        # Use user's output folder directly
        output_folder = request.output_folder
        task_id = output_folder.split('/')[-1]  # Use folder name as task ID

        # Detect file type for iLEAPP
        file_type = 'fs'
        if request.input_path.endswith(('.tar', '.tar.gz', '.tgz')):
            file_type = 'tar'
        elif request.input_path.endswith('.zip'):
            file_type = 'zip'

        # Build iLEAPP command
        ileapp_script = os.path.join(ILEAPP_PATH, "ileapp.py")
        cmd = [
            "python", ileapp_script,
            "-t", file_type,
            "-i", request.input_path,
            "-o", output_folder,
            "-tz", request.timezone_offset if request.timezone_offset else 'UTC'
        ]

        # Initialize task
        tasks[task_id] = {
            "queue": asyncio.Queue(),
            "status": "processing"
        }

        # Run iLEAPP as background task
        async def run_task():
            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    cwd=ILEAPP_PATH,
                    env={**os.environ, "PYTHONUNBUFFERED": "1"}
                )

                tasks[task_id]["process"] = process

                # Send initial messages
                await tasks[task_id]["queue"].put(f"Starting iLEAPP forensic analysis...")
                await tasks[task_id]["queue"].put(f"Processing: {os.path.basename(request.input_path)}")
                await tasks[task_id]["queue"].put(f"Output folder: {output_folder}")

                # Stream output directly to queue
                async for line in process.stdout:
                    line_text = line.decode().strip()
                    if line_text:
                        await tasks[task_id]["queue"].put(line_text)

                # Wait for completion
                await process.wait()
                await tasks[task_id]["queue"].put(f"Process completed with exit code: {process.returncode}")
                tasks[task_id]["status"] = "completed"

            except Exception as e:
                error_msg = f"Processing error: {str(e)}"
                await tasks[task_id]["queue"].put(error_msg)
                tasks[task_id]["status"] = "error"
                print(f"iLEAPP processing error: {e}")

        asyncio.create_task(run_task())

        return {
            "message": "iLEAPP processing started",
            "task_id": task_id,
            "status": "processing"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start processing: {str(e)}"
        )

@app.post("/api/process/stop/{task_id}")
async def stop_processing(task_id: str):
    """Stop a running iLEAPP processing task."""
    if task_id not in tasks or tasks[task_id]["status"] != "processing":
        raise HTTPException(status_code=404, detail="Task not found or not processing")

    try:
        # Kill the subprocess if it exists
        if "process" in tasks[task_id]:
            process = tasks[task_id]["process"]
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()

        # Send stop message and update status
        await tasks[task_id]["queue"].put("Processing stopped by user")
        tasks[task_id]["status"] = "stopped"

        return {
            "message": "Processing stopped successfully",
            "task_id": task_id,
            "status": "stopped"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to stop processing: {str(e)}"
        )

@app.get("/api/process/stream/{task_id}")
async def stream_processing_logs(task_id: str):
    """SSE endpoint for real-time iLEAPP processing logs."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_generator():
        queue = tasks[task_id]["queue"]

        while tasks[task_id]["status"] == "processing":
            message = await queue.get()
            yield f"data: {message}\n\n"

        # Send final status
        final_status = tasks[task_id]["status"]
        yield f"data: Processing {final_status}\n\n"
        yield f"event: close\ndata: Stream ended\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)