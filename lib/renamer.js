const fs = require('fs');
const path = require('path');

const DATE_IN_NAME = /(20\d{2})[-._]?(\d{2})[-._]?(\d{2})/;

function isValidDate(y, mo, d) {
  return y >= 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

function extractDateFromName(name) {
  const m = name.match(DATE_IN_NAME);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidDate(y, mo, d)) return null;
  return { y, mo, d };
}

function formatDate(y, mo, d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function buildTokenValues(fileInfo) {
  const ext = path.extname(fileInfo.name).toLowerCase();
  const base = path.basename(fileInfo.name, ext);
  const date = extractDateFromName(fileInfo.name);
  const parent = path.basename(path.dirname(fileInfo.path));
  const stats = fileInfo.stat || {};
  const mtime = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();
  const size = stats.size || 0;
  return {
    name: base,
    ext,
    full: fileInfo.name,
    parent,
    date: date ? formatDate(date.y, date.mo, date.d) : '',
    dateYear: date ? String(date.y) : '',
    dateMonth: date ? String(date.mo).padStart(2, '0') : '',
    dateDay: date ? String(date.d).padStart(2, '0') : '',
    mtime: `${mtime.getFullYear()}-${String(mtime.getMonth() + 1).padStart(2, '0')}-${String(mtime.getDate()).padStart(2, '0')}`,
    size: String(size),
    sizeKB: String(Math.max(1, Math.round(size / 1024)))
  };
}

function cleanBaseName(name) {
  return name.replace(/^(20\d{2})[-._]?(\d{2})[-._]?(\d{2})[-._]?\s*/, '');
}

function applyTokens(pattern, values, seq, seqZero) {
  const cleanName = cleanBaseName(values.name);
  let out = pattern
    .replace(/\{nombre\}/gi, values.name)
    .replace(/\{nombre_limpio\}/gi, cleanName)
    .replace(/\{extension\}/gi, values.ext)
    .replace(/\{archivo\}/gi, values.full)
    .replace(/\{carpeta\}/gi, values.parent)
    .replace(/\{fecha\}/gi, values.date || values.mtime)
    .replace(/\{anio\}/gi, values.dateYear || String(values.mtime.split('-')[0]))
    .replace(/\{mes\}/gi, values.dateMonth || values.mtime.split('-')[1])
    .replace(/\{dia\}/gi, values.dateDay || values.mtime.split('-')[2])
    .replace(/\{mtime\}/gi, values.mtime)
    .replace(/\{tamano\}/gi, values.size)
    .replace(/\{kb\}/gi, values.sizeKB);
  if (/\{sec\}/i.test(out)) out = out.replace(/\{sec\}/gi, String(seq));
  if (/\{sec2\}/i.test(out)) out = out.replace(/\{sec2\}/gi, String(seq).padStart(3, '0'));
  return out;
}

function sanitizeFileName(name) {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().replace(/[. ]+$/, '');
  return cleaned || 'archivo';
}

function buildRenamePlan(files, pattern, opts) {
  const options = opts || {};
  const seqZero = options.seqZero !== false;
  const plan = [];
  const used = new Map();
  for (let i = 0; i < files.length; i++) {
    const fileInfo = files[i];
    const values = buildTokenValues(fileInfo);
    let base = applyTokens(pattern, values, i + 1, seqZero);
    base = sanitizeFileName(base);
    let finalName = base + values.ext;
    let candidate = finalName;
    let counter = 1;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}_${counter}${values.ext}`;
      counter++;
    }
    used.set(candidate.toLowerCase(), true);
    const target = path.join(path.dirname(fileInfo.path), candidate);
    plan.push({
      source: fileInfo.path,
      target,
      name: fileInfo.name,
      newName: candidate,
      skipped: fileInfo.name === candidate
    });
  }
  return plan;
}

function applyRenamePlan(plan, onItem) {
  const log = [];
  let renamed = 0;
  let failed = 0;
  for (const item of plan) {
    try {
      if (item.skipped || item.source === item.target) {
        log.push(`Sin cambios: ${item.name}`);
        continue;
      }
      if (!fs.existsSync(item.source)) {
        failed++;
        log.push(`No existe: ${item.source}`);
        continue;
      }
      if (fs.existsSync(item.target)) {
        const ext = path.extname(item.target);
        const base = path.basename(item.target, ext);
        item.target = path.join(path.dirname(item.target), `${base}_ren_${Date.now()}${ext}`);
      }
      fs.renameSync(item.source, item.target);
      renamed++;
      log.push(`Renombrado: ${item.name} -> ${path.basename(item.target)}`);
      if (onItem) onItem({ from: item.source, to: item.target, name: item.name, newName: path.basename(item.target) });
    } catch (e) {
      failed++;
      log.push(`Error: ${item.name} (${e.message})`);
    }
  }
  return { renamed, failed, log };
}

module.exports = {
  extractDateFromName,
  buildRenamePlan,
  applyRenamePlan,
  sanitizeFileName,
  applyTokens
};