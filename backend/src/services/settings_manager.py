import logging
from typing import Optional

from core.database import db_fetch_one, db_execute

logger = logging.getLogger(__name__)


class SettingsManager:
    """Manages application settings stored in the database."""

    async def get_setting(self, key: str) -> Optional[str]:
        """Get a setting value by key. Returns None if not found."""
        row = await db_fetch_one(
            "SELECT value FROM settings WHERE key = ?", (key,)
        )
        return row["value"] if row else None

    async def set_setting(self, key: str, value: str) -> None:
        """Create or update a setting."""
        await db_execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
            (key, value)
        )

    async def delete_setting(self, key: str) -> None:
        """Delete a setting by key."""
        await db_execute("DELETE FROM settings WHERE key = ?", (key,))


# Global instance
settings_manager = SettingsManager()
