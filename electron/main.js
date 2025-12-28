const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const isDev = require('electron-is-dev');

let mainWindow;
let pythonProcess;

// Backend configuration
const BACKEND_PORT = 8000;

// In production, use bundled Python executable
// In development, use venv Python
const PYTHON_PATH = process.platform === 'win32'
  ? isDev
    ? path.join(__dirname, '../backend/venv/Scripts/python.exe')
    : path.join(process.resourcesPath, 'VDF Tools Backend', 'vdf-backend.exe')
  : isDev
    ? path.join(__dirname, '../backend/venv/bin/python')
    : path.join(process.resourcesPath, 'VDF Tools Backend', 'vdf-backend');

const BACKEND_FILE = path.join(__dirname, '../backend/main.py');

// In production, load static HTML files from Resources directory
// In development, load from dev server
const FRONTEND_URL = isDev
  ? 'http://localhost:3000'
  : `file://${path.join(process.resourcesPath, 'out', 'index.html')}`;

// Health check configuration
const HEALTH_CHECK_URL = 'http://127.0.0.1:8000/health';
const MAX_HEALTH_CHECK_RETRIES = 30;
const HEALTH_CHECK_INTERVAL = 1000; // 1 second

let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    center: true,
    frame: false,
    resizable: false,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  const splashPath = path.join(__dirname, 'splash.html');
  splashWindow.loadFile(splashPath);

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function updateSplashStatus(message, attempt = 0, maxAttempts = 0) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('update-status', message);
    if (attempt > 0) {
      splashWindow.webContents.send('update-retry-info', attempt, maxAttempts);
    }
  }
}

async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(HEALTH_CHECK_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data.status === 'healthy';
    }

    console.log(`Health check failed: HTTP ${response.status}`);
    return false;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Health check timeout');
    } else {
      console.log('Health check error:', error.message);
    }
    return false;
  }
}

async function waitForBackend() {
  console.log('Checking backend health...');

  for (let attempt = 1; attempt <= MAX_HEALTH_CHECK_RETRIES; attempt++) {
    const isHealthy = await checkBackendHealth();

    if (isHealthy) {
      console.log('Backend is healthy!');
      updateSplashStatus('Ready');
      return true;
    }

    // Update splash screen with progress
    const statusMsg = attempt === 1
      ? 'Initializing...'
      : 'Initializing...';
    updateSplashStatus(statusMsg, attempt, MAX_HEALTH_CHECK_RETRIES);

    console.log(`Health check attempt ${attempt}/${MAX_HEALTH_CHECK_RETRIES} failed, retrying...`);

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }

  console.log('Backend health check failed after all retries');
  return false;
}

async function showBackendErrorDialog() {
  const { dialog } = require('electron');

  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Backend Not Responding',
    message: 'The backend service is taking longer than expected to start.',
    detail: 'This can happen on slower systems or if there are configuration issues. The application will continue trying to connect.',
    buttons: ['Keep Waiting', 'Quit'],
    defaultId: 0,
    cancelId: 1
  });

  return result.response === 0; // true if user chose "Keep Waiting"
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    title: 'VDF Tools',
    show: false
  });

  mainWindow.loadURL(FRONTEND_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development only
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startPythonBackend() {
  console.log('Starting Python backend...');
  console.log('Python path:', PYTHON_PATH);
  console.log('Is dev:', isDev);

  // Show splash screen immediately
  createSplashWindow();
  updateSplashStatus('Starting application...');

  let args, cmd;

  if (isDev) {
    // Development: Run uvicorn with Python interpreter
    cmd = PYTHON_PATH;
    args = ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', BACKEND_PORT.toString()];
  } else {
    // Production: Run bundled executable directly
    cmd = PYTHON_PATH;
    args = [];  // Executable has everything bundled
  }

  pythonProcess = spawn(cmd, args, {
    cwd: isDev ? path.join(__dirname, '../backend') : undefined,
    shell: true
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Backend]: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error]: ${data}`);
  });

  pythonProcess.on('error', (error) => {
    console.error(`Failed to start backend: ${error.message}`);
    updateSplashStatus('Failed to start application');
  });

  pythonProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });

  // Wait for backend to be healthy using health check
  const isHealthy = await waitForBackend();

  if (isHealthy) {
    // Backend is ready - close splash and create main window
    console.log('Backend is ready, starting frontend...');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    createWindow();
  } else {
    // Health check failed - show error dialog
    updateSplashStatus('Taking longer than expected...');
    const shouldKeepWaiting = await showBackendErrorDialog();

    if (shouldKeepWaiting) {
      // User chose to keep waiting - continue retrying in background
      updateSplashStatus('Continuing to initialize...');
      continueWaitingForBackend();
    } else {
      // User chose to quit
      console.log('User chose to quit');
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      app.quit();
    }
  }
}

async function continueWaitingForBackend() {
  // Continuously check backend health in background
  while (true) {
    await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));

    const isHealthy = await checkBackendHealth();
    if (isHealthy) {
      console.log('Backend is now ready!');
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      createWindow();
      break;
    }

    console.log('Still waiting for backend...');
  }
}

async function stopPythonBackend() {
  if (pythonProcess) {
    console.log('Stopping Python backend...');

    try {
      // Try graceful shutdown via API first
      await fetch('http://localhost:8000/shutdown', { method: 'POST' });

      // Wait a moment for shutdown to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force kill if still running
      if (pythonProcess) {
        pythonProcess.kill('SIGTERM');
      }
    } catch (error) {
      // If API call fails, force kill immediately
      console.log('Graceful shutdown failed, forcing kill...');
      pythonProcess.kill('SIGTERM');
    }

    pythonProcess = null;
  }
}

// App lifecycle
app.whenReady().then(() => {
  startPythonBackend();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await stopPythonBackend();
    app.quit();
  }
});

app.on('before-quit', async (e) => {
  if (pythonProcess) {
    e.preventDefault();
    await stopPythonBackend();
    app.quit();
  }
});

// Handle cleanup on all platforms
process.on('SIGINT', async () => {
  await stopPythonBackend();
  app.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopPythonBackend();
  app.quit();
  process.exit(0);
});

// IPC handlers for renderer process
ipcMain.handle('retry-backend-check', async () => {
  // Trigger another round of health checks
  updateSplashStatus('Retrying...');
  await continueWaitingForBackend();
});

ipcMain.handle('quit-app', async () => {
  // Gracefully quit the application
  await stopPythonBackend();
  app.quit();
});

