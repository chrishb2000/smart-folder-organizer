const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

const POPCOUNT = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = 0;
    let n = i;
    while (n) {
      c += n & 1;
      n >>= 1;
    }
    table[i] = c;
  }
  return table;
})();

function decodeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  if (ext === '.jpg' || ext === '.jpeg') {
    const img = jpeg.decode(data, { useTArray: true, maxMemoryUsageInMB: 512, formatAsRGBA: true });
    return { width: img.width, height: img.height, data: img.data };
  }
  if (ext === '.png') {
    const png = PNG.sync.read(data);
    return { width: png.width, height: png.height, data: png.data };
  }
  return null;
}

function grayscaleResizeTo9x8(img) {
  const w = img.width;
  const h = img.height;
  const outW = 9;
  const outH = 8;
  const out = new Float64Array(outW * outH);
  for (let y = 0; y < outH; y++) {
    const sy0 = Math.floor((y * h) / outH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * h) / outH));
    for (let x = 0; x < outW; x++) {
      const sx0 = Math.floor((x * w) / outW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * w) / outW));
      let sum = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * w + sx) * 4;
          sum += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
          count++;
        }
      }
      out[y * outW + x] = sum / Math.max(count, 1);
    }
  }
  return out;
}

function dHashFromGrayscale(gray) {
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = gray[y * 9 + x];
      const right = gray[y * 9 + x + 1];
      bits = (bits << 1n) | (left >= right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

function computeDHash(filePath) {
  try {
    const img = decodeImage(filePath);
    if (!img) return null;
    const gray = grayscaleResizeTo9x8(img);
    return { hash: dHashFromGrayscale(gray), width: img.width, height: img.height };
  } catch (e) {
    return null;
  }
}

function hammingDistance(a, b) {
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    const ca = parseInt(a[i], 16);
    const cb = parseInt(b[i], 16);
    dist += POPCOUNT[ca ^ cb];
  }
  return dist;
}

function findSimilarGroups(files, opts) {
  const options = opts || {};
  const threshold = typeof options.threshold === 'number' ? options.threshold : 7;
  const maxFiles = options.maxFiles || 0;
  const entries = [];
  let processed = 0;
  for (const f of files) {
    const decoded = computeDHash(f.path);
    if (!decoded) continue;
    entries.push({ file: f, hash: decoded.hash, width: decoded.width, height: decoded.height });
    processed++;
    if (maxFiles > 0 && processed >= maxFiles) break;
    if (options.onProgress) options.onProgress(processed, files.length);
  }
  const groups = [];
  const used = new Array(entries.length).fill(false);
  for (let i = 0; i < entries.length; i++) {
    if (used[i]) continue;
    const group = { hash: entries[i].hash, files: [entries[i].file], reps: [entries[i]] };
    used[i] = true;
    for (let j = i + 1; j < entries.length; j++) {
      if (used[j]) continue;
      if (hammingDistance(entries[i].hash, entries[j].hash) <= threshold) {
        group.files.push(entries[j].file);
        group.reps.push(entries[j]);
        used[j] = true;
      }
    }
    if (group.files.length > 1) {
      group.reps.sort((a, b) => (a.width * a.height) - (b.width * b.height));
      group.hash = group.reps[0].hash;
      groups.push(group);
    }
  }
  return groups;
}

module.exports = {
  decodeImage,
  computeDHash,
  hammingDistance,
  findSimilarGroups
};