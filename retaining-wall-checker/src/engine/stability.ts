/**
 * Bearing capacity (GG1 Fig. A2 / CoP Foundations 2017 Table 2.3),
 * v14.0 CR-4 slope crest bearing (GG1 Fig. A4 / FC 2017 Fig. 2.3),
 * shear key mechanism (GG1 Fig. 42), GG1 partial factor stability,
 * CoP Foundations 2017 global FOS stability, accidental vehicle impact,
 * δ = 0 settlement sensitivity check, and stepped gravity section checks (GG1 Fig. 40).
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { DEG2RAD as R, G_WATER as g } from './constants';
import { omg, params, qSide, wallDelta } from './earthPressure';
import { geo, secLoads } from './geometry';
import {
  FSo,
  ckOn,
  fdA,
  fdK,
  fdL,
  fdV,
  gpF,
  isG,
  scOn,
  vSOn,
} from './helpers';
import { barCalc, comp, ev, topCases } from './loads';
import { cl, f, ints } from './math';
import type {
  AccImpactResult,
  BearingResult,
  CompResult,
  Delta0CheckResult,
  EvalResult,
  Fc17BearingResult,
  Fc17OverturningResult,
  Fc17Result,
  Fc17SlidingResult,
  Fc17UpliftResult,
  FcFactors,
  Gg1BearingResult,
  Gg1OverturningResult,
  Gg1Result,
  Gg1SlidingResult,
  KeyMechResult,
  MaterialParams,
  OverburdenResult,
  QoResult,
  SecCheckResult,
  SlsResult,
  UtilResult,
  WallState,
} from './types';

/** Bearing pressure distribution for N, e across base width B */
export const qDist = (N: number, e: number, B: number) => {
  const ee = Math.abs(e);
  return (x: number): number => {
    const xx = e >= 0 ? x : B - x;
    if (!(N > 0)) return 0;
    if (ee <= B / 6) return (N / B) * (1 + (6 * ee) / B) - ((N / B) * ((12 * ee) / B) * xx) / B;
    const L = 3 * (B / 2 - ee);
    return L > 0 ? Math.max(0, ((2 * N) / L) * (1 - xx / L)) : 0;
  };
};

/** Ultimate bearing capacity – GG1 Fig. A2 = CoP Fdn 2017 Table 2.3 */
export function brg(
  N: number,
  H: number,
  B: number,
  e: number,
  phi: number,
  c: number,
  gEff: number,
  qo: number,
  omega: number,
  negE0: boolean,
): BearingResult {
  const eb = negE0 ? Math.max(0, e) : Math.abs(e);
  const Bp = Math.max(0, B - 2 * eb);
  const p = phi * R;
  const w = omega * R;
  const Nq = Math.exp(Math.PI * Math.tan(p)) * Math.tan(Math.PI / 4 + p / 2) ** 2;
  const Nc = (Nq - 1) / Math.tan(p);
  const Ng = 2 * (Nq + 1) * Math.tan(p);
  const Ki = N > 0 ? Math.max(0, H) / (N + (Bp * c) / Math.tan(p)) : 1;
  const m = 2;
  const iq = Math.max(0, 1 - Ki) ** m;
  const ig = Math.max(0, 1 - Ki) ** (m + 1);
  const ic = Math.max(0, iq - (1 - iq) / (Nc * Math.tan(p)));
  const gq = omega <= 45 ? (1 - Math.tan(w)) ** 2 : 0;
  const gc = Math.exp(-2 * w * Math.tan(p));
  const qu = c * Nc * Math.max(0, ic) * gc + 0.5 * gEff * Bp * Ng * ig * gq + qo * Nq * iq * gq;
  return { eb, Bp, Nq, Nc, Ng, Ki, iq, ig, ic, gq, gc, qu, Qu: qu * Bp };
}

/** v14.0 CR-4: foundation near the crest of a slope – GG1 Fig. A4 / FC 2017 Fig. 2.3 */
export function brgX(
  S: WallState,
  N: number,
  H: number,
  B: number,
  e: number,
  phi: number,
  c: number,
  gEff: number,
  qo: number,
  omega: number,
  negE0: boolean,
  fcB?: number | boolean,
): BearingResult {
  if (!scOn(S)) return brg(N, H, B, e, phi, c, gEff, qo, omega, negE0);
  const be = -+S.bf;
  const d = Math.max(0, +S.Hf - +S.Zb);
  const b = Math.max(0, +S.scb || 0);
  const rA = brg(N, H, B, e, phi, c, gEff, 0, be, negE0);
  const rB = brg(N, H, B, e, phi, c, gEff, qo, 0, negE0);
  const Bw = fcB ? B : rB.Bp;
  const L4 = 4 * Bw;
  const xA = -d / Math.tan(be * R);
  const t = b >= L4 ? 1 : cl((b - xA) / Math.max(L4 - xA, 1e-9), 0, 1);
  const qu = rA.qu + (rB.qu - rA.qu) * t;
  return {
    ...rB,
    qu,
    Qu: qu * rB.Bp,
    sc: { be, d, b, xA, L4, Bw, fcB: !!fcB, qA: rA.qu, qB: rB.qu, rA, rB, t },
  };
}

export const scRows = (r: BearingResult, fc: boolean): [string, string, string, string][] => {
  const k = r.sc;
  if (!k) return [];
  const BL = fc ? '4B' : '4B′';
  return [
    [
      'Crest',
      'Foundation near the crest of a slope' + (fc ? ' (FC 2017 Fig. 2.3)' : ' (GG1 Fig. A4)'),
      `b = ${f(k.b)} m (toe to crest), d = ${f(k.d)} m (crest − founding level), β = ${f(k.be, 1)}°`,
      `${BL} = ${f(k.L4, 3)} m`,
    ],
    [
      'qA',
      `At the edge of the slope, x = −d·cotβ = ${f(k.xA, 3)} m`,
      `ground slope factor${fc ? '' : 's'} ω = β: ${fc ? 'ζqg = ζγg' : 'gq = gγ'} = ${f(k.rA.gq, 3)}${
        fc ? '' : `, gc = ${f(k.rA.gc, 3)}`
      }; q′ = 0`,
      `${f(k.qA)} kPa`,
    ],
    ['qB', `At x = ${BL} – level ground, depth d`, 'ω = 0; q′ as below', `${f(k.qB)} kPa`],
    [
      'q(b)',
      'Linear interpolation at x = b',
      k.b >= k.L4 ? `b ≥ ${BL} → qB` : `qA + (qB − qA)(b + d·cotβ)/(${BL} + d·cotβ)`,
      `${f(r.qu)} kPa`,
    ],
  ];
};

/** Effective overburden at founding level, front side */
export function overburden(S: WallState, C: CompResult, cap: number | null): OverburdenResult {
  const Fs = FSo(S);
  let d1 = C.d10;
  let ws = C.ws0;
  if (S.fon && !S.obdp) {
    const hf = Math.max(0, +S.Hf - +S.Zb);
    ws = Math.min(C.wf, hf);
    d1 = hf - ws;
  }
  if (cap != null) {
    const t = d1 + ws;
    const k = t > cap ? cap / t : 1;
    d1 *= k;
    ws *= k;
  }
  return { q: Fs.g * d1 + C.gFs * ws, D: d1 + ws };
}

/** CoP Foundations 2017 Cl 2.2.4: qo = γs′·Df */
export function qoCalc(S: WallState, C: CompResult): QoResult {
  const Fs = FSo(S);
  if (!S.fon) return { q: 0, D: 0, src: 'front soil not considered – no overburden relief' };
  if (S.dfm === 'ogl') {
    const Zb = +S.Zb;
    const D = Math.max(0, +S.ogl - Zb);
    const ws = cl(Math.min(+S.fw, +S.ogl) - Zb, 0, D);
    const dd = D - ws;
    return {
      q: Fs.g * dd + C.gFs * ws,
      D,
      src: `original ground level +${f(+S.ogl)} mPD before excavation: Df = ${f(D)} m (dry ${f(dd)} m × ${Fs.g} + submerged ${f(ws)} m × ${f(C.gFs)})`,
    };
  }
  const o = overburden(S, C, null);
  return {
    q: o.q,
    D: o.D,
    src: `front soil above base${S.obdp ? `, top ${S.dp} m neglected` : ''}: Df = ${f(o.D)} m`,
  };
}

export const gEffBase = (S: WallState, C: CompResult): number =>
  C.ub > 0 || C.uf > 0 ? C.gF : S.f.g;

/** Shear key – GG1 Fig. 42 mechanism 1 (horizontal plane AB through key bottom) */
export function keyMech(
  S: WallState,
  P: MaterialParams,
  C: CompResult,
  s: EvalResult,
  gqF: number,
): KeyMechResult | null {
  const K = C.KG;
  if (!K || !(K.dk > 0) || !(K.Bk > 0)) return null;
  const B = C.G.B;
  const { dk, Bk, xk } = K;
  const Ff = S.f;
  const wet = C.ub > 0 || C.uf > 0;
  const gfb = wet ? Ff.gs - g : Ff.g;
  const sv0 = S.bon ? S.r.g * C.h1 + C.gR * C.wb : 0;
  const dPa = P.Kah * (sv0 * dk + 0.5 * gfb * dk * dk);
  const dPq = S.bon ? P.Kah * C.q * dk * gqF : 0;
  const dPw = C.ub > 0 ? g * (C.wb * dk + 0.5 * dk * dk) : 0;
  const usePp = !!(C.pasOK && S.ppS);
  const kOn = !S.nopp || !!S.kpp;
  const sf0 = C.pasOK ? FSo(S).g * C.d1 + C.gFs * C.ws : 0;
  const dPp = kOn
    ? P.Kpf * (sf0 * dk + 0.5 * gfb * dk * dk) + 2 * P.cF * Math.sqrt(P.Kpf) * dk
    : 0;
  const dPpw = usePp && C.uf > 0 ? g * (C.wf * dk + 0.5 * dk * dk) : 0;
  const Rp = (usePp ? s.Hp : 0) + dPp + dPpw;
  const Fa = s.H + dPa + dPq + dPw;
  const N1 = s.N + (wet ? (Ff.gs - g) * (B - Bk) * dk - g * Bk * dk : Ff.g * (B - Bk) * dk);
  const Nb = cl(ints(xk, xk + Bk, qDist(s.N, s.e, B), 200), 0, Math.max(0, N1));
  const Ns = Math.max(0, N1 - Nb);
  const tphi = Math.tan(P.phf * R);
  const Fr = Ns * tphi + P.cF * (B - Bk) + Nb * Math.tan(P.db * R) + Rp;
  return {
    kOn,
    dk,
    Bk,
    xk,
    Zk: +S.Zb - dk,
    gfb,
    sv0,
    dPa,
    dPq,
    dPw,
    usePp,
    sf0,
    dPp,
    dPpw,
    Rp,
    Fa,
    N1,
    Nb,
    Ns,
    tphi,
    Fr,
    deep: dk > B / 2 + 1e-9,
    shallow: dk < 0.5 - 1e-9,
  };
}

/** SLS middle-third eccentricity envelope (GG1 §9.2.4, unfactored) */
export function slsE(S: WallState): SlsResult {
  const Pk = params(S, 'k');
  let wE: SlsResult | null = null;
  for (const tc of topCases(S)) {
    const C = comp(S, Pk, tc);
    for (const sh of [0, 1]) {
      for (const pv of [0, 1]) {
        for (const fd of fdV(S)) {
          const fa = fdA({ sheel: sh, pvq: pv }, fd);
          const s = ev(C, fa, { ppM: S.ppO });
          if (!wE || s.e > wE.s.e + 1e-12) wE = { tc, sh, pv, fa, s, C };
        }
      }
    }
  }
  return wE!;
}

/** Stability: GG1 partial factor method (ULS + SLS) */
export function gg1(S: WallState): Gg1Result {
  const Pf = params(S, 'f');
  const Pk = params(S, 'k');
  const gq = +S.gq;
  let wS: Gg1SlidingResult | null = null;
  let wB: Gg1BearingResult | null = null;
  let wO: Gg1OverturningResult | null = null;

  for (const tc of topCases(S)) {
    const C = comp(S, Pf, tc);
    const faS = fdK(S, { sur: gq, sheel: 0, pvq: 0, wind: gq, bar: gq, pas: 1, pwat: 1 }, 0);
    const faB = { ...faS, sheel: gq, pvq: gq };
    const s = ev(C, faS, { ppM: S.ppO });
    const km = keyMech(S, Pf, C, s, gq);
    const Fr = km ? km.Fr : Math.max(s.N, 0) * Math.tan(Pf.db * R) + (S.ppS ? s.Hp : 0);
    const Fa = km ? km.Fa : s.H;
    const gS = gpF(S, 'gpS');
    const uS = (Fa * gS) / Math.max(Fr, 1e-9);
    const sl: Gg1SlidingResult = { tc, C, s, Fr, Fa, u: uS, gp: gS, fa: faS, km };
    if (!wS || uS > wS.u) wS = sl;

    const gO = gpF(S, 'gpO');
    const oF = s.Md > 1e-9 ? s.Mr / (s.Md * gO) : Infinity;
    if (!wO || oF < wO.F) wO = { tc, s, F: oF, gp: gO, C, fa: faS };

    const bCases: [string, Record<string, number>][] = [
      ['q_in on heel γf = ' + gq + ', Pav,q γf = ' + gq, faB],
      ['q_in and Pav,q absent (γf = 0)', { ...faS }],
      ['q_in γf = ' + gq + ', Pav,q absent', { ...faS, sheel: gq }],
      ['q_in absent, Pav,q γf = ' + gq, { ...faS, pvq: gq }],
    ];
    for (const [lab0, fa0] of bCases) {
      for (const fd of fdV(S)) {
        const fa = fdA(fa0, fd);
        const lab = lab0 + fdL(fd);
        const b = ev(C, fa, { ppM: S.ppO });
        const ob = overburden(S, C, null);
        const Hb = b.H - (S.ppB ? b.Hp : 0);
        const r = brgX(S, b.N, Hb, C.G.B, b.e, Pf.phf, Pf.cF, gEffBase(S, C), ob.q, omg(S), true);
        const u = r.Qu > 1e-9 ? b.N / r.Qu : Infinity;
        if (!wB || u > wB.u) wB = { tc, lab, b, r, ob, u, Hb, C, fa };
      }
    }
  }

  const wE = slsE(S);
  const okE = !(wE.s.N > 0) ? false : wE.s.e <= wE.C.G.B / 6 + 1e-9;
  const naE = wE.s.e < 0;
  return {
    Pf,
    Pk,
    cases: [],
    sl: wS!,
    ot: wO!,
    br: wB!,
    sls: wE,
    okE,
    naE,
    okS: wS!.u <= 1 + 1e-9,
    okO: wO!.F >= 1 - 1e-9,
    okB: wB!.u <= 1 + 1e-9,
  };
}

/** CoP Foundations 2017 Cl 2.5.4 factors */
export const fcF = (S: WallState): FcFactors => {
  const pos = S.gwc === 'pos';
  return {
    pos,
    Fs: +S.Fs,
    Fsw: pos ? 1.1 : +S.Fs,
    Fo: +S.Fo,
    Fow: +S.Fow,
    Fog: pos ? 1.1 : 1.5,
    Fu: pos ? 1.1 : 1.5,
    Fb: +S.Fb,
    lab: pos ? 'Cl 2.5.4(3) – highest possible GWL' : 'Cl 2.5.4(2) – highest anticipated GWL',
  };
};

/** Stability: CoP Foundations 2017 Cl 2.5.4 / 2.2.4 */
export function fc17(S: WallState): Fc17Result {
  const Pk = params(S, 'k');
  const FF = fcF(S);
  const { Fs, Fsw, Fo, Fow, Fog, Fu, Fb } = FF;
  const gS = gpF(S, 'gpS');
  const gO = gpF(S, 'gpO');

  let wS: Fc17SlidingResult | null = null;
  let wO: Fc17OverturningResult | null = null;
  let wU: Fc17UpliftResult | null = null;
  let wB: Fc17BearingResult | null = null;

  for (const tc of topCases(S)) {
    const C = comp(S, Pk, tc);
    const dead = fdK(S, { sheel: 0, pvq: 0, pas: 1 }, 0);
    const s = ev(C, dead, { ppM: S.ppO });
    const km = keyMech(S, Pk, C, s, 1);
    const Rr = km ? km.Fr : Math.max(s.N, 0) * Math.tan(Pk.db * R) + (S.ppS ? s.Hp : 0);
    const Ha = km ? km.Fa : s.H;
    const Hw = Math.min(Ha, (s.Hc.water || 0) + (km ? km.dPw : 0));
    const Ho = Math.max(0, Ha - Hw);
    const Hreq = (Fsw * Hw + Fs * Ho) * gS;
    const F = Rr / Math.max(Ha, 1e-9);
    const uS = Hreq / Math.max(Rr, 1e-9);
    if (!wS || uS > wS.u) {
      const ref = Fs;
      const Hst = Hreq / ref;
      wS = {
        tc,
        s,
        R: Rr,
        Ha,
        Hw,
        Ho,
        Hreq,
        F,
        Freq: Hreq / Math.max(Ha, 1e-9),
        u: uS,
        C,
        fa: dead,
        km,
        ref,
        Hst,
        Fe: Rr / Math.max(Hst, 1e-9),
      };
    }

    const Mw = s.Mc.wind || 0;
    const Mg = (s.Mc.water || 0) + (s.Mc.upl || 0);
    const Mo = Math.max(0, s.Md - Mw - Mg);
    const Mreq = (Fow * Mw + Fog * Mg + Fo * Mo) * gO;
    const Fov = s.Mr / Math.max(s.Md, 1e-9);
    const uO = Mreq / Math.max(s.Mr, 1e-9);
    if (!wO || uO > wO.u) {
      const ref = Mw > 1e-9 ? Fow : Fo;
      const Mst = Mreq / ref;
      wO = {
        tc,
        s,
        F: s.Md > 1e-9 ? Fov : Infinity,
        Freq: Mreq / Math.max(s.Md, 1e-9),
        Mw,
        Mg,
        Mo,
        Mreq,
        u: uO,
        C,
        fa: dead,
        ref,
        Mst,
        Fe: Mst > 1e-9 ? s.Mr / Mst : Infinity,
      };
    }

    const rU = s.U > 0 ? s.W / (Fu * s.U) : Infinity;
    if (!wU || rU < wU.r) wU = { tc, s, req: Fu * s.U, r: rU };

    for (const [sh, pv] of [
      [1, 1],
      [0, 0],
      [1, 0],
      [0, 1],
    ] as const) {
      for (const fd of fdV(S)) {
        if (sh && !(C.qi > 0 || C.qt > 0) && !pv) continue;
        const fa = fdA({ sheel: sh, pvq: pv, pas: 1 }, fd);
        const b = ev(C, fa, { ppM: S.ppO });
        const cap = Math.min(3, C.G.B);
        const ob = overburden(S, C, cap);
        const Hb = b.H - (S.ppB ? b.Hp : 0);
        const rr = brgX(S, b.N, Hb, C.G.B, b.e, S.f.phi, S.f.c, gEffBase(S, C), ob.q, omg(S), false, 1);
        const qu = Math.min(rr.qu, 3000);
        const qoR = qoCalc(S, C);
        const qo = qoR.q;
        const qap = rr.Bp > 1e-9 ? b.N / rr.Bp : Infinity;
        const Fbv = qap > qo ? Math.max(0, (qu - qo) / (qap - qo)) : Infinity;
        const qa = (qu - qo) / Fb + qo;
        const lab = `q_in ${sh ? 'present' : 'absent'}, Pav,q ${pv ? 'present' : 'absent'}` + fdL(fd);
        if (!wB || Fbv < wB.F - 1e-9) {
          wB = { tc, b, rr, qu, qo, qoR, qa, qap, F: Fbv, ob, C, fa, lab };
        }
      }
    }
  }

  return {
    Pk,
    ...FF,
    gS,
    gO,
    sl: wS!,
    ot: wO!,
    up: wU!,
    br: wB!,
    okS: wS!.u <= 1 + 1e-9,
    okO: wO!.u <= 1 + 1e-9,
    okU: wU!.r >= 1 - 1e-9,
    okB: wB!.F >= Fb - 1e-9,
  };
}

/** Utilisation (<= 1.0 = pass) on the selected checking method */
export function utilOf(
  S: WallState,
  A: Gg1Result | { sls: SlsResult },
  Fc: Fc17Result | null,
  P: boolean,
  B: number,
): UtilResult {
  const E = A.sls;
  const eU = E.s.N > 0 ? (E.s.e < 0 ? 0 : E.s.e / (B / 6)) : Infinity;
  let sl: number;
  let ot: number;
  let br: number;
  let up: number;
  if (P) {
    const Ag = A as Gg1Result;
    sl = Ag.sl.u;
    ot = 1 / Math.max(Ag.ot.F, 1e-9);
    br = Ag.br.u;
    up = 0;
  } else {
    const F = Fc!;
    sl = F.sl.u;
    ot = F.ot.u;
    br = F.br.F === Infinity ? 0 : F.Fb / Math.max(F.br.F, 1e-9);
    up = F.up.s.U > 0 ? 1 / Math.max(F.up.r, 1e-9) : 0;
  }
  const ec = eU;
  const uls = Math.max(sl, ot, br, up);
  const okULS = uls <= 1 + 1e-9;
  const okAll = okULS && (!ckOn(S, 'ecc') || eU <= 1 + 1e-9);
  return { sl, ot, br, up, ec, uls, okULS, okAll };
}

/** Accidental vehicle impact transient stability check (v11 F1) */
export function accImp(S: WallState): AccImpactResult | null {
  if (!vSOn(S)) return null;
  const Pk = params(S, 'k');
  const b = barCalc(S);
  const C = comp(S, Pk, { k: 'bar', F: b.F, z: b.z });
  const dead = fdK(S, { sheel: 0, pvq: 0, pas: 1 }, 0);
  const s = ev(C, dead, { ppM: S.ppO });
  const km = keyMech(S, Pk, C, s, 1);
  const Rr = km ? km.Fr : Math.max(s.N, 0) * Math.tan(Pk.db * R) + (S.ppS ? s.Hp : 0);
  const Ha = km ? km.Fa : s.H;
  const Fs = Rr / Math.max(Ha, 1e-9);
  const Fo = s.Md > 1e-9 ? s.Mr / s.Md : Infinity;
  let wB: { F: number; qu: number; qo: number; qap: number; b: EvalResult; r: BearingResult } | null = null;
  for (const [sh, pv] of [
    [1, 1],
    [0, 0],
    [1, 0],
    [0, 1],
  ] as const) {
    for (const fd of fdV(S)) {
      const fa = fdA({ sheel: sh, pvq: pv, pas: 1 }, fd);
      const bb = ev(C, fa, { ppM: S.ppO });
      const ob = overburden(S, C, Math.min(3, C.G.B));
      const Hb = bb.H - (S.ppB ? bb.Hp : 0);
      const r = brgX(S, bb.N, Hb, C.G.B, bb.e, S.f.phi, S.f.c, gEffBase(S, C), ob.q, omg(S), false, 1);
      const qu = Math.min(r.qu, 3000);
      const qo = qoCalc(S, C).q;
      const qap = r.Bp > 1e-9 ? bb.N / r.Bp : Infinity;
      const F = qap > qo ? Math.max(0, (qu - qo) / (qap - qo)) : Infinity;
      if (!wB || F < wB.F) wB = { F, qu, qo, qap, b: bb, r };
    }
  }
  return {
    b,
    C,
    s,
    Rr,
    Ha,
    Fs,
    Fo,
    br: wB!,
    km,
    ok: Fs >= 1 - 1e-9 && Fo >= 1 - 1e-9 && wB!.F >= 1 - 1e-9,
  };
}

/** GG1 Table 14 Note (2) δ = 0 sensitivity check for gravity / reversed-L walls */
export function d0Chk(S: WallState, P: boolean): Delta0CheckResult | null {
  if (!(isG(S) || S.ty === 'Li') || S.comp || S.kam !== 'c') return null;
  const t = structuredClone(S);
  t.comp = 1;
  t.dwm = 'auto';
  const A = gg1(t);
  const Fc = fc17(t);
  const u = utilOf(t, A, Fc, P, geo(t).B);
  return { u, Fc, A };
}

export const otF = (Fc: Fc17Result, o: Fc17OverturningResult): string =>
  (
    [
      [Fc.Fo, 'M_O', o.Mo],
      [Fc.Fog, 'M_GW', o.Mg],
      [Fc.Fow, 'M_W', o.Mw],
    ] as [number, string, number][]
  )
    .filter(([, n, v]) => v > 1e-9 || n === 'M_O')
    .map(([F, n]) => (Math.abs(F - o.ref) < 1e-9 ? n : `(${f(F, 1)}/${f(o.ref, 1)})·${n}`))
    .join(' + ');

/** Stepped gravity wall change-in-section checks (GG1 §9.2.3(2), Fig. 40) */
export function secChecks(S: WallState): SecCheckResult[] {
  if (!isG(S)) return [];
  const G = geo(S);
  const SL = secLoads(S, G);
  const Hr = +S.Hr;
  const bo = S.bon;
  const q = qSide(S, G);
  const Rs = S.r;
  const P = S.acc === 'gg1';
  const FF = fcF(S);
  const gq = +S.gq;
  const gO = gpF(S, 'gpO');
  const wd0 = wallDelta(S, Math.atan(Math.tan(S.r.phi * R) / (P ? +S.gm : 1)) / R, G);
  const dSec = S.kam === 'c' ? Math.min(wd0.dRaw, wd0.dmaxSec) : null;
  const Pu = params(S, P ? 'f' : 'k', dSec, G);
  const Pk = params(
    S,
    'k',
    S.kam === 'c' ? Math.min(wallDelta(S, S.r.phi, G).dRaw, wallDelta(S, S.r.phi, G).dmaxSec) : null,
    G,
  );
  const out: SecCheckResult[] = [];

  const fld = (Pp: MaterialParams) => {
    const C0 = comp(S, Pp, null);
    const { gR } = C0;
    const h1 = C0.hs0 - C0.wb;
    const Kh = Pp.Kah;
    const tD = Math.tan((Pp.d + (Pp.al || 0)) * R);
    const sv = (dd: number) => (dd <= h1 ? Rs.g * dd : Rs.g * h1 + gR * (dd - h1));
    return {
      Kh,
      tD,
      al: Pp.al || 0,
      d: Pp.d,
      eS: (z: number) => {
        const dd = Hr - z;
        return dd < 0 || !bo ? 0 : Kh * sv(dd);
      },
      eW: (z: number) => {
        const dd = Hr - z;
        return dd < 0 || !bo ? 0 : g * Math.max(0, dd - h1);
      },
      qP: (z: number) => (bo && Hr - z >= 0 ? Kh * q : 0),
    };
  };

  const FU = fld(Pu);
  const FK = fld(Pk);

  const act = (F: ReturnType<typeof fld>, Ls: number) => {
    const Hs = ints(Ls, Hr, F.eS);
    const Ms = ints(Ls, Hr, (z) => F.eS(z) * (z - Ls));
    const Hw = ints(Ls, Hr, F.eW);
    const Mw = ints(Ls, Hr, (z) => F.eW(z) * (z - Ls));
    const Hq = ints(Ls, Hr, F.qP);
    const Mq = ints(Ls, Hr, (z) => F.qP(z) * (z - Ls));
    const Pv = (Hs + Hq) * F.tD;
    return { Hs, Ms, Hw, Mw, Hq, Mq, Pv };
  };

  const tops = topCases(S, G);
  S.st.forEach((st, i) => {
    const gs = G.SG[i];
    if (!(gs.h > 1e-9) || !(gs.ts > 1e-9)) return;
    const Ls = +st.bot;
    const h = gs.ts;
    const W = SL[i].W;
    const Me = SL[i].Me;
    const Mw0 = (W * h) / 2 - Me;
    const lab = `${st.rc ? `Stem ${i + 1} (RC)` : `Mass concrete stem ${i + 1}`} on the ${
      i === S.st.length - 1 ? 'block' : 'stem below'
    }`;
    const AU = act(FU, Ls);
    const AK = act(FK, Ls);
    const PvU = AU.Hs * FU.tD;
    let wr: SecCheckResult | null = null;

    for (const t of tops) {
      const zt = +S.Zb + t.z;
      const mt = zt > Ls ? t.F * (zt - Ls) : 0;
      const ht = zt > Ls ? t.F : 0;
      const MR = Mw0;
      let Mo: number;
      let Mreq: number;
      let Fot: number;
      let Freq: number;
      if (P) {
        Mo = AU.Ms + AU.Mw + gq * (AU.Mq + mt) - PvU * h;
        Mreq = Mo * gO;
        Fot = Mo > 1e-9 ? MR / Mo : Infinity;
        Freq = gO;
      } else {
        const Mwind = t.k === 'wind' ? mt : 0;
        const Mgw = AU.Mw;
        const Moth = Math.max(0, AU.Ms + AU.Mq + (t.k === 'wind' ? 0 : mt) - PvU * h);
        const ref = Mwind > 1e-9 ? FF.Fow : FF.Fo;
        Mo = Mwind + Mgw + Moth;
        Mreq = (FF.Fow * Mwind + FF.Fog * Mgw + FF.Fo * Moth) * gO;
        Fot = Mreq > 1e-9 ? MR / (Mreq / ref) : Infinity;
        Freq = ref;
      }
      const uO = Mreq / Math.max(MR, 1e-9);
      const okO = uO <= 1 + 1e-9;

      let ek: number | null = null;
      let eN = 0;
      let eMR = 0;
      let eMD = 0;
      for (const fd of SL[i].Wf ? [0, 1] : [0]) {
        for (const [sq, pv] of [
          [1, 0],
          [1, 1],
          [0, 0],
        ] as const) {
          const Pv = (AK.Hs + pv * AK.Hq) * FK.tD;
          const MRk = Mw0 + (fd ? (SL[i].Wf! * h) / 2 - SL[i].Mef! : 0);
          const MDk = AK.Ms + AK.Mw + sq * AK.Mq + (t.k === 'bar' && vSOn(S) ? 0 : mt) - Pv * h;
          const N = W + (fd ? SL[i].Wf! : 0) + Pv;
          const e = h / 2 - (MRk - MDk) / Math.max(N, 1e-9);
          if (ek == null || e > ek) {
            ek = e;
            eN = N;
            eMR = MRk;
            eMD = MDk;
          }
        }
      }
      const okE = ek! <= h / 6 + 1e-9;
      const uE = Math.max(0, ek!) / (h / 6);
      const na = !!st.rc;
      const r: SecCheckResult = {
        i,
        st,
        k: 's' + i,
        lab,
        Ls,
        h,
        W,
        Me,
        Pv: PvU,
        N: W + PvU,
        H: AU.Hs + AU.Hw + AU.Hq + ht,
        MR,
        Mo,
        Mreq,
        Fot,
        Freq,
        uO,
        okO,
        tk: t.k,
        A: AU,
        AK,
        ek: ek!,
        eN,
        eMR,
        eMD,
        okE,
        rc: !!st.rc,
        Kh: FU.Kh,
        al: FU.al,
        dd: FU.d,
        uE,
        na,
        ok: na || (okO && okE),
        sev: na ? null : Math.max(uO, uE),
      };
      if (!wr || (r.sev || 0) > (wr.sev || 0)) wr = r;
    }
    if (wr) out.push(wr);
  });
  return out;
}
