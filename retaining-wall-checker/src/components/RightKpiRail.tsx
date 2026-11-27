import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { f, stepOf } from '../engine';
import type { CalcAllResult, CheckRegisterRow } from '../engine';
import type { WorkspaceTab } from '../hooks/useProjectStore';

interface RightKpiRailProps {
  result: CalcAllResult;
  registerRows: CheckRegisterRow[];
  onJumpTab: (tab: WorkspaceTab) => void;
  onJumpStep: (step: number) => void;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function extractMainVal(html: string): string {
  const m = html.match(/<b>([^<]+)<\/b>/);
  return m ? m[1] : stripTags(html);
}

const SHORT_CODE: Record<string, string> = {
  sl: 'SL',
  ot: 'OT',
  br: 'BR',
  up: 'UP',
  ecc: 'EC',
  acc: 'AI',
  rc: 'RC',
  mesh: 'MS',
};

export function RightKpiRail({ result, registerRows, onJumpTab, onJumpStep }: RightKpiRailProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hasErr = !!result.err;
  const fails = !result.err ? result.fails : [];
  const overallOk = !hasErr && fails.length === 0;

  const stabRows = registerRows.filter((r) => r.gp === 's');
  const rcRows = registerRows.filter((r) => r.gp === 'r');

  const statusColor = (st: CheckRegisterRow['st']) => {
    if (st === true) return 'var(--status-pass)';
    if (st === false) return 'var(--status-fail)';
    if (st === 'rv') return 'var(--status-warn)';
    return 'var(--status-na)';
  };

  const renderBody = () => {
    if (result.err) {
      return (
        <div className="p-3 space-y-2">
          <div
            className="rounded border p-2.5 text-xs"
            style={{
              backgroundColor: 'var(--status-fail-bg)',
              borderColor: 'var(--status-fail-bd)',
              color: 'var(--status-fail)',
            }}
          >
            <div className="font-semibold flex items-center gap-1.5 mb-1.5">
              <XCircle className="w-4 h-4 shrink-0" />
              {result.V.E.length} Input Error{result.V.E.length > 1 ? 's' : ''}
            </div>
            <ul className="space-y-1.5 list-disc pl-4">
              {result.V.E.map((msg, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onJumpStep(stepOf(msg))}
                    className="text-left underline decoration-dotted cursor-pointer"
                  >
                    {msg}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div className="p-2.5 space-y-3 overflow-y-auto flex-1">
        {/* Overall Verdict Card */}
        <button
          type="button"
          onClick={() => onJumpTab('register')}
          className="w-full rounded-md border px-3 py-2 text-left cursor-pointer transition-opacity hover:opacity-95"
          style={{
            backgroundColor: overallOk ? 'var(--status-pass-bg)' : 'var(--status-fail-bg)',
            borderColor: overallOk ? 'var(--status-pass-bd)' : 'var(--status-fail-bd)',
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
              style={{ color: overallOk ? 'var(--status-pass)' : 'var(--status-fail)' }}
            >
              {overallOk ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {overallOk ? 'ALL CHECKS PASS' : `${fails.length} CHECK${fails.length > 1 ? 'S' : ''} FAIL`}
            </span>
            <span className="font-mono-eng text-[11px]" style={{ color: 'var(--text-muted)' }}>
              B = {f(result.G.B)} m
            </span>
          </div>
          {!overallOk && (
            <div className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--status-fail)' }}>
              {fails.join(' · ')}
            </div>
          )}
        </button>

        {/* Warnings Indicator */}
        {result.V.W.length > 0 && (
          <div
            className="rounded border px-2.5 py-1.5 text-[11px] flex items-center gap-2"
            style={{
              backgroundColor: 'var(--status-warn-bg)',
              borderColor: 'var(--status-warn-bd)',
              color: 'var(--status-warn)',
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              <b>{result.V.W.length}</b> engineering note{result.V.W.length > 1 ? 's' : ''} / warning
              {result.V.W.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Group 1: Wall Stability */}
        <div>
          <div
            className="text-[10px] font-bold uppercase tracking-wider px-1 mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Wall Stability
          </div>
          <div className="space-y-1.5">
            {stabRows.map((row) => {
              const col = statusColor(row.st);
              return (
                <button
                  key={row.id + row.n}
                  type="button"
                  onClick={() => onJumpTab('stab6')}
                  className="w-full text-left rounded border px-2.5 py-2 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: 'var(--surface-panel)',
                    borderColor: 'var(--border-hairline)',
                    borderLeftWidth: '3px',
                    borderLeftColor: col,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-semibold truncate">{row.n}</span>
                    <span
                      className="font-mono-eng text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        color: row.st === true ? 'var(--status-pass)' : row.st === false ? 'var(--status-fail)' : 'var(--text-muted)',
                        backgroundColor:
                          row.st === true
                            ? 'var(--status-pass-bg)'
                            : row.st === false
                              ? 'var(--status-fail-bg)'
                              : 'var(--surface-subtle)',
                      }}
                    >
                      {row.st === true ? 'PASS' : row.st === false ? 'FAIL' : row.st === 'na' ? 'N/A' : 'OFF'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1 gap-2">
                    <span className="font-mono-eng text-[13px] font-bold tabular-nums">
                      {extractMainVal(row.pv)}
                    </span>
                    <span className="font-mono-eng text-[10.5px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {stripTags(row.rq)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Group 2: Structural Design */}
        {rcRows.length > 0 && (
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-wider px-1 mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Structural (RC / Mesh)
            </div>
            <div className="space-y-1.5">
              {rcRows.map((row, idx) => {
                const col = statusColor(row.st);
                const util = typeof row.u === 'number' && Number.isFinite(row.u) ? row.u : null;
                const pct = util != null ? Math.min(100, (util * 100) / 1.25) : 0;
                const barCol =
                  util == null
                    ? col
                    : util > 1 + 1e-9
                      ? 'var(--status-fail)'
                      : util > 0.85
                        ? 'var(--status-warn)'
                        : 'var(--status-pass)';
                return (
                  <button
                    key={row.id + idx}
                    type="button"
                    onClick={() => onJumpTab('rc7')}
                    className="w-full text-left rounded border px-2.5 py-2 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--surface-panel)',
                      borderColor: 'var(--border-hairline)',
                      borderLeftWidth: '3px',
                      borderLeftColor: col,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold truncate">{row.n}</span>
                      {util != null && (
                        <span className="font-mono-eng text-[11px] font-bold" style={{ color: barCol }}>
                          {f(util * 100, 0)}%
                        </span>
                      )}
                    </div>
                    <div className="font-mono-eng text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {stripTags(row.pv)}
                    </div>
                    {util != null && (
                      <div
                        className="mt-1.5 h-1.5 rounded-full overflow-hidden relative"
                        style={{ backgroundColor: 'var(--surface-subtle)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct.toFixed(1)}%`, backgroundColor: barCol }}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-px opacity-50"
                          style={{ left: '80%', backgroundColor: 'var(--text-primary)' }}
                          title="100% limit"
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Full Desktop KPI Panel (>= 1280px) or Slide-Over Drawer */}
      <aside
        className={`flex flex-col shrink-0 border-l transition-all ${
          drawerOpen
            ? 'fixed right-0 top-[77px] bottom-0 w-[300px] z-40 shadow-2xl'
            : 'hidden xl:flex w-[296px]'
        }`}
        style={{
          backgroundColor: 'var(--surface-canvas)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div
          className="flex items-center justify-between px-3 h-9 border-b shrink-0"
          style={{
            backgroundColor: 'var(--surface-panel)',
            borderColor: 'var(--border-hairline)',
          }}
        >
          <span className="text-xs font-semibold tracking-tight">Live Check Status</span>
          <div className="flex items-center gap-1.5">
            <span
              className="font-mono-eng text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{
                backgroundColor: hasErr
                  ? 'var(--status-warn)'
                  : overallOk
                    ? 'var(--status-pass)'
                    : 'var(--status-fail)',
              }}
            >
              {hasErr ? 'ERR' : overallOk ? 'PASS' : 'FAIL'}
            </span>
            {drawerOpen && (
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-0.5 rounded border cursor-pointer"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {renderBody()}

        {/* Quantities Footer */}
        {!result.err && (
          <div
            className="grid grid-cols-2 gap-2 px-3 py-2 border-t shrink-0"
            style={{
              backgroundColor: 'var(--surface-panel)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Concrete
              </div>
              <div className="font-mono-eng text-xs font-bold tabular-nums">
                {f(result.vol, 3)} <span className="font-normal opacity-70">m³/m</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Steel (est.)
              </div>
              <div className="font-mono-eng text-xs font-bold tabular-nums">
                {f(result.steel, 0)} <span className="font-normal opacity-70">kg/m</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Compact Status Rail (< 1280px) */}
      {!drawerOpen && (
        <aside
          className="flex xl:hidden flex-col items-center py-2 gap-1.5 w-14 shrink-0 border-l"
          style={{
            backgroundColor: 'var(--surface-panel)',
            borderColor: 'var(--border-hairline)',
          }}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-1 rounded border mb-1 cursor-pointer"
            style={{ borderColor: 'var(--border-hairline)' }}
            title="Expand KPI panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {registerRows.slice(0, 8).map((r, i) => (
            <button
              key={r.id + i}
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-10 py-1 rounded font-mono-eng text-[10px] font-bold text-white cursor-pointer"
              style={{ backgroundColor: statusColor(r.st) }}
              title={`${r.n}: ${stripTags(r.pv)}`}
            >
              {SHORT_CODE[r.id] || r.id.toUpperCase()}
            </button>
          ))}
        </aside>
      )}
    </>
  );
}
