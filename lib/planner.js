const path = require('path');
const fs = require('fs');
const { getCategory } = require('./scanner');

function extractDateFromName(name) {
  const m = name.match(/(20\d{2})[-._]?(\d{2})[-._]?(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
    return { y, mo, d };
  }
  return null;
}

function formatDateKey(y, mo, d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function buildOrganizePlan(folderPath, includeCategories, opts) {
  const options = opts || {};
  const organizeByDate = !!options.organizeByDate;
  const autoRename = !!options.autoRename;
  const customRules = options.customRules || null;
  const plan = [];

  let entries = [];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (e) {
    return { success: false, error: 'No se pudo leer la carpeta: ' + folderPath };
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(folderPath, entry.name);
    let stat = null;
    try {
      stat = fs.statSync(full);
    } catch (e) {
      continue;
    }
    const category = getCategory(full, customRules);
    if (!includeCategories.includes(category)) continue;

    let rel = category;
    if (organizeByDate) {
      const dt = new Date(stat.mtimeMs);
      rel = path.join(category, String(dt.getFullYear()), String(dt.getMonth() + 1).padStart(2, '0'));
    }

    let targetName = entry.name;
    if (autoRename) {
      const date = extractDateFromName(entry.name);
      if (date) {
        const ext = path.extname(entry.name);
        const base = path.basename(entry.name, ext);
        targetName = `${formatDateKey(date.y, date.mo, date.d)}_${base}${ext}`;
      }
    }

    const targetDir = path.join(folderPath, rel);
    plan.push({
      source: full,
      target: path.join(targetDir, targetName),
      category,
      rel
    });
  }

  return { success: true, plan };
}

module.exports = {
  extractDateFromName,
  formatDateKey,
  buildOrganizePlan
};