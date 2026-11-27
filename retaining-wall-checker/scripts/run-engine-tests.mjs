#!/usr/bin/env node
/**
 * Zero-dependency Node 22+ TypeScript test runner for src/engine/.
 * Executes the Benchmark Gate (BM1–BM5, 66 quantities, <= 0.5% tolerance)
 * AND full numerical/DXF parity verification against legacy/Retaining_Wall_Checker_v14.0.1.html.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Allow Node 22 native TS execution to resolve extensionless relative imports (./foo -> ./foo.ts)
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !/\.[a-z0-9]+$/i.test(specifier)
    ) {
      for (const suffix of ['.ts', '/index.ts']) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // try next
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const engine = await import(pathToFileURL(resolve(rootDir, 'src/engine/index.ts')).href);
const {
  BMK,
  BMTOL,
  benchRun,
  calcAll,
  dgCalc,
  dgCU,
  lapReq,
  regRows,
  dxfText,
  dxParse,
  dxExtract,
  dxViews,
  dxCands,
  dxGuess,
  lean,
  fullM,
  runAutoOptimizer,
  calcCriticalLimits,
  runSensitivity,
  autoBars,
  loadDefaultDesign,
  applyWallType,
  addMainStem,
  deleteMainStem,
  addExtraStem,
  deleteExtraStem,
  addExtraStemSeg,
  deleteExtraStemSeg,
  renderFigureSvg,
  figureInputFromResult,
  fillDef,
  syncState,
} = engine;

// ---- 1. Benchmark Gate (BM1–BM5) ----
console.log('=== 1. BENCHMARK GATE (BM1–BM5, tolerance <= 0.5%) ===');
const benchResults = benchRun();
assert.equal(benchResults.length, 5, 'Expected 5 benchmark cases');
let totalQty = 0;
let maxRelDiff = 0;
for (const r of benchResults) {
  assert.equal(r.er, '', `${r.c.id} errored: ${r.er}`);
  for (const row of r.rows) {
    totalQty++;
    if (row.d > maxRelDiff) maxRelDiff = row.d;
    assert.ok(
      Number.isFinite(row.m) && row.d <= BMTOL && row.ok,
      `${r.c.id} ${row.key} failed: model=${row.m}, ref=${row.ref}, diff=${(row.d * 100).toFixed(4)}%`,
    );
  }
  console.log(`  PASS  ${r.c.id} (${r.rows.length} quantities, max diff ${(r.mx * 100).toFixed(4)}%) — ${r.c.t}`);
}
console.log(`  -> ${benchResults.length}/5 cases, ${totalQty}/${totalQty} quantities PASS (overall max diff ${(maxRelDiff * 100).toFixed(4)}%)\n`);

// ---- 2. Load Legacy v14.0.1 HTML in isolated Node VM ----
function loadLegacySandbox() {
  const htmlPath = resolve(rootDir, 'legacy/Retaining_Wall_Checker_v14.0.1.html');
  const html = readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Could not locate <script> in legacy HTML');
  const noop = () => {};
  const makeEl = () => ({
    id: '', innerHTML: '', textContent: '', innerText: '', value: '', options: [],
    style: { setProperty: noop }, dataset: {}, hidden: true, disabled: false,
    scrollTop: 0, offsetHeight: 0,
    classList: { toggle: noop, add: noop, remove: noop, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 1000, height: 800 }),
  });
  const els = new Map();
  const getEl = (id) => {
    if (!els.has(id)) { const e = makeEl(); e.id = id; els.set(id, e); }
    return els.get(id);
  };
  const doc = {
    getElementById: getEl, querySelector: () => makeEl(), querySelectorAll: () => [],
    addEventListener: noop, createElement: () => makeEl(),
    createTreeWalker: () => ({ nextNode: () => null }),
    head: makeEl(), body: makeEl(), documentElement: makeEl(), title: '', activeElement: null,
  };
  const ctx = {
    console, Math, Date, JSON, Number, String, Boolean, Array, Object, Set, Map,
    RegExp, Error, Promise, Uint8Array, TextEncoder, TextDecoder, structuredClone,
    parseInt, parseFloat, isNaN, isFinite, performance,
    setTimeout: () => 0, clearTimeout: noop,
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    document: doc, location: { hash: '', href: 'http://localhost/', protocol: 'http:' },
    history: { replaceState: noop },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    addEventListener: noop, Node: class {}, NodeFilter: { SHOW_TEXT: 4 },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    m[1] +
      `\n;globalThis.__LEGACY = {
        evalCase(st) {
          S = fillDef(structuredClone(st));
          sync();
          const R0 = calcAll();
          const DG = R0.err ? null : dgCalc(R0);
          const CU = R0.err ? null : dgCU(R0, DG);
          const REG = R0.err ? null : regRows(R0);
          const laps = R0.err ? null : Object.fromEntries(R0.RS.map(r => [r.k, [lapReq(r.k), lapReq(r.k, 3)]]));
          return { R0, DG, CU, REG, laps };
        },
        evalDxf(st, sc, name) {
          S = fillDef(structuredClone(st));
          sync();
          return dxfText({ sc, name });
        },
        evalTools(st) {
          S = fillDef(structuredClone(st));
          sync();
          return { lean: lean(structuredClone(S)), fullM: fullM(structuredClone(S)) };
        },
        evalDxfParse(buf) {
          const P = dxParse(buf);
          const X = dxExtract(P);
          X.k = P.k;
          const V = dxViews(X);
          const C = dxCands(X, V);
          const G = dxGuess(X, V, C);
          return { ver: P.ver, k: P.k, nT: X.T.length, nDm: X.Dm.length, nGm: X.Gm.length, nV: V.length, nLv: C.lv.length, nDmC: C.dm.length, G };
        }
      };`,
    ctx,
  );
  return ctx.__LEGACY;
}

const legacy = loadLegacySandbox();

function expectClose(actual, expected, label, relTol = 1e-11) {
  if (!Number.isFinite(expected)) {
    assert.equal(actual, expected, `${label}: actual=${actual} vs legacy=${expected}`);
    return;
  }
  const denom = Math.max(1, Math.abs(expected));
  const rel = Math.abs(actual - expected) / denom;
  assert.ok(rel <= relTol, `${label}: actual=${actual} vs legacy=${expected} (rel=${rel})`);
}

let parityCount = 0;
function compareCase(name, state) {
  const leg = legacy.evalCase(state);
  const ts = calcAll(state);
  assert.equal(!!ts.err, !!leg.R0.err, `${name}: err mismatch`);
  if (ts.err || leg.R0.err) {
    assert.deepEqual(ts.V.E, leg.R0.V.E, `${name}: errors mismatch`);
    parityCount++;
    return;
  }
  assert.deepEqual(ts.fails, [...leg.R0.fails], `${name}: fails mismatch`);
  expectClose(ts.G.B, leg.R0.G.B, `${name}: B`);
  expectClose(ts.vol, leg.R0.vol, `${name}: vol`);
  expectClose(ts.steel, leg.R0.steel, `${name}: steel`);
  expectClose(ts.Pk.Ka, leg.R0.Pk.Ka, `${name}: Pk.Ka`);
  expectClose(ts.Pk.Kah, leg.R0.Pk.Kah, `${name}: Pk.Kah`);
  expectClose(ts.Pk.Kp, leg.R0.Pk.Kp, `${name}: Pk.Kp`);
  expectClose(ts.Pf.Ka, leg.R0.Pf.Ka, `${name}: Pf.Ka`);
  expectClose(ts.ko, leg.R0.ko, `${name}: ko`);

  expectClose(ts.A.sl.u, leg.R0.A.sl.u, `${name}: A.sl.u`);
  expectClose(ts.A.ot.F, leg.R0.A.ot.F, `${name}: A.ot.F`);
  expectClose(ts.A.br.u, leg.R0.A.br.u, `${name}: A.br.u`);
  expectClose(ts.A.br.r.qu, leg.R0.A.br.r.qu, `${name}: A.br.r.qu`);
  expectClose(ts.A.sls.s.e, leg.R0.A.sls.s.e, `${name}: A.sls.s.e`);

  expectClose(ts.Fc.sl.F, leg.R0.Fc.sl.F, `${name}: Fc.sl.F`);
  expectClose(ts.Fc.ot.F, leg.R0.Fc.ot.F, `${name}: Fc.ot.F`);
  expectClose(ts.Fc.br.F, leg.R0.Fc.br.F, `${name}: Fc.br.F`);
  expectClose(ts.Fc.br.qu, leg.R0.Fc.br.qu, `${name}: Fc.br.qu`);
  expectClose(ts.Fc.up.r, leg.R0.Fc.up.r, `${name}: Fc.up.r`);

  assert.equal(ts.RS.length, leg.R0.RS.length, `${name}: RS.length`);
  ts.RS.forEach((r, idx) => {
    const lr = leg.R0.RS[idx];
    assert.equal(r.k, lr.k);
    expectClose(r.M, lr.M, `${name}: RS[${r.k}].M`);
    expectClose(r.V, lr.V, `${name}: RS[${r.k}].V`);
    expectClose(r.Asr, lr.Asr, `${name}: RS[${r.k}].Asr`);
    expectClose(r.Asp, lr.Asp, `${name}: RS[${r.k}].Asp`);
    expectClose(r.v, lr.v, `${name}: RS[${r.k}].v`);
    expectClose(r.vc, lr.vc, `${name}: RS[${r.k}].vc`);
    assert.equal(r.ok, lr.ok, `${name}: RS[${r.k}].ok`);
  });

  assert.equal(ts.PL.length, leg.R0.PL.length, `${name}: PL.length`);
  ts.PL.forEach((p, idx) => {
    expectClose(p.Fot, leg.R0.PL[idx].Fot, `${name}: PL[${idx}].Fot`);
    expectClose(p.ek, leg.R0.PL[idx].ek, `${name}: PL[${idx}].ek`);
  });
  assert.equal(ts.MS.length, leg.R0.MS.length, `${name}: MS.length`);

  assert.equal(!!ts.AI, !!leg.R0.AI, `${name}: AI`);
  if (ts.AI && leg.R0.AI) {
    expectClose(ts.AI.Fs, leg.R0.AI.Fs, `${name}: AI.Fs`);
    expectClose(ts.AI.Fo, leg.R0.AI.Fo, `${name}: AI.Fo`);
    expectClose(ts.AI.br.F, leg.R0.AI.br.F, `${name}: AI.br.F`);
  }

  const tsDG = dgCalc(state, ts);
  const tsCU = dgCU(state, ts, tsDG);
  if (leg.DG) {
    assert.deepEqual(Object.keys(tsDG || {}).sort(), [...Object.keys(leg.DG)].sort());
    for (const k of Object.keys(leg.DG)) {
      const aPts = tsDG[k];
      const bPts = leg.DG[k];
      assert.equal(aPts.length, bPts.length);
      for (let i = 0; i < bPts.length; i++) {
        expectClose(aPts[i].M, bPts[i].M, `${name}: DG[${k}][${i}].M`);
        expectClose(aPts[i].V, bPts[i].V, `${name}: DG[${k}][${i}].V`);
      }
    }
    for (const k of Object.keys(leg.CU)) {
      const ac = tsCU[k];
      const bc = leg.CU[k];
      assert.equal(!!ac?.none, !!bc?.none, `${name}: CU[${k}].none`);
      if (ac && bc && !ac.none) {
        expectClose(ac.zc, bc.zc, `${name}: CU[${k}].zc`);
        expectClose(ac.zt, bc.zt, `${name}: CU[${k}].zt`);
      }
    }
    for (const r of ts.RS) {
      assert.deepEqual([lapReq(state, r.k), lapReq(state, r.k, 3)], [...leg.laps[r.k]], `${name}: lap[${r.k}]`);
    }
  }

  const tsReg = regRows(state, ts);
  assert.equal(tsReg.length, leg.REG.length, `${name}: regRows length`);
  tsReg.forEach((row, idx) => {
    assert.equal(row.id, leg.REG[idx].id);
    assert.equal(row.st, leg.REG[idx].st);
  });

  parityCount++;
  console.log(`  PASS  ${name}`);
}

console.log('=== 2. EXACT PARITY vs legacy/Retaining_Wall_Checker_v14.0.1.html ===');
for (const acc of ['fc', 'gg1']) {
  for (const ty of ['T', 'L', 'Li', 'G']) {
    compareCase(`default ${ty} (${acc})`, loadDefaultDesign(ty, { acc }));
  }
}
for (const ty of ['T', 'G']) {
  for (const kam of ['r', 'c', 'm']) {
    const s = loadDefaultDesign(ty, { acc: 'fc' });
    s.kam = kam;
    s.kaM = 0.3;
    s.kaMf = 0.33;
    compareCase(`${ty} kam=${kam}`, s);
  }
}
for (const acc of ['fc', 'gg1']) {
  const s = loadDefaultDesign('T', { acc });
  s.bf = -25;
  s.scon = 1;
  s.scb = 1.5;
  compareCase(`CR-4 slope crest (${acc})`, s);
}
{
  const s = loadDefaultDesign('T', { acc: 'fc' });
  s.skon = 1; s.skd = 0.7; s.skw = 0.6; s.skx = 1.2;
  s.nopp = 0; s.ppS = 1; s.ppO = 1;
  s.wo = 1; s.wh = 1.8; s.wsd = 0.6;
  s.fdl = 1; s.fdP = 6; s.fdS = 2.5;
  s.bro = 1; s.brc = 'v6C'; s.vSO = 1; s.accI = 1;
  compareCase('shear key + passive + wind + fence DL + vehicle impact', s);
}
{
  const ter = loadDefaultDesign('T', { acc: 'fc' });
  ter.Lt = 3.5;
  ter.xs = [{ x: 0.3, t: 0.35, h: 1.8, zt: 8.0, rc: 1, pp: 1 }];
  ter.xa = 'ter';
  compareCase('terraced 2-stem (fc)', ter);

  const u = loadDefaultDesign('T', { acc: 'gg1' });
  u.Lt = 3.8; u.Hf = 8.5;
  u.xs = [{ x: 0.25, t: 0.35, h: 2.2, zt: 6.6, rc: 1 }];
  u.xa = 'U';
  compareCase('U-channel (gg1)', u);
}
{
  const g1 = loadDefaultDesign('G', { acc: 'fc' });
  g1.gmr = 'cc'; g1.gmb = '965';
  g1.st = [
    { t: 0.4, fb: 0, rb: 0, of: 0.2, top: 10.2, bot: 9.2, rc: 1 },
    { t: 0.8, fb: 0, rb: 0, of: 0.2, top: 9.2, bot: 8.4, rc: 0 },
  ];
  g1.gBh = 2.4; g1.gBt = 1.2; g1.gbf = 1.0; g1.gbr = 0.4;
  compareCase('stepped gravity + mesh 965', g1);

  const g2 = structuredClone(g1);
  g2.gmb = '913t';
  compareCase('stepped gravity + mesh 913t', g2);
}

console.log('\n=== 3. CR-1 DXF EXPORT & DXF PARSER PARITY ===');
for (const ty of ['T', 'G']) {
  const s = loadDefaultDesign(ty, { acc: 'fc' });
  s.pn = 'J-2026'; s.jno = 'Test Wall';
  for (const sc of [100, 50]) {
    const tsDxf = dxfText(s, { sc, name: `RW_${ty}` });
    const legDxf = legacy.evalDxf(s, sc, `RW_${ty}`);
    assert.equal(tsDxf, legDxf, `DXF mismatch for ${ty} 1:${sc}`);
    console.log(`  PASS  DXF export byte-for-byte parity: ${ty} 1:${sc} (${tsDxf.length} bytes)`);
  }
}
{
  const s = loadDefaultDesign('T', { acc: 'fc' });
  const dxf = dxfText(s, { sc: 100, name: 'RW1' });
  const buf = new TextEncoder().encode(dxf);
  const P = dxParse(buf);
  const X = dxExtract(P); X.k = P.k;
  const V = dxViews(X);
  const C = dxCands(X, V);
  const G = dxGuess(X, V, C);
  const leg = legacy.evalDxfParse(buf);
  assert.equal(P.ver, leg.ver);
  assert.equal(P.k, leg.k);
  assert.equal(X.T.length, leg.nT);
  assert.equal(X.Dm.length, leg.nDm);
  assert.equal(X.Gm.length, leg.nGm);
  assert.equal(V.length, leg.nV);
  assert.equal(C.lv.length, leg.nLv);
  assert.equal(C.dm.length, leg.nDmC);
  assert.deepEqual(G, JSON.parse(JSON.stringify(leg.G)));
  console.log(`  PASS  DXF parser parity (${X.T.length} texts, ${X.Dm.length} dims, ${X.Gm.length} geom, ${V.length} views)`);
}

console.log('\n=== 4. DESIGN TOOLS & STATELESSNESS ===');
{
  const s = loadDefaultDesign('T', { acc: 'fc' });
  const snapBefore = JSON.stringify(s);
  calcAll(s);
  assert.equal(JSON.stringify(s), snapBefore, 'calcAll mutated caller state!');

  const legT = legacy.evalTools(s);
  const tsLean = lean(s);
  const tsFull = fullM(s);
  expectClose(tsLean.vol, legT.lean.vol, 'lean.vol');
  expectClose(tsLean.uls, legT.lean.uls, 'lean.uls');
  expectClose(tsFull.qmax, legT.fullM.qmax, 'fullM.qmax');
  expectClose(tsFull.steel, legT.fullM.steel, 'fullM.steel');

  const opt = await runAutoOptimizer(s);
  assert.ok(opt.best && opt.best.m.okAll, 'Auto-Optimizer failed to find passing solution');
  const crit = calcCriticalLimits(s);
  assert.ok(crit.w1 && crit.q1, 'Critical limits missing');
  const sens = runSensitivity(s);
  assert.ok(sens && sens.rows.length >= 4, 'Sensitivity tornado missing rows');
  const ab = autoBars(s);
  assert.ok(ab.ok, 'Auto-Bars failed');
  const after = calcAll(ab.state);
  assert.ok(!after.err && after.okRC, 'Auto-Bars result did not pass RC');

  const { state: mig } = fillDef({ ty: 'T', Hr: 10, Zb: 6 });
  syncState(mig);
  assert.equal(mig.ver, 9);
  assert.equal(mig.r.gs, mig.r.g);
  console.log(`  PASS  lean, fullM, Auto-Optimizer (B=${opt.best.B.toFixed(2)}m, vol=${opt.best.vol.toFixed(3)}m³/m), Critical Limits, Sensitivity, Auto-Bars, Purity`);
}

console.log('\n=== 5. FIGURE SVG, ALL DRAG HANDLES & MULTI-STEM MUTATIONS ===');
{
  const s = loadDefaultDesign('T', { acc: 'fc' });
  const r0 = calcAll(s);
  assert(!r0.err);
  const fT = renderFigureSvg(s, figureInputFromResult(s, r0));
  assert.ok(fT.handles.length >= 16, `Expected >=16 drag handles on T wall, got ${fT.handles.length}`);
  assert.ok(fT.svgHtml.includes('ΣPa') && fT.svgHtml.includes('ΣPq') && fT.svgHtml.includes('Resultant R'));

  // Main stem split & delete
  const sStem = structuredClone(s);
  const n0 = sStem.st.length;
  assert.ok(addMainStem(sStem).ok);
  assert.equal(sStem.st.length, n0 + 1);
  assert.ok(!calcAll(sStem).err);
  assert.ok(deleteMainStem(sStem, sStem.st.length - 1));
  assert.equal(sStem.st.length, n0);

  // Multi-stem terraced wall: extra stem on toe side + terrace soil + upper step + L->T conversion
  const sTer = structuredClone(s);
  assert.ok(addExtraStem(sTer).ok);
  assert.equal(sTer.xs.length, 1);
  assert.ok(sTer.xs[0].x < sTer.Lt, 'Extra stem must sit on toe side (x < Lt)');
  assert.ok(addExtraStemSeg(sTer, 0).ok);
  const rTer = calcAll(sTer);
  assert.ok(!rTer.err);
  const fTer = renderFigureSvg(sTer, figureInputFromResult(sTer, rTer));
  assert.ok(fTer.svgHtml.includes('Terrace +'), 'Terrace soil missing in multi-stem figure');
  assert.ok(fTer.handles.some((h) => h.p === 'xs.0.zt'), 'Terrace level handle missing');
  assert.ok(fTer.handles.some((h) => h.p === 'xs.0.up.0.h'), 'Extra stem upper step handle missing');
  assert.ok(deleteExtraStemSeg(sTer, 0, 0));
  assert.ok(deleteExtraStem(sTer, 0));
  assert.equal(sTer.xs.length, 0);

  const sL = loadDefaultDesign('L', { acc: 'fc' });
  const conv = addExtraStem(sL);
  assert.ok(conv.ok && conv.convertedFromL && sL.ty === 'T');

  console.log(`  PASS  Figure SVG (${fT.handles.length} T handles / ${fTer.handles.length} multi-stem handles), Terrace soil, Add/Delete/Split Stems & L→T auto-conversion`);
}

console.log(`\nALL ENGINE VERIFICATIONS PASSED (${benchResults.length} benchmarks / ${totalQty} quantities + ${parityCount} full parity scenarios + DXF + Tools + Figure/Stems).`);
