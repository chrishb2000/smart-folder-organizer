const fs = require('fs');
const path = require('path');

const HEAD_SIZE = 8192;
const TAIL_SIZE = 65536;

function readHead(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(HEAD_SIZE);
    const n = fs.readSync(fd, buf, 0, HEAD_SIZE, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

function readHeadTail(filePath) {
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(Math.min(HEAD_SIZE, stat.size));
    fs.readSync(fd, head, 0, head.length, 0);
    let tail = head;
    if (stat.size > HEAD_SIZE) {
      const tailLen = Math.min(TAIL_SIZE, stat.size);
      tail = Buffer.alloc(tailLen);
      fs.readSync(fd, tail, 0, tailLen, stat.size - tailLen);
    }
    return { head, tail, size: stat.size };
  } finally {
    fs.closeSync(fd);
  }
}

function detectType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (buffer.subarray(0, 2).toString('latin1') === 'BM') return 'bmp';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WAVE') return 'wav';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'AVI ') return 'avi';
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer.subarray(0, 4).toString('latin1') === 'PK\x03\x04') return 'zip';
  if (buffer.subarray(0, 4).toString('latin1') === 'PK\x05\x06') return 'zip';
  if (buffer.subarray(0, 4).toString('latin1') === 'PK\x07\x08') return 'zip';
  if (buffer.subarray(0, 4).toString('latin1') === 'Rar!') return 'rar';
  if (buffer.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))) return '7z';
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) return 'gz';
  if (buffer.subarray(0, 3).toString('latin1') === 'BZh') return 'bz2';
  if (buffer.subarray(0, 2).toString('latin1') === 'MZ') return 'exe';
  if (buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'ole2';
  if (buffer.subarray(0, 4).toString('latin1') === 'fLaC') return 'flac';
  if (buffer.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg';
  if (buffer.subarray(0, 4).toString('latin1') === 'ID3') return 'mp3';
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3';
  if (buffer.subarray(0, 7).toString('latin1') === 'SQLite') return 'sqlite';
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') return 'mp4';
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'mkv';
  if (buffer.subarray(0, 4).toString('latin1') === 'FLV\x01' || buffer.subarray(0, 4).toString('latin1') === 'FLV\x04') return 'flv';
  return null;
}

const EXT_TO_MAGIC = {
  '.png': ['png'],
  '.jpg': ['jpeg'],
  '.jpeg': ['jpeg'],
  '.gif': ['gif'],
  '.bmp': ['bmp'],
  '.webp': ['webp'],
  '.wav': ['wav'],
  '.avi': ['avi'],
  '.pdf': ['pdf'],
  '.zip': ['zip'],
  '.rar': ['rar'],
  '.7z': ['7z'],
  '.gz': ['gz'],
  '.tgz': ['gz'],
  '.bz2': ['bz2'],
  '.exe': ['exe'],
  '.dll': ['exe'],
  '.msi': ['ole2'],
  '.doc': ['ole2'],
  '.xls': ['ole2'],
  '.ppt': ['ole2'],
  '.docx': ['zip'],
  '.xlsx': ['zip'],
  '.pptx': ['zip'],
  '.jar': ['zip'],
  '.apk': ['zip'],
  '.flac': ['flac'],
  '.ogg': ['ogg'],
  '.mp3': ['mp3'],
  '.mp4': ['mp4'],
  '.m4v': ['mp4'],
  '.mov': ['mp4'],
  '.mkv': ['mkv'],
  '.webm': ['mkv'],
  '.flv': ['flv'],
  '.sqlite': ['sqlite'],
  '.db': ['sqlite', 'ole2']
};

function extensionMatchesContent(ext, buffer) {
  const allowed = EXT_TO_MAGIC[ext];
  if (!allowed) return true;
  const type = detectType(buffer);
  if (!type) return true;
  return allowed.includes(type);
}

function checkWrongExtension(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (!EXT_TO_MAGIC[ext]) return false;
    const { head } = readHeadTail(filePath);
    const type = detectType(head);
    if (!type) return false;
    return !EXT_TO_MAGIC[ext].includes(type);
  } catch (e) {
    return false;
  }
}

function checkBrokenFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const { head, tail, size } = readHeadTail(filePath);
    const type = detectType(head);
    const broken = { broken: false, reason: null };
    if (type === 'png' && ext !== '.png') {
      const e = detectType(head);
      if (e !== 'png') return broken;
    }
    switch (type) {
      case 'png': {
        if (size < 20) { broken.broken = true; broken.reason = 'PNG sin datos suficientes'; return broken; }
        const iend = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
        const endOk = tail.length >= 8 && tail.subarray(tail.length - 8).equals(iend);
        if (!endOk) { broken.broken = true; broken.reason = 'PNG truncado (sin bloque IEND)'; }
        return broken;
      }
      case 'jpeg': {
        if (size < 4) { broken.broken = true; broken.reason = 'JPEG sin datos suficientes'; return broken; }
        const endOk = tail.length >= 2 && tail[tail.length - 2] === 0xff && tail[tail.length - 1] === 0xd9;
        if (!endOk) { broken.broken = true; broken.reason = 'JPEG truncado (sin marcador EOI)'; }
        return broken;
      }
      case 'pdf': {
        const window = Buffer.concat([head, tail]);
        const hasEof = window.includes(Buffer.from('%%EOF')) || window.includes(Buffer.from('%EOF'));
        if (!hasEof) { broken.broken = true; broken.reason = 'PDF corrupto (sin marcador %%EOF)'; }
        return broken;
      }
      case 'gif': {
        if (!tail.length || tail[tail.length - 1] !== 0x3b) { broken.broken = true; broken.reason = 'GIF truncado (sin terminador)'; }
        return broken;
      }
      default:
        return broken;
    }
  } catch (e) {
    return { broken: false, reason: null };
  }
}

module.exports = {
  detectType,
  extensionMatchesContent,
  checkWrongExtension,
  checkBrokenFile
};