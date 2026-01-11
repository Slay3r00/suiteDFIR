import logging
from typing import List, Optional, Dict, Any
from fastapi import HTTPException

from core.models import Task, TaskCreate, Note, NoteCreate
from core.database import db_fetch_all, db_fetch_one, db_execute, db_execute_return_id

logger = logging.getLogger(__name__)

class TaskNoteManager:
    """Manages tasks and notes operations."""

    async def get_tasks(self, case_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve all tasks, optionally filtered by case_id."""
        if case_id:
            return await db_fetch_all(
                "SELECT * FROM tasks WHERE case_id = ? ORDER BY created_at DESC", 
                (case_id,)
            )
        else:
            return await db_fetch_all("SELECT * FROM tasks ORDER BY created_at DESC")

    async def create_task(self, task: TaskCreate) -> Dict[str, Any]:
        """Create a new task."""
        task_id = await db_execute_return_id(
            "INSERT INTO tasks (content, description, priority, case_id) VALUES (?, ?, ?, ?)",
            (task.content, task.description, task.priority, task.case_id)
        )
        return await self.get_task_by_id(task_id)

    async def get_task_by_id(self, task_id: int) -> Dict[str, Any]:
        """Retrieve a single task by ID."""
        task = await db_fetch_one("SELECT * FROM tasks WHERE id = ?", (task_id,))
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task

    async def toggle_task_status(self, task_id: int) -> Dict[str, Any]:
        """Toggle the completion status of a task."""
        # Get current status
        current_task = await self.get_task_by_id(task_id)
        new_status = not current_task['completed']
        
        await db_execute(
            "UPDATE tasks SET completed = ? WHERE id = ?", 
            (new_status, task_id)
        )
        
        return await self.get_task_by_id(task_id)

    async def delete_task(self, task_id: int) -> Dict[str, str]:
        """Delete a task by ID."""
        await db_execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return {"message": "Task deleted"}

    async def get_notes(self, case_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve all notes, optionally filtered by case_id."""
        if case_id:
            return await db_fetch_all(
                "SELECT * FROM notes WHERE case_id = ? ORDER BY created_at DESC", 
                (case_id,)
            )
        else:
            return await db_fetch_all("SELECT * FROM notes ORDER BY created_at DESC")

    async def create_note(self, note: NoteCreate) -> Dict[str, Any]:
        """Create a new note."""
        note_id = await db_execute_return_id(
            "INSERT INTO notes (content, description, case_id) VALUES (?, ?, ?)",
            (note.content, note.description, note.case_id)
        )
        return await self._get_note_by_id(note_id)

    async def _get_note_by_id(self, note_id: int) -> Dict[str, Any]:
        """Internal helper to retrieve a single note by ID."""
        note = await db_fetch_one("SELECT * FROM notes WHERE id = ?", (note_id,))
        if not note:
            # Should technically not happen immediately after creation if successful
            raise HTTPException(status_code=404, detail="Note not found") 
        return note

    async def delete_note(self, note_id: int) -> Dict[str, str]:
        """Delete a note by ID."""
        await db_execute("DELETE FROM notes WHERE id = ?", (note_id,))
        return {"message": "Note deleted"}

# Global instance
task_note_manager = TaskNoteManager()
