import { useState } from 'react';
import { CheckCircle2, Compass, FileCode2, Upload, Wand2, X } from 'lucide-react';
import {
  DWP,
  QCAT,
  TYN,
  buildModelFromDxfBay,
  dd,
  dxCands,
  dxExtract,
  dxGuess,
  dxParse,
  dxViews,
  runAutoDesignPass,
  wizBuild,
  wizErr,
  wzDef,
  wzFromS,
  wzVal,
} from '../engine';
import type { AutoDesignRunResult, DwgState, WallState, WallType, WizardData } from '../engine';

/* =========================================================================
   1. SETUP WIZARD MODAL (7-Step First-Trial Builder)
   ========================================================================= */
const WIZ_TITLES = [
  'Project & Wall Type',
  'Levels (mPD)',
  'Geometry',
  'Soil Parameters',
  'Groundwater & Loads',
  'Method & Materials',
  'Review',
];

export function SetupWizardModal({
  state,
  onApply,
  onClose,
}: {
  state: WallState;
  onApply: (next: WallState) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<WizardData>(() => wzFromS(state));
  const [err, setErr] = useState('');

  const RC = d.ty !== 'G';
  const ter = RC && /^t/.test(d.lay);
  const U = RC && d.lay === 'U';
  const sug = wzDef(d);
  const patch = (p: Partial<WizardData>) => {
    setErr('');
    setD((cur) => ({ ...cur, ...p }));
  };

  const goNext = () => {
    const e = wizErr(d, step);
    if (e) {
      setErr(e);
      return;
    }
    setStep((s) => Math.min(WIZ_TITLES.length - 1, s + 1));
  };

  const finish = () => {
    for (let k = 1; k <= 5; k++) {
      const e = wizErr(d, k);
      if (e) {
        setStep(k);
        setErr(e);
        return;
      }
    }
    onApply(wizBuild(state, d));
    onClose();
  };

  const num = (label: string, key: string, unit = '') => (
    <label className="flex flex-col gap-1 text-xs">
      <span style={{ color: 'var(--text-secondary)' }}>
        {label} {d[key] == null || d[key] === '' ? <span style={{ color: 'var(--text-muted)' }}>(suggested)</span> : ''}
      </span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step="any"
          value={d[key] != null && d[key] !== '' ? d[key] : (sug[key] ?? '')}
          onChange={(e) => patch({ [key]: e.target.value === '' ? null : +e.target.value })}
          className="w-full px-2 py-1 rounded border font-mono-eng text-xs"
          style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
        />
        {unit && <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-2xl rounded-lg border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
        >
          <span className="font-semibold text-sm flex items-center gap-2">
            <Compass className="w-4 h-4" style={{ color: 'var(--accent-cobalt)' }} />
            Setup Wizard — {step + 1} / {WIZ_TITLES.length}: {WIZ_TITLES[step]}
          </span>
          <button type="button" onClick={onClose} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {/* Progress segments */}
        <div className="flex gap-1 px-4 pt-3">
          {WIZ_TITLES.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full"
              style={{ backgroundColor: i <= step ? 'var(--accent-cobalt)' : 'var(--border-muted)' }}
            />
          ))}
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(['jno', 'pn', 'dsn', 'chk'] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1 text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {{ jno: 'Title', pn: 'Job No.', dsn: 'Designer', chk: 'Checker' }[k]}
                    </span>
                    <input
                      value={d[k]}
                      onChange={(e) => patch({ [k]: e.target.value })}
                      className="px-2 py-1 rounded border text-xs"
                      style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                    />
                  </label>
                ))}
              </div>
              <div className="text-xs font-semibold pt-1">Wall Form</div>
              <div className="grid grid-cols-4 gap-2">
                {(['T', 'L', 'Li', 'G'] as WallType[]).map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    onClick={() => patch({ ty, gs: null })}
                    className="p-2 rounded border text-xs font-medium cursor-pointer"
                    style={{
                      borderColor: d.ty === ty ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
                      backgroundColor: d.ty === ty ? 'var(--accent-cobalt-soft)' : 'var(--surface-canvas)',
                    }}
                  >
                    {TYN[ty].split(' – ')[0]}
                  </button>
                ))}
              </div>
              {RC && (
                <>
                  <div className="text-xs font-semibold pt-1">Stems on Base Layout</div>
                  <div className="grid grid-cols-4 gap-2">
                    {([['1', 'Single stem'], ['t2', 'Terraced (2)'], ['t3', 'Terraced (3)'], ['U', 'U-channel']] as const).map(([v, lb]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => patch({ lay: v })}
                        className="p-2 rounded border text-xs font-medium cursor-pointer"
                        style={{
                          borderColor: d.lay === v ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
                          backgroundColor: d.lay === v ? 'var(--accent-cobalt-soft)' : 'var(--surface-canvas)',
                        }}
                      >
                        {lb}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {num('Retained ground level Hr', 'Hr', 'mPD')}
              {num('Founding level Zb', 'Zb', 'mPD')}
              {num(U ? 'Outer ground level Hf' : 'Front ground level Hf', 'Hf', 'mPD')}
              {RC ? num('Wall top level', 'top', 'mPD') : num('Mass block top level', 'gtop', 'mPD')}
              {ter && num('Terrace 1 level', 'zt1', 'mPD')}
              {ter && d.lay === 't3' && num('Terrace 2 level', 'zt2', 'mPD')}
              {U && num('Channel clear width', 'cw', 'm')}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {RC ? (
                <>
                  {num('Main stem width t', 't', 'm')}
                  {num('Base thickness tb', 'tb', 'm')}
                  {(d.ty !== 'L' || ter || U) && num(ter || U ? 'Main stem x from toe' : 'Toe length Lt', 'Lt', 'm')}
                  {d.ty !== 'Li' && num('Heel length Lh', 'Lh', 'm')}
                </>
              ) : (
                <>
                  {num('Block bottom width B', 'gB', 'm')}
                  {num('Block top width b_t', 'gbt', 'm')}
                  <label className="flex flex-col gap-1 text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>Batter on</span>
                    <select
                      value={d.gbat}
                      onChange={(e) => patch({ gbat: e.target.value as 'front' | 'back' })}
                      className="px-2 py-1 rounded border text-xs"
                      style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                    >
                      <option value="front">Front face (toe side)</option>
                      <option value="back">Back face (retained side)</option>
                    </select>
                  </label>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-3">
              {num('Retained φ′', 'rphi', '°')}
              {num('Retained γ', 'rg', 'kN/m³')}
              {num('Foundation φ′', 'fphi', '°')}
              {num('Foundation c′', 'fc', 'kPa')}
              {num('Foundation γ', 'fg', 'kN/m³')}
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Retained GWL</span>
                <select
                  value={d.wl}
                  onChange={(e) => patch({ wl: e.target.value })}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="0">None (weepholes)</option>
                  <option value="0.3333333">1/3 H</option>
                  <option value="0.5">1/2 H</option>
                  <option value="1">Full H</option>
                </select>
              </label>
              {num('Front design GWL', 'fw', 'mPD')}
              <label className="flex flex-col gap-1 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Surcharge</span>
                <select
                  value={d.qcat}
                  onChange={(e) => patch({ qcat: e.target.value })}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  {Object.entries(QCAT)
                    .filter(([k]) => k !== 'bldg' && k !== 'c')
                    .map(([k, [lb]]) => (
                      <option key={k} value={k}>{lb}</option>
                    ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Wall-top load</span>
                <select
                  value={d.tl}
                  onChange={(e) => patch({ tl: e.target.value as WizardData['tl'] })}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="none">None</option>
                  <option value="fence">Fence (wind)</option>
                  <option value="ped">Pedestrian parapet</option>
                  <option value="veh">Vehicle barrier</option>
                </select>
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Checking method</span>
                <select
                  value={d.acc}
                  onChange={(e) => patch({ acc: e.target.value as 'fc' | 'gg1' })}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="fc">Global FOS – CoP Fdn 2017</option>
                  <option value="gg1">Partial factors – Geoguide 1</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Concrete grade fcu</span>
                <select
                  value={d.fcu}
                  onChange={(e) => patch({ fcu: +e.target.value })}
                  className="px-2 py-1 rounded border text-xs font-mono-eng"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  {[30, 35, 40, 45].map((v) => <option key={v} value={v}>C{v}</option>)}
                </select>
              </label>
            </div>
          )}

          {step === 6 && (
            <div className="rounded border p-3 text-xs space-y-1.5" style={{ backgroundColor: 'var(--surface-canvas)', borderColor: 'var(--border-muted)' }}>
              <div><b>Wall:</b> {TYN[d.ty]}</div>
              <div><b>Levels:</b> Retained +{dd(d.Hr)} · Founding +{dd(d.Zb)} · Front +{dd(d.Hf)} mPD</div>
              <div>
                <b>Geometry:</b>{' '}
                {RC
                  ? `t = ${dd(wzVal(d, 't'))} m, tb = ${dd(wzVal(d, 'tb'))} m, Lt = ${dd(wzVal(d, 'Lt'))} m, Lh = ${dd(wzVal(d, 'Lh'))} m`
                  : `B = ${dd(wzVal(d, 'gB'))} m, b_t = ${dd(wzVal(d, 'gbt'))} m, batter on ${d.gbat}`}
              </div>
              <div><b>Method:</b> {d.acc === 'gg1' ? 'GG1 Partial Factors' : 'FC 2017 Global FOS'} · C{d.fcu}</div>
            </div>
          )}

          {err && (
            <div className="rounded border px-3 py-2 text-xs" style={{ backgroundColor: 'var(--status-fail-bg)', borderColor: 'var(--status-fail-bd)', color: 'var(--status-fail)' }}>
              {err}
            </div>
          )}
        </div>

        <div
          className="flex justify-between items-center px-4 py-3 border-t"
          style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}
        >
          <button type="button" onClick={onClose} className="px-3 py-1 rounded border text-xs cursor-pointer" style={{ borderColor: 'var(--border-hairline)' }}>
            Cancel
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="px-3 py-1 rounded border text-xs cursor-pointer" style={{ borderColor: 'var(--border-hairline)' }}>
                ← Back
              </button>
            )}
            {step < WIZ_TITLES.length - 1 ? (
              <button type="button" onClick={goNext} className="px-3 py-1 rounded text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: 'var(--accent-cobalt)' }}>
                Next →
              </button>
            ) : (
              <button type="button" onClick={finish} className="px-3 py-1 rounded text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: 'var(--status-pass)' }}>
                Build Model
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. TWO-PASS AUTO DESIGN MODAL
   ========================================================================= */
export function AutoDesignModal({
  state,
  onApply,
  onClose,
}: {
  state: WallState;
  onApply: (next: WallState, msg: string) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pass1, setPass1] = useState<AutoDesignRunResult | null>(null);
  const [pass2, setPass2] = useState<AutoDesignRunResult | null>(null);

  const start = async () => {
    setBusy(true);
    try {
      const r1 = await runAutoDesignPass(state, false);
      setPass1(r1);
      if (!r1.ok) {
        const r2 = await runAutoDesignPass(state, true);
        setPass2(r2);
      }
    } finally {
      setBusy(false);
    }
  };

  const target = pass1?.ok ? pass1 : pass2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-xl rounded-lg border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}>
          <span className="font-semibold text-sm flex items-center gap-2">
            <Wand2 className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />
            Auto Design (Repair · Optimise · Size Bars)
          </span>
          <button type="button" onClick={onClose} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {!pass1 && !busy && (
            <>
              <p style={{ color: 'var(--text-secondary)' }}>
                Pass 1 repairs invalid geometry, runs the Auto-Optimizer on base/block width, and chooses the lightest passing bars. If still failing, Pass 2 proposes embedment/section thickening for your approval (retained GL is never altered).
              </p>
              <button
                type="button"
                onClick={start}
                className="px-4 py-2 rounded text-xs font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-teal)' }}
              >
                Run Auto Design
              </button>
            </>
          )}
          {busy && <div className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>Running stability optimisation &amp; reinforcement sizing…</div>}
          {target && (
            <div className="space-y-2.5">
              <div
                className="rounded border p-2.5 flex items-center gap-2 font-semibold"
                style={{
                  backgroundColor: target.ok ? 'var(--status-pass-bg)' : 'var(--status-warn-bg)',
                  borderColor: target.ok ? 'var(--status-pass-bd)' : 'var(--status-warn-bd)',
                  color: target.ok ? 'var(--status-pass)' : 'var(--status-warn)',
                }}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {target.ok ? 'All stability and structural checks pass.' : target.why}
              </div>
              {target.log.length > 0 && (
                <ul className="list-disc pl-5 space-y-1 max-h-52 overflow-y-auto" style={{ color: 'var(--text-secondary)' }}>
                  {target.log.map((line, idx) => (
                    <li key={idx} dangerouslySetInnerHTML={{ __html: line }} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}>
          <button type="button" onClick={onClose} className="px-3 py-1 rounded border text-xs cursor-pointer" style={{ borderColor: 'var(--border-hairline)' }}>
            Close
          </button>
          {target && (
            <button
              type="button"
              onClick={() => {
                onApply(target.state, target.ok ? 'Auto Design applied (all checks pass)' : 'Auto Design partial result applied');
                onClose();
              }}
              className="px-3 py-1 rounded text-xs font-semibold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--accent-cobalt)' }}
            >
              Apply Proposed Design
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   3. OFFLINE DXF IMPORT MODAL (v12.2 Parser -> Gravity Wall Builder)
   ========================================================================= */
export function DxfImportModal({
  state,
  onBuild,
  onClose,
}: {
  state: WallState;
  onBuild: (next: WallState, name: string) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState('Select an ASCII AutoCAD 2013 DXF file (.dxf). Runs 100% offline.');
  const [dwg, setDwg] = useState<DwgState | null>(null);
  const [summary, setSummary] = useState('');

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const P = dxParse(buf);
      const X = dxExtract(P);
      X.k = P.k;
      const V = dxViews(X);
      const C = dxCands(X, V);
      const G = dxGuess(X, V, C);
      const src = (c: { src: string; v: number }) => `${c.src} · ${V[c.v]?.type || ''}`;
      const picks: DwgState['picks'] = {};
      for (const [k, , t] of DWP) {
        const g = (G as any)[k];
        if (!g) {
          picks[k] = { v: '', src: 'not found', conf: 'missing' };
          continue;
        }
        const c = t === 'dm' ? C.dm[g.c] : C.lv[g.c];
        picks[k] = {
          v: t === 'dm' ? (c as any).v : (c as any).z,
          src: t === 'dm' ? `dim ${(c as any).txt} · ${V[(c as any).v_]?.type || ''}` : src(c as any),
          conf: g.conf,
          ci: g.c,
        };
      }
      const bays = G.bays.length
        ? G.bays.map((b, i) => {
            if (b.Hr) picks[`b${i}.Hr`] = { v: C.lv[b.Hr.c].z, src: src(C.lv[b.Hr.c]), conf: b.Hr.conf, ci: b.Hr.c };
            if (b.stTop) picks[`b${i}.stTop`] = { v: C.lv[b.stTop.c].z, src: src(C.lv[b.stTop.c]), conf: b.stTop.conf, ci: b.stTop.c };
            return { name: b.name, tt: b.tt, stT: 0.3, rc: 1, fh: b.fh.v, ft: 'm', sol: 0.6, bar: b.bar || 'none' };
          })
        : [{ name: 'Bay 1', tt: 'none', stT: 0.3, rc: 1, fh: 0, ft: 'm', sol: 0.6, bar: 'none' }];

      setDwg({
        sheets: [{ name: file.name, no: file.name.replace(/\.dxf$/i, ''), type: 'dxf', nts: 0 }],
        picks,
        bays,
        chk: [],
        cf: (C.bad || []).slice(),
        so: '',
        el: '',
      });
      setSummary(`${file.name}: ${X.T.length} texts · ${X.Dm.length} dims · ${V.length} view(s)`);
      setStatus('Review extracted levels & dimensions below, then build.');
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-2xl rounded-lg border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-hairline)' }}>
          <span className="font-semibold text-sm flex items-center gap-2">
            <FileCode2 className="w-4 h-4" style={{ color: 'var(--accent-cobalt)' }} />
            Import Drawing (ASCII DXF — Offline)
          </span>
          <button type="button" onClick={onClose} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          <div className="flex items-center gap-3">
            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--accent-cobalt)' }}
            >
              <Upload className="w-3.5 h-3.5" /> Open `.dxf` file
              <input type="file" accept=".dxf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
            <span style={{ color: 'var(--text-muted)' }}>{summary || status}</span>
          </div>

          {dwg && (
            <div className="space-y-3">
              <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border-muted)' }}>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-left" style={{ backgroundColor: 'var(--surface-subtle)', borderColor: 'var(--border-muted)' }}>
                      <th className="py-1.5 px-3">Parameter</th>
                      <th className="py-1.5 px-3">Extracted Value</th>
                      <th className="py-1.5 px-3">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DWP.map(([k, lab, , u]) => {
                      const p = dwg.picks[k] || { v: '', src: 'missing', conf: 'missing' };
                      return (
                        <tr key={k} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-muted)' }}>
                          <td className="py-1.5 px-3 font-medium">{lab}</td>
                          <td className="py-1.5 px-3">
                            <input
                              type="number"
                              step="any"
                              value={p.v}
                              onChange={(e) =>
                                setDwg((cur) =>
                                  cur
                                    ? { ...cur, picks: { ...cur.picks, [k]: { ...p, v: e.target.value === '' ? '' : +e.target.value, conf: 'high' } } }
                                    : cur,
                                )
                              }
                              className="w-24 px-1.5 py-0.5 rounded border font-mono-eng text-xs"
                              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                            />{' '}
                            <span style={{ color: 'var(--text-muted)' }}>{u}</span>
                          </td>
                          <td className="py-1.5 px-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.src}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                {dwg.bays.map((b, i) => (
                  <div key={i} className="rounded border p-2.5 flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--surface-canvas)' }}>
                    <div>
                      <b>{b.name}</b> · Retained GL:{' '}
                      <input
                        type="number"
                        step="any"
                        value={dwg.picks[`b${i}.Hr`]?.v ?? ''}
                        onChange={(e) =>
                          setDwg((cur) =>
                            cur
                              ? { ...cur, picks: { ...cur.picks, [`b${i}.Hr`]: { v: e.target.value === '' ? '' : +e.target.value, src: 'typed', conf: 'high' } } }
                              : cur,
                          )
                        }
                        className="w-20 px-1.5 py-0.5 rounded border font-mono-eng text-xs"
                        style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
                      />{' '}
                      mPD
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const res = buildModelFromDxfBay(state, dwg, i);
                        if (!res.ok) setStatus(res.error);
                        else {
                          onBuild(res.state, b.name);
                          onClose();
                        }
                      }}
                      className="px-3 py-1 rounded text-xs font-semibold text-white cursor-pointer"
                      style={{ backgroundColor: 'var(--status-pass)' }}
                    >
                      Build {b.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
