const fs = require('fs');
const path = require('path');
const { extractDateFromName, buildOrganizePlan } = require('../lib/planner');

async function main() {
  const testDir = path.join(__dirname, '_test_plan');
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const write = (name, content) => fs.writeFileSync(path.join(testDir, name), content);

  write('IMG_20260115_1234.jpg', 'foto');
  write('reporte_2026-03-05.pdf', 'doc');
  write('normal.txt', 'texto');
  write('data.xlsx', 'hoja');

  const check = (name, cond) => {
    if (cond) console.log(`PASS: ${name}`);
    else { console.error(`FAIL: ${name}`); process.exit(1); }
  };

  check('extrae fecha YYYY_MMDD de nombre', extractDateFromName('IMG_20260115_1234.jpg').y === 2026);
  check('extrae fecha ISO de nombre', extractDateFromName('reporte_2026-03-05.pdf').mo === 3);
  check('no extrae fecha de nombre sin fecha', extractDateFromName('normal.txt') === null);

  const plan1 = buildOrganizePlan(testDir, ['Imagenes', 'Documentos'], {});
  check('plan simple crea entradas', plan1.success && plan1.plan.length === 4);
  check('plan simple no incluye otras categorias', plan1.success && plan1.plan.every((p) => ['Imagenes', 'Documentos'].includes(p.category)));

  const plan2 = buildOrganizePlan(testDir, ['Imagenes', 'Documentos'], { organizeByDate: true });
  check('organiza por fecha', plan2.plan.some((p) => p.target.includes('2026')));

  const plan3 = buildOrganizePlan(testDir, ['Imagenes', 'Documentos'], { autoRename: true });
  check('renombra con fecha', plan3.plan.some((p) => path.basename(p.target).startsWith('2026-01-15_')));

  const customRules = [{ folder: 'Facturas', exts: ['.pdf'] }];
  const plan4 = buildOrganizePlan(testDir, ['Facturas'], { customRules });
  check('regla personalizada en plan', plan4.success && plan4.plan.length === 1 && plan4.plan[0].category === 'Facturas');

  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\nPLANNER TESTS PASSED');
  process.exit(0);
}

main();