from fastapi import APIRouter
from typing import List, Optional
from core.models import Task, TaskCreate, Note, NoteCreate
from services.task_note_manager import task_note_manager

router = APIRouter(
    prefix="/api/dashboard",
    tags=["tasks", "notes"]
)

@router.get("/tasks", response_model=List[Task])
async def get_tasks(case_id: Optional[int] = None):
    return await task_note_manager.get_tasks(case_id)

@router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    return await task_note_manager.create_task(task)

@router.put("/tasks/{task_id}", response_model=Task)
async def toggle_task(task_id: int):
    return await task_note_manager.toggle_task_status(task_id)

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int):
    return await task_note_manager.delete_task(task_id)

@router.get("/notes", response_model=List[Note])
async def get_notes(case_id: Optional[int] = None):
    return await task_note_manager.get_notes(case_id)

@router.post("/notes", response_model=Note)
async def create_note(note: NoteCreate):
    return await task_note_manager.create_note(note)

@router.delete("/notes/{note_id}")
async def delete_note(note_id: int):
    return await task_note_manager.delete_note(note_id)
