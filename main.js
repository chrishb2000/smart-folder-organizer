const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { scanFolderSync, buildCategories, findDuplicates } = require('./lib/scanner');
const { buildOrganizePlan } = require('./lib/planner');
const { findSimilarGroups } = require('./lib/imghash');
const { buildRenamePlan, applyRenamePlan } = require('./lib/renamer');
const { buildReport, buildActionCsv, buildHtmlReport, saveReport } = require('./lib/reporter');
const { computeDashboard } = require('./lib/stats');
const { extractMetadata } = require('./lib/exif');

let mainWindow;
let userDataDir;
let quarantineDir;
let dataFile;
let store = { rules: [], undo: [], hashCache: {} };

/* ---------- Persistencia ---------- */
function ensureDirs() {
  userDataDir = app.getPath('userData');
  quarantineDir = path.join(userDataDir, 'quarantine');
  dataFile = path.join(userDataDir, 'sfo-data.json');
  fs.mkdirSync(quarantineDir, { recursive: true });
}

function loadStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    store = {
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      undo: Array.isArray(parsed.undo) ? parsed.undo : [],
      hashCache: parsed.hashCache && typeof parsed.hashCache === 'object' ? parsed.hashCache : {}
    };
  } catch (e) {
    store = { rules: [], undo: [], hashCache: {} };
  }
}

function saveStore() {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
  } catch (e) { /* ignore */ }
}

function newUndoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addUndoRecord(rec) {
  rec.id = newUndoId();
  rec.date = Date.now();
  store.undo.unshift(rec);
  if (store.undo.length > 50) store.undo = store.undo.slice(0, 50);
  saveStore();
  return rec.id;
}

/* ---------- Utilidades de archivos ---------- */
function quarantineFile(originalPath) {
  const base = path.basename(originalPath);
  const dest = path.join(quarantineDir, `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${base}`);
  fs.copyFileSync(originalPath, dest);
  return dest;
}

function createZipBackup(rootFolder, files, label) {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(rootFolder) || files.length === 0) return resolve(null);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
      const zipPath = path.join(rootFolder, `Respaldo_SFO_${label}_${stamp}.zip`);
      const fileList = files.map((f) => `'${f.replace(/'/g, "''")}'`).join(',');
      const cmd = `Compress-Archive -Path @(${fileList}) -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`;
      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true });
      let done = false;
      const finish = (zip) => { if (!done) { done = true; resolve(zip); } };
      ps.on('error', () => finish(null));
      ps.on('close', (code) => finish(code === 0 ? zipPath : null));
      setTimeout(() => finish(null), 30000);
    } catch (e) {
      resolve(null);
    }
  });
}

/* ---------- Ventana ---------- */
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
  const loadOptions = process.env.SFO_E2E ? { query: { e2e: '1' } } : undefined;
  mainWindow.loadFile(path.join(__dirname, 'index.html'), loadOptions);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  ensureDirs();
  loadStore();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- IPC: seleccion ---------- */
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecciona la carpeta a analizar'
  });
  if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
  return null;
});

/* ---------- IPC: escaneo multi-carpeta ---------- */
ipcMain.handle('scan-folders', async (event, { folders, customRules }) => {
  const result = {
    folders,
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
    scanDuration: 0,
    files: [],
    emptyFolders: [],
    tempFiles: [],
    wrongExtensions: [],
    brokenFiles: [],
    topLevelFiles: [],
    categories: [],
    largeFiles: [],
    duplicateGroups: [],
    duplicateWasted: 0,
    dashboard: null
  };
  const startAll = Date.now();
  const cache = store.hashCache || {};

  for (const folder of folders) {
    const scan = scanFolderSync(folder, customRules, (scanned, current) => {
      event.sender.send('scan-progress', { scanned, folder, current });
    }, { checkIntegrity: true });
    result.totalFiles += scan.totalFiles;
    result.totalFolders += scan.totalFolders;
    result.totalSize += scan.totalSize;
    result.files.push(...scan.files);
    result.emptyFolders.push(...scan.emptyFolders);
    result.tempFiles.push(...scan.tempFiles);
    result.wrongExtensions.push(...scan.wrongExtensions);
    result.brokenFiles.push(...scan.brokenFiles);
    result.topLevelFiles.push(...scan.files.filter((f) => path.dirname(f.path) === folder));
  }

  event.sender.send('scan-progress', { scanned: result.totalFiles, current: 'Comparando hashes para detectar duplicados...' });
  const dupResult = await findDuplicates(result.files, null, cache);
  store.hashCache = dupResult.cache;
  if (Object.keys(store.hashCache).length > 250000) {
    const keys = Object.keys(store.hashCache);
    for (const k of keys.slice(0, keys.length - 250000)) delete store.hashCache[k];
  }
  saveStore();
  result.duplicateGroups = dupResult.groups;
  result.duplicateWasted = dupResult.groups.reduce((s, g) => s + g.size * (g.files.length - 1), 0);
  result.categories = buildCategories(result.files);
  result.largeFiles = [...result.files].sort((a, b) => b.size - a.size).slice(0, 30);
  result.scanDuration = Date.now() - startAll;
  result.dashboard = computeDashboard(result);

  return result;
});

/* ---------- IPC: plan de organizacion ---------- */
ipcMain.handle('build-organize-plan', (event, payload) => {
  const { folders, includeCategories, organizeByDate, autoRename, customRules } = payload;
  const plan = [];
  for (const folder of folders) {
    const r = buildOrganizePlan(folder, includeCategories, { organizeByDate, autoRename, customRules });
    if (!r.success) return r;
    plan.push(...r.plan);
  }
  return { success: true, plan };
});

ipcMain.handle('apply-organize-plan', (event, { plan }) => {
  const entries = [];
  let moved = 0;
  let failed = 0;
  const log = [];
  for (const item of plan) {
    try {
      const targetDir = path.dirname(item.target);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      let dest = item.target;
      if (fs.existsSync(dest)) {
        const ext = path.extname(item.target);
        const base = path.basename(item.target, ext);
        dest = path.join(targetDir, `${base}_${Date.now()}${ext}`);
      }
      fs.renameSync(item.source, dest);
      entries.push({ from: item.source, to: dest });
      moved++;
      log.push(`Movido: ${item.source} -> ${dest}`);
    } catch (e) {
      failed++;
      log.push(`Error: ${item.source} (${e.message})`);
    }
  }
  if (moved > 0) {
    const rootFolders = [...new Set(plan.map((p) => path.dirname(p.source)))];
    addUndoRecord({ type: 'move', label: `Mover ${moved} archivos`, entries, folders: rootFolders });
  }
  return { success: true, moved, failed, log };
});

/* ---------- IPC: carpetas vacias ---------- */
ipcMain.handle('delete-empty-folders', (event, { folderPath }) => {
  let deleted = 0;
  const log = [];
  const dirs = [];
  function clean(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const en of entries) {
      if (en.isDirectory()) clean(path.join(dir, en.name));
    }
    entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.length === 0 && dir !== folderPath) {
      try {
        fs.rmdirSync(dir);
        dirs.push(dir);
        deleted++;
        log.push(`Carpeta vacia eliminada: ${dir}`);
      } catch (e) { /* ignore */ }
    }
  }
  clean(folderPath);
  if (deleted > 0) addUndoRecord({ type: 'rmdir', label: `Eliminar ${deleted} carpetas vacias`, dirs });
  return { success: true, deleted, log };
});

/* ---------- IPC: borrado seguro (cuarentena + zip) ---------- */
async function secureDeleteFiles(files, rootFolder, label, backupZip) {
  let deleted = 0;
  const log = [];
  const entries = [];
  let zipPath = null;
  if (backupZip) zipPath = await createZipBackup(rootFolder, files, label);
  if (zipPath) log.push(`Respaldo .zip creado: ${zipPath}`);
  for (const f of files) {
    try {
      const backup = quarantineFile(f);
      fs.unlinkSync(f);
      entries.push({ original: f, backup });
      deleted++;
      log.push(`${label} movido a cuarentena: ${f}`);
    } catch (e) {
      log.push(`Error: ${f} (${e.message})`);
    }
  }
  if (deleted > 0) addUndoRecord({ type: 'trash', label: `${label} (${deleted})`, entries });
  return { success: true, deleted, log, zipPath };
}

ipcMain.handle('delete-temp-files', async (event, { files, rootFolder, backupZip }) => {
  return secureDeleteFiles(files, rootFolder, 'Temporal', backupZip);
});

ipcMain.handle('delete-duplicates', async (event, { files, rootFolder, backupZip }) => {
  return secureDeleteFiles(files, rootFolder, 'Duplicado', backupZip);
});

/* ---------- IPC: reglas personalizadas ---------- */
ipcMain.handle('get-rules', () => store.rules);

ipcMain.handle('save-rules', (event, rules) => {
  store.rules = Array.isArray(rules) ? rules : [];
  saveStore();
  return store.rules;
});

/* ---------- IPC: deshacer ---------- */
ipcMain.handle('get-undo', () => store.undo);

ipcMain.handle('undo-record', (event, id) => {
  const idx = store.undo.findIndex((r) => r.id === id);
  if (idx === -1) return { success: false, error: 'Registro no encontrado.' };
  const rec = store.undo[idx];
  const log = [];
  try {
    if (rec.type === 'move') {
      for (const e of rec.entries) {
        if (fs.existsSync(e.to)) {
          const dir = path.dirname(e.from);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.renameSync(e.to, e.from);
          log.push(`Restaurado: ${e.from}`);
        } else {
          log.push(`No se encontro el archivo: ${e.to}`);
        }
      }
    } else if (rec.type === 'rename') {
      for (const e of rec.entries) {
        if (fs.existsSync(e.to)) {
          fs.renameSync(e.to, e.from);
          log.push(`Renombrado restaurado: ${path.basename(e.from)}`);
        } else {
          log.push(`No se encontro: ${e.to}`);
        }
      }
    } else if (rec.type === 'rmdir') {
      for (const d of rec.dirs) {
        try {
          fs.mkdirSync(d, { recursive: true });
          log.push(`Carpeta recreada: ${d}`);
        } catch (e) {
          log.push(`Error al recrear: ${d}`);
        }
      }
    } else if (rec.type === 'trash') {
      for (const e of rec.entries) {
        if (fs.existsSync(e.backup)) {
          const dir = path.dirname(e.original);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(e.backup, e.original);
          fs.unlinkSync(e.backup);
          log.push(`Restaurado desde cuarentena: ${e.original}`);
        } else {
          log.push(`No se encontro respaldo para: ${e.original}`);
        }
      }
    }
  } catch (e) {
    return { success: false, error: e.message, log };
  }
  store.undo.splice(idx, 1);
  saveStore();
  return { success: true, log };
});

/* ---------- IPC: miniaturas ---------- */
ipcMain.handle('get-thumbnails', async (event, paths) => {
  const result = {};
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico']);
  for (const p of paths) {
    try {
      const ext = path.extname(p).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) {
        result[p] = null;
        continue;
      }
      if (ext === '.svg') {
        const data = fs.readFileSync(p);
        result[p] = `data:image/svg+xml;base64,${data.toString('base64')}`;
        continue;
      }
      const img = await nativeImage.createThumbnailFromPath(p, { width: 96, height: 96 });
      result[p] = img.isEmpty() ? null : img.toDataURL();
    } catch (e) {
      result[p] = null;
    }
  }
  return result;
});

/* ---------- IPC: imagenes similares ---------- */
ipcMain.handle('analyze-similar-images', async (event, { files, threshold, maxFiles }) => {
  event.sender.send('scan-progress', { scanned: 0, current: 'Analizando imagenes similares (hash perceptual)...' });
  const groups = findSimilarGroups(files || [], { threshold, maxFiles });
  return { groups };
});

/* ---------- IPC: renombrado masivo ---------- */
ipcMain.handle('preview-rename', (event, { files, pattern }) => {
  const plan = buildRenamePlan(files || [], pattern, { seqZero: true });
  return { success: true, plan };
});

ipcMain.handle('apply-rename', (event, { plan }) => {
  const entries = [];
  const result = applyRenamePlan(plan, (item) => entries.push(item));
  if (result.renamed > 0) {
    addUndoRecord({ type: 'rename', label: `Renombrar ${result.renamed} archivos`, entries });
  }
  return result;
});

/* ---------- IPC: informes ---------- */
ipcMain.handle('export-report', async (event, { scanData, format, actions }) => {
  const defaultPath = scanData.folders && scanData.folders[0]
    ? path.join(scanData.folders[0], `Informe_SmartFolderOrganizer.${format}`)
    : `Informe_SmartFolderOrganizer.${format}`;
  const dialogResult = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar informe',
    defaultPath,
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  });
  if (dialogResult.canceled || !dialogResult.filePath) return { success: false, canceled: true };
  let content;
  if (format === 'html') {
    content = buildHtmlReport(scanData, `Analisis de ${scanData.totalFiles} archivos (${new Date().toLocaleString()})`);
  } else {
    const rep = buildReport(scanData);
    const actionCsv = buildActionCsv(actions || []);
    content = rep.csv + '\r\n\r\n=== ACCIONES ===\r\n' + actionCsv;
  }
  fs.writeFileSync(dialogResult.filePath, content, 'utf8');
  return { success: true, filePath: dialogResult.filePath };
});

/* ---------- IPC: metadatos de imagen (EXIF) ---------- */
ipcMain.handle('get-file-metadata', (event, filePath) => {
  return extractMetadata(filePath);
});

/* ---------- IPC: misc ---------- */
ipcMain.handle('open-in-explorer', (event, filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});