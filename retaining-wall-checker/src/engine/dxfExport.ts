/**
 * v14.0.1 CR-1: AutoCAD DXF R2000 ASCII section exporter.
 * Units in mm, x = 0 at toe front-bottom, y = level in mPD × 1000.
 * Real AutoCAD DIMENSION entities (dimstyle 1-<scale>), text style S2 (romans.shx, width 0.8),
 * level marks (label, value, triangle), and per-element layers.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { DEG2RAD as R } from './constants';
import { DXFT } from './dxfTemplate';
import { params } from './earthPressure';
import { fdX, geo, keyG, pX } from './geometry';
import { fdOn, gTx, isG, isU, rcv, scOn, syncedClone, vStemOn } from './helpers';
import { comp, ppZ } from './loads';
import { cl } from './math';
import { cvAll, lapReq } from './rcDesign';
import type { DxfExportOptions, Point2D, WallState } from './types';

export function dxfText(rawState: WallState, o: DxfExportOptions = {}): string {
  const S = syncedClone(rawState);
  const sc = +(o.sc || 100);
  const th = 2 * sc;
  const G = geo(S);
  const C = comp(S, params(S, 'k', null, G), null);
  const Zb = +S.Zb;
  const bt = G.bt;
  const Hr = +S.Hr;
  const Hf = +S.Hf;
  const B = G.B;
  const Gv = isG(S);
  const XS = G.XS || [];
  const UU = isU(S);
  const CR = scOn(S);
  const sb = CR ? +S.scb : 0;
  const xr = B + Math.max(3, (23 * th) / 1000, 0.6 * Math.max(0, Hr - Zb) + 1);
  const xL = 1000 * Math.min(0, pX(G.fr, Hf)) - 8 * th;
  const xL2 = xL - 6 * th;
  const xl = -Math.max(4.5, CR ? sb + 2.5 : 0, 0.6 * Math.max(0, Hf - Zb) + 1.5, (-xL2 + 16 * th) / 1000);

  const E: string[] = [];
  const BR: string[] = [];
  const BK: string[] = [];
  let hd = 0x100;
  let nD = 0;

  const M = (v: number) => v * 1000;
  const N = (v: number) => (Math.round(v * 1000) / 1000).toFixed(3);
  const enc = (t: string) =>
    String(t).replace(/[^\x20-\x7e]/g, (ch) => '\\U+' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0'));

  const hdr = (
    ty: string,
    ly: string,
    sub: string,
    A?: string[],
    own?: string,
    col?: number,
  ): string => {
    const h = (hd++).toString(16).toUpperCase();
    (A || E).push('0', ty, '5', h, '330', own || '17', '100', 'AcDbEntity', '8', ly, ...(col ? ['62', String(col)] : []), '100', sub);
    return h;
  };

  const PL = (ly: string, pts: Point2D[], closed?: number) => {
    if (pts.length < 2) return;
    hdr('LWPOLYLINE', ly, 'AcDbPolyline');
    E.push('90', String(pts.length), '70', closed ? '1' : '0');
    for (const [x, z] of pts) E.push('10', N(M(x)), '20', N(M(z)));
  };

  const PLm = (ly: string, pts: Point2D[], closed?: number) => {
    if (pts.length < 2) return;
    hdr('LWPOLYLINE', ly, 'AcDbPolyline');
    E.push('90', String(pts.length), '70', closed ? '1' : '0');
    for (const [x, y] of pts) E.push('10', N(x), '20', N(y));
  };

  const TX = (
    ly: string,
    x: number,
    y: number,
    h: number,
    t: string,
    ha?: number,
    rot?: number,
    A?: string[],
    own?: string,
    col?: number,
    va?: number,
  ) => {
    if (!String(t).trim()) return;
    const dst = A || E;
    hdr('TEXT', ly, 'AcDbText', dst, own, col);
    const ha0 = ha || 0;
    dst.push('10', N(x), '20', N(y), '30', '0.0', '40', N(h), '1', enc(t), '50', N(rot || 0), '41', '0.8', '7', 'S2');
    if (ha0 || va) dst.push('72', String(ha0), '11', N(x), '21', N(y), '31', '0.0');
    dst.push('100', 'AcDbText');
    if (va) dst.push('73', String(va));
  };

  const DSN = '1-' + sc;
  const ASZ = 2 * sc;
  const EXO = sc;
  const EXE = sc;
  const GAP = sc;

  const DIM = (p1: Point2D, p2: Point2D, rot: number, dl: number, pre?: string) => {
    const V = rot === 90;
    const u = (p: Point2D) => (V ? p[1] : p[0]);
    const w = (p: Point2D) => (V ? p[0] : p[1]);
    const P = (uu: number, ww: number): Point2D => (V ? [ww, uu] : [uu, ww]);
    const a = Math.min(u(p1), u(p2));
    const b = Math.max(u(p1), u(p2));
    const span = b - a;
    if (!(span > 1)) return;
    const meas = String(Math.round(span));
    const txt = (pre || '') + meas;
    const nm = '*D' + ++nD;
    const br = (hd++).toString(16).toUpperCase();
    const A: string[] = [];
    const LN = (q1: Point2D, q2: Point2D, col: number) => {
      hdr('LINE', '0', 'AcDbLine', A, br, col);
      A.push('10', N(q1[0]), '20', N(q1[1]), '30', '0.0', '11', N(q2[0]), '21', N(q2[1]), '31', '0.0');
    };
    const AR = (tip: number, dir: number) => {
      const bs = tip + dir * ASZ;
      const q = [P(tip, dl), P(bs, dl + ((V ? -1 : 1) * ASZ) / 6), P(bs, dl - ((V ? -1 : 1) * ASZ) / 6)];
      hdr('SOLID', '0', 'AcDbTrace', A, br, 6);
      A.push(
        '10', N(q[0][0]), '20', N(q[0][1]), '30', '0.0',
        '11', N(q[1][0]), '21', N(q[1][1]), '31', '0.0',
        '12', N(q[2][0]), '22', N(q[2][1]), '32', '0.0',
        '13', N(q[2][0]), '23', N(q[2][1]), '33', '0.0',
      );
    };
    BR.push('0', 'BLOCK_RECORD', '5', br, '330', '9', '100', 'AcDbSymbolTableRecord', '100', 'AcDbBlockTableRecord', '2', nm);
    for (const p of [p1, p2]) {
      const s = Math.sign(dl - w(p)) || 1;
      if (Math.abs(dl - w(p)) > EXO) LN(P(u(p), w(p) + s * EXO), P(u(p), dl + s * EXE), 6);
    }
    const ins = span >= 2.6 * ASZ;
    if (ins) {
      LN(P(a, dl), P(b, dl), 6);
      AR(a, 1);
      AR(b, -1);
    } else {
      LN(P(a - 2 * ASZ, dl), P(b + 2 * ASZ, dl), 6);
      AR(a, -1);
      AR(b, 1);
    }
    const tp: Point2D = V ? [dl - GAP, (a + b) / 2] : [(a + b) / 2, dl + GAP];
    TX('0', tp[0], tp[1], th, txt, 1, V ? 90 : 0, A, br, 7, 1);
    const hB = (hd++).toString(16).toUpperCase();
    const hE = (hd++).toString(16).toUpperCase();
    BK.push(
      '0', 'BLOCK', '5', hB, '330', br, '100', 'AcDbEntity', '8', '0', '100', 'AcDbBlockBegin',
      '2', nm, '70', '1', '10', '0.0', '20', '0.0', '30', '0.0', '3', nm, '1', '',
      ...A,
      '0', 'ENDBLK', '5', hE, '330', br, '100', 'AcDbEntity', '8', '0', '100', 'AcDbBlockEnd',
    );
    const q2: Point2D = V ? [dl, p2[1]] : [p2[0], dl];
    const tm: Point2D = V ? [dl - GAP - th / 2, (a + b) / 2] : [(a + b) / 2, dl + GAP + th / 2];
    hdr('DIMENSION', 'DIM', 'AcDbDimension');
    E.push(
      '2', nm, '10', N(q2[0]), '20', N(q2[1]), '30', '0.0',
      '11', N(tm[0]), '21', N(tm[1]), '31', '0.0',
      '70', '32', '71', '5', '42', N(span), '1', pre ? enc(pre) + '<>' : '', '3', DSN,
      '100', 'AcDbAlignedDimension',
      '13', N(p1[0]), '23', N(p1[1]), '33', '0.0',
      '14', N(p2[0]), '24', N(p2[1]), '34', '0.0',
      '50', V ? '90.0' : '0.0',
      '100', 'AcDbRotatedDimension',
    );
  };

  const rect = (ly: string, x1: number, z1: number, x2: number, z2: number) =>
    PL(ly, [[x1, z1], [x2, z1], [x2, z2], [x1, z2]], 1);
  const dH = (x1: number, x2: number, z: number, yd: number, pre?: string) =>
    DIM([M(x1), M(z)], [M(x2), M(z)], 0, yd, pre);
  const dV = (z1: number, z2: number, x: number, xd: number, pre?: string) =>
    DIM([M(x), M(z1)], [M(x), M(z2)], 90, xd, pre);
  const LV = (X: number, z: number, lab?: string, toX?: number) => {
    const Y = M(z);
    const w = 0.8 * th;
    const h = 0.7 * th;
    const tx = toX ?? X;
    PLm('LEVEL', [[X, Y], [X - w / 2, Y + h], [X + w / 2, Y + h]], 1);
    PLm('LEVEL', [[Math.min(X - 2 * th, tx), Y], [Math.max(X + 2 * th, tx), Y]]);
    const yv = Y + h + 0.4 * th;
    TX('LEVEL', X, yv, th, (z >= 0 ? '+' : '') + z.toFixed(2) + 'mPD', 1);
    if (lab) TX('LEVEL', X, yv + 1.5 * th, th, lab, 1);
  };

  // ---- concrete
  if (Gv) {
    const gbr = +S.gbr || 0;
    PL('RW-BASE', [[0, Zb], [B, Zb], [B - gbr, bt], [gTx(S), bt]], 1);
  } else rect('RW-BASE', 0, Zb, B, bt);

  G.SG.filter((g) => g.h > 1e-9).forEach((g) =>
    PL('RW-STEM', [[g.xf0, g.bot], [g.xb0, g.bot], [g.xb1, g.top], [g.xf1, g.top]], 1),
  );

  const KG = keyG(S, G);
  if (KG && KG.dk > 0 && KG.Bk > 0) rect('RW-KEY', KG.xk, Zb - KG.dk, KG.xk + KG.Bk, Zb);

  XS.forEach((a) => {
    a.segs.forEach((g) => {
      if (g.h > 1e-9 && g.t > 1e-9) rect('RW-STEMBASE', g.x0, g.bot, g.x1, g.top);
    });
    if (a.pp) {
      const gT = a.segs[a.segs.length - 1];
      const xc = gT.x0 + gT.t / 2;
      PL('RW-PARAPET', [[xc, a.top], [xc, ppZ(S, a)]]);
      TX('RW-PARAPET', M(xc) + 0.5 * th, M(ppZ(S, a)) - th, th, 'PARAPET / BARRIER (SCHEMATIC)');
    }
  });

  {
    const fx0 = G.ftx;
    const g0 = G.SG.find((g) => g.h > 1e-9);
    const wh = S.wo ? +S.wh : 0;
    const fxc = g0
      ? S.fdl && S.fxo !== '' && Number.isFinite(+S.fxo)
        ? fdX(S, G)
        : (g0.xf1 + g0.xb1) / 2
      : Gv
        ? gTx(S) + (S.fxo !== '' && Number.isFinite(+S.fxo) ? cl(+S.fxo, 0, +S.gBt) : +S.gBt / 2)
        : fx0 + 0.05;
    if (S.wo || (S.bro && !vStemOn(S)) || fdOn(S)) {
      const hF = Math.max(wh, S.bro && !vStemOn(S) ? +S.bhb : 0, fdOn(S) ? 1 : 0);
      rect('RW-FENCE', fxc - 0.05, G.top, fxc + 0.05, G.top + hF);
      TX(
        'RW-FENCE',
        M(fxc + 0.05) + 0.5 * th,
        M(G.top + hF) - th,
        th,
        (S.wo ? 'FENCE' : S.bro && !vStemOn(S) ? 'BARRIER' : 'FENCE') + ' (SCHEMATIC)',
      );
    }
  }

  // ---- ground lines
  if (S.bon) {
    const tb = Math.tan((+S.br || 0) * R);
    const xH = G.xH;
    const pts: Point2D[] = [[xH, Hr]];
    if (tb > 0 && +S.brL > 0) {
      const xk = xH + +S.brL;
      pts.push([xk, Hr + +S.brL * tb]);
      if (xk < xr) pts.push([xr, Hr + +S.brL * tb]);
    } else pts.push([xr, Hr + (xr - xH) * tb]);
    PL('GND-RETAINED', pts);
  }
  XS.forEach((a, j) => {
    if (UU || !(a.zt > bt + 1e-9)) return;
    const nx = j < XS.length - 1 ? XS[j + 1].x0 : pX(G.frM, a.zt);
    PL('GND-RETAINED', [[a.xb(a.zt), a.zt], [nx, a.zt]]);
  });
  if (Hf > Zb || CR) {
    const xF = pX(G.fr, Hf);
    const tf = S.fon ? Math.tan((+S.bf || 0) * R) : 0;
    const pts: Point2D[] = [[xF, Hf]];
    if (tf < 0 && CR) {
      pts.push([-sb, Hf]);
      pts.push([xl, Hf + (-sb - xl) * tf]);
    } else if (tf) {
      pts.push([xl, Hf + (xF - xl) * tf]);
    } else pts.push([xl, Hf]);
    PL('GND-FRONT', pts);
  }
  if (S.bon && C.wb > 0) PL('GWL', [[pX(G.bk, C.Wb), C.Wb], [xr, C.Wb]]);
  if (S.fon && C.wf > 0) PL('GWL', [[xl, Zb + C.wf], [0, Zb + C.wf]]);

  // ---- reinforcement
  const CV = cvAll(S, G);
  const ln = (k: string) => lapReq(S, k);
  const bm = (d: number, s: number) => `T${d}@${s}`;
  if (o.bars !== false) {
    const nS = S.st.length;
    const cb = CV.b / 1000;
    const ct = CV.t / 1000;
    const cs = CV.s / 1000;
    G.SG.forEach((g, i) => {
      const s = S.st[i];
      if (!(g.h > 1e-9) || (Gv && !s.rc)) return;
      const r = rcv(S, 's' + i);
      const dr = r.d / 2000;
      const df = r.d3 / 2000;
      const top = g.top - cs;
      PL('RW-REBAR', [[g.xb0 - cs - dr, g.bot], [g.xb1 - cs - dr, top]]);
      PL('RW-REBAR', [[g.xf0 + cs + df, g.bot], [g.xf1 + cs + df, top]]);
      const zm = (g.bot + g.top) / 2;
      TX('RW-REBAR', M(Math.max(g.xb0, g.xb1)) + 1.3 * th, M(zm), th, `${bm(r.d, r.s)} (REAR, MAIN)`, 1, 90);
      TX('RW-REBAR', M(Math.min(g.xf0, g.xf1)) - 0.4 * th, M(zm), th, `${bm(r.d3, r.s3)} (FRONT)`, 1, 90);
      TX('RW-REBAR', M(Math.max(g.xb0, g.xb1)) + 2.4 * th, M(g.top) - 1.6 * th, th, `${bm(r.d2, r.s2)} EF (HORIZ.)`, 0, 0);
      if (i === nS - 1 && !Gv) {
        const db = rcv(S, 'T').d / 1000;
        const zs = Zb + cb + db;
        PL('RW-REBAR', [[g.xb0 - cs - dr, g.bot], [g.xb0 - cs - dr, zs]]);
        const lp = ln('s' + i);
        if (lp) {
          const xo = g.xb0 - cs - dr - (1.5 * r.d) / 1000;
          PL('RW-REBAR', [[xo, g.bot], [xo, g.bot + lp / 1000]]);
          TX('RW-REBAR', M(xo) - 0.6 * th, M(g.bot + lp / 2000), th, `LAP ${lp}`, 1, 90);
        }
      }
    });
    XS.forEach((a) =>
      a.segs.forEach((sg) => {
        if (!(sg.h > 1e-9)) return;
        const k = 'x' + a.j + (sg.k ? 's' + sg.k : '');
        const r = rcv(S, k);
        const dr = r.d / 2000;
        const df = r.d3 / 2000;
        const oF = UU ? sg.x0 : sg.x1;
        const iF = UU ? sg.x1 : sg.x0;
        const sgn = UU ? 1 : -1;
        PL('RW-REBAR', [[oF + sgn * (cs + dr), sg.bot], [oF + sgn * (cs + dr), sg.top - cs]]);
        PL('RW-REBAR', [[iF - sgn * (cs + df), sg.bot], [iF - sgn * (cs + df), sg.top - cs]]);
        TX('RW-REBAR', UU ? M(sg.x0) - 0.4 * th : M(sg.x1) + 1.3 * th, M((sg.bot + sg.top) / 2), th, `${bm(r.d, r.s)} (MAIN)`, 1, 90);
        const lp = !sg.k && ln(k);
        if (lp) TX('RW-REBAR', M(sg.x0 + sg.t / 2), M(sg.bot) + 1.2 * th, th, `LAP ${lp}`, 1, 0);
      }),
    );
    if (!Gv) {
      const rT = rcv(S, 'T');
      const rH = rcv(S, 'H');
      const zb = Zb + cb + rT.d / 2000;
      const zt = bt - ct - rH.d / 2000;
      PL('RW-REBAR', [[cb, zb], [B - cb, zb]]);
      PL('RW-REBAR', [[cb, zt], [B - cb, zt]]);
      const yb = M(Zb) - 1.4 * th;
      const yt = M(bt) + 0.5 * th;
      if (G.Lt0 > 0) TX('RW-REBAR', M(G.Lt0 / 2), yb, th, `${bm(rT.d, rT.s)} B (TOE MAIN)`, 1);
      if (G.hl > 0) TX('RW-REBAR', M(G.xb + G.hl / 2), yt, th, `${bm(rH.d, rH.s)} T (HEEL MAIN)`, 1);
      if (G.Lt0 > 0) TX('RW-REBAR', M(G.Lt0 / 2), yt, th, `${bm(rT.d3, rT.s3)} T`, 1);
      if (G.hl > 0) TX('RW-REBAR', M(G.xb + G.hl / 2), yb, th, `${bm(rH.d3, rH.s3)} B`, 1);
    }
  }

  // ---- dimensions (mm)
  const kz = KG && KG.dk > 0 ? KG.dk : 0;
  const y1 = M(Zb - kz) - 6 * th;
  const y2 = y1 - 5 * th;
  const g0 = G.SG.filter((g) => g.h > 1e-9);
  const lo = g0.length ? g0[g0.length - 1] : null;
  if (Gv) {
    const bf = Math.max(0, +S.gbf || 0);
    const bT = Math.max(0, +S.gBt || 0);
    const xs = [0, bf, bf + bT, B].filter((x, i, a) => i === 0 || x > a[i - 1] + 1e-6);
    for (let i = 0; i < xs.length - 1; i++) dH(xs[i], xs[i + 1], Zb, y1);
  } else if (lo) {
    const xs = [0, ...XS.flatMap((a) => [a.x0, a.x1]), G.Lt, lo.xb0, B]
      .sort((a, b) => a - b)
      .filter((x, i, a) => i === 0 || x > a[i - 1] + 1e-6);
    for (let i = 0; i < xs.length - 1; i++) dH(xs[i], xs[i + 1], Zb, y1);
  }
  dH(0, B, Zb, y2, 'B = ');
  const yT = M(G.top) + 5 * th;
  if (g0.length) dH(g0[0].xf1, g0[0].xb1, G.top, yT);
  if (KG && KG.dk > 0) {
    dH(KG.xk, KG.xk + KG.Bk, Zb - KG.dk, M(Zb - KG.dk) - 2.5 * th);
    dV(Zb - KG.dk, Zb, KG.xk + KG.Bk, M(KG.xk + KG.Bk) + 3 * th);
  }
  dV(Zb, bt, 0, xL);
  g0.slice().reverse().forEach((g) => dV(g.bot, g.top, g.xf0, xL));
  dV(Zb, G.top, 0, xL2, 'H = ');
  if (S.fon && Hf > Zb) dV(Zb, Hf, Math.min(0, pX(G.fr, Hf)), xL2 - 6 * th, 'Df = ');
  if (S.bon && Hr > Zb) dV(Zb, Hr, B, M(xr) - 3 * th);
  if (CR && sb > 0) dH(-sb, 0, Hf, M(Hf) + 3 * th, 'b = ');

  // ---- levels
  const mB = M(B);
  const dX = 3.5 * th;
  const xT = M(G.ftx);
  LV(Math.min(xT - dX, xL + (xT - xL) / 2), G.top, 'T.O.W.', xT);
  LV(mB + 8.5 * th, Zb, 'F.L.', mB);
  LV(S.bon && Math.abs(Hr - bt) * 1000 < 4 * th ? mB + 8.5 * th : mB + dX, bt, 'B.T.', mB);
  if (S.bon) {
    const tb = Math.tan((+S.br || 0) * R);
    const xg = tb > 0 ? M(G.xH) + dX : mB + dX;
    LV(xg, tb > 0 ? Hr + ((xg - M(G.xH)) / 1000) * tb : Hr, 'G.L.');
  }
  const xlm = M(xl) + dX;
  if (Hf > Zb || S.fon) {
    LV(xlm, CR ? Hf : Hf + (S.fon ? Math.tan((+S.bf || 0) * R) * (pX(G.fr, Hf) - xlm / 1000) : 0), 'G.L.');
  }
  if (S.bon && C.wb > 0) LV(mB + 13.5 * th, C.Wb, 'GWL');
  if (S.fon && C.wf > 0) LV(xlm, Zb + C.wf, 'GWL');
  if (KG && KG.dk > 0) LV(M(KG.xk + KG.Bk) + dX, Zb - KG.dk, '', M(KG.xk + KG.Bk));
  XS.forEach((a) => LV(M(a.x0 + a.t / 2), a.top, ''));

  // ---- title
  const nm = o.name || 'RW';
  const yt = y2 - 6 * th;
  const tl = [`${nm} - TYPICAL SECTION`, `SCALE 1:${sc}  (UNITS: mm, LEVELS: mPD)`];
  const dz = [S.pn ? `JOB NO. ${S.pn}` : '', S.jno ? String(S.jno) : ''].filter(Boolean).join('  ');
  TX('TEXT', M(B / 2), yt, 2 * th, tl[0], 1);
  TX('TEXT', M(B / 2), yt - 3 * th, th, tl[1], 1);
  if (dz) TX('TEXT', M(B / 2), yt - 5 * th, th, dz, 1);
  TX('TEXT', M(B / 2), yt - 7 * th, th, 'SECTION GENERATED FROM THE CALCULATION MODEL - BAR LINES ARE SCHEMATIC; DETAILING TO STRUCTURAL DRAWINGS', 1);

  const body = E.join('\n') + '\n';
  const t = DXFT.replace('\n  2\n*Paper_Space\n340\n1E\n', (m) => m + (BR.length ? BR.join('\n') + '\n' : ''))
    .replace(
      'BLOCK_RECORD\n  5\n9\n330\n0\n100\nAcDbSymbolTable\n 70\n2\n',
      `BLOCK_RECORD\n  5\n9\n330\n0\n100\nAcDbSymbolTable\n 70\n${2 + nD}\n`,
    )
    .replace('\n100\nAcDbBlockEnd\n  0\nENDSEC\n', () => '\n100\nAcDbBlockEnd\n' + (BK.length ? BK.join('\n') + '\n' : '') + '  0\nENDSEC\n')
    .replace(/\nENTITIES\n  0\nENDSEC\n/, `\nENTITIES\n${body}  0\nENDSEC\n`)
    .replace(/\n\$HANDSEED\n  5\n[0-9A-F]+\n/, `\n$HANDSEED\n  5\n${hd.toString(16).toUpperCase()}\n`);
  return t.replace(/\r?\n/g, '\r\n');
}

export const dxfName = (n?: string): string =>
  String(n || 'RW').replace(/[\\/:*?"<>|]+/g, '_').trim() + '_section.dxf';
