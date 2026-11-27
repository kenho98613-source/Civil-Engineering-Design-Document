/**
 * Stateless state-reading helpers, defaults, migration (fillDef), and sync.
 * Exact port of legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { DEFAULT_STATE, QCAT } from './constants';
import { cl } from './math';
import type {
  FillDefResult,
  LoadFactors,
  RcBarSet,
  SoilParams,
  StemInput,
  WallState,
} from './types';

export const isG = (S: WallState): boolean => S.ty === 'G';

export const isU = (S: WallState): boolean =>
  !isG(S) && Array.isArray(S.xs) && S.xs.length > 0 && S.xa === 'U';

export const gLn = (): number => 0; // v13.4: back face leaning into the fill not permitted (b_r >= 0)

export const gTx = (S: WallState): number => Math.max(0, +S.gbf || 0) + gLn();

export const gBW = (S: WallState): number =>
  Math.max(0, +S.gbf || 0) + Math.max(0, +S.gBt || 0) + Math.max(0, +S.gbr || 0);

export const gBat = (S: WallState): string => {
  const a = +S.gbf > 1e-6;
  const b = +S.gbr > 1e-6;
  return a && b
    ? 'front and back faces battered'
    : a
      ? 'front face battered'
      : b
        ? 'back face battered'
        : 'rectangular';
};

export const stTT = (s: StemInput): number =>
  +s.t - Math.max(0, +s.fb || 0) - Math.max(0, +s.rb || 0);

export const gpF = (S: WallState, k: 'gpS' | 'gpO' | 'gpA'): number =>
  S.gpon && S[k] ? Math.max(1, +S.gpv || 1) : 1;

export const ckOn = (S: WallState, id: string): boolean => !(S.ck && S.ck[id] && S.ck[id].off);

export const phiCv = (S: WallState): number => +S.f.cv;

/** Front soil (passive side, above base): same as foundation soil unless separately specified */
export const FSo = (S: WallState): SoilParams => (S.fsm ? S.f : S.fs);

/** Backfill resting on heel / virtual back (v13.7 CR-3: weight only) */
export const BFo = (S: WallState): SoilParams => (S.bkfm ? S.bkf : S.r);
export const bfOn = (S: WallState): boolean => !!S.bkfm;

/** Retained design WL as a fraction of retained height */
export const wlF = (S: WallState): number => {
  const h = Math.max(0, S.Hr - S.Zb);
  if (S.wl === 'c') return h > 0 ? cl((+S.wlZ - S.Zb) / h, 0, 1) : 0;
  return +S.wl || 0;
};

export const wlLev = (S: WallState): number => +S.Zb + Math.max(0, S.Hr - S.Zb) * wlF(S);

export const qVal = (S: WallState): number =>
  S.qcat === 'bldg'
    ? 10 * Math.max(1, +S.qst || 1)
    : S.qcat === 'c'
      ? +S.q
      : (QCAT[S.qcat]?.[1] ?? +S.q);

export const scOn = (S: WallState): boolean => !!(S.scon && S.fon && +S.bf < 0);

export const hEffMax = (S: WallState): number => (S.heffm === 'c' ? +S.heff : +S.heffm);

export const hEff = (S: WallState, h: number): number =>
  Math.min(h / 2, Math.max(1, hEffMax(S)));

export const isVeh = (S: WallState): boolean => /^v6/.test(S.brc);
export const vSOn = (S: WallState): boolean => !!(S.bro && isVeh(S) && S.vSO);
export const vStemOn = (S: WallState): boolean => !!(S.bro && isVeh(S) && S.vStem);

/** v13.8.13 CR-1: fence self-weight (permanent) */
export const fdW = (S: WallState): number => {
  const P = +S.fdP;
  const s = S.fdS === '' || S.fdS == null ? 0 : +S.fdS;
  return Number.isFinite(P) && P > 0 ? (s > 0 ? P / s : P) : 0;
};

export const fdOn = (S: WallState): boolean => !!(S.fdl && fdW(S) > 0);

export const fdK = (S: WallState, o: LoadFactors, v: number): LoadFactors =>
  fdOn(S) ? { ...o, fdl: v } : o;

export const fdV = (S: WallState): (number | null)[] => (fdOn(S) ? [1, 0] : [null]);

export const fdA = (fa: LoadFactors, v: number | null): LoadFactors =>
  v == null ? fa : { ...fa, fdl: v };

export const fdL = (v: number | null): string =>
  v == null ? '' : `, fence DL ${v ? 'present' : 'absent'}`;

export const rcv = (S: WallState, k: string): RcBarSet =>
  Object.assign(
    isG(S)
      ? { d: 25, s: 200, d2: 20, s2: 200, d3: 25, s3: 200 }
      : /^[sx]/.test(k)
        ? { d: 16, s: 200, d2: 12, s2: 200, d3: 16, s3: 200 }
        : { d: 16, s: 200, d2: 12, s2: 200, d3: 12, s3: 200 },
    S.rc[k],
  );

/**
 * Pure equivalent of sync() — updates derived fields on a mutable state clone.
 */
export function syncState(S: WallState): WallState {
  for (const k of ['r', 'f', 'fs', 'bkf'] as const) {
    if (S[k]) S[k].gs = +S[k].g;
  }
  if (isG(S)) {
    S.tb = +S.gBh;
    S.gB = +gBW(S).toFixed(4);
  }
  const n = S.st.length;
  if (!n) return S;
  S.st[n - 1].bot = +(S.Zb + S.tb).toFixed(3);
  for (let i = 1; i < n; i++) S.st[i].top = S.st[i - 1].bot;
  if (!isG(S)) S.st.forEach((s) => { s.rc = 1; });
  return S;
}

/**
 * Pure clone + sync helper used by calculation entry points so caller state is never mutated.
 */
export function syncedClone(S: WallState): WallState {
  return syncState(structuredClone(S));
}

/**
 * Exact port of fillDef(o): migrates legacy v7/v8/v9/v10/v13 inputs and fills missing defaults.
 * Returns { state, dropped, migrationNote } without mutating global window.
 */
export function fillDef(raw: Record<string, unknown>): FillDefResult {
  const o: Record<string, any> = structuredClone(raw || {});
  const dropped: string[] = [];
  let migrationNote = '';

  if (o && o.grmin == null && o.rmin != null) o.grmin = o.rmin;
  const m10 = !!o && o.stv == null;
  if (m10 && o.ty === 'G' && Array.isArray(o.st) && o.st.some((x: any) => !x.rc)) {
    o.st.forEach((x: any) => {
      x.rc = 1;
    });
    migrationNote =
      'Older input: gravity stems converted to RC stems (v10.0 – every stem has an RC calculation; untick “RC stem” in Step 2 for a plain stem).';
  }
  if (o && o.cvS == null && o.cvr != null) {
    o.cvS = Math.max(+o.cvr || 0, +o.cvf || 0);
    if (o.vL == null) o.vL = 1.5;
    if (o.cvt == null) o.cvt = 50;
    for (const k of ['cvr', 'cvf', 'cvb', 'exr', 'exf', 'ext', 'exb']) delete o[k];
  }
  const gmig = o.ty === 'G' && o.gB == null;
  const m3 = o.geo3 == null;

  const fill = (target: Record<string, any>, defaults: Record<string, any>) => {
    for (const k in defaults) {
      if (target[k] == null) {
        target[k] = structuredClone(defaults[k]);
      } else if (
        defaults[k] &&
        typeof defaults[k] === 'object' &&
        !Array.isArray(defaults[k])
      ) {
        fill(target[k], defaults[k]);
      }
    }
  };
  fill(o, DEFAULT_STATE as unknown as Record<string, any>);

  if (gmig) {
    const n = (o.st || []).length;
    if (o.gbM === 1 || !n) {
      o.gB = +(o.gb || o.gw || 2.4);
      o.gBt = Math.min(+(o.gtw || o.gB), o.gB);
      o.gBh = +(o.gH || o.tb || 3);
      o.st = [];
    } else {
      o.gB = +(+o.Lt + +o.st[n - 1].t + +o.Lh).toFixed(3);
      o.gBt = o.gB;
      o.gBh = +o.tb;
    }
    o.gbat = 'front';
    (o.st || []).forEach((s: any) => {
      delete s.tt;
    });
  }

  if (m3) {
    const st: any[] = o.st || [];
    const n = st.length;
    st.forEach((s) => {
      const tt = +s.tt > 0 ? Math.min(+s.tt, +s.t) : +s.t;
      s.fb = +Math.max(0, +s.t - tt).toFixed(4);
      s.rb = 0;
      s.of = 0;
      delete s.tt;
    });
    if (o.ty === 'G') {
      const B = +o.gB;
      const Bt = Math.min(+o.gBt, B);
      const bk = o.gbat === 'back';
      o.gbf = bk ? 0 : +(B - Bt).toFixed(4);
      o.gbr = bk ? +(B - Bt).toFixed(4) : 0;
      o.gBt = Bt;
      if (n && !bk) {
        st[n - 1].of = +(Bt - +st[n - 1].t).toFixed(4);
        for (let i = n - 2; i >= 0; i--) {
          st[i].of = +(+st[i + 1].t - +st[i].t).toFixed(4);
        }
      }
    } else {
      for (let i = n - 2; i >= 0; i--) {
        const b = st[i + 1];
        st[i].of = +(+b.t - b.fb - +st[i].t).toFixed(4);
      }
    }
    delete o.gbat;
    delete o.gtw;
    delete o.gw;
    o.geo3 = 1;
  }

  if (o.f) {
    if (o.f.cvm === 'v') o.f.cv = 30;
    else if (o.f.cvm === 'g') o.f.cv = 34;
    o.f.cvm = 'c';
  }
  if (o.lon && (+o.lQv > 0 || +o.lQh > 0)) {
    dropped.push(`line load Q1 = ${o.lQv} kN/m, Qh = ${o.lQh} kN/m`);
  }
  if (o.gpon && +o.gpv !== 1) {
    dropped.push(`project factor γproj = ${o.gpv}`);
  }
  o.gpon = 0;
  o.lon = 0;
  o.adv = 1;
  if (o.acc !== 'fc' && o.acc !== 'gg1') o.acc = 'fc';
  o.gmo = 'B';
  if (o.ver !== 9) o.rck = o.rck || 'ko';
  o.ver = 9;

  return {
    state: o as WallState,
    dropped,
    migrationNote,
  };
}
