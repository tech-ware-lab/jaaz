import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import aiosqlite
from .config_service import USER_DATA_DIR
DB_PATH = os.path.join(USER_DATA_DIR, "localmanus.db")

# Database version
CURRENT_VERSION = 2

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
        # Create canvases table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS canvases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT,
                description TEXT DEFAULT '',
                thumbnail TEXT DEFAULT '',
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON canvases(updated_at DESC, id DESC)
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                canvas_id TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                title TEXT,
                model TEXT,
                provider TEXT,
                FOREIGN KEY (canvas_id) REFERENCES canvases(id)
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC, id DESC)
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                message TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id_id ON chat_messages(session_id, id);
        """)

    def _migrate_db(self, conn: sqlite3.Connection, from_version: int, to_version: int):
        """Handle database migrations"""
        if from_version < 2:
            # 创建 canvases 表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS canvases (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    data TEXT,
                    description TEXT DEFAULT '',
                    thumbnail TEXT DEFAULT '',
                    created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON canvases(updated_at DESC, id DESC)
            """)

            # Add canvas_id column to chat_sessions
            conn.execute("ALTER TABLE chat_sessions ADD COLUMN canvas_id TEXT REFERENCES canvases(id)")
            
            # Create default canvas
            conn.execute("""
                INSERT INTO canvases (id, name)
                VALUES ('default', 'Default Canvas')
            """)
            
            # Associate all existing sessions with default canvas
            conn.execute("""
                UPDATE chat_sessions
                SET canvas_id = 'default'
                WHERE canvas_id IS NULL
            """)
        
        # Update version
        conn.execute("UPDATE db_version SET version = ?", (to_version,))

    async def create_canvas(self, id: str, name: str):
        """Create a new canvas"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO canvases (id, name)
                VALUES (?, ?)
            """, (id, name))
            await db.commit()

    async def list_canvases(self) -> List[Dict[str, Any]]:
        """Get all canvases"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT id, name, description, thumbnail, created_at, updated_at
                FROM canvases
                ORDER BY updated_at DESC
            """)
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def create_chat_session(self, id: str, model: str, provider: str, canvas_id: str, title: Optional[str] = None):
        """Save a new chat session"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO chat_sessions (id, model, provider, canvas_id, title)
                VALUES (?, ?, ?, ?, ?)
            """, (id, model, provider, canvas_id, title))
            await db.commit()

    async def create_message(self, session_id: str, role: str, message: str):
        """Save a chat message"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO chat_messages (session_id, role, message)
                VALUES (?, ?, ?)
            """, (session_id, role, message))
            await db.commit()

    async def get_chat_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get chat history for a session"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT role, message, id
                FROM chat_messages
                WHERE session_id = ?
                ORDER BY id ASC
            """, (session_id,))
            rows = await cursor.fetchall()
            
            messages = []
            for row in rows:
                row_dict = dict(row)
                if row_dict['message']:
                    try:
                        msg = json.loads(row_dict['message'])
                        messages.append(msg)
                    except:
                        pass
                
            return messages

    async def list_sessions(self, canvas_id: str) -> List[Dict[str, Any]]:
        """List all chat sessions"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            if canvas_id:
                cursor = await db.execute("""
                    SELECT id, title, model, provider, created_at, updated_at
                    FROM chat_sessions
                    WHERE canvas_id = ?
                    ORDER BY updated_at DESC
                """, (canvas_id,))
            else:
                cursor = await db.execute("""
                    SELECT id, title, model, provider, created_at, updated_at
                    FROM chat_sessions
                    ORDER BY updated_at DESC
                """)
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def save_canvas_data(self, id: str, data: str):
        """Save canvas data"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                UPDATE canvases 
                SET data = ?, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ?
            """, (data, id))
            await db.commit()

    async def get_canvas_data(self, id: str) -> Optional[Dict[str, Any]]:
        """Get canvas data"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT data, name
                FROM canvases
                WHERE id = ?
            """, (id,))
            row = await cursor.fetchone()

            sessions = await self.list_sessions(id)
            
            if row:
                return {
                    'data': json.loads(row['data']) if row['data'] else {},
                    'sessions': sessions
                }
            return None

    async def delete_canvas(self, id: str):
        """Delete canvas and related data"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM canvases WHERE id = ?", (id,))
            await db.commit()

# Create a singleton instance
db_service = DatabaseService() 