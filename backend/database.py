import sqlite3
import asyncio
from typing import Optional, List
import os
from config import BASE_DIR

DB_PATH = str(BASE_DIR / "vdf_tools.db")

# Schema Definitions
SCHEMA = {
    "profiles": """
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            tool TEXT NOT NULL DEFAULT 'ileapp',
            modules_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, tool)
        )
    """,
    "reports": """
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            tool TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            case_id INTEGER
        )
    """,
    "backups": """
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
            password TEXT,
            case_id INTEGER
        )
    """,
    "tasks": """
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            completed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            case_id INTEGER
        )
    """,
    "notes": """
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            case_id INTEGER
        )
    """,
    "cases": """
        CREATE TABLE IF NOT EXISTS cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            case_number TEXT,
            client_name TEXT,
            client_phone TEXT,
            client_email TEXT,
            description TEXT,
            status TEXT DEFAULT 'Active',
            priority TEXT DEFAULT 'Medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_visited_at TIMESTAMP
        )
    """
}

def get_db_connection():
    """Get a database connection with row factory set to sqlite3.Row"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """Initialize SQLite database for profiles and reports"""
    conn = sqlite3.connect(DB_PATH)
    # Enable WAL mode for better concurrency
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.cursor()
    
    # Create tables if they don't exist
    for table_name, create_sql in SCHEMA.items():
        cursor.execute(create_sql)
        
    # Migrations
    # Add last_visited_at to cases if it doesn't exist
    try:
        cursor.execute("SELECT last_visited_at FROM cases LIMIT 1")
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE cases ADD COLUMN last_visited_at TIMESTAMP")

    # Add client_phone and client_email
    try:
        cursor.execute("SELECT client_phone FROM cases LIMIT 1")
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE cases ADD COLUMN client_phone TEXT")
    
    try:
        cursor.execute("SELECT client_email FROM cases LIMIT 1")
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE cases ADD COLUMN client_email TEXT")
        
    conn.commit()
    conn.close()

async def db_execute(query: str, params: tuple = ()) -> None:
    """Execute a write operation (INSERT/UPDATE/DELETE) in a thread pool."""
    loop = asyncio.get_running_loop()
    def _do_execute():
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(query, params)
            # Context manager automatically commits on success
    await loop.run_in_executor(None, _do_execute)

async def db_fetch_one(query: str, params: tuple = ()) -> Optional[dict]:
    """Execute a read operation and return one row."""
    loop = asyncio.get_running_loop()
    def _do_fetch():
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(query, params)
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
    return await loop.run_in_executor(None, _do_fetch)

async def db_fetch_all(query: str, params: tuple = ()) -> List[dict]:
    """Execute a read operation and return all rows."""
    loop = asyncio.get_running_loop()
    def _do_fetch():
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()
    return await loop.run_in_executor(None, _do_fetch)

async def db_execute_return_id(query: str, params: tuple = ()) -> int:
    """Execute a write operation and return the lastrowid."""
    loop = asyncio.get_running_loop()
    def _do_execute():
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute(query, params)
            return cursor.lastrowid
    return await loop.run_in_executor(None, _do_execute)
