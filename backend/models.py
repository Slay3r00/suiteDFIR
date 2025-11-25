from pydantic import BaseModel
from typing import List, Optional

class Profile(BaseModel):
    id: int
    name: str
    tool: str
    modules: List[str]

class ProfileCreate(BaseModel):
    name: str
    modules: List[str]
    tool: str

class Case(BaseModel):
    id: int
    name: str
    case_number: Optional[str] = None
    business_name: Optional[str] = None
    investigator_name: Optional[str] = None
    client_name: Optional[str] = None
    client_location: Optional[str] = None
    client_contact: Optional[str] = None
    description: Optional[str] = None
    status: str = "Active"
    priority: str = "Medium"
    created_at: str

class CaseCreate(BaseModel):
    name: str
    case_number: Optional[str] = None
    business_name: Optional[str] = None
    investigator_name: Optional[str] = None
    client_name: Optional[str] = None
    client_location: Optional[str] = None
    client_contact: Optional[str] = None
    description: Optional[str] = None
    status: str = "Active"
    priority: str = "Medium"

class CaseUpdate(BaseModel):
    name: Optional[str] = None
    case_number: Optional[str] = None
    business_name: Optional[str] = None
    investigator_name: Optional[str] = None
    client_name: Optional[str] = None
    client_location: Optional[str] = None
    client_contact: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None

class ProcessRequest(BaseModel):
    tool: str
    input_path: str
    output_folder: Optional[str] = None
    selected_modules: List[str]
    timezone_offset: str = "UTC"
    report_name: Optional[str] = None
    case_name: str
    password: Optional[str] = None
    case_id: Optional[int] = None

class ValidateBackupRequest(BaseModel):
    input_path: str

class FilePathResponse(BaseModel):
    file_path: str
    success: bool
    message: str

class Report(BaseModel):
    name: str
    path: str
    url: str
    tool: str
    created_at: str
    size: str
    artifact_count: int

class Task(BaseModel):
    id: int
    content: str
    description: Optional[str] = None
    priority: str
    completed: bool
    created_at: str
    case_id: Optional[int] = None

class TaskCreate(BaseModel):
    content: str
    description: Optional[str] = None
    priority: str = "medium"
    case_id: Optional[int] = None

class Note(BaseModel):
    id: int
    content: str
    description: Optional[str] = None
    created_at: str
    case_id: Optional[int] = None

class NoteCreate(BaseModel):
    content: str
    description: Optional[str] = None
    case_id: Optional[int] = None

class BackupRequest(BaseModel):
    udid: str
    name: str
    password: Optional[str] = None
    case_id: Optional[int] = None
