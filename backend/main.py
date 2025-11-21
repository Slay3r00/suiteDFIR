from fastapi import FastAPI, HTTPException
import shutil
import zipfile
from pathlib import Path
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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
import sqlite3
import json
from datetime import datetime

# Tool Configuration - Add new tools here
TOOLS_CONFIG = {
    "ileapp": {
        "name": "iLEAPP",
        "path": os.path.join(os.path.dirname(__file__), "forensic-tools", "leapp-tools", "iLEAPP"),
        "script": "ileapp.py",
        "profile_ext": ".ilprofile",
        "description": "iOS Logs, Events, And Plist Parser",
        "excluded_modules": {'iTunesBackupInfo', 'last_build', 'logarchive'}
    },
    "aleapp": {
        "name": "aLEAPP",
        "path": os.path.join(os.path.dirname(__file__), "forensic-tools", "leapp-tools", "ALEAPP"),
        "script": "aleapp.py",
        "profile_ext": ".alprofile",
        "description": "Android Logs, Events, And Protobuf Parser",
        "excluded_modules": set()  # No known modules to exclude for aLEAPP yet
    }
}

DB_PATH = os.path.join(os.path.dirname(__file__), "profiles.db")

def init_database():
    """Initialize SQLite database for profiles"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if tool column exists
    cursor.execute("PRAGMA table_info(profiles)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'tool' not in columns and 'profiles' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE profiles ADD COLUMN tool TEXT DEFAULT "ileapp"')
        print("Migrated profiles table to include tool column")
    
    # Create table if doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            tool TEXT NOT NULL DEFAULT 'ileapp',
            modules_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, tool)
        )
    ''')
    conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all configured forensic tool plugins on startup"""
    global plugin_loaders, available_modules
    try:
        # Initialize database first
        init_database()
        print("Database initialized")

        # Initialize each configured tool
        for tool_id, config in TOOLS_CONFIG.items():
            try:
                tool_path = config["path"]
                if not os.path.exists(tool_path):
                    print(f"Warning: {config['name']} path not found: {tool_path}")
                    continue

                # Add tool to Python path
                if tool_path not in sys.path:
                    sys.path.insert(0, tool_path)

                # Save current directory
                original_dir = os.getcwd()
                
                # Change to tool directory for imports
                os.chdir(tool_path)

                # CRITICAL: Clear scripts from sys.modules to prevent caching between tools
                # This ensures we load the correct plugin_loader for the current tool
                for module_name in list(sys.modules.keys()):
                    if module_name.startswith('scripts'):
                        del sys.modules[module_name]

                # Import tool's modules
                import scripts.plugin_loader as plugin_loader_module
                import scripts.modules_to_exclude as modules_to_exclude

                plugin_loader = plugin_loader_module.PluginLoader()
                plugin_loaders[tool_id] = plugin_loader

                # Load modules with simplified logic
                excluded_modules = config['excluded_modules']
                plugins_list = list(plugin_loader.plugins)
                tool_modules = {}

                for plugin in plugins_list:
                    if plugin.module_name in excluded_modules:
                        continue

                    plugin_enabled = plugin.module_name not in modules_to_exclude.modules_to_exclude
                    plugin_module_name = plugin.artifact_info.get('name', plugin.name) if hasattr(plugin, 'artifact_info') else plugin.name

                    tool_modules[plugin.name] = {
                        'category': plugin.category,
                        'display_name': plugin_module_name,
                        'module_name': plugin.module_name,
                        'enabled': plugin_enabled,
                        'selected': plugin_enabled
                    }

                available_modules[tool_id] = tool_modules
                print(f"Loaded {len(tool_modules)} {config['name']} modules")

                # Restore original directory
                os.chdir(original_dir)

            except Exception as e:
                print(f"Failed to initialize {config['name']} plugins: {e}")
                import traceback
                traceback.print_exc()

    except Exception as e:
        print(f"Failed to initialize forensic tools: {e}")

    yield

    # Cleanup on shutdown (if needed)
    print("Shutting down forensic tools server...")


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

class Profile(BaseModel):
    id: int
    name: str
    modules: List[str]
    created_at: str

class ProfileCreate(BaseModel):
    name: str
    modules: List[str]

class Report(BaseModel):
    name: str
    path: str
    tool: str
    created_at: str
    size: str
    artifact_count: int


# Unified task management
tasks = {}

# Global variables for plugin management (per-tool)
plugin_loaders = {}  # {"ileapp": PluginLoader, "aleapp": PluginLoader}
available_modules = {}  # {"ileapp": {...}, "aleapp": {...}}

@app.get("/")
async def root():
    total_modules = sum(len(modules) for modules in available_modules.values())
    return {
        "message": "Forensic Tools Web API is running",
        "tools": list(TOOLS_CONFIG.keys()),
        "modules_loaded": total_modules
    }

@app.get("/health")
async def health_check():
    tools_status = {tool: len(plugin_loaders.get(tool, {}) or {}) > 0 for tool in TOOLS_CONFIG.keys()}
    return {
        "status": "healthy",
        "tools_initialized": tools_status
    }

@app.get("/api/{tool}/modules")
async def get_modules(tool: str):
    """Get list of available modules for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found. Available tools: {list(TOOLS_CONFIG.keys())}")
    
    if tool not in available_modules or not available_modules[tool]:
        raise HTTPException(status_code=503, detail=f"{TOOLS_CONFIG[tool]['name']} modules not loaded")

    # Convert to format expected by frontend
    modules_list = []
    for name, info in available_modules[tool].items():
        modules_list.append({
            'name': name,
            'category': info['category'],
            'display_name': info['display_name'],
            'module_name': info['module_name'],
            'enabled': info['enabled'],
            'selected': info['selected']
        })

    return {"modules": modules_list, "total": len(modules_list)}

@app.post("/api/{tool}/modules/select")
async def select_modules(tool: str, module_selections: Dict[str, bool]):
    """Update module selection state for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    if tool not in available_modules:
        raise HTTPException(status_code=503, detail=f"{TOOLS_CONFIG[tool]['name']} not initialized")

    for module_name, selected in module_selections.items():
        if module_name in available_modules[tool]:
            available_modules[tool][module_name]['selected'] = selected

    selected_count = sum(1 for info in available_modules[tool].values() if info['selected'])
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
            return FilePathResponse(file_path="", success=False, message="User cancelled file selection")
        return FilePathResponse(file_path="", success=False, message=f"File dialog error: {result.stderr}")

    except subprocess.TimeoutExpired:
        return FilePathResponse(file_path="", success=False, message="File dialog timed out")
    except Exception as e:
        return FilePathResponse(file_path="", success=False, message=f"Failed to open file dialog: {str(e)}")

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
            return FilePathResponse(file_path="", success=False, message="User cancelled folder selection")
        return FilePathResponse(file_path="", success=False, message=f"Folder dialog error: {result.stderr}")

    except subprocess.TimeoutExpired:
        return FilePathResponse(file_path="", success=False, message="Folder dialog timed out")
    except Exception as e:
        return FilePathResponse(file_path="", success=False, message=f"Failed to open folder dialog: {str(e)}")

@app.post("/api/{tool}/process")
async def start_processing(tool: str, request: ProcessRequest):
    """Start forensic tool processing with simplified architecture."""
    try:
        # Validate input file exists
        if not os.path.exists(request.input_path):
            raise HTTPException(
                status_code=400,
                detail=f"Input file not found: {request.input_path}"
            )

        # Validate tool
        if tool not in TOOLS_CONFIG:
            raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
        
        config = TOOLS_CONFIG[tool]
        tool_path = config["path"]

        # Use user's output folder directly
        output_folder = request.output_folder
        task_id = output_folder.split('/')[-1]  # Use folder name as task ID

        # Detect file type
        file_type = 'fs'
        if request.input_path.endswith(('.tar', '.tar.gz', '.tgz')):
            file_type = 'tar'
        elif request.input_path.endswith('.zip'):
            file_type = 'zip'

        # Create temporary profile file
        import tempfile
        
        # Filter out disabled modules if any
        modules_to_run = request.selected_modules
        
        print(f"DEBUG: Received {len(modules_to_run)} selected modules from frontend")
        print(f"DEBUG: Sample modules (first 5): {modules_to_run[:5] if len(modules_to_run) > 0 else 'none'}")
        
        # CRITICAL: Filter out modules that don't belong to this tool
        # This prevents iOS modules from being sent to Android and vice versa
        if tool in available_modules:
            valid_plugin_names = set(available_modules[tool].keys())
            
            # DEBUG: Check for iOS-specific modules in aLEAPP list
            ios_modules_in_list = [m for m in modules_to_run if 'safari' in m.lower() or 'apple' in m.lower() or 'userDefaults' in m]
            if ios_modules_in_list and tool == 'aleapp':
                print(f"DEBUG: WARNING - Found iOS modules in request for aLEAPP: {ios_modules_in_list[:5]}")
                print(f"DEBUG: Checking if they're in aLEAPP's available_modules...")
                for ios_mod in ios_modules_in_list[:3]:
                    print(f"DEBUG: '{ios_mod}' in aleapp modules? {ios_mod in valid_plugin_names}")
            
            filtered_modules = [m for m in modules_to_run if m in valid_plugin_names]
            
            if len(filtered_modules) != len(modules_to_run):
                print(f"DEBUG: Filtered out {len(modules_to_run) - len(filtered_modules)} invalid modules for {tool}")
                print(f"DEBUG: Invalid modules were probably from the other tool")
            
            modules_to_run = filtered_modules
            print(f"DEBUG: After filtering: {len(modules_to_run)} valid modules")
        
        profile_data = {
            "leapp": tool,
            "format_version": 1,
            "plugins": modules_to_run
        }
        
        print(f"DEBUG: Profile will contain {len(modules_to_run)} modules")
        print(f"DEBUG: Sample profile modules (first 10): {modules_to_run[:10] if len(modules_to_run) > 0 else 'none'}")
        
        # Create a temporary file for the profile
        # We use delete=False so we can pass the path to the subprocess
        # It should be cleaned up after the process finishes
        with tempfile.NamedTemporaryFile(mode='w', suffix=config['profile_ext'], delete=False) as tmp_profile:
            json.dump(profile_data, tmp_profile)
            tmp_profile_path = tmp_profile.name
            
        # Debug: Show the actual profile file path so we can inspect it
        print(f"DEBUG: Profile written to: {tmp_profile_path}")

        # Build command
        tool_script = os.path.join(tool_path, config["script"])
        cmd = [
            "python", tool_script,
            "-t", file_type,
            "-i", request.input_path,
            "-o", output_folder,
            "-m", tmp_profile_path
        ]
        
        # TODO: Timezone argument causes argparse conflicts in some LEAPP tools
        # Commenting out until we can determine the correct long-form flag
        # if request.timezone_offset and request.timezone_offset.strip():
        #     cmd.extend(["-tz", request.timezone_offset])

        # Debug: Print the exact command being run
        print(f"DEBUG: Executing command for {config['name']}: {' '.join(cmd)}")

        # Initialize task
        tasks[task_id] = {
            "queue": asyncio.Queue(),
            "status": "processing",
            "profile_path": tmp_profile_path,  # Store path for cleanup
            "created_report_path": None  # Store report path for cleanup on stop
        }

        # Run iLEAPP as background task
        async def run_task():
            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    cwd=tool_path,
                    env={**os.environ, "PYTHONUNBUFFERED": "1"}
                )

                tasks[task_id]["process"] = process

                # Send initial messages
                await tasks[task_id]["queue"].put(f"Starting {config['name']} forensic analysis...")
                await tasks[task_id]["queue"].put(f"Processing: {os.path.basename(request.input_path)}")
                await tasks[task_id]["queue"].put(f"Output folder: {output_folder}")
                await tasks[task_id]["queue"].put(f"Selected modules: {len(modules_to_run)}")

                # Stream output directly to queue
                async for line in process.stdout:
                    line_text = line.decode().strip()
                    if line_text:
                        # Capture report location for potential cleanup
                        if "Report location:" in line_text:
                            try:
                                report_path = line_text.split("Report location:", 1)[1].strip()
                                tasks[task_id]["created_report_path"] = report_path
                                print(f"DEBUG: Captured report path: {report_path}")
                            except Exception as e:
                                print(f"DEBUG: Failed to parse report path: {e}")

                        # Filter out banner lines (tool-agnostic filtering)
                        if any(x in line_text for x in [
                            "LEAPP v",
                            "Objective: Triage",
                            "By: Alexis Brignoni",
                            "By: Yogesh Khatri",
                            "--------------------------------------------------------------------------------------"
                        ]):
                            continue
                        
                        await tasks[task_id]["queue"].put(line_text)
                        
                        # DEBUG: Print line to console to verify what we're seeing
                        if "Report location" in line_text:
                            print(f"DEBUG: Found report location line: '{line_text}'")
                        
                # Wait for completion
                await process.wait()
                await tasks[task_id]["queue"].put(f"Process completed with exit code: {process.returncode}")
                tasks[task_id]["status"] = "completed"

            except Exception as e:
                error_msg = f"Processing error: {str(e)}"
                await tasks[task_id]["queue"].put(error_msg)
                tasks[task_id]["status"] = "error"
                print(f"{config['name']} processing error: {e}")
            
            finally:
                # Cleanup temporary profile file
                if os.path.exists(tmp_profile_path):
                    try:
                        os.unlink(tmp_profile_path)
                    except Exception as e:
                        print(f"Failed to delete temp profile: {e}")

        asyncio.create_task(run_task())

        return {
            "message": f"{config['name']} processing started",
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

        # CLEANUP: Delete partial report directory if it exists
        report_path = tasks[task_id].get("created_report_path")
        if report_path and os.path.exists(report_path):
            try:
                shutil.rmtree(report_path)
                await tasks[task_id]["queue"].put(f"Deleted incomplete report: {os.path.basename(report_path)}")
                print(f"DEBUG: Deleted incomplete report at {report_path}")
            except Exception as e:
                error_msg = f"Failed to delete incomplete report: {e}"
                await tasks[task_id]["queue"].put(error_msg)
                print(f"DEBUG: {error_msg}")

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

# Profile Management Endpoints

@app.get("/api/{tool}/profiles", response_model=List[Profile])
async def get_profiles(tool: str):
    """Get list of all saved profiles for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, modules_json, created_at FROM profiles WHERE tool = ? ORDER BY created_at DESC', (tool,))
        rows = cursor.fetchall()
        conn.close()

        profiles = []
        for row in rows:
            profiles.append(Profile(
                id=row[0],
                name=row[1],
                modules=json.loads(row[2]),
                created_at=row[3]
            ))

        return profiles
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profiles: {str(e)}")

@app.post("/api/{tool}/profiles", response_model=Profile)
async def create_profile(tool: str, profile: ProfileCreate):
    """Create a new profile for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        modules_json = json.dumps(profile.modules)

        cursor.execute(
            'INSERT INTO profiles (name, tool, modules_json) VALUES (?, ?, ?)',
            (profile.name, tool, modules_json)
        )
        profile_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return Profile(
            id=profile_id,
            name=profile.name,
            modules=profile.modules,
            created_at=datetime.now().isoformat()
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Profile with this name already exists")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create profile: {str(e)}")

@app.post("/api/{tool}/profiles/{profile_id}/load")
async def load_profile(tool: str, profile_id: int):
    """Load a profile's module selection for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    global available_modules

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT name, modules_json FROM profiles WHERE id = ? AND tool = ?', (profile_id, tool))
        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile_name, modules_json = row
        selected_modules = json.loads(modules_json)

        # Update global available_modules with profile selection for this tool
        if tool in available_modules:
            for module_name in available_modules[tool]:
                available_modules[tool][module_name]['selected'] = module_name in selected_modules

        return {
            "message": f"Loaded profile: {profile_name}",
            "profile_id": profile_id,
            "selected_count": len(selected_modules)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load profile: {str(e)}")

@app.delete("/api/{tool}/profiles/{profile_id}")
async def delete_profile(tool: str, profile_id: int):
    """Delete a profile for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM profiles WHERE id = ? AND tool = ?', (profile_id, tool))
        conn.commit()
        rows_affected = cursor.rowcount
        conn.close()

        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {"message": "Profile deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete profile: {str(e)}")

# Reports Management Endpoints

def get_size_format(b, factor=1024, suffix="B"):
    """Scale bytes to its proper format"""
    for unit in ["", "K", "M", "G", "T", "P", "E", "Z"]:
        if b < factor:
            return f"{b:.2f}{unit}{suffix}"
        b /= factor
    return f"{b:.2f}Y{suffix}"

@app.get("/api/reports", response_model=List[Report])
async def get_reports():
    """Scan report directories and return list of reports"""
    reports = []
    
    report_dirs = {
        "ileapp": os.path.join(os.path.dirname(__file__), "reports", "ileapp-reports"),
        "aleapp": os.path.join(os.path.dirname(__file__), "reports", "aleapp-reports")
    }

    for tool, base_path in report_dirs.items():
        if not os.path.exists(base_path):
            continue

        try:
            # Scan directory
            with os.scandir(base_path) as entries:
                for entry in entries:
                    if entry.is_dir():
                        try:
                            # Get stats
                            stats = entry.stat()
                            created_at = datetime.fromtimestamp(stats.st_ctime).isoformat()
                            
                            # Calculate size
                            total_size = 0
                            file_count = 0
                            for dirpath, dirnames, filenames in os.walk(entry.path):
                                for f in filenames:
                                    fp = os.path.join(dirpath, f)
                                    if not os.path.islink(fp):
                                        total_size += os.path.getsize(fp)
                                    file_count += 1
                            
                            reports.append(Report(
                                name=entry.name,
                                path=entry.path,
                                tool=tool,
                                created_at=created_at,
                                size=get_size_format(total_size),
                                artifact_count=file_count
                            ))
                        except Exception as e:
                            print(f"Error processing report {entry.name}: {e}")
                            continue
        except Exception as e:
            print(f"Error scanning {tool} reports: {e}")

    # Sort by creation date desc
    reports.sort(key=lambda x: x.created_at, reverse=True)
    return reports

@app.delete("/api/reports")
async def delete_report(path: str):
    """Delete a report directory"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Security check: ensure path is within reports directory
    reports_base = os.path.join(os.path.dirname(__file__), "reports")
    if not os.path.abspath(path).startswith(os.path.abspath(reports_base)):
        raise HTTPException(status_code=403, detail="Invalid report path")

    try:
        shutil.rmtree(path)
        return {"message": "Report deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")

@app.post("/api/reports/open")
async def open_report(path: str):
    """Open report folder in system file explorer"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        if platform.system() == "Darwin":  # macOS
            subprocess.run(["open", path])
        elif platform.system() == "Windows":
            os.startfile(path)
        else:  # Linux
            subprocess.run(["xdg-open", path])
        return {"message": "Report opened successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open report: {str(e)}")

@app.get("/api/reports/download")
async def download_report(path: str):
    """Zip and download report directory"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        # Create zip in temp location
        import tempfile
        temp_dir = tempfile.mkdtemp()
        zip_name = f"{os.path.basename(path)}.zip"
        zip_path = os.path.join(temp_dir, zip_name)
        
        shutil.make_archive(os.path.splitext(zip_path)[0], 'zip', path)
        
        return FileResponse(
            zip_path,
            media_type='application/zip',
            filename=zip_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download report: {str(e)}")

# Mount static reports directories (MUST be last to avoid catching API routes)
reports_base = os.path.join(os.path.dirname(__file__), "reports")
app.mount("/reports/ileapp", StaticFiles(directory=os.path.join(reports_base, "ileapp-reports")), name="ileapp-reports")
app.mount("/reports/aleapp", StaticFiles(directory=os.path.join(reports_base, "aleapp-reports")), name="aleapp-reports")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)