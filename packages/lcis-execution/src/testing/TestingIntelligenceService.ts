/**
 * TestingIntelligenceService — Deliverable 4 of the EIS.
 *
 * Reads the code graph + ChangeAnalyzer footprint to produce:
 *   - detectAffectedTests   → existing test files in the blast radius
 *   - detectMissingCoverage → entities with NO test coverage (coverage gap)
 *   - generateTestPlan      → the full TestPlan artifact
 *   - generate*Plan helpers  → regression / smoke / load / security / acceptance
 *
 * ABSOLUTE READ-ONLY: plans/analyzes/recommends — NEVER executes/mutates/writes/runs.
 * NO fetch/child_process/spawn/exec/eval/writeFile/appendFile/network.
 * Pure deterministic reasoning over the engine + graphify-out artifacts.
 * No AI/LLM. Every output via plan(body, {evidence, now}) → provenance guaranteed.
 */

import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { ChangeAnalyzer, toAnalysis, plan, planConfidence } from '../shared/index';
import type {
  ChangeRequest,
  ChangeAnalysis,
  TestPlan,
  TestTarget,
  TestKind,
  CoverageGap,
  RiskLevel,
} from '../shared/index';
import type { Evidence } from '@letbuyy/lcis-core';

const TEST_RE = /\.(test|spec)\.[tj]sx?$|\/tests?\//i;

/**
 * Critical path terms — if any appear in the blast radius, smoke plan includes them.
 * These are structural keywords, not LLM-generated, matched against affected sets.
 */
const CRITICAL_PATH_TERMS = ['checkout', 'payment', 'auth', 'identity', 'order', 'refund', 'gift_card'];

export class TestingIntelligenceService {
  private readonly analyzer: ChangeAnalyzer;

  constructor(
    private readonly engine: LcisEngine,
    private readonly now = (): string => new Date().toISOString(),
  ) {
    this.analyzer = new ChangeAnalyzer(engine, now);
  }

  // ── detectAffectedTests ──────────────────────────────────────────────────────

  /**
   * For each affected rpc/route/table/domain term, search the graph for test nodes
   * that reference it. Returns existing TestTarget[] — existing tests that must run.
   * Each target cites 'file' evidence. Honest: only returns nodes where sourceFile
   * matches the TEST_RE pattern.
   */
  detectAffectedTests(input: ChangeRequest | ChangeAnalysis): TestTarget[] {
    const analysis = toAnalysis(this.analyzer, input);
    if (analysis.unresolved) return [];

    const targets: TestTarget[] = [];
    const seen = new Set<string>();

    // Collect search terms from rpcs, apis (routes), tables, domains
    const terms = [
      ...analysis.affected.rpcs.slice(0, 6),
      ...analysis.affected.apis.slice(0, 4),
      ...analysis.affected.tables.slice(0, 8),
      ...analysis.affected.domains.slice(0, 4),
    ];

    // Also include any test files the ChangeAnalyzer already found
    for (const f of analysis.affected.tests) {
      if (!seen.has(f)) {
        seen.add(f);
        targets.push({
          kind: 'regression',
          target: f,
          reason: `existing test in blast radius of "${analysis.request.text}"`,
          evidence: [evidence('file', f, 'found in affected tests from ChangeAnalyzer blast', 'graphify-out/graph.json')],
        });
      }
    }

    for (const term of terms) {
      const nodes = this.engine.graph.search(term, 40);
      for (const n of nodes) {
        const f = n.sourceFile;
        if (f && TEST_RE.test(f) && !seen.has(f)) {
          seen.add(f);
          targets.push({
            kind: 'regression' as TestKind,
            target: f,
            reason: `graph search for "${term}" matched test file`,
            evidence: [evidence('file', f, `graph node "${n.id}" (label: "${n.label}") references "${term}"`, 'graphify-out/graph.json')],
          });
        }
      }
    }

    return targets;
  }

  // ── detectMissingCoverage ────────────────────────────────────────────────────

  /**
   * Identifies affected rpcs/routes/tables that have NO matching test file in the graph.
   * Severity: money/tenant entities → 'critical'; general entity with high risk → 'high';
   * else 'medium'. Honest: only flags entities for which no test node is found.
   */
  detectMissingCoverage(input: ChangeRequest | ChangeAnalysis): CoverageGap[] {
    const analysis = toAnalysis(this.analyzer, input);
    if (analysis.unresolved) return [];

    const gaps: CoverageGap[] = [];
    const { money, tenant } = analysis.risk;

    // Entities to check: rpcs + apis + money/tenant tables
    const entityGroups: { kind: 'rpc' | 'route' | 'table'; items: readonly string[] }[] = [
      { kind: 'rpc', items: analysis.affected.rpcs },
      { kind: 'route', items: analysis.affected.apis },
      { kind: 'table', items: analysis.affected.tables },
    ];

    for (const group of entityGroups) {
      for (const entity of group.items) {
        // Check if any test node in the graph references this entity
        const nodes = this.engine.graph.search(entity, 40);
        const hasTest = nodes.some((n) => n.sourceFile && TEST_RE.test(n.sourceFile));

        if (!hasTest) {
          // Determine severity
          let severity: RiskLevel = 'medium';
          const lowerEntity = entity.toLowerCase();
          const isMoneyEntity =
            money &&
            (lowerEntity.includes('payment') ||
              lowerEntity.includes('order') ||
              lowerEntity.includes('ledger') ||
              lowerEntity.includes('refund') ||
              lowerEntity.includes('gift_card') ||
              lowerEntity.includes('payout') ||
              lowerEntity.includes('checkout'));
          const isTenantEntity =
            tenant &&
            (lowerEntity.includes('site') ||
              lowerEntity.includes('store') ||
              lowerEntity.includes('tenant') ||
              lowerEntity.includes('merchant'));

          if (isMoneyEntity) {
            severity = 'critical';
          } else if (isTenantEntity || analysis.risk.level === 'high' || analysis.risk.level === 'critical') {
            severity = 'high';
          }

          gaps.push({
            subject: entity,
            kind: group.kind === 'rpc' ? 'unit' : group.kind === 'route' ? 'integration' : 'unit',
            severity,
            note: `no test file found referencing "${entity}" (${group.kind}); ${money ? 'money-ledger ' : ''}${tenant ? 'multi-tenant ' : ''}risk applies`,
            evidence: [
              evidence(
                group.kind === 'table' ? 'table' : group.kind === 'route' ? 'route' : 'rpc',
                entity,
                `no matching test node found in graph for "${entity}"`,
                'graphify-out/graph.json',
              ),
            ],
          });
        }
      }
    }

    return gaps;
  }

  // ── generateTestPlan ─────────────────────────────────────────────────────────

  /**
   * Composes the full TestPlan artifact:
   *   required   = detectAffectedTests (existing tests that must run)
   *   missing    = detectMissingCoverage (gaps — entities with no test)
   *   recommended = defense-in-depth suggestions for elevated-risk blast
   *   *Plan      = the 5 per-kind plan helpers
   *   coverageConfidence = entities-with-tests / total-affected-entities (0 when nothing)
   */
  generateTestPlan(input: ChangeRequest | ChangeAnalysis): TestPlan {
    const analysis = toAnalysis(this.analyzer, input);
    const required = this.detectAffectedTests(analysis);
    const missing = this.detectMissingCoverage(analysis);
    const regressionPlan = this.generateRegressionPlan(analysis);
    const smokePlan = this.generateSmokePlan(analysis);
    const loadPlan = this.generateLoadPlan(analysis);
    const securityPlan = this.generateSecurityPlan(analysis);
    const acceptancePlan = this.generateAcceptancePlan(analysis);

    // Collect all evidence
    const ev: Evidence[] = [
      ...analysis.evidence,
      ...required.flatMap((t) => t.evidence),
      ...missing.flatMap((g) => g.evidence),
    ];

    // coverageConfidence: entities that have at least one test / total entities
    const totalEntities =
      analysis.affected.rpcs.length +
      analysis.affected.apis.length +
      analysis.affected.tables.length +
      analysis.affected.domains.length;
    const coveredCount = required.length; // each TestTarget is a covered test file
    const coverageConfidence = totalEntities === 0 ? 0 : Math.min(coveredCount / Math.max(totalEntities, 1), 1);

    // Recommended: for elevated risk, suggest adding security + acceptance targets
    const recommended: TestTarget[] = [];
    if (analysis.risk.money) {
      recommended.push({
        kind: 'security',
        target: 'money-ledger canonical-RPC paths',
        reason: 'money table in blast radius — canonical-ledger-only validator must be covered by security/integration test',
        evidence: [evidence('rpc', 'canonical-money-rpcs', 'money=true in risk assessment', 'graphify-out/db-intel.json')],
      });
    }
    if (analysis.risk.tenant) {
      recommended.push({
        kind: 'integration',
        target: 'multi-tenant RLS isolation',
        reason: 'tenant table in blast radius — cross-tenant isolation must be verified',
        evidence: [evidence('table', 'sites', 'tenant=true in risk assessment', 'graphify-out/db-intel.json')],
      });
    }
    if (analysis.risk.level === 'high' || analysis.risk.level === 'critical') {
      recommended.push({
        kind: 'contract',
        target: 'affected API contracts',
        reason: `elevated risk (${analysis.risk.level}) — API contract tests recommended before merge`,
        evidence: [evidence('artifact-field', `risk:${analysis.risk.level}`, 'risk assessment from ChangeAnalyzer', 'graphify-out/domain-intel.json')],
      });
    }

    const body = {
      request: analysis.request,
      required,
      missing,
      recommended,
      regressionPlan,
      smokePlan,
      loadPlan,
      securityPlan,
      acceptancePlan,
      riskLevel: analysis.risk.level,
      coverageConfidence: Math.round(coverageConfidence * 100) / 100,
    };

    return plan(body, { evidence: ev, confidence: planConfidence(ev, 0.4), now: this.now });
  }

  // ── per-kind plan helpers ────────────────────────────────────────────────────

  /**
   * Regression plan: affected existing test files that must re-run after this change.
   */
  generateRegressionPlan(input: ChangeRequest | ChangeAnalysis): TestTarget[] {
    const analysis = toAnalysis(this.analyzer, input);
    if (analysis.unresolved) return [];
    return this.detectAffectedTests(analysis).map((t) => ({
      ...t,
      kind: 'regression' as TestKind,
    }));
  }

  /**
   * Smoke plan: critical path tests — checkout / payment / auth / identity / order /
   * refund / gift_card — if any of those terms appear in the blast radius.
   */
  generateSmokePlan(input: ChangeRequest | ChangeAnalysis): TestTarget[] {
    const analysis = toAnalysis(this.analyzer, input);
    if (analysis.unresolved) return [];

    const blastTerms = [
      ...analysis.affected.domains,
      ...analysis.affected.rpcs,
      ...analysis.affected.apis,
      ...analysis.affected.tables,
    ].map((s) => s.toLowerCase());

    const targets: TestTarget[] = [];
    const seen = new Set<string>();

    for (const term of CRITICAL_PATH_TERMS) {
      const inBlast = blastTerms.some((b) => b.includes(term));
      if (!inBlast) continue;

      // Search graph for test nodes matching this critical-path term
      const nodes = this.engine.graph.search(term, 30);
      for (const n of nodes) {
        const f = n.sourceFile;
        if (f && TEST_RE.test(f) && !seen.has(f)) {
          seen.add(f);
          targets.push({
            kind: 'smoke',
            target: f,
            reason: `critical-path term "${term}" is in the blast radius and this test covers it`,
            evidence: [evidence('file', f, `critical path: "${term}" found in blast + graph`, 'graphify-out/graph.json')],
          });
        }
      }
    }

    return targets;
  }

  /**
   * Load plan: affected routes + workers — these are the throughput targets
   * for load/performance testing when the change touches them.
   */
  generateLoadPlan(input: ChangeRequest | ChangeAnalysis): TestTarget[] {
    const analysis = toAnalysis(this.analyzer, input);
    if (analysis.unresolved) return [];

    const targets: TestTarget[] = [];

    for (const route of analysis.affected.apis) {
      targets.push({
        kind: 'load',
        target: route,
        reason: `affected API route "${route}" — load test required to ensure throughput SLO holds`,
        evidence: [evidence('route', route, 'in affected.apis from blast radius', 'graphify-out/domain-intel.json')],
      });
    }

    for (const worker of analysis.affected.workers) {
      targets.push({
        kind: 'load',
        target: worker,
        reason: `affected worker "${worker}" — queue throughput + idempotency test required`,
        evidence: [evidence('worker', worker, 'in affected.workers from blast radius', 'graphify-out/domain-intel.json')],
      });
    }

    return targets;
  }

  /**
   * Security plan: elevated when money/tenant/auth is in the blast radius.
   * Targets the affected RPCs and any RLS/policy surface.
   */
  generateSecurityPlan(input: ChangeRequest | ChangeAnalysis): TestTarget[] {
    const analysis = toAnalysis(this.analyzer, input);
    if (analysis.unresolved) return [];

    const { money, tenant } = analysis.risk;
    const blastStr = [
      ...analysis.affected.domains,
      ...analysis.affected.apis,
      ...analysis.affected.rpcs,
      ...analysis.affected.tables,
    ]
      .join(' ')
      .toLowerCase();

    const hasAuth = blastStr.includes('auth') || blastStr.includes('identity') || blastStr.includes('jwt') || blastStr.includes('session');
    const elevated = money || tenant || hasAuth;
    if (!elevated) return [];

    const targets: TestTarget[] = [];
    const seen = new Set<string>();

    // Target each affected RPC as a security test subject
    for (const rpc of analysis.affected.rpcs) {
      if (!seen.has(rpc)) {
        seen.add(rpc);
        targets.push({
          kind: 'security',
          target: rpc,
          reason: `RPC "${rpc}" is in blast radius with ${money ? 'money ' : ''}${tenant ? 'tenant ' : ''}${hasAuth ? 'auth ' : ''}exposure`,
          evidence: [
            evidence(
              'rpc',
              rpc,
              `security test required: money=${money}, tenant=${tenant}, auth=${hasAuth}`,
              'graphify-out/db-intel.json',
            ),
          ],
        });
      }
    }

    // For money: add canonical-ledger-RPC coverage requirement
    if (money) {
      targets.push({
        kind: 'security',
        target: 'canonical-ledger-only-validator',
        reason: 'money table in blast — canonical-ledger-only-validator must be exercised (no direct .insert/update on money tables)',
        evidence: [evidence('validator', 'canonical-ledger-only-validator', 'money=true', 'graphify-out/db-intel.json')],
      });
    }

    // For tenant: add RLS isolation target
    if (tenant) {
      targets.push({
        kind: 'security',
        target: 'RLS-tenant-isolation',
        reason: 'tenant table in blast — Row-Level Security cross-tenant isolation must be verified',
        evidence: [evidence('policy', 'rls-tenant-isolation', 'tenant=true', 'graphify-out/db-intel.json')],
      });
    }

    return targets;
  }

  /**
   * Acceptance plan: one acceptance TestTarget per affected domain, anchored to
   * business behavior evidence.
   */
  generateAcceptancePlan(input: ChangeRequest | ChangeAnalysis): TestTarget[] {
    const analysis = toAnalysis(this.analyzer, input);
    if (analysis.unresolved) return [];

    return analysis.affected.domains.map((domain) => ({
      kind: 'acceptance' as TestKind,
      target: domain,
      reason: `domain "${domain}" is in the blast radius — acceptance criteria must hold after this change`,
      evidence: [
        evidence(
          'artifact-field',
          `domain:${domain}`,
          `"${domain}" in affected.domains from impact analysis`,
          'graphify-out/domain-intel.json',
        ),
      ],
    }));
  }
}
