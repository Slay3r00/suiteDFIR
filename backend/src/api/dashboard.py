import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

from core.models import Note, NoteCreate, Task, TaskCreate
from services.task_note_manager import task_note_manager
from services.system_manager import system_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"]
)

@router.get("/tasks", response_model=list[Task])
async def get_tasks(case_id: Optional[int] = None):
    return await task_note_manager.get_tasks(case_id)

@router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    logger.info("Creating new dashboard task")
    return await task_note_manager.create_task(task)

@router.put("/tasks/{task_id}", response_model=Task)
async def toggle_task(task_id: int):
    logger.info(f"Toggling task status for ID: {task_id}")
    return await task_note_manager.toggle_task_status(task_id)

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int):
    logger.info(f"Deleting task ID: {task_id}")
    return await task_note_manager.delete_task(task_id)

@router.get("/notes", response_model=list[Note])
async def get_notes(case_id: Optional[int] = None):
    return await task_note_manager.get_notes(case_id)

@router.post("/notes", response_model=Note)
async def create_note(note: NoteCreate):
    logger.info("Creating new dashboard note")
    return await task_note_manager.create_note(note)

@router.delete("/notes/{note_id}")
async def delete_note(note_id: int):
    logger.info(f"Deleting note ID: {note_id}")
    return await task_note_manager.delete_note(note_id)

@router.get("/activity")
async def get_recent_activity(case_id: Optional[int] = None):
    """Get recent activity for the dashboard"""
    return await system_manager.get_recent_activity(case_id)
