/**
 * Earth pressure coefficients (Rankine, Coulomb, Manual), wall friction (GG1 Table 14),
 * at-rest Ko (GG1 §6.4), compaction-induced pressure (GG1 §6.8 Fig. 27),
 * and factored/characteristic soil parameters (GG1 Eq 4.3, 4.4).
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { DEG2RAD as R } from './constants';
import { geo, pX, pXl } from './geometry';
import { FSo, isG, phiCv, qVal } from './helpers';
import { f } from './math';
import type {
  CompactionInfo,
  GeometryResult,
  KaResult,
  MaterialParams,
  WallDeltaResult,
  WallState,
} from './types';

export const qIn = (S: WallState, G?: GeometryResult): number =>
  (G ?? geo(S)).Lw > 0 ? Math.max(0, +S.qin || 0) : 0;

export const qSide = (S: WallState, G?: GeometryResult): number => {
  const G0 = G ?? geo(S);
  return G0.Lw > 0 ? Math.max(qIn(S, G0), qVal(S)) : qVal(S);
};

/** Gravity wall Coulomb pressure plane inclination alpha (GG1 Fig. 39 / 40) */
export function gAlpha(S: WallState, phiDeg: number, G?: GeometryResult): number {
  if (!isG(S) || S.kam !== 'c' || !S.bon) return 0;
  const G0 = G ?? geo(S);
  const B = G0.B;
  const Zb = +S.Zb;
  const Hr = +S.Hr;
  if (!(Hr > Zb + 1e-6)) return 0;
  if ((+S.gbr || 0) < 0) return 0;
  const pts = G0.bk.filter((p) => p[1] > Zb + 1e-6 && p[1] <= Hr + 1e-9);
  pts.push([pXl(G0.bk, Hr), Hr]);
  if (pts.some((p) => p[0] > B + 1e-6)) return 0;
  let a = Math.PI / 2;
  for (const [x, z] of pts) a = Math.min(a, Math.atan(Math.max(0, B - x) / (z - Zb)));
  return Math.max(0, Math.min(a / R, 45 - phiDeg / 2));
}

export const gPlane = (S: WallState, al: number, G: GeometryResult) => (z: number): number =>
  G.B - Math.max(0, z - +S.Zb) * Math.tan(al * R);

/** Wall friction angle delta (GG1 Table 14) */
export function wallDelta(S: WallState, phiDeg: number, G?: GeometryResult): WallDeltaResult {
  const G0 = G ?? geo(S);
  const virt = G0.vb;
  let dmax: number;
  let src: string;
  let dmaxSec: number | null = null;
  let soilZ = false;

  if (S.comp) {
    dmax = 0;
    src = 'Geoguide 1 (2020) Table 14 Note (2) – wall on compressible foundation: δ = 0';
  } else if (S.ty === 'G') {
    const al = gAlpha(S, phiDeg, G0);
    const xpl = gPlane(S, al, G0);
    const bt2 = +S.Zb + +S.tb;
    const Hr2 = +S.Hr;
    const dC = (2 * phiDeg) / 3;
    const dS = Math.min(phiDeg / 2, S.bon ? Math.max(0, +S.br) : 0);
    if (S.bon && Hr2 > bt2 + 1e-6) {
      for (let k = 0; k < 22; k++) {
        const z = bt2 + ((Hr2 - bt2) * (k + 0.5)) / 22;
        if (pX(G0.bk, z) < xpl(z) - 1e-4) {
          soilZ = true;
          break;
        }
      }
    }
    dmaxSec = dC;
    dmax = dC;
    soilZ = false; // v13.8.4: mass concrete wall takes δmax = 2φ′/3 for the whole wall
    src =
      `Geoguide 1 (2020) Table 14 – soil/wall interface of a mass concrete (gravity) wall: δmax = 2φ′/3 = ${f(dC, 1)}°; Pa on the ${
        Math.abs(al) > 1e-6
          ? `${al < 0 ? 'battered back face leaning into the fill' : 'plane through the back corners of the wall'} (GG1 Fig. 39 / 40), α = ${f(al, 1)}° to the vertical`
          : 'back of the wall (GG1 Fig. 39)'
      }` +
      (soilZ
        ? `. Above the top of the block (+${f(bt2)}) the plane passes through the retained soil, a soil-to-soil interface with δmax = min(φ′/2, β) = ${f(dS, 1)}°. GG1 Fig. 40(b) applies a single δ to the whole wall, so the whole-wall check takes the smaller value, δmax = ${f(dmax, 1)}°; each change-in-section check above the block uses its own plane, δmax = ${f(dC, 1)}°.`
        : '');
  } else if (virt) {
    const b = S.bon ? +S.br : 0;
    dmax = Math.min(phiDeg / 2, b);
    src = `Geoguide 1 (2020) Table 14 & §5.11.2 – ${
      isG(S)
        ? 'virtual back in the soil (soil–soil plane through the back edge of the block, GG1 Fig. 40)'
        : S.ty === 'Li'
          ? 'virtual back in the soil (battered stem back)'
          : 'virtual back of R.C. L / inverted-T wall'
    }: δmax = min(φ′/2, backfill slope β) = min(${f(phiDeg / 2, 1)}°, ${f(b, 1)}°) = ${f(dmax, 1)}°`;
  } else if (S.ty === 'Li' || S.ty === 'G') {
    dmax = (2 * phiDeg) / 3;
    src = `Geoguide 1 (2020) Table 14 – soil/wall interface of ${
      S.ty === 'G'
        ? 'mass concrete (gravity) wall, pressure on the concrete back face'
        : 'R.C. reversed L-shaped wall'
    }: δmax = 2φ′/3 = ${f((2 * phiDeg) / 3, 1)}°`;
  } else {
    dmax = phiDeg / 2;
    src = 'GG1 Table 14';
  }

  const fr =
    S.dwm === 'auto'
      ? dmax / phiDeg
      : S.dwm === 'h'
        ? 0.5
        : S.dwm === 't'
          ? 2 / 3
          : +S.dcw / +S.r.phi;
  const dR = fr * phiDeg;
  const d = Math.min(dR, dmax);
  return {
    d,
    dRaw: dR,
    dmax,
    dmaxSec: dmaxSec == null ? dmax : dmaxSec,
    soilZ,
    src,
    over: dR > dmax + 1e-6,
    used: d,
  };
}

/** Active earth pressure coefficient Ka (Rankine / Coulomb) */
export function KaOf(
  S: WallState,
  phiDeg: number,
  dDeg: number,
  bDeg = 0,
  aDeg = 0,
): KaResult {
  const p = phiDeg * R;
  const d = dDeg * R;
  const b = bDeg * R;
  const t = aDeg * R;

  if (S.kam === 'c') {
    const Ka =
      Math.cos(p - t) ** 2 /
      (Math.cos(t) ** 2 *
        Math.cos(d + t) *
        (1 +
          Math.sqrt(
            Math.max(0, Math.sin(p + d) * Math.sin(p - b)) /
              (Math.cos(d + t) * Math.cos(t - b)),
          )) **
          2);
    return {
      Ka,
      Kah: Ka * Math.cos(d + t),
      d: dDeg,
      al: aDeg,
      lab: `Coulomb (GG1 §6.5.4, Fig. 17), δ = ${f(dDeg, 1)}°, β = ${f(bDeg, 1)}°${
        Math.abs(aDeg) > 1e-6
          ? `, back inclination α = ${f(aDeg, 1)}°${
              aDeg < 0
                ? ' (back batter leaning into the fill – GG1 §9.2.3(2): reduces the earth pressure)'
                : ''
            } (GG1 Fig. 39: Pah = Pa·cos(α+δ), Pav = Pa·sin(α+δ))`
          : ''
      }`,
    };
  }
  if (bDeg > 0) {
    const cb = Math.cos(b);
    const r = Math.sqrt(Math.max(0, cb * cb - Math.cos(p) ** 2));
    const Ka = (cb * (cb - r)) / (cb + r);
    return {
      Ka,
      Kah: Ka * Math.cos(d),
      d: dDeg,
      lab: `Rankine (GG1 §6.5.1), sloping backfill β = ${f(bDeg, 1)}°`,
    };
  }
  const Ka = (1 - Math.sin(p)) / (1 + Math.sin(p));
  return { Ka, Kah: Ka * Math.cos(d), d: dDeg, lab: 'Rankine (GG1 §6.5.1)' };
}

/** Passive earth pressure coefficient Kp (Coulomb, δ = 0; uphill β_front conservatively 0) */
export const KpOf = (phiDeg: number, bDeg = 0): number => {
  const p = phiDeg * R;
  const b = Math.min(0, bDeg) * R;
  return (
    Math.cos(p) ** 2 /
    (1 - Math.sqrt(Math.max(0, (Math.sin(p) * Math.sin(p + b)) / Math.cos(b)))) ** 2
  );
};

/** Trial wedge critical planar failure surface from heel (v13.8 CR-10) */
export function wedgeCrit(phiDeg: number, dDeg: number, bDeg: number) {
  const p = phiDeg * R;
  const d = dDeg * R;
  const b = Math.max(0, bDeg) * R;
  const tb = Math.tan(b);
  let best = { Pa: -1, th: 0, xH: 0 };
  let lo = b + 1e-6;
  let hi = Math.PI / 2 - 1e-6;
  for (let pass = 0; pass < 3; pass++) {
    const n = 240;
    const st = (hi - lo) / n;
    for (let i = 0; i <= n; i++) {
      const th = lo + i * st;
      const t = Math.tan(th) - tb;
      if (!(t > 1e-9)) continue;
      const x = 1 / t;
      const A = 0.5 * x;
      const den = Math.cos(th - p - d);
      if (Math.abs(den) < 1e-9) continue;
      const Pa = (A * Math.sin(th - p)) / den;
      if (Pa > best.Pa) best = { Pa, th: th / R, xH: x };
    }
    lo = Math.max(b + 1e-6, (best.th - (2 * st) / R) * R);
    hi = Math.min(Math.PI / 2 - 1e-6, (best.th + (2 * st) / R) * R);
  }
  return best;
}

export const omg = (S: WallState): number => (S.fon ? Math.max(0, -+S.bf) : 0);

/** Characteristic ('k') or GG1 factored ('f') soil & earth pressure parameters */
export function params(
  S: WallState,
  mode: 'k' | 'f',
  dForce?: number | null,
  G?: GeometryResult,
): MaterialParams {
  const gm = mode === 'f' ? +S.gm : 1;
  const Fs = FSo(S);
  const phr = Math.atan(Math.tan(S.r.phi * R) / gm) / R;
  const phf = Math.atan(Math.tan(S.f.phi * R) / gm) / R;
  const phs = Math.atan(Math.tan(Fs.phi * R) / gm) / R;
  const wd = wallDelta(S, phr, G);
  const al = S.kam === 'c' ? gAlpha(S, phr, G) : 0;
  let K: KaResult;
  if (S.kam === 'm') {
    const v = mode === 'f' ? +S.kaMf : +S.kaM;
    const dm = dForce != null ? dForce : wd.d;
    K = {
      Ka: v,
      Kah: v * Math.cos(dm * R),
      d: dm,
      al: 0,
      lab: 'Manual override' + (mode === 'f' ? ' (GG1 factored value)' : ''),
    };
  } else {
    K = KaOf(S, phr, dForce != null ? dForce : wd.d, S.bon ? +S.br : 0, al);
  }
  const Kp = S.kpm === 'm' ? (mode === 'f' ? +S.kpMf : +S.kpM) : KpOf(phs, +S.bf);
  const Kpf = S.kpm === 'm' ? Kp : KpOf(phf, +S.bf);
  const db0 = S.dbm === 'cv' ? phiCv(S) : +S.dcb;
  const db = Math.atan(Math.tan(db0 * R) / gm) / R;
  return {
    mode,
    gm,
    phr,
    phf,
    phs,
    wd,
    al: K.al || 0,
    Ka: K.Ka,
    Kah: K.Kah,
    d: K.d,
    kaLab: K.lab,
    Kp,
    Kpf,
    cP: Fs.c / gm,
    db0,
    db,
    cF: S.f.c / gm,
  };
}

export const planeX = (G: GeometryResult): number => G.B;

export function planeName(S: WallState, G?: GeometryResult, Pk?: MaterialParams): string {
  const G0 = G ?? geo(S);
  const p = Pk ?? params(S, 'k', null, G0);
  const al = isG(S) ? gAlpha(S, p.phr, G0) : 0;
  if (isG(S) && al > 1e-6) {
    return `plane through the back corners of the wall (GG1 Fig. 39 / 40), inclined α = ${f(al, 1)}° to the vertical from the back bottom corner of the block`;
  }
  if (isG(S) && al < -1e-6) {
    return `back face of the block leaning into the fill (GG1 Fig. 41), α = ${f(al, 1)}° to the vertical, continued to the retained ground surface`;
  }
  return G0.vb
    ? isG(S)
      ? 'vertical plane through the back bottom corner of the block (GG1 Fig. 40)'
      : 'virtual back (vertical plane through heel end)'
    : isG(S)
      ? 'back face of the mass concrete wall'
      : 'back face of wall';
}

export function kaEq(S: WallState, al: number, _dd: number): string {
  const b = S.bon ? +S.br || 0 : 0;
  if (S.kam === 'm') return 'Manual input';
  if (S.kam === 'r') {
    return b > 0
      ? `cosβ·(cosβ − √(cos²β − cos²φ′)) / (cosβ + √(cos²β − cos²φ′))`
      : `(1 − sinφ′) / (1 + sinφ′) = (1 − sin${f(S.r.phi, 1)}°) / (1 + sin${f(S.r.phi, 1)}°)`;
  }
  return Math.abs(al) > 1e-6
    ? `cos²(φ′ − α) / [cos²α·cos(α + δ)·(1 + √(sin(φ′ + δ)·sin(φ′ − β) / (cos(α + δ)·cos(α − β))))²]`
    : `cos²φ′ / [cosδ·(1 + √(sin(φ′ + δ)·sin(φ′ − β) / (cosδ·cosβ)))²]`;
}

export function kpEq(S: WallState, Pk: MaterialParams): string {
  if (S.kpm === 'm') return 'Manual input';
  const p = f(Pk.phs, 1);
  const b = Math.min(0, +S.bf || 0);
  return b < 0
    ? `cos²φ′ / (1 − √(sinφ′·sin(φ′ + β) / cosβ))² = cos²${p}° / (1 − √(sin${p}°·sin(${p}° − ${f(-b, 1)}°) / cos${f(-b, 1)}°))²`
    : `cos²φ′ / (1 − sinφ′)² = cos²${p}° / (1 − sin${p}°)²`;
}

/** At-rest earth pressure coefficient Ko (GG1 §6.4 Eq 6.1–6.4) */
export const koAuto = (S: WallState): number => {
  const q = Math.sin(S.r.phi * R);
  const b = S.bon ? Math.max(0, +S.br) : 0;
  return (1 - q) * (1 + Math.sin(b * R)) * Math.pow(Math.max(+S.ocr || 1, 1), 0.5);
};

export const koVal = (S: WallState): number => (S.kom ? +S.koM : koAuto(S));

export const koDesc = (S: WallState): string => {
  const b = S.bon ? Math.max(0, +S.br) : 0;
  return S.kom
    ? 'manual override'
    : `(1 − sinφ′)${b > 0 ? `(1 + sin${f(b, 1)}°)` : ''}${
        +S.ocr > 1 ? `·OCR^0.5, OCR = ${S.ocr}` : ''
      } – GG1 Eq 6.${b > 0 ? '2' : '1'}${+S.ocr > 1 ? ' & 6.4' : ''}`;
};

/** Compaction-induced earth pressure (GG1 §6.8, Fig. 27, Ingold 1979) */
export const cmpOn = (S: WallState): boolean => !!(S.cmp && S.bon && +S.cQ > 0);

export const cmpInfo = (S: WallState, K: number): CompactionInfo => {
  const Q = +S.cQ;
  const gm = +S.r.g;
  const phm = Math.sqrt((2 * Q * gm) / Math.PI);
  const r = Math.sqrt((2 * Q) / (Math.PI * gm));
  return { Q, phm, zc: +S.br > 0 ? 0 : K * r, hc: r / K };
};

export const cmpP = (S: WallState, sv: number, K: number): number => {
  if (!cmpOn(S)) return K * sv;
  const c = cmpInfo(S, K);
  return Math.max(K * sv, +S.br > 0 ? c.phm : Math.min(sv / K, c.phm));
};
