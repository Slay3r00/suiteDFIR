import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

from core.models import MessageResponse, Note, NoteCreate, RecentActivityResponse, Task, TaskCreate
from services.system_manager import system_manager
from services.task_note_manager import task_note_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"]
)

# Task Management

@router.get("/tasks", response_model=list[Task])
async def get_tasks(case_id: Optional[int] = None):
    """Retrieve all dashboard tasks."""
    rows = await task_note_manager.get_tasks(case_id)
    return [Task.model_validate(row) for row in rows]

@router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    """Create a new dashboard task."""
    logger.info("Creating new dashboard task")
    row = await task_note_manager.create_task(task)
    return Task.model_validate(row)

@router.put("/tasks/{task_id}", response_model=Task)
async def toggle_task(task_id: int):
    """Toggle the completion status of a task."""
    logger.info(f"Toggling task status for ID: {task_id}")
    try:
        task = await task_note_manager.toggle_task_status(task_id)
        return Task.model_validate(task)
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")

@router.delete("/tasks/{task_id}", response_model=MessageResponse)
async def delete_task(task_id: int):
    """Delete a dashboard task."""
    logger.info(f"Deleting task ID: {task_id}")
    try:
        result = await task_note_manager.delete_task(task_id)
        return MessageResponse.model_validate(result)
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")

# Note Management

@router.get("/notes", response_model=list[Note])
async def get_notes(case_id: Optional[int] = None):
    """Retrieve all dashboard notes."""
    rows = await task_note_manager.get_notes(case_id)
    return [Note.model_validate(row) for row in rows]

@router.post("/notes", response_model=Note)
async def create_note(note: NoteCreate):
    """Create a new dashboard note."""
    logger.info("Creating new dashboard note")
    row = await task_note_manager.create_note(note)
    return Note.model_validate(row)

@router.delete("/notes/{note_id}", response_model=MessageResponse)
async def delete_note(note_id: int):
    """Delete a dashboard note."""
    logger.info(f"Deleting note ID: {note_id}")
    try:
        result = await task_note_manager.delete_note(note_id)
        return MessageResponse.model_validate(result)
    except ValueError:
        raise HTTPException(status_code=404, detail="Note not found")

# System Activity

@router.get("/activity", response_model=RecentActivityResponse)
async def get_recent_activity(case_id: Optional[int] = None):
    """Get recent activity for the dashboard"""
    result = await system_manager.get_recent_activity(case_id)
    return RecentActivityResponse(activities=result)
