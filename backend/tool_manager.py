"""
Tool Manager for VDF Tools
Handles downloading and managing iLEAPP/aLEAPP forensic tools from GitHub.
"""

import sys
import subprocess
import logging
import platform
import json
import shutil
import zipfile
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

import requests

from config import TOOLS_CONFIG, TOOLS_DIR

logger = logging.getLogger(__name__)


class ToolManager:
    """Manages forensic tool installations with GitHub downloads."""
    
    def __init__(self):
        self.tools_dir = Path(TOOLS_DIR)
        self.tools_dir.mkdir(parents=True, exist_ok=True)
    
    def get_tool_path(self, tool_name: str) -> Optional[Path]:
        """Get the path to an installed tool. Returns None if not installed."""
        if tool_name not in TOOLS_CONFIG:
            return None
            
        config = TOOLS_CONFIG[tool_name]
        tool_subdir = config.get("subdir", tool_name)
        tool_path = self.tools_dir / "leapp-tools" / tool_subdir
        
        if tool_path.exists():
            return tool_path
        return None
    
    def check_tools_status(self) -> Dict[str, Any]:
        """Check installation status of all configured tools."""
        status = {}
        
        for tool_name, config in TOOLS_CONFIG.items():
            tool_path = self.get_tool_path(tool_name)
            metadata = self._get_installed_metadata(tool_name) if tool_path else {}
            
            status[tool_name] = {
                "name": config["name"],
                "description": config["description"],
                "installed": tool_path is not None,
                "path": str(tool_path) if tool_path else None,
                "version": metadata.get("tag_name"),
                "installed_at": metadata.get("download_date"),
            }
            
            # Check for updates if installed
            if tool_path:
                try:
                    latest = self._get_github_release_info(tool_name)
                    if latest:
                        status[tool_name]["latest_version"] = latest.get("tag_name")
                        status[tool_name]["update_available"] = (
                            metadata.get("tag_name") != latest.get("tag_name")
                        )
                except Exception:
                    pass
        
        return status
    
    def _get_github_release_info(self, tool_name: str) -> Dict[str, Any]:
        """Get latest release info from GitHub API."""
        if tool_name not in TOOLS_CONFIG:
            return {}
            
        config = TOOLS_CONFIG[tool_name]
        repo_url = config.get("github_url", "")
        
        if not repo_url:
            return {}
        
        try:
            # Convert repo URL to API endpoint
            repo_path = repo_url.replace("https://github.com/", "").replace(".git", "")
            api_url = f"https://api.github.com/repos/{repo_path}/releases/latest"
            
            response = requests.get(api_url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            return {
                "tag_name": data["tag_name"],
                "zip_url": data["zipball_url"],
                "published_at": data["published_at"]
            }
        except Exception as e:
            logger.error(f"Failed to fetch release info for {tool_name}: {e}")
            return {}
    
    def _get_installed_metadata(self, tool_name: str) -> Dict[str, Any]:
        """Get metadata for installed tool."""
        tool_path = self.get_tool_path(tool_name)
        if not tool_path:
            return {}
            
        metadata_path = tool_path / ".vdf_metadata.json"
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to read metadata: {e}")
        return {}
    
    def install_tool(self, tool_name: str, progress_callback=None) -> Dict[str, Any]:
        """
        Install a tool from GitHub (main branch).
        
        Args:
            tool_name: 'ileapp' or 'aleapp'
            progress_callback: Optional callback(progress, message) for updates
            
        Returns:
            Dict with success status and message
        """
        if tool_name not in TOOLS_CONFIG:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
        
        config = TOOLS_CONFIG[tool_name]
        
        def update_progress(pct, msg):
            if progress_callback:
                progress_callback(pct, msg)
            logger.info(f"[{tool_name}] {msg} ({pct}%)")
        
        try:
            update_progress(5, f"Downloading {config['name']}...")
            
            # Build direct download URL for main branch (no API needed)
            repo_url = config.get("github_url", "")
            repo_path = repo_url.replace("https://github.com/", "").replace(".git", "")
            zip_url = f"https://github.com/{repo_path}/archive/refs/heads/main.zip"
            
            update_progress(10, f"Downloading from GitHub...")
            
            # Download zip file
            temp_dir = self.tools_dir / f"{tool_name}_temp"
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            zip_path = temp_dir / f"{tool_name}.zip"
            
            response = requests.get(zip_url, stream=True, timeout=300)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        pct = 10 + int(40 * downloaded / total_size)
                        update_progress(pct, f"Downloading... ({downloaded // 1024}KB)")
            
            update_progress(50, "Extracting files...")
            
            # Extract to leapp-tools directory
            leapp_tools_dir = self.tools_dir / "leapp-tools"
            leapp_tools_dir.mkdir(parents=True, exist_ok=True)
            
            tool_subdir = config.get("subdir", tool_name)
            target_path = leapp_tools_dir / tool_subdir
            
            # Remove existing installation
            if target_path.exists():
                shutil.rmtree(target_path)
            
            # Extract zip
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # GitHub zips have a root folder, we need to handle that
                members = zip_ref.namelist()
                root_folder = members[0].split('/')[0]
                
                for member in members:
                    # Skip the root folder itself
                    if member == root_folder + '/':
                        continue
                    
                    # Remove root folder prefix
                    new_path = member[len(root_folder) + 1:]
                    if not new_path:
                        continue
                    
                    target_file = target_path / new_path
                    
                    if member.endswith('/'):
                        target_file.mkdir(parents=True, exist_ok=True)
                    else:
                        target_file.parent.mkdir(parents=True, exist_ok=True)
                        with zip_ref.open(member) as source, open(target_file, 'wb') as target:
                            shutil.copyfileobj(source, target)
            
            update_progress(70, "Installing Python dependencies...")
            
            # Install requirements
            requirements_file = target_path / "requirements.txt"
            if requirements_file.exists():
                try:
                    subprocess.run(
                        [sys.executable, "-m", "pip", "install", "-r", str(requirements_file), "-q"],
                        check=True,
                        capture_output=True,
                        timeout=300
                    )
                except subprocess.CalledProcessError as e:
                    logger.warning(f"Some dependencies may have failed: {e}")
            
            update_progress(90, "Saving metadata...")
            
            # Save metadata
            metadata = {
                "tag_name": "main",
                "source": "direct_download",
                "download_date": datetime.now().isoformat()
            }
            
            metadata_path = target_path / ".vdf_metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Cleanup temp files
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            update_progress(100, f"{config['name']} installed successfully!")
            
            return {
                "success": True,
                "message": f"{config['name']} installed successfully",
                "version": "main"
            }
            
        except Exception as e:
            logger.error(f"Failed to install {tool_name}: {e}")
            # Cleanup on failure
            temp_dir = self.tools_dir / f"{tool_name}_temp"
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
            return {"success": False, "error": str(e)}
    
    def uninstall_tool(self, tool_name: str) -> Dict[str, Any]:
        """Uninstall a tool."""
        if tool_name not in TOOLS_CONFIG:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
        
        tool_path = self.get_tool_path(tool_name)
        if not tool_path:
            return {"success": False, "error": f"{tool_name} is not installed"}
        
        try:
            shutil.rmtree(tool_path)
            return {"success": True, "message": f"{TOOLS_CONFIG[tool_name]['name']} uninstalled"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# Global instance
tool_manager = ToolManager()
