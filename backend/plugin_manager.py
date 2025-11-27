import os
import sys
import logging
import contextlib
from config import TOOLS_CONFIG
from state import plugin_loaders, available_modules

logger = logging.getLogger(__name__)

@contextlib.contextmanager
def safe_tool_execution(tool_path):
    """
    Context manager to safely execute code within a forensic tool's environment.
    
    Handles:
    1. Modifying sys.path to include the tool
    2. Changing working directory to the tool's directory
    3. Cleaning up sys.modules to prevent conflicts between tools (iLEAPP/aLEAPP)
    4. Restoring original state (cwd, sys.path) after execution
    """
    original_cwd = os.getcwd()
    path_inserted = False
    
    try:
        # 1. Add tool to Python path
        if tool_path not in sys.path:
            sys.path.insert(0, tool_path)
            path_inserted = True

        # 2. Change to tool directory
        os.chdir(tool_path)

        # 3. Clear conflicting modules (scripts package)
        # We do this BEFORE usage to ensure we load the correct version for this tool
        modules_to_remove = [m for m in sys.modules if m == 'scripts' or m.startswith('scripts.')]
        for m in modules_to_remove:
            del sys.modules[m]

        yield

    except OSError as e:
        logger.error(f"OS Error during tool execution setup for {tool_path}: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during tool execution context: {e}")
        raise
    finally:
        # 4. Restore state
        try:
            os.chdir(original_cwd)
        except OSError as e:
            logger.error(f"Failed to restore original working directory {original_cwd}: {e}")
            
        if path_inserted:
            try:
                sys.path.remove(tool_path)
            except ValueError:
                pass # Already removed

def load_plugins():
    """
    Loads forensic tool plugins based on configuration.
    Uses safe_tool_execution to isolate tool environments.
    """
    for tool_id, config in TOOLS_CONFIG.items():
        try:
            tool_path = config["path"]
            if not os.path.exists(tool_path):
                logger.warning(f"{config['name']} path not found: {tool_path}")
                continue

            logger.info(f"Loading {config['name']} modules from {tool_path}...")

            with safe_tool_execution(tool_path):
                # Import plugin_loader from the tool
                # These imports MUST happen inside the context where sys.path is set
                import scripts.plugin_loader as plugin_loader
                import scripts.modules_to_exclude as modules_to_exclude
                
                # Load modules
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
                logger.info(f"Loaded {len(tool_modules)} {config['name']} modules")

        except Exception as e:
            logger.error(f"Error loading {config['name']} modules: {e}")
