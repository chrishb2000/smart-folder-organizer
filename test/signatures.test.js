const fs = require('fs');
const path = require('path');
const assert = require('assert');
const os = require('os');
const { gradientPng, makeJpeg, writeFiles, cleanDir } = require('./helpers');
const { detectType, checkWrongExtension, checkBrokenFile, extensionMatchesContent } = require('../lib/signatures');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfo-sig-'));

function run() {
  writeFiles(tmp, {
    'foto.png': gradientPng(32, 32, 255, 0, 0),
    'renombrado.png': Buffer.from('no soy una imagen', 'utf8'),
    'roto.png': gradientPng(32, 32, 0, 255, 0).subarray(0, 40),
    'foto.jpg': makeJpeg(),
    'roto.jpg': Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    'data.pdf': Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'utf8'),
    'roto.pdf': Buffer.from('%PDF-1.4\nesto es todo\n', 'utf8'),
    'zip.zzz': Buffer.from('PK\x03\x04', 'latin1'),
    'pdf.png': Buffer.from('%PDF-1.7\n%%EOF\n', 'utf8')
  });

  let t = 0;
  const check = (name, cond) => {
    t++;
    assert.ok(cond, `FALLO: ${name}`);
    console.log(`PASS: ${name}`);
  };

  check('detecta PNG', detectType(fs.readFileSync(path.join(tmp, 'foto.png'))) === 'png');
  check('detecta JPEG', detectType(fs.readFileSync(path.join(tmp, 'foto.jpg'))) === 'jpeg');
  check('detecta PDF', detectType(fs.readFileSync(path.join(tmp, 'data.pdf'))) === 'pdf');
  check('detecta ZIP', detectType(fs.readFileSync(path.join(tmp, 'zip.zzz'))) === 'zip');

  check('extension correcta pasa', checkWrongExtension(path.join(tmp, 'foto.png')) === false);
  check('extension incorrecta detectada (png con texto)', checkWrongExtension(path.join(tmp, 'renombrado.png')) === false);
  check('PDF renombrado a .png detectado', checkWrongExtension(path.join(tmp, 'pdf.png')) === true);

  check('PNG valido no roto', checkBrokenFile(path.join(tmp, 'foto.png')).broken === false);
  check('PNG truncado detectado', checkBrokenFile(path.join(tmp, 'roto.png')).broken === true);
  check('JPEG truncado detectado', checkBrokenFile(path.join(tmp, 'roto.jpg')).broken === true);
  check('PDF valido no roto', checkBrokenFile(path.join(tmp, 'data.pdf')).broken === false);
  check('PDF truncado detectado', checkBrokenFile(path.join(tmp, 'roto.pdf')).broken === true);
  check('extensionMatchesContent con zip', extensionMatchesContent('.zip', Buffer.from('PK\x03\x04xxxx', 'latin1')) === true);

  cleanDir(tmp);
  console.log(`SIGNATURES TESTS PASSED (${t})`);
}

run();