from fastapi import FastAPI, HTTPException, BackgroundTasks
import shutil
import zipfile
from pathlib import Path
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
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

DB_PATH = os.path.join(os.path.dirname(__file__), "vdf_tools.db")

def init_database():
    """Initialize SQLite database for profiles and reports"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if tool column exists in profiles
    cursor.execute("PRAGMA table_info(profiles)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'tool' not in columns and 'profiles' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE profiles ADD COLUMN tool TEXT DEFAULT "ileapp"')
        print("Migrated profiles table to include tool column")
    
    # Check if progress column exists in backups
    cursor.execute("PRAGMA table_info(backups)")
    backup_columns = [col[1] for col in cursor.fetchall()]
    
    if 'progress' not in backup_columns and 'backups' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE backups ADD COLUMN progress INTEGER DEFAULT 0')
        print("Migrated backups table to include progress column")

    # Check if priority column exists in tasks
    cursor.execute("PRAGMA table_info(tasks)")
    task_columns = [col[1] for col in cursor.fetchall()]
    
    if 'priority' not in task_columns and 'tasks' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT "medium"')
        print("Migrated tasks table to include priority column")

    # Check if password column exists in backups
    cursor.execute("PRAGMA table_info(backups)")
    backup_columns = [col[1] for col in cursor.fetchall()]
    
    if 'password' not in backup_columns and 'backups' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE backups ADD COLUMN password TEXT')
        print("Migrated backups table to include password column")
    
    # Create profiles table if doesn't exist
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

    # Create reports table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            tool TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create backups table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            device_udid TEXT NOT NULL,
            device_name TEXT NOT NULL,
            path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL,
            size TEXT,
            progress INTEGER DEFAULT 0,
            type TEXT DEFAULT 'ios',
            password TEXT
        )
    ''')
    
    # Migration: Add type column if it doesn't exist
    cursor.execute("PRAGMA table_info(backups)")
    columns = [info[1] for info in cursor.fetchall()]
    if 'type' not in columns:
        print("Migrating database: Adding type column to backups table")
        cursor.execute("ALTER TABLE backups ADD COLUMN type TEXT DEFAULT 'ios'")

    # Create tasks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            completed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create notes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Migration: Add description column to tasks if it doesn't exist
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [info[1] for info in cursor.fetchall()]
    if 'description' not in columns:
        print("Migrating database: Adding description column to tasks table")
        cursor.execute("ALTER TABLE tasks ADD COLUMN description TEXT")

    # Migration: Add description column to notes if it doesn't exist
    cursor.execute("PRAGMA table_info(notes)")
    columns = [info[1] for info in cursor.fetchall()]
    if 'description' not in columns:
        print("Migrating database: Adding description column to notes table")
        cursor.execute("ALTER TABLE notes ADD COLUMN description TEXT")

    conn.commit()
    conn.close()




@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all configured forensic tool plugins on startup"""
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
                # We must remove 'scripts' AND all submodules (e.g. scripts.plugin_loader)
                modules_to_remove = [m for m in sys.modules if m == 'scripts' or m.startswith('scripts.')]
                for m in modules_to_remove:
                    del sys.modules[m]
                
                # Import plugin_loader from the tool
                import scripts.plugin_loader as plugin_loader
                import scripts.modules_to_exclude as modules_to_exclude
                
                # Load modules
                print(f"Loading {config['name']} modules from {tool_path}...")
                loader = plugin_loader.PluginLoader()
                plugin_loaders[tool_id] = loader
                
                # Process plugins into a dictionary
                tool_modules = {}
                excluded_modules = config['excluded_modules']
                
                # loader.plugins is a list of plugin objects
                for plugin in loader.plugins:
                    if plugin.module_name in excluded_modules:
                        continue
                        
                    # Check if module is enabled in modules_to_exclude
                    # Note: modules_to_exclude might be a list or dict depending on tool version
                    # We'll assume if it's in the list, it's excluded (or maybe enabled? logic was: plugin_enabled = plugin.module_name not in modules_to_exclude.modules_to_exclude)
                    plugin_enabled = True
                    if hasattr(modules_to_exclude, 'modules_to_exclude'):
                        plugin_enabled = plugin.module_name not in modules_to_exclude.modules_to_exclude
                    
                    # Get display name
                    plugin_display_name = plugin.name
                    if hasattr(plugin, 'artifact_info'):
                        plugin_display_name = plugin.artifact_info.get('name', plugin.name)
                        
                    tool_modules[plugin.name] = {
                        "name": plugin.name,
                        "category": plugin.category,
                        "display_name": plugin_display_name,
                        "module_name": plugin.module_name,
                        "enabled": plugin_enabled,
                        "selected": plugin_enabled # Default to selected
                    }
                
                available_modules[tool_id] = tool_modules
                print(f"Loaded {len(tool_modules)} {config['name']} modules")

                # Restore directory
                os.chdir(original_dir)

            except Exception as e:
                print(f"Error loading {config['name']} modules: {e}")
                # Restore directory if error occurred
                if 'original_dir' in locals():
                    os.chdir(original_dir)

        yield
    finally:
        # Cleanup (if needed)
        pass

app = FastAPI(lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount reports directory to serve HTML reports
# We mount the parent directory of reports so we can access both ileapp and aleapp reports
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")
if not os.path.exists(REPORTS_DIR):
    os.makedirs(REPORTS_DIR)

# Mount specific report directories if they exist, or create them
for tool in TOOLS_CONFIG:
    tool_report_dir = os.path.join(REPORTS_DIR, f"{tool}-reports")
    if not os.path.exists(tool_report_dir):
        os.makedirs(tool_report_dir)
    
    # Mount each tool's report directory
    # This allows accessing /ileapp-reports/... and /aleapp-reports/...
    app.mount(f"/{tool}-reports", StaticFiles(directory=tool_report_dir), name=f"{tool}-reports")

# Also mount the root reports directory for convenience if needed
app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")

# Pydantic models for request/response

class Profile(BaseModel):
    id: int
    name: str
    tool: str
    modules: List[str]

class ProcessRequest(BaseModel):
    input_path: str
    output_folder: str
    selected_modules: List[str]
    timezone_offset: str = "UTC"
    report_name: str = ""  # Optional custom report name
    password: str = ""  # Optional backup password

class ValidateBackupRequest(BaseModel):
    input_path: str

class FilePathResponse(BaseModel):
    file_path: str
    success: bool
    message: str

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

class Task(BaseModel):
    id: int
    content: str
    description: Optional[str] = None
    priority: str
    completed: bool
    created_at: str

class TaskCreate(BaseModel):
    content: str
    description: Optional[str] = None
    priority: str = "medium"

class Note(BaseModel):
    id: int
    content: str
    description: Optional[str] = None
    created_at: str

class NoteCreate(BaseModel):
    content: str
    description: Optional[str] = None


# Global state
plugin_loaders = {}
available_modules = {}
tasks = {}
backup_tasks = {}
active_backups = {}

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
    """Get available modules for a specific tool"""
    if tool not in available_modules:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    # Convert dictionary values to list for frontend
    modules = list(available_modules[tool].values())
    return {"modules": modules, "total": len(modules)}

@app.post("/api/{tool}/modules/select")
async def select_modules(tool: str, module_selections: Dict[str, bool]):
    """Update module selection state for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    if tool not in available_modules:
        raise HTTPException(status_code=503, detail=f"{TOOLS_CONFIG[tool]['name']} not initialized")

    # The new `available_modules` structure is a dict of Plugin objects, not dicts with 'selected' key.
    # This endpoint will now just acknowledge the selection, the actual filtering happens in `start_processing`.
    # If we wanted to persist selection state, we'd need to modify the Plugin objects or store state elsewhere.
    # For now, we'll just return a success message.
    selected_count = sum(1 for module_name, selected in module_selections.items() if selected and module_name in available_modules[tool])
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

@app.post("/api/ios/validate-backup")
async def validate_backup(request: ValidateBackupRequest):
    """Check if an iOS backup is encrypted."""
    if not os.path.exists(request.input_path):
        raise HTTPException(status_code=400, detail="Input path does not exist")

    try:
        # Run the check_encryption.py script
        result = subprocess.run(
            [sys.executable, "check_encryption.py", request.input_path],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Validation script failed: {result.stderr}")
            
        try:
            data = json.loads(result.stdout)
            return data
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail=f"Invalid JSON from validation script: {result.stdout}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

        # Determine output folder
        if request.output_folder:
            output_folder = request.output_folder
        else:
            # Default to tool-specific report directory
            # Use tool ID (lowercase) for consistency with init logic
            output_folder = os.path.join(REPORTS_DIR, f"{tool}-reports")
        task_id = output_folder.split('/')[-1]  # Use folder name as task ID

        # Detect file type
        file_type = 'fs'
        if request.input_path.endswith(('.tar', '.tar.gz', '.tgz')):
            file_type = 'tar'
        elif request.input_path.endswith('.zip'):
            file_type = 'zip'
        elif os.path.isdir(request.input_path):
            # Check if it's an iTunes backup
            manifest_path = os.path.join(request.input_path, 'Manifest.db')
            info_path = os.path.join(request.input_path, 'Info.plist')
            if os.path.exists(manifest_path) and os.path.exists(info_path):
                file_type = 'itunes'

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
            print(f"DEBUG: {tool} has {len(valid_plugin_names)} valid plugins")
            print(f"DEBUG: Sample valid plugins: {list(valid_plugin_names)[:5]}")
            
            # DEBUG: Check for iOS-specific modules in aLEAPP list
            ios_modules_in_list = [m for m in modules_to_run if 'safari' in m.lower() or 'apple' in m.lower() or 'userDefaults' in m]
            if ios_modules_in_list and tool == 'aleapp':
                print(f"DEBUG: WARNING - Found iOS modules in request for aLEAPP: {ios_modules_in_list[:5]}")
                
            filtered_modules = [m for m in modules_to_run if m in valid_plugin_names]
            
            if len(filtered_modules) != len(modules_to_run):
                print(f"DEBUG: Filtered out {len(modules_to_run) - len(filtered_modules)} invalid modules for {tool}")
                print(f"DEBUG: Invalid modules were probably from the other tool")
                # Print first 5 invalid modules to see what they are
                invalid_modules = [m for m in modules_to_run if m not in valid_plugin_names]
                print(f"DEBUG: Sample invalid modules: {invalid_modules[:5]}")
            
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
            sys.executable, tool_script,
            "-t", file_type,
            "-i", request.input_path,
            "-o", output_folder,
            "-m", tmp_profile_path
        ]
        
        # Add password if provided (only for iLEAPP)
        if tool == 'ileapp' and request.password:
            cmd.extend(["--itunes_password", request.password])
        
        # TODO: Timezone argument causes argparse conflicts in some LEAPP tools
        # Commenting out until we can determine the correct long-form flag
        # if request.timezone_offset and request.timezone_offset.strip():
        #     cmd.extend(["-tz", request.timezone_offset])

        # Debug: Print the exact command being run
        print(f"DEBUG: Executing command for {config['name']}: {' '.join(cmd)}")

        # Store active tasks and their status/queues

        tasks[task_id] = {
            "queue": asyncio.Queue(),
            "status": "processing",
            "profile_path": tmp_profile_path,  # Store path for cleanup
            "output_folder": output_folder,
            "start_time": datetime.now().timestamp(),
            "report_name": request.report_name,
            "tool": tool
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
                if request.report_name:
                    await tasks[task_id]["queue"].put(f"Report Name: {request.report_name}")

                # Stream output directly to queue
                async for line in process.stdout:
                    line_text = line.decode().strip()
                    if line_text:
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

                # SAVE REPORT TO DB if successful and name provided
                if process.returncode == 0 and request.report_name:
                    try:
                        # Find the created report folder
                        # It should be the newest folder in output_folder matching the pattern
                        newest_report = None
                        # Scan for the report directory that was just created
                        # We look for directories created after start_time
                        with os.scandir(output_folder) as entries:
                            for entry in entries:
                                if entry.is_dir() and entry.name.startswith(('iLEAPP_Reports_', 'aLEAPP_Reports_', 'ALEAPP_Reports_', 'RLEAPP_Reports_', 'tLEAPP_Reports_')):
                                    # Check creation time
                                    # Allow for a small buffer (e.g. 1 second) due to filesystem resolution
                                    if entry.stat().st_ctime >= tasks[task_id]["start_time"] - 1.0:
                                        newest_report = entry.path
                                        break
                        
                        if newest_report:
                            conn = sqlite3.connect(DB_PATH)
                            cursor = conn.cursor()
                            cursor.execute(
                                "INSERT INTO reports (name, path, tool) VALUES (?, ?, ?)",
                                (request.report_name, newest_report, tool)
                            )
                            conn.commit()
                            conn.close()
                            print(f"DEBUG: Saved report '{request.report_name}' to DB for path: {newest_report}")
                            await tasks[task_id]["queue"].put(f"Report saved as: {request.report_name}")
                        else:
                            print("DEBUG: Could not find created report folder to save to DB")
                    except Exception as e:
                        print(f"DEBUG: Failed to save report to DB: {e}")

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
        output_folder = tasks[task_id].get("output_folder")
        start_time = tasks[task_id].get("start_time")
        
        if output_folder and start_time and os.path.exists(output_folder):
            try:
                # Check for any new report directories created after start_time
                for item in os.listdir(output_folder):
                    item_path = os.path.join(output_folder, item)
                    if os.path.isdir(item_path):
                        # Check if it looks like a LEAPP report
                        if item.startswith(('iLEAPP_Reports_', 'aLEAPP_Reports_', 'RLEAPP_Reports_', 'tLEAPP_Reports_')):
                            # Check creation time
                            try:
                                ctime = os.path.getctime(item_path)
                                # Allow for a small time difference (e.g. if folder created immediately)
                                if ctime >= start_time - 1.0:
                                    shutil.rmtree(item_path)
                                    await tasks[task_id]["queue"].put(f"Deleted incomplete report: {item}")
                                    print(f"DEBUG: Deleted incomplete report at {item_path}")
                            except Exception as e:
                                print(f"DEBUG: Error checking/deleting {item}: {e}")
            except Exception as e:
                error_msg = f"Failed to cleanup reports: {e}"
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
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, tool, modules_json FROM profiles WHERE tool = ?", (tool,))
    profiles = []
    for row in cursor.fetchall():
        profiles.append(Profile(
            id=row[0],
            name=row[1],
            tool=row[2],
            modules=json.loads(row[3])
        ))
    conn.close()
    return profiles

@app.post("/api/{tool}/profiles")
async def save_profile(tool: str, profile: ProfileCreate):
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
            tool=tool,
            modules=profile.modules
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
    
    # The actual loading of modules into the UI is handled by the frontend
    # This endpoint primarily serves to fetch the profile data.
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
        
        # Update available_modules state
        if tool in available_modules:
            # Convert list to set for faster lookup
            selected_set = set(selected_modules)
            
            for module_name, module_data in available_modules[tool].items():
                # Update selected status
                module_data["selected"] = module_name in selected_set

        return {
            "message": f"Loaded profile: {profile_name}",
            "profile_id": profile_id,
            "selected_count": len(selected_modules),
            "modules": selected_modules # Return modules for frontend to update
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
    """Get list of reports from database"""
    reports = []
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get all reports from DB
        cursor.execute('SELECT name, path, tool, created_at FROM reports ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        
        for row in rows:
            name, path, tool, created_at = row
            
            # Verify path exists
            if not os.path.exists(path):
                # Handle case mismatch for aLEAPP reports (DB has aLEAPP-reports, disk has aleapp-reports)
                if 'aLEAPP-reports' in path:
                    alt_path = path.replace('aLEAPP-reports', 'aleapp-reports')
                    if os.path.exists(alt_path):
                        print(f"DEBUG: Found report at alternate path: {alt_path}")
                        path = alt_path
                    else:
                        print(f"DEBUG: Report path not found: {path}")
                        continue
                else:
                    print(f"DEBUG: Report path not found: {path}")
                    continue
            
            print(f"DEBUG: Found report: {name} ({tool}) at {path}")
                
            try:
                # Calculate size and file count
                total_size = 0
                file_count = 0
                for dirpath, dirnames, filenames in os.walk(path):
                    for f in filenames:
                        fp = os.path.join(dirpath, f)
                        if not os.path.islink(fp):
                            total_size += os.path.getsize(fp)
                        file_count += 1
                
                reports.append(Report(
                    name=name,
                    path=path,
                    tool=tool,
                    created_at=created_at,
                    size=get_size_format(total_size),
                    artifact_count=file_count
                ))
            except Exception as e:
                print(f"Error processing report {name}: {e}")
                continue
                
    except Exception as e:
        print(f"Error fetching reports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

    return reports

@app.delete("/api/reports")
async def delete_report(path: str):
    """Delete a report from database and filesystem"""
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")
    
    # Security check: ensure path is within reports directory
    if not os.path.abspath(path).startswith(os.path.abspath(REPORTS_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Delete from DB first
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM reports WHERE path = ?", (path,))
        conn.commit()
        conn.close()

        # Delete from filesystem
        if os.path.exists(path):
            shutil.rmtree(path)
            return {"message": "Report deleted successfully"}
        else:
            return {"message": "Report deleted from DB (file not found on disk)"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")

# Backup Management
BACKUPS_DIR = os.path.join(os.path.dirname(__file__), "backups", "libimobile")
os.makedirs(BACKUPS_DIR, exist_ok=True)

# Global dictionary to store active backup processes
# Key: backup_id, Value: asyncio.subprocess.Process
active_backups: Dict[int, asyncio.subprocess.Process] = {}

class BackupRequest(BaseModel):
    udid: str
    name: str
    password: Optional[str] = None

def get_connected_devices():
    """Get list of connected iOS devices"""
    devices = []
    try:
        # Get UDIDs
        result = subprocess.run(['idevice_id', '-l'], capture_output=True, text=True)
        if result.returncode == 0:
            udids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
            
            for udid in udids:
                # Get device name
                name_result = subprocess.run(['ideviceinfo', '-u', udid, '-k', 'DeviceName'], capture_output=True, text=True)
                device_name = name_result.stdout.strip() if name_result.returncode == 0 else "Unknown Device"
                
                # Get product type (e.g. iPhone12,1)
                type_result = subprocess.run(['ideviceinfo', '-u', udid, '-k', 'ProductType'], capture_output=True, text=True)
                product_type = type_result.stdout.strip() if type_result.returncode == 0 else "Unknown Type"
                
                # Check encryption status
                enc_result = subprocess.run(['ideviceinfo', '-u', udid, '-q', 'com.apple.mobile.backup'], capture_output=True, text=True)
                is_encrypted = False
                if enc_result.returncode == 0:
                    output = enc_result.stdout
                    if "WillEncrypt: true" in output or "RequiresEncryption: 1" in output:
                        is_encrypted = True

                devices.append({
                    "udid": udid,
                    "name": device_name,
                    "type": product_type,
                    "is_encrypted": is_encrypted
                })
    except Exception as e:
        print(f"Error getting devices: {e}")
        
    return devices

@app.get("/api/ios/devices")
async def list_devices():
    """List connected iOS devices"""
    return get_connected_devices()

async def run_backup_process(backup_id: int, udid: str, backup_path: str, password: Optional[str] = None):
    cmd = ['idevicebackup2', 'backup', backup_path, '-u', udid]

    try:
        if password:
            # Enable encryption
            enc_cmd = ['idevicebackup2', 'encryption', 'on', password, '-u', udid]
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
                
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("UPDATE backups SET status = 'failed' WHERE id = ?", (backup_id,))
                conn.commit()
                conn.close()
                return

        # Create subprocess with increased stream limit to handle \r progress bars
        # idevicebackup2 uses \r for progress which can cause buffer overflow
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            limit=1024 * 1024  # 1MB limit instead of default 64KB
        )
        
        # Store process handle
        active_backups[backup_id] = process
        backup_tasks[backup_id]["process"] = process

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Stream output line by line
        # Use readline instead of async iteration to avoid buffer issues with \r progress bars
        while True:
            try:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=60.0)
                if not line:
                    break
                
                line_text = line.decode().strip()
                if line_text:
                    # Stream to queue
                    if backup_id in backup_tasks:
                        await backup_tasks[backup_id]["queue"].put(line_text)
                    
                    # Parse progress
                    if '%' in line_text:
                        try:
                            parts = line_text.split('%')[0].split()
                            if parts:
                                percentage = int(parts[-1])
                                cursor.execute(
                                    "UPDATE backups SET progress = ? WHERE id = ?",
                                    (percentage, backup_id)
                                )
                                conn.commit()
                        except Exception as e:
                            print(f"Error parsing progress: {e}")
            except asyncio.TimeoutError:
                # Check if process is still alive
                if process.returncode is not None:
                    break
                continue
            except Exception as e:
                print(f"Error reading backup output: {e}")
                break

        # Wait for process to finish
        await process.wait()
        
        # Final status update
        status = 'failed' # Default to failed
        
        if process.returncode == 0:
            status = 'completed'
            if backup_id in backup_tasks:
                await backup_tasks[backup_id]["queue"].put("Backup completed successfully")
        else:
            # Check if it was cancelled
            cursor.execute("SELECT status FROM backups WHERE id = ?", (backup_id,))
            row = cursor.fetchone()
            current_status = row[0] if row else 'failed'
            
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
        
        # Update DB with final status
        cursor.execute("UPDATE backups SET status = ?, progress = 100 WHERE id = ?", (status, backup_id))
        conn.commit()
        
        # Calculate size if successful
        if status == 'completed':
            try:
                total_size = 0
                for dirpath, dirnames, filenames in os.walk(backup_path):
                    for f in filenames:
                        fp = os.path.join(dirpath, f)
                        if not os.path.islink(fp):
                            total_size += os.path.getsize(fp)
                
                size_str = f"{total_size / (1024*1024*1024):.2f} GB"
                cursor.execute("UPDATE backups SET size = ? WHERE id = ?", (size_str, backup_id))
                conn.commit()
            except Exception as e:
                print(f"Error calculating size: {e}")

    except Exception as e:
        print(f"Backup error: {e}")
        cursor.execute("UPDATE backups SET status = 'failed' WHERE id = ?", (backup_id,))
        conn.commit()
        if backup_id in backup_tasks:
            await backup_tasks[backup_id]["queue"].put(f"Backup error: {str(e)}")
            backup_tasks[backup_id]["status"] = "failed"
            
    finally:
        conn.close()
        if backup_id in active_backups:
            del active_backups[backup_id]
        # Note: We don't delete from backup_tasks here to allow the stream to finish sending logs

@app.post("/api/ios/backup")
async def start_backup(request: BackupRequest, background_tasks: BackgroundTasks):
    """Start iOS backup"""
    # Check if device is still connected
    devices = get_connected_devices()
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
        "INSERT INTO backups (name, device_udid, device_name, path, status, password) VALUES (?, ?, ?, ?, ?, ?)",
        (request.name, request.udid, device['name'], backup_path, 'in_progress', request.password)
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

@app.get("/api/ios/backup/stream/{backup_id}")
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

@app.post("/api/ios/backup/{backup_id}/stop")
async def stop_backup(backup_id: int):
    """Stop an active backup"""
    if backup_id in active_backups and active_backups[backup_id] is not None:
        process = active_backups[backup_id]
        try:
            # Send SIGTERM
            process.terminate()
            
            # Update status in DB
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("UPDATE backups SET status = 'cancelled' WHERE id = ?", (backup_id,))
            conn.commit()
            conn.close()
            
            return {"message": "Backup stopping"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to stop backup: {str(e)}")
    else:
        raise HTTPException(status_code=404, detail="Backup not found or not active")

@app.get("/api/backups")
async def get_backups():
    """Get list of backups"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, device_udid, device_name, path, created_at, status, size, progress, type FROM backups ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    backups = []
    for row in rows:
        backups.append({
            "id": row[0],
            "name": row[1],
            "device_udid": row[2],
            "device_name": row[3],
            "path": row[4],
            "created_at": row[5],
            "status": row[6],
            "size": row[7],
            "progress": row[8] if len(row) > 8 else 0,
            "type": row[9] if len(row) > 9 else 'ios'
        })
        
    return backups

@app.delete("/api/backups/{backup_id}")
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
            shutil.rmtree(path)
        except Exception as e:
            print(f"Error deleting backup files: {e}")
            
    return {"message": "Backup deleted"}

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

# Dashboard Tasks & Notes API

@app.get("/api/dashboard/tasks", response_model=List[Task])
async def get_tasks():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tasks

@app.post("/api/dashboard/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO tasks (content, description, priority) VALUES (?, ?, ?)", (task.content, task.description, task.priority))
    task_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    new_task = dict(sqlite3.Row(cursor, cursor.fetchone()))
    conn.close()
    return new_task

@app.put("/api/dashboard/tasks/{task_id}", response_model=Task)
async def toggle_task(task_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get current status
    cursor.execute("SELECT completed FROM tasks WHERE id = ?", (task_id,))
    result = cursor.fetchone()
    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
        
    new_status = not result[0]
    cursor.execute("UPDATE tasks SET completed = ? WHERE id = ?", (new_status, task_id))
    conn.commit()
    
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated_task = dict(sqlite3.Row(cursor, cursor.fetchone()))
    conn.close()
    return updated_task

@app.delete("/api/dashboard/tasks/{task_id}")
async def delete_task(task_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"message": "Task deleted"}

@app.get("/api/dashboard/notes", response_model=List[Note])
async def get_notes():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notes ORDER BY created_at DESC")
    notes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return notes

@app.post("/api/dashboard/notes", response_model=Note)
async def create_note(note: NoteCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO notes (content, description) VALUES (?, ?)", (note.content, note.description))
    note_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    new_note = dict(sqlite3.Row(cursor, cursor.fetchone()))
    conn.close()
    return new_note

@app.delete("/api/dashboard/notes/{note_id}")
async def delete_note(note_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return {"message": "Note deleted"}

    conn.close()
    return {"message": "Note deleted"}

# Dashboard Top Widgets API

@app.get("/api/system/health")
async def get_system_health():
    import psutil
    return {
        "cpu": psutil.cpu_percent(interval=1),
        "ram": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage('/').percent
    }

@app.get("/api/system/storage")
async def get_storage_usage():
    import psutil
    
    # Get total disk usage
    disk = psutil.disk_usage('/')
    total = disk.total
    free = disk.free
    used = disk.used
    
    # Calculate size of backups and reports
    backups_size = 0
    reports_size = 0
    
    # Helper to get directory size
    def get_dir_size(path):
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    total_size += os.path.getsize(fp)
        return total_size

    # Calculate backups size (assuming they are in a 'backups' folder or similar)
    # Since we store backup paths in DB, we could sum those, but a folder scan is safer if they are centralized
    # For now, let's assume a 'backups' directory exists in root or we check the DB
    # Let's use the DB to find where backups are stored or just check common paths
    # Based on previous code, backups seem to be in specific paths. 
    # Let's just sum up the size of known backup paths from DB for accuracy
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT path FROM backups")
    backup_paths = [row[0] for row in cursor.fetchall()]
    
    cursor.execute("SELECT path FROM reports")
    report_paths = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    
    for path in backup_paths:
        if os.path.exists(path):
            if os.path.isfile(path):
                backups_size += os.path.getsize(path)
            else:
                backups_size += get_dir_size(path)
                
    for path in report_paths:
        if os.path.exists(path):
             if os.path.isfile(path):
                reports_size += os.path.getsize(path)
             else:
                reports_size += get_dir_size(path)

    # System usage is everything else used
    system_size = max(0, used - backups_size - reports_size)
    
    return {
        "total": total,
        "free": free,
        "breakdown": [
            {"name": "Backups", "value": backups_size, "color": "#3b82f6"}, # Blue
            {"name": "Reports", "value": reports_size, "color": "#10b981"}, # Green
            {"name": "System", "value": system_size, "color": "#6b7280"},  # Gray
            {"name": "Free", "value": free, "color": "#1f2937"}    # Dark Gray
        ]
    }

@app.get("/api/dashboard/activity")
async def get_recent_activity():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get recent backups
    cursor.execute("SELECT id, name, 'backup' as type, status, created_at FROM backups ORDER BY created_at DESC LIMIT 5")
    backups = [dict(row) for row in cursor.fetchall()]
    
    # Get recent reports
    cursor.execute("SELECT id, name, 'report' as type, 'completed' as status, created_at FROM reports ORDER BY created_at DESC LIMIT 5")
    reports = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    # Combine and sort
    activity = backups + reports
    activity.sort(key=lambda x: x['created_at'], reverse=True)
    
    return activity[:10] # Return top 10

@app.get("/api/dashboard/devices")
async def get_active_devices():
    devices = []
    
    # Check for iOS devices using idevice_id
    try:
        # Check if idevice_id is available
        if shutil.which("idevice_id"):
            result = subprocess.run(["idevice_id", "-l"], capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.splitlines():
                    if line.strip():
                        devices.append({
                            "id": line.strip(),
                            "name": "iOS Device", # Getting name requires ideviceinfo which is slower
                            "type": "ios",
                            "status": "online",
                            "connection": "usb",
                            "battery": 100 # Placeholder as getting battery is complex
                        })
    except Exception as e:
        print(f"Error checking iOS devices: {e}")

    # Check for Android devices using adb
    try:
        # Check if adb is available
        if shutil.which("adb"):
            result = subprocess.run(["adb", "devices"], capture_output=True, text=True)
            if result.returncode == 0:
                lines = result.stdout.splitlines()
                for line in lines[1:]: # Skip first line "List of devices attached"
                    if line.strip() and "device" in line:
                        parts = line.split()
                        devices.append({
                            "id": parts[0],
                            "name": "Android Device",
                            "type": "android",
                            "status": "online",
                            "connection": "usb",
                            "battery": 100
                        })
    except Exception as e:
        print(f"Error checking Android devices: {e}")
        
    return devices

# Mount static reports directories (MUST be last to avoid catching API routes)
reports_base = os.path.join(os.path.dirname(__file__), "reports")
app.mount("/reports/ileapp", StaticFiles(directory=os.path.join(reports_base, "ileapp-reports")), name="ileapp-reports")
app.mount("/reports/aleapp", StaticFiles(directory=os.path.join(reports_base, "aleapp-reports")), name="aleapp-reports")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)