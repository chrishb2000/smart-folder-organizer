const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(width, height, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let off = 0;
  for (let y = 0; y < height; y++) {
    raw[off++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw[off++] = r;
      raw[off++] = g;
      raw[off++] = b;
      raw[off++] = a;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function gradientPng(width, height, r, g, b) {
  return makePng(width, height, (x, y) => [Math.round((x / Math.max(width - 1, 1)) * r), Math.round((y / Math.max(height - 1, 1)) * g), Math.round(((x + y) / Math.max(width + height - 2, 1)) * b), 255]);
}

function checkerPng(width, height, size) {
  return makePng(width, height, (x, y) => {
    const on = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
    return on ? [0, 0, 0, 255] : [255, 255, 255, 255];
  });
}

const JPEG_1X1 = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');

function makeJpeg(width, height, pixelFn) {
  return JPEG_1X1;
}

function writeFiles(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, buf] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), buf);
  }
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = {
  makePng,
  gradientPng,
  checkerPng,
  makeJpeg,
  JPEG_1X1,
  writeFiles,
  cleanDir
};