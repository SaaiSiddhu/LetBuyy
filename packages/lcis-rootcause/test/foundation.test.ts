/**
 * LRAS Phase 12 — foundation tests.
 *
 * Covers:
 *  (A) rootcause() envelope — evidence passthrough, confidenceFrom exact values,
 *      sources deduplication, timestamp === injected clock, liveConnected default.
 *  (B) SYMPTOM_TAXONOMY invariants — 6 non-unknown kinds covered, each entry has >=1 term,
 *      terms are lowercase, domains non-empty for commerce kinds, anchors follow '<layer>:<name>'.
 *  (C) ROOT_CAUSE_RULES invariants — RC01..RC08 unique ids, baseConfidence in (0,1),
 *      every category is a valid CauseCategory, registry get/list.
 *  (D) Type-shape smoke tests — constructing valid Symptom / CauseHypothesis / Diagnosis literals.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { rootcause, confidenceFrom, defaultNow } from '../src/shared/envelope';
import { SYMPTOM_TAXONOMY } from '../src/shared/taxonomy';
import { ROOT_CAUSE_RULES, RootCauseRuleRegistry } from '../src/shared/rules';
import type {
  Symptom,
  SymptomKind,
  CauseHypothesis,
  CauseCategory,
  Diagnosis,
  AffectedSummary,
  RecentChangeSummary,
  HypothesisInput,
  RootCauseArtifact,
  DiagnosisVerdict,
  Connection,
} from '../src/shared/types';
import type { Evidence } from '@letbuyy/lcis-core';

// ── Fixed test clock (deterministic) ──────────────────────────────────────────

const FIXED_TS = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED_TS;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ev(kind: Evidence['kind'], ref: string, source?: string): Evidence {
  return source !== undefined
    ? { kind, ref, source }
    : { kind, ref };
}

function notConnectedEv(ref: string): Evidence {
  return { kind: 'not-connected', ref };
}

// ── (A) confidenceFrom ────────────────────────────────────────────────────────

test('confidenceFrom: empty evidence array returns 0', () => {
  assert.equal(confidenceFrom([]), 0);
});

test('confidenceFrom: all not-connected evidence returns 0', () => {
  const evs: Evidence[] = [notConnectedEv('RAZORPAY_KEY'), notConnectedEv('SUPABASE_URL')];
  assert.equal(confidenceFrom(evs), 0);
});

test('confidenceFrom: one connected evidence returns 0.6 (0.5 + 0.1 * 1)', () => {
  assert.equal(confidenceFrom([ev('file', 'src/shared/rules.ts')]), 0.6);
});

test('confidenceFrom: two connected evidence items returns 0.7', () => {
  assert.equal(confidenceFrom([ev('file', 'a.ts'), ev('graph-node', 'domain:payments')]), 0.7);
});

test('confidenceFrom: three connected evidence items returns 0.8', () => {
  const evs = [
    ev('file', 'a.ts'),
    ev('graph-node', 'n1'),
    ev('rpc', 'create_checkout_order'),
  ];
  assert.equal(confidenceFrom(evs), 0.8);
});

test('confidenceFrom: four connected evidence items returns 0.9 (cap)', () => {
  const evs = [
    ev('file', 'a.ts'),
    ev('graph-node', 'n1'),
    ev('rpc', 'r1'),
    ev('table', 't1'),
  ];
  assert.equal(confidenceFrom(evs), 0.9);
});

test('confidenceFrom: five connected evidence items still caps at 0.9', () => {
  const evs = [
    ev('file', 'a.ts'),
    ev('graph-node', 'n1'),
    ev('rpc', 'r1'),
    ev('table', 't1'),
    ev('policy', 'p1'),
  ];
  assert.equal(confidenceFrom(evs), 0.9);
});

test('confidenceFrom: mixed connected and not-connected counts only connected (1 connected => 0.6)', () => {
  const evs: Evidence[] = [
    ev('file', 'a.ts'),
    notConnectedEv('RAZORPAY_KEY'),
    notConnectedEv('DB_URL'),
    notConnectedEv('WEBHOOK_SECRET'),
  ];
  assert.equal(confidenceFrom(evs), 0.6);
});

// ── (A) rootcause() envelope ──────────────────────────────────────────────────

test('rootcause: timestamp equals injected clock', () => {
  const result = rootcause({ value: 1 }, { evidence: [], now: fixedNow });
  assert.equal(result.timestamp, FIXED_TS);
});

test('rootcause: evidence is passed through exactly', () => {
  const evs: Evidence[] = [ev('file', 'src/shared/rules.ts', 'graphify-out/graph.json')];
  const result = rootcause({ x: 'y' }, { evidence: evs, now: fixedNow });
  assert.deepEqual(result.evidence, evs);
});

test('rootcause: liveConnected defaults to false when not supplied', () => {
  const result = rootcause({ x: 1 }, { evidence: [], now: fixedNow });
  assert.equal(result.liveConnected, false);
});

test('rootcause: liveConnected can be set to true', () => {
  const result = rootcause({ x: 1 }, { evidence: [], liveConnected: true, now: fixedNow });
  assert.equal(result.liveConnected, true);
});

test('rootcause: confidence is auto-computed from evidence when not supplied', () => {
  const evs = [ev('file', 'a.ts'), ev('graph-node', 'domain:orders')];
  const result = rootcause({}, { evidence: evs, now: fixedNow });
  assert.equal(result.confidence, 0.7);
});

test('rootcause: explicit confidence overrides the computed value', () => {
  const result = rootcause({}, { evidence: [ev('file', 'f.ts')], confidence: 0.55, now: fixedNow });
  assert.equal(result.confidence, 0.55);
});

test('rootcause: sources are auto-derived (deduped) from evidence.source fields', () => {
  const evs: Evidence[] = [
    { kind: 'file', ref: 'a.ts', source: 'graphify-out/graph.json' },
    { kind: 'graph-node', ref: 'n1', source: 'graphify-out/graph.json' }, // duplicate
    { kind: 'rpc', ref: 'create_checkout_order', source: 'graphify-out/db-intel.json' },
  ];
  const result = rootcause({}, { evidence: evs, now: fixedNow });
  assert.deepEqual([...result.sources].sort(), [
    'graphify-out/db-intel.json',
    'graphify-out/graph.json',
  ]);
});

test('rootcause: explicit sources override the auto-derived deduplication', () => {
  const evs: Evidence[] = [{ kind: 'file', ref: 'a.ts', source: 'auto-source' }];
  const explicit = ['explicit-source'];
  const result = rootcause({}, { evidence: evs, sources: explicit, now: fixedNow });
  assert.deepEqual([...result.sources], explicit);
});

test('rootcause: evidence with no source fields yields empty sources list', () => {
  const evs: Evidence[] = [{ kind: 'not-connected', ref: 'RAZORPAY_KEY' }];
  const result = rootcause({}, { evidence: evs, now: fixedNow });
  assert.deepEqual([...result.sources], []);
});

test('rootcause: body properties are merged into the result', () => {
  const result = rootcause(
    { alpha: 'hello', beta: 42 },
    { evidence: [], now: fixedNow },
  );
  assert.equal((result as { alpha: string }).alpha, 'hello');
  assert.equal((result as { beta: number }).beta, 42);
});

test('rootcause: RootCauseArtifact shape — result has all five mandatory fields', () => {
  const result: RootCauseArtifact = rootcause({}, { evidence: [], now: fixedNow });
  assert.ok('evidence' in result);
  assert.ok('confidence' in result);
  assert.ok('sources' in result);
  assert.ok('timestamp' in result);
  assert.ok('liveConnected' in result);
});

test('rootcause: sources array has no duplicates when multiple evidence share the same source', () => {
  const evs: Evidence[] = Array.from({ length: 5 }, (_, i) => ({
    kind: 'file' as const,
    ref: `file${i}.ts`,
    source: 'shared-source',
  }));
  const result = rootcause({}, { evidence: evs, now: fixedNow });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0], 'shared-source');
});

test('rootcause: zero-confidence when evidence is empty', () => {
  const result = rootcause({}, { evidence: [], now: fixedNow });
  assert.equal(result.confidence, 0);
});

test('rootcause: zero-confidence when all evidence is not-connected', () => {
  const evs = [notConnectedEv('A'), notConnectedEv('B')];
  const result = rootcause({}, { evidence: evs, now: fixedNow });
  assert.equal(result.confidence, 0);
});

// ── (B) SYMPTOM_TAXONOMY invariants ──────────────────────────────────────────

/** The six non-unknown commerce symptom kinds required by the frozen type contract. */
const REQUIRED_KINDS: Exclude<SymptomKind, 'unknown'>[] = [
  'orders-failing',
  'checkout-broken',
  'queue-backlog',
  'high-latency',
  'deployment-failed',
  'worker-crashed',
];

test('SYMPTOM_TAXONOMY: is a non-empty readonly array', () => {
  assert.ok(Array.isArray(SYMPTOM_TAXONOMY));
  assert.ok(SYMPTOM_TAXONOMY.length > 0);
});

test('SYMPTOM_TAXONOMY: exactly 6 entries (one per non-unknown kind)', () => {
  assert.equal(SYMPTOM_TAXONOMY.length, 6);
});

test('SYMPTOM_TAXONOMY: covers all 6 mandated non-unknown SymptomKind values', () => {
  const kinds = SYMPTOM_TAXONOMY.map((e) => e.kind);
  for (const required of REQUIRED_KINDS) {
    assert.ok(kinds.includes(required), `SYMPTOM_TAXONOMY missing entry for kind '${required}'`);
  }
});

test('SYMPTOM_TAXONOMY: each entry has at least one term', () => {
  for (const entry of SYMPTOM_TAXONOMY) {
    assert.ok(
      entry.terms.length >= 1,
      `taxonomy entry for kind '${entry.kind}' has no terms`,
    );
  }
});

test('SYMPTOM_TAXONOMY: all terms are lowercase strings', () => {
  for (const entry of SYMPTOM_TAXONOMY) {
    for (const term of entry.terms) {
      assert.equal(
        term,
        term.toLowerCase(),
        `term '${term}' in kind '${entry.kind}' is not lowercase`,
      );
    }
  }
});

test('SYMPTOM_TAXONOMY: all terms are non-empty strings', () => {
  for (const entry of SYMPTOM_TAXONOMY) {
    for (const term of entry.terms) {
      assert.ok(term.length > 0, `empty term found in kind '${entry.kind}'`);
    }
  }
});

test('SYMPTOM_TAXONOMY: commerce kinds have non-empty domains arrays', () => {
  // Commerce kinds are those that map to business domains (not pure-infra).
  const commerceKinds: SymptomKind[] = ['orders-failing', 'checkout-broken'];
  for (const entry of SYMPTOM_TAXONOMY) {
    if (commerceKinds.includes(entry.kind)) {
      assert.ok(
        entry.domains.length > 0,
        `commerce kind '${entry.kind}' has empty domains`,
      );
    }
  }
});

test('SYMPTOM_TAXONOMY: all anchors follow the <layer>:<name> format', () => {
  const ANCHOR_RE = /^[a-z][a-z0-9-]*:[a-z][a-z0-9_:-]*$/;
  for (const entry of SYMPTOM_TAXONOMY) {
    for (const anchor of entry.anchors) {
      assert.match(
        anchor,
        ANCHOR_RE,
        `anchor '${anchor}' in kind '${entry.kind}' does not follow '<layer>:<name>' format`,
      );
    }
  }
});

test('SYMPTOM_TAXONOMY: orders-failing entry anchors include domain:orders', () => {
  const entry = SYMPTOM_TAXONOMY.find((e) => e.kind === 'orders-failing');
  assert.ok(entry, 'orders-failing entry missing');
  assert.ok(entry.anchors.includes('domain:orders'), 'orders-failing must anchor domain:orders');
});

test('SYMPTOM_TAXONOMY: checkout-broken entry anchors include domain:payments', () => {
  const entry = SYMPTOM_TAXONOMY.find((e) => e.kind === 'checkout-broken');
  assert.ok(entry, 'checkout-broken entry missing');
  assert.ok(entry.anchors.includes('domain:payments'), 'checkout-broken must anchor domain:payments');
});

test('SYMPTOM_TAXONOMY: worker-crashed entry anchors include worker:queue-worker', () => {
  const entry = SYMPTOM_TAXONOMY.find((e) => e.kind === 'worker-crashed');
  assert.ok(entry, 'worker-crashed entry missing');
  assert.ok(entry.anchors.includes('worker:queue-worker'), 'worker-crashed must anchor worker:queue-worker');
});

test('SYMPTOM_TAXONOMY: queue-backlog entry anchors include queue:order-events', () => {
  const entry = SYMPTOM_TAXONOMY.find((e) => e.kind === 'queue-backlog');
  assert.ok(entry, 'queue-backlog entry missing');
  assert.ok(entry.anchors.includes('queue:order-events'), 'queue-backlog must anchor queue:order-events');
});

test('SYMPTOM_TAXONOMY: kind values are valid SymptomKind (not "unknown")', () => {
  for (const entry of SYMPTOM_TAXONOMY) {
    assert.notEqual(entry.kind, 'unknown', `taxonomy entry kind must not be 'unknown'`);
    assert.ok(
      (REQUIRED_KINDS as string[]).includes(entry.kind),
      `kind '${entry.kind}' is not a valid non-unknown SymptomKind`,
    );
  }
});

test('SYMPTOM_TAXONOMY: no duplicate kinds', () => {
  const kinds = SYMPTOM_TAXONOMY.map((e) => e.kind);
  const unique = new Set(kinds);
  assert.equal(unique.size, kinds.length, 'SYMPTOM_TAXONOMY has duplicate kind entries');
});

test('SYMPTOM_TAXONOMY: all domains are non-empty strings when present', () => {
  for (const entry of SYMPTOM_TAXONOMY) {
    for (const domain of entry.domains) {
      assert.ok(typeof domain === 'string' && domain.length > 0,
        `empty or non-string domain in kind '${entry.kind}'`);
    }
  }
});

// ── (C) ROOT_CAUSE_RULES invariants ──────────────────────────────────────────

const VALID_CATEGORIES: CauseCategory[] = [
  'change', 'dependency', 'infrastructure', 'configuration', 'external', 'unknown',
];

test('ROOT_CAUSE_RULES: is a non-empty readonly array', () => {
  assert.ok(Array.isArray(ROOT_CAUSE_RULES));
  assert.ok(ROOT_CAUSE_RULES.length > 0);
});

test('ROOT_CAUSE_RULES: exactly 8 rules (RC01..RC08)', () => {
  assert.equal(ROOT_CAUSE_RULES.length, 8);
});

test('ROOT_CAUSE_RULES: all rule ids are unique', () => {
  const ids = ROOT_CAUSE_RULES.map((r) => r.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'duplicate rule ids found in ROOT_CAUSE_RULES');
});

test('ROOT_CAUSE_RULES: ids match the RC01..RC08 pattern', () => {
  const RC_RE = /^RC0[1-8]$/;
  for (const rule of ROOT_CAUSE_RULES) {
    assert.match(rule.id, RC_RE, `rule id '${rule.id}' does not match RC01..RC08 pattern`);
  }
});

test('ROOT_CAUSE_RULES: baseConfidence is strictly in (0, 1) for every rule', () => {
  for (const rule of ROOT_CAUSE_RULES) {
    assert.ok(
      rule.baseConfidence > 0 && rule.baseConfidence < 1,
      `rule ${rule.id} baseConfidence ${rule.baseConfidence} is not in (0, 1)`,
    );
  }
});

test('ROOT_CAUSE_RULES: every category is a valid CauseCategory value', () => {
  for (const rule of ROOT_CAUSE_RULES) {
    assert.ok(
      (VALID_CATEGORIES as string[]).includes(rule.category),
      `rule ${rule.id} has invalid category '${rule.category}'`,
    );
  }
});

test('ROOT_CAUSE_RULES: every rule has a non-empty title', () => {
  for (const rule of ROOT_CAUSE_RULES) {
    assert.ok(rule.title.length > 0, `rule ${rule.id} has empty title`);
  }
});

test('ROOT_CAUSE_RULES: every rule has a non-empty description', () => {
  for (const rule of ROOT_CAUSE_RULES) {
    assert.ok(rule.description.length > 0, `rule ${rule.id} has empty description`);
  }
});

test('ROOT_CAUSE_RULES: RC01 is category "change" with baseConfidence 0.6', () => {
  const rc01 = ROOT_CAUSE_RULES.find((r) => r.id === 'RC01');
  assert.ok(rc01, 'RC01 missing');
  assert.equal(rc01.category, 'change');
  assert.equal(rc01.baseConfidence, 0.6);
});

test('ROOT_CAUSE_RULES: RC07 is category "external" with baseConfidence 0.35', () => {
  const rc07 = ROOT_CAUSE_RULES.find((r) => r.id === 'RC07');
  assert.ok(rc07, 'RC07 missing');
  assert.equal(rc07.category, 'external');
  assert.equal(rc07.baseConfidence, 0.35);
});

test('ROOT_CAUSE_RULES: RC08 is category "dependency" with baseConfidence 0.3', () => {
  const rc08 = ROOT_CAUSE_RULES.find((r) => r.id === 'RC08');
  assert.ok(rc08, 'RC08 missing');
  assert.equal(rc08.category, 'dependency');
  assert.equal(rc08.baseConfidence, 0.3);
});

test('RootCauseRuleRegistry.list() returns all 8 rules', () => {
  const registry = new RootCauseRuleRegistry();
  const rules = registry.list();
  assert.equal(rules.length, 8);
});

test('RootCauseRuleRegistry.get() returns the correct rule by id', () => {
  const registry = new RootCauseRuleRegistry();
  const rc04 = registry.get('RC04');
  assert.ok(rc04, 'RC04 not found via get()');
  assert.equal(rc04.id, 'RC04');
  assert.equal(rc04.category, 'infrastructure');
});

test('RootCauseRuleRegistry.get() returns undefined for an unknown id', () => {
  const registry = new RootCauseRuleRegistry();
  assert.equal(registry.get('RC99'), undefined);
});

test('RootCauseRuleRegistry.get() returns undefined for empty string', () => {
  const registry = new RootCauseRuleRegistry();
  assert.equal(registry.get(''), undefined);
});

test('RootCauseRuleRegistry.list() result is the same reference as ROOT_CAUSE_RULES', () => {
  const registry = new RootCauseRuleRegistry();
  const rules = registry.list();
  // list() returns ROOT_CAUSE_RULES directly — a frozen reference
  assert.deepEqual(rules, ROOT_CAUSE_RULES);
});

// ── (D) Type-shape smoke tests ────────────────────────────────────────────────

test('Symptom literal: valid shape with all required fields', () => {
  const symptom: Symptom = {
    text: 'orders failing after deploy',
    kind: 'orders-failing',
    domains: ['orders', 'payments'],
    anchors: ['domain:orders', 'rpc:create_checkout_order'],
    matchedTerms: ['orders failing'],
  };
  assert.equal(symptom.kind, 'orders-failing');
  assert.equal(symptom.domains.length, 2);
  assert.equal(symptom.anchors.length, 2);
  assert.equal(symptom.matchedTerms.length, 1);
});

test('Symptom literal: kind "unknown" is valid for unmatched text', () => {
  const symptom: Symptom = {
    text: 'something weird is happening',
    kind: 'unknown',
    domains: [],
    anchors: [],
    matchedTerms: [],
  };
  assert.equal(symptom.kind, 'unknown');
  assert.equal(symptom.domains.length, 0);
  assert.equal(symptom.anchors.length, 0);
});

test('Symptom literal: all 7 SymptomKind values are valid string literals', () => {
  const kinds: SymptomKind[] = [
    'orders-failing',
    'checkout-broken',
    'queue-backlog',
    'high-latency',
    'deployment-failed',
    'worker-crashed',
    'unknown',
  ];
  assert.equal(kinds.length, 7);
  const unique = new Set(kinds);
  assert.equal(unique.size, 7);
});

test('CauseHypothesis literal: valid shape with all required fields', () => {
  const h: CauseHypothesis = {
    id: 'hyp-RC01-001',
    rule: 'RC01',
    category: 'change',
    cause: 'Recent money-path migration',
    detail: 'Migration 0042 touched the orders table within the last 2 hours.',
    confidence: 0.65,
    connection: 'NOT_CONNECTED',
    evidence: [ev('table', 'orders', 'graphify-out/db-intel.json')],
  };
  assert.equal(h.rule, 'RC01');
  assert.equal(h.category, 'change');
  assert.ok(h.confidence > 0 && h.confidence <= 1);
  assert.ok(h.evidence.length >= 1, 'CauseHypothesis must have at least one evidence item');
});

test('CauseHypothesis literal: connection field accepts CONNECTED and NOT_CONNECTED', () => {
  const conn: Connection = 'CONNECTED';
  const notConn: Connection = 'NOT_CONNECTED';
  assert.equal(conn, 'CONNECTED');
  assert.equal(notConn, 'NOT_CONNECTED');
});

test('CauseHypothesis literal: all 6 CauseCategory values are valid string literals', () => {
  const cats: CauseCategory[] = [
    'change', 'dependency', 'infrastructure', 'configuration', 'external', 'unknown',
  ];
  assert.equal(cats.length, 6);
  const unique = new Set(cats);
  assert.equal(unique.size, 6);
});

test('AffectedSummary literal: valid shape with all required fields', () => {
  const affected: AffectedSummary = {
    systems: ['api:orders', 'rpc:create_checkout_order', 'table:orders'],
    byLayer: { api: 1, rpc: 1, table: 1 },
    domains: ['orders', 'payments'],
    deployments: ['deployment:storefront-runtime'],
  };
  assert.equal(affected.systems.length, 3);
  assert.equal(affected.domains.length, 2);
  assert.equal(affected.deployments.length, 1);
});

test('AffectedSummary literal: deployments may be empty (none derivable)', () => {
  const affected: AffectedSummary = {
    systems: ['rpc:create_checkout_order'],
    byLayer: { rpc: 1 },
    domains: ['payments'],
    deployments: [],
  };
  assert.equal(affected.deployments.length, 0);
});

test('RecentChangeSummary literal: valid shape with CONNECTED and changes', () => {
  const changes: RecentChangeSummary = {
    changes: [
      { id: 'ch-001', kind: 'migration', subject: 'orders', detail: 'Added column status_v2' },
    ],
    migrations: ['0042_add_status_v2'],
    connection: 'CONNECTED',
  };
  assert.equal(changes.connection, 'CONNECTED');
  assert.equal(changes.changes.length, 1);
  assert.equal(changes.migrations.length, 1);
});

test('RecentChangeSummary literal: valid shape with NOT_CONNECTED and empty changes', () => {
  const changes: RecentChangeSummary = {
    changes: [],
    migrations: [],
    connection: 'NOT_CONNECTED',
  };
  assert.equal(changes.connection, 'NOT_CONNECTED');
  assert.equal(changes.changes.length, 0);
});

test('HypothesisInput literal: valid shape with all required fields', () => {
  const input: HypothesisInput = {
    symptom: {
      text: 'checkout error after deploy',
      kind: 'checkout-broken',
      domains: ['payments'],
      anchors: ['domain:payments'],
      matchedTerms: ['checkout error'],
    },
    affected: {
      systems: ['api:checkout', 'rpc:create_checkout_order'],
      byLayer: { api: 1, rpc: 1 },
      domains: ['payments'],
      deployments: [],
    },
    recentChanges: {
      changes: [],
      migrations: [],
      connection: 'NOT_CONNECTED',
    },
    structure: {
      cycles: [],
      spofs: ['rpc:create_checkout_order'],
      consumerlessQueues: [],
    },
    notConnectedSignals: [{ signal: 'RAZORPAY_KEY_ID', source: 'env:RAZORPAY_KEY_ID' }],
    externalProviders: ['Razorpay'],
  };
  assert.equal(input.symptom.kind, 'checkout-broken');
  assert.equal(input.structure.spofs.length, 1);
  assert.equal(input.externalProviders.length, 1);
  assert.equal(input.notConnectedSignals.length, 1);
});

test('Diagnosis literal: valid DIAGNOSED shape with hypotheses', () => {
  const diag: Diagnosis = rootcause(
    {
      symptom: {
        text: 'orders failing',
        kind: 'orders-failing' as SymptomKind,
        domains: ['orders'],
        anchors: ['domain:orders'],
        matchedTerms: ['orders failing'],
      } satisfies Symptom,
      verdict: 'DIAGNOSED' as DiagnosisVerdict,
      hypotheses: [
        {
          id: 'hyp-RC02-001',
          rule: 'RC02',
          category: 'change' as CauseCategory,
          cause: 'Recent change to orders system',
          detail: 'Change record ch-042 targets the orders table.',
          confidence: 0.55,
          connection: 'NOT_CONNECTED' as Connection,
          evidence: [ev('table', 'orders', 'graphify-out/db-intel.json')],
        } satisfies CauseHypothesis,
      ],
      affected: {
        systems: ['table:orders'],
        byLayer: { table: 1 },
        domains: ['orders'],
        deployments: [],
      } satisfies AffectedSummary,
      recentChanges: {
        changes: [{ id: 'ch-042', kind: 'code', subject: 'orders', detail: 'Updated order RPC' }],
        migrations: [],
        connection: 'NOT_CONNECTED' as Connection,
      } satisfies RecentChangeSummary,
      likelyOwners: ['payments-team'],
      recommendedRollback: null,
      verificationPlan: ['Check order creation via POST /v1/checkout'],
      missingSignals: [],
      summary: 'Recent change to the orders system is the most likely cause.',
    },
    { evidence: [ev('table', 'orders', 'graphify-out/db-intel.json')], now: fixedNow },
  );
  assert.equal(diag.verdict, 'DIAGNOSED');
  assert.equal(diag.hypotheses.length, 1);
  assert.equal(diag.timestamp, FIXED_TS);
  assert.ok(diag.evidence.length >= 1);
});

test('Diagnosis literal: valid UNKNOWN shape with empty hypotheses and missingSignals', () => {
  const diag: Diagnosis = rootcause(
    {
      symptom: {
        text: 'something unknown',
        kind: 'unknown' as SymptomKind,
        domains: [],
        anchors: [],
        matchedTerms: [],
      } satisfies Symptom,
      verdict: 'UNKNOWN' as DiagnosisVerdict,
      hypotheses: [],
      affected: {
        systems: [],
        byLayer: {},
        domains: [],
        deployments: [],
      } satisfies AffectedSummary,
      recentChanges: {
        changes: [],
        migrations: [],
        connection: 'NOT_CONNECTED' as Connection,
      } satisfies RecentChangeSummary,
      likelyOwners: [],
      recommendedRollback: null,
      verificationPlan: [],
      missingSignals: [{ signal: 'telemetry', source: 'OTEL_EXPORTER_OTLP_ENDPOINT' }],
      summary: 'Insufficient evidence to diagnose. Missing: telemetry.',
    },
    { evidence: [], now: fixedNow },
  );
  assert.equal(diag.verdict, 'UNKNOWN');
  assert.equal(diag.hypotheses.length, 0);
  assert.equal(diag.missingSignals.length, 1);
  assert.equal(diag.confidence, 0);
});

test('Diagnosis literal: all 3 DiagnosisVerdict values are valid string literals', () => {
  const verdicts: DiagnosisVerdict[] = ['DIAGNOSED', 'PARTIAL', 'UNKNOWN'];
  assert.equal(verdicts.length, 3);
  const unique = new Set(verdicts);
  assert.equal(unique.size, 3);
});

test('Diagnosis: recommendedRollback can carry steps when a change hypothesis survives', () => {
  const diag: Diagnosis = rootcause(
    {
      symptom: {
        text: 'deployment failed',
        kind: 'deployment-failed' as SymptomKind,
        domains: ['operations'],
        anchors: [],
        matchedTerms: ['deployment failed'],
      } satisfies Symptom,
      verdict: 'DIAGNOSED' as DiagnosisVerdict,
      hypotheses: [
        {
          id: 'hyp-RC01-002',
          rule: 'RC01',
          category: 'change' as CauseCategory,
          cause: 'Recent money-path migration',
          detail: 'Migration 0043 modified payment_transactions.',
          confidence: 0.65,
          connection: 'NOT_CONNECTED' as Connection,
          evidence: [ev('table', 'payment_transactions', 'graphify-out/db-intel.json')],
        } satisfies CauseHypothesis,
      ],
      affected: {
        systems: ['table:payment_transactions'],
        byLayer: { table: 1 },
        domains: ['payments'],
        deployments: ['deployment:api-gateway'],
      } satisfies AffectedSummary,
      recentChanges: {
        changes: [],
        migrations: ['0043_payment_transactions_v2'],
        connection: 'NOT_CONNECTED' as Connection,
      } satisfies RecentChangeSummary,
      likelyOwners: ['payments-team'],
      recommendedRollback: {
        readiness: 'READY',
        steps: ['Revert migration 0043', 'Restart api-gateway', 'Verify payment creation'],
      },
      verificationPlan: ['POST /v1/checkout and confirm 200', 'Check payment_transactions row created'],
      missingSignals: [],
      summary: 'Recent migration on the money path is the most likely cause.',
    },
    { evidence: [ev('table', 'payment_transactions', 'graphify-out/db-intel.json')], now: fixedNow },
  );
  assert.ok(diag.recommendedRollback !== null);
  assert.ok(diag.recommendedRollback!.steps.length > 0);
  assert.equal(diag.recommendedRollback!.readiness, 'READY');
});
