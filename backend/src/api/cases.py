import logging
from typing import List
from services.case_manager import case_manager
from fastapi import APIRouter, HTTPException
from core.models import Case, CaseCreate, CaseUpdate

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/cases",
    tags=["cases"]
)

@router.get("", response_model=List[Case])
async def get_cases():
    """Get list of all cases"""
    try:
        rows = await case_manager.get_cases()
        return [Case.model_validate(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cases: {str(e)}")

@router.post("", response_model=Case)
async def create_case(case: CaseCreate):
    """Create a new case"""
    try:
        case_id = await case_manager.create_case(case.model_dump())
        row = await case_manager.get_case(case_id)
        if not row:
            raise HTTPException(status_code=404, detail="Failed to fetch created case")

        return Case.model_validate(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create case: {str(e)}")

@router.get("/{case_id}", response_model=Case)
async def get_case(case_id: int):
    """Get a specific case by ID"""
    try:
        row = await case_manager.get_case(case_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Case not found")
            
        return Case.model_validate(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch case: {str(e)}")

@router.put("/{case_id}", response_model=Case)
async def update_case(case_id: int, case_update: CaseUpdate):
    """Update an existing case"""
    try:
        # Build update query dynamically
        update_data = case_update.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
            
        success = await case_manager.update_case(case_id, update_data)
        if not success:
             raise HTTPException(status_code=404, detail="Case not found")

        # Fetch updated case
        row = await case_manager.get_case(case_id)
        if not row:
            raise HTTPException(status_code=404, detail="Case not found")
        return Case.model_validate(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update case: {str(e)}")

@router.post("/{case_id}/visit", response_model=Case)
async def visit_case(case_id: int):
    """Update the last_visited_at timestamp for a case"""
    try:
        logger.info(f"Tracking visit for case ID: {case_id}")
        
        row = await case_manager.get_case(case_id)
        if not row:
             raise HTTPException(status_code=404, detail="Case not found")

        await case_manager.visit_case(case_id)
        
        # Fetch updated case
        row = await case_manager.get_case(case_id)
        return Case.model_validate(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to track case visit: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to track case visit: {str(e)}")

@router.delete("/{case_id}")
async def delete_case(case_id: int):
    """Delete a case and all associated data"""
    try:
        # Check if case exists
        row = await case_manager.get_case(case_id)
        if not row:
            raise HTTPException(status_code=404, detail="Case not found")

        result = await case_manager.delete_case(case_id)
        
        if result.get("errors"):
            logger.error(f"Case deleted with filesystem errors for {case_id}: {result['errors']}")

        return {"message": "Case and associated data deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete case: {str(e)}")
