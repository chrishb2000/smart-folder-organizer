const path = require('path');
const fs = require('fs');
const { formatBytes } = require('./stats');

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

function buildReport(result, opts) {
  const options = opts || {};
  const files = result.files || [];
  const rows = files.map((f) => ({
    nombre: f.name,
    ruta: f.path,
    carpeta: path.dirname(f.path),
    extension: f.ext || path.extname(f.name).toLowerCase(),
    categoria: f.category,
    tamano: f.size,
    modificado: f.modified ? new Date(f.modified).toISOString() : ''
  }));
  const csv = buildCsv(rows, ['nombre', 'ruta', 'carpeta', 'extension', 'categoria', 'tamano', 'modificado']);
  return { rows, csv };
}

function buildActionCsv(actions) {
  return buildCsv(
    actions.map((a) => ({
      fecha: a.date ? new Date(a.date).toISOString() : '',
      tipo: a.type,
      accion: a.label,
      detalle: a.detail || ''
    })),
    ['fecha', 'tipo', 'accion', 'detalle']
  );
}

function buildHtmlReport(result, extra) {
  const files = result.files || [];
  const rowsHtml = files
    .map((f) => `<tr><td>${escapeHtml(f.name)}</td><td>${escapeHtml(path.dirname(f.path))}</td><td>${escapeHtml(f.category)}</td><td>${formatBytes(f.size)}</td><td>${new Date(f.modified).toLocaleDateString()}</td></tr>`)
    .join('\n');
  const statsHtml = `
    <div class="stats">
      <div class="stat"><b>${files.length}</b><span>archivos</span></div>
      <div class="stat"><b>${formatBytes(result.totalSize || 0)}</b><span>tamano total</span></div>
      <div class="stat"><b>${(result.emptyFolders || []).length}</b><span>carpetas vacias</span></div>
      <div class="stat"><b>${(result.tempFiles || []).length}</b><span>temporales</span></div>
      <div class="stat"><b>${formatBytes(result.duplicateWasted || 0)}</b><span>duplicados</span></div>
    </div>`;
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Informe Smart Folder Organizer</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#1f2937;background:#f9fafb}
h1{font-size:20px;border-bottom:2px solid #4f8cff;padding-bottom:8px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.stat{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;min-width:120px}
.stat b{display:block;font-size:18px;color:#2563eb}
.stat span{font-size:12px;color:#6b7280}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}
th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}
th{background:#f3f4f6;position:sticky;top:0}
tr:nth-child(even){background:#f9fafb}
.footer{margin-top:16px;font-size:12px;color:#6b7280}
</style>
</head>
<body>
<h1>Informe de Analisis - Smart Folder Organizer</h1>
${extra ? `<p>${escapeHtml(extra)}</p>` : ''}
${statsHtml}
<table>
<thead><tr><th>Archivo</th><th>Carpeta</th><th>Categoria</th><th>Tamano</th><th>Modificado</th></tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
<div class="footer">Generado por Smart Folder Organizer - Christian Freelance (https://christian-freelance.us/)</div>
</body>
</html>`;
  return html;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function saveReport(rootFolder, filename, content) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  const safeName = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  const ext = path.extname(safeName) || '.txt';
  const base = safeName.endsWith(ext) ? path.basename(safeName, ext) : safeName;
  const file = path.join(rootFolder, `${base}_${stamp}${ext}`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

module.exports = {
  buildCsv,
  buildReport,
  buildActionCsv,
  buildHtmlReport,
  saveReport,
  formatBytes
};