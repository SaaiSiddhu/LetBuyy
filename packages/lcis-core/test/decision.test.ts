/**
 * DecisionService integration tests.
 * All assertions are real and reproducible against the current graphify-out/ artifacts.
 *
 * Principles:
 * - Use conservative `>=` where artifact values may shift.
 * - Skip gracefully if an artifact is missing (store.has() check).
 * - No randomness; rankings are deterministic across two calls.
 * - Scale-tier honesty: strings must contain "load test", never a fabricated number.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ArtifactStore } from '../src/runtime/ArtifactStore';
import { DecisionService } from '../src/decision/DecisionService';
import { riskScore, fixScore, severityWeight, inrImpactTier } from '../src/decision/scoring';

// Use the real graphify-out/ directory (same path as blast-radius.test.ts)
const store = ArtifactStore.default();
const svc = new DecisionService(store);

// ─── Pure scoring function tests (no IO) ─────────────────────────────────────

describe('scoring — pure functions', () => {
  it('severityWeight maps emoji and text correctly', () => {
    assert.equal(severityWeight('🔴'), 3);
    assert.equal(severityWeight('critical'), 3);
    assert.equal(severityWeight('🟠'), 2);
    assert.equal(severityWeight('🟡'), 1);
    assert.equal(severityWeight('🟢'), 0);
    assert.equal(severityWeight('unknown'), 0);
  });

  it('riskScore formula: max 180 for critical + money + 0 readiness + open blocker', () => {
    const score = riskScore({ severityWeight: 3, moneyDomain: 1, systemReadiness: 0, openBlockerRef: 1 });
    // 3×40 + 1×30 + (100-0)×0.2 + 1×10 = 120+30+20+10 = 180
    assert.equal(score, 180);
  });

  it('riskScore formula: LB-8 expected score (severityWeight=3, moneyDomain=0, sr=88, openBlockerRef=1)', () => {
    const score = riskScore({ severityWeight: 3, moneyDomain: 0, systemReadiness: 88, openBlockerRef: 1 });
    // 3×40 + 0×30 + (100-88)×0.2 + 1×10 = 120+0+2.4+10 = 132.4
    assert.equal(score, 132.4);
  });

  it('fixScore: LB-8 open critical blocker → score 205', () => {
    // severityWeight=3, inrTierWeight=2(high), openBlockerRef=1, moneyDomain=0
    const score = fixScore({ severityWeight: 3, moneyDomain: 0, systemReadiness: 88, openBlockerRef: 1 }, 'high');
    // 3×40 + 2×35 + 1×15 + 0×10 = 120+70+15+0 = 205
    assert.equal(score, 205);
  });

  it('fixScore: structural dead-RPC (low tier, no blocker, no money) → score 0', () => {
    const score = fixScore({ severityWeight: 0, moneyDomain: 0, systemReadiness: 100, openBlockerRef: 0 }, 'low');
    assert.equal(score, 0);
  });

  it('inrImpactTier: payments domain → critical regardless of severity', () => {
    assert.equal(inrImpactTier('payments', '🟡', false, 'payments fix'), 'critical');
    assert.equal(inrImpactTier('orders', '🟡', false, 'orders issue'), 'critical');
    assert.equal(inrImpactTier('refunds', '🟠', false, 'refunds'), 'critical');
  });

  it('inrImpactTier: open 🔴 blocker (non-money) → high', () => {
    assert.equal(inrImpactTier('merchant', '🔴', true, 'LB-8 blocker'), 'high');
  });

  it('inrImpactTier: open 🟠 blocker → medium', () => {
    assert.equal(inrImpactTier('identity', '🟠', true, 'LB-10 partial'), 'medium');
  });

  it('inrImpactTier: structural dead-code → low', () => {
    assert.equal(inrImpactTier('structural', 'unknown', false, 'dead rpc'), 'low');
  });
});

// ─── DecisionService integration tests ───────────────────────────────────────

describe('DecisionService.rankRisks()', () => {
  it('TC-1: risk ranking is deterministic across two calls', { skip: !store.has('decision-engine-v2') }, () => {
    const r1 = svc.rankRisks();
    const r2 = svc.rankRisks();
    assert.equal(r1.length, r2.length);
    for (let i = 0; i < r1.length; i++) {
      const a = r1[i];
      const b = r2[i];
      if (a && b) {
        assert.equal(a.id, b.id);
        assert.equal(a.rank, b.rank);
        assert.equal(a.score, b.score);
      }
    }
  });

  it('TC-1b: rank 1 is the highest-scoring item', { skip: !store.has('execution-intel') }, () => {
    const risks = svc.rankRisks();
    assert.ok(risks.length >= 1);
    // Rank 1 must have the highest score
    const rank1 = risks[0];
    assert.ok(rank1 !== undefined);
    for (const r of risks) {
      assert.ok(rank1.score >= r.score, `rank1.score(${rank1.score}) < ${r.id}.score(${r.score})`);
    }
  });

  it('TC-1c: every RankedRisk carries formula and factors', { skip: !store.has('execution-intel') }, () => {
    const risks = svc.rankRisks();
    for (const r of risks) {
      assert.ok(typeof r.formula === 'string' && r.formula.length > 0, `${r.id} missing formula`);
      assert.ok(typeof r.factors.severityWeight === 'number', `${r.id} missing severityWeight`);
      assert.ok(typeof r.factors.moneyDomain === 'number', `${r.id} missing moneyDomain`);
      assert.ok(typeof r.score === 'number', `${r.id} missing score`);
      // Formula string must match the expected pattern
      assert.match(r.formula, /severityWeight\(\d\)×40/);
    }
  });

  it('TC-1d: rank 1 is LB-8 (🔴, open blocker) when artifacts are real', { skip: !store.has('decision-engine-v2') || !store.has('execution-intel') }, () => {
    const risks = svc.rankRisks();
    const top = risks[0];
    assert.ok(top !== undefined);
    // LB-8 is 🔴 + openBlocker — should be highest
    assert.equal(top.id, 'LB-8');
    assert.equal(top.factors.severityWeight, 3);
    assert.equal(top.factors.openBlockerRef, 1);
    // score ≥ 120 (at minimum: 3×40 = 120)
    assert.ok(top.score >= 120, `Expected score >= 120, got ${top.score}`);
  });
});

describe('DecisionService.rankFixes()', () => {
  it('TC-3: open critical blockers rank above structural dead-code cleanup', { skip: !store.has('fix-engine') }, () => {
    const fixes = svc.rankFixes();
    assert.ok(fixes.length >= 2);
    // Find LB-8 fix (critical launch blocker)
    const lb8 = fixes.find((f) => f.id === 'LB-8');
    // Find structural fix (dead RPCs — first plan in fix-engine)
    const structural = fixes.find((f) => f.inrImpactTier === 'low' && f.id.startsWith('fix-'));
    if (lb8 && structural) {
      assert.ok(lb8.rank < structural.rank, `LB-8 rank(${lb8.rank}) should be < structural rank(${structural.rank})`);
      assert.ok(lb8.score > structural.score, `LB-8 score(${lb8.score}) should be > structural score(${structural.score})`);
    }
  });

  it('TC-3b: LB-8 fix score equals 205 (severityWeight=3, tier=high, openBlocker=1, noMoney)', { skip: !store.has('fix-engine') && !store.has('execution-intel') }, () => {
    const fixes = svc.rankFixes();
    const lb8 = fixes.find((f) => f.id === 'LB-8');
    if (!lb8) return; // skip if not in this run's fix list
    assert.equal(lb8.score, 205, `LB-8 fix score should be 205, got ${lb8.score}`);
    assert.match(lb8.formula, /205/);
  });

  it('TC-2: payments/orders domain forces inrImpactTier = critical', { skip: !store.has('fix-engine') }, () => {
    const fixes = svc.rankFixes();
    const moneyFixes = fixes.filter((f) => f.domain === 'payments' || f.domain === 'orders');
    for (const f of moneyFixes) {
      assert.equal(f.inrImpactTier, 'critical', `${f.id}: money domain should be critical, got ${f.inrImpactTier}`);
    }
  });

  it('TC-2b: LB-7 shipping/GST domain → tier is NOT critical (shipping != money domain)', { skip: !store.has('fix-engine') }, () => {
    const fixes = svc.rankFixes();
    const lb7 = fixes.find((f) => f.id === 'LB-7');
    if (!lb7) return;
    // shipping is not a money domain → tier should be medium (🟡 blocker, open)
    assert.notEqual(lb7.inrImpactTier, 'critical', `LB-7 should NOT be critical tier (shipping != money domain)`);
  });

  it('TC-3c: every RankedFix carries formula and factors', { skip: !store.has('fix-engine') }, () => {
    const fixes = svc.rankFixes();
    for (const f of fixes) {
      assert.ok(typeof f.formula === 'string' && f.formula.length > 0, `${f.id} missing formula`);
      assert.ok(typeof f.factors.severityWeight === 'number', `${f.id} missing severityWeight`);
    }
  });
});

describe('DecisionService.evidence()', () => {
  it('TC-4: evidence(LB-12) returns >= 2 entries including blocker-report source', { skip: !store.has('execution-intel') }, () => {
    const evArr = svc.evidence('LB-12');
    assert.ok(evArr.length >= 2, `Expected >= 2 evidence entries for LB-12, got ${evArr.length}`);
    const blocker = evArr.find((e) => e.source === 'blocker-report');
    assert.ok(blocker !== undefined, 'Should have a blocker-report evidence entry');
    assert.ok(blocker.ref === 'LB-12', `ref should be LB-12, got ${blocker.ref}`);
  });

  it('TC-4b: evidence entries have non-empty ref and value', { skip: !store.has('execution-intel') }, () => {
    const evArr = svc.evidence('LB-8');
    for (const e of evArr) {
      assert.ok(typeof e.ref === 'string' && e.ref.length > 0, 'ref must be non-empty');
      assert.ok(typeof e.value === 'string' && e.value.length > 0, 'value must be non-empty');
    }
  });
});

describe('DecisionService.trace()', () => {
  it('TC-5: trace(LB-9) returns full factor-filled Decision object', { skip: !store.has('execution-intel') }, () => {
    const d = svc.trace('LB-9');
    assert.equal(d.id, 'LB-9');
    assert.ok(d.inputs.blockers.includes('LB-9'), 'inputs.blockers should include LB-9');
    assert.equal(d.factors.severityWeight, 3, 'LB-9 is 🔴 → severityWeight = 3');
    assert.equal(d.factors.openBlockerRef, 1, 'LB-9 is open → openBlockerRef = 1');
    assert.ok(typeof d.formula === 'string' && d.formula.length > 0, 'formula must be non-empty');
    assert.ok(d.score >= 120, `score should be >= 120, got ${d.score}`);
    // rank must match its position in rankRisks()
    const risks = svc.rankRisks();
    const riskEntry = risks.find((r) => r.id === 'LB-9');
    if (riskEntry) {
      assert.equal(d.rank, riskEntry.rank, 'trace.rank should match rankRisks position');
    }
  });

  it('trace() returns rank = -1 and score = 0 for unknown id', () => {
    const d = svc.trace('NONEXISTENT-999');
    assert.equal(d.rank, -1);
    assert.equal(d.score, 0);
    assert.equal(d.formula, 'not found');
  });
});

describe('DecisionService.launchVerdict()', () => {
  it('TC-6: launchVerdict is NO-GO while 🔴 blockers are open', { skip: !store.has('execution-intel') }, () => {
    const lv = svc.launchVerdict();
    // With 3 open 🔴 blockers (LB-8, LB-9, LB-12), verdict must be NO-GO
    assert.equal(lv.verdict, 'NO-GO');
    assert.ok(lv.openBlockers >= 3, `Expected >= 3 open blockers, got ${lv.openBlockers}`);
  });

  it('TC-6b: launchVerdict returns certification docs array', { skip: !store.has('execution-intel') }, () => {
    const lv = svc.launchVerdict();
    assert.ok(Array.isArray(lv.certificationDocs), 'certificationDocs must be an array');
    for (const cd of lv.certificationDocs) {
      assert.ok(typeof cd.doc === 'string' && cd.doc.length > 0, 'doc must be non-empty');
      assert.ok(typeof cd.verdict === 'string' && cd.verdict.length > 0, 'verdict must be non-empty');
    }
  });

  it('TC-6c: overallReadiness is a number 0-100', { skip: !store.has('production-readiness') }, () => {
    const lv = svc.launchVerdict();
    assert.ok(lv.overallReadiness >= 0 && lv.overallReadiness <= 100, `overallReadiness out of range: ${lv.overallReadiness}`);
  });
});

describe('DecisionService.scaleTiers()', () => {
  it('TC-7: scale tier blocks10000Merchants contains "load test" (honesty contract)', { skip: !store.has('decision-engine-v2') }, () => {
    const tiers = svc.scaleTiers();
    const entries10k = tiers.blocks10000Merchants;
    assert.ok(entries10k.length >= 1, 'blocks10000Merchants must have at least one entry');
    const hasLoadTest = entries10k.some((e) => e.toLowerCase().includes('load test'));
    assert.ok(hasLoadTest, `blocks10000Merchants must contain "load test" — got: ${entries10k.join(' | ')}`);
  });

  it('TC-7b: blocks100kConcurrentUsers contains "load test"', { skip: !store.has('decision-engine-v2') }, () => {
    const tiers = svc.scaleTiers();
    const entries = tiers.blocks100kConcurrentUsers;
    const hasLoadTest = entries.some((e) => e.toLowerCase().includes('load test'));
    assert.ok(hasLoadTest, `blocks100kConcurrentUsers must contain "load test"`);
  });

  it('TC-7c: all 5 tier keys are present and non-empty', () => {
    const tiers = svc.scaleTiers();
    assert.ok(Array.isArray(tiers.blocks100Merchants) && tiers.blocks100Merchants.length >= 1);
    assert.ok(Array.isArray(tiers.blocks10kUsers) && tiers.blocks10kUsers.length >= 1);
    assert.ok(Array.isArray(tiers.blocks100kConcurrentUsers) && tiers.blocks100kConcurrentUsers.length >= 1);
    assert.ok(Array.isArray(tiers.blocks1000Merchants) && tiers.blocks1000Merchants.length >= 1);
    assert.ok(Array.isArray(tiers.blocks10000Merchants) && tiers.blocks10000Merchants.length >= 1);
  });
});

describe('DecisionService.systemReadiness()', () => {
  it('TC-8: Payments system score is 88 (from production-readiness.json)', { skip: !store.has('production-readiness') }, () => {
    const systems = svc.systemReadiness();
    const payments = systems.find((s) => s.system === 'Payments');
    assert.ok(payments !== undefined, 'Payments system must be in readiness list');
    assert.equal(payments.score, 88, `Expected Payments score = 88, got ${payments.score}`);
  });

  it('TC-8b: returns 18 systems', { skip: !store.has('production-readiness') }, () => {
    const systems = svc.systemReadiness();
    assert.equal(systems.length, 18, `Expected 18 systems, got ${systems.length}`);
  });

  it('TC-8c: every system has non-empty evidence array', { skip: !store.has('production-readiness') }, () => {
    const systems = svc.systemReadiness();
    for (const s of systems) {
      assert.ok(Array.isArray(s.evidence) && s.evidence.length >= 1, `${s.system} missing evidence`);
    }
  });
});

describe('DecisionService.dimensionReadiness()', () => {
  it('returns 10 dimensions', { skip: !store.has('production-readiness-v2') }, () => {
    const dims = svc.dimensionReadiness();
    assert.equal(dims.length, 10, `Expected 10 dimensions, got ${dims.length}`);
  });

  it('Security dimension score is 90', { skip: !store.has('production-readiness-v2') }, () => {
    const dims = svc.dimensionReadiness();
    const sec = dims.find((d) => d.dimension === 'Security');
    assert.ok(sec !== undefined, 'Security dimension must be present');
    assert.equal(sec.score, 90, `Expected Security score = 90, got ${sec.score}`);
  });
});

describe('DecisionService.impactRank()', () => {
  it('returns systems sorted lowest score first (highest priority)', { skip: !store.has('production-readiness') }, () => {
    const ranked = svc.impactRank();
    for (let i = 1; i < ranked.length; i++) {
      const prev = ranked[i - 1];
      const cur = ranked[i];
      if (prev && cur) {
        assert.ok(prev.score <= cur.score, `impactRank not sorted: ${prev.system}(${prev.score}) > ${cur.system}(${cur.score})`);
      }
    }
    // Payments (88) should appear before Architecture (100)
    if (ranked.length >= 2) {
      const paymentsIdx = ranked.findIndex((s) => s.system === 'Payments');
      const archIdx = ranked.findIndex((s) => s.system === 'Architecture');
      if (paymentsIdx >= 0 && archIdx >= 0) {
        assert.ok(paymentsIdx < archIdx, 'Payments (88) should rank before Architecture (100) in impactRank');
      }
    }
  });
});

describe('DecisionService.prioritize()', () => {
  it('prioritize returns items sorted by score descending', () => {
    const items = [
      { id: 'A', severity: '🟡', domain: 'shipping' },
      { id: 'B', severity: '🔴', domain: 'payments' },
      { id: 'C', severity: '🟠', domain: 'merchant' },
    ];
    const ranked = svc.prioritize(items);
    assert.equal(ranked.length, 3);
    // B (🔴 + payments=money) should be rank 1
    assert.equal(ranked[0]?.id, 'B');
    // Ranks should be sequential
    for (let i = 0; i < ranked.length; i++) {
      assert.equal(ranked[i]?.rank, i + 1);
    }
  });

  it('prioritize is deterministic on same input', () => {
    const items = [
      { id: 'X', severity: '🔴', domain: 'orders' },
      { id: 'Y', severity: '🔴', domain: 'orders' },
    ];
    const r1 = svc.prioritize(items);
    const r2 = svc.prioritize(items);
    assert.deepEqual(r1, r2);
  });
});

describe('DecisionService.order()', () => {
  it('order re-ranks provided fixes by score descending', { skip: !store.has('fix-engine') }, () => {
    const fixes = svc.rankFixes();
    // Reverse order and re-rank
    const reversed = [...fixes].reverse();
    const reordered = svc.order(reversed);
    // Should come back in original score order
    const original = svc.rankFixes();
    for (let i = 0; i < Math.min(reordered.length, original.length); i++) {
      const a = reordered[i];
      const b = original[i];
      if (a && b) {
        assert.equal(a.id, b.id, `order()[${i}] mismatch: ${a.id} vs ${b.id}`);
      }
    }
  });
});
