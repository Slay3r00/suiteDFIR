from fastapi import APIRouter, HTTPException
from typing import List, Optional
import sqlite3
from core.models import Task, TaskCreate, Note, NoteCreate
from core.database import DB_PATH

router = APIRouter(
    prefix="/api/dashboard",
    tags=["tasks", "notes"]
)

@router.get("/tasks", response_model=List[Task])
async def get_tasks(case_id: Optional[int] = None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if case_id:
        cursor.execute("SELECT * FROM tasks WHERE case_id = ? ORDER BY created_at DESC", (case_id,))
    else:
        cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tasks

@router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("INSERT INTO tasks (content, description, priority, case_id) VALUES (?, ?, ?, ?)", (task.content, task.description, task.priority, task.case_id))
    task_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    new_task = dict(cursor.fetchone())
    conn.close()
    return new_task

@router.put("/tasks/{task_id}", response_model=Task)
async def toggle_task(task_id: int):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get current status
    cursor.execute("SELECT completed FROM tasks WHERE id = ?", (task_id,))
    result = cursor.fetchone()
    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
        
    new_status = not result['completed']
    cursor.execute("UPDATE tasks SET completed = ? WHERE id = ?", (new_status, task_id))
    conn.commit()
    
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated_task = dict(cursor.fetchone())
    conn.close()
    return updated_task

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"message": "Task deleted"}

@router.get("/notes", response_model=List[Note])
async def get_notes(case_id: Optional[int] = None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if case_id:
        cursor.execute("SELECT * FROM notes WHERE case_id = ? ORDER BY created_at DESC", (case_id,))
    else:
        cursor.execute("SELECT * FROM notes ORDER BY created_at DESC")
    notes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return notes

@router.post("/notes", response_model=Note)
async def create_note(note: NoteCreate):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("INSERT INTO notes (content, description, case_id) VALUES (?, ?, ?)", (note.content, note.description, note.case_id))
    note_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    new_note = dict(cursor.fetchone())
    conn.close()
    return new_note

@router.delete("/notes/{note_id}")
async def delete_note(note_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return {"message": "Note deleted"}
