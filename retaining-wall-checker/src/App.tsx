import { MODEL_VERSION, benchRun } from './engine';

export default function App() {
  const results = benchRun();
  const passed = results.filter((r) => r.ok).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans">
      <h1 className="text-lg font-semibold">
        Retaining Wall Design &amp; Checker {MODEL_VERSION} — Phase 1 Engine Ready
      </h1>
      <p className="text-sm text-slate-600 mt-1">
        Benchmark Gate: {passed} / {results.length} PASS (tolerance ≤ 0.5%). Desktop UI arrives in Phase 2.
      </p>
    </div>
  );
}
