/**
 * Offline AutoCAD ASCII DXF parser, view clusterer, level datum fitter,
 * candidate extractor, keyword guesser, and bay-to-model builder (v12.2).
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { syncState } from './helpers';
import { dd, f } from './math';
import { applyWallType } from './stateOps';
import type {
  DwgState,
  DxfCandidates,
  DxfDimItem,
  DxfEntity,
  DxfExtracted,
  DxfGeomItem,
  DxfGuessBay,
  DxfGuessResult,
  DxfInsert,
  DxfParsed,
  DxfTextItem,
  DxfView,
  Point2D,
  WallState,
} from './types';

export const DXLV = /^[+\-]\d{1,3}\.\d{2,3}$/;

export function dxParse(buf: ArrayBuffer | Uint8Array): DxfParsed {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let txt = new TextDecoder('utf-8').decode(bytes);
  const ver = (txt.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/) || [])[1] || '';
  if (ver && ver < 'AC1021') {
    const cp = (txt.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*(\S+)/) || [])[1] || '';
    const enc = /936/.test(cp) ? 'gbk' : /950/.test(cp) ? 'big5' : 'windows-1252';
    try {
      txt = new TextDecoder(enc).decode(bytes);
    } catch {
      // keep utf-8 fallback
    }
  }
  if (!/\bSECTION\b/.test(txt.slice(0, 2000)) || !/ENTITIES/.test(txt)) {
    throw new Error('not an ASCII DXF file (save as “AutoCAD 2013 DXF”, ASCII)');
  }
  const u = +((txt.match(/\$INSUNITS\s*\r?\n\s*70\s*\r?\n\s*(\d+)/) || [])[1] || 0);
  const L = txt.split(/\r?\n/);
  const E: DxfEntity[] = [];
  let sec = '';
  let cur: DxfEntity | null = null;
  for (let i = 0; i + 1 < L.length; i += 2) {
    const c = L[i].trim();
    const v = L[i + 1];
    if (c === '0') {
      const w = v.trim();
      if (w === 'SECTION') {
        sec = '?';
        cur = null;
        continue;
      }
      if (w === 'ENDSEC') {
        sec = '';
        cur = null;
        continue;
      }
      cur = sec === 'ENTITIES' ? { t: w, g: [] } : null;
      if (cur) E.push(cur);
      continue;
    }
    if (c === '2' && sec === '?') {
      sec = v.trim();
      continue;
    }
    if (cur) cur.g.push([+c, v]);
  }
  return { ver, k: u === 6 ? 1 : u === 5 ? 0.01 : u === 1 ? 0.0254 : 0.001, E };
}

export const dxG = (e: DxfEntity, c: number): string | null => {
  for (const [k, v] of e.g) if (k === c) return v;
  return null;
};

export const dxN = (e: DxfEntity, c: number, d = 0): number => {
  const v = dxG(e, c);
  return v == null || v.trim() === '' ? d : +v;
};

export const dxClean = (s: unknown): string =>
  String(s ?? '')
    .replace(/\\P/g, '\n')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\[A-Za-z][^;\\]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/%%[uUoO]/g, '')
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°')
    .replace(/%%p/gi, '±')
    .trim();

export function dxExtract(P: DxfParsed): DxfExtracted {
  const T: DxfTextItem[] = [];
  const Dm: DxfDimItem[] = [];
  const Gm: DxfGeomItem[] = [];
  const I: DxfInsert[] = [];
  let ins: DxfInsert | null = null;

  for (const e of P.E) {
    const t = e.t;
    if (t === 'INSERT') {
      ins = { x: dxN(e, 10), y: dxN(e, 20), b: dxG(e, 2) || '' };
      I.push(ins);
      continue;
    }
    if (t === 'SEQEND') {
      ins = null;
      continue;
    }
    if (t === 'TEXT' || t === 'ATTRIB' || t === 'MTEXT') {
      const raw =
        t === 'MTEXT'
          ? e.g
              .filter(([k]) => k === 3)
              .map((x) => x[1])
              .join('') + (dxG(e, 1) || '')
          : dxG(e, 1) || '';
      const s = dxClean(raw);
      if (t === 'ATTRIB' && ins && s) ins.att = 1;
      if (!s) continue;
      T.push({
        s,
        x: dxN(e, 10),
        y: dxN(e, 20),
        h: dxN(e, 40, 250),
        ly: dxG(e, 8) || '',
        ins: t === 'ATTRIB' && ins ? ins : null,
      });
      continue;
    }
    if (t === 'DIMENSION') {
      const ty = dxN(e, 70) & 7;
      if (ty > 1) continue;
      const x1 = dxN(e, 13);
      const y1 = dxN(e, 23);
      const x2 = dxN(e, 14);
      const y2 = dxN(e, 24);
      const r = dxN(e, 50, 0);
      const m = dxN(e, 42, NaN);
      const dir: 'h' | 'v' =
        ty === 1
          ? Math.abs(x2 - x1) >= Math.abs(y2 - y1)
            ? 'h'
            : 'v'
          : Math.abs(Math.sin((r * Math.PI) / 180)) > 0.7
            ? 'v'
            : 'h';
      const meas = Number.isFinite(m) ? m : dir === 'h' ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
      const raw = dxClean(dxG(e, 1) || '');
      const shown = raw ? raw.replace('<>', String(Math.round(meas))) : String(Math.round(meas));
      const num = +((shown.match(/-?\d+(?:\.\d+)?/g) || []).pop() ?? NaN);
      Dm.push({
        v: meas,
        dir,
        x1,
        y1,
        x2,
        y2,
        tx: dxN(e, 11, (x1 + x2) / 2),
        ty: dxN(e, 21, (y1 + y2) / 2),
        txt: shown.replace(/\n/g, ' '),
        ov:
          raw &&
          !raw.includes('<>') &&
          /^\s*(MAX\.?|MIN\.?)?\s*\d+(\.\d+)?\s*(mm)?\s*$/i.test(raw) &&
          Number.isFinite(num)
            ? num
            : null,
        ly: dxG(e, 8) || '',
      });
      continue;
    }
    if (t === 'LINE') {
      Gm.push({
        k: 'l',
        p: [
          [dxN(e, 10), dxN(e, 20)],
          [dxN(e, 11), dxN(e, 21)],
        ],
      });
      continue;
    }
    if (t === 'LWPOLYLINE') {
      const xs = e.g.filter(([k]) => k === 10).map((x) => +x[1]);
      const ys = e.g.filter(([k]) => k === 20).map((x) => +x[1]);
      if (xs.length > 1) Gm.push({ k: 'l', p: xs.map((x, i): Point2D => [x, ys[i]]), c: dxN(e, 70) & 1 });
      continue;
    }
    if (t === 'CIRCLE' || t === 'ARC') {
      Gm.push({
        k: t === 'CIRCLE' ? 'c' : 'a',
        x: dxN(e, 10),
        y: dxN(e, 20),
        r: dxN(e, 40),
        a0: dxN(e, 50, 0),
        a1: dxN(e, 51, 360),
      });
    }
  }
  return { T, Dm, Gm, I };
}

export function dxViews(X: DxfExtracted): DxfView[] {
  const pts: [number, number, 't' | 'd' | 'g', number][] = [];
  X.T.forEach((t, i) => pts.push([t.x, t.y, 't', i]));
  X.Dm.forEach((d, i) => {
    pts.push([d.x1, d.y1, 'd', i], [d.x2, d.y2, 'd', i], [d.tx, d.ty, 'd', i]);
  });
  X.Gm.forEach((g, i) => {
    if (g.k === 'l') g.p.forEach((q) => pts.push([q[0], q[1], 'g', i]));
    else pts.push([g.x, g.y, 'g', i]);
  });

  const hs = X.T.map((t) => t.h)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  const R = Math.max(1500, 10 * (hs[hs.length >> 1] || 300));
  const par = pts.map((_, i) => i);
  const fd = (i: number) => {
    while (par[i] !== i) i = par[i] = par[par[i]];
    return i;
  };
  const H = new Map<string, number[]>();
  const key = (x: number, y: number) => Math.floor(x / R) + ',' + Math.floor(y / R);
  pts.forEach((p, i) => {
    const k = key(p[0], p[1]);
    if (!H.has(k)) H.set(k, []);
    H.get(k)!.push(i);
  });
  pts.forEach((p, i) => {
    const cx = Math.floor(p[0] / R);
    const cy = Math.floor(p[1] / R);
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        for (const j of H.get(cx + a + ',' + (cy + b)) || []) {
          if (j < i && Math.hypot(pts[j][0] - p[0], pts[j][1] - p[1]) <= R) {
            par[fd(i)] = fd(j);
          }
        }
      }
    }
  });
  const first: Record<string, number> = {};
  pts.forEach((p, i) => {
    const k = p[2] + p[3];
    if (first[k] == null) first[k] = i;
    else par[fd(i)] = fd(first[k]);
  });

  const G = new Map<
    number,
    { x0: number; y0: number; x1: number; y1: number; T: Set<number>; D: Set<number>; G: Set<number> }
  >();
  pts.forEach((p, i) => {
    const r = fd(i);
    if (!G.has(r)) {
      G.set(r, { x0: 1e18, y0: 1e18, x1: -1e18, y1: -1e18, T: new Set(), D: new Set(), G: new Set() });
    }
    const v = G.get(r)!;
    v.x0 = Math.min(v.x0, p[0]);
    v.y0 = Math.min(v.y0, p[1]);
    v.x1 = Math.max(v.x1, p[0]);
    v.y1 = Math.max(v.y1, p[1]);
    v[p[2] === 't' ? 'T' : p[2] === 'd' ? 'D' : 'G'].add(p[3]);
  });

  const V: DxfView[] = [...G.values()]
    .filter((v) => v.T.size + v.D.size >= 3)
    .map((v) => ({
      id: 0,
      x0: v.x0,
      y0: v.y0,
      x1: v.x1,
      y1: v.y1,
      T: [...v.T],
      D: [...v.D],
      G: [...v.G],
      title: '',
      type: 'other' as DxfView['type'],
    }))
    .sort((a, b) => b.y1 - a.y1);

  V.forEach((v, i) => {
    const tt = v.T.map((j) => X.T[j]).sort((a, b) => b.h - a.h);
    const ti = tt.find((t) => /ELEVATION|SECTION|DETAIL|PLAN|LAYOUT/i.test(t.s));
    v.title = (ti || tt[0] || { s: 'View ' + (i + 1) }).s.replace(/\n/g, ' ');
    v.type = /ELEVATION/i.test(v.title)
      ? 'elevation'
      : /SECTION|DETAIL/i.test(v.title)
        ? 'section'
        : /PLAN|LAYOUT/i.test(v.title)
          ? 'plan'
          : 'other';
    v.id = i;
  });
  return V;
}

export function dxCands(X: DxfExtracted, V: DxfView[]): DxfCandidates {
  const k = X.k ?? 0.001;
  const C: DxfCandidates = { lv: [], dm: [] };

  for (const v of V) {
    if (v.type === 'ignore' || v.type === 'plan') continue;
    const tags: {
      z: number;
      x: number;
      y: number;
      q: 'text' | 'tag';
      t: DxfTextItem;
      j: number;
      axis?: number;
    }[] = [];

    for (const j of v.T) {
      const t = X.T[j];
      const s = t.s.replace(/\s*m?PD$/i, '').trim();
      if (!DXLV.test(s)) continue;
      let ax = t.x;
      let ay = t.y + t.h / 2;
      let q: 'text' | 'tag' = 'text';
      if (t.ins && Math.hypot(t.ins.x - t.x, t.ins.y - t.y) < 6 * t.h) {
        ax = t.ins.x;
        ay = t.ins.y;
        q = 'tag';
      } else {
        const n = X.I.filter(
          (I) => !I.att && I.y <= t.y + t.h && t.y - I.y < 4 * t.h && Math.abs(I.x - t.x) < 8 * t.h,
        ).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
        if (n) {
          ax = n.x;
          ay = n.y;
          q = 'tag';
        }
      }
      tags.push({ z: +s, x: ax, y: ay, q, t, j });
    }

    const byX: Record<number, typeof tags> = {};
    tags.forEach((g) => {
      const kx = Math.round(g.t.x / (2 * g.t.h));
      (byX[kx] = byX[kx] || []).push(g);
    });
    Object.values(byX).forEach((a) => {
      if (a.length >= 3) a.forEach((g) => { g.axis = 1; });
    });

    const an = tags.filter((g) => g.q === 'tag' && !g.axis);
    const base = an.length ? an : tags.filter((g) => g.axis);
    const sl = k;
    let c: number | null = null;
    if (base.length) {
      const cs = base.map((g) => g.z - sl * g.y).sort((a, b) => a - b);
      c = cs[cs.length >> 1];
    }
    v.dat = c == null ? null : { c, s: sl };

    tags.forEach((g) => {
      const res = c == null ? 0 : g.z - (c + sl * g.y);
      if (Math.abs(res) > 0.02 && g.q === 'tag' && !g.axis) {
        C.bad = (C.bad || []).concat([
          `Level tag ${g.t.s} (${v.title}) does not match the drawing geometry by ${f(res, 3)} m`,
        ]);
      }
      if (!g.axis) {
        C.lv.push({
          z: g.z,
          x: g.x,
          y: g.y,
          v: v.id,
          src: g.q === 'tag' ? 'level tag' : 'level text',
          ti: g.j,
        });
      }
    });

    for (const j of v.D) {
      const d = X.Dm[j];
      const val = d.v * k;
      C.dm.push({ v: +val.toFixed(4), dir: d.dir, x: d.tx, y: d.ty, v_: v.id, j, txt: d.txt, ov: d.ov });
      if (d.ov != null && Math.abs(d.ov - d.v) > 0.5) {
        C.bad = (C.bad || []).concat([
          `Dimension text “${d.txt}” (${v.title}) ≠ measured ${f(d.v, 0)} – text overridden`,
        ]);
      }
      if (d.dir === 'v' && v.dat) {
        for (const [y] of [
          [d.y1, 'end 1'],
          [d.y2, 'end 2'],
        ] as [number, string][]) {
          const z = +(v.dat.c + v.dat.s * y).toFixed(3);
          const o = d.y1 === y ? d.y2 : d.y1;
          C.lv.push({
            z,
            x: d.x1,
            y,
            v: v.id,
            src: `dim ${d.txt} ${y < o ? 'lower' : 'upper'} end`,
            dj: j,
            dz: +(v.dat.c + v.dat.s * o).toFixed(3),
          });
        }
      }
    }
  }
  return C;
}

export function dxNear(
  X: DxfExtracted,
  V: DxfView[],
  c: { v?: number; v_?: number; x: number; y: number },
  re: RegExp,
): number {
  const v = V[(c.v ?? c.v_)!];
  if (!v) return 1e18;
  let b = 1e18;
  for (const j of v.T) {
    const t = X.T[j];
    if (re.test(t.s) && !DXLV.test(t.s)) {
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      if (d < b) b = d;
    }
  }
  return b;
}

export function dxGuess(X: DxfExtracted, V: DxfView[], C: DxfCandidates): DxfGuessResult {
  const out: DxfGuessResult = { bays: [] };
  const near = (c: { v?: number; v_?: number; x: number; y: number }, re: RegExp) => dxNear(X, V, c, re);
  const ht = (() => {
    const h = X.T.map((t) => t.h).sort((a, b) => a - b);
    return h[h.length >> 1] || 300;
  })();
  const R1 = 12 * ht;
  const pickLv = (re: RegExp, fil?: (c: DxfCandidates['lv'][number]) => boolean) => {
    let best: { i: number; d: number } | null = null;
    C.lv.forEach((c, i) => {
      if (fil && !fil(c)) return;
      const d = near(c, re);
      if (d < R1 && (!best || d < best.d)) best = { i, d };
    });
    return best as { i: number; d: number } | null;
  };

  let g: { i: number } | null = null;
  {
    const i = C.lv.findIndex((c) => c.ti != null && /GWL|WATER/i.test((X.T[c.ti] || {}).ly || ''));
    if (i >= 0) g = { i };
  }
  if (!g) g = pickLv(/G\.?\s?W\.?\s?L|WATER/i);
  if (g) out.gwl = { c: g.i, conf: 'high' };

  g = pickLv(
    /EXIST\w*\s+GROUND|E\.?G\.?L|GROUND\s+LEVEL|FRONT/i,
    (c) => !out.gwl || Math.abs(c.z - C.lv[out.gwl.c].z) > 1e-6,
  );
  if (g) out.Hf = { c: g.i, conf: 'high' };

  g = pickLv(/SITE\s+FORMATION|TOP\s+OF\s+(MASS|WALL)|T\.?O\.?W\b/i);
  if (g) out.top = { c: g.i, conf: 'high' };

  const zHf = out.Hf ? C.lv[out.Hf.c].z : Infinity;
  const zTop = out.top ? C.lv[out.top.c].z : null;
  const zi = C.lv.findIndex(
    (c) => /lower end/.test(c.src) && V[c.v].type === 'section' && zTop != null && Math.abs((c.dz ?? 0) - zTop) < 0.005,
  );
  if (zi >= 0) out.Zb = { c: zi, conf: 'high' };
  else {
    const lo = C.lv.map((c, i) => [c, i] as const)
      .filter(
        ([c]) =>
          c.z < zHf - 1e-6 &&
          c.src !== 'level text' &&
          !(out.gwl && Math.abs(c.z - C.lv[out.gwl.c].z) < 1e-6),
      )
      .sort((a, b) => a[0].z - b[0].z)[0];
    if (lo) out.Zb = { c: lo[1], conf: 'med' };
  }
  if (!out.top) {
    const up = C.lv.map((c, i) => [c, i] as const)
      .filter(([c]) => /upper end/.test(c.src) && V[c.v].type === 'section')
      .sort((a, b) => Math.abs(b[0].z - (b[0].dz ?? 0)) - Math.abs(a[0].z - (a[0].dz ?? 0)))[0];
    if (up) out.top = { c: up[1], conf: 'med' };
  }
  if (out.top && out.Zb && !/lower end/.test(C.lv[out.Zb.c].src)) {
    const h = C.lv[out.top.c].z - C.lv[out.Zb.c].z;
    if (C.dm.some((d) => d.dir === 'v' && Math.abs(d.v - h) < 0.005)) out.Zb.conf = 'high';
  }
  const hs = C.dm.map((d, i) => [d, i] as const)
    .filter(([d]) => d.dir === 'h' && V[d.v_].type === 'section')
    .sort((a, b) => b[0].v - a[0].v);
  if (hs.length) out.B = { c: hs[0][1], conf: hs.length === 1 ? 'high' : 'med' };

  const ev = V.find((v) => v.type === 'elevation');
  const bays: DxfGuessBay[] = [];
  if (ev) {
    const bd = ev.D.map((j) => X.Dm[j])
      .filter((d) => /BAY\s*\d/i.test(d.txt))
      .map((d) => ({
        n: (d.txt.match(/BAY\s*\d+/i) || ['Bay'])[0].replace(/bay/i, 'Bay'),
        a: Math.min(d.x1, d.x2),
        b: Math.max(d.x1, d.x2),
      }))
      .sort((p, q) => p.a - q.a);
    const B0 = bd.length ? bd : [{ n: 'Bay 1', a: ev.x0, b: ev.x1 }];
    B0[0].a = ev.x0;
    B0[B0.length - 1].b = ev.x1;
    const used = new Set(
      (['Zb', 'Hf', 'top', 'gwl'] as const)
        .filter((k) => out[k])
        .map((k) => C.lv[out[k]!.c].z.toFixed(3)),
    );
    for (const by of B0) {
      const inB = (x: number) => x >= by.a - 1 && x <= by.b + 1;
      const tx = (re: RegExp) => ev.T.some((j) => inB(X.T[j].x) && re.test(X.T[j].s));
      const L = C.lv.map((c, i) => [c, i] as const)
        .filter(([c]) => c.v === ev.id && inB(c.x) && c.src === 'level tag' && !used.has(c.z.toFixed(3)))
        .sort((p, q) => q[0].z - p[0].z);
      const par = tx(/PARAPET/i);
      const kerb = !par && tx(/KERB|PLANTER/i);
      const fence = tx(/FENCE/i);
      const bar = tx(/BARRIER/i);
      const o: DxfGuessBay = {
        name: by.n,
        tt: par ? 'parapet' : kerb ? 'kerb' : 'none',
        fh: { v: 0, conf: 'high' },
        bar: bar || par ? '' : 'none',
      };
      if (par && L.length) {
        o.stTop = { c: L[0][1], conf: 'med' };
        if (L[1]) o.Hr = { c: L[1][1], conf: 'med' };
      } else if (L.length) o.Hr = { c: L[0][1], conf: 'med' };
      if (kerb && o.Hr) {
        const zr = C.lv[o.Hr.c].z;
        const ki = C.lv.findIndex(
          (c) =>
            c.v === ev.id &&
            /upper end/.test(c.src) &&
            zTop != null &&
            Math.abs((c.dz ?? 0) - zTop) < 0.005 &&
            inB(c.x),
        );
        o.stTop =
          ki >= 0
            ? { c: ki, conf: Math.abs(C.lv[ki].z - zr) < 0.005 ? 'high' : 'med' }
            : { c: o.Hr.c, conf: 'med' };
      }
      const zS = o.stTop ? C.lv[o.stTop.c].z : null;
      const fd =
        zS == null
          ? null
          : ev.D.map((j) => X.Dm[j]).find(
              (d) =>
                d.dir === 'v' &&
                inB(d.x1) &&
                ev.dat &&
                [d.y1, d.y2].some((y) => Math.abs(ev.dat!.c + ev.dat!.s * y - zS) < 0.005) &&
                Math.max(ev.dat.c + ev.dat.s * d.y1, ev.dat.c + ev.dat.s * d.y2) > zS + 0.01,
            );
      o.fh = fd
        ? { v: +(fd.v * (X.k ?? 0.001)).toFixed(3), conf: /MAX|FENCE/i.test(fd.txt) ? 'high' : 'med', txt: fd.txt }
        : fence
          ? { v: '', conf: 'missing' }
          : { v: 0, conf: 'high' };
      bays.push(o);
    }
  }
  out.bays = bays;
  return out;
}

/** Pure port of dwBuild(i): build gravity wall state from a confirmed DXF bay */
export function buildModelFromDxfBay(
  baseState: WallState,
  D: DwgState,
  bayIndex: number,
): { ok: true; state: WallState } | { ok: false; error: string } {
  const b = D.bays[bayIndex];
  const g = (k: string): number | null => {
    const p = D.picks[k];
    return p && p.v !== '' && p.v != null && Number.isFinite(+p.v) ? +p.v : null;
  };
  const Zb = g('Zb');
  const Hf = g('Hf');
  const top = g('top');
  const B = g('B');
  const gw = g('gwl');
  const Hr = g(`b${bayIndex}.Hr`);
  const sT = g(`b${bayIndex}.stTop`);
  const vf = g(`b${bayIndex}.vfz`);

  if (Zb == null || Hf == null || top == null || B == null || Hr == null) {
    return { ok: false, error: 'Missing required drawing levels or wall width B' };
  }
  if (!(top > Zb + 0.2)) return { ok: false, error: 'Wall top must be above the founding level' };
  const zTop = b.tt !== 'none' ? sT! : top;
  if (Hr > zTop + 1e-6) {
    return {
      ok: false,
      error: `${b.name}: retained level +${dd(Hr)} is above the wall / kerb top +${dd(zTop)} – add a kerb / parapet`,
    };
  }
  if (b.tt !== 'none' && !(sT != null && sT > top)) {
    return { ok: false, error: 'Kerb / parapet top must be above the wall top' };
  }

  const S = structuredClone(baseState);
  const Dcopy = structuredClone(D);
  if (Dcopy.pn0 == null) Dcopy.pn0 = S.pn || '';
  if (S.ty !== 'G') applyWallType(S, 'G');
  const r3 = (x: number) => +(+x).toFixed(3);

  Object.assign(S, {
    Zb: r3(Zb),
    gBh: r3(top - Zb),
    tb: r3(top - Zb),
    gBt: r3(B),
    gbf: 0,
    gbr: 0,
    Hr: r3(Hr),
    Hf: r3(Hf),
    bon: 1,
  });
  S.st =
    b.tt === 'none'
      ? []
      : [{ t: +b.stT > 0 ? +b.stT : 0.3, fb: 0, rb: 0, of: 0, top: r3(sT!), bot: r3(top), rc: b.rc ? 1 : 0 }];
  if (gw != null) {
    S.wl = 'c';
    S.wlZ = r3(Math.max(Zb, Math.min(gw, Hr)));
    S.fw = r3(Math.min(gw, Hf));
  }
  S.wo = +b.fh > 0 ? 1 : 0;
  if (S.wo) {
    S.wh = +b.fh;
    S.wsd = +b.sol > 0 ? +b.sol : 0.6;
    S.wsdb = ({ g: 'grille', m: 'mesh', s: 'solid' } as Record<string, string>)[b.ft] || 'custom';
  } else S.wsdb = '';
  if (b.bar === 'none') S.bro = 0;
  else if (b.bar === 'ped') {
    S.bro = 1;
    S.brc = '1.5';
  } else {
    S.bro = 1;
    S.brc = b.bar;
    S.vStem = S.st.length ? 1 : 0;
    if (vf != null && Math.abs(vf - Hr) > 1e-6) {
      S.vFl = 'c';
      S.vFz = vf;
    } else S.vFl = 'r';
  }
  S.flim = Dcopy.flim ? 1 : 0;
  if (Dcopy.pn0) S.pn = Dcopy.pn0;
  Dcopy.built = bayIndex;
  delete Dcopy.figs;
  S.dwg = Dcopy;
  syncState(S);
  return { ok: true, state: S };
}
