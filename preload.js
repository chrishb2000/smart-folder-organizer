const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolders: (payload) => ipcRenderer.invoke('scan-folders', payload),
  buildOrganizePlan: (payload) => ipcRenderer.invoke('build-organize-plan', payload),
  applyOrganizePlan: (payload) => ipcRenderer.invoke('apply-organize-plan', payload),
  deleteEmptyFolders: (payload) => ipcRenderer.invoke('delete-empty-folders', payload),
  deleteTempFiles: (payload) => ipcRenderer.invoke('delete-temp-files', payload),
  deleteDuplicates: (payload) => ipcRenderer.invoke('delete-duplicates', payload),
  getRules: () => ipcRenderer.invoke('get-rules'),
  saveRules: (rules) => ipcRenderer.invoke('save-rules', rules),
  getUndo: () => ipcRenderer.invoke('get-undo'),
  undoRecord: (id) => ipcRenderer.invoke('undo-record', id),
  getThumbnails: (paths) => ipcRenderer.invoke('get-thumbnails', paths),
  analyzeSimilarImages: (payload) => ipcRenderer.invoke('analyze-similar-images', payload),
  previewRename: (payload) => ipcRenderer.invoke('preview-rename', payload),
  applyRename: (payload) => ipcRenderer.invoke('apply-rename', payload),
  exportReport: (payload) => ipcRenderer.invoke('export-report', payload),
  getFileMetadata: (filePath) => ipcRenderer.invoke('get-file-metadata', filePath),
  openInExplorer: (filePath) => ipcRenderer.invoke('open-in-explorer', filePath),
  onScanProgress: (callback) => ipcRenderer.on('scan-progress', (_event, data) => callback(data))
});