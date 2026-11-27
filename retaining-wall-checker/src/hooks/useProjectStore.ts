/**
 * Central state & multi-wall-type project store for the desktop workstation.
 * Connects React UI strictly to the pure TypeScript src/engine/ modules.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_STATE,
  PJF,
  applyWallType,
  autoBars,
  calcAll,
  dgCU,
  dgCalc,
  dxfName,
  dxfText,
  fillDef,
  linkLevels,
  loadDefaultDesign,
  nextName,
  parseProjectFile,
  pjFrom,
  regRows,
  serializeProject,
  setVirtualParam,
  syncState,
  uid,
  uniqName,
} from '../engine';
import type {
  CalcAllResult,
  CheckRegisterRow,
  CurtailmentResult,
  DiagramMap,
  ProjectFile,
  WallState,
  WallType,
} from '../engine';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ReportMode = 'concise' | 'full';
export type WorkspaceTab =
  | 'figure'
  | 'rcd'
  | 'bmd'
  | 'tools'
  | 'register'
  | 'calc5'
  | 'stab6'
  | 'rc7'
  | 'limits8';

const STORAGE_PJ = 'rw14_desktop_pj';
const STORAGE_THEME = 'rw14_theme';

function loadInitialProject(): ProjectFile {
  try {
    const raw = localStorage.getItem(STORAGE_PJ);
    if (raw) {
      const parsed = parseProjectFile(raw);
      return parsed.project;
    }
  } catch {
    // fallback to default
  }
  const s = syncState(fillDef(structuredClone(DEFAULT_STATE) as unknown as Record<string, unknown>).state);
  return pjFrom(s, 'RW1', false);
}

export interface WallTabStatus {
  index: number;
  id: string;
  name: string;
  ty: WallType;
  status: 'pass' | 'fail' | 'error';
}

export function useProjectStore() {
  const [project, setProject] = useState<ProjectFile>(loadInitialProject);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const v = localStorage.getItem(STORAGE_THEME);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      // ignore
    }
    return 'system';
  });
  const [reportMode, setReportMode] = useState<ReportMode>('concise');
  const [activeStep, setActiveStep] = useState<number>(2);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('figure');
  const [toast, setToast] = useState<string>('');
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  // Undo / redo history per active wall session (700ms merge window, matching v14.0.1)
  const historyRef = useRef<{ undo: string[]; redo: string[]; cur: string; ts: number }>({
    undo: [],
    redo: [],
    cur: JSON.stringify(project.types[project.active].S),
    ts: 0,
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const activeEntry = project.types[project.active] ?? project.types[0];
  const state: WallState = activeEntry.S;

  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  // Apply theme attribute to root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_THEME, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Persist project to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PJ, serializeProject(project));
    } catch {
      // ignore
    }
  }, [project]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyRef.current.undo.length > 0);
    setCanRedo(historyRef.current.redo.length > 0);
  }, []);

  const pushHistory = useCallback(
    (nextS: WallState, forceNew = false) => {
      const snap = JSON.stringify(nextS);
      const h = historyRef.current;
      if (snap === h.cur) return;
      const now = Date.now();
      if (forceNew || now - h.ts > 700 || h.undo.length === 0) {
        h.undo.push(h.cur);
        if (h.undo.length > 150) h.undo.shift();
      }
      h.ts = now;
      h.cur = snap;
      h.redo = [];
      syncHistoryFlags();
    },
    [syncHistoryFlags],
  );

  const commitState = useCallback(
    (mutator: (draft: WallState) => void, opts?: { forceHistory?: boolean; message?: string }) => {
      setProject((prev) => {
        const nextTypes = prev.types.slice();
        const curEntry = nextTypes[prev.active];
        const draft = structuredClone(curEntry.S);
        mutator(draft);
        syncState(draft);
        const nextMeta = { ...prev.project };
        PJF.forEach((k) => {
          (nextMeta as any)[k] = (draft as any)[k] ?? '';
        });
        nextTypes[prev.active] = { ...curEntry, S: draft };
        // Keep shared project metadata synced across all wall types
        for (let i = 0; i < nextTypes.length; i++) {
          if (i !== prev.active) {
            const copy = structuredClone(nextTypes[i].S);
            PJF.forEach((k) => {
              (copy as any)[k] = (nextMeta as any)[k];
            });
            nextTypes[i] = { ...nextTypes[i], S: copy };
          }
        }
        pushHistory(draft, opts?.forceHistory);
        return { ...prev, project: nextMeta, types: nextTypes };
      });
      if (opts?.message) notify(opts.message);
    },
    [notify, pushHistory],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.undo.length) return;
    h.redo.push(h.cur);
    h.cur = h.undo.pop()!;
    h.ts = 0;
    const restored = syncState(fillDef(JSON.parse(h.cur)).state);
    setProject((prev) => {
      const nextTypes = prev.types.slice();
      nextTypes[prev.active] = { ...nextTypes[prev.active], S: restored };
      return { ...prev, types: nextTypes };
    });
    syncHistoryFlags();
    notify('Undo');
  }, [notify, syncHistoryFlags]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.redo.length) return;
    h.undo.push(h.cur);
    h.cur = h.redo.pop()!;
    h.ts = 0;
    const restored = syncState(fillDef(JSON.parse(h.cur)).state);
    setProject((prev) => {
      const nextTypes = prev.types.slice();
      nextTypes[prev.active] = { ...nextTypes[prev.active], S: restored };
      return { ...prev, types: nextTypes };
    });
    syncHistoryFlags();
    notify('Redo');
  }, [notify, syncHistoryFlags]);

  const switchWallType = useCallback(
    (index: number) => {
      setProject((prev) => {
        if (!prev.types[index] || index === prev.active) return prev;
        const targetS = prev.types[index].S;
        historyRef.current = { undo: [], redo: [], cur: JSON.stringify(targetS), ts: 0 };
        syncHistoryFlags();
        return { ...prev, active: index };
      });
      notify(`Switched to ${project.types[index]?.name ?? 'wall'}`);
    },
    [notify, project.types, syncHistoryFlags],
  );

  const addWallType = useCallback(
    (mode: 'dup' | 'blank') => {
      setProject((prev) => {
        const curS = prev.types[prev.active].S;
        const baseS =
          mode === 'dup'
            ? structuredClone(curS)
            : (() => {
                const fresh = fillDef(structuredClone(DEFAULT_STATE) as unknown as Record<string, unknown>).state;
                fresh.acc = curS.acc;
                fresh.dwg = null;
                return syncState(fresh);
              })();
        PJF.forEach((k) => {
          (baseS as any)[k] = (prev.project as any)[k];
        });
        const name = uniqName(prev.types, nextName(prev.types[prev.types.length - 1].name));
        const nextTypes = [...prev.types, { id: uid(), name, named: 1, S: baseS }];
        historyRef.current = { undo: [], redo: [], cur: JSON.stringify(baseS), ts: 0 };
        syncHistoryFlags();
        return { ...prev, types: nextTypes, active: nextTypes.length - 1 };
      });
      notify(mode === 'dup' ? 'Duplicated wall type' : 'Created new wall type');
    },
    [notify, syncHistoryFlags],
  );

  const renameWallType = useCallback(
    (index: number, rawName: string) => {
      const name = rawName.trim();
      if (!name) return;
      setProject((prev) => {
        if (prev.types.some((t, j) => j !== index && t.name === name)) {
          notify(`"${name}" is already in use`);
          return prev;
        }
        const nextTypes = prev.types.slice();
        nextTypes[index] = { ...nextTypes[index], name, named: 1 };
        return { ...prev, types: nextTypes };
      });
      notify(`Renamed wall type to ${name}`);
    },
    [notify],
  );

  const deleteWallType = useCallback(
    (index: number) => {
      setProject((prev) => {
        if (prev.types.length < 2 || !prev.types[index]) return prev;
        const nextTypes = prev.types.slice();
        const removed = nextTypes.splice(index, 1)[0];
        const nextActive = index === prev.active ? Math.max(0, index - 1) : index < prev.active ? prev.active - 1 : prev.active;
        historyRef.current = {
          undo: [],
          redo: [],
          cur: JSON.stringify(nextTypes[nextActive].S),
          ts: 0,
        };
        syncHistoryFlags();
        notify(`Deleted ${removed.name}`);
        return { ...prev, types: nextTypes, active: nextActive };
      });
    },
    [notify, syncHistoryFlags],
  );

  const changeWallForm = useCallback(
    (ty: WallType) => {
      commitState((draft) => {
        applyWallType(draft, ty);
      }, { forceHistory: true, message: `Wall form changed to ${ty}` });
    },
    [commitState],
  );

  const editFigureParam = useCallback(
    (paramPath: string, value: number) => {
      commitState(
        (draft) => {
          setVirtualParam(draft, paramPath, value);
          syncState(draft);
          linkLevels(draft, paramPath);
        },
        { forceHistory: true, message: `Updated ${paramPath.replace('@', '')} = ${value}` },
      );
    },
    [commitState],
  );

  // Live SVG drag preview (updates state without pushing intermediate undo frames)
  const previewFigureParam = useCallback((paramPath: string, value: number) => {
    setProject((prev) => {
      const nextTypes = prev.types.slice();
      const curEntry = nextTypes[prev.active];
      const draft = structuredClone(curEntry.S);
      setVirtualParam(draft, paramPath, value);
      syncState(draft);
      linkLevels(draft, paramPath);
      nextTypes[prev.active] = { ...curEntry, S: draft };
      return { ...prev, types: nextTypes };
    });
  }, []);

  // Commit final state of a pointer drag gesture as a single Undo snapshot
  const commitFigureDrag = useCallback(
    (label: string) => {
      setProject((prev) => {
        const curS = prev.types[prev.active].S;
        pushHistory(curS, true);
        return prev;
      });
      notify(label);
    },
    [notify, pushHistory],
  );

  // Replace entire active WallState (Setup Wizard, Auto Design, DXF Import, Scenario Load)
  const replaceActiveState = useCallback(
    (next: WallState, msg: string, renameTo?: string) => {
      setProject((prev) => {
        const nextTypes = prev.types.slice();
        const curEntry = nextTypes[prev.active];
        const clean = syncState(fillDef(structuredClone(next) as unknown as Record<string, unknown>).state);
        const nextMeta = { ...prev.project };
        PJF.forEach((k) => {
          if ((clean as any)[k] !== undefined && (clean as any)[k] !== '') {
            (nextMeta as any)[k] = (clean as any)[k];
          } else {
            (clean as any)[k] = (nextMeta as any)[k] ?? '';
          }
        });
        let nextNameVal = curEntry.name;
        if (renameTo && renameTo.trim()) {
          const cand = renameTo.trim();
          nextNameVal = prev.types.some((t, j) => j !== prev.active && t.name === cand)
            ? uniqName(prev.types.filter((_, j) => j !== prev.active), cand)
            : cand;
        }
        nextTypes[prev.active] = { ...curEntry, name: nextNameVal, named: renameTo ? 1 : curEntry.named, S: clean };
        for (let i = 0; i < nextTypes.length; i++) {
          if (i !== prev.active) {
            const copy = structuredClone(nextTypes[i].S);
            PJF.forEach((k) => {
              (copy as any)[k] = (nextMeta as any)[k];
            });
            nextTypes[i] = { ...nextTypes[i], S: copy };
          }
        }
        pushHistory(clean, true);
        return { ...prev, project: nextMeta, types: nextTypes };
      });
      notify(msg);
    },
    [notify, pushHistory],
  );

  const applyDefaultForCurrentForm = useCallback(() => {
    commitState(
      (draft) => {
        const next = loadDefaultDesign(draft.ty, {
          jno: draft.jno,
          pn: draft.pn,
          dsn: draft.dsn,
          chk: draft.chk,
          acc: draft.acc,
        });
        Object.assign(draft, next);
      },
      { forceHistory: true, message: 'Loaded passing default design' },
    );
  }, [commitState]);

  const runAutoBarsNow = useCallback(
    (only?: string) => {
      const res = autoBars(state, only);
      if (!res.ok) {
        notify('Fix input errors before Auto-Bars');
        return;
      }
      commitState(
        (draft) => {
          draft.rc = structuredClone(res.state.rc);
          draft.mvd = res.state.mvd;
          draft.mvs = res.state.mvs;
          draft.mhd = res.state.mhd;
          draft.mhs = res.state.mhs;
          draft.mtd = res.state.mtd;
          draft.mts = res.state.mts;
          draft.mbd = res.state.mbd;
          draft.mbs = res.state.mbs;
        },
        {
          forceHistory: true,
          message: res.log.length ? `Auto-Bars updated ${res.log.length} item(s)` : 'Bars already optimal',
        },
      );
    },
    [commitState, notify, state],
  );

  const exportDxfSection = useCallback(
    (scale: number) => {
      const text = dxfText(state, { sc: scale, name: activeEntry.name });
      const blob = new Blob([text], { type: 'application/dxf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = dxfName(activeEntry.name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      notify(`Exported ${dxfName(activeEntry.name)} (1:${scale})`);
    },
    [activeEntry.name, notify, state],
  );

  const saveProjectDownload = useCallback(() => {
    const json = serializeProject(project);
    const fname = String(state.pn || state.jno || 'retaining-wall').replace(/[^\w-]+/g, '_') + '.rwall';
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    notify(`Saved ${fname}`);
  }, [notify, project, state.jno, state.pn]);

  const loadProjectText = useCallback(
    (jsonText: string, fileName: string) => {
      try {
        const parsed = parseProjectFile(jsonText);
        setProject(parsed.project);
        historyRef.current = {
          undo: [],
          redo: [],
          cur: JSON.stringify(parsed.project.types[parsed.project.active].S),
          ts: 0,
        };
        syncHistoryFlags();
        notify(`Opened ${fileName} (${parsed.project.types.length} wall type${parsed.project.types.length > 1 ? 's' : ''})`);
      } catch (err) {
        notify(`Open failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [notify, syncHistoryFlags],
  );

  const resetFactory = useCallback(() => {
    const fresh = syncState(fillDef(structuredClone(DEFAULT_STATE) as unknown as Record<string, unknown>).state);
    const pj = pjFrom(fresh, 'RW1', false);
    setProject(pj);
    historyRef.current = { undo: [], redo: [], cur: JSON.stringify(fresh), ts: 0 };
    syncHistoryFlags();
    notify('Reset to factory defaults');
  }, [notify, syncHistoryFlags]);

  // Live memoized calculations from src/engine/
  const result: CalcAllResult = useMemo(() => calcAll(state), [state]);

  const registerRows: CheckRegisterRow[] = useMemo(() => {
    if (result.err) return [];
    return regRows(state, result);
  }, [result, state]);

  const diagrams: DiagramMap | null = useMemo(() => {
    if (result.err) return null;
    return dgCalc(state, result);
  }, [result, state]);

  const curtailments: Record<string, CurtailmentResult | null> = useMemo(() => {
    if (result.err || !diagrams) return {};
    return dgCU(state, result, diagrams);
  }, [diagrams, result, state]);

  const wallTabStatuses: WallTabStatus[] = useMemo(
    () =>
      project.types.map((t, index) => {
        const r = index === project.active ? result : calcAll(t.S);
        const status = r.err ? 'error' : r.fails.length ? 'fail' : 'pass';
        return { index, id: t.id, name: t.name, ty: t.S.ty, status };
      }),
    [project.active, project.types, result],
  );

  return {
    project,
    activeEntry,
    state,
    result,
    registerRows,
    diagrams,
    curtailments,
    wallTabStatuses,
    theme,
    setTheme,
    reportMode,
    setReportMode,
    activeStep,
    setActiveStep,
    activeTab,
    setActiveTab,
    hoveredField,
    setHoveredField,
    toast,
    notify,
    canUndo,
    canRedo,
    undo,
    redo,
    commitState,
    switchWallType,
    addWallType,
    renameWallType,
    deleteWallType,
    changeWallForm,
    editFigureParam,
    previewFigureParam,
    commitFigureDrag,
    replaceActiveState,
    applyDefaultForCurrentForm,
    runAutoBarsNow,
    exportDxfSection,
    saveProjectDownload,
    loadProjectText,
    resetFactory,
  };
}
