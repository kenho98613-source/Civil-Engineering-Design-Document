import { useState } from 'react';
import { Check, Eye, EyeOff, Minus, Plus, X } from 'lucide-react';
import {
  DEG2RAD as R,
  dd,
  f,
  gTx,
  geo,
  isG,
  keyG,
  pX,
  qDist,
  scOn,
  wlLev,
} from '../engine';
import type { CalcAllResult, WallState } from '../engine';

interface SectionCanvasProps {
  state: WallState;
  result: CalcAllResult;
  hoveredField: string | null;
  onEditParam: (param: string, value: number) => void;
  onForceScaleChange: (scale: number) => void;
}

interface LayerFlags {
  dims: boolean;
  forces: boolean;
  soil: boolean;
  bearing: boolean;
  rebar: boolean;
}

interface PopoverTarget {
  param: string;
  label: string;
  unit: string;
  value: number;
  step: number;
  xPct: number;
  yPct: number;
}

export function SectionCanvas({
  state: S,
  result,
  hoveredField,
  onEditParam,
  onForceScaleChange,
}: SectionCanvasProps) {
  const [layers, setLayers] = useState<LayerFlags>({
    dims: true,
    forces: true,
    soil: true,
    bearing: true,
    rebar: true,
  });
  const [popover, setPopover] = useState<PopoverTarget | null>(null);
  const [draftVal, setDraftVal] = useState<string>('');

  const G = result.G ?? geo(S);
  const Zb = +S.Zb;
  const Hr = +S.Hr;
  const Hf = +S.Hf;
  const B = Math.max(0.5, G.B);
  const Htot = Math.max(1, G.top - Zb);
  const Gv = isG(S);
  const KG = keyG(S, G);
  const CR = scOn(S);
  const sb = CR ? +S.scb : 0;

  // World bounds (m)
  const padL = Math.max(2.2, CR ? sb + 1.8 : 0, 0.55 * Htot);
  const padR = Math.max(2.6, 0.75 * Htot);
  const padB = Math.max(1.8, (KG ? KG.dk : 0) + 1.4);
  const padT = Math.max(1.4, (S.wo ? +S.wh : 0) + 1.1);

  const xMin = -padL;
  const xMax = B + padR;
  const zMin = Zb - padB;
  const zMax = Math.max(G.top, Hr) + padT;

  const W = 820;
  const H = 520;
  const sx = W / (xMax - xMin);
  const sz = H / (zMax - zMin);
  const sc = Math.min(sx, sz);
  const ox = (W - (xMax - xMin) * sc) / 2 - xMin * sc;
  const oy = (H - (zMax - zMin) * sc) / 2 + zMax * sc;

  const X = (x: number) => ox + x * sc;
  const Y = (z: number) => oy - z * sc;
  const ptsStr = (pts: [number, number][]) => pts.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ');

  const openEditor = (p: Omit<PopoverTarget, 'xPct' | 'yPct'>, svgX: number, svgY: number) => {
    setPopover({
      ...p,
      xPct: Math.max(12, Math.min(82, (svgX / W) * 100)),
      yPct: Math.max(12, Math.min(78, (svgY / H) * 100)),
    });
    setDraftVal(String(p.value));
  };

  const commitPopover = () => {
    if (!popover) return;
    const v = parseFloat(draftVal);
    if (Number.isFinite(v)) onEditParam(popover.param, v);
    setPopover(null);
  };

  // Bearing distribution (SLS)
  const sls = !result.err ? result.A.sls : null;
  const qFn = sls ? qDist(sls.s.N, sls.s.e, B) : null;
  const qMax = qFn ? Math.max(1, qFn(0), qFn(B)) : 1;
  const bDepth = Math.min(1.1, padB * 0.55);

  const wb = S.bon ? wlLev(S) : Zb;
  const wf = S.fon ? Math.min(+S.fw, Hf) : Zb;

  // Retained ground polyline
  const retSoilPts: [number, number][] = [];
  if (S.bon) {
    const tb = Math.tan((+S.br || 0) * R);
    retSoilPts.push([G.xH, Hr], [xMax, Hr + (xMax - G.xH) * tb], [xMax, Zb], [B, Zb]);
    if (G.hl > 0) retSoilPts.push([B, G.bt], [G.xb, G.bt]);
  }

  // Front ground polyline
  const frontSoilPts: [number, number][] = [];
  if (S.fon && Hf >= Zb) {
    const xF = pX(G.fr, Hf);
    const tf = Math.tan((+S.bf || 0) * R);
    frontSoilPts.push([xF, Hf]);
    if (CR && tf < 0) {
      frontSoilPts.push([-sb, Hf], [xMin, Hf + (-sb - xMin) * tf]);
    } else {
      frontSoilPts.push([xMin, Hf + (xF - xMin) * tf]);
    }
    frontSoilPts.push([xMin, Zb], [0, Zb]);
    if (G.Lt0 > 0) frontSoilPts.push([0, G.bt], [G.Lt0, G.bt]);
  }

  // Force resultant summary for clean arrows
  const Ck = !result.err ? result.Ck : null;
  const asc = +S.asc || 1;
  const sumCat = (dir: 'h' | 'p' | 'v') => {
    if (!Ck) return { F: 0, arm: 0 };
    const items = Ck.it.filter((i) => i.dir === dir);
    const F = items.reduce((a, b) => a + b.F, 0);
    const arm = F > 1e-9 ? items.reduce((a, b) => a + b.F * b.arm, 0) / F : 0;
    return { F, arm };
  };
  const hRes = sumCat('h');
  const pRes = sumCat('p');
  const vRes = sumCat('v');

  const hi = (key: string) => hoveredField === key;

  const toggleLayer = (k: keyof LayerFlags) => setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <div className="flex flex-col gap-2">
      {/* Floating CAD Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-md border"
        style={{
          backgroundColor: 'var(--surface-panel)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ['dims', 'Dimensions'],
              ['forces', 'Forces'],
              ['soil', 'Soil & GWL'],
              ['bearing', 'Bearing & Kern'],
              ['rebar', 'Rebar'],
            ] as [keyof LayerFlags, string][]
          ).map(([k, label]) => {
            const on = layers[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleLayer(k)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] cursor-pointer transition-colors"
                style={{
                  borderColor: on ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
                  backgroundColor: on ? 'var(--accent-cobalt-soft)' : 'transparent',
                  color: on ? 'var(--accent-cobalt)' : 'var(--text-muted)',
                  fontWeight: on ? 600 : 400,
                }}
              >
                {on ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 opacity-60" />}
                {label}
              </button>
            );
          })}
        </div>

        <label className="inline-flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>Arrow scale</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={asc}
            onChange={(e) => onForceScaleChange(+e.target.value)}
            className="w-20 accent-blue-600"
          />
          <span className="font-mono-eng w-8 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
            {asc.toFixed(1)}×
          </span>
        </label>
      </div>

      {/* Main SVG Viewport + Anchored Popover */}
      <div
        className="relative rounded-md border overflow-hidden"
        style={{
          backgroundColor: 'var(--cad-bg)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none">
          <defs>
            <marker id="arr-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,1 L9,5 L0,9 z" fill="var(--cad-force-active)" />
            </marker>
            <marker id="arr-grn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,1 L9,5 L0,9 z" fill="var(--cad-force-passive)" />
            </marker>
            <marker id="arr-blk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,1 L9,5 L0,9 z" fill="var(--cad-force-weight)" />
            </marker>
            <pattern id="soil-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="12" stroke="var(--cad-soil-stroke)" strokeOpacity="0.18" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Subtle Founding Datum Line */}
          <line
            x1={0}
            x2={W}
            y1={Y(Zb)}
            y2={Y(Zb)}
            stroke="var(--border-muted)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Soil Layer */}
          {layers.soil && (
            <g>
              {retSoilPts.length > 2 && (
                <>
                  <polygon points={ptsStr(retSoilPts)} fill="var(--cad-soil-fill)" />
                  <polygon points={ptsStr(retSoilPts)} fill="url(#soil-hatch)" />
                  <polyline
                    points={ptsStr(retSoilPts.slice(0, 2))}
                    fill="none"
                    stroke="var(--cad-soil-stroke)"
                    strokeWidth={hi('Hr') || hi('br') ? 2.6 : 1.6}
                  />
                </>
              )}
              {frontSoilPts.length > 2 && (
                <>
                  <polygon points={ptsStr(frontSoilPts)} fill="var(--cad-front-soil)" />
                  <polyline
                    points={ptsStr(CR ? frontSoilPts.slice(0, 3) : frontSoilPts.slice(0, 2))}
                    fill="none"
                    stroke="var(--cad-soil-stroke)"
                    strokeWidth={hi('Hf') || hi('crest') ? 2.6 : 1.6}
                  />
                </>
              )}
              {/* Groundwater Table Lines */}
              {S.bon && wb > Zb + 1e-4 && (
                <g>
                  <rect
                    x={X(pX(G.bk, wb))}
                    y={Y(wb)}
                    width={Math.max(0, X(xMax) - X(pX(G.bk, wb)))}
                    height={Math.max(0, Y(Zb) - Y(wb))}
                    fill="var(--cad-water-fill)"
                  />
                  <line
                    x1={X(pX(G.bk, wb))}
                    x2={X(xMax)}
                    y1={Y(wb)}
                    y2={Y(wb)}
                    stroke="var(--cad-water)"
                    strokeWidth={hi('wl') ? 2.5 : 1.4}
                    strokeDasharray="6 4"
                  />
                  <text
                    x={X(B + 0.5)}
                    y={Y(wb) - 5}
                    fontSize="10.5"
                    fill="var(--cad-water)"
                    className="cad-label font-mono-eng"
                  >
                    ▽ GWL +{dd(wb)}
                  </text>
                </g>
              )}
              {S.fon && wf > Zb + 1e-4 && (
                <line
                  x1={X(xMin)}
                  x2={X(0)}
                  y1={Y(wf)}
                  y2={Y(wf)}
                  stroke="var(--cad-water)"
                  strokeWidth={hi('fw') ? 2.5 : 1.3}
                  strokeDasharray="5 4"
                />
              )}
            </g>
          )}

          {/* Middle-Third Kern Band & Bearing Pressure */}
          {layers.bearing && sls && qFn && (
            <g>
              <rect
                x={X(B / 3)}
                y={Y(Zb)}
                width={X((2 * B) / 3) - X(B / 3)}
                height={10}
                fill="var(--cad-kern)"
                stroke="var(--status-pass)"
                strokeWidth="0.8"
              />
              <polygon
                points={ptsStr([
                  [0, Zb],
                  ...Array.from({ length: 21 }, (_, i) => {
                    const x = (B * i) / 20;
                    return [x, Zb - (qFn(x) / qMax) * bDepth] as [number, number];
                  }),
                  [B, Zb],
                ])}
                fill="var(--accent-cobalt-soft)"
                stroke="var(--accent-cobalt)"
                strokeWidth="1.2"
              />
              <text
                x={X(0) + 4}
                y={Y(Zb - (qFn(0) / qMax) * bDepth) + 12}
                fontSize="10"
                fill="var(--accent-cobalt)"
                className="cad-label font-mono-eng"
              >
                q_toe {f(qFn(0), 1)} kPa
              </text>
              <text
                x={X(B) - 4}
                y={Y(Zb - (qFn(B) / qMax) * bDepth) + 12}
                textAnchor="end"
                fontSize="10"
                fill="var(--accent-cobalt)"
                className="cad-label font-mono-eng"
              >
                q_heel {f(qFn(B), 1)} kPa
              </text>
              {Number.isFinite(sls.s.xbar) && (
                <line
                  x1={X(sls.s.xbar)}
                  x2={X(sls.s.xbar)}
                  y1={Y(Zb) - 6}
                  y2={Y(Zb) + 16}
                  stroke={Math.abs(sls.s.e) <= B / 6 ? 'var(--status-pass)' : 'var(--status-fail)'}
                  strokeWidth="2.2"
                />
              )}
            </g>
          )}

          {/* Concrete Wall Geometry */}
          <g>
            {/* Base / Gravity Block */}
            {Gv ? (
              <polygon
                points={ptsStr([
                  [0, Zb],
                  [B, Zb],
                  [B - (+S.gbr || 0), G.bt],
                  [gTx(S), G.bt],
                ])}
                fill="var(--cad-concrete-fill)"
                stroke={hi('gBt') || hi('tb') || hi('gbf') || hi('gbr') ? 'var(--accent-cobalt)' : 'var(--cad-concrete-stroke)'}
                strokeWidth={hi('gBt') || hi('tb') ? 2.4 : 1.5}
              />
            ) : (
              <rect
                x={X(0)}
                y={Y(G.bt)}
                width={X(B) - X(0)}
                height={Y(Zb) - Y(G.bt)}
                fill="var(--cad-concrete-fill)"
                stroke={hi('Lt') || hi('Lh') || hi('tb') ? 'var(--accent-cobalt)' : 'var(--cad-concrete-stroke)'}
                strokeWidth={hi('Lt') || hi('Lh') || hi('tb') ? 2.4 : 1.5}
              />
            )}

            {/* Main Stem Segments */}
            {G.SG.filter((g) => g.h > 1e-9).map((g) => (
              <polygon
                key={g.i}
                points={ptsStr([
                  [g.xf0, g.bot],
                  [g.xb0, g.bot],
                  [g.xb1, g.top],
                  [g.xf1, g.top],
                ])}
                fill="var(--cad-concrete-fill)"
                stroke={hi(`st.${g.i}`) ? 'var(--accent-cobalt)' : 'var(--cad-concrete-stroke)'}
                strokeWidth={hi(`st.${g.i}`) ? 2.4 : 1.5}
              />
            ))}

            {/* Extra Stems on Base */}
            {G.XS.map((a) =>
              a.segs.map((sg) => (
                <rect
                  key={`${a.j}-${sg.k}`}
                  x={X(sg.x0)}
                  y={Y(sg.top)}
                  width={X(sg.x1) - X(sg.x0)}
                  height={Y(sg.bot) - Y(sg.top)}
                  fill="var(--cad-concrete-fill)"
                  stroke="var(--cad-concrete-stroke)"
                  strokeWidth="1.5"
                />
              )),
            )}

            {/* Shear Key */}
            {KG && KG.dk > 0 && KG.Bk > 0 && (
              <rect
                x={X(KG.xk)}
                y={Y(Zb)}
                width={X(KG.xk + KG.Bk) - X(KG.xk)}
                height={Y(Zb - KG.dk) - Y(Zb)}
                fill="var(--cad-concrete-fill)"
                stroke={hi('key') ? 'var(--accent-cobalt)' : 'var(--cad-concrete-stroke)'}
                strokeWidth={hi('key') ? 2.4 : 1.5}
              />
            )}
          </g>

          {/* Schematic Rebar Layer */}
          {layers.rebar && !Gv && (
            <g stroke="var(--cad-rebar)" strokeWidth="1.6" fill="none" strokeLinecap="round">
              {G.SG.filter((g) => g.h > 1e-9).map((g) => (
                <g key={g.i}>
                  <line x1={X(g.xb0 - 0.06)} y1={Y(g.bot)} x2={X(g.xb1 - 0.06)} y2={Y(g.top - 0.05)} />
                  <line x1={X(g.xf0 + 0.06)} y1={Y(g.bot)} x2={X(g.xf1 + 0.06)} y2={Y(g.top - 0.05)} strokeDasharray="3 2" />
                </g>
              ))}
              <line x1={X(0.06)} y1={Y(Zb + 0.08)} x2={X(B - 0.06)} y2={Y(Zb + 0.08)} />
              <line x1={X(0.06)} y1={Y(G.bt - 0.08)} x2={X(B - 0.06)} y2={Y(G.bt - 0.08)} />
            </g>
          )}

          {/* Force Resultant Arrows */}
          {layers.forces && Ck && (
            <g>
              {hRes.F > 0 && (
                <g>
                  <line
                    x1={X(B) + Math.min(110, 48 * asc)}
                    y1={Y(Zb + hRes.arm)}
                    x2={X(B) + 6}
                    y2={Y(Zb + hRes.arm)}
                    stroke="var(--cad-force-active)"
                    strokeWidth="2.2"
                    markerEnd="url(#arr-red)"
                  />
                  <text
                    x={X(B) + Math.min(115, 52 * asc)}
                    y={Y(Zb + hRes.arm) + 4}
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--cad-force-active)"
                    className="cad-label font-mono-eng"
                  >
                    ΣH = {f(hRes.F, 1)} kN/m
                  </text>
                </g>
              )}
              {pRes.F > 0 && (
                <g>
                  <line
                    x1={X(0) - Math.min(95, 42 * asc)}
                    y1={Y(Zb + pRes.arm)}
                    x2={X(0) - 6}
                    y2={Y(Zb + pRes.arm)}
                    stroke="var(--cad-force-passive)"
                    strokeWidth="2.2"
                    markerEnd="url(#arr-grn)"
                  />
                  <text
                    x={X(0) - Math.min(100, 46 * asc)}
                    y={Y(Zb + pRes.arm) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--cad-force-passive)"
                    className="cad-label font-mono-eng"
                  >
                    ΣPp = {f(pRes.F, 1)}
                  </text>
                </g>
              )}
              {vRes.F > 0 && (
                <g>
                  <line
                    x1={X(vRes.arm)}
                    y1={Y(G.top) - Math.min(54, 34 * asc)}
                    x2={X(vRes.arm)}
                    y2={Y(G.top) - 6}
                    stroke="var(--cad-force-weight)"
                    strokeWidth="2"
                    markerEnd="url(#arr-blk)"
                  />
                  <text
                    x={X(vRes.arm)}
                    y={Y(G.top) - Math.min(60, 40 * asc)}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight="600"
                    fill="var(--cad-force-weight)"
                    className="cad-label font-mono-eng"
                  >
                    ΣV = {f(vRes.F, 1)} kN/m
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Interactive CAD Dimension Pills (Click to Open Popover Editor) */}
          {layers.dims && (
            <g>
              {/* Overall Base Width B */}
              <line x1={X(0)} x2={X(B)} y1={Y(Zb - padB + 0.35)} y2={Y(Zb - padB + 0.35)} stroke="var(--cad-dim)" strokeWidth="1" />
              <line x1={X(0)} x2={X(0)} y1={Y(Zb)} y2={Y(Zb - padB + 0.25)} stroke="var(--cad-dim)" strokeWidth="0.7" strokeDasharray="2 2" />
              <line x1={X(B)} x2={X(B)} y1={Y(Zb)} y2={Y(Zb - padB + 0.25)} stroke="var(--cad-dim)" strokeWidth="0.7" strokeDasharray="2 2" />
              <text
                x={X(B / 2)}
                y={Y(Zb - padB + 0.35) - 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="var(--text-primary)"
                className="cad-label font-mono-eng"
              >
                B = {dd(B)} m
              </text>

              {/* Clickable Pill Helper */}
              {[
                ...(!Gv && S.ty !== 'L'
                  ? [{ param: 'Lt', label: 'Toe Lt', unit: 'm', value: +S.Lt, step: 0.05, x: X(G.Lt / 2), y: Y(G.bt) - 14 }]
                  : []),
                ...(!Gv && S.ty !== 'Li'
                  ? [{ param: 'Lh', label: 'Heel Lh', unit: 'm', value: +S.Lh, step: 0.05, x: X(G.xb + G.hl / 2), y: Y(G.bt) - 14 }]
                  : []),
                ...(Gv
                  ? [{ param: 'gBt', label: 'Top b_t', unit: 'm', value: +S.gBt, step: 0.05, x: X(gTx(S) + +S.gBt / 2), y: Y(G.bt) - 14 }]
                  : []),
                { param: 'tb', label: Gv ? 'Block h_b' : 'Base tb', unit: 'm', value: +S.tb, step: 0.05, x: X(B) + 42, y: Y(Zb + +S.tb / 2) },
                { param: 'Hr', label: 'GL_r', unit: 'mPD', value: +S.Hr, step: 0.1, x: X(B + 1.25), y: Y(Hr) - 14 },
                ...(S.fon
                  ? [{ param: 'Hf', label: 'GL_f', unit: 'mPD', value: +S.Hf, step: 0.1, x: X(-1.1), y: Y(Hf) - 14 }]
                  : []),
              ].map((pill) => (
                <g
                  key={pill.param}
                  className="cursor-pointer group"
                  onClick={() => openEditor(pill, pill.x, pill.y)}
                >
                  <rect
                    x={pill.x - 42}
                    y={pill.y - 11}
                    width={84}
                    height={20}
                    rx={10}
                    fill="var(--surface-panel)"
                    stroke={popover?.param === pill.param ? 'var(--accent-cobalt)' : 'var(--border-hairline)'}
                    strokeWidth={popover?.param === pill.param ? 1.8 : 1.1}
                  />
                  <text
                    x={pill.x}
                    y={pill.y + 3}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="var(--accent-cobalt)"
                    className="font-mono-eng"
                  >
                    {pill.label.split(' ')[1] || pill.label} {dd(pill.value)}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>

        {/* Anchored Popover Editor */}
        {popover && (
          <div
            className="absolute z-30 w-52 rounded-md border shadow-xl p-2.5"
            style={{
              left: `${popover.xPct}%`,
              top: `${popover.yPct}%`,
              transform: 'translate(-50%, -105%)',
              backgroundColor: 'var(--surface-elevated)',
              borderColor: 'var(--accent-cobalt)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">{popover.label}</span>
              <button
                type="button"
                onClick={() => setPopover(null)}
                className="p-0.5 rounded hover:opacity-70 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const v = +(parseFloat(draftVal || '0') - popover.step).toFixed(3);
                  setDraftVal(String(v));
                  onEditParam(popover.param, v);
                }}
                className="p-1.5 rounded border cursor-pointer"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                autoFocus
                type="number"
                step={popover.step}
                value={draftVal}
                onChange={(e) => setDraftVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPopover();
                  if (e.key === 'Escape') setPopover(null);
                }}
                className="w-full px-2 py-1 rounded border text-right font-mono-eng text-xs"
                style={{
                  borderColor: 'var(--border-hairline)',
                  backgroundColor: 'var(--surface-canvas)',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const v = +(parseFloat(draftVal || '0') + popover.step).toFixed(3);
                  setDraftVal(String(v));
                  onEditParam(popover.param, v);
                }}
                className="p-1.5 rounded border cursor-pointer"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={commitPopover}
                className="p-1.5 rounded text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-cobalt)' }}
                title="Apply (Enter)"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
            <div className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Units: {popover.unit} · Enter to apply · Esc to close
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] px-1" style={{ color: 'var(--text-muted)' }}>
        <span>Click any blue dimension pill to edit via popover · Hover left-pane fields to highlight elements</span>
        <span className="font-mono-eng">
          Founding +{dd(Zb)} · Top +{dd(G.top)} mPD
        </span>
      </div>
    </div>
  );
}
