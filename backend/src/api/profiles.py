import logging

from fastapi import APIRouter, Body, Depends, HTTPException

from api.dependencies import validate_tool
from core.config import TOOLS_CONFIG
from core.models import Profile, ProfileCreate
from core.state import available_modules
from services.profile_manager import profile_manager

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/api/profiles",
    tags=["profiles"]
)


@router.get("", response_model=list[Profile])
async def get_profiles(tool: str = Depends(validate_tool)):
    """Get list of all saved profiles for specified tool"""
    rows = await profile_manager.get_profiles(tool)
    return [Profile.model_validate(row) for row in rows]


@router.post("")
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
    except Exception as e:
        if "UNIQUE constraint" in str(e):
            raise HTTPException(status_code=400, detail="Profile with this name already exists")
        raise


@router.post("/{profile_id}/load")
async def load_profile(profile_id: int, tool: str = Body(..., embed=True)):
    """Load a profile's module selection for specified tool"""
    # Validate tool exists
    validate_tool(tool)
    
    result = await profile_manager.load_profile(profile_id, tool)
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {
        "message": f"Loaded profile: {result['profile_name']}",
        "profile_id": result['profile_id'],
        "selected_count": result['selected_count'],
        "modules": result['modules']
    }


@router.delete("/{profile_id}")
async def delete_profile(profile_id: int):
    """Delete a profile"""
    deleted = await profile_manager.delete_profile(profile_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile deleted successfully"}


@router.get("/modules")
async def get_modules(tool: str = Depends(validate_tool)):
    """Get available modules for a specific tool"""
    result = await profile_manager.get_modules(tool)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found or not loaded")
    return result


@router.post("/modules/select")
async def select_modules(tool: str = Body(...), selections: dict[str, bool] = Body(...)):
    """Update module selection state for specified tool"""
    # Validate tool exists
    validate_tool(tool)
    
    if tool not in available_modules:
        raise HTTPException(status_code=503, detail=f"{TOOLS_CONFIG[tool]['name']} not initialized")

    selected_count = await profile_manager.select_modules(tool, selections)
    return {"message": f"Updated selections: {selected_count} modules selected"}
