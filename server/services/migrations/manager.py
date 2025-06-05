import importlib
import inspect
import pkgutil
from typing import List, Type
import sqlite3
from . import Migration

class MigrationManager:
    def __init__(self):
        self.migrations: List[Type[Migration]] = []
        self._load_migrations()

    def _load_migrations(self) -> None:
        """Load all migration classes from the migrations"""
        package = importlib.import_module("services.migrations")
        for _, name, _ in pkgutil.iter_modules(package.__path__):
            if name.startswith('v') and name[1:].isdigit():
                module = importlib.import_module(f"services.migrations.{name}")
                for item_name, item in inspect.getmembers(module):
                    if (inspect.isclass(item) and 
                        issubclass(item, Migration) and 
                        item != Migration):
                        self.migrations.append(item)
        
        # Sort migrations by version
        self.migrations.sort(key=lambda x: x.version)

    def get_migrations_to_apply(self, current_version: int, target_version: int) -> List[Type[Migration]]:
        """Get list of migrations to apply"""
        return [m for m in self.migrations 
                if m.version > current_version and m.version <= target_version]

    def get_migrations_to_rollback(self, current_version: int, target_version: int) -> List[Type[Migration]]:
        """Get list of migrations to rollback"""
        return [m for m in reversed(self.migrations)
                if m.version <= current_version and m.version > target_version]

    def migrate(self, conn: sqlite3.Connection, from_version: int, to_version: int) -> None:
        """Apply or rollback migrations to reach target version"""
        if from_version < to_version:
            # Apply migrations forward
            for migration_class in self.get_migrations_to_apply(from_version, to_version):
                migration = migration_class()
                print(f"Applying migration {migration.version}: {migration.description}")
                migration.up(conn)
                conn.execute("UPDATE db_version SET version = ?", (migration.version,))
        else:
            # Rollback migrations
            for migration_class in self.get_migrations_to_rollback(from_version, to_version):
                migration = migration_class()
                print(f"Rolling back migration {migration.version}: {migration.description}")
                migration.down(conn)
                conn.execute("UPDATE db_version SET version = ?", (migration.version - 1,)) 