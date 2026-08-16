const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildReport, buildActionCsv, buildHtmlReport, saveReport } = require('../lib/reporter');

function run() {
  const files = [
    { path: 'C:\\fotos\\a.jpg', name: 'a.jpg', ext: '.jpg', category: 'Imagenes', size: 5000, modified: Date.parse('2024-01-05') }
  ];
  const result = {
    totalFiles: 1,
    totalSize: 5000,
    files,
    emptyFolders: [],
    tempFiles: [],
    duplicateWasted: 0
  };

  let t = 0;
  const check = (name, cond) => {
    t++;
    assert.ok(cond, `FALLO: ${name}`);
    console.log(`PASS: ${name}`);
  };

  const rep = buildReport(result);
  check('csv incluye cabecera', rep.csv.startsWith('nombre,ruta,carpeta,extension,categoria,tamano,modificado'));
  check('csv escapa comas', rep.csv.includes('C:\\fotos\\a.jpg'));

  const csvActions = buildActionCsv([{ date: Date.now(), type: 'move', label: 'Mover 2 archivos', detail: 'x' }]);
  check('csv de acciones', csvActions.includes('tipo,accion') && csvActions.includes('move'));

  const html = buildHtmlReport(result, 'Test');
  check('html contiene stats', html.includes('archivos') && html.includes('Smart Folder Organizer'));
  check('html escapa', !html.includes('<script>'));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfo-rep-'));
  const saved = saveReport(tmp, 'informe.csv', rep.csv);
  check('archivo csv guardado', fs.existsSync(saved) && saved.endsWith('.csv'));
  const saved2 = saveReport(tmp, 'informe.html', html);
  check('archivo html guardado', fs.existsSync(saved2) && saved2.endsWith('.html'));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`REPORTER TESTS PASSED (${t})`);
}

run();