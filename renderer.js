const sfoApi = window.api;

const CATEGORY_ORDER = ['Imagenes', 'Videos', 'Audios', 'Documentos', 'Instaladores', 'Comprimidos', 'Codigo', 'Otros'];

let folders = [];
let scanData = null;
let customRules = [];
let sessionHistory = [];
let undoRecords = [];
let sessionActions = [];

const $ = (id) => document.getElementById(id);

/* ---------- Tema ---------- */
function initTheme() {
  const saved = localStorage.getItem('sfo-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('themeToggle').textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro';
  localStorage.setItem('sfo-theme', theme);
}

$('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 4000);
}

/* ---------- Modal ---------- */
let modalResolve = null;
function askConfirm(title, body) {
  return new Promise((resolve) => {
    modalResolve = resolve;
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = body;
    $('modal').classList.remove('hidden');
  });
}
$('modalCancel').addEventListener('click', () => {
  $('modal').classList.add('hidden');
  if (modalResolve) { modalResolve(false); modalResolve = null; }
});
$('modalConfirm').addEventListener('click', () => {
  $('modal').classList.add('hidden');
  if (modalResolve) { modalResolve(true); modalResolve = null; }
});

/* ---------- Utilidades ---------- */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function isImagePath(p) {
  return /\.(jpe?g|png|gif|bmp|webp|svg|ico)$/i.test(p);
}

/* ---------- Cola de carpetas ---------- */
function renderFolderQueue() {
  const container = $('folderQueue');
  if (folders.length === 0) {
    container.innerHTML = '<div class="empty-hint">No has anadido carpetas. Haz clic en &quot;+ Anadir carpeta&quot;.</div>';
    return;
  }
  container.innerHTML = folders.map((f, i) => `
    <div class="folder-chip">
      <span class="chip-path" title="${escapeHtml(f)}">${escapeHtml(f)}</span>
      <button class="chip-remove" data-idx="${i}" title="Quitar">&times;</button>
    </div>
  `).join('');

  container.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      folders.splice(Number(btn.dataset.idx), 1);
      renderFolderQueue();
    });
  });
}

$('addFolderBtn').addEventListener('click', async () => {
  const folder = await sfoApi.selectFolder();
  if (!folder) return;
  if (!folders.includes(folder)) folders.push(folder);
  renderFolderQueue();
});

/* ---------- Escaneo ---------- */
$('scanBtn').addEventListener('click', async () => {
  if (folders.length === 0) {
    showToast('Anade al menos una carpeta antes de analizar.');
    return;
  }
  $('statsView').classList.add('hidden');
  $('progressWrap').classList.remove('hidden');
  $('progressBar').style.width = '0%';
  $('progressText').textContent = 'Escaneando...';
  addHistory('Analisis iniciado de ' + folders.length + ' carpeta(s)');

  try {
    scanData = await sfoApi.scanFolders({ folders, customRules });
    renderResults(scanData);
    showToast('Analisis completado correctamente.');
    addHistory(`Analisis completado: ${scanData.totalFiles} archivos en ${formatBytes(scanData.totalSize)}`);
  } catch (err) {
    showToast('Error al analizar: ' + err.message);
    addHistory('Error de analisis: ' + err.message);
  } finally {
    $('progressWrap').classList.add('hidden');
  }
});

sfoApi.onScanProgress(({ scanned, current }) => {
  $('progressText').textContent = `Escaneando: ${scanned} archivos - ${current || ''}`;
  $('progressBar').style.width = '100%';
});

/* ---------- Resultados ---------- */
function renderResults(data) {
  $('statFiles').textContent = data.totalFiles.toLocaleString();
  $('statFolders').textContent = data.totalFolders.toLocaleString();
  $('statSize').textContent = formatBytes(data.totalSize);
  $('statDupes').textContent = data.duplicateGroups.length;
  $('statWasted').textContent = formatBytes(data.duplicateWasted);
  $('statDuration').textContent = `${(data.scanDuration / 1000).toFixed(1)} s`;

  renderCategories(data.categories);
  renderDuplicates(data.duplicateGroups);
  renderLargeFiles(data.largeFiles);
  renderClean(data.emptyFolders, data.tempFiles);
  renderIntegrity(data.wrongExtensions, data.brokenFiles);
  renderDashboard(data.dashboard || {});
  renderSimilarPlaceholder();
  drawPieChart(data.categories);

  $('homeView').classList.remove('active');
  $('resultsView').classList.add('active');
}

/* ---------- Grafico circular ---------- */
const PIE_COLORS = ['#4f8cff', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];

function drawPieChart(categories) {
  const canvas = $('pieChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width;
  const H = canvas.height;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) / 2 - 10;
  const total = categories.reduce((s, c) => s + c.size, 0) || 1;
  let angle = -Math.PI / 2;

  categories.forEach((c, i) => {
    const slice = (c.size / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    angle += slice;
  });

  const legend = $('chartLegend');
  legend.innerHTML = categories.map((c, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></span>
      <span class="legend-text">${escapeHtml(c.name)} - ${c.count} (${formatBytes(c.size)})</span>
    </div>
  `).join('');
}

/* ---------- Organizar ---------- */
function renderCategories(categories) {
  const grid = $('categoryCheckboxes');
  const ordered = CATEGORY_ORDER.map((name) => categories.find((c) => c.name === name)).filter(Boolean);
  grid.innerHTML = ordered.map((c) => `
    <label>
      <input type="checkbox" class="cat-check" value="${escapeHtml(c.name)}" checked />
      <span>${escapeHtml(c.name)} <small>(${c.count} / ${formatBytes(c.size)})</small></span>
    </label>
  `).join('');

  if (ordered.length === 0) {
    grid.innerHTML = '<p class="hint">No se encontraron archivos para organizar en la raiz de las carpetas.</p>';
  }
}

$('applyOrganizeBtn').addEventListener('click', async () => {
  if (!scanData) return;
  const includeCategories = Array.from(document.querySelectorAll('.cat-check:checked')).map((el) => el.value);
  const result = await sfoApi.buildOrganizePlan({
    folders: scanData.folders,
    includeCategories,
    organizeByDate: $('optByDate').checked,
    autoRename: $('optRename').checked,
    customRules
  });
  if (!result.success) {
    showToast('Error al generar el plan: ' + (result.error || 'desconocido'));
    return;
  }
  if (result.plan.length === 0) {
    showToast('No hay archivos que mover con las opciones seleccionadas.');
    return;
  }
  const ok = await askConfirm(
    'Aplicar organizacion',
    `Se moveran <strong>${result.plan.length}</strong> archivos a subcarpetas por categoria. Puedes deshacerlo desde el historial. Continuar?`
  );
  if (!ok) return;
  const applied = await sfoApi.applyOrganizePlan({ plan: result.plan });
  applied.log.forEach((l) => addHistory(l));
  showToast(`Organizacion aplicada: ${applied.moved} movidos, ${applied.failed} con error.`);
  addHistory(`Organizacion: ${applied.moved} archivos movidos, ${applied.failed} errores.`);
  await refreshUndo();
  rescan();
});

$('cancelOrganizeBtn').addEventListener('click', startNewOrganization);
$('newOrgBtn').addEventListener('click', startNewOrganization);

/* ---------- Nueva organizacion ---------- */
function startNewOrganization() {
  folders = [];
  scanData = null;
  renamePlan = null;
  similarData = null;
  cleanData = { emptyFolders: [], tempFiles: [] };
  integrityData = { wrong: [], broken: [] };
  $('resultsView').classList.remove('active');
  $('homeView').classList.add('active');
  $('statsView').classList.add('hidden');
  $('progressWrap').classList.add('hidden');
  renderFolderQueue();
  renderFilteredFiles();
  showToast('Nueva organizacion iniciada. Anade carpetas para comenzar.');
}

/* ---------- Reglas personalizadas ---------- */
async function loadRules() {
  customRules = await sfoApi.getRules();
  renderRules();
}

function renderRules() {
  const list = $('ruleList');
  if (customRules.length === 0) {
    list.innerHTML = '<p class="hint" style="margin:0">Sin reglas. Ejemplo: carpeta &quot;Facturas&quot; con extensiones pdf, xlsx.</p>';
    return;
  }
  list.innerHTML = customRules.map((r, i) => `
    <div class="rule-item">
      <span class="rule-name">${escapeHtml(r.folder)}</span>
      <span class="rule-exts">${escapeHtml(r.exts.join(', '))}</span>
      <button class="rule-del" data-idx="${i}" title="Eliminar">&times;</button>
    </div>
  `).join('');

  list.querySelectorAll('.rule-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      customRules.splice(Number(btn.dataset.idx), 1);
      await sfoApi.saveRules(customRules);
      renderRules();
      addHistory('Regla personalizada eliminada.');
    });
  });
}

$('addRuleBtn').addEventListener('click', async () => {
  const folder = $('ruleFolder').value.trim();
  const extText = $('ruleExts').value.trim();
  if (!folder || !extText) {
    showToast('Indica el nombre de la carpeta y las extensiones.');
    return;
  }
  const exts = extText.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).map((e) => (e.startsWith('.') ? e : '.' + e));
  customRules.push({ folder, exts });
  await sfoApi.saveRules(customRules);
  $('ruleFolder').value = '';
  $('ruleExts').value = '';
  renderRules();
  addHistory(`Regla anadida: ${folder} (${exts.join(', ')})`);
  showToast('Regla guardada. Re-analiza para aplicarla.');
});

/* ---------- Duplicados ---------- */
function renderDuplicates(groups) {
  const container = $('duplicateGroups');
  if (!groups || groups.length === 0) {
    container.innerHTML = '<p class="hint">No se encontraron archivos duplicados.</p>';
    return;
  }
  container.innerHTML = groups.map((group, idx) => `
    <div class="dup-group">
      <div class="dup-head">
        <strong>Grupo ${idx + 1} &middot; ${group.files.length} copias &middot; ${formatBytes(group.size)} c/u</strong>
        <button class="btn btn-danger btn-small dup-delete" data-idx="${idx}">Eliminar copias extra</button>
      </div>
      <div class="dup-files">
        ${group.files.map((f, fi) => `
          <div class="dup-file${fi === 0 ? ' keep' : ''}">
            <span class="dup-name">${fi === 0 ? '&#10004; Original: ' : ''}${escapeHtml(f.name)}</span>
            <span>${escapeHtml(f.path)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.dup-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const group = groups[Number(btn.dataset.idx)];
      const toDelete = group.files.slice(1).map((f) => f.path);
      const secure = $('dupSecure').checked;
      const backupZip = $('dupZip').checked;
      const sizeFreed = formatBytes(group.size * toDelete.length);
      const modeText = secure
        ? `Se moveran a cuarentena (restaurable) y se eliminaran del disco. Espacio a liberar: ${sizeFreed}.`
        : `Se eliminaran definitivamente (sin posibilidad de restaurar). Espacio a liberar: ${sizeFreed}.`;
      const ok = await askConfirm(
        'Eliminar duplicados',
        `<strong>${toDelete.length}</strong> copias duplicadas (se conserva la primera). ${modeText}` +
        (backupZip ? '<br/><em>Ademas se creara un respaldo .zip.</em>' : '')
      );
      if (!ok) return;
      const result = await sfoApi.deleteDuplicates({ files: toDelete, rootFolder: group.files[0].path.split(/[\\/]/).slice(0, -1).join(pathSep()), backupZip });
      result.log.forEach((l) => addHistory(l));
      showToast(`Duplicados: ${result.deleted} eliminados.`);
      addHistory(`Duplicados: ${result.deleted} copias eliminadas (${sizeFreed})${secure ? ' [cuarentena]' : ''}`);
      await refreshUndo();
      rescan();
    });
  });
}

/* ---------- Archivos grandes ---------- */
async function renderLargeFiles(files) {
  const container = $('largeList');
  if (!files || files.length === 0) {
    container.innerHTML = '<p class="hint">No hay archivos para mostrar.</p>';
    return;
  }
  const imagePaths = files.filter((f) => isImagePath(f.path)).map((f) => f.path);
  const thumbs = await sfoApi.getThumbnails(imagePaths);

  container.innerHTML = files.map((f) => `
    <div class="file-item">
      ${thumbs[f.path] ? `<img class="thumb" src="${thumbs[f.path]}" alt="" />` : ''}
      <span class="file-cat">${escapeHtml(f.category)}</span>
      <span class="file-name">${escapeHtml(f.name)}</span>
      <span class="file-size">${formatBytes(f.size)}</span>
      <button class="link-btn" data-path="${escapeHtml(f.path)}">Abrir ubicacion</button>
    </div>
  `).join('');

  container.querySelectorAll('.link-btn').forEach((btn) => {
    btn.addEventListener('click', () => sfoApi.openInExplorer(btn.dataset.path));
  });
}

function pathSep() {
  return navigator.userAgent.indexOf('Win') !== -1 ? '\\' : '/';
}

/* ---------- Limpieza ---------- */
let cleanData = { emptyFolders: [], tempFiles: [] };

function renderClean(emptyFolders, tempFiles) {
  cleanData = { emptyFolders, tempFiles };
  const container = $('cleanResults');
  const emptyCount = emptyFolders.length;
  const tempCount = tempFiles.length;
  const tempSize = tempFiles.reduce((s, f) => s + f.size, 0);
  container.classList.remove('hidden');
  container.innerHTML =
    `<div>Carpetas vacias detectadas: <strong>${emptyCount}</strong></div>` +
    `<div>Archivos temporales detectados: <strong>${tempCount}</strong> (${formatBytes(tempSize)})</div>`;
}

$('cleanEmptyBtn').addEventListener('click', async () => {
  if (!scanData || cleanData.emptyFolders.length === 0) {
    showToast('No hay carpetas vacias que eliminar.');
    return;
  }
  const ok = await askConfirm(
    'Eliminar carpetas vacias',
    `Se eliminaran <strong>${cleanData.emptyFolders.length}</strong> carpetas vacias dentro de las carpetas analizadas. Puedes restaurarlas desde el historial.`
  );
  if (!ok) return;
  const foldersToClean = scanData.folders;
  const allLogs = [];
  let totalDeleted = 0;
  for (const folderPath of foldersToClean) {
    const result = await sfoApi.deleteEmptyFolders({ folderPath });
    totalDeleted += result.deleted;
    result.log.forEach((l) => allLogs.push(l));
  }
  allLogs.forEach((l) => addHistory(l));
  showToast(`Carpetas vacias eliminadas: ${totalDeleted}`);
  addHistory(`Limpieza: ${totalDeleted} carpetas vacias eliminadas.`);
  await refreshUndo();
  rescan();
});

$('cleanTempBtn').addEventListener('click', async () => {
  if (!scanData || cleanData.tempFiles.length === 0) {
    showToast('No hay archivos temporales que eliminar.');
    return;
  }
  const secure = $('cleanSecure').checked;
  const backupZip = $('cleanZip').checked;
  const size = cleanData.tempFiles.reduce((s, f) => s + f.size, 0);
  const modeText = secure
    ? `Se moveran a cuarentena (restaurable) y se eliminaran del disco.`
    : `Se eliminaran definitivamente (sin posibilidad de restaurar).`;
  const ok = await askConfirm(
    'Eliminar archivos temporales',
    `Se eliminaran <strong>${cleanData.tempFiles.length}</strong> archivos temporales (${formatBytes(size)}). ${modeText}` +
    (backupZip ? '<br/><em>Ademas se creara un respaldo .zip.</em>' : '')
  );
  if (!ok) return;
  const rootFolder = scanData.folders[0];
  const result = await sfoApi.deleteTempFiles({ files: cleanData.tempFiles.map((f) => f.path), rootFolder, backupZip });
  result.log.forEach((l) => addHistory(l));
  showToast(`Temporales: ${result.deleted} eliminados.`);
  addHistory(`Limpieza: ${result.deleted} temporales eliminados (${formatBytes(size)})${secure ? ' [cuarentena]' : ''}`);
  await refreshUndo();
  rescan();
});

/* ---------- Historial y deshacer ---------- */
function addHistory(text) {
  const time = new Date().toLocaleTimeString();
  sessionHistory.unshift({ time, text });
  sessionActions.push({ date: Date.now(), type: 'session', label: text, detail: '' });
  if (sessionActions.length > 200) sessionActions = sessionActions.slice(0, 200);
  renderHistory();
}

async function refreshUndo() {
  undoRecords = await sfoApi.getUndo();
  renderHistory();
}

function renderHistory() {
  const log = $('historyLog');
  const undoHtml = undoRecords.map((rec) => `
    <div class="log-entry">
      <span class="log-time">[${new Date(rec.date).toLocaleTimeString()}]</span>
      <span class="log-text">&#8634; ${escapeHtml(rec.label)}</span>
      <span class="log-actions">
        <button class="restore-btn" data-id="${rec.id}">Restaurar</button>
      </span>
    </div>
  `).join('');
  const sessionHtml = sessionHistory.map((e) =>
    `<div class="log-entry"><span class="log-time">[${e.time}]</span><span class="log-text">${escapeHtml(e.text)}</span></div>`
  ).join('');
  log.innerHTML = (undoHtml + sessionHtml) || '<div class="log-entry"><span class="log-text">Sin acciones registradas.</span></div>';

  log.querySelectorAll('.restore-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const result = await sfoApi.undoRecord(btn.dataset.id);
      if (result.success) {
        result.log.forEach((l) => addHistory(l));
        showToast('Accion restaurada correctamente.');
        addHistory('Deshacer completado.');
        await refreshUndo();
        rescan();
      } else {
        showToast('No se pudo restaurar: ' + (result.error || 'desconocido'));
        result.log && result.log.forEach((l) => addHistory(l));
      }
    });
  });
}

$('clearHistoryBtn').addEventListener('click', () => {
  sessionHistory = [];
  renderHistory();
});

/* ---------- Integridad (extensiones incorrectas y rotos) ---------- */
let integrityData = { wrong: [], broken: [] };

function renderIntegrity(wrong, broken) {
  integrityData = { wrong: wrong || [], broken: broken || [] };
  const container = $('integrityResults');
  const wrongCount = integrityData.wrong.length;
  const brokenCount = integrityData.broken.length;
  const wrongSize = integrityData.wrong.reduce((s, f) => s + f.size, 0);
  const brokenSize = integrityData.broken.reduce((s, f) => s + f.size, 0);
  container.classList.remove('hidden');
  container.innerHTML =
    `<div>Extensiones incorrectas: <strong>${wrongCount}</strong> (${formatBytes(wrongSize)}) &middot; Archivos rotos/corruptos: <strong>${brokenCount}</strong> (${formatBytes(brokenSize)})</div>`;
  $('deleteWrongBtn').disabled = wrongCount === 0;
  $('deleteBrokenBtn').disabled = brokenCount === 0;
}

function integrityClean(kind) {
  return async () => {
    if (!scanData) return;
    const files = kind === 'wrong' ? integrityData.wrong : integrityData.broken;
    if (files.length === 0) {
      showToast('No hay archivos de este tipo.');
      return;
    }
    const backupZip = $('integrityZip').checked;
    const label = kind === 'wrong' ? 'Extension incorrecta' : 'Archivo roto';
    const size = files.reduce((s, f) => s + f.size, 0);
    const ok = await askConfirm(
      `Mover ${label}s a cuarentena`,
      `Se moveran <strong>${files.length}</strong> ${label}s (${formatBytes(size)}) a la cuarentena (restaurable).` +
      (backupZip ? '<br/><em>Ademas se creara un respaldo .zip.</em>' : '')
    );
    if (!ok) return;
    const rootFolder = scanData.folders[0];
    const result = await sfoApi.deleteDuplicates({ files: files.map((f) => f.path), rootFolder, backupZip });
    result.log.forEach((l) => addHistory(l));
    showToast(`${label}s: ${result.deleted} movidos a cuarentena.`);
    addHistory(`Integridad: ${result.deleted} ${label}s a cuarentena (${formatBytes(size)})`);
    await refreshUndo();
    rescan();
  };
}

$('deleteWrongBtn').addEventListener('click', integrityClean('wrong'));
$('deleteBrokenBtn').addEventListener('click', integrityClean('broken'));

/* ---------- Imagenes similares ---------- */
let similarData = null;

$('similarThreshold').addEventListener('input', () => {
  $('similarThresholdLabel').textContent = $('similarThreshold').value;
});

function renderSimilarPlaceholder() {
  $('similarResults').innerHTML = '<p class="hint">Pulsa &quot;Analizar imagenes similares&quot; para buscar fotos casi-duplicadas.</p>';
}

$('analyzeSimilarBtn').addEventListener('click', async () => {
  if (!scanData) return;
  const threshold = Number($('similarThreshold').value);
  const imageFiles = scanData.files.filter((f) => /\.(jpe?g|png)$/i.test(f.ext));
  if (imageFiles.length === 0) {
    $('similarResults').innerHTML = '<p class="hint">No se encontraron archivos JPG/PNG para analizar.</p>';
    return;
  }
  $('progressWrap').classList.remove('hidden');
  $('progressText').textContent = `Analizando ${imageFiles.length} imagenes...`;
  try {
    const { groups } = await sfoApi.analyzeSimilarImages({ files: imageFiles, threshold, maxFiles: 0 });
    similarData = groups;
    renderSimilarResults(groups);
    addHistory(`Analisis de imagenes similares: ${groups.length} grupo(s) encontrados (umbral ${threshold}).`);
  } catch (err) {
    $('similarResults').innerHTML = `<p class="hint">Error: ${escapeHtml(err.message)}</p>`;
  } finally {
    $('progressWrap').classList.add('hidden');
  }
});

async function renderSimilarResults(groups) {
  const container = $('similarResults');
  if (!groups || groups.length === 0) {
    container.innerHTML = '<p class="hint">No se encontraron imagenes similares con el umbral actual.</p>';
    return;
  }
  const allPaths = groups.flatMap((g) => g.files.map((f) => f.path));
  const thumbs = await sfoApi.getThumbnails(allPaths);
  const metas = {};
  for (const p of allPaths.slice(0, 30)) {
    try { metas[p] = await sfoApi.getFileMetadata(p); } catch (e) { metas[p] = null; }
  }
  container.innerHTML = groups.map((group, idx) => `
    <div class="dup-group">
      <div class="dup-head">
        <strong>Grupo ${idx + 1} &middot; ${group.files.length} imagenes similares</strong>
        <button class="btn btn-danger btn-small similar-delete" data-idx="${idx}">Mover copias a cuarentena</button>
      </div>
      <div class="dup-files">
        ${group.files.map((f, fi) => `
          <div class="dup-file${fi === 0 ? ' keep' : ''}">
            ${thumbs[f.path] ? `<img class="thumb thumb-lg" src="${thumbs[f.path]}" alt="" />` : ''}
            <span class="dup-name">${fi === 0 ? '&#10004; Original: ' : ''}${escapeHtml(f.name)}</span>
            <span class="meta-line">${metaLine(metas[f.path])}</span>
            <span>${escapeHtml(f.path)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.similar-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const group = groups[Number(btn.dataset.idx)];
      const toDelete = group.files.slice(1).map((f) => f.path);
      const backupZip = $('dupZip').checked;
      const ok = await askConfirm(
        'Mover imagenes similares a cuarentena',
        `Se conserva la primera imagen y se mueven <strong>${toDelete.length}</strong> copias similares a cuarentena (restaurable).`
      );
      if (!ok) return;
      const rootFolder = group.files[0].path.split(/[\\/]/).slice(0, -1).join(pathSep());
      const result = await sfoApi.deleteDuplicates({ files: toDelete, rootFolder, backupZip });
      result.log.forEach((l) => addHistory(l));
      showToast(`Imagenes similares: ${result.deleted} movidas a cuarentena.`);
      await refreshUndo();
      rescan();
    });
  });
}

function metaLine(meta) {
  if (!meta) return '';
  const parts = [];
  if (meta.width && meta.height) parts.push(`${meta.width}x${meta.height}`);
  if (meta.dateTaken) parts.push(escapeHtml(String(meta.dateTaken)));
  if (meta.cameraMake || meta.cameraModel) parts.push(escapeHtml([meta.cameraMake, meta.cameraModel].filter(Boolean).join(' ')));
  return parts.length ? `<span class="meta-line">${parts.join(' &middot; ')}</span>` : '';
}

/* ---------- Renombrado masivo ---------- */
let renamePlan = null;

$('previewRenameBtn').addEventListener('click', async () => {
  if (!scanData) return;
  const pattern = $('renamePattern').value.trim();
  if (!pattern) {
    showToast('Indica un patron de renombrado, ej: {fecha}_{nombre_limpio}_{sec}');
    return;
  }
  const files = scanData.files;
  if (files.length === 0) {
    showToast('No hay archivos para renombrar.');
    return;
  }
  const { plan } = await sfoApi.previewRename({ files, pattern });
  renamePlan = plan;
  const preview = $('renamePreview');
  const changes = plan.filter((p) => !p.skipped);
  preview.innerHTML =
    `<h4>Se renombraran ${changes.length} archivos (${plan.length - changes.length} sin cambios):</h4>` +
    changes.slice(0, 200).map((p) =>
      `<div class="plan-item">${escapeHtml(p.name)} &rarr; <strong>${escapeHtml(p.newName)}</strong></div>`
    ).join('') +
    (changes.length > 200 ? `<div class="plan-item">... y ${changes.length - 200} mas.</div>` : '');
  preview.classList.remove('hidden');
  $('applyRenameBtn').disabled = changes.length === 0;
});

$('applyRenameBtn').addEventListener('click', async () => {
  if (!renamePlan || !scanData) return;
  const changes = renamePlan.filter((p) => !p.skipped);
  const ok = await askConfirm(
    'Aplicar renombrado',
    `Se renombraran <strong>${changes.length}</strong> archivos. Puedes deshacerlo desde el historial. Continuar?`
  );
  if (!ok) return;
  const result = await sfoApi.applyRename({ plan: renamePlan });
  result.log.forEach((l) => addHistory(l));
  showToast(`Renombrado: ${result.renamed} archivos, ${result.failed} con error.`);
  addHistory(`Renombrado: ${result.renamed} archivos renombrados, ${result.failed} errores.`);
  $('applyRenameBtn').disabled = true;
  renamePlan = null;
  $('renamePreview').classList.add('hidden');
  await refreshUndo();
  rescan();
});

/* ---------- Dashboard y filtros ---------- */
function renderDashboard(dash) {
  const container = $('dashCharts');
  const ext = $('filterCategory');
  ext.innerHTML = '<option value="">Todas las categorias</option>' +
    (dash.categories || []).map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');

  const extMax = Math.max(1, ...(dash.topExtensions || []).map((e) => e.size));
  const folderMax = Math.max(1, ...(dash.topFolders || []).map((f) => f.size));
  const bucketMax = Math.max(1, ...(dash.sizeBuckets || []).map((b) => b.size));
  const extBars = (dash.topExtensions || []).map((e) => barRow(e.ext, e.size, e.count, extMax)).join('');
  const folderBars = (dash.topFolders || []).map((f) => barRow(shortPath(f.folder), f.size, f.count, folderMax)).join('');
  const bucketBars = (dash.sizeBuckets || []).map((b) => barRow(b.label, b.size, b.count, bucketMax)).join('');
  const histMax = Math.max(1, ...(dash.dateHistogram || []).map((h) => h.count));

  container.innerHTML = `
    <div class="dash-grid">
      <div class="dash-card">
        <h4>Top extensiones</h4>
        ${extBars || '<p class="hint">Sin datos.</p>'}
      </div>
      <div class="dash-card">
        <h4>Carpetas mas pesadas</h4>
        ${folderBars || '<p class="hint">Sin datos.</p>'}
      </div>
      <div class="dash-card">
        <h4>Distribucion por tamano</h4>
        ${bucketBars || '<p class="hint">Sin datos.</p>'}
      </div>
      <div class="dash-card">
        <h4>Archivos por mes</h4>
        <div class="hist-bars">
          ${(dash.dateHistogram || []).map((h) => `
            <div class="hist-col" title="${escapeHtml(h.month)}: ${h.count} archivos">
              <div class="hist-bar" style="height:${Math.round((h.count / histMax) * 100)}%"></div>
              <span class="hist-label">${escapeHtml(h.month.slice(2))}</span>
            </div>`).join('') || '<p class="hint">Sin datos.</p>'}
        </div>
      </div>
    </div>`;
  renderFilteredFiles();
}

function shortPath(p) {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.length > 3 ? '...' + parts.slice(-3).join('/') : p;
}

function barRow(label, size, count, maxSize) {
  const pct = Math.max(2, Math.round((size / Math.max(maxSize, 1)) * 100));
  return `
    <div class="bar-row">
      <span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <span class="bar-value">${formatBytes(size)} <small>(${count})</small></span>
    </div>`;
}

function renderFilteredFiles() {
  const container = $('filteredList');
  if (!scanData) {
    container.innerHTML = '';
    return;
  }
  const q = ($('filterSearch').value || '').toLowerCase().trim();
  const minKB = Number($('filterMin').value) || 0;
  const cat = $('filterCategory').value;
  const files = scanData.files.filter((f) => {
    if (q && !f.name.toLowerCase().includes(q)) return false;
    if (minKB > 0 && f.size < minKB * 1024) return false;
    if (cat && f.category !== cat) return false;
    return true;
  }).slice(0, 500);
  container.innerHTML = `<h4>Archivos filtrados (${files.length}${scanData.files.length > 500 ? ' de ' + scanData.files.length : ''}):</h4>` +
    (files.length === 0
      ? '<p class="hint">Sin coincidencias.</p>'
      : files.map((f) => `
        <div class="file-item">
          <span class="file-cat">${escapeHtml(f.category)}</span>
          <span class="file-name">${escapeHtml(f.name)}</span>
          <span class="file-size">${formatBytes(f.size)}</span>
          <button class="link-btn" data-path="${escapeHtml(f.path)}">Abrir ubicacion</button>
        </div>`).join(''));
  container.querySelectorAll('.link-btn').forEach((btn) => {
    btn.addEventListener('click', () => sfoApi.openInExplorer(btn.dataset.path));
  });
}

$('filterSearch').addEventListener('input', renderFilteredFiles);
$('filterMin').addEventListener('input', renderFilteredFiles);
$('filterCategory').addEventListener('change', renderFilteredFiles);

/* ---------- Informes ---------- */
function exportReport(format) {
  return async () => {
    if (!scanData) {
      showToast('Primero analiza carpetas.');
      return;
    }
    const result = await sfoApi.exportReport({ scanData, format, actions: sessionActions });
    if (result.canceled) return;
    const container = $('reportResult');
    container.classList.remove('hidden');
    if (result.success) {
      container.innerHTML = `<div>Informe guardado: <strong>${escapeHtml(result.filePath)}</strong></div>`;
      addHistory(`Informe ${format.toUpperCase()} exportado: ${result.filePath}`);
      sessionActions.push({ date: Date.now(), type: 'report', label: `Exportar informe ${format.toUpperCase()}`, detail: result.filePath });
    } else {
      container.innerHTML = '<div>No se pudo guardar el informe.</div>';
    }
  };
}

$('exportCsvBtn').addEventListener('click', exportReport('csv'));
$('exportHtmlBtn').addEventListener('click', exportReport('html'));

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $(`${tab.dataset.tab}Tab`).classList.add('active');
  });
});

/* ---------- Re-escaneo ---------- */
async function rescan() {
  if (!scanData) return;
  $('progressWrap').classList.remove('hidden');
  $('progressBar').style.width = '0%';
  $('progressText').textContent = 'Re-escaneando...';
  try {
    scanData = await sfoApi.scanFolders({ folders: scanData.folders, customRules });
    renderResults(scanData);
    showToast('Datos actualizados.');
  } catch (err) {
    showToast('Error al re-analizar: ' + err.message);
  } finally {
    $('progressWrap').classList.add('hidden');
  }
}

/* ---------- Init ---------- */
initTheme();
renderFolderQueue();
renderHistory();
loadRules();

if (location.search.includes('e2e')) {
  window.__sfo = {
    setScanData: (d) => { scanData = d; },
    renderResults,
    renderFiltered: renderFilteredFiles,
    getScanData: () => scanData
  };
}