import os
import re
from typing import Optional, List
from langchain_core.tools import tool
from pathlib import Path

# Define the sandbox path - using the reports directory
SANDBOX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "reports"))

@tool
def forensic_tree_view(path: str = ".") -> str:
    """
    Generates a recursive ASCII tree view of the directory structure.
    Useful for seeing the overall hierarchy of forensic reports.
    'path' is relative to the reports root.
    """
    # Build absolute path safely
    safe_path = Path(SANDBOX_PATH) / path.lstrip("/")
    if not safe_path.exists():
        return f"Error: Path {path} does not exist in sandbox."
    if not str(safe_path.resolve()).startswith(SANDBOX_PATH):
        return "Error: Access denied (outside of sandbox)."
    
    output = []
    
    def _build_tree(current_path: Path, prefix: str = "", depth: int = 0):
        if depth > 3:
            output.append(f"{prefix}...")
            return

        try:
            items = sorted(list(current_path.iterdir()))
        except PermissionError:
            output.append(f"{prefix}[Permission Denied]")
            return

        for i, item in enumerate(items):
            is_last = (i == len(items) - 1)
            connector = "└── " if is_last else "├── "
            output.append(f"{prefix}{connector}{item.name}")
            if item.is_dir():
                new_prefix = prefix + ("    " if is_last else "│   ")
                _build_tree(item, new_prefix, depth + 1)

    output.append(safe_path.name + "/")
    _build_tree(safe_path)
    return "\n".join(output)

@tool
def forensic_grep(pattern: str, file_path: str, context_lines: int = 2) -> str:
    """
    Searches for a regex pattern in a file and returns matching lines with context.
    'file_path' is relative to the reports root.
    """
    try:
        abs_path = (Path(SANDBOX_PATH) / file_path.lstrip("/")).resolve()
        if not str(abs_path).startswith(SANDBOX_PATH):
            return "Error: Access denied (outside of sandbox)."
        if not abs_path.is_file():
            return f"Error: {file_path} is not a valid file."
            
        matches = []
        with open(abs_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            
        regex = re.compile(pattern, re.IGNORECASE)
        
        for i, line in enumerate(lines):
            if regex.search(line):
                start = max(0, i - context_lines)
                end = min(len(lines), i + context_lines + 1)
                context = []
                for j in range(start, end):
                    prefix = ">> " if j == i else "   "
                    context.append(f"{j+1}{prefix}{lines[j].strip()}")
                matches.append("\n".join(context))
                if len(matches) >= 10:
                    matches.append("... (showing first 10 matches)")
                    break
        
        return "\n\n---\n\n".join(matches) if matches else "No matches found."
    except Exception as e:
        return f"Error during grep: {str(e)}"
