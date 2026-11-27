# Engineering Engine & Workflow Rules

1. **Source of Truth**: `legacy/Retaining_Wall_Checker_v14.0.1.html` (exact snapshot of PR #9 `retaining-wall-checker/src/index.html` v14.0.1, built upon v13.8.13) is the reference implementation for Hong Kong retaining wall design & checking:
   - Geoguide 1: Guide to Retaining Wall Design (2020 Version) – CEDD / GEO
   - Code of Practice for Foundations 2017 – BD
   - Code of Practice for Structural Use of Concrete 2013 (2020 Edition) – BD
   - Code of Practice on Wind Effects in Hong Kong 2019 – BD
   - Code of Practice for Dead and Imposed Loads 2011 (2021 Edition) – BD
   - Including v14.0.1 additions: CR-1 DXF R2000 section export, CR-3 ULS BMD/SFD + 50% bar curtailment + lap length, CR-4 bearing capacity near a slope crest (GG1 Fig. A4 / FC 2017 Fig. 2.3).
2. **Do Not Alter Calculation Logic**: When extracting the calculation engine, geometry, stability checks, RC design, BMD/SFD & curtailment, shear key, stepped gravity section checks, slope-crest bearing, line/barrier/wind/fence self-weight loads, Design Tools evaluators, DXF import parser, and DXF section exporter into `src/engine/`, preserve all formulas, factors, numerical integration rules, edge cases, and data structures faithfully. Do not "simplify" or change engineering equations unless explicitly instructed.
3. **Pure & Stateless Engine**: `src/engine/` must have zero DOM or React dependencies and must not rely on mutable module-level state. Every calculation entry point takes `WallState` (or synced copy) as an explicit argument so interactive UI, Stress sliders, Auto-Optimizer, Sensitivity analysis, and multi-wall-type PDF reports remain deterministic and side-effect free.
4. **Benchmark & Parity Gate**:
   - Port the 5 built-in benchmark cases (`BM1`–`BM5`, 66 independent hand-calculated quantities) into automated Vitest tests (`src/engine/__tests__/benchmarks.test.ts`) and run them after every milestone. All benchmark quantities must stay within the **0.5%** tolerance (`BMTOL = 0.005`).
   - Maintain a parity regression test suite (`src/engine/__tests__/parity.test.ts`) comparing `src/engine/` against `legacy/Retaining_Wall_Checker_v14.0.1.html` across wall types (`T`, `L`, `Li`, `G`), checking methods (`fc`, `gg1`), Ka modes (`r`, `c`, `m`), passive/toe/overburden options, shear key, slope crest, BMD/SFD & curtailment, terraced/U-channel, fence wind & self-weight, vehicle impact, Design Tools, DXF parser, and DXF export.
5. **Decoupled Report Layer**: Keep A4 print/PDF report generation in a dedicated module (`src/report/`) completely separate from interactive desktop UI components (`src/components/`) so UI theme or layout changes never break A4 submission report formatting, tables, figures, or pagination.
6. **Project Data Hygiene**: Never commit client `.rwall` files, exported `.pdf` reports, or client `.dxf` drawings into this repository.
