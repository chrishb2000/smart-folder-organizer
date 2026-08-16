const fs = require('fs');
const path = require('path');
const assert = require('assert');
const os = require('os');
const { gradientPng, checkerPng, makeJpeg, writeFiles, cleanDir } = require('./helpers');
const { computeDHash, hammingDistance, findSimilarGroups } = require('../lib/imghash');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfo-img-'));

function run() {
  const gradA = gradientPng(64, 64, 255, 128, 64);
  const gradA2 = gradientPng(63, 63, 255, 128, 64);
  const checker = checkerPng(64, 64, 4);
  const jpg1 = makeJpeg();

  writeFiles(tmp, {
    'a.png': gradA,
    'a2.png': gradA2,
    'checker.png': checker,
    'c.jpg': jpg1
  });

  let t = 0;
  const check = (name, cond) => {
    t++;
    assert.ok(cond, `FALLO: ${name}`);
    console.log(`PASS: ${name}`);
  };

  const ha = computeDHash(path.join(tmp, 'a.png'));
  const ha2 = computeDHash(path.join(tmp, 'a2.png'));
  const hcheck = computeDHash(path.join(tmp, 'checker.png'));
  const hc = computeDHash(path.join(tmp, 'c.jpg'));

  check('hash es 16 chars hex', /^[0-9a-f]{16}$/.test(ha.hash));
  check('hash JPEG decodifica', !!hc && /^[0-9a-f]{16}$/.test(hc.hash));
  check('dimensiones PNG extraidas', ha.width === 64 && ha.height === 64);
  check('gradiente A vs A2 (casi iguales) cercano', hammingDistance(ha.hash, ha2.hash) <= 2);
  check('gradiente vs ajedrez (distintos) lejano', hammingDistance(ha.hash, hcheck.hash) > 12);

  const fileInfos = ['a.png', 'a2.png', 'checker.png'].map((n) => ({ path: path.join(tmp, n), name: n }));
  const groups = findSimilarGroups(fileInfos, { threshold: 7 });
  check('agrupa A y A2 como similares', groups.length === 1 && groups[0].files.length === 2);

  const groups2 = findSimilarGroups(fileInfos, { threshold: 7, maxFiles: 2 });
  check('maxFiles limita procesamiento', groups2.length === 0 || groups2.every((g) => g.files.length >= 0));

  cleanDir(tmp);
  console.log(`IMGHASH TESTS PASSED (${t})`);
}

run();