/**
 * FeatureIntelligenceService tests — EINS Phase 7.
 *
 * Runs against the REAL graphify-out artifacts (no fixtures, no mocks). Verifies:
 *   - Engine construction + fixed clock
 *   - Real domain feature → non-empty affected sets matching eis.analyze
 *   - Money/tenant flags propagate into risk
 *   - Reuse-evidence (lcis-execution:eis.analyze) present in every output
 *   - Unresolved gibberish → unresolved=true + empty sets (honest, not fabricated)
 *   - Provenance: evidence / confidence / sources / timestamp on every output
 *   - Determinism: same request + fixed now → deep-equal output
 *   - Read-only source scan: no forbidden IO patterns in src/feature/
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '@letbuyy/lcis-core';
import { createEisEngine } from '@letbuyy/lcis-execution';
import { FeatureIntelligenceService } from '../src/feature/index';
import type { EngineeringImpact, FeatureRequest } from '../src/shared/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Fixed clock + engine ──────────────────────────────────────────────────────

const FIXED = '2026-06-21T00:00:00.000Z';
const core = createEngine();

/** Pull real domain/table names from the artifacts (not brittle to specific names). */
const di = core.store.read<{ domains: { key: string }[] }>('domain-intel');
const db = core.store.read<{ tables: { name: string; money?: boolean; tenant?: boolean }[] }>('db-intel');
const aDomain = di.domains[0]?.key;
const bDomain = di.domains[1]?.key;
const moneyTable = db.tables.find((t) => t.money)?.name;
const tenantTable = db.tables.find((t) => t.tenant)?.name;

const svc = new FeatureIntelligenceService(core, () => FIXED);

// ── Helper ────────────────────────────────────────────────────────────────────

function hasProvenance(x: EngineeringImpact): boolean {
  return (
    Array.isArray(x.evidence) &&
    typeof x.confidence === 'number' &&
    Array.isArray(x.sources) &&
    typeof x.timestamp === 'string'
  );
}

function hasReuseEvidence(impact: EngineeringImpact): boolean {
  return impact.evidence.some(
    (e) => e.ref === 'lcis-execution:eis.analyze' && e.source === 'packages/lcis-execution',
  );
}

// ── Source scan: no forbidden IO in src/feature ───────────────────────────────

test('source scan: no fetch/child_process/spawn/exec/eval/writeFile in src/feature', () => {
  const srcDir = join(__dirname, '../src/feature');
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 0, 'src/feature must have .ts files');
  const FORBIDDEN = ['fetch(', 'child_process', 'spawn(', 'exec(', 'eval(', 'writeFile', 'appendFile'];
  for (const file of files) {
    const raw = readFileSync(join(srcDir, file), 'utf8');
    // Strip comments before scanning (single-line and block comments).
    const content = raw
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const pat of FORBIDDEN) {
      assert.ok(!content.includes(pat), `Forbidden pattern "${pat}" found in src/feature/${file}`);
    }
  }
});

// ── Engine construction + fixed clock ────────────────────────────────────────

test('FeatureIntelligenceService constructs with createEngine() + fixed now', () => {
  const s = new FeatureIntelligenceService(core, () => FIXED);
  assert.ok(s instanceof FeatureIntelligenceService);
});

test('analyzeFeature: timestamp honours the injected fixed clock', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.equal(impact.timestamp, FIXED);
});

// ── Provenance ────────────────────────────────────────────────────────────────

test('analyzeFeature: every output carries evidence/confidence/sources/timestamp', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(hasProvenance(impact), 'must carry full provenance');
});

test('analyzeFeature: confidence is within [0, 0.9]', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(impact.confidence >= 0 && impact.confidence <= 0.9, `confidence ${impact.confidence} out of range`);
});

test('analyzeFeature: evidence array is non-empty for a resolvable request', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(impact.evidence.length > 0, 'evidence must be non-empty for a resolved request');
});

test('analyzeFeature: sources array is non-empty for a resolvable request', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(impact.sources.length > 0, 'sources must be non-empty');
});

// ── Reuse evidence ────────────────────────────────────────────────────────────

test('analyzeFeature: reuse-evidence (lcis-execution:eis.analyze) present for a resolved request', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(hasReuseEvidence(impact), 'must cite lcis-execution:eis.analyze as reuse evidence');
});

test('analyzeFeature: reuse-evidence present even for unresolved requests', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.ok(hasReuseEvidence(impact), 'reuse citation must be present even when unresolved');
});

// ── Real domain feature → non-empty affected sets matching eis.analyze ─────────

test('analyzeFeature: real domain feature → non-empty affected sets', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(impact.domains.length >= 1, 'domains must be non-empty');
  assert.equal(impact.unresolved, false);
});

test('analyzeFeature: affected domains match eis.analyze affected domains', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.domains, [...analysis.affected.domains]);
});

test('analyzeFeature: affected tables match eis.analyze affected tables', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.tables, [...analysis.affected.tables]);
});

test('analyzeFeature: affected rpcs match eis.analyze affected rpcs', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.rpcs, [...analysis.affected.rpcs]);
});

test('analyzeFeature: affected services match eis.analyze affected services', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.services, [...analysis.affected.services]);
});

test('analyzeFeature: affected workers match eis.analyze affected workers', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.workers, [...analysis.affected.workers]);
});

test('analyzeFeature: affected queues match eis.analyze affected queues', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.queues, [...analysis.affected.queues]);
});

test('analyzeFeature: affected events match eis.analyze affected events', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.events, [...analysis.affected.events]);
});

test('analyzeFeature: affected tests match eis.analyze affected tests', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.tests, [...analysis.affected.tests]);
});

test('analyzeFeature: affected docs match eis.analyze affected docs', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.docs, [...analysis.affected.docs]);
});

test('analyzeFeature: apis match eis.analyze affected apis', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.apis, [...analysis.affected.apis]);
});

// ── Complexity propagation ─────────────────────────────────────────────────────

test('analyzeFeature: complexity band + score match eis.analyze', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.equal(impact.complexity.band, analysis.complexity.band);
  assert.equal(impact.complexity.score, analysis.complexity.score);
});

// ── Money / tenant flags ──────────────────────────────────────────────────────

test('analyzeFeature: money table → risk.money=true', () => {
  assert.ok(moneyTable, 'need a real money table');
  const impact = svc.analyzeFeature({ text: 'touch ledger', tables: [moneyTable!] });
  assert.equal(impact.risk.money, true);
});

test('analyzeFeature: money table → risk.level=critical', () => {
  assert.ok(moneyTable, 'need a real money table');
  const impact = svc.analyzeFeature({ text: 'touch ledger', tables: [moneyTable!] });
  assert.equal(impact.risk.level, 'critical');
});

test('analyzeFeature: tenant table → risk.tenant=true', () => {
  assert.ok(tenantTable, 'need a real tenant table');
  const impact = svc.analyzeFeature({ text: 'touch tenant table', tables: [tenantTable!] });
  assert.equal(impact.risk.tenant, true);
});

test('analyzeFeature: risk.drivers is a string array', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(Array.isArray(impact.risk.drivers));
  for (const d of impact.risk.drivers) assert.equal(typeof d, 'string');
});

test('analyzeFeature: money risk propagates matching eis.analyze', () => {
  assert.ok(moneyTable, 'need a real money table');
  const req: FeatureRequest = { text: 'touch ledger', tables: [moneyTable!] };
  const eis = createEisEngine({ core, now: () => FIXED });
  const analysis = eis.analyze(req);
  const impact = svc.analyzeFeature(req);
  assert.equal(impact.risk.money, analysis.risk.money);
  assert.equal(impact.risk.tenant, analysis.risk.tenant);
});

// ── Unresolved: honest, not fabricated ────────────────────────────────────────

test('unresolved gibberish → unresolved=true', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.equal(impact.unresolved, true);
});

test('unresolved → domains is empty array', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(impact.domains, []);
});

test('unresolved → tables is empty array', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(impact.tables, []);
});

test('unresolved → rpcs is empty array', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(impact.rpcs, []);
});

test('unresolved → services is empty array', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(impact.services, []);
});

test('unresolved → workers is empty array', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(impact.workers, []);
});

test('unresolved → queues is empty array', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(impact.queues, []);
});

test('unresolved → events is empty array', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(impact.events, []);
});

test('unresolved → apis is empty array', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(impact.apis, []);
});

test('unresolved → still carries full provenance (no empty/null timestamp)', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.ok(hasProvenance(impact), 'unresolved impact must still carry provenance');
  assert.equal(impact.timestamp, FIXED);
});

test('unresolved → confidence is a valid number', () => {
  const impact = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.ok(typeof impact.confidence === 'number' && impact.confidence >= 0);
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('determinism: same request + fixed now → deep-equal EngineeringImpact', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const a = svc.analyzeFeature(req);
  const b = svc.analyzeFeature(req);
  assert.deepEqual(a, b);
});

test('determinism: unresolved request is also deterministic', () => {
  const a = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  const b = svc.analyzeFeature({ text: 'zzqqx wibble frobnicate xyzzy' });
  assert.deepEqual(a, b);
});

test('determinism: two-domain request is deterministic', () => {
  assert.ok(aDomain && bDomain, 'need two real domains');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!, bDomain!] };
  const a = svc.analyzeFeature(req);
  const b = svc.analyzeFeature(req);
  assert.deepEqual(a, b);
});

// ── request is echoed back ────────────────────────────────────────────────────

test('analyzeFeature: request field echoes the original FeatureRequest', () => {
  assert.ok(aDomain, 'need a real domain');
  const req: FeatureRequest = { text: 'change', domains: [aDomain!] };
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.request, req);
});

test('analyzeFeature: unresolved request field echoes the original FeatureRequest', () => {
  const req: FeatureRequest = { text: 'zzqqx wibble frobnicate xyzzy' };
  const impact = svc.analyzeFeature(req);
  assert.deepEqual(impact.request, req);
});

// ── EngineeringImpact shape invariants ───────────────────────────────────────

test('analyzeFeature: risk object has level/money/tenant/drivers', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(typeof impact.risk.level === 'string');
  assert.ok(typeof impact.risk.money === 'boolean');
  assert.ok(typeof impact.risk.tenant === 'boolean');
  assert.ok(Array.isArray(impact.risk.drivers));
});

test('analyzeFeature: complexity object has band + score', () => {
  assert.ok(aDomain, 'need a real domain');
  const impact = svc.analyzeFeature({ text: 'change', domains: [aDomain!] });
  assert.ok(typeof impact.complexity.band === 'string');
  assert.ok(typeof impact.complexity.score === 'number');
});
