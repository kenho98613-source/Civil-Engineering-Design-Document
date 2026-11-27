import { describe, expect, it } from 'vitest';
import { BMK, BMTOL, benchRun } from '../benchmarks';

describe('Benchmark Gate (BM1–BM5, tolerance ≤ 0.5%)', () => {
  const results = benchRun();

  it('runs all 5 built-in benchmark cases without errors', () => {
    expect(results).toHaveLength(5);
    expect(BMK).toHaveLength(5);
    for (const r of results) {
      expect(r.er).toBe('');
      expect(r.ok).toBe(true);
      expect(r.mx).toBeLessThanOrEqual(BMTOL);
    }
  });

  for (const res of results) {
    describe(`${res.c.id}: ${res.c.t}`, () => {
      for (const row of res.rows) {
        it(`${row.key} (${row.l}) matches hand calc ${row.ref} within 0.5%`, () => {
          expect(Number.isFinite(row.m)).toBe(true);
          expect(row.d).toBeLessThanOrEqual(BMTOL);
          expect(row.ok).toBe(true);
        });
      }
    });
  }
});
