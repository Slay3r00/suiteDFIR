from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import subprocess
import platform
from typing import List, Optional
import sqlite3
import os
import shutil
import logging
from models import Report
from database import DB_PATH
from utils import get_size_format, normalize_report_path

from config import REPORTS_DIR

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"]
)

@router.get("", response_model=List[Report])
async def get_reports(case_id: Optional[int] = None):
    """Get list of reports from database"""
    reports = []
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get all reports from DB
        if case_id:
            cursor.execute('SELECT name, path, tool, created_at FROM reports WHERE case_id = ? ORDER BY created_at DESC', (case_id,))
        else:
            cursor.execute('SELECT name, path, tool, created_at FROM reports ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        
        for row in rows:
            name, path, tool, created_at = row
            
            # Verify and normalize path
            path = normalize_report_path(path)
            if not os.path.exists(path):
                continue
            
            # logger.debug(f"Found report: {name} ({tool}) at {path}")
                
            try:
                # Calculate size and file count
                total_size = 0
                file_count = 0
                for dirpath, dirnames, filenames in os.walk(path):
                    for f in filenames:
                        fp = os.path.join(dirpath, f)
                        if not os.path.islink(fp):
                            total_size += os.path.getsize(fp)
                        file_count += 1
                
                # Calculate relative path for URL
                # REPORTS_DIR is parent of tool-specific report dirs
                rel_path = os.path.relpath(path, REPORTS_DIR)
                url = f"/reports/{rel_path}/index.html"

                reports.append(Report(
                    name=name,
                    path=path,
                    url=url,
                    tool=tool,
                    created_at=created_at,
                    size=get_size_format(total_size),
                    artifact_count=file_count
                ))
            except Exception as e:
                logger.error(f"Error processing report {name}: {e}")
                continue
                
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

    return reports

@router.delete("")
async def delete_report(path: str):
    """Delete a report from database and filesystem"""
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")
    
    # Security check: ensure path is within reports directory
    if not os.path.abspath(path).startswith(os.path.abspath(REPORTS_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Delete from DB first
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM reports WHERE path = ?", (path,))
        conn.commit()
        conn.close()

        # Delete from filesystem
        if os.path.exists(path):
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
            return {"message": "Report deleted successfully"}
        else:
            return {"message": "Report deleted from DB (file not found on disk)"}
            
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
        # Create zip in temp location
        import tempfile
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
