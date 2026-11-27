/**
 * Input validation (errors and engineering warnings) and step mapping.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */
import { CKL, DEG2RAD as R, G_WATER as g } from './constants';
import { wallDelta } from './earthPressure';
import { geo, keyG } from './geometry';
import {
  bfOn,
  ckOn,
  fdW,
  gTx,
  isG,
  isVeh,
  phiCv,
  qVal,
  scOn,
  stTT,
  vStemOn,
} from './helpers';
import { vehCalc } from './loads';
import { esc, f } from './math';
import { cvAll } from './rcDesign';
import type { ValidationResult, WallState } from './types';

export function validate(S: WallState): ValidationResult {
  const E: string[] = [];
  const W: string[] = [];
  const G = geo(S);

  if (!isG(S) && !S.st.length) E.push('At least one stem is required for this wall type.');
  S.st.forEach((s, i) => {
    const n = `Stem ${i + 1}`;
    if (!(+s.t > 0)) E.push(`${n}: bottom width must be > 0.`);
    if (+s.top < +s.bot - 1e-9) E.push(`${n}: top level is below the bottom level.`);
    if (+s.fb < 0 || +s.rb < 0) E.push(`${n}: front / rear batter cannot be negative.`);
    else if (+s.t > 0 && !(stTT(s) > 1e-3)) {
      E.push(`${n}: top width = t − front batter − rear batter = ${f(stTT(s))} m – must be > 0.`);
    }
  });
  if (S.st.length && !(G.top > G.bt + 1e-9)) {
    E.push('Total stem height is zero – give at least one stem a height (or remove it).');
  }
  if (isG(S)) {
    if (!(+S.gBt > 0)) E.push('Block top width must be > 0.');
    if (+S.gbf < 0) E.push('Block front batter cannot be negative.');
    if (bfOn(S)) {
      const b = S.bkf;
      if (!(+b.g > 0)) E.push('Backfill unit weight γ must be greater than zero.');
      if (+b.phi < 0 || +b.phi > 60) E.push('Backfill φ′ must be between 0° and 60°.');
      if (+b.c < 0) E.push('Backfill c′ cannot be negative.');
    }
    if (+S.gbr < 0) {
      E.push(
        'Block rear batter b_r cannot be negative – the back face may only batter towards the front (top narrower than the base).',
      );
    }
    if (!(+S.gBh > 0)) E.push('Block height must be > 0.');
  }
  {
    const SG = G.SG;
    const m = SG.length;
    SG.forEach((sg, i) => {
      if (!isG(S) && i === m - 1) return;
      const sup = i < m - 1 ? SG[i + 1] : null;
      const a = sup ? sup.xf1 : gTx(S);
      const b = sup ? sup.xb1 : a + Math.max(0, +S.gBt || 0);
      const nm = `Stem ${i + 1}`;
      if (!(sg.ts >= Math.max(0.1, 0.25 * sg.t) - 1e-6)) {
        E.push(
          `${nm} (x = ${f(sg.xf0)} to ${f(sg.xb0)} m from toe) has only ${f(sg.ts)} m bearing on the top of ${
            sup ? 'Stem ' + (i + 2) : 'the block'
          } (x = ${f(a)} to ${f(b)} m) – at least max(0.10 m, t/4) required. Adjust the width or front offset.`,
        );
      } else if (sg.ovF > 1e-6 || sg.ovB > 1e-6) {
        W.push(
          `${nm} overhangs the top of ${sup ? 'Stem ' + (i + 2) : 'the block'}${
            sg.ovF > 1e-6 ? ` by ${f(sg.ovF)} m at the front` : ''
          }${sg.ovF > 1e-6 && sg.ovB > 1e-6 ? ' and' : ''}${
            sg.ovB > 1e-6 ? ` by ${f(sg.ovB)} m at the back` : ''
          }: the joint section is taken as the bearing width ${f(sg.ts)} m (stability uses the full concrete weight). The overhang (nib / corbel) and its soffit / backfill below are to be detailed separately.`,
        );
      }
    });
  }
  if (!(S.tb > 0)) E.push('Base thickness must be > 0.');
  if (!isG(S) && S.xs && S.xs.length) {
    const XS = G.XS;
    const bt = G.bt;
    const UU = S.xa === 'U';
    if (UU && XS.length > 1) {
      E.push('U-channel: only one stem on base (the opposite wall) – remove the others or choose “Terraced”.');
    }
    if (XS.length > 2) E.push('At most 2 stems on base (3 stems on the base in total).');
    XS.forEach((a, j) => {
      const n = `Stem on base ${j + 1}`;
      const nx = j < XS.length - 1 ? XS[j + 1].x0 : G.Lt;
      if (!(a.t > 0)) E.push(`${n}: width must be > 0.`);
      if (!(a.h > 0)) E.push(`${n}: height must be > 0.`);
      if (j > 0 && a.x0 < XS[j - 1].x1 - 1e-6) {
        E.push(`${n} overlaps stem on base ${j} – list the stems from the toe towards the main stem.`);
      }
      a.segs.slice(1).forEach((sg) => {
        if (!(sg.t > 0) || !(sg.h > 0)) E.push(`${n} segment ${sg.k + 1}: width and height must be > 0.`);
      });
      if (a.xn0 < -1e-6) E.push(`${n}: a segment projects beyond the toe end of the base.`);
      if (a.xm > nx + 1e-6) {
        E.push(
          `${n} (x = ${f(a.x0)} to ${f(a.xm)} m) overlaps ${
            j < XS.length - 1 ? 'stem on base ' + (j + 2) : 'the main stem (front face x = ' + f(G.Lt) + ' m)'
          } – reduce x or increase the toe length.`,
        );
      } else if (nx - a.x1 < 0.5 - 1e-6) {
        W.push(`${n}: clear gap to the next stem is only ${f(nx - a.x1)} m.`);
      }
      if (!UU) {
        const zt = +a.s.zt;
        if (!(zt >= bt - 1e-6 && zt <= a.top + 1e-6)) {
          E.push(`${n}: terrace level must be between the base top +${f(bt)} and the stem top +${f(a.top)} mPD.`);
        }
        const up = j < XS.length - 1 ? XS[j + 1].zt : +S.Hr;
        if (zt > up + 1e-6) {
          W.push(`${n}: terrace level +${f(zt)} is above the level retained behind the next stem (+${f(up)}).`);
        }
      }
    });
    const a0 = XS[0];
    if (a0) {
      if (S.fon && +S.Hf > a0.top + 1e-6) {
        E.push(`Front ground level +${f(+S.Hf)} is above the top of stem on base 1 (+${f(a0.top)} mPD).`);
      }
      if (UU && !S.fon) {
        E.push('U-channel: tick “Front soil considered” in Step 3 – the soil retained by the opposite wall is the front soil (Front GL).');
      }
      if (UU && +S.Hf <= bt + 1e-6) {
        W.push('U-channel: front (outer) ground level is at or below the base top – the opposite wall retains no soil.');
      }
    }
  }
  if (+S.dp < 0) E.push('Passive neglect depth cannot be negative.');
  if (S.acc !== 'gg1' && S.dfm === 'ogl' && +S.ogl < +S.Zb) {
    E.push('Original ground level is below the foundation base.');
  }
  if (S.acc !== 'gg1' && S.fon && S.dfm === 'ogl' && +S.ogl > +S.Hf) {
    W.push('qo based on original ground above the final front level (excavation relief). Justify that this overburden existed before excavation (CoP Foundations 2017 Cl 2.2.4).');
  }
  if (qVal(S) < 0 || +S.qin < 0) E.push('Surcharge cannot be negative.');
  for (const [k, s] of [
    ['r', 'Retained'],
    ['f', 'Foundation'],
  ] as const) {
    if (+S[k].c < 0) E.push(`${s} c′ cannot be negative.`);
    if (!(+S[k].g > 0)) E.push(`${s} γ must be > 0.`);
  }
  if (S.acc !== 'gg1' && [S.Fs, S.Fo, S.Fow, S.Fb].some((v) => !(+v >= 1))) {
    E.push('Factors of safety must be ≥ 1.0.');
  }
  if (S.acc === 'gg1' && (!(+S.gm >= 1) || !(+S.gq >= 0))) E.push('Partial factors invalid.');
  if (S.wo && !(+S.wh > 0)) E.push('Fence height must be > 0.');
  if (scOn(S) && !(+S.scb >= 0)) E.push('Slope crest: distance b must be ≥ 0.');
  if (S.fdl && !(fdW(S) > 0)) E.push('Fence self-weight P must be > 0.');
  if (S.bro && !vStemOn(S) && !(+S.bhb > 0)) E.push('Barrier height must be > 0.');
  if (!(+S.gc > 0)) E.push('Concrete unit weight must be > 0.');
  if (S.xrc) {
    for (const k in S.rc) {
      const ro = S.rc[k];
      if (!ro) continue;
      for (const x of ['s', 's2', 's3'] as const) {
        const v = +ro[x];
        if (ro[x] != null && !(v >= 75 && v <= 400)) {
          E.push(`Bar spacing ${v} mm outside 75–400 mm.`);
        }
      }
    }
  }
  if (!isG(S) && (+S.Lt < 0 || +S.Lh < 0)) E.push('Toe / heel length cannot be negative.');
  if (S.bon && S.Hr > G.top + 1e-6) {
    E.push(`Retained soil level (+${f(S.Hr)}) is above the wall top (+${f(G.top)}).`);
  }
  if (S.Hr < S.Zb) E.push('Retained soil level is below the base.');
  if (S.fon && S.Hf > S.Hr) {
    E.push('Front soil level is above retained soil level – not covered by this model.');
  }
  if (S.fon && S.fw > S.Hf) W.push('Front design GWL above front ground level – check.');
  for (const [k, s] of [
    ['r', 'Retained'],
    ['f', 'Foundation'],
  ] as const) {
    if (!(S[k].phi > 0 && S[k].phi < 55)) {
      E.push(`${s} φ′ must be between 0° and 55° (φ = 0 undrained not supported).`);
    }
    if (S[k].gs < g) E.push(`${s} γsat must be ≥ γw.`);
  }
  if (phiCv(S) > S.f.phi + 1e-9) {
    W.push('φcv′ exceeds foundation φ′ – δb is capped by GG1 §5.12 (≤ φ′ of undisturbed soil).');
  }
  if (S.dbm === 'c' && +S.dcb > S.f.phi) {
    E.push('Custom δb exceeds foundation φ′ – not permitted (GG1 §5.12).');
  }
  if (!(S.wsd > 0 && S.wsd <= 1)) E.push('Solidity ratio must be within (0, 1].');
  if (S.acc === 'gg1') {
    if (+S.gm < 1.2) W.push('γm below Geoguide 1 Table 7 minimum (1.2).');
    if (+S.gq < 1.5) W.push('γf for surcharge below Geoguide 1 Table 6 minimum (1.5).');
  } else {
    if (+S.Fs < 1.5) W.push('FOS sliding below 1.5 (CoP Foundations 2017 Cl 2.5.4).');
    if (+S.Fo < 2) W.push('FOS overturning (other loads) below 2.0 (CoP Foundations 2017 Cl 2.5.4).');
    if (+S.Fow < 1.5) W.push('FOS overturning (wind) below 1.5 (CoP Foundations 2017 Cl 2.5.4).');
    if (+S.Fb < 3) W.push('FOS bearing below 3 (CoP Foundations 2017 Cl 2.2.4).');
  }
  {
    const phR = S.acc === 'gg1' ? Math.atan(Math.tan(S.r.phi * R) / S.gm) / R : +S.r.phi;
    if (S.bon && (+S.br < 0 || +S.br > phR + 1e-9)) {
      E.push(
        `β_retained must be ≥ 0° and cannot exceed the ${S.acc === 'gg1' ? 'factored ' : ''}φ′ of the retained soil (${f(phR, 1)}°).`,
      );
    }
    if (S.fon && +S.bf <= -S.f.phi) {
      E.push('β_front (downhill) must be smaller in magnitude than foundation φ′.');
    }
    if (S.bon && +S.br > 0 && S.kam === 'r') {
      W.push('β_retained > 0 with Rankine Ka: Rankine sloping-backfill formula used (thrust parallel to slope). Use Coulomb or manual Ka if preferred.');
    }
  }
  if (S.dp < 1) {
    W.push('Passive neglect depth < 1 m – GG1 Fig. 39 note 2 requires min. 1 m where excavation is likely; justification required.');
  }
  if (qVal(S) < 10) {
    W.push('Surcharge < 10 kPa – GG1 §7.2.1 requires min. 10 kPa unless the site layout makes this clearly unnecessary – state the justification in the submission.');
  }
  {
    const G9 = geo(S);
    const ph9 = +S.r.phi;
    if (S.bon && G9.vb && +S.br > ph9 / 2 + 1e-9 && S.kam === 'r') {
      E.push(
        `Rankine theory is not applicable here: the active pressure plane is a virtual back in the soil, so the Rankine thrust makes an angle i_a = β = ${f(+S.br, 1)}° with the normal to the plane, which exceeds δmax = φ′/2 = ${f(ph9 / 2, 1)}° (Geoguide 1 (2020) §6.5.1, Table 14). Use the trial wedge method (§6.5.6).`,
      );
    }
    if (S.bon && G9.vb && +S.br > ph9 / 2 + 1e-9 && S.kam === 'c') {
      W.push(
        `β_retained ${f(+S.br, 1)}° exceeds φ′/2 on a soil-to-soil plane: δ is capped at ${f(ph9 / 2, 1)}° (GG1 Table 14). GG1 §6.5.6 trial wedge would be the more rigorous method.`,
      );
    }
  }
  const wd = wallDelta(S, S.r.phi, G);
  if (wd.over && !S.comp) {
    W.push(
      G.hl > 0 && !isG(S)
        ? `Wall friction δ = ${f(wd.d, 1)}° > ${f(wd.dmax, 1)}°. Geoguide 1 Table 14, row “virtual back of R.C. L- or inverted T-shaped walls”: δmax = φ′/2 or the backfill slope, whichever is smaller; §5.11.2: “δ should be taken as the slope angle of the ground behind the wall, subject to an upper limit of φ′/2”. With β_retained = ${f(S.bon ? +S.br : 0, 1)}°, δmax = ${f(wd.dmax, 1)}°. Select “Auto” or justify.`
        : `Wall friction δ = ${f(wd.d, 1)}° > δmax = ${f(wd.dmax, 1)}° (${wd.src}). Select “Auto” or justify.`,
    );
  }
  if (S.fcu < 20 || S.fcu > 100) E.push('fcu outside CoP range.');
  if (S.kam === 'm') {
    const kv = +S.kaM;
    const kf = +S.kaMf;
    if (!(kv > 0 && kv <= 1)) E.push('Manual Ka must be > 0 and ≤ 1.');
    if (!(kf > 0 && kf <= 1)) E.push('Manual factored Ka must be > 0 and ≤ 1.');
  }
  if (S.cvS !== 'a' && !(+S.cvS >= 20 && +S.cvS <= 100)) {
    E.push('Nominal cover must be between 20 and 100 mm.');
  }
  for (const [ck, clab] of [
    ['cvt', 'Base top'],
    ['cvb', 'Base bottom'],
  ] as const) {
    const val = S[ck];
    if (val != null && val !== '' && !(+val >= 20 && +val <= 100)) {
      E.push(`${clab} cover must be between 20 and 100 mm.`);
    }
  }
  if (isG(S)) {
    const hr = Math.max(0, S.Hr - S.Zb);
    if (hr > 3) W.push(`Mass concrete wall retaining ${f(hr)} m – GG1 §9.3.1: particularly suitable for < 3 m.`);
  }
  if (S.fon && !S.fsm) {
    const s = S.fs;
    if (+s.c < 0) E.push('Front soil c′ cannot be negative.');
    if (!(+s.g > 0)) E.push('Front soil γ must be > 0.');
    if (!(s.phi > 0 && s.phi < 55)) E.push('Front soil φ′ must be between 0° and 55°.');
    if (s.gs < g) E.push('Front soil γsat must be ≥ γw.');
  }
  if (S.skon) {
    const K = keyG(S, G);
    if (!(+S.skd > 0) || !(+S.skw > 0)) E.push('Shear key depth and width must be > 0.');
    else {
      if (+S.skw > G.B) E.push('Shear key wider than the base.');
      if (+S.skd < 0.5) W.push('Shear key depth < 0.5 m – GG1 §9.2.3(2) recommends a minimum depth of 0.5 m (below the disturbed zone).');
      if (+S.skd > G.B / 2) W.push(`Shear key depth > B/2 (${f(G.B / 2)} m) – GG1 §9.2.3(2): deep keys should not be used.`);
      if (K && K.xk + K.Bk > G.B - 0.25 * G.B) W.push('Shear key close to the heel – GG1 §9.2.3(2): risk of undermining the temporary excavation.');
    }
  }
  if (S.lon && S.bon) {
    if (+S.lx < 0) E.push('Line load distance x cannot be negative.');
    if (+S.lQh > 0 && !(+S.lx > 0)) E.push('Horizontal line load needs x > 0 (He = x·tan(45° + φ′/2), GG1 Fig. 29(c)).');
    if (+S.lQv < 0 || +S.lQh < 0) E.push('Line loads cannot be negative.');
    if (+S.br > 0) W.push('Line load: GG1 Fig. 29 is for a level retained surface – β_retained > 0 not covered.');
    W.push('Line load pressures from GG1 Fig. 29 assume a rigid, non-yielding wall (conservative for a yielding wall).');
  }
  if (S.wl === 'c' && S.bon && (+S.wlZ < +S.Zb - 1e-9 || +S.wlZ > +S.Hr + 1e-9)) {
    W.push('Custom retained WL outside base level – retained ground level; clipped.');
  }
  if (isG(S) && S.xrc && S.gmr === 'cc') {
    if (!(+S.grho > 0)) E.push('Anti-crack mesh ratio ρ must be > 0.');
    if ((['mvs', 'mhs', 'mts', 'mbs'] as const).some((k) => !(+S[k] >= 75 && +S[k] <= 400))) {
      E.push('Minimum / anti-crack bar spacing must be 75–400 mm.');
    }
    if (S.gmb !== '965' && !(+S.grmin > 0)) E.push('Mesh ρmin must be > 0.');
  }
  if (S.gpon) {
    if (!(+S.gpv >= 1)) E.push('Project-specific factor γproj must be ≥ 1.0.');
    W.push(
      `Project-specific additional factor γproj = ${S.gpv} applied to ${
        [S.gpS ? 'sliding' : '', S.gpO ? 'overturning' : '', S.gpA ? 'As,req' : ''].filter(Boolean).join(', ') || 'nothing'
      } – NOT a code requirement${S.gpsrc ? ` (source: ${esc(S.gpsrc)})` : ' – state the source'}.`,
    );
  }
  if (S.xrc && S.cmp && S.bon && !(+S.cQ > 0)) {
    E.push('Compaction line load Q1 must be > 0 (or untick compaction).');
  }
  for (const [id, n] of CKL) {
    if (!ckOn(S, id) && !(S.ck[id]?.why || '').trim()) {
      W.push(`Check “${n}” switched OFF without a reason – enter the reason in the check register.`);
    }
  }
  if (S.bro && isVeh(S)) {
    const V = vehCalc(S, G);
    if (S.brc === 'v6E' && !(V.M > 0)) E.push('Class 6E: enter the gross vehicle mass M.');
    if (S.vFl === 'c' && !Number.isFinite(+S.vFz)) E.push('Enter the vehicle floor level.');
    {
      const bTop = G.top + (vStemOn(S) ? 0 : +S.bhb);
      if (V.zA > bTop + 1e-6) {
        W.push(
          `Vehicle bumper height +${f(V.zA)} mPD is above the ${
            vStemOn(S) ? 'wall (stem) top' : 'barrier top'
          } +${f(bTop)} mPD – check barrier height (DIL Table 3.16).`,
        );
      } else if (bTop - V.zA < 0.15 - 1e-9) {
        W.push(
          `Vehicle bumper level +${f(V.zA)} mPD is only ${f((bTop - V.zA) * 1000, 0)} mm below the ${
            vStemOn(S) ? 'wall (stem) top' : 'barrier top'
          } +${f(bTop)} mPD – the impact acts at the top edge; consider raising the barrier. Vehicle floor level = finished running surface (not the structural slab level).`,
        );
      }
    }
    if (vStemOn(S) && V.fl < +S.Zb) E.push('Vehicle floor level is below the founding level.');
    if (+S.vL < 1.5 - 1e-9) W.push(`Dispersion length ${S.vL} m < 1.5 m – taken as 1.5 m (DIL Cl 3.8.3.3).`);
    if (S.vSO) {
      W.push('Vehicle impact excluded from wall stability (structural design only). Justify in the submission: impact is a short-duration load on a 1.5 m length of a continuous wall and disperses along the wall; GEO / BD may still ask for an accidental-case stability check (e.g. CoP SUC Cl 2.3.2.2 γf = 1.05 with the dispersed length).');
    }
    if (V.Ld > 1.5 + 1e-9) {
      W.push(`Vehicle impact distributed over ${f(V.Ld, 2)} m (> 1.5 m, DIL Cl 3.8.3.3) – dispersion through the wall must be justified.`);
    }
    W.push('Vehicle impact treated as an imposed load (CoP Table 2.1: γf 1.6 Comb 1, 1.2 Comb 3; FC 2017 / GG1 as variable action). CoP Cl 2.3.2.2 (γf = 1.05 for accidental loads) not adopted – conservative.');
  }
  if (S.skon && S.nopp && !S.kpp) {
    W.push('All passive ignored, including the shear key (Rp1 = 0): the key only moves the sliding plane to its base (GG1 Fig. 42).');
  }
  if (S.xrc) {
    const C = cvAll(S, G);
    const st = isG(S) ? S.st.some((x) => x.rc) : 1;
    if (st && C.sMin != null && C.s < C.sMin) {
      W.push(`Stem cover ${C.s} mm < CoP minimum ${C.sMin} mm (Table 4.2 Cond ${C.sEx}, bar Ø ${C.dS}).`);
    }
    if (st && C.sMin == null) {
      W.push(`C${S.fcu} is below the minimum grade for exposure Cond ${C.sEx} (CoP Table 4.2) – stem cover taken as ${C.s} mm.`);
    }
    if (!isG(S) && C.tMin != null && C.t < C.tMin) {
      W.push(`Base top cover ${C.t} mm < CoP minimum ${C.tMin} mm (Table 4.2 Cond ${C.tEx}).`);
    }
  }
  if (isG(S) && S.xrc && S.gmr === 'cc' && S.gmb !== '965') {
    W.push('Minimum steel to CoP 9.3.1.1(a) on the full thickness – a section with As ≥ Table 9.1 would be classed as "reinforced" (Cl 9.2.1.1); the wall is still designed as mass concrete to GG1 §9.3 (conservative).');
  }
  return { E, W };
}

/** Map validation error/warning message to workflow Step 1–5 */
export const stepOf = (m: string): number =>
  /fcu|spacing|cover|mesh|ρ|Compaction|joint|Joint|h_eff|anti-crack|starter|Minimum steel/.test(m)
    ? 5
    : /WL|GWL|[Ss]urcharge|Fence|[Bb]arrier|[Vv]ehicle|impact|Line load|line load|Solidity|Class 6E|Wind|wind/.test(m)
      ? 4
      : /φ|γ|c′|β_|δ|[Ww]all friction|Passive|passive|Original ground|Ka |Kp|compressible|Table 14/.test(m)
        ? 3
        : /Factors of safety|FOS|Partial factor|γproj|γm/.test(m)
          ? 1
          : 2;
