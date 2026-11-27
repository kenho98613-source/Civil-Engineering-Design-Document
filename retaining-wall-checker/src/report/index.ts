/**
 * Decoupled A4 Report Layer (Phase 4).
 *
 * Per RULES.md #5, all A4 print / PDF submission report templates, styles,
 * Concise/Full toggles, and multi-wall-type summary builders live here —
 * completely isolated from interactive desktop UI components and themes.
 */
import type { CalcAllResult, CheckRegisterRow, ProjectFile, WallState } from '../engine/types';

export type ReportMode = 'concise' | 'full';

export interface SingleWallReportPayload {
  wallName: string;
  state: WallState;
  result: CalcAllResult;
  registerRows: CheckRegisterRow[];
  mode: ReportMode;
}

export interface MultiWallReportPayload {
  project: ProjectFile['project'];
  walls: SingleWallReportPayload[];
  mode: ReportMode;
}
