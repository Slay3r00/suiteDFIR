import asyncio
import logging
from state import processing_tasks
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from models import ProcessRequest, StopRequest
from process_manager import process_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/process",
    tags=["processing"]
)

@router.post("/start")
async def start_processing(request: ProcessRequest, background_tasks: BackgroundTasks):
    """Start processing with selected modules"""
    return await process_manager.start_process(request, background_tasks)

@router.post("/stop")
async def stop_processing(request: StopRequest = None):
    """Stop current processing job"""
    task_id = request.task_id if request else None
    return await process_manager.stop_process(task_id)

@router.get("/stream/{task_id}")
async def stream_processing_logs(task_id: str):
    """SSE endpoint for real-time processing logs"""
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    async def event_generator():
        if task_id not in processing_tasks:
            return
            
        queue = processing_tasks[task_id]["queue"]
        
        while True:
            if task_id not in processing_tasks:
                break
                
            # Check if completed and empty
            if processing_tasks[task_id]["status"] in ["success", "error", "cancelled"] and queue.empty():
                yield f"event: close\ndata: Stream ended\n\n"
                break
                
            try:
                message = await asyncio.wait_for(queue.get(), timeout=1.0)
                yield f"data: {message}\n\n"
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                yield f"data: Error reading log: {str(e)}\n\n"
                break
                
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )
