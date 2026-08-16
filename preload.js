const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  buildOrganizePlan: (payload) => ipcRenderer.invoke('build-organize-plan', payload),
  applyOrganizePlan: (payload) => ipcRenderer.invoke('apply-organize-plan', payload),
  deleteEmptyFolders: (payload) => ipcRenderer.invoke('delete-empty-folders', payload),
  deleteTempFiles: (payload) => ipcRenderer.invoke('delete-temp-files', payload),
  deleteDuplicates: (payload) => ipcRenderer.invoke('delete-duplicates', payload),
  openInExplorer: (filePath) => ipcRenderer.invoke('open-in-explorer', filePath),
  onScanProgress: (callback) => ipcRenderer.on('scan-progress', (_event, data) => callback(data))
});