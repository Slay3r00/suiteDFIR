import logging

from fastapi import APIRouter, HTTPException

from core.models import Case, CaseCreate, CaseUpdate, MessageResponse
from services.case_manager import case_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/cases",
    tags=["cases"]
)

@router.get("", response_model=list[Case])
async def get_cases():
    """Get list of all cases"""
    rows = await case_manager.get_cases()
    return [Case.model_validate(row) for row in rows]

@router.post("", response_model=Case)
async def create_case(case: CaseCreate):
    """Create a new case"""
    case_id = await case_manager.create_case(case.model_dump())
    row = await case_manager.get_case(case_id)
    if not row:
        raise HTTPException(status_code=404, detail="Failed to fetch created case")

    return Case.model_validate(row)

@router.get("/{case_id}", response_model=Case)
async def get_case(case_id: int):
    """Get a specific case by ID"""
    row = await case_manager.get_case(case_id)
    
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
        
    return Case.model_validate(row)

@router.put("/{case_id}", response_model=Case)
async def update_case(case_id: int, case_update: CaseUpdate):
    """Update an existing case"""
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

@router.post("/{case_id}/visit", response_model=Case)
async def visit_case(case_id: int):
    """Update the last_visited_at timestamp for a case"""
    logger.info(f"Tracking visit for case ID: {case_id}")
    
    await case_manager.visit_case(case_id)
    
    # Fetch updated case
    row = await case_manager.get_case(case_id)
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
        
    return Case.model_validate(row)

@router.delete("/{case_id}", response_model=MessageResponse)
async def delete_case(case_id: int):
    """Delete a case and all associated data"""
    result = await case_manager.delete_case(case_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=404, detail="Case not found")
    
    if result.get("errors"):
        logger.error(f"Case deleted with filesystem errors for {case_id}: {result['errors']}")

    return {"message": "Case and associated data deleted successfully"}
