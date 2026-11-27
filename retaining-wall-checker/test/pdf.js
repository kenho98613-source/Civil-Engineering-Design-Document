// node pdf.js model.html rwall typeIndex out.pdf [full]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [model, rwf, ti, out, full] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(), pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('file://' + path.resolve(model)); await pg.waitForTimeout(800);
  await pg.evaluate(([rw, i, full]) => { rwLoad(rw, 'cs'); if (PJ.active != i) pjSwitch(i); S.rpf = full ? 1 : 0; sync(); ri(); rr(); try { mclose() } catch (e) { } }, [fs.readFileSync(rwf, 'utf8'), +ti, !!full]);
  await pg.emulateMedia({ media: 'print' });
  await pg.pdf({ path: out, format: 'A4', printBackground: true });
  console.log('pdf', out, 'errors', errs.length); await b.close()
})();
