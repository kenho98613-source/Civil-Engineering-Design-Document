// Regression harness: node vreg.js <model.html> <out.json> <project.rwall>
// For each case: numeric results (R0 subset, rounded) + report HTML (ps, sm, r5, r6, r7) + multi-type summary.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [model, out, rw] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(), pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  pg.on('dialog', d => d.dismiss());
  await pg.goto('file://' + path.resolve(model));
  await pg.waitForTimeout(800);
  const rwText = fs.readFileSync(rw, 'utf8');
  const res = await pg.evaluate(async (rwText) => {
    const rnd = x => typeof x == 'number' ? (Number.isFinite(x) ? +x.toPrecision(10) : String(x)) : x;
    const clean = (o, d = 0, seen = new WeakSet()) => {
      if (o == null || typeof o != 'object') return typeof o == 'function' ? undefined : rnd(o);
      if (o instanceof Node || seen.has(o) || d > 8) return undefined;
      seen.add(o);
      if (Array.isArray(o)) return o.map(x => clean(x, d + 1, seen));
      const r = {}; for (const k of Object.keys(o).sort()) { const v = clean(o[k], d + 1, seen); if (v !== undefined) r[k] = v } return r;
    };
    const snap = (name) => {
      sync(); ri(); rr();
      const R = window.__RES, R0 = R ? R.R0 : calcAll();
      const num = clean({ A: R0.A, Fc: R0.Fc, u: R0.u, AI: R0.AI, D0: R0.D0, fails: R0.fails, Pk: R0.Pk, Pf: R0.Pf, PL: R0.PL, RS: R0.RS, MS: R0.MS, B: R0.G && R0.G.B, vol: R0.vol, steel: R0.steel, err: R0.err, E: R0.V && R0.V.E });
      const html = {}; for (const id of ['ps', 'sm', 'r5', 'r6', 'r7']) html[id] = (document.getElementById(id) || {}).innerHTML || '';
      const warn = (R0.V && R0.V.W || []).slice();
      return { name, num, html, warn, inp: document.getElementById('in').innerText };
    };
    const C = [];
    // default designs of each wall type, global + partial factor
    for (const acc of ['fc', 'gg1']) for (const ty of ['T', 'L', 'Li', 'G']) {
      S.acc = acc; loadDefault(ty); S.acc = acc; C.push(snap(`default ${ty} ${acc}`));
      if (ty == 'T' || ty == 'G') {
        for (const kam of ['r', 'c', 'm']) { if (S.kam == kam) continue; S.kam = kam; S.kaM = 0.3; S.kaMf = 0.33; C.push(snap(`default ${ty} ${acc} kam=${kam}`)) }
      }
    }
    // project file: each wall type as saved + variants
    rwLoad(rwText, 'project.rwall');
    const nT = PJ.types.length;
    for (let i = 0; i < nT; i++) {
      PJ.types[PJ.active].S = S; PJ.active = i; S = pjGet(i);
      const S0 = structuredClone(S);
      C.push(snap(`proj ${PJ.types[i].name}`));
      if (i < 2) {
        const V = [
          ['kam=m 0.25', s => { s.kam = 'm'; s.kaM = 0.25; s.kaMf = 0.25 }],
          ['kam=c', s => { s.kam = 'c' }],
          ['gg1', s => { s.acc = 'gg1' }],
          ['passive on', s => { s.nopp = 0; s.dp = 1 }],
          ['tsw on, nopp', s => { s.tsw = 1; s.nopp = 1; s.obdp = 0; s.dp = 1 }],
          ['tsw on, obdp', s => { s.tsw = 1; s.nopp = 1; s.obdp = 1; s.dp = 1 }],
          ['accI on', s => { s.accI = 1 }],
        ];
        for (const [n, fn] of V) { S = fillDef(structuredClone(S0)); fn(S); C.push(snap(`proj ${PJ.types[i].name} ${n}`)) }
        S = fillDef(structuredClone(S0));
      }
      PJ.types[i].S = S;
    }
    // multi-type summary page
    let sum = '';
    try { mpBuild([...Array(nT).keys()]); const e = document.querySelector('#mp .mpsum'); sum = e ? e.innerHTML : ''; document.body.classList.remove('mpx'); document.getElementById('mp').innerHTML = '' } catch (e) { sum = 'ERR ' + e }
    let bench = '';
    try { bench = JSON.stringify(benchRun()) } catch (e) { bench = 'ERR ' + e }
    return { C, sum, bench };
  }, rwText);
  res.errs = errs;
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(model, 'cases', res.C.length, 'errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
