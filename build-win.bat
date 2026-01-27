@echo off
setlocal EnableDelayedExpansion

echo ==========================================
echo   VDF Tools Production Build (Windows)
echo ==========================================

REM --- Configuration ---
set "BACKEND_DIR=%~dp0backend"
set "FRONTEND_DIR=%~dp0frontend"
set "ELECTRON_DIR=%~dp0electron"
set "BUILD_DIR=%ELECTRON_DIR%\out"

REM Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python.
    exit /b 1
)

REM --- Step 1: Build Python Backend ---
echo.
echo [1/5] Building Python Backend...
cd "%BACKEND_DIR%"

if not exist venv (
    echo   Creating virtual environment...
    python -m venv venv
)

echo   Activating venv...
call venv\Scripts\activate

echo   Installing requirements...
pip install -r requirements.txt
pip install pyinstaller

echo   Running PyInstaller...
if exist build rd /s /q build
if exist dist rd /s /q dist
pyinstaller build.spec

echo   Checking if backend executable exists...
if not exist "dist\VDF Tools Backend\vdf-backend.exe" (
    echo [ERROR] Backend build likely failed. Executable not found at "dist\VDF Tools Backend\vdf-backend.exe".
    exit /b 1
)
echo   Backend built successfully.

REM --- Step 2: Build Frontend ---
echo.
echo [2/5] Building Frontend (Static Export)...
cd "%FRONTEND_DIR%"
call npm install
call npm run build:static

if not exist out (
    echo [ERROR] Frontend build failed. 'out' directory not found.
    exit /b 1
)
echo   Frontend built successfully.

REM --- Step 3: Package Electron App ---
echo.
echo [3/5] Packaging Electron App...
cd "%ELECTRON_DIR%"
if exist out rd /s /q out
call npm install
call npx electron-forge package

REM Find the output directory (handling version/arch variations)
for /d %%D in ("out\vdf-tools-win32-*") do set "APP_ROOT=%ELECTRON_DIR%\%%D"

if not defined APP_ROOT (
    echo [ERROR] Electron package failed. Output directory not found.
    exit /b 1
)
echo   Electron packaged to: %APP_ROOT%

REM --- Step 4: Copy Resources ---
echo.
echo [4/5] Copying Resources...

set "RESOURCES_PATH=%APP_ROOT%\resources"

echo   Copying Backend...
if not exist "%RESOURCES_PATH%\VDF Tools Backend" mkdir "%RESOURCES_PATH%\VDF Tools Backend"
xcopy /E /I /Y /Q "%BACKEND_DIR%\dist\VDF Tools Backend" "%RESOURCES_PATH%\VDF Tools Backend"

echo   Copying Frontend...
if not exist "%RESOURCES_PATH%\out" mkdir "%RESOURCES_PATH%\out"
xcopy /E /I /Y /Q "%FRONTEND_DIR%\out" "%RESOURCES_PATH%\out"

echo   Copying Binaries...
if not exist "%RESOURCES_PATH%\bin" mkdir "%RESOURCES_PATH%\bin"
if exist "%BACKEND_DIR%\bin\windows" (
    xcopy /E /I /Y /Q "%BACKEND_DIR%\bin\windows" "%RESOURCES_PATH%\bin"
) else (
    echo   [WARNING] No Windows binaries found in backend\bin\windows. Please check your source.
)

echo   Creating reports directory...
if not exist "%RESOURCES_PATH%\reports" mkdir "%RESOURCES_PATH%\reports"

REM --- Step 5: Create Installer (Squirrel) ---
echo.
echo [5/5] Creating Installer...
cd "%ELECTRON_DIR%"
REM Explicitly set platform/arch to avoid "paths[0] undefined" resolution errors
call npx electron-forge make --skip-package --platform win32 --arch x64

echo.
echo ==========================================
echo   Build Complete!
echo ==========================================
echo.
echo Output artifacts should be in: electron\out\make
pause
