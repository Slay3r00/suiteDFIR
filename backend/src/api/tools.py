import logging

from fastapi import APIRouter
from core.models import ToolsStatusResponse
from services.tool_manager import tool_manager

router = APIRouter(
    prefix="/api/tools",
    tags=["tools"]
)

logger = logging.getLogger(__name__)


@router.get("/status", response_model=ToolsStatusResponse)
async def get_tools_status():
    """
    Get availability status of all configured forensic tools.

    Returns status for iLEAPP (iOS) and aLEAPP (Android) tools.
    Tools are vendored with the application, so this only checks
    if they exist at expected paths.
    """
    return ToolsStatusResponse.model_validate(tool_manager.check_tools_status())
