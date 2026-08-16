const { app, BrowserWindow } = require('electron');
require('../main.js');

const path = require('path');
const fs = require('fs');

const testDir = path.join(__dirname, '_e2e_scan');
fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir, { recursive: true });
const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
fs.writeFileSync(path.join(testDir, 'fotoA.png'), pngBytes);
fs.writeFileSync(path.join(testDir, 'fotoB.png'), pngBytes);
fs.writeFileSync(path.join(testDir, 'doc.pdf'), 'doc-content');
fs.writeFileSync(path.join(testDir, 'basura.tmp'), 'tmp');
fs.mkdirSync(path.join(testDir, 'empty1'));

const pngPath = path.join(testDir, 'fotoA.png');

app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (_ev, _level, message) => {
    if (/error|uncaught|failed/i.test(message)) console.log('RENDERER_ERR=' + message);
  });

  win.webContents.once('did-finish-load', async () => {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const script = `(async () => {
        const out = {};
        const fsys = ${JSON.stringify(testDir)};

        out.themeStart = document.documentElement.getAttribute('data-theme');
        document.getElementById('themeToggle').click();
        await new Promise(r=>setTimeout(r,80));
        out.themeAfter = document.documentElement.getAttribute('data-theme');
        out.themeLabel = document.getElementById('themeToggle').textContent;

        const scan = await window.api.scanFolders({ folders: [fsys], customRules: [] });
        out.scanFiles = scan.totalFiles;
        out.dupGroups = scan.duplicateGroups.length;
        out.tempCount = scan.tempFiles.length;
        out.emptyCount = scan.emptyFolders.length;
        out.catImg = (scan.categories.find(c=>c.name==='Imagenes')||{}).count || 0;

        const plan = await window.api.buildOrganizePlan({ folders: [fsys], includeCategories: ['Imagenes','Documentos'], organizeByDate: false, autoRename: false, customRules: [] });
        out.planCount = plan.plan.length;
        const applied = await window.api.applyOrganizePlan({ plan: plan.plan });
        out.appliedMoved = applied.moved;

        const undo = await window.api.getUndo();
        out.undoCount = undo.length;
        const undoRes = await window.api.undoRecord(undo[0].id);
        out.undoSuccess = undoRes.success;

        const thumbs = await window.api.getThumbnails([${JSON.stringify(pngPath)}]);
        const tv = thumbs[${JSON.stringify(pngPath)}];
        out.thumbHasData = !!tv;
        out.thumbPrefix = (tv||'').slice(0, 22);

        await window.api.saveRules([{ folder: 'Facturas', exts: ['.pdf'] }]);
        const rules = await window.api.getRules();
        out.rulesCount = rules.length;
        out.rulesFolder = (rules[0]||{}).folder;

        out.undoAfterRestore = (await window.api.getUndo()).length;

        // --- Borrado seguro de duplicados + deshacer (cuarentena) ---
        const scan2 = await window.api.scanFolders({ folders: [fsys], customRules: [] });
        const g2 = scan2.duplicateGroups[0];
        const toDel2 = g2.files.slice(1).map(f => f.path);
        const delRes = await window.api.deleteDuplicates({ files: toDel2, rootFolder: fsys, backupZip: false });
        out.delDeleted = delRes.deleted;
        const trashUndo = (await window.api.getUndo()).find(r => r.type === 'trash');
        out.trashUndoExists = !!trashUndo;
        const undoRes2 = await window.api.undoRecord(trashUndo.id);
        out.trashUndoSuccess = undoRes2.success;
        out.trashUndoLog = undoRes2.log.length;

        // --- Respaldo .zip antes de eliminar ---
        const scan3 = await window.api.scanFolders({ folders: [fsys], customRules: [] });
        const g3 = scan3.duplicateGroups[0];
        const toDel3 = g3.files.slice(1).map(f => f.path);
        const del3 = await window.api.deleteDuplicates({ files: toDel3, rootFolder: fsys, backupZip: true });
        out.zipPath = del3.zipPath || null;
        const trashUndo3 = (await window.api.getUndo()).find(r => r.type === 'trash');
        if (trashUndo3) await window.api.undoRecord(trashUndo3.id);

        return out;
      })()`;
      const result = await win.webContents.executeJavaScript(script);
      console.log('E2E_RESULT=' + JSON.stringify(result));

      const fotoBack = fs.existsSync(path.join(testDir, 'fotoA.png'));
      const docBack = fs.existsSync(path.join(testDir, 'doc.pdf'));
      console.log('FS_CHECK fotoBack=' + fotoBack + ' docBack=' + docBack);

      let zipCheck = null;
      if (result.zipPath) {
        zipCheck = fs.existsSync(result.zipPath);
        const head = fs.readFileSync(result.zipPath);
        zipCheck = zipCheck && head.length > 4 && head[0] === 0x50 && head[1] === 0x4b;
      }
      console.log('ZIP_CHECK zipPath=' + (result.zipPath || 'null') + ' valid=' + zipCheck);

      const errors = [];
      if (result.themeAfter === result.themeStart) errors.push('theme-unchanged');
      if (result.scanFiles !== 4) errors.push('scanFiles!=4');
      if (result.dupGroups !== 1) errors.push('dupGroups!=1');
      if (result.tempCount !== 1) errors.push('tempCount!=1');
      if (result.emptyCount !== 1) errors.push('emptyCount!=1');
      if (result.planCount !== 3) errors.push('planCount!=3');
      if (result.appliedMoved !== 3) errors.push('appliedMoved!=3');
      if (result.undoCount < 1) errors.push('undoCount<1');
      if (!result.undoSuccess) errors.push('undo-failed');
      if (!result.thumbHasData) errors.push('no-thumbnail');
      if (result.rulesCount !== 1 || result.rulesFolder !== 'Facturas') errors.push('rules-failed');
      if (!fotoBack || !docBack) errors.push('fs-not-restored');
      if (result.undoAfterRestore !== 0) errors.push('undo-not-cleared');
      if (result.delDeleted !== 1) errors.push('delDeleted!=1');
      if (!result.trashUndoExists) errors.push('trash-undo-missing');
      if (!result.trashUndoSuccess) errors.push('trash-undo-failed');
      if (!zipCheck) errors.push('zip-not-valid');

      if (errors.length === 0) console.log('E2E: ALL PASSED');
      else console.log('E2E: FAILURES ' + JSON.stringify(errors));
    } catch (e) {
      console.log('E2E_ERROR=' + e.message + '\n' + (e.stack || ''));
    }
    fs.rmSync(testDir, { recursive: true, force: true });
    app.exit(0);
  });
});