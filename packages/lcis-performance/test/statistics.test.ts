/**
 * StatisticsService test suite — node:test + assert/strict.
 * Fixed clock: '2026-07-04T00:00:00.000Z' (unused by StatisticsService itself,
 * present per test-convention requirement).
 *
 * All fixture values are hand-computed from the documented formulas:
 *
 *   Percentile: sort asc, idx = min(len-1, max(0, ceil(p/100*len)-1))
 *   StdDev:     population stddev (divide by N)
 *   trendOf:    OLS linearTrend from @letbuyy/lcis-operations
 *   movingAverageOf: SMA movingAverage from @letbuyy/lcis-operations
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StatisticsService } from '../src/statistics/StatisticsService';

// ── helpers ───────────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-07-04T00:00:00.000Z'; // per test convention (unused directly here)

/** Tolerance for floating-point comparisons */
const EPS = 1e-9;

function near(actual: number, expected: number, eps = EPS): boolean {
  return Math.abs(actual - expected) < eps;
}

function assertNear(actual: number, expected: number, label = '', eps = EPS): void {
  assert.ok(
    near(actual, expected, eps),
    `${label}: expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`,
  );
}

// ── shared service instance ───────────────────────────────────────────────────

const svc = new StatisticsService();

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — null / empty
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — empty input returns null (no-fabrication law)', () => {
  it('returns null for empty array []', () => {
    assert.equal(svc.statsOf([]), null);
  });

  it('never throws on empty input', () => {
    assert.doesNotThrow(() => svc.statsOf([]));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — single element [42]
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — single element [42]', () => {
  const result = svc.statsOf([42]);

  it('returns non-null', () => assert.notEqual(result, null));
  it('count is 1', () => assert.equal(result!.count, 1));
  it('mean is 42', () => assert.equal(result!.mean, 42));
  it('min is 42', () => assert.equal(result!.min, 42));
  it('max is 42', () => assert.equal(result!.max, 42));
  it('p50 is 42', () => assert.equal(result!.p50, 42));
  it('p95 is 42', () => assert.equal(result!.p95, 42));
  it('p99 is 42', () => assert.equal(result!.p99, 42));
  it('stddev is 0', () => assert.equal(result!.stddev, 0));
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — two elements [3, 7]
// Hand computations:
//   sorted=[3,7], len=2
//   p50: ceil(0.50*2)-1 = ceil(1)-1 = 0 → sorted[0]=3
//   p95: ceil(0.95*2)-1 = ceil(1.9)-1 = 2-1=1 → sorted[1]=7
//   p99: ceil(0.99*2)-1 = ceil(1.98)-1 = 2-1=1 → sorted[1]=7
//   mean=5, stddev=sqrt(((3-5)²+(7-5)²)/2)=sqrt(4)=2
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — two elements [3, 7]', () => {
  const result = svc.statsOf([3, 7]);

  it('returns non-null', () => assert.notEqual(result, null));
  it('count is 2', () => assert.equal(result!.count, 2));
  it('mean is 5', () => assert.equal(result!.mean, 5));
  it('min is 3', () => assert.equal(result!.min, 3));
  it('max is 7', () => assert.equal(result!.max, 7));
  it('p50 is 3 (ceil-based nearest-rank)', () => assert.equal(result!.p50, 3));
  it('p95 is 7', () => assert.equal(result!.p95, 7));
  it('p99 is 7', () => assert.equal(result!.p99, 7));
  it('stddev is 2 (population)', () => assertNear(result!.stddev, 2));
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — all-equal [5, 5, 5, 5]
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — all-equal [5, 5, 5, 5]', () => {
  const result = svc.statsOf([5, 5, 5, 5]);

  it('returns non-null', () => assert.notEqual(result, null));
  it('count is 4', () => assert.equal(result!.count, 4));
  it('mean is 5', () => assert.equal(result!.mean, 5));
  it('min is 5', () => assert.equal(result!.min, 5));
  it('max is 5', () => assert.equal(result!.max, 5));
  it('p50 is 5', () => assert.equal(result!.p50, 5));
  it('p95 is 5', () => assert.equal(result!.p95, 5));
  it('p99 is 5', () => assert.equal(result!.p99, 5));
  it('stddev is 0', () => assert.equal(result!.stddev, 0));
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — negative values [-3, -1, -2]
// sorted = [-3, -2, -1], len=3
//   p50: ceil(0.50*3)-1 = ceil(1.5)-1 = 2-1=1 → sorted[1]=-2
//   p95: ceil(0.95*3)-1 = ceil(2.85)-1 = 3-1=2 → sorted[2]=-1
//   p99: ceil(0.99*3)-1 = ceil(2.97)-1 = 3-1=2 → sorted[2]=-1
//   mean = (-3-1-2)/3 = -6/3 = -2
//   stddev = sqrt(((-3-(-2))²+(-1-(-2))²+(-2-(-2))²)/3) = sqrt((1+1+0)/3) = sqrt(2/3)
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — negative values [-3, -1, -2] (unsorted input with negatives)', () => {
  const result = svc.statsOf([-3, -1, -2]);

  it('returns non-null', () => assert.notEqual(result, null));
  it('count is 3', () => assert.equal(result!.count, 3));
  it('mean is -2', () => assert.equal(result!.mean, -2));
  it('min is -3', () => assert.equal(result!.min, -3));
  it('max is -1', () => assert.equal(result!.max, -1));
  it('p50 is -2 (sorted[1] of [-3,-2,-1])', () => assert.equal(result!.p50, -2));
  it('p95 is -1 (sorted[2])', () => assert.equal(result!.p95, -1));
  it('p99 is -1 (sorted[2])', () => assert.equal(result!.p99, -1));
  it('stddev is sqrt(2/3) ≈ 0.8165', () => assertNear(result!.stddev, Math.sqrt(2 / 3)));
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — unsorted input [3, 1, 2] (result identical to sorted [1, 2, 3])
// sorted=[1,2,3], len=3
//   p50: ceil(1.5)-1=1 → sorted[1]=2
//   p95: ceil(2.85)-1=2 → sorted[2]=3
//   p99: ceil(2.97)-1=2 → sorted[2]=3
//   mean=2, stddev=sqrt(((3-2)²+(1-2)²+(2-2)²)/3)=sqrt(2/3)
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — unsorted input [3, 1, 2]', () => {
  const result = svc.statsOf([3, 1, 2]);

  it('returns non-null', () => assert.notEqual(result, null));
  it('count is 3', () => assert.equal(result!.count, 3));
  it('mean is 2', () => assert.equal(result!.mean, 2));
  it('min is 1', () => assert.equal(result!.min, 1));
  it('max is 3', () => assert.equal(result!.max, 3));
  it('p50 is 2 (median of sorted [1,2,3])', () => assert.equal(result!.p50, 2));
  it('p95 is 3', () => assert.equal(result!.p95, 3));
  it('p99 is 3', () => assert.equal(result!.p99, 3));
  it('stddev is sqrt(2/3)', () => assertNear(result!.stddev, Math.sqrt(2 / 3)));
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — canonical fixture [1..100]
// p50=50, p95=95, p99=99
// mean=50.5
// stddev = sqrt((100²-1)/12) = sqrt(9999/12) = sqrt(833.25)
//   derivation: Var of discrete uniform {1..n} = (n²-1)/12
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — canonical [1..100] fixture (specified in task)', () => {
  const arr = Array.from({ length: 100 }, (_, i) => i + 1);
  const result = svc.statsOf(arr);

  it('returns non-null', () => assert.notEqual(result, null));
  it('count is 100', () => assert.equal(result!.count, 100));
  it('min is 1', () => assert.equal(result!.min, 1));
  it('max is 100', () => assert.equal(result!.max, 100));
  it('mean is 50.5', () => assertNear(result!.mean, 50.5));
  it('p50 is 50 (spec mandated: ceil(50)-1=49 → sorted[49]=50)', () => assert.equal(result!.p50, 50));
  it('p95 is 95 (spec mandated: ceil(95)-1=94 → sorted[94]=95)', () => assert.equal(result!.p95, 95));
  it('p99 is 99 (spec mandated: ceil(99)-1=98 → sorted[98]=99)', () => assert.equal(result!.p99, 99));
  it('stddev is sqrt(833.25) ≈ 28.866...', () => assertNear(result!.stddev, Math.sqrt(833.25)));
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — large 10k array determinism
// Array [1..10000]: mean=5000.5, p50=5000, p95=9500, p99=9900, stddev=sqrt((10000²-1)/12)
// p50: ceil(0.50*10000)-1 = 5000-1=4999 → sorted[4999]=5000
// p95: ceil(0.95*10000)-1 = 9500-1=9499 → sorted[9499]=9500
// p99: ceil(0.99*10000)-1 = 9900-1=9899 → sorted[9899]=9900
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — large 10k array determinism', () => {
  const arr = Array.from({ length: 10000 }, (_, i) => i + 1);
  let result: ReturnType<typeof svc.statsOf>;

  it('produces a result (does not crash or timeout)', () => {
    result = svc.statsOf(arr);
    assert.notEqual(result, null);
  });

  it('count is 10000', () => {
    result = result ?? svc.statsOf(arr);
    assert.equal(result!.count, 10000);
  });

  it('p50 is 5000', () => {
    result = result ?? svc.statsOf(arr);
    assert.equal(result!.p50, 5000);
  });

  it('p95 is 9500', () => {
    result = result ?? svc.statsOf(arr);
    assert.equal(result!.p95, 9500);
  });

  it('p99 is 9900', () => {
    result = result ?? svc.statsOf(arr);
    assert.equal(result!.p99, 9900);
  });

  it('calling twice gives identical result (deterministic)', () => {
    const r1 = svc.statsOf(arr);
    const r2 = svc.statsOf(arr);
    assert.equal(r1!.p50, r2!.p50);
    assert.equal(r1!.p95, r2!.p95);
    assert.equal(r1!.mean, r2!.mean);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — does not mutate caller's array
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — immutability (does not mutate input)', () => {
  it('leaves the input array in original order', () => {
    const input = [5, 3, 1, 4, 2];
    const snapshot = [...input];
    svc.statsOf(input);
    assert.deepEqual(input, snapshot);
  });

  it('accepts readonly number[] without type error', () => {
    const ro: readonly number[] = [1, 2, 3] as const;
    assert.notEqual(svc.statsOf(ro), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// statsOf — additional shape / edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('statsOf — additional shape and edge cases', () => {
  it('result object has all 8 required SeriesStatistics fields', () => {
    const r = svc.statsOf([1, 2, 3]);
    assert.notEqual(r, null);
    assert.ok('count' in r!);
    assert.ok('mean' in r!);
    assert.ok('min' in r!);
    assert.ok('max' in r!);
    assert.ok('p50' in r!);
    assert.ok('p95' in r!);
    assert.ok('p99' in r!);
    assert.ok('stddev' in r!);
  });

  it('p50 <= p95 <= p99 always holds', () => {
    const cases: readonly number[][] = [
      [1, 2, 3],
      [100, 50, 10, 200, 30],
      Array.from({ length: 50 }, (_, i) => i * 2),
    ];
    for (const c of cases) {
      const r = svc.statsOf(c)!;
      assert.ok(r.p50 <= r.p95, `p50(${r.p50}) <= p95(${r.p95})`);
      assert.ok(r.p95 <= r.p99, `p95(${r.p95}) <= p99(${r.p99})`);
    }
  });

  it('min <= mean <= max always holds', () => {
    const cases: readonly number[][] = [[1, 2, 3], [-10, 0, 10], [7, 7, 7]];
    for (const c of cases) {
      const r = svc.statsOf(c)!;
      assert.ok(r.min <= r.mean, `min(${r.min}) <= mean(${r.mean})`);
      assert.ok(r.mean <= r.max, `mean(${r.mean}) <= max(${r.max})`);
    }
  });

  it('stddev >= 0 always', () => {
    const cases: readonly number[][] = [[1], [1, 2], [-5, 5], [3, 3, 3]];
    for (const c of cases) {
      assert.ok(svc.statsOf(c)!.stddev >= 0);
    }
  });

  it('mean is exact sum/count for [10, 20, 30]', () => {
    const r = svc.statsOf([10, 20, 30]);
    assert.equal(r!.mean, 20);
  });

  it('[0, 0, 0] — mean=0, stddev=0', () => {
    const r = svc.statsOf([0, 0, 0])!;
    assert.equal(r.mean, 0);
    assert.equal(r.stddev, 0);
    assert.equal(r.p50, 0);
  });

  it('floats: [1.5, 2.5, 3.5] — mean=2.5, min=1.5, max=3.5', () => {
    const r = svc.statsOf([1.5, 2.5, 3.5])!;
    assertNear(r.mean, 2.5);
    assert.equal(r.min, 1.5);
    assert.equal(r.max, 3.5);
  });

  it('large negative values [-1000, -500, -250] — min=-1000, max=-250', () => {
    const r = svc.statsOf([-1000, -500, -250])!;
    assert.equal(r.min, -1000);
    assert.equal(r.max, -250);
  });

  it('mixed positive/negative [-5, 0, 5] — mean=0, stddev=sqrt(50/3)', () => {
    const r = svc.statsOf([-5, 0, 5])!;
    assertNear(r.mean, 0);
    // stddev = sqrt((25+0+25)/3) = sqrt(50/3)
    assertNear(r.stddev, Math.sqrt(50 / 3));
    assert.equal(r.min, -5);
    assert.equal(r.max, 5);
  });

  it('duplicate values at edges [1, 1, 5, 5] — min=1, max=5', () => {
    const r = svc.statsOf([1, 1, 5, 5])!;
    assert.equal(r.min, 1);
    assert.equal(r.max, 5);
    assert.equal(r.mean, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trendOf — null / empty
// ─────────────────────────────────────────────────────────────────────────────

describe('trendOf — empty input returns null (no-fabrication law)', () => {
  it('returns null for empty array', () => {
    assert.equal(svc.trendOf([], 3), null);
  });

  it('never throws on empty input', () => {
    assert.doesNotThrow(() => svc.trendOf([], 5));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trendOf — [1, 2, 3] horizon 2  →  [4, 5]
// OLS: slope=1, intercept=1; forecast(2): x=3→4, x=4→5
// ─────────────────────────────────────────────────────────────────────────────

describe('trendOf — [1, 2, 3] horizon 2 (spec mandated: [4, 5])', () => {
  const result = svc.trendOf([1, 2, 3], 2);

  it('returns non-null', () => assert.notEqual(result, null));
  it('returns exactly 2 values', () => assert.equal(result!.length, 2));
  it('first forecast value is 4', () => assertNear(result![0]!, 4));
  it('second forecast value is 5', () => assertNear(result![1]!, 5));
});

// ─────────────────────────────────────────────────────────────────────────────
// trendOf — flat series [5, 5, 5] horizon 3  →  [5, 5, 5]
// OLS: slope=0, intercept=5
// ─────────────────────────────────────────────────────────────────────────────

describe('trendOf — flat series [5, 5, 5] horizon 3 → [5, 5, 5]', () => {
  const result = svc.trendOf([5, 5, 5], 3);

  it('returns non-null', () => assert.notEqual(result, null));
  it('returns 3 values', () => assert.equal(result!.length, 3));
  it('all forecast values are 5', () => {
    for (const v of result!) assertNear(v, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trendOf — single value [7] horizon 2  →  [7, 7]
// linearTrend edge case: n=1 → slope=0, intercept=7
// ─────────────────────────────────────────────────────────────────────────────

describe('trendOf — single value [7] horizon 2 → [7, 7]', () => {
  const result = svc.trendOf([7], 2);

  it('returns non-null', () => assert.notEqual(result, null));
  it('returns 2 values', () => assert.equal(result!.length, 2));
  it('first forecast value is 7', () => assertNear(result![0]!, 7));
  it('second forecast value is 7', () => assertNear(result![1]!, 7));
});

// ─────────────────────────────────────────────────────────────────────────────
// trendOf — horizon 0 returns empty array
// ─────────────────────────────────────────────────────────────────────────────

describe('trendOf — horizon 0 returns empty readonly array', () => {
  it('returns [] (not null) for non-empty series with horizon 0', () => {
    const result = svc.trendOf([1, 2, 3], 0);
    assert.notEqual(result, null);
    assert.equal(result!.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trendOf — [2, 4, 6] horizon 3 (slope=2, intercept=2, next=8,10,12)
// OLS: n=3, sumX=3, sumY=12, sumXY=0*2+1*4+2*6=16, sumX2=5
// denom=3*5-9=6, slope=(3*16-3*12)/6=(48-36)/6=2, intercept=(12-2*3)/3=6/3=2
// forecast: x=3→2+2*3=8, x=4→2+2*4=10, x=5→2+2*5=12
// ─────────────────────────────────────────────────────────────────────────────

describe('trendOf — [2, 4, 6] horizon 3 → [8, 10, 12]', () => {
  const result = svc.trendOf([2, 4, 6], 3);

  it('returns non-null', () => assert.notEqual(result, null));
  it('returns 3 values', () => assert.equal(result!.length, 3));
  it('first is 8', () => assertNear(result![0]!, 8));
  it('second is 10', () => assertNear(result![1]!, 10));
  it('third is 12', () => assertNear(result![2]!, 12));
});

// ─────────────────────────────────────────────────────────────────────────────
// trendOf — does not mutate caller's array
// ─────────────────────────────────────────────────────────────────────────────

describe('trendOf — immutability', () => {
  it('does not mutate the input array', () => {
    const input = [1, 2, 3];
    const snapshot = [...input];
    svc.trendOf(input, 2);
    assert.deepEqual(input, snapshot);
  });

  it('accepts readonly number[]', () => {
    const ro: readonly number[] = [1, 2, 3] as const;
    assert.notEqual(svc.trendOf(ro, 1), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trendOf — returns an array (readonly) not null for >1 value with horizon 1
// ─────────────────────────────────────────────────────────────────────────────

describe('trendOf — returns non-null for various non-empty series', () => {
  it('[10] horizon 1 → [10]', () => {
    const r = svc.trendOf([10], 1);
    assert.equal(r!.length, 1);
    assertNear(r![0]!, 10);
  });

  it('[0, 0] horizon 2 → [0, 0]', () => {
    const r = svc.trendOf([0, 0], 2);
    assert.equal(r!.length, 2);
    assertNear(r![0]!, 0);
    assertNear(r![1]!, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — null / empty
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — empty input returns null (no-fabrication law)', () => {
  it('returns null for empty array with window 3', () => {
    assert.equal(svc.movingAverageOf([], 3), null);
  });

  it('never throws on empty input', () => {
    assert.doesNotThrow(() => svc.movingAverageOf([], 2));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — window larger than series → [] (not null)
// delegate: series.length < window → returns []
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — window larger than series → [] (not null)', () => {
  it('[1, 2] window=3 → empty array (not null)', () => {
    const result = svc.movingAverageOf([1, 2], 3);
    assert.notEqual(result, null);
    assert.equal(result!.length, 0);
  });

  it('[10] window=2 → empty array', () => {
    const result = svc.movingAverageOf([10], 2);
    assert.notEqual(result, null);
    assert.equal(result!.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — window=1 returns copy of series
// delegate: window===1 → returns a copy of the series
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — window=1 returns copy of series', () => {
  it('[10, 20] window=1 → [10, 20]', () => {
    const result = svc.movingAverageOf([10, 20], 1);
    assert.notEqual(result, null);
    assert.deepEqual([...result!], [10, 20]);
  });

  it('[3, 1, 4, 1, 5] window=1 → [3, 1, 4, 1, 5]', () => {
    const result = svc.movingAverageOf([3, 1, 4, 1, 5], 1);
    assert.deepEqual([...result!], [3, 1, 4, 1, 5]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — [1, 2, 3, 4, 5] window=3 → [2, 3, 4]
// windows: (1+2+3)/3=2, (2+3+4)/3=3, (3+4+5)/3=4
// length = 5 - 3 + 1 = 3
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — [1, 2, 3, 4, 5] window=3 → [2, 3, 4]', () => {
  const result = svc.movingAverageOf([1, 2, 3, 4, 5], 3);

  it('returns non-null', () => assert.notEqual(result, null));
  it('returns 3 values', () => assert.equal(result!.length, 3));
  it('first SMA is 2', () => assertNear(result![0]!, 2));
  it('second SMA is 3', () => assertNear(result![1]!, 3));
  it('third SMA is 4', () => assertNear(result![2]!, 4));
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — [6, 8, 10, 12] window=2 → [7, 9, 11]
// (6+8)/2=7, (8+10)/2=9, (10+12)/2=11 — length = 4-2+1=3
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — [6, 8, 10, 12] window=2 → [7, 9, 11]', () => {
  const result = svc.movingAverageOf([6, 8, 10, 12], 2);

  it('returns 3 values', () => assert.equal(result!.length, 3));
  it('SMA[0] is 7', () => assertNear(result![0]!, 7));
  it('SMA[1] is 9', () => assertNear(result![1]!, 9));
  it('SMA[2] is 11', () => assertNear(result![2]!, 11));
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — exact window = series.length → single value (overall mean)
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — window equals series length → single mean', () => {
  it('[2, 4, 6, 8] window=4 → [5]', () => {
    const result = svc.movingAverageOf([2, 4, 6, 8], 4);
    assert.equal(result!.length, 1);
    assertNear(result![0]!, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — throws for invalid window (delegate throws RangeError)
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — invalid window propagates RangeError from delegate', () => {
  it('throws RangeError for window=0', () => {
    assert.throws(() => svc.movingAverageOf([1, 2, 3], 0), RangeError);
  });

  it('throws RangeError for window=-1', () => {
    assert.throws(() => svc.movingAverageOf([1, 2, 3], -1), RangeError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — immutability
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — immutability', () => {
  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    svc.movingAverageOf(input, 3);
    assert.deepEqual(input, snapshot);
  });

  it('accepts readonly number[]', () => {
    const ro: readonly number[] = [1, 2, 3, 4, 5] as const;
    const result = svc.movingAverageOf(ro, 3);
    assert.notEqual(result, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// movingAverageOf — additional semantics
// ─────────────────────────────────────────────────────────────────────────────

describe('movingAverageOf — additional semantics', () => {
  it('float series [1.0, 2.0, 3.0] window=2 → [1.5, 2.5]', () => {
    const result = svc.movingAverageOf([1.0, 2.0, 3.0], 2);
    assert.equal(result!.length, 2);
    assertNear(result![0]!, 1.5);
    assertNear(result![1]!, 2.5);
  });

  it('all-same series [4, 4, 4, 4] window=2 → [4, 4, 4]', () => {
    const result = svc.movingAverageOf([4, 4, 4, 4], 2);
    assert.equal(result!.length, 3);
    for (const v of result!) assertNear(v, 4);
  });

  it('single element [42] window=1 → [42]', () => {
    const result = svc.movingAverageOf([42], 1);
    assert.equal(result!.length, 1);
    assertNear(result![0]!, 42);
  });

  it('output length is series.length - window + 1 for valid window', () => {
    const s = [1, 2, 3, 4, 5, 6, 7];
    const w = 3;
    const result = svc.movingAverageOf(s, w);
    assert.equal(result!.length, s.length - w + 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-concern — StatisticsService is a plain class, no state between calls
// ─────────────────────────────────────────────────────────────────────────────

describe('StatisticsService — stateless / no shared mutable state', () => {
  it('two instances produce identical results for the same input', () => {
    const svc2 = new StatisticsService();
    const input = [3, 1, 4, 1, 5, 9, 2, 6];
    const r1 = svc.statsOf(input);
    const r2 = svc2.statsOf(input);
    assert.deepEqual(r1, r2);
  });

  it('sequential calls on the same instance do not contaminate each other', () => {
    svc.statsOf([100, 200, 300]);
    const r = svc.statsOf([1, 2, 3]);
    assert.equal(r!.max, 3);
    assert.equal(r!.min, 1);
  });

  it('trendOf is stateless across calls', () => {
    svc.trendOf([100, 200, 300], 5);
    const r = svc.trendOf([1, 2, 3], 1);
    assertNear(r![0]!, 4);
  });

  it('movingAverageOf is stateless across calls', () => {
    svc.movingAverageOf([100, 200, 300, 400], 2);
    const r = svc.movingAverageOf([1, 2, 3, 4, 5], 3);
    assertNear(r![0]!, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Metadata: fixed clock reference (unused by StatisticsService, present per convention)
// ─────────────────────────────────────────────────────────────────────────────

describe('test-convention metadata', () => {
  it('FIXED_NOW constant is set to 2026-07-04T00:00:00.000Z', () => {
    assert.equal(FIXED_NOW, '2026-07-04T00:00:00.000Z');
  });
});
