const path = require('path');

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function topFolders(files, limit) {
  const map = new Map();
  for (const f of files) {
    const dir = path.dirname(f.path);
    if (!map.has(dir)) map.set(dir, { folder: dir, count: 0, size: 0 });
    const e = map.get(dir);
    e.count++;
    e.size += f.size;
  }
  return [...map.values()].sort((a, b) => b.size - a.size).slice(0, limit || 10);
}

function topExtensions(files, limit) {
  const map = new Map();
  for (const f of files) {
    const ext = f.ext || path.extname(f.path).toLowerCase() || '(sin ext)';
    if (!map.has(ext)) map.set(ext, { ext, count: 0, size: 0 });
    const e = map.get(ext);
    e.count++;
    e.size += f.size;
  }
  return [...map.values()].sort((a, b) => b.size - a.size).slice(0, limit || 8);
}

function dateHistogram(files) {
  const map = new Map();
  for (const f of files) {
    const d = new Date(f.modified || f.mtimeMs || Date.now());
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, { month: key, count: 0, size: 0 });
    const e = map.get(key);
    e.count++;
    e.size += f.size;
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}

function sizeBuckets(files) {
  const buckets = [
    { label: '< 100 KB', min: 0, max: 100 * 1024 },
    { label: '100 KB - 1 MB', min: 100 * 1024, max: 1024 * 1024 },
    { label: '1 MB - 10 MB', min: 1024 * 1024, max: 10 * 1024 * 1024 },
    { label: '10 MB - 100 MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
    { label: '> 100 MB', min: 100 * 1024 * 1024, max: Infinity }
  ];
  const out = buckets.map((b) => ({ label: b.label, count: 0, size: 0 }));
  for (const f of files) {
    const idx = out.findIndex((b, i) => f.size >= buckets[i].min && f.size < buckets[i].max);
    if (idx !== -1) {
      out[idx].count++;
      out[idx].size += f.size;
    }
  }
  return out;
}

function computeDashboard(result) {
  const files = result.files || [];
  return {
    totalFiles: result.totalFiles || files.length,
    totalSize: result.totalSize || 0,
    totalFolders: result.totalFolders || 0,
    topFolders: topFolders(files, 10),
    topExtensions: topExtensions(files, 8),
    dateHistogram: dateHistogram(files),
    sizeBuckets: sizeBuckets(files),
    categories: result.categories || [],
    duplicateWasted: result.duplicateWasted || 0,
    emptyCount: (result.emptyFolders || []).length,
    tempCount: (result.tempFiles || []).length
  };
}

module.exports = {
  formatBytes,
  topFolders,
  topExtensions,
  dateHistogram,
  sizeBuckets,
  computeDashboard
};