/**
 * Built-in Benchmark Suite (BM1–BM5, 66 independent hand-calculated quantities).
 * Tolerance: 0.5% (BMTOL = 0.005).
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #3).
 */
import { calcAll } from './calcAll';
import { fillDef, syncState } from './helpers';
import type {
  BenchmarkCase,
  BenchmarkCaseResult,
  CalcAllSuccessResult,
} from './types';

export const BMTOL = 0.005;

export const BMK: BenchmarkCase[] = [
  {
    id: 'BM1',
    t: 'R.C. inverted-T wall, level backfill, dry, Rankine, global FOS (CoP Fdn 2017)',
    s: {
      acc: 'fc', gpon: 0, cmp: 0, comp: 0, wo: 0, bro: 0, skon: 0, lon: 0,
      qcat: 'c', q: 10, qin: 10, qinRC: 1, kam: 'r', dwm: 'auto', dbm: 'cv',
      r: { c: 0, phi: 30, g: 19, gs: 19 },
      f: { c: 0, phi: 35, cvm: 'c', cv: 30, g: 20, gs: 20 },
      fsm: 1, br: 0, bf: 0, bon: 1, fon: 1, nopp: 1, ppS: 1, ppO: 0, ppB: 0,
      dp: 0.5, obdp: 1, dfm: 'front', tsw: 1, Zb: 0, wl: '0', fw: -5,
      cvS: 50, cvt: 50, cbs: 'blind', fcu: 40, fy: 500, rck: 'ko', kom: 0, ocr: 1,
      xs: [], xa: 'ter', Fs: 1.5, Fo: 2, Fow: 1.5, Fb: 3, gwc: 'ant', gc: 24,
      gm: 1.2, gq: 1.5, hnr: 0, accI: 0, geo3: 1, gB: 2.4, ty: 'T', Hr: 5, Hf: 1.5,
      Lt: 1, Lh: 2.4, tb: 0.6,
      st: [{ t: 0.4, fb: 0, rb: 0, of: 0, top: 5, bot: 0.6, rc: 1 }],
      rc: { s0: { d: 20, s: 150, d2: 12, s2: 200, d3: 12, s3: 200 } },
    },
    q: [
      ['Ka', 0.3333333], ['H', 95.83333], ['N', 305.6], ['Mr', 680.32],
      ['Mo', 173.6111], ['e', 0.2419212], ['Fsl', 1.841095], ['Fot', 3.918643],
      ['Fbr', 11.20989], ['qu', 828.8475], ['M', 266.2645], ['V', 163.944], ['As', 1933.108],
    ],
  },
  {
    id: 'BM2',
    t: 'BM1 with design GWL at ½ retained height (water pressure + uplift)',
    s: {
      acc: 'fc', gpon: 0, cmp: 0, comp: 0, wo: 0, bro: 0, skon: 0, lon: 0,
      qcat: 'c', q: 10, qin: 10, qinRC: 1, kam: 'r', dwm: 'auto', dbm: 'cv',
      r: { c: 0, phi: 30, g: 19, gs: 19 },
      f: { c: 0, phi: 35, cvm: 'c', cv: 30, g: 20, gs: 20 },
      fsm: 1, br: 0, bf: 0, bon: 1, fon: 1, nopp: 1, ppS: 1, ppO: 0, ppB: 0,
      dp: 0.5, obdp: 1, dfm: 'front', tsw: 1, Zb: 0, wl: '0.5', fw: 0,
      cvS: 50, cvt: 50, cbs: 'blind', fcu: 40, fy: 500, rck: 'ko', kom: 0, ocr: 1,
      xs: [], xa: 'ter', Fs: 1.5, Fo: 2, Fow: 1.5, Fb: 3, gwc: 'ant', gc: 24,
      gm: 1.2, gq: 1.5, hnr: 0, accI: 0, geo3: 1, gB: 2.4, ty: 'T', Hr: 5, Hf: 1.5,
      Lt: 1, Lh: 2.4, tb: 0.6,
      st: [{ t: 0.4, fb: 0, rb: 0, of: 0, top: 5, bot: 0.6, rc: 1 }],
      rc: { s0: { d: 20, s: 150, d2: 12, s2: 200, d3: 12, s3: 200 } },
    },
    q: [
      ['Ka', 0.3333333], ['H', 116.2708], ['N', 259.0025], ['Mr', 680.32],
      ['Mo', 308.6894], ['e', 0.4651465], ['Fsl', 1.286094], ['Fot', 2.203898],
      ['Fbr', 4.26681], ['qu', 319.7604], ['Fup', 4.372195], ['M', 274.1147],
      ['V', 176.3389], ['As', 1994.797],
    ],
  },
  {
    id: 'BM3',
    t: 'Rectangular mass concrete wall, Coulomb δ = 2φ′/3, level backfill, dry',
    s: {
      acc: 'fc', gpon: 0, cmp: 0, comp: 0, wo: 0, bro: 0, skon: 0, lon: 0,
      qcat: 'c', q: 10, qin: 10, qinRC: 1, kam: 'c', dwm: 'auto', dbm: 'cv',
      r: { c: 0, phi: 30, g: 19, gs: 19 },
      f: { c: 0, phi: 35, cvm: 'c', cv: 30, g: 20, gs: 20 },
      fsm: 1, br: 0, bf: 0, bon: 1, fon: 1, nopp: 1, ppS: 1, ppO: 0, ppB: 0,
      dp: 0.5, obdp: 1, dfm: 'front', tsw: 1, Zb: 0, wl: '0', fw: -5,
      cvS: 50, cvt: 50, cbs: 'blind', fcu: 40, fy: 500, rck: 'ko', kom: 0, ocr: 1,
      xs: [], xa: 'ter', Fs: 1.5, Fo: 2, Fow: 1.5, Fb: 3, gwc: 'ant', gc: 24,
      gm: 1.2, gq: 1.5, hnr: 0, accI: 0, geo3: 1, gB: 2, ty: 'G', Hr: 3, Hf: 0.5,
      st: [], gbf: 0, gbr: 0, gBt: 2, gBh: 3, tb: 3,
    },
    q: [
      ['Ka', 0.2973139], ['Kah', 0.2793836], ['H', 32.26881], ['N', 152.6943],
      ['Mr', 144], ['Mo', 19.07103], ['e', 0.1818359], ['Fsl', 2.73199],
      ['Fot', 7.550719], ['Fbr', 4.131485], ['qu', 385.5303],
    ],
  },
  {
    id: 'BM4',
    t: 'Mass concrete wall, front + back batter (α > 0), β = 15°, GWL ½H – GG1 Fig. 17 & 39',
    s: {
      acc: 'fc', gpon: 0, cmp: 0, comp: 0, wo: 0, bro: 0, skon: 0, lon: 0,
      qcat: 'c', q: 10, qin: 10, qinRC: 1, kam: 'c', dwm: 'auto', dbm: 'cv',
      r: { c: 0, phi: 30, g: 19, gs: 19 },
      f: { c: 0, phi: 35, cvm: 'c', cv: 30, g: 20, gs: 20 },
      fsm: 1, br: 15, bf: 0, bon: 1, fon: 1, nopp: 1, ppS: 1, ppO: 0, ppB: 0,
      dp: 0.5, obdp: 1, dfm: 'front', tsw: 1, Zb: 0, wl: '0.5', fw: 0,
      cvS: 50, cvt: 50, cbs: 'blind', fcu: 40, fy: 500, rck: 'ko', kom: 0, ocr: 1,
      xs: [], xa: 'ter', Fs: 1.5, Fo: 2, Fow: 1.5, Fb: 3, gwc: 'ant', gc: 24,
      gm: 1.2, gq: 1.5, hnr: 0, accI: 0, geo3: 1, gB: 2.4, ty: 'G', Hr: 3, Hf: 1,
      st: [], gbf: 0.3, gbr: 0.6, gBt: 1.5, gBh: 3, tb: 3,
    },
    q: [
      ['al', 11.30993], ['Ka', 0.4971658], ['Kah', 0.424763], ['H', 55.40858],
      ['N', 144.4378], ['Mr', 158.7621], ['Mo', 39.74232], ['e', 0.3759789],
      ['Fsl', 1.505023], ['Fot', 3.994786], ['Fbr', 2.716886], ['qu', 220.9445], ['Fup', 6.119823],
    ],
  },
  {
    id: 'BM5',
    t: 'R.C. L-wall, GG1 partial factor method (γm = 1.2, γq = 1.5)',
    s: {
      acc: 'gg1', gpon: 0, cmp: 0, comp: 0, wo: 0, bro: 0, skon: 0, lon: 0,
      qcat: 'c', q: 10, qin: 10, qinRC: 1, kam: 'r', dwm: 'auto', dbm: 'cv',
      r: { c: 0, phi: 30, g: 19, gs: 19 },
      f: { c: 0, phi: 35, cvm: 'c', cv: 30, g: 20, gs: 20 },
      fsm: 1, br: 0, bf: 0, bon: 1, fon: 1, nopp: 1, ppS: 1, ppO: 0, ppB: 0,
      dp: 0.5, obdp: 1, dfm: 'front', tsw: 1, Zb: 0, wl: '0', fw: -5,
      cvS: 50, cvt: 50, cbs: 'blind', fcu: 40, fy: 500, rck: 'ko', kom: 0, ocr: 1,
      xs: [], xa: 'ter', Fs: 1.5, Fo: 2, Fow: 1.5, Fb: 3, gwc: 'ant', gc: 24,
      gm: 1.2, gq: 1.5, hnr: 0, accI: 0, geo3: 1, gB: 2.4, ty: 'L', Hr: 4, Hf: 1,
      Lt: 0, Lh: 2.6, tb: 0.5,
      st: [{ t: 0.35, fb: 0, rb: 0, of: 0, top: 4, bot: 0.5, rc: 1 }],
      rc: { s0: { d: 16, s: 150, d2: 12, s2: 200, d3: 12, s3: 200 } },
    },
    q: [
      ['Kaf', 0.3951331], ['phf', 30.26383], ['db', 25.69338], ['gH', 83.76822],
      ['gN', 237.7], ['gMr', 342.645], ['gMo', 127.4963], ['usl', 0.7324736],
      ['gFot', 2.68749], ['ubr', 0.6766917], ['gqu', 194.0434], ['eS', 0.4298894],
      ['M', 144.0396], ['V', 109.4625], ['As', 1193.675],
    ],
  },
];

export const BQ: Record<string, [string, string, (R: CalcAllSuccessResult) => number]> = {
  Ka: ['Ka', '', (R) => R.Pk.Ka],
  Kah: ['Kah = Ka·cos(α + δ)', '', (R) => R.Pk.Kah],
  al: ['α – Pa plane to the vertical (GG1 Fig. 39)', '°', (R) => R.Pk.al],
  H: ['ΣH – horizontal thrust', 'kN/m', (R) => R.Fc.sl.s.H],
  N: ['N = ΣV − U', 'kN/m', (R) => R.Fc.sl.s.N],
  Mr: ['Mr – restoring moment about the toe', 'kNm/m', (R) => R.Fc.sl.s.Mr],
  Mo: ['Mo – overturning moment about the toe (GG1 Fig. 39)', 'kNm/m', (R) => R.Fc.sl.s.Md],
  e: ['e – eccentricity', 'm', (R) => R.Fc.sl.s.e],
  Fsl: ['FOS sliding', '', (R) => R.Fc.sl.F],
  Fot: ['FOS overturning', '', (R) => R.Fc.ot.F],
  Fbr: ['FOS bearing', '', (R) => R.Fc.br.F],
  qu: ['q_ult', 'kPa', (R) => R.Fc.br.qu],
  Fup: ['FOS uplift', '', (R) => R.Fc.up.r],
  M: ['Stem base M (1.4E + 1.6Q, Ko)', 'kNm/m', (R) => R.RS.find((e) => e.k === 's0')!.M],
  V: ['Stem base V', 'kN/m', (R) => R.RS.find((e) => e.k === 's0')!.V],
  As: ['Stem As,req', 'mm²/m', (R) => R.RS.find((e) => e.k === 's0')!.Asr],
  Kaf: ['Ka (factored φ′)', '', (R) => R.Pf.Kah],
  phf: ['φ′ founding (factored)', '°', (R) => R.Pf.phf],
  db: ['δb (factored φ′cv)', '°', (R) => R.Pf.db],
  gH: ['ΣH (γQ = 1.5 on surcharge)', 'kN/m', (R) => R.A.sl.Fa],
  gN: ['N', 'kN/m', (R) => R.A.sl.s.N],
  gMr: ['Mr about the toe', 'kNm/m', (R) => R.A.ot.s.Mr],
  gMo: ['Mo about the toe', 'kNm/m', (R) => R.A.ot.s.Md],
  usl: ['Sliding utilisation', '', (R) => R.A.sl.u],
  gFot: ['Overturning Mr / Mo', '', (R) => R.A.ot.F],
  ubr: ['Bearing utilisation', '', (R) => R.A.br.u],
  gqu: ['q_ult (factored strength)', 'kPa', (R) => R.A.br.r.qu],
  eS: ['e (SLS, unfactored)', 'm', (R) => R.A.sls.s.e],
};

export function benchRun(): BenchmarkCaseResult[] {
  const out: BenchmarkCaseResult[] = [];
  for (const c of BMK) {
    const { state } = fillDef(c.s);
    syncState(state);
    let R: CalcAllSuccessResult | null = null;
    let er = '';
    try {
      const res = calcAll(state);
      if (res.err) er = res.V.E.join('; ');
      else R = res;
    } catch (x) {
      er = String(x);
    }
    const rows = c.q.map(([key, ref]) => {
      const [l, u, getter] = BQ[key];
      let m = NaN;
      if (!er && R) {
        try {
          m = +getter(R);
        } catch {
          m = NaN;
        }
      }
      const d = Math.abs(m - ref) / Math.max(Math.abs(ref), 1e-6);
      return { key, l, u, ref, m, d, ok: Number.isFinite(d) && d <= BMTOL };
    });
    out.push({
      c,
      er,
      rows,
      ok: !er && rows.every((r) => r.ok),
      mx: Math.max(...rows.map((r) => (Number.isFinite(r.d) ? r.d : 1))),
    });
  }
  return out;
}
