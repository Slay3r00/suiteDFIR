import os
import sys
import platform
from pathlib import Path

def get_base_dir() -> Path:
    """Get the base directory for persistent data, handling both dev and bundled environments."""
    if getattr(sys, 'frozen', False):
        # Bundled: store in user's Application Support / AppData
        if platform.system() == "Darwin":
            base = Path.home() / "Library" / "Application Support" / "VDF Tools"
        elif platform.system() == "Windows":
            base = Path.home() / "AppData" / "Local" / "VDF Tools"
        else:
            base = Path.home() / ".vdf-tools"
    else:
        # Development: use backend directory (go up from src/core to backend)
        base = Path(__file__).parent.parent.parent

    return base

BASE_DIR = get_base_dir()

# Tool Configuration
TOOLS_CONFIG = {
    "ileapp": {
        "name": "iLEAPP",
        "subdir": "iLEAPP",
        "github_url": "https://github.com/abrignoni/iLEAPP",
        "script": "ileapp.py",
        "profile_ext": ".ilprofile",
        "description": "iOS Logs, Events, And Plist Parser",
        "excluded_modules": {'iTunesBackupInfo', 'last_build', 'logarchive'}
    },
    "aleapp": {
        "name": "aLEAPP",
        "subdir": "ALEAPP",
        "github_url": "https://github.com/abrignoni/ALEAPP",
        "script": "aleapp.py",
        "profile_ext": ".alprofile",
        "description": "Android Logs, Events, And Protobuf Parser",
        "excluded_modules": {'googleMapsSearches', 'notificationHistory'}
    }
}

# Directories
REPORTS_DIR = str(BASE_DIR / "reports")
BACKUPS_DIR = str(BASE_DIR / "backups")
TOOLS_DIR = str(BASE_DIR / "forensic-tools")

# Database paths
VDF_DB_PATH = str(BASE_DIR / "data" / "vdf_tools.db")

# Cache directories for LEAPP geocoding database
CACHE_DIR = BASE_DIR / "data" / "cache"
COORDS_DB = str(CACHE_DIR / "coordinates.db")
