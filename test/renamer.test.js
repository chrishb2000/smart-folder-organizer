const fs = require('fs');
const path = require('path');
const assert = require('assert');
const os = require('os');
const { buildRenamePlan, applyRenamePlan, extractDateFromName, sanitizeFileName } = require('../lib/renamer');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfo-ren-'));

function run() {
  const sub = path.join(tmp, 'Facturas');
  fs.mkdirSync(sub, { recursive: true });
  const files = [
    { name: 'factura_enero.txt', path: path.join(sub, 'factura_enero.txt') },
    { name: '2024-05-12_contrato.pdf', path: path.join(sub, '2024-05-12_contrato.pdf') },
    { name: 'foto.png', path: path.join(sub, 'foto.png') }
  ];
  for (const f of files) fs.writeFileSync(f.path, 'x');

  let t = 0;
  const check = (name, cond) => {
    t++;
    assert.ok(cond, `FALLO: ${name}`);
    console.log(`PASS: ${name}`);
  };

  check('extrae fecha YYYY-MM-DD', extractDateFromName('2024-05-12_x.txt').y === 2024);
  check('no extrae fecha invalida', extractDateFromName('2024-99-99_x.txt') === null);

  const plan = buildRenamePlan(files, '{fecha}_{nombre_limpio}_{sec}', { seqZero: false });
  check('plan tiene 3 entradas', plan.length === 3);
  check('renombra con fecha del nombre', plan[1].newName.match(/^2024-05-12_contrato_\d+\.pdf$/) !== null);
  check('usa fecha de modificacion si no hay en nombre', plan[0].newName.match(/^\d{4}-\d{2}-\d{2}_factura_enero_\d+\.txt$/) !== null);
  check('tokens secuenciales', buildRenamePlan([files[0]], 'archivo_{sec}')[0].newName === 'archivo_1.txt');
  check('sanitiza caracteres invalidos', sanitizeFileName('a:b*c') === 'a_b_c');
  check('sanitiza nombre vacio', sanitizeFileName('...') === 'archivo');

  const result = applyRenamePlan(plan);
  check('renombrado aplicado', result.renamed === 3 && result.failed === 0);
  check('archivo renombrado en disco', fs.existsSync(path.join(sub, plan[1].newName)) && !fs.existsSync(files[1].path));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`RENAMER TESTS PASSED (${t})`);
}

run();