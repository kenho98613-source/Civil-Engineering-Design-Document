// UI smoke test with real clicks: node ui2.js model.html rwall
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [model, rwf] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1600, height: 1000 } }); const errs = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200))); pg.on('dialog', d => d.dismiss());
  await pg.goto('file://' + path.resolve(model)); await pg.waitForTimeout(800);
  const rw = fs.readFileSync(rwf, 'utf8'); const log = [];
  const click = async (sel) => { const e = await pg.$(sel); if (!e) return false; try { await e.click({ timeout: 1500 }); await pg.waitForTimeout(150); return true } catch (x) { try { await e.evaluate(el => el.click()); await pg.waitForTimeout(150); return 'js' } catch (y) { return false } } };
  const drag = async () => {
    const hs = await pg.$$('#fg [data-h]'); let n = 0;
    for (const h of hs.slice(0, 25)) {
      const bb = await h.boundingBox(); if (!bb) continue;
      await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.mouse.down();
      await pg.mouse.move(bb.x + bb.width / 2 + 12, bb.y + bb.height / 2 - 10, { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(60); n++
    }
    return n
  };
  const modalBtns = async () => pg.evaluate(() => [...document.querySelectorAll('#mdl button')].map(b => b.textContent.trim()).slice(0, 8));
  const closeM = () => pg.evaluate(() => { try { mclose() } catch (e) { } });
  const scen = []; for (const ty of ['T', 'L', 'Li', 'G']) scen.push(['def', ty]); for (let i = 0; i < 4; i++) scen.push(['cs', i]);
  for (const [k, v] of scen) {
    if (k == 'def') await pg.evaluate(t => loadDefault(t), v);
    else await pg.evaluate(([rw, i]) => { rwLoad(rw, 'cs'); if (PJ.active != i) pjSwitch(i) }, [rw, v]);
    await closeM(); await pg.waitForTimeout(100);
    const e0 = errs.length; const r = { case: k + ' ' + v };
    r.xadd = await click('#fg [data-a=xadd]'); if (r.xadd) { r.xaddDrag = await drag(); r.xaddRes = await pg.evaluate(() => !!window.__RES) }
    await pg.evaluate(() => { if (S.xs && S.xs.length) { S.xs = []; sync(); ri(); rr() } });
    r.drag = await drag();
    r.autobar = await click('[data-a=autobar]');
    r.autodes = await click('[data-a=autodes]'); await pg.waitForTimeout(1500); r.adBtns = await modalBtns();
    const ap = await pg.$$('#mdl button.pri'); if (ap.length) { try { await ap[0].click({ timeout: 1500 }) } catch (x) { } } await closeM();
    r.wiz = await click('[data-a=wiz]'); await pg.waitForTimeout(300);
    for (let s = 0; s < 8; s++) { const nb = await pg.$('#mdl button.pri'); if (!nb) break; try { await nb.click({ timeout: 1500 }) } catch (x) { break } await pg.waitForTimeout(200) }
    await closeM();
    for (const t of ['L', 'Li', 'G', 'T']) await pg.evaluate(t => { const e = document.querySelector('[data-a=ty][data-v="' + t + '"]'); if (e) e.click(); else { applyTy(t); ri(); rr() } }, t);
    r.res = await pg.evaluate(() => !!window.__RES); r.newErr = errs.slice(e0); log.push(r)
  }
  await pg.evaluate(rw => { rwLoad(rw, 'cs'); mpBuild([0, 1, 2, 3]); document.body.classList.remove('mpx'); document.getElementById('mp').innerHTML = '' }, rw);
  for (const r of log) console.log(r.case, 'xadd', r.xadd, r.xaddDrag, r.xaddRes, '| drag', r.drag, '| autobar', r.autobar, '| autodes', r.autodes, r.adBtns.slice(0, 3).join('/'), '| wiz', r.wiz, '| res', r.res, '| ERR', r.newErr);
  console.log('TOTAL page errors', errs.length); await b.close()
})();
