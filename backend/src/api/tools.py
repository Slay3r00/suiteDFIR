import logging

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import validate_tool
from core.models import ToolInstallResult, ToolsStatusResponse
from services.plugin_manager import load_plugins
from services.tool_manager import tool_manager
from utils.sse import wrapped_sse_generator, create_sse_response

router = APIRouter(
    prefix="/api/tools",
    tags=["tools"]
)

logger = logging.getLogger(__name__)

@router.get("/status", response_model=ToolsStatusResponse)
async def get_tools_status():
    """Get installation status of all configured tools."""
    return tool_manager.check_tools_status()


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
    result = await tool_manager.install_tool(tool)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Installation failed"))
    
    # Reload plugins so modules are available immediately
    try:
        load_plugins()
    except Exception as e:
        logger.warning(f"Failed to reload plugins: {e}")
    
    return result


@router.delete("/{tool}", response_model=ToolInstallResult)
async def uninstall_tool(tool: str = Depends(validate_tool)):
    """Uninstall a tool."""
    result = await tool_manager.uninstall_tool(tool)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Uninstall failed"))
    
    return result
