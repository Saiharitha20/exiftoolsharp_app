const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  processImages: (folderPath) => ipcRenderer.send('process-images', folderPath),
  onProcessingUpdate: (callback) => ipcRenderer.on('processing-update', (event, message) => callback(message)),
  onProcessingComplete: (callback) => ipcRenderer.on('processing-complete', (event, data) => callback(data)),
  onProcessingError: (callback) => ipcRenderer.on('processing-error', (event, error) => callback(error)),
  onSelectedFolder: (callback) => ipcRenderer.on('selected-folder', (event, folderPath) => callback(folderPath)),
  sendProcessFiles: (data) => ipcRenderer.send('process-files', data),
});