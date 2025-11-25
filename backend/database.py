import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "vdf_tools.db")

def init_database():
    """Initialize SQLite database for profiles and reports"""
    conn = sqlite3.connect(DB_PATH)
    # Enable WAL mode for better concurrency
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.cursor()
    
    # Check if tool column exists in profiles
    cursor.execute("PRAGMA table_info(profiles)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'tool' not in columns and 'profiles' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE profiles ADD COLUMN tool TEXT DEFAULT "ileapp"')
        print("Migrated profiles table to include tool column")
    
    # Check if progress column exists in backups
    cursor.execute("PRAGMA table_info(backups)")
    backup_columns = [col[1] for col in cursor.fetchall()]
    
    if 'progress' not in backup_columns and 'backups' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE backups ADD COLUMN progress INTEGER DEFAULT 0')
        print("Migrated backups table to include progress column")

    # Check if priority column exists in tasks
    cursor.execute("PRAGMA table_info(tasks)")
    task_columns = [col[1] for col in cursor.fetchall()]
    
    if 'priority' not in task_columns and 'tasks' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT "medium"')
        print("Migrated tasks table to include priority column")

    # Check if password column exists in backups
    cursor.execute("PRAGMA table_info(backups)")
    backup_columns = [col[1] for col in cursor.fetchall()]
    
    if 'password' not in backup_columns and 'backups' in [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        # Migrate existing table
        cursor.execute('ALTER TABLE backups ADD COLUMN password TEXT')
        print("Migrated backups table to include password column")
    
    # Create profiles table if doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            tool TEXT NOT NULL DEFAULT 'ileapp',
            modules_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, tool)
        )
    ''')

    # Create reports table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            tool TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create backups table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            device_udid TEXT NOT NULL,
            device_name TEXT NOT NULL,
            path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL,
            size TEXT,
            progress INTEGER DEFAULT 0,
            type TEXT DEFAULT 'ios',
            password TEXT
        )
    ''')
    
    # Migration: Add type column if it doesn't exist
    cursor.execute("PRAGMA table_info(backups)")
    columns = [info[1] for info in cursor.fetchall()]
    if 'type' not in columns:
        print("Migrating database: Adding type column to backups table")
        cursor.execute("ALTER TABLE backups ADD COLUMN type TEXT DEFAULT 'ios'")

    # Create tasks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            completed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create notes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Migration: Add description column to tasks if it doesn't exist
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [info[1] for info in cursor.fetchall()]
    if 'description' not in columns:
        print("Migrating database: Adding description column to tasks table")
        cursor.execute("ALTER TABLE tasks ADD COLUMN description TEXT")

    # Migration: Add description column to notes if it doesn't exist
    cursor.execute("PRAGMA table_info(notes)")
    columns = [info[1] for info in cursor.fetchall()]
    if 'description' not in columns:
        print("Migrating database: Adding description column to notes table")
        cursor.execute("ALTER TABLE notes ADD COLUMN description TEXT")

    # Create cases table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            case_number TEXT,
            business_name TEXT,
            investigator_name TEXT,
            client_name TEXT,
            client_location TEXT,
            client_contact TEXT,
            description TEXT,
            status TEXT DEFAULT 'Active',
            priority TEXT DEFAULT 'Medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Helper to add case_id column and migrate data
    def add_case_id_column(table_name):
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [info[1] for info in cursor.fetchall()]
        if 'case_id' not in columns:
            print(f"Migrating database: Adding case_id column to {table_name} table")
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN case_id INTEGER REFERENCES cases(id)")

    # Migrate tables
    add_case_id_column('backups')
    add_case_id_column('reports')
    add_case_id_column('tasks')
    add_case_id_column('notes')

    conn.commit()
    conn.close()
