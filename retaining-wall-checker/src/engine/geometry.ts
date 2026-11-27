/**
 * Wall cross-section geometry, polylines, soil bands, shear key geometry,
 * section vertical loads, concrete volume, and steel weight estimation.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import {
  BFo,
  FSo,
  fdOn,
  fdW,
  gBW,
  gLn,
  gTx,
  isG,
  isU,
  wlLev,
} from './helpers';
import { cl, f } from './math';
import type {
  ExtraStemGeo,
  ExtraStemSegmentGeo,
  GeometryResult,
  MassElement,
  Piece4,
  Point2D,
  RcDesignElement,
  SectionLoad,
  SectionLoadsResult,
  ShearKeyGeo,
  SoilBandResult,
  StemGeo,
  WallState,
} from './types';

export const trap = (b1: number, b2: number, h: number) => ({
  A: ((b1 + b2) / 2) * h,
  xc: (b1 * b1 + b1 * b2 + b2 * b2) / (3 * (b1 + b2)),
  yc: (h * (b1 + 2 * b2)) / (3 * (b1 + b2)),
});

export function stemGeo(S: WallState): StemGeo[] {
  const n = S.st.length;
  const Gw = isG(S);
  const out: StemGeo[] = new Array(n);
  let xs = Gw ? gTx(S) : 0;

  for (let i = n - 1; i >= 0; i--) {
    const s = S.st[i];
    const t = +s.t;
    const fb = Math.max(0, +s.fb || 0);
    const rb = Math.max(0, +s.rb || 0);
    const h = Math.max(0, +s.top - +s.bot);
    const xf0 = !Gw && i === n - 1 ? (S.ty === 'L' ? 0 : +S.Lt) : xs + (+s.of || 0);
    const xb0 = xf0 + t;
    out[i] = {
      i,
      s,
      t,
      fb,
      rb,
      tt: t - fb - rb,
      h,
      bot: +s.bot,
      top: +s.top,
      xf0,
      xb0,
      xf1: xf0 + fb,
      xb1: xb0 - rb,
      xc: xf0 + t / 2,
      xs0: 0,
      xs1: 0,
      ts: 0,
      ovF: 0,
      ovB: 0,
    };
    xs = xf0 + fb;
  }

  for (let i = 0; i < n; i++) {
    const g = out[i];
    const sup = i < n - 1 ? out[i + 1] : null;
    const a = sup ? sup.xf1 : Gw ? gTx(S) : g.xf0;
    const b = sup ? sup.xb1 : Gw ? a + Math.max(0, +S.gBt || 0) : g.xb0;
    g.xs0 = Math.max(g.xf0, a);
    g.xs1 = Math.min(g.xb0, b);
    g.ts = Math.max(0, g.xs1 - g.xs0);
    g.ovF = Math.max(0, a - g.xf0);
    g.ovB = Math.max(0, g.xb0 - b);
  }
  return out;
}

/** x of a wall face (polyline listed top -> bottom) at level z */
export const pX = (P: Point2D[], z: number): number => {
  if (!P.length) return 0;
  if (z >= P[0][1]) return P[0][0];
  for (let k = 0; k < P.length - 1; k++) {
    const [a, za] = P[k];
    const [b, zb] = P[k + 1];
    if (za > zb && z <= za && z >= zb) return a + ((b - a) * (za - z)) / (za - zb);
  }
  return P[P.length - 1][0];
};

/** Same as pX, but at a vertex shared by two segments the LOWER segment is used */
export const pXl = (P: Point2D[], z: number): number => {
  for (let k = P.length - 2; k >= 0; k--) {
    const [a, za] = P[k];
    const [b, zb] = P[k + 1];
    if (za > zb && z <= za + 1e-9 && z >= zb - 1e-9) {
      return a + ((b - a) * (za - z)) / (za - zb);
    }
  }
  return pX(P, z);
};

/** Trapezoid split into front triangle + rectangle + rear triangle */
export const pieces4 = (
  xf0: number,
  xb0: number,
  fb: number,
  rb: number,
  z0: number,
  h: number,
): Piece4[] => {
  const r: Piece4[] = [];
  if (!(h > 1e-9)) return r;
  const rp = Math.max(0, rb);
  const rn = Math.max(0, -rb);
  const tt = xb0 - xf0 - fb - rp;
  if (fb > 1e-9) r.push({ k: 'fb', b: fb, h, A: (fb * h) / 2, x: xf0 + (2 * fb) / 3, z: z0 + h / 3 });
  if (tt > 1e-9) r.push({ k: 'r', b: tt, h, A: tt * h, x: xf0 + fb + tt / 2, z: z0 + h / 2 });
  if (rp > 1e-9) r.push({ k: 'rb', b: rp, h, A: (rp * h) / 2, x: xb0 - (2 * rp) / 3, z: z0 + h / 3 });
  if (rn > 1e-9) r.push({ k: 'rb', b: rn, h, A: (rn * h) / 2, x: xb0 + rn / 3, z: z0 + (2 * h) / 3 });
  return r;
};

/** Soil between a wall face P and the vertical plane (side 'b': x = B; 'f': x = 0) for z1..z2 */
export function soilBand(
  P: Point2D[],
  side: 'b' | 'f',
  B: number,
  z1: number,
  z2: number,
  Wl: number,
): SoilBandResult {
  const r: SoilBandResult = { d: { A: 0, M: 0, Z: 0 }, s: { A: 0, M: 0, Z: 0 } };
  if (!(z2 > z1 + 1e-9)) return r;
  const zs = [z1, z2, Wl, ...P.map((p) => p[1])]
    .filter((z) => z >= z1 && z <= z2)
    .sort((a, b) => a - b);
  const W = (z: number) => {
    const x = pX(P, z);
    return side === 'b' ? Math.max(0, B - x) : Math.max(0, x);
  };
  for (let k = 0; k < zs.length - 1; k++) {
    const za = zs[k];
    const zb = zs[k + 1];
    const Lz = zb - za;
    if (!(Lz > 1e-9)) continue;
    const e = Math.min(1e-7, Lz / 10);
    const w1 = W(za + e);
    const w2 = W(zb - e);
    const A = ((w1 + w2) / 2) * Lz;
    if (!(A > 0)) continue;
    const I2 = (Lz * (w1 * w1 + w1 * w2 + w2 * w2)) / 3;
    const o = (za + zb) / 2 < Wl ? r.s : r.d;
    o.A += A;
    o.M += side === 'b' ? B * A - I2 / 2 : I2 / 2;
    o.Z += (Lz * (w1 * (2 * za + zb) + w2 * (za + 2 * zb))) / 6;
  }
  return r;
}

/** Soil between wall back face and inclined plane (numerical strips) */
export function soilBandP(
  Pw: Point2D[],
  xp: (z: number) => number,
  z1: number,
  z2: number,
  Wl: number,
): SoilBandResult {
  const r: SoilBandResult = { d: { A: 0, M: 0, Z: 0 }, s: { A: 0, M: 0, Z: 0 } };
  if (!(z2 > z1 + 1e-9)) return r;
  const N = Math.max(60, Math.ceil((z2 - z1) / 0.01));
  const dz = (z2 - z1) / N;
  for (let k = 0; k < N; k++) {
    const z = z1 + (k + 0.5) * dz;
    const xw = pX(Pw, z);
    const x2 = xp(z);
    const w = Math.max(0, x2 - xw);
    if (!(w > 0)) continue;
    const o = z < Wl ? r.s : r.d;
    const A = w * dz;
    o.A += A;
    o.M += A * (x2 - w / 2);
    o.Z += A * z;
  }
  return r;
}

/** Soil on base between a stem on base (back face x1) and next stem (front face xn(z)) */
export function terrBand(
  x1: number | ((z: number) => number),
  xn: (z: number) => number,
  z1: number,
  z2: number,
  Wl: number,
): SoilBandResult {
  const r: SoilBandResult = { d: { A: 0, M: 0, Z: 0 }, s: { A: 0, M: 0, Z: 0 } };
  const X1 = typeof x1 === 'function' ? x1 : () => x1;
  if (!(z2 > z1 + 1e-9)) return r;
  const N = Math.max(60, Math.ceil((z2 - z1) / 0.01));
  const dz = (z2 - z1) / N;
  for (let k = 0; k < N; k++) {
    const z = z1 + (k + 0.5) * dz;
    const xa = X1(z);
    const w = Math.max(0, xn(z) - xa);
    if (!(w > 0)) continue;
    const o = z < Wl ? r.s : r.d;
    const A = w * dz;
    o.A += A;
    o.M += A * (xa + w / 2);
    o.Z += A * z;
  }
  return r;
}

export function xsGeo(S: WallState, bt: number): ExtraStemGeo[] {
  if (isG(S) || !Array.isArray(S.xs) || !S.xs.length) return [];
  const UU = S.xa === 'U';
  return S.xs.map((s, j) => {
    const x0 = Math.max(0, +s.x || 0);
    const t = Math.max(0, +s.t || 0);
    const h = Math.max(0, +s.h || 0);
    const x1 = x0 + t;
    const segs: ExtraStemSegmentGeo[] = [
      { k: 0, x0, x1, t, h, bot: bt, top: bt + h, p: `xs.${j}` },
    ];
    let z = bt + h;
    (Array.isArray(s.up) ? s.up : []).forEach((u, i) => {
      const tu = Math.max(0, +u.t || 0);
      const hu = Math.max(0, +u.h || 0);
      const a0 = UU ? x1 - tu : x0;
      segs.push({
        k: i + 1,
        x0: a0,
        x1: a0 + tu,
        t: tu,
        h: hu,
        bot: z,
        top: z + hu,
        p: `xs.${j}.up.${i}`,
      });
      z += hu;
    });
    const top = z;
    const A = segs.reduce((q, g) => q + g.t * g.h, 0);
    const xw = A > 0 ? segs.reduce((q, g) => q + g.t * g.h * (g.x0 + g.t / 2), 0) / A : x0 + t / 2;
    const sg = (zz: number) =>
      segs.find((g) => zz >= g.bot - 1e-9 && zz <= g.top + 1e-9) || segs[segs.length - 1];
    return {
      j,
      s,
      x0,
      x1,
      t,
      h,
      bot: bt,
      top,
      zt: UU ? bt : Math.min(top, Math.max(bt, +s.zt || bt)),
      xc: x0 + t / 2,
      pp: !!s.pp,
      segs,
      A,
      xw,
      xm: Math.max(...segs.map((g) => g.x1)),
      xn0: Math.min(...segs.map((g) => g.x0)),
      xb: (zz: number) => sg(zz).x1,
      xf: (zz: number) => sg(zz).x0,
    };
  });
}

export function geo(S: WallState): GeometryResult {
  const n = S.st.length;
  const Gw = isG(S);
  const SG = stemGeo(S);
  const bt = +S.Zb + +S.tb;
  const Zb = +S.Zb;
  const bf = Gw ? Math.max(0, +S.gbf || 0) : 0;
  const br = Gw ? +S.gbr || 0 : 0;
  const B = Gw
    ? gBW(S)
    : (S.ty === 'L' ? 0 : +S.Lt) + (n ? +S.st[n - 1].t : 0) + (S.ty === 'Li' ? 0 : +S.Lh);
  let k = n - 1;
  while (k > 0 && !(SG[k].h > 1e-9)) k--;
  const b = n ? SG[k] : null;
  const Lt = b ? b.xf0 : 0;
  const xb = b ? b.xb0 : B;
  const bk: Point2D[] = [];
  const fr: Point2D[] = [];
  for (const s of SG) {
    if (!(s.h > 1e-9)) continue;
    bk.push([s.xb1, s.top], [s.xb0, s.bot]);
    fr.push([s.xf1, s.top], [s.xf0, s.bot]);
  }
  bk.push([B - br, bt], [B, Zb]);
  fr.push([bf + gLn(), bt], [0, Zb]);
  const XS = xsGeo(S, bt);
  const frM = fr.slice();
  const fr2: Point2D[] = XS.length
    ? [
        ...XS[0].segs
          .slice()
          .reverse()
          .flatMap((g): Point2D[] => [
            [g.x0, g.top],
            [g.x0, g.bot],
          ]),
        [0, bt],
        [0, Zb],
      ]
    : fr;
  const Hr = +S.Hr;
  const xH = pXl(bk, Hr);
  const Lw = S.bon ? Math.max(0, B - xH) : 0;
  const vb =
    !!S.bon &&
    Hr > Zb + 1e-9 &&
    (Lw > 1e-4 || bk.some((p) => p[1] < Hr - 1e-9 && p[1] > Zb + 1e-9 && B - p[0] > 1e-4));
  return {
    n,
    SG,
    tl: xb - Lt,
    Lt,
    hl: Math.max(0, B - xb),
    B,
    xb,
    bt,
    top: bk[0][1],
    bk,
    fr: fr2,
    frM,
    XS,
    Lt0: XS.length ? XS[0].x0 : Lt,
    Lw,
    xH,
    vb,
    ftx: frM[0][0],
    ttw: bk[0][0] - frM[0][0],
  };
}

export const fdX = (S: WallState, G: GeometryResult): number =>
  G.ftx +
  (S.fxo !== '' && S.fxo != null && Number.isFinite(+S.fxo)
    ? cl(+S.fxo, 0, G.ttw)
    : G.ttw / 2);

/** Shear key geometry (GG1 §9.2.3(2), Fig. 42) */
export const keyG = (S: WallState, G?: GeometryResult): ShearKeyGeo | null => {
  if (!S.skon) return null;
  const G0 = G ?? geo(S);
  const Bk = Math.max(0, +S.skw);
  const dk = Math.max(0, +S.skd);
  return { dk, Bk, xk: cl(+S.skx, 0, Math.max(0, G0.B - Bk)) };
};

/** Concrete cross-section area per m run (= m³/m) */
export function concArea(S: WallState, G?: GeometryResult): number {
  const G0 = G ?? geo(S);
  let A = isG(S) ? ((Math.max(0, +S.gBt) + gBW(S)) / 2) * +S.tb : G0.B * S.tb;
  G0.SG.forEach((g) => {
    A += ((g.t + g.tt) / 2) * g.h;
  });
  (G0.XS || []).forEach((a) => {
    A += a.A;
  });
  const K = keyG(S, G0);
  if (K) A += K.Bk * K.dk;
  return A;
}

/** Approximate steel weight per m run (bars over element lengths; laps / anchorage excluded) */
export function steelKg(S: WallState, RS: RcDesignElement[], G?: GeometryResult): number {
  const G0 = G ?? geo(S);
  let m = 0;
  for (const r of RS) {
    let L = 0;
    if (r.k[0] === 's') {
      const s = S.st[+r.k.slice(1)];
      L = s ? s.top - s.bot : 0;
    } else if (r.k[0] === 'x') {
      const mt = r.k.match(/^x(\d+)(?:s(\d+))?$/);
      const a = mt && G0.XS[+mt[1]];
      const g = a && a.segs[+(mt[2] || 0)];
      L = g ? g.h + (+(mt[2] || 0) ? 0 : G0.tl / 2) : 0;
    } else if (r.k[0] === 'M') {
      const j = +r.k.slice(1);
      const a = G0.XS[j];
      L = a ? ((j < G0.XS.length - 1 ? G0.XS[j + 1].x0 : G0.Lt) - a.x1) / 2 : 0;
    } else if (r.k === 'T') {
      L = G0.Lt0 + G0.tl / 2;
    } else if (r.k === 'H') {
      L = G0.hl + G0.tl / 2;
    } else if (r.k === 'B') {
      L = +S.tb;
    }
    m += (r.Asp + r.As3 + 2 * r.As2) * 1e-6 * 7850 * L;
  }
  return m;
}

/** Vertical loads above each stem section (+ mass block at founding level) */
export function secLoads(S: WallState, G?: GeometryResult): SectionLoadsResult {
  const G0 = G ?? geo(S);
  const Rs = BFo(S);
  const Hr = +S.Hr;
  const XS = G0.XS || [];
  const nX = XS.length;
  const Fs = nX ? Rs : FSo(S);
  const Wb = S.bon ? wlLev(S) : -1e9;
  const fOn = nX ? !isU(S) : !!S.fon;
  const frP = nX ? G0.frM : G0.fr;
  const zT = nX
    ? isU(S)
      ? +S.Zb
      : XS[nX - 1].zt
    : Math.max(+S.Zb, +S.Hf - S.dp);
  const Wf = nX ? Math.min(Wb, zT) : Math.min(+S.fw, +S.Hf);
  const SG = G0.SG;

  const BRK = [
    Wb,
    Wf,
    zT,
    Hr,
    +S.Zb,
    +S.Zb + +S.tb,
    ...SG.flatMap((q) => [q.bot, q.top]),
    ...XS.flatMap((a) => [
      a.zt,
      a.top,
      a.bot,
      ...(a.segs || []).flatMap((g) => [g.bot, g.top]),
    ]),
  ]
    .map(Number)
    .filter(Number.isFinite);

  const strip = (z1: number, z2: number, fn: (z: number, dz: number) => void) => {
    if (!(z2 > z1)) return;
    const bp = [
      z1,
      ...BRK.filter((z) => z > z1 + 1e-9 && z < z2 - 1e-9).sort((a, b) => a - b),
      z2,
    ];
    for (let j = 0; j < bp.length - 1; j++) {
      const a = bp[j];
      const c = bp[j + 1];
      if (!(c > a)) continue;
      const N = Math.max(4, Math.ceil((c - a) / 0.01 - 1e-6));
      const dz = (c - a) / N;
      for (let k = 0; k < N; k++) fn(a + (k + 0.5) * dz, dz);
    }
  };

  const one = (xf0: number, xb0: number, zb: number, pcs: Piece4[]): SectionLoad => {
    let W = 0;
    let Me = 0;
    const xc = (xf0 + xb0) / 2;
    const acc = (Wt: number, x: number) => {
      W += Wt;
      Me += Wt * (xc - x);
    };
    pcs.forEach((p) => acc(p.A * S.gc, p.x));
    if (S.bon) {
      strip(zb, Hr, (z, dz) => {
        const x = Math.max(pX(G0.bk, z), xf0);
        if (x < xb0 - 1e-9) acc((xb0 - x) * dz * (z < Wb ? Rs.gs : Rs.g), (xb0 + x) / 2);
      });
    }
    if (fOn) {
      strip(zb, zT, (z, dz) => {
        const x = Math.min(pX(frP, z), xb0);
        if (x > xf0 + 1e-9) acc((x - xf0) * dz * (z < Wf ? Fs.gs : Fs.g), (xf0 + x) / 2);
      });
    }
    if (!fdOn(S)) return { W, Me };
    const Wd = fdW(S);
    return { W, Me, Wf: Wd, Mef: Wd * (xc - fdX(S, G0)) };
  };

  const stp = (k: number) =>
    SG.slice(0, k + 1).flatMap((q) => pieces4(q.xf0, q.xb0, q.fb, q.rb, q.bot, q.h));

  const out: SectionLoadsResult = SG.map((g) => one(g.xs0, g.xs1, g.bot, stp(g.i)));
  if (isG(S)) {
    const bf = Math.max(0, +S.gbf || 0);
    const br = +S.gbr || 0;
    const Zb = +S.Zb;
    const all = stp(SG.length - 1);
    out.blk = {
      ...one(0, G0.B, Zb, [...all, ...pieces4(0, G0.B, bf + gLn(), br, Zb, +S.tb)]),
      xf0: 0,
      xb0: G0.B,
      z: Zb,
    };
  }
  return out;
}

/** Stem thickness at level z (used for curtailment CR-3) */
export function stemT(k: string, z: number, G: GeometryResult): number | null {
  let m: RegExpMatchArray | null;
  if ((m = k.match(/^s(\d+)$/))) {
    const g = G.SG[+m[1]];
    if (!g) return null;
    const t0 = g.xb0 - g.xf0;
    const t1 = g.xb1 - g.xf1;
    return z <= g.bot + 1e-9 ? g.ts || t0 : t0 + ((t1 - t0) * (z - g.bot)) / Math.max(g.h, 1e-9);
  }
  if ((m = k.match(/^x(\d+)(?:s(\d+))?$/))) {
    const a = G.XS[+m[1]];
    const sg = a && a.segs[+(m[2] || 0)];
    return sg ? sg.t : null;
  }
  return null;
}

/** Mass concrete elements of a gravity wall */
export function massEls(S: WallState, G?: GeometryResult): MassElement[] {
  if (!isG(S)) return [];
  const G0 = G ?? geo(S);
  const o: MassElement[] = [];
  S.st.forEach((st, i) => {
    if (st.rc || !(G0.SG[i].h > 1e-9)) return;
    o.push({ i, lab: `Mass concrete stem ${i + 1}`, h: G0.SG[i].ts, blk: 0 });
  });
  o.push({ i: -1, lab: `Mass concrete block — founding level +${f(+S.Zb)}`, h: G0.B, blk: 1 });
  return o;
}
