/**
 * LDSS foundation tests — the decision() envelope, composite scoring, axis weights, and the
 * frozen strategy tables (deterministic calibration).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { evidence, notConnected } from '@letbuyy/lcis-core';
import { AXES, AXIS_WEIGHTS, STRATEGY_TABLE, composite, confidenceFrom, decision } from '../src/shared/index';
import type { DecisionKind, TradeoffAxis } from '../src/shared/index';

const FIXED = '2026-07-04T00:00:00.000Z';
const now = () => FIXED;

test('decision() stamps provenance with the injected clock', () => {
  const out = decision({ x: 1 }, { evidence: [evidence('artifact-field', 'a', 'd', 's')], now });
  assert.equal(out.timestamp, FIXED);
  assert.equal(out.liveConnected, false);
  assert.deepEqual(out.sources, ['s']);
});

test('confidenceFrom: 0 empty, 0 all-not-connected, cap 0.9', () => {
  assert.equal(confidenceFrom([]), 0);
  assert.equal(confidenceFrom([notConnected('a', 's')]), 0);
  const many = Array.from({ length: 9 }, (_, i) => evidence('artifact-field', `r${i}`, 'd', 's'));
  assert.equal(confidenceFrom(many), 0.9);
});

test('AXIS_WEIGHTS sum to 1', () => {
  const sum = AXES.reduce((s, a) => s + AXIS_WEIGHTS[a], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum ${sum}`);
});

test('composite is the weighted sum, rounded to 3 dp', () => {
  const scores: Record<TradeoffAxis, number> = { risk: 1, cost: 1, readiness: 1, 'blast-radius': 1 };
  assert.equal(composite(scores), 1);
  const zero: Record<TradeoffAxis, number> = { risk: 0, cost: 0, readiness: 0, 'blast-radius': 0 };
  assert.equal(composite(zero), 0);
  // Known mix: risk .8*.35 + cost .5*.2 + readiness .75*.3 + blast .8*.15 = .28+.1+.225+.12 = .725
  assert.equal(composite({ risk: 0.8, cost: 0.5, readiness: 0.75, 'blast-radius': 0.8 }), 0.725);
});

test('STRATEGY_TABLE covers all six decision kinds with >= 3 strategies each', () => {
  const kinds: DecisionKind[] = ['deploy', 'migration', 'rollback', 'scaling', 'business', 'architecture'];
  for (const k of kinds) {
    assert.ok(STRATEGY_TABLE[k].length >= 3, `${k} has ${STRATEGY_TABLE[k].length}`);
  }
});

test('every strategy has all four axis scores in [0,1] and a unique id per kind', () => {
  for (const k of Object.keys(STRATEGY_TABLE) as DecisionKind[]) {
    const ids = new Set<string>();
    for (const s of STRATEGY_TABLE[k]) {
      ids.add(s.id);
      for (const axis of AXES) {
        const v = s.scores[axis];
        assert.ok(v >= 0 && v <= 1, `${k}.${s.id}.${axis}=${v}`);
      }
    }
    assert.equal(ids.size, STRATEGY_TABLE[k].length, `${k} has duplicate strategy ids`);
  }
});
