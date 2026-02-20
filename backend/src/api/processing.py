import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException

from core.models import MessageResponse, ProcessingStarted, ProcessRequest, StopRequest
from core.state import processing_tasks
from services.process_manager import process_manager
from utils.sse import create_task_sse_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/process",
    tags=["processing"]
)

@router.post("/start", response_model=ProcessingStarted)
async def start_processing(request: ProcessRequest, background_tasks: BackgroundTasks):
    """Start processing with selected modules"""
    try:
        return ProcessingStarted.model_validate(await process_manager.start_process(request, background_tasks))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop", response_model=MessageResponse)
async def stop_processing(request: StopRequest = None):
    """Stop current processing job"""
    task_id = request.task_id if request else None
    try:
        return MessageResponse.model_validate(await process_manager.stop_process(task_id))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/stream/{task_id}")
async def stream_processing_logs(task_id: str):
    """SSE endpoint for real-time processing logs"""
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    return create_task_sse_response(
        task_id=task_id,
        task_dict=processing_tasks,
        terminal_statuses=["success", "error", "cancelled"],
        cleanup=False
    )
