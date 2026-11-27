/**
 * Wall-top loads (Wind Code 2019, DIL 2011 pedestrian/vehicle barriers),
 * line loads (GG1 Fig. 29), characteristic load components (comp),
 * and factored load evaluation (ev).
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { B31, DEG2RAD as R, G_WATER as g, T42, VEH } from './constants';
import { gPlane, qIn } from './earthPressure';
import { fdX, geo, keyG, pX, pieces4, soilBand, soilBandP, terrBand } from './geometry';
import {
  BFo,
  FSo,
  bfOn,
  fdOn,
  fdW,
  gTx,
  isG,
  isU,
  isVeh,
  qVal,
  vSOn,
  wlF,
} from './helpers';
import { cl, f, ints, lin } from './math';
import type {
  BarrierCalcResult,
  CompParamsLite,
  CompResult,
  EvalOptions,
  EvalResult,
  ExtraStemGeo,
  GeometryResult,
  LineLoadResult,
  LoadComponent,
  LoadFactors,
  Piece4,
  Point2D,
  TopCase,
  VehCalcResult,
  WallState,
  WindCalcResult,
  WindZone,
} from './types';

/** Wind Code 2019 (Appendix B3 / Table 4-2) fence wind load */
export function windCalc(S: WallState, G?: GeometryResult): WindCalcResult {
  const G0 = G ?? geo(S);
  const h = +S.wh;
  const ph = cl(+S.wsd, 0.01, 1);
  const gl = S.fon ? Math.min(+S.Hf, +S.Hr) : +S.Zb;
  const Z = Math.max(G0.top + h - gl, 0);
  const Ze = Z;
  const Qo = Ze <= 2.5 ? 1.59 : 3.7 * Math.pow(Ze / 500, 0.16);
  const Qz = Qo * +S.wSt;
  const L = 2 * h;
  const Ss = Math.exp(0.17 - 0.07 * Math.pow(L, 0.32));
  let Cp: number;
  let area: number;
  let basis: string;
  let zone: WindZone = S.wz;
  let note = '';
  const lh = +S.wlen / h;

  if (ph < 0.8) {
    Cp = lin(T42, ph);
    area = ph * h;
    basis = 'Table 4-2 (open framework, φ < 0.8) – pressure on solid area';
  } else {
    const ex: Record<WindZone, boolean> = { A: true, B: true, C: lh > 2, D: lh > 4 };
    if (!ex[zone]) {
      note = `Zone ${zone} does not exist for l/h = ${f(lh, 1)} (Fig. B3-1); `;
      zone = ex.C ? 'C' : 'B';
    }
    const a = B31[zone];
    const c1 =
      lh <= 3
        ? a[0]
        : lh <= 5
          ? a[0] + ((a[1] - a[0]) * (lh - 3)) / 2
          : lh < 10
            ? a[1] + ((a[2] - a[1]) * (lh - 5)) / 5
            : a[2];
    const Cp1 = c1;
    Cp = 1.2 + ((Cp1 - 1.2) * (ph - 0.8)) / 0.2;
    area = h;
    basis = `Table B3-1 zone ${zone}, l/h = ${f(lh, 1)}, no return corner – gross area${
      ph < 1
        ? ` (interpolated φ 0.8 → 1.0: Cp = 1.2 + (${f(Cp1, 2)} − 1.2)(φ − 0.8)/0.2)`
        : ''
    }`;
  }

  const P = Qz * Cp * Ss;
  const F = P * area;
  const z = G0.top - S.Zb + h / 2;
  const steps: [string, string, string, string, string][] = [
    ['Z', 'Reference height – fence top above the front ground', 'App. B3', `${f(G0.top + h)} − ${f(gl)}`, `${f(Z)} m`],
    [
      'Qo,z',
      'Wind reference pressure',
      'Table 3-1 / Eq 3-2',
      `Qo,z = 3.7(Z/500)^0.16 ${Z <= 2.5 ? '; Z ≤ 2.5 m → 1.59 kPa minimum' : `= 3.7×(${f(Z)}/500)^0.16`}`,
      `${f(Qo, 3)} kPa`,
    ],
    ['Qz', 'Design wind pressure', 'Eq 3-1', `Qz = Qo,z·St·Sθ (Sθ = 1.0) = ${f(Qo, 3)}×${S.wSt}×1.0`, `${f(Qz, 3)} kPa`],
    [
      'Cp',
      'Force / pressure coefficient',
      ph < 0.8 ? 'Table 4-2' : 'App. B3, Table B3-1',
      ph < 0.8
        ? `open framework, φ = ${f(ph, 2)} < 0.8`
        : `free-standing wall, φ = ${f(ph, 2)} ≥ 0.8, zone ${zone}, l/h = ${f(lh, 1)}`,
      f(Cp, 3),
    ],
    ['Ss', 'Size factor', 'Eq C1-1a; App. B3', `Ss = exp(0.17 − 0.07·L^0.32), L0.5p = 2h = 2×${f(h)} = ${f(L)} m`, f(Ss, 3)],
    ['P', 'Net wind pressure', 'Eq 2-3a', `P = Qz·Cp·Ss = ${f(Qz, 3)}×${f(Cp, 3)}×${f(Ss, 3)}`, `${f(P, 3)} kPa`],
    [
      'F',
      'Wind force per m run',
      ph < 0.8 ? 'Table 4-2 note c' : 'App. B3',
      ph < 0.8
        ? `F = P·φ·h (solid area) = ${f(P, 3)}×${f(ph, 2)}×${f(h)}`
        : `F = P·h (gross area) = ${f(P, 3)}×${f(h)}`,
      `${f(F, 2)} kN/m`,
    ],
    ['y', 'Lever arm above the base', '–', `acts at h/2 above the wall top: ${f(G0.top - S.Zb)} + ${f(h)}/2`, `${f(z)} m`],
  ];
  return { h, ph, Z, Ze, Qo, Qz, Ss, L, Cp, area, basis, note, P, F, z, zone, steps };
}

/** DIL 2011 Cl 3.8.3 vehicle barrier impact */
export function vehCalc(S: WallState, G?: GeometryResult): VehCalcResult {
  const [M0, v, hb] = VEH[S.brc];
  const M = M0 ?? Math.max(0, +S.vM || 0);
  const c = 100;
  const b = Math.max(0, +S.vb || 0);
  const F1 = (0.5 * M * v * v) / (c + b);
  const Lr = Math.max(0, +S.vR || 0);
  const gm = Lr < 10 ? 1 : Lr > 20 ? 2 : 1 + (Lr - 10) / 10;
  const F2 = F1 * gm;
  const F = F2 * (S.vObl ? 0.5 : 1);
  const Ld = Math.max(1.5, +S.vL || 1.5);
  const G0 = G ?? geo(S);
  const fl = S.vFl === 't' ? G0.top : S.vFl === 'c' ? +S.vFz : +S.Hr;
  return { M, v, c, b, hb, F1, Lr, gm, F2, F, Ld, Fm: F / Ld, fl, zA: fl + hb / 1000 };
}

export const brVal = (S: WallState, G?: GeometryResult): number =>
  isVeh(S) ? vehCalc(S, G).Fm : S.brc === 'c' ? +S.brF : +S.brc;

export function barCalc(S: WallState, G?: GeometryResult): BarrierCalcResult {
  const G0 = G ?? geo(S);
  if (isVeh(S)) {
    const V = vehCalc(S, G0);
    return { F: V.Fm, ha: V.zA - G0.top, z: V.zA - S.Zb, veh: V };
  }
  const F = brVal(S, G0);
  const ha = Math.min(1.1, +S.bhb);
  return { F, ha, z: G0.top - S.Zb + ha };
}

export const ppF = (S: WallState): number => (S.bro && !isVeh(S) ? brVal(S) : 1.5);

export const ppZ = (S: WallState, a: ExtraStemGeo): number => (isU(S) ? +S.Hf : a.zt) + 1.1;

export function topCases(S: WallState, G?: GeometryResult): TopCase[] {
  const G0 = G ?? geo(S);
  const a: TopCase[] = [{ k: 'none', F: 0, z: 0 }];
  if (S.wo) {
    const w = windCalc(S, G0);
    a.push({ k: 'wind', F: w.F, z: w.z });
  }
  if (S.bro && !vSOn(S)) {
    const b = barCalc(S, G0);
    a.push({ k: 'bar', F: b.F, z: b.z });
  }
  return a;
}

/** Line loads parallel to the wall – GG1 §7.3.3 / §7.3.6, Figure 29 (Terzaghi 1953) */
export function lineLoad(S: WallState, phiDeg: number, H: number): LineLoadResult | null {
  if (!S.lon || !(H > 0)) return null;
  const x = Math.max(0, +S.lx);
  const Qv = Math.max(0, +S.lQv || 0);
  const Qh = Math.max(0, +S.lQh || 0);
  const m = x / H;
  const sn = (n: number) =>
    m <= 0.4 ? (0.2 * n) / (0.16 + n * n) ** 2 : (1.28 * m * m * n) / (m * m + n * n) ** 2;
  const Pk = m <= 0.4 ? 0.55 : 0.64 / (1 + m * m);
  const I0 = ints(0, 1, sn, 800);
  const I1 = ints(0, 1, (n) => sn(n) * n, 800);
  const nb = I1 / I0;
  const kf = Pk / I0;
  const He = x * Math.tan((45 + phiDeg / 2) * R);
  const hc = Math.min(He, H);
  const fh = He > 0 ? 1 - (1 - hc / He) ** 2 : 0;
  const zh =
    He > 0 && fh > 0 ? ((2 / He) * ((hc * hc) / 2 - hc ** 3 / (3 * He))) / fh : 0;
  return {
    x,
    m,
    H,
    Qv,
    Qh,
    Pk,
    kf,
    nb,
    Pv: Qv * Pk,
    yv: H * (1 - nb),
    He,
    Ph: Qh * fh,
    yh: H - zh,
    trunc: He > H + 1e-9,
    sig: (z: number) => {
      const d = S.Hr - z;
      if (d < 0 || d > H) return 0;
      let s = Qv > 0 ? (Qv / H) * sn(d / H) * kf : 0;
      if (Qh > 0 && He > 0 && d <= He) s += ((2 * Qh) / He) * (1 - d / He);
      return s;
    },
  };
}

/** Characteristic load components (dir: h driving horizontal, p passive, v vertical, u uplift) */
export function comp(S: WallState, P: CompParamsLite, top: TopCase | null): CompResult {
  const G = geo(S);
  const { B, xb, hl, bt } = G;
  const Rs = S.r;
  const F = S.f;
  const Fs = FSo(S);
  const Zb = +S.Zb;
  const gc = +S.gc;
  const q = qVal(S);
  const qi = qIn(S, G);
  const bo = S.bon;
  const fo = S.fon;
  const tb_ = bo ? Math.tan(+S.br * R) : 0;
  const al = isG(S) && bo ? P.al || 0 : 0;
  const ta = Math.tan(al * R);
  const xpl = gPlane(S, al, G);
  const LwP = al !== 0 ? Math.max(0, xpl(+S.Hr) - G.xH) : G.Lw;
  const hs0 = Math.max(0, S.Hr - Zb);
  const hs = hs0 + LwP * tb_;
  const fr = wlF(S);
  const wb = bo ? hs0 * fr : 0;
  const Wb = Zb + wb;
  const h1 = hs - wb;
  const gR = Rs.gs - g;
  const gF = F.gs - g;
  const gFs = Fs.gs - g;
  const K = P.Kah;
  const tD = Math.tan((P.d + al) * R);
  const pasOK = !!(fo && !S.nopp);
  const wf = cl(Math.min(S.fw, S.Hf) - Zb, 0, 1e9);
  const hf0 = fo ? Math.max(0, S.Hf - S.dp - Zb) : 0;
  const ws0 = Math.min(wf, hf0);
  const d10 = hf0 - ws0;
  const hf = pasOK ? hf0 : 0;
  const ws = pasOK ? ws0 : 0;
  const d1 = hf - ws;
  const sk = Math.sqrt(P.Kp);
  const UU = isU(S);

  const it: LoadComponent[] = [];
  const cnt: Record<string, number> = {};
  const add = (
    pre: string,
    t: string,
    fm: string,
    F_: number,
    cat: string,
    dir: 'h' | 'p' | 'v' | 'u',
    arm: number,
    y?: number,
  ) => {
    if (F_ > 1e-9) {
      cnt[pre] = (cnt[pre] || 0) + 1;
      it.push({ n: pre + cnt[pre], t, fm, F: F_, cat, dir, arm, y });
    }
  };

  const LL = bo ? lineLoad(S, P.phr, hs0) : null;
  if (bo) {
    add('Pah', 'Surcharge q_out', `q_out·Kah·H = ${f(q, 1)}×${f(K, 3)}×${f(hs)}`, q * K * hs, 'sur', 'h', hs / 2);
    if (LL) {
      add(
        'Pah',
        'Line load Q1 (vertical)',
        `GG1 Fig. 29(a): m = x/H = ${f(LL.x)}/${f(LL.H)} = ${f(LL.m, 3)} ${
          LL.m <= 0.4 ? '≤ 0.4 → Ph = 0.55Q1' : `> 0.4 → Ph = 0.64Q1/(1+m²) = ${f(LL.Pk, 3)}Q1`
        } = ${f(LL.Pk, 3)}×${f(LL.Qv, 1)}; yp = ${f(LL.yv / LL.H, 2)}H`,
        LL.Pv,
        'sur',
        'h',
        LL.yv,
      );
      add(
        'Pah',
        'Line load Qh (horizontal)',
        `GG1 Fig. 29(c): He = x·tan(45°+φ′/2) = ${f(LL.He)} m; Ph = Qh${
          LL.trunc ? ' × [1 − (1 − H/He)²] (He > H)' : ''
        } = ${f(LL.Ph)}`,
        LL.Ph,
        'sur',
        'h',
        LL.yh,
      );
    }
    add('Pah', 'Soil above WL', `½·Kah·γ·h1² = ½×${f(K, 3)}×${Rs.g}×${f(h1)}²`, 0.5 * K * Rs.g * h1 * h1, 'soil', 'h', wb + h1 / 3);
    add('Pah', 'Dry-soil load on wet zone', `Kah·γ·h1·hw = ${f(K, 3)}×${Rs.g}×${f(h1)}×${f(wb)}`, K * Rs.g * h1 * wb, 'soil', 'h', wb / 2);
    add('Pah', 'Submerged soil', `½·Kah·γ′·hw² = ½×${f(K, 3)}×${f(gR)}×${f(wb)}²`, 0.5 * K * gR * wb * wb, 'soil', 'h', wb / 3);
    add('Pah', 'Water (retained)', `½·γw·hw² = ½×9.81×${f(wb)}²`, 0.5 * g * wb * wb, 'water', 'h', wb / 3);
  }
  if (top && top.F > 0) {
    add(
      top.k === 'wind' ? 'Lw' : 'Lb',
      top.k === 'wind' ? 'Fence wind (Wind Code 2019)' : 'Barrier load (DIL 2011 Table 3.13)',
      top.k === 'wind' ? 'P·A (see 5.2)' : `line load ${f(top.F, 2)} kN/m`,
      top.F,
      top.k === 'wind' ? 'wind' : 'bar',
      'h',
      top.z,
    );
  }

  let KaU: number | null = null;
  if (pasOK && UU) {
    const Fq = FSo(S);
    const pU = +Fq.phi * R;
    KaU = (1 - Math.sin(pU)) / (1 + Math.sin(pU));
    const sKa = Math.sqrt(KaU);
    const cU = +Fq.c;
    const sv = (dd: number) => (dd <= d1 ? Fq.g * dd : Fq.g * d1 + gFs * (dd - d1));
    const sh = (z: number) => Math.max(0, KaU! * sv(hf - z) - 2 * cU * sKa);
    const Fh = ints(0, hf, sh, 400);
    const Mh = ints(0, hf, (z) => sh(z) * z, 400);
    add(
      'Pp',
      'Front retained soil (U-channel) – active pressure, resisting',
      `∫max(0, Kaf·σ′v − 2c′√Kaf)dz, Kaf = (1 − sinφ′)/(1 + sinφ′) = ${f(KaU, 3)} (φ′ = ${f(+Fq.phi, 1)}°, characteristic, δ = 0), depth ${f(hf)} m`,
      Fh,
      'pas',
      'p',
      Fh > 0 ? Mh / Fh : 0,
    );
    add('Pp', 'Water (front)', `½·γw·hw² = ½×9.81×${f(wf)}²`, 0.5 * g * wf * wf, 'pwat', 'p', wf / 3);
  } else if (pasOK) {
    add('Pp', 'Cohesion term', `2c′√Kp·h = 2×${f(P.cP, 2)}×${f(sk, 3)}×${f(hf)}`, 2 * P.cP * sk * hf, 'pas', 'p', hf / 2);
    add('Pp', 'Soil above WL', `½·Kp·γ·d² = ½×${f(P.Kp, 3)}×${Fs.g}×${f(d1)}²`, 0.5 * P.Kp * Fs.g * d1 * d1, 'pas', 'p', ws + d1 / 3);
    add('Pp', 'Dry-soil load on wet zone', `Kp·γ·d·hw = ${f(P.Kp, 3)}×${Fs.g}×${f(d1)}×${f(ws)}`, P.Kp * Fs.g * d1 * ws, 'pas', 'p', ws / 2);
    add('Pp', 'Submerged soil', `½·Kp·γ′·hw² = ½×${f(P.Kp, 3)}×${f(gFs)}×${f(ws)}²`, 0.5 * P.Kp * gFs * ws * ws, 'pas', 'p', ws / 3);
    add('Pp', 'Water (front)', `½·γw·hw² = ½×9.81×${f(wf)}²`, 0.5 * g * wf * wf, 'pwat', 'p', wf / 3);
  }

  const SG = G.SG;
  const piece = (nm: string, pc: Piece4[]) => {
    const LB = { fb: ' – front batter (triangle)', r: ' – rectangle', rb: ' – rear batter (triangle)' };
    pc.forEach((p) =>
      add(
        'W',
        nm + (pc.length > 1 || p.k !== 'r' ? LB[p.k] : ''),
        p.k === 'r' ? `b·h·γc = ${f(p.b)}×${f(p.h)}×${gc}` : `½·b·h·γc = ½×${f(p.b)}×${f(p.h)}×${gc}`,
        p.A * gc,
        'dead',
        'v',
        p.x,
        p.z,
      ),
    );
  };

  if (isG(S)) piece('Mass concrete block', pieces4(0, B, gTx(S), +S.gbr || 0, Zb, +S.tb));
  else add('W', 'Base slab', `B·tb·γc = ${f(B)}×${f(S.tb)}×${gc}`, B * S.tb * gc, 'dead', 'v', B / 2, Zb + S.tb / 2);

  SG.forEach((s) => piece('Stem ' + (s.i + 1), pieces4(s.xf0, s.xb0, s.fb, s.rb, s.bot, s.h)));

  if (fdOn(S)) {
    add(
      'Wf',
      'Fence self-weight (permanent – ignored in sliding / overturning)',
      +S.fdS > 0 ? `P/s = ${f(+S.fdP, 2)}/${f(+S.fdS, 2)}` : `line load ${f(fdW(S), 2)} kN/m`,
      fdW(S),
      'fdl',
      'v',
      fdX(S, G),
      G.top,
    );
  }

  const KG = keyG(S, G);
  if (KG && KG.dk > 0 && KG.Bk > 0) {
    add('W', 'Shear key', `Bk·dk·γc = ${f(KG.Bk)}×${f(KG.dk)}×${gc}`, KG.Bk * KG.dk * gc, 'dead', 'v', KG.xk + KG.Bk / 2, Zb - KG.dk / 2);
  }

  const hh = Math.max(0, S.Hr - bt);
  const wh = cl(Wb - bt, 0, hh);
  const dry = hh - wh;
  const Lw = LwP;

  const band = (
    Pline: Point2D[],
    side: 'b' | 'f',
    z1: number,
    z2: number,
    Wl: number,
    nm: string,
    g1: number,
    g2: number,
    cat: string,
    fm: string,
    sb?: number,
  ) => {
    const r = al !== 0 && side === 'b' ? soilBandP(Pline, xpl, z1, z2, Wl) : soilBand(Pline, side, B, z1, z2, Wl);
    const tx = (o: { A: number }, gm: number) =>
      sb && o.A > 0 ? `b·h·γ = ${f(sb)}×${f(o.A / sb)}×${gm}` : `${fm} → A = ${f(o.A, 3)} m² × ${gm}`;
    add('W', nm + ' (dry)', tx(r.d, g1), r.d.A * g1, cat, 'v', r.d.A > 0 ? r.d.M / r.d.A : 0, r.d.A > 0 ? r.d.Z / r.d.A : z1);
    add('W', nm + ' (sat.)', tx(r.s, g2), r.s.A * g2, cat, 'v', r.s.A > 0 ? r.s.M / r.s.A : 0, r.s.A > 0 ? r.s.Z / r.s.A : z1);
  };

  const vB = G.bk.filter((p) => p[1] > bt + 1e-9).every((p) => Math.abs(p[0] - xb) < 1e-9);
  const vF = G.fr.filter((p) => p[1] > bt + 1e-9).every((p) => Math.abs(p[0] - G.Lt0) < 1e-9);

  if (bo) {
    const pf =
      al !== 0
        ? `∫(x_plane − x_back)dz, x_plane = B − (z − Zb)·tan${f(al, 1)}° (GG1 Fig. 39 note 1)`
        : '∫(B − x_back)dz';
    const Bf = BFo(S);
    if (isG(S)) {
      band(
        G.bk,
        'b',
        Zb,
        Math.min(+S.Hr, bt),
        Wb,
        al > 0 ? 'Soil over battered back, in front of the Pa plane' : 'Soil wedge over battered back of block',
        Bf.g,
        Bf.gs,
        'fill',
        pf,
      );
    }
    band(
      G.bk,
      'b',
      bt,
      +S.Hr,
      Wb,
      (isG(S) && al !== 0 ? 'Soil on the block, in front of the Pa plane' : 'Heel soil') +
        (bfOn(S) ? ' – backfill' : ''),
      Bf.g,
      Bf.gs,
      'fill',
      al !== 0 ? pf : '∫(B − x_back)dz (wall back face to plane through heel end)',
      al !== 0 ? 0 : vB ? hl : 0,
    );
    if (tb_ > 0 && Lw > 0) {
      add(
        'W',
        'Heel soil wedge (sloping backfill)',
        `½·b²·tanβ·γ = ½×${f(Lw)}²×tan${f(S.br, 1)}°×${Bf.g}`,
        0.5 * Lw * Lw * tb_ * Bf.g,
        'fill',
        'v',
        B - Lw / 3,
        S.Hr + (Lw * tb_) / 3,
      );
    }
    add(
      'Wq',
      'Surcharge q_in on heel (variable – bearing & RC only; not in sliding / overturning)',
      `q_in·b = ${f(qi, 1)}×${f(Lw)}`,
      qi * Lw,
      'sheel',
      'v',
      (al !== 0 ? xpl(+S.Hr) : B) - Lw / 2,
      S.Hr,
    );
    if (al > 0 && wb > 0) {
      add(
        'U1v',
        'Water on the inclined Pa plane – vertical comp. (GG1 Fig. 39(b): U1v = U1·sinα)',
        `½·γw·hw²·tanα = ½×9.81×${f(wb)}²×tan${f(al, 1)}°`,
        0.5 * g * wb * wb * ta,
        'water',
        'v',
        B - (wb / 3) * ta,
        Zb + wb / 3,
      );
    }
    if (al < 0 && wb > 0) {
      add(
        'U',
        'Water on the back face leaning into the fill – upward vertical component',
        `½·γw·hw²·|tanα| = ½×9.81×${f(wb)}²×|tan${f(al, 1)}°|`,
        0.5 * g * wb * wb * Math.abs(ta),
        'upl',
        'u',
        B + (wb / 3) * Math.abs(ta),
      );
    }
  }

  const ht = Math.max(0, S.Hf - S.dp - bt);
  const wt = cl(Math.min(S.fw, S.Hf) - bt, 0, ht);
  const dt = ht - wt;
  const zT = Math.max(Zb, +S.Hf - S.dp);
  const Wf = Math.min(+S.fw, +S.Hf);

  if (fo && +S.tsw) {
    if (isG(S)) {
      band(G.fr, 'f', Zb, Math.min(zT, bt), Wf, 'Soil wedge over battered front of block', Fs.g, Fs.gs, 'tsoil', '∫x_front dz');
    }
    band(G.fr, 'f', bt, zT, Wf, 'Toe soil', Fs.g, Fs.gs, 'tsoil', '∫x_front dz (toe plane to wall front face)', vF ? G.Lt0 : 0);
  }

  const XS = G.XS || [];
  let qt = 0;
  if (XS.length) {
    XS.forEach((a) =>
      a.segs.forEach((sg) =>
        add(
          'W',
          `Stem on base ${a.j + 1}${a.segs.length > 1 ? ` – segment ${sg.k + 1}` : ''}${UU ? ' (U-channel wall)' : ''}`,
          `t·h·γc = ${f(sg.t)}×${f(sg.h)}×${gc}`,
          sg.t * sg.h * gc,
          'dead',
          'v',
          sg.x0 + sg.t / 2,
          sg.bot + sg.h / 2,
        ),
      ),
    );
    const Bf = BFo(S);
    if (!UU) {
      XS.forEach((a, j) => {
        const xn = (z: number) => (j < XS.length - 1 ? XS[j + 1].x0 : pX(G.frM, z));
        const Wt = Math.min(Wb, a.zt);
        const r = terrBand(a.xb, xn, bt, a.zt, Wt);
        const nm = `Terrace soil behind stem on base ${j + 1} (to +${f(a.zt)})`;
        add('W', nm + ' (dry)', `∫(x_next − x_back)dz → A = ${f(r.d.A, 3)} m² × ${Bf.g}`, r.d.A * Bf.g, 'fill', 'v', r.d.A > 0 ? r.d.M / r.d.A : 0, r.d.A > 0 ? r.d.Z / r.d.A : bt);
        add('W', nm + ' (sat.)', `∫(x_next − x_back)dz → A = ${f(r.s.A, 3)} m² × ${Bf.gs}`, r.s.A * Bf.gs, 'fill', 'v', r.s.A > 0 ? r.s.M / r.s.A : 0, r.s.A > 0 ? r.s.Z / r.s.A : bt);
        if (a.pp) {
          add(
            'Pah',
            `Parapet on stem on base ${j + 1} (DIL Table 3.13, variable)`,
            `line load ${f(ppF(S), 2)} kN/m at +${f(ppZ(S, a))} mPD (1.1 m above the terrace)`,
            ppF(S),
            'sur',
            'h',
            ppZ(S, a) - Zb,
          );
        }
        const xbz = a.xb(a.zt);
        const wq = Math.max(0, xn(a.zt) - xbz);
        const qq = qVal(S);
        if (wq > 0 && qq > 0) {
          qt += qq * wq;
          add('Wq', `Surcharge q on terrace ${j + 1} (variable – bearing only)`, `q·b = ${f(qq, 1)}×${f(wq)}`, qq * wq, 'sheel', 'v', xbz + wq / 2, a.zt);
        }
      });
    }
  }

  if (tD > 0) {
    const Hs = it.filter((i) => i.cat === 'soil').reduce((s, i) => s + i.F, 0);
    const Hq = it.filter((i) => i.cat === 'sur').reduce((s, i) => s + i.F, 0);
    const zS = Hs > 0 ? it.filter((i) => i.cat === 'soil').reduce((s, i) => s + i.F * i.arm, 0) / Hs : hs / 3;
    const zQ = Hq > 0 ? it.filter((i) => i.cat === 'sur').reduce((s, i) => s + i.F * i.arm, 0) / Hq : hs / 2;
    const an = al > 0 ? `tan(δ + α)` : `tanδ`;
    const an2 = al > 0 ? `tan(${f(P.d, 1)}° + ${f(al, 1)}°)` : `tan${f(P.d, 1)}°`;
    add('Pav', 'Vertical comp. of Pah (soil) – wall friction δ', `ΣPah,soil·${an} = ${f(Hs)} × ${an2} = ${f(Hs)}×${f(tD, 3)}`, Hs * tD, 'pvs', 'v', B - zS * ta, Zb + zS);
    add('Pav,q', 'Vertical comp. of Pah (surcharge) – for RC &amp; bearing checking only', `ΣPah,q·${an} = ${f(Hq)} × ${an2} = ${f(Hq)}×${f(tD, 3)}`, Hq * tD, 'pvq', 'v', B - zQ * ta, Zb + zQ);
  }

  const ub = g * wb;
  const uf = g * wf;
  add('U', 'Uplift – rectangle', `min(ub,uf)·B = ${f(Math.min(ub, uf))}×${f(B)}`, Math.min(ub, uf) * B, 'upl', 'u', B / 2);
  add('U', 'Uplift – triangle', `½·|ub−uf|·B = ½×${f(Math.abs(ub - uf))}×${f(B)}`, 0.5 * Math.abs(ub - uf) * B, 'upl', 'u', ub >= uf ? (2 * B) / 3 : B / 3);

  it.forEach((i) => {
    if (i.dir === 'v' && (i.cat === 'pvs' || i.cat === 'pvq' || i.cat === 'water')) i.pav = 1;
  });

  return {
    it,
    G,
    P,
    al,
    q,
    qi,
    qt,
    hs0,
    hs,
    wb,
    Wb,
    h1,
    gR,
    gF,
    gFs,
    hf,
    wf,
    ws,
    d1,
    hf0,
    ws0,
    d10,
    sk,
    ub,
    uf,
    dry,
    wh,
    dt,
    wt,
    top,
    pasOK,
    LL,
    KG,
    KaU,
    UU,
  };
}

/** Evaluate a component set with load factors; o.ppM passive in moments */
export function ev(C: CompResult, fa: LoadFactors, o: EvalOptions = {}): EvalResult {
  const B = C.G.B;
  let H = 0;
  let Hp = 0;
  let W = 0;
  let U = 0;
  let Ms = 0;
  let Md = 0;
  let Mp = 0;
  const Hc: Record<string, number> = {};
  const Mc: Record<string, number> = {};
  const Vc: Record<string, number> = {};

  for (const i of C.it) {
    const k = fa[i.cat] ?? 1;
    const F = i.F * k;
    if (!(k > 0)) continue;
    if (i.dir === 'h') {
      H += F;
      Md += F * i.arm;
      Hc[i.cat] = (Hc[i.cat] || 0) + F;
      Mc[i.cat] = (Mc[i.cat] || 0) + F * i.arm;
    } else if (i.dir === 'p') {
      Hp += F;
      Mp += F * i.arm;
    } else if (i.dir === 'v') {
      W += F;
      Vc[i.cat] = (Vc[i.cat] || 0) + F;
      if (i.pav) {
        Md -= F * i.arm;
        Mc[i.cat] = (Mc[i.cat] || 0) - F * i.arm;
      } else {
        Ms += F * i.arm;
        Mc['s_' + i.cat] = (Mc['s_' + i.cat] || 0) + F * i.arm;
      }
    } else {
      U += F;
      Md += F * i.arm;
      Mc.upl = (Mc.upl || 0) + F * i.arm;
    }
  }
  const N = W - U;
  const Mr = Ms + (o.ppM ? Mp : 0);
  const xbar = N > 0 ? (Mr - Md) / N : NaN;
  const e = B / 2 - xbar;
  return { H, Hp, W, U, N, Ms, Md, Mp, Mr, xbar, e, Hc, Mc, Vc, B };
}
