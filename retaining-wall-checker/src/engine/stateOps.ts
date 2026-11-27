/**
 * State operations: wall type switching, default designs, figure virtual-parameter editing,
 * linked levels, .rwall multi-wall-type project serialization, and Setup Wizard builder.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { DEFAULT_STATE, DFLT, MODEL_VERSION, PJF } from './constants';
import { geo, stemGeo } from './geometry';
import { fillDef, isG, isU, isVeh, syncState } from './helpers';
import { dd, f } from './math';
import type { ProjectFile, ProjectMeta, WallState, WallType, WallTypeEntry } from './types';

export const uid = (): string => Math.random().toString(36).slice(2, 9);

export function gp(S: WallState, p: string): unknown {
  if (p[0] === '@') {
    const m = p.match(/^@h\.(\d+)$/);
    const s = m && S.st[+m[1]];
    return s ? +(+s.top - +s.bot).toFixed(3) : null;
  }
  return p.split('.').reduce<any>((o, k) => o?.[k], S);
}

export function sp(S: WallState, p: string, v: unknown): void {
  const k = p.split('.');
  let o: any = S;
  for (let i = 0; i < k.length - 1; i++) o = o[k[i]] ?? (o[k[i]] = {});
  o[k[k.length - 1]] = v;
}

/** Mutates a cloned state to switch wall type (exact port of applyTy) */
export function applyWallType(S: WallState, v: WallType): WallState {
  if (v === S.ty) return S;
  if ((v === 'G' || v === 'Li') && S.kam === 'r') S.kam = 'c';
  if ((v === 'T' || v === 'L') && S.kam === 'c' && S.dwm === 'auto') S.kam = 'r';
  if (v === 'G' && S.ty !== 'G') {
    S.gc = 23;
    S.rck = 'ka';
    const Hh = Math.max(1, +S.Hr - +S.Zb);
    const bh = +(0.8 * Hh).toFixed(2);
    const bw = +Math.max(1, 0.7 * Hh).toFixed(2);
    const tw = +Math.max(0.6, 0.3 * Hh).toFixed(2);
    Object.assign(S, { gBt: tw, gbf: +(bw - tw).toFixed(2), gbr: 0, gBh: bh });
    const lt = +tw.toFixed(2);
    S.st = [{ t: lt, fb: 0, rb: 0, of: +(tw - lt).toFixed(2), top: +S.Hr, bot: +S.Zb + bh, rc: 1 }];
  }
  if (v !== 'G' && S.ty === 'G') {
    S.gc = 24;
    S.rck = 'ko';
    S.tb = 0.6;
    S.st = [{ t: 0.4, fb: 0, rb: 0, of: 0, top: +S.Hr, bot: +S.Zb + 0.6, rc: 1 }];
    S.Lt = 1.2;
    S.Lh = Math.max(1, +(0.5 * (S.Hr - S.Zb)).toFixed(2));
  }
  S.ty = v;
  syncState(S);
  return S;
}

/** Build passing default design for a wall type (exact port of loadDefault) */
export function loadDefaultDesign(
  ty: WallType,
  keep?: Partial<Pick<WallState, 'jno' | 'pn' | 'dsn' | 'chk' | 'acc'>>,
): WallState {
  const S = fillDef(structuredClone(DEFAULT_STATE) as unknown as Record<string, unknown>).state;
  applyWallType(S, ty);
  Object.assign(S, structuredClone(DFLT[ty] || {}), keep || {});
  syncState(S);
  return S;
}

/** Virtual parameter edit from interactive figure (exact port of setP) */
export function setVirtualParam(S: WallState, pRaw: string, v: number): WallState {
  let p = pRaw;
  let m = p.match(/^st\.(\d+)\.t$/);
  if (m) p = '@tw.' + m[1];
  if (isG(S)) {
    if (p === '@H') {
      S.Hr = +(+S.Zb + v).toFixed(3);
      return S;
    }
    if (p === 'tb') {
      S.gBh = v;
      return S;
    }
    if (p === '@gtf') {
      const d = v - (+S.gbf || 0);
      const n = S.st.length;
      S.gbf = +v;
      S.gBt = +(+S.gBt - d).toFixed(4);
      if (n) S.st[n - 1].of = +Math.max(0, (+S.st[n - 1].of || 0) - d).toFixed(4);
      return S;
    }
    if (p === '@gtb') {
      const d = v - (+S.gbr || 0);
      S.gbr = +v;
      S.gBt = +(+S.gBt - d).toFixed(4);
      return S;
    }
  }
  if (p === '@H') {
    S.Hr = +(+S.Zb + v).toFixed(3);
    return S;
  }
  if (p === '@Df') {
    S.Hf = +(+S.Zb + v).toFixed(3);
    return S;
  }
  if (p === '@WL') {
    S.wl = 'c';
    S.wlZ = +v;
    return S;
  }
  if (p === '@mv') {
    const d = v - +S.Lt;
    S.Lt = +v;
    if (S.ty !== 'Li') S.Lh = +Math.max(0, +S.Lh - d).toFixed(4);
    return S;
  }
  m = p.match(/^@(tw|tf|h)\.(\d+)$/);
  if (m) {
    const i = +m[2];
    const n = S.st.length;
    const s = S.st[i];
    if (!s) return S;
    const bot = !isG(S) && i === n - 1;
    if (m[1] === 'h') {
      const hv = Math.max(0, v);
      if (i === 0) s.top = +(+s.bot + hv).toFixed(3);
      else {
        const up = S.st[i - 1];
        up.bot = +Math.min(+up.top, +s.bot + hv).toFixed(3);
        s.top = up.bot;
      }
      return S;
    }
    const dt = v - +s.t;
    s.t = +(+v).toFixed(4);
    if (m[1] === 'tw') {
      if (bot && S.ty !== 'Li') S.Lh = +Math.max(0, +S.Lh - dt).toFixed(4);
      return S;
    }
    if (bot) {
      if (S.ty !== 'L') S.Lt = +Math.max(0, +S.Lt - dt).toFixed(4);
    } else s.of = +((+s.of || 0) - dt).toFixed(4);
    if (i > 0) S.st[i - 1].of = +((+S.st[i - 1].of || 0) + dt).toFixed(4);
    return S;
  }
  m = p.match(/^st\.(\d+)\.fb$/);
  if (m) {
    const i = +m[1];
    const s = S.st[i];
    const d = v - (+s.fb || 0);
    s.fb = v;
    if (i > 0) S.st[i - 1].of = +((+S.st[i - 1].of || 0) - d).toFixed(4);
    return S;
  }
  sp(S, p, v);
  return S;
}

/** Linked levels for figure edits (exact port of linkLv) */
export function linkLevels(S: WallState, p: string): WallState {
  const G = geo(S);
  const XS = G.XS || [];
  if (S.bon && +S.Hr > G.top + 1e-6) S.Hr = +G.top.toFixed(3);
  if (+S.Hf > +S.Hr) S.Hf = +S.Hr;
  if (XS[0] && S.fon && +S.Hf > XS[0].top + 1e-6) {
    if (p === '@Df' || p === 'Hf') {
      const q = S.xs[0];
      const u = q.up && q.up.length ? q.up[q.up.length - 1] : q;
      u.h = +(+u.h + (+S.Hf - XS[0].top)).toFixed(3);
    } else S.Hf = +XS[0].top.toFixed(3);
  }
  XS.forEach((a, j) => {
    if (S.xa === 'U') return;
    const zt = +S.xs[j].zt;
    if (zt > a.top + 1e-6) {
      if (p === `xs.${j}.zt`) {
        const q = S.xs[j];
        const u = q.up && q.up.length ? q.up[q.up.length - 1] : q;
        u.h = +(+u.h + (zt - a.top)).toFixed(3);
      } else S.xs[j].zt = +a.top.toFixed(3);
    }
  });
  if (S.wl === 'c' && +S.wlZ > +S.Hr) S.wlZ = +S.Hr;
  if (+S.fw > +S.Hf) S.fw = +S.Hf;
  return S;
}

/* ---------------- Exact v14.0.1 Stem & Extra-Stem Mutations ---------------- */

/** Split bottom main stem in half (or create first stem on gravity block). Exact port of a=='add'. */
export function addMainStem(S: WallState): { ok: boolean; error?: string } {
  const bt = +S.Zb + +S.tb;
  const n = S.st.length;
  if (!n) {
    S.st.push({
      t: isG(S) ? +Math.min(0.5, +S.gBt).toFixed(2) : 1,
      fb: 0,
      rb: 0,
      of: 0,
      top: Math.max(+S.Hr, bt + 0.5),
      bot: bt,
      rc: 1,
    });
    syncState(S);
    return { ok: true };
  }
  const l = S.st[n - 1];
  const hl = +l.top - bt;
  if (hl < 0.4 - 1e-9) {
    return {
      ok: false,
      error: `The bottom stem is only ${f(Math.max(0, hl))} m high. At least 0.4 m is needed to split it.`,
    };
  }
  l.bot = +(l.top - hl / 2).toFixed(3);
  let t = +(l.t + 0.15).toFixed(2);
  const of = +l.of || 0;
  if (isG(S)) t = +Math.max(+l.t, Math.min(t, +S.gBt - of)).toFixed(2);
  S.st.push({ t, fb: 0, rb: 0, of, top: l.bot, bot: bt, rc: 1 });
  l.of = 0;
  syncState(S);
  return { ok: true };
}

/** Delete main stem segment i, re-index RC keys, and keep remaining stems at their physical x positions. Exact port of a=='del'. */
export function deleteMainStem(S: WallState, i: number): boolean {
  const n = S.st.length;
  if (!isG(S) && n < 2) return false;
  if (i < 0 || i >= n) return false;
  const old = stemGeo(S).map((g) => g.xf0);
  const Bo = geo(S).B;
  if (i === 0 && n > 1) S.st[1].top = S.st[0].top;
  S.st.splice(i, 1);
  old.splice(i, 1);
  for (let j = i; j <= S.st.length; j++) {
    if (S.rc['s' + (j + 1)]) S.rc['s' + j] = S.rc['s' + (j + 1)];
    else delete S.rc['s' + j];
  }
  syncState(S);
  const m = S.st.length;
  for (let k = m - 1; k >= 0; k--) {
    const s = S.st[k];
    const d = old[k] - stemGeo(S)[k].xf0;
    if (Math.abs(d) < 1e-9) continue;
    if (!isG(S) && k === m - 1) {
      if (S.ty !== 'L') S.Lt = +Math.max(0, +S.Lt + d).toFixed(4);
      if (S.ty !== 'Li') S.Lh = +Math.max(0, +S.Lh + Bo - geo(S).B).toFixed(4);
    } else {
      s.of = +((+s.of || 0) + d).toFixed(4);
    }
  }
  syncState(S);
  return true;
}

/** Add an extra stem on base (toe side, terraced or U-channel). Auto-converts L->T and extends Lt. Exact port of a=='xadd'. */
export function addExtraStem(S: WallState): { ok: boolean; convertedFromL?: boolean; error?: string } {
  let convertedFromL = false;
  if (S.ty === 'L') {
    S.Lt = 0;
    applyWallType(S, 'T');
    convertedFromL = true;
  }
  const G = geo(S);
  const bt = G.bt;
  const n = S.xs.length;
  if (S.xa === 'U' && n) {
    return { ok: false, error: 'U-channel layout already has its front stem.' };
  }
  let x: number;
  const t = 0.3;
  let h: number;
  let zt: number;
  if (S.xa === 'U') {
    x = 0.2;
    h = +Math.max(0.5, +S.Hf - bt).toFixed(2);
    zt = bt;
    S.fon = 1;
  } else {
    const pv = n ? S.xs[n - 1] : null;
    x = pv ? +(+pv.x + +pv.t + 1.5).toFixed(2) : 0.3;
    zt = +(pv ? (+pv.zt + +S.Hr) / 2 : bt + Math.max(0.5, (+S.Hr - bt) / 2)).toFixed(2);
    h = +Math.max(0.3, zt - bt).toFixed(2);
  }
  const need = x + t + 1 - +G.Lt;
  if (need > 1e-6) {
    const d = +need.toFixed(2);
    S.Lt = +(+S.Lt + d).toFixed(2);
  }
  S.xs.push({ x, t, h, zt, rc: 1 });
  syncState(S);
  return { ok: true, convertedFromL };
}

/** Delete extra stem j and re-index x/M RC keys. Exact port of a=='xdel'. */
export function deleteExtraStem(S: WallState, i: number): boolean {
  if (!S.xs[i]) return false;
  S.xs.splice(i, 1);
  const RC2: WallState['rc'] = {};
  for (const [k, v] of Object.entries(S.rc)) {
    const m = k.match(/^([xM])(\d+)(s\d+)?$/);
    if (!m) {
      RC2[k] = v;
      continue;
    }
    const j = +m[2];
    if (j === i) continue;
    RC2[m[1] + (j > i ? j - 1 : j) + (m[3] || '')] = v;
  }
  S.rc = RC2;
  syncState(S);
  return true;
}

/** Split top segment of extra stem i into an upper stepped segment. Exact port of a=='xseg'. */
export function addExtraStemSeg(S: WallState, i: number): { ok: boolean; error?: string } {
  const q = S.xs[i];
  if (!q) return { ok: false, error: 'Extra stem not found' };
  q.up = Array.isArray(q.up) ? q.up : [];
  const last = q.up.length ? q.up[q.up.length - 1] : q;
  const hh = +last.h;
  if (!(hh >= 0.4 - 1e-9)) {
    return { ok: false, error: `Top segment is only ${f(Math.max(0, hh))} m high — at least 0.4 m is needed to split it.` };
  }
  last.h = +(hh / 2).toFixed(3);
  q.up.push({ t: +Math.max(0.2, +last.t - 0.1).toFixed(2), h: +(hh / 2).toFixed(3) });
  syncState(S);
  return { ok: true };
}

/** Delete upper segment k of extra stem i and restore height to segment below. Exact port of a=='xsdel'. */
export function deleteExtraStemSeg(S: WallState, i: number, k: number): boolean {
  const q = S.xs[i];
  const u = q && Array.isArray(q.up) ? q.up : [];
  if (!u[k]) return false;
  const below = k ? u[k - 1] : q;
  below.h = +(+below.h + +u[k].h).toFixed(3);
  u.splice(k, 1);
  for (let m = k + 1; m <= u.length + 1; m++) {
    const o = 'x' + i + 's' + (m + 1);
    const nn = 'x' + i + 's' + m;
    if (S.rc[o]) S.rc[nn] = S.rc[o];
    else delete S.rc[nn];
    delete S.rc[o];
  }
  syncState(S);
  return true;
}

/* ---------------- Project (.rwall) helpers ---------------- */

export function pjFrom(S0: WallState, name?: string, named?: boolean): ProjectFile {
  const project = Object.fromEntries(PJF.map((k) => [k, (S0 as any)[k] ?? ''])) as unknown as ProjectMeta;
  return {
    app: 'rwall',
    ver: 13,
    project,
    types: [{ id: uid(), name: name || 'RW1', named: named ? 1 : 0, S: structuredClone(S0) }],
    active: 0,
  };
}

export function pjName1(o: WallState): string | null {
  const D = o && o.dwg;
  const b = D && Array.isArray(D.bays) && D.built != null ? D.bays[D.built] : null;
  if (!b || !b.name) return null;
  if (D!.pn0 && o.pn === `${D!.pn0} – ${b.name}`) o.pn = D!.pn0;
  return String(b.name);
}

function incL(t: string): string {
  const a = t.split('');
  for (let k = a.length - 1; k >= 0; k--) {
    const c = a[k];
    if (c !== 'Z' && c !== 'z') {
      a[k] = String.fromCharCode(c.charCodeAt(0) + 1);
      return a.join('');
    }
    a[k] = c === 'Z' ? 'A' : 'a';
  }
  return (a[0] === 'A' ? 'A' : 'a') + a.join('');
}

export function nextName(n: string): string {
  const s = String(n || '').trim();
  let m = s.match(/^(.*?)(\d+)$/);
  if (m) return m[1] + String(+m[2] + 1).padStart(m[2].length, '0');
  m = s.match(/^(.*[^A-Za-z]|)([A-Za-z]{1,2})$/);
  if (m && (m[1] || m[2].length === 1)) return m[1] + incL(m[2]);
  return s ? s + ' 2' : 'RW1';
}

export function uniqName(types: WallTypeEntry[], n: string, skip?: number): string {
  let out = String(n || '').trim() || 'RW1';
  while (types.some((t, j) => j !== skip && t.name === out)) out = nextName(out);
  return out;
}

export function serializeProject(PJ: ProjectFile, onlyIndex?: number): string {
  const P: ProjectFile = JSON.parse(JSON.stringify(PJ));
  if (onlyIndex != null) {
    P.types = [P.types[onlyIndex]];
    P.active = 0;
  }
  return JSON.stringify(
    {
      app: 'rwall',
      ver: 13,
      model: MODEL_VERSION,
      saved: new Date().toISOString(),
      project: P.project,
      active: P.active,
      types: P.types,
      S: P.types[P.active].S,
    },
    null,
    1,
  );
}

export interface ParsedProjectResult {
  project: ProjectFile;
  dropped: string[];
  migrationNotes: string[];
  newerVersion: boolean;
}

export function parseProjectFile(jsonText: string): ParsedProjectResult {
  const o = JSON.parse(jsonText);
  const dropped: string[] = [];
  const migrationNotes: string[] = [];
  let L: WallTypeEntry[];

  if (o && Array.isArray(o.types) && o.types.length) {
    L = o.types.map((x: any) => ({
      id: x.id || uid(),
      name: String(x.name || 'RW1'),
      named: x.named ? 1 : 0,
      S: x.S,
    }));
    if (!L.every((x) => x.S && typeof x.S === 'object' && Array.isArray(x.S.st))) {
      throw new Error('damaged project file');
    }
    L.forEach((x) => {
      const res = fillDef(x.S as unknown as Record<string, unknown>);
      x.S = res.state;
      dropped.push(...res.dropped);
      if (res.migrationNote) migrationNotes.push(res.migrationNote);
      if (o.project) {
        PJF.forEach((k) => {
          if (o.project[k] != null) (x.S as any)[k] = o.project[k];
        });
      }
    });
  } else {
    const st = o && o.S ? o.S : o;
    if (!st || typeof st !== 'object' || !Array.isArray(st.st)) {
      throw new Error('not a .rwall project file');
    }
    const res = fillDef(st);
    dropped.push(...res.dropped);
    if (res.migrationNote) migrationNotes.push(res.migrationNote);
    const n = pjName1(res.state);
    L = [{ id: uid(), name: n || 'RW1', named: n ? 1 : 0, S: res.state }];
  }

  const meta = Object.fromEntries(
    PJF.map((k) => [k, o && o.project && o.project[k] != null ? o.project[k] : (L[0].S as any)[k] ?? '']),
  ) as unknown as ProjectMeta;

  return {
    project: {
      app: 'rwall',
      ver: 13,
      project: meta,
      types: L,
      active: Math.min(Math.max(0, +(o && o.active) || 0), L.length - 1),
    },
    dropped,
    migrationNotes,
    newerVersion: !!(o && +o.ver > 13),
  };
}

/* ---------------- Setup Wizard helpers ---------------- */

export interface WizardData {
  jno: string;
  pn: string;
  dsn: string;
  chk: string;
  ty: WallType;
  lay: string;
  Hr: number;
  Zb: number;
  Hf: number;
  top: number;
  gtop: number;
  zt1: number;
  zt2: number;
  cw: number;
  rphi: number;
  rg: number;
  fphi: number;
  fg: number;
  fc: number;
  wl: string;
  fw: number;
  vfz: number;
  qcat: string;
  tl: 'none' | 'fence' | 'ped' | 'veh';
  vc: string;
  acc: 'fc' | 'gg1';
  xrc: number;
  fcu: number;
  gbat: 'front' | 'back';
  gs: { t: number; h: number; pos: 'front' | 'centre' | 'back' }[] | null;
  [key: string]: any;
}

export function wzFromS(S: WallState): WizardData {
  const G = geo(S);
  const XS = G.XS || [];
  return {
    jno: S.jno || '',
    pn: S.pn || '',
    dsn: S.dsn || '',
    chk: S.chk || '',
    ty: S.ty,
    lay: !isG(S) && XS.length ? (isU(S) ? 'U' : 't' + (XS.length + 1)) : '1',
    Hr: +S.Hr,
    Zb: +S.Zb,
    Hf: +S.Hf,
    top: +G.top,
    gtop: isG(S) ? +(+S.Zb + +S.gBh).toFixed(3) : +S.Hr,
    zt1: XS[0] ? XS[0].zt : +Math.max(+S.Hf, +S.Zb + (+S.Hr - S.Zb) / 3).toFixed(2),
    zt2: XS[1]
      ? XS[1].zt
      : +((Math.max(+S.Hf, +S.Zb + (+S.Hr - S.Zb) / 3) + +S.Hr) / 2).toFixed(2),
    cw: 3,
    rphi: +S.r.phi,
    rg: +S.r.g,
    fphi: +S.f.phi,
    fg: +S.f.g,
    fc: +S.f.c,
    wl: ['0', '0.3333333', '0.5', '1'].includes(String(S.wl)) ? String(S.wl) : '0.5',
    fw: +S.fw,
    vfz: S.vFl === 'c' ? +S.vFz : +S.Hr,
    qcat: S.qcat,
    tl: S.bro ? (isVeh(S) ? 'veh' : 'ped') : S.wo ? 'fence' : 'none',
    vc: isVeh(S) ? S.brc : 'v6A',
    acc: S.acc,
    xrc: S.xrc ? 1 : 0,
    fcu: +S.fcu,
    gbat: +S.gbr > 1e-6 && !(+S.gbf > 1e-6) ? 'back' : 'front',
    gs: null,
  };
}

export function wzDef(d: WizardData): Record<string, number> {
  const r5 = (x: number) => Math.round(x * 20) / 20;
  const H = Math.max(0.5, d.Hr - d.Zb);
  const o: Record<string, number> = {};
  const v = (k: string) => (d[k] != null && d[k] !== '' ? +d[k] : o[k]);
  const RC = d.ty !== 'G';
  const ter = RC && /^t/.test(d.lay);
  const U = RC && d.lay === 'U';
  if (!RC) {
    o.gB = Math.max(1, r5(0.7 * H));
    o.gbt = Math.min(v('gB'), Math.max(0.6, r5(0.3 * H)));
    return o;
  }
  o.t = Math.max(0.3, r5(0.08 * H + 0.1));
  o.tb = Math.max(0.3, r5(0.08 * H + 0.1));
  const tb = v('tb');
  const t = v('t');
  const bt = d.Zb + tb;
  const B0 = Math.max(1.5, r5(0.65 * H));
  o.Lt = d.ty === 'L' ? 0 : d.ty === 'Li' ? Math.max(0.5, B0 - t) : r5(0.3 * B0);
  o.Lh = d.ty === 'Li' ? 0 : Math.max(0.5, r5(B0 - v('Lt') - t));
  if (ter) {
    const zs = d.lay === 't3' ? [+d.zt1, +d.zt2] : [+d.zt1];
    let x = 0.3;
    zs.forEach((z, j) => {
      o['x' + j + '_x'] = +x.toFixed(2);
      x = v('x' + j + '_x');
      const h = Math.max(0.3, z - bt);
      o['x' + j + '_h'] = +h.toFixed(2);
      o['x' + j + '_t'] = Math.max(0.3, r5(0.08 * h + 0.1));
      x += v('x' + j + '_t') + Math.max(1.5, r5(0.4 * v('x' + j + '_h') + 1));
    });
    o.Lt = +x.toFixed(2);
    if (d.ty === 'Li') o.Lh = 0;
  }
  if (U) {
    const h = Math.max(0.5, d.Hf - bt);
    o.x0_x = 0.3;
    o.x0_h = +h.toFixed(2);
    o.x0_t = Math.max(0.3, r5(0.08 * h + 0.1));
    o.Lt = +(v('x0_x') + v('x0_t') + Math.max(0.5, +d.cw)).toFixed(2);
    o.Lh = d.ty === 'Li' ? 0 : Math.max(0.3, r5(0.15 * H));
  }
  return o;
}

export const wzVal = (d: WizardData, k: string): number => {
  const o = wzDef(d);
  return d[k] != null && d[k] !== '' ? +d[k] : o[k];
};

export function wizErr(d: WizardData, i: number): string {
  const RC = d.ty !== 'G';
  const ter = RC && /^t/.test(d.lay);
  const U = RC && d.lay === 'U';
  const H = d.Hr - d.Zb;
  const v = (k: string) => wzVal(d, k);
  if (i === 1) {
    if (!(H > 0.3)) return 'Retained ground level must be at least 0.3 m above the founding level.';
    if (d.Hf > d.Hr) {
      return U
        ? 'Enter the higher side as the retained ground level.'
        : 'Front ground level is above the retained level.';
    }
    if (RC && d.top < d.Hr - 1e-6) return 'Wall top is below the retained ground level.';
    if (!RC && !(d.gtop > d.Zb + 0.2)) return 'Top of the mass concrete block must be above the founding level.';
    if (ter && !(d.zt1 > d.Zb && d.zt1 < d.Hr)) {
      return 'Terrace 1 level must be between the founding level and the retained level.';
    }
    if (ter && d.lay === 't3' && !(d.zt2 > d.zt1 && d.zt2 < d.Hr)) {
      return 'Terrace 2 level must be between terrace 1 and the retained level.';
    }
    if (ter && d.Hf > d.zt1) return 'Front ground level is above terrace 1.';
  }
  if (i === 2) {
    if (RC) {
      if (!(v('t') > 0 && v('tb') > 0)) return 'Stem width and base thickness must be > 0.';
      if (v('Lt') < 0 || v('Lh') < 0) return 'Toe / heel length cannot be negative.';
      const n = ter ? (d.lay === 't3' ? 2 : 1) : U ? 1 : 0;
      for (let j = 0; j < n; j++) {
        const x0 = v('x' + j + '_x');
        const x1 = x0 + v('x' + j + '_t');
        const nx = j < n - 1 ? v('x' + (j + 1) + '_x') : v('Lt');
        if (!(v('x' + j + '_t') > 0 && v('x' + j + '_h') > 0)) {
          return `Stem on base ${j + 1}: width and height must be > 0.`;
        }
        if (x1 > nx + 1e-6) {
          return `Stem on base ${j + 1} overlaps ${
            j < n - 1 ? 'stem on base ' + (j + 2) : 'the main stem'
          } – reduce x or increase the main-stem position.`;
        }
      }
    } else {
      const B = v('gB');
      const bt = v('gbt');
      if (!(B > 0 && bt > 0)) return 'Block widths must be > 0.';
      if (bt > B + 1e-6) return 'Top width cannot exceed the bottom width.';
      const gs = d.gs || [];
      if (gs.some((q) => !(+q.t > 0 && +q.h > 0))) return 'Every stem needs a width and a height > 0.';
      const top = d.gtop + gs.reduce((a, q) => a + (+q.h || 0), 0);
      if (d.Hr > top + 1e-6) {
        return `Retained ground +${dd(d.Hr)} is above the wall top +${dd(top)} – add a stem or raise the block.`;
      }
      let w = bt;
      for (const q of gs) {
        if (+q.t > w + 1e-6 && q.pos !== 'front' && q.pos !== 'back') {
          return 'A centred stem cannot be wider than the element below.';
        }
        w = +q.t;
      }
    }
  }
  return '';
}

export function wizBuild(baseState: WallState, d: WizardData): WallState {
  const S = structuredClone(baseState);
  const RC = d.ty !== 'G';
  const ter = RC && /^t/.test(d.lay);
  const U = RC && d.lay === 'U';
  const v = (k: string) => wzVal(d, k);

  Object.assign(S, {
    jno: d.jno,
    pn: d.pn,
    dsn: d.dsn,
    chk: d.chk,
    Hr: +d.Hr,
    Zb: +d.Zb,
    Hf: Math.min(+d.Hf, +d.Hr),
    fon: 1,
  });
  const tyE: WallType = d.ty === 'L' && d.lay !== '1' ? 'T' : d.ty;
  if (S.ty !== tyE) applyWallType(S, tyE);
  else if (tyE === 'G') {
    S.ty = 'T';
    applyWallType(S, 'G');
  }

  S.r.phi = +d.rphi;
  S.r.g = +d.rg;
  S.f.phi = +d.fphi;
  S.f.g = +d.fg;
  S.f.c = +d.fc;
  S.wl = d.wl;
  S.fw = Math.min(+d.fw, S.Hf);
  S.qcat = d.qcat;
  S.wo = d.tl === 'fence' ? 1 : 0;
  S.bro = d.tl === 'ped' || d.tl === 'veh' ? 1 : 0;
  if (d.tl === 'ped') S.brc = '1.5';
  if (d.tl === 'veh') {
    S.brc = d.vc;
    S.vFl = 'c';
    S.vFz = +d.vfz;
  }
  S.acc = d.acc;
  S.xrc = +d.xrc;
  S.fcu = +d.fcu;
  S.xs = [];
  S.xa = 'ter';

  if (!RC) {
    const B = v('gB');
    const bw = Math.min(v('gbt'), B);
    const hb = +(d.gtop - d.Zb).toFixed(3);
    Object.assign(S, {
      gBt: bw,
      gbf: d.gbat === 'back' ? 0 : +(B - bw).toFixed(3),
      gbr: d.gbat === 'back' ? +(B - bw).toFixed(3) : 0,
      gBh: hb,
      tb: hb,
    });
    const gs = d.gs || [];
    const st = [];
    let z = +d.gtop;
    let w = bw;
    for (const q of gs) {
      const t = +q.t;
      const h = +q.h;
      const of = q.pos === 'front' ? 0 : q.pos === 'centre' ? (w - t) / 2 : w - t;
      st.push({ t, fb: 0, rb: 0, of: +of.toFixed(4), top: +(z + h).toFixed(3), bot: +z.toFixed(3), rc: 1 });
      z += h;
      w = t;
    }
    S.st = st.reverse();
  } else {
    const tb = v('tb');
    const t = v('t');
    const bt = S.Zb + tb;
    const top = Math.max(+d.top, S.Hr);
    S.tb = tb;
    S.st = [{ t, fb: 0, rb: 0, of: 0, top, bot: +bt.toFixed(3), rc: 1 }];
    if (ter) {
      const zs = d.lay === 't3' ? [+d.zt1, +d.zt2] : [+d.zt1];
      zs.forEach((z, j) =>
        S.xs.push({ x: v('x' + j + '_x'), t: v('x' + j + '_t'), h: v('x' + j + '_h'), zt: +z, rc: 1 }),
      );
    }
    if (U) {
      S.xa = 'U';
      S.xs.push({ x: v('x0_x'), t: v('x0_t'), h: v('x0_h'), zt: 0, rc: 1 });
    }
    S.Lt = +v('Lt').toFixed(2);
    S.Lh = +v('Lh').toFixed(2);
  }
  syncState(S);
  return S;
}
