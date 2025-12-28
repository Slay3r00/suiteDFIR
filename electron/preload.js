const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform: () => process.platform,

  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Backend health check controls
  retryBackendCheck: () => ipcRenderer.invoke('retry-backend-check'),
  quitApp: () => ipcRenderer.invoke('quit-app')
});
