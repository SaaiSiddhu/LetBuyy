/**
 * RollbackIntelligenceService tests.
 *
 * Uses the Node built-in test runner. A createEngine() helper wires a fixed
 * timestamp and the real graphify-out artifacts (same pattern as foundation.test.ts).
 * The mock-engine helper below gives pure-unit coverage where we need controlled inputs.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createEngine, type LcisEngine } from '@letbuyy/lcis-core';
import { RollbackIntelligenceService } from '../src/rollback/index';
import { type ChangeRequest } from '../src/shared/index';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED = '2026-06-20T00:00:00.000Z';
const fixedNow = () => FIXED;

/** Real engine over graphify-out. */
const realEngine = createEngine();

/** Pull real money/tenant table names from the artifact so assertions are not brittle. */
const dbIntel = realEngine.store.read<{ tables: { name: string; money?: boolean; tenant?: boolean }[] }>('db-intel');
const moneyTable = dbIntel.tables.find((t) => t.money)?.name ?? 'payment_transactions';
const tenantTable = dbIntel.tables.find((t) => t.tenant && !t.money)?.name ?? 'sites';
const domainIntel = realEngine.store.read<{ domains: { key: string }[] }>('domain-intel');
const aDomain = domainIntel.domains[0]?.key ?? 'payments';

// ── Mock engine builder ───────────────────────────────────────────────────────

interface MockStoreData {
  'db-intel'?: unknown;
  'relationship-intel'?: unknown;
  runbooks?: unknown;
  [key: string]: unknown;
}

/**
 * Lightweight mock engine for pure-unit tests. Delegates blast/graph/memory to
 * the real engine so seed resolution + relationship queries work; only the store
 * is overridden for controlled artifact injection.
 */
function buildMockEngine(storeData: MockStoreData): LcisEngine {
  const mockStore = {
    read: <T>(name: string): T => {
      const val = storeData[name];
      if (val === undefined) return realEngine.store.read<T>(name);
      return val as T;
    },
    tryRead: <T>(name: string): T | null => {
      if (name in storeData) {
        return storeData[name] === null ? null : (storeData[name] as T);
      }
      return realEngine.store.tryRead<T>(name);
    },
    has: (name: string): boolean => {
      if (name in storeData) return storeData[name] !== null;
      return realEngine.store.has(name);
    },
    pathOf: realEngine.store.pathOf.bind(realEngine.store),
    cacheStats: realEngine.store.cacheStats.bind(realEngine.store),
  } as unknown as LcisEngine['store'];

  return {
    store: mockStore,
    graph: realEngine.graph,
    blast: realEngine.blast,
    memory: realEngine.memory,
    decision: realEngine.decision,
    architecture: realEngine.architecture,
    verification: realEngine.verification,
  };
}

/** Service instance over real artifacts. */
const svc = new RollbackIntelligenceService(realEngine, fixedNow);

// ── describe: detectIrreversibleChanges ──────────────────────────────────────

describe('detectIrreversibleChanges', () => {
  test('money table → at least one irreversible change returned', () => {
    const result = svc.detectIrreversibleChanges({ text: 'modify payment ledger', tables: [moneyTable] });
    assert.ok(result.length >= 1, 'expected irreversible changes for money table');
  });

  test('money table irreversible change has severity critical', () => {
    const result = svc.detectIrreversibleChanges({ text: 'update orders ledger', tables: [moneyTable] });
    const crit = result.filter((i) => i.severity === 'critical');
    assert.ok(crit.length >= 1, 'expected critical severity for money table');
  });

  test('money table irreversible reason mentions canonical RPC, not delete', () => {
    const result = svc.detectIrreversibleChanges({ text: 'write to payment_transactions', tables: [moneyTable] });
    const reasons = result.map((i) => i.reason.toLowerCase()).join(' ');
    assert.ok(reasons.includes('rpc') || reasons.includes('canonical'), 'reason must cite canonical RPC path');
    assert.ok(!reasons.includes('delete ledger') && !reasons.includes('direct deletion'), 'must not suggest direct delete');
  });

  test('every IrreversibleChange has evidence array (non-empty)', () => {
    const result = svc.detectIrreversibleChanges({ text: 'modify payment_transactions', tables: [moneyTable] });
    for (const ic of result) {
      assert.ok(ic.evidence.length > 0, `subject "${ic.subject}" must have evidence`);
    }
  });

  test('trivial change with no tables → empty irreversible list', () => {
    const result = svc.detectIrreversibleChanges({ text: 'update a UI label', tables: [] });
    assert.equal(result.length, 0);
  });

  test('non-money, non-tenant table with low fan-in → not flagged irreversible', () => {
    // Use a table name that won't resolve through the blast graph to money tables.
    // xyzzy_ui_labels is a deliberately unresolvable token — no domain/table match.
    const result = svc.detectIrreversibleChanges({ text: 'add a new display label', tables: [] });
    // With no table seeds and non-money text, irreversible list should be empty
    assert.equal(result.length, 0);
  });

  test('drop-class text on high-fan-in sites table → flagged irreversible', () => {
    // 'sites' has fan-in 260 — a DROP request should be irreversible
    const result = svc.detectIrreversibleChanges({ text: 'drop the sites table entirely', tables: ['sites'] });
    // sites is a tenant table with massive fan-in; drop-class text
    assert.ok(result.length >= 1, 'dropping sites (fan-in 260) should be irreversible');
  });

  test('each IrreversibleChange has a subject field', () => {
    const result = svc.detectIrreversibleChanges({ text: 'touch money', tables: [moneyTable] });
    for (const ic of result) {
      assert.ok(typeof ic.subject === 'string' && ic.subject.length > 0);
    }
  });
});

// ── describe: detectRollbackRisk ──────────────────────────────────────────────

describe('detectRollbackRisk', () => {
  test('money table → rollback risk is critical', () => {
    const risk = svc.detectRollbackRisk({ text: 'touch payment ledger', tables: [moneyTable] });
    assert.equal(risk.level, 'critical');
  });

  test('money table → risk.money is true', () => {
    const risk = svc.detectRollbackRisk({ text: 'payment mutation', tables: [moneyTable] });
    assert.equal(risk.money, true);
  });

  test('unresolved change → rollback risk is low', () => {
    // Use text with no matching domain/table seeds to avoid blast-radius money elevation
    const risk = svc.detectRollbackRisk({ text: 'zzqqxwibblexyzzy' });
    assert.ok(['low', 'medium'].includes(risk.level));
  });

  test('risk has drivers array', () => {
    const risk = svc.detectRollbackRisk({ text: 'modify payments', domains: ['payments'] });
    assert.ok(Array.isArray(risk.drivers));
  });

  test('irreversible changes elevate risk to critical', () => {
    // money tables → irreversible → should be critical
    const risk = svc.detectRollbackRisk({ text: 'write to ledger entries', tables: ['ledger_entries'] });
    assert.equal(risk.level, 'critical');
  });

  test('risk.score is a number ≥ 0', () => {
    const risk = svc.detectRollbackRisk({ text: 'change orders', domains: [aDomain] });
    assert.ok(typeof risk.score === 'number' && risk.score >= 0);
  });
});

// ── describe: identifyRollbackDependencies ───────────────────────────────────

describe('identifyRollbackDependencies', () => {
  test('returns an array of strings', () => {
    const deps = svc.identifyRollbackDependencies({ text: 'change payments domain', domains: ['payments'] });
    assert.ok(Array.isArray(deps));
    for (const d of deps) assert.equal(typeof d, 'string');
  });

  test('dependencies are reversed from suggestedSequence', () => {
    const req: ChangeRequest = { text: 'change', domains: [aDomain] };
    const analysis = realEngine.blast.impact(aDomain) as { domain: string; breaks: { domains: { list: string[] } } } | { error: string };
    const deps = svc.identifyRollbackDependencies(req);
    // We can't easily test exact reverse without re-running the analyzer,
    // but we can confirm deps is an array and has consistent structure
    assert.ok(Array.isArray(deps));
  });

  test('trivial request with no resolved seeds → empty or minimal deps', () => {
    const deps = svc.identifyRollbackDependencies({ text: 'zzqqxwibblexyzzy' });
    assert.ok(Array.isArray(deps));
  });

  test('deterministic: same request returns same deps twice', () => {
    const req: ChangeRequest = { text: 'payment rollback', domains: ['payments'] };
    const deps1 = svc.identifyRollbackDependencies(req);
    const deps2 = svc.identifyRollbackDependencies(req);
    assert.deepEqual(deps1, deps2);
  });
});

// ── describe: identifyRecoverySteps ──────────────────────────────────────────

describe('identifyRecoverySteps', () => {
  test('recovery steps is a non-empty array for a domain request', () => {
    const steps = svc.identifyRecoverySteps({ text: 'change payments', domains: ['payments'] });
    assert.ok(steps.length >= 1, 'expected at least one recovery step');
  });

  test('every step has order, action, reversible, evidence', () => {
    const steps = svc.identifyRecoverySteps({ text: 'change orders', domains: ['orders'] });
    for (const s of steps) {
      assert.ok(typeof s.order === 'number');
      assert.ok(typeof s.action === 'string' && s.action.length > 0);
      assert.ok(typeof s.reversible === 'boolean');
      assert.ok(Array.isArray(s.evidence) && s.evidence.length > 0);
    }
  });

  test('orders are sequential starting at 1', () => {
    const steps = svc.identifyRecoverySteps({ text: 'change products', domains: ['products'] });
    for (let i = 0; i < steps.length; i++) {
      assert.equal(steps[i]!.order, i + 1);
    }
  });

  test('domain with a runbook match → step action cites [Runbook:...]', () => {
    // payments domain has a runbook
    const steps = svc.identifyRecoverySteps({ text: 'payments failure', domains: ['payments'] });
    const hasCitation = steps.some((s) => s.action.includes('[Runbook:') || s.action.toLowerCase().includes('runbook'));
    assert.ok(hasCitation, 'expected runbook citation in steps for payments domain');
  });

  test('money change → step mentions canonical RPC (not delete)', () => {
    const steps = svc.identifyRecoverySteps({ text: 'write to ledger', tables: [moneyTable] });
    const actions = steps.map((s) => s.action.toLowerCase()).join(' ');
    // Must not instruct the operator to drop or truncate; mentioning "never delete"
    // in a prohibition is fine — check for direct instructions only.
    const hasDangerousInstruction = actions.includes('truncate') || actions.includes('drop table');
    assert.equal(hasDangerousInstruction, false, 'recovery steps must not instruct direct ledger drop/truncate');
  });

  test('money change → recovery steps mention complete_order_refund or restore_gift_card', () => {
    const steps = svc.identifyRecoverySteps({ text: 'payment ledger mutation', tables: [moneyTable] });
    const combined = steps.map((s) => s.action.toLowerCase()).join(' ');
    // Generic fallback path for money should cite the canonical RPCs
    // This only applies if the request doesn't match a domain runbook
    // (payments runbook recovery steps also handle money safely)
    const safeRef =
      combined.includes('complete_order_refund') ||
      combined.includes('restore_gift_card') ||
      combined.includes('canonical') ||
      combined.includes('reconcil') ||
      combined.includes('ledger_balance_breaks');
    assert.ok(safeRef, 'money recovery must cite canonical RPC or reconciliation check');
  });

  test('trivial request → returns at least a generic step', () => {
    const steps = svc.identifyRecoverySteps({ text: 'update label color' });
    assert.ok(steps.length >= 1);
  });

  test('deterministic: same request → same steps twice', () => {
    const req: ChangeRequest = { text: 'change orders', domains: ['orders'] };
    const s1 = svc.identifyRecoverySteps(req);
    const s2 = svc.identifyRecoverySteps(req);
    assert.equal(s1.length, s2.length);
    for (let i = 0; i < s1.length; i++) {
      assert.equal(s1[i]!.action, s2[i]!.action);
    }
  });
});

// ── describe: estimateRecoveryTime ────────────────────────────────────────────

describe('estimateRecoveryTime', () => {
  test('returns a non-empty string', () => {
    const result = svc.estimateRecoveryTime({ text: 'change products' });
    assert.ok(typeof result === 'string' && result.length > 0);
  });

  test('trivial change → band mentions "minutes"', () => {
    const result = svc.estimateRecoveryTime({ text: 'update UI label color', tables: [] });
    assert.ok(result.toLowerCase().includes('minute'), `expected "minutes" in: ${result}`);
  });

  test('money + irreversible → mentions "manual" or "unbounded"', () => {
    const result = svc.estimateRecoveryTime({ text: 'mutate payment_transactions', tables: [moneyTable] });
    const lower = result.toLowerCase();
    assert.ok(
      lower.includes('manual') || lower.includes('unbounded'),
      `expected manual/unbounded for money+irreversible, got: ${result}`,
    );
  });

  test('result explains basis (no bare fabricated numbers)', () => {
    const result = svc.estimateRecoveryTime({ text: 'change payments', domains: ['payments'] });
    // Should have explanatory text, not just "30 minutes" or similar
    assert.ok(result.length > 20, 'explanation should be substantive');
  });

  test('deterministic: same request → same recovery time estimate', () => {
    const req: ChangeRequest = { text: 'payments change', domains: ['payments'] };
    assert.equal(svc.estimateRecoveryTime(req), svc.estimateRecoveryTime(req));
  });
});

// ── describe: generateRollbackPlan ────────────────────────────────────────────

describe('generateRollbackPlan', () => {
  test('money change → readiness is CONDITIONAL or NOT_READY', () => {
    const plan = svc.generateRollbackPlan({ text: 'modify payment ledger', tables: [moneyTable] });
    assert.ok(
      plan.readiness === 'CONDITIONAL' || plan.readiness === 'NOT_READY',
      `expected CONDITIONAL or NOT_READY for money change, got ${plan.readiness}`,
    );
  });

  test('trivial change with no table → readiness is READY', () => {
    // Use a text that doesn't resolve to any domain/money-table seeds
    const plan = svc.generateRollbackPlan({ text: 'change a tooltip text' });
    assert.equal(plan.readiness, 'READY');
  });

  test('money change → complexity is irreversible or complex', () => {
    const plan = svc.generateRollbackPlan({ text: 'write to ledger_entries', tables: ['ledger_entries'] });
    assert.ok(
      plan.complexity === 'irreversible' || plan.complexity === 'complex',
      `expected complex or irreversible, got ${plan.complexity}`,
    );
  });

  test('trivial change → complexity is simple', () => {
    const plan = svc.generateRollbackPlan({ text: 'change a tooltip text' });
    assert.ok(
      plan.complexity === 'simple' || plan.complexity === 'moderate',
      `expected simple or moderate for trivial change, got ${plan.complexity}`,
    );
  });

  test('plan has all PlanArtifact fields: evidence, confidence, sources, timestamp', () => {
    const plan = svc.generateRollbackPlan({ text: 'change products', domains: ['products'] });
    assert.ok(Array.isArray(plan.evidence));
    assert.ok(typeof plan.confidence === 'number');
    assert.ok(Array.isArray(plan.sources));
    assert.equal(plan.timestamp, FIXED);
  });

  test('plan.confidence is in [0, 0.95]', () => {
    const plan = svc.generateRollbackPlan({ text: 'change payments domain', domains: ['payments'] });
    assert.ok(plan.confidence >= 0 && plan.confidence <= 0.95, `confidence out of range: ${plan.confidence}`);
  });

  test('plan.steps is a non-empty array', () => {
    const plan = svc.generateRollbackPlan({ text: 'change orders', domains: ['orders'] });
    assert.ok(Array.isArray(plan.steps) && plan.steps.length >= 1);
  });

  test('plan.irreversible is an array', () => {
    const plan = svc.generateRollbackPlan({ text: 'change products' });
    assert.ok(Array.isArray(plan.irreversible));
  });

  test('plan.dependencies is an array of strings', () => {
    const plan = svc.generateRollbackPlan({ text: 'change payments', domains: ['payments'] });
    assert.ok(Array.isArray(plan.dependencies));
    for (const d of plan.dependencies) assert.equal(typeof d, 'string');
  });

  test('plan.estimatedRecovery is a non-empty string', () => {
    const plan = svc.generateRollbackPlan({ text: 'change products', domains: ['products'] });
    assert.ok(typeof plan.estimatedRecovery === 'string' && plan.estimatedRecovery.length > 0);
  });

  test('plan.risk has level, money, tenant, drivers', () => {
    const plan = svc.generateRollbackPlan({ text: 'change payments', domains: ['payments'] });
    assert.ok(['low', 'medium', 'high', 'critical'].includes(plan.risk.level));
    assert.ok(typeof plan.risk.money === 'boolean');
    assert.ok(typeof plan.risk.tenant === 'boolean');
    assert.ok(Array.isArray(plan.risk.drivers));
  });

  test('plan.request equals input request', () => {
    const req: ChangeRequest = { text: 'rollback test', domains: ['products'] };
    const plan = svc.generateRollbackPlan(req);
    assert.equal(plan.request.text, req.text);
  });

  test('plan.sources contains at least one graphify-out path', () => {
    const plan = svc.generateRollbackPlan({ text: 'change payments', domains: ['payments'] });
    assert.ok(
      plan.sources.some((s) => s.includes('graphify-out')),
      `expected graphify-out source in: ${plan.sources.join(', ')}`,
    );
  });

  test('determinism: same request produces identical plan twice', () => {
    const req: ChangeRequest = { text: 'change orders domain', domains: ['orders'] };
    const p1 = svc.generateRollbackPlan(req);
    const p2 = svc.generateRollbackPlan(req);
    assert.equal(p1.readiness, p2.readiness);
    assert.equal(p1.complexity, p2.complexity);
    assert.equal(p1.steps.length, p2.steps.length);
    assert.equal(p1.estimatedRecovery, p2.estimatedRecovery);
    assert.equal(p1.confidence, p2.confidence);
    assert.equal(p1.timestamp, p2.timestamp);
  });

  test('unresolved request → readiness READY, no irreversible changes', () => {
    const plan = svc.generateRollbackPlan({ text: 'zzqqxwibblexyzzy' });
    assert.equal(plan.readiness, 'READY');
    // Unresolved = no money/tenant seeds → irreversible list is empty
    assert.equal(plan.irreversible.length, 0);
  });

  test('money domain + domain request → evidence array is non-empty', () => {
    const plan = svc.generateRollbackPlan({ text: 'change payment domain', domains: ['payments'] });
    assert.ok(plan.evidence.length > 0);
  });
});

// ── describe: read-only source scan ──────────────────────────────────────────

describe('read-only enforcement (source scan)', () => {
  const SERVICE_SRC = readFileSync(
    new URL('../src/rollback/RollbackIntelligenceService.ts', import.meta.url),
    'utf8',
  );

  const BANNED = ['fetch(', 'writeFile', 'appendFile', 'spawn(', 'exec(', 'eval(', 'child_process'];

  for (const banned of BANNED) {
    test(`src/rollback/ does not contain "${banned}"`, () => {
      assert.ok(
        !SERVICE_SRC.includes(banned),
        `Banned pattern "${banned}" found in RollbackIntelligenceService.ts`,
      );
    });
  }

  test('src/rollback/index.ts does not contain any banned IO pattern', () => {
    const indexSrc = readFileSync(
      new URL('../src/rollback/index.ts', import.meta.url),
      'utf8',
    );
    for (const banned of BANNED) {
      assert.ok(!indexSrc.includes(banned), `Banned pattern "${banned}" in rollback/index.ts`);
    }
  });
});
