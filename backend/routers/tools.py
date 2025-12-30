"""
Tools router for managing forensic tool installations.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
import asyncio

from tool_manager import tool_manager
from config import TOOLS_CONFIG

router = APIRouter(
    prefix="/api/tools",
    tags=["tools"]
)


@router.get("/status")
async def get_tools_status():
    """Get installation status of all configured tools."""
    return tool_manager.check_tools_status()


@router.post("/install/{tool_name}")
async def install_tool(tool_name: str):
    """
    Install a tool from GitHub. Returns Server-Sent Events for progress updates.
    """
    tool_name = tool_name.lower()
    
    if tool_name not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool_name}")
    
    async def generate_progress():
        progress_updates = []
        
        def progress_callback(pct, msg):
            progress_updates.append({"progress": pct, "message": msg})
        
        # Run installation in thread pool to avoid blocking
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(
                tool_manager.install_tool, 
                tool_name, 
                progress_callback
            )
            
            # Stream progress updates while installation runs
            last_sent = 0
            while not future.done():
                if len(progress_updates) > last_sent:
                    for update in progress_updates[last_sent:]:
                        yield f"data: {json.dumps(update)}\n\n"
                    last_sent = len(progress_updates)
                await asyncio.sleep(0.1)
            
            # Send any remaining updates
            for update in progress_updates[last_sent:]:
                yield f"data: {json.dumps(update)}\n\n"
            
            # Get result and send final message
            result = future.result()
            if result["success"]:
                # Reload plugins so modules are available immediately
                try:
                    from plugin_manager import load_plugins
                    load_plugins()
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to reload plugins: {e}")
                
                yield f"data: {json.dumps({'progress': 100, 'message': result['message'], 'complete': True})}\n\n"
            else:
                yield f"data: {json.dumps({'progress': -1, 'message': result.get('error', 'Installation failed'), 'error': True})}\n\n"
    
    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/install/{tool_name}/sync")
async def install_tool_sync(tool_name: str):
    """
    Install a tool synchronously (for simpler clients).
    """
    tool_name = tool_name.lower()
    
    if tool_name not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool_name}")
    
    result = tool_manager.install_tool(tool_name)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Installation failed"))
    
    # Reload plugins so modules are available immediately
    try:
        from plugin_manager import load_plugins
        load_plugins()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to reload plugins: {e}")
    
    return result


@router.delete("/{tool_name}")
async def uninstall_tool(tool_name: str):
    """Uninstall a tool."""
    tool_name = tool_name.lower()
    
    if tool_name not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool_name}")
    
    result = tool_manager.uninstall_tool(tool_name)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Uninstall failed"))
    
    return result
