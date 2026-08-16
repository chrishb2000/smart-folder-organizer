const fs = require('fs');
const path = require('path');
const exifParser = require('exif-parser');
const { decodeImage } = require('./imghash');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);

function extractMetadata(filePath) {
  const meta = { path: filePath, ext: path.extname(filePath).toLowerCase() };
  try {
    if (meta.ext === '.jpg' || meta.ext === '.jpeg') {
      const buf = fs.readFileSync(filePath);
      let parser = null;
      try {
        parser = exifParser.create(buf).parse();
      } catch (e) {
        parser = null;
      }
      if (parser && parser.tags) {
        const t = parser.tags;
        if (t.ImageWidth) meta.width = t.ImageWidth;
        if (t.ImageHeight) meta.height = t.ImageHeight;
        if (t.DateTimeOriginal) meta.dateTaken = t.DateTimeOriginal;
        if (t.ModifyDate) meta.dateModifiedExif = t.ModifyDate;
        if (t.Make) meta.cameraMake = t.Make;
        if (t.Model) meta.cameraModel = t.Model;
        if (t.FNumber) meta.aperture = t.FNumber;
        if (t.ExposureTime) meta.exposure = t.ExposureTime;
        if (t.ISO && t.ISO.length) meta.iso = t.ISO[0];
        if (typeof t.FocalLengthIn35mmFilm === 'number') meta.focal35 = t.FocalLengthIn35mmFilm;
      }
      if (!meta.width || !meta.height) {
        try {
          const img = decodeImage(filePath);
          if (img) {
            meta.width = img.width;
            meta.height = img.height;
          }
        } catch (e) { /* ignore */ }
      }
    } else if (meta.ext === '.png' || meta.ext === '.gif' || meta.ext === '.bmp') {
      try {
        const img = decodeImage(filePath);
        if (img) {
          meta.width = img.width;
          meta.height = img.height;
        }
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
  return meta;
}

function isImageExt(ext) {
  return IMAGE_EXTS.has(ext.toLowerCase());
}

module.exports = {
  isImageExt,
  extractMetadata
};