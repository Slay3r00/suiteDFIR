import logging

from fastapi import APIRouter, HTTPException

from core.models import SettingValue
from services.settings_manager import settings_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/settings",
    tags=["settings"]
)


@router.get("/{key}")
async def get_setting(key: str):
    """Get a setting by key."""
    value = await settings_manager.get_setting(key)
    if value is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    return {"key": key, "value": value}


@router.put("/{key}")
async def set_setting(key: str, body: SettingValue):
    """Create or update a setting."""
    await settings_manager.set_setting(key, body.value)
    return {"key": key, "value": body.value}
