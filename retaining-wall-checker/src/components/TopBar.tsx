import { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Compass,
  FileCode2,
  FileDown,
  FlaskConical,
  FolderOpen,
  Layers,
  Moon,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  SunMoon,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import { MODEL_VERSION } from '../engine';
import type { ReportMode, ThemeMode, WallTabStatus } from '../hooks/useProjectStore';

interface TopBarProps {
  projectTitle: string;
  jobNo: string;
  checkingMethod: 'fc' | 'gg1';
  wallTabs: WallTabStatus[];
  activeWallIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  theme: ThemeMode;
  reportMode: ReportMode;
  toast: string;
  onSelectWall: (index: number) => void;
  onAddWall: (mode: 'dup' | 'blank') => void;
  onRenameWall: (index: number, name: string) => void;
  onDeleteWall: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onThemeChange: (t: ThemeMode) => void;
  onReportModeChange: (m: ReportMode) => void;
  onOpenFile: (text: string, name: string) => void;
  onSaveFile: () => void;
  onOpenDxfImport: () => void;
  onExportDxf: (scale: number) => void;
  onOpenWizard: () => void;
  onOpenAutoDesign: () => void;
  onLoadDefault: () => void;
  onOpenBenchmarks: () => void;
  onReset: () => void;
  onAutoBars: () => void;
  onExportPdf: () => void;
}

export function TopBar(props: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<'file' | 'more' | 'add' | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [armedDeleteIdx, setArmedDeleteIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cycleTheme = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(props.theme) + 1) % order.length];
    props.onThemeChange(next);
  };

  const commitRename = () => {
    if (editingIdx != null && editVal.trim()) {
      props.onRenameWall(editingIdx, editVal.trim());
    }
    setEditingIdx(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((txt) => props.onOpenFile(txt, file.name));
    e.target.value = '';
    setOpenMenu(null);
  };

  return (
    <header
      className="select-none shrink-0 border-b"
      style={{
        backgroundColor: 'var(--surface-panel)',
        borderColor: 'var(--border-hairline)',
      }}
      onMouseLeave={() => setOpenMenu(null)}
    >
      {/* Row 1: Primary Command Bar */}
      <div className="flex items-center gap-2 px-3 h-11">
        {/* Brand & Active Project */}
        <div className="flex items-center gap-2.5 min-w-0 mr-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center shrink-0 font-mono-eng text-xs font-bold text-white"
            style={{ backgroundColor: 'var(--accent-cobalt)' }}
            title="Retaining Wall Design & Checker"
          >
            RW
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[13px] truncate">
                {props.projectTitle || 'Retaining Wall Checker'}
              </span>
              <span
                className="font-mono-eng text-[10px] px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--text-muted)',
                }}
              >
                {MODEL_VERSION}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span>{props.jobNo ? `Job ${props.jobNo}` : 'Hong Kong GEO / BD'}</span>
              <span>·</span>
              <span className="font-medium" style={{ color: 'var(--accent-cobalt)' }}>
                {props.checkingMethod === 'gg1' ? 'GG1 Partial Factors' : 'FC 2017 Global FOS'}
              </span>
              {props.toast && (
                <>
                  <span>·</span>
                  <span className="truncate max-w-[220px]" style={{ color: 'var(--status-pass)' }}>
                    {props.toast}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Command Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={props.onOpenWizard}
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded border text-xs font-medium cursor-pointer transition-colors"
            style={{
              borderColor: 'var(--border-hairline)',
              backgroundColor: 'var(--surface-panel)',
              color: 'var(--text-primary)',
            }}
            title="7-step guided Setup Wizard"
          >
            <Compass className="w-3.5 h-3.5" style={{ color: 'var(--accent-cobalt)' }} />
            <span className="hidden lg:inline">Setup Wizard</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenAutoDesign}
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded text-xs font-medium text-white cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--accent-teal)' }}
            title="Two-pass Auto Design: repair geometry, optimise width, and select lightest passing bars"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto Design</span>
          </button>

          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border-hairline)' }} />

          <button
            type="button"
            onClick={props.onUndo}
            disabled={!props.canUndo}
            className="p-1.5 h-7 rounded border cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={props.onRedo}
            disabled={!props.canRedo}
            className="p-1.5 h-7 rounded border cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border-hairline)' }} />

          {/* File Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-xs cursor-pointer"
              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>File</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {openMenu === 'file' && (
              <div
                className="absolute right-0 mt-1 w-56 rounded-md border shadow-lg py-1 z-50"
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 opacity-70" /> Open `.rwall` project…
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onSaveFile();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 opacity-70" /> Save `.rwall` project
                </button>
                <div className="my-1 border-t" style={{ borderColor: 'var(--border-muted)' }} />
                <button
                  type="button"
                  onClick={() => {
                    props.onOpenDxfImport();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                >
                  <FileCode2 className="w-3.5 h-3.5 opacity-70" /> Import CAD DXF (Offline)…
                </button>
                <div className="my-1 border-t" style={{ borderColor: 'var(--border-muted)' }} />
                <button
                  type="button"
                  onClick={() => {
                    props.onExportDxf(100);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 opacity-70" /> Export Section DXF (1:100)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onExportDxf(50);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 opacity-70" /> Export Section DXF (1:50)
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".rwall,.json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* More Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-xs cursor-pointer"
              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
            >
              <span>Tools</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {openMenu === 'more' && (
              <div
                className="absolute right-0 mt-1 w-56 rounded-md border shadow-lg py-1 z-50"
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    props.onAutoBars();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 opacity-70" /> Auto-Bars (Lightest Passing)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onOpenBenchmarks();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                >
                  <FlaskConical className="w-3.5 h-3.5 opacity-70" /> Benchmark Suite (BM1–BM5)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onLoadDefault();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 opacity-70" /> Load Passing Default
                </button>
                <div className="my-1 border-t" style={{ borderColor: 'var(--border-muted)' }} />
                <button
                  type="button"
                  onClick={() => {
                    props.onReset();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:opacity-80 cursor-pointer"
                  style={{ color: 'var(--status-fail)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Factory Defaults
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border-hairline)' }} />

          {/* Report Mode Segmented Control */}
          <div
            className="inline-flex rounded border p-0.5 text-[11px]"
            style={{
              backgroundColor: 'var(--surface-subtle)',
              borderColor: 'var(--border-hairline)',
            }}
            title="Report detail level (Concise vs Full with code notes)"
          >
            {(['concise', 'full'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => props.onReportModeChange(m)}
                className="px-2 py-0.5 rounded capitalize cursor-pointer transition-colors"
                style={
                  props.reportMode === m
                    ? {
                        backgroundColor: 'var(--surface-panel)',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                      }
                    : { color: 'var(--text-muted)' }
                }
              >
                {m}
              </button>
            ))}
          </div>

          {/* Theme Switch */}
          <button
            type="button"
            onClick={cycleTheme}
            className="inline-flex items-center gap-1 px-2 h-7 rounded border text-[11px] cursor-pointer"
            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-panel)' }}
            title={`Theme: ${props.theme} (click to cycle Light / Dark / System)`}
          >
            {props.theme === 'light' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : props.theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <SunMoon className="w-3.5 h-3.5" />
            )}
            <span className="capitalize hidden xl:inline">{props.theme}</span>
          </button>

          {/* Primary Export PDF CTA */}
          <button
            type="button"
            onClick={props.onExportPdf}
            className="inline-flex items-center gap-1.5 px-3 h-7 rounded text-xs font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent-cobalt)' }}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Row 2: Multi-Wall-Type Tab Strip */}
      <div
        className="flex items-end gap-1 px-3 pt-1 border-t overflow-x-auto"
        style={{
          backgroundColor: 'var(--surface-subtle)',
          borderColor: 'var(--border-muted)',
        }}
      >
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold pb-1.5 mr-1.5 shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          <Layers className="w-3 h-3" /> Wall Types
        </span>

        {props.wallTabs.map((tab) => {
          const active = tab.index === props.activeWallIndex;
          const dotColor =
            tab.status === 'pass'
              ? 'var(--status-pass)'
              : tab.status === 'fail'
                ? 'var(--status-fail)'
                : 'var(--status-warn)';
          const isEditing = editingIdx === tab.index;
          const isArmed = armedDeleteIdx === tab.index;

          return (
            <div
              key={tab.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-t border border-b-0 text-xs shrink-0 transition-colors"
              style={{
                backgroundColor: active ? 'var(--surface-canvas)' : 'transparent',
                borderColor: active ? 'var(--border-hairline)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 500,
              }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
              {isEditing ? (
                <input
                  autoFocus
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingIdx(null);
                  }}
                  className="w-20 px-1 py-0 text-xs border rounded"
                  style={{
                    backgroundColor: 'var(--surface-panel)',
                    borderColor: 'var(--accent-cobalt)',
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => props.onSelectWall(tab.index)}
                  onDoubleClick={() => {
                    setEditingIdx(tab.index);
                    setEditVal(tab.name);
                  }}
                  className="cursor-pointer"
                  title="Click to switch · Double-click to rename"
                >
                  {tab.name}
                </button>
              )}
              <span className="font-mono-eng text-[10px] opacity-60">{tab.ty}</span>
              {active && props.wallTabs.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (isArmed) {
                      setArmedDeleteIdx(null);
                      props.onDeleteWall(tab.index);
                    } else {
                      setArmedDeleteIdx(tab.index);
                      setTimeout(() => setArmedDeleteIdx((cur) => (cur === tab.index ? null : cur)), 3000);
                    }
                  }}
                  className="ml-0.5 px-1 rounded text-[10px] cursor-pointer"
                  style={
                    isArmed
                      ? { backgroundColor: 'var(--status-fail)', color: '#fff' }
                      : { color: 'var(--text-muted)' }
                  }
                  title="Delete wall type (click twice)"
                >
                  {isArmed ? 'Confirm?' : <X className="w-3 h-3" />}
                </button>
              )}
            </div>
          );
        })}

        {/* + New Wall Type */}
        <div className="relative pb-1 ml-1">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'add' ? null : 'add')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer"
            style={{
              borderColor: 'var(--border-hairline)',
              backgroundColor: 'var(--surface-panel)',
              color: 'var(--text-secondary)',
            }}
          >
            <Plus className="w-3 h-3" /> New
          </button>
          {openMenu === 'add' && (
            <div
              className="absolute left-0 mt-1 w-48 rounded-md border shadow-lg py-1 z-50"
              style={{
                backgroundColor: 'var(--surface-elevated)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  props.onAddWall('dup');
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:opacity-80 cursor-pointer"
              >
                Duplicate current wall
              </button>
              <button
                type="button"
                onClick={() => {
                  props.onAddWall('blank');
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:opacity-80 cursor-pointer"
              >
                Blank wall (factory defaults)
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
