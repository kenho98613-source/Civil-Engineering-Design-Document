import { useState } from 'react';
import { Check, Wand2, X } from 'lucide-react';
import {
  ABD,
  ABD2,
  ABS,
  anch,
  ancRC,
  cvAll,
  f,
  isG,
  lapReq,
  rcv,
} from '../engine';
import type { CalcAllSuccessResult, RcBarSet, RcDesignElement, WallState } from '../engine';

interface RcDiagramViewProps {
  state: WallState;
  result: CalcAllSuccessResult;
  onCommit: (mutator: (draft: WallState) => void, opts?: { forceHistory?: boolean; message?: string }) => void;
  onAutoBars: (only?: string) => void;
}

type BarRole = 'main' | 'dist' | 'opp';

function ElementSectionSvg({
  el,
  bar,
  selectedRole,
  onPickRole,
}: {
  el: RcDesignElement;
  bar: RcBarSet;
  selectedRole: BarRole | null;
  onPickRole: (role: BarRole) => void;
}) {
  const isStem = el.ty === 's';
  const W = 420;
  const H = 175;
  // Draw proportional concrete section box
  const x0 = isStem ? 168 : 110;
  const x1 = isStem ? 252 : 310;
  const y0 = isStem ? 20 : 48;
  const y1 = isStem ? 155 : 132;
  const cov = 11;

  // Main tension face coordinates
  const mainLine = isStem
    ? el.rev
      ? [x0 + cov, y0 + 8, x0 + cov, y1 - 8]
      : [x1 - cov, y0 + 8, x1 - cov, y1 - 8]
    : el.ty === 'T'
      ? [x0 + 8, y1 - cov, x1 - 8, y1 - cov]
      : [x0 + 8, y0 + cov, x1 - 8, y0 + cov];

  const oppLine = isStem
    ? el.rev
      ? [x1 - cov, y0 + 8, x1 - cov, y1 - 8]
      : [x0 + cov, y0 + 8, x0 + cov, y1 - 8]
    : el.ty === 'T'
      ? [x0 + 8, y0 + cov, x1 - 8, y0 + cov]
      : [x0 + 8, y1 - cov, x1 - 8, y1 - cov];

  const mainDots = isStem
    ? [44, 72, 100, 128].map((y) => [mainLine[0] + (el.rev ? 7 : -7), y])
    : [138, 178, 218, 258, 282].map((x) => [x, mainLine[1] + (el.ty === 'T' ? -7 : 7)]);

  const pill = (
    role: BarRole,
    px: number,
    py: number,
    title: string,
    spec: string,
    accent: string,
  ) => {
    const active = selectedRole === role;
    return (
      <g className="cursor-pointer" onClick={() => onPickRole(role)}>
        <rect
          x={px}
          y={py}
          width={126}
          height={34}
          rx={6}
          fill="var(--surface-panel)"
          stroke={active ? 'var(--accent-cobalt)' : 'var(--border-hairline)'}
          strokeWidth={active ? 2 : 1.1}
        />
        <rect x={px} y={py} width={4} height={34} rx={2} fill={accent} />
        <text x={px + 10} y={py + 13} fontSize="9.5" fill="var(--text-muted)">
          {title}
        </text>
        <text x={px + 10} y={py + 27} fontSize="11.5" fontWeight="700" fill="var(--text-primary)" className="font-mono-eng">
          {spec} ▾
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block rounded border" style={{ backgroundColor: 'var(--cad-bg)', borderColor: 'var(--border-muted)' }}>
      {/* Concrete Cross Section */}
      <rect
        x={x0}
        y={y0}
        width={x1 - x0}
        height={y1 - y0}
        fill="var(--cad-concrete-fill)"
        stroke="var(--cad-concrete-stroke)"
        strokeWidth="1.5"
      />
      {/* Thickness label */}
      <text
        x={(x0 + x1) / 2}
        y={y1 + 14}
        textAnchor="middle"
        fontSize="10"
        fill="var(--text-muted)"
        className="font-mono-eng"
      >
        h = {f(el.h, 0)} mm · d = {f(el.d, 0)} mm
      </text>

      {/* Main Tension Reinforcement (thick orange-red) */}
      <line
        x1={mainLine[0]}
        y1={mainLine[1]}
        x2={mainLine[2]}
        y2={mainLine[3]}
        stroke="var(--cad-rebar)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Opposite Face Reinforcement */}
      <line
        x1={oppLine[0]}
        y1={oppLine[1]}
        x2={oppLine[2]}
        y2={oppLine[3]}
        stroke="var(--accent-cobalt)"
        strokeWidth="2"
        strokeDasharray="5 3"
        strokeLinecap="round"
      />

      {/* Distribution Bars (dots) */}
      {mainDots.map(([cx, cy], idx) => (
        <circle key={idx} cx={cx} cy={cy} r="2.8" fill="var(--cad-rebar)" />
      ))}

      {/* Tension Face Label */}
      <text
        x={(x0 + x1) / 2}
        y={y0 - 6}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="var(--cad-rebar)"
      >
        Tension: {el.tf}
      </text>

      {/* Leader Lines */}
      <line x1={x0} y1={52} x2={136} y2={52} stroke="var(--border-hairline)" strokeDasharray="2 2" />
      <line x1={x1} y1={52} x2={284} y2={52} stroke="var(--border-hairline)" strokeDasharray="2 2" />
      <line x1={x1} y1={115} x2={284} y2={115} stroke="var(--border-hairline)" strokeDasharray="2 2" />

      {/* Interactive Bar Callout Pills */}
      {pill('opp', 10, 35, `Opp. (${el.of.split(' ')[0]})`, `T${bar.d3}@${bar.s3}`, 'var(--accent-cobalt)')}
      {pill('main', 284, 35, `Main (${el.tf.split(' ')[0]})`, `T${bar.d}@${bar.s}`, 'var(--cad-rebar)')}
      {pill('dist', 284, 98, 'Distribution (EF)', `T${bar.d2}@${bar.s2}`, 'var(--status-warn)')}
    </svg>
  );
}

export function RcDiagramView({ state: S, result, onCommit, onAutoBars }: RcDiagramViewProps) {
  const [picker, setPicker] = useState<{ k: string; role: BarRole } | null>(null);
  const CV = cvAll(S, result.G);

  const updateBar = (k: string, role: BarRole, field: 'd' | 's', val: number) => {
    onCommit(
      (draft) => {
        const cur = { ...rcv(draft, k) };
        if (role === 'main') {
          if (field === 'd') cur.d = val;
          else cur.s = val;
        } else if (role === 'dist') {
          if (field === 'd') cur.d2 = val;
          else cur.s2 = val;
        } else {
          if (field === 'd') cur.d3 = val;
          else cur.s3 = val;
        }
        draft.rc[k] = cur;
      },
      { forceHistory: true, message: `Updated ${k} reinforcement` },
    );
  };

  if (!S.xrc) {
    return (
      <div className="rounded-md border p-4 text-xs" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
        Structural RC calculation is currently disabled (enable in Step 1).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Interactive RC Reinforcement Diagrams (CoP SUC 2013)</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Click any bar callout pill inside a sketch to open the bar picker · Cover: Stem {CV.s} mm, Base Top {CV.t} mm, Base Bottom {CV.b} mm.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAutoBars()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white cursor-pointer"
          style={{ backgroundColor: 'var(--accent-teal)' }}
        >
          <Wand2 className="w-3.5 h-3.5" /> Auto-Bars (All Elements)
        </button>
      </div>

      {/* RC Element Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {result.RS.map((el) => {
          const bar = rcv(S, el.k);
          const uMax = Math.max(el.uM, el.uV);
          const barCol = uMax > 1 + 1e-9 ? 'var(--status-fail)' : uMax > 0.85 ? 'var(--status-warn)' : 'var(--status-pass)';
          const isOpen = picker?.k === el.k;
          const lap = lapReq(S, el.k);
          const anc = /^s\d+$/.test(el.k) ? (isG(S) ? anch(S, el) : ancRC(S, el)) : null;

          const activeD =
            picker?.role === 'main' ? bar.d : picker?.role === 'dist' ? bar.d2 : bar.d3;
          const activeS =
            picker?.role === 'main' ? bar.s : picker?.role === 'dist' ? bar.s2 : bar.s3;
          const diaList = picker?.role === 'dist' ? ABD2 : ABD;

          return (
            <div
              key={el.k + el.n}
              className="relative rounded-md border p-3 space-y-2.5"
              style={{
                backgroundColor: 'var(--surface-panel)',
                borderColor: isOpen ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
                borderLeftWidth: '4px',
                borderLeftColor: el.ok ? 'var(--status-pass)' : 'var(--status-fail)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{el.n}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {el.gov} · Mu = {f(Math.abs(el.M), 1)} kNm/m · Vu = {f(Math.abs(el.V), 1)} kN/m
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono-eng text-xs font-bold" style={{ color: barCol }}>
                    {f(uMax * 100, 0)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => onAutoBars(el.k)}
                    className="px-2 py-0.5 rounded border text-[11px] cursor-pointer"
                    style={{ borderColor: 'var(--border-hairline)' }}
                    title="Select lightest passing bar set for this element"
                  >
                    Auto
                  </button>
                </div>
              </div>

              {/* Interactive Section Sketch */}
              <ElementSectionSvg
                el={el}
                bar={bar}
                selectedRole={isOpen ? picker!.role : null}
                onPickRole={(role) =>
                  setPicker((cur) => (cur && cur.k === el.k && cur.role === role ? null : { k: el.k, role }))
                }
              />

              {/* Anchored Bar Picker Popover */}
              {isOpen && picker && (
                <div
                  className="rounded-md border p-2.5 space-y-2 shadow-lg"
                  style={{
                    backgroundColor: 'var(--surface-elevated)',
                    borderColor: 'var(--accent-cobalt)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      Edit {picker.role === 'main' ? 'Main Tension' : picker.role === 'dist' ? 'Distribution (EF)' : 'Opposite Face'} Bars
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicker(null)}
                      className="p-0.5 rounded hover:opacity-70 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                      Diameter (mm)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {diaList.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateBar(el.k, picker.role, 'd', d)}
                          className="px-2 py-0.5 rounded border font-mono-eng text-xs cursor-pointer"
                          style={
                            activeD === d
                              ? { backgroundColor: 'var(--accent-cobalt)', borderColor: 'var(--accent-cobalt)', color: '#fff', fontWeight: 700 }
                              : { borderColor: 'var(--border-hairline)' }
                          }
                        >
                          T{d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                      Spacing c/c (mm)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ABS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateBar(el.k, picker.role, 's', s)}
                          className="px-2 py-0.5 rounded border font-mono-eng text-xs cursor-pointer"
                          style={
                            activeS === s
                              ? { backgroundColor: 'var(--accent-cobalt)', borderColor: 'var(--accent-cobalt)', color: '#fff', fontWeight: 700 }
                              : { borderColor: 'var(--border-hairline)' }
                          }
                        >
                          @{s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Engineering Verification Badges */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono-eng">
                <div className="rounded px-2 py-1" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                  <div className="text-[9.5px]" style={{ color: 'var(--text-muted)' }}>As req / prov</div>
                  <div className="font-semibold" style={{ color: el.okM ? 'var(--text-primary)' : 'var(--status-fail)' }}>
                    {f(Math.max(el.Asr, el.Asm), 0)} / {f(el.Asp, 0)}
                  </div>
                </div>
                <div className="rounded px-2 py-1" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                  <div className="text-[9.5px]" style={{ color: 'var(--text-muted)' }}>Shear v / vc</div>
                  <div className="font-semibold" style={{ color: el.okV ? 'var(--text-primary)' : 'var(--status-fail)' }}>
                    {f(el.v, 2)} / {f(el.vc, 2)}
                  </div>
                </div>
                <div className="rounded px-2 py-1" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                  <div className="text-[9.5px]" style={{ color: 'var(--text-muted)' }}>
                    {lap ? 'Lap / Crack' : 'Crack / Cover'}
                  </div>
                  <div className="font-semibold flex items-center gap-1">
                    {lap ? `${lap} mm` : el.okCr ? 'OK' : 'FAIL'}
                    {el.okCr && el.okC && <Check className="w-3 h-3 inline" style={{ color: 'var(--status-pass)' }} />}
                  </div>
                </div>
              </div>

              {anc && (
                <div className="text-[10.5px] flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
                  <span>
                    Starter anchorage: req <b className="font-mono-eng">{anc.emb} mm</b> · avail <b className="font-mono-eng">{f(anc.av, 0)} mm</b>
                  </span>
                  <span
                    className="font-mono-eng font-semibold"
                    style={{ color: anc.ok ? 'var(--status-pass)' : 'var(--status-warn)' }}
                  >
                    {anc.ok ? 'Straight OK' : 'Cog / Hook req.'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gravity Anti-Crack / Minimum Mesh Card */}
      {isG(S) && S.gmr === 'cc' && result.MS.length > 0 && (
        <div
          className="rounded-md border overflow-hidden"
          style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
        >
          <div
            className="px-3 py-2 text-xs font-semibold border-b flex items-center justify-between"
            style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
          >
            <span>Gravity Mass Concrete Surface / Minimum Mesh (Detailing)</span>
            <button
              type="button"
              onClick={() => onAutoBars('mesh')}
              className="px-2 py-0.5 rounded border text-[11px] cursor-pointer"
              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
            >
              Auto-Mesh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b text-left text-[11px]" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
                  <th className="py-1.5 px-3">Section</th>
                  <th className="py-1.5 px-3">Direction</th>
                  <th className="py-1.5 px-3">Bar</th>
                  <th className="py-1.5 px-3 text-right">Provided / Req (mm²/m)</th>
                  <th className="py-1.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.MS.map((m, idx) => (
                  <tr key={idx} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                    <td className="py-1.5 px-3">{m.sec}</td>
                    <td className="py-1.5 px-3">{m.lab}</td>
                    <td className="py-1.5 px-3 font-mono-eng font-semibold">T{m.d}@{m.sp}</td>
                    <td className="py-1.5 px-3 text-right font-mono-eng">
                      {f(m.prov, 0)} / {f(m.need, 0)}
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <span
                        className="font-mono-eng text-[10.5px] font-bold px-2 py-0.5 rounded"
                        style={{
                          color: m.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                          backgroundColor: m.ok ? 'var(--status-pass-bg)' : 'var(--status-fail-bg)',
                        }}
                      >
                        {m.ok ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
