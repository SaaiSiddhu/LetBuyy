/**
 * LBIS foundation tests — the business() envelope, the BI rule registry, and the compose
 * helpers that enforce the no-fabrication law (notConnectedMetric always value:null).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { evidence, notConnected } from '@letbuyy/lcis-core';
import {
  BUSINESS_RULES,
  BusinessRuleRegistry,
  business,
  confidenceFrom,
} from '../src/shared/index';
import { mapFinding, notConnectedMetric, safeFindings, structuralFinding } from '../src/shared/compose';

const FIXED = '2026-07-04T00:00:00.000Z';
const now = () => FIXED;

// ── business() envelope ────────────────────────────────────────────────────────

test('business() stamps evidence/sources/timestamp/liveConnected', () => {
  const ev = [evidence('artifact-field', 'x', 'y', 'src-a')];
  const out = business({ foo: 1 }, { evidence: ev, now });
  assert.equal(out.timestamp, FIXED);
  assert.equal(out.liveConnected, false);
  assert.deepEqual(out.sources, ['src-a']);
  assert.equal(out.evidence.length, 1);
});

test('business() confidence: 0 when empty', () => {
  assert.equal(business({}, { evidence: [], now }).confidence, 0);
});

test('business() confidence: 0 when all evidence is not-connected', () => {
  const out = business({}, { evidence: [notConnected('a', 'src'), notConnected('b', 'src')], now });
  assert.equal(out.confidence, 0);
});

test('business() confidence: capped at 0.9', () => {
  const many = Array.from({ length: 10 }, (_, i) => evidence('artifact-field', `r${i}`, 'd', 's'));
  assert.equal(business({}, { evidence: many, now }).confidence, 0.9);
});

test('business() liveConnected can be overridden', () => {
  assert.equal(business({}, { evidence: [], liveConnected: true, now }).liveConnected, true);
});

test('business() dedupes sources from evidence', () => {
  const ev = [evidence('artifact-field', 'a', 'd', 'same'), evidence('artifact-field', 'b', 'd', 'same')];
  assert.deepEqual(business({}, { evidence: ev, now }).sources, ['same']);
});

test('confidenceFrom exact values', () => {
  assert.equal(confidenceFrom([]), 0);
  assert.equal(confidenceFrom([evidence('artifact-field', 'a', 'd', 's')]), 0.6);
  assert.equal(confidenceFrom([evidence('artifact-field', 'a', 'd', 's'), evidence('artifact-field', 'b', 'd', 's')]), 0.7);
});

// ── BI rules ────────────────────────────────────────────────────────────────────

test('BUSINESS_RULES has BI01..BI08 with unique ids', () => {
  const ids = BUSINESS_RULES.map((r) => r.id);
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  for (let i = 1; i <= 8; i++) assert.ok(ids.includes(`BI0${i}`));
});

test('every BI rule has a valid severity', () => {
  const valid = new Set(['critical', 'high', 'medium', 'low', 'info']);
  for (const r of BUSINESS_RULES) assert.ok(valid.has(r.severity), `${r.id}: ${r.severity}`);
});

test('BusinessRuleRegistry get/list', () => {
  const reg = new BusinessRuleRegistry();
  assert.equal(reg.list().length, 8);
  assert.equal(reg.get('BI05')?.id, 'BI05');
  assert.equal(reg.get('NOPE'), undefined);
});

// ── compose helpers — the no-fabrication law ───────────────────────────────────

test('notConnectedMetric always yields value:null / NOT_CONNECTED', () => {
  const m = notConnectedMetric('k', 'Label', 'unit', 'src', ['a', 'b']);
  assert.equal(m.value, null);
  assert.equal(m.connection, 'NOT_CONNECTED');
  assert.equal(m.liveSource, 'src');
  assert.deepEqual(m.backedBy, ['a', 'b']);
  assert.ok(m.evidence.length >= 1);
  assert.equal(m.evidence[0]!.kind, 'not-connected');
});

test('notConnectedMetric adds a backing evidence item per backedBy entry', () => {
  const m = notConnectedMetric('k', 'L', 'u', 'src', ['x', 'y', 'z']);
  // 1 notConnected + 3 backing = 4
  assert.equal(m.evidence.length, 4);
});

test('mapFinding preserves CONNECTED status', () => {
  const f = mapFinding('merchant', { id: 'F1', severity: 'high', subject: 's', title: 't', detail: 'd', status: 'CONNECTED', evidence: [] });
  assert.equal(f.connection, 'CONNECTED');
  assert.equal(f.area, 'merchant');
  assert.equal(f.id, 'merchant-F1');
});

test('mapFinding maps any non-CONNECTED status to NOT_CONNECTED', () => {
  for (const status of ['NOT_CONNECTED', 'PARTIAL', 'UNKNOWN', 'NOT_DETECTABLE']) {
    const f = mapFinding('a', { id: 'F', severity: 'low', subject: 's', title: 't', detail: 'd', status, evidence: [] });
    assert.equal(f.connection, 'NOT_CONNECTED', `status ${status}`);
  }
});

test('structuralFinding namespaces the id by area', () => {
  const f = structuralFinding('coupon', 'present', 'info', 's', 't', 'd', 'CONNECTED', []);
  assert.equal(f.id, 'coupon-present');
  assert.equal(f.connection, 'CONNECTED');
});

test('safeFindings returns [] on throw', () => {
  assert.deepEqual(safeFindings(() => { throw new Error('boom'); }), []);
  assert.deepEqual(safeFindings(() => [{ id: 'a', severity: 'low', subject: 's', title: 't', detail: 'd', status: 'CONNECTED', evidence: [] }]).length, 1);
});
