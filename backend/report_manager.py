import os
import shutil
import logging
import asyncio
from typing import List, Dict, Any, Optional
from database import db_execute, db_fetch_all
from config import REPORTS_DIR
from utils import get_size_format

logger = logging.getLogger(__name__)


class ReportManager:
    """Manages forensic report data and filesystem operations."""

    async def get_reports(self, case_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get reports from DB for case with computed stats (size, file count, URL)."""
        if not case_id:
            return []
        rows = await db_fetch_all(
            'SELECT name, path, tool, created_at FROM reports WHERE case_id = ? ORDER BY created_at DESC',
            (case_id,)
        )

        reports = []
        for row in rows:
            path = row['path']
            
            if not os.path.exists(path):
                continue

            try:
                stats = await self._calculate_report_stats(path)
                
                # Calculate relative path for URL
                rel_path = os.path.relpath(path, REPORTS_DIR)
                url = f"/api/reports/view/{rel_path}/index.html"

                reports.append({
                    "name": row['name'],
                    "path": path,
                    "url": url,
                    "tool": row['tool'],
                    "created_at": row['created_at'],
                    "size": stats['size'],
                    "artifact_count": stats['file_count']
                })
            except Exception as e:
                logger.error(f"Error processing report {row['name']}: {e}")
                continue

        return reports

    async def delete_report(self, path: str) -> Dict[str, Any]:
        """Delete a report from DB and filesystem"""
        # Security check: ensure path is within reports directory
        if not os.path.abspath(path).startswith(os.path.abspath(REPORTS_DIR)):
            return {"success": False, "error": "Access denied", "status_code": 403}

        # Delete from DB first
        await db_execute("DELETE FROM reports WHERE path = ?", (path,))

        # Delete from filesystem
        if os.path.exists(path):
            try:
                await self._delete_path(path)
                return {"success": True, "message": "Report deleted successfully"}
            except Exception as e:
                logger.error(f"Error deleting report files at {path}: {e}")
                return {"success": True, "message": "Report deleted from DB (filesystem error)"}
        else:
            return {"success": True, "message": "Report deleted from DB (file not found on disk)"}

    async def _calculate_report_stats(self, path: str) -> Dict[str, Any]:
        """Calculate size and file count for a report directory."""
        def _calc():
            total_size = 0
            file_count = 0
            for dirpath, dirnames, filenames in os.walk(path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if not os.path.islink(fp):
                        try:
                            total_size += os.path.getsize(fp)
                        except OSError:
                            pass
                    file_count += 1
            return {"size": get_size_format(total_size), "file_count": file_count}

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _calc)

    async def _delete_path(self, path: str):
        """Asynchronously delete a file or directory."""
        def _do_delete():
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _do_delete)


# Global instance
report_manager = ReportManager()
