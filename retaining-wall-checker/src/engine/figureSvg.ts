/**
 * Exact 1:1 pure TypeScript port of v14.0.1 fig() (lines 1280–1427).
 * Produces the complete Hong Kong GEO/BD cross-section & characteristic load SVG,
 * including all earth/water/passive pressure diagrams, uplift + effective bearing pressure,
 * inclined resultant R, individual force arrows + legend, multi-stem terrace soil & water,
 * unplanned excavation band, surcharge bands, dimension chains, inline editors, and ALL ~20+ drag handles.
 * Zero DOM dependencies (RULES.md #2).
 */
import { DEG2RAD as R, G_WATER as g } from './constants';
import { planeX } from './earthPressure';
import { fdX, pX, pXl } from './geometry';
import { FSo, bfOn, fdOn, gTx, isG, isU, scOn, vSOn, vStemOn } from './helpers';
import { barCalc, ppF, ppZ } from './loads';
import { cl, dd, f as F0 } from './math';
import { qDist } from './stability';
import type {
  CalcAllSuccessResult,
  CompResult,
  EvalResult,
  GeometryResult,
  LoadFactors,
  WallState,
} from './types';

export type FigureMode = 'all' | 'geo' | 'load';

export interface FigureFreeze {
  xl: number;
  y0: number;
  s: number;
  xb0: number;
  anc: 'toe' | 'xb';
}

export interface FigureHandle {
  p: string;
  ax: 'x' | 'z';
  k: 1 | -1;
  v: number;
  x: number;
  z: number;
  anc: 'toe' | 'xb';
  min: number;
  max: number;
  d: number;
  lab: string;
}

export interface FigureViewMeta {
  xl: number;
  y0: number;
  s: number;
  xb: number;
  W: number;
  H: number;
}

export interface FigureLayers {
  dims: boolean;
  handles: boolean;
  pressures: boolean;
  forces: boolean;
  soil: boolean;
  bearing: boolean;
  rebar: boolean;
}

export const DEFAULT_FIGURE_LAYERS: FigureLayers = {
  dims: true,
  handles: true,
  pressures: true,
  forces: true,
  soil: true,
  bearing: true,
  rebar: false,
};

export interface FigureRenderInput {
  G: GeometryResult;
  C: CompResult;
  s: EvalResult;
  sB?: EvalResult | null;
  fa?: LoadFactors | null;
  mode?: FigureMode;
  layers?: Partial<FigureLayers>;
  noEdit?: boolean;
  freeze?: FigureFreeze | null;
  figId?: string;
}

export interface FigureRenderOutput {
  svgHtml: string;
  notesHtml: string;
  handles: FigureHandle[];
  viewMeta: FigureViewMeta;
}

let figCounter = 0;

/** Build FigureRenderInput directly from a CalcAllSuccessResult (matches v14.0.1 rr() call to fig()). */
export function figureInputFromResult(
  S: WallState,
  R0: CalcAllSuccessResult,
  opts?: { mode?: FigureMode; layers?: Partial<FigureLayers>; noEdit?: boolean; freeze?: FigureFreeze | null },
): FigureRenderInput {
  const sls = R0.A.sls;
  const brS = R0.P ? R0.A.br.b : R0.Fc.br.b;
  return {
    G: R0.G,
    C: sls.C,
    s: sls.s,
    sB: brS,
    fa: sls.fa,
    mode: opts?.mode ?? ((S.fgm as FigureMode) || 'all'),
    layers: opts?.layers,
    noEdit: opts?.noEdit,
    freeze: opts?.freeze ?? null,
  };
}

/** Exact 1:1 port of v14.0.1 fig(c) with optional CAD layer flags */
export function renderFigureSvg(S: WallState, c: FigureRenderInput): FigureRenderOutput {
  const FI = c.figId || `f${++figCounter}`;
  const f = (v: number, d?: number) => (d == null ? dd(v) : F0(v, d));
  const { B, Lt, xb, hl, bt, top } = c.G;
  const Zb = +S.Zb;
  const Hr = +S.Hr;
  const Hf = +S.Hf;
  const Fs = FSo(S);
  const sa = S.asc || 1;
  const wh = S.wo ? +S.wh : 0;
  const NE = !!c.noEdit;
  const KG = c.C.KG;
  const MD: FigureMode = c.mode || (NE ? 'all' : ((S.fgm as FigureMode) || 'all'));
  const LY: FigureLayers = { ...DEFAULT_FIGURE_LAYERS, ...(c.layers || {}) };
  const SG_ = MD !== 'load' && LY.dims;
  const SL_ = MD !== 'geo';
  const SP_ = SL_ && LY.pressures;
  const SF_ = SL_ && LY.forces;
  const SB_ = SL_ && LY.bearing;
  const SH_ = !NE && MD !== 'load' && LY.handles;
  const NT: string[] = [];
  const NM: string[] = [];
  const SY = '①②③④⑤⑥⑦⑧⑨';
  const nt = (t: string) => {
    NM.push(t);
    return SY[NM.length - 1] || `(${NM.length})`;
  };

  const CL: Record<string, string> = {
    a: '#a16207',
    q: '#9333ea',
    p: '#2e9e5b',
    w: '#2563eb',
    g: '#475569',
    l: '#9333ea',
    wd: '#0891b2',
    b: '#dc2626',
    u: '#f59e0b',
    n: '#111827',
    e: '#0d9488',
    r: '#0f172a',
    x: '#be123c',
  };

  const P = c.C.it.filter((i) => i.dir === 'h');
  const Pp = c.C.it.filter((i) => i.dir === 'p');
  const Wv = c.C.it.filter((i) => i.dir === 'v');
  const U = c.C.it.filter((i) => i.dir === 'u');
  const fmax = Math.max(1, ...c.C.it.map((p) => p.F), c.s.N > 0 ? c.s.N : 0);
  const lm = 1.4 * sa;
  const len = (v: number) => Math.max(0.28, (v / fmax) * lm);
  const dkk = KG ? KG.dk : 0;
  const GM = MD === 'geo';
  const ML = MD === 'load';

  const xl = Math.min(GM ? -2.9 : -Math.max(0.9 + lm + 1.8, 4.1), scOn(S) ? -+S.scb - 1.6 : 0);
  const xr = GM
    ? B + 2.6 + (S.lon && S.bon ? Math.max(0, +S.lx - 1) : 0)
    : B + 1.8 + lm + 1.7 + (S.lon && S.bon ? Math.max(0, +S.lx - 1) : 0);
  const y0 = GM
    ? Zb - dkk - (isG(S) ? 0.9 : 1.5)
    : ML
      ? Zb - dkk - 1.5
      : Zb - dkk - Math.min(2.6, Math.max(1.4, lm) + 1);
  const y1 =
    (GM ? Math.max(top + wh, Hr, Hf) + 0.5 : Math.max(top + wh, Hr, Hf) + Math.min(lm, 1) + 0.5) +
    (S.bon && +S.br > 0 ? Math.min((xr - c.G.xH) * Math.tan(S.br * R), Math.max(1, 0.35 * (Hr - Zb))) + 0.45 : 0);

  const W = 940;
  const H = 600;
  const s0 = Math.min((W - 20) / (xr - xl), (H - 54) / (y1 - y0));
  const FZ_ = NE ? null : c.freeze ?? null;
  const s = FZ_ ? FZ_.s : s0;
  const xo = FZ_ ? FZ_.xl + (FZ_.anc === 'xb' ? xb - FZ_.xb0 : 0) : xl;
  const yo = FZ_ ? FZ_.y0 : y0;
  const X = (x: number) => 10 + (x - xo) * s;
  const Y = (z: number) => H - 12 - (z - yo) * s;
  const HD: FigureHandle[] = [];

  const rc = (x1: number, z1: number, x2: number, z2: number, a: string) =>
    `<rect x="${f(X(x1), 1)}" y="${f(Y(z2), 1)}" width="${f((x2 - x1) * s, 1)}" height="${f(Math.max(0, (z2 - z1) * s), 1)}" ${a}/>`;
  const tx = (
    x: number,
    y: number,
    t: string,
    a?: string | null,
    col?: string | null,
    k?: string | null,
    cls?: string,
  ) =>
    `<text x="${f(x, 1)}" y="${f(y, 1)}" text-anchor="${a || 'start'}" class="${k || 'lb'}${cls ? ' ' + cls : ''}"${col ? ` style="fill:${col}"` : ''}>${t}</text>`;

  const bx: [number, number, number, number][] = [[0, 0, W, 40]];
  const ov = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

  interface EditSpec {
    p: string;
    v: number;
    d?: number;
    u?: string;
    st?: number;
    pt?: string;
  }

  const put = (
    ax: number,
    ay: number,
    t: string,
    an?: string | null,
    col?: string | null,
    k?: string | null,
    ed?: EditSpec | null,
  ) => {
    let text = t;
    let edit = ed;
    if (NE || MD === 'load') {
      if (edit) text = edit.pt ?? `${text} ${f(edit.v, edit.d)}${edit.u ?? ''}`;
      edit = null;
    }
    const cw = k === 'lv' ? 5.9 : 6.9;
    const full = edit ? edit.pt ?? `${text} ${f(edit.v, edit.d)}${edit.u ?? ''}` : text;
    const ws = edit ? text.length * cw + 52 : 0;
    const w = Math.max(full.length * cw, ws) + 8;
    const x0 = an === 'end' ? ax - w : an === 'middle' ? ax - w / 2 : ax;
    let d0 = 0;
    let b: [number, number, number, number] = [x0, ay - 11, x0 + w, ay + 4];
    for (const d of [0, ...Array.from({ length: 14 }, (_, i) => [-(i + 1) * 15, (i + 1) * 15]).flat()]) {
      d0 = d;
      b = [x0, ay + d - 11, x0 + w, ay + d + 4];
      if (!bx.some((z) => ov(z, b))) break;
    }
    bx.push(b);
    const yy = ay + d0;
    const lead = d0
      ? `<line x1="${f(ax, 1)}" y1="${f(ay, 1)}" x2="${f(ax + (an === 'end' ? -3 : an === 'start' ? 3 : 0), 1)}" y2="${f(ay + d0 + (d0 > 0 ? -10 : 3), 1)}" stroke="${col || '#94a3b8'}" stroke-width=".8"/>`
      : '';
    if (!edit) return lead + tx(ax, yy, text, an, col, k);
    const xs = an === 'end' ? ax - ws : an === 'middle' ? ax - ws / 2 : ax;
    const xi = xs + text.length * cw + 2;
    return (
      lead +
      tx(ax, yy, full, an, col, k, 'prt') +
      tx(xs, yy, text, 'start', col, k, 'scr') +
      `<foreignObject class="fo" x="${f(xi, 1)}" y="${f(yy - 12, 1)}" width="48" height="17"><input class="fi" type="number" step="${edit.st || 0.05}" data-p="${edit.p}" value="${dd(edit.v)}" title="Edit – synced with the input panel"></foreignObject>`
    );
  };

  const CONC = 'fill="var(--cad-concrete-fill, #cfd6dd)" stroke="var(--cad-concrete-stroke, #64748b)" stroke-width="1.3"';
  const soil = (x1: number, z1: number, x2: number, z2: number) =>
    rc(x1, z1, x2, z2, 'fill="var(--cad-soil-fill, #f2e8cf)"') + rc(x1, z1, x2, z2, `fill="url(#${FI}dots)"`);
  const wat = (x1: number, z1: number, x2: number, z2: number) =>
    rc(x1, z1, x2, z2, 'fill="#3b82f6" fill-opacity=".16"');
  const ln = (x1: number, x2: number, z: number, col: string, d?: number) =>
    `<line x1="${f(X(x1), 1)}" x2="${f(X(x2), 1)}" y1="${f(Y(z), 1)}" y2="${f(Y(z), 1)}" stroke="${col}" stroke-width="1.2"${d ? ' stroke-dasharray="6 3"' : ''}/>`;
  const PT = (pts: [number, number][]) => pts.map((p) => `${f(X(p[0]), 1)},${f(Y(p[1]), 1)}`).join(' ');

  let o = `<svg viewBox="0 0 ${W} ${H}" class="rw-fig-svg"><defs>${Object.entries(CL)
    .map(
      ([k, v]) =>
        `<marker id="${FI}mk${k}" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto"><path d="M0,0L5,2.5L0,5z" fill="${v}"/></marker>`,
    )
    .join('')}<pattern id="${FI}dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".9" fill="#b8a56f"/><circle cx="6.5" cy="6.5" r=".9" fill="#b8a56f"/></pattern><pattern id="${FI}hat" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0,8L8,0" stroke="#a79f8a" stroke-width=".8"/></pattern><pattern id="${FI}hat2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#8a7f5a" stroke-width="1.1"/></pattern></defs>`;

  type LabelTuple = [number, number, string, string | null, string | null, string | null, EditSpec | null?];
  interface ForceArrow {
    a: [number, number, number, number];
    k: string;
    t: string;
    an: string;
    dy: number;
    pri: number;
    col?: number;
    dash?: number;
    op?: number;
    lx?: number;
  }

  const lb: LabelTuple[] = [];
  const fr: ForceArrow[] = [];
  const C = c.C;
  const K = C.P.Kah;
  const q = C.q;
  const pas = C.pasOK;

  if (LY.soil) {
    o += rc(xl, y0, xr, Zb, 'fill="var(--cad-front-soil, #e6e0d0)"') + rc(xl, y0, xr, Zb, `fill="url(#${FI}hat)"`);
  } else {
    o += ln(xl, xr, Zb, '#94a3b8', 1);
  }

  const SP = (pts: [number, number][] | null) =>
    pts
      ? `<polygon points="${PT(pts)}" fill="var(--cad-soil-fill, #f2e8cf)"/><polygon points="${PT(pts)}" fill="url(#${FI}dots)"/>`
      : '';
  const WP = (pts: [number, number][] | null) =>
    pts ? `<polygon points="${PT(pts)}" fill="#3b82f6" fill-opacity=".16"/>` : '';
  const reg = (P0: [number, number][], side: 'b' | 'f', z1: number, z2: number, ztop?: number) => {
    if (!(z2 > z1 + 1e-9)) return null;
    const pts: [number, number][] = [[pX(P0, z2), z2]];
    for (const p of P0) if (p[1] < z2 - 1e-9 && p[1] > z1 + 1e-9) pts.push(p);
    pts.push([pX(P0, z1), z1]);
    const e = side === 'b' ? B : 0;
    pts.push([e, z1], [e, ztop ?? z2]);
    return pts;
  };

  const xbH = c.G.xH;
  const xF = pX(c.G.fr, Hf);

  if (S.bon) {
    if (LY.soil) {
      o += soil(B, Zb, xr, Hr);
      const bkR = reg(c.G.bk, 'b', Zb, Hr);
      o +=
        bfOn(S) && bkR
          ? `<polygon points="${PT(bkR)}" fill="var(--cad-soil-fill, #f2e8cf)"/><polygon points="${PT(bkR)}" fill="url(#${FI}hat2)" fill-opacity=".45"/>` +
            (SG_ ? (lb.push([X((pXl(c.G.bk, (Zb + Hr) / 2) + B) / 2), Y((Zb + Hr) / 2) + 4, 'Backfill', 'middle', '#6b5b2a', 'lv']), '') : '')
          : SP(bkR);
      if (C.wb > 0) o += wat(B, Zb, xr, C.Wb) + WP(reg(c.G.bk, 'b', Zb, Math.min(Hr, C.Wb)));
    }
    o += ln(xbH, xr, Hr, '#8a7f5a');
  }

  // Front soil: always drawn when above founding level; hatched when passive ignored
  if (Hf > Zb) {
    const tf = S.fon ? Math.tan(+S.bf * R) : 0;
    const SC = scOn(S);
    const xc_ = SC ? -+S.scb : xF;
    const zf = (x: number) => Hf + Math.max(0, xc_ - x) * tf;
    const polyPts: [number, number][] = tf
      ? [
          [xl, Zb],
          [xl, zf(xl)],
          ...(SC && xc_ > xl && xc_ < 0 ? ([[xc_, Hf]] as [number, number][]) : []),
          [0, zf(0)],
          [0, Zb],
        ]
      : [
          [xl, Zb],
          [xl, Hf],
          [0, Hf],
          [0, Zb],
        ];
    const poly = PT(polyPts);
    const Df = Hf - Zb;
    const TR = reg(c.G.fr, 'f', Zb, Hf, tf ? zf(0) : Hf);
    if (LY.soil) {
      if (pas) {
        o += `<polygon points="${poly}" fill="var(--cad-soil-fill, #f2e8cf)"/><polygon points="${poly}" fill="url(#${FI}dots)"/>${SP(TR)}`;
      } else {
        o += `<polygon points="${poly}" fill="var(--cad-soil-fill, #f2e8cf)" fill-opacity=".45" stroke="#8a7f5a" stroke-dasharray="5 3" stroke-width="1"/><polygon points="${poly}" fill="url(#${FI}hat2)" fill-opacity=".55"/>`;
        if (TR) {
          o += `<polygon points="${PT(TR)}" fill="var(--cad-soil-fill, #f2e8cf)" fill-opacity=".45"/><polygon points="${PT(TR)}" fill="url(#${FI}hat2)" fill-opacity=".55"/>`;
        }
        if (SG_) {
          lb.push([
            X(xl) + 6,
            Y((Hf + Zb) / 2) + 4,
            'Front soil ' +
              nt(
                S.fon
                  ? `Front soil (Df = ${f(Df)} m): passive resistance ignored (hatched).`
                  : `Front soil (Df = ${f(Df)} m): not considered in the calculation.`,
              ),
            'start',
            '#8a5a00',
            'lv',
          ]);
        }
      }
    }
    if (tf) {
      o += SC
        ? `<polyline points="${PT([
            [xl, zf(xl)],
            [xc_, Hf],
            [xF, Hf],
          ])}" fill="none" stroke="#8a7f5a" stroke-width="1.2"/>` +
          (SG_ ? (lb.push([X(xc_), Y(Hf) - 8, `crest, b = ${f(+S.scb)} m`, 'middle', '#8a5a00', 'lv']), '') : '')
        : `<line x1="${f(X(xl), 1)}" y1="${f(Y(zf(xl)), 1)}" x2="${f(X(xF), 1)}" y2="${f(Y(Hf), 1)}" stroke="#8a7f5a" stroke-width="1.2"/>`;
      if (SG_) lb.push([X(xl) + 6, Y(zf(xl)) - 20, `β_f = ${f(S.bf, 1)}°`, 'start', null, 'lv']);
    }
    if (LY.soil && S.fon && C.wf > 0) o += wat(xl, Zb, 0, Zb + C.wf) + WP(reg(c.G.fr, 'f', Zb, Math.min(Hf, Zb + C.wf)));
    o += tf ? '' : ln(xl, xF, Hf, '#8a7f5a');
    if (LY.soil && S.fon && S.dp > 0) {
      const zd = Math.max(Zb, Hf - S.dp);
      o += rc(xl, zd, xF, Hf, 'fill="#d97706" fill-opacity=".10"') + ln(xl, xF, zd, '#b45309', 1);
      if (SG_) {
        lb.push([
          X(xl) + 6,
          Y(zd) + 12,
          'Unplanned exc. ' +
            nt(
              `Unplanned excavation ${f(Math.min(S.dp, Df))} m (GG1 Fig. 39 note 2)${pas ? ': passive taken below +' + f(zd) + ' mPD' : ''}.`,
            ),
          'start',
          '#b45309',
          'lv',
        ]);
      }
    }
  }

  // Earth, surcharge, water & passive pressure distribution polygons
  const KpD = C.UU && C.KaU != null ? C.KaU : C.P.Kp;
  const mq = S.bon ? K * q : 0;
  const ms = S.bon ? K * (S.r.g * C.h1 + C.gR * C.wb) : 0;
  const mw = S.bon ? g * C.wb : 0;
  const pc = pas && !C.UU ? 2 * C.P.cP * C.sk : 0;
  const mp = pas ? KpD * (Fs.g * C.d1 + C.gFs * C.ws) : 0;
  const pw = pas ? g * C.wf : 0;
  const psc = 0.7 / Math.max(mq, ms, mw, pc + mp, pw, 1e-6);

  const colp = (
    b0: number,
    dir: number,
    pts: [number, number][],
    k: string,
    items: typeof P,
    id: string,
  ) => {
    if ((!SP_ && !SF_) || pts.every((pt) => pt[0] < 1e-6)) return '';
    const zt = pts[0][1];
    const zl = pts[pts.length - 1][1];
    const F_ = items.reduce((t, p) => t + p.F, 0);
    const z_ = F_ > 0 ? items.reduce((t, p) => t + p.F * p.arm, 0) / F_ : 0;
    if (SF_ && F_ > 1e-9) {
      fr.push({
        a: [X(b0 + dir * len(F_)), Y(Zb + z_), X(b0), Y(Zb + z_)],
        k,
        t: `${id} ${f(F_, 2)}`,
        an: dir > 0 ? 'start' : 'end',
        dy: 4,
        pri: 1,
        col: dir,
      });
    }
    if (!SP_) return '';
    return `<polygon points="${PT([[b0, Zb + zt], ...pts.map(([pv, z]): [number, number] => [b0 + dir * pv * psc, Zb + z]), [b0, Zb + zl]])}" fill="${CL[k]}" fill-opacity=".16" stroke="${CL[k]}" stroke-width="1"/><line x1="${f(X(b0), 1)}" x2="${f(X(b0), 1)}" y1="${f(Y(Zb + zt), 1)}" y2="${f(Y(Zb + zl), 1)}" stroke="${CL[k]}" stroke-dasharray="3 3" stroke-width=".8"/>`;
  };

  const A = P.filter((p) => p.cat !== 'wind' && p.cat !== 'bar');
  const bs = B + (mq > 0 ? mq * psc + 0.12 : 0);
  const bw = bs + (ms > 0 ? ms * psc + 0.12 : 0);
  const bp = -(pc + mp) * psc - 0.15;

  if (C.al > 0) {
    const zt = Zb + C.hs;
    const xt = B - C.hs * Math.tan(C.al * R);
    o += `<line x1="${f(X(B), 1)}" y1="${f(Y(Zb), 1)}" x2="${f(X(xt), 1)}" y2="${f(Y(zt), 1)}" stroke="#9333ea" stroke-width="1.4" stroke-dasharray="6 4"/>`;
    lb.push([X(xt) + 5, Y(zt) + 13, `α = ${f(C.al, 1)}°`, 'start', '#9333ea', 'lv']);
  }

  o +=
    colp(B, 1, [[mq, C.hs], [mq, 0]], 'q', A.filter((p) => p.cat === 'sur' && !/^Parapet/.test(p.t)), isG(S) ? 'ΣPah,q' : 'ΣPq') +
    colp(bs, 1, [[0, C.hs], [K * S.r.g * C.h1, C.wb], [ms, 0]], 'a', A.filter((p) => p.cat === 'soil'), isG(S) ? 'ΣPah' : 'ΣPa') +
    colp(bw, 1, [[0, C.wb], [mw, 0]], 'w', A.filter((p) => p.cat === 'water'), isG(S) ? 'U1h' : 'Pw') +
    colp(0, -1, [[pc, C.hf], [pc + KpD * Fs.g * C.d1, C.ws], [pc + mp, 0]], 'p', Pp.filter((p) => p.cat === 'pas'), C.UU ? 'ΣPf' : 'ΣPp') +
    colp(pc + mp > 0 ? bp : 0, -1, [[0, C.wf], [pw, 0]], 'w', Pp.filter((p) => p.cat === 'pwat'), 'Pwf');

  // Backfill slope, surcharge bands, and line loads (GG1 Fig. 29)
  {
    const tb = S.bon ? Math.tan(S.br * R) : 0;
    const cap = +S.brL > 0 ? +S.brL * tb : Math.max(1, 0.35 * (Hr - Zb));
    const xk = tb > 0 ? xbH + cap / tb : 1e9;
    const zs = (x: number) => Hr + Math.min((x - xbH) * tb, cap);
    const QB = 'fill="#3b82f6" fill-opacity=".18" stroke="#3b82f6" stroke-width=".8"';
    const band = (x1: number, x2: number) => {
      const xs = [x1, ...(xk > x1 && xk < x2 ? [xk] : []), x2];
      return `<polygon points="${PT([...xs.map((x): [number, number] => [x, zs(x)]), ...xs.slice().reverse().map((x): [number, number] => [x, zs(x) + 0.22])])}" ${QB}/>`;
    };
    if (S.bon && tb > 0) {
      const SPp = PT([[xbH, Hr], ...(xk < xr ? ([[xk, zs(xk)]] as [number, number][]) : []), [xr, zs(xr)], [xr, Hr]]);
      o +=
        `<polygon points="${SPp}" fill="var(--cad-soil-fill, #f2e8cf)"/><polygon points="${SPp}" fill="url(#${FI}dots)"/>` +
        (xk < xr
          ? `<line x1="${f(X(xk), 1)}" y1="${f(Y(zs(xk)), 1)}" x2="${f(X(Math.min(xr, xk + 0.6)), 1)}" y2="${f(Y(zs(xk) + 0.35), 1)}" stroke="#8a7f5a" stroke-dasharray="3 3"/>`
          : '');
    }
    if (S.bon && q > 0) {
      const x0 = B;
      o += band(x0, xr);
      lb.push([X((x0 + xr) / 2), Y(zs((x0 + xr) / 2) + 0.22) - 5, `q = ${f(q, 2)} kPa`, 'middle', CL.w, 'lv']);
    }
    if (S.bon && C.qi > 0) {
      o += band(xbH, B).replace(QB, `fill="url(#${FI}hat2)" fill-opacity=".55" stroke="#6b7280" stroke-width=".8" stroke-dasharray="4 2"`);
      lb.push([X(xbH) + 4, Y(zs(xb) + 0.22) - 5, `q_in = ${f(C.qi, 2)} kPa (bearing & RC only)`, 'start', '#6b7280', 'lv']);
    }
    if (S.bon && tb > 0) {
      lb.push([X(Math.min(xr, xk)) - 6, Y(zs(Math.min(xr, xk))) - 20, `β = ${f(S.br, 1)}°${xk < xr ? ' (slope continues)' : ''}`, 'end', null, 'lv']);
    }
    if (SL_ && C.LL && (C.LL.Qv > 0 || C.LL.Qh > 0)) {
      const xq = planeX(c.G) + C.LL.x;
      const zq = zs(xq);
      if (C.LL.Qv > 0) {
        fr.push({ a: [X(xq), Y(zq + 0.25 + len(C.LL.Qv)), X(xq), Y(zq + 0.24)], k: 'l', t: `Q1 = ${f(C.LL.Qv, 1)} kN/m`, an: 'middle', dy: -6, pri: 0 });
      }
      if (C.LL.Qh > 0) {
        fr.push({ a: [X(xq + len(C.LL.Qh)), Y(zq + 0.12), X(xq), Y(zq + 0.12)], k: 'l', t: `Qh = ${f(C.LL.Qh, 1)} kN/m`, an: 'start', dy: -6, pri: 0 });
      }
      o += `<line x1="${f(X(planeX(c.G)), 1)}" y1="${f(Y(zq) + 14, 1)}" x2="${f(X(xq), 1)}" y2="${f(Y(zq) + 14, 1)}" stroke="#9333ea" stroke-width=".8" stroke-dasharray="2 2"/>`;
      lb.push([X((planeX(c.G) + xq) / 2), Y(zq) + 26, 'x =', 'middle', '#9333ea', 'lv', { p: 'lx', v: C.LL.x, u: ' m' }]);
    }
  }

  if (S.bon) {
    if (C.wb > 0) o += ln(B, xr, C.Wb, CL.w, 1);
    if (SG_) {
      lb.push([
        X(xr) - 6,
        Y(C.wb > 0 ? C.Wb : Zb) - 6,
        'WL +',
        'end',
        CL.w,
        'lv',
        { p: '@WL', v: C.Wb, pt: C.wb > 0 ? `WL +${f(C.Wb)}` : 'No WL (drained)' },
      ]);
    }
  }
  if (S.fon && C.wf > 0) o += ln(xl, 0, Zb + C.wf, CL.w, 1);
  if (S.fon && SG_) {
    lb.push([
      X(xl) + 6,
      Y(Zb + C.wf) - 6,
      'GWL +',
      'start',
      CL.w,
      'lv',
      { p: 'fw', v: +S.fw, pt: C.wf > 0 ? `GWL +${f(Zb + C.wf)}` : `GWL +${f(+S.fw)} (below base)` },
    ]);
  }

  // Multi-stem terrace soil & water between extra stems (SB1..SBn) and main stem front face (frM)
  const pg = (pts: [number, number][], a: string) => `<polygon points="${PT(pts)}" ${a}/>`;
  const gbf_ = isG(S) ? Math.max(0, +S.gbf || 0) : 0;
  const gbr_ = isG(S) ? +S.gbr || 0 : 0;
  const gtx_ = isG(S) ? gTx(S) : 0;
  const XS = c.G.XS || [];

  if (XS.length && !C.UU) {
    XS.forEach((a, j) => {
      const nx = (z: number) => (j < XS.length - 1 ? XS[j + 1].x0 : pX(c.G.frM, z));
      const poly = (z2: number): [number, number][] => {
        const pts: [number, number][] = [];
        for (const sg of a.segs) {
          if (sg.bot >= z2 - 1e-9) break;
          pts.push([sg.x1, sg.bot], [sg.x1, Math.min(sg.top, z2)]);
        }
        pts.push([nx(z2), z2]);
        if (j === XS.length - 1) {
          for (const qPt of c.G.frM) if (qPt[1] < z2 - 1e-9 && qPt[1] > bt + 1e-9) pts.push(qPt);
        }
        pts.push([nx(bt), bt]);
        return pts;
      };
      if (a.zt > bt + 1e-9) {
        o += SP(poly(a.zt)) + ln(a.x1, nx(a.zt), a.zt, '#8a7f5a');
        const Wt = Math.min(C.Wb, a.zt);
        if (Wt > bt + 1e-9) o += WP(poly(Wt));
        if (SG_) {
          lb.push([
            X((a.xb(a.zt) + nx(a.zt)) / 2),
            Y(a.zt) - 6,
            'Terrace +',
            'middle',
            null,
            'lv',
            { p: `xs.${j}.zt`, v: a.zt, pt: `Terrace +${f(a.zt)}` },
          ]);
        }
      }
    });
  }
  if (XS.length && C.UU && SG_) lb.push([X((XS[0].x1 + Lt) / 2), Y(bt) - 14, 'Channel', 'middle', null, 'lv']);

  // Concrete base / block, main stems, shear key, extra stems
  o +=
    (isG(S) ? pg([[0, Zb], [B, Zb], [B - gbr_, bt], [gtx_, bt]], CONC) : rc(0, Zb, B, bt, CONC)) +
    c.G.SG.filter((sg) => sg.h > 1e-9)
      .map((sg) =>
        pg(
          [
            [sg.xf0, sg.bot],
            [sg.xb0, sg.bot],
            [sg.xb1, sg.top],
            [sg.xf1, sg.top],
          ],
          sg.s.rc && isG(S) ? 'fill="#b9c7d6" stroke="#334155" stroke-width="1.3"' : CONC,
        ),
      )
      .join('');
  if (KG && KG.dk > 0) o += rc(KG.xk, Zb - KG.dk, KG.xk + KG.Bk, Zb, CONC);

  XS.forEach((a, j) => {
    a.segs.forEach((sg) => {
      o += rc(sg.x0, sg.bot, sg.x1, sg.top, CONC);
      if (sg.k && SG_) {
        lb.push(
          [X(sg.x0 + sg.t / 2), Y(sg.top) - 6, 't =', 'middle', '#475569', 'lv', { p: `${sg.p}.t`, v: sg.t, pt: `t = ${f(sg.t)}` }],
          [X(Math.min(sg.x0, a.x0)) - 6, Y(sg.bot + sg.h * 0.5), 'h =', 'end', '#475569', 'lv', { p: `${sg.p}.h`, v: sg.h, pt: `h = ${f(sg.h)}` }],
        );
      }
    });
    const gT = a.segs[a.segs.length - 1];
    if (a.pp) {
      const zp = ppZ(S, a);
      o += rc(gT.x0 + gT.t / 2 - 0.04, a.top, gT.x0 + gT.t / 2 + 0.04, Math.max(a.top + 0.3, zp), `fill="${CL.b}" fill-opacity=".55"`);
      if (SG_) lb.push([X(a.x0) - 4, Y(zp), `Parapet ${f(ppF(S), 2)}`, 'end', CL.l, 'lv']);
    }
    if (SG_) {
      lb.push(
        [X(a.xc), Y(a.bot + a.h) - 6, `SB${j + 1} t =`, 'middle', '#475569', 'lv', { p: `xs.${j}.t`, v: a.t, pt: `SB${j + 1} t = ${f(a.t)}` }],
        [X(a.x0) - 6, Y(a.bot + a.h * 0.55), 'h =', 'end', '#475569', 'lv', { p: `xs.${j}.h`, v: a.h, pt: `h = ${f(a.h)}` }],
      );
    }
  });

  // Fence / barrier schematic on top of main wall
  const fx0 = c.G.ftx;
  const g0 = c.G.SG.find((sg) => sg.h > 1e-9);
  const fxc = g0
    ? S.fdl && S.fxo !== '' && Number.isFinite(+S.fxo)
      ? fdX(S, c.G)
      : (g0.xf1 + g0.xb1) / 2
    : isG(S)
      ? gtx_ + (S.fxo !== '' && Number.isFinite(+S.fxo) ? cl(+S.fxo, 0, +S.gBt) : +S.gBt / 2)
      : fx0 + 0.05;
  if (S.wo || (S.bro && !vStemOn(S)) || fdOn(S)) {
    const hF = Math.max(wh, S.bro && !vStemOn(S) ? +S.bhb : 0, fdOn(S) ? 1 : 0);
    o += rc(fxc - 0.05, top, fxc + 0.05, top + hF, `fill="${S.wo || !S.bro ? CL.wd : CL.b}" fill-opacity=".55"`);
    if (SG_) {
      lb.push([X(fxc + 0.05) + 6, Y(top + hF * 0.6), S.wo ? `Fence ${f(wh)}` : S.bro && !vStemOn(S) ? 'Barrier' : 'Fence', 'start', CL.l, 'lv']);
    }
  }

  // Schematic Rebar Overlay (when Rebar layer is toggled ON)
  if (LY.rebar && !isG(S)) {
    o += '<g stroke="var(--cad-rebar, #c2410c)" stroke-width="1.6" fill="none" stroke-linecap="round">';
    c.G.SG.filter((sg) => sg.h > 1e-9).forEach((sg) => {
      o += `<line x1="${f(X(sg.xb0 - 0.06), 1)}" y1="${f(Y(sg.bot), 1)}" x2="${f(X(sg.xb1 - 0.06), 1)}" y2="${f(Y(sg.top - 0.05), 1)}"/>`;
      o += `<line x1="${f(X(sg.xf0 + 0.06), 1)}" y1="${f(Y(sg.bot), 1)}" x2="${f(X(sg.xf1 + 0.06), 1)}" y2="${f(Y(sg.top - 0.05), 1)}" stroke-dasharray="3 2"/>`;
    });
    XS.forEach((a) => {
      a.segs.forEach((sg) => {
        if (!(sg.h > 1e-9)) return;
        o += `<line x1="${f(X(sg.x1 - 0.05), 1)}" y1="${f(Y(sg.bot), 1)}" x2="${f(X(sg.x1 - 0.05), 1)}" y2="${f(Y(sg.top - 0.05), 1)}"/>`;
        o += `<line x1="${f(X(sg.x0 + 0.05), 1)}" y1="${f(Y(sg.bot), 1)}" x2="${f(X(sg.x0 + 0.05), 1)}" y2="${f(Y(sg.top - 0.05), 1)}" stroke-dasharray="3 2"/>`;
      });
    });
    o += `<line x1="${f(X(0.06), 1)}" y1="${f(Y(Zb + 0.07), 1)}" x2="${f(X(B - 0.06), 1)}" y2="${f(Y(Zb + 0.07), 1)}"/>`;
    o += `<line x1="${f(X(0.06), 1)}" y1="${f(Y(bt - 0.07), 1)}" x2="${f(X(B - 0.06), 1)}" y2="${f(Y(bt - 0.07), 1)}"/>`;
    o += '</g>';
  }

  // Base uplift (orange) + effective bearing pressure (teal) + middle-third + inclined resultant R
  if (SB_ && c.s.N > 0) {
    const ux = (x: number) => C.uf + ((C.ub - C.uf) * x) / B;
    const qb = qDist(c.s.N, c.s.e, B);
    const qm = Math.max(qb(0), qb(B));
    const sq = 0.7 / Math.max(qm, ux(0), ux(B), 1e-6);
    const xs = Array.from({ length: 21 }, (_, i) => (B * i) / 20);
    const Pt = (g1: (x: number) => number, g2: (x: number) => number) =>
      xs.map((x) => `${f(X(x), 1)},${f(Y(Zb - g1(x) * sq), 1)}`).join(' ') +
      ' ' +
      xs
        .slice()
        .reverse()
        .map((x) => `${f(X(x), 1)},${f(Y(Zb - g2(x) * sq), 1)}`)
        .join(' ');
    o += `<polygon points="${Pt(() => 0, ux)}" fill="${CL.u}" fill-opacity=".22" stroke="${CL.u}" stroke-width="1"/><polygon points="${Pt(ux, (x) => ux(x) + qb(x))}" fill="${CL.e}" fill-opacity=".2" stroke="${CL.e}" stroke-width="1"/>`;
    const sB = c.sB;
    const qB = sB && sB.N > 0 ? qDist(sB.N, sB.e, B) : null;
    const qBm = qB ? Math.max(qB(0), qB(B)) : 0;
    const dif = qB && Math.abs(qBm - qm) > 0.05;
    const xl_ =
      [
        c.fa && c.fa.sheel === 0 && C.qi > 0 ? 'q_in' : '',
        c.fa && c.fa.pvq === 0 && C.it.some((i) => i.cat === 'pvq') ? 'Pav,q' : '',
      ]
        .filter(Boolean)
        .join(' & ') || 'q_in';
    if (dif && MD === 'load' && qB) {
      o += `<polyline points="${xs.map((x) => `${f(X(x), 1)},${f(Y(Zb - (ux(x) + qB(x)) * sq), 1)}`).join(' ')}" fill="none" stroke="${CL.e}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    }
    [0, B].forEach((x) => {
      const mx = qb(x) >= qb(B - x);
      lb.push([X(x), Y(Zb - (ux(x) + qb(x)) * sq) + 13, mx ? `q_max ${f(qb(x), 2)}` : `q_min ${f(qb(x), 2)}`, 'middle', CL.e, 'lv']);
    });
    NT.push(
      `Effective base pressure (kPa) for the middle-third case${dif ? ` (without ${xl_})${MD === 'load' ? '; dashed = bearing case with ' + xl_ : '; bearing case with ' + xl_}, q_max = ${f(qBm, 2)} kPa` : ''}; uplift shaded orange.`,
    );
  }

  if (SB_ || SF_) {
    const mt = Math.abs(c.s.e) <= B / 6 + 1e-9 && c.s.N > 0;
    if (SB_) {
      o += `<rect x="${f(X(B / 3), 1)}" y="${f(Y(Zb) - 3, 1)}" width="${f((B / 3) * s, 1)}" height="6" fill="#16a34a" fill-opacity=".55" stroke="#15803d" stroke-width=".8"/>`;
      NT.push(`Green band = middle third of the base, ${f(B / 3)}–${f((2 * B) / 3)} m from the toe (GG1 §9.2.4).`);
    }
    if (SF_ && c.s.N > 0 && Number.isFinite(c.s.xbar)) {
      const Hn = c.s.H - (S.ppO ? c.s.Hp : 0);
      const Rm = Math.hypot(Hn, c.s.N);
      const L = Math.max(0.6, len(Rm));
      const ux2 = Hn / Rm;
      const uy = c.s.N / Rm;
      const xe = cl(c.s.xbar, -0.5, B + 0.5);
      fr.push({
        a: [X(xe + ux2 * L), Y(Zb + uy * L), X(xe), Y(Zb)],
        k: mt ? 'r' : 'x',
        t: `R ${f(Rm, 2)} (e = ${f(c.s.e, 3)} ${c.s.e < 0 ? '< 0' : mt ? '≤ B/6' : '> B/6'})`,
        an: 'start',
        dy: -4,
        pri: 6,
      });
    }
  }

  // Full CAD Dimension Chains & Editable Labels
  if (SG_) {
    const DC = '#64748b';
    const ln2 = (x1: number, y1: number, x2: number, y2: number, d?: number) =>
      `<line x1="${f(x1, 1)}" y1="${f(y1, 1)}" x2="${f(x2, 1)}" y2="${f(y2, 1)}" stroke="${DC}" stroke-width=".8"${d ? ' stroke-dasharray="2 2"' : ''}/>`;
    const tk = (x: number, y: number, hz?: number) =>
      hz ? ln2(x - 3.5, y, x + 3.5, y) : ln2(x, y - 3.5, x, y + 3.5);
    const dv = (x: number, z1: number, z2: number, t: string, an: string, ed?: EditSpec | null) => {
      o += ln2(X(x), Y(z1), X(x), Y(z2)) + tk(X(x), Y(z1), 1) + tk(X(x), Y(z2), 1);
      lb.push([X(x) + (an === 'end' ? -6 : 6), Y((z1 + z2) / 2) + 4, t, an, DC, 'lv', ed]);
    };
    const dh = (z: number, x1: number, x2: number, t: string, ed?: EditSpec | null) => {
      o += ln2(X(x1), Y(z), X(x2), Y(z)) + tk(X(x1), Y(z)) + tk(X(x2), Y(z));
      lb.push([X((x1 + x2) / 2), Y(z) + 14, t, 'middle', DC, 'lv', ed]);
    };
    const xc = -((pc + mp > 0 ? (pc + mp) * psc : 0) + (pw > 0 ? pw * psc + 0.15 : 0) + 0.55);
    const n1 = S.st.length > 1;
    S.st.forEach((t, i) => {
      const sg = c.G.SG[i];
      const j = n1 ? String(i + 1) : '';
      dv(xc, sg.bot, sg.top, `h${j} =`, 'end', { p: '@h.' + i, v: sg.h, pt: `h${j} = ${f(sg.h)}` });
      o += ln2(X(xc), Y(sg.top), X(sg.xf1), Y(sg.top), 1) + ln2(X(xc), Y(sg.bot), X(sg.xf0), Y(sg.bot), 1);
      if (!(sg.h > 1e-9)) return;
      const zm = sg.bot + sg.h / 2;
      const L0 = sg.xf0 + sg.fb / 2;
      const L1 = sg.xb0 - sg.rb / 2;
      o += ln2(X(L0), Y(zm), X(L1), Y(zm)) + tk(X(L0), Y(zm)) + tk(X(L1), Y(zm));
      lb.push([
        X(L1) + 8,
        Y(zm) + 4,
        `t${j} =`,
        'start',
        DC,
        'lv',
        {
          p: `st.${i}.t`,
          v: sg.t,
          pt: `t${j} = ${f(sg.t)}${Math.abs(sg.tt - sg.t) > 1e-6 ? ` (top ${f(sg.tt)})` : ''}${isG(S) && t.rc ? ' RC' : ''}`,
        },
      ]);
      if (sg.fb > 1e-6) lb.push([X(sg.xf1) - 6, Y(sg.top) + 14, `fb${j} =`, 'end', DC, 'lv', { p: `st.${i}.fb`, v: sg.fb }]);
      if (sg.rb > 1e-6) lb.push([X(sg.xb1) + 6, Y(sg.top) + 14, `rb${j} =`, 'start', DC, 'lv', { p: `st.${i}.rb`, v: sg.rb }]);
      if ((isG(S) || i < S.st.length - 1) && Math.abs(+t.of || 0) > 1e-6) {
        lb.push([X(sg.xf0) - 6, Y(sg.bot) - 5, `of${j} =`, 'end', DC, 'lv', { p: `st.${i}.of`, v: +t.of || 0 }]);
      }
    });
    if (isG(S)) {
      const bw0 = +S.gBt;
      dh(Zb + 0.15, 0, B, `B = ${f(B)}`);
      if (Math.abs(bw0 - B) > 1e-6 || !NE) dh(bt - 0.2, gtx_, gtx_ + bw0, 'b_t =', { p: 'gBt', v: bw0 });
      if (gbf_ > 1e-6) lb.push([X(0) - 6, Y(Zb + 0.55 * (bt - Zb)), 'b_f =', 'end', DC, 'lv', { p: 'gbf', v: gbf_ }]);
      if (gbr_ > 1e-6) lb.push([X(B) + 6, Y(Zb + 0.55 * (bt - Zb)), 'b_r =', 'start', DC, 'lv', { p: 'gbr', v: gbr_ }]);
    }
    dv(xc, Zb, bt, `${isG(S) ? 'h_b' : 't_b'} =`, 'end', { p: 'tb', v: +S.tb });
    o += ln2(X(xc), Y(Zb), X(0), Y(Zb), 1) + ln2(X(xc), Y(bt), X(0), Y(bt), 1);
    if (S.bon && C.hs0 > 0) {
      dv(xr - 0.3, Zb, Hr, 'H =', 'end', {
        p: '@H',
        v: Hr - Zb,
        pt: `H = ${f(Hr - Zb)}${C.hs > C.hs0 + 1e-6 ? ` (virtual back ${f(C.hs)})` : ''}`,
      });
    }
    if (Hf > Zb) dv(xl + 0.35, Zb, Hf, 'Df =', 'start', { p: '@Df', v: Hf - Zb });
    if (KG && KG.dk > 0) dv(KG.xk - 0.12, Zb - KG.dk, Zb, 'dk =', 'end', { p: 'skd', v: KG.dk });

    const zr1 = y0 + 0.95;
    const zr2 = y0 + 0.4;
    const chn = !isG(S);
    if (chn && XS.length) {
      const pts = [0, ...XS.flatMap((a) => [a.x0, a.x1]), Lt, xb, B]
        .filter((x, i, a) => a.indexOf(x) === i)
        .sort((a, b) => a - b);
      pts.forEach((x) => {
        o += ln2(X(x), Y(Zb - dkk), X(x), Y(zr1), 1);
      });
      [0, B].forEach((x) => {
        o += ln2(X(x), Y(zr1), X(x), Y(zr2), 1);
      });
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k];
        const b2 = pts[k + 1];
        const j = XS.findIndex((qv) => Math.abs(qv.x0 - b2) < 1e-9);
        if (b2 - a > 1e-6) {
          dh(zr1, a, b2, j >= 0 ? 'x =' : f(b2 - a), j >= 0 ? { p: `xs.${j}.x`, v: b2, pt: `x${j + 1} = ${f(b2)}` } : null);
        }
      }
      dh(zr2, 0, B, `B = ${f(B)}`);
    } else if (chn) {
      [0, Lt, xb, B]
        .filter((x, i, a) => a.indexOf(x) === i)
        .forEach((x) => {
          o += ln2(X(x), Y(Zb - dkk), X(x), Y(zr1), 1);
        });
      [0, B].forEach((x) => {
        o += ln2(X(x), Y(zr1), X(x), Y(zr2), 1);
      });
      if (Lt > 0) dh(zr1, 0, Lt, S.ty === 'L' ? `Toe ${f(Lt)}` : 'Toe =', S.ty === 'L' ? null : { p: 'Lt', v: Lt });
      dh(zr1, Lt, xb, `${f(xb - Lt)}`);
      if (hl > 0) dh(zr1, xb, B, S.ty === 'Li' ? `Heel ${f(hl)}` : 'Heel =', S.ty === 'Li' ? null : { p: 'Lh', v: hl });
      dh(zr2, 0, B, `B = ${f(B)}`);
    }
  }

  if (SG_) {
    lb.push(
      [X(xr) - 6, Y(Hr) + (S.bon && q > 0 ? 16 : -6), `GL +${f(Hr)}`, 'end', null, 'lv'],
      [S.fon && +S.bf ? X(xF) - 6 : X(xl) + 6, Y(Hf) - 6, `GL +${f(Hf)}`, S.fon && +S.bf ? 'end' : 'start', null, 'lv'],
      [X(xl) + 6, Y(Zb) + 14, `Founding +${f(Zb)}`, 'start', null, 'lv'],
      [X(fx0) - 6, Y(top) - 6, S.st.length ? 'Top +' : `Top +${f(top)}`, 'end', null, 'lv', S.st.length ? { p: 'st.0.top', v: top, pt: `Top +${f(top)}` } : null],
    );
  }

  // Individual Force Arrows (Wind, Barrier, W, Wf, Ws, Qin, Pv, Pvq, U1v, U)
  const L = P.find((p) => p.cat === 'wind' || p.cat === 'bar');
  const xf = fxc + 0.05;
  let FBx: ReturnType<typeof barCalc> | null = null;
  if (SF_) {
    if (L) {
      fr.push({
        a: [X(xf + len(L.F)), Y(Zb + L.arm), X(xf), Y(Zb + L.arm)],
        k: L.cat === 'wind' ? 'wd' : 'b',
        t: `${L.cat === 'wind' ? 'Fw' : 'Fb'} ${f(L.F, 2)}`,
        an: 'start',
        dy: 4,
        pri: 0,
      });
    }
    if (S.bro && !(L && L.cat === 'bar')) {
      const bb = barCalc(S, c.G);
      if (bb.F > 0) {
        FBx = bb;
        fr.push({
          a: [X(xf + len(bb.F)), Y(Zb + bb.z), X(xf), Y(Zb + bb.z)],
          k: 'b',
          t: `Fb ${f(bb.F, 2)}${vSOn(S) ? ' (structural only)' : ' (not in this case)'}`,
          an: 'start',
          dy: 4,
          pri: 0,
          dash: 1,
        });
      }
    }
    const VG: [string, string, string][] = [
      ['dead', 'W', 'g'],
      ['fdl', 'Wf', 'g'],
      ['fill', 'Ws', 'a'],
      ['sheel', 'Qin', 'q'],
      ['pvs', isG(S) ? 'ΣPav' : 'Pv', 'a'],
      ['pvq', isG(S) ? 'Pav,q' : 'Pvq', 'q'],
      ['water', 'U1v', 'w'],
    ];
    VG.forEach(([ct, id, kk]) => {
      const a = Wv.filter((w) => w.cat === ct);
      const F_ = a.reduce((t, w) => t + w.F, 0);
      if (!(F_ > 1e-9)) return;
      const xa = a.reduce((t, w) => t + w.F * w.arm, 0) / F_;
      const ya = a.reduce((t, w) => t + w.F * (w.y ?? Zb), 0) / F_;
      const ex = !!(c.fa && c.fa[ct] === 0);
      fr.push({
        a: [X(xa), Y(ya + len(F_)), X(xa), Y(ya)],
        k: kk,
        t: `${id} ${f(F_, 2)}${ex ? ' *' : ''}`,
        an: 'middle',
        dy: -6,
        pri: 3,
        op: ex ? 0.35 : 1,
      });
      if (ex) {
        NT.push(
          ct === 'fdl'
            ? '* Wf (fence self-weight) not included in the middle-third case drawn (fence absent governs).'
            : `* ${id} not included in the middle-third case (included for bearing).`,
        );
      }
    });
    const Fu = U.reduce((t, w) => t + w.F, 0);
    if (Fu > 1e-9) {
      const xa = U.reduce((t, w) => t + w.F * w.arm, 0) / Fu;
      fr.push({ a: [X(xa), Y(Zb - len(Fu)), X(xa), Y(Zb)], k: 'u', t: `U ${f(Fu, 2)}`, an: 'middle', dy: 15, pri: 4 });
    }
  }

  fr.sort((p, q2) => p.pri - q2.pri);
  o += fr
    .map(
      (a) =>
        `<line${a.dash ? ' stroke-dasharray="6 3"' : ''} x1="${f(a.a[0], 1)}" y1="${f(a.a[1], 1)}" x2="${f(a.a[2], 1)}" y2="${f(a.a[3], 1)}" stroke="${CL[a.k]}" stroke-width="${a.k === 'r' || a.k === 'x' ? 3 : 2.2}"${a.op != null && a.op < 1 ? ` stroke-opacity="${a.op}"` : ''} marker-end="url(#${FI}mk${a.k})"/>`,
    )
    .join('');

  // Clear horizontal resultant label columns with dotted leaders
  {
    const cR = fr.filter((a) => a.col === 1);
    const cL = fr.filter((a) => a.col === -1);
    if (cR.length) {
      const xc = Math.max(...cR.map((a) => a.a[0]), X(bw + mw * psc)) + 16;
      cR.forEach((a) => {
        o += `<line x1="${f(a.a[0] + 2, 1)}" y1="${f(a.a[1], 1)}" x2="${f(xc - 3, 1)}" y2="${f(a.a[1], 1)}" stroke="${CL[a.k]}" stroke-width=".8" stroke-dasharray="2 2"/>`;
        a.lx = xc;
      });
    }
    if (cL.length) {
      const xc = Math.min(...cL.map((a) => a.a[0]), X(bp - pw * psc)) - 16;
      cL.forEach((a) => {
        o += `<line x1="${f(a.a[0] - 2, 1)}" y1="${f(a.a[1], 1)}" x2="${f(xc + 3, 1)}" y2="${f(a.a[1], 1)}" stroke="${CL[a.k]}" stroke-width=".8" stroke-dasharray="2 2"/>`;
        a.lx = xc;
      });
    }
  }

  // Colour-coded load legend
  let LG = '';
  if (SL_) {
    const used = new Set(fr.map((a) => a.k));
    const LE = (
      [
        ['a', 'Earth / soil'],
        ['q', 'Surcharge'],
        ['w', 'Water'],
        ['p', 'Passive'],
        ['wd', 'Wind'],
        ['b', 'Barrier'],
        ['g', 'Self-weight'],
        ['u', 'Uplift'],
        ['r', 'Resultant R'],
        ['x', 'Resultant R'],
      ] as [string, string][]
    )
      .filter(([k]) => used.has(k))
      .filter((e, _, Arr) => !(e[0] === 'x' && Arr.some((z) => z[0] === 'r')));
    let lx = 12;
    const ly = 33;
    LE.forEach(([k, t]) => {
      const w = t.length * 6.2 + 30;
      LG +=
        `<line x1="${lx}" y1="${ly - 4}" x2="${lx + 18}" y2="${ly - 4}" stroke="${CL[k]}" stroke-width="2.4" marker-end="url(#${FI}mk${k})"/>` +
        tx(lx + 23, ly, t, 'start', 'var(--text-secondary, #334155)', 'lv');
      lx += w;
    });
    if (LE.length) bx.push([8, ly - 12, lx, ly + 5]);
  }

  o +=
    LG +
    lb.map((l) => put(l[0], l[1], l[2], l[3], l[4], l[5], l[6])).join('') +
    fr
      .map((a) =>
        a.lx != null
          ? put(a.lx + (a.col! > 0 ? 2 : -2), a.a[1] + 4, a.t, a.col! > 0 ? 'start' : 'end', CL[a.k])
          : put(a.a[0] + (a.an === 'start' ? 5 : a.an === 'end' ? -5 : 0), a.a[1] + a.dy, a.t, a.an, CL[a.k]),
      )
      .join('');

  // ALL ~20+ Interactive Drag Handles (exact v14.0.1 lines 1391-1422)
  if (SH_) {
    const n = S.st.length;
    const hm = (Zb + bt) / 2;
    const hb = bt - Zb;
    const add = (
      p: string,
      ax: 'x' | 'z',
      k: 1 | -1,
      v: number,
      x: number,
      z: number,
      o2: Partial<FigureHandle> & { lab: string },
    ) => HD.push({ p, ax, k, v: +v, x, z, anc: 'toe', min: -1e9, max: 1e9, d: 2, ...o2 });

    if (S.bon) add('@H', 'z', 1, Hr - Zb, Math.min(xr - 0.6, B + 0.7), Hr, { min: +S.tb + 0.3, max: +(top - Zb).toFixed(3), lab: 'Retained ground level' });
    if (n) add('st.0.top', 'z', 1, top, xl + 1.1, top, { min: +S.st[0].bot, lab: 'Wall top' });
    const fo = !isG(S);
    if (S.ty !== 'L' && fo) add('Lt', 'x', -1, +S.Lt, 0, hm, { anc: 'xb', min: 0, lab: 'Toe (base front end)' });
    if (S.ty !== 'Li' && fo) add('Lh', 'x', 1, +S.Lh, B, hm, { min: 0, lab: 'Heel (base back end)' });
    add('tb', 'z', 1, +S.tb, hl > 0.3 ? (xb + B) / 2 : Lt > 0.3 ? Lt / 2 : xb - 0.15, bt, {
      min: 0.2,
      max: n ? +S.st[n - 1].top - 0.2 : 1e9,
      lab: isG(S) ? 'Block height' : 'Base t',
    });
    if (isG(S)) {
      const bf = gbf_;
      const br = gbr_;
      const bw0 = +S.gBt;
      add('gbf', 'x', -1, bf, 0, Zb + 0.12 * hb, { anc: 'xb', min: 0, lab: 'Block front batter (toe moves)' });
      add('gbr', 'x', 1, br, B, Zb + 0.12 * hb, { min: 0, lab: 'Block rear batter (heel moves)' });
      add('@gtf', 'x', 1, bf, gtx_, bt - 0.12 * hb, { min: 0, max: bf + bw0 - 0.1, lab: 'Block top front edge (front batter)' });
      add('@gtb', 'x', -1, br, B - br, bt - 0.12 * hb, { min: 0, max: br + bw0 - 0.1, lab: 'Block top back edge (rear batter)' });
    }
    c.G.SG.forEach((sg) => {
      const i = sg.i;
      const N = `Stem ${i + 1}`;
      const bot = !isG(S) && i === n - 1;
      const sup = i < n - 1 ? c.G.SG[i + 1] : null;
      const a = sup ? sup.xf1 : isG(S) ? gtx_ : 0;
      const b = sup ? sup.xb1 : isG(S) ? gtx_ + +S.gBt : B;
      if (i < n - 1) add(`st.${i}.bot`, 'z', 1, sg.bot, xl + 1.1, sg.bot, { min: +S.st[i + 1].bot, max: sg.top, lab: `${N} bottom (joint)` });
      if (!(sg.h > 0.05)) return;
      const z1 = sg.bot + 0.5 * sg.h;
      const fz = (z: number) => (z - sg.bot) / sg.h;
      add('@tf.' + i, 'x', -1, sg.t, sg.xf0 + sg.fb * fz(z1), z1, {
        anc: bot && S.ty === 'L' ? 'xb' : 'toe',
        min: Math.max(0.1, sg.fb + sg.rb + 0.05),
        max: bot ? (S.ty === 'L' ? 1e9 : sg.t + +S.Lt) : sg.t + Math.max(0, sg.xf0 - a),
        lab: `${N} front face (width)`,
      });
      add('@tw.' + i, 'x', 1, sg.t, sg.xb0 - sg.rb * fz(z1), z1, {
        min: Math.max(0.1, sg.fb + sg.rb + 0.05),
        max: bot ? (S.ty === 'Li' ? 1e9 : sg.t + +S.Lh) : Math.max(0.1, b - sg.xf0),
        lab: `${N} back face (width)`,
      });
      add(`st.${i}.fb`, 'x', 1, sg.fb, sg.xf1, sg.top - Math.min(0.08, sg.h / 8), { min: 0, max: Math.max(0, sg.t - sg.rb - 0.05), lab: `${N} front batter` });
      add(`st.${i}.rb`, 'x', -1, sg.rb, sg.xb1, sg.top - Math.min(0.08, sg.h / 8), { min: 0, max: Math.max(0, sg.t - sg.fb - 0.05), lab: `${N} rear batter` });
      const zc = sg.bot + 0.3 * sg.h;
      if (bot) {
        if (S.ty === 'T') add('@mv', 'x', 1, +S.Lt, sg.xc, zc, { min: 0, max: +S.Lt + +S.Lh, lab: `${N} position (toe ↔ heel)` });
      } else {
        add(`st.${i}.of`, 'x', 1, +sg.s.of || 0, sg.xc, sg.bot + 0.15 * sg.h, { min: 0, max: Math.max(0, b - a - sg.t), lab: `${N} position (front offset)` });
      }
    });
    XS.forEach((a, j) => {
      const nx = j < XS.length - 1 ? XS[j + 1].x0 : Lt;
      const pv = j > 0 ? XS[j - 1].x1 : 0;
      const N = `Stem on base ${j + 1}`;
      add(`xs.${j}.x`, 'x', 1, a.x0, a.xc, a.bot + 0.3 * a.h, { min: +pv.toFixed(3), max: +Math.max(pv, nx - a.t).toFixed(3), lab: `${N} position x (from toe)` });
      add(`xs.${j}.t`, 'x', 1, a.t, a.x1, a.bot + 0.5 * a.h, { min: 0.15, max: +Math.max(0.15, nx - a.x0).toFixed(3), lab: `${N} width t (back face)` });
      add(`xs.${j}.h`, 'z', 1, a.h, a.xc, a.bot + a.h, { min: 0.3, max: +Math.max(0.3, top - bt).toFixed(3), lab: `${N}${a.segs.length > 1 ? ' segment 1' : ''} height h` });
      a.segs.slice(1).forEach((sg) => {
        add(`${sg.p}.h`, 'z', 1, sg.h, sg.x0 + sg.t / 2, sg.top, { min: 0.2, max: +Math.max(0.2, top - sg.bot).toFixed(3), lab: `${N} segment ${sg.k + 1} height` });
        add(`${sg.p}.t`, 'x', isU(S) ? -1 : 1, sg.t, isU(S) ? sg.x0 : sg.x1, sg.bot + 0.5 * sg.h, { min: 0.15, max: 3, lab: `${N} segment ${sg.k + 1} width` });
      });
      if (!C.UU && a.zt > bt + 1e-6) {
        const xe = j < XS.length - 1 ? XS[j + 1].x0 : pX(c.G.frM, a.zt);
        add(`xs.${j}.zt`, 'z', 1, a.zt, (a.x1 + xe) / 2, a.zt, { min: +bt.toFixed(3), max: +a.top.toFixed(3), lab: `Terrace ${j + 1} level` });
      }
    });
    if (S.bon && +S.br > 0 && +S.brL > 0) {
      const xb0 = pXl(c.G.bk, Hr);
      add('brL', 'x', 1, +S.brL, xb0 + +S.brL, Hr + +S.brL * Math.tan(+S.br * R), { min: 0.2, lab: 'Backslope length L_b' });
    }
    if (S.bon) add('@WL', 'z', 1, C.wb > 0 ? C.Wb : Zb, xr - 1.1, C.wb > 0 ? C.Wb : Zb, { min: Zb, max: Hr, lab: 'Design WL' });
    if (S.fon) add('fw', 'z', 1, +S.fw, xl + 1.1, Math.max(+S.fw, Zb - 0.3), { max: Hf, lab: 'Front GWL' });
    if (Hf > Zb || S.fon) add('@Df', 'z', 1, Hf - Zb, xl + 2, Hf, { min: 0, lab: 'Front soil Df' });
    if (KG && KG.dk > 0) {
      add('skd', 'z', -1, KG.dk, KG.xk + KG.Bk / 2, Zb - KG.dk, { min: 0.1, lab: 'Key depth' });
      add('skx', 'x', 1, KG.xk, KG.xk, Zb - KG.dk / 2, { min: 0, max: B - KG.Bk, lab: 'Key position' });
    }
    if (S.wo) add('wh', 'z', 1, wh, fxc, top + wh, { min: 0.1, lab: 'Fence height' });
    if (C.LL && S.bon) {
      const xq = planeX(c.G) + C.LL.x;
      add('lx', 'x', 1, C.LL.x, xq, Hr + (S.bon ? Math.tan(S.br * R) * (xq - xbH) : 0), { min: 0, lab: 'Line load x' });
    }
    o += HD.map(
      (h, i) =>
        `<g class="hd ${h.ax}" data-h="${i}"><title>${h.lab} = ${dd(h.v)}${h.p === '@WL' || h.p === 'fw' || /\.(top|bot|zt)$/.test(h.p) ? ' mPD' : ' m'} – drag to change (Alt = fine 0.01 m)</title><circle cx="${f(X(h.x), 1)}" cy="${f(Y(h.z), 1)}" r="11" fill="transparent"/><circle class="hk" cx="${f(X(h.x), 1)}" cy="${f(Y(h.z), 1)}" r="5.5"/></g>`,
    ).join('');
  }

  const cap =
    MD === 'geo'
      ? `${NE ? 'Figure 1 – Cross-section and levels' : 'Cross-section'} · dimensions in m, levels in mPD${NE ? '' : ' · blue boxes editable · drag ● handles'}`
      : MD === 'load'
        ? `${NE ? 'Figure 2 – ' : ''}Characteristic loads (kN/m) and base pressure (kPa), governing middle-third case (Section 6) · arrow length ∝ force`
        : `Dimensions m, levels mPD, loads kN/m (characteristic, governing middle-third case) · arrow length ∝ force${NE ? '' : ' · blue boxes editable · drag ● handles'}`;

  if (SL_) {
    NT.push(
      isG(S)
        ? `GG1 Fig. 39 components on the back of the wall: ΣPah, ΣPah,q = horizontal component of active thrust; ΣPav, Pav,q = vertical component; U1h = water on the back (Ka ${C.P.kaLab} = ${f(C.P.Ka ?? 0, 3)}, Kah = ${f(K, 3)}${pas ? `, Kp = ${f(C.P.Kp, 3)}` : ''}); W = concrete, Ws = soil resting on the wall, U = uplift (U2), R = resultant at base.`
        : `ΣPq, ΣPa = active thrust from surcharge and soil, Pw = water (Ka ${C.P.kaLab} = ${f(C.P.Ka ?? 0, 3)}, Kah = ${f(K, 3)}${pas ? `, Kp = ${f(C.P.Kp, 3)}` : ''}); W = concrete, Ws = soil on base, Pv = vertical component of earth pressure, U = uplift, R = resultant at base.`,
    );
    if (L) NT.push(`${L.cat === 'wind' ? 'Fw = fence wind' : 'Fb = barrier load'} – governing wall-top load case.`);
    if (FBx) {
      NT.push(
        vSOn(S)
          ? `Fb (dashed) = vehicle impact ${f(FBx.F, 2)} kN/m at +${f(+S.Zb + FBx.z)} mPD – structural design only.`
          : `Fb (dashed) = barrier load ${f(FBx.F, 2)} kN/m.`,
      );
    }
    if (C.qi > 0) NT.push('Qin / q_in = surcharge on heel side – used for bearing and RC design only.');
  }

  const svgHtml = o + tx(12, 17, cap, 'start', null, 'cap') + '</svg>';
  const notesHtml =
    NM.length + NT.length
      ? `<ul class="fgn">${NM.map((t, i) => `<li data-n="${SY[i] || i + 1}">${t}</li>`).join('')}${NT.map((t) => `<li data-n="–">${t}</li>`).join('')}</ul>`
      : '';

  return {
    svgHtml,
    notesHtml,
    handles: HD,
    viewMeta: { xl, y0, s: s0, xb, W, H },
  };
}
