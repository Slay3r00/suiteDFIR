import logging

from fastapi import APIRouter, Depends, HTTPException

from core.config import TOOLS_CONFIG
from core.models import ToolInstallResult, ToolsStatusResponse
from services.plugin_manager import load_plugins
from services.tool_manager import tool_manager
from utils.sse import wrapped_sse_generator, create_sse_response

router = APIRouter(
    prefix="/api/tools",
    tags=["tools"]
)

logger = logging.getLogger(__name__)


def validate_tool(tool: str) -> str:
    """
    Dependency that validates a tool exists in configuration.
    Returns the normalized (lowercase) tool name.
    """
    tool = tool.lower()
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    return tool

@router.get("/status", response_model=ToolsStatusResponse)
async def get_tools_status():
    """Get installation status of all configured tools."""
    return ToolsStatusResponse.model_validate(tool_manager.check_tools_status())


@router.post("/install/{tool}")
async def install_tool(tool: str = Depends(validate_tool)):
    """
    Install a tool from GitHub. Returns Server-Sent Events for progress updates.
    """
    return create_sse_response(wrapped_sse_generator(tool_manager.install_tool_stream(tool, on_success=load_plugins)))


@router.post("/install/{tool}/sync", response_model=ToolInstallResult)
async def install_tool_sync(tool: str = Depends(validate_tool)):
    """
    Install a tool synchronously (for simpler clients).
    """
    try:
        return ToolInstallResult.model_validate(await tool_manager.install_tool(tool))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tool}", response_model=ToolInstallResult)
async def uninstall_tool(tool: str = Depends(validate_tool)):
    """Uninstall a tool."""
    try:
        return ToolInstallResult.model_validate(await tool_manager.uninstall_tool(tool))
    except ValueError as e:
         raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
         raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
         raise HTTPException(status_code=500, detail=str(e))
