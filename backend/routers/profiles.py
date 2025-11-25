from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Optional
import sqlite3
import json
from models import Profile, ProfileCreate
from database import DB_PATH
from config import TOOLS_CONFIG
from state import available_modules

router = APIRouter(
    tags=["profiles"]
)

@router.get("/api/profiles", response_model=List[Profile])
async def get_profiles(tool: str):
    """Get list of all saved profiles for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, tool, modules_json FROM profiles WHERE tool = ?", (tool,))
    profiles = []
    for row in cursor.fetchall():
        profiles.append(Profile(
            id=row[0],
            name=row[1],
            tool=row[2],
            modules=json.loads(row[3])
        ))
    conn.close()
    return profiles

@router.post("/api/profiles")
async def save_profile(profile: ProfileCreate):
    """Create a new profile for specified tool"""
    if profile.tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{profile.tool}' not found")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        modules_json = json.dumps(profile.modules)

        cursor.execute(
            'INSERT INTO profiles (name, tool, modules_json) VALUES (?, ?, ?)',
            (profile.name, profile.tool, modules_json)
        )
        profile_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return Profile(
            id=profile_id,
            name=profile.name,
            tool=profile.tool,
            modules=profile.modules
        )
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
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT name, modules_json FROM profiles WHERE id = ? AND tool = ?', (profile_id, tool))
        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile_name, modules_json = row
        selected_modules = json.loads(modules_json)
        
        # Update available_modules state
        if tool in available_modules:
            selected_set = set(selected_modules)
            
            for module_name, module_data in available_modules[tool].items():
                module_data["selected"] = module_name in selected_set

        return {
            "message": f"Loaded profile: {profile_name}",
            "profile_id": profile_id,
            "selected_count": len(selected_modules),
            "modules": selected_modules
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load profile: {str(e)}")

@router.delete("/api/profiles/{profile_id}")
async def delete_profile(profile_id: int):
    """Delete a profile"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM profiles WHERE id = ?', (profile_id,))
        conn.commit()
        rows_affected = cursor.rowcount
        conn.close()

        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Profile not found")

        return {"message": "Profile deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete profile: {str(e)}")

@router.get("/api/profiles/modules")
async def get_modules(tool: str):
    """Get available modules for a specific tool"""
    if tool not in available_modules:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    modules = list(available_modules[tool].values())
    return {"modules": modules, "total": len(modules)}

@router.post("/api/profiles/modules/select")
async def select_modules(tool: str = Body(...), selections: Dict[str, bool] = Body(...)):
    """Update module selection state for specified tool"""
    if tool not in TOOLS_CONFIG:
        raise HTTPException(status_code=404, detail=f"Tool '{tool}' not found")
    
    if tool not in available_modules:
        raise HTTPException(status_code=503, detail=f"{TOOLS_CONFIG[tool]['name']} not initialized")

    # Update selection state in memory
    if tool in available_modules:
        for module_name, selected in selections.items():
            if module_name in available_modules[tool]:
                available_modules[tool][module_name]["selected"] = selected

    selected_count = sum(1 for m in available_modules[tool].values() if m.get("selected"))
    return {"message": f"Updated selections: {selected_count} modules selected"}
