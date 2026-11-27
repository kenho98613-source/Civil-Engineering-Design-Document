import { ChevronLeft, ChevronRight, Plus, Trash2, Wand2 } from 'lucide-react';
import {
  ABD,
  ABS,
  BCAT,
  CVO,
  QCAT,
  cvAll,
  dd,
  f,
  geo,
  isG,
  isVeh,
  koDesc,
  koVal,
  qVal,
  stepOf,
  wlLev,
} from '../engine';
import type { CalcAllResult, WallState, WallType } from '../engine';

interface LeftStepPanelProps {
  state: WallState;
  result: CalcAllResult;
  activeStep: number;
  onStepChange: (step: number) => void;
  onCommit: (mutator: (draft: WallState) => void, opts?: { forceHistory?: boolean; message?: string }) => void;
  onChangeWallForm: (ty: WallType) => void;
  onAutoBars: () => void;
  onHoverField: (field: string | null) => void;
}

const STEPS = [
  { n: 1, short: 'Project', title: '1. Project & Method' },
  { n: 2, short: 'Geometry', title: '2. Wall Geometry' },
  { n: 3, short: 'Soil', title: '3. Soil & Earth Pressure' },
  { n: 4, short: 'Loads', title: '4. Groundwater & Loads' },
  { n: 5, short: 'RC', title: '5. Materials & RC' },
] as const;

const WALL_FORMS: { ty: WallType; label: string; svg: string }[] = [
  {
    ty: 'T',
    label: 'Inverted T',
    svg: '<rect x="24" y="4" width="20" height="18" fill="var(--cad-soil-fill)"/><rect x="4" y="22" width="38" height="5" fill="var(--cad-concrete-fill)" stroke="var(--cad-concrete-stroke)" stroke-width="1.2"/><rect x="18" y="4" width="4" height="18" fill="var(--cad-concrete-fill)" stroke="var(--cad-concrete-stroke)" stroke-width="1.2"/>',
  },
  {
    ty: 'L',
    label: 'L-wall',
    svg: '<rect x="10" y="4" width="32" height="18" fill="var(--cad-soil-fill)"/><rect x="6" y="22" width="36" height="5" fill="var(--cad-concrete-fill)" stroke="var(--cad-concrete-stroke)" stroke-width="1.2"/><rect x="6" y="4" width="4" height="18" fill="var(--cad-concrete-fill)" stroke="var(--cad-concrete-stroke)" stroke-width="1.2"/>',
  },
  {
    ty: 'Li',
    label: 'Reversed L',
    svg: '<rect x="38" y="4" width="6" height="18" fill="var(--cad-soil-fill)"/><rect x="4" y="22" width="38" height="5" fill="var(--cad-concrete-fill)" stroke="var(--cad-concrete-stroke)" stroke-width="1.2"/><rect x="34" y="4" width="4" height="18" fill="var(--cad-concrete-fill)" stroke="var(--cad-concrete-stroke)" stroke-width="1.2"/>',
  },
  {
    ty: 'G',
    label: 'Gravity',
    svg: '<rect x="30" y="4" width="14" height="18" fill="var(--cad-soil-fill)"/><polygon points="8,27 30,27 30,4 20,4" fill="var(--cad-concrete-fill)" stroke="var(--cad-concrete-stroke)" stroke-width="1.2"/>',
  },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-md border p-2.5 space-y-2"
      style={{
        backgroundColor: 'var(--surface-panel)',
        borderColor: 'var(--border-hairline)',
      }}
    >
      <div
        className="text-[10.5px] font-bold uppercase tracking-wider pb-1 border-b"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-muted)' }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function AdvancedBlock({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded border overflow-hidden"
      style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--surface-subtle)' }}
    >
      <summary className="px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer select-none flex items-center justify-between">
        <span style={{ color: 'var(--text-secondary)' }}>{title}</span>
        {badge && (
          <span
            className="font-mono-eng text-[9.5px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--accent-cobalt-soft)', color: 'var(--accent-cobalt)' }}
          >
            {badge}
          </span>
        )}
      </summary>
      <div
        className="p-2.5 space-y-2 border-t"
        style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-muted)' }}
      >
        {children}
      </div>
    </details>
  );
}

function NumRow({
  label,
  value,
  unit,
  step = 0.1,
  hoverKey,
  onHover,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  step?: number;
  hoverKey?: string;
  onHover?: (k: string | null) => void;
  onChange: (v: number) => void;
}) {
  return (
    <label
      className="flex items-center justify-between gap-2 text-xs"
      onMouseEnter={() => hoverKey && onHover?.(hoverKey)}
      onMouseLeave={() => hoverKey && onHover?.(null)}
    >
      <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span
        className="inline-flex items-center rounded border overflow-hidden shrink-0"
        style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
      >
        <input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          className="w-[74px] px-2 py-1 text-right font-mono-eng text-xs bg-transparent focus:outline-none"
        />
        {unit && (
          <span
            className="px-1.5 py-1 text-[10px] border-l select-none"
            style={{
              backgroundColor: 'var(--surface-subtle)',
              borderColor: 'var(--border-muted)',
              color: 'var(--text-muted)',
            }}
          >
            {unit}
          </span>
        )}
      </span>
    </label>
  );
}

export function LeftStepPanel({
  state: S,
  result,
  activeStep,
  onStepChange,
  onCommit,
  onChangeWallForm,
  onAutoBars,
  onHoverField,
}: LeftStepPanelProps) {
  const G = geo(S);
  const CV = cvAll(S, G);

  // Per-step error / warning counts
  const errCounts = [0, 0, 0, 0, 0, 0];
  const warnCounts = [0, 0, 0, 0, 0, 0];
  result.V.E.forEach((m) => { errCounts[stepOf(m)]++; });
  result.V.W.forEach((m) => { warnCounts[stepOf(m)]++; });

  const setField = <K extends keyof WallState>(k: K, v: WallState[K], forceHistory = false) =>
    onCommit((d) => {
      (d as any)[k] = v;
    }, { forceHistory });

  return (
    <aside
      className="flex flex-col w-[352px] shrink-0 border-r min-h-0"
      style={{
        backgroundColor: 'var(--surface-canvas)',
        borderColor: 'var(--border-hairline)',
      }}
    >
      {/* Sticky Step 1–5 Progress Stepper */}
      <div
        className="grid grid-cols-5 gap-1 px-2.5 py-2 border-b shrink-0"
        style={{
          backgroundColor: 'var(--surface-panel)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        {STEPS.map((st) => {
          const isCur = activeStep === st.n;
          const isDone = st.n < activeStep && errCounts[st.n] === 0;
          const ec = errCounts[st.n];
          const wc = warnCounts[st.n];
          return (
            <button
              key={st.n}
              type="button"
              onClick={() => onStepChange(st.n)}
              className="relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded border text-[10px] cursor-pointer transition-colors"
              style={{
                borderColor: isCur ? 'var(--accent-cobalt)' : 'var(--border-muted)',
                backgroundColor: isCur ? 'var(--accent-cobalt-soft)' : 'transparent',
                fontWeight: isCur ? 700 : 500,
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center font-mono-eng text-[11px] font-bold"
                style={{
                  backgroundColor:
                    ec > 0
                      ? 'var(--status-fail)'
                      : isCur
                        ? 'var(--accent-cobalt)'
                        : isDone
                          ? 'var(--status-pass)'
                          : 'var(--surface-subtle)',
                  color: ec > 0 || isCur || isDone ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {st.n}
              </span>
              <span className="truncate max-w-full">{st.short}</span>
              {ec > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: 'var(--status-fail)' }}
                >
                  {ec}
                </span>
              )}
              {ec === 0 && wc > 0 && (
                <span
                  className="absolute top-0.5 right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--status-warn)' }}
                  title={`${wc} warning(s)`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Step Body */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {activeStep === 1 && (
          <>
            <SectionCard title="Project Metadata">
              {(
                [
                  ['Title', 'jno'],
                  ['Job No.', 'pn'],
                  ['Designer', 'dsn'],
                  ['Checker', 'chk'],
                ] as const
              ).map(([lab, key]) => (
                <label key={key} className="flex items-center justify-between gap-2 text-xs">
                  <span style={{ color: 'var(--text-secondary)' }}>{lab}</span>
                  <input
                    type="text"
                    value={S[key] || ''}
                    onChange={(e) => setField(key, e.target.value)}
                    className="w-48 px-2 py-1 rounded border text-xs bg-transparent"
                    style={{
                      borderColor: 'var(--border-hairline)',
                      backgroundColor: 'var(--surface-canvas)',
                    }}
                  />
                </label>
              ))}
            </SectionCard>

            <SectionCard title="Checking Method (Hong Kong Practice)">
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['fc', 'Global FOS', 'CoP Fdn 2017'],
                    ['gg1', 'Partial Factors', 'Geoguide 1'],
                  ] as const
                ).map(([val, t, sub]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setField('acc', val, true)}
                    className="p-2 rounded border text-left cursor-pointer"
                    style={{
                      borderColor: S.acc === val ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
                      backgroundColor: S.acc === val ? 'var(--accent-cobalt-soft)' : 'var(--surface-canvas)',
                    }}
                  >
                    <div className="text-xs font-semibold">{t}</div>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                      {sub}
                    </div>
                  </button>
                ))}
              </div>

              {S.acc === 'fc' ? (
                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>GWL case</span>
                    <select
                      value={S.gwc}
                      onChange={(e) => setField('gwc', e.target.value as 'ant' | 'pos', true)}
                      className="px-2 py-1 rounded border text-xs"
                      style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                    >
                      <option value="ant">Cl 2.5.4(2) Highest anticipated</option>
                      <option value="pos">Cl 2.5.4(3) Highest possible</option>
                    </select>
                  </label>
                  <NumRow label="FOS Sliding" value={S.Fs} step={0.1} onChange={(v) => setField('Fs', v)} />
                  <NumRow label="FOS Overturning (other)" value={S.Fo} step={0.1} onChange={(v) => setField('Fo', v)} />
                  <NumRow label="FOS Overturning (wind)" value={S.Fow} step={0.1} onChange={(v) => setField('Fow', v)} />
                  <NumRow label="FOS Bearing" value={S.Fb} step={0.1} onChange={(v) => setField('Fb', v)} />
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <NumRow label="Material factor γm (GG1 T7)" value={S.gm} step={0.05} onChange={(v) => setField('gm', v)} />
                  <NumRow label="Surcharge factor γq (GG1 T6)" value={S.gq} step={0.1} onChange={(v) => setField('gq', v)} />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!S.xrc}
                  onChange={(e) => setField('xrc', e.target.checked ? 1 : 0, true)}
                />
                <span>Include structural RC / mesh design (Section 7)</span>
              </label>
            </SectionCard>

            <AdvancedBlock title="Ground Investigation (GI) Statement" badge={S.gis ? 'ON' : undefined}>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!S.gis}
                  onChange={(e) => setField('gis', e.target.checked ? 1 : 0, true)}
                />
                <span>Include GI report verification note</span>
              </label>
              {!!S.gis && (
                <label className="flex flex-col gap-1 text-xs">
                  <span style={{ color: 'var(--text-secondary)' }}>GI report reference</span>
                  <input
                    type="text"
                    value={S.gir || ''}
                    onChange={(e) => setField('gir', e.target.value)}
                    placeholder="e.g. GI Report No. GI/2025/01"
                    className="w-full px-2 py-1 rounded border text-xs"
                    style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                  />
                </label>
              )}
            </AdvancedBlock>

            <AdvancedBlock title="Project Factor γ_proj (Multiplier)" badge={S.gpon ? `×${f(S.gpv, 2)}` : undefined}>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!S.gpon}
                  onChange={(e) => setField('gpon', e.target.checked ? 1 : 0, true)}
                />
                <span>Apply extra project-specific factor γ_proj</span>
              </label>
              {!!S.gpon && (
                <div className="space-y-1.5 pt-1">
                  <NumRow label="Factor γ_proj" value={S.gpv} step={0.05} onChange={(v) => setField('gpv', v)} />
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={!!S.gpS} onChange={(e) => setField('gpS', e.target.checked ? 1 : 0, true)} />
                    <span>Apply to Sliding</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={!!S.gpO} onChange={(e) => setField('gpO', e.target.checked ? 1 : 0, true)} />
                    <span>Apply to Overturning</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={!!S.gpA} onChange={(e) => setField('gpA', e.target.checked ? 1 : 0, true)} />
                    <span>Apply to RC actions (Mu, Vu)</span>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>Source / contract clause</span>
                    <input
                      type="text"
                      value={S.gpsrc || ''}
                      onChange={(e) => setField('gpsrc', e.target.value)}
                      placeholder="e.g. Particular Spec Cl. 5.2"
                      className="w-full px-2 py-1 rounded border text-xs"
                      style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                    />
                  </label>
                </div>
              )}
            </AdvancedBlock>
          </>
        )}

        {activeStep === 2 && (
          <>
            <SectionCard title="Wall Form">
              <div className="grid grid-cols-4 gap-1.5">
                {WALL_FORMS.map((wf) => {
                  const on = S.ty === wf.ty;
                  return (
                    <button
                      key={wf.ty}
                      type="button"
                      onClick={() => onChangeWallForm(wf.ty)}
                      className="flex flex-col items-center gap-1 p-1.5 rounded border cursor-pointer"
                      style={{
                        borderColor: on ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
                        backgroundColor: on ? 'var(--accent-cobalt-soft)' : 'var(--surface-canvas)',
                      }}
                    >
                      <svg viewBox="0 0 48 30" className="w-11 h-7" dangerouslySetInnerHTML={{ __html: wf.svg }} />
                      <span className="text-[10.5px] font-medium leading-tight">{wf.label}</span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Key Levels (mPD)">
              <NumRow label="Founding level Zb" value={S.Zb} unit="mPD" hoverKey="Zb" onHover={onHoverField} onChange={(v) => setField('Zb', v)} />
              <NumRow label="Retained ground Hr" value={S.Hr} unit="mPD" hoverKey="Hr" onHover={onHoverField} onChange={(v) => setField('Hr', v)} />
              <NumRow label="Front ground Hf" value={S.Hf} unit="mPD" hoverKey="Hf" onHover={onHoverField} onChange={(v) => setField('Hf', v)} />
              <NumRow label="Front GWL fw" value={S.fw} unit="mPD" hoverKey="fw" onHover={onHoverField} onChange={(v) => setField('fw', v)} />
            </SectionCard>

            {isG(S) ? (
              <SectionCard title={`Mass Concrete Block (B = ${dd(G.B)} m)`}>
                <NumRow label="Block top width b_t" value={S.gBt} unit="m" step={0.05} hoverKey="gBt" onHover={onHoverField} onChange={(v) => setField('gBt', v)} />
                <NumRow label="Block height h_b" value={S.gBh} unit="m" step={0.05} hoverKey="tb" onHover={onHoverField} onChange={(v) => setField('gBh', v)} />
                <NumRow label="Front batter b_f" value={S.gbf} unit="m" step={0.05} hoverKey="gbf" onHover={onHoverField} onChange={(v) => setField('gbf', v)} />
                <NumRow label="Rear batter b_r" value={S.gbr} unit="m" step={0.05} hoverKey="gbr" onHover={onHoverField} onChange={(v) => setField('gbr', v)} />
              </SectionCard>
            ) : (
              <SectionCard title={`Base Slab (Total B = ${dd(G.B)} m)`}>
                {S.ty !== 'L' && (
                  <NumRow label="Toe length Lt" value={S.Lt} unit="m" step={0.05} hoverKey="Lt" onHover={onHoverField} onChange={(v) => setField('Lt', v)} />
                )}
                {S.ty !== 'Li' && (
                  <NumRow label="Heel length Lh" value={S.Lh} unit="m" step={0.05} hoverKey="Lh" onHover={onHoverField} onChange={(v) => setField('Lh', v)} />
                )}
                <NumRow label="Base thickness tb" value={S.tb} unit="m" step={0.05} hoverKey="tb" onHover={onHoverField} onChange={(v) => setField('tb', v)} />
              </SectionCard>
            )}

            <SectionCard title="Main Stem Segments (Top → Bottom)">
              <div className="space-y-2">
                {S.st.map((st, i) => (
                  <div
                    key={i}
                    className="rounded border p-2 space-y-1.5"
                    style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--surface-canvas)' }}
                    onMouseEnter={() => onHoverField(`st.${i}`)}
                    onMouseLeave={() => onHoverField(null)}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span>
                        Stem {i + 1}{' '}
                        <span className="font-mono-eng font-normal" style={{ color: 'var(--text-muted)' }}>
                          (+{dd(st.bot)} → +{dd(st.top)})
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        {isG(S) && (
                          <label className="inline-flex items-center gap-1 text-[10.5px] font-normal cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!st.rc}
                              onChange={(e) =>
                                onCommit((d) => {
                                  d.st[i].rc = e.target.checked ? 1 : 0;
                                }, { forceHistory: true })
                              }
                            />
                            RC
                          </label>
                        )}
                        {(isG(S) || S.st.length > 1) && (
                          <button
                            type="button"
                            onClick={() =>
                              onCommit((d) => {
                                if (i === 0 && d.st.length > 1) d.st[1].top = d.st[0].top;
                                d.st.splice(i, 1);
                              }, { forceHistory: true })
                            }
                            className="p-0.5 rounded hover:opacity-70 cursor-pointer"
                            style={{ color: 'var(--status-fail)' }}
                            title="Remove stem segment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <NumRow
                      label="Thickness t"
                      value={st.t}
                      unit="m"
                      step={0.05}
                      onChange={(v) => onCommit((d) => { d.st[i].t = v; })}
                    />
                    {i === 0 && (
                      <NumRow
                        label="Top level"
                        value={st.top}
                        unit="mPD"
                        step={0.1}
                        onChange={(v) => onCommit((d) => { d.st[i].top = v; })}
                      />
                    )}
                    {i < S.st.length - 1 && (
                      <NumRow
                        label="Bottom level"
                        value={st.bot}
                        unit="mPD"
                        step={0.1}
                        onChange={(v) => onCommit((d) => { d.st[i].bot = v; })}
                      />
                    )}
                    <details className="text-[11px] pt-0.5">
                      <summary className="cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
                        Batters &amp; offset (fb={dd(st.fb)}, rb={dd(st.rb)}, of={dd(st.of)})
                      </summary>
                      <div className="space-y-1.5 pt-1.5">
                        <NumRow label="Front batter fb" value={st.fb} unit="m" step={0.02} onChange={(v) => onCommit((d) => { d.st[i].fb = v; })} />
                        <NumRow label="Rear batter rb" value={st.rb} unit="m" step={0.02} onChange={(v) => onCommit((d) => { d.st[i].rb = v; })} />
                        <NumRow label="Rear offset of" value={st.of} unit="m" step={0.02} onChange={(v) => onCommit((d) => { d.st[i].of = v; })} />
                      </div>
                    </details>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onCommit((d) => {
                      const bt = +d.Zb + +d.tb;
                      if (!d.st.length) {
                        d.st.push({ t: 0.4, fb: 0, rb: 0, of: 0, top: Math.max(+d.Hr, bt + 0.5), bot: bt, rc: 1 });
                      } else {
                        const last = d.st[d.st.length - 1];
                        const hl = +last.top - bt;
                        if (hl >= 0.4) {
                          last.bot = +(last.top - hl / 2).toFixed(3);
                          d.st.push({ t: +(last.t + 0.15).toFixed(2), fb: 0, rb: 0, of: 0, top: last.bot, bot: bt, rc: 1 });
                        }
                      }
                    }, { forceHistory: true })
                  }
                  className="w-full py-1.5 rounded border border-dashed text-xs flex items-center justify-center gap-1 cursor-pointer"
                  style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add stem segment
                </button>
              </div>
            </SectionCard>

            {!isG(S) && (
              <AdvancedBlock
                title="Extra Stems on Base (Terraced / U-Channel)"
                badge={S.xs.length ? `${S.xs.length} (${S.xa})` : undefined}
                defaultOpen={S.xs.length > 0}
              >
                <label className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-secondary)' }}>Layout</span>
                  <select
                    value={S.xa}
                    onChange={(e) => setField('xa', e.target.value as 'ter' | 'U', true)}
                    className="px-2 py-1 rounded border text-xs"
                    style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                  >
                    <option value="ter">Terraced (soil between stems)</option>
                    <option value="U">U-Channel (open trough)</option>
                  </select>
                </label>
                {S.xs.map((xst, idx) => (
                  <div
                    key={idx}
                    className="rounded border p-2 space-y-1.5"
                    style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--surface-canvas)' }}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span>Extra Stem {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => onCommit((d) => { d.xs.splice(idx, 1); }, { forceHistory: true })}
                        className="p-0.5 cursor-pointer"
                        style={{ color: 'var(--status-fail)' }}
                        title="Remove extra stem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <NumRow label="Position x from toe" value={xst.x} unit="m" step={0.1} onChange={(v) => onCommit((d) => { d.xs[idx].x = v; })} />
                    <NumRow label="Thickness t" value={xst.t} unit="m" step={0.05} onChange={(v) => onCommit((d) => { d.xs[idx].t = v; })} />
                    <NumRow label="Height h above base" value={xst.h} unit="m" step={0.1} onChange={(v) => onCommit((d) => { d.xs[idx].h = v; })} />
                    {S.xa === 'ter' && (
                      <>
                        <NumRow label="Terrace soil zt" value={xst.zt} unit="mPD" step={0.1} onChange={(v) => onCommit((d) => { d.xs[idx].zt = v; })} />
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!xst.pp}
                            onChange={(e) => onCommit((d) => { d.xs[idx].pp = e.target.checked ? 1 : 0; }, { forceHistory: true })}
                          />
                          <span>Include terrace passive resistance</span>
                        </label>
                      </>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onCommit((d) => {
                      const g0 = geo(d);
                      const nx = +Math.max(g0.xb + 0.3, g0.B - 0.5).toFixed(2);
                      d.xs.push({ x: nx, t: 0.3, h: Math.max(0.8, +(d.Hr - g0.bt - 0.8).toFixed(2)), zt: +(g0.bt + 0.6).toFixed(2), rc: 1, pp: 0 });
                    }, { forceHistory: true })
                  }
                  className="w-full py-1.5 rounded border border-dashed text-xs flex items-center justify-center gap-1 cursor-pointer"
                  style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add extra stem
                </button>
              </AdvancedBlock>
            )}

            <SectionCard title="Shear Key (GG1 Fig. 42)">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!S.skon}
                  onChange={(e) => setField('skon', e.target.checked ? 1 : 0, true)}
                />
                <span>Include shear key below base</span>
              </label>
              {!!S.skon && (
                <div className="space-y-1.5 pt-1">
                  <NumRow label="Key depth dk" value={S.skd} unit="m" step={0.05} hoverKey="key" onHover={onHoverField} onChange={(v) => setField('skd', v)} />
                  <NumRow label="Key width Bk" value={S.skw} unit="m" step={0.05} hoverKey="key" onHover={onHoverField} onChange={(v) => setField('skw', v)} />
                  <NumRow label="Key x from toe" value={S.skx} unit="m" step={0.05} hoverKey="key" onHover={onHoverField} onChange={(v) => setField('skx', v)} />
                  <label className="flex items-center gap-2 text-xs cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={!!S.kpp}
                      onChange={(e) => setField('kpp', e.target.checked ? 1 : 0, true)}
                    />
                    <span>Include passive earth pressure in front of key</span>
                  </label>
                </div>
              )}
            </SectionCard>
          </>
        )}

        {activeStep === 3 && (
          <>
            <SectionCard title="Retained Soil">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.bon} onChange={(e) => setField('bon', e.target.checked ? 1 : 0, true)} />
                <span>Retained backfill present</span>
              </label>
              <NumRow label="Friction angle φ′" value={S.r.phi} unit="°" step={0.5} onChange={(v) => onCommit((d) => { d.r.phi = v; })} />
              <NumRow label="Unit weight γ" value={S.r.g} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.r.g = v; })} />
              <NumRow label="Saturated weight γ_sat" value={S.r.gs} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.r.gs = v; })} />
              <NumRow label="Backfill slope β" value={S.br} unit="°" step={1} hoverKey="br" onHover={onHoverField} onChange={(v) => setField('br', v)} />
              <NumRow label="Slope extent L_β (0=∞)" value={S.brL} unit="m" step={0.5} onChange={(v) => setField('brL', v)} />
            </SectionCard>

            <SectionCard title="Foundation Soil">
              <NumRow label="Friction angle φ′" value={S.f.phi} unit="°" step={0.5} onChange={(v) => onCommit((d) => { d.f.phi = v; })} />
              <NumRow label="Cohesion c′" value={S.f.c} unit="kPa" step={1} onChange={(v) => onCommit((d) => { d.f.c = v; })} />
              <NumRow label="Base friction φ′cv (δb)" value={S.f.cv} unit="°" step={0.5} onChange={(v) => onCommit((d) => { d.f.cv = v; })} />
              <NumRow label="Unit weight γ" value={S.f.g} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.f.g = v; })} />
              <NumRow label="Saturated weight γ_sat" value={S.f.gs} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.f.gs = v; })} />
            </SectionCard>

            <SectionCard title="Earth Pressure & Front Soil">
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Active Ka theory</span>
                <select
                  value={S.kam}
                  onChange={(e) => setField('kam', e.target.value as WallState['kam'], true)}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="r">Rankine (GG1 §6.5.1)</option>
                  <option value="c">Coulomb (GG1 Fig. 17)</option>
                  <option value="m">Manual Ka</option>
                </select>
              </label>
              {S.kam === 'm' && (
                <>
                  <NumRow label="Manual Ka (char.)" value={S.kaM} step={0.01} onChange={(v) => setField('kaM', v)} />
                  <NumRow label="Manual Ka (factored)" value={S.kaMf} step={0.01} onChange={(v) => setField('kaMf', v)} />
                </>
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.fon} onChange={(e) => setField('fon', e.target.checked ? 1 : 0, true)} />
                <span>Front soil present (in front of toe)</span>
              </label>
              <NumRow label="Neglected depth d_p" value={S.dp} unit="m" step={0.1} onChange={(v) => setField('dp', v)} />
              <NumRow label="Front ground slope β_f" value={S.bf} unit="°" step={1} hoverKey="crest" onHover={onHoverField} onChange={(v) => setField('bf', v)} />
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!S.nopp}
                  onChange={(e) => setField('nopp', e.target.checked ? 0 : 1, true)}
                />
                <span>Include passive resistance (Pp)</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!S.tsw}
                  onChange={(e) => setField('tsw', e.target.checked ? 1 : 0, true)}
                />
                <span>Include toe soil self-weight</span>
              </label>
              {S.bf < 0 && (
                <div
                  className="mt-1 p-2 rounded border space-y-1.5"
                  style={{ borderColor: 'var(--accent-cobalt)', backgroundColor: 'var(--accent-cobalt-soft)' }}
                >
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!S.scon}
                      onChange={(e) => setField('scon', e.target.checked ? 1 : 0, true)}
                    />
                    <span>Near slope crest (CR-4: GG1 Fig. A4 / FC Fig. 2.3)</span>
                  </label>
                  {!!S.scon && (
                    <NumRow
                      label="Toe to crest distance b"
                      value={S.scb}
                      unit="m"
                      step={0.1}
                      hoverKey="crest"
                      onHover={onHoverField}
                      onChange={(v) => setField('scb', v)}
                    />
                  )}
                </div>
              )}
            </SectionCard>

            <AdvancedBlock
              title="Advanced Soil Layers (Backfill / Front)"
              badge={S.bkfm || S.fsm ? 'CUSTOM' : undefined}
            >
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.bkfm} onChange={(e) => setField('bkfm', e.target.checked ? 1 : 0, true)} />
                <span>Separate heel backfill weight (γ_bkf)</span>
              </label>
              {!!S.bkfm && (
                <div className="space-y-1.5 pl-4">
                  <NumRow label="Backfill γ" value={S.bkf.g} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.bkf.g = v; })} />
                  <NumRow label="Backfill γ_sat" value={S.bkf.gs} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.bkf.gs = v; })} />
                </div>
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                <input type="checkbox" checked={!!S.fsm} onChange={(e) => setField('fsm', e.target.checked ? 1 : 0, true)} />
                <span>Separate front soil layer</span>
              </label>
              {!!S.fsm && (
                <div className="space-y-1.5 pl-4">
                  <NumRow label="Front soil φ′" value={S.fs.phi} unit="°" step={0.5} onChange={(v) => onCommit((d) => { d.fs.phi = v; })} />
                  <NumRow label="Front soil c′" value={S.fs.c} unit="kPa" step={1} onChange={(v) => onCommit((d) => { d.fs.c = v; })} />
                  <NumRow label="Front soil γ" value={S.fs.g} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.fs.g = v; })} />
                  <NumRow label="Front soil γ_sat" value={S.fs.gs} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.fs.gs = v; })} />
                </div>
              )}
            </AdvancedBlock>

            <AdvancedBlock title="Wall/Base Friction, Kp & Embedment">
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Wall friction δ (GG1 T14)</span>
                <select
                  value={S.dwm}
                  onChange={(e) => setField('dwm', e.target.value as WallState['dwm'], true)}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="auto">Auto (GG1 Table 14)</option>
                  <option value="h">φ′/2 (horizontal)</option>
                  <option value="t">2φ′/3 (cast in-situ)</option>
                  <option value="c">Custom δ</option>
                </select>
              </label>
              {S.dwm === 'c' && (
                <NumRow label="Custom wall δ" value={S.dcw} unit="°" step={0.5} onChange={(v) => setField('dcw', v)} />
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.comp} onChange={(e) => setField('comp', e.target.checked ? 1 : 0, true)} />
                <span>Compressible foundation (δ = 0)</span>
              </label>
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Base friction δ_b</span>
                <select
                  value={S.dbm}
                  onChange={(e) => setField('dbm', e.target.value as WallState['dbm'], true)}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="cv">φ′_cv (cast in-situ)</option>
                  <option value="c">Custom δ_b</option>
                </select>
              </label>
              {S.dbm === 'c' && (
                <NumRow label="Custom base δ_b" value={S.dcb} unit="°" step={0.5} onChange={(v) => setField('dcb', v)} />
              )}
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Passive Kp mode</span>
                <select
                  value={S.kpm}
                  onChange={(e) => setField('kpm', e.target.value as WallState['kpm'], true)}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="a">Auto (GG1 Fig. 18)</option>
                  <option value="m">Manual Kp</option>
                </select>
              </label>
              {S.kpm === 'm' && (
                <>
                  <NumRow label="Manual Kp (char.)" value={S.kpM} step={0.1} onChange={(v) => setField('kpM', v)} />
                  <NumRow label="Manual Kp (factored)" value={S.kpMf} step={0.1} onChange={(v) => setField('kpMf', v)} />
                </>
              )}
              {!S.nopp && (
                <div className="space-y-1 pt-1 text-xs">
                  <div className="text-[10.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>Passive Pp inclusion per check</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!S.ppS} onChange={(e) => setField('ppS', e.target.checked ? 1 : 0, true)} />
                    <span>Include Pp in Sliding</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!S.ppO} onChange={(e) => setField('ppO', e.target.checked ? 1 : 0, true)} />
                    <span>Include Pp in Overturning</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!S.ppB} onChange={(e) => setField('ppB', e.target.checked ? 1 : 0, true)} />
                    <span>Include Pp in Bearing</span>
                  </label>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.obdp} onChange={(e) => setField('obdp', e.target.checked ? 1 : 0, true)} />
                <span>Deduct d_p from bearing overburden Df</span>
              </label>
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Bearing Df datum</span>
                <select
                  value={S.dfm}
                  onChange={(e) => setField('dfm', e.target.value as 'front' | 'ogl', true)}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="front">Front GL (Hf − Zb)</option>
                  <option value="ogl">Original GL (OGL − Zb)</option>
                </select>
              </label>
              {S.dfm === 'ogl' && (
                <NumRow label="Original GL (OGL)" value={S.ogl} unit="mPD" step={0.1} onChange={(v) => setField('ogl', v)} />
              )}
            </AdvancedBlock>
          </>
        )}

        {activeStep === 4 && (
          <>
            <SectionCard title={`Retained Groundwater (+${dd(wlLev(S))} mPD)`}>
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Design GWL</span>
                <select
                  value={S.wl}
                  onChange={(e) => {
                    const v = e.target.value;
                    onCommit((d) => {
                      d.wl = v;
                      if (v === 'c') d.wlZ = +wlLev(d).toFixed(2);
                    }, { forceHistory: true });
                  }}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="0">None (weepholes)</option>
                  <option value="0.3333333">1/3 H</option>
                  <option value="0.5">1/2 H</option>
                  <option value="1">Full H</option>
                  <option value="c">Custom level</option>
                </select>
              </label>
              {S.wl === 'c' && (
                <NumRow label="Custom GWL" value={S.wlZ} unit="mPD" step={0.1} hoverKey="wl" onHover={onHoverField} onChange={(v) => setField('wlZ', v)} />
              )}
            </SectionCard>

            <SectionCard title={`Surcharge (q_out = ${f(qVal(S), 1)} kPa)`}>
              <label className="flex items-center justify-between text-xs gap-2">
                <span style={{ color: 'var(--text-secondary)' }}>Category</span>
                <select
                  value={S.qcat}
                  onChange={(e) => setField('qcat', e.target.value, true)}
                  className="max-w-[200px] px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  {Object.entries(QCAT).map(([k, [lab]]) => (
                    <option key={k} value={k}>
                      {lab}
                    </option>
                  ))}
                </select>
              </label>
              {S.qcat === 'c' && (
                <NumRow label="Custom q_out" value={S.q} unit="kPa" step={1} onChange={(v) => setField('q', v)} />
              )}
              <NumRow label="Heel surcharge q_in" value={S.qin} unit="kPa" step={1} onChange={(v) => setField('qin', v)} />
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.qst} onChange={(e) => setField('qst', e.target.checked ? 1 : 0, true)} />
                <span>Apply q_out to stability checks</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.qinRC} onChange={(e) => setField('qinRC', e.target.checked ? 1 : 0, true)} />
                <span>Include q_in in heel RC slab design</span>
              </label>
            </SectionCard>

            <AdvancedBlock
              title="Line Load Behind Wall (GG1 Fig. 25)"
              badge={S.lon ? `${f(S.lQv, 0)}/${f(S.lQh, 0)} kN/m` : undefined}
              defaultOpen={!!S.lon}
            >
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.lon} onChange={(e) => setField('lon', e.target.checked ? 1 : 0, true)} />
                <span>Include surface line load (Qv, Qh)</span>
              </label>
              {!!S.lon && (
                <div className="space-y-1.5 pt-1">
                  <NumRow label="Vertical Qv" value={S.lQv} unit="kN/m" step={5} onChange={(v) => setField('lQv', v)} />
                  <NumRow label="Horizontal Qh" value={S.lQh} unit="kN/m" step={5} onChange={(v) => setField('lQh', v)} />
                  <NumRow label="Distance x behind back" value={S.lx} unit="m" step={0.1} onChange={(v) => setField('lx', v)} />
                </div>
              )}
            </AdvancedBlock>

            <SectionCard title="Fence Wind & Self-Weight">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.wo} onChange={(e) => setField('wo', e.target.checked ? 1 : 0, true)} />
                <span>Fence wind load (Wind Code 2019)</span>
              </label>
              {!!S.wo && (
                <div className="space-y-1.5 pl-4">
                  <NumRow label="Fence height h" value={S.wh} unit="m" step={0.1} onChange={(v) => setField('wh', v)} />
                  <NumRow label="Solidity ratio φ" value={S.wsd} step={0.05} onChange={(v) => setField('wsd', v)} />
                  <NumRow label="Fence length l" value={S.wlen} unit="m" step={1} onChange={(v) => setField('wlen', v)} />
                  <label className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>Wind zone (Table 2)</span>
                    <select
                      value={S.wz}
                      onChange={(e) => setField('wz', e.target.value as WallState['wz'], true)}
                      className="px-2 py-1 rounded border text-xs font-mono-eng"
                      style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                    >
                      <option value="A">Zone A (≤ 5 m)</option>
                      <option value="B">Zone B (5–10 m)</option>
                      <option value="C">Zone C (10–20 m)</option>
                      <option value="D">Zone D (&gt; 20 m)</option>
                    </select>
                  </label>
                  <NumRow label="Topography factor S_t" value={S.wSt} step={0.05} onChange={(v) => setField('wSt', v)} />
                </div>
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                <input type="checkbox" checked={!!S.fdl} onChange={(e) => setField('fdl', e.target.checked ? 1 : 0, true)} />
                <span>Fence self-weight (v13.8.13)</span>
              </label>
              {!!S.fdl && (
                <div className="space-y-1.5 pl-4">
                  <NumRow label="Load per post P" value={S.fdP} unit="kN" step={0.5} onChange={(v) => setField('fdP', v)} />
                  <NumRow label="Post spacing s" value={+S.fdS || 0} unit="m" step={0.5} onChange={(v) => setField('fdS', v)} />
                  <NumRow
                    label="Post x-offset from centre"
                    value={+S.fxo || 0}
                    unit="m"
                    step={0.05}
                    onChange={(v) => setField('fxo', v)}
                  />
                </div>
              )}
            </SectionCard>

            <SectionCard title="Barrier / Vehicle Impact (DIL 2011)">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.bro} onChange={(e) => setField('bro', e.target.checked ? 1 : 0, true)} />
                <span>Barrier line load / vehicle impact</span>
              </label>
              {!!S.bro && (
                <div className="space-y-1.5 pt-1">
                  <select
                    value={S.brc}
                    onChange={(e) => setField('brc', e.target.value, true)}
                    className="w-full px-2 py-1 rounded border text-xs"
                    style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                  >
                    {Object.entries(BCAT).map(([k, lab]) => (
                      <option key={k} value={k}>
                        {lab}
                      </option>
                    ))}
                  </select>
                  {S.brc === 'c' && (
                    <NumRow label="Custom barrier F" value={S.brF} unit="kN/m" step={0.5} onChange={(v) => setField('brF', v)} />
                  )}
                  {!isVeh(S) && (
                    <NumRow label="Barrier height" value={S.bhb} unit="m" step={0.1} onChange={(v) => setField('bhb', v)} />
                  )}
                  {isVeh(S) && (
                    <>
                      <NumRow label="Dispersion length Ld" value={S.vL} unit="m" step={0.5} onChange={(v) => setField('vL', v)} />
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={!!S.vSO} onChange={(e) => setField('vSO', e.target.checked ? 1 : 0, true)} />
                        <span>Exclude impact from global stability (RC only)</span>
                      </label>
                      {!!S.vSO && (
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={!!S.accI} onChange={(e) => setField('accI', e.target.checked ? 1 : 0, true)} />
                          <span>Run accidental stability check (FOS ≥ 1.0)</span>
                        </label>
                      )}
                      <details className="text-[11px] pt-1">
                        <summary className="cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
                          Advanced vehicle impact parameters (DIL 6A–6E)
                        </summary>
                        <div className="space-y-1.5 pt-2">
                          <NumRow label="Vehicle mass M" value={S.vM} unit="kg" step={500} onChange={(v) => setField('vM', v)} />
                          <NumRow label="Barrier deflection δb" value={S.vb} unit="mm" step={5} onChange={(v) => setField('vb', v)} />
                          <NumRow label="Ramp length Lr" value={S.vR} unit="m" step={1} onChange={(v) => setField('vR', v)} />
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={!!S.vObl} onChange={(e) => setField('vObl', e.target.checked ? 1 : 0, true)} />
                            <span>Oblique impact (×0.5)</span>
                          </label>
                          <label className="flex items-center justify-between text-xs">
                            <span style={{ color: 'var(--text-secondary)' }}>Impact floor level</span>
                            <select
                              value={S.vFl}
                              onChange={(e) => setField('vFl', e.target.value as WallState['vFl'], true)}
                              className="px-2 py-1 rounded border text-xs"
                              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                            >
                              <option value="r">Retained GL (Hr)</option>
                              <option value="t">Wall top</option>
                              <option value="c">Custom level</option>
                            </select>
                          </label>
                          {S.vFl === 'c' && (
                            <NumRow label="Custom floor z" value={S.vFz} unit="mPD" step={0.1} onChange={(v) => setField('vFz', v)} />
                          )}
                          <NumRow label="Impact stem index (0=main)" value={S.vStem} step={1} onChange={(v) => setField('vStem', Math.max(0, Math.round(v)))} />
                        </div>
                      </details>
                    </>
                  )}
                </div>
              )}
            </SectionCard>
          </>
        )}

        {activeStep === 5 && (
          <>
            <SectionCard title="Concrete & Reinforcement Materials">
              <NumRow label="Concrete unit weight γc" value={S.gc} unit="kN/m³" step={0.5} onChange={(v) => setField('gc', v)} />
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Concrete grade fcu</span>
                <select
                  value={S.fcu}
                  onChange={(e) => setField('fcu', +e.target.value, true)}
                  className="px-2 py-1 rounded border text-xs font-mono-eng"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  {[25, 30, 35, 40, 45, 50, 55, 60].map((v) => (
                    <option key={v} value={v}>
                      C{v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Steel yield fy</span>
                <select
                  value={S.fy}
                  onChange={(e) => {
                    const fy = +e.target.value;
                    onCommit((d) => {
                      d.fy = fy;
                      d.rmin = d.grmin = fy === 250 ? 0.24 : 0.13;
                      d.grho = fy === 250 ? 0.3 : 0.25;
                    }, { forceHistory: true });
                  }}
                  className="px-2 py-1 rounded border text-xs font-mono-eng"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value={500}>500 MPa (Grade 500B)</option>
                  <option value={250}>250 MPa (Grade 250)</option>
                </select>
              </label>
            </SectionCard>

            <SectionCard title="Nominal Cover (CoP Table 4.2)">
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Stem cover (both faces)</span>
                <select
                  value={String(S.cvS)}
                  onChange={(e) => setField('cvS', e.target.value === 'a' ? 'a' : +e.target.value, true)}
                  className="px-2 py-1 rounded border text-xs font-mono-eng"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="a">Auto ({CV.auto} mm)</option>
                  {CVO.map((c) => (
                    <option key={c} value={c}>
                      {c} mm
                    </option>
                  ))}
                </select>
              </label>
              {!isG(S) && (
                <NumRow label="Base top cover" value={S.cvt} unit="mm" step={5} onChange={(v) => setField('cvt', v)} />
              )}
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Base underside cast</span>
                <select
                  value={S.cbs}
                  onChange={(e) => setField('cbs', e.target.value as 'blind' | 'earth', true)}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="blind">On blinding (≥ 40 mm)</option>
                  <option value="earth">Against earth (≥ 75 mm)</option>
                </select>
              </label>
            </SectionCard>

            <SectionCard title="RC Pressure & Auto-Sizing">
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>RC earth pressure</span>
                <select
                  value={S.rck}
                  onChange={(e) => setField('rck', e.target.value as WallState['rck'], true)}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="ko">At-rest Ko ({f(koVal(S), 3)})</option>
                  <option value="ka">Active Ka</option>
                  <option value="env">Envelope (max of Ka, Ko)</option>
                </select>
              </label>
              <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                Ko = {f(koVal(S), 3)} ({koDesc(S)})
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.cmp} onChange={(e) => setField('cmp', e.target.checked ? 1 : 0, true)} />
                <span>Compaction pressure (GG1 Fig. 27)</span>
              </label>
              {!!S.cmp && (
                <NumRow label="Compaction Q1" value={S.cQ} unit="kN/m" step={1} onChange={(v) => setField('cQ', v)} />
              )}
              <NumRow label="Auto-bar target util." value={S.utgt} unit="%" step={5} onChange={(v) => setField('utgt', v)} />
              <button
                type="button"
                onClick={onAutoBars}
                className="w-full py-1.5 rounded text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: 'var(--accent-teal)' }}
              >
                <Wand2 className="w-3.5 h-3.5" /> Auto-Select Lightest Passing Bars
              </button>
            </SectionCard>

            <AdvancedBlock title="Advanced Ko, Minimum Steel & Stem Basis">
              <NumRow label="Overconsolidation OCR" value={S.ocr} step={0.5} onChange={(v) => setField('ocr', v)} />
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.kom} onChange={(e) => setField('kom', e.target.checked ? 1 : 0, true)} />
                <span>Manual Ko override</span>
              </label>
              {!!S.kom && (
                <NumRow label="Manual Ko" value={S.koM} step={0.02} onChange={(v) => setField('koM', v)} />
              )}
              <NumRow label="Min steel ratio ρ_min" value={S.rmin} unit="%" step={0.01} onChange={(v) => setField('rmin', v)} />
              <label className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>Stem min steel basis</span>
                <select
                  value={S.smb}
                  onChange={(e) => setField('smb', e.target.value as 'wall' | 'slab', true)}
                  className="px-2 py-1 rounded border text-xs"
                  style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                >
                  <option value="wall">Wall (CoP Cl 9.6.2 / 9.6.3)</option>
                  <option value="slab">Slab (CoP Table 9.1)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={!!S.hnr} onChange={(e) => setField('hnr', e.target.checked ? 1 : 0, true)} />
                <span>Include heel negative moment / uplift check</span>
              </label>
            </AdvancedBlock>

            {isG(S) && (
              <AdvancedBlock
                title="Gravity Anti-Crack / Min Mesh (CoP 9.6.5 / 9.13)"
                badge={S.gmr !== 'none' ? S.gmb.toUpperCase() : 'OFF'}
                defaultOpen={S.gmr !== 'none'}
              >
                <label className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-secondary)' }}>Surface mesh mode</span>
                  <select
                    value={S.gmr}
                    onChange={(e) => setField('gmr', e.target.value, true)}
                    className="px-2 py-1 rounded border text-xs"
                    style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                  >
                    <option value="none">Plain mass concrete (no mesh)</option>
                    <option value="cc">Crack-control / minimum mesh</option>
                  </select>
                </label>
                {S.gmr !== 'none' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-secondary)' }}>Code basis</span>
                      <select
                        value={S.gmb}
                        onChange={(e) => setField('gmb', e.target.value as WallState['gmb'], true)}
                        className="px-2 py-1 rounded border text-xs"
                        style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                      >
                        <option value="965">CoP 9.6.5 (Surface steel)</option>
                        <option value="913t">CoP 9.13 (Thermal ρ_crit)</option>
                        <option value="913f">CoP 9.13 (Full section)</option>
                      </select>
                    </label>
                    <NumRow label="Crack-control ratio ρ" value={S.grho} unit="%" step={0.05} onChange={(v) => setField('grho', v)} />
                    <NumRow label="Min steel ratio ρ_min" value={S.grmin} unit="%" step={0.01} onChange={(v) => setField('grmin', v)} />
                    <label className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-secondary)' }}>Effective zone h_eff</span>
                      <select
                        value={S.heffm}
                        onChange={(e) => setField('heffm', e.target.value, true)}
                        className="px-2 py-1 rounded border text-xs"
                        style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                      >
                        <option value="a">Auto (min(h/2, 250 mm))</option>
                        <option value="c">Custom h_eff</option>
                      </select>
                    </label>
                    {S.heffm === 'c' && (
                      <NumRow label="Custom h_eff" value={S.heff} unit="mm" step={25} onChange={(v) => setField('heff', v)} />
                    )}
                    <div className="pt-1 space-y-1.5">
                      <div className="text-[10.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>Mesh Bar Sizes</div>
                      {(
                        [
                          ['Vertical faces', 'mvd', 'mvs'],
                          ['Horizontal faces', 'mhd', 'mhs'],
                          ['Top face', 'mtd', 'mts'],
                          ['Bottom face', 'mbd', 'mbs'],
                        ] as const
                      ).map(([lab, dk, sk]) => (
                        <div key={dk} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--text-secondary)' }}>{lab}</span>
                          <span className="flex items-center gap-1 font-mono-eng">
                            <select
                              value={S[dk]}
                              onChange={(e) => setField(dk, +e.target.value, true)}
                              className="px-1 py-0.5 rounded border text-xs"
                              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                            >
                              {ABD.map((dm) => <option key={dm} value={dm}>T{dm}</option>)}
                            </select>
                            <span>@</span>
                            <select
                              value={S[sk]}
                              onChange={(e) => setField(sk, +e.target.value, true)}
                              className="px-1 py-0.5 rounded border text-xs"
                              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-canvas)' }}
                            >
                              {ABS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                            </select>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </AdvancedBlock>
            )}
          </>
        )}
      </div>

      {/* Bottom Sticky Stepper Footer */}
      <div
        className="flex items-center justify-between px-3 py-2 border-t shrink-0"
        style={{
          backgroundColor: 'var(--surface-panel)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <button
          type="button"
          disabled={activeStep <= 1}
          onClick={() => onStepChange(Math.max(1, activeStep - 1))}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer disabled:opacity-35"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </button>
        <span className="font-mono-eng text-[11px]" style={{ color: 'var(--text-muted)' }}>
          B {dd(G.B)}m · H {dd(Math.max(0, S.Hr - S.Zb))}m
        </span>
        <button
          type="button"
          disabled={activeStep >= 5}
          onClick={() => onStepChange(Math.min(5, activeStep + 1))}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-white cursor-pointer disabled:opacity-35"
          style={{ backgroundColor: 'var(--accent-cobalt)' }}
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
