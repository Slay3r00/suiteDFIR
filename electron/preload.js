const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC listeners for splash screen
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, msg) => callback(msg)),
  onUpdateRetryInfo: (callback) => ipcRenderer.on('update-retry-info', (event, attempt, max) => callback(attempt, max)),
  // Backend URL for dynamic port allocation
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url')
});
