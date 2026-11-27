/**
 * Retaining Wall Design & Checker – Detailed Calculation Steps (v14.0.1)
 *
 * Pure, zero-DOM TypeScript port of legacy v14.0.1 Sections 5, 6, 7, and 8
 * step-by-step engineering calculation tables (`epcTable`, `ctab`, `kmL`, `csOT`,
 * `csE_`, `ecL`, `sums`, `RCT`, `rcSch`, `cvTab`, `dgSec`, `WTB`, `nc`, `rvl`).
 *
 * Every equation, factor, clause reference, and substitution traces directly to
 * `CalcAllSuccessResult` without altering any calculation logic (RULES.md).
 */

import type {
  CalcAllSuccessResult,
  CompResult,
  KeyMechResult,
  LoadComponent,
  LoadFactors,
  MaterialParams,
  RcDesignElement,
  TopCase,
  WallState,
} from './types';
import { BCAT, CKL, COMBS, EXN, MBN } from './constants';
import { esc, f } from './math';
import { ckOn, fdOn, gpF, hEffMax, isG, isU, isVeh, rcv, scOn } from './helpers';
import { cmpInfo, cmpOn, kaEq, koDesc, kpEq, omg } from './earthPressure';
import { barCalc, comp, windCalc } from './loads';
import { gEffBase, otF, qDist, scRows } from './stability';
import { aMin, ancRC, anch, cvAll, dgCU, dgCalc, lapReq, mbName } from './rcDesign';

/* ---------------- Shared Table & Badge Helpers ---------------- */

export type CheckStatus = boolean | 'na' | 'rv' | 'nc';

const CU: Record<string, string> = {
  'ΣH': 'kN/m',
  'ΣH_O': 'kN/m',
  'ΣH_GW': 'kN/m',
  'ΣV': 'kN/m',
  'ΣW': 'kN/m',
  'ΣU': 'kN/m',
  'ΣPp': 'kN/m',
  N: 'kN/m',
  Qn: 'kN/m',
  H: 'kN/m',
  'H*': 'kN/m',
  R: 'kN/m',
  Fa: 'kN/m',
  Fr: 'kN/m',
  Qult: 'kN/m',
  M_R: 'kNm/m',
  M_O: 'kNm/m',
  M_GW: 'kNm/m',
  M_W: 'kNm/m',
  'M*': 'kNm/m',
  e: 'm',
  'B′': 'm',
  'x̄': 'm',
  q: 'kPa',
  'q′': 'kPa',
  qu: 'kPa',
  qult: 'kPa',
  qo: 'kPa',
  'γ′': 'kN/m³',
  'δb': '°',
  'δb,f': '°',
};

const lp = (s: CheckStatus): string => {
  const m: [string, string] =
    s === true
      ? ['okq', '✓']
      : s === false
      ? ['no', 'FAIL']
      : s === 'na'
      ? ['na', 'N/A']
      : s === 'rv'
      ? ['rv', 'REQUIRES VERIFICATION']
      : ['nc', 'NOT CHECKED'];
  return `<span class="lamp ${m[0]}">${m[1]}</span>`;
};

const cs = (s: CheckStatus): string => (s === true ? 'ok' : s === false ? 'no' : s);

const CX = (t: string): string => `<span class="xp">${t}</span>`;

const cuv = (sym: string, v: string): string => {
  const u = CU[sym];
  return u && /^-?[0-9]+(?:\.[0-9]+)?$/.test(String(v).trim()) ? `${v} ${u}` : v;
};

type CtabRow = [string, string, string] | [string, string, string, string];

const ctab = (rows: CtabRow[]): string =>
  `<div class="tw"><table class="ctab"><thead><tr><th>Symbol</th><th>Description</th><th>Source / formula</th><th>Value</th></tr></thead><tbody>${rows
    .map((r) =>
      r[0] === '!'
        ? `<tr class="res"><td colspan="3">${r[1]}</td><td>${r[2]}</td></tr>`
        : `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${cuv(r[0], r[3] ?? '')}</td></tr>`
    )
    .join('')}</tbody></table></div>`;

const T = (h: string[], rows: string[][], cls?: string): string =>
  `<div class="tw${rows.length <= 25 ? ' kt' : ''}"><table${cls ? ` class="${cls}"` : ''}><thead><tr>${h
    .map((x) => `<th>${x}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;

const bl = (t: string, s: CheckStatus, v: string, lines: string[]): string =>
  `<div class="blk ${cs(s)}"><div class="bh"><b>${t}</b><span>${v} ${lp(s)}</span></div>${lines
    .filter(Boolean)
    .map((l) => `<p>${l}</p>`)
    .join('')}</div>`;

const tn = (t: TopCase | { k: TopCase['k'] }): string =>
  t.k === 'none' ? 'no top load' : t.k === 'wind' ? 'with fence wind' : 'with barrier load';

/* ---------------- Section 5.0 Earth Pressure Coefficients ---------------- */

export function epcRows(S: WallState, Pk: MaterialParams, Pf: MaterialParams, P: boolean): string[][] {
  const Gv = isG(S);
  const al = Pk.al || 0;
  const dd = Pk.d || 0;
  const rows: string[][] = [];
  rows.push(['φ′', 'Angle of shearing resistance of the retained soil', '–', `${f(Pk.phr, 1)}°` + (P ? ` (factored ${f(Pf.phr, 1)}°)` : '')]);
  if (S.bon) rows.push(['β', 'Ground slope behind the wall', '–', `${f(+S.br || 0, 1)}°`]);
  if (Gv) rows.push(['α', 'Inclination of the active pressure plane to the vertical' + CX(' (GG1 Fig. 39 / 40)'), '–', `${f(al, 1)}°`]);
  rows.push(['δ', 'Wall Friction Angle <span class="kc">(GG1 Table 14)</span>', '–', `${f(dd, 1)}°`]);
  rows.push(['Ka', 'Active earth pressure coefficient', kaEq(S, al, dd), f(Pk.Ka, 3) + (P ? ` (factored ${f(Pf.Ka, 3)})` : '')]);
  rows.push(['Kah', 'Horizontal component of Ka', 'Ka·cos(α + δ)', f(Pk.Kah, 3) + (P ? ` (factored ${f(Pf.Kah, 3)})` : '')]);
  const pasOn = S.fon && !S.nopp;
  rows.push([
    'Kp',
    'Passive earth pressure coefficient',
    pasOn ? kpEq(S, Pk) : S.fon ? 'passive resistance ignored' : 'front soil not considered',
    pasOn ? f(Pk.Kp, 3) + (P ? ` (factored ${f(Pf.Kpf, 3)})` : '') : 'not used',
  ]);
  return rows;
}

export function epcTable(S: WallState, Pk: MaterialParams, Pf: MaterialParams, P: boolean): string {
  return `<h3>5.0 Earth pressure coefficients</h3>` + T(['Symbol', 'Description', 'Source / formula', 'Value'], epcRows(S, Pk, Pf, P));
}

/* ---------------- Section 5: Characteristic Loads ---------------- */

const GN: Record<string, string> = {
  O: 'soil, surcharge and wall-top loads',
  GW: 'groundwater',
  W: 'wind',
  D: 'permanent – restoring',
  V: 'variable – bearing only',
  F: 'fence self-weight – bearing / eccentricity / RC only',
  P: 'passive',
  A: 'vertical comp. on the back – reduces Mo',
};

export const groupOfLoad = (p: LoadComponent): string =>
  p.dir === 'u'
    ? 'GW'
    : p.dir === 'p'
    ? 'P'
    : p.dir === 'v'
    ? p.cat === 'fdl'
      ? 'F'
      : p.cat === 'sheel' || p.cat === 'pvq'
      ? 'V'
      : p.pav
      ? 'A'
      : 'D'
    : p.cat === 'water'
    ? 'GW'
    : p.cat === 'wind'
    ? 'W'
    : 'O';

export function renderCalcSec5(S: WallState, R0: CalcAllSuccessResult): string {
  const { Pk, Pf, P, Ck, G } = R0;
  const H5 = ['ID', 'Item', 'Formula', 'Force (kN/m)', 'Arm (m)', 'Moment (kNm/m)', 'Group'];

  const items = (C: CompResult, dir: LoadComponent['dir'], pf?: 1 | 2): string[][] => {
    const a = C.it.filter((i) => i.dir === dir && (!pf || (pf === 1 ? !i.pav : !!i.pav)));
    const gs = [...new Set(a.map(groupOfLoad))];
    return [
      ...a.map((p) => [p.n, p.t, p.fm, f(p.F), f(p.arm), f(p.F * p.arm), groupOfLoad(p)]),
      ...(gs.length > 1
        ? gs.map((g) => {
            const b = a.filter((p) => groupOfLoad(p) === g);
            return [
              `<b>Σ ${g}</b>`,
              `<i>${GN[g] || g}</i>`,
              '',
              `<b>${f(b.reduce((t, p) => t + p.F, 0))}</b>`,
              '',
              `<b>${f(b.reduce((t, p) => t + p.F * p.arm, 0))}</b>`,
              g,
            ];
          })
        : []),
      [
        '<b>Σ</b>',
        '<b>Total</b>',
        '',
        `<b>${f(a.reduce((t, p) => t + p.F, 0))}</b>`,
        '',
        `<b>${f(a.reduce((t, p) => t + p.F * p.arm, 0))}</b>`,
        '',
      ],
    ];
  };

  let h =
    `<h2>5. Calculation – characteristic (unfactored) loads, per m run, moments about toe</h2>` +
    (P
      ? '<p class="mu">Characteristic values. The Geoguide 1 checks in Section 6 apply γm to the soil strength (Kah,f / Kah) and γf to variable actions – each Section 6 table shows the factor applied to every item.</p>'
      : '') +
    epcTable(S, Pk, Pf, P) +
    `<p class="mu xp" style="font-size:11.5px">Group: O = other loads (FC 2017 FOS 2.0 overturning / 1.5 sliding) · GW = groundwater (1.5) · W = wind (1.5) · D = permanent, restoring · A = vertical component of the earth / water force on the back (in N; reduces Mo, GG1 Fig. 39) · V = variable, used for bearing only${
      fdOn(S) ? ' · F = fence self-weight, bearing / eccentricity / RC only (ignored in sliding / overturning)' : ''
    } · P = passive. Section 6 refers to these subtotals.</p>` +
    `<h3>5.1 Active side (retained) – arm z above base bottom</h3>` +
    T(H5, items(Ck, 'h'));

  if (S.wo || S.bro) {
    const r: string[][] = [];
    let wt = '';
    if (S.wo) {
      const w = windCalc(S, G);
      r.push(['Lw', 'Fence wind' + CX(' – Wind Code 2019'), 'P = Qz·Cp·Ss; F = P × loaded area (see table below)', f(w.F), f(w.z), w.basis]);
      wt =
        `<p><b>Fence wind load${CX(' – Wind Code 2019, Eq 2-3a')}: P = Qz·Cp·Ss</b> (fence h = ${f(w.h)} m, solidity φ = ${f(w.ph, 2)})</p>` +
        T(
          ['Symbol', 'Description', 'Source / formula', 'Value'],
          w.steps.map((st) => [st[0], st[1], (st[2] === '–' ? '' : CX(st[2] + ' – ')) + st[3], st[4]])
        );
    }
    if (S.bro) {
      const b = barCalc(S, G);
      const V = b.veh;
      r.push(
        V
          ? [
              'Lb',
              'Vehicle barrier impact' + CX(' – DIL 2011 Cl 3.8.3'),
              `${BCAT[S.brc] || S.brc}: F = 0.5Mv²/(c + b) (DIL Cl 3.8.3.1: M in kg, v in m/s, c and b in mm, F in kN) = 0.5×${V.M}×${f(V.v, 1)}²/(${V.c} + ${f(V.b, 0)}) = ${f(V.F1, 1)} kN${
                V.gm !== 1 ? `; ramp γ = ${f(V.gm, 2)} (Table 3.15) → ${f(V.F2, 1)} kN` : ''
              }${S.vObl ? `; oblique ×0.5 (Cl 3.8.3.4) → ${f(V.F, 1)} kN` : ''}; dispersion length = ${f(V.Ld, 2)} m (DIL Cl 3.8.3.3: F over 1.5 m at bumper height, dispersed through the wall over ${f(V.Ld, 2)} m) → ${f(V.F, 1)}/${f(V.Ld, 2)} = ${f(V.Fm, 2)} kN/m; at bumper height ${V.hb} mm (Table 3.16) above ${
                S.vFl === 't' ? 'wall top' : S.vFl === 'c' ? 'vehicle floor level' : 'retained ground level'
              } +${f(V.fl)} = +${f(V.zA)} mPD${S.vStem ? '; acts on the wall stem (stem is the barrier)' : ''}`,
              f(b.F),
              f(b.z),
              S.vSO
                ? 'imposed load (CoP Table 2.1 γf = 1.6 / 1.2) – <b>structural design of the stem only (Section 7); not included in wall stability (Section 6)</b>'
                : 'imposed load (CoP Table 2.1 γf = 1.6 / 1.2); separate case from wind',
            ]
          : [
              'Lb',
              'Barrier' + CX(' – DIL 2011 Table 3.13'),
              `${BCAT[S.brc] || S.brc}, at min(1.1, ${S.bhb}) = ${f(b.ha)} m above wall top`,
              f(b.F),
              f(b.z),
              'separate load case from wind (DIL 3.8.1.1)',
            ]
      );
    }
    h += `<h3>5.2 Loads at wall top</h3>` + T(['ID', 'Item', 'Formula', 'Force (kN/m)', 'Arm z (m)', 'Notes'], r) + wt;
  }

  // 5.3 Passive side
  h +=
    `<h3>5.3 Passive side (front)</h3>` +
    (Ck.it.some((i) => i.dir === 'p')
      ? T(H5, items(Ck, 'p'))
      : `<p class="mu">${S.fon ? 'No passive zone below the neglected depth.' : 'Front soil not considered.'}</p>`);

  // 5.4 Vertical loads (CR-1: show zero Toe soil row when d_p eliminates it)
  const vRows = items(Ck, 'v', 1);
  if (S.fon && +S.tsw && +S.dp > 0 && !Ck.it.some((i) => i.cat === 'tsoil')) {
    const sNoDp: WallState = { ...S, dp: 0 };
    if (comp(sNoDp, Pk, null).it.some((i) => i.cat === 'tsoil')) {
      const k = vRows.findIndex((x) => String(x[0]).startsWith('<b>Σ'));
      vRows.splice(k < 0 ? vRows.length : k, 0, ['', 'Toe soil', `(within d_p = ${f(+S.dp)} m)`, f(0), '', f(0), 'D']);
    }
  }
  h +=
    `<h3>5.4 Vertical loads – arm x from toe</h3>` +
    T(H5, vRows) +
    (Ck.it.some((i) => i.pav)
      ? `<p class="xp">Vertical components of the earth / water force on the back of the wall (GG1 Fig. 39: Pav = Pah·tan(α + δ)${
          Ck.it.some((i) => i.pav && i.cat === 'water') ? ', U1v = U1·sinα' : ''
        }) – included in N; their moment about the toe is deducted from the overturning moment Mo:</p>` + T(H5, items(Ck, 'v', 2))
      : '');

  // 5.5 Uplift
  h +=
    `<h3>5.5 Uplift on base – linear pore pressure toe → heel</h3>` +
    (Ck.it.some((i) => i.dir === 'u') ? T(H5, items(Ck, 'u')) : '<p class="mu">No water at base level.</p>');

  return h;
}

/* ---------------- Section 6: Stability (Full Step-by-Step Calculation) ---------------- */

export function renderStabSec6(S: WallState, R0: CalcAllSuccessResult): string {
  const { G, Pk, Pf, P, A, Fc, Ck, PL } = R0;
  const sl = A.sl;
  const bA = A.br;
  const o6 = A.ot;
  const se = A.sls;
  const ppOn = Boolean(S.ppS && Ck.pasOK);
  const PLc = PL.filter((p) => !p.na);
  const PLr = PL.filter((p) => p.na);

  const eCb = (x: boolean): boolean => ((!A.naE && A.okE === false) || !R0.csE ? false : x);
  const eSm = (): string => (A.naE ? 'e < 0' : `e ${f(se.s.e, 3)} ${A.okE ? '≤' : '>'} B/6`);

  // Changes in section (GG1 §9.2.3(2), Fig. 40)
  const csNote = (): string =>
    `<span class="mu">Changes in section (GG1 §9.2.3(2), Fig. 40): the wall above each change in section is taken as a free body with active earth pressure on the part above; moments about the front edge of the section${
      P ? ', factored parameters' : ''
    }; M_R = W·h/2 − ΣW·e (W incl. soil resting on the wall above the section), Mo = Pah·yp − Pav·h.</span>`;

  const csOT = (): string[] =>
    PLc.length || PLr.length
      ? [
          csNote(),
          ctab([
            ...PLc.map(
              (p): CtabRow => [
                `+${f(p.Ls)}`,
                `${p.lab}, h = ${f(p.h, 3)} m (${tn({ k: p.tk })})`,
                `M_R = ${f(p.MR, 2)}; Mo = ${f(p.Mo, 2)}${p.Pv > 1e-9 ? ` (after deducting Pav·h = ${f(p.Pv * p.h, 2)})` : ''}${
                  P ? '' : `; M* = ${f(p.Mreq / p.Freq, 2)}`
                }`,
                `<b>${f(p.Fot, 2)}</b> ≥ ${f(p.Freq, 2)} ${lp(p.okO)}`,
              ]
            ),
            ...PLr.map((p): CtabRow => [`+${f(p.Ls)}`, p.lab, 'reinforced – designed in Section 7', lp('na')]),
          ]),
        ]
      : [];

  const csE_ = (): string[] =>
    PLc.length
      ? [
          csNote().replace(/moments about.*?section(, factored parameters)?;/, 'unfactored parameters, surcharge present and absent;'),
          ctab(
            PLc.map(
              (p): CtabRow => [
                `+${f(p.Ls)}`,
                `${p.lab}, h = ${f(p.h, 3)} m`,
                `e = h/2 − (M_R − Mo)/N = ${f(p.h / 2, 3)} − (${f(p.eMR, 2)} − ${f(p.eMD, 2)})/${f(p.eN, 2)}`,
                `<b>${f(p.ek, 3)}</b> ${p.okE ? '≤' : '>'} h/6 = ${f(p.h / 6, 3)} ${lp(p.okE)}`,
              ]
            )
          ),
        ]
      : [];

  const gOs = PLc.reduce<(typeof PLc)[number] | null>((a, p) => (!a || p.uO > a.uO ? p : a), null);
  const otT = (F0: number, _ok0: boolean, req: number): string =>
    `FOS ${f(F0, 2)} ≥ ${f(req, 2)}${gOs ? ` · +${f(gOs.Ls)}: ${f(gOs.Fot, 2)}` : ''}`;

  // Shear key GG1 Fig. 42 Mechanism 1 derivation lines
  const kmL = (km: KeyMechResult, Pp: MaterialParams, gqF: number): string[] => [
    `<b>Shear key – GG1 Fig. 42 mechanism 1</b>: horizontal plane AB through the key bottom at +${f(km.Zk)} mPD (dk = ${f(km.dk)} m, Bk = ${f(km.Bk)} m, front face ${f(km.xk)} m from toe); earth and water pressures taken to the key bottom (GG1 §9.2.3(2)).`,
    `ΔPa (base → key bottom) = Kah(σ′v0·dk + ½γ′dk²) = ${f(Pp.Kah, 3)}×(${f(km.sv0)}×${f(km.dk)} + ½×${f(km.gfb)}×${f(km.dk)}²) = ${f(km.dPa)} kN/m${
      km.dPq > 0 ? `; surcharge Kah·q·dk${gqF !== 1 ? ' × γf' : ''} = ${f(km.dPq)} kN/m` : ''
    }${km.dPw > 0 ? `; water γw(hw·dk + ½dk²) = ${f(km.dPw)} kN/m` : ''}`,
    `Activating Fa = S1 = ΣH + ΔPa = <b>${f(km.Fa)}</b> kN/m`,
    `N1 on AB = N + soil between base and AB = ${f(km.N1)} kN/m → trapezoidal base pressure: Nb (on key) = ${f(km.Nb)}, Ns (on soil) = ${f(km.Ns)} kN/m`,
    ...(!km.kOn ? ['Rp1 = 0 – all passive resistance ignored (Step 3: front-soil Pp ignored and shear-key passive not used)'] : []),
    ...(km.kOn && S.nopp
      ? ['Front-soil passive above founding level ignored (unplanned excavation / removable); shear-key passive kept from founding level to key bottom with σ′f0 = 0 (GG1 Fig. 42 mechanism 1).']
      : []),
    `Rp1 (passive to key bottom, δ = 0) = ${km.usePp ? 'ΣPp above base + ' : ''}Kp,f(σ′f0·dk + ½γ′dk²) + 2c′√Kp,f·dk${km.dPpw > 0 ? ' + water' : ''} = ${
      km.usePp ? f(km.Rp - km.dPp - km.dPpw) + ' + ' : ''
    }${f(km.dPp)}${km.dPpw > 0 ? ' + ' + f(km.dPpw) : ''} = ${f(km.Rp)} kN/m (Kp,f = ${f(Pp.Kpf, 3)}, foundation soil, σ′f0 = ${f(km.sf0)} kPa)`,
    `Fr = Ns·tanφ′ + c′(B − Bk) + Nb·tanδb + Rp1 = ${f(km.Ns)}×${f(km.tphi, 3)} + ${f(Pp.cF, 2)}×${f(G.B - km.Bk)} + ${f(km.Nb)}×tan${f(Pp.db, 2)}° + ${f(km.Rp)} = <b>${f(km.Fr)}</b> kN/m`,
  ];

  // Unfactored / factored Section 5 item summation helper (used by Accidental Vehicle Impact)
  const brk = (C: CompResult, fa: LoadFactors, dir: LoadComponent['dir'], mom?: boolean, pv?: boolean) => {
    let t = 0;
    const q: string[] = [];
    for (const i of C.it) {
      if (i.dir !== dir) continue;
      if (mom && dir === 'v' && (pv ? !i.pav : i.pav)) continue;
      const k = fa[i.cat] ?? 1;
      if (!(k > 0)) continue;
      const v = i.F * k * (mom ? i.arm : 1);
      t += v;
      q.push(`${i.n} ${f(i.F * (mom ? i.arm : 1), 1)}${k !== 1 ? '×' + k : ''}`);
    }
    return { s: q.join(' + ') || '0', t };
  };

  const sums = (C: CompResult, fa: LoadFactors, what: string): string[] => {
    const h = brk(C, fa, 'h');
    const v = brk(C, fa, 'v');
    const u = brk(C, fa, 'u');
    const pp = brk(C, fa, 'p');
    const mh = brk(C, fa, 'h', true);
    const mv = brk(C, fa, 'v', true);
    const ma = brk(C, fa, 'v', true, true);
    const mu = brk(C, fa, 'u', true);
    const mp = brk(C, fa, 'p', true);
    const L = [
      `<span class="mu xp">Summation of Section 5 items${P ? ' (re-calculated with GG1 factored parameters; ×factor shown)' : ' (×0 items omitted)'}:</span>`,
    ];
    if (what.includes('H')) L.push(`ΣH = ${h.s} = <b>${f(h.t)}</b> kN/m`);
    if (what.includes('N')) L.push(`ΣV = ${v.s} = ${f(v.t)} kN/m; ΣU = ${u.s} = ${f(u.t)} kN/m → N = ΣV − ΣU = <b>${f(v.t - u.t)}</b> kN/m`);
    if (what.includes('P') && pp.t > 0) L.push(`ΣPp = ${pp.s} = <b>${f(pp.t)}</b> kN/m`);
    if (what.includes('M')) {
      L.push(`M_R = ${mv.s}${S.ppO && mp.t > 0 ? ' + ' + mp.s : ''} = <b>${f(mv.t + (S.ppO ? mp.t : 0))}</b> kNm/m`);
      L.push(`Mo = ${mh.s}${mu.t > 0 ? ' + ' + mu.s : ''}${ma.t > 0 ? ' − (' + ma.s + ')' : ''} = <b>${f(mh.t + mu.t - ma.t)}</b> kNm/m (GG1 Fig. 39)`);
    }
    return L;
  };

  // Middle-third eccentricity block (shared by GG1 and FC 2017)
  const qdSls = qDist(se.s.N, se.s.e, G.B);
  const ecL0 = [
    `<span class="mu">Unfactored loads; worst of q_in / Pav,q present and absent (governing: q_in ${se.sh ? 'present' : 'absent'}, Pav,q ${se.pv ? 'present' : 'absent'}, ${tn(se.tc)})</span>`,
    ctab([
      ['M_R', 'Restoring moment', `5.4 group D${S.ppO ? ' + 5.3' : ''}`, f(se.s.Mr)],
      ['M_O', 'Overturning moment' + CX(' (GG1 Fig. 39)'), `5.1 + 5.5${se.C.it.some((i) => i.pav) ? ' − 5.4 Pav·xp' : ''}`, f(se.s.Md)],
      ['N', 'Normal force', 'ΣW − ΣU', f(se.s.N)],
      ['x̄', 'Resultant from the toe', '(M_R − M_O) / N', `${f(se.s.xbar, 3)} m`],
      ['q_max / q_min', 'Base pressure (characteristic)', 'N/B (1 ± 6e/B)', `${f(Math.max(qdSls(0), qdSls(G.B)))} / ${f(Math.min(qdSls(0), qdSls(G.B)))} kPa`],
      [
        '!',
        A.naE ? 'e = B/2 − x̄ < 0 – rule need not be applied (§9.2.4)' : `e = B/2 − x̄ ≤ B/6 = ${f(G.B / 6, 3)} m`,
        `<b>${f(se.s.e, 3)} m</b> ${lp(A.naE ? 'na' : A.okE)}`,
      ],
    ]),
  ];
  const ecL = [...ecL0, ...csE_()];
  const ecH = (): string[] => ['<b>(a) Eccentricity – middle third (GG1 §9.2.4)</b>', ...ecL, '<b>(b) Bearing capacity</b>'];

  let h6 =
    `<h2 class="pb">6. Stability</h2>` +
    `<p class="mu">Checking method: <b>${P ? 'Partial factor' : 'Global factor'}</b>${CX(
      P ? ' – Geoguide 1 (2020)' : ' – CoP Foundations 2017 Cl 2.5.4 / 2.2.4'
    )}.<span class="int"> FC 2017 Cl 6.3: walls may be designed to GG1; Chapter 2 also applies where the wall supports a structure or resists surcharge from foundations.</span></p>`;

  if (P) {
    // 6.1 Geoguide 1 Partial Factors
    const chM: Record<string, number> = {};
    for (const i of se.C.it) chM[i.n] = i.F;
    const kr = Pk.Kah > 0 ? Pf.Kah / Pk.Kah : 1;

    const li = (C: CompResult, fa: LoadFactors, dir: LoadComponent['dir'], mom?: boolean, pv?: boolean) => {
      let t = 0;
      const q: string[] = [];
      for (const i of C.it) {
        if (i.dir !== dir) continue;
        if (mom && dir === 'v' && (pv ? !i.pav : i.pav)) continue;
        const k = fa[i.cat] ?? 1;
        if (!(k > 0)) continue;
        const a = mom ? i.arm : 1;
        t += i.F * k * a;
        const c = chM[i.n];
        const r = c > 0 ? i.F / c : 1;
        q.push(`${i.n} ${f((c > 0 ? c : i.F) * a, 2)}${Math.abs(r - 1) > 0.002 ? ' × ' + f(r, 3) : ''}${k !== 1 ? ' × ' + f(k, 2) : ''}`);
      }
      return { s: q.join(' + ') || '–', t };
    };

    const kaRow: CtabRow = [
      'Kah,f / Kah',
      'Retained soil strength factored' + CX(' (GG1 Table 7') + `, γm = ${f(+S.gm, 2)}` + CX(')'),
      `tanφ′f = tanφ′/γm: retained φ′ ${S.r.phi}° → ${f(Pf.phr, 2)}°; Kah,f = ${f(Pf.Kah, 3)}, Kah = ${f(Pk.Kah, 3)}`,
      `× ${f(kr, 3)}`,
    ];
    const note = `<span class="mu xp">Section 5 (characteristic) values × Kah,f/Kah for soil and surcharge pressures, × γf for variable actions (GG1 Table 6: surcharge ${S.gq}${
      S.wo || S.bro ? ', wall-top loads 1.5' : ''
    }); Pv (wall-friction component) × its own ratio (factored Kah and δ); water and permanent loads × 1.0.</span>`;

    // Sliding (GG1)
    const h = li(sl.C, sl.fa, 'h');
    const v = li(sl.C, sl.fa, 'v');
    const u = li(sl.C, sl.fa, 'u');
    const pp = li(sl.C, sl.fa, 'p');
    const gS = sl.gp || 1;
    const uS = sl.u;
    const tS = ctab([
      kaRow,
      ['ΣH', 'Driving horizontal loads (factored)', '5.1 / 5.2: ' + h.s, f(h.t)],
      ['ΣV', 'Permanent vertical loads (γf = 1.0)', '5.4: ' + v.s, f(v.t)],
      ['ΣU', 'Uplift', '5.5: ' + u.s, f(u.t)],
      ['N', 'Normal force on the base', 'ΣV − ΣU', f(v.t - u.t)],
      ...(sl.km
        ? ([
            ['Fa', 'Activating force (incl. ΔPa to the key bottom, see note)', 'ΣH + ΔPa', f(sl.Fa)],
            ['Fr', 'Resistance – shear key (see note)', 'Ns·tanφ′f + c′f(B − Bk) + Nb·tanδb,f + Rp1', f(sl.Fr)],
          ] as CtabRow[])
        : ([
            ['δb,f', 'Base friction angle (factored)', `tanδb,f = tan${f(Pk.db, 1)}° / γm`, `${f(Pf.db, 2)}°`],
            ...(ppOn ? ([['ΣPp', 'Passive resistance (factored)', '5.3: ' + pp.s, f(sl.s.Hp)]] as CtabRow[]) : []),
            ['Fa', 'Activating force', 'ΣH', f(sl.s.H)],
            ['Fr', 'Resisting force', `N·tanδb,f${ppOn ? ' + ΣPp' : ''} (no base adhesion)`, f(sl.Fr)],
          ] as CtabRow[])),
      ['!', `Fr / Fa${gS > 1 ? ' (with γproj)' : ''} ≥ ${f(gS, 2)}`, `<b>${f(gS / Math.max(uS, 1e-9), 2)}</b> ${lp(A.okS)}`],
    ]);

    // Overturning (GG1)
    const gO = o6.gp || 1;
    const mv = li(o6.C, o6.fa, 'v', true);
    const ma = li(o6.C, o6.fa, 'v', true, true);
    const mh = li(o6.C, o6.fa, 'h', true);
    const mu = li(o6.C, o6.fa, 'u', true);
    const mp = li(o6.C, o6.fa, 'p', true);
    const tO = ctab([
      kaRow,
      ['M_R', 'Restoring moment about the toe (Fig. 39: W·xw)', '5.4: ' + mv.s + (S.ppO && mp.t > 0 ? ' + 5.3: ' + mp.s : ''), f(o6.s.Mr)],
      [
        'M_O',
        'Overturning moment about the toe' + CX(' (Fig. 39') + ': Pah·yp − Pav·xp + U·xu' + CX(')'),
        '5.1 / 5.2: ' + mh.s + (mu.t > 0 ? ' + 5.5: ' + mu.s : '') + (ma.t > 0 ? ' − 5.4: (' + ma.s + ')' : ''),
        f(o6.s.Md),
      ],
      ['!', `FOS = M_R / Mo${gO > 1 ? ' (with γproj)' : ''} ≥ ${f(gO, 2)}`, `<b>${f(o6.F * gO, 2)}</b> ${lp(A.okO)}`],
    ]);

    // Bearing (GG1 App. A)
    const r = bA.r;
    const bh = li(bA.C, bA.fa, 'h');
    const bv = li(bA.C, bA.fa, 'v');
    const bu = li(bA.C, bA.fa, 'u');
    const tB = ctab([
      kaRow,
      ['ΣH', 'Horizontal loads (factored)', '5.1 / 5.2: ' + bh.s, f(bh.t)],
      ['ΣV', 'Vertical loads', '5.4: ' + bv.s, f(bv.t)],
      ['ΣU', 'Uplift', '5.5: ' + bu.s, f(bu.t)],
      ['Qn', 'Vertical load on the base', `ΣV − ΣU (${bA.lab})`, f(bA.b.N)],
      ['H', 'Horizontal load', `ΣH${S.ppB ? ' − ΣPp' : ''}`, f(bA.Hb)],
      ['e', 'Eccentricity of this bearing case', `B/2 − (M_R − M_O)/N${bA.b.e < 0 ? ' (negative → eb = 0' + CX(', A.3.1.2') + ')' : ''}`, `${f(bA.b.e, 3)} m`],
      ['B′', 'Effective width', 'B − 2|e|', `${f(r.Bp, 3)} m`],
      ['φ′f / c′f', 'Foundation soil strength factored', `tanφ′f = tanφ′/γm; c′f = c′/γm: foundation φ′ ${S.f.phi}° → ${f(Pf.phf, 2)}°`, `${f(Pf.phf, 2)}° / ${f(Pf.cF, 2)} kPa`],
      ['Nq / Nc / Nγ', 'Bearing capacity factors', 'GG1 App. A; Nγ = 2(Nq + 1)tanφ′f', `${f(r.Nq, 2)} / ${f(r.Nc, 2)} / ${f(r.Ng, 2)}`],
      ['iq / iγ / ic', 'Inclination factors', `Ki = H/(N + B′c′cotφ′) = ${f(r.Ki, 3)}, m = 2 (strip)`, `${f(r.iq, 3)} / ${f(r.ig, 3)} / ${f(r.ic, 3)}`],
      ...(omg(S) > 0 && !r.sc ? ([['gq = gγ / gc', 'Ground slope factors', `ω = ${f(omg(S), 1)}°`, `${f(r.gq, 3)} / ${f(r.gc, 3)}`]] as CtabRow[]) : []),
      ['q′', 'Overburden beside the base', `depth ${f(bA.ob.D)} m${S.obdp ? ` (top ${S.dp} m neglected)` : ''}`, `${f(bA.ob.q)} kPa`],
      ['γ′', 'Unit weight below the base', bA.C.ub > 0 || bA.C.uf > 0 ? 'submerged' : 'bulk', `${f(gEffBase(S, bA.C), 2)} kN/m³`],
      ...(r.sc ? scRows(r, false) : ([['qult', 'Ultimate bearing pressure', 'c′Nc·ic·gc + ½γ′B′Nγ·iγ·gγ + q′Nq·iq·gq', `${f(r.qu)} kPa`]] as CtabRow[])),
      ['Qult', 'Ultimate bearing capacity', 'qult · B′', `${f(r.Qu)} kN/m`],
      ['!', 'Qult / Qn ≥ 1.00', `<b>${f(1 / Math.max(bA.u, 1e-9), 2)}</b> ${lp(A.okB)}`],
    ]);

    h6 +=
      `<h3>6.1 Ultimate limit state${CX(' – Geoguide 1, partial factors (GG1 §4.3.4, Tables 6 & 7)')}</h3>` +
      bl(
        sl.km ? 'Sliding – shear key' + CX(' (GG1 Fig. 42 mechanism 1)') : 'Sliding' + CX(' (GG1 Fig. 39 / 41 mech. 1)'),
        A.okS,
        `Fr / Fa ${f(gS / Math.max(uS, 1e-9), 2)} ≥ ${f(gS, 2)}`,
        [
          `<span class="mu xp">Worst case: ${tn(sl.tc)}. q_in on the heel not counted as stabilising (variable action); base adhesion 0.</span>`,
          note,
          tS,
          ...(sl.km ? kmL(sl.km, Pf, +S.gq).map((x) => `<span class="xp">${x}</span>`) : []),
        ]
      ) +
      bl('Overturning about the toe' + CX(' (GG1 Fig. 39)'), A.okO && R0.csO, otT(o6.F * gO, A.okO, gO), [
        `<span class="mu xp">Worst case: ${tn(o6.tc)}. GG1 Fig. 39 note 5: not required where the middle-third rule is complied with (see Bearing).</span>`,
        tO,
        ...csOT(),
      ]) +
      bl(
        'Bearing capacity' + CX(' (GG1 App. A, Fig. A2)') + ' – incl. eccentricity' + CX(' (GG1 §9.2.4)'),
        eCb(A.okB),
        `${eSm()} · Qult / Qn ${f(1 / Math.max(bA.u, 1e-9), 2)} ≥ 1.0`,
        [
          ...ecH(),
          `<span class="mu">Worst case: ${tn(bA.tc)}; variable actions checked present and absent. The eccentricity in the table below is that of this bearing case ((a) uses the worst unfactored case).</span>`,
          tB,
          bA.ob.D > bA.C.G.B ? `<span class="warn int">Embedment ${f(bA.ob.D)} m > B – shallow-foundation equation outside range (A.3.1.2).</span>` : '',
        ]
      );
  } else {
    // 6.1 Global factor of safety – CoP Foundations 2017
    const fsl = Fc.sl;
    const fo = Fc.ot;
    const bF2 = Fc.br;
    const ids = (C: CompResult, dir: LoadComponent['dir'], pr: (i: LoadComponent) => boolean) =>
      C.it.filter((i) => i.dir === dir && pr(i)).map((i) => i.n).join(', ') || '–';
    const use = (fa: LoadFactors) => (i: LoadComponent) => (fa[i.cat] ?? 1) > 0;
    const lab = Fc.lab;
    const dashIdx = lab.indexOf(' – ');
    const gwLab = dashIdx > 0 ? CX(lab.slice(0, dashIdx + 3)) + lab.slice(dashIdx + 3) : lab;

    const tS = ctab([
      ['ΣH_O', 'Driving – soil, surcharge, wall-top loads', `5.1 group O: ${ids(fsl.C, 'h', (i) => groupOfLoad(i) !== 'GW')}`, f(fsl.Ho)],
      ['ΣH_GW', 'Driving – groundwater', `5.1 group GW: ${ids(fsl.C, 'h', (i) => groupOfLoad(i) === 'GW')}`, f(fsl.Hw)],
      ['ΣW', 'Permanent vertical loads (incl. Pav)', `5.4 groups D + A: ${ids(fsl.C, 'v', use(fsl.fa))}`, f(fsl.s.W)],
      ['ΣU', 'Uplift', '5.5', f(fsl.s.U)],
      ['N', 'Normal force on the base', 'ΣW − ΣU', f(fsl.s.N)],
      ...(fsl.km
        ? ([['R', 'Resistance – shear key (GG1 Fig. 42 mech. 1, see note)', 'Ns·tanφ′ + c′(B − Bk) + Nb·tanδb + Rp1', f(fsl.R)]] as CtabRow[])
        : ([
            ['δb', 'Base friction angle', S.dbm === 'cv' ? 'φcv′ (GG1 §5.12)' : 'custom value (Step 3)', `${f(Pk.db, 1)}°`],
            ...(ppOn ? ([['ΣPp', 'Passive resistance', '5.3', f(fsl.s.Hp)]] as CtabRow[]) : []),
            ['R', 'Sliding resistance', `N·tanδb${ppOn ? ' + ΣPp' : ''}`, f(fsl.R)],
          ] as CtabRow[])),
      [
        'H*',
        `Driving force for FOS ${f(fsl.ref, 1)}`,
        fsl.Hw > 0 && Fc.Fsw !== Fc.Fs
          ? `ΣH_O + (${f(Fc.Fsw, 1)}/${f(Fc.Fs, 1)})·ΣH_GW${Fc.gS > 1 ? ` × γproj ${f(Fc.gS, 2)}` : ''}`
          : `ΣH_O + ΣH_GW${Fc.gS > 1 ? ` × γproj ${f(Fc.gS, 2)}` : ''}`,
        f(fsl.Hst),
      ],
      ['!', `FOS = R / H* = ${f(fsl.R)} / ${f(fsl.Hst)} ≥ ${f(fsl.ref, 1)}`, `<b>${f(fsl.Fe, 2)}</b> ${lp(Fc.okS)}`],
    ]);

    const tO = ctab([
      ['M_R', 'Restoring moment – permanent loads', `5.4 group D${S.ppO ? ' + 5.3' : ''} (moments about the toe)`, f(fo.s.Mr)],
      [
        'M_O',
        'Overturning – soil, surcharge and wall-top loads (GG1 Fig. 39: Pah·yp − Pav·xp)',
        `5.1 group O${fo.C.it.some((i) => i.pav && i.cat !== 'water') ? ' − 5.4 group A (Pav·xp)' : ''}`,
        f(fo.Mo),
      ],
      [
        'M_GW',
        'Overturning – groundwater',
        '5.1 group GW + 5.5 uplift' + (fo.C.it.some((i) => i.pav && i.cat === 'water') ? ' − U1v·xu1' : ''),
        f(fo.Mg),
      ],
      ...(fo.Mw > 0 ? ([['M_W', 'Overturning – fence wind', '5.2', f(fo.Mw)]] as CtabRow[]) : []),
      [
        'M*',
        `Overturning moment for FOS ${f(fo.ref, 1)}${fo.Mw > 0 ? ' (case with wind)' : ''}`,
        otF(Fc, fo) + (Fc.gO > 1 ? ` × γproj ${f(Fc.gO, 2)}` : ''),
        f(fo.Mst),
      ],
      ['!', `FOS = M_R / M* = ${f(fo.s.Mr)} / ${f(fo.Mst)} ≥ ${f(fo.ref, 1)}`, `<b>${f(fo.Fe, 2)}</b> ${lp(Fc.okO)}`],
    ]);

    const r = bF2.rr;
    const qoEq = Math.abs(bF2.ob.q - bF2.qo) < 0.005;
    const tB = ctab([
      ['N', 'Vertical load', `ΣW − ΣU (${bF2.lab})`, f(bF2.b.N)],
      ['H', 'Horizontal load', `ΣH${S.ppB ? ' − ΣPp' : ''}`, f(bF2.b.H - (S.ppB ? bF2.b.Hp : 0))],
      ['e', 'Eccentricity of this bearing case', 'B/2 − (M_R − M_O)/N', `${f(bF2.b.e, 3)} m`],
      ['B′', 'Effective width', 'B − 2|e|', `${f(r.Bp, 3)} m`],
      ['q', 'Applied pressure', 'N / B′', `${f(bF2.qap)} kPa`],
      ['Nq / Nc / Nγ', 'Bearing capacity factors', `FC 2017 Table 2.3, φ′ = ${S.f.phi}°`, `${f(r.Nq, 2)} / ${f(r.Nc, 2)} / ${f(r.Ng, 2)}`],
      ['ζqi / ζγi / ζci', 'Inclination factors', `Ki = H/(N + B′c′cotφ′) = ${f(r.Ki, 3)}`, `${f(r.iq, 3)} / ${f(r.ig, 3)} / ${f(r.ic, 3)}`],
      ...(omg(S) > 0 && !r.sc ? ([['ζqg = ζγg', 'Ground slope factor', `(1 − tanω)², ω = ${f(omg(S), 1)}°`, f(r.gq, 3)]] as CtabRow[]) : []),
      ...(qoEq
        ? ([['q′ = qo', 'Overburden at founding level', bF2.qoR.src, `${f(bF2.qo)} kPa`]] as CtabRow[])
        : ([['q′', 'Overburden beside the base (in qu)', 'depth ≤ min(3 m, B)', `${f(bF2.ob.q)} kPa`]] as CtabRow[])),
      ['γ′', 'Unit weight below the base', bF2.C.ub > 0 || bF2.C.uf > 0 ? 'submerged' : 'bulk', `${f(gEffBase(S, bF2.C), 2)} kN/m³`],
      ...scRows(r, true),
      [
        'qu',
        'Ultimate bearing capacity',
        r.sc ? `interpolated q(b)${r.qu > 3000 ? ' (≤ 3000)' : ''}` : `c′Ncζc + ½γ′B′Nγζγ + q′Nqζq${r.qu > 3000 ? ' (≤ 3000)' : ''}`,
        `${f(bF2.qu)} kPa`,
      ],
      ...(qoEq ? [] : ([['qo', 'Original overburden at founding level (net pressure)', bF2.qoR.src, `${f(bF2.qo)} kPa`]] as CtabRow[])),
      [
        '!',
        `FOS = (qu − qo)/(q − qo) ≥ ${f(Fc.Fb, 1)}; qa = (qu − qo)/${f(Fc.Fb, 1)} + qo = ${f(bF2.qa)} kPa`,
        `<b>${bF2.F === Infinity ? '∞' : f(bF2.F, 2)}</b> ${lp(Fc.okB)}`,
      ],
    ]);

    h6 +=
      `<h3>6.1 Global factor of safety${CX(' – CoP Foundations 2017 (Cl 2.5.4, Cl 2.2.4)')}</h3>` +
      `<p class="mu">Groundwater condition: <b>${gwLab}</b>.${
        Fc.gS > 1 || Fc.gO > 1
          ? ` Project-specific factor γproj applied: sliding × ${f(Fc.gS, 2)}, overturning × ${f(Fc.gO, 2)} (not a code requirement – see Section 8).`
          : ''
      }</p>` +
      bl(
        fsl.km ? 'Sliding – shear key' + CX(' (GG1 Fig. 42 mechanism 1)') : 'Sliding' + CX(' (FC 2017 Cl 2.5.4)'),
        Fc.okS,
        `FOS ${f(fsl.Fe, 2)} ≥ ${f(fsl.ref, 1)}`,
        [
          `<span class="mu xp">Worst case: ${tn(fsl.tc)}. Dead loads only resist (Cl 2.5.4(4)); base adhesion 0.</span>`,
          tS,
          ...(fsl.km ? kmL(fsl.km, Pk, 1).map((x) => `<span class="xp">${x}</span>`) : []),
        ]
      ) +
      bl('Overturning about the toe' + CX(' (FC 2017 Cl 2.5.4)'), Fc.okO && R0.csO, otT(fo.Fe, Fc.okO, fo.ref), [
        `<span class="mu xp">Worst case: ${tn(fo.tc)}. FOS ${f(Fc.Fo, 1)} on other loads and ${f(Fc.Fog, 1)} on groundwater (${f(Fc.Fow, 1)} on wind) – the groundwater / wind moments are scaled to the reference FOS.</span>`,
        tO,
        ...csOT(),
      ]) +
      bl(
        'Uplift' + CX(' (FC 2017 Cl 2.5.4)'),
        Fc.up.s.U > 0 ? Fc.okU : 'na',
        Fc.up.s.U > 0 ? `W / U ${f(Fc.up.s.W / Fc.up.s.U, 2)} ≥ ${f(Fc.Fu, 2)}` : 'no uplift',
        [
          ctab([
            ['ΣW', 'Permanent vertical loads', '5.4 group D', f(Fc.up.s.W)],
            ['ΣU', 'Uplift', '5.5', f(Fc.up.s.U)],
            ['!', `W / U ≥ ${f(Fc.Fu, 2)}`, `<b>${Fc.up.s.U > 0 ? f(Fc.up.s.W / Fc.up.s.U, 2) : '–'}</b> ${lp(Fc.up.s.U > 0 ? Fc.okU : 'na')}`],
          ]),
        ]
      ) +
      bl(
        'Bearing' + CX(' (FC 2017 Cl 2.2.4)') + ' – incl. eccentricity' + CX(' (GG1 §9.2.4)'),
        eCb(Fc.okB),
        `${eSm()} · ${bF2.F === Infinity ? 'q ≤ qo' : `FOS ${f(bF2.F, 2)} ≥ ${f(Fc.Fb, 1)}`}`,
        [
          ...ecH(),
          `<span class="mu">Worst case: ${tn(bF2.tc)}; variable actions checked present and absent. The eccentricity in the table below is that of this bearing case ((a) uses the worst unfactored case).</span>`,
          tB,
        ]
      );
  }

  // 6.2 Accidental case – vehicle impact (DIL Cl 3.8.3)
  if (R0.AI) {
    const AI = R0.AI;
    const V0 = AI.b.veh;
    h6 +=
      `<h3>6.2 Accidental case – vehicle impact${CX(' (DIL Cl 3.8.3)')}</h3>` +
      `<p class="mu xp">Vehicle impact is excluded from 6.1 (structural design only). As a short-duration accidental action it is checked with unfactored loads: impact ${f(AI.b.F, 2)} kN/m${
        V0 ? ` (F = ${f(V0.F, 1)} kN dispersed over Ld = ${f(V0.Ld, 2)} m)` : ''
      } at +${f(V0 ? V0.zA : +S.Zb + AI.b.z)} mPD; required FOS ≥ 1.0 for an accidental load (same unfactored form in either checking method); middle-third rule not applied to a transient load.</p>` +
      bl('Accidental impact – sliding, overturning, bearing', AI.ok, `min FOS ${f(Math.min(AI.Fs, AI.Fo, AI.br.F), 2)} ≥ 1.0`, [
        ...sums(AI.C, { sheel: 0, pvq: 0, pas: 1 }, 'HNPM'),
        `Sliding: Rr / ΣH = ${f(AI.Rr)} / ${f(AI.Ha)} = <b>${f(AI.Fs, 2)}</b> ≥ 1.0`,
        `Overturning: Mr / Md = ${f(AI.s.Mr)} / ${f(AI.s.Md)} = <b>${f(AI.Fo, 2)}</b> ≥ 1.0`,
        `Bearing (FC 2017 Cl 2.2.4 form): qu = ${f(AI.br.qu)} kPa, qo = ${f(AI.br.qo)} kPa, q = N/B′ = ${f(AI.br.b.N)}/${f(AI.br.r.Bp, 3)} = ${f(AI.br.qap)} kPa → (qu − qo)/(q − qo) = <b>${
          AI.br.F === Infinity ? '∞' : f(AI.br.F, 2)
        }</b> ≥ 1.0 (e = ${f(AI.br.b.e, 3)} m)`,
      ]);
  }

  // δ = 0° sensitivity check note (if wall relies on δ > 0)
  if (R0.D0) {
    const d0 = R0.D0;
    const d0Ok = d0.u.okAll;
    const slTxt = P
      ? `Fr/Fa ${f((d0.A.sl.gp || 1) / Math.max(d0.A.sl.u, 1e-9), 2)}`
      : `FOS ${f(d0.Fc.sl.Fe, 2)} ≥ ${f(d0.Fc.sl.ref, 1)}`;
    const otTxt = P
      ? `FOS ${f(d0.A.ot.F * (d0.A.ot.gp || 1), 2)}`
      : `FOS ${f(d0.Fc.ot.Fe, 2)} ≥ ${f(d0.Fc.ot.ref, 1)}`;
    const brTxt = P
      ? `Qult/Qn ${f(1 / Math.max(d0.A.br.u, 1e-9), 2)}`
      : d0.Fc.br.F === Infinity
      ? 'q ≤ qo'
      : `FOS ${f(d0.Fc.br.F, 2)} ≥ ${f(d0.Fc.Fb, 1)}`;
    h6 += bl('Sensitivity check – wall friction δ = 0° (informational)', d0Ok ? 'na' : 'rv', d0Ok ? 'still passes with δ = 0°' : 'relies on δ > 0°', [
      `<span class="mu">Re-checked with δ = 0° (compressible ground / wall settlement eliminates wall friction): Sliding ${slTxt} · Overturning ${otTxt} · Bearing ${brTxt} · e = ${f(d0.A.sls.s.e, 3)} m.</span>`,
    ]);
  }

  return h6;
}

/* ---------------- Section 7: Structural Design (Full 12-Step RCT Tables) ---------------- */

export function renderStructSec7(S: WallState, R0: CalcAllSuccessResult): string {
  if (!S.xrc) {
    return `<h2>7. Structural design</h2><p class="mu">Structural calculation is turned off (Step 5).</p>`;
  }

  const { Pk, ko, RS, MS, G } = R0;
  const kaTxt = `Ka (${Pk.kaLab}) = ${f(Pk.Ka, 3)}, Kah = ${f(Pk.Kah, 3)}`;
  const koTxt = `Ko = ${f(ko, 3)} (${koDesc(S)})`;

  const cmpTxt = (): string => {
    if (!cmpOn(S)) return S.cmp ? ' Compaction-induced pressure: not applied (no backfill or Q1 = 0).' : ' Compaction-induced pressure: not considered.';
    const K = S.rck === 'ka' ? Pk.Kah : ko;
    const c = cmpInfo(S, K);
    return ` <b>Compaction-induced pressure</b> (GG1 §6.8, Fig. 27; Ingold 1979): roller line load Q1 = ${f(c.Q, 1)} kN/m, p′hm = √(2Q1γ/π) = ${f(c.phm, 1)} kPa; ${
      +S.br > 0 ? 'fill slope behind wall → zc = 0 (Fig. 27 note 2)' : `zc = ${f(c.zc, 2)} m, hc = ${f(c.hc, 2)} m`
    }; σ′h = max(K·σ′v, ${+S.br > 0 ? 'p′hm' : 'min(σ′v/K, p′hm)'}) for structural design (GG1 Table 20).`;
  };

  const cvTab = (stem: boolean | number, base: boolean | number): string => {
    const C = cvAll(S, G);
    const L = C.rows.filter((r) => (r.st ? Boolean(stem) : Boolean(base)));
    return L.length
      ? `<p><b>Exposure and nominal cover</b> (CoP Table 4.1; Table 4.2 for C${S.fcu}; Cl 4.2.4.1):</p>` +
          T(
            ['Element / face', 'Exposure (CoP Table 4.1)', 'Nominal cover used'],
            L.map((r) => [r.n, `Cond ${r.ex} ${EXN[r.ex] || ''} – ${r.why}${r.min != null ? `; minimum ${r.min} mm` : ''}`, `${r.c} mm`]),
            'l'
          )
      : '';
  };

  const RCT = (_r: RcDesignElement, rows: [string, string, string, string, string][]): string => {
    const sp = (x: string): [string, string] => {
      const m = String(x).match(/^(\d+[a-z]?)\s+(.*)$/);
      return m ? [m[1], m[2]] : ['', x];
    };
    const st = rows.map((x) => {
      const [n, t] = sp(x[0]);
      return [n, t, x[1], x[2], x[3], x[4] || ''];
    });
    const ck = rows.filter((x) => x[4]);
    const bad = ck.filter((x) => x[4].includes('FAIL'));
    return (
      (bad.length
        ? `<p class="mu" style="margin:2px 0 4px"><span style="color:var(--st-fail)">${bad.length} of ${ck.length} checks fail: ${bad
            .map((x) => sp(x[0])[1])
            .join(', ')}</span></p>`
        : '') + T(['Step', 'Item', 'Formula / clause', 'Substitution', 'Result / requirement', 'Status'], st, 'rct')
    );
  };

  const rcSch = (): string =>
    T(
      ['Element', 'Main (tension face)', 'Distribution', 'Opposite face', 'As,prov / As,req main (mm²/m)', 'Status'],
      RS.map((r) => [
        r.n,
        `T${r.bm.d}@${r.bm.s} – ${r.tf.toLowerCase()}`,
        `T${r.r.d2}@${r.r.s2} EF`,
        `T${r.bo.d}@${r.bo.s} – ${r.of.toLowerCase()}`,
        `${f(r.Asp, 0)} / ${f(Math.max(r.Asr, r.Asm), 0)}`,
        lp(r.ok),
      ]),
      'l'
    );

  const rcBlk = (r: RcDesignElement, X13: [string, string, string, string, string][] = []): string =>
    `<div class="rcb"><h3>${r.n} — h = ${f(r.h, 0)} mm ${lp(r.ok)}</h3>${
      r.bad ? '<p class="err">Factored resultant outside base – base pressure invalid for this combination.</p>' : ''
    }` +
    RCT(r, [
      [
        '1 Design actions',
        `envelope of Comb 1–3${S.rck === 'env' ? ', Ka & Ko' : ''}`,
        `governing: ${r.gov}${
          r.hnM != null
            ? `; optional check, base-pressure relief ignored: M = ${f(Math.abs(r.hnM), 1)}, V = ${f(Math.abs(r.hnV ?? 0), 1)} (${
                S.hnr ? 'governs design' : 'for information'
              })`
            : ''
        }`,
        `M = ${f(Math.abs(r.M), 1)} kNm/m; V = ${f(Math.abs(r.V), 1)} kN/m${
          r.me && Math.abs(r.me) > 0.005
            ? `<br><small>incl. eccentric self-weight / soil on steps Me,k = ${f(r.me, 2)} kNm/m about the section centroid (γ = ${
                r.me > 0 ? '1.4 / 1.2 adverse' : '1.0 beneficial'
              })</small>`
            : ''
        }`,
        '',
      ],
      [
        '2 Effective depth',
        `d = h − c − φ/2${r.rev ? ' (moment reversed: tension on ' + r.tf.toLowerCase() + ')' : ''}`,
        `${f(r.h, 0)} − ${r.cT} − ${r.bm.d}/2`,
        `d = ${f(r.d, 0)} mm`,
        '',
      ],
      [
        '3 K factor, lever arm',
        'K = M/(fcu·b·d²) ≤ K′ (eq 6.7, 6.8); z = d[0.5+√(0.25−K/0.9)] ≤ 0.95d (eq 6.10)',
        `${f(Math.abs(r.M) * 1e6, 0)}/(${S.fcu}×1000×${f(r.d, 0)}²)`,
        `K = ${f(r.K, 4)} ≤ K′ = ${r.Kp}; z = ${f(r.z, 0)} mm; x = ${f(r.x, 0)} mm`,
        lp(r.okK),
      ],
      [
        '4 Steel required',
        'As = M/(0.87fy·z) (eq 6.12)' + (r.gpA > 1 ? ' × γproj' : ''),
        `${f(Math.abs(r.M) * 1e6, 0)}/(0.87×${S.fy}×${f(r.z, 0)})${r.gpA > 1 ? ' × ' + f(r.gpA, 2) : ''}`,
        `${f(r.Asr, 0)} mm²/m`,
        '',
      ],
      r.gv
        ? [
            '5 Minimum per face (crack control)',
            S.gsz === 'sz' ? `As,min = ρ·b·h_eff per face, h_eff = min(h/2, ${f(hEffMax(S), 0)}) (surface zone)` : 'As,min = ρ·b·h/2 per face (CoP 9.6.5, full section)',
            `${S.grho}% × 1000 × ${f(r.he ?? 0, 0)}`,
            `${f(r.Asm, 0)} mm²/m per face`,
            '',
          ]
        : r.wl
        ? ['5 Minimum vertical (RC wall)', 'ΣAs,v ≥ 0.4%·b·h, half at each face (CoP Cl 9.6.2)', `0.4% × 1000 × ${f(r.h, 0)} / 2`, `${f(r.Asm, 0)} mm²/m each face`, '']
        : ['5 Minimum', 'ρmin·αmin·b·h (Table 9.1, Cl 9.3.1.1)', `${S.rmin}% × ${f(r.am, 3)} × 1000 × ${f(r.h, 0)}`, `${f(r.Asm, 0)} mm²/m`, ''],
      [`6 Main – ${r.tf}`, 'As,prov ≥ max(As,req, As,min); ≤ 4% (9.2.1.3)', `T${r.bm.d}@${r.bm.s}`, `${f(r.Asp, 0)} ≥ ${f(Math.max(r.Asr, r.Asm), 0)} mm²/m`, lp(r.okM && r.okMax)],
      ...(r.gv || r.wl
        ? ([
            [
              `6b ${r.of}`,
              r.wl ? 'As,prov ≥ 0.2%·b·h (half of 0.4%, CoP Cl 9.6.2)' : 'As,prov ≥ As,min per face (CoP 9.6.5)',
              `T${r.bo.d}@${r.bo.s}`,
              `${f(r.As3, 0)} ≥ ${f(r.Asm, 0)} mm²/m`,
              lp(r.okOpp),
            ],
          ] as [string, string, string, string, string][])
        : []),
      [
        '7 Shear',
        'v = V/bd ≤ vc (Table 6.3); v ≤ min(0.8√fcu, 7) (6.1.2.5(a))',
        `100As/bd = ${f(r.rho, 3)}; (400/d)^¼ = ${f(r.f4, 3)} (≥ 0.67); fcu ≤ 80`,
        `v = ${f(r.v, 3)}; vc = ${f(r.vc, 3)}; vmax = ${f(r.vmax, 2)} N/mm²`,
        lp(r.okV && r.okVm),
      ],
      r.gv
        ? ['8 Horizontal / distribution', 'As per face ≥ As,min per face (CoP 9.6.5, each direction)', `T${r.r.d2}@${r.r.s2} EF`, `${f(r.secProv, 0)} ≥ ${f(r.secReq, 0)}`, lp(r.okSec)]
        : r.wl
        ? [
            '8 Horizontal (RC wall)',
            `ΣAs,h ≥ ${r.rh}%·b·h (CoP Cl 9.6.3); φh ≥ max(φv/4, 6); s ≤ 400`,
            `2 × T${r.r.d2}@${r.r.s2}`,
            `${f(r.secProv, 0)} ≥ ${f(r.secReq, 0)} mm²/m; φ${r.r.d2} ≥ ${f(Math.max(6, r.bm.d / 4), 0)}`,
            lp(r.okSec),
          ]
        : ['8 Secondary', 'ΣAs ≥ max(ρmin·b·h, 0.2·As,main) (9.3.1.1(a))', `2 × T${r.r.d2}@${r.r.s2}`, `${f(r.secProv, 0)} ≥ ${f(r.secReq, 0)}`, lp(r.okSec)],
      [
        '9 Spacing',
        'main ≤ min(2h,250); secondary ≤ min(3h,400); clear ≥ max(φ, 25) (9.3.1.1(b))',
        `${r.bm.s} / ${r.r.s2} / ${r.bo.s}`,
        `main ${r.bm.s} ≤ ${f(r.sMain, 0)}; secondary ${r.r.s2} ≤ ${f(r.sSec, 0)} mm`,
        lp(r.okS),
      ],
      [
        '10 Crack control',
        r.crk ? 'clear s ≤ min(47000/fs, 300)/ρreq (9.2.1.4, 9.3.1.1(b))' : 'h ≤ 200 or ρreq < 0.3% – no further check',
        r.crk ? `fs = ${f(r.fs, 0)} N/mm²; ρreq = ${f(r.rq, 3)}%` : `ρreq = ${f(r.rq, 3)}%`,
        r.crk ? `${f(r.bm.s - r.bm.d, 0)} ≤ ${f(r.Sc, 0)} mm` : '',
        lp(r.okCr),
      ],
      ['11 Cover ≥ bar size', 'Cl 4.2.4.1(b)', `${r.cm} / ${r.co} mm`, '', lp(r.okC)],
      ...(r.gv
        ? ([
            [
              '12 Section classification',
              'CoP Cl 9.2.1.1, Table 9.1',
              `As,prov ${f(r.Asp, 0)} vs Table 9.1 minimum ${f(r.tab9, 0)} mm²/m`,
              r.Asp >= r.tab9 ? 'reinforced section' : 'section with crack-control bars only (strength not relied upon)',
              '',
            ],
          ] as [string, string, string, string, string][])
        : []),
      ...X13,
    ]) +
    '</div>';

  let h7 = '';
  if (!isG(S)) {
    h7 =
      `<h2 class="pb">7. Structural design${CX(' – CoP SUC 2013 (2020 Ed.)')}</h2>` +
      `<p><b>Earth pressure for structural design:</b> ${
        S.rck === 'ka' ? kaTxt : S.rck === 'ko' ? koTxt : 'envelope of ' + kaTxt + ' and ' + koTxt
      } ${
        S.rck === 'ka'
          ? ' (active: wall free to yield, GG1 §6.2).'
          : S.rck === 'ko'
          ? ' – Ko (at-rest), conservative for structural design – GG1 §10.2, Table 20.'
          : ' (worse of active and at-rest, GG1 §10.2).'
      }${cmpTxt()} Unfactored soil parameters; ULS by load factors (GG1 §4.3.5).${
        gpF(S, 'gpA') > 1 ? ` As,req × γproj ${f(gpF(S, 'gpA'), 2)} (project-specific).` : ''
      }</p>` +
      `<div class="xp">` +
      T(
        ['Comb.', 'CoP Table 2.1', 'Earth & water γf', 'Imposed (surcharge, barrier)', 'Wind', 'Dead adverse / beneficial'],
        COMBS.map((c) => [c.id, c.n, String(c.gE), c.gQ ? String(c.gQ) : '– (excluded)', c.gW ? String(c.gW) : '–', `${c.gGa} / ${c.gGb}`])
      ) +
      `</div>` +
      `<p class="mu xp">Wind and barrier load are applied as separate cases (DIL 3.8.1.1). Toe / heel actions from base pressure re-computed under each factored load set (equilibrium); downward loads on the toe taken at γf = 1.0 (beneficial). Passive resistance excluded from structural equilibrium (conservative).</p>` +
      `<p><b>Basis of minimum reinforcement:</b> ${
        S.smb !== 'slab'
          ? `<b>Stems</b> – designed as RC walls: CoP Cl 9.6.2 vertical ≥ 0.4% of b·h (half at each face), Cl 9.6.3 horizontal ≥ ${
              +S.fy === 250 ? '0.30' : '0.25'
            }% of b·h, φh ≥ φv/4, s ≤ 400 mm (adopted although Cl 9.6.1 permits slab rules for walls in predominantly out-of-plane bending – conservative, BD practice). <b>Base (toe / heel)</b> – slab rules`
          : 'CoP Cl 9.6.1 – “for walls subjected predominantly to out-of-plane bending the rules for slabs apply”. Hence, for stems and base'
      }: Cl 9.3.1.1(a): ${S.rmin}% × αmin (= ${f(aMin(S), 3)}, Table 9.1 note 2) for tension reinforcement, ${S.rmin}% total in each direction, secondary ≥ 20% of principal; Cl 9.2.1.3 maximum 4%.</p>` +
      cvTab(1, 1);

    if (RS.length) {
      h7 +=
        `<h3>7.1 Reinforcement schedule</h3>` +
        rcSch() +
        RS.map((r) => {
          const bs = r.k === 's' + (S.st.length - 1) || /^x\d+$/.test(r.k);
          if (!bs) return rcBlk(r);
          const a = ancRC(S, r);
          return rcBlk(r, [
            [
              '12 Starter bars into the base',
              `L_anch = 0.87fy·φ / (4·fbu), fbu = β√fcu (CoP Cl 8.4, β = ${a.be}, bars in tension)`,
              `0.87 × ${a.fy} × ${a.phi} / (4 × ${a.be} × √${a.fcu}) = ${f(a.lb, 0)} mm = ${f(a.lb / a.phi, 1)}φ`,
              a.ok
                ? `straight depth in base ${f(a.av, 0)} mm ≥ ${a.emb} mm`
                : `straight depth in base ${f(a.av, 0)} mm < ${a.emb} mm → L-bars hooked under the base bottom layer; total anchorage incl. bend ≥ ${a.emb} mm`,
              '',
            ],
          ]);
        }).join('');
    }
  } else {
    // Gravity wall Section 7 (GG1 §9.3.2 & CoP SUC 2013)
    const nRC = RS.length;
    h7 =
      `<h2 class="pb">7. Structural design${CX(' – Geoguide 1 §9.3.2 &amp; CoP SUC 2013 (2020 Ed.)')}</h2>` +
      `<h3>7.1 Design basis</h3>` +
      `<p class="xp">Geoguide 1 §9.3.2: the mass concrete wall is designed by the §9.2 stability checks (Section 6, incl. each change in section, Fig. 40). ${
        S.gmr === 'cc' ? `Minimum / anti-crack reinforcement: ${mbName(S)} (7.3).` : 'No reinforcement in the mass concrete.'
      }${nRC ? ` RC stems (${RS.map((r) => r.n).join(', ')}): CoP SUC 2013, 7.2.` : ''}</p>` +
      `<div class="xp">` +
      T(
        ['Element of design (GG1 Table 20)', 'Earth pressure in backfill', 'Compaction-induced lateral pressure', 'Geotechnical parameters'],
        [
          ['ULS: sliding, overturning, bearing capacity (Section 6)', 'Active', 'No need to consider', 'Factored'],
          ['Middle-third / middle-half rule (Section 6)', 'Active', 'No need to consider', 'Unfactored'],
          ['Stability at each change in section (Section 6)', 'Active', 'No need to consider', 'Factored'],
          ...(nRC
            ? [
                [
                  'Structural design of RC elements (7.2)',
                  S.rck === 'ka' ? 'Active (movement justified)' : S.rck === 'ko' ? 'At-rest' : 'Envelope of active and at-rest',
                  cmpOn(S) ? 'Considered' : 'Not considered',
                  'Unfactored × CoP γf',
                ],
              ]
            : []),
        ],
        'l'
      ) +
      `</div>` +
      (!nRC
        ? ''
        : `<p class="xp"><b>Earth pressure for the RC elements:</b> ${
            S.rck === 'ka' ? kaTxt : S.rck === 'ko' ? koTxt : 'envelope of ' + kaTxt + ' and ' + koTxt
          }. ${
            S.rck === 'ka'
              ? 'Active state – GG1 Table 20 note (1): wall movement is sufficient to mobilise the active condition (to be justified).'
              : S.rck === 'ko'
              ? 'Ko (at-rest), as required by GG1 Table 20 for structural design.'
              : 'Worse of active and at-rest governs each check.'
          }${cmpTxt()} Unfactored soil parameters; ULS by load factors (GG1 §4.3.5).</p>` +
          `<p><b>Load combinations</b> (CoP SUC 2013 Table 2.1):</p>` +
          T(
            ['Comb.', 'CoP Table 2.1', 'Earth & water γf', 'Imposed (surcharge, barrier)', 'Wind', 'Dead adverse / beneficial'],
            COMBS.map((c) => [c.id, c.n, String(c.gE), c.gQ ? String(c.gQ) : '– (excluded)', c.gW ? String(c.gW) : '–', `${c.gGa} / ${c.gGb}`])
          )) +
      cvTab(nRC, MS.length);

    // 7.2 RC elements + starter bar anchorage
    h7 +=
      `<h3>7.2 RC elements</h3>` +
      (nRC
        ? `<p class="mu">RC stem designed as reinforced concrete; minimum steel ${
            S.smb !== 'slab'
              ? `as an RC wall – CoP Cl 9.6.2 (0.4% vertical, half each face) and Cl 9.6.3 (${+S.fy === 250 ? '0.30' : '0.25'}% horizontal)`
              : `by Cl 9.6.1 slab rules – Cl 9.3.1.1(a), ${S.rmin}% × αmin`
          }. Step 12: starter bars anchored into the mass concrete below (CoP Cl 8.4).</p>` +
          rcSch() +
          RS.map((r) => {
            const a = anch(S, r);
            return rcBlk(r, [
              [
                `12 Starter bar anchorage into ${a.rcB ? 'RC below' : 'mass concrete'}`,
                `L_anch = 0.87fy·φ / (4·fbu), fbu = β√fcu (CoP Cl 8.4, eq 8.4 / eq 8.3; β = ${a.be} for ${
                  a.fy === 250 ? 'plain round bars' : 'Type 2 deformed bars'
                } in tension, Table 8.3)`,
                `0.87 × ${a.fy} × ${a.phi} / (4 × ${a.be} × √${a.fcu}) = ${f(a.lb, 0)} mm = ${f(a.lb / a.phi, 1)}φ`,
                `use ${a.n}φ = ${a.L} mm → embed ≥ ${a.emb} mm into ${a.into}; depth available ${f(a.av, 0)} mm ${a.ok ? '≥' : '<'} ${a.emb}`,
                lp(a.ok),
              ],
            ]);
          }).join('')
        : '<p class="mu">No RC elements – the whole wall is mass concrete (tick “RC” on a stem in Step 2 to design that stem as reinforced concrete).</p>');

    // 7.3 Minimum / anti-crack steel
    h7 +=
      `<h3>7.3 ${S.gmr === 'cc' ? mbName(S) : 'Minimum / anti-crack steel'} – schedule (detailing, not relied upon for strength)</h3>` +
      (MS.length
        ? `<p>Basis: <b>${MBN[S.gmb || '965'] || MBN['965']}</b>. ${
            S.gmb === '965' || !S.gmb
              ? `Reinforcement to control cracking due to flexure or thermal and hydration shrinkage, at least ${S.grho}% in each direction, half near each face; surface zone h_eff = min(h/2, ${f(hEffMax(S), 0)} mm) per face (CIRIA C660 / BS 8007 concept).`
              : `CoP Cl 9.3.1.1(a): minimum ${S.grmin}% (fy ${S.fy}) of the concrete cross-sectional area in each direction${
                  S.gmb === '913t' ? ', taken as the total of both faces' : ', applied to each face (conservative)'
                }; h = full member thickness for vertical / horizontal bars and block height for top / bottom bars. αmin (tension reinforcement) not applied – bars are not tension reinforcement.`
          } Spacing ≤ 300 mm.</p>` +
          T(
            ['Section', 'Bars', 'h (mm)', 'Requirement', 'As,req (mm²/m)', 'Provided', 'As,prov (mm²/m)', 'Spacing', 'Status'],
            MS.map((m) => [
              m.sec,
              m.lab,
              f(m.hm, 0),
              m.rtx,
              f(m.need, 0) + (m.tot ? ' (both faces)' : ' per face'),
              `T${m.d}@${m.sp}${m.k === 't' || m.k === 'b' ? ' top & bottom' : ' each face'}`,
              f(m.tot ? m.prov : m.Ap, 0) + (m.tot ? ` (${m.pair === 'tb' ? 'top + bottom' : '2 faces'})` : ''),
              `${m.sp} ${lp(m.okS)}`,
              `${lp(m.ok)} ${f(100 * m.u, 0)} %`,
            ]),
            'l'
          ) +
          `<p><b>Note:</b> ${
            S.gmb === '965' || !S.gmb
              ? 'Nominal surface anti-crack mesh is provided to control early thermal and hydration shrinkage cracking'
              : 'Minimum reinforcement to CoP Cl 9.3.1.1(a) is provided for crack control'
          } and is NOT relied upon for flexural or shear strength – the stability of the mass concrete wall is demonstrated in Section 6 (GG1 §9.2).</p>`
        : '<p class="mu">Not provided – the mass concrete is unreinforced (Step 5 “Unreinforced mass concrete”). Select “Minimum / anti-crack steel” to schedule bars.</p>');
  }

  // 7.2 / 7.4 Curtailment & Lap Length Table
  if (RS.length) {
    const DG = dgCalc(S, R0);
    const stemRs = RS.filter((r) => DG[r.k] && /^[sx]/.test(r.k));
    if (stemRs.length) {
      const CUmap = dgCU(S, R0, DG);
      const secNo = isG(S) ? '7.4' : '7.2';
      const rows = stemRs.map((r) => {
        const C = CUmap[r.k];
        const b = rcv(S, r.k);
        const l1 = lapReq(S, r.k);
        const l3 = lapReq(S, r.k, 3);
        const pts = DG[r.k];
        return [
          esc(r.n),
          `${f(pts[0].M)} / ${f(pts[0].V)}`,
          C
            ? C.none
              ? `No – ${C.why}`
              : `T${C.phi}@${2 * C.s} stop at <b>+${f(C.zc ?? 0)}</b> (theoretical +${f(C.zt ?? 0)} + max(d ${f(C.d ?? 0, 0)}, 12φ ${12 * C.phi}, ℓb ${f(C.lb ?? 0, 0)}) = ${f(C.ext ?? 0, 0)} mm)`
            : '–',
          l1 ? `T${b.d}: <b>${l1}</b>${b.d3 !== b.d && l3 ? ` · T${b.d3}: <b>${l3}</b>` : ''}` : '–',
        ];
      });
      h7 +=
        `<h3>${secNo} Curtailment of 50% main bars and lap lengths</h3>` +
        T(
          ['Element', 'M / V at base (kNm/m, kN/m)', 'Curtailment of 50 % main bars' + CX(' (CoP Cl 9.2.1.6)'), 'Lap length, mm' + CX(' (CoP Cl 8.7.4.1)')],
          rows,
          'l'
        ) +
        `<p class="mu xp">Curtailment: the remaining 50 % of the main bars satisfy bending and the minimum steel above the theoretical point; the stopped bars extend beyond it by the greater of d, 12φ and the anchorage length ℓb = 0.87fy·φ/(4β√fcu) (bars stopped in a tension zone). Lap length = max(ℓb, 15φ, 300 mm), rounded up to 50 mm; factor 1.0 – laps not at the top of a pour with cover &lt; 2φ, not at corners, staggered (×1.4 / ×2.0 otherwise).</p>`;
    }
  }

  return h7;
}

/* ---------------- Section 8: Internal Limitations & Verification ---------------- */

export function renderLimitsSec8(S: WallState, R0: CalcAllSuccessResult): string {
  const { G, V, P, X } = R0;
  const WTB = T(
    ['Wall type', 'Plane on which Pa is calculated', 'δmax (GG1 Table 14)', 'Soil counted in W', 'Geoguide 1 reference'],
    [
      ['Gravity – mass concrete', 'Soil / wall interface: the concrete back face (stepped: at the locations of Fig. 40)', '2φ′/3', 'Soil resting on the steps / batters of the wall', '§9.2, §9.3, Table 14, Figs. 39 & 40'],
      ['Cantilever – inverted T', 'Vertical virtual back through the heel', 'min(φ′/2, backfill slope β)', 'All backfill between the stem back face and the virtual back', '§10.2, Table 14, §5.11.2'],
      ['L-wall (heel only)', 'Vertical virtual back through the heel', 'min(φ′/2, backfill slope β)', 'Backfill carried on the heel', '§10.2, Table 14, §5.11.2'],
      ['Reversed L (toe only)', 'Soil / wall interface: the concrete back face (no heel)', '2φ′/3', 'None behind the wall', 'Table 14, §5.11.2'],
    ],
    'l'
  );

  const activeName = ({ G: 'Gravity – mass concrete', T: 'Cantilever – inverted T', L: 'L-wall (heel only)', Li: 'Reversed L (toe only)' } as Record<string, string>)[S.ty] || '';

  const nc: [string, string][] = [
    ['Overall / global slope stability', 'GG1 §9.2.3(1); Geotechnical Manual for Slopes'],
    ['Tilted-base sliding; shear key mechanism 2 (inclined plane) and structural design of the key', 'GG1 Figs. 41, 42 (key: mechanism 1 checked)'],
    ['Point loads / strip loads on the retained surface', 'GG1 Fig. 29(b), §7.3.4–7.3.5'],
    ['External stability at each step of a stepped RC wall', 'GG1 §9.2.3(2), Fig. 40 (mass concrete stems checked in Section 6)'],
    ['Settlement, tilting, deformation', 'GG1 §9.2.4'],
    ['Hydraulic failure (piping / heave)', 'GG1 §8.6'],
    ['Irregular / broken backfill profile, layered retained soil (trial wedge)', 'GG1 §6.5.6'],
    ...(scOn(S) ? [] : ([['Bearing near slope crest (interpolation)', 'GG1 Fig. A4; FC 2017 Fig. 2.3']] as [string, string][])),
    ['Undrained (φ = 0) bearing / short-term case', 'GG1 Fig. A3'],
    ['Groundwater below founding level within B′ (γ′ interpolation)', 'FC 2017 Cl 2.2.4 note 6(c)'],
    ['Direct crack-width calculation, early thermal cracking', 'CoP Cl 7.2.3, 7.2.4'],
    ['Laps, curtailment; bend anchorage of starter bars (straight anchorage checked in 7)', 'CoP Section 8, Cl 9.2.1.6'],
    ['Deflection', 'CoP 7.3'],
    ...((G.XS || []).length
      ? ([
          ['Stems on base: differential settlement between tiers / walls; each tier treated as part of one rigid wall on one base', 'GG1 §9.2.4'],
          ['Stems on base: shape limited to rectangular RC stems; no fence / vehicle barrier on stems on base (pedestrian parapet only)', '–'],
          ...(isU(S) ? ([['U-channel: water inside the channel (beneficial, ignored); flotation with water outside only', 'FC 2017 Cl 2.5.4']] as [string, string][]) : []),
        ] as [string, string][])
      : []),
    ['Seismic / landslide debris impact', 'GG1 §7.4; GEO TGN 42'],
    ['Drainage design (filter, weepholes)', 'GG1 Chapter 8'],
  ];

  const rvl: string[] = [
    ...V.W,
    ...(S.wo && +S.wsd < 0.8 ? ['Fence with φ < 0.8 treated as open framework (Wind Code Table 4-2).'] : []),
    ...(isG(S) ? ['Horizontal construction joints in the mass concrete: sliding at a discontinuity (GG1 §9.2.3(2)) is calculated separately and is not included in this submission appendix.'] : []),
    ...(S.gpon ? [`Project-specific factor γproj = ${f(Math.max(1, +S.gpv || 1), 2)} – not a code value; source: ${esc(S.gpsrc || 'NOT STATED')}.`] : []),
    ...(S.rck === 'ka' && X ? ['RC structural design uses Ka – GG1 §10.2 / Table 20 expects at-rest (Ko) for rigid walls; confirm wall movement justifies active state.'] : []),
    ...(S.kam === 'm' || S.kpm === 'm' ? ['Manual Ka / Kp values – Engineer to confirm both characteristic and GG1-factored values.'] : []),
    ...(P && (S.wo || S.bro) ? ['GG1 Table 6 does not list wind / barrier loads; treated as variable load with γf = ' + S.gq + ' in GG1 ULS (assumption).'] : []),
    'Design water level and drainage basis to be stated (GG1 §8.3, §9.3.5).',
    'Soil parameters to be derived from GI per GG1 Chapter 5.',
  ];

  return (
    `<h2>8. Internal limitations (not printed)</h2>` +
    `<p class="mu">This tab is for the designer only and is excluded from the report preview and PDF. This calculation covers external stability of a wall on a level base and the structural checks listed in Section 7. It is not a complete retaining wall design.</p>` +
    `<h3>8.1 NOT CHECKED</h3>` +
    T(
      ['Item', 'Reference', 'Status'],
      [
        ...CKL.filter(([id]) => !ckOn(S, id)).map(([id, n]) => [
          `${n} – switched off by user`,
          `Reason: ${esc((S.ck && S.ck[id] && S.ck[id].why) || 'NOT STATED')}`,
          lp('nc'),
        ]),
        ...nc.map(([a, b]) => [a, b, lp('nc')]),
      ],
      'l'
    ) +
    `<h3>8.2 Basis adopted for each wall type (Geoguide 1)</h3><p class="mu">The row in bold applies to this wall.</p>` +
    WTB.replace(`<td>${activeName}</td>`, `<td><b>${activeName}</b></td>`) +
    `<h3>8.3 REQUIRES VERIFICATION</h3>` +
    T(['Item', 'Status'], rvl.map((x) => [x, lp('rv')]), 'l')
  );
}
