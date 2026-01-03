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
                # Use /api/reports/view/ endpoint for scroll tracking injection
                rel_path = os.path.relpath(path, REPORTS_DIR)
                url = f"/api/reports/view/{rel_path}/index.html"

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


# Enhanced scroll tracking script to inject into HTML reports
# Tracks: sidebar scroll, main content scroll, and current page URL
SCROLL_TRACKING_SCRIPT = """
<script>
(function() {
    // Throttle for performance
    let scrollTimeout;
    let sidebarTimeout;
    let dtTimeout;
    
    // Get sidebar element (LEAPP uses #sidebar_id)
    function getSidebar() {
        return document.getElementById('sidebar_id') || 
               document.querySelector('.sidebar-sticky') || 
               document.querySelector('.sidebar');
    }

    // Get DataTables page info if present
    function getDtPage() {
        if (typeof $ === 'undefined' || !$.fn.dataTable) return undefined;

        // Method 1: Global API
        const tables = $.fn.dataTable.tables({ visible: true, api: true });
        if (tables.any()) return tables.page();

        // Method 2: Fallback selector
        const fallbackTable = $('table.dataTable, table.display, table.table-striped').first();
        if (fallbackTable.length && fallbackTable.DataTable) {
             return fallbackTable.DataTable().page();
        }
        return undefined;
    }
    
    // Send combined state to parent
    function sendState() {
        const sidebar = getSidebar();
        let dtPageVal = undefined;

        try {
            dtPageVal = getDtPage();
        } catch (e) {
            // console.error(e);
        }

        const state = {
            type: 'reportState',
            mainScrollY: window.scrollY || document.documentElement.scrollTop,
            sidebarScrollY: sidebar ? sidebar.scrollTop : 0,
            currentPage: window.location.pathname + window.location.search,
            dtPage: dtPageVal
        };
        window.parent.postMessage(state, '*');
    }
    
    // Track main window scroll
    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(sendState, 100);
    }, { passive: true });
    
    // Track sidebar scroll if present
    function attachSidebarListener() {
        const sidebar = getSidebar();
        if (sidebar) {
            sidebar.addEventListener('scroll', function() {
                clearTimeout(sidebarTimeout);
                sidebarTimeout = setTimeout(sendState, 100);
            }, { passive: true });
        }
    }

    // Track DataTables pagination events
    function attachDtListener() {
        if (typeof $ !== 'undefined' && $.fn.dataTable) {
            $(document).on('page.dt length.dt', function() {
                clearTimeout(dtTimeout);
                dtTimeout = setTimeout(sendState, 100);
            });
        }
    }
    
    // Handle messages from parent
    window.addEventListener('message', function(event) {
        if (!event.data) return;
        
        // Restore full state
        if (event.data.type === 'restoreState') {
            const hasDt = typeof $ !== 'undefined' && $.fn.dataTable;
            console.log('[Injected] Restoring state:', event.data, 'HasDT:', hasDt);

            // 1. Restore DataTables Page (if applicable)
            // 1. Restore DataTables Page (if applicable)
            if (event.data.dtPage !== undefined && hasDt) {
                // Method 1: Global API
                let tables = $.fn.dataTable.tables({ visible: true, api: true });
                let targetTableApi = null;

                if (tables.any()) {
                    targetTableApi = tables;
                } else {
                    // Method 2: Fallback selector
                    const fallbackTable = $('table.dataTable, table.display, table.table-striped').first();
                    if (fallbackTable.length && fallbackTable.DataTable) {
                         targetTableApi = fallbackTable.DataTable();
                    }
                }
                
                if (targetTableApi) {
                    const currentPage = targetTableApi.page();
                    const targetPage = event.data.dtPage;
                    // console.log('[Injected] Table page - Current:', currentPage, 'Target:', targetPage);
                    
                    if (currentPage !== targetPage) {
                        // console.log('[Injected] Changing table page to:', targetPage);
                        targetTableApi.page(targetPage).draw('page');
                    }
                }
            }

            // 2. Restore Scroll Positions
            if (event.data.mainScrollY !== undefined) {
                window.scrollTo({ top: event.data.mainScrollY, behavior: 'instant' });
            }
            if (event.data.sidebarScrollY !== undefined) {
                const sidebar = getSidebar();
                if (sidebar) {
                    sidebar.scrollTop = event.data.sidebarScrollY;
                }
            }
        }
        
        // Legacy support for simple scroll
        if (event.data.type === 'scrollTo') {
            window.scrollTo({ top: event.data.scrollY, behavior: 'instant' });
        }
        
        // Request current state
        if (event.data.type === 'getState' || event.data.type === 'getScroll') {
            sendState();
        }
    });
    
    // Initialize on load
    window.addEventListener('load', function() {
        attachSidebarListener();
        attachDtListener();
        // Send initial state after a short delay
        setTimeout(sendState, 200);
    });
    
    // Also try to attach immediately in case DOM is already ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        attachSidebarListener();
        attachDtListener();
    }
})();
</script>
"""



from fastapi import Response
import mimetypes

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
            # Find </body> case-insensitively and inject before it
            import re
            content = re.sub(
                r'(</body>)',
                SCROLL_TRACKING_SCRIPT + r'\1',
                content,
                count=1,
                flags=re.IGNORECASE
            )
        else:
            # No </body> tag, append at end
            content += SCROLL_TRACKING_SCRIPT
        
        headers = {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
        return Response(content=content, media_type="text/html", headers=headers)
    
    # For non-HTML files, serve directly
    return FileResponse(full_path, media_type=content_type)

