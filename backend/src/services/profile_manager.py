import asyncio
import json
import logging
from typing import List, Dict, Any, Optional

from core.database import db_execute, db_fetch_one, db_fetch_all, db_execute_return_id
from core.config import TOOLS_CONFIG
from core.state import available_modules

logger = logging.getLogger(__name__)


class ProfileManager:
    """Manages forensic tool profiles (saved module selections)."""

    async def get_profiles(self, tool: str) -> List[Dict[str, Any]]:
        """Get all saved profiles for a tool."""
        rows = await db_fetch_all(
            "SELECT id, name, tool, modules_json FROM profiles WHERE tool = ?",
            (tool,)
        )
        profiles = []
        for row in rows:
            d = dict(row)
            d['modules'] = json.loads(d.pop('modules_json'))
            profiles.append(d)
        return profiles

    async def create_profile(self, name: str, tool: str, modules: List[str]) -> Dict[str, Any]:
        """Create a new profile. Returns the created profile dict or raises on duplicate."""
        modules_json = json.dumps(modules)
        
        try:
            profile_id = await db_execute_return_id(
                'INSERT INTO profiles (name, tool, modules_json) VALUES (?, ?, ?)',
                (name, tool, modules_json)
            )
        except Exception as e:
            # Check for unique constraint violation (sqlite3 specific)
            if "UNIQUE constraint" in str(e) or "integrity" in str(e).lower():
                raise ValueError(f"Profile with name '{name}' already exists")
            raise e

        return {
            "id": profile_id,
            "name": name,
            "tool": tool,
            "modules": modules
        }

    async def load_profile(self, profile_id: int, tool: str) -> Optional[Dict[str, Any]]:
        """Load a profile and update available_modules state. Returns None if not found."""
        row = await db_fetch_one(
            'SELECT name, modules_json FROM profiles WHERE id = ? AND tool = ?',
            (profile_id, tool)
        )
        if not row:
            return None

        profile_name = row['name']
        selected_modules = json.loads(row['modules_json'])

        # Update in-memory state
        if tool in available_modules:
            selected_set = set(selected_modules)
            for module_name, module_data in available_modules[tool].items():
                module_data["selected"] = module_name in selected_set

        return {
            "profile_name": profile_name,
            "profile_id": profile_id,
            "selected_count": len(selected_modules),
            "modules": selected_modules
        }

    async def delete_profile(self, profile_id: int) -> bool:
        """Delete a profile. Returns True if deleted, False if not found."""
        row = await db_fetch_one("SELECT id FROM profiles WHERE id = ?", (profile_id,))
        if not row:
            return False
        await db_execute('DELETE FROM profiles WHERE id = ?', (profile_id,))
        return True

    async def get_modules(self, tool: str) -> Optional[Dict[str, Any]]:
        """Get available modules for a tool from state. Returns None if tool not loaded."""
        if tool not in available_modules or len(available_modules.get(tool, {})) == 0:
            logger.info(f"Tool '{tool}' not in available_modules, attempting reload...")
            
            # Offload heavy blocking reload to thread pool
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._reload_plugins_sync, tool)

        if tool not in available_modules:
            return None

        modules = list(available_modules[tool].values())
        return {"modules": modules, "total": len(modules)}

    def _reload_plugins_sync(self, tool: str):
        """Synchronous helper for reloading plugins, to be run in executor."""
        try:
            from tool_manager import tool_manager
            tool_path = tool_manager.get_tool_path(tool)
            if tool_path:
                from plugin_manager import load_plugins
                load_plugins()
        except Exception as e:
            logger.error(f"Error reloading plugins: {e}")

    async def select_modules(self, tool: str, selections: Dict[str, bool]) -> int:
        """Update module selection state. Returns count of selected modules."""
        if tool not in available_modules:
             # This implies the tool's plugins haven't been loaded yet
             # The router previously returned 503, so we can raise a specific error or ValueError
             # Raising ValueError ("not initialized") to be caught by router
             raise ValueError(f"Tool '{tool}' not initialized")

        for module_name, selected in selections.items():
            if module_name in available_modules[tool]:
                available_modules[tool][module_name]["selected"] = selected

        return sum(1 for m in available_modules[tool].values() if m.get("selected"))


# Global instance
profile_manager = ProfileManager()
