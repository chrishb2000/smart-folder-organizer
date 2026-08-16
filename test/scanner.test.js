const fs = require('fs');
const path = require('path');
const { scanFolderSync, buildCategories, findDuplicates } = require('../lib/scanner');

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

  fs.mkdirSync(path.join(testDir, 'sub'));
  write(path.join('sub', 'video.mp4'), 'video');
  fs.mkdirSync(path.join(testDir, 'empty_dir'));
  fs.mkdirSync(path.join(testDir, 'sub', 'nested_empty'));

  const scan = scanFolderSync(testDir);
  console.log('== SCAN ==');
  console.log('totalFiles:', scan.totalFiles);
  console.log('totalFolders:', scan.totalFolders);
  console.log('emptyFolders:', scan.emptyFolders.length, scan.emptyFolders.map((p) => path.basename(p)));
  console.log('tempFiles:', scan.tempFiles.map((f) => f.name));
  console.log('categories:', buildCategories(scan.files).map((c) => `${c.name}=${c.count}`).join(', '));

  const dupes = await findDuplicates(scan.files);
  console.log('== DUPLICATES ==');
  console.log('groups:', dupes.length);
  for (const g of dupes) {
    console.log('  size:', g.size, 'files:', g.files.map((f) => f.name).join(', '));
  }

  if (dupes.length !== 1) {
    console.error(`FAIL: se esperaba 1 grupo duplicado, se obtuvieron ${dupes.length}`);
    process.exit(1);
  }

  const dupNames = dupes.flatMap((g) => g.files.map((f) => f.name));
  const check = (name, cond) => {
    if (cond) console.log(`PASS: ${name}`);
    else { console.error(`FAIL: ${name}`); process.exit(1); }
  };
  check('duplicados detectados (foto1,foto2,copia)', dupNames.includes('foto1.jpg') && dupNames.includes('copia_duplicada.jpg'));
  check('categorias correctas', scan.files.some((f) => f.category === 'Documentos' && f.name === 'documento.pdf'));
  check('temporal detectado', scan.tempFiles.some((f) => f.name === 'basura.tmp'));
  check('carpetas vacias detectadas', scan.emptyFolders.some((f) => path.basename(f) === 'empty_dir') && scan.emptyFolders.some((f) => path.basename(f) === 'nested_empty'));

  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\nALL TESTS PASSED');
  process.exit(0);
}

main();