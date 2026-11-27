/**
 * Design Tools evaluators: lean(), fullM(), Auto-Optimizer, Live Stress & Critical Limits,
 * Sensitivity Tornado, Auto-Bars, Geometry Repair, and Two-Pass Auto-Design.
 * All evaluations run the exact same calculation engine on cloned states.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { calcAll } from './calcAll';
import { ABD, ABD2, ABS, UN } from './constants';
import { concArea, geo } from './geometry';
import { isG, phiCv, qVal, rcv, stTT, syncState, syncedClone, wlLev } from './helpers';
import { cl, dd, f } from './math';
import { anch, dsg } from './rcDesign';
import { fc17, gg1, qDist, slsE, utilOf } from './stability';
import { applyWallType, wizBuild, wizErr, wzFromS, wzVal } from './stateOps';
import type {
  CriticalLimit,
  CriticalLimitsResult,
  FullMetricsResult,
  LeanResult,
  LeanSuccessResult,
  OptimizeCandidate,
  OptimizeOptions,
  OptimizeResult,
  RcBarSet,
  SensitivityResult,
  UtilResult,
  WallState,
} from './types';
import { validate } from './validate';

export function lean(rawState: WallState): LeanResult {
  const S = syncedClone(rawState);
  const V = validate(S);
  if (V.E.length) return { err: V.E };
  const P = S.acc === 'gg1';
  const G = geo(S);
  const A = P ? gg1(S) : { sls: slsE(S) };
  const Fc = P ? null : fc17(S);
  const u = utilOf(S, A, Fc, P, G.B);
  return { ...u, G, P, A, Fc, vol: concArea(S, G) };
}

export function fullM(rawState: WallState): FullMetricsResult {
  const S = syncedClone(rawState);
  const c = calcAll(S);
  if (c.err) return { err: c.V.E };
  const se = c.A.sls;
  const qd = qDist(se.s.N, se.s.e, c.G.B);
  return {
    ty: S.ty,
    acc: S.acc,
    B: c.G.B,
    vol: c.vol,
    steel: c.steel,
    qmax: Math.max(qd(0), qd(c.G.B)),
    u: c.u,
    rcU: c.RS.length ? Math.max(...c.RS.map((r) => Math.max(r.uM, r.uV))) : null,
    ok: !c.fails.length,
    fails: c.fails,
    X: c.X,
  };
}

export const govN = (m: Pick<UtilResult, 'sl' | 'ot' | 'br' | 'up'> | null): string => {
  if (!m) return '–';
  let k: 'sl' | 'ot' | 'br' | 'up' = 'sl';
  for (const x of ['ot', 'br', 'up'] as const) if (m[x] > m[k]) k = x;
  return UN[k];
};

const yieldUI = () => new Promise<void>((r) => setTimeout(r, 0));

/** Auto-Optimizer – minimum concrete volume (exact port of runOpt) */
export async function runAutoOptimizer(
  rawState: WallState,
  opts: OptimizeOptions = {},
  onProgress?: (pct: number) => void,
): Promise<OptimizeResult> {
  const base = syncedClone(rawState);
  const key = JSON.stringify(rawState);
  const G0 = geo(base);
  const H = Math.max(1, base.Hr - base.Zb);
  const G1 = isG(base);
  const XSo = !G1 && base.xs && base.xs.length > 0;
  const useT = base.ty !== 'L' && !G1 && !XSo && !base.flim;
  const useH = base.ty !== 'Li' && !G1;
  const Lmax = +Math.max(2 * H + 2, 4).toFixed(2);
  const stp = 0.05;
  const r2 = (v: number) => +(Math.round(v / stp) * stp).toFixed(2);

  const tbMin = opts.tbMin ?? +Math.max(0.3, +base.tb - 0.2).toFixed(2);
  const tbMax = opts.tbMax ?? +(+base.tb + 0.4).toFixed(2);
  const tbs =
    G1 || !opts.optTb
      ? null
      : (() => {
          const a: number[] = [];
          const lo = Math.max(0.2, Math.min(tbMin, tbMax));
          const hi = Math.max(tbMin, tbMax);
          for (let t = lo; t <= hi + 1e-9; t += stp) a.push(r2(t));
          return a;
        })();

  let n = 0;
  let best: OptimizeCandidate | null = null;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const tot = (tbs ? tbs.length : 1) * (useT && useH ? (Lmax / 0.25 + 12) * 10 : 12);

  const mk = (Lt: number, Lh: number, tb: number | null, gw?: number): WallState => {
    const t = structuredClone(base);
    if (useT) t.Lt = Lt;
    if (useH) t.Lh = Lh;
    if (tb != null) t.tb = tb;
    if (G1 && gw != null) t.gBt = gw;
    return t;
  };

  const test = async (t: WallState): Promise<LeanSuccessResult | null> => {
    n++;
    if (onProgress && n % 12 === 0) {
      onProgress(Math.min(99, (100 * n) / tot));
      await yieldUI();
    }
    const m = lean(t);
    return m.err ? null : m;
  };

  const ok = (m: LeanSuccessResult | null): m is LeanSuccessResult => !!m && m.okAll;

  const minVar = async (
    make: (v: number) => WallState,
    loInit: number,
    hiInit: number,
  ): Promise<{ v: number; m: LeanSuccessResult } | null> => {
    let lo = loInit;
    let hi = hiInit;
    let mh = await test(make(hi));
    if (!ok(mh)) return null;
    const ml = await test(make(lo));
    if (ok(ml)) return { v: lo, m: ml };
    while (hi - lo > stp + 1e-9) {
      const mid = r2((lo + hi) / 2);
      if (mid <= lo + 1e-9 || mid >= hi - 1e-9) break;
      const mm = await test(make(mid));
      if (ok(mm)) {
        hi = mid;
        mh = mm;
      } else {
        lo = mid;
      }
    }
    return { v: r2(hi), m: mh };
  };

  const consider = (
    t: WallState,
    m: LeanSuccessResult,
    rec: { Lt?: number; Lh?: number; tb: number; gw?: number },
  ) => {
    if (opts.optRc) {
      const fm = fullM(t);
      if (fm.err || !fm.ok) return;
    }
    if (!best || m.vol < best.vol - 1e-9 || (Math.abs(m.vol - best.vol) < 1e-9 && m.G.B < best.B)) {
      best = { ...rec, m, vol: m.vol, B: m.G.B };
    }
  };

  for (const tb of tbs || [null]) {
    if (G1) {
      const loG = (() => {
        const ns = base.st.length;
        const s = base.st[ns - 1];
        return Math.max(0.3, ns ? (+s.of || 0) + +s.t : 0.3);
      })();
      const r = await minVar((v) => mk(0, 0, null, v), loG, Lmax);
      if (r) consider(mk(0, 0, null, r.v), r.m, { gw: r.v, tb: +base.tb });
      continue;
    }
    if (useT && useH) {
      let bt: { Lt: number; Lh: number; m: LeanSuccessResult } | null = null;
      for (let Lt = 0; Lt <= Lmax + 1e-9; Lt += 0.25) {
        const L = r2(Lt);
        if (bt && L + G0.tl >= bt.m.G.B) break;
        const r = await minVar((v) => mk(L, v, tb), 0, Lmax);
        if (r && (!bt || r.m.vol < bt.m.vol)) bt = { Lt: L, Lh: r.v, m: r.m };
      }
      if (!bt) continue;
      for (let Lt = Math.max(0, bt.Lt - 0.2); Lt <= bt.Lt + 0.2 + 1e-9; Lt += stp) {
        const L = r2(Lt);
        if (L === bt.Lt) continue;
        const r = await minVar((v) => mk(L, v, tb), 0, Lmax);
        if (r && r.m.vol < bt.m.vol - 1e-9) bt = { Lt: L, Lh: r.v, m: r.m };
      }
      consider(mk(bt.Lt, bt.Lh, tb), bt.m, { Lt: bt.Lt, Lh: bt.Lh, tb: tb ?? +base.tb });
    } else if (useH) {
      const r = await minVar((v) => mk(0, v, tb), 0, Lmax);
      if (r) consider(mk(0, r.v, tb), r.m, { Lt: 0, Lh: r.v, tb: tb ?? +base.tb });
    } else if (useT) {
      const r = await minVar((v) => mk(v, 0, tb), 0, Lmax);
      if (r) consider(mk(r.v, 0, tb), r.m, { Lt: r.v, Lh: 0, tb: tb ?? +base.tb });
    }
  }

  const cm = lean(base);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return best
    ? {
        key,
        G1,
        n,
        ms: now - t0,
        cur: {
          Lt: G0.Lt,
          Lh: G0.hl,
          tb: +base.tb,
          gw: +base.gBt,
          B: G0.B,
          vol: cm.err ? NaN : cm.vol,
          m: cm,
        },
        best: { ...best, tb: best.tb ?? +base.tb },
      }
    : { none: 1, Lmax, tbs, key };
}

/** Build stressed state for GWT / surcharge slider */
export function buildStressState(S: WallState, wl?: number | null, q?: number | null): WallState {
  const t = structuredClone(S);
  if (wl != null) {
    t.wl = 'c';
    t.wlZ = wl;
  }
  if (q != null) {
    t.qcat = 'c';
    t.q = q;
  }
  return t;
}

/** Critical GWT & surcharge failure thresholds by 22-step bisection (exact port of critHTML) */
export function calcCriticalLimits(rawState: WallState): CriticalLimitsResult {
  const t = syncedClone(rawState);
  const Zb = +t.Zb;
  const Hr = +t.Hr;
  const mkW = (L: number) => {
    const x = structuredClone(t);
    x.wl = 'c';
    x.wlZ = L;
    return x;
  };
  const fw = (L: number) => lean(mkW(L));
  const crit = (
    fz: (v: number) => LeanResult,
    loInit: number,
    hiInit: number,
    okf: (m: LeanSuccessResult) => boolean,
  ): CriticalLimit | null => {
    let lo = loInit;
    let hi = hiInit;
    const a = fz(hi);
    const b = fz(lo);
    if (!a || a.err || !b || b.err) return null;
    if (okf(a)) return { none: 1 };
    if (!okf(b)) return { all: 1, m: b };
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      const fm = fz(mid);
      if (!fm.err && okf(fm)) lo = mid;
      else hi = mid;
    }
    const fhi = fz(hi);
    return { v: lo, m: fhi.err ? undefined : fhi };
  };

  const U = (m: LeanSuccessResult) => m.okULS;
  const E = (m: LeanSuccessResult) => m.ec <= 1 + 1e-9;
  const w1 = crit(fw, Zb, Hr, U);
  const w2 = crit(fw, Zb, Hr, E);
  const qMax = Math.max(500, 4 * qVal(t));
  const fq = (v: number) => {
    const x = structuredClone(t);
    x.qcat = 'c';
    x.q = v;
    return lean(x);
  };
  const q1 = crit(fq, 0, qMax, U);
  return { w1, w2, q1, qMax };
}

/** One-at-a-time sensitivity tornado (exact port of runTorn) */
export function runSensitivity(rawState: WallState): SensitivityResult | null {
  const S = syncedClone(rawState);
  const b = lean(S);
  if (b.err) return null;
  const Zb = +S.Zb;
  const Hr = +S.Hr;
  const wl0 = wlLev(S);
  const q0 = qVal(S);
  const qi0 = +S.qin || 0;
  const cv0 = S.dbm === 'c' ? +S.dcb : phiCv(S);
  const scv = (t: WallState, v: number) => {
    if (t.dbm === 'c') t.dcb = v;
    else t.f.cv = v;
  };
  const P: [string, (t: WallState) => void, (t: WallState) => void, string][] = [
    ['φ′ backfill', (t) => { t.r.phi -= 2; }, (t) => { t.r.phi += 2; }, `${S.r.phi - 2}° / ${S.r.phi + 2}°`],
    [`φ′ foundation${S.fsm ? ' & front soil' : ''}`, (t) => { t.f.phi -= 2; }, (t) => { t.f.phi += 2; }, `${S.f.phi - 2}° / ${S.f.phi + 2}°`],
    ['φcv′ (base friction δb)', (t) => scv(t, cv0 - 2), (t) => scv(t, cv0 + 2), `${cv0 - 2}° / ${cv0 + 2}°`],
    ...(S.bon
      ? [
          [
            'Retained GWT',
            (t: WallState) => {
              t.wl = 'c';
              t.wlZ = cl(wl0 - 1, Zb, Hr);
            },
            (t: WallState) => {
              t.wl = 'c';
              t.wlZ = cl(wl0 + 1, Zb, Hr);
            },
            `+${f(cl(wl0 - 1, Zb, Hr))} / +${f(cl(wl0 + 1, Zb, Hr))} mPD`,
          ] as [string, (t: WallState) => void, (t: WallState) => void, string],
        ]
      : []),
    [
      'Surcharge',
      (t) => {
        t.qcat = 'c';
        t.q = Math.max(0, q0 - 10);
        t.qin = Math.max(0, qi0 - 10);
      },
      (t) => {
        t.qcat = 'c';
        t.q = q0 + 10;
        t.qin = qi0 + 10;
      },
      `${f(Math.max(0, q0 - 10), 0)} / ${f(q0 + 10, 0)} kPa`,
    ],
  ];
  const run = (fn: (t: WallState) => void): LeanSuccessResult | null => {
    const t = structuredClone(S);
    fn(t);
    const m = lean(t);
    return m.err ? null : m;
  };
  return {
    key: JSON.stringify(rawState),
    base: b,
    rows: P.map(([n, lo, hi, lab]) => ({ n, lab, lo: run(lo), hi: run(hi) })),
  };
}

/** Auto-bar target utilisation */
export const utT = (S: WallState): number => cl(+S.utgt || 80, 50, 100) / 100;

/** Automatic reinforcement selector (exact port of autoBars; returns updated state + log) */
export function autoBars(
  rawState: WallState,
  only?: string,
): { ok: boolean; state: WallState; log: string[] } {
  const S = syncedClone(rawState);
  const log: string[] = [];
  const R0 = calcAll(S);
  if (R0.err) return { ok: false, state: S, log };
  const grp: Record<string, typeof R0.RS> = {};
  const UT = utT(S);
  for (const e of R0.RS) (grp[e.k] = grp[e.k] || []).push(e);

  for (const [k, es] of Object.entries(grp)) {
    if (only && only !== k) continue;
    const sv0 = S.rc[k];
    const cur = rcv(S, k);
    const base = es.map((e) => ({
      k: e.k,
      n: e.n,
      h: e.h,
      M: e.M,
      V: e.V,
      cm: e.cm,
      co: e.co,
      ty: e.ty,
      gv: e.gv,
      bad: e.bad,
      fn: e.fn,
      me: e.me,
      gov: e.gov,
    }));
    const A = (d: number, s: number) => ((Math.PI * d * d) / 4) * (1000 / s);
    const okSet = (o: RcBarSet, lM: number, lV: number) => {
      S.rc[k] = o;
      try {
        return base.every((b) => {
          const c = dsg(S, { ...b });
          return c.ok && c.uM <= lM + 1e-9 && c.uV <= lV + 1e-9 && (!(isG(S) && /^s\d+$/.test(k)) || anch(S, c).ok);
        });
      } finally {
        if (sv0 === undefined) delete S.rc[k];
        else S.rc[k] = sv0;
      }
    };
    const uOf = (o: RcBarSet) => {
      S.rc[k] = o;
      try {
        let m = 0;
        let v = 0;
        for (const b of base) {
          const c = dsg(S, { ...b });
          m = Math.max(m, c.uM);
          v = Math.max(v, c.uV);
        }
        return { m, v };
      } finally {
        if (sv0 === undefined) delete S.rc[k];
        else S.rc[k] = sv0;
      }
    };
    const srch = (lM: number, lV: number) => {
      let best: { o: RcBarSet; w: number } | null = null;
      for (const d of ABD) {
        for (const s of ABS) {
          if (best && A(d, s) > best.w) continue;
          for (const s3 of ABS) {
            if (best && A(d, s) + A(d, s3) > best.w) continue;
            for (const d2 of ABD2) {
              for (const s2 of ABS) {
                const w = A(d, s) + A(d, s3) + 2 * A(d2, s2);
                if (best && w >= best.w) continue;
                const o: RcBarSet = { d, s, d2, s2, d3: d, s3 };
                if (okSet(o, lM, lV)) best = { o, w };
              }
            }
          }
        }
      }
      return best;
    };

    let best = srch(UT, UT);
    let miss = 0;
    if (!best && UT < 1) {
      best = srch(UT, 1);
      miss = best ? 1 : 0;
      if (!best) {
        best = srch(1, 1);
        miss = best ? 2 : 0;
      }
    }
    const nm = es[0].n.replace(/ – (top|bottom) face$/, '');
    if (!best) {
      log.push(`${nm}: no bar set within T12–T40 @100–300 passes – change the section`);
      continue;
    }
    const t = (o: RcBarSet) => `T${o.d}@${o.s} / T${o.d2}@${o.s2} EF / T${o.d3}@${o.s3}`;
    const uu = uOf(best.o);
    const pc = (x: number) => f(100 * x, 0) + '%';
    if (t(cur) !== t(best.o)) {
      log.push(`${nm}: ${t(cur)} → <b>${t(best.o)}</b> (utilisation ${pc(Math.max(uu.m, uu.v))})`);
    }
    if (miss === 1) {
      log.push(
        `${nm}: shear v/vc = ${pc(uu.v)} is above the ${pc(UT)} target for every bar set – set by the section thickness (thicken the section to reach the target); bending kept ≤ ${pc(UT)}`,
      );
    }
    if (miss === 2) {
      log.push(
        `${nm}: target utilisation ≤ ${pc(UT)} not reachable with T12–T40 @100–300; the lightest passing set is used (utilisation ${pc(Math.max(uu.m, uu.v))})`,
      );
    }
    S.rc[k] = best.o;
  }

  if (isG(S) && S.gmr === 'cc' && (!only || only === 'mesh')) {
    const R1 = calcAll(S);
    const MS = !R1.err ? R1.MS || [] : [];
    const P: Record<'v' | 'h' | 't' | 'b', ['mvd' | 'mhd' | 'mtd' | 'mbd', 'mvs' | 'mhs' | 'mts' | 'mbs']> = {
      v: ['mvd', 'mvs'],
      h: ['mhd', 'mhs'],
      t: ['mtd', 'mts'],
      b: ['mbd', 'mbs'],
    };
    for (const [k, [pd, ps]] of Object.entries(P) as [
      'v' | 'h' | 't' | 'b',
      ['mvd' | 'mhd' | 'mtd' | 'mbd', 'mvs' | 'mhs' | 'mts' | 'mbs'],
    ][]) {
      const rows = MS.filter((m) => m.k === k);
      if (!rows.length) continue;
      const need = Math.max(...rows.map((m) => (m.tot ? m.need / 2 : m.need)));
      let b: { d: number; sp: number; a: number } | null = null;
      for (const d of [10, 12, 16, 20, 25, 32]) {
        for (const sp of ABS) {
          const a = ((Math.PI * d * d) / 4) * (1000 / sp);
          if (a >= need - 1e-6 && (!b || a < b.a)) b = { d, sp, a };
        }
      }
      if (!b) continue;
      if (+S[pd] !== b.d || +S[ps] !== b.sp) {
        log.push(`${rows[0].lab}: T${S[pd]}@${S[ps]} → <b>T${b.d}@${b.sp}</b>`);
      }
      S[pd] = b.d;
      S[ps] = b.sp;
    }
  }
  return { ok: true, state: S, log };
}

/** Repair obvious invalid geometry inputs (exact port of repairGeo) */
export function repairGeo(rawState: WallState): { state: WallState; log: string[] } {
  const S = structuredClone(rawState);
  const log: string[] = [];
  const r2 = (x: number) => +(+x).toFixed(3);
  if (S.ty === 'L' && S.xs.length) {
    S.Lt = 0;
    applyWallType(S, 'T');
    log.push('L-wall with stems on base → inverted T (toe added)');
  }
  if (!isG(S)) {
    if (+S.Lt < 0) {
      S.Lt = 0;
      log.push('toe length set to 0');
    }
    if (+S.Lh < 0) {
      S.Lh = 0;
      log.push('heel length set to 0');
    }
    if (!(+S.tb > 0)) {
      S.tb = 0.4;
      log.push('base thickness set to 0.40 m');
    }
  } else {
    if (!(+S.gBt > 0)) {
      S.gBt = 1;
      log.push('block top width set to 1.0 m');
    }
    if (+S.gbf < 0) S.gbf = 0;
    if (+S.gbr < 0) S.gbr = 0;
    if (!(+S.gBh > 0)) {
      S.gBh = r2(Math.max(0.5, 0.8 * (S.Hr - S.Zb)));
      log.push('block height reset');
    }
  }
  S.st.forEach((q, i) => {
    if (!(+q.t > 0)) {
      q.t = 0.3;
      log.push(`stem ${i + 1} width set to 0.30 m`);
    }
    if (+q.fb < 0) q.fb = 0;
    if (+q.rb < 0) q.rb = 0;
    if (!(stTT(q) > 1e-3)) {
      q.fb = 0;
      q.rb = 0;
      log.push(`stem ${i + 1} batters removed (top width ≤ 0)`);
    }
  });
  syncState(S);
  let G = geo(S);
  if (S.bon && +S.Hr > G.top + 1e-6) {
    if (S.st.length) {
      S.st[0].top = r2(S.Hr);
      log.push(`wall top raised to the retained level +${dd(+S.Hr)}`);
    } else if (isG(S)) {
      S.gBh = r2(S.Hr - S.Zb);
      log.push('block raised to the retained level');
    }
    syncState(S);
  }
  if (S.fon && +S.Hf > +S.Hr) {
    S.Hf = +S.Hr;
    log.push('front ground lowered to the retained level');
  }
  if (!isG(S) && S.xs.length) {
    if (S.xa === 'U' && S.xs.length > 1) {
      S.xs = S.xs.slice(0, 1);
      log.push('U-channel: extra stems on base removed');
    }
    if (S.xs.length > 2) {
      S.xs = S.xs.slice(0, 2);
      log.push('only 2 stems on base kept');
    }
    let x = 0;
    S.xs.forEach((q, j) => {
      if (!(+q.t > 0)) q.t = 0.3;
      if (!(+q.h > 0)) q.h = 0.5;
      if (+q.x < x) {
        q.x = r2(x);
        log.push(`stem on base ${j + 1} moved to x = ${dd(q.x)} m`);
      }
      syncState(S);
      const a = geo(S).XS[j];
      x = a.xm + 0.5;
      if (S.xa !== 'U') {
        if (+q.zt < a.bot) q.zt = r2(a.bot);
        if (+q.zt > a.top + 1e-6) {
          const u = q.up && q.up.length ? q.up[q.up.length - 1] : q;
          u.h = r2(+u.h + (+q.zt - a.top));
          log.push(`stem on base ${j + 1} raised to its terrace level`);
        }
      }
    });
    syncState(S);
    G = geo(S);
    const lx = G.XS[G.XS.length - 1].xm + 1;
    if (lx > G.Lt + 1e-6) {
      S.Lt = r2(+S.Lt + (lx - G.Lt));
      log.push(`main stem moved back – toe ${dd(S.Lt)} m to fit the stems on base`);
    }
    syncState(S);
    G = geo(S);
    if (S.fon && +S.Hf > G.XS[0].top + 1e-6) {
      const q = S.xs[0];
      const u = q.up && q.up.length ? q.up[q.up.length - 1] : q;
      u.h = r2(+u.h + (+S.Hf - G.XS[0].top));
      log.push('stem on base 1 raised to the front ground level');
    }
  }
  if (S.wl === 'c' && +S.wlZ > +S.Hr) S.wlZ = +S.Hr;
  if (S.fon && +S.fw > +S.Hf) S.fw = +S.Hf;
  syncState(S);
  return { state: S, log };
}

const GEOK = ['ty', 'Zb', 'Hf', 'fon', 'fw', 'tb', 'st', 'xs', 'xa', 'Lt', 'Lh', 'gBt', 'gbf', 'gbr', 'gBh'] as const;

export interface AutoDesignRunResult {
  ok: boolean;
  why: string;
  state: WallState;
  log: string[];
}

/** Single pass of auto-design (fit = false: pass 1; fit = true: pass 2 with rebuild/deepen/thicken) */
export async function runAutoDesignPass(rawState: WallState, fit: boolean): Promise<AutoDesignRunResult> {
  const rep = repairGeo(rawState);
  let S = rep.state;
  const log = [...rep.log];
  const adStab = (st: WallState) => {
    const R = calcAll(st);
    return R.err ? ['input error'] : R.fails.filter((x) => /Sliding|Overturning|Bearing|Uplift|Eccentricity/.test(x));
  };
  const adAll = (st: WallState) => {
    const R = calcAll(st);
    return R.err ? ['input error'] : R.fails;
  };
  const adOpt = async (st: WallState, l: string[]) => {
    const res = await runAutoOptimizer(st);
    const b = res.best;
    if (!b) return false;
    if (res.G1) {
      if (b.gw != null && Math.abs(b.gw - st.gBt) > 1e-6) l.push(`block top width ${dd(+st.gBt)} → <b>${dd(b.gw)}</b> m`);
      if (b.gw != null) st.gBt = b.gw;
    } else {
      if (st.ty !== 'L' && !st.xs.length && b.Lt != null && Math.abs(b.Lt - st.Lt) > 1e-6) {
        l.push(`toe ${dd(+st.Lt)} → <b>${dd(b.Lt)}</b> m`);
      }
      if (st.ty !== 'L' && !st.xs.length && b.Lt != null) st.Lt = b.Lt;
      if (st.ty !== 'Li' && b.Lh != null && Math.abs(b.Lh - st.Lh) > 1e-6) {
        l.push(`heel ${dd(+st.Lh)} → <b>${dd(b.Lh)}</b> m`);
      }
      if (st.ty !== 'Li' && b.Lh != null) st.Lh = b.Lh;
      if (Math.abs(b.tb - st.tb) > 1e-6) l.push(`base thickness ${dd(+st.tb)} → <b>${dd(b.tb)}</b> m`);
      st.tb = b.tb;
    }
    syncState(st);
    return true;
  };
  const adRebuild = (st: WallState, l: string[]) => {
    const d = wzFromS(st);
    const r2 = (x: number) => +(+x).toFixed(3);
    if (!(d.Hr - d.Zb > 0.3)) {
      d.Zb = r2(d.Hr - 1);
      l.push(`founding level lowered to +${dd(d.Zb)} mPD (retained height must be > 0.3 m)`);
    }
    if (d.Hf > d.Hr) d.Hf = d.Hr;
    if (d.Hf < d.Zb) d.Hf = d.Zb;
    if (d.ty !== 'G' && d.top < d.Hr) d.top = d.Hr;
    if (d.ty === 'G') {
      if (!(d.gtop > d.Zb + 0.2 && d.gtop <= d.Hr + 1e-6)) {
        d.gtop = r2(d.Zb + Math.max(0.5, 0.8 * (d.Hr - d.Zb)));
      }
      d.gs = d.Hr > d.gtop + 1e-6 ? [{ t: Math.min(0.5, wzVal(d, 'gbt')), h: r2(d.Hr - d.gtop), pos: 'back' }] : [];
    }
    if (/^t/.test(d.lay) && d.ty !== 'G') {
      const lo = d.Zb + 0.3;
      const hi = d.Hr - 0.3;
      d.zt1 = r2(Math.min(hi, Math.max(lo, +d.zt1, d.Hf)));
      if (d.lay === 't3') d.zt2 = r2(Math.min(hi, Math.max(d.zt1 + 0.3, +d.zt2)));
      if (d.lay === 't3' && !(d.zt2 > d.zt1)) d.lay = 't2';
    }
    const e = wizErr(d, 1) || wizErr(d, 2);
    if (e) {
      l.push(`<span class=err>${e}</span>`);
      return false;
    }
    const built = wizBuild(st, d);
    for (const k of GEOK) (st as any)[k] = structuredClone((built as any)[k]);
    syncState(st);
    l.push('wall geometry rebuilt from the levels (setup-wizard first-trial proportions)');
    return true;
  };
  const adLower = (st: WallState, dz: number) => {
    const r2 = (x: number) => +(+x).toFixed(3);
    st.Zb = r2(+st.Zb - dz);
    if (isG(st)) {
      const eq = Math.abs(+st.tb - +st.gBh) < 1e-6;
      st.gBh = r2(+st.gBh + dz);
      if (eq) st.tb = st.gBh;
    } else if (st.st.length) {
      st.st[st.st.length - 1].bot = r2(+st.Zb + +st.tb);
    }
    syncState(st);
  };
  const adThick = (st: WallState) => {
    for (let it = 0; it < 10; it++) {
      const R = calcAll(st);
      if (R.err || !R.RS) return;
      const bad = [...new Set(R.RS.filter((e) => !e.ok).map((e) => e.k))];
      if (!bad.length) return;
      let ch = 0;
      for (const k of bad) {
        let m: RegExpMatchArray | null;
        if ((m = k.match(/^s(\d+)$/))) {
          const q = st.st[+m[1]];
          q.t = +(+q.t + 0.05).toFixed(3);
          ch = 1;
        } else if ((m = k.match(/^x(\d+)(?:s(\d+))?$/))) {
          const q = st.xs[+m[1]];
          const u = m[2] ? q.up?.[+m[2] - 1] : q;
          if (u) {
            u.t = +(+u.t + 0.05).toFixed(3);
            ch = 1;
          }
        } else if (!isG(st)) {
          st.tb = +(+st.tb + 0.05).toFixed(3);
          if (st.st.length) st.st[st.st.length - 1].bot = +(+st.Zb + +st.tb).toFixed(3);
          ch = 1;
        }
      }
      if (!ch) return;
      syncState(st);
      const ab = autoBars(st);
      st.rc = ab.state.rc;
    }
  };

  let V = validate(S);
  if (V.E.length && fit) {
    adRebuild(S, log);
    V = validate(S);
  }
  if (V.E.length) return { ok: false, why: 'Input errors: ' + V.E.join(' '), state: S, log };
  if (adStab(S).length) await adOpt(S, log);
  if (fit && adStab(S).length) {
    const base = structuredClone(S);
    for (let k = 1; k <= 6; k++) {
      S = structuredClone(base);
      adLower(S, 0.25 * k);
      if (validate(S).E.length) continue;
      if (adStab(S).length) await adOpt(S, []);
      if (!adStab(S).length) {
        log.push(`founding level +${dd(+base.Zb)} → <b>+${dd(+S.Zb)}</b> mPD (embedment +${dd(0.25 * k)} m)`);
        break;
      }
    }
    if (adStab(S).length) {
      S = base;
      syncState(S);
    }
  }
  if (S.xrc) {
    const ab1 = autoBars(S);
    S = ab1.state;
    log.push(...ab1.log);
    if (fit && adAll(S).some((x) => /RC|Mass|structural/i.test(x))) {
      adThick(S);
      if (adStab(S).length) await adOpt(S, log);
      const ab2 = autoBars(S);
      S = ab2.state;
      log.push(...ab2.log);
    }
  }
  syncState(S);
  const F = adAll(S);
  return { ok: !F.length, why: F.length ? 'Still failing: ' + F.join(', ') : '', state: S, log };
}
