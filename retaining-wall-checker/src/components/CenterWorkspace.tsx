import { AlertTriangle, CheckCircle2, Lock, X, XCircle } from 'lucide-react';
import {
  ABD,
  ABS,
  REFS,
  anch,
  ancRC,
  benchRun,
  f,
  kaEq,
  kpEq,
  rcv,
  scRows,
  windCalc,
} from '../engine';
import type {
  CalcAllResult,
  CheckRegisterRow,
  CurtailmentResult,
  DiagramMap,
  WallState,
} from '../engine';
import type { WorkspaceTab } from '../hooks/useProjectStore';
import { BmdSfdView } from './BmdSfdView';
import { DesignToolsView } from './DesignToolsView';
import { RcDiagramView } from './RcDiagramView';
import { SectionCanvas } from './SectionCanvas';

interface CenterWorkspaceProps {
  state: WallState;
  result: CalcAllResult;
  registerRows: CheckRegisterRow[];
  diagrams: DiagramMap | null;
  curtailments: Record<string, CurtailmentResult | null>;
  activeTab: WorkspaceTab;
  hoveredField: string | null;
  onTabChange: (tab: WorkspaceTab) => void;
  onEditFigureParam: (param: string, value: number) => void;
  onPreviewFigureParam: (param: string, value: number) => void;
  onCommitFigureDrag: (label: string) => void;
  onCommit: (mutator: (draft: WallState) => void, opts?: { forceHistory?: boolean; message?: string }) => void;
  onReplaceState: (next: WallState, msg: string) => void;
  onAutoBars: (only?: string) => void;
}

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'figure', label: 'Figure' },
  { id: 'rcd', label: 'RC Diagram' },
  { id: 'bmd', label: 'BMD / SFD' },
  { id: 'tools', label: 'Design Tools' },
  { id: 'register', label: 'Check Register' },
  { id: 'calc5', label: '5. Calculation' },
  { id: 'stab6', label: '6. Stability' },
  { id: 'rc7', label: '7. Structural' },
  { id: 'limits8', label: '8. Limitations' },
];

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

export function CenterWorkspace(props: CenterWorkspaceProps) {
  const { state: S, result, registerRows, activeTab } = props;

  return (
    <main className="flex-1 min-w-0 flex flex-col min-h-0">
      {/* Workspace Sub-Tab Bar */}
      <div
        className="flex items-center gap-1 px-3 h-9 border-b overflow-x-auto shrink-0"
        style={{
          backgroundColor: 'var(--surface-panel)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        {TABS.map((t) => {
          const on = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => props.onTabChange(t.id)}
              className="px-2.5 h-7 rounded text-xs whitespace-nowrap cursor-pointer transition-colors"
              style={
                on
                  ? {
                      backgroundColor: 'var(--accent-cobalt)',
                      color: '#ffffff',
                      fontWeight: 600,
                    }
                  : {
                      color: 'var(--text-secondary)',
                    }
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable Workspace Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {activeTab === 'figure' && (
          <SectionCanvas
            state={S}
            result={result}
            hoveredField={props.hoveredField}
            onEditParam={props.onEditFigureParam}
            onPreviewParam={props.onPreviewFigureParam}
            onCommitDrag={props.onCommitFigureDrag}
            onForceScaleChange={(v) => props.onCommit((d) => { d.asc = v; })}
          />
        )}

        {activeTab === 'rcd' && !result.err && (
          <RcDiagramView
            state={S}
            result={result}
            onCommit={props.onCommit}
            onAutoBars={props.onAutoBars}
          />
        )}

        {activeTab === 'bmd' && !result.err && (
          <BmdSfdView
            state={S}
            result={result}
            diagrams={props.diagrams}
            curtailments={props.curtailments}
          />
        )}

        {activeTab === 'tools' && (
          <DesignToolsView
            state={S}
            onApplyState={(mutator, msg) => props.onCommit(mutator, { forceHistory: true, message: msg })}
            onReplaceState={props.onReplaceState}
          />
        )}

        {activeTab === 'register' && !result.err && (
          <div
            className="rounded-md border overflow-hidden"
            style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
          >
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr
                  className="border-b text-left text-[11px] uppercase tracking-wide"
                  style={{
                    backgroundColor: 'var(--surface-subtle)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <th className="py-2 px-3 w-8">✓</th>
                  <th className="py-2 px-3">Check</th>
                  <th className="py-2 px-3">Provided</th>
                  <th className="py-2 px-3">Required</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Clause</th>
                </tr>
              </thead>
              <tbody>
                {registerRows.map((r, i) => {
                  const isOff = r.st === 'nc';
                  return (
                    <tr
                      key={r.id + i}
                      className="border-b last:border-b-0"
                      style={{ borderColor: 'var(--border-muted)', opacity: isOff ? 0.6 : 1 }}
                    >
                      <td className="py-2 px-3">
                        {r.lk === 1 ? (
                          <Lock className="w-3.5 h-3.5 opacity-50" />
                        ) : r.lk === 2 ? null : (
                          <input
                            type="checkbox"
                            checked={!isOff}
                            onChange={(e) =>
                              props.onCommit((d) => {
                                d.ck[r.id] = d.ck[r.id] || {};
                                d.ck[r.id].off = e.target.checked ? 0 : 1;
                              }, { forceHistory: true })
                            }
                          />
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold">{r.n}</div>
                        {r.det && !isOff && (
                          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {r.det}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono-eng">{isOff ? 'excluded' : stripHtml(r.pv)}</td>
                      <td className="py-2 px-3 font-mono-eng" style={{ color: 'var(--text-muted)' }}>
                        {isOff ? '' : stripHtml(r.rq)}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="font-mono-eng text-[10.5px] font-bold px-2 py-0.5 rounded"
                          style={{
                            color:
                              r.st === true
                                ? 'var(--status-pass)'
                                : r.st === false
                                  ? 'var(--status-fail)'
                                  : 'var(--text-muted)',
                            backgroundColor:
                              r.st === true
                                ? 'var(--status-pass-bg)'
                                : r.st === false
                                  ? 'var(--status-fail-bg)'
                                  : 'var(--surface-subtle)',
                          }}
                        >
                          {r.st === true ? 'PASS' : r.st === false ? 'FAIL' : r.st === 'na' ? 'N/A' : 'OFF'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {r.cl}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'calc5' && !result.err && (
          <div className="space-y-3">
            <div
              className="rounded-md border overflow-hidden"
              style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
            >
              <div
                className="px-3 py-2 text-xs font-semibold border-b"
                style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
              >
                5.0 Earth Pressure Coefficients
              </div>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {[
                    ['Ka', 'Active earth pressure coefficient', kaEq(S, result.Pk.al, result.Pk.d), f(result.Pk.Ka, 3)],
                    ['Kah', 'Horizontal component Ka·cos(α + δ)', 'Ka·cos(α + δ)', f(result.Pk.Kah, 3)],
                    ['δ', 'Wall friction angle (GG1 Table 14)', result.Pk.wd.src, `${f(result.Pk.d, 1)}°`],
                    ['Kp', 'Passive earth pressure coefficient', S.fon && !S.nopp ? kpEq(S, result.Pk) : 'ignored', S.fon && !S.nopp ? f(result.Pk.Kp, 3) : 'not used'],
                  ].map(([sym, desc, fm, val]) => (
                    <tr key={sym} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                      <td className="py-2 px-3 font-mono-eng font-semibold w-16">{sym}</td>
                      <td className="py-2 px-3">{desc}</td>
                      <td className="py-2 px-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>{fm}</td>
                      <td className="py-2 px-3 text-right font-mono-eng font-semibold">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className="rounded-md border overflow-hidden"
              style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
            >
              <div
                className="px-3 py-2 text-xs font-semibold border-b"
                style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
              >
                5.1 Characteristic Load Components ({result.Ck.it.length} items)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-left text-[11px]" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
                      <th className="py-1.5 px-3">Ref</th>
                      <th className="py-1.5 px-3">Component</th>
                      <th className="py-1.5 px-3">Formula</th>
                      <th className="py-1.5 px-3 text-right">Force (kN/m)</th>
                      <th className="py-1.5 px-3 text-right">Arm (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.Ck.it.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                        <td className="py-1.5 px-3 font-mono-eng">{item.n}</td>
                        <td className="py-1.5 px-3">{item.t}</td>
                        <td className="py-1.5 px-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.fm}</td>
                        <td className="py-1.5 px-3 text-right font-mono-eng">{f(item.F, 2)}</td>
                        <td className="py-1.5 px-3 text-right font-mono-eng">{f(item.arm, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!!S.wo && (() => {
              const wc = windCalc(S, result.G);
              return (
                <div
                  className="rounded-md border overflow-hidden"
                  style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
                >
                  <div
                    className="px-3 py-2 text-xs font-semibold border-b flex items-center justify-between"
                    style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
                  >
                    <span>5.2 Fence Wind Load (Code of Practice on Wind Effects in HK 2019)</span>
                    <span className="font-mono-eng" style={{ color: 'var(--accent-cobalt)' }}>
                      F_w = {f(wc.F, 2)} kN/m at +{f(wc.z, 2)} mPD
                    </span>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <tbody>
                      {wc.steps.map(([sym, desc, fm, val, cl], idx) => (
                        <tr key={idx} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                          <td className="py-1.5 px-3 font-mono-eng font-semibold w-16">{sym}</td>
                          <td className="py-1.5 px-3">{desc}</td>
                          <td className="py-1.5 px-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>{fm}</td>
                          <td className="py-1.5 px-3 text-right font-mono-eng font-semibold">{val}</td>
                          <td className="py-1.5 px-3 text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{cl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'stab6' && !result.err && (
          <div className="space-y-3">
            {(() => {
              const P = result.P;
              const br = P ? result.A.br.r : result.Fc.br.rr;
              const crRows = scRows(br, !P);
              const km = P ? result.A.sl.km : result.Fc.sl.km;
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      {
                        title: '6.1 Sliding',
                        ok: P ? result.A.okS : result.Fc.okS,
                        main: P ? `Fr / Fa = ${f(result.A.sl.Fr, 1)} / ${f(result.A.sl.Fa, 1)}` : `FOS = ${f(result.Fc.sl.Fe, 2)} ≥ ${f(result.Fc.sl.ref, 2)}`,
                        sub: P ? `Utilisation ${f(result.A.sl.u * 100, 1)}%` : `R = ${f(result.Fc.sl.R, 1)} kN/m · H* = ${f(result.Fc.sl.Hst, 1)} kN/m`,
                      },
                      {
                        title: '6.2 Overturning',
                        ok: (P ? result.A.okO : result.Fc.okO) && result.csO,
                        main: P ? `M_R / M_o = ${f(result.A.ot.F, 2)} ≥ 1.00` : `FOS = ${f(result.Fc.ot.Fe, 2)} ≥ ${f(result.Fc.ot.ref, 2)}`,
                        sub: P ? `M_R = ${f(result.A.ot.s.Mr, 1)} · M_o = ${f(result.A.ot.s.Md, 1)} kNm/m` : `M_R = ${f(result.Fc.ot.s.Mr, 1)} · M* = ${f(result.Fc.ot.Mst, 1)} kNm/m`,
                      },
                      {
                        title: '6.3 Bearing Capacity',
                        ok: P ? result.A.okB : result.Fc.okB,
                        main: P ? `Qult / Qn = ${f(result.A.br.r.Qu, 0)} / ${f(result.A.br.b.N, 0)}` : `FOS = ${f(result.Fc.br.F, 2)} ≥ ${f(result.Fc.Fb, 2)}`,
                        sub: `q_ult = ${f(br.qu, 1)} kPa · B′ = ${f(br.Bp, 2)} m${br.sc ? ' · CR-4 Slope Crest' : ''}`,
                      },
                      {
                        title: '6.4 Middle-Third Eccentricity (SLS)',
                        ok: (result.A.okE || result.A.naE) && result.csE,
                        main: `e = ${f(result.A.sls.s.e, 3)} m vs B/6 = ${f(result.G.B / 6, 3)} m`,
                        sub: `x̄ = ${f(result.A.sls.s.xbar, 3)} m · N = ${f(result.A.sls.s.N, 1)} kN/m`,
                      },
                    ].map((card) => (
                      <div
                        key={card.title}
                        className="rounded-md border p-3"
                        style={{
                          backgroundColor: 'var(--surface-panel)',
                          borderColor: 'var(--border-hairline)',
                          borderLeftWidth: '4px',
                          borderLeftColor: card.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{card.title}</span>
                          <span
                            className="font-mono-eng text-[10px] font-bold px-2 py-0.5 rounded"
                            style={{
                              color: card.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                              backgroundColor: card.ok ? 'var(--status-pass-bg)' : 'var(--status-fail-bg)',
                            }}
                          >
                            {card.ok ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <div className="font-mono-eng text-sm font-bold">{card.main}</div>
                        <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                          {card.sub}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Shear Key Mechanics (GG1 Fig. 42) */}
                  {km && km.kOn && (
                    <div
                      className="rounded-md border overflow-hidden"
                      style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
                    >
                      <div
                        className="px-3 py-2 text-xs font-semibold border-b flex items-center justify-between"
                        style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
                      >
                        <span>6.1a Shear Key Sliding Mechanics (GG1 Fig. 42)</span>
                        <span className="font-mono-eng text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          dk = {f(km.dk, 2)} m · Bk = {f(km.Bk, 2)} m · xk = {f(km.xk, 2)} m
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2.5 text-xs font-mono-eng">
                        <div className="p-2 rounded" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ΔPa / ΔPq / ΔPw</div>
                          <div className="font-bold">{f(km.dPa, 1)} / {f(km.dPq, 1)} / {f(km.dPw, 1)}</div>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Key Passive Rp</div>
                          <div className="font-bold">{km.usePp ? `${f(km.Rp, 1)} kN/m` : 'excluded'}</div>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Soil-to-Soil Ns</div>
                          <div className="font-bold">{f(km.Ns, 1)} kN/m</div>
                        </div>
                        <div className="p-2 rounded" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total Fr / Fa</div>
                          <div className="font-bold">{f(km.Fr, 1)} / {f(km.Fa, 1)} kN/m</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stepped Gravity / Unreinforced Section Checks */}
                  {result.PL.length > 0 && (
                    <div
                      className="rounded-md border overflow-hidden"
                      style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
                    >
                      <div
                        className="px-3 py-2 text-xs font-semibold border-b"
                        style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
                      >
                        6.5 Internal Section Checks (Stepped Gravity / Plain Concrete Joints)
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b text-left text-[11px]" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
                            <th className="py-1.5 px-3">Section</th>
                            <th className="py-1.5 px-3 text-right">Width (m)</th>
                            <th className="py-1.5 px-3 text-right">Overturning FOS</th>
                            <th className="py-1.5 px-3 text-right">Eccentricity e</th>
                            <th className="py-1.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.PL.map((pl) => (
                            <tr key={pl.k} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                              <td className="py-1.5 px-3 font-medium">{pl.lab}</td>
                              <td className="py-1.5 px-3 text-right font-mono-eng">{f(pl.Ls, 2)}</td>
                              <td className="py-1.5 px-3 text-right font-mono-eng">{f(pl.Fot, 2)} ≥ {f(pl.Freq, 2)}</td>
                              <td className="py-1.5 px-3 text-right font-mono-eng">{f(pl.ek, 3)} / {f(pl.Ls / 6, 3)} m</td>
                              <td className="py-1.5 px-3 text-center">
                                <span
                                  className="font-mono-eng text-[10px] font-bold px-2 py-0.5 rounded"
                                  style={{
                                    color: pl.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                                    backgroundColor: pl.ok ? 'var(--status-pass-bg)' : 'var(--status-fail-bg)',
                                  }}
                                >
                                  {pl.na ? 'N/A' : pl.ok ? 'PASS' : 'FAIL'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Accidental Vehicle Impact Stability Check */}
                  {result.AI && (
                    <div
                      className="rounded-md border p-3"
                      style={{
                        backgroundColor: 'var(--surface-panel)',
                        borderColor: 'var(--border-hairline)',
                        borderLeftWidth: '4px',
                        borderLeftColor: result.AI.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">6.6 Accidental Vehicle Impact Stability (FOS ≥ 1.00)</span>
                        <span
                          className="font-mono-eng text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{
                            color: result.AI.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                            backgroundColor: result.AI.ok ? 'var(--status-pass-bg)' : 'var(--status-fail-bg)',
                          }}
                        >
                          {result.AI.ok ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <div className="font-mono-eng text-xs flex flex-wrap gap-4">
                        <span>Sliding FOS = <b>{f(result.AI.Fs, 2)}</b></span>
                        <span>Overturning FOS = <b>{f(result.AI.Fo, 2)}</b></span>
                        <span>Bearing FOS = <b>{f(result.AI.br.F, 2)}</b></span>
                        <span>Impact F = <b>{f(result.AI.b.F, 1)} kN/m</b></span>
                      </div>
                    </div>
                  )}

                  {/* Sensitivity Check: Wall Friction delta = 0 */}
                  {result.D0 && (
                    <div
                      className="rounded-md border p-3"
                      style={{
                        backgroundColor: 'var(--surface-panel)',
                        borderColor: 'var(--border-hairline)',
                        borderLeftWidth: '4px',
                        borderLeftColor: result.D0.u.okAll ? 'var(--status-pass)' : 'var(--status-warn)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">6.7 Sensitivity Check: Wall Friction δ = 0° (GG1 §7.4)</span>
                        <span
                          className="font-mono-eng text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{
                            color: result.D0.u.okAll ? 'var(--status-pass)' : 'var(--status-warn)',
                            backgroundColor: result.D0.u.okAll ? 'var(--status-pass-bg)' : 'var(--status-warn-bg)',
                          }}
                        >
                          {result.D0.u.okAll ? 'PASS' : 'CHECK'}
                        </span>
                      </div>
                      <div className="font-mono-eng text-xs flex flex-wrap gap-4" style={{ color: 'var(--text-secondary)' }}>
                        <span>Sliding util = <b>{f(result.D0.u.sl * 100, 1)}%</b></span>
                        <span>Overturning util = <b>{f(result.D0.u.ot * 100, 1)}%</b></span>
                        <span>Bearing util = <b>{f(result.D0.u.br * 100, 1)}%</b></span>
                        <span>Eccentricity util = <b>{f(result.D0.u.ec * 100, 1)}%</b></span>
                      </div>
                    </div>
                  )}

                  {crRows.length > 0 && (
                    <div
                      className="rounded-md border overflow-hidden"
                      style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
                    >
                      <div
                        className="px-3 py-2 text-xs font-semibold border-b"
                        style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
                      >
                        CR-4 Foundation Near Slope Crest Interpolation
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          {crRows.map(([sym, desc, fm, val]) => (
                            <tr key={sym} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                              <td className="py-1.5 px-3 font-mono-eng font-semibold w-16">{sym}</td>
                              <td className="py-1.5 px-3">{desc}</td>
                              <td className="py-1.5 px-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>{fm}</td>
                              <td className="py-1.5 px-3 text-right font-mono-eng font-semibold">{val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'rc7' && !result.err && (
          <div className="space-y-3">
            {/* Nominal Cover Schedule (CoP Table 4.2) */}
            {result.CA.length > 0 && (
              <div
                className="rounded-md border overflow-hidden"
                style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
              >
                <div
                  className="px-3 py-2 text-xs font-semibold border-b"
                  style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
                >
                  7.0 Nominal Concrete Cover (CoP SUC 2013 Table 4.2 · C{S.fcu})
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-left text-[11px]" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
                      <th className="py-1.5 px-3">Face / Element</th>
                      <th className="py-1.5 px-3">Exposure</th>
                      <th className="py-1.5 px-3 text-right">Min Req (mm)</th>
                      <th className="py-1.5 px-3 text-right">Provided (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.CA.map((c, idx) => (
                      <tr key={idx} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                        <td className="py-1.5 px-3 font-medium">{c.n}</td>
                        <td className="py-1.5 px-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.why}</td>
                        <td className="py-1.5 px-3 text-right font-mono-eng">{c.min ?? '–'}</td>
                        <td className="py-1.5 px-3 text-right font-mono-eng font-semibold">{c.c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.RS.length === 0 ? (
              <div className="rounded-md border p-4 text-xs" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
                No RC bending/shear elements active for this configuration.
              </div>
            ) : (
              result.RS.map((r) => {
                const cur = rcv(S, r.k);
                return (
                  <div
                    key={r.k + r.n}
                    className="rounded-md border p-3 space-y-2"
                    style={{
                      backgroundColor: 'var(--surface-panel)',
                      borderColor: 'var(--border-hairline)',
                      borderLeftWidth: '4px',
                      borderLeftColor: r.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold">{r.n}</span>
                        <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          h = {f(r.h, 0)} mm · d = {f(r.d, 0)} mm · {r.gov}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => props.onAutoBars(r.k)}
                          className="px-2 py-0.5 rounded border text-[11px] cursor-pointer"
                          style={{ borderColor: 'var(--border-hairline)' }}
                        >
                          Auto-Bar
                        </button>
                        <span
                          className="font-mono-eng text-[10.5px] font-bold px-2 py-0.5 rounded"
                          style={{
                            color: r.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                            backgroundColor: r.ok ? 'var(--status-pass-bg)' : 'var(--status-fail-bg)',
                          }}
                        >
                          {r.ok ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono-eng">
                      <div className="p-2 rounded" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Mu / Vu</div>
                        <div className="font-bold">{f(Math.abs(r.M), 1)} / {f(Math.abs(r.V), 1)}</div>
                      </div>
                      <div className="p-2 rounded" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>As,req / As,prov</div>
                        <div className="font-bold">{f(Math.max(r.Asr, r.Asm), 0)} / {f(r.Asp, 0)}</div>
                      </div>
                      <div className="p-2 rounded" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Shear v / vc</div>
                        <div className="font-bold">{f(r.v, 2)} / {f(r.vc, 2)} MPa</div>
                      </div>
                      <div className="p-2 rounded" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Main Bars ({r.tf})</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <select
                            value={cur.d}
                            onChange={(e) =>
                              props.onCommit((d) => {
                                d.rc[r.k] = { ...rcv(d, r.k), d: +e.target.value };
                              }, { forceHistory: true })
                            }
                            className="px-1 py-0.5 rounded border text-xs"
                            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
                          >
                            {ABD.map((dm) => <option key={dm} value={dm}>T{dm}</option>)}
                          </select>
                          <span>@</span>
                          <select
                            value={cur.s}
                            onChange={(e) =>
                              props.onCommit((d) => {
                                d.rc[r.k] = { ...rcv(d, r.k), s: +e.target.value };
                              }, { forceHistory: true })
                            }
                            className="px-1 py-0.5 rounded border text-xs"
                            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
                          >
                            {ABS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Gravity Anti-Crack / Min Mesh Schedule */}
            {result.MS.length > 0 && (
              <div
                className="rounded-md border overflow-hidden"
                style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
              >
                <div
                  className="px-3 py-2 text-xs font-semibold border-b flex items-center justify-between"
                  style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
                >
                  <span>7.5 Gravity Block Surface / Anti-Crack Mesh Schedule ({S.gmb.toUpperCase()})</span>
                  <span
                    className="font-mono-eng text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{
                      color: result.okMesh ? 'var(--status-pass)' : 'var(--status-fail)',
                      backgroundColor: result.okMesh ? 'var(--status-pass-bg)' : 'var(--status-fail-bg)',
                    }}
                  >
                    {result.okMesh ? 'ALL PASS' : 'CHECK'}
                  </span>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-left text-[11px]" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
                      <th className="py-1.5 px-3">Face / Direction</th>
                      <th className="py-1.5 px-3 text-right">As,req (mm²/m)</th>
                      <th className="py-1.5 px-3 text-right">Provided</th>
                      <th className="py-1.5 px-3 text-right">As,prov</th>
                      <th className="py-1.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.MS.map((m, idx) => (
                      <tr key={idx} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                        <td className="py-1.5 px-3 font-medium">{m.lab}</td>
                        <td className="py-1.5 px-3 text-right font-mono-eng">{f(m.need, 0)}</td>
                        <td className="py-1.5 px-3 text-right font-mono-eng">T{m.d}@{m.sp}</td>
                        <td className="py-1.5 px-3 text-right font-mono-eng">{f(m.prov, 0)}</td>
                        <td className="py-1.5 px-3 text-center">
                          <span
                            className="font-mono-eng text-[10px] font-bold px-2 py-0.5 rounded"
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
            )}

            {/* Starter Bar Anchorage Check */}
            {(() => {
              const an = anch(S, result.G, result.RS) || ancRC(S, result.G, result.RS);
              if (!an) return null;
              return (
                <div
                  className="rounded-md border p-3"
                  style={{
                    backgroundColor: 'var(--surface-panel)',
                    borderColor: 'var(--border-hairline)',
                    borderLeftWidth: '4px',
                    borderLeftColor: an.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">7.6 Stem Starter Bar Anchorage (CoP Cl 8.4.4)</span>
                    <span
                      className="font-mono-eng text-[10px] font-bold px-2 py-0.5 rounded"
                      style={{
                        color: an.ok ? 'var(--status-pass)' : 'var(--status-fail)',
                        backgroundColor: an.ok ? 'var(--status-pass-bg)' : 'var(--status-fail-bg)',
                      }}
                    >
                      {an.ok ? 'PASS' : 'CHECK'}
                    </span>
                  </div>
                  <div className="font-mono-eng text-xs flex flex-wrap gap-4" style={{ color: 'var(--text-secondary)' }}>
                    <span>Bar: <b>T{an.phi}</b></span>
                    <span>Req l_b = <b>{f(an.lb, 0)} mm</b></span>
                    <span>Available = <b>{f(an.av, 0)} mm</b></span>
                    {an.into && <span>Into: <b>{an.into}</b></span>}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'limits8' && (
          <div
            className="rounded-md border p-4 space-y-3 text-xs"
            style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
          >
            <h2 className="text-sm font-bold">8. Engineering Scope, Limitations &amp; Code References</h2>
            {result.V.W.length > 0 && (
              <div
                className="rounded border p-3 space-y-1"
                style={{
                  backgroundColor: 'var(--status-warn-bg)',
                  borderColor: 'var(--status-warn-bd)',
                  color: 'var(--status-warn)',
                }}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Active Warnings ({result.V.W.length})
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {result.V.W.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <ol className="list-decimal pl-5 space-y-1" style={{ color: 'var(--text-secondary)' }}>
              {REFS.map((ref, i) => <li key={i}>{ref}</li>)}
            </ol>
          </div>
        )}
      </div>
    </main>
  );
}

export function BenchmarkModal({ onClose }: { onClose: () => void }) {
  const results = benchRun();
  const passed = results.filter((r) => r.ok).length;
  const maxDiff = Math.max(...results.map((r) => r.mx));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--surface-panel)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
        >
          <div className="flex items-center gap-2">
            {passed === results.length ? (
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--status-pass)' }} />
            ) : (
              <XCircle className="w-4 h-4" style={{ color: 'var(--status-fail)' }} />
            )}
            <span className="font-semibold text-sm">
              Benchmark Gate (BM1–BM5): {passed} / {results.length} PASS
            </span>
            <span className="font-mono-eng text-xs" style={{ color: 'var(--text-muted)' }}>
              max diff {(maxDiff * 100).toFixed(4)}% (tol ≤ 0.500%)
            </span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:opacity-70 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {results.map((r) => (
            <div key={r.c.id} className="rounded border overflow-hidden" style={{ borderColor: 'var(--border-hairline)' }}>
              <div
                className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: 'var(--surface-subtle)' }}
              >
                <span>
                  {r.c.id} — {r.c.t}
                </span>
                <span
                  className="font-mono-eng"
                  style={{ color: r.ok ? 'var(--status-pass)' : 'var(--status-fail)' }}
                >
                  {r.ok ? 'PASS' : 'FAIL'} · max {(r.mx * 100).toFixed(4)}%
                </span>
              </div>
              <table className="w-full text-[11.5px] border-collapse">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
                    <th className="py-1 px-3">Quantity</th>
                    <th className="py-1 px-3 text-right">Hand Calc</th>
                    <th className="py-1 px-3 text-right">Engine</th>
                    <th className="py-1 px-3 text-right">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map((row) => (
                    <tr key={row.key} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                      <td className="py-1 px-3">{row.l}</td>
                      <td className="py-1 px-3 text-right font-mono-eng">{row.ref}</td>
                      <td className="py-1 px-3 text-right font-mono-eng">
                        {Number.isFinite(row.m) ? row.m.toFixed(4) : '–'}
                      </td>
                      <td
                        className="py-1 px-3 text-right font-mono-eng font-semibold"
                        style={{ color: row.ok ? 'var(--status-pass)' : 'var(--status-fail)' }}
                      >
                        {(row.d * 100).toFixed(4)}% {row.ok ? '✓' : '✗'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
