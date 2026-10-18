/**
 * analyzePr — LCIS PR Intelligence core analyzer.
 *
 * Consumes @letbuyy/lcis-core exclusively. Read-only; no writes, no SQL, no network.
 * Every finding is deterministic and evidence-cited.
 *
 * analyzeWithVerdicts() is the async V2 entry point that also runs the six EIS
 * verdicts (architecture / security / migration / coverage / launch / rollback).
 * The original synchronous-compatible analyzePr() is preserved intact; it returns
 * verdicts: [] so all existing callers and tests continue to work without change.
 */
import { createEngine, evidence } from '@letbuyy/lcis-core';
import type { LcisEngine, Evidence } from '@letbuyy/lcis-core';
import { createEisEngine } from '@letbuyy/lcis-execution';
import type { EisEngine, ReviewVerdict } from '@letbuyy/lcis-execution';
import { createGovernanceEngine } from '@letbuyy/lcis-governance';
import type { GovernanceEngine, GovernanceVerdict } from '@letbuyy/lcis-governance';
import { createOperationsEngine } from '@letbuyy/lcis-operations';
import type { OperationsEngine, OperationalVerdict } from '@letbuyy/lcis-operations';
import { createEngineeringEngine } from '@letbuyy/lcis-engineering';
import type { EngineeringEngine, EngineeringVerdict } from '@letbuyy/lcis-engineering';
import { createOrchestrationEngine } from '@letbuyy/lcis-orchestration';
import type { OrchestrationEngine, ExecutionVerdict, ExecutionHealth } from '@letbuyy/lcis-orchestration';
import { PrInputSchema } from './types';
import type { PrInput, PrReport, AffectedDomain, RiskLevel, SensitivityFlags } from './types';
import {
  filePathToDomain,
  DOMAIN_TO_SERVICES,
  matchesAny,
  AUTH_PATTERNS,
  PAYMENT_PATTERNS,
  RLS_PATTERNS,
  MIGRATION_PATTERNS,
  TENANT_PATTERNS,
  VALIDATOR_PATTERNS,
  SECURITY_PATTERNS,
} from './domain-map';

// ── Domain label lookup (from ArchitectureService NARRATIVE map keys) ──────
const DOMAIN_LABELS: Record<string, string> = {
  payments: 'Payments',
  orders: 'Orders',
  refunds: 'Refunds',
  payouts: 'Payouts',
  'gift-cards': 'Gift Cards',
  inventory: 'Inventory',
  products: 'Products',
  collections: 'Collections',
  discounts: 'Discounts',
  shipping: 'Shipping',
  gst: 'GST',
  authentication: 'Authentication',
  authorization: 'Authorization',
  identity: 'Identity',
  merchant: 'Merchant',
  notifications: 'Notifications',
  analytics: 'Analytics',
  themes: 'Themes',
  storefront: 'Storefront',
  marketplace: 'Marketplace',
  developer: 'Developer',
  operations: 'Operations',
};

/** Money domains — canonical-ledger-only-validator applies */
const MONEY_DOMAINS = new Set(['payments', 'refunds', 'payouts', 'gift-cards', 'orders']);

/** Tenant-scoped domains */
const TENANT_DOMAINS = new Set([
  'payments', 'orders', 'refunds', 'payouts', 'gift-cards', 'inventory',
  'products', 'collections', 'discounts', 'shipping', 'gst', 'identity',
  'merchant', 'notifications', 'analytics', 'themes', 'storefront',
]);

/** Frozen apps — touching these is an architecture warning */
const FROZEN_APPS = new Map([
  ['apps/frozen/app-store', 'app-marketplace'],
  ['apps/frozen/developer-portal', 'developer-portal'],
  ['apps/frozen/theme-store', 'theme-marketplace'],
  ['apps/frozen/operations-portal', 'platform-operations-portal'],
]);

/** Deprecated aliases — touching these is an architecture warning */
const DEPRECATED_ALIASES = new Set([
  'apps/admin', 'apps/auth', 'apps/checkout', 'apps/internal',
  'apps/merchant', 'apps/storefront', 'apps/analytics',
]);

// ── Risk derivation ─────────────────────────────────────────────────────────

function deriveRisk(
  sensitivity: SensitivityFlags,
  affectedDomains: AffectedDomain[],
  blastNodes: number,
): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let level: RiskLevel = 'LOW';

  const bump = (to: RiskLevel, reason: string): void => {
    reasons.push(reason);
    const ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (ORDER.indexOf(to) > ORDER.indexOf(level)) level = to;
  };

  // Money / payment path → CRITICAL
  if (sensitivity.paymentRelated) {
    bump('CRITICAL', 'paymentRelated=true — canonical-ledger-only-validator, HMAC, step-up apply');
  }

  // Migration → HIGH (schema changes are irreversible)
  if (sensitivity.migrationRelated) {
    bump('HIGH', 'migrationRelated=true — SQL migrations are irreversible schema changes');
  }

  // Auth → HIGH
  if (sensitivity.authRelated) {
    bump('HIGH', 'authRelated=true — session issuance / JWT / OAuth in scope');
  }

  // Security-sensitive files → HIGH
  if (sensitivity.securitySensitive) {
    bump('HIGH', 'securitySensitive=true — HMAC / JWT / Turnstile / CORS / signing files touched');
  }

  // RLS / tenant isolation → HIGH
  if (sensitivity.rlsRelated) {
    bump('HIGH', 'rlsRelated=true — row-level security policies in scope');
  }
  if (sensitivity.tenantIsolation) {
    bump('HIGH', 'tenantIsolation=true — multi-tenant isolation (site_id / verifySiteOwnership) touched');
  }

  // Cross-domain → MEDIUM floor
  if (sensitivity.crossDomain) {
    bump('MEDIUM', 'crossDomain=true — changes span multiple LCIS domains');
  }

  // Validator/governance impact → MEDIUM
  if (sensitivity.validatorImpact) {
    bump('MEDIUM', 'validatorImpact=true — governance validators or AGENTS.md/CLAUDE.md touched');
  }

  // Money domains in affected set
  const moneyDomainHits = affectedDomains.filter((d) => d.money).map((d) => d.key);
  if (moneyDomainHits.length > 0) {
    bump('CRITICAL', `${moneyDomainHits.length} money domain(s) affected: ${moneyDomainHits.join(', ')}`);
  }

  // Blast radius thresholds
  if (blastNodes > 100) {
    bump('HIGH', `blast radius = ${blastNodes} impacted nodes (threshold: >100)`);
  } else if (blastNodes > 30) {
    bump('MEDIUM', `blast radius = ${blastNodes} impacted nodes (threshold: >30)`);
  }

  // Docs-only safety floor — if nothing bumped above LOW, confirm LOW
  if (level === 'LOW') {
    reasons.push('no sensitive patterns detected; blast radius within LOW thresholds');
  }

  return { level, reasons };
}

// ── Source-file → node-id index (built once per engine instance) ────────────
//
// The WeakMap key is the engine itself so the index is reused across calls
// within the same process (singleton engine) but correctly scoped to test-stub
// engines that have no graph nodes at all.

const sourceFileIndexCache = new WeakMap<LcisEngine, Map<string, string[]>>();

function getSourceFileIndex(engine: LcisEngine): Map<string, string[]> {
  const cached = sourceFileIndexCache.get(engine);
  if (cached) return cached;
  const index = new Map<string, string[]>();
  try {
    for (const node of engine.graph.nodes()) {
      if (node.sourceFile) {
        const ids = index.get(node.sourceFile) ?? [];
        if (ids.length === 0) index.set(node.sourceFile, ids);
        ids.push(node.id);
      }
    }
  } catch {
    // Stub engine with no artifact — index stays empty; no blast contribution.
  }
  sourceFileIndexCache.set(engine, index);
  return index;
}

// ── Blast a set of seed node ids, returning aggregate impacted ids ───────────
//
// Delegates to engine.blast.blast() per resolved node (same BFS logic, no
// duplication of graph traversal). Unions the impacted sets to avoid double-
// counting when multiple nodes in the same file are changed.

function blastFromNodeIds(engine: LcisEngine, nodeIds: string[]): {
  impactedNodeIds: Set<string>;
  impactedFiles: Set<string>;
} {
  const impactedNodeIds = new Set<string>();
  const impactedFiles = new Set<string>();

  for (const id of nodeIds) {
    const node = engine.graph.node(id);
    if (!node) continue;
    // Resolve by id first (exact lookup), then by label as fallback.
    const blastResult = engine.blast.blast(node.id) ?? engine.blast.blast(node.label);
    if (!blastResult) continue;
    // Collect from topImpacted (capped) + walk the full impacted count using
    // the graph traverse helper available on GraphService.
    // We prefer to re-use the full engine.graph.traverse so we honour the same
    // depth (3) and direction ('in') as BlastRadiusService.blast().
    const reached = engine.graph.traverse(id, 3, 'in');
    for (const rid of reached) {
      if (!impactedNodeIds.has(rid)) {
        impactedNodeIds.add(rid);
        const rNode = engine.graph.node(rid);
        if (rNode?.sourceFile) impactedFiles.add(rNode.sourceFile);
      }
    }
  }
  return { impactedNodeIds, impactedFiles };
}

// ── EIS verdict builder ────────────────────────────────────────────────────
//
// Builds the six ReviewVerdict objects from the EIS engine and the PR analysis
// footprint. Each verdict is evidence-cited; UNKNOWN is returned whenever a
// signal cannot be determined (never fabricated as PASS).

async function buildVerdicts(
  eis: EisEngine,
  report: PrReport,
  changedFiles: string[],
): Promise<ReviewVerdict[]> {
  // Build a ChangeRequest from the PR: unique domain keys + changed files
  const domainKeys = [...new Set(report.affectedDomains.map((d) => d.key))];
  const req = {
    text: 'PR review',
    domains: domainKeys,
    files: changedFiles,
  };

  const verdicts: ReviewVerdict[] = [];

  // ── 1. Architecture ─────────────────────────────────────────────────────
  try {
    const analysis = eis.analyze(req);
    const crossDomain = domainKeys.length > 1;
    const blastHigh = report.blastRadius.affectedNodes > 100;
    const hasFrozen = report.architectureWarnings.some((w) => w.includes('[frozen-app]'));
    const hasDeprecated = report.architectureWarnings.some((w) => w.includes('[deprecated-alias]'));

    const archFindings: string[] = [];
    if (hasFrozen) archFindings.push('Frozen app(s) touched — requires ARB approval');
    if (hasDeprecated) archFindings.push('Deprecated alias(es) referenced — do not recreate');
    if (crossDomain) archFindings.push(`Cross-domain blast: ${domainKeys.join(', ')}`);
    if (blastHigh) archFindings.push(`Blast radius ${report.blastRadius.affectedNodes} nodes > threshold 100`);

    const archVerdict: ReviewVerdict['verdict'] =
      hasFrozen || hasDeprecated ? 'FAIL'
      : crossDomain || blastHigh ? 'WARN'
      : 'PASS';

    const archSummary =
      archVerdict === 'FAIL' ? 'Frozen/deprecated code touched — ARB required'
      : archVerdict === 'WARN' ? `Cross-domain or high-blast change (${domainKeys.length} domain(s), ${report.blastRadius.affectedNodes} nodes)`
      : 'No architecture violations detected';

    verdicts.push({
      dimension: 'architecture',
      verdict: archVerdict,
      summary: archSummary,
      findings: archFindings,
      evidence: analysis.evidence.slice(0, 5),
    });
  } catch {
    verdicts.push({
      dimension: 'architecture',
      verdict: 'UNKNOWN',
      summary: 'Architecture analysis unavailable (engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 2. Security ─────────────────────────────────────────────────────────
  try {
    const secPlan = eis.testing.generateSecurityPlan(req);
    const { paymentRelated, authRelated, securitySensitive, rlsRelated, tenantIsolation } = report.sensitivity;
    const hasMoneyDomain = report.affectedDomains.some((d) => d.money);

    const secFindings: string[] = [];
    if (paymentRelated) secFindings.push('Payment/ledger files touched — canonical-ledger-only-validator + step-up gate required');
    if (authRelated) secFindings.push('Auth/session/JWT files touched — identity-platform reviewer required');
    if (securitySensitive) secFindings.push('HMAC/JWT/Turnstile/CORS/signing files in scope — security review required');
    if (rlsRelated) secFindings.push('RLS policy files touched — multi-tenant isolation review required');
    if (tenantIsolation) secFindings.push('site_id/verifySiteOwnership touched — tenant isolation review required');
    if (hasMoneyDomain && secPlan.length === 0) secFindings.push('Money domain affected but no security test plan found');

    const secVerdict: ReviewVerdict['verdict'] =
      (paymentRelated && hasMoneyDomain) || rlsRelated ? 'FAIL'
      : authRelated || securitySensitive || tenantIsolation ? 'WARN'
      : 'PASS';

    const secSummary =
      secVerdict === 'FAIL' ? 'CRITICAL: money/RLS paths touched — security block required'
      : secVerdict === 'WARN' ? 'Auth/security-sensitive files in scope — reviewer required'
      : 'No elevated security signals detected';

    verdicts.push({
      dimension: 'security',
      verdict: secVerdict,
      summary: secSummary,
      findings: secFindings,
      evidence: secPlan.flatMap((t) => t.evidence).slice(0, 5),
    });
  } catch {
    verdicts.push({
      dimension: 'security',
      verdict: 'UNKNOWN',
      summary: 'Security analysis unavailable (engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 3. Migration ─────────────────────────────────────────────────────────
  try {
    const readiness = eis.migration.verifyMigrationReadiness(req);
    const migFindings: string[] = [
      ...readiness.blockers.map((b) => `BLOCKER: ${b.slice(0, 120)}`),
      ...readiness.warnings.map((w) => `WARNING: ${w.slice(0, 120)}`),
    ];

    const migVerdict: ReviewVerdict['verdict'] =
      !readiness.ready ? 'FAIL'
      : readiness.warnings.length > 0 ? 'WARN'
      : report.sensitivity.migrationRelated ? 'WARN'
      : 'PASS';

    const migSummary =
      migVerdict === 'FAIL' ? `Migration blocked: ${readiness.blockers.length} blocker(s) — human DBA review required`
      : migVerdict === 'WARN' ? `Migration warnings: ${readiness.warnings.length} warning(s) or SQL files touched`
      : 'No migration blockers detected';

    verdicts.push({
      dimension: 'migration',
      verdict: migVerdict,
      summary: migSummary,
      findings: migFindings,
      evidence: readiness.evidence.slice(0, 5),
    });
  } catch {
    verdicts.push({
      dimension: 'migration',
      verdict: 'UNKNOWN',
      summary: 'Migration readiness unavailable (engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 4. Coverage ──────────────────────────────────────────────────────────
  try {
    const testPlan = eis.testing.generateTestPlan(req);
    const { missing, required: requiredTests, coverageConfidence } = testPlan;

    if (report.affectedDomains.length === 0 && changedFiles.length === 0) {
      verdicts.push({
        dimension: 'coverage',
        verdict: 'UNKNOWN',
        summary: 'No affected domains — coverage cannot be determined',
        findings: [],
        evidence: [],
      });
    } else {
      const criticalGaps = missing.filter((g) => g.severity === 'critical');
      const highGaps = missing.filter((g) => g.severity === 'high');
      const covFindings = [
        ...criticalGaps.map((g) => `CRITICAL gap: ${g.subject} (${g.kind}) — ${g.note.slice(0, 100)}`),
        ...highGaps.map((g) => `HIGH gap: ${g.subject} (${g.kind}) — ${g.note.slice(0, 100)}`),
        requiredTests.length > 0 ? `${requiredTests.length} existing test(s) must re-run` : '',
        `Coverage confidence: ${Math.round(coverageConfidence * 100)}%`,
      ].filter(Boolean);

      const covVerdict: ReviewVerdict['verdict'] =
        criticalGaps.length > 0 ? 'FAIL'
        : highGaps.length > 0 || coverageConfidence < 0.3 ? 'WARN'
        : 'PASS';

      const covSummary =
        covVerdict === 'FAIL' ? `${criticalGaps.length} critical coverage gap(s) — money/tenant paths untested`
        : covVerdict === 'WARN' ? `${highGaps.length} high coverage gap(s); confidence ${Math.round(coverageConfidence * 100)}%`
        : `Coverage acceptable (confidence ${Math.round(coverageConfidence * 100)}%)`;

      verdicts.push({
        dimension: 'coverage',
        verdict: covVerdict,
        summary: covSummary,
        findings: covFindings as string[],
        evidence: missing.flatMap((g) => g.evidence).slice(0, 5),
      });
    }
  } catch {
    verdicts.push({
      dimension: 'coverage',
      verdict: 'UNKNOWN',
      summary: 'Coverage analysis unavailable (engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 5. Launch ────────────────────────────────────────────────────────────
  try {
    const goNoGo = await eis.launch.generateGoNoGoDecision(req);
    const launchFindings: string[] = [
      `Decision: ${goNoGo.decision} — ${goNoGo.rationale.slice(0, 120)}`,
      ...goNoGo.blockers.map((b) => `Blocker [${b.id}]: ${b.title} (${b.state}/${b.severity})`),
      ...goNoGo.unknowns.slice(0, 3).map((u) => `Unknown: ${u.slice(0, 100)}`),
    ];

    const launchVerdict: ReviewVerdict['verdict'] =
      goNoGo.decision === 'GO' ? 'PASS'
      : goNoGo.decision === 'CONDITIONAL_GO' ? 'WARN'
      : 'FAIL';

    const launchSummary =
      launchVerdict === 'PASS' ? 'Launch GO — no structural blockers detected'
      : launchVerdict === 'WARN' ? `Launch CONDITIONAL_GO — ${goNoGo.unknowns.length} unknown(s) or warnings`
      : `Launch NO_GO — ${goNoGo.blockers.length} blocker(s) must be resolved`;

    verdicts.push({
      dimension: 'launch',
      verdict: launchVerdict,
      summary: launchSummary,
      findings: launchFindings,
      evidence: goNoGo.evidence.slice(0, 5),
    });
  } catch {
    verdicts.push({
      dimension: 'launch',
      verdict: 'UNKNOWN',
      summary: 'Launch readiness unavailable (engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 6. Rollback ──────────────────────────────────────────────────────────
  try {
    const rollback = eis.rollback.generateRollbackPlan(req);
    const rollbackFindings: string[] = [
      `Readiness: ${rollback.readiness}`,
      `Complexity: ${rollback.complexity}`,
      ...rollback.irreversible.map((i) => `Irreversible: ${i.subject} — ${i.reason.slice(0, 80)}`),
      `Estimated recovery: ${rollback.estimatedRecovery}`,
    ];

    const rbVerdict: ReviewVerdict['verdict'] =
      rollback.readiness === 'READY' ? 'PASS'
      : rollback.readiness === 'CONDITIONAL' ? 'WARN'
      : 'FAIL';

    const rbSummary =
      rbVerdict === 'PASS' ? 'Rollback READY — all changes reversible'
      : rbVerdict === 'WARN' ? `Rollback CONDITIONAL — ${rollback.irreversible.length} irreversible item(s)`
      : `Rollback NOT_READY — critical irreversibility (money/data-loss risk)`;

    verdicts.push({
      dimension: 'rollback',
      verdict: rbVerdict,
      summary: rbSummary,
      findings: rollbackFindings,
      evidence: rollback.evidence.slice(0, 5),
    });
  } catch {
    verdicts.push({
      dimension: 'rollback',
      verdict: 'UNKNOWN',
      summary: 'Rollback analysis unavailable (engine error)',
      findings: [],
      evidence: [],
    });
  }

  return verdicts;
}

// ── GDIS governance verdict builder ─────────────────────────────────────────
//
// Runs the six GDIS reports and FILTERS their findings to entities that match
// the PR's affected domain keys, tables, or rpcs. Then maps to six
// GovernanceVerdicts: architecture-drift, compliance, ownership, security-drift,
// readiness, governance. UNKNOWN is returned when nothing can be determined.
// Never fabricates a PASS.

async function buildGovernanceVerdicts(
  gov: GovernanceEngine,
  report: PrReport,
): Promise<GovernanceVerdict[]> {
  // The subject-match set: affected domain keys (case-insensitive prefix/substring).
  // We also match against any short label (e.g. 'payments', 'orders').
  const affectedKeys = new Set(report.affectedDomains.map((d) => d.key.toLowerCase()));

  /** Returns true if a finding/gap/score subject is relevant to this PR. */
  function isRelevant(subject: string): boolean {
    if (affectedKeys.size === 0) return false;
    const s = subject.toLowerCase();
    for (const key of affectedKeys) {
      if (s.includes(key) || key.includes(s)) return true;
    }
    return false;
  }

  const govVerdicts: GovernanceVerdict[] = [];

  // ── 1. Architecture Drift ──────────────────────────────────────────────────
  try {
    const driftReport = gov.drift.generateDriftReport();
    const relevant = driftReport.findings.filter((f) => isRelevant(f.subject));

    let verdict: GovernanceVerdict['verdict'];
    if (relevant.length === 0) {
      verdict = affectedKeys.size === 0 ? 'UNKNOWN' : 'PASS';
    } else {
      const maxSev = relevant.reduce<string>((acc, f) => {
        const order = ['info', 'low', 'medium', 'high', 'critical'];
        return order.indexOf(f.severity) > order.indexOf(acc) ? f.severity : acc;
      }, 'info');
      verdict = (maxSev === 'critical' || maxSev === 'high') ? 'FAIL' : 'WARN';
    }

    const findings = relevant.slice(0, 8).map(
      (f) => `[${f.severity.toUpperCase()}] ${f.subject} — ${f.title}: ${f.detail.slice(0, 100)}`,
    );
    const summary =
      verdict === 'PASS' ? `No architecture drift detected for affected domains (${affectedKeys.size} domain(s))`
      : verdict === 'UNKNOWN' ? 'No affected domains — architecture drift indeterminate'
      : verdict === 'FAIL' ? `${relevant.length} critical/high architecture drift finding(s) in affected domains`
      : `${relevant.length} architecture drift finding(s) in affected domains (${driftReport.findings.length} total)`;

    govVerdicts.push({
      dimension: 'architecture-drift',
      verdict,
      summary,
      findings,
      evidence: relevant.flatMap((f) => f.evidence).slice(0, 5),
    });
  } catch {
    govVerdicts.push({
      dimension: 'architecture-drift',
      verdict: 'UNKNOWN',
      summary: 'Architecture drift analysis unavailable (governance engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 2. Compliance ──────────────────────────────────────────────────────────
  try {
    const compReport = gov.compliance.generateComplianceReport();
    const relevant = compReport.violations.filter((f) => isRelevant(f.subject));

    let verdict: GovernanceVerdict['verdict'];
    if (relevant.length === 0) {
      verdict = affectedKeys.size === 0 ? 'UNKNOWN' : 'PASS';
    } else {
      verdict = 'FAIL'; // Any compliance violation for an affected entity is a FAIL
    }

    const findings = relevant.slice(0, 8).map(
      (f) => `[${f.rule ?? f.kind}] ${f.subject} — ${f.title}: ${f.detail.slice(0, 100)}`,
    );
    const summary =
      verdict === 'PASS' ? `No compliance violations for affected domains (score ${compReport.score}/100)`
      : verdict === 'UNKNOWN' ? 'No affected domains — compliance indeterminate'
      : `${relevant.length} compliance violation(s) in affected domains (overall score ${compReport.score}/100)`;

    govVerdicts.push({
      dimension: 'compliance',
      verdict,
      summary,
      findings,
      evidence: relevant.flatMap((f) => f.evidence).slice(0, 5),
    });
  } catch {
    govVerdicts.push({
      dimension: 'compliance',
      verdict: 'UNKNOWN',
      summary: 'Compliance analysis unavailable (governance engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 3. Ownership ───────────────────────────────────────────────────────────
  try {
    const ownerReport = gov.ownership.generateOwnershipReport();
    const relevant = ownerReport.gaps.filter((g) => isRelevant(g.subject));

    let verdict: GovernanceVerdict['verdict'];
    if (relevant.length === 0) {
      verdict = affectedKeys.size === 0 ? 'UNKNOWN' : 'PASS';
    } else {
      const maxSev = relevant.reduce<string>((acc, g) => {
        const order = ['info', 'low', 'medium', 'high', 'critical'];
        return order.indexOf(g.severity) > order.indexOf(acc) ? g.severity : acc;
      }, 'info');
      verdict = (maxSev === 'critical' || maxSev === 'high') ? 'FAIL' : 'WARN';
    }

    const findings = relevant.slice(0, 8).map(
      (g) => `[${g.severity.toUpperCase()}] Unowned ${g.entityType}: ${g.subject}`,
    );
    const summary =
      verdict === 'PASS' ? `All affected domains have declared owners`
      : verdict === 'UNKNOWN' ? 'No affected domains — ownership indeterminate'
      : verdict === 'FAIL' ? `${relevant.length} critical/high ownership gap(s) in affected domains`
      : `${relevant.length} ownership gap(s) in affected domains`;

    govVerdicts.push({
      dimension: 'ownership',
      verdict,
      summary,
      findings,
      evidence: relevant.flatMap((g) => g.evidence).slice(0, 5),
    });
  } catch {
    govVerdicts.push({
      dimension: 'ownership',
      verdict: 'UNKNOWN',
      summary: 'Ownership analysis unavailable (governance engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 4. Security Drift ──────────────────────────────────────────────────────
  try {
    const secReport = gov.security.generateSecurityDriftReport();
    const relevant = secReport.findings.filter((f) => isRelevant(f.subject));

    let verdict: GovernanceVerdict['verdict'];
    if (relevant.length === 0) {
      verdict = affectedKeys.size === 0 ? 'UNKNOWN' : 'PASS';
    } else {
      const maxSev = relevant.reduce<string>((acc, f) => {
        const order = ['info', 'low', 'medium', 'high', 'critical'];
        return order.indexOf(f.severity) > order.indexOf(acc) ? f.severity : acc;
      }, 'info');
      verdict = (maxSev === 'critical' || maxSev === 'high') ? 'FAIL' : 'WARN';
    }

    const findings = relevant.slice(0, 8).map(
      (f) => `[${f.severity.toUpperCase()}] ${f.subject} — ${f.title}: ${f.detail.slice(0, 100)}`,
    );
    const summary =
      verdict === 'PASS' ? `No security drift detected in affected domains`
      : verdict === 'UNKNOWN' ? 'No affected domains — security drift indeterminate'
      : verdict === 'FAIL' ? `${relevant.length} critical/high security drift finding(s) in affected domains`
      : `${relevant.length} security drift finding(s) in affected domains`;

    govVerdicts.push({
      dimension: 'security-drift',
      verdict,
      summary,
      findings,
      evidence: relevant.flatMap((f) => f.evidence).slice(0, 5),
    });
  } catch {
    govVerdicts.push({
      dimension: 'security-drift',
      verdict: 'UNKNOWN',
      summary: 'Security drift analysis unavailable (governance engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 5. Readiness ───────────────────────────────────────────────────────────
  try {
    const readReport = await gov.readiness.generateReadinessReport();
    const relevant = readReport.scores.filter((s) => isRelevant(s.subject));

    let verdict: GovernanceVerdict['verdict'];
    if (relevant.length === 0) {
      verdict = affectedKeys.size === 0 ? 'UNKNOWN' : 'PASS';
    } else {
      const hasNotReady = relevant.some((s) => s.band === 'not-ready');
      const hasConditional = relevant.some((s) => s.band === 'conditional');
      verdict = hasNotReady ? 'FAIL' : hasConditional ? 'WARN' : 'PASS';
    }

    const findings = relevant.slice(0, 8).map(
      (s) => `[${s.band.toUpperCase()}] ${s.subject} — readiness ${s.score}/100 (${s.unknowns.length} unknown factor(s))`,
    );
    const summary =
      verdict === 'PASS' ? `All affected domains are ready or above conditional threshold`
      : verdict === 'UNKNOWN' ? 'No affected domains — readiness indeterminate'
      : verdict === 'FAIL' ? `${relevant.filter((s) => s.band === 'not-ready').length} domain(s) not-ready in affected PR scope`
      : `${relevant.filter((s) => s.band === 'conditional').length} domain(s) conditional in affected PR scope`;

    govVerdicts.push({
      dimension: 'readiness',
      verdict,
      summary,
      findings,
      evidence: relevant.flatMap((s) => s.evidence).slice(0, 5),
    });
  } catch {
    govVerdicts.push({
      dimension: 'readiness',
      verdict: 'UNKNOWN',
      summary: 'Readiness analysis unavailable (governance engine error)',
      findings: [],
      evidence: [],
    });
  }

  // ── 6. Governance (composite) ──────────────────────────────────────────────
  try {
    const govReport = await gov.generateGovernanceReport();

    // Composite verdict: FAIL if any prior dimension FAIL, WARN if any WARN, else PASS
    const hasFail = govVerdicts.some((v) => v.verdict === 'FAIL');
    const hasWarn = govVerdicts.some((v) => v.verdict === 'WARN');
    const allUnknown = govVerdicts.every((v) => v.verdict === 'UNKNOWN');

    const verdict: GovernanceVerdict['verdict'] =
      allUnknown ? 'UNKNOWN'
      : hasFail ? 'FAIL'
      : hasWarn ? 'WARN'
      : 'PASS';

    const findings: string[] = [];
    if (hasFail) {
      const failDims = govVerdicts.filter((v) => v.verdict === 'FAIL').map((v) => v.dimension);
      findings.push(`FAIL dimensions: ${failDims.join(', ')}`);
    }
    if (hasWarn) {
      const warnDims = govVerdicts.filter((v) => v.verdict === 'WARN').map((v) => v.dimension);
      findings.push(`WARN dimensions: ${warnDims.join(', ')}`);
    }
    findings.push(`Constitutional health score: ${govReport.healthScore}/100`);

    const summary =
      verdict === 'UNKNOWN' ? 'No affected domains — governance composite indeterminate'
      : verdict === 'FAIL' ? `Governance FAIL — ${govVerdicts.filter((v) => v.verdict === 'FAIL').length} dimension(s) failing; health ${govReport.healthScore}/100`
      : verdict === 'WARN' ? `Governance WARN — ${govVerdicts.filter((v) => v.verdict === 'WARN').length} dimension(s) warning; health ${govReport.healthScore}/100`
      : `Governance PASS — all dimensions healthy; constitutional health ${govReport.healthScore}/100`;

    govVerdicts.push({
      dimension: 'governance',
      verdict,
      summary,
      findings,
      evidence: govReport.evidence.slice(0, 5),
    });
  } catch {
    govVerdicts.push({
      dimension: 'governance',
      verdict: 'UNKNOWN',
      summary: 'Governance composite unavailable (governance engine error)',
      findings: [],
      evidence: [],
    });
  }

  return govVerdicts;
}

// ── Operational area derivation ──────────────────────────────────────────────
//
// Maps the PR's changed files to a set of LCOS area strings (runtime, commerce,
// deployment, security, …) using path heuristics aligned with the OperationalArea type.
// This is purely additive over the existing domain mapping — no file reads, no network.

const RUNTIME_PATTERNS = [
  'services/queue-workers', 'services/webhook-service', 'services/api-gateway',
  'queue', 'worker', 'cron', 'job', 'background',
];

const COMMERCE_PATTERNS = [
  'payment', 'razorpay', 'ledger', 'payout', 'refund', 'cod',
  'gift_card', 'gift-card', 'checkout', 'order', 'cart',
];

const SECURITY_OPS_PATTERNS = [
  'hmac', 'jwt', 'jwks', 'signing', 'turnstile', 'cors',
  'ratelimit', 'rate-limit', 'auth', 'secret', 'encryption', 'hash', 'rls',
];

const DEPLOYMENT_PATTERNS = [
  '.github/workflows', 'vercel', 'cloudflare', 'wrangler', 'dockerfile',
  'docker-compose', 'pnpm-workspace', 'turbo.json', '.env', 'next.config',
];

function deriveOperationalAreas(changedFiles: string[], affectedDomainKeys: string[]): Set<string> {
  const areas = new Set<string>();

  for (const file of changedFiles) {
    const lower = file.toLowerCase();
    if (RUNTIME_PATTERNS.some((p) => lower.includes(p.toLowerCase()))) areas.add('runtime');
    if (COMMERCE_PATTERNS.some((p) => lower.includes(p.toLowerCase()))) areas.add('commerce');
    if (SECURITY_OPS_PATTERNS.some((p) => lower.includes(p.toLowerCase()))) areas.add('security');
    if (DEPLOYMENT_PATTERNS.some((p) => lower.includes(p.toLowerCase()))) areas.add('deployment');
    // Merchant/customer touchpoints
    if (lower.includes('/merchant/') || lower.includes('create-store') || lower.includes('onboarding')) areas.add('merchant');
    if (lower.includes('/customers/') || lower.includes('store_customer')) areas.add('customer');
    // Incident/ops surface
    if (lower.includes('incident') || lower.includes('audit_log') || lower.includes('feature_flag')) areas.add('incident');
    // Forecasting
    if (lower.includes('analytic') || lower.includes('rollup') || lower.includes('metric')) areas.add('forecast');
  }

  // Map domain keys to LCOS areas as a second signal
  for (const key of affectedDomainKeys) {
    if (['payments', 'refunds', 'payouts', 'gift-cards', 'orders'].includes(key)) areas.add('commerce');
    if (['authentication', 'authorization', 'identity'].includes(key)) areas.add('security');
    if (['merchant'].includes(key)) areas.add('merchant');
    if (['notifications', 'analytics'].includes(key)) areas.add('forecast');
    if (['operations'].includes(key)) areas.add('incident');
    if (['inventory', 'products', 'shipping'].includes(key)) areas.add('commerce');
  }

  return areas;
}

// ── LCOS operational-impact verdict builder ──────────────────────────────────
//
// Runs ops.operationsReport(), filters its findings to those whose `area` or
// `subject` overlaps the PR's affected operational areas, then derives ONE
// OperationalVerdict. FAIL = critical SPOF-level finding in affected area.
// WARN = high/medium finding OR NOT_CONNECTED blind spot in the changed area.
// PASS = affected areas are clean. UNKNOWN = no overlap found.

function buildOperationalVerdict(
  ops: OperationsEngine,
  changedFiles: string[],
  affectedDomainKeys: string[],
): OperationalVerdict {
  const affectedAreas = deriveOperationalAreas(changedFiles, affectedDomainKeys);

  // Short-circuit: no files, no domains, no operational mapping possible
  if (affectedAreas.size === 0 && changedFiles.length === 0) {
    return {
      dimension: 'operational-impact',
      verdict: 'UNKNOWN',
      summary: 'No changed files — operational impact cannot be determined',
      findings: [],
      evidence: [],
    };
  }

  let opsReport;
  try {
    opsReport = ops.operationsReport();
  } catch {
    return {
      dimension: 'operational-impact',
      verdict: 'UNKNOWN',
      summary: 'Operations report unavailable (engine error)',
      findings: [],
      evidence: [],
    };
  }

  // Collect all findings across all area reports
  const allAreaReports = [
    opsReport.runtime, opsReport.commerce, opsReport.merchant, opsReport.customer,
    opsReport.deployment, opsReport.incident, opsReport.security, opsReport.forecast,
  ];

  // Filter to findings whose area matches the PR's affected areas
  const relevantFindings = allAreaReports.flatMap((r) => [...r.findings]).filter((f) => {
    if (affectedAreas.size === 0) return false;
    // Match on area name
    if (affectedAreas.has(f.area)) return true;
    // Supplemental: match subject substring against domain keys
    const subjectLower = f.subject.toLowerCase();
    for (const key of affectedDomainKeys) {
      if (subjectLower.includes(key) || key.includes(subjectLower)) return true;
    }
    return false;
  });

  // Identify NOT_CONNECTED blind spots in the affected areas (makes shipping risky)
  const blindSpots = allAreaReports
    .filter((r) => affectedAreas.has(r.area))
    .flatMap((r) => [...r.signals])
    .filter((s) => s.status === 'NOT_CONNECTED');

  // Build findings array for the verdict
  const findingLines: string[] = relevantFindings.slice(0, 10).map(
    (f) => `[${f.severity.toUpperCase()}][${f.area}] ${f.title} — ${f.subject} (${f.status})`,
  );
  for (const bs of blindSpots.slice(0, 5)) {
    findingLines.push(
      `[NOT_CONNECTED][${bs.area}] Telemetry blind spot: ${bs.key} — wire ${bs.requiresEnvVar.join(', ') || bs.source} to observe`,
    );
  }

  // Evidence: pull from relevant findings (cap at 5)
  const evidence = relevantFindings.flatMap((f) => [...f.evidence]).slice(0, 5);

  // Verdict derivation:
  //   FAIL  — any critical finding in the affected area
  //   WARN  — any high/medium finding OR NOT_CONNECTED blind spots that hide risk
  //   PASS  — affected areas have findings but all low/info, and no blind spots
  //   UNKNOWN — affectedAreas non-empty but no operational signal mapped

  const hasCritical = relevantFindings.some((f) => f.severity === 'critical');
  const hasHighMedium = relevantFindings.some((f) => f.severity === 'high' || f.severity === 'medium');
  const hasBlindSpots = blindSpots.length > 0;

  let verdict: OperationalVerdict['verdict'];
  let summary: string;

  if (affectedAreas.size > 0 && relevantFindings.length === 0 && !hasBlindSpots) {
    // Affected areas clean
    verdict = 'PASS';
    summary = `Affected operational area(s) [${[...affectedAreas].join(', ')}] have no elevated findings or telemetry blind spots`;
  } else if (hasCritical) {
    verdict = 'FAIL';
    const critCount = relevantFindings.filter((f) => f.severity === 'critical').length;
    summary = `${critCount} critical operational finding(s) in affected area(s) [${[...affectedAreas].join(', ')}] — SPOF or critical risk; do not ship unreviewed`;
  } else if (hasHighMedium || hasBlindSpots) {
    verdict = 'WARN';
    const prefix = hasHighMedium
      ? `${relevantFindings.filter((f) => f.severity === 'high' || f.severity === 'medium').length} high/medium operational finding(s)`
      : '';
    const bsMsg = hasBlindSpots ? `${blindSpots.length} NOT_CONNECTED telemetry blind spot(s)` : '';
    summary = [prefix, bsMsg].filter(Boolean).join('; ') +
      ` in affected area(s) [${[...affectedAreas].join(', ')}] — observability gap; consider connecting telemetry before shipping`;
  } else if (relevantFindings.length > 0) {
    // Only low/info
    verdict = 'PASS';
    summary = `Affected area(s) [${[...affectedAreas].join(', ')}] have only low/info operational findings — no elevated risk`;
  } else {
    verdict = 'UNKNOWN';
    summary = `No operational findings map to affected area(s) [${[...affectedAreas].join(', ') || 'none'}] — indeterminate`;
  }

  return { dimension: 'operational-impact', verdict, summary, findings: findingLines, evidence };
}

// ── Main analyzer ───────────────────────────────────────────────────────────

async function _coreAnalyze(
  rawInput: unknown,
  engineOverride?: LcisEngine,
): Promise<{ report: PrReport; changedFiles: string[] }> {
  // Zod validation
  const input: PrInput = PrInputSchema.parse(rawInput);
  const { changedFiles, changedSymbols = [] } = input;

  const engine = engineOverride ?? createEngine();
  const ev: Evidence[] = [];

  // ── 1. Map changed files → domains ──────────────────────────────────────
  const domainFileMap = new Map<string, string[]>(); // domain key → files

  for (const file of changedFiles) {
    const domain = filePathToDomain(file);
    if (domain) {
      const existing = domainFileMap.get(domain) ?? [];
      existing.push(file);
      domainFileMap.set(domain, existing);
      ev.push(evidence('file', file, `path heuristic → domain '${domain}'`, 'src/domain-map.ts'));
    }
  }

  // ── 2. Build source-file → node-id index (once per engine) ──────────────
  const sourceFileIndex = getSourceFileIndex(engine);

  // ── 3. Collect blast seeds from changed files ────────────────────────────
  //
  // For each changed file that has graph nodes, collect those node ids as blast
  // seeds. Files not in the code graph (e.g. .sql migrations) contribute no
  // seeds here — they still contribute via sensitivity flags (step 5 below).

  const fileSeedNodeIds: string[] = [];
  for (const file of changedFiles) {
    const nodeIds = sourceFileIndex.get(file);
    if (nodeIds && nodeIds.length > 0) {
      for (const id of nodeIds) fileSeedNodeIds.push(id);
      ev.push(evidence(
        'graph-node',
        file,
        `file resolved to ${nodeIds.length} graph node(s); seeds for blast`,
        'graphify-out/graph.json',
      ));
    }
  }

  // ── 4. Blast radius from changed symbols ─────────────────────────────────
  //
  // changedSymbols are an ADDITIONAL seed source (union with file-derived seeds).
  // We track these separately so their contributions are merged with file blasts.

  let totalBlastNodes = 0;
  let totalBlastFiles = 0;
  const blastDomains = new Set<string>();

  // Helper: register domains from a set of impacted files
  function addBlastFileDomains(files: Iterable<string>): void {
    for (const f of files) {
      const d = filePathToDomain(f);
      if (d) blastDomains.add(d);
    }
  }

  // 4a. Blast from changed files via the source-file index
  if (fileSeedNodeIds.length > 0) {
    const { impactedNodeIds, impactedFiles } = blastFromNodeIds(engine, fileSeedNodeIds);
    totalBlastNodes += impactedNodeIds.size;
    totalBlastFiles += impactedFiles.size;
    addBlastFileDomains(impactedFiles);
    if (impactedNodeIds.size > 0) {
      ev.push(evidence(
        'graph-node',
        changedFiles.join(', '),
        `file-derived blast: ${impactedNodeIds.size} nodes, ${impactedFiles.size} files impacted`,
        'graphify-out/graph.json',
      ));
    }
  }

  // 4b. Blast from explicitly-passed symbols (original behaviour, preserved)
  for (const sym of changedSymbols) {
    const result = engine.blast.blast(sym);
    if (result) {
      // Merge into totals (guard against double-counting with file blast by using
      // cumulative max rather than sum; here we add since symbols are expected to
      // be explicit callers' concern — the union is what matters for display).
      totalBlastNodes += result.impactedNodes;
      totalBlastFiles += result.impactedFiles;
      ev.push(evidence(
        'graph-node',
        sym,
        `blast: ${result.impactedNodes} nodes, ${result.impactedFiles} files impacted`,
        result.artifact,
      ));

      // Map blast top-impacted files back to domains
      for (const node of result.topImpacted) {
        const fileDomain = node.file ? filePathToDomain(node.file) : null;
        if (fileDomain) blastDomains.add(fileDomain);
      }
    } else {
      ev.push(evidence('graph-node', sym, 'symbol not found in code graph', 'graphify-out/graph.json'));
    }
  }

  // ── 5. Merge blast domains into domain map ───────────────────────────────
  for (const d of blastDomains) {
    if (!domainFileMap.has(d)) {
      domainFileMap.set(d, []);
    }
  }

  // ── 6. Enrich domains via engine.architecture.explainDomain + explainOwnership ─
  const affectedDomains: AffectedDomain[] = [];
  const allReviewers = new Set<string>();
  const allServices = new Set<string>();

  for (const [domainKey, files] of domainFileMap.entries()) {
    const fromBlast = blastDomains.has(domainKey) && files.length === 0;

    // explainOwnership for reviewers
    try {
      const ownershipExp = await engine.architecture.explainOwnership(domainKey);
      for (const e of ownershipExp.evidence) {
        if (e.kind === 'artifact-field' && e.ref.includes('.owners')) {
          // Parse owners out of the detail string
          if (e.detail) {
            e.detail.split(',').map((s) => s.trim()).filter(Boolean).forEach((o) => allReviewers.add(o));
          }
        }
      }
      ev.push(...ownershipExp.evidence);
    } catch {
      // domain not in artifact — skip gracefully
    }

    // Populate services
    const services = DOMAIN_TO_SERVICES[domainKey] ?? [];
    services.forEach((s) => allServices.add(s));

    // explainRisk for evidence
    try {
      const riskExp = await engine.architecture.explainRisk(domainKey);
      ev.push(...riskExp.evidence);
    } catch {
      // skip
    }

    affectedDomains.push({
      key: domainKey,
      label: DOMAIN_LABELS[domainKey] ?? domainKey,
      fromFiles: files,
      fromBlast,
      money: MONEY_DOMAINS.has(domainKey),
      tenant: TENANT_DOMAINS.has(domainKey),
    });
  }

  // ── 7. Sensitivity detection (deterministic, path-based) ─────────────────
  const validationWarnings: string[] = [];

  function detectFlag(
    patterns: string[],
    flagName: string,
    warningTemplate: (file: string) => string,
  ): boolean {
    const hits = changedFiles.filter((f) => matchesAny(f, patterns));
    for (const f of hits) {
      validationWarnings.push(warningTemplate(f));
    }
    return hits.length > 0;
  }

  const authRelated = detectFlag(
    AUTH_PATTERNS,
    'authRelated',
    (f) => `[authRelated] ${f} — touches authentication/session/OAuth/JWT; identity-platform reviewer required`,
  );

  const paymentRelated = detectFlag(
    PAYMENT_PATTERNS,
    'paymentRelated',
    (f) => `[paymentRelated] ${f} — touches payment/ledger/razorpay; canonical-ledger-only-validator + step-up apply`,
  );

  const rlsRelated = detectFlag(
    RLS_PATTERNS,
    'rlsRelated',
    (f) => `[rlsRelated] ${f} — touches RLS policy; security reviewer required`,
  );

  const migrationRelated = detectFlag(
    MIGRATION_PATTERNS,
    'migrationRelated',
    (f) => `[migrationRelated] ${f} — SQL migration: irreversible schema change; DBA review required`,
  );

  const tenantIsolation = detectFlag(
    TENANT_PATTERNS,
    'tenantIsolation',
    (f) => `[tenantIsolation] ${f} — touches site_id/tenant isolation; verifySiteOwnership must be present`,
  );

  const validatorImpact = detectFlag(
    VALIDATOR_PATTERNS,
    'validatorImpact',
    (f) => `[validatorImpact] ${f} — touches governance validator or CLAUDE.md/AGENTS.md; run validate-governance.mjs`,
  );

  const securitySensitive = detectFlag(
    SECURITY_PATTERNS,
    'securitySensitive',
    (f) => `[securitySensitive] ${f} — touches HMAC/JWT/Turnstile/CORS/signing; security review required`,
  );

  const crossDomain = affectedDomains.length > 1;
  if (crossDomain) {
    validationWarnings.push(
      `[crossDomain] PR spans ${affectedDomains.length} domains: ${affectedDomains.map((d) => d.key).join(', ')}`,
    );
  }

  const sensitivity: SensitivityFlags = {
    crossDomain,
    authRelated,
    paymentRelated,
    rlsRelated,
    migrationRelated,
    tenantIsolation,
    validatorImpact,
    securitySensitive,
  };

  // ── 8. Architecture warnings ──────────────────────────────────────────────
  const architectureWarnings: string[] = [];

  for (const file of changedFiles) {
    const lower = file.toLowerCase();
    for (const [root, frozen] of FROZEN_APPS) {
      if (lower === root || lower.startsWith(root + '/')) {
        architectureWarnings.push(
          `[frozen-app] ${file} — app '${frozen}' is frozen/not a deploy target (CLAUDE.md §Frozen); changes require ARB approval`,
        );
      }
    }
    for (const deprecated of DEPRECATED_ALIASES) {
      if (lower.includes(deprecated.toLowerCase())) {
        architectureWarnings.push(
          `[deprecated-alias] ${file} — '${deprecated}' is a deprecated runtime alias (CLAUDE.md §Deprecated); do not recreate`,
        );
      }
    }
  }

  // Layer violation check: packages must not import from apps
  const packageFiles = changedFiles.filter((f) => f.startsWith('packages/'));
  const appImportViolations = packageFiles.filter((f) => {
    // Heuristic: if a package file mentions apps/* paths directly it may be a layer violation
    return false; // Would require file content reads — skip in read-only mode
  });
  void appImportViolations; // kept for future expansion

  // ── 9. Risk derivation ───────────────────────────────────────────────────
  const risk = deriveRisk(sensitivity, affectedDomains, totalBlastNodes);

  // ── 10. Top blast domains ────────────────────────────────────────────────
  const topDomains = [
    ...new Set([...affectedDomains.map((d) => d.key), ...blastDomains]),
  ].slice(0, 10);

  // ── 11. Reviewers — dedupe, remove empty strings ─────────────────────────
  const reviewers = [...allReviewers].filter(Boolean).sort();

  const report: PrReport = {
    sensitivity,
    risk: { level: risk.level, reasons: risk.reasons },
    affectedDomains,
    affectedServices: [...allServices].sort(),
    recommendedReviewers: reviewers,
    validationWarnings,
    architectureWarnings,
    blastRadius: {
      affectedFiles: totalBlastFiles,
      affectedNodes: totalBlastNodes,
      topDomains,
    },
    evidence: ev,
    generatedAt: new Date().toISOString(),
    verdicts: [], // empty in the sync path; populated by analyzeWithVerdicts()
    governanceVerdicts: [], // empty in the sync path; populated by analyzeWithGovernance()
    operationalVerdict: null, // null in the sync path; populated by analyzeWithOperations()
    engineeringVerdicts: [], // empty in the sync path; populated by analyzeWithEngineering()
    executionVerdicts: [], // empty in the sync path; populated by analyzeWithExecution()
  };

  return { report, changedFiles };
}

/**
 * analyzePr — the original async entry point, preserved exactly.
 * Returns verdicts: [] — existing callers and tests are unaffected.
 */
export async function analyzePr(
  rawInput: unknown,
  engineOverride?: LcisEngine,
): Promise<PrReport> {
  const { report } = await _coreAnalyze(rawInput, engineOverride);
  return report;
}

/**
 * analyzeWithVerdicts — the V2 async entry point.
 * Runs the same core analysis as analyzePr(), then appends six LCIS review verdicts
 * (architecture / security / migration / coverage / launch / rollback), each
 * evidence-cited. UNKNOWN when a signal cannot be determined.
 */
export async function analyzeWithVerdicts(
  rawInput: unknown,
  engineOverride?: LcisEngine,
  eisOverride?: EisEngine,
): Promise<PrReport> {
  const { report, changedFiles } = await _coreAnalyze(rawInput, engineOverride);
  const eis = eisOverride ?? createEisEngine({ core: engineOverride ?? createEngine() });
  const verdicts = await buildVerdicts(eis, report, changedFiles);
  return { ...report, verdicts };
}

/**
 * analyzeWithGovernance — the V3 async entry point (GDIS / PR Intelligence V3).
 * Runs the same core analysis as analyzePr(), then appends:
 *   - The six EIS review verdicts (architecture / security / migration / coverage / launch / rollback)
 *   - The six GDIS governance verdicts (architecture-drift / compliance / ownership /
 *     security-drift / readiness / governance), each filtered to the PR's affected entities
 *     and evidence-cited. UNKNOWN when nothing can be matched.
 *
 * Accepts optional overrides for the EIS and governance engines (for testing).
 */
export async function analyzeWithGovernance(
  rawInput: unknown,
  engineOverride?: LcisEngine,
  eisOverride?: EisEngine,
  govOverride?: GovernanceEngine,
): Promise<PrReport> {
  const { report, changedFiles } = await _coreAnalyze(rawInput, engineOverride);
  const core = engineOverride ?? createEngine();
  const eis = eisOverride ?? createEisEngine({ core });
  const gov = govOverride ?? createGovernanceEngine({ core });
  const [verdicts, governanceVerdicts] = await Promise.all([
    buildVerdicts(eis, report, changedFiles),
    buildGovernanceVerdicts(gov, report),
  ]);
  return { ...report, verdicts, governanceVerdicts };
}

// ── EINS engineering verdict builder ────────────────────────────────────────
//
// Calls eins.generateBlueprint() and eins.generateFullEngineeringPackage() once,
// then maps to six EngineeringVerdicts:
//   engineering-readiness  → package decision GO/CONDITIONAL_GO/NO_GO
//   engineering-complexity → blueprint.impact.complexity.band
//   engineering-risk       → blueprint.impact.risk.level
//   engineering-coverage   → blueprint.gates with category 'gap', missing tests
//   engineering-rollback   → blueprint.rollback.readiness
//   engineering-verification → blueprint.gates with category 'gate' (unmet)
//
// UNKNOWN is returned when a signal cannot be determined (never fabricated as PASS).

async function buildEngineeringVerdicts(
  eins: EngineeringEngine,
  report: PrReport,
  changedFiles: string[],
): Promise<EngineeringVerdict[]> {
  const domainKeys = [...new Set(report.affectedDomains.map((d) => d.key))];
  const req = {
    text: `PR review: ${changedFiles.slice(0, 3).join(', ')}${changedFiles.length > 3 ? ` (+${changedFiles.length - 3} more)` : ''}`,
    domains: domainKeys,
    files: changedFiles,
  };

  const verdicts: EngineeringVerdict[] = [];

  let blueprint: Awaited<ReturnType<EngineeringEngine['generateBlueprint']>> | null = null;
  let pkg: Awaited<ReturnType<EngineeringEngine['generateFullEngineeringPackage']>> | null = null;

  try {
    blueprint = await eins.generateBlueprint(req);
    pkg = await eins.generateFullEngineeringPackage(req);
  } catch {
    // If both calls fail, return 6 UNKNOWN verdicts
    const dims: EngineeringVerdict['dimension'][] = [
      'engineering-readiness', 'engineering-complexity', 'engineering-risk',
      'engineering-coverage', 'engineering-rollback', 'engineering-verification',
    ];
    for (const dimension of dims) {
      verdicts.push({ dimension, verdict: 'UNKNOWN', summary: 'Engineering engine unavailable', findings: [], evidence: [] });
    }
    return verdicts;
  }

  // ── 1. engineering-readiness ─────────────────────────────────────────────
  try {
    const decision = pkg.decision.verdict;
    const readinessVerdict: EngineeringVerdict['verdict'] =
      decision === 'GO' ? 'PASS'
      : decision === 'CONDITIONAL_GO' ? 'WARN'
      : 'FAIL';

    const findings: string[] = [
      `Engineering decision: ${decision}`,
      ...pkg.decision.blockers.map((b) => `Blocker: ${b.slice(0, 120)}`),
    ];

    const summary =
      readinessVerdict === 'PASS' ? `Engineering GO — no structural blockers (${pkg.tasks.length} task(s), ${pkg.graph.milestones.length} milestone(s))`
      : readinessVerdict === 'WARN' ? `Engineering CONDITIONAL_GO — ${pkg.decision.blockers.length} blocker(s) or warnings present`
      : `Engineering NO_GO — ${pkg.decision.blockers.length} blocker(s) must be resolved before merge`;

    verdicts.push({
      dimension: 'engineering-readiness',
      verdict: readinessVerdict,
      summary,
      findings,
      evidence: [...pkg.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'engineering-readiness', verdict: 'UNKNOWN', summary: 'Readiness analysis unavailable', findings: [], evidence: [] });
  }

  // ── 2. engineering-complexity ────────────────────────────────────────────
  try {
    const band = blueprint.impact.complexity.band;
    const complexityVerdict: EngineeringVerdict['verdict'] =
      band === 'trivial' || band === 'low' ? 'PASS'
      : band === 'moderate' ? 'WARN'
      : 'FAIL'; // high | severe

    const findings: string[] = [
      `Complexity band: ${band} (score ${blueprint.impact.complexity.score})`,
      `Domains: ${blueprint.impact.domains.join(', ') || 'none'}`,
      `Tables: ${blueprint.impact.tables.join(', ') || 'none'}`,
      `RPCs: ${blueprint.impact.rpcs.join(', ') || 'none'}`,
    ];

    const summary =
      complexityVerdict === 'PASS' ? `Complexity ${band} — well within safe change threshold`
      : complexityVerdict === 'WARN' ? `Complexity moderate — extra review recommended; ${blueprint.impact.domains.length} domain(s) affected`
      : `Complexity ${band} — high/severe; requires careful staged rollout; ${blueprint.impact.domains.length} domain(s) affected`;

    verdicts.push({
      dimension: 'engineering-complexity',
      verdict: complexityVerdict,
      summary,
      findings,
      evidence: [...blueprint.impact.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'engineering-complexity', verdict: 'UNKNOWN', summary: 'Complexity analysis unavailable', findings: [], evidence: [] });
  }

  // ── 3. engineering-risk ──────────────────────────────────────────────────
  try {
    const riskLevel = blueprint.impact.risk.level;
    const riskVerdict: EngineeringVerdict['verdict'] =
      riskLevel === 'low' ? 'PASS'
      : riskLevel === 'medium' ? 'WARN'
      : 'FAIL'; // high | critical

    const findings: string[] = [
      `Risk level: ${riskLevel}`,
      blueprint.impact.risk.money ? 'Money path: canonical-ledger-only-validator applies' : '',
      blueprint.impact.risk.tenant ? 'Tenant isolation: site_id / verifySiteOwnership in scope' : '',
      ...blueprint.impact.risk.drivers.map((d: string) => `Driver: ${d.slice(0, 100)}`),
    ].filter(Boolean);

    const summary =
      riskVerdict === 'PASS' ? `Engineering risk low — no money/tenant drivers detected`
      : riskVerdict === 'WARN' ? `Engineering risk medium — ${blueprint.impact.risk.drivers.length} driver(s): ${blueprint.impact.risk.drivers.slice(0, 2).join('; ')}`
      : `Engineering risk ${riskLevel} — ${blueprint.impact.risk.money ? 'MONEY PATH; ' : ''}${blueprint.impact.risk.tenant ? 'TENANT ISOLATION; ' : ''}${blueprint.impact.risk.drivers.length} driver(s)`;

    verdicts.push({
      dimension: 'engineering-risk',
      verdict: riskVerdict,
      summary,
      findings,
      evidence: [...blueprint.impact.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'engineering-risk', verdict: 'UNKNOWN', summary: 'Risk analysis unavailable', findings: [], evidence: [] });
  }

  // ── 4. engineering-coverage ──────────────────────────────────────────────
  try {
    const gapFindings = blueprint.gates.filter((g) => g.category === 'gap');
    const criticalGaps = gapFindings.filter((g) => g.severity === 'critical' || g.severity === 'high');
    const testsRequired = blueprint.tests.required ?? [];
    const testsMissing = blueprint.tests.missing ?? [];

    const coverageVerdict: EngineeringVerdict['verdict'] =
      criticalGaps.length > 0 || testsMissing.some((m) => m.severity === 'critical') ? 'FAIL'
      : gapFindings.length > 0 || testsMissing.length > 0 ? 'WARN'
      : 'PASS';

    const findings: string[] = [
      ...criticalGaps.map((g) => `[${g.severity.toUpperCase()}] Coverage gap: ${g.subject} — ${g.title} (${g.rule ?? g.kind})`),
      ...testsMissing.map((m) => `Missing test: ${m.subject} (${m.kind}) — ${m.note?.slice(0, 80) ?? ''}`),
      testsRequired.length > 0 ? `${testsRequired.length} test(s) must pass` : '',
      `Coverage confidence: ${Math.round((blueprint.tests.coverageConfidence ?? 0) * 100)}%`,
    ].filter(Boolean);

    const summary =
      coverageVerdict === 'FAIL' ? `${criticalGaps.length} critical/high coverage gap(s) — engineering gates unmet`
      : coverageVerdict === 'WARN' ? `${gapFindings.length} coverage gap(s) or ${testsMissing.length} missing test(s) — review required`
      : `Coverage acceptable — no critical gaps detected`;

    verdicts.push({
      dimension: 'engineering-coverage',
      verdict: coverageVerdict,
      summary,
      findings,
      evidence: gapFindings.flatMap((g) => [...g.evidence]).slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'engineering-coverage', verdict: 'UNKNOWN', summary: 'Coverage analysis unavailable', findings: [], evidence: [] });
  }

  // ── 5. engineering-rollback ──────────────────────────────────────────────
  try {
    const rollback = blueprint.rollback;
    const rollbackReadiness = rollback.readiness;
    const rollbackVerdict: EngineeringVerdict['verdict'] =
      rollbackReadiness === 'READY' ? 'PASS'
      : rollbackReadiness === 'CONDITIONAL' ? 'WARN'
      : 'FAIL'; // NOT_READY

    const irreversible = rollback.irreversible ?? [];
    const findings: string[] = [
      `Rollback readiness: ${rollbackReadiness}`,
      `Rollback complexity: ${rollback.complexity}`,
      ...irreversible.map((i) => `Irreversible: ${i.subject} — ${i.reason.slice(0, 80)}`),
      `Estimated recovery: ${rollback.estimatedRecovery}`,
    ];

    const summary =
      rollbackVerdict === 'PASS' ? `Rollback READY — all engineering changes reversible`
      : rollbackVerdict === 'WARN' ? `Rollback CONDITIONAL — ${irreversible.length} irreversible item(s); verify before merge`
      : `Rollback NOT_READY — critical irreversibility detected (money/data-loss risk)`;

    verdicts.push({
      dimension: 'engineering-rollback',
      verdict: rollbackVerdict,
      summary,
      findings,
      evidence: [...rollback.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'engineering-rollback', verdict: 'UNKNOWN', summary: 'Rollback analysis unavailable', findings: [], evidence: [] });
  }

  // ── 6. engineering-verification ─────────────────────────────────────────
  try {
    const gateFindings = blueprint.gates.filter((g) => g.category === 'gate');
    const blockerFindings = blueprint.gates.filter((g) => g.category === 'blocker');
    const unmetCritical = gateFindings.filter((g) => g.severity === 'critical' || g.severity === 'high');

    const verificationVerdict: EngineeringVerdict['verdict'] =
      unmetCritical.length > 0 || blockerFindings.length > 0 ? 'FAIL'
      : gateFindings.length > 0 ? 'WARN'
      : 'PASS';

    const preMergeGates = blueprint.verification.preMergeGates ?? [];
    const verificationChecks = blueprint.verification.checks ?? [];
    const findings: string[] = [
      ...unmetCritical.map((g) => `[${g.severity.toUpperCase()}] Gate unmet: ${g.subject} — ${g.title} (${g.rule ?? g.kind})`),
      ...blockerFindings.map((g) => `Blocker: ${g.subject} — ${g.title}`),
      gateFindings.length > 0 ? `${gateFindings.length} engineering gate(s) require verification` : '',
      preMergeGates.length > 0 ? `Pre-merge gates: ${preMergeGates.slice(0, 3).join(', ')}` : '',
      `Verification checks: ${verificationChecks.length}`,
    ].filter(Boolean);

    const summary =
      verificationVerdict === 'FAIL' ? `${unmetCritical.length} critical/high unmet gate(s) or ${blockerFindings.length} blocker(s) — cannot merge`
      : verificationVerdict === 'WARN' ? `${gateFindings.length} gate(s) require verification (${verificationChecks.length} check(s))`
      : `All engineering gates met — ${verificationChecks.length} verification check(s) passed`;

    verdicts.push({
      dimension: 'engineering-verification',
      verdict: verificationVerdict,
      summary,
      findings,
      evidence: gateFindings.flatMap((g) => [...g.evidence]).slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'engineering-verification', verdict: 'UNKNOWN', summary: 'Verification analysis unavailable', findings: [], evidence: [] });
  }

  return verdicts;
}

/**
 * analyzeWithOperations — the V4 async entry point (LCOS / PR Intelligence V4).
 * Runs the same core analysis as analyzePr(), the six EIS verdicts, the six GDIS
 * governance verdicts, AND appends ONE LCOS operational-impact verdict — does this
 * PR touch an area with operational risk (SPOF, critical finding, NOT_CONNECTED
 * telemetry blind spot)? Evidence-cited. UNKNOWN when no operational signal maps.
 *
 * Additive over V2 + V3 — does not break existing verdicts or governanceVerdicts.
 * Accepts optional engine overrides for all four engines (for testing).
 */
export async function analyzeWithOperations(
  rawInput: unknown,
  engineOverride?: LcisEngine,
  eisOverride?: EisEngine,
  govOverride?: GovernanceEngine,
  opsOverride?: OperationsEngine,
): Promise<PrReport> {
  const { report, changedFiles } = await _coreAnalyze(rawInput, engineOverride);
  const core = engineOverride ?? createEngine();
  const eis = eisOverride ?? createEisEngine({ core });
  const gov = govOverride ?? createGovernanceEngine({ core });
  const ops = opsOverride ?? createOperationsEngine({ core });

  const [verdicts, governanceVerdicts] = await Promise.all([
    buildVerdicts(eis, report, changedFiles),
    buildGovernanceVerdicts(gov, report),
  ]);

  const affectedDomainKeys = report.affectedDomains.map((d) => d.key);
  const operationalVerdict = buildOperationalVerdict(ops, changedFiles, affectedDomainKeys);

  return { ...report, verdicts, governanceVerdicts, operationalVerdict };
}

/**
 * analyzeWithEngineering — the V5 async entry point (EINS / PR Intelligence V5).
 * Runs the same core analysis as analyzePr(), the six EIS review verdicts, the six
 * GDIS governance verdicts, the LCOS operational-impact verdict, AND appends SIX
 * EINS engineering verdicts:
 *   engineering-readiness  / engineering-complexity / engineering-risk /
 *   engineering-coverage   / engineering-rollback   / engineering-verification
 *
 * Each verdict is evidence-cited. UNKNOWN is returned when a signal cannot be
 * determined (never fabricated as PASS).
 *
 * Additive over V2 + V3 + V4 — does not break any existing verdicts.
 * Accepts optional engine overrides for all five engines (for testing).
 */
export async function analyzeWithEngineering(
  rawInput: unknown,
  engineOverride?: LcisEngine,
  eisOverride?: EisEngine,
  govOverride?: GovernanceEngine,
  opsOverride?: OperationsEngine,
  einsOverride?: EngineeringEngine,
): Promise<PrReport> {
  const { report, changedFiles } = await _coreAnalyze(rawInput, engineOverride);
  const core = engineOverride ?? createEngine();
  const eis = eisOverride ?? createEisEngine({ core });
  const gov = govOverride ?? createGovernanceEngine({ core });
  const ops = opsOverride ?? createOperationsEngine({ core });
  const eins = einsOverride ?? createEngineeringEngine({ core });

  const [verdicts, governanceVerdicts, engineeringVerdicts] = await Promise.all([
    buildVerdicts(eis, report, changedFiles),
    buildGovernanceVerdicts(gov, report),
    buildEngineeringVerdicts(eins, report, changedFiles),
  ]);

  const affectedDomainKeys = report.affectedDomains.map((d) => d.key);
  const operationalVerdict = buildOperationalVerdict(ops, changedFiles, affectedDomainKeys);

  return { ...report, verdicts, governanceVerdicts, operationalVerdict, engineeringVerdicts };
}

// ── EAOS execution verdict builder ──────────────────────────────────────────
//
// Calls eaos.generateFullExecutionPackage() once, then maps to six ExecutionVerdicts:
//   execution-readiness → rollout.launchVerdict (GO/CONDITIONAL_GO/NO_GO)
//   execution-health    → package overall health band (merged areas)
//   validation-health   → validation area health + failed validations
//   rollout-health      → rollout area health + rollback readiness
//   artifact-health     → artifact findings (drift / missing) — coverage is NOT_CONNECTED
//   agent-health        → agent area health + ownership/orphan findings
//
// Bands map healthy→PASS, degraded→WARN, failing→FAIL, unknown→UNKNOWN.
// UNKNOWN is returned when a signal cannot be determined (never fabricated as PASS).

function bandToVerdict(health: ExecutionHealth): ExecutionVerdict['verdict'] {
  switch (health.band) {
    case 'healthy':
      return 'PASS';
    case 'degraded':
      return 'WARN';
    case 'failing':
      return 'FAIL';
    default:
      return 'UNKNOWN';
  }
}

function healthFindings(health: ExecutionHealth): string[] {
  return [
    `${health.area} health: ${health.band}${health.score !== null ? ` (score ${health.score})` : ' (score indeterminable)'}`,
    `Signals: ${health.connectedSignals} CONNECTED, ${health.notConnectedSignals} NOT_CONNECTED (live tracking not wired)`,
  ];
}

async function buildExecutionVerdicts(
  eaos: OrchestrationEngine,
  report: PrReport,
  changedFiles: string[],
): Promise<ExecutionVerdict[]> {
  const domainKeys = [...new Set(report.affectedDomains.map((d) => d.key))];
  const req = {
    text: `PR review: ${changedFiles.slice(0, 3).join(', ')}${changedFiles.length > 3 ? ` (+${changedFiles.length - 3} more)` : ''}`,
    domains: domainKeys,
    files: changedFiles,
  };

  const verdicts: ExecutionVerdict[] = [];

  let pkg: Awaited<ReturnType<OrchestrationEngine['generateFullExecutionPackage']>> | null = null;
  try {
    pkg = await eaos.generateFullExecutionPackage(req);
  } catch {
    // If the engine fails entirely, return 6 UNKNOWN verdicts
    const dims: ExecutionVerdict['dimension'][] = [
      'execution-readiness', 'execution-health', 'validation-health',
      'rollout-health', 'artifact-health', 'agent-health',
    ];
    return dims.map((dimension) => ({
      dimension, verdict: 'UNKNOWN' as const, summary: 'Orchestration engine unavailable', findings: [], evidence: [],
    }));
  }

  // ── 1. execution-readiness ───────────────────────────────────────────────
  try {
    const launch = pkg.rollout.launchVerdict;
    const readinessVerdict: ExecutionVerdict['verdict'] =
      launch === 'GO' ? 'PASS' : launch === 'CONDITIONAL_GO' ? 'WARN' : 'FAIL';
    const blocked = pkg.execution.graph.blocked.length;
    const ready = pkg.execution.graph.parallelizable.length;
    verdicts.push({
      dimension: 'execution-readiness',
      verdict: readinessVerdict,
      summary:
        readinessVerdict === 'PASS'
          ? `Execution ready — launch GO, ${ready} task(s) READY to start`
          : readinessVerdict === 'WARN'
            ? `Execution CONDITIONAL_GO — ${pkg.rollout.blockers.length} blocker(s); ${blocked} structurally blocked task(s)`
            : `Execution NO_GO — ${pkg.rollout.blockers.length} blocker(s) must be resolved before this work can proceed`,
      findings: [
        `Launch verdict: ${launch}`,
        `${pkg.execution.graph.nodes.length} task(s): ${ready} READY, ${blocked} BLOCKED (structural)`,
        ...pkg.rollout.blockers.slice(0, 5).map((b) => `Blocker: ${b.slice(0, 120)}`),
      ],
      evidence: [...pkg.rollout.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'execution-readiness', verdict: 'UNKNOWN', summary: 'Readiness signal unavailable', findings: [], evidence: [] });
  }

  // ── 2. execution-health ──────────────────────────────────────────────────
  try {
    verdicts.push({
      dimension: 'execution-health',
      verdict: bandToVerdict(pkg.health),
      summary: `Overall execution health ${pkg.health.band}${pkg.health.score !== null ? ` (${pkg.health.score})` : ''} across execution/agent/validation/rollout areas`,
      findings: [...healthFindings(pkg.health), ...pkg.execution.findings.slice(0, 3).map((f) => `[${f.severity.toUpperCase()}] ${f.title}`)],
      evidence: [...pkg.execution.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'execution-health', verdict: 'UNKNOWN', summary: 'Health signal unavailable', findings: [], evidence: [] });
  }

  // ── 3. validation-health ─────────────────────────────────────────────────
  try {
    const failed = pkg.validation.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    const base = bandToVerdict(pkg.validation.health);
    const validationVerdict: ExecutionVerdict['verdict'] = failed.length > 0 && base === 'PASS' ? 'WARN' : base;
    verdicts.push({
      dimension: 'validation-health',
      verdict: validationVerdict,
      summary: `Validation ${pkg.validation.health.band}: ${pkg.validation.validations.length} validation(s), ${failed.length} critical/high finding(s); live CI results NOT_CONNECTED`,
      findings: [...healthFindings(pkg.validation.health), ...failed.slice(0, 5).map((f) => `[${f.severity.toUpperCase()}] ${f.title}`)],
      evidence: [...pkg.validation.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'validation-health', verdict: 'UNKNOWN', summary: 'Validation signal unavailable', findings: [], evidence: [] });
  }

  // ── 4. rollout-health ────────────────────────────────────────────────────
  try {
    const rollback = pkg.rollout.rollbackReadiness;
    const base = bandToVerdict(pkg.rollout.health);
    const rolloutVerdict: ExecutionVerdict['verdict'] =
      rollback === 'NOT_READY' ? 'FAIL' : rollback === 'CONDITIONAL' && base === 'PASS' ? 'WARN' : base;
    verdicts.push({
      dimension: 'rollout-health',
      verdict: rolloutVerdict,
      summary: `Rollout ${pkg.rollout.health.band}; rollback ${rollback}; launch ${pkg.rollout.launchVerdict}`,
      findings: [
        ...healthFindings(pkg.rollout.health),
        `Rollback readiness: ${rollback}`,
        ...pkg.rollout.findings.slice(0, 3).map((f) => `[${f.severity.toUpperCase()}] ${f.title}`),
      ],
      evidence: [...pkg.rollout.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'rollout-health', verdict: 'UNKNOWN', summary: 'Rollout signal unavailable', findings: [], evidence: [] });
  }

  // ── 5. artifact-health ───────────────────────────────────────────────────
  try {
    const critical = pkg.artifact.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    const artifactVerdict: ExecutionVerdict['verdict'] =
      pkg.artifact.artifacts.length === 0 ? 'UNKNOWN'
      : critical.length > 0 ? 'FAIL'
      : pkg.artifact.findings.length > 0 ? 'WARN'
      : 'PASS';
    verdicts.push({
      dimension: 'artifact-health',
      verdict: artifactVerdict,
      summary:
        artifactVerdict === 'UNKNOWN'
          ? 'No planned artifacts derivable for this change'
          : `${pkg.artifact.artifacts.length} planned artifact(s), ${pkg.artifact.findings.length} finding(s) (${critical.length} critical/high); on-disk presence NOT_CONNECTED`,
      findings: [
        `Planned artifacts: ${pkg.artifact.artifacts.length} (coverage ${pkg.artifact.coverage.connection})`,
        ...pkg.artifact.findings.slice(0, 5).map((f) => `[${f.severity.toUpperCase()}] ${f.title}`),
      ],
      evidence: [...pkg.artifact.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'artifact-health', verdict: 'UNKNOWN', summary: 'Artifact signal unavailable', findings: [], evidence: [] });
  }

  // ── 6. agent-health ──────────────────────────────────────────────────────
  try {
    const agentIssues = pkg.agent.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    const base = bandToVerdict(pkg.agent.health);
    const agentVerdict: ExecutionVerdict['verdict'] = agentIssues.length > 0 && base === 'PASS' ? 'WARN' : base;
    verdicts.push({
      dimension: 'agent-health',
      verdict: agentVerdict,
      summary: `Agent assignments ${pkg.agent.health.band}: ${pkg.agent.agents.length} assignment(s), ${pkg.agent.findings.length} finding(s); live agent activity NOT_CONNECTED`,
      findings: [...healthFindings(pkg.agent.health), ...agentIssues.slice(0, 5).map((f) => `[${f.severity.toUpperCase()}] ${f.title}`)],
      evidence: [...pkg.agent.evidence].slice(0, 5),
    });
  } catch {
    verdicts.push({ dimension: 'agent-health', verdict: 'UNKNOWN', summary: 'Agent signal unavailable', findings: [], evidence: [] });
  }

  return verdicts;
}

/**
 * analyzeWithExecution — the V6 async entry point (EAOS / PR Intelligence V6).
 * Runs the same core analysis as analyzePr(), the six EIS review verdicts, the six
 * GDIS governance verdicts, the LCOS operational-impact verdict, the six EINS
 * engineering verdicts, AND appends SIX EAOS execution verdicts:
 *   execution-readiness / execution-health / validation-health /
 *   rollout-health      / artifact-health  / agent-health
 *
 * Each verdict is evidence-cited. UNKNOWN is returned when a signal cannot be
 * determined (never fabricated as PASS). EAOS tracks execution — nothing here
 * executes anything; live execution progress is honestly NOT_CONNECTED.
 *
 * Additive over V2 + V3 + V4 + V5 — does not break any existing verdicts.
 * Accepts optional engine overrides for all six engines (for testing).
 */
export async function analyzeWithExecution(
  rawInput: unknown,
  engineOverride?: LcisEngine,
  eisOverride?: EisEngine,
  govOverride?: GovernanceEngine,
  opsOverride?: OperationsEngine,
  einsOverride?: EngineeringEngine,
  eaosOverride?: OrchestrationEngine,
): Promise<PrReport> {
  const { report, changedFiles } = await _coreAnalyze(rawInput, engineOverride);
  const core = engineOverride ?? createEngine();
  const eis = eisOverride ?? createEisEngine({ core });
  const gov = govOverride ?? createGovernanceEngine({ core });
  const ops = opsOverride ?? createOperationsEngine({ core });
  const eins = einsOverride ?? createEngineeringEngine({ core });
  const eaos = eaosOverride ?? createOrchestrationEngine({ core });

  const [verdicts, governanceVerdicts, engineeringVerdicts, executionVerdicts] = await Promise.all([
    buildVerdicts(eis, report, changedFiles),
    buildGovernanceVerdicts(gov, report),
    buildEngineeringVerdicts(eins, report, changedFiles),
    buildExecutionVerdicts(eaos, report, changedFiles),
  ]);

  const affectedDomainKeys = report.affectedDomains.map((d) => d.key);
  const operationalVerdict = buildOperationalVerdict(ops, changedFiles, affectedDomainKeys);

  return { ...report, verdicts, governanceVerdicts, operationalVerdict, engineeringVerdicts, executionVerdicts };
}
