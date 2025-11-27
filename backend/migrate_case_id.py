import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "vdf_tools.db")

def migrate():
    print(f"Migrating database at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    tables_to_check = ['tasks', 'notes', 'reports', 'backups']

    for table in tables_to_check:
        print(f"Checking table {table}...")
        try:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [info[1] for info in cursor.fetchall()]
            
            if 'case_id' not in columns:
                print(f"Adding case_id to {table}...")
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN case_id INTEGER")
                print(f"Successfully added case_id to {table}")
            else:
                print(f"Table {table} already has case_id")
                
        except Exception as e:
            print(f"Error checking/migrating {table}: {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
