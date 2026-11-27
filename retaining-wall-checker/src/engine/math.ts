/**
 * Pure numerical, formatting, and interpolation helpers.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #2).
 */

export const F0 = (v: number, d = 2): string =>
  Number.isFinite(v) ? (+v).toFixed(d) : v === Infinity ? '∞' : '–';

export const f = (v: number, d = 2): string =>
  Number.isFinite(v) ? (+v).toFixed(d) : v === Infinity ? '∞' : '–';

export const cl = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Midpoint numerical integration over [a, b] with n subintervals (exact parity with v14.0.1). */
export const ints = (a: number, b: number, fn: (x: number) => number, n = 400): number => {
  if (!(b > a)) return 0;
  let s = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) s += fn(a + (i + 0.5) * h) * h;
  return s;
};

export const dd = (v: number | string): string => {
  if (!Number.isFinite(+v)) return f(+v);
  const r = Math.round(+v * 1000) / 1000;
  const t = r.toFixed(3);
  return t.endsWith('0') ? r.toFixed(2) : t;
};

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Piecewise linear interpolation clamped to table bounds. */
export const lin = (T: [number, number][], x: number): number => {
  const xv = cl(x, T[0][0], T[T.length - 1][0]);
  for (let i = 0; i < T.length - 1; i++) {
    const [a, ca] = T[i];
    const [b, cb] = T[i + 1];
    if (xv <= b) return ca + ((cb - ca) * (xv - a)) / (b - a);
  }
  return T[T.length - 1][1];
};

/** Round up to nearest 5 mm (CoP nominal cover). */
export const c5 = (x: number): number => Math.ceil(x / 5 - 1e-9) * 5;
