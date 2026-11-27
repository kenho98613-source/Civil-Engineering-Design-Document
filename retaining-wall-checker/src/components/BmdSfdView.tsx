import { useState } from 'react';
import { f, lapReq, rcv } from '../engine';
import type { CalcAllSuccessResult, CurtailmentResult, DiagramMap, DiagramPoint, WallState } from '../engine';

interface BmdSfdViewProps {
  state: WallState;
  result: CalcAllSuccessResult;
  diagrams: DiagramMap | null;
  curtailments: Record<string, CurtailmentResult | null>;
}

function StemDiagramSvg({
  title,
  pts,
  field,
  unit,
  color,
  curtail,
}: {
  title: string;
  pts: DiagramPoint[];
  field: 'M' | 'V';
  unit: string;
  color: string;
  curtail?: CurtailmentResult | null;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 280;
  const H = 260;
  const z0 = pts[0].z ?? 0;
  const z1 = pts[pts.length - 1].z ?? z0 + 1;
  const mx = Math.max(1e-6, ...pts.map((p) => Math.abs(p[field])));
  const x0 = 110;
  const sx = (W - x0 - 28) / mx;
  const sy = (H - 52) / Math.max(z1 - z0, 1e-6);
  const X = (v: number) => x0 + v * sx;
  const Y = (z: number) => H - 26 - (z - z0) * sy;

  const poly = [[0, z0], ...pts.map((p) => [p[field], p.z ?? z0]), [0, z1]]
    .map(([v, z]) => `${X(v).toFixed(1)},${Y(z).toFixed(1)}`)
    .join(' ');
  const activePt = hoverIdx != null ? pts[hoverIdx] : pts[0];

  return (
    <div
      className="rounded-md border p-2.5"
      style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold">{title}</span>
        <span className="font-mono-eng text-[11px] font-bold" style={{ color }}>
          {hoverIdx != null ? `z +${f(activePt.z ?? 0)}: ` : 'base: '}
          {f(activePt[field], 1)} {unit}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ry = ((e.clientY - rect.top) / rect.height) * H;
          const z = z0 + (H - 26 - ry) / sy;
          let best = 0;
          let bd = Infinity;
          pts.forEach((p, idx) => {
            const d = Math.abs((p.z ?? 0) - z);
            if (d < bd) {
              bd = d;
              best = idx;
            }
          });
          setHoverIdx(best);
        }}
      >
        <line x1={x0} y1={Y(z0)} x2={x0} y2={Y(z1)} stroke="var(--text-muted)" strokeWidth="1.4" />
        <polygon points={poly} fill={color} fillOpacity="0.16" stroke={color} strokeWidth="1.5" />
        <text x="6" y={Y(z0) + 4} fontSize="10" fill="var(--text-muted)" className="font-mono-eng">
          +{f(z0)}
        </text>
        <text x="6" y={Y(z1) + 4} fontSize="10" fill="var(--text-muted)" className="font-mono-eng">
          +{f(z1)}
        </text>
        {field === 'M' && curtail && !curtail.none && curtail.zc != null && curtail.zt != null && (
          <g>
            <line
              x1={x0 - 8}
              x2={W - 8}
              y1={Y(curtail.zc)}
              y2={Y(curtail.zc)}
              stroke="var(--status-pass)"
              strokeDasharray="4 3"
              strokeWidth="1.4"
            />
            <text
              x={W - 8}
              y={Y(curtail.zc) - 4}
              textAnchor="end"
              fontSize="9.5"
              fontWeight="600"
              fill="var(--status-pass)"
              className="font-mono-eng"
            >
              50% stop +{f(curtail.zc)}
            </text>
            <line
              x1={x0 - 8}
              x2={W - 60}
              y1={Y(curtail.zt)}
              y2={Y(curtail.zt)}
              stroke="var(--status-pass)"
              strokeDasharray="1.5 2.5"
              strokeWidth="1"
            />
          </g>
        )}
        {hoverIdx != null && (
          <g>
            <line
              x1={x0}
              x2={X(activePt[field])}
              y1={Y(activePt.z ?? z0)}
              y2={Y(activePt.z ?? z0)}
              stroke={color}
              strokeDasharray="2 2"
            />
            <circle cx={X(activePt[field])} cy={Y(activePt.z ?? z0)} r="3.5" fill={color} />
          </g>
        )}
      </svg>
    </div>
  );
}

export function BmdSfdView({ state, result, diagrams, curtailments }: BmdSfdViewProps) {
  if (!diagrams) {
    return (
      <div className="rounded-md border p-4 text-xs" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
        No RC elements to display BMD / SFD envelopes.
      </div>
    );
  }

  const stemElems = result.RS.filter((r) => diagrams[r.k] && /^[sx]/.test(r.k));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">ULS Bending Moment &amp; Shear Force Envelopes (v14.0 CR-3)</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            CoP SUC 2013 load combinations · 50% bar curtailment (Cl 9.2.1.6) · Lap lengths (Cl 8.7.4.1). Hover diagrams to read (M, V) at any level.
          </p>
        </div>
      </div>

      {/* Stem BMD/SFD Grid */}
      {stemElems.map((r) => {
        const pts = diagrams[r.k];
        const cu = curtailments[r.k];
        return (
          <div key={r.k} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StemDiagramSvg
              title={`${r.n.replace(/ \(RC\)$/, '')} — BMD`}
              pts={pts}
              field="M"
              unit="kNm/m"
              color="var(--accent-cobalt)"
              curtail={cu}
            />
            <StemDiagramSvg
              title={`${r.n.replace(/ \(RC\)$/, '')} — SFD`}
              pts={pts}
              field="V"
              unit="kN/m"
              color="var(--status-fail)"
            />
          </div>
        );
      })}

      {/* Curtailment & Lap Length Table */}
      {stemElems.length > 0 && (
        <div
          className="rounded-md border overflow-hidden"
          style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
        >
          <div
            className="px-3 py-2 text-xs font-semibold border-b"
            style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
          >
            50% Curtailment (CoP Cl 9.2.1.6) &amp; Tension Lap Length (CoP Cl 8.7.4.1)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
                  <th className="py-2 px-3">Element</th>
                  <th className="py-2 px-3 text-right">Base M / V</th>
                  <th className="py-2 px-3">50% Main Bar Curtailment</th>
                  <th className="py-2 px-3 text-right">Lap Length</th>
                </tr>
              </thead>
              <tbody>
                {stemElems.map((r) => {
                  const pts = diagrams[r.k];
                  const cu = curtailments[r.k];
                  const b = rcv(state, r.k);
                  const l1 = lapReq(state, r.k);
                  const l3 = lapReq(state, r.k, 3);
                  return (
                    <tr key={r.k} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                      <td className="py-2 px-3 font-medium">{r.n}</td>
                      <td className="py-2 px-3 text-right font-mono-eng whitespace-nowrap">
                        {f(pts[0].M)} kNm/m · {f(pts[0].V)} kN/m
                      </td>
                      <td className="py-2 px-3">
                        {!cu ? (
                          '–'
                        ) : cu.none ? (
                          <span style={{ color: 'var(--text-muted)' }}>No — {cu.why}</span>
                        ) : (
                          <span>
                            <b className="font-mono-eng" style={{ color: 'var(--status-pass)' }}>
                              T{cu.phi}@{2 * cu.s} stop at +{f(cu.zc!)} mPD
                            </b>{' '}
                            <span style={{ color: 'var(--text-muted)' }}>
                              (z_t +{f(cu.zt!)} + {f(cu.ext!, 0)} mm)
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-eng whitespace-nowrap">
                        {l1 ? (
                          <>
                            T{b.d}: <b>{l1} mm</b>
                            {b.d3 !== b.d && l3 ? ` · T${b.d3}: ${l3} mm` : ''}
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
