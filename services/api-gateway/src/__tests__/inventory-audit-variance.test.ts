// ============================================================
// Unit tests for the inventory audit variance engine
// Run: npx tsx --test services/api-gateway/src/__tests__/inventory-audit-variance.test.ts
// ============================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    computeVariance,
    reconcileSessionLines,
    summarizeSession,
    type AuditLine,
} from '../lib/inventory-audit-variance';

// ── computeVariance ───────────────────────────────────────────────────────────

test('computeVariance — exact match returns variance 0 and direction match', () => {
    const r = computeVariance(10, 10);
    assert.equal(r.variance, 0);
    assert.equal(r.direction, 'match');
});

test('computeVariance — over: counted > system', () => {
    const r = computeVariance(10, 15);
    assert.equal(r.variance, 5);
    assert.equal(r.direction, 'over');
});

test('computeVariance — short: counted < system', () => {
    const r = computeVariance(20, 12);
    assert.equal(r.variance, -8);
    assert.equal(r.direction, 'short');
});

test('computeVariance — zero system, counted > 0 is over', () => {
    const r = computeVariance(0, 5);
    assert.equal(r.variance, 5);
    assert.equal(r.direction, 'over');
});

test('computeVariance — both zero is match', () => {
    const r = computeVariance(0, 0);
    assert.equal(r.variance, 0);
    assert.equal(r.direction, 'match');
});

test('computeVariance — null system treated as 0', () => {
    const r = computeVariance(null, 3);
    assert.equal(r.variance, 3);
    assert.equal(r.direction, 'over');
});

test('computeVariance — null counted treated as 0', () => {
    const r = computeVariance(10, null);
    assert.equal(r.variance, -10);
    assert.equal(r.direction, 'short');
});

test('computeVariance — undefined quantities treated as 0', () => {
    const r = computeVariance(undefined, undefined);
    assert.equal(r.variance, 0);
    assert.equal(r.direction, 'match');
});

test('computeVariance — negative counted (recording error) is short', () => {
    const r = computeVariance(5, -1);
    assert.equal(r.variance, -6);
    assert.equal(r.direction, 'short');
});

test('computeVariance — large quantities', () => {
    const r = computeVariance(100000, 100003);
    assert.equal(r.variance, 3);
    assert.equal(r.direction, 'over');
});

// ── reconcileSessionLines ─────────────────────────────────────────────────────

test('reconcileSessionLines — zero-variance line is skipped', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 10, counted_qty: 10 },
    ];
    const deltas = reconcileSessionLines(lines);
    assert.equal(deltas.length, 0);
});

test('reconcileSessionLines — over-variance line included', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 5, counted_qty: 8 },
    ];
    const deltas = reconcileSessionLines(lines);
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0].product_id, 'p1');
    assert.equal(deltas[0].delta, 3);
    assert.equal(deltas[0].reason, 'recount');
});

test('reconcileSessionLines — short-variance line has negative delta', () => {
    const lines: AuditLine[] = [
        { product_id: 'p2', system_qty: 20, counted_qty: 14 },
    ];
    const deltas = reconcileSessionLines(lines);
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0].delta, -6);
    assert.equal(deltas[0].reason, 'recount');
});

test('reconcileSessionLines — mixed lines: zero skipped, non-zero included', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 10, counted_qty: 10 }, // match — skip
        { product_id: 'p2', system_qty: 5,  counted_qty: 8 },  // over +3
        { product_id: 'p3', system_qty: 20, counted_qty: 15 }, // short -5
    ];
    const deltas = reconcileSessionLines(lines);
    assert.equal(deltas.length, 2);
    assert.equal(deltas[0].product_id, 'p2');
    assert.equal(deltas[0].delta, 3);
    assert.equal(deltas[1].product_id, 'p3');
    assert.equal(deltas[1].delta, -5);
});

test('reconcileSessionLines — variant_id and location_id preserved', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', variant_id: 'v1', location_id: 'loc-a', system_qty: 3, counted_qty: 6 },
    ];
    const deltas = reconcileSessionLines(lines);
    assert.equal(deltas[0].variant_id, 'v1');
    assert.equal(deltas[0].location_id, 'loc-a');
});

test('reconcileSessionLines — missing variant_id defaults to null', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 1, counted_qty: 4 },
    ];
    const deltas = reconcileSessionLines(lines);
    assert.equal(deltas[0].variant_id, null);
    assert.equal(deltas[0].location_id, null);
});

test('reconcileSessionLines — empty array returns empty', () => {
    assert.deepEqual(reconcileSessionLines([]), []);
});

test('reconcileSessionLines — null input returns empty', () => {
    assert.deepEqual(reconcileSessionLines(null as unknown as AuditLine[]), []);
});

test('reconcileSessionLines — all lines match returns no deltas', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 10, counted_qty: 10 },
        { product_id: 'p2', system_qty: 0,  counted_qty: 0 },
    ];
    assert.deepEqual(reconcileSessionLines(lines), []);
});

// ── summarizeSession ──────────────────────────────────────────────────────────

test('summarizeSession — empty array returns zero summary', () => {
    const s = summarizeSession([]);
    assert.deepEqual(s, { total_lines: 0, matched: 0, over: 0, short: 0, net_variance: 0 });
});

test('summarizeSession — null input returns zero summary', () => {
    const s = summarizeSession(null as unknown as AuditLine[]);
    assert.deepEqual(s, { total_lines: 0, matched: 0, over: 0, short: 0, net_variance: 0 });
});

test('summarizeSession — all matched', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 5, counted_qty: 5 },
        { product_id: 'p2', system_qty: 0, counted_qty: 0 },
    ];
    const s = summarizeSession(lines);
    assert.equal(s.total_lines, 2);
    assert.equal(s.matched, 2);
    assert.equal(s.over, 0);
    assert.equal(s.short, 0);
    assert.equal(s.net_variance, 0);
});

test('summarizeSession — mixed over/short/match', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 10, counted_qty: 10 }, // match
        { product_id: 'p2', system_qty: 5,  counted_qty: 8 },  // over +3
        { product_id: 'p3', system_qty: 20, counted_qty: 15 }, // short -5
        { product_id: 'p4', system_qty: 0,  counted_qty: 2 },  // over +2
    ];
    const s = summarizeSession(lines);
    assert.equal(s.total_lines, 4);
    assert.equal(s.matched, 1);
    assert.equal(s.over, 2);
    assert.equal(s.short, 1);
    assert.equal(s.net_variance, 0); // +3 + (-5) + 2 = 0
});

test('summarizeSession — net_variance sums algebraically (can be negative)', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 100, counted_qty: 90 }, // short -10
        { product_id: 'p2', system_qty: 50,  counted_qty: 52 }, // over +2
    ];
    const s = summarizeSession(lines);
    assert.equal(s.net_variance, -8);
    assert.equal(s.short, 1);
    assert.equal(s.over, 1);
});

test('summarizeSession — single over line', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 0, counted_qty: 7 },
    ];
    const s = summarizeSession(lines);
    assert.equal(s.total_lines, 1);
    assert.equal(s.over, 1);
    assert.equal(s.net_variance, 7);
});

test('summarizeSession — single short line', () => {
    const lines: AuditLine[] = [
        { product_id: 'p1', system_qty: 10, counted_qty: 3 },
    ];
    const s = summarizeSession(lines);
    assert.equal(s.total_lines, 1);
    assert.equal(s.short, 1);
    assert.equal(s.net_variance, -7);
});
