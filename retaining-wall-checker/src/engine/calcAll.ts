/**
 * Master calculation orchestrator (calcAll) and Check Register generator (regRows).
 * Pure & stateless: clones and syncs input state before running calculations.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { koVal, params } from './earthPressure';
import { concArea, geo, massEls, steelKg } from './geometry';
import { ckOn, isG, qVal, syncedClone, vSOn } from './helpers';
import { comp, ev, topCases } from './loads';
import { f } from './math';
import { cvAll, dsg, mbName, meshSched, rcActions } from './rcDesign';
import { accImp, d0Chk, fc17, gg1, otF, secChecks, utilOf } from './stability';
import type {
  CalcAllResult,
  CalcAllSuccessResult,
  CheckRegisterRow,
  RcDesignElement,
  WallState,
} from './types';
import { validate } from './validate';

export function calcAll(rawState: WallState): CalcAllResult {
  const S = syncedClone(rawState);
  const G = geo(S);
  const V = validate(S);
  const Pk = params(S, 'k', null, G);
  const Pf = params(S, 'f', null, G);
  const q = qVal(S);
  const P = S.acc === 'gg1';
  if (V.E.length) return { err: 1, G, V, Pk, Pf, q, P };

  const A = gg1(S);
  const Fc = fc17(S);
  const tops = topCases(S, G);
  const gov = tops.length > 1 ? tops.reduce((a, b) => (b.F * b.z > a.F * a.z ? b : a)) : tops[0];
  const Ck = comp(S, Pk, gov.k === 'none' ? null : gov);
  const sk = ev(Ck, {}, { ppM: S.ppO });
  const ko = koVal(S);
  const dK = Pk.d;
  const kSet: [number, number, string][] =
    S.rck === 'ka'
      ? [[Pk.Kah, dK, 'Ka']]
      : S.rck === 'ko'
        ? [[ko, 0, 'Ko']]
        : [
            [Pk.Kah, dK, 'Ka'],
            [ko, 0, 'Ko'],
          ];
  const runs = kSet.map(([K, d, l]) => ({ l, els: rcActions(S, K, d) }));
  let rawRS = runs[0].els.map((e) => ({ ...e }));
  if (runs.length > 1) {
    rawRS = rawRS.map((a, i) => {
      const b = runs[1].els[i];
      const m = { ...a };
      if (Math.abs(b.M) > Math.abs(a.M)) {
        m.M = b.M;
        m.gov = b.gov + ' (Ko)';
      }
      if (Math.abs(b.V) > Math.abs(a.V)) m.V = b.V;
      m.bad = a.bad || b.bad;
      return m;
    });
  }
  const hn = rawRS.find((e) => e.n.startsWith('Heel –'));
  const he = rawRS.find((e) => e.k === 'H' && !e.n.startsWith('Heel –'));
  if (hn && he) {
    he.hnM = hn.M;
    he.hnV = hn.V;
    if (S.hnr) {
      if (Math.abs(hn.M) > Math.abs(he.M)) {
        he.M = hn.M;
        he.gov = hn.gov + ' (relief ignored)';
      }
      if (Math.abs(hn.V) > Math.abs(he.V)) he.V = hn.V;
    }
  }
  rawRS = rawRS.filter((e) => !e.n.startsWith('Heel –'));
  if (isG(S)) rawRS = rawRS.filter((e) => !e.gv);
  {
    const rk = (e: { k: string }) =>
      e.k[0] === 's' ? 0 : e.k[0] === 'x' ? 1 : e.k === 'T' ? 2 : e.k[0] === 'M' ? 3 : e.k === 'H' ? 4 : 5;
    rawRS.sort((a, b) => rk(a) - rk(b) || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  }
  const RS: RcDesignElement[] = rawRS.map((e) => dsg(S, e));

  const PL = secChecks(S);
  const okPlain = PL.every((p) => p.ok);
  const csO = PL.every((p) => p.na || p.okO);
  const csE = PL.every((p) => p.na || p.okE);
  const MS = meshSched(S, massEls(S, G), G);
  const okMesh = MS.every((m) => m.ok);
  const CA = cvAll(S, G).rows;
  const crOK = true;
  const okRC = RS.every((r) => r.ok);
  const u = utilOf(S, A, Fc, P, G.B);
  const X = S.xrc;
  const fails: string[] = [];
  const AI = S.accI && vSOn(S) ? accImp(S) : null;
  const D0 = d0Chk(S, P);

  if (D0 && !D0.u.okULS) {
    const F = D0.Fc;
    V.W.push(
      `GG1 Table 14 Note (2): with δ = 0 (wall able to settle relative to the backfill) the wall does NOT pass – ${
        P
          ? `sliding ${f(D0.u.sl, 3)}, overturning FOS ${f(D0.A.ot.F, 2)}, bearing ${f(D0.u.br, 3)} (utilisation)`
          : `sliding FOS ${f(F.sl.F, 2)}, overturning ${f(F.ot.F, 2)}, bearing ${f(F.br.F, 2)}`
      }. ${
        S.gis
          ? `The adopted δ = ${f(Pk.d, 1)}° is supported by the GI (founding material${S.gir ? ' – ' + S.gir : ''}).`
          : `The adopted δ = ${f(Pk.d, 1)}° must be justified: no compressible stratum below the founding level (GI) and an estimate showing the wall does not settle relative to the backfill; otherwise design with δ = 0 (Step 3 “compressible ground”).`
      }`,
    );
  }

  const gvO = PL.filter((p) => !p.na && !p.okO).map((p) => '+' + f(p.Ls));
  const gvE = PL.filter((p) => !p.na && !p.okE).map((p) => '+' + f(p.Ls));
  if (P) {
    if (!A.okS) fails.push('Sliding');
    if (!A.okO || !csO) fails.push('Overturning' + (gvO.length ? ` (change in section ${gvO.join(', ')})` : ''));
    if (!A.okB) fails.push('Bearing');
  } else {
    if (!Fc.okS) fails.push('Sliding');
    if (!Fc.okO || !csO) fails.push('Overturning' + (gvO.length ? ` (change in section ${gvO.join(', ')})` : ''));
    if (!Fc.okB) fails.push('Bearing');
    if (!Fc.okU) fails.push('Uplift');
  }
  if (ckOn(S, 'ecc') && !((A.okE || A.naE) && csE)) {
    fails.push('Eccentricity (middle third' + (gvE.length ? `, change in section ${gvE.join(', ')}` : '') + ')');
  }
  if (X && ckOn(S, 'rc') && RS.length && !okRC) {
    fails.push(isG(S) ? 'Structural (RC stem)' : 'RC design');
  }
  if (X && ckOn(S, 'mesh') && MS.length && !okMesh) fails.push(mbName(S) + ' (detailing)');
  if (AI && !AI.ok) fails.push('Accidental impact (vehicle)');

  return {
    G,
    V,
    Pk,
    Pf,
    q,
    P,
    A,
    Fc,
    gov,
    Ck,
    sk,
    ko,
    RS,
    PL,
    MS,
    okMesh,
    CA,
    crOK,
    okRC,
    okPlain,
    csO,
    csE,
    u,
    fails,
    X,
    AI,
    D0,
    vol: concArea(S, G),
    steel: steelKg(S, RS, G) + MS.reduce((a, m) => a + m.wt, 0),
  };
}

/** Check register rows for both UI status rail / table and decoupled A4 report */
export function regRows(S: WallState, R0: CalcAllSuccessResult): CheckRegisterRow[] {
  const { A, Fc, P, G, RS, PL, MS, okMesh, u, X, AI, csO, csE } = R0;
  const rows: CheckRegisterRow[] = [];
  const PLc = PL.filter((p) => !p.na);
  const gOt = PLc.reduce<(typeof PLc)[number] | null>((a, p) => (!a || p.uO > a.uO ? p : a), null);
  const gEc = PLc.reduce<(typeof PLc)[number] | null>((a, p) => (!a || p.uE > a.uE ? p : a), null);
  const at = (p: (typeof PLc)[number]) => ` – change in section +${f(p.Ls)}`;
  const add = (
    id: string,
    n: string,
    cl: string,
    st: CheckRegisterRow['st'],
    pv: string,
    rq: string,
    det: string,
    lk: number,
    uu?: number | null,
    gp: 's' | 'r' = 's',
  ) => rows.push({ id, n, cl, st, pv, rq, det, lk, u: uu, gp });

  const off = (id: string) => !ckOn(S, id);
  const keyS = S.skon ? ' (shear key)' : '';
  const okS = (x: number) => x <= 1 + 1e-9;

  if (P) {
    const gS = A.sl.gp || 1;
    const gO = A.ot.gp || 1;
    const gx = (gVal: number) => (gVal > 1 ? ` (γproj ${f(gVal, 2)})` : '');
    add(
      'sl',
      'Sliding' + keyS,
      'GG1 §9.2.3, Fig. 39',
      okS(A.sl.u),
      `Fr / Fa = ${f(A.sl.Fr)} / ${f(A.sl.Fa ?? A.sl.s.H)} = <b>${f(gS / Math.max(A.sl.u, 1e-9), 2)}</b>`,
      `≥ ${f(gS, 2)}${gx(gS)}`,
      'factored soil strength (γm), factored surcharge',
      1,
    );
    {
      const sc = !!(gOt && gOt.uO > 1 / Math.max(A.ot.F, 1e-9));
      add(
        'ot',
        'Overturning' + (sc && gOt ? at(gOt) : ''),
        sc ? 'GG1 Figs. 39, 40' : 'GG1 Fig. 39',
        A.okO && csO,
        sc && gOt
          ? `M_R / Mo = ${f(gOt.MR, 2)} / ${f(gOt.Mo, 2)} = <b>${f(gOt.Fot, 2)}</b>`
          : `M_R / Mo = ${f(A.ot.s.Mr, 1)} / ${f(A.ot.s.Md, 1)} = <b>${f(A.ot.F * gO, 2)}</b>`,
        `≥ ${f(gO, 2)}${gx(gO)}`,
        'factored parameters' +
          (PLc.length
            ? `; founding level ${f(A.ot.F * gO, 2)}${PLc.map((p) => `, +${f(p.Ls)} ${f(p.Fot, 2)}`).join('')}`
            : ''),
        1,
      );
    }
    {
      const sc = !!(gEc && gEc.uE > (A.naE ? 0 : u.ec));
      add(
        'ecc',
        'Eccentricity – middle third' + (sc && gEc ? at(gEc) : ''),
        sc ? 'GG1 §9.2.4, Fig. 40' : 'GG1 §9.2.4',
        off('ecc') ? 'nc' : sc ? (A.okE || A.naE) && csE : A.naE ? (csE ? 'na' : false) : okS(u.ec) && csE,
        sc && gEc
          ? `e = <b>${f(gEc.ek, 3)}</b> m`
          : A.naE
            ? `e = ${f(A.sls.s.e, 3)} m`
            : `e = <b>${f(A.sls.s.e, 3)}</b> m`,
        sc && gEc ? `≤ h/6 = ${f(gEc.h / 6, 3)} m` : A.naE ? 'rule need not apply (e < 0)' : `≤ B/6 = ${f(G.B / 6, 3)} m`,
        'unfactored' +
          (PLc.length
            ? `; founding level e = ${f(A.sls.s.e, 3)} m (B/6 = ${f(G.B / 6, 3)})${PLc.map(
                (p) => `, +${f(p.Ls)} e = ${f(p.ek, 3)} m (h/6 = ${f(p.h / 6, 3)})`,
              ).join('')}`
            : ''),
        0,
      );
    }
    add(
      'br',
      'Bearing capacity',
      'GG1 App. A, Fig. A2',
      okS(A.br.u),
      `Qult / Qn = ${f(A.br.r.Qu, 0)} / ${f(A.br.b.N, 0)} = <b>${f(1 / Math.max(A.br.u, 1e-9), 2)}</b>`,
      '≥ 1.00',
      'strip footing, factored φ′, c′',
      1,
    );
  } else {
    add(
      'sl',
      'Sliding' + keyS,
      'FC 2017 Cl 2.5.4',
      Fc.okS,
      `R / H* = ${f(Fc.sl.R, 1)} / ${f(Fc.sl.Hst, 1)} = <b>${f(Fc.sl.Fe, 2)}</b>`,
      `≥ ${f(Fc.sl.ref, 2)}${Fc.gS > 1 ? ' (H* incl. γproj)' : ''}`,
      `H* = ΣH_O${
        Fc.sl.Hw > 0
          ? Fc.Fsw !== Fc.Fs
            ? ` + (${f(Fc.Fsw, 1)}/${f(Fc.Fs, 1)})·ΣH_GW`
            : ' + ΣH_GW'
          : ''
      }`,
      1,
    );
    {
      const sc = !!(gOt && gOt.uO > Fc.ot.u);
      add(
        'ot',
        'Overturning' + (sc && gOt ? at(gOt) : ''),
        sc ? 'FC 2017 Cl 2.5.4; GG1 Fig. 40' : 'FC 2017 Cl 2.5.4',
        Fc.okO && csO,
        sc && gOt
          ? `M_R / M* = ${f(gOt.MR, 2)} / ${f(gOt.Mreq / gOt.Freq, 2)} = <b>${f(gOt.Fot, 2)}</b>`
          : `M_R / M* = ${f(Fc.ot.s.Mr, 1)} / ${f(Fc.ot.Mst, 1)} = <b>${f(Fc.ot.Fe, 2)}</b>`,
        `≥ ${f(sc && gOt ? gOt.Freq : Fc.ot.ref, 2)}`,
        `M* = ${otF(Fc, Fc.ot)}${Fc.ot.Mw > 0 ? ' (case with wind)' : ''}${
          PLc.length
            ? `; founding level ${f(Fc.ot.Fe, 2)}${PLc.map((p) => `, +${f(p.Ls)} ${f(p.Fot, 2)}`).join('')}`
            : ''
        }`,
        1,
      );
    }
    add(
      'up',
      'Uplift',
      'FC 2017 Cl 2.5.4',
      Fc.up.s.U > 0 ? Fc.okU : 'na',
      Fc.up.s.U > 0 ? `W / U = ${f(Fc.up.s.W, 1)} / ${f(Fc.up.s.U, 1)} = <b>${f(Fc.up.s.W / Fc.up.s.U, 2)}</b>` : 'no uplift',
      Fc.up.s.U > 0 ? `≥ ${f(Fc.Fu, 2)}` : '–',
      '',
      1,
    );
    {
      const sc = !!(gEc && gEc.uE > (A.naE ? 0 : u.ec));
      add(
        'ecc',
        'Eccentricity – middle third' + (sc && gEc ? at(gEc) : ''),
        sc ? 'GG1 §9.2.4, Fig. 40' : 'GG1 §9.2.4',
        off('ecc') ? 'nc' : sc ? (A.okE || A.naE) && csE : A.naE ? (csE ? 'na' : false) : okS(u.ec) && csE,
        sc && gEc
          ? `e = <b>${f(gEc.ek, 3)}</b> m`
          : A.naE
            ? `e = ${f(A.sls.s.e, 3)} m`
            : `e = <b>${f(A.sls.s.e, 3)}</b> m`,
        sc && gEc ? `≤ h/6 = ${f(gEc.h / 6, 3)} m` : A.naE ? 'rule need not apply (e < 0)' : `≤ B/6 = ${f(G.B / 6, 3)} m`,
        'unfactored' +
          (PLc.length
            ? `; founding level e = ${f(A.sls.s.e, 3)} m (B/6 = ${f(G.B / 6, 3)})${PLc.map(
                (p) => `, +${f(p.Ls)} e = ${f(p.ek, 3)} m (h/6 = ${f(p.h / 6, 3)})`,
              ).join('')}`
            : ''),
        0,
      );
    }
    add(
      'br',
      'Bearing capacity',
      'FC 2017 Cl 2.2.4',
      Fc.okB,
      Fc.br.F === Infinity
        ? 'q ≤ qo'
        : `(qu − qo) / (q − qo) = ${f(Fc.br.qu - Fc.br.qo, 1)} / ${f(Fc.br.qap - Fc.br.qo, 1)} = <b>${f(Fc.br.F, 2)}</b>`,
      `≥ ${f(Fc.Fb, 2)}`,
      `q ${f(Fc.br.qap, 0)} ≤ qa ${f(Fc.br.qa, 0)} kPa`,
      1,
    );
  }
  if (AI) {
    add(
      'acc',
      'Accidental impact (vehicle)',
      'DIL Cl 3.8.3',
      AI.ok,
      `FOS ${f(AI.Fs, 2)} / ${f(AI.Fo, 2)} / ${AI.br.F === Infinity ? '∞' : f(AI.br.F, 2)}`,
      '≥ 1.00',
      'sliding / overturning / bearing, unfactored',
      1,
    );
  }
  if (X && RS.length) {
    RS.forEach((r, i) =>
      add(
        'rc',
        r.n,
        'CoP SUC 2013',
        off('rc') ? 'nc' : r.ok,
        `T${r.bm.d}@${r.bm.s} · As ${f(r.Asp, 0)} / ${f(Math.max(r.Asr, r.Asm), 0)} mm²/m`,
        '',
        r.ok ? '' : 'see Section 7',
        i ? 2 : 0,
        Math.max(r.uM, r.uV),
        'r',
      ),
    );
  }
  if (X && MS.length) {
    const mw = MS.reduce((a, m) => (m.u > a.u ? m : a));
    add(
      'mesh',
      mbName(S) + ' – detailing',
      S.gmb === '965' ? 'CoP Cl 9.6.5' : 'CoP Cl 9.3.1.1(a)',
      off('mesh') ? 'nc' : okMesh,
      `worst: T${mw.d}@${mw.sp} → ${f(mw.prov, 0)} mm²/m`,
      `≥ ${f(mw.need, 0)}`,
      'not relied upon for strength',
      0,
      null,
      'r',
    );
  }
  return rows;
}
