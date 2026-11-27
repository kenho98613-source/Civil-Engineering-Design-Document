import { useEffect, useMemo, useRef, useState } from 'react';
import {
  dd,
  figureInputFromResult,
  renderFigureSvg,
} from '../engine';
import type {
  CalcAllResult,
  FigureFreeze,
  FigureHandle,
  FigureMode,
  WallState,
} from '../engine';

interface SectionCanvasProps {
  state: WallState;
  result: CalcAllResult;
  hoveredField: string | null;
  onEditParam: (param: string, value: number) => void;
  onPreviewParam?: (param: string, value: number) => void;
  onCommitDrag?: (label: string) => void;
  onForceScaleChange: (scale: number) => void;
}

interface ActiveDragState {
  h: FigureHandle;
  freeze: FigureFreeze;
  px: number;
  py: number;
  ppm: number;
  v: number;
  clientX: number;
  clientY: number;
}

export function SectionCanvas({
  state: S,
  result,
  onEditParam,
  onPreviewParam,
  onCommitDrag,
  onForceScaleChange,
}: SectionCanvasProps) {
  const [mode, setMode] = useState<FigureMode>(() => (S.fgm as FigureMode) || 'all');
  const [drag, setDrag] = useState<ActiveDragState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<ActiveDragState | null>(null);
  dragRef.current = drag;

  const rendered = useMemo(() => {
    if (result.err) return null;
    return renderFigureSvg(
      S,
      figureInputFromResult(S, result, {
        mode,
        freeze: drag?.freeze ?? null,
        noEdit: false,
      }),
    );
  }, [S, result, mode, drag?.freeze]);

  // Bind exact v14.0.1 pointer drag physics (FZ frozen transform + anc:'xb' anchor shifting + 0.05m / Alt 0.01m snap)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = d.h.ax === 'x' ? (e.clientX - d.px) / d.ppm : -(e.clientY - d.py) / d.ppm;
      const st = e.altKey ? 0.01 : 0.05;
      const raw = Math.round((d.h.v + d.h.k * delta) / st) * st;
      const v = +Math.max(d.h.min, Math.min(d.h.max, raw)).toFixed(3);
      setDrag((prev) => (prev ? { ...prev, v, clientX: e.clientX, clientY: e.clientY } : null));
      if (v !== d.v) {
        if (onPreviewParam) onPreviewParam(d.h.p, v);
        else onEditParam(d.h.p, v);
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      if (Math.abs(d.v - d.h.v) > 1e-6) {
        if (onCommitDrag) {
          const u = d.h.p === '@WL' || d.h.p === 'fw' || /\.(top|bot|zt)$/.test(d.h.p) ? ' mPD' : ' m';
          onCommitDrag(`Figure drag: ${d.h.lab} = ${dd(d.v)}${u}`);
        } else {
          onEditParam(d.h.p, d.v);
        }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onCommitDrag, onEditParam, onPreviewParam]);

  // Delegate pointerdown on [data-h] drag handles & change/Enter on inline .fi inputs
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !rendered) return;
    const target = e.target as Element | null;
    const gEl = target?.closest?.('[data-h]');
    if (!gEl) return;
    const idx = +(gEl.getAttribute('data-h') ?? -1);
    const h = rendered.handles[idx];
    const sv0 = gEl.ownerSVGElement;
    if (!h || !sv0) return;
    e.preventDefault();
    const r = sv0.getBoundingClientRect();
    const vb = sv0.viewBox.baseVal;
    const k = r.width / Math.max(1, vb.width);
    const FV = rendered.viewMeta;
    setDrag({
      h,
      freeze: { xl: FV.xl, y0: FV.y0, s: FV.s, xb0: FV.xb, anc: h.anc },
      px: e.clientX,
      py: e.clientY,
      ppm: k * FV.s,
      v: h.v,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLDivElement>) => {
    const t = e.target as unknown as HTMLInputElement;
    if (!t || !t.classList?.contains('fi')) return;
    const v = parseFloat(t.value);
    const p = t.dataset?.p;
    if (!p || !Number.isFinite(v)) return;
    onEditParam(p, v);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as unknown as HTMLInputElement;
    if (e.key === 'Enter' && t?.classList?.contains('fi')) {
      e.preventDefault();
      t.blur();
    }
  };

  const asc = +S.asc || 1;

  return (
    <div className="flex flex-col gap-2">
      {/* CAD Figure Mode Bar (All / Geometry / Loads + Arrow Scale) */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-md border"
        style={{ backgroundColor: 'var(--surface-panel)', borderColor: 'var(--border-hairline)' }}
      >
        <div className="inline-flex items-center gap-1">
          {(
            [
              ['all', 'Combined (Geometry + Loads)'],
              ['geo', 'Geometry & Handles'],
              ['load', 'Loads & Base Pressure'],
            ] as [FigureMode, string][]
          ).map(([m, label]) => {
            const on = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="px-2.5 py-0.5 rounded-full border text-[11px] cursor-pointer transition-colors"
                style={{
                  borderColor: on ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
                  backgroundColor: on ? 'var(--accent-cobalt-soft)' : 'transparent',
                  color: on ? 'var(--accent-cobalt)' : 'var(--text-muted)',
                  fontWeight: on ? 600 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {rendered && (
            <span className="font-mono-eng text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {rendered.handles.length} drag handles active
            </span>
          )}
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
      </div>

      {/* Exact v14.0.1 Engineering SVG Figure */}
      <div
        ref={wrapRef}
        className="relative rounded-md border overflow-hidden p-1"
        style={{
          backgroundColor: 'var(--cad-bg)',
          borderColor: drag ? 'var(--accent-cobalt)' : 'var(--border-hairline)',
        }}
        onPointerDown={handlePointerDown}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      >
        {rendered ? (
          <>
            <div dangerouslySetInnerHTML={{ __html: rendered.svgHtml }} />
            {rendered.notesHtml && (
              <div
                className="px-3 pb-2 text-[11px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
                dangerouslySetInnerHTML={{ __html: rendered.notesHtml }}
              />
            )}
          </>
        ) : (
          <div className="p-6 text-xs text-center" style={{ color: 'var(--status-fail)' }}>
            Fix input errors in the left panel to render the cross-section and load diagram.
          </div>
        )}
      </div>

      {/* Floating Fixed Drag Coordinate HUD */}
      {drag && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1 rounded shadow-lg font-mono-eng text-xs font-semibold text-white"
          style={{
            left: drag.clientX + 14,
            top: drag.clientY + 12,
            backgroundColor: 'var(--accent-cobalt)',
          }}
        >
          {drag.h.lab} = {dd(drag.v)}
          {drag.h.p === '@WL' || drag.h.p === 'fw' || /\.(top|bot|zt)$/.test(drag.h.p) ? ' mPD' : ' m'}
        </div>
      )}
    </div>
  );
}
