import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import aiosqlite

USER_DATA_DIR = os.getenv("USER_DATA_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "user_data"))
DB_PATH = os.path.join(USER_DATA_DIR, "chat_history.db")

# Database version
CURRENT_VERSION = 1

class DatabaseService:
    def __init__(self):
        self.db_path = DB_PATH
        self._ensure_db_directory()
        self._init_db()

    def _ensure_db_directory(self):
        """Ensure the database directory exists"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

    def _init_db(self):
        """Initialize the database with the current schema"""
        with sqlite3.connect(self.db_path) as conn:
            # Create version table if it doesn't exist
            conn.execute("""
                CREATE TABLE IF NOT EXISTS db_version (
                    version INTEGER PRIMARY KEY
                )
            """)
            
            # Get current version
            cursor = conn.execute("SELECT version FROM db_version")
            current_version = cursor.fetchone()
            
            if current_version is None:
                # First time setup
                conn.execute("INSERT INTO db_version (version) VALUES (?)", (CURRENT_VERSION,))
                self._create_initial_schema(conn)
            elif current_version[0] < CURRENT_VERSION:
                # Need to migrate
                self._migrate_db(conn, current_version[0], CURRENT_VERSION)

    def _create_initial_schema(self, conn: sqlite3.Connection):
        """Create the initial database schema"""
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                title TEXT,
                model TEXT,
                provider TEXT
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                content TEXT,
                tool_calls TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
            )
        """)

    def _migrate_db(self, conn: sqlite3.Connection, from_version: int, to_version: int):
        """Handle database migrations"""
        # Add migration logic here when needed
        # Example:
        # if from_version < 2:
        #     conn.execute("ALTER TABLE chat_sessions ADD COLUMN new_column TEXT")
        
        # Update version
        conn.execute("UPDATE db_version SET version = ?", (to_version,))

    async def save_chat_session(self, session_id: str, model: str, provider: str, title: Optional[str] = None):
        """Save a new chat session"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT OR REPLACE INTO chat_sessions (session_id, model, provider, title, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (session_id, model, provider, title))
            await db.commit()

    async def save_message(self, session_id: str, role: str, content: str, tool_calls: Optional[List[Dict[str, Any]]] = None):
        """Save a chat message"""
        async with aiosqlite.connect(self.db_path) as db:
            tool_calls_json = json.dumps(tool_calls) if tool_calls else None
            await db.execute("""
                INSERT INTO chat_messages (session_id, role, content, tool_calls)
                VALUES (?, ?, ?, ?)
            """, (session_id, role, content, tool_calls_json))
            await db.commit()

    async def get_chat_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get chat history for a session"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT role, content, tool_calls, created_at
                FROM chat_messages
                WHERE session_id = ?
                ORDER BY created_at ASC
            """, (session_id,))
            rows = await cursor.fetchall()
            
            messages = []
            for row in rows:
                message = dict(row)
                if message['tool_calls']:
                    message['tool_calls'] = json.loads(message['tool_calls'])
                messages.append(message)
            return messages

    async def list_sessions(self) -> List[Dict[str, Any]]:
        """List all chat sessions"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT session_id, title, model, provider, created_at, updated_at
                FROM chat_sessions
                ORDER BY updated_at DESC
            """)
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

# Create a singleton instance
db_service = DatabaseService() 