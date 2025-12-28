import os

# Tool Configuration
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
        "excluded_modules": {'googleMapsSearches', 'notificationHistory'}
    }
}

# Reports Directory
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")
