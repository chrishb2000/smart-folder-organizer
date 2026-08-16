const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  getCategory,
  scanFolderSync,
  buildCategories,
  findDuplicates
} = require('./lib/scanner');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    show: false,
    title: 'Smart Folder Organizer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecciona la carpeta a analizar'
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('scan-folder', async (event, folderPath) => {
  const start = Date.now();
  const sendProgress = (scanned, current) => {
    event.sender.send('scan-progress', { scanned, current });
  };

  const scan = scanFolderSync(folderPath, sendProgress);

  sendProgress(scan.totalFiles, 'Hashing duplicados...');

  const duplicateGroups = await findDuplicates(scan.files, (done, total) => {
    event.sender.send('scan-progress', { scanned: scan.totalFiles + done, current: `Comparando hashes ${done}/${total}` });
  });

  const categories = buildCategories(scan.files);
  const largeFiles = [...scan.files].sort((a, b) => b.size - a.size).slice(0, 30);

  let duplicateWasted = 0;
  for (const g of duplicateGroups) {
    duplicateWasted += g.size * (g.files.length - 1);
  }

  const topLevelFiles = scan.files.filter((f) => path.dirname(f.path) === folderPath);

  return {
    folder: folderPath,
    scanDuration: Date.now() - start,
    totalFiles: scan.totalFiles,
    totalFolders: scan.totalFolders,
    totalSize: scan.totalSize,
    categories,
    largeFiles,
    duplicateGroups,
    duplicateWasted,
    emptyFolders: scan.emptyFolders,
    tempFiles: scan.tempFiles,
    topLevelFiles
  };
});

ipcMain.handle('build-organize-plan', (event, { folderPath, includeCategories }) => {
  const plan = [];
  let entries = [];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (e) {
    return { success: false, error: 'No se pudo leer la carpeta.' };
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(folderPath, entry.name);
    const category = getCategory(full);
    if (!includeCategories.includes(category)) continue;
    const targetDir = path.join(folderPath, category);
    const target = path.join(targetDir, entry.name);
    plan.push({ source: full, target, category });
  }
  return { success: true, plan };
});

ipcMain.handle('apply-organize-plan', async (event, { folderPath, plan }) => {
  let moved = 0;
  let failed = 0;
  const log = [];
  for (const item of plan) {
    try {
      const targetDir = path.dirname(item.target);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      if (fs.existsSync(item.target)) {
        const base = path.basename(item.target, path.extname(item.target));
        const ext = path.extname(item.target);
        const dest = path.join(targetDir, `${base}_${Date.now()}${ext}`);
        fs.renameSync(item.source, dest);
        log.push(`Movido (conflicto): ${item.source} -> ${dest}`);
      } else {
        fs.renameSync(item.source, item.target);
        log.push(`Movido: ${item.source} -> ${item.target}`);
      }
      moved++;
    } catch (e) {
      failed++;
      log.push(`Error: ${item.source} (${e.message})`);
    }
  }
  return { success: true, moved, failed, log };
});

ipcMain.handle('delete-empty-folders', async (event, { folderPath }) => {
  let deleted = 0;
  const log = [];
  function clean(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) clean(full);
    }
    entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.length === 0 && dir !== folderPath) {
      try {
        fs.rmdirSync(dir);
        deleted++;
        log.push(`Carpeta vacia eliminada: ${dir}`);
      } catch (e) { /* ignore */ }
    }
  }
  clean(folderPath);
  return { success: true, deleted, log };
});

ipcMain.handle('delete-temp-files', async (event, { files }) => {
  let deleted = 0;
  const log = [];
  for (const f of files) {
    try {
      fs.unlinkSync(f);
      deleted++;
      log.push(`Temporal eliminado: ${f}`);
    } catch (e) {
      log.push(`Error: ${f} (${e.message})`);
    }
  }
  return { success: true, deleted, log };
});

ipcMain.handle('delete-duplicates', async (event, { files }) => {
  let deleted = 0;
  const log = [];
  for (const f of files) {
    try {
      fs.unlinkSync(f);
      deleted++;
      log.push(`Duplicado eliminado: ${f}`);
    } catch (e) {
      log.push(`Error: ${f} (${e.message})`);
    }
  }
  return { success: true, deleted, log };
});

ipcMain.handle('open-in-explorer', (event, filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});