const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_CATEGORY_RULES = [
  { name: 'Imagenes', exts: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.heic', '.tiff', '.raw', '.psd', '.ai'] },
  { name: 'Videos', exts: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.ts', '.mpeg'] },
  { name: 'Audios', exts: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus', '.mid', '.amr'] },
  { name: 'Documentos', exts: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv', '.rtf', '.odt', '.ods', '.odp'] },
  { name: 'Instaladores', exts: ['.exe', '.msi', '.dmg', '.deb', '.apk', '.appimage', '.pkg', '.jar'] },
  { name: 'Comprimidos', exts: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.iso', '.tgz'] },
  { name: 'Codigo', exts: ['.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.html', '.css', '.json', '.xml', '.sql', '.sh', '.bat', '.php', '.rb', '.go', '.rs'] }
];

const TEMP_EXTS = ['.tmp', '.temp', '.bak', '.old', '.log', '.dmp', '.crdownload', '.part', '.swp'];

function getCategory(filePath, customRules) {
  const ext = path.extname(filePath).toLowerCase();
  if (customRules && customRules.length > 0) {
    for (const rule of customRules) {
      if (rule.exts.includes(ext)) return rule.folder;
    }
  }
  const rule = DEFAULT_CATEGORY_RULES.find((r) => r.exts.includes(ext));
  return rule ? rule.name : 'Otros';
}

function isHiddenEntry(name) {
  return name.startsWith('.') && name !== '.' && name !== '..';
}

function getDirSize(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += getDirSize(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* ignore */ }
  return total;
}

function scanFolderSync(rootPath, customRules, onProgress) {
  const result = {
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
    files: [],
    emptyFolders: [],
    tempFiles: []
  };
  const allFiles = [];

  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    let hasContent = false;
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (isHiddenEntry(entry.name)) continue;
      if (entry.isDirectory()) {
        result.totalFolders++;
        const subSize = walk(full);
        if (subSize === 0) {
          result.emptyFolders.push(full);
        }
        hasContent = true;
      } else if (entry.isFile()) {
        let stat = null;
        try {
          stat = fs.statSync(full);
        } catch (e) {
          continue;
        }
        hasContent = true;
        result.totalFiles++;
        result.totalSize += stat.size;
        const category = getCategory(full, customRules);
        const ext = path.extname(full).toLowerCase();
        const fileInfo = {
          name: entry.name,
          path: full,
          size: stat.size,
          ext,
          category,
          modified: stat.mtimeMs,
          isTemp: TEMP_EXTS.includes(ext)
        };
        allFiles.push(fileInfo);
        if (fileInfo.isTemp) result.tempFiles.push(fileInfo);
        if (onProgress) onProgress(result.totalFiles, full);
      }
    }
    if (!hasContent) return 0;
    try {
      return getDirSize(dir);
    } catch (e) {
      return 0;
    }
  }

  walk(rootPath);
  result.files = allFiles;
  return result;
}

function buildCategories(files) {
  const map = {};
  for (const f of files) {
    if (!map[f.category]) {
      map[f.category] = { name: f.category, count: 0, size: 0, exts: [] };
    }
    map[f.category].count++;
    map[f.category].size += f.size;
    if (!map[f.category].exts.includes(f.ext)) map[f.category].exts.push(f.ext);
  }
  return Object.values(map).sort((a, b) => b.size - a.size);
}

function hashFile(filePath) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', () => resolve(null));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function findDuplicates(files, onProgress) {
  const bySize = {};
  for (const f of files) {
    if (f.size === 0) continue;
    if (!bySize[f.size]) bySize[f.size] = [];
    bySize[f.size].push(f);
  }
  const groups = [];
  const candidates = Object.values(bySize).filter((list) => list.length > 1);
  let done = 0;
  for (const list of candidates) {
    for (const f of list) {
      if (onProgress) onProgress(++done, candidates.length);
      const h = await hashFile(f.path);
      if (!h) continue;
      if (!f._hash) f._hash = h;
    }
    const byHash = {};
    for (const f of list) {
      if (!byHash[f._hash]) byHash[f._hash] = [];
      byHash[f._hash].push(f);
    }
    for (const h in byHash) {
      if (byHash[h].length > 1) {
        groups.push({ hash: h, size: list[0].size, files: byHash[h] });
      }
    }
  }
  return groups;
}

module.exports = {
  DEFAULT_CATEGORY_RULES,
  TEMP_EXTS,
  getCategory,
  scanFolderSync,
  buildCategories,
  findDuplicates,
  hashFile,
  getDirSize
};