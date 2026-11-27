import { ChevronLeft, ChevronRight, Plus, Trash2, Wand2 } from 'lucide-react';
import {
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
                </div>
              )}
            </SectionCard>
          </>
        )}

        {activeStep === 3 && (
          <>
            <SectionCard title="Retained Soil">
              <NumRow label="Friction angle φ′" value={S.r.phi} unit="°" step={0.5} onChange={(v) => onCommit((d) => { d.r.phi = v; })} />
              <NumRow label="Unit weight γ" value={S.r.g} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.r.g = v; })} />
              <NumRow label="Backfill slope β" value={S.br} unit="°" step={1} hoverKey="br" onHover={onHoverField} onChange={(v) => setField('br', v)} />
            </SectionCard>

            <SectionCard title="Foundation Soil">
              <NumRow label="Friction angle φ′" value={S.f.phi} unit="°" step={0.5} onChange={(v) => onCommit((d) => { d.f.phi = v; })} />
              <NumRow label="Cohesion c′" value={S.f.c} unit="kPa" step={1} onChange={(v) => onCommit((d) => { d.f.c = v; })} />
              <NumRow label="Base friction φ′cv (δb)" value={S.f.cv} unit="°" step={0.5} onChange={(v) => onCommit((d) => { d.f.cv = v; })} />
              <NumRow label="Unit weight γ" value={S.f.g} unit="kN/m³" step={0.5} onChange={(v) => onCommit((d) => { d.f.g = v; })} />
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
            </SectionCard>

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
