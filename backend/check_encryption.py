import sys
import os
import json

# Add iLEAPP to path
current_dir = os.path.dirname(os.path.abspath(__file__))
ileapp_path = os.path.join(current_dir, 'forensic-tools', 'leapp-tools', 'iLEAPP')
sys.path.insert(0, ileapp_path)

# Mock logfunc to avoid errors if ilapfuncs tries to log
import scripts.ilapfuncs
scripts.ilapfuncs.logfunc = lambda x: None

try:
    from scripts.search_files import get_itunes_backup_type, check_itunes_backup_status
except ImportError as e:
    print(json.dumps({"error": f"Failed to import iLEAPP modules: {str(e)}"}))
    sys.exit(1)

def check_encryption(path):
    try:
        backup_type = get_itunes_backup_type(path)
        if not backup_type:
            return {"encrypted": False, "type": "unknown", "supported": False}
        
        supported, encrypted, message = check_itunes_backup_status(path, backup_type)
        
        return {
            "encrypted": encrypted,
            "type": backup_type,
            "supported": supported,
            "message": message
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No path provided"}))
        sys.exit(1)
        
    path = sys.argv[1]
    result = check_encryption(path)
    print(json.dumps(result))
