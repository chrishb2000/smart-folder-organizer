const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pngPath = path.join(__dirname, '..', 'build', 'icon.png');
const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');

const png = fs.readFileSync(pngPath);

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

function encodePng(width, height, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let off = 0;
  for (let y = 0; y < height; y++) {
    raw[off++] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw[off++] = r; raw[off++] = g; raw[off++] = b; raw[off++] = a;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// read source png pixels
function readPng(pngBuf) {
  // parse IDAT
  let pos = 8;
  let idatParts = [];
  let width = 0, height = 0;
  while (pos < pngBuf.length) {
    const len = pngBuf.readUInt32BE(pos);
    const type = pngBuf.toString('ascii', pos + 4, pos + 8);
    const data = pngBuf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatParts.push(data);
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * 4 + 1;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const prev = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    const filter = raw[rowStart];
    const cur = new Uint8Array(width * 4);
    for (let i = 0; i < width * 4; i++) {
      const x = raw[rowStart + 1 + i];
      const a = i >= 4 ? cur[i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      let v = x;
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += a + b - c;
      cur[i] = v & 0xff;
    }
    for (let i = 0; i < width * 4; i++) {
      pixels[y * width * 4 + i] = cur[i];
      prev[i] = cur[i];
    }
  }
  return { width, height, pixels };
}

const { width, height, pixels } = readPng(png);

// produce 256, 128, 64, 48, 32, 16 sizes
const sizes = [256, 128, 64, 48, 32, 16];
const images = sizes.map((size) => {
  const enc = encodePng(size, size, (x, y) => {
    const sx = Math.floor((x * width) / size);
    const sy = Math.floor((y * height) / size);
    const i = (sy * width + sx) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
  });
  return { size, png: enc };
});

const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(images.length, 4);

const entries = [];
let offset = 6 + images.length * 16;
for (const img of images) {
  const entry = Buffer.alloc(16);
  entry[0] = img.size >= 256 ? 0 : img.size;
  entry[1] = img.size >= 256 ? 0 : img.size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);   // planes
  entry.writeUInt16LE(32, 6);  // bpp
  entry.writeUInt32LE(img.png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += img.png.length;
  entries.push(entry);
}

const ico = Buffer.concat([icoHeader, ...entries, ...images.map((i) => i.png)]);
fs.writeFileSync(icoPath, ico);
console.log('icon.ico created: ' + icoPath + ' (' + ico.length + ' bytes, ' + images.length + ' sizes)');