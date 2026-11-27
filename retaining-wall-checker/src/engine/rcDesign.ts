/**
 * Reinforced concrete structural design (CoP SUC 2013, 2020 Ed.),
 * nominal cover (Table 4.1 & 4.2), ULS actions, bending/shear/crack/spacing checks,
 * v14.0 CR-3 BMD/SFD envelopes + 50% bar curtailment + lap lengths,
 * gravity anti-crack / minimum steel schedules, and starter bar anchorage.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { COMBS, DEG2RAD as R, GR, G_WATER as g, T42c } from './constants';
import { cmpP, koVal, qIn, qSide } from './earthPressure';
import { geo, secLoads, stemT } from './geometry';
import {
  BFo,
  FSo,
  fdV,
  gpF,
  hEff,
  hEffMax,
  isG,
  isU,
  qVal,
  rcv,
  syncedClone,
  vSOn,
} from './helpers';
import { barCalc, comp, ev, ppF, ppZ, windCalc } from './loads';
import { c5, cl, f, ints } from './math';
import { qDist } from './stability';
import type {
  AnchorageResult,
  CalcAllSuccessResult,
  CoverResult,
  CoverRow,
  CurtailmentResult,
  DiagramMap,
  DiagramPoint,
  ExtraStemGeo,
  GeometryResult,
  MassElement,
  MeshRow,
  RcActionElement,
  RcDesignElement,
  SectionLoad,
  TopCase,
  WallState,
} from './types';

export const KP = (fcu: number): number => (fcu <= 45 ? 0.156 : fcu <= 70 ? 0.12 : 0.094);
export const XK = (fcu: number): number => (fcu <= 45 ? 0.45 : fcu <= 70 ? 0.4 : 0.36);
export const aMin = (S: WallState): number =>
  Math.max(1, (40 * Math.pow(+S.fcu, 2 / 3)) / +S.fy);

export const coverReq = (S: WallState, ex: number): number | null => {
  let i = -1;
  GR.forEach((v, j) => {
    if (+S.fcu >= v) i = j;
  });
  return i < 0 ? null : T42c[ex][i];
};

/** Nominal cover calculation (CoP SUC 2013 Table 4.1, Table 4.2, Cl 4.2.4.1) */
export function cvAll(S: WallState, G?: GeometryResult): CoverResult {
  const Gv = isG(S);
  const G0 = G ?? geo(S);
  const Zt = +S.Zb + +S.tb;
  const Hr = +S.Hr;
  const Hf = +S.Hf;
  const bo = !!+S.bon;
  const fo = !!+S.fon;
  const sk = S.st.map((s, i) => ({ s, k: 's' + i })).filter((o) => !Gv || o.s.rc);
  const xk = Gv ? [] : Object.keys(S.rc || {}).filter((k) => /^x/.test(k));
  const zT = sk.length ? Math.max(...sk.map((o) => +o.s.top)) : G0.top;
  const dmx = (ks: string[]) =>
    Math.max(
      0,
      ...ks.flatMap((k) => {
        const r = rcv(S, k);
        return [+r.d || 0, +r.d3 || 0];
      }),
    );
  const dS = dmx([...sk.map((o) => o.k), ...xk]);
  const dB = Gv
    ? 0
    : dmx(['T', 'H', ...Object.keys(S.rc || {}).filter((k) => /^M/.test(k))]);
  const mn = (ex: number, d: number) => {
    const t = coverReq(S, ex);
    return t == null ? null : c5(Math.max(t, d, 20));
  };
  const rE: [number, string] =
    bo && zT <= Hr + 5e-3
      ? [1, 'in contact with the retained soil']
      : [2, bo ? `exposed above the retained ground level +${f(Hr)}` : 'no retained soil – exposed'];
  const fE: [number, string] =
    fo && zT <= Hf + 5e-3
      ? [1, 'in contact with the front soil']
      : [2, fo ? `exposed above the front ground level +${f(Hf)}` : 'no front soil – exposed'];
  const sEx = Math.max(rE[0], fE[0]);
  const sMin = mn(sEx, dS);
  const auto = sMin ?? c5(Math.max(40, dS, 20));
  const sv = S.cvS === 'a' || S.cvS == null || S.cvS === '' ? auto : +S.cvS;
  const toeX = (G0.Lt0 || 0) > 1e-6 && !(fo && Hf >= Zt - 5e-3);
  const heelX = (G0.hl || 0) > 1e-6 && !bo;
  const tE: [number, string] = toeX
    ? [2, 'toe top exposed – front ground level below the base top']
    : heelX
      ? [2, 'heel top exposed – no retained soil']
      : [1, 'covered by soil'];
  const tMin = mn(tE[0], dB);
  const tv = +S.cvt;
  const bq = S.cbs === 'earth' ? 75 : 40;
  const bMin = mn(1, dB);
  const bv = Math.max(bq, bMin || 0);
  const rows: CoverRow[] = [
    { n: 'Stem – retained (rear) face', ex: rE[0], why: rE[1], min: mn(rE[0], dS), c: sv, st: 1 },
    { n: 'Stem – front face', ex: fE[0], why: fE[1], min: mn(fE[0], dS), c: sv, st: 1 },
    { n: Gv ? 'Mass concrete block – top face' : 'Base – top face', ex: tE[0], why: tE[1], min: tMin, c: tv },
    {
      n: Gv ? 'Mass concrete block – underside' : 'Base – underside',
      ex: 1,
      why: `in contact with the founding soil; cast ${
        S.cbs === 'earth' ? 'against earth (Cl 4.2.4.1(d) ≥ 75 mm)' : 'on blinding (Cl 4.2.4.1(d) ≥ 40 mm)'
      }`,
      min: Math.max(bq, bMin || 0),
      c: bv,
    },
  ];
  return { s: sv, t: tv, b: bv, auto, sMin, tMin, bMin, sEx, tEx: tE[0], dS, dB, rows };
}

export const rcLN = (i: number): string => `Stem ${i + 1} (RC)`;

export function dgPut(dg: DiagramMap, k: string, pts: DiagramPoint[]): void {
  if (!dg[k]) {
    dg[k] = pts.map((p) => ({ ...p }));
    return;
  }
  dg[k].forEach((q, j) => {
    const p = pts[j];
    if (!p) return;
    if (Math.abs(p.M) > Math.abs(q.M)) q.M = p.M;
    if (Math.abs(p.V) > Math.abs(q.V)) q.V = p.V;
  });
}

/** ULS structural design actions (with optional v14.0 CR-3 diagram collector dg) */
export function rcActions(
  S: WallState,
  Kh: number,
  dDeg: number,
  dg?: DiagramMap,
): RcActionElement[] {
  const CV = cvAll(S);
  const G = geo(S);
  const C0 = comp(S, { Kah: Kh, d: dDeg, Kp: 0, cP: 0, phr: +S.r.phi }, null);
  const { gR } = C0;
  const h1 = C0.hs0 - C0.wb;
  const q = qSide(S, G);
  const qi = qIn(S, G);
  const Rs = S.r;
  const Hr = +S.Hr;
  const bo = S.bon;
  const LL = C0.LL;
  const Gv = isG(S);

  const eP = (z: number) => {
    const dd = Hr - z;
    if (dd < 0 || !bo) return 0;
    return cmpP(S, dd <= h1 ? Rs.g * dd : Rs.g * h1 + gR * (dd - h1), Kh) + g * Math.max(0, dd - h1);
  };
  const qP = (z: number) => (bo && Hr - z >= 0 ? Kh * q + (LL ? LL.sig(z) : 0) : 0);

  const w = S.wo ? windCalc(S, G) : null;
  const b = S.bro ? barCalc(S, G) : null;
  const els: Record<string, RcActionElement> = {};
  const SEC = secLoads(S, G);
  const XS = G.XS || [];
  const UU = isU(S);
  const koRun = Math.abs(Kh - koVal(S)) < 1e-9 && S.rck !== 'ka';

  const kFr = () => {
    const p = +FSo(S).phi * R;
    const ka = (1 - Math.sin(p)) / (1 + Math.sin(p));
    const ko = S.kom ? +S.koM : (1 - Math.sin(p)) * Math.pow(Math.max(+S.ocr || 1, 1), 0.5);
    return koRun ? ko : ka;
  };

  const xsLat = (a: ExtraStemGeo, cb: (typeof COMBS)[number], zs?: number) => {
    let top: number;
    let Wt: number;
    let gm: number;
    let gms: number;
    let Kx: number;
    if (UU) {
      const Fq = FSo(S);
      top = +S.Hf;
      Wt = Math.min(+S.fw, top);
      gm = Fq.g;
      gms = Fq.gs;
      Kx = kFr();
    } else {
      top = a.zt;
      Wt = Math.min(C0.Wb, top);
      gm = Rs.g;
      gms = Rs.gs;
      Kx = Kh;
    }
    top = Math.min(top, a.top);
    const b0 = zs ?? a.bot;
    if (!(top > b0 + 1e-9) && !a.pp) return { H: 0, M: 0, top: b0 };
    top = Math.max(top, b0);
    const qx = qVal(S);
    const sv = (z: number) =>
      gm * (top - Math.max(z, Math.min(Wt, top))) + (gms - g) * Math.max(0, Math.min(Wt, top) - z);
    const uw = (z: number) => g * Math.max(0, Math.min(Wt, top) - z);
    const ePx = (z: number) => cmpP(S, sv(z), Kx) + uw(z);
    const qPx = () => Kx * qx;
    const pF = a.pp ? cb.gQ * ppF(S) : 0;
    const pz = Math.max(0, ppZ(S, a) - b0);
    return {
      H: cb.gE * ints(b0, top, ePx) + cb.gQ * qPx() * (top - b0) + pF,
      M: cb.gE * ints(b0, top, (z) => ePx(z) * (z - b0)) + (cb.gQ * qPx() * (top - b0) ** 2) / 2 + pF * pz,
      top,
      Kx,
    };
  };

  const put = (
    k: string,
    o: Omit<RcActionElement, 'gov'>,
    cb: (typeof COMBS)[number],
    tk: TopCase['k'],
  ) => {
    const e = els[k] || (els[k] = { ...o, M: 0, V: 0, gov: '' });
    if (Math.abs(o.M) > Math.abs(e.M)) {
      e.M = o.M;
      e.gov = `Comb ${cb.id}` + (tk !== 'none' ? ` + ${tk === 'wind' ? 'wind' : 'barrier'}` : '');
    }
    if (Math.abs(o.V) > Math.abs(e.V)) e.V = o.V;
  };

  const cant = (Ls: number, cb: (typeof COMBS)[number], tc: TopCase, me?: number) => {
    let V = cb.gE * ints(Ls, Hr, eP) + cb.gQ * ints(Ls, Hr, qP);
    let M = cb.gE * ints(Ls, Hr, (z) => eP(z) * (z - Ls)) + cb.gQ * ints(Ls, Hr, (z) => qP(z) * (z - Ls));
    if (tc.F > 0) {
      const zl = +S.Zb + tc.z;
      if (zl > Ls) {
        V += tc.F;
        M += tc.F * (zl - Ls);
      }
    }
    if (me != null) M += (me > 0 ? cb.gGa : cb.gGb) * me;
    return { M, V };
  };

  const cantF = (
    Ls: number,
    cb: (typeof COMBS)[number],
    tc: TopCase,
    sc: SectionLoad,
  ): [{ M: number; V: number }, number] => {
    const a = cant(Ls, cb, tc, sc.Me);
    if (!sc.Wf) return [a, sc.Me];
    const m2 = sc.Me + sc.Mef!;
    const bb = cant(Ls, cb, tc, m2);
    return Math.abs(bb.M) > Math.abs(a.M) + 1e-12 ? [bb, m2] : [a, sc.Me];
  };

  for (const cb of COMBS) {
    const tops: TopCase[] = [{ k: 'none', F: 0, z: 0 }];
    if (w && cb.gW > 0) tops.push({ k: 'wind', F: cb.gW * w.F, z: w.z, Fk: w.F });
    if (b && cb.gQ > 0) tops.push({ k: 'bar', F: cb.gQ * b.F, z: b.z, Fk: b.F });

    for (const tc of tops) {
      for (const qv of qi > 0 || (XS.length && !UU) ? [1, 0] : [0]) {
        for (const fd of fdV(S)) {
          if (!qv && fd !== 0) {
            S.st.forEach((s, i) => {
              if (!s.rc && !Gv) return;
              if (!(G.SG[i].h > 1e-9)) return;
              const [a, meU] = cantF(+s.bot, cb, tc, SEC[i]);
              put(
                's' + i,
                {
                  k: 's' + i,
                  n: Gv ? (s.rc ? rcLN(i) : `Mass concrete stem ${i + 1}`) : `Stem ${i + 1} (RC)`,
                  h: G.SG[i].ts * 1000,
                  M: a.M,
                  V: a.V,
                  cm: CV.s,
                  co: CV.s,
                  ty: 's',
                  gv: Gv && !s.rc,
                  me: meU,
                },
                cb,
                tc.k,
              );
            });
          }

          if (dg && !qv && fd !== 0) {
            S.st.forEach((s, i) => {
              if (!s.rc && !Gv) return;
              if (Gv && !s.rc) return;
              const sg = G.SG[i];
              if (!(sg.h > 1e-9)) return;
              const sc = SEC[i];
              const meA = Math.max(0, sc.Me, sc.Wf ? sc.Me + sc.Mef! : -1e9);
              const pts: DiagramPoint[] = [];
              for (let j = 0; j <= 20; j++) {
                const z = sg.bot + (sg.h * j) / 20;
                const a = j ? cant(z, cb, tc, meA) : cantF(sg.bot, cb, tc, sc)[0];
                pts.push({ z, M: a.M, V: a.V });
              }
              dgPut(dg, 's' + i, pts);
            });
            XS.forEach((a) =>
              a.segs.forEach((sg) => {
                const k = 'x' + a.j + (sg.k ? 's' + sg.k : '');
                const pts: DiagramPoint[] = [];
                for (let j = 0; j <= 20; j++) {
                  const z = sg.bot + (sg.h * j) / 20;
                  const L = xsLat(a, cb, z);
                  pts.push({ z, M: L.M, V: L.H });
                }
                dgPut(dg, k, pts);
              }),
            );
          }

          if (!qv && fd !== 0) {
            XS.forEach((a) =>
              a.segs.forEach((sg) => {
                const L = xsLat(a, cb, sg.bot);
                const k = 'x' + a.j + (sg.k ? 's' + sg.k : '');
                put(
                  k,
                  {
                    k,
                    n: `Stem on base ${a.j + 1}${
                      a.segs.length > 1 ? ` – segment ${sg.k + 1} (bottom +${f(sg.bot)})` : ''
                    } (RC)${UU ? ' – U-channel wall' : ''}`,
                    h: sg.t * 1000,
                    M: L.M,
                    V: L.H,
                    cm: CV.s,
                    co: CV.s,
                    ty: 's',
                    gv: 0,
                    fn: UU ? ['Outer (retained) face', 'Channel face'] : null,
                  },
                  cb,
                  tc.k,
                );
              }),
            );
          }

          if (Gv && !qv && fd !== 0 && SEC.blk) {
            const [a, meU] = cantF(+S.Zb, cb, tc, SEC.blk);
            put(
              'B',
              {
                k: 'B',
                n: 'Mass concrete block – section at founding level (min. steel)',
                h: G.B * 1000,
                M: a.M,
                V: a.V,
                cm: CV.s,
                co: CV.s,
                ty: 's',
                gv: 1,
                me: meU,
              },
              cb,
              tc.k,
            );
          }

          if (Gv && !G.n) continue;
          if (tc.k === 'bar' && vSOn(S)) continue;

          const C = comp(
            S,
            { Kah: Kh, d: dDeg, Kp: 0, cP: 0, phr: +S.r.phi },
            tc.F > 0 ? { k: tc.k, F: tc.Fk!, z: tc.z } : null,
          );
          const fa: Record<string, number> = {
            soil: cb.gE,
            water: cb.gE,
            upl: cb.gE,
            sur: cb.gQ,
            sheel: qv ? cb.gQ : 0,
            pvq: cb.gQ,
            pvs: cb.gE,
            dead: cb.gGa,
            fill: cb.gGa,
            tsoil: cb.gGa,
            wind: cb.gW,
            bar: cb.gQ,
            pas: 0,
            pwat: 0,
            ...(fd == null ? {} : { fdl: fd ? cb.gGa : 0 }),
          };
          const s = ev(C, fa, {});
          const B = G.B;
          const qb = qDist(s.N, s.e, B);
          const uf = (x: number) => cb.gE * (C.uf + ((C.ub - C.uf) * x) / B);
          const bad = !(s.N > 0) || Math.abs(s.e) >= B / 2;
          const Fs = FSo(S);

          if (G.Lt0 > 0) {
            const dn = S.gc * S.tb + (S.fon && +S.tsw ? Fs.g * C.dt + Fs.gs * C.wt : 0);
            put(
              'T',
              {
                k: 'T',
                n: Gv ? 'Block – front projection beyond the lowest stem (min. steel)' : 'Toe',
                h: S.tb * 1000,
                M: ints(0, G.Lt0, (x) => (qb(x) + uf(x) - cb.gGb * dn) * (G.Lt0 - x)),
                V: ints(0, G.Lt0, (x) => qb(x) + uf(x) - cb.gGb * dn),
                cm: CV.b,
                co: CV.t,
                ty: 'T',
                bad,
                gv: Gv,
              },
              cb,
              tc.k,
            );
            if (dg) {
              const pts: DiagramPoint[] = [];
              for (let j = 0; j <= 20; j++) {
                const xs = (G.Lt0 * j) / 20;
                pts.push({
                  x: xs,
                  M: ints(0, xs, (x) => (qb(x) + uf(x) - cb.gGb * dn) * (xs - x)),
                  V: ints(0, xs, (x) => qb(x) + uf(x) - cb.gGb * dn),
                });
              }
              dgPut(dg, 'T', pts);
            }
          }

          if (G.hl > 0 && (S.qinRC || !qv)) {
            const Bf = BFo(S);
            const dd =
              S.gc * S.tb +
              (bo ? Bf.g * C.dry + Bf.gs * C.wh : 0) +
              (bo && S.br > 0 ? 0.5 * G.hl * Math.tan(S.br * R) * Bf.g : 0);
            const dq = bo && qv ? qi : 0;
            const xb = G.xb;
            const M = ints(xb, B, (x) => (cb.gGa * dd + cb.gQ * dq - qb(x) - uf(x)) * (x - xb));
            const V = ints(xb, B, (x) => cb.gGa * dd + cb.gQ * dq - qb(x) - uf(x));
            put(
              'H',
              {
                k: 'H',
                n: Gv ? 'Block – rear projection beyond the lowest stem (min. steel)' : 'Heel',
                h: S.tb * 1000,
                M,
                V,
                cm: CV.t,
                co: CV.b,
                ty: 'H',
                bad,
                gv: Gv,
              },
              cb,
              tc.k,
            );
            if (dg) {
              const pts: DiagramPoint[] = [];
              for (let j = 0; j <= 20; j++) {
                const xs = xb + ((B - xb) * j) / 20;
                pts.push({
                  x: xs,
                  M: ints(xs, B, (x) => (cb.gGa * dd + cb.gQ * dq - qb(x) - uf(x)) * (x - xs)),
                  V: ints(xs, B, (x) => cb.gGa * dd + cb.gQ * dq - qb(x) - uf(x)),
                });
              }
              dgPut(dg, 'H', pts);
            }
            {
              const L = B - xb;
              put(
                'Hn',
                {
                  k: 'H',
                  n: 'Heel – base-pressure relief ignored (optional check)',
                  h: S.tb * 1000,
                  M: ((cb.gGa * dd + cb.gQ * dq) * L * L) / 2,
                  V: (cb.gGa * dd + cb.gQ * dq) * L,
                  cm: CV.t,
                  co: CV.b,
                  ty: 'H',
                  gv: Gv,
                },
                cb,
                tc.k,
              );
            }
          }

          if (XS.length) {
            const tb2 = S.tb / 2;
            const dnB = S.gc * S.tb;
            const toeS = S.fon && +S.tsw ? Fs.g * C.dt + Fs.gs * C.wt : 0;
            const qq = qVal(S);
            const Lx = XS.map((a) => xsLat(a, cb));
            const cut = (x: number, gD: number) => {
              let M = ints(0, x, (u) => (qb(u) + uf(u)) * (x - u), 200);
              let V = ints(0, x, (u) => qb(u) + uf(u), 200);
              M -= (gD * dnB * x * x) / 2;
              V -= gD * dnB * x;
              const xt = Math.min(x, XS[0].x0);
              if (xt > 0 && toeS > 0) {
                M -= gD * toeS * xt * (x - xt / 2);
                V -= gD * toeS * xt;
              }
              XS.forEach((a, j) => {
                if (a.xm > x + 1e-9) return;
                const W = gD * S.gc * a.A;
                M -= W * (x - a.xw);
                V -= W;
                const L = Lx[j];
                const mL = L.M + L.H * tb2;
                M += UU ? mL : -mL;
                if (!UU) {
                  const xe = Math.min(x, j < XS.length - 1 ? XS[j + 1].x0 : G.Lt);
                  const Lw = xe - a.x1;
                  if (Lw > 0) {
                    const Wt = Math.min(C.Wb, a.zt);
                    const dz = Math.max(0, a.zt - G.bt);
                    const wt = cl(Wt - G.bt, 0, dz);
                    const wLoad = gD * (Rs.g * (dz - wt) + Rs.gs * wt) + (qv ? cb.gQ * qq : 0);
                    M -= wLoad * Lw * (x - (a.x1 + Lw / 2));
                    V -= wLoad * Lw;
                  }
                }
              });
              return { M, V };
            };

            XS.forEach((a, j) => {
              const xn = j < XS.length - 1 ? XS[j + 1].x0 : G.Lt;
              if (!(xn > a.x1 + 1e-6)) return;
              let mx = 0;
              let mn = 0;
              let vm = 0;
              for (let k = 0; k <= 16; k++) {
                const x = a.x1 + ((xn - a.x1) * k) / 16;
                for (const gD of [cb.gGa, cb.gGb]) {
                  const r = cut(x, gD);
                  mx = Math.max(mx, r.M);
                  mn = Math.min(mn, r.M);
                  vm = Math.max(vm, Math.abs(r.V));
                }
              }
              const nm = `Base span ${j + 1} (x ${f(a.x1)}–${f(xn)} m)`;
              put('M' + j + 't', { k: 'M' + j, n: nm + ' – top face', h: S.tb * 1000, M: Math.max(-mn, 0), V: vm, cm: CV.t, co: CV.b, ty: 'H', bad, span: 1 }, cb, tc.k);
              put('M' + j + 'b', { k: 'M' + j, n: nm + ' – bottom face', h: S.tb * 1000, M: -Math.max(mx, 1e-6), V: vm, cm: CV.t, co: CV.b, ty: 'H', bad, span: 1 }, cb, tc.k);
            });
          }
        }
      }
    }
  }

  return Object.values(els);
}

/** Single-element RC section design check (CoP SUC 2013) */
export function dsg(S: WallState, c: RcActionElement): RcDesignElement {
  const r = rcv(S, c.k);
  const rev = c.M < 0;
  const bm = rev ? { d: r.d3, s: r.s3 } : { d: r.d, s: r.s };
  const bo = rev ? { d: r.d, s: r.s } : { d: r.d3, s: r.s3 };
  const cT = rev ? c.co : c.cm;
  const b = 1000;
  const h = c.h;
  const dd = h - cT - bm.d / 2;
  const M = Math.abs(c.M) * 1e6;
  const fcu = +S.fcu;
  const fy = +S.fy;
  const Kp = KP(fcu);
  const K = M / (fcu * b * dd * dd);
  const gv = !!c.gv;
  const z = dd * Math.min(0.95, 0.5 + Math.sqrt(Math.max(0, 0.25 - Math.min(K, Kp) / 0.9)));
  const x = (dd - z) / XK(fcu);
  const Asr0 = M / (0.87 * fy * z);
  const gpA = gpF(S, 'gpA');
  const Asr = Asr0 * gpA;
  const am = aMin(S);
  const wl = c.ty === 's' && !gv && S.smb !== 'slab';
  const rv = 0.4;
  const rh = fy === 250 ? 0.3 : 0.25;
  const he = gv ? hEff(S, h) : null;
  const Asm = gv
    ? ((+S.grho / 100) * b * he!)
    : wl
      ? ((rv / 2 / 100) * b * h)
      : (S.rmin / 100) * am * b * h;
  const Ab = (d: number, s: number) => ((Math.PI * d * d) / 4) * (1000 / s);
  const Asp = Ab(bm.d, bm.s);
  const As2 = Ab(r.d2, r.s2);
  const As3 = Ab(bo.d, bo.s);
  const secReq = gv ? Asm : wl ? (rh / 100) * b * h : Math.max((S.rmin / 100) * b * h, 0.2 * Asp);
  const secProv = gv ? As2 : 2 * As2;
  const rho = Math.min(3, (100 * Asp) / (b * dd));
  const f4 = Math.max(0.67, Math.pow(400 / dd, 0.25));
  const vc = (0.79 * Math.cbrt(rho) * f4 * Math.cbrt(Math.min(fcu, 80) / 25)) / 1.25;
  const v = (Math.abs(c.V) * 1000) / (b * dd);
  const vmax = Math.min(0.8 * Math.sqrt(fcu), 7);
  const sMain = Math.min(2 * h, 250);
  const sSec = Math.min(3 * h, 400);
  const rq = (100 * Asr) / (b * dd);
  const fs = (2 * fy * Asr) / (3 * Asp);
  const crk = h > 200 && rq >= 0.3;
  const Sc = crk
    ? Math.min(47000 / Math.max(fs, 1), 300) / (rq < 1 ? Math.max(rq, 0.01) : 1)
    : Infinity;
  const st = c.ty === 's';
  const f1 = c.fn ? c.fn[0] : st ? 'Retained (back) face' : c.ty === 'T' ? 'Bottom face' : 'Top face';
  const f2 = c.fn ? c.fn[1] : st ? 'Front face' : c.ty === 'T' ? 'Top face' : 'Bottom face';
  const tf = rev ? f2 : f1;
  const of = rev ? f1 : f2;
  const tab9 = (S.rmin / 100) * am * b * h;

  const okK = K <= Kp;
  const okM = dd > 0 && K <= Kp && Asp >= Math.max(Asr, Asm);
  const okV = v <= vc;
  const okVm = v <= vmax;
  const okSec =
    secProv >= secReq && (!wl || (r.d2 >= Math.max(6, bm.d / 4) && r.s2 <= 400));
  const okMax = Asp <= 0.04 * b * h && As3 <= 0.04 * b * h;
  const okOpp = !(gv || wl) || As3 >= Asm;
  const okS =
    bm.s <= sMain &&
    r.s2 <= sSec &&
    bo.s <= Math.min(3 * h, 400) &&
    [
      [r.s, r.d],
      [r.s2, r.d2],
      [r.s3, r.d3],
    ].every(([sp, dm]) => sp - dm >= Math.max(dm, 25));
  const okCr = !crk || bm.s - bm.d <= Sc;
  const okC = c.cm >= r.d && c.co >= r.d3;
  const uM = Math.max(Asr, Asm) / Math.max(Asp, 1e-9);
  const uV = v / Math.max(vc, 1e-9);
  const ok = okM && okV && okVm && okSec && okMax && okOpp && okS && okCr && okC && !c.bad;

  return {
    ...c,
    wl,
    rv,
    rh,
    r,
    rev,
    bm,
    bo,
    cT,
    d: dd,
    K,
    Kp,
    z,
    x,
    Asr,
    Asr0,
    gpA,
    am,
    Asm,
    he,
    Asp,
    As2,
    As3,
    secReq,
    secProv,
    rho,
    f4,
    vc,
    v,
    vmax,
    sMain,
    sSec,
    rq,
    fs,
    crk,
    Sc,
    tf,
    of,
    st,
    gv,
    tab9,
    okK,
    okM,
    okV,
    okVm,
    okSec,
    okMax,
    okOpp,
    okS,
    okCr,
    okC,
    uM,
    uV,
    ok,
  };
}

/** v14.0 CR-3: ULS BMD/SFD diagram envelope */
export function dgCalc(rawState: WallState, R0: CalcAllSuccessResult): DiagramMap | null {
  if (!R0 || !R0.RS || !R0.RS.length) return null;
  const S = syncedClone(rawState);
  const Pk = R0.Pk;
  const ko = R0.ko;
  const dK = Pk.d;
  const kSet: [number, number][] =
    S.rck === 'ka'
      ? [[Pk.Kah, dK]]
      : S.rck === 'ko'
        ? [[ko, 0]]
        : [
            [Pk.Kah, dK],
            [ko, 0],
          ];
  const DG: DiagramMap = {};
  for (const [K, d] of kSet) rcActions(S, K, d, DG);
  return DG;
}

/** Tension anchorage length lb (CoP Cl 8.4) */
export const lbOf = (S: WallState, phi: number): number => {
  const fy = +S.fy;
  const fcu = Math.min(+S.fcu, 60);
  const be = fy === 250 ? 0.28 : 0.5;
  return (0.87 * fy * phi) / (4 * be * Math.sqrt(fcu));
};

/** Lap length (CoP SUC 2013 Cl 8.7.4.1) */
export function lapReq(S: WallState, k: string, face?: number): number | null {
  if (!/^s\d+$/.test(k) && !/^x\d+$/.test(k)) return null;
  if (/^s\d+$/.test(k) && isG(S) && !(S.st[+k.slice(1)] || {}).rc) return null;
  const r = rcv(S, k);
  const phi = face === 3 ? r.d3 : r.d;
  if (!(phi > 0)) return null;
  const lb = lbOf(S, phi);
  const L = Math.ceil(lb / phi - 1e-9) * phi;
  return Math.ceil(Math.max(L, 15 * phi, 300) / 50 - 1e-9) * 50;
}

/** v14.0 CR-3: 50% curtailment of main tension bars in a stem (CoP Cl 9.2.1.6) */
export function curt(
  S: WallState,
  r: RcDesignElement,
  pts: DiagramPoint[] | undefined,
  G: GeometryResult,
): CurtailmentResult | null {
  if (!pts || pts.length < 2 || r.gv) return null;
  const bars = rcv(S, r.k);
  const phi = bars.d;
  const top = pts[pts.length - 1].z!;
  const ok: (RcDesignElement | false | null)[] = [];
  for (const p of pts) {
    if (p.M < 0) {
      ok.push(false);
      continue;
    }
    const c = dsg(S, {
      k: r.k,
      n: r.n,
      M: p.M,
      V: p.V,
      h: (stemT(r.k, p.z!, G) || r.h / 1000) * 1000,
      cm: r.cm,
      co: r.co,
      ty: 's',
      gv: false,
      fn: r.fn,
      gov: r.gov,
    });
    ok.push(c.okK && Math.max(c.Asr, c.Asm) <= 0.5 * c.Asp + 1e-9 ? c : null);
  }
  let j = ok.length;
  while (j > 0 && ok[j - 1]) j--;
  if (j >= ok.length) {
    const pT = pts[pts.length - 1];
    const cT = dsg(S, {
      k: r.k,
      n: r.n,
      M: Math.max(0, pT.M),
      V: pT.V,
      h: (stemT(r.k, pT.z!, G) || r.h / 1000) * 1000,
      cm: r.cm,
      co: r.co,
      ty: 's',
      gv: false,
      fn: r.fn,
      gov: r.gov,
    });
    return {
      none: 1,
      why:
        cT.Asm > 0.5 * cT.Asp
          ? `50 % of the main bars (${f(0.5 * cT.Asp, 0)} mm²/m) < minimum steel ${f(cT.Asm, 0)} mm²/m – run full height`
          : '50 % of the main bars not sufficient below the top – run full height',
      phi,
      s: bars.s,
    };
  }
  const c = ok[j] as RcDesignElement;
  const zt = pts[j].z!;
  const lb = lbOf(S, phi);
  const ext = Math.max(c.d, 12 * phi, lb);
  const zc = zt + ext / 1000;
  if (zc >= top - 1e-6) {
    return {
      none: 1,
      why: `theoretical point +${f(zt)} + ${f(ext, 0)} mm reaches the top – run full height`,
      phi,
      s: bars.s,
      zt,
      ext,
      lb,
      d: c.d,
    };
  }
  return { phi, s: bars.s, zt, ext, lb, d: c.d, zc, need: Math.max(c.Asr, c.Asm), half: 0.5 * c.Asp };
}

export function dgCU(
  S: WallState,
  R0: CalcAllSuccessResult,
  DG: DiagramMap | null,
): Record<string, CurtailmentResult | null> {
  const o: Record<string, CurtailmentResult | null> = {};
  if (DG) {
    for (const r of R0.RS) {
      if (DG[r.k] && /^[sx]/.test(r.k)) o[r.k] = curt(S, r, DG[r.k], R0.G);
    }
  }
  return o;
}

export const mbName = (S: WallState): string =>
  S.gmb === '965' || !S.gmb
    ? 'Anti-crack mesh (CoP Cl 9.6.5)'
    : `Minimum reinforcement ${S.grmin}% (CoP Cl 9.3.1.1(a))`;

/** Gravity wall anti-crack / minimum steel schedule */
export function meshSched(S: WallState, PL: MassElement[], G?: GeometryResult): MeshRow[] {
  if (!isG(S) || S.gmr !== 'cc') return [];
  const G0 = G ?? geo(S);
  const gb = S.gmb || '965';
  const ab = (d: number, s: number) => ((Math.PI * d * d) / 4) * (1000 / s);
  const BS: Record<'v' | 'h' | 't' | 'b', [number, number]> = {
    v: [+S.mvd || 12, +S.mvs || 175],
    h: [+S.mhd || 12, +S.mhs || 175],
    t: [+S.mtd || 12, +S.mts || 175],
    b: [+S.mbd || 12, +S.mbs || 175],
  };
  const rows: MeshRow[] = [];
  const req = (hm: number) => {
    if (gb === '965') {
      const he = Math.min(hm / 2, Math.max(1, hEffMax(S)));
      return {
        he,
        Am: (+S.grho / 100) * 1000 * he,
        At: undefined as number | undefined,
        tot: 0,
        txt: `${S.grho}% × 1000 × ${f(he, 0)} (h_eff) per face`,
      };
    }
    const At = (+S.grmin / 100) * 1000 * hm;
    return gb === '913t'
      ? { he: hm, Am: At / 2, At, tot: 1, txt: `${S.grmin}% × 1000 × ${f(hm, 0)} = ${f(At, 0)} total of both faces` }
      : { he: hm, Am: At, At, tot: 0, txt: `${S.grmin}% × 1000 × ${f(hm, 0)} at each face` };
  };
  const row = (
    sec: string,
    lab: string,
    k: 'v' | 'h' | 't' | 'b',
    hm: number,
    L: number,
    pair: string,
  ): MeshRow => {
    const [d, sp] = BS[k];
    const Ap = ab(d, sp);
    const Rr = req(hm);
    return {
      sec,
      lab,
      lab0: lab,
      k,
      hm,
      he: Rr.he,
      Am: Rr.Am,
      At: Rr.At,
      tot: Rr.tot,
      rtx: Rr.txt,
      d,
      sp,
      Ap,
      L,
      pair,
      okS: sp <= 300,
      prov: 0,
      need: 0,
      okA: false,
      u: 0,
      wt: 0,
      ok: false,
    };
  };

  for (const p of PL) {
    const hm = p.h * 1000;
    const st = S.st[p.i];
    const Hh = p.blk ? +S.gBh : st ? +st.top - +st.bot : 0;
    rows.push(
      row(p.lab, 'Vertical bars – front & back faces', 'v', hm, Hh, 'v'),
      row(p.lab, 'Horizontal bars – front & back faces', 'h', hm, Hh, 'h'),
    );
    if (p.blk) {
      const hb = +S.gBh * 1000;
      const sec = `${S.st.length ? 'Base block' : 'Mass concrete block'} – top / bottom faces (h = block height ${f(+S.gBh)} m)`;
      rows.push(
        row(sec, 'Transverse – main (across the wall), top & bottom faces', 't', hb, G0.B, 't'),
        row(sec, 'Longitudinal – distribution (along the wall), top & bottom faces', 'b', hb, G0.B, 'b'),
      );
    }
  }

  for (const r of rows) {
    const prov = r.tot
      ? r.pair === 'tb'
        ? rows.filter((x) => x.sec === r.sec && x.pair === 'tb').reduce((a, x) => a + x.Ap, 0)
        : 2 * r.Ap
      : r.Ap;
    const need = r.tot ? r.At! : r.Am;
    r.prov = prov;
    r.need = need;
    r.okA = prov >= need - 1e-6;
    r.u = need / Math.max(prov, 1e-9);
    r.wt = r.Ap * 1e-6 * 7850 * r.L * 2;
    r.lab0 = r.lab;
    r.ok = r.okA && r.okS;
  }
  return rows;
}

/** Tension anchorage of gravity RC stem starter bars (CoP 2013 Cl 8.4) */
export function anch(S: WallState, r: RcDesignElement): AnchorageResult {
  const i = +String(r.k).slice(1);
  const phi = r.bm.d;
  const fy = +S.fy;
  const fcu = Math.min(+S.fcu, 60);
  const be = fy === 250 ? 0.28 : 0.5;
  const fb = be * Math.sqrt(fcu);
  const lb = (0.87 * fy * phi) / (4 * fb);
  const n = Math.ceil(lb / phi - 1e-9);
  const L = n * phi;
  const emb = Math.ceil(L / 50) * 50;
  const nb = S.st[i + 1];
  const rcB = !!(nb && nb.rc);
  const av = nb ? (+nb.top - +nb.bot) * 1000 : +S.gBh * 1000;
  const into = nb
    ? nb.rc
      ? `Stem ${i + 2} (RC) below (lap / anchorage in RC)`
      : `mass concrete stem ${i + 2} below`
    : 'mass concrete block';
  return { phi, fy, fcu, be, fb, lb, n, L, emb, av, rcB, into, ok: av >= emb - 1e-6 };
}

/** Starter bars of an RC stem into an RC base slab */
export function ancRC(S: WallState, r: RcDesignElement): AnchorageResult {
  const phi = r.bm.d;
  const fy = +S.fy;
  const fcu = Math.min(+S.fcu, 60);
  const be = fy === 250 ? 0.28 : 0.5;
  const lb = (0.87 * fy * phi) / (4 * be * Math.sqrt(fcu));
  const emb = Math.ceil((Math.ceil(lb / phi - 1e-9) * phi) / 50) * 50;
  const db = Math.max(rcv(S, 'T').d || 0, rcv(S, 'H').d3 || 0);
  const av = +S.tb * 1000 - cvAll(S).b - db;
  return { phi, fy, fcu, be, lb, emb, av, ok: av >= emb - 1e-6 };
}
