"""
PyInstaller spec file for VDF Tools Python Backend
Bundles the FastAPI backend and all dependencies into a single executable
"""

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Backend directory
backend_dir = os.path.dirname(os.path.abspath(SPEC))

# Collect all data from forensic-tools
datas = [
    (os.path.join(backend_dir, 'forensic-tools'), 'forensic-tools'),
    (os.path.join(backend_dir, 'reports'), 'reports'),
    (os.path.join(backend_dir, 'vdf_tools.db'), '.'),
]

# Collect hidden imports
hiddenimports = [
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'fastapi',
    'fastapi.dependencies',
    'fastapi.security',
    'fastapi.middleware',
    'fastapi.middleware.cors',
    'fastapi.middleware.gzip',
    'fastapi.responses',
    'pydantic',
    'pydantic.dataclasses',
    'starlette',
    'starlette.responses',
    'starlette.middleware',
    'starlette.middleware.cors',
    'langchain',
    'langchain.schema',
    'langchain_core',
    'langchain_openai',
    'langgraph',
    'langgraph.prebuilt',
    'aiofiles',
    'websockets',
    'sqlite3',
    'sqlalchemy',
    'pillow',
    'PIL',
    'bs4',
    'beautifulsoup4',
    'lxml',
    'xmltodict',
    'openpyxl',  # If you use Excel files
]

# Collect all submodules for key packages
binaries = []
zipfiles = []

# Analysis configuration
a = Analysis(
    [os.path.join(backend_dir, 'main.py')],
    pathex=[backend_dir],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas'],  # Exclude heavy unused libs
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='vdf-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Set to True to see backend console for debugging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # You can add an icon file later
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='VDF Tools Backend',
)
