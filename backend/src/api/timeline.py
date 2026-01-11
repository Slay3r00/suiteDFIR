import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services.timeline_manager import timeline_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/cases/{case_id}/timeline",
    tags=["timeline"]
)

@router.get("")
async def get_timeline(
    case_id: int,
    page: int = Query(0, ge=0),
    limit: int = Query(10, ge=-1),
    sort_by: str = Query("date", regex="^(date|artifact|description|source|id)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    search: Optional[str] = None,
    filters: Optional[str] = None,
    report_id: Optional[str] = None
):
    """
    Fetch timeline events from tl.db files for a specific case.
    Supports pagination, sorting, filtering by report, global search, and column filters.
    """
    return await timeline_manager.get_timeline_events(
        case_id=case_id,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
        search=search,
        filters=filters,
        report_id=report_id
    )

