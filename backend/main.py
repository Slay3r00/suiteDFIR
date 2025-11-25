from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import sys
import asyncio

from database import init_database
from routers import cases, reports, profiles, tasks, processing, backups, system
from config import TOOLS_CONFIG, REPORTS_DIR
from state import plugin_loaders, available_modules
from utils import broadcast_event

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

        # Start device monitor
        # Note: monitor_devices is now handled in system.py or utils.py, 
        # but we need to start it here. Since we moved it to utils (implied by previous steps but not explicitly done in system.py),
        # let's check where it is. Wait, I didn't move monitor_devices to system.py, I moved get_active_devices.
        # The background task `monitor_devices` was in main.py. I should have moved it to system.py or utils.py.
        # Let's import it from system if I put it there, or keep it here if I forgot.
        # Looking at my write_to_file for system.py, I did NOT include monitor_devices loop, only get_active_devices.
        # I need to keep monitor_devices here or move it. 
        # Ideally it should be in system.py or utils.py to keep main.py clean.
        # However, for now, to avoid breaking, I will keep the startup logic here but I need the function.
        # Actually, I should have moved `monitor_devices` to `utils.py` or `system.py`.
        # Let's import `monitor_devices` from `utils` if it's there.
        # Checking utils.py content from memory/previous context... I only moved `broadcast_event` and `get_connected_devices`.
        # So `monitor_devices` loop logic is missing from my new system.py.
        # I will re-implement `monitor_devices` here using the utils functions, or better, move it to `utils.py` in a separate step?
        # No, I can just define it here for now or import it if I put it in system.py.
        # I did NOT put it in system.py.
        # I will define it here for now to ensure it runs, using the imported utils.
        
        asyncio.create_task(monitor_devices_task())
        yield
    finally:
        pass

async def monitor_devices_task():
    """Background task to monitor connected devices"""
    # We need to import state module to access the mutable global variable
    import state
    from utils import get_connected_devices, broadcast_event
    
    print("Starting device monitor...")
    
    while True:
        try:
            new_devices = await get_connected_devices()
            
            # Check if devices changed (simple comparison)
            current_ids = set(d["id"] for d in state.current_devices)
            new_ids = set(d["id"] for d in new_devices)
            
            if current_ids != new_ids:
                print(f"Devices changed: {len(new_devices)} connected")
                # Update state
                state.current_devices = new_devices
                
                # Broadcast to all clients
                await broadcast_event("device_update", state.current_devices)
            
            # Update anyway to keep battery/status fresh
            state.current_devices = new_devices
            
        except Exception as e:
            print(f"Error in device monitor: {e}")
            
        await asyncio.sleep(2)

app = FastAPI(lifespan=lifespan)

# Include Routers
app.include_router(system.router) # Root and system endpoints
app.include_router(cases.router)
app.include_router(reports.router)
app.include_router(profiles.router)
app.include_router(tasks.router)
app.include_router(processing.router)
app.include_router(backups.router)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount reports directory to serve HTML reports
if not os.path.exists(REPORTS_DIR):
    os.makedirs(REPORTS_DIR)

# Mount specific report directories if they exist, or create them
for tool in TOOLS_CONFIG:
    tool_report_dir = os.path.join(REPORTS_DIR, f"{tool}-reports")
    if not os.path.exists(tool_report_dir):
        os.makedirs(tool_report_dir)
    
    # Mount each tool's report directory
    app.mount(f"/{tool}-reports", StaticFiles(directory=tool_report_dir), name=f"{tool}-reports")

# Also mount the root reports directory for convenience
app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)