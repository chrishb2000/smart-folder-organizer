const fs = require('fs');
const path = require('path');
const { scanFolderSync, buildCategories, findDuplicates, getCategory, hashFileWithCache } = require('../lib/scanner');

async function main() {
  const testDir = path.join(__dirname, '_test_scan');
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const write = (name, content) => fs.writeFileSync(path.join(testDir, name), content);

  write('foto1.jpg', 'imagen-jpeg');
  write('foto2.jpg', 'imagen-jpeg');
  write('documento.pdf', 'pdf-contenido');
  write('musica.mp3', 'audio-mp3');
  write('instalador.exe', 'exe');
  write('archive.zip', 'zip');
  write('codigo.js', 'js');
  write('basura.tmp', 'temporal');
  write('copia_duplicada.jpg', 'imagen-jpeg');
  write('pdf_renombrado.png', '%PDF-1.4\n%%EOF\n');

  fs.mkdirSync(path.join(testDir, 'sub'));
  write(path.join('sub', 'video.mp4'), 'video');
  fs.mkdirSync(path.join(testDir, 'empty_dir'));
  fs.mkdirSync(path.join(testDir, 'sub', 'nested_empty'));

  const scan = scanFolderSync(testDir, null, null, { checkIntegrity: true });
  console.log('== SCAN ==');
  console.log('totalFiles:', scan.totalFiles);
  console.log('emptyFolders:', scan.emptyFolders.length, scan.emptyFolders.map((p) => path.basename(p)));
  console.log('tempFiles:', scan.tempFiles.map((f) => f.name));

  const dupes = await findDuplicates(scan.files, null, {});
  const dupes2 = await findDuplicates(scan.files, null, dupes.cache);
  console.log('duplicate groups:', dupes.groups.length);

  const check = (name, cond) => {
    if (cond) console.log(`PASS: ${name}`);
    else { console.error(`FAIL: ${name}`); process.exit(1); }
  };

  check('1 grupo duplicado (3 archivos identicos)', dupes.groups.length === 1 && dupes.groups[0].files.length === 3);
  check('categorias correctas', scan.files.some((f) => f.category === 'Documentos' && f.name === 'documento.pdf'));
  check('temporal detectado', scan.tempFiles.some((f) => f.name === 'basura.tmp'));
  check('carpetas vacias detectadas', scan.emptyFolders.length === 2);
  check('extension incorrecta detectada', scan.wrongExtensions.some((f) => f.name === 'pdf_renombrado.png'));

  const customRules = [{ folder: 'Facturas', exts: ['.pdf', '.xlsx'] }];
  check('regla personalizada prioritaria', getCategory('doc.pdf', customRules) === 'Facturas');
  check('regla personalizada no rompe defaults', getCategory('img.jpg', customRules) === 'Imagenes');

  const sample = scan.files.find((f) => f.name === 'foto1.jpg');
  const cached = await hashFileWithCache(sample.path, sample.size, sample.modified, dupes.cache);
  check('caché de hash reutilizada', cached.cached === true && cached.hash === dupes.groups[0].hash);

  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\nSCANNER TESTS PASSED');
  process.exit(0);
}

main();