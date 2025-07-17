const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration methods
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  testConnection: (config) => ipcRenderer.invoke('test-connection', config),
  
  // Server control methods
  startServer: (config) => ipcRenderer.invoke('start-server', config),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  getProjectPath: () => ipcRenderer.invoke('get-project-path'),
  
  // Event listeners
  onServerStatus: (callback) => ipcRenderer.on('server-status', callback),
  removeServerStatusListener: (callback) => ipcRenderer.removeListener('server-status', callback)
});