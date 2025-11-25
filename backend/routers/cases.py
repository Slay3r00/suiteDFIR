from fastapi import APIRouter, HTTPException
from typing import List
import sqlite3
from models import Case, CaseCreate, CaseUpdate
from database import DB_PATH
import os
import shutil

router = APIRouter(
    prefix="/api/cases",
    tags=["cases"]
)

@router.get("", response_model=List[Case])
async def get_cases():
    """Get list of all cases"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, case_number, business_name, investigator_name, 
                   client_name, client_location, client_contact, description, 
                   status, priority, created_at 
            FROM cases 
            ORDER BY created_at DESC
        ''')
        cases = []
        for row in cursor.fetchall():
            cases.append(Case(
                id=row[0],
                name=row[1],
                case_number=row[2],
                business_name=row[3],
                investigator_name=row[4],
                client_name=row[5],
                client_location=row[6],
                client_contact=row[7],
                description=row[8],
                status=row[9],
                priority=row[10],
                created_at=row[11]
            ))
        conn.close()
        return cases
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cases: {str(e)}")

@router.post("", response_model=Case)
async def create_case(case: CaseCreate):
    """Create a new case"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO cases (
                name, case_number, business_name, investigator_name, 
                client_name, client_location, client_contact, description, 
                status, priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            case.name, case.case_number, case.business_name, case.investigator_name,
            case.client_name, case.client_location, case.client_contact, case.description,
            case.status, case.priority
        ))
        case_id = cursor.lastrowid
        
        # Fetch created case
        cursor.execute('SELECT created_at FROM cases WHERE id = ?', (case_id,))
        created_at = cursor.fetchone()[0]
        conn.commit()
        conn.close()

        return Case(
            id=case_id,
            created_at=created_at,
            **case.dict()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create case: {str(e)}")

@router.get("/{case_id}", response_model=Case)
async def get_case(case_id: int):
    """Get a specific case by ID"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, case_number, business_name, investigator_name, 
                   client_name, client_location, client_contact, description, 
                   status, priority, created_at 
            FROM cases 
            WHERE id = ?
        ''', (case_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Case not found")
            
        return Case(
            id=row[0],
            name=row[1],
            case_number=row[2],
            business_name=row[3],
            investigator_name=row[4],
            client_name=row[5],
            client_location=row[6],
            client_contact=row[7],
            description=row[8],
            status=row[9],
            priority=row[10],
            created_at=row[11]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch case: {str(e)}")

@router.put("/{case_id}", response_model=Case)
async def update_case(case_id: int, case_update: CaseUpdate):
    """Update an existing case"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Build update query dynamically
        update_data = case_update.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
            
        set_clause = ", ".join([f"{key} = ?" for key in update_data.keys()])
        values = list(update_data.values())
        values.append(case_id)
        
        cursor.execute(f'UPDATE cases SET {set_clause} WHERE id = ?', values)
        
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Case not found")
            
        conn.commit()
        
        # Fetch updated case
        cursor.execute('''
            SELECT id, name, case_number, business_name, investigator_name, 
                   client_name, client_location, client_contact, description, 
                   status, priority, created_at 
            FROM cases 
            WHERE id = ?
        ''', (case_id,))
        row = cursor.fetchone()
        conn.close()
        
        return Case(
            id=row[0],
            name=row[1],
            case_number=row[2],
            business_name=row[3],
            investigator_name=row[4],
            client_name=row[5],
            client_location=row[6],
            client_contact=row[7],
            description=row[8],
            status=row[9],
            priority=row[10],
            created_at=row[11]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update case: {str(e)}")

@router.delete("/{case_id}")
async def delete_case(case_id: int):
    """Delete a case and all associated data"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if case exists
        cursor.execute('SELECT id FROM cases WHERE id = ?', (case_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Case not found")

        # 1. Fetch associated files to delete
        # Backups
        cursor.execute('SELECT path FROM backups WHERE case_id = ?', (case_id,))
        backup_paths = [row[0] for row in cursor.fetchall()]

        # Reports
        cursor.execute('SELECT path FROM reports WHERE case_id = ?', (case_id,))
        report_paths = [row[0] for row in cursor.fetchall()]

        # 2. Delete from Database
        cursor.execute('DELETE FROM backups WHERE case_id = ?', (case_id,))
        cursor.execute('DELETE FROM reports WHERE case_id = ?', (case_id,))
        cursor.execute('DELETE FROM tasks WHERE case_id = ?', (case_id,))
        cursor.execute('DELETE FROM notes WHERE case_id = ?', (case_id,))
        cursor.execute('DELETE FROM cases WHERE id = ?', (case_id,))
        
        conn.commit()
        conn.close()

        # 3. Delete from Filesystem
        # We do this after DB commit so UI is updated even if file deletion fails
        errors = []
        
        for path in backup_paths:
            if os.path.exists(path):
                try:
                    if os.path.isdir(path):
                        shutil.rmtree(path)
                    else:
                        os.remove(path)
                except Exception as e:
                    print(f"Error deleting backup {path}: {e}")
                    errors.append(f"Failed to delete backup {os.path.basename(path)}")

        # Track parent directories to check for cleanup
        parent_dirs = set()

        for path in report_paths:
            if os.path.exists(path):
                try:
                    # Add parent dir to set before deleting
                    parent_dirs.add(os.path.dirname(path))
                    
                    if os.path.isdir(path):
                        shutil.rmtree(path)
                    else:
                        os.remove(path)
                except Exception as e:
                    print(f"Error deleting report {path}: {e}")
                    errors.append(f"Failed to delete report {os.path.basename(path)}")
        
        # Cleanup empty parent directories (e.g. Case Name folders)
        # Import REPORTS_DIR to check against
        from config import REPORTS_DIR
        
        for parent_dir in parent_dirs:
            if os.path.exists(parent_dir) and os.path.isdir(parent_dir):
                try:
                    # Safety check: Don't delete REPORTS_DIR or its immediate children (tool dirs)
                    # Calculate path relative to REPORTS_DIR
                    try:
                        rel = os.path.relpath(parent_dir, REPORTS_DIR)
                        # If relative path is '.' (root) or has no directory separators (immediate child like 'ileapp-reports'), skip
                        if rel == '.' or os.path.dirname(rel) == '':
                            # print(f"Skipping cleanup of root/tool directory: {parent_dir}")
                            continue
                    except ValueError:
                        # Path is not under REPORTS_DIR, skip to be safe
                        continue

                    # Only delete if empty
                    if not os.listdir(parent_dir):
                        os.rmdir(parent_dir)
                        print(f"Removed empty directory: {parent_dir}")
                except Exception as e:
                    print(f"Error cleaning up directory {parent_dir}: {e}")

        if errors:
            print(f"Case deleted with filesystem errors: {errors}")

        return {"message": "Case and associated data deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete case: {str(e)}")
