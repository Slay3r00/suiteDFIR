import os
import re
import shutil
import logging
import mimetypes
import tempfile
import subprocess
import platform
from typing import Optional
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from core.models import Report
from core.config import REPORTS_DIR
from services.report_manager import report_manager
from utils.constants import SCROLL_TRACKING_SCRIPT

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"]
)


@router.get("", response_model=list[Report])
async def get_reports(case_id: Optional[int] = None):
    """Get list of reports from database"""
    try:
        rows = await report_manager.get_reports(case_id)
        return [Report.model_validate(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")


@router.delete("")
async def delete_report(path: str):
    """Delete a report from database and filesystem"""
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")

    try:
        result = await report_manager.delete_report(path)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=result.get("status_code", 500),
                detail=result.get("error")
            )
        
        return {"message": result.get("message")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")


@router.post("/open")
async def open_report(path: str):
    """Open report folder in system file explorer"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        if platform.system() == "Darwin":  # macOS
            subprocess.run(["open", path])
        elif platform.system() == "Windows":
            os.startfile(path)
        else:  # Linux
            subprocess.run(["xdg-open", path])
        return {"message": "Report opened successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open report: {str(e)}")


@router.get("/download")
async def download_report(path: str):
    """Zip and download report directory"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        temp_dir = tempfile.mkdtemp()
        zip_name = f"{os.path.basename(path)}.zip"
        zip_path = os.path.join(temp_dir, zip_name)

        shutil.make_archive(os.path.splitext(zip_path)[0], 'zip', path)

        return FileResponse(
            zip_path,
            media_type='application/zip',
            filename=zip_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download report: {str(e)}")

@router.get("/view/{file_path:path}")
async def serve_report_file(file_path: str):
    """Serve report files with scroll tracking script injection for HTML files"""
    full_path = os.path.join(REPORTS_DIR, file_path)

    # Security check: ensure path is within reports directory
    if not os.path.abspath(full_path).startswith(os.path.abspath(REPORTS_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    if os.path.isdir(full_path):
        # If directory, try to serve index.html
        full_path = os.path.join(full_path, "index.html")
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="index.html not found")

    # Determine content type
    content_type, _ = mimetypes.guess_type(full_path)
    if content_type is None:
        content_type = "application/octet-stream"

    # For HTML files, inject the scroll tracking script
    if full_path.endswith('.html') or full_path.endswith('.htm'):
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        # Inject script before </body> or at end if no </body>
        if '</body>' in content.lower():
            content = re.sub(
                r'(</body>)',
                SCROLL_TRACKING_SCRIPT + r'\1',
                content,
                count=1,
                flags=re.IGNORECASE
            )
        else:
            content += SCROLL_TRACKING_SCRIPT

        headers = {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
        return Response(content=content, media_type="text/html", headers=headers)

    # For non-HTML files, serve directly
    return FileResponse(full_path, media_type=content_type)
