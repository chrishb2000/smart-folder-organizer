const { app } = require('electron');
const electron = require('electron');
const path = require('path');
const fs = require('fs');

process.env.SFO_E2E = '1';

const testDir = path.join(__dirname, '_e2e_scan');
fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir, { recursive: true });

electron.dialog.showSaveDialog = async () => ({
  canceled: false,
  filePath: path.join(testDir, 'informe_e2e.csv')
});

const { gradientPng, checkerPng } = require('./helpers');
fs.writeFileSync(path.join(testDir, 'fotoA.png'), gradientPng(48, 48, 255, 128, 64));
fs.writeFileSync(path.join(testDir, 'fotoB.png'), gradientPng(48, 48, 255, 128, 64));
fs.writeFileSync(path.join(testDir, 'fotoC.png'), gradientPng(47, 47, 255, 128, 64));
fs.writeFileSync(path.join(testDir, 'img_dif.png'), checkerPng(48, 48, 3));
fs.writeFileSync(path.join(testDir, 'doc.pdf'), 'doc-content');
fs.writeFileSync(path.join(testDir, 'basura.tmp'), 'tmp');
fs.writeFileSync(path.join(testDir, 'falso.png'), '%PDF-1.4\n%%EOF\n');
fs.mkdirSync(path.join(testDir, 'empty1'));

require('../main.js');

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
        out.wrongExtCount = (scan.wrongExtensions||[]).length;

        window.__sfo.setScanData(scan);
        window.__sfo.renderResults(scan);
        out.dashCards = document.querySelectorAll('.dash-card').length;
        document.getElementById('filterSearch').value = 'foto';
        window.__sfo.renderFiltered();
        out.filteredItems = document.querySelectorAll('#filteredList .file-item').length;

        const imgPaths = ['fotoA.png','fotoB.png','fotoC.png','img_dif.png'].map(n => fsys + '\\\\' + n);
        const similar = await window.api.analyzeSimilarImages({ files: imgPaths.map(p => ({ path: p })), threshold: 7, maxFiles: 0 });
        out.similarGroups = similar.groups.length;
        out.similarGroupSize = similar.groups.length ? similar.groups[0].files.length : 0;
        out.similarHasDif = similar.groups.length ? similar.groups[0].files.some(f => f.path.endsWith('img_dif.png')) : false;

        const meta = await window.api.getFileMetadata(fsys + '\\\\fotoA.png');
        out.metaW = meta.width;
        out.metaH = meta.height;

        // --- Renombrado masivo + deshacer ---
        const filesToRename = ['fotoA.png','fotoB.png','fotoC.png','img_dif.png'].map(n => ({ path: fsys + '\\\\' + n, name: n }));
        const rp = await window.api.previewRename({ files: filesToRename, pattern: '{fecha}_{nombre_limpio}_{sec}' });
        out.renamePreviewCount = rp.plan.length;
        const rr = await window.api.applyRename({ plan: rp.plan });
        out.renamed = rr.renamed;
        const renameUndo = (await window.api.getUndo()).find(r => r.type === 'rename');
        out.renameUndoExists = !!renameUndo;
        const rUndo = await window.api.undoRecord(renameUndo.id);
        out.renameUndoSuccess = rUndo.success;

        // --- Organizar + deshacer ---
        const plan = await window.api.buildOrganizePlan({ folders: [fsys], includeCategories: ['Imagenes','Documentos'], organizeByDate: false, autoRename: false, customRules: [] });
        out.planCount = plan.plan.length;
        const applied = await window.api.applyOrganizePlan({ plan: plan.plan });
        out.appliedMoved = applied.moved;
        const undo = await window.api.getUndo();
        out.undoCount = undo.length;
        const undoRes = await window.api.undoRecord(undo.find(r => r.type === 'move').id);
        out.undoSuccess = undoRes.success;

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

        // --- Informes ---
        const exp = await window.api.exportReport({ scanData: scan, format: 'csv', actions: [] });
        out.reportSaved = exp.success;

        // --- Nueva organizacion (volver al inicio sin cerrar la ventana) ---
        const newBtn = document.getElementById('newOrgBtn');
        out.hasNewBtn = !!newBtn;
        if (newBtn) {
          document.getElementById('homeView').classList.remove('active');
          document.getElementById('resultsView').classList.add('active');
          newBtn.click();
          await new Promise(r=>setTimeout(r,120));
          out.afterNewHome = document.getElementById('homeView').classList.contains('active');
          out.afterNewResults = document.getElementById('resultsView').classList.contains('active');
          out.folderQueueCleared = document.getElementById('folderQueue').textContent.indexOf('No has anadido') !== -1;
        }

        return out;
      })()`;
      const result = await win.webContents.executeJavaScript(script);
      console.log('E2E_RESULT=' + JSON.stringify(result));

      const fotoBack = fs.existsSync(path.join(testDir, 'fotoA.png'));
      const docBack = fs.existsSync(path.join(testDir, 'doc.pdf'));
      const csvReport = fs.existsSync(path.join(testDir, 'informe_e2e.csv'));
      console.log('FS_CHECK fotoBack=' + fotoBack + ' docBack=' + docBack + ' csvReport=' + csvReport);

      let zipCheck = null;
      if (result.zipPath) {
        zipCheck = fs.existsSync(result.zipPath);
        const head = fs.readFileSync(result.zipPath);
        zipCheck = zipCheck && head.length > 4 && head[0] === 0x50 && head[1] === 0x4b;
      }
      console.log('ZIP_CHECK zipPath=' + (result.zipPath || 'null') + ' valid=' + zipCheck);

      const errors = [];
      if (result.themeAfter === result.themeStart) errors.push('theme-unchanged');
      if (result.scanFiles !== 7) errors.push('scanFiles!=7');
      if (result.dupGroups !== 1) errors.push('dupGroups!=1');
      if (result.tempCount !== 1) errors.push('tempCount!=1');
      if (result.emptyCount !== 1) errors.push('emptyCount!=1');
      if (result.wrongExtCount !== 1) errors.push('wrongExt!=1');
      if (result.dashCards < 4) errors.push('dashboard-missing');
      if (result.filteredItems < 3) errors.push('filter-failed');
      if (result.similarGroups !== 1) errors.push('similarGroups!=1');
      if (result.similarGroupSize !== 3) errors.push('similarSize!=3');
      if (result.similarHasDif) errors.push('similar-grouped-different');
      if (result.metaW !== 48 || result.metaH !== 48) errors.push('meta-dims');
      if (result.renamePreviewCount !== 4) errors.push('renamePreview!=4');
      if (result.renamed !== 4) errors.push('renamed!=4');
      if (!result.renameUndoExists) errors.push('rename-undo-missing');
      if (!result.renameUndoSuccess) errors.push('rename-undo-failed');
      if (result.planCount !== 6) errors.push('planCount!=6');
      if (result.appliedMoved !== 6) errors.push('appliedMoved!=6');
      if (result.undoCount < 1) errors.push('undoCount<1');
      if (!result.undoSuccess) errors.push('undo-failed');
      if (result.rulesCount !== 1 || result.rulesFolder !== 'Facturas') errors.push('rules-failed');
      if (!fotoBack || !docBack) errors.push('fs-not-restored');
      if (result.undoAfterRestore !== 0) errors.push('undo-not-cleared');
      if (result.delDeleted !== 1) errors.push('delDeleted!=1');
      if (!result.trashUndoExists) errors.push('trash-undo-missing');
      if (!result.trashUndoSuccess) errors.push('trash-undo-failed');
      if (!zipCheck) errors.push('zip-not-valid');
      if (!result.reportSaved || !csvReport) errors.push('report-export-failed');
      if (!result.hasNewBtn) errors.push('new-btn-missing');
      if (!result.afterNewHome || result.afterNewResults) errors.push('new-org-navigation-failed');
      if (!result.folderQueueCleared) errors.push('folder-queue-not-cleared');

      if (errors.length === 0) console.log('E2E: ALL PASSED');
      else console.log('E2E: FAILURES ' + JSON.stringify(errors));
    } catch (e) {
      console.log('E2E_ERROR=' + e.message + '\n' + (e.stack || ''));
    }
    fs.rmSync(testDir, { recursive: true, force: true });
    app.exit(0);
  });
});