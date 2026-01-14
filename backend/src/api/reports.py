import logging
import os
import shutil
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response
from fastapi.responses import FileResponse

from core.config import REPORTS_DIR
from core.models import MessageResponse, Report
from services.report_manager import report_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"]
)


@router.get("", response_model=list[Report])
async def get_reports(case_id: Optional[int] = None):
    """Get list of reports from database"""
    rows = await report_manager.get_reports(case_id)
    return [Report.model_validate(row) for row in rows]


@router.delete("", response_model=MessageResponse)
async def delete_report(path: str):
    """Delete a report from database and filesystem"""
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")

    result = await report_manager.delete_report(path)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error")
        )
    
    return {"message": result.get("message")}


@router.post("/open", response_model=MessageResponse)
async def open_report(path: str):
    """Open report folder in system file explorer"""
    from utils.helpers import handle_open_path_request
    return handle_open_path_request(path, REPORTS_DIR, "Report")


@router.get("/download")
async def download_report(path: str, background_tasks: BackgroundTasks):
    """Zip and download report directory"""
    result = await report_manager.create_zip_archive(path)

    if "error" in result:
        raise HTTPException(
            status_code=result.get("status_code", 500), 
            detail=result.get("error")
        )
    
    # Schedule cleanup of the temp directory containing the zip
    zip_path = result["zip_path"]
    temp_dir = os.path.dirname(zip_path)
    background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)

    return FileResponse(
        zip_path,
        media_type='application/zip',
        filename=result["filename"]
    )

@router.get("/view/{file_path:path}")
async def serve_report_file(file_path: str):
    """Serve report files with scroll tracking script injection for HTML files"""
    result = await report_manager.prepare_report_file(file_path)

    if "error" in result:
        raise HTTPException(status_code=result.get("status_code", 500), detail=result.get("error"))

    if result.get("is_html"):
        return Response(
            content=result["content"],
            media_type=result["media_type"],
            headers=result["headers"]
        )

    return FileResponse(result["file_path"], media_type=result["media_type"])
