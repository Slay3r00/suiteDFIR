import logging
from fastapi import APIRouter, Body, Depends, HTTPException

from core.config import TOOLS_CONFIG
from core.models import MessageResponse, ModulesResponse, ModuleSelectionResult, Profile, ProfileCreate, ProfileLoadResult
from services.profile_manager import profile_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/profiles",
    tags=["profiles"]
)


def validate_tool(tool: str) -> str:
    """
    Dependency that validates a tool exists in configuration.
    Returns the normalized (lowercase) tool name.
    """
    tool = tool.lower()
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    return tool

@router.get("", response_model=list[Profile])
async def get_profiles(tool: str = Depends(validate_tool)):
    """Get list of all saved profiles for specified tool"""
    rows = await profile_manager.get_profiles(tool)
    return [Profile.model_validate(row) for row in rows]

@router.post("", response_model=Profile)
async def save_profile(profile: ProfileCreate):
    """Create a new profile for specified tool"""
    # Validate tool exists
    validate_tool(profile.tool)
    
    try:
        result = await profile_manager.create_profile(
            name=profile.name,
            tool=profile.tool,
            modules=profile.modules
        )
        return Profile.model_validate(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{profile_id}/load", response_model=ProfileLoadResult)
async def load_profile(profile_id: int, tool: str = Body(..., embed=True)):
    """Load a profile's module selection for specified tool"""
    # Validate tool exists
    validate_tool(tool)
    
    result = await profile_manager.load_profile(profile_id, tool)
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return ProfileLoadResult(
        message=f"Loaded profile: {result['profile_name']}",
        profile_id=result['profile_id'],
        selected_count=result['selected_count'],
        modules=result['modules']
    )

@router.delete("/{profile_id}", response_model=MessageResponse)
async def delete_profile(profile_id: int):
    """Delete a profile"""
    deleted = await profile_manager.delete_profile(profile_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Profile not found")
    return MessageResponse(message="Profile deleted successfully")

@router.get("/modules", response_model=ModulesResponse)
async def get_modules(tool: str = Depends(validate_tool)):
    """Get available modules for a specific tool"""
    result = await profile_manager.get_modules(tool)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found or not loaded")
    return result

@router.post("/modules/select", response_model=ModuleSelectionResult)
async def select_modules(tool: str = Body(...), selections: dict[str, bool] = Body(...)):
    """Update module selection state for specified tool"""
    # Validate tool exists
    validate_tool(tool)
    
    try:
        selected_count = await profile_manager.select_modules(tool, selections)
        return ModuleSelectionResult(message=f"Updated selections: {selected_count} modules selected")
    except ValueError as e:
        # If tool not initialized (not in available_modules)
        raise HTTPException(status_code=503, detail=str(e))
