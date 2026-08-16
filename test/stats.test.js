const assert = require('assert');
const { computeDashboard, topFolders, topExtensions, dateHistogram, sizeBuckets, formatBytes } = require('../lib/stats');

function run() {
  const files = [
    { path: 'C:\\fotos\\a.jpg', name: 'a.jpg', ext: '.jpg', category: 'Imagenes', size: 5000, modified: Date.parse('2024-01-05') },
    { path: 'C:\\fotos\\b.png', name: 'b.png', ext: '.png', category: 'Imagenes', size: 90000, modified: Date.parse('2024-01-20') },
    { path: 'C:\\docs\\c.pdf', name: 'c.pdf', ext: '.pdf', category: 'Documentos', size: 3000000, modified: Date.parse('2023-12-01') },
    { path: 'C:\\docs\\d.txt', name: 'd.txt', ext: '.txt', category: 'Documentos', size: 30000000, modified: Date.parse('2024-02-10') }
  ];
  const result = {
    totalFiles: 4,
    totalSize: 33095000,
    totalFolders: 2,
    files,
    emptyFolders: ['C:\\vacio'],
    tempFiles: [],
    categories: [],
    duplicateWasted: 5000
  };

  let t = 0;
  const check = (name, cond) => {
    t++;
    assert.ok(cond, `FALLO: ${name}`);
    console.log(`PASS: ${name}`);
  };

  const top = topFolders(files, 2);
  check('top folders ordena por tamano', top.length === 2 && top[0].folder === 'C:\\docs');
  const ext = topExtensions(files, 3);
  check('top extensiones', ext[0].ext === '.txt' && ext[0].count === 1);
  const hist = dateHistogram(files);
  check('histograma mensual', hist.length === 3 && hist[0].month === '2023-12');
  const buckets = sizeBuckets(files);
  check('cubetas de tamano suman', buckets.reduce((s, b) => s + b.count, 0) === 4);
  check('formatBytes', formatBytes(1024 * 1024) === '1.0 MB');

  const dash = computeDashboard(result);
  check('dashboard totales', dash.totalFiles === 4 && dash.totalSize === 33095000);
  check('dashboard vacias', dash.emptyCount === 1);

  console.log(`STATS TESTS PASSED (${t})`);
}

run();