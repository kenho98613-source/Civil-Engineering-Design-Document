import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  autoBars,
  calcAll,
  calcCriticalLimits,
  dgCU,
  dgCalc,
  dxCands,
  dxExtract,
  dxGuess,
  dxParse,
  dxViews,
  dxfText,
  fillDef,
  fullM,
  lapReq,
  lean,
  loadDefaultDesign,
  regRows,
  runAutoOptimizer,
  runSensitivity,
  syncState,
} from '../index';
import type { WallState, WallType } from '../types';

/**
 * Loads legacy/Retaining_Wall_Checker_v14.0.1.html's <script> into an isolated Node VM
 * with minimal DOM stubs so we can verify exact numerical & DXF parity against RULES.md #1.
 */
function loadLegacySandbox() {
  const htmlPath = resolve(__dirname, '../../../legacy/Retaining_Wall_Checker_v14.0.1.html');
  const html = readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Could not locate <script> in legacy HTML');

  const noop = () => {};
  const makeEl = (): any => ({
    id: '',
    innerHTML: '',
    textContent: '',
    innerText: '',
    value: '',
    options: [],
    style: { setProperty: noop },
    dataset: {},
    hidden: true,
    disabled: false,
    scrollTop: 0,
    offsetHeight: 0,
    classList: { toggle: noop, add: noop, remove: noop, contains: () => false },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    appendChild: noop,
    remove: noop,
    setAttribute: noop,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 1000, height: 800 }),
  });

  const els = new Map<string, any>();
  const getEl = (id: string) => {
    if (!els.has(id)) {
      const e = makeEl();
      e.id = id;
      els.set(id, e);
    }
    return els.get(id);
  };

  const doc: any = {
    getElementById: getEl,
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener: noop,
    createElement: () => makeEl(),
    createTreeWalker: () => ({ nextNode: () => null }),
    head: makeEl(),
    body: makeEl(),
    documentElement: makeEl(),
    title: '',
    activeElement: null,
  };

  const ctx: any = {
    console,
    Math,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    Promise,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    structuredClone,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    performance,
    setTimeout: () => 0,
    clearTimeout: noop,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: noop,
    document: doc,
    location: { hash: '', href: 'http://localhost/', protocol: 'http:' },
    history: { replaceState: noop },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    addEventListener: noop,
    Node: class {},
    NodeFilter: { SHOW_TEXT: 4 },
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

function expectClose(actual: number, expected: number, label: string, relTol = 1e-11) {
  if (!Number.isFinite(expected)) {
    expect(actual, label).toBe(expected);
    return;
  }
  const denom = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected) / denom, `${label}: actual=${actual} vs legacy=${expected}`).toBeLessThanOrEqual(relTol);
}

function compareCase(name: string, state: WallState) {
  const leg = legacy.evalCase(state);
  const ts = calcAll(state);

  expect(!!ts.err, `${name}: err flag`).toBe(!!leg.R0.err);
  if (ts.err || leg.R0.err) {
    expect(ts.V.E, `${name}: errors`).toEqual([...leg.R0.V.E]);
    return;
  }

  expect(ts.fails, `${name}: fails`).toEqual([...leg.R0.fails]);
  expectClose(ts.G.B, leg.R0.G.B, `${name}: B`);
  expectClose(ts.vol, leg.R0.vol, `${name}: vol`);
  expectClose(ts.steel, leg.R0.steel, `${name}: steel`);
  expectClose(ts.Pk.Ka, leg.R0.Pk.Ka, `${name}: Pk.Ka`);
  expectClose(ts.Pk.Kah, leg.R0.Pk.Kah, `${name}: Pk.Kah`);
  expectClose(ts.Pk.Kp, leg.R0.Pk.Kp, `${name}: Pk.Kp`);
  expectClose(ts.Pf.Ka, leg.R0.Pf.Ka, `${name}: Pf.Ka`);
  expectClose(ts.ko, leg.R0.ko, `${name}: ko`);

  // Stability (GG1 + FC2017)
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

  // RC elements
  expect(ts.RS.length, `${name}: RS.length`).toBe(leg.R0.RS.length);
  ts.RS.forEach((r, idx) => {
    const lr = leg.R0.RS[idx];
    expect(r.k, `${name}: RS[${idx}].k`).toBe(lr.k);
    expectClose(r.M, lr.M, `${name}: RS[${r.k}].M`);
    expectClose(r.V, lr.V, `${name}: RS[${r.k}].V`);
    expectClose(r.Asr, lr.Asr, `${name}: RS[${r.k}].Asr`);
    expectClose(r.Asp, lr.Asp, `${name}: RS[${r.k}].Asp`);
    expectClose(r.v, lr.v, `${name}: RS[${r.k}].v`);
    expectClose(r.vc, lr.vc, `${name}: RS[${r.k}].vc`);
    expect(r.ok, `${name}: RS[${r.k}].ok`).toBe(lr.ok);
  });

  // Stepped gravity section checks & mesh
  expect(ts.PL.length, `${name}: PL.length`).toBe(leg.R0.PL.length);
  ts.PL.forEach((p, idx) => {
    expectClose(p.Fot, leg.R0.PL[idx].Fot, `${name}: PL[${idx}].Fot`);
    expectClose(p.ek, leg.R0.PL[idx].ek, `${name}: PL[${idx}].ek`);
  });
  expect(ts.MS.length, `${name}: MS.length`).toBe(leg.R0.MS.length);

  // Accidental impact
  expect(!!ts.AI, `${name}: AI`).toBe(!!leg.R0.AI);
  if (ts.AI && leg.R0.AI) {
    expectClose(ts.AI.Fs, leg.R0.AI.Fs, `${name}: AI.Fs`);
    expectClose(ts.AI.Fo, leg.R0.AI.Fo, `${name}: AI.Fo`);
    expectClose(ts.AI.br.F, leg.R0.AI.br.F, `${name}: AI.br.F`);
  }

  // CR-3 BMD/SFD, curtailment, laps
  const tsDG = dgCalc(state, ts);
  const tsCU = dgCU(state, ts, tsDG);
  if (leg.DG) {
    expect(Object.keys(tsDG || {}).sort()).toEqual(Object.keys(leg.DG).sort());
    for (const k of Object.keys(leg.DG)) {
      const aPts = tsDG![k];
      const bPts = leg.DG[k];
      expect(aPts.length).toBe(bPts.length);
      for (let i = 0; i < bPts.length; i++) {
        expectClose(aPts[i].M, bPts[i].M, `${name}: DG[${k}][${i}].M`);
        expectClose(aPts[i].V, bPts[i].V, `${name}: DG[${k}][${i}].V`);
      }
    }
    for (const k of Object.keys(leg.CU)) {
      const ac = tsCU[k];
      const bc = leg.CU[k];
      expect(!!ac?.none, `${name}: CU[${k}].none`).toBe(!!bc?.none);
      if (ac && bc && !ac.none) {
        expectClose(ac.zc!, bc.zc, `${name}: CU[${k}].zc`);
        expectClose(ac.zt!, bc.zt, `${name}: CU[${k}].zt`);
      }
    }
    for (const r of ts.RS) {
      expect([lapReq(state, r.k), lapReq(state, r.k, 3)], `${name}: lap[${r.k}]`).toEqual(leg.laps[r.k]);
    }
  }

  // Check register row count & statuses
  const tsReg = regRows(state, ts);
  expect(tsReg.length, `${name}: regRows length`).toBe(leg.REG.length);
  tsReg.forEach((row, idx) => {
    expect(row.id).toBe(leg.REG[idx].id);
    expect(row.st).toBe(leg.REG[idx].st);
  });
}

describe('Exact Parity vs legacy/Retaining_Wall_Checker_v14.0.1.html', () => {
  const wallTypes: WallType[] = ['T', 'L', 'Li', 'G'];
  const methods: ('fc' | 'gg1')[] = ['fc', 'gg1'];

  for (const acc of methods) {
    for (const ty of wallTypes) {
      it(`default ${ty} wall (${acc})`, () => {
        const s = loadDefaultDesign(ty, { acc });
        compareCase(`default ${ty} ${acc}`, s);
      });
    }
  }

  it('Ka modes (Rankine, Coulomb, Manual) on T and G walls', () => {
    for (const ty of ['T', 'G'] as const) {
      for (const kam of ['r', 'c', 'm'] as const) {
        const s = loadDefaultDesign(ty, { acc: 'fc' });
        s.kam = kam;
        s.kaM = 0.3;
        s.kaMf = 0.33;
        compareCase(`${ty} kam=${kam}`, s);
      }
    }
  });

  it('CR-4 bearing capacity near slope crest (FC 2017 Fig. 2.3 & GG1 Fig. A4)', () => {
    for (const acc of ['fc', 'gg1'] as const) {
      const s = loadDefaultDesign('T', { acc });
      s.bf = -25;
      s.scon = 1;
      s.scb = 1.5;
      compareCase(`slope crest ${acc}`, s);
    }
  });

  it('Shear key, passive earth pressure, fence wind, fence self-weight (v13.8.13) & vehicle impact', () => {
    const s = loadDefaultDesign('T', { acc: 'fc' });
    s.skon = 1;
    s.skd = 0.7;
    s.skw = 0.6;
    s.skx = 1.2;
    s.nopp = 0;
    s.ppS = 1;
    s.ppO = 1;
    s.wo = 1;
    s.wh = 1.8;
    s.wsd = 0.6;
    s.fdl = 1;
    s.fdP = 6;
    s.fdS = 2.5;
    s.bro = 1;
    s.brc = 'v6C';
    s.vSO = 1;
    s.accI = 1;
    compareCase('key + wind + fence DL + vehicle impact', s);
  });

  it('Terraced stems on base and U-channel walls', () => {
    const ter = loadDefaultDesign('T', { acc: 'fc' });
    ter.Lt = 3.5;
    ter.xs = [{ x: 0.3, t: 0.35, h: 1.8, zt: 8.0, rc: 1, pp: 1 }];
    ter.xa = 'ter';
    compareCase('terraced 2-stem', ter);

    const u = loadDefaultDesign('T', { acc: 'gg1' });
    u.Lt = 3.8;
    u.Hf = 8.5;
    u.xs = [{ x: 0.25, t: 0.35, h: 2.2, zt: 6.6, rc: 1 }];
    u.xa = 'U';
    compareCase('U-channel gg1', u);
  });

  it('Stepped gravity wall with mass concrete stem + anti-crack mesh (CoP 9.6.5 & 9.3.1.1)', () => {
    const g1 = loadDefaultDesign('G', { acc: 'fc' });
    g1.gmr = 'cc';
    g1.gmb = '965';
    g1.st = [
      { t: 0.4, fb: 0, rb: 0, of: 0.2, top: 10.2, bot: 9.2, rc: 1 },
      { t: 0.8, fb: 0, rb: 0, of: 0.2, top: 9.2, bot: 8.4, rc: 0 },
    ];
    g1.gBh = 2.4;
    g1.gBt = 1.2;
    g1.gbf = 1.0;
    g1.gbr = 0.4;
    compareCase('stepped gravity + mesh 965', g1);

    const g2 = structuredClone(g1);
    g2.gmb = '913t';
    compareCase('stepped gravity + mesh 913t', g2);
  });

  it('CR-1 DXF R2000 section export matches legacy output byte-for-byte (1:100 and 1:50)', () => {
    for (const ty of ['T', 'G'] as const) {
      const s = loadDefaultDesign(ty, { acc: 'fc' });
      s.pn = 'J-2026';
      s.jno = 'Test Wall';
      for (const sc of [100, 50]) {
        const tsDxf = dxfText(s, { sc, name: `RW_${ty}` });
        const legDxf = legacy.evalDxf(s, sc, `RW_${ty}`);
        expect(tsDxf, `DXF ${ty} 1:${sc}`).toBe(legDxf);
      }
    }
  });

  it('DXF parser round-trips an exported DXF identically to legacy', () => {
    const s = loadDefaultDesign('T', { acc: 'fc' });
    const dxf = dxfText(s, { sc: 100, name: 'RW1' });
    const buf = new TextEncoder().encode(dxf);

    const P = dxParse(buf);
    const X = dxExtract(P);
    X.k = P.k;
    const V = dxViews(X);
    const C = dxCands(X, V);
    const G = dxGuess(X, V, C);

    const leg = legacy.evalDxfParse(buf);
    expect(P.ver).toBe(leg.ver);
    expect(P.k).toBe(leg.k);
    expect(X.T.length).toBe(leg.nT);
    expect(X.Dm.length).toBe(leg.nDm);
    expect(X.Gm.length).toBe(leg.nGm);
    expect(V.length).toBe(leg.nV);
    expect(C.lv.length).toBe(leg.nLv);
    expect(C.dm.length).toBe(leg.nDmC);
    expect(G).toEqual(leg.G);
  });

  it('Design Tools (lean, fullM, Auto-Optimizer, Critical Limits, Sensitivity, Auto-Bars) work deterministically', async () => {
    const s = loadDefaultDesign('T', { acc: 'fc' });
    const legT = legacy.evalTools(s);
    const tsLean = lean(s);
    const tsFull = fullM(s);
    expect(tsLean.err).toBeUndefined();
    expect(tsFull.err).toBeUndefined();
    if (!tsLean.err && !tsFull.err) {
      expectClose(tsLean.vol, legT.lean.vol, 'lean.vol');
      expectClose(tsLean.uls, legT.lean.uls, 'lean.uls');
      expectClose(tsFull.qmax, legT.fullM.qmax, 'fullM.qmax');
      expectClose(tsFull.steel, legT.fullM.steel, 'fullM.steel');
    }

    const opt = await runAutoOptimizer(s);
    expect(opt.best).toBeDefined();
    expect(opt.best!.m.okAll).toBe(true);

    const crit = calcCriticalLimits(s);
    expect(crit.w1).not.toBeNull();
    expect(crit.q1).not.toBeNull();

    const sens = runSensitivity(s);
    expect(sens).not.toBeNull();
    expect(sens!.rows.length).toBeGreaterThanOrEqual(4);

    const ab = autoBars(s);
    expect(ab.ok).toBe(true);
    const after = calcAll(ab.state);
    expect(after.err).toBeUndefined();
    if (!after.err) expect(after.okRC).toBe(true);
  });

  it('fillDef migrates pre-v10 gravity inputs and keeps calcAll pure (no caller state mutation)', () => {
    const raw = loadDefaultDesign('T', { acc: 'fc' });
    const snap = JSON.stringify(raw);
    calcAll(raw);
    expect(JSON.stringify(raw)).toBe(snap);

    const { state } = fillDef({ ty: 'T', Hr: 10, Zb: 6 });
    syncState(state);
    expect(state.ver).toBe(9);
    expect(state.r.gs).toBe(state.r.g);
  });
});
