import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Gauge,
  Pin,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  TYN,
  UN,
  buildStressState,
  calcCriticalLimits,
  f,
  fullM,
  govN,
  isG,
  lean,
  qVal,
  runAutoOptimizer,
  runSensitivity,
  wlLev,
} from '../engine';
import type {
  FullMetricsSuccess,
  OptimizeResult,
  SensitivityResult,
  WallState,
} from '../engine';

interface DesignToolsViewProps {
  state: WallState;
  onApplyState: (mutator: (draft: WallState) => void, msg: string) => void;
  onReplaceState: (next: WallState, msg: string) => void;
}

interface PinnedScenario {
  name: string;
  S: WallState;
  m: FullMetricsSuccess;
}

const PIN_KEY = 'rw14_pinned_scenarios';
const PIN_COLORS = ['#2563eb', '#d97706', '#059669'];

export function DesignToolsView({ state: S, onApplyState, onReplaceState }: DesignToolsViewProps) {
  // 1. Auto-Optimizer state
  const [optTb, setOptTb] = useState(false);
  const [optRc, setOptRc] = useState(false);
  const [tbMin, setTbMin] = useState(() => +Math.max(0.3, +S.tb - 0.2).toFixed(2));
  const [tbMax, setTbMax] = useState(() => +(+S.tb + 0.4).toFixed(2));
  const [optBusy, setOptBusy] = useState(false);
  const [optPct, setOptPct] = useState(0);
  const [optRes, setOptRes] = useState<OptimizeResult | null>(null);

  // 2. Live Stress Test state
  const [stressWl, setStressWl] = useState<number | null>(null);
  const [stressQ, setStressQ] = useState<number | null>(null);

  // 3. Scenario Pin A/B/C state
  const [pinName, setPinName] = useState('');
  const [pins, setPins] = useState<PinnedScenario[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
    } catch {
      return [];
    }
  });

  // 4. Sensitivity Tornado state
  const [sensRes, setSensRes] = useState<SensitivityResult | null>(null);

  const savePins = (next: PinnedScenario[]) => {
    setPins(next);
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleRunOpt = async () => {
    setOptBusy(true);
    setOptPct(5);
    try {
      const res = await runAutoOptimizer(S, { optTb, optRc, tbMin, tbMax }, (p) => setOptPct(p));
      setOptRes(res);
      setOptPct(100);
    } finally {
      setOptBusy(false);
    }
  };

  const handleApplyOpt = () => {
    const b = optRes?.best;
    if (!b) return;
    onApplyState((d) => {
      if (optRes?.G1 && b.gw != null) d.gBt = b.gw;
      else {
        if (d.ty !== 'L' && !d.xs.length && b.Lt != null) d.Lt = b.Lt;
        if (d.ty !== 'Li' && b.Lh != null) d.Lh = b.Lh;
        d.tb = b.tb;
      }
    }, 'Optimised geometry applied');
  };

  // Live Stress computations
  const curWl = stressWl ?? wlLev(S);
  const curQ = stressQ ?? qVal(S);
  const stressedState = useMemo(() => buildStressState(S, stressWl, stressQ), [S, stressQ, stressWl]);
  const stressMetrics = useMemo(() => lean(stressedState), [stressedState]);
  const critLimits = useMemo(() => calcCriticalLimits(stressedState), [stressedState]);

  const handlePin = (targetS: WallState, customName?: string) => {
    if (pins.length >= 3) return;
    const m = fullM(targetS);
    if (m.err) return;
    const label = customName || `${String.fromCharCode(65 + pins.length)} – ${pinName.trim() || TYN[targetS.ty]}`;
    savePins([...pins, { name: label, S: structuredClone(targetS), m }]);
    setPinName('');
  };

  const stateKey = JSON.stringify(S);

  const renderTornadoSvg = (T: SensitivityResult, key: 'sl' | 'br') => {
    const rows = T.rows
      .filter((r) => r.lo && r.hi)
      .map((r) => ({ ...r, a: r.lo![key], b: r.hi![key], sw: Math.abs(r.hi![key] - r.lo![key]) }))
      .sort((x, y) => y.sw - x.sw);
    const baseVal = T.base[key];
    const mx =
      Math.max(1.1, baseVal * 1.1, ...rows.map((r) => Math.max(r.a, r.b)).filter(Number.isFinite)) * 1.08;
    const W = 720;
    const lw = 210;
    const rw = W - lw - 34;
    const X = (v: number) => lw + (rw * Math.min(v, mx)) / mx;
    const rh = 26;
    const H = 34 + rows.length * rh + 20;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block rounded border" style={{ backgroundColor: 'var(--cad-bg)', borderColor: 'var(--border-muted)' }}>
        <text x="10" y="18" fontSize="11.5" fontWeight="700" fill="var(--text-primary)">
          {key === 'sl' ? 'Sliding' : 'Bearing'} Utilisation — Base {f(100 * baseVal, 0)}%
        </text>
        {Array.from({ length: Math.floor(mx / 0.25) + 1 }, (_, i) => i * 0.25).map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1={28} y2={H - 16} stroke="var(--border-muted)" strokeWidth="0.8" />
            <text x={X(v)} y={H - 4} textAnchor="middle" fontSize="9.5" fill="var(--text-muted)" className="font-mono-eng">
              {f(100 * v, 0)}%
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = 32 + i * rh;
          const xA1 = X(Math.min(baseVal, r.a));
          const xA2 = X(Math.max(baseVal, r.a));
          const xB1 = X(Math.min(baseVal, r.b));
          const xB2 = X(Math.max(baseVal, r.b));
          return (
            <g key={r.n}>
              <text x="10" y={y + 15} fontSize="10.5" fill="var(--text-secondary)">
                {r.n} <tspan fill="var(--text-muted)">({r.lab})</tspan>
              </text>
              <rect x={xA1} y={y + 3} width={Math.max(2, xA2 - xA1)} height={rh - 9} rx={2} fill="#3b82f6" fillOpacity="0.85" />
              <rect x={xB1} y={y + 3} width={Math.max(2, xB2 - xB1)} height={rh - 9} rx={2} fill="#f59e0b" fillOpacity="0.85" />
              <text x={X(r.a) + (r.a < baseVal ? -4 : 4)} y={y + 15} textAnchor={r.a < baseVal ? 'end' : 'start'} fontSize="9.5" fill="var(--text-primary)" className="font-mono-eng">
                {f(100 * r.a, 0)}
              </text>
              <text x={X(r.b) + (r.b < baseVal ? -4 : 4)} y={y + 15} textAnchor={r.b < baseVal ? 'end' : 'start'} fontSize="9.5" fill="var(--text-primary)" className="font-mono-eng">
                {f(100 * r.b, 0)}
              </text>
            </g>
          );
        })}
        <line x1={X(baseVal)} x2={X(baseVal)} y1={28} y2={H - 16} stroke="var(--text-primary)" strokeWidth="1.3" />
        {mx >= 1 && (
          <line x1={X(1)} x2={X(1)} y1={28} y2={H - 16} stroke="var(--status-fail)" strokeWidth="1.5" strokeDasharray="5 3" />
        )}
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. AUTO-OPTIMIZER CARD */}
      <section className="rounded-md border p-3.5 space-y-3" style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-cobalt)' }} />
              Auto-Optimizer — Minimum Concrete Volume
            </h3>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Searches {isG(S) ? 'block top width b_t' : 'toe / heel geometry'} at 0.05 m resolution for the smallest concrete volume passing all stability checks.
            </p>
          </div>
          <button
            type="button"
            disabled={optBusy}
            onClick={handleRunOpt}
            className="px-3 py-1.5 rounded text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-cobalt)' }}
          >
            {optBusy ? 'Searching…' : 'Run Auto-Optimizer'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          {!isG(S) && (
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={optTb} onChange={(e) => setOptTb(e.target.checked)} />
                <span>Also optimise base thickness</span>
              </label>
              <input type="number" step={0.05} value={tbMin} onChange={(e) => setTbMin(+e.target.value)} className="w-16 px-1.5 py-0.5 rounded border font-mono-eng text-xs" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }} />
              <span>–</span>
              <input type="number" step={0.05} value={tbMax} onChange={(e) => setTbMax(+e.target.value)} className="w-16 px-1.5 py-0.5 rounded border font-mono-eng text-xs" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }} />
              <span>m</span>
            </div>
          )}
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={optRc} onChange={(e) => setOptRc(e.target.checked)} />
            <span>Require RC checks pass (current bars)</span>
          </label>
        </div>

        {optBusy && (
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-subtle)' }}>
            <div className="h-full transition-all" style={{ width: `${optPct}%`, backgroundColor: 'var(--accent-cobalt)' }} />
          </div>
        )}

        {optRes && (
          optRes.none ? (
            <div className="rounded border p-2.5 text-xs" style={{ backgroundColor: 'var(--status-fail-bg)', borderColor: 'var(--status-fail-bd)', color: 'var(--status-fail)' }}>
              No passing geometry found within search range (L ≤ {f(optRes.Lmax ?? 0)} m). Increase stem/base size or review loading.
            </div>
          ) : optRes.best && optRes.cur ? (
            <div className="space-y-2.5 pt-1">
              {optRes.key !== stateKey && (
                <div className="text-[11px]" style={{ color: 'var(--status-warn)' }}>
                  Inputs changed since this run — re-run optimizer to refresh.
                </div>
              )}
              <div className="overflow-x-auto rounded border" style={{ borderColor: 'var(--border-muted)' }}>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-left" style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
                      <th className="py-1.5 px-3">Parameter</th>
                      <th className="py-1.5 px-3 text-right">Current</th>
                      <th className="py-1.5 px-3 text-right">Optimised</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono-eng">
                    {optRes.G1 ? (
                      <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                        <td className="py-1.5 px-3 font-sans">Block top width b_t (m)</td>
                        <td className="py-1.5 px-3 text-right">{f(optRes.cur.gw)}</td>
                        <td className="py-1.5 px-3 text-right font-bold">{f(optRes.best.gw ?? 0)}</td>
                      </tr>
                    ) : (
                      <>
                        <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                          <td className="py-1.5 px-3 font-sans">Toe Lt / Heel Lh (m)</td>
                          <td className="py-1.5 px-3 text-right">{f(optRes.cur.Lt)} / {f(optRes.cur.Lh)}</td>
                          <td className="py-1.5 px-3 text-right font-bold">{f(optRes.best.Lt ?? 0)} / {f(optRes.best.Lh ?? 0)}</td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                          <td className="py-1.5 px-3 font-sans">Base thickness tb (m)</td>
                          <td className="py-1.5 px-3 text-right">{f(optRes.cur.tb)}</td>
                          <td className="py-1.5 px-3 text-right font-bold">{f(optRes.best.tb)}</td>
                        </tr>
                      </>
                    )}
                    <tr className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                      <td className="py-1.5 px-3 font-sans">Total base width B (m)</td>
                      <td className="py-1.5 px-3 text-right">{f(optRes.cur.B)}</td>
                      <td className="py-1.5 px-3 text-right font-bold">{f(optRes.best.B)}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 font-sans">Concrete volume (m³/m)</td>
                      <td className="py-1.5 px-3 text-right">{f(optRes.cur.vol, 3)}</td>
                      <td className="py-1.5 px-3 text-right font-bold" style={{ color: 'var(--status-pass)' }}>
                        {f(optRes.best.vol, 3)} ({f(100 * (1 - optRes.best.vol / Math.max(optRes.cur.vol, 1e-9)), 1)}% saved)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span style={{ color: 'var(--text-muted)' }}>
                  Governing at optimum: <b>{govN(optRes.best.m)}</b> · {optRes.n} trials in {f((optRes.ms ?? 0) / 1000, 2)} s
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={optRes.key !== stateKey}
                    onClick={handleApplyOpt}
                    className="px-3 py-1 rounded text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
                    style={{ backgroundColor: 'var(--status-pass)' }}
                  >
                    Apply to Design
                  </button>
                  <button
                    type="button"
                    disabled={optRes.key !== stateKey || pins.length >= 3}
                    onClick={() => {
                      const t = structuredClone(S);
                      if (optRes.G1 && optRes.best?.gw != null) t.gBt = optRes.best.gw;
                      else if (optRes.best) {
                        t.Lt = optRes.best.Lt ?? t.Lt;
                        t.Lh = optRes.best.Lh ?? t.Lh;
                        t.tb = optRes.best.tb;
                      }
                      handlePin(t, `${String.fromCharCode(65 + pins.length)} – Optimised ${TYN[S.ty]}`);
                    }}
                    className="px-2.5 py-1 rounded border text-xs cursor-pointer disabled:opacity-40"
                    style={{ borderColor: 'var(--border-hairline)' }}
                  >
                    Pin Optimised
                  </button>
                </div>
              </div>
            </div>
          ) : null
        )}
      </section>

      {/* 2. LIVE STRESS TEST CARD */}
      <section className="rounded-md border p-3.5 space-y-3" style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <Gauge className="w-4 h-4" style={{ color: 'var(--accent-cobalt)' }} />
              Live Stress Test — Groundwater &amp; Surcharge
            </h3>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Drag sliders to probe reserve capacity without modifying your design inputs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setStressWl(null); setStressQ(null); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer"
            style={{ borderColor: 'var(--border-hairline)' }}
          >
            <RotateCcw className="w-3 h-3" /> Design Values
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border p-2.5 space-y-1" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--surface-canvas)' }}>
            <div className="flex justify-between text-xs">
              <span>Retained GWT</span>
              <span className="font-mono-eng font-bold" style={{ color: 'var(--accent-cobalt)' }}>
                +{f(curWl)} mPD ({S.Hr > S.Zb ? f((100 * (curWl - S.Zb)) / (S.Hr - S.Zb), 0) : 0}% H)
              </span>
            </div>
            <input
              type="range"
              min={S.Zb}
              max={S.Hr}
              step={0.05}
              value={Math.max(S.Zb, Math.min(S.Hr, curWl))}
              onChange={(e) => setStressWl(+e.target.value)}
              className="w-full accent-blue-600"
            />
          </div>
          <div className="rounded border p-2.5 space-y-1" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--surface-canvas)' }}>
            <div className="flex justify-between text-xs">
              <span>Surcharge q_out</span>
              <span className="font-mono-eng font-bold" style={{ color: 'var(--accent-cobalt)' }}>
                {f(curQ, 0)} kPa
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(60, Math.ceil(qVal(S) * 2))}
              step={1}
              value={curQ}
              onChange={(e) => setStressQ(+e.target.value)}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        {!stressMetrics.err && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(
              [
                ['Sliding', stressMetrics.sl],
                ['Overturning', stressMetrics.ot],
                ['Bearing', stressMetrics.br],
                ...(stressMetrics.P ? [] : [['Uplift', stressMetrics.up] as [string, number]]),
                ['Eccentricity', stressMetrics.ec],
              ] as [string, number][]
            ).map(([lab, val]) => {
              const ok = val <= 1 + 1e-9;
              const col = ok ? (val > 0.85 ? 'var(--status-warn)' : 'var(--status-pass)') : 'var(--status-fail)';
              return (
                <div key={lab} className="rounded border p-2" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--surface-canvas)' }}>
                  <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{lab}</div>
                  <div className="font-mono-eng text-sm font-bold" style={{ color: col }}>
                    {Number.isFinite(val) ? `${f(val * 100, 0)}%` : '∞'}
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ backgroundColor: 'var(--surface-subtle)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (val * 100) / 1.4)}%`, backgroundColor: col }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Critical Thresholds Callout */}
        <div
          className="rounded border p-2.5 text-xs space-y-1"
          style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-muted)' }}
        >
          <div>
            <b>Critical retained GWL (ULS):</b>{' '}
            <span className="font-mono-eng">
              {!critLimits.w1
                ? '–'
                : critLimits.w1.none
                  ? `No ULS failure up to +${f(S.Hr)} mPD`
                  : critLimits.w1.all
                    ? `Already failing at dry (${govN(critLimits.w1.m ?? null)})`
                    : `+${f(critLimits.w1.v ?? 0)} mPD (${govN(critLimits.w1.m ?? null)})`}
            </span>
          </div>
          <div>
            <b>Middle-third limit (e = B/6):</b>{' '}
            <span className="font-mono-eng">
              {!critLimits.w2 ? '–' : critLimits.w2.none ? 'Not reached' : critLimits.w2.all ? 'Exceeded even when dry' : `+${f(critLimits.w2.v ?? 0)} mPD`}
            </span>
            {' · '}
            <b>Critical surcharge q_out:</b>{' '}
            <span className="font-mono-eng">
              {!critLimits.q1
                ? '–'
                : critLimits.q1.none
                  ? `> ${f(critLimits.qMax, 0)} kPa`
                  : critLimits.q1.all
                    ? 'Failing at 0 kPa'
                    : `${f(critLimits.q1.v ?? 0, 1)} kPa (${govN(critLimits.q1.m ?? null)})`}
            </span>
          </div>
        </div>
      </section>

      {/* 3. SCENARIO PIN A/B/C COMPARATOR */}
      <section className="rounded-md border p-3.5 space-y-3" style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
            <Pin className="w-4 h-4" style={{ color: 'var(--accent-cobalt)' }} />
            Scenario Pin &amp; A/B/C Comparator ({pins.length} / 3)
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={TYN[S.ty]}
              value={pinName}
              onChange={(e) => setPinName(e.target.value)}
              className="px-2 py-1 rounded border text-xs w-44"
              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
            />
            <button
              type="button"
              disabled={pins.length >= 3}
              onClick={() => handlePin(S)}
              className="px-3 py-1 rounded text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent-cobalt)' }}
            >
              Pin Current
            </button>
          </div>
        </div>

        {pins.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Pin up to 3 designs (e.g., Inverted-T vs Gravity vs L-wall) to compare concrete volume, steel weight, base pressure, and utilisation side by side.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border" style={{ borderColor: 'var(--border-muted)' }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b text-left" style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-muted)' }}>
                  <th className="py-1.5 px-3">Metric</th>
                  {pins.map((p, i) => (
                    <th key={i} className="py-1.5 px-3 text-right">
                      <span style={{ color: PIN_COLORS[i] }}>■</span> {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono-eng">
                {[
                  ['Base Width B (m)', (p: PinnedScenario) => f(p.m.B)],
                  ['Concrete (m³/m)', (p: PinnedScenario) => f(p.m.vol, 3)],
                  ['Steel est. (kg/m)', (p: PinnedScenario) => f(p.m.steel, 0)],
                  ['q_max SLS (kPa)', (p: PinnedScenario) => f(p.m.qmax, 1)],
                  ['Max Stability Util.', (p: PinnedScenario) => `${f(100 * Math.max(p.m.u.sl, p.m.u.ot, p.m.u.br, p.m.u.ec), 0)}%`],
                  ['Max RC Util.', (p: PinnedScenario) => (p.m.rcU != null ? `${f(100 * p.m.rcU, 0)}%` : '–')],
                  ['Verdict', (p: PinnedScenario) => (p.m.ok ? 'PASS' : 'FAIL')],
                ].map(([label, getter]) => (
                  <tr key={label as string} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                    <td className="py-1.5 px-3 font-sans">{label as string}</td>
                    {pins.map((p, i) => (
                      <td key={i} className="py-1.5 px-3 text-right">
                        {(getter as (x: PinnedScenario) => string)(p)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="py-1.5 px-3" />
                  {pins.map((p, i) => (
                    <td key={i} className="py-1.5 px-3 text-right font-sans space-x-1">
                      <button
                        type="button"
                        onClick={() => onReplaceState(structuredClone(p.S), `Loaded pinned scenario ${p.name}`)}
                        className="px-2 py-0.5 rounded border text-[11px] cursor-pointer"
                        style={{ borderColor: 'var(--border-hairline)' }}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => savePins(pins.filter((_, j) => j !== i))}
                        className="p-0.5 rounded text-[11px] cursor-pointer"
                        style={{ color: 'var(--status-fail)' }}
                      >
                        <Trash2 className="w-3 h-3 inline" />
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. SENSITIVITY TORNADO CARD */}
      <section className="rounded-md border p-3.5 space-y-3" style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent-cobalt)' }} />
              Sensitivity Tornado (One-at-a-Time)
            </h3>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Perturbs φ′ ±2°, φ′cv ±2°, GWT ±1.0 m, Surcharge ±10 kPa · Blue = decreased, Amber = increased, Red dashed = 100%.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSensRes(runSensitivity(S))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent-cobalt)' }}
          >
            <Activity className="w-3.5 h-3.5" /> Run Sensitivity
          </button>
        </div>

        {sensRes && (
          <div className="space-y-2.5">
            {sensRes.key !== stateKey && (
              <div className="text-[11px]" style={{ color: 'var(--status-warn)' }}>
                Inputs changed since last sensitivity run — click Run Sensitivity to refresh.
              </div>
            )}
            {renderTornadoSvg(sensRes, 'sl')}
            {renderTornadoSvg(sensRes, 'br')}
          </div>
        )}
      </section>
    </div>
  );
}
