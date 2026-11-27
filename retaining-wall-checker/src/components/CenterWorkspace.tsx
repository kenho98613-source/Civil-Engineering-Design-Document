import { useState } from 'react';
import { CheckCircle2, Lock, X, XCircle } from 'lucide-react';
import {
  benchRun,
  renderCalcSec5,
  renderLimitsSec8,
  renderStabSec6,
  renderStructSec7,
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
  { id: 'calc5', label: '5. Loads & Ka' },
  { id: 'stab6', label: '6. Stability Steps' },
  { id: 'rc7', label: '7. Structural Steps' },
  { id: 'limits8', label: '8. Limits' },
];

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function CalcSheet({
  title,
  html,
  fullClauses,
  onToggleClauses,
}: {
  title: string;
  html: string;
  fullClauses: boolean;
  onToggleClauses: (full: boolean) => void;
}) {
  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden"
      style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b"
        style={{ backgroundColor: 'var(--surface-chrome)', borderColor: 'var(--border-hairline)' }}
      >
        <span className="text-xs font-semibold tracking-tight">{title}</span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span style={{ color: 'var(--text-muted)' }}>Detail:</span>
          <button
            type="button"
            onClick={() => onToggleClauses(true)}
            className="px-2.5 py-0.5 rounded-full border cursor-pointer transition-colors"
            style={{
              borderColor: fullClauses ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
              backgroundColor: fullClauses ? 'var(--accent-cobalt-soft)' : 'var(--surface-panel)',
              color: fullClauses ? 'var(--accent-cobalt)' : 'var(--text-secondary)',
              fontWeight: fullClauses ? 600 : 500,
            }}
          >
            Full (All Clauses &amp; Derivations)
          </button>
          <button
            type="button"
            onClick={() => onToggleClauses(false)}
            className="px-2.5 py-0.5 rounded-full border cursor-pointer transition-colors"
            style={{
              borderColor: !fullClauses ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
              backgroundColor: !fullClauses ? 'var(--accent-cobalt-soft)' : 'var(--surface-panel)',
              color: !fullClauses ? 'var(--accent-cobalt)' : 'var(--text-secondary)',
              fontWeight: !fullClauses ? 600 : 500,
            }}
          >
            Concise
          </button>
        </div>
      </div>
      <div
        className={`calc-sheet${fullClauses ? ' full' : ''} p-4`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export function CenterWorkspace(props: CenterWorkspaceProps) {
  const { state: S, result, registerRows, activeTab } = props;
  const [fullClauses, setFullClauses] = useState(true);

  return (
    <main className="flex-1 min-w-0 flex flex-col min-h-0">
      {/* Workspace Sub-Tab Bar (Direction A Underline Navigation) */}
      <div
        className="flex items-center gap-1 px-3.5 border-b overflow-x-auto shrink-0"
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
              className="px-3 h-8 text-xs whitespace-nowrap cursor-pointer border-b-2 transition-colors"
              style={{
                borderColor: on ? 'var(--accent-cobalt)' : 'transparent',
                color: on ? 'var(--accent-cobalt)' : 'var(--text-secondary)',
                fontWeight: on ? 600 : 500,
              }}
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
            className="rounded-xl border overflow-hidden shadow-sm"
            style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
          >
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr
                  className="border-b text-left text-[11px] uppercase tracking-wide"
                  style={{
                    backgroundColor: 'var(--surface-chrome)',
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
                      onClick={() => props.onTabChange(r.gp === 's' ? 'stab6' : 'rc7')}
                      className="border-b last:border-b-0 cursor-pointer hover:opacity-85"
                      style={{ borderColor: 'var(--border-muted)', opacity: isOff ? 0.6 : 1 }}
                      title="Click to open detailed calculation steps"
                    >
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
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
          <CalcSheet
            title="Section 5 — Earth Pressure Coefficients & Characteristic Loads (Unfactored)"
            html={renderCalcSec5(S, result)}
            fullClauses={fullClauses}
            onToggleClauses={setFullClauses}
          />
        )}

        {activeTab === 'stab6' && !result.err && (
          <CalcSheet
            title={`Section 6 — Detailed Stability Calculation Steps (${result.P ? 'Geoguide 1 Partial Factors' : 'CoP Foundations 2017 Global FOS'})`}
            html={renderStabSec6(S, result)}
            fullClauses={fullClauses}
            onToggleClauses={setFullClauses}
          />
        )}

        {activeTab === 'rc7' && !result.err && (
          <CalcSheet
            title="Section 7 — Structural RC / Mass Concrete Step-by-Step Design (CoP SUC 2013)"
            html={renderStructSec7(S, result)}
            fullClauses={fullClauses}
            onToggleClauses={setFullClauses}
          />
        )}

        {activeTab === 'limits8' && !result.err && (
          <CalcSheet
            title="Section 8 — Scope, Wall Type Basis & Verification Register (Internal)"
            html={renderLimitsSec8(S, result)}
            fullClauses={fullClauses}
            onToggleClauses={setFullClauses}
          />
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
