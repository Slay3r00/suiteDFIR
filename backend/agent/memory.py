"""
Chat memory management using LangChain's SQLChatMessageHistory.
Provides persistent conversation history per session.
"""
import os
from langchain_community.chat_message_histories import SQLChatMessageHistory

# Use the existing vdf_tools.db database
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "vdf_tools.db")
CONNECTION_STRING = f"sqlite:///{DB_PATH}"


def get_session_history(session_id: str) -> SQLChatMessageHistory:
    """
    Returns a SQLChatMessageHistory instance for the given session.
    Automatically creates the message_store table if it doesn't exist.
    """
    return SQLChatMessageHistory(
        session_id=session_id,
        connection_string=CONNECTION_STRING,
        table_name="chat_messages"
    )


def init_memory_db():
    """Initialize the chat memory database tables."""
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id TEXT PRIMARY KEY,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    finally:
        conn.close()

# Initialize DB on module load
init_memory_db()


def save_session_title(session_id: str, title: str):
    """Save or update the title for a session."""
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO chat_sessions (session_id, title)
            VALUES (?, ?)
            ON CONFLICT(session_id) DO UPDATE SET title = excluded.title
        """, (session_id, title))
        conn.commit()
    finally:
        conn.close()


def get_all_sessions() -> list[dict]:
    """
    Get all unique session IDs from the database.
    Returns list of dicts with session_id, message_count, and title.
    """
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Complex query to get both existing sessions (from chat_messages) and new empty sessions (from chat_sessions)
        cursor.execute("""
            SELECT 
                t.session_id, 
                COUNT(cm.rowid) as message_count, 
                MAX(cm.rowid) as last_id,
                t.title,
                t.created_at
            FROM (
                -- Get sessions explicitly created
                SELECT session_id, title, created_at FROM chat_sessions
                UNION
                -- Get sessions that only exist in messages (legacy or implicitly created)
                SELECT DISTINCT session_id, NULL as title, NULL as created_at 
                FROM chat_messages 
                WHERE session_id NOT IN (SELECT session_id FROM chat_sessions)
            ) t
            LEFT JOIN chat_messages cm ON t.session_id = cm.session_id
            GROUP BY t.session_id
            ORDER BY COALESCE(last_id, 0) DESC, t.created_at DESC
        """)
        
        sessions = []
        for row in cursor.fetchall():
            session_id = row[0]
            count = row[1]
            title = row[3]
            
            # Default title logic if no custom title exists
            if not title:
                # Try to extract a readable ID part (e.g., from session_123_abc -> abc)
                parts = session_id.split('_')
                if len(parts) > 2:
                    suffix = parts[-1][:8]
                    title = f"Chat {suffix}"
                else:
                    title = f"Chat {session_id[:8]}"
            
            sessions.append({
                "session_id": session_id,
                "message_count": count,
                "title": title
            })
            
        return sessions
    except sqlite3.OperationalError:
        # Table doesn't exist yet
        return []
    finally:
        conn.close()


def delete_session(session_id: str) -> bool:
    """Delete a session and all its messages."""
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Delete messages (if any exist)
        cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        messages_deleted = cursor.rowcount > 0

        # Delete session record from chat_sessions table
        cursor.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
        session_deleted = cursor.rowcount > 0

        conn.commit()

        # Return True if either:
        # - Session record was deleted (even with 0 messages)
        # - Messages were deleted (legacy sessions without chat_sessions record)
        return session_deleted or messages_deleted

    except sqlite3.OperationalError:
        return False
    finally:
        conn.close()


def get_session_messages(session_id: str) -> list[dict]:
    """Get all messages for a specific session."""
    history = get_session_history(session_id)
    messages = history.messages
    return [
        {"role": msg.type, "content": msg.content}
        for msg in messages
    ]
