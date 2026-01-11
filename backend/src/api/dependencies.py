"""Shared FastAPI dependencies for API routers."""

from fastapi import HTTPException

from core.config import TOOLS_CONFIG


def validate_tool(tool: str) -> str:
    """
    Dependency that validates a tool exists in configuration.
    Returns the normalized (lowercase) tool name.
    """
    tool = tool.lower()
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    return tool
