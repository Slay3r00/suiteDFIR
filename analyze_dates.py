import sqlite3
import json
import re
from collections import Counter

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

def get_pattern(s):
    if not s: return "EMPTY"
    # Replace digits with 0, letters with A
    p = re.sub(r'[0-9]', '0', s)
    p = re.sub(r'[A-Za-z]', 'A', p)
    return p

def analyze():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    patterns = Counter()
    examples = {}
    
    # 1. Analyze 'key' column
    cursor.execute("SELECT key FROM data")
    for (key,) in cursor:
        p = get_pattern(key)
        patterns[p] += 1
        if p not in examples: examples[p] = key
        
    # 2. Analyze 'datalist' JSON for all DATE_KEYS
    cursor.execute("SELECT datalist FROM data")
    for (datalist_str,) in cursor:
        try:
            data = json.loads(datalist_str)
            for k in DATE_KEYS:
                if k in data:
                    val = str(data[k])
                    p = get_pattern(val)
                    patterns[p] += 1
                    if p not in examples: examples[p] = val
        except:
            continue
            
    conn.close()
    
    print("Exhaustive Pattern Analysis:")
    print("-" * 30)
    for p, count in patterns.most_common():
        print(f"Pattern: {p}")
        print(f"Count:   {count}")
        print(f"Example: {examples[p]}")
        print("-" * 30)

if __name__ == "__main__":
    analyze()
