const api = window.api;

const CATEGORY_ORDER = ['Imagenes', 'Videos', 'Audios', 'Documentos', 'Instaladores', 'Comprimidos', 'Codigo', 'Otros'];

let scanData = null;
let currentPlan = null;
let historyEntries = [];

const $ = (id) => document.getElementById(id);

/* ---------- Theme ---------- */
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
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
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

/* ---------- Utilities ---------- */
function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return 'N/A';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function addHistory(entry) {
  const time = new Date().toLocaleTimeString();
  historyEntries.unshift({ time, text: entry });
  renderHistory();
}

function renderHistory() {
  const log = $('historyLog');
  log.innerHTML = historyEntries.map((e) =>
    `<div class="log-entry"><span class="log-time">[${e.time}]</span> ${escapeHtml(e.text)}</div>`
  ).join('') || '<div class="log-entry">Sin acciones registradas.</div>';
}

$('clearHistoryBtn').addEventListener('click', () => {
  historyEntries = [];
  renderHistory();
});

/* ---------- Folder selection ---------- */
$('selectFolderBtn').addEventListener('click', async () => {
  const folder = await api.selectFolder();
  if (!folder) return;
  $('selectedFolder').textContent = `Analizando: ${folder}`;
  $('selectedFolder').classList.remove('hidden');
  $('statsView').classList.add('hidden');
  $('progressWrap').classList.remove('hidden');
  $('progressBar').style.width = '0%';
  $('progressText').textContent = 'Escaneando...';
  addHistory(`Analisis iniciado de: ${folder}`);

  try {
    scanData = await api.scanFolder(folder);
    renderResults(scanData);
    $('selectedFolder').textContent = `Carpeta analizada: ${folder}`;
    $('statsView').classList.remove('hidden');
    showToast('Analisis completado correctamente.');
    addHistory(`Analisis completado: ${scanData.totalFiles} archivos en ${formatBytes(scanData.totalSize)}`);
  } catch (err) {
    showToast('Error al analizar la carpeta: ' + err.message);
    addHistory(`Error de analisis: ${err.message}`);
  } finally {
    $('progressWrap').classList.add('hidden');
  }
});

api.onScanProgress(({ scanned, current }) => {
  $('progressText').textContent = `Escaneando: ${scanned} archivos - ${current || ''}`;
});

/* ---------- Results rendering ---------- */
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

  $('homeView').classList.remove('active');
  $('resultsView').classList.add('active');
}

/* ---------- Organize tab ---------- */
function renderCategories(categories) {
  const grid = $('categoryCheckboxes');
  const ordered = CATEGORY_ORDER.map((name) =>
    categories.find((c) => c.name === name)
  ).filter(Boolean);

  grid.innerHTML = ordered.map((c) => `
    <label>
      <input type="checkbox" class="cat-check" value="${escapeHtml(c.name)}" checked />
      <span>${escapeHtml(c.name)} <small>(${c.count} / ${formatBytes(c.size)})</small></span>
    </label>
  `).join('');

  if (ordered.length === 0) {
    grid.innerHTML = '<p class="hint">No se encontraron archivos para organizar en la raiz de la carpeta.</p>';
  }
}

$('previewPlanBtn').addEventListener('click', async () => {
  if (!scanData) return;
  const selected = Array.from(document.querySelectorAll('.cat-check:checked')).map((el) => el.value);
  const result = await api.buildOrganizePlan({
    folderPath: scanData.folder,
    includeCategories: selected
  });
  const preview = $('planPreview');
  if (!result.success || result.plan.length === 0) {
    preview.innerHTML = '<h4>Vista previa</h4><p class="hint">No hay archivos que mover con las categorias seleccionadas.</p>';
    preview.classList.remove('hidden');
    $('applyPlanBtn').disabled = true;
    currentPlan = null;
    return;
  }
  preview.innerHTML =
    `<h4>Se moveran ${result.plan.length} archivos:</h4>` +
    result.plan.slice(0, 120).map((item) =>
      `<div class="plan-item">${escapeHtml(item.source.split(/[\\/]/).pop())} &rarr; ${escapeHtml(item.category)}/</div>`
    ).join('') +
    (result.plan.length > 120 ? `<div class="plan-item">... y ${result.plan.length - 120} mas.</div>` : '');
  preview.classList.remove('hidden');
  currentPlan = result.plan;
  $('applyPlanBtn').disabled = false;
});

$('applyPlanBtn').addEventListener('click', async () => {
  if (!currentPlan || !scanData) return;
  const ok = await askConfirm(
    'Aplicar organizacion',
    `Se moveran <strong>${currentPlan.length}</strong> archivos a subcarpetas por categoria dentro de ${escapeHtml(scanData.folder)}. Continuar?`
  );
  if (!ok) return;
  const result = await api.applyOrganizePlan({ folderPath: scanData.folder, plan: currentPlan });
  result.log.forEach((l) => addHistory(l));
  showToast(`Organizacion aplicada: ${result.moved} movidos, ${result.failed} con error.`);
  addHistory(`Organizacion: ${result.moved} archivos movidos, ${result.failed} errores.`);
  $('applyPlanBtn').disabled = true;
  currentPlan = null;
  $('planPreview').classList.add('hidden');
  rescan();
});

/* ---------- Duplicates tab ---------- */
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
            <span>${escapeHtml(f.name)}</span>
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
      const ok = await askConfirm(
        'Eliminar duplicados',
        `Se eliminaran <strong>${toDelete.length}</strong> copias duplicadas (se conserva la primera). Espacio a liberar: <strong>${formatBytes(group.size * toDelete.length)}</strong>.`
      );
      if (!ok) return;
      const result = await api.deleteDuplicates({ files: toDelete });
      result.log.forEach((l) => addHistory(l));
      showToast(`Duplicados eliminados: ${result.deleted}`);
      addHistory(`Duplicados: ${result.deleted} copias eliminadas (${formatBytes(group.size * result.deleted)})`);
      rescan();
    });
  });
}

/* ---------- Large files tab ---------- */
function renderLargeFiles(files) {
  const container = $('largeList');
  if (!files || files.length === 0) {
    container.innerHTML = '<p class="hint">No hay archivos para mostrar.</p>';
    return;
  }
  container.innerHTML = files.map((f) => `
    <div class="file-item">
      <span class="file-cat">${escapeHtml(f.category)}</span>
      <span class="file-name">${escapeHtml(f.name)}</span>
      <span class="file-size">${formatBytes(f.size)}</span>
      <button class="link-btn" data-path="${escapeHtml(f.path)}">Abrir ubicacion</button>
    </div>
  `).join('');

  container.querySelectorAll('.link-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      api.openInExplorer(btn.dataset.path);
    });
  });
}

/* ---------- Clean tab ---------- */
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
    `Se eliminaran <strong>${cleanData.emptyFolders.length}</strong> carpetas vacias dentro de la carpeta analizada.`
  );
  if (!ok) return;
  const result = await api.deleteEmptyFolders({ folderPath: scanData.folder });
  result.log.forEach((l) => addHistory(l));
  showToast(`Carpetas vacias eliminadas: ${result.deleted}`);
  addHistory(`Limpieza: ${result.deleted} carpetas vacias eliminadas.`);
  rescan();
});

$('cleanTempBtn').addEventListener('click', async () => {
  if (!scanData || cleanData.tempFiles.length === 0) {
    showToast('No hay archivos temporales que eliminar.');
    return;
  }
  const size = cleanData.tempFiles.reduce((s, f) => s + f.size, 0);
  const ok = await askConfirm(
    'Eliminar archivos temporales',
    `Se eliminaran <strong>${cleanData.tempFiles.length}</strong> archivos temporales (${formatBytes(size)}). Esta accion no se puede deshacer.`
  );
  if (!ok) return;
  const result = await api.deleteTempFiles({ files: cleanData.tempFiles.map((f) => f.path) });
  result.log.forEach((l) => addHistory(l));
  showToast(`Temporales eliminados: ${result.deleted}`);
  addHistory(`Limpieza: ${result.deleted} archivos temporales eliminados (${formatBytes(size)})`);
  rescan();
});

/* ---------- Tabs navigation ---------- */
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $(`${tab.dataset.tab}Tab`).classList.add('active');
  });
});

/* ---------- Rescan ---------- */
async function rescan() {
  if (!scanData) return;
  $('progressWrap').classList.remove('hidden');
  $('progressBar').style.width = '0%';
  $('progressText').textContent = 'Re-escaneando...';
  try {
    scanData = await api.scanFolder(scanData.folder);
    renderResults(scanData);
    showToast('Datos actualizados.');
  } catch (err) {
    showToast('Error al re-analizar: ' + err.message);
  } finally {
    $('progressWrap').classList.add('hidden');
  }
}

initTheme();
renderHistory();