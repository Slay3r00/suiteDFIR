import sqlite3
import logging
from typing import Dict
from fastapi import APIRouter, HTTPException, Body
from core.models import Profile, ProfileCreate
from core.config import TOOLS_CONFIG
from core.state import available_modules
from services.profile_manager import profile_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["profiles"]
)


@router.get("/api/profiles", response_model=list[Profile])
async def get_profiles(tool: str):
    """Get list of all saved profiles for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    rows = await profile_manager.get_profiles(tool)
    return [Profile.model_validate(row) for row in rows]


@router.post("/api/profiles")
async def save_profile(profile: ProfileCreate):
    """Create a new profile for specified tool"""
    if profile.tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{profile.tool}' not found")
    
    try:
        result = await profile_manager.create_profile(
            name=profile.name,
            tool=profile.tool,
            modules=profile.modules
        )
        return Profile.model_validate(result)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Profile with this name already exists")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create profile: {str(e)}")


@router.post("/api/profiles/{profile_id}/load")
async def load_profile(profile_id: int, tool: str = Body(..., embed=True)):
    """Load a profile's module selection for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    try:
        result = await profile_manager.load_profile(profile_id, tool)
        if not result:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return {
            "message": f"Loaded profile: {result['profile_name']}",
            "profile_id": result['profile_id'],
            "selected_count": result['selected_count'],
            "modules": result['modules']
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load profile: {str(e)}")


@router.delete("/api/profiles/{profile_id}")
async def delete_profile(profile_id: int):
    """Delete a profile"""
    try:
        deleted = await profile_manager.delete_profile(profile_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"message": "Profile deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete profile: {str(e)}")


@router.get("/api/profiles/modules")
async def get_modules(tool: str):
    """Get available modules for a specific tool"""
    result = profile_manager.get_modules(tool)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found or not loaded")
    return result


@router.post("/api/profiles/modules/select")
async def select_modules(tool: str = Body(...), selections: Dict[str, bool] = Body(...)):
    """Update module selection state for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    if tool not in available_modules:
        raise HTTPException(status_code=503, detail=f"{TOOLS_CONFIG[tool]['name']} not initialized")

    selected_count = profile_manager.select_modules(tool, selections)
    return {"message": f"Updated selections: {selected_count} modules selected"}
