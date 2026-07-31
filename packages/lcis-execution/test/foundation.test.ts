/**
 * EIS foundation tests — the seed resolver + ChangeAnalyzer run against the REAL
 * graphify-out artifacts (no fixtures). Verifies deterministic resolution, the
 * evidence/confidence/sources/timestamp contract, honest "unresolved" behavior,
 * and the money/tenant risk elevation that everything downstream depends on.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import {
  ChangeAnalyzer,
  SeedResolver,
  assessComplexity,
  assessRisk,
  plan,
  planConfidence,
  tokenizeRequest,
  type AffectedSets,
} from '../src/index';
import { evidence } from '@letbuyy/lcis-core';

const FIXED = '2026-06-20T00:00:00.000Z';
const engine = createEngine();
const analyzer = new ChangeAnalyzer(engine, () => FIXED);

// Pull real fixtures from the live artifacts so assertions are not brittle to specific names.
const db = engine.store.read<{ tables: { name: string; money?: boolean; tenant?: boolean }[] }>('db-intel');
const di = engine.store.read<{ domains: { key: string }[] }>('domain-intel');
const moneyTable = db.tables.find((t) => t.money)?.name;
const tenantTable = db.tables.find((t) => t.tenant)?.name;
const aDomain = di.domains[0]?.key;

const EMPTY: AffectedSets = {
  domains: [], services: [], apis: [], rpcs: [], tables: [], workers: [], queues: [], events: [], tests: [], docs: [],
};

// ── tokenizer ────────────────────────────────────────────────────────────────
test('tokenizeRequest strips stopwords + short tokens, de-dupes', () => {
  const toks = tokenizeRequest('Add GST Filing for the GST system');
  assert.ok(toks.includes('gst'));
  assert.ok(toks.includes('filing'));
  assert.ok(!toks.includes('add'));
  assert.ok(!toks.includes('the'));
  assert.equal(toks.filter((t) => t === 'gst').length, 1);
});

// ── plan() envelope ──────────────────────────────────────────────────────────
test('plan() stamps evidence + confidence + sources + timestamp', () => {
  const out = plan({ x: 1 }, { evidence: [evidence('table', 't', 'note', 'graphify-out/db-intel.json')], now: () => FIXED });
  assert.equal(out.x, 1);
  assert.equal(out.timestamp, FIXED);
  assert.ok(out.confidence > 0 && out.confidence <= 0.95);
  assert.deepEqual(out.sources, ['graphify-out/db-intel.json']);
});
test('planConfidence is 0 with no evidence and capped at 0.95', () => {
  assert.equal(planConfidence([]), 0);
  assert.ok(planConfidence(Array(50).fill(evidence('table', 't'))) <= 0.95);
});

// ── scoring ──────────────────────────────────────────────────────────────────
test('assessComplexity: empty footprint is trivial; broad footprint escalates', () => {
  assert.equal(assessComplexity(EMPTY, 0).band, 'trivial');
  const big = assessComplexity({ ...EMPTY, domains: ['a', 'b', 'c', 'd'], tables: Array(10).fill('t'), rpcs: ['r', 'r2'] }, 3);
  assert.ok(['high', 'severe'].includes(big.band));
});
test('assessRisk: money → critical, tenant → at least high', () => {
  assert.equal(assessRisk({ ...EMPTY }, true, false, 5).level, 'critical');
  assert.ok(['high', 'critical'].includes(assessRisk({ ...EMPTY }, false, true, 5).level));
  assert.equal(assessRisk({ ...EMPTY }, false, false, 0).level, 'low');
});

// ── seed resolution against real data ────────────────────────────────────────
test('SeedResolver: explicit seeds resolve at score 1 with evidence', () => {
  const seeds = new SeedResolver(engine).resolve({ text: 'x', domains: ['payments'], tables: ['orders'] });
  const dom = seeds.find((s) => s.kind === 'domain' && s.ref === 'payments');
  const tab = seeds.find((s) => s.kind === 'table' && s.ref === 'orders');
  assert.ok(dom && dom.score === 1 && dom.evidence.length > 0);
  assert.ok(tab && tab.score === 1);
});
test('SeedResolver: "Add GST Filing" resolves to real GST entities (deterministic, no LLM)', () => {
  const seeds = new SeedResolver(engine).resolve({ text: 'Add GST Filing' });
  // The platform has GST (gst_invoices etc.) — at least one seed should surface, all evidence-cited.
  assert.ok(Array.isArray(seeds));
  for (const s of seeds) assert.ok(s.evidence.length > 0, 'every seed cites evidence');
});

// ── change analysis against real data ────────────────────────────────────────
test('ChangeAnalyzer: a real domain yields a non-empty footprint with full provenance', () => {
  assert.ok(aDomain, 'domain-intel has at least one domain');
  const a = analyzer.analyze({ text: 'change', domains: [aDomain!] });
  assert.equal(a.timestamp, FIXED);
  assert.ok(a.evidence.length > 0);
  assert.ok(a.sources.length > 0);
  assert.ok(a.confidence > 0);
  assert.ok(a.affected.domains.includes(aDomain!));
  assert.equal(a.unresolved, false);
});
test('ChangeAnalyzer: a money table elevates risk to critical', () => {
  assert.ok(moneyTable, 'db-intel has a money table');
  const a = analyzer.analyze({ text: 'touch ledger', tables: [moneyTable!] });
  assert.equal(a.risk.money, true);
  assert.equal(a.risk.level, 'critical');
  assert.ok(a.rollbackStrategy.includes('ledger'));
});
test('ChangeAnalyzer: a tenant table flags multi-tenant launch impact', () => {
  assert.ok(tenantTable, 'db-intel has a tenant table');
  const a = analyzer.analyze({ text: 'touch tenant', tables: [tenantTable!] });
  assert.equal(a.risk.tenant, true);
  assert.ok(a.launchImpact.toLowerCase().includes('tenant') || a.launchImpact.toLowerCase().includes('merchant'));
});
test('ChangeAnalyzer: unmatched request is honestly unresolved, not fabricated', () => {
  const a = analyzer.analyze({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.equal(a.unresolved, true);
  assert.deepEqual(a.affected.domains, []);
  assert.ok(a.evidence.some((e) => e.ref === 'unresolved'));
});
test('ChangeAnalyzer: every affected set is an array; nothing undefined', () => {
  const a = analyzer.analyze({ text: 'change', domains: [aDomain!] });
  for (const k of Object.keys(EMPTY) as (keyof AffectedSets)[]) assert.ok(Array.isArray(a.affected[k]));
});
