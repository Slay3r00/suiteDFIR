import sqlite3
import json
import re

DB_PATH = "/Users/jacobcontreras/vdf-tools/backend/reports/ileapp-reports/IOS 13 Device/iLEAPP_Reports_2026-01-02_Friday_215423/_Timeline/tl.db"

DATE_KEYS = [
    'Timestamp', 'Sent', 'Date', 'Created', 'Received Time', 
    'Last Modified Timestamp', 'Starting Timestamp', 'Call Date/Time', 
    'Message Timestamp', 'Read Timestamp', 'Attachment Timestamp', 
    'Last update time', 'Last Joined', 'Added At', 'Modified', 'Last opened',
    'Start Time', 'End Time', 'Added Date', 'Creation Date', 
    'Modification Date', 'Modified Time', 'Visit Time', 'Last Seen Time',
    'Date Created', 'Date and Time', 'Date and time', 
    'Last Associated/Roamed At', 'Last Connection Time', 'Last Modification Time',
    'Start Date', 'End Date', 'TimestampUTC', 'Update Time', 'Visit Timestamp',
    'Creation Time', 'Date Joined', 'Date added to Health', 'Fire Date',
    'First Usage Timestamp', 'Last Connect Timestamp', 'Last Update Date',
    'Last Usage Timestamp', 'Last Used Date', 'Timestamp Modified',
    'Created Time', 'Date of Birth', 'Last Modified',
    'Start Timestamp', 'End Timestamp', 'Timestamp added to Health'
]

def is_date_like(s):
    if not s or len(s) < 4: return False
    # Check for common date separators
    if any(sep in s for sep in ['-', '/', ':', ',']):
        # Ignore obvious non-dates like GUIDs (lots of hex and dashes)
        if re.match(r'^[0-9a-fA-F-]{32,}$', s): return False
        if len(s) > 50: return False # Likely a sentence or path
        return True
    # Pure digits could be epochs
    if s.isdigit() and 10 <= len(s) <= 20: return True
    return False

def get_detailed_pattern(s):
    # Preserve separators and spacing
    p = ""
    for char in s:
        if char.isdigit(): p += '0'
        elif char.isalpha(): p += 'A'
        else: p += char
    return p

def analyze():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    unique_formats = {}
    
    # 1. Analyze 'key' column
    cursor.execute("SELECT DISTINCT key FROM data")
    for (key,) in cursor:
        if is_date_like(key):
            fmt = get_detailed_pattern(key)
            if fmt not in unique_formats: unique_formats[fmt] = key
        
    # 2. Analyze 'datalist' JSON
    cursor.execute("SELECT datalist FROM data")
    for (datalist_str,) in cursor:
        try:
            data = json.loads(datalist_str)
            for k in DATE_KEYS:
                if k in data:
                    val = str(data[k])
                    if is_date_like(val):
                        fmt = get_detailed_pattern(val)
                        if fmt not in unique_formats: unique_formats[fmt] = val
        except:
            continue
            
    conn.close()
    
    print("Guaranteed Date Formats Found:")
    print("-" * 50)
    for fmt, example in sorted(unique_formats.items()):
        print(f"Format Pattern: {fmt}")
        print(f"Example Value:  {example}")
        print("-" * 50)

if __name__ == "__main__":
    analyze()
