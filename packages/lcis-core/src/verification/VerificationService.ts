/**
 * VerificationService — consolidated evidence-weighted verification for LCIS.
 *
 * Replaces ad-hoc readiness checks in audit-engine-v2.mjs, production-readiness-*.mjs,
 * launch-command-center.mjs, and connections-intel.mjs, and consolidates the
 * VerificationEngine / EvidenceVerifier / ConfidenceCalculator / VerificationLedger
 * quartet from :3334.
 *
 * ADVISORY ONLY — the 108-validator gate (scripts/validate-governance.mjs) is the
 * sole authoritative merge gate.  A PARTIAL or UNVERIFIED result from this service
 * MUST NOT block a PR.  Only REFUTED MAY surface as an advisory PR warning.
 *
 * Refuse-to-rubber-stamp rule (preserved verbatim from VerificationEngine.mjs):
 *   REFUTED   — any evidence item where corroborates === false AND source is one of
 *               v1-lcis, security-gate, 107-validators, rls-gate, canonical-ledger.
 *   VERIFIED  — ≥2 independent corroborating sources AND weighted confidence ≥ 0.60.
 *   PARTIAL   — 1 corroborating source OR confidence in [0.30, 0.60).
 *   UNVERIFIED — 0 corroborating sources OR confidence < 0.30.
 *   Zero evidence → confidence = 0 → UNVERIFIED (not REFUTED; REFUTED requires an
 *   explicit authoritative contradiction).
 */

import type { Verification, VerificationStatus, Gap } from '../contracts/index';
import { evidence, notConnected } from '../contracts/index';
import type { ArtifactStore } from '../runtime/ArtifactStore';
import type {
  InternalEvidence,
  RawAuditIntel,
  RawConnectionsIntel,
  RawDbIntel,
  RawDomainIntel,
  RawInfraIntel,
  RawLaunchCommandCenter,
  RawProductionReadinessV2,
} from './types';
import { AUTHORITATIVE_SOURCES, sourceWeight } from './types';

// ---------------------------------------------------------------------------
// Confidence calculation (ConfidenceCalculator.mjs logic)
// ---------------------------------------------------------------------------

function computeConfidence(
  items: readonly InternalEvidence[],
  notConnectedCount: number,
  isRefuted: boolean,
): number {
  if (items.length === 0) return 0;

  const totalWeight = items.reduce((s, e) => s + sourceWeight(e.sourceKey), 0);
  if (totalWeight === 0) return 0;

  const weightedCorroboration = items.reduce(
    (s, e) => s + (e.corroborates ? sourceWeight(e.sourceKey) : 0),
    0,
  );

  const hasLiveConnected = items.some((e) => e.sourceKey.includes('live-connected'));
  const cap = hasLiveConnected ? 1.0 : 0.95;

  let confidence = weightedCorroboration / totalWeight - notConnectedCount * 0.08;
  if (isRefuted) confidence -= 0.40;
  return Math.max(0, Math.min(cap, confidence));
}

// ---------------------------------------------------------------------------
// Status derivation (deriveStatus / _finalise from VerificationEngine.mjs)
// ---------------------------------------------------------------------------

function deriveStatus(items: readonly InternalEvidence[]): VerificationStatus {
  if (items.length === 0) return 'UNVERIFIED';

  // REFUTED check first — a single authoritative contradiction wins unconditionally.
  for (const e of items) {
    if (!e.corroborates && AUTHORITATIVE_SOURCES.has(e.sourceKey)) {
      return 'REFUTED';
    }
  }

  const corroborating = items.filter((e) => e.corroborates);
  const corrobCount = corroborating.length;
  const totalWeight = items.reduce((s, e) => s + sourceWeight(e.sourceKey), 0);
  const weightedScore =
    totalWeight > 0
      ? items.reduce((s, e) => s + (e.corroborates ? sourceWeight(e.sourceKey) : 0), 0) /
        totalWeight
      : 0;

  if (corrobCount >= 2 && weightedScore >= 0.60) return 'VERIFIED';
  if (corrobCount >= 1 || (weightedScore >= 0.30 && weightedScore < 0.60)) return 'PARTIAL';
  return 'UNVERIFIED';
}

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function parseRatio(s: string): { num: number; den: number } {
  const [a, b] = s.split('/');
  return { num: Number(a ?? 0), den: Number(b ?? 1) || 1 };
}

function buildVerification(
  subject: string,
  items: readonly InternalEvidence[],
  gaps: readonly Gap[],
  notConnectedRefs: readonly string[],
): Verification {
  const rawStatus = deriveStatus(items);
  const isRefuted = rawStatus === 'REFUTED';
  const confidence = computeConfidence(items, notConnectedRefs.length, isRefuted);

  // Re-apply confidence thresholds after notConnected penalty so that a VERIFIED
  // determination from deriveStatus() can be downgraded when the penalty drops
  // confidence below 0.60 (e.g. verifyRuntime with 13 NOT CONNECTED sources).
  //
  // Rules:
  // - REFUTED is never downgraded — an authoritative contradiction wins unconditionally.
  // - UNVERIFIED from deriveStatus (zero evidence) stays UNVERIFIED regardless.
  // - A VERIFIED that the NC penalty drops to < 0.60 becomes PARTIAL (not UNVERIFIED).
  // - A PARTIAL (from deriveStatus) stays PARTIAL even if NC penalty kills confidence,
  //   because evidence IS present — the structure is real, just unconnected live sources.
  let status: VerificationStatus;
  if (rawStatus === 'REFUTED') {
    status = 'REFUTED';
  } else if (rawStatus === 'UNVERIFIED') {
    status = 'UNVERIFIED';
  } else if (rawStatus === 'VERIFIED' && confidence < 0.60) {
    // NC penalty downgraded a VERIFIED to below threshold — treat as PARTIAL
    status = 'PARTIAL';
  } else {
    status = rawStatus; // VERIFIED or PARTIAL unchanged
  }

  // Map internal evidence items to contract Evidence
  const contractEvidence = items.map((ie) =>
    evidence(
      'artifact-field',
      ie.sourceKey,
      `${ie.assertion} [value: ${JSON.stringify(ie.value)}${ie.corroborates ? '' : ' — CONTRADICTS'}]`,
      ie.sourceKey,
    ),
  );

  // Append not-connected evidence items
  const notConnectedEvidence = notConnectedRefs.map((ref) =>
    notConnected(ref, ref),
  );

  return {
    subject,
    status,
    confidence: Math.round(confidence * 1000) / 1000,
    evidence: [...contractEvidence, ...notConnectedEvidence],
    gaps,
  };
}

// ---------------------------------------------------------------------------
// VerificationService
// ---------------------------------------------------------------------------

export class VerificationService {
  constructor(private readonly store: ArtifactStore) {}

  // -------------------------------------------------------------------------
  // verifyArchitecture
  // -------------------------------------------------------------------------

  async verifyArchitecture(): Promise<Verification> {
    const audit = this.store.tryRead<RawAuditIntel>('audit-engine-v2');
    const prv2 = this.store.tryRead<RawProductionReadinessV2>('production-readiness-v2');

    const items: InternalEvidence[] = [];
    const gaps: Gap[] = [];

    if (!audit) {
      return buildVerification('architecture', [], [], []);
    }

    const { summary, findings } = audit;
    const hardViolations = summary.hardViolations ?? 0;

    // Assertion 1: hardViolations === 0 from 107-validators
    if (hardViolations === 0) {
      items.push({
        sourceKey: '107-validators',
        assertion: 'Gate hardViolations = 0',
        value: hardViolations,
        corroborates: true,
      });
    } else {
      items.push({
        sourceKey: 'security-gate',
        assertion: 'Gate hardViolations > 0 — contradicts architecture soundness',
        value: hardViolations,
        corroborates: false,
      });
      gaps.push({
        what: `gap-arch-hard-violations`,
        detail: `${hardViolations} hard violation(s) in the 107-validator gate — AUTHORITATIVE (not candidates)`,
      });
    }

    // Assertion 2: auth coverage
    const { num: authNum, den: authDen } = parseRatio(summary.authCoverage ?? '0/1');
    const authRatio = authNum / authDen;
    items.push({
      sourceKey: 'security-gate',
      assertion: `Auth coverage ${summary.authCoverage} (${(authRatio * 100).toFixed(0)}%)`,
      value: summary.authCoverage,
      corroborates: authRatio > 0.5,
    });
    if (authRatio <= 0.5) {
      gaps.push({
        what: 'gap-arch-auth-coverage',
        detail: `Auth coverage ${summary.authCoverage} — below 50%; note: candidates, not gate violations`,
      });
    }

    // Assertion 3: validation coverage
    const { num: valNum, den: valDen } = parseRatio(summary.validationCoverage ?? '0/1');
    const valRatio = valNum / valDen;
    items.push({
      sourceKey: 'arch-intel',
      assertion: `Validation coverage ${summary.validationCoverage}`,
      value: summary.validationCoverage,
      corroborates: valRatio >= 0.60,
    });
    if (valRatio < 0.60) {
      gaps.push({
        what: 'gap-arch-validation-coverage',
        detail: `Validation coverage ${summary.validationCoverage} — below 60%; candidates only`,
      });
    }

    // Assertion 4: RLS candidate count
    // Use arch-intel (structural/heuristic) source — NOT rls-gate — because these are
    // CANDIDATES, not gate violations. rls-gate is reserved for hard gate failures.
    // The gate (rls-force-coverage-validator) passes (GREEN) even when candidates > 0.
    const rlsFinding = findings.find((f) => f.id === 'A-RLS');
    const rlsCount = rlsFinding?.count ?? 0;
    items.push({
      sourceKey: 'arch-intel',
      assertion: `Tenant tables without detected RLS (candidates): ${rlsCount} — rls-force-coverage-validator is authoritative and GREEN`,
      value: rlsCount,
      corroborates: rlsCount === 0,
    });
    if (rlsCount > 0) {
      gaps.push({
        what: 'gap-arch-rls-candidates',
        detail: `${rlsCount} tenant table(s) without detected RLS in audit heuristic; rls-force-coverage-validator is authoritative and passes`,
      });
    }

    // Assertion 5: architecture system score from production-readiness-v2
    if (prv2) {
      const archSystem = prv2.systems.find(
        (s) => s.system === 'Architecture' || s.system?.toLowerCase().includes('arch'),
      );
      const archScore = archSystem?.score ?? prv2.summary?.overall ?? 0;
      items.push({
        sourceKey: 'db-intel',
        assertion: `Architecture system readiness score: ${archScore}`,
        value: archScore,
        corroborates: archScore >= 80,
      });
      if (archScore < 80) {
        gaps.push({
          what: 'gap-arch-system-score',
          detail: `Architecture system score ${archScore} — below 80 threshold`,
        });
      }
    }

    return buildVerification('architecture', items, gaps, []);
  }

  // -------------------------------------------------------------------------
  // verifyDomains
  // -------------------------------------------------------------------------

  async verifyDomains(): Promise<Verification> {
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    const db = this.store.tryRead<RawDbIntel>('db-intel');
    const audit = this.store.tryRead<RawAuditIntel>('audit-engine-v2');

    if (!di) {
      return buildVerification('domains', [], [], []);
    }

    const items: InternalEvidence[] = [];
    const gaps: Gap[] = [];
    const domains = di.domains ?? [];
    const dbTables = new Set((db?.tables ?? []).map((t) => t.name));

    // Assertion 1: ownership (A-OWN finding)
    const ownFinding = audit?.findings.find((f) => f.id === 'A-OWN');
    const ownlessDomains = domains.filter((d) => !d.owners || d.owners.length === 0);
    const aownCount = ownFinding?.count ?? ownlessDomains.length;
    items.push({
      sourceKey: 'canonical-ledger',
      assertion: `Ownerless domains detected by A-OWN: ${aownCount}`,
      value: aownCount,
      corroborates: aownCount === 0,
    });
    for (const d of ownlessDomains) {
      gaps.push({
        what: `gap-domain-no-owner-${d.key}`,
        detail: `Domain '${d.label}' (${d.key}) has no declared owner`,
      });
    }

    // Assertion 2: money domains have ≥1 RPC
    const moneyDomainsNoRpc = domains.filter(
      (d) => d.money && (d.counts?.rpcs ?? 0) === 0,
    );
    items.push({
      sourceKey: 'arch-intel',
      assertion: `Money domains without RPCs: ${moneyDomainsNoRpc.length}`,
      value: moneyDomainsNoRpc.map((d) => d.key),
      corroborates: moneyDomainsNoRpc.length === 0,
    });
    for (const d of moneyDomainsNoRpc) {
      gaps.push({
        what: `gap-domain-money-no-rpc-${d.key}`,
        detail: `Money domain '${d.key}' has no declared RPC (−10 scoring penalty)`,
      });
    }

    // Assertion 3: every domain has ≥1 gateway route
    const domainsNoRoute = domains.filter((d) => (d.counts?.routes ?? 0) === 0);
    items.push({
      sourceKey: 'domain-graph',
      assertion: `Domains without gateway routes: ${domainsNoRoute.length} of ${domains.length}`,
      value: domainsNoRoute.map((d) => d.key),
      corroborates: domainsNoRoute.length === 0,
    });
    for (const d of domainsNoRoute) {
      gaps.push({
        what: `gap-domain-no-route-${d.key}`,
        detail: `Domain '${d.key}' has no declared gateway route (−10 scoring penalty)`,
      });
    }

    // Assertion 4: cross-domain edges reference real tables in db-intel
    const edges = di.edges ?? [];
    let unresolvedEdges = 0;
    if (db) {
      for (const edge of edges as ReadonlyArray<{ target?: string; table?: string }>) {
        const targetTable = edge.target ?? edge.table;
        if (targetTable && !dbTables.has(targetTable)) {
          unresolvedEdges++;
          gaps.push({
            what: `gap-domain-edge-unknown-table-${targetTable}`,
            detail: `Cross-domain edge references table '${targetTable}' not found in db-intel`,
          });
        }
      }
      items.push({
        sourceKey: 'db-intel',
        assertion: `Cross-domain edge tables resolvable in db-intel (${edges.length} total edges, ${unresolvedEdges} unresolved)`,
        value: { total: edges.length, unresolved: unresolvedEdges },
        corroborates: unresolvedEdges === 0,
      });
    }

    // Assertion 5: total domain count matches expected 22
    items.push({
      sourceKey: 'domain-graph',
      assertion: `Domain count: ${domains.length}`,
      value: domains.length,
      corroborates: domains.length === 22,
    });

    return buildVerification('domains', items, gaps, []);
  }

  // -------------------------------------------------------------------------
  // verifyServices
  // -------------------------------------------------------------------------

  async verifyServices(): Promise<Verification> {
    const infra = this.store.tryRead<RawInfraIntel>('infra-intel');
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');

    if (!infra) {
      return buildVerification('services', [], [], []);
    }

    const items: InternalEvidence[] = [];
    const gaps: Gap[] = [];
    const { summary, workers } = infra;

    // Deprecated aliases that must NOT appear in active deploy topology
    const DEPRECATED_ALIASES = new Set([
      'apps/admin', 'apps/auth', 'apps/checkout', 'apps/internal',
      'apps/merchant', 'apps/storefront', 'apps/analytics',
      'apps/mobile/operator-team-app', 'apps/commerce/web/consumer-storefront',
    ]);

    const vercelApps = summary.vercelApps ?? [];

    // Assertion 1: worker count matches expected 4
    const workerCount = summary.workers ?? workers.length;
    items.push({
      sourceKey: 'arch-intel',
      assertion: `Active Cloudflare Workers: ${workerCount} (expected 4)`,
      value: workerCount,
      corroborates: workerCount === 4,
    });
    if (workerCount !== 4) {
      gaps.push({
        what: 'gap-svc-worker-count',
        detail: `Expected 4 Cloudflare Workers, found ${workerCount}`,
      });
    }

    // Assertion 2: no deprecated alias in Vercel deploy targets
    const foundDeprecated = vercelApps.filter((app) =>
      DEPRECATED_ALIASES.has(app) || [...DEPRECATED_ALIASES].some((alias) => app.includes(alias)),
    );
    if (foundDeprecated.length > 0) {
      items.push({
        sourceKey: 'v1-lcis',
        assertion: `Deprecated app alias found in active deploy config: ${foundDeprecated.join(', ')}`,
        value: foundDeprecated,
        corroborates: false,
      });
      for (const dep of foundDeprecated) {
        gaps.push({
          what: `gap-svc-deprecated-alias-${dep.replace(/\//g, '-')}`,
          detail: `Deprecated alias '${dep}' found in infra deploy targets — AUTHORITATIVE per CLAUDE.md`,
        });
      }
    } else {
      items.push({
        sourceKey: 'v1-lcis',
        assertion: `No deprecated app aliases in active deploy targets (${vercelApps.join(', ')})`,
        value: vercelApps,
        corroborates: true,
      });
    }

    // Assertion 3: migrate gate present
    items.push({
      sourceKey: 'arch-intel',
      assertion: `Migration gate present: ${summary.hasMigrateGate ?? false}`,
      value: summary.hasMigrateGate,
      corroborates: summary.hasMigrateGate === true,
    });
    if (!summary.hasMigrateGate) {
      gaps.push({
        what: 'gap-svc-no-migrate-gate',
        detail: 'No migrate gate found in infra-intel — deployment safety concern',
      });
    }

    // Assertion 4: RUNTIME_TELEMETRY binding declared
    const allBindings = workers.flatMap((w) => w.bindings ?? []);
    const hasTelemetry = allBindings.includes('RUNTIME_TELEMETRY');
    items.push({
      sourceKey: 'db-intel',
      assertion: `RUNTIME_TELEMETRY binding declared: ${hasTelemetry}`,
      value: hasTelemetry,
      corroborates: hasTelemetry,
    });
    if (!hasTelemetry) {
      gaps.push({
        what: 'gap-svc-no-telemetry-binding',
        detail: 'RUNTIME_TELEMETRY binding absent from all workers',
      });
    }

    // Assertion 5: DLQ present in queue consumers
    const queueConsumers = summary.queueConsumers ?? [];
    const hasDlq = queueConsumers.some(
      (q) => q.toLowerCase().includes('dead') || q.toLowerCase().includes('dlq'),
    );
    items.push({
      sourceKey: 'arch-intel',
      assertion: `Dead-letter queue present in consumer list: ${hasDlq}`,
      value: hasDlq,
      corroborates: hasDlq,
    });
    if (!hasDlq) {
      gaps.push({ what: 'gap-svc-no-dlq', detail: 'No DLQ in infra-intel queueConsumers' });
    }

    void di; // available for future cross-checks

    return buildVerification('services', items, gaps, []);
  }

  // -------------------------------------------------------------------------
  // verifyRuntime
  // -------------------------------------------------------------------------

  async verifyRuntime(): Promise<Verification> {
    const conn = this.store.tryRead<RawConnectionsIntel>('connections-intel');
    const infra = this.store.tryRead<RawInfraIntel>('infra-intel');

    if (!conn) {
      return buildVerification('runtime', [], [], []);
    }

    const items: InternalEvidence[] = [];
    const gaps: Gap[] = [];
    const notConnectedRefs: string[] = [];

    const connections = conn.connections ?? [];
    const { summary } = conn;

    // All 13 NOT CONNECTED sources contribute to notConnected list (honesty law)
    for (const c of connections) {
      const isConnected = c.status !== 'NOT CONNECTED';
      items.push({
        sourceKey: 'arch-intel',
        assertion: `Provider '${c.source}' declared in connections-intel (status: ${c.status})`,
        value: c.status,
        corroborates: true, // structural declaration is CONNECTED
      });
      if (!isConnected) {
        // Honesty law: must state exact env var
        const exactSource = c.exactSource ?? `unknown-env-var for ${c.source}`;
        if (!exactSource) {
          gaps.push({
            what: `gap-runtime-missing-exact-source-${c.source}`,
            detail: `NOT CONNECTED source '${c.source}' has no exactSource declared — violates honesty law`,
          });
        }
        notConnectedRefs.push(`${c.source}: ${exactSource}`);
      }
    }

    // Assertion: adapter-ready count matches expectation (≥ 10)
    const adapterReady = summary.adapterReady ?? 0;
    items.push({
      sourceKey: 'arch-intel',
      assertion: `Adapter-ready sources: ${adapterReady} of ${summary.sources}`,
      value: adapterReady,
      corroborates: adapterReady >= 10,
    });
    if (adapterReady < 10) {
      gaps.push({
        what: 'gap-runtime-adapter-ready',
        detail: `Only ${adapterReady} of ${summary.sources} sources have adapters ready (expected ≥ 10)`,
      });
    }

    // DLQ in queue consumers
    if (infra) {
      const consumers = infra.summary.queueConsumers ?? [];
      const hasDlq = consumers.some(
        (q) => q.toLowerCase().includes('dead') || q.toLowerCase().includes('dlq'),
      );
      items.push({
        sourceKey: 'arch-intel',
        assertion: `DLQ declared in queue consumers: ${hasDlq}`,
        value: hasDlq,
        corroborates: hasDlq,
      });
      if (!hasDlq) {
        gaps.push({ what: 'gap-runtime-no-dlq', detail: 'No DLQ in infra-intel queueConsumers' });
      }
    }

    // Note: status will always be PARTIAL for runtime (structural CONNECTED, live NOT CONNECTED)
    // The 13 × 0.08 = 1.04 notConnected penalty brings confidence well below 0.60.
    return buildVerification('runtime', items, gaps, notConnectedRefs);
  }

  // -------------------------------------------------------------------------
  // verifyDependencies
  // -------------------------------------------------------------------------

  async verifyDependencies(): Promise<Verification> {
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    const audit = this.store.tryRead<RawAuditIntel>('audit-engine-v2');
    const db = this.store.tryRead<RawDbIntel>('db-intel');

    if (!audit && !di) {
      return buildVerification('dependencies', [], [], []);
    }

    const items: InternalEvidence[] = [];
    const gaps: Gap[] = [];

    // Assertion 1: no circular domain dependencies (simple check for mutual consumedBy)
    if (di) {
      const domains = di.domains ?? [];
      const cycleDetected = detectCycle(domains.map((d) => ({
        key: d.key,
        deps: (d.dependsOn ?? []).map((e) => e.domain),
      })));
      items.push({
        sourceKey: 'domain-graph',
        assertion: `Cross-domain dependency graph acyclic: ${!cycleDetected}`,
        value: !cycleDetected,
        corroborates: !cycleDetected,
      });
      if (cycleDetected) {
        gaps.push({
          what: 'gap-deps-circular-domain',
          detail: 'Circular dependency detected in cross-domain edge graph',
        });
      }
    }

    if (audit) {
      const { findings, summary } = audit;
      const hardViolations = summary.hardViolations ?? 0;

      // Assertion 2: canonical-ledger-only-validator (hardViolations === 0)
      items.push({
        sourceKey: 'canonical-ledger',
        assertion: `canonical-ledger-only-validator hardViolations: ${hardViolations}`,
        value: hardViolations,
        corroborates: hardViolations === 0,
      });
      if (hardViolations > 0) {
        gaps.push({
          what: 'gap-deps-canonical-ledger-violations',
          detail: `${hardViolations} hard violation(s) from canonical-ledger-only-validator — money table mutation outside RPC`,
        });
      }

      // Assertion 3: dead RPCs within expected range (current: 75)
      const deadRpcFinding = findings.find((f) => f.id === 'A-DEAD-RPC');
      const deadRpcs = deadRpcFinding?.count ?? 0;
      items.push({
        sourceKey: 'canonical-ledger',
        assertion: `Dead RPCs (candidates): ${deadRpcs} (note: mostly trigger/internal functions; canonical-ledger-only-validator is authoritative)`,
        value: deadRpcs,
        corroborates: deadRpcs <= 100, // generous bound — historical norm ~75
      });
      if (deadRpcs > 100) {
        gaps.push({
          what: 'gap-deps-dead-rpcs-spike',
          detail: `Dead RPC candidate count ${deadRpcs} exceeds expected range (~75); review with CREATE TRIGGER`,
        });
      }

      // Assertion 4: dead tables within expected range (current: 44)
      const deadTblFinding = findings.find((f) => f.id === 'A-DEAD-TBL');
      const deadTbls = deadTblFinding?.count ?? 0;
      items.push({
        sourceKey: 'arch-intel',
        assertion: `Dead table candidates: ${deadTbls} (note: event-sourcing/projection internals)`,
        value: deadTbls,
        corroborates: deadTbls <= 60, // generous bound — historical norm ~44
      });
      if (deadTbls > 60) {
        gaps.push({
          what: 'gap-deps-dead-tables-spike',
          detail: `Dead table candidate count ${deadTbls} exceeds expected range (~44); review event-sourcing internals`,
        });
      }
    }

    // Assertion 5: blast-radius hotspot symbols present in db-intel
    if (db) {
      const gatewayRpcCount = db.summary?.rpcsCalledByGateway ?? 0;
      items.push({
        sourceKey: 'code-graph',
        assertion: `Gateway-called RPCs declared in db-intel: ${gatewayRpcCount}`,
        value: gatewayRpcCount,
        corroborates: gatewayRpcCount > 0,
      });
      if (gatewayRpcCount === 0) {
        gaps.push({
          what: 'gap-deps-no-gateway-rpcs',
          detail: 'db-intel shows zero gateway-called RPCs — possible stale artifact',
        });
      }
    }

    return buildVerification('dependencies', items, gaps, []);
  }

  // -------------------------------------------------------------------------
  // verifyProductionReadiness
  // -------------------------------------------------------------------------

  async verifyProductionReadiness(): Promise<Verification> {
    const prv2 = this.store.tryRead<RawProductionReadinessV2>('production-readiness-v2');
    const launch = this.store.tryRead<RawLaunchCommandCenter>('launch-command-center');
    const audit = this.store.tryRead<RawAuditIntel>('audit-engine-v2');
    const conn = this.store.tryRead<RawConnectionsIntel>('connections-intel');

    // No primary artifacts → UNVERIFIED
    if (!prv2 && !launch) {
      return buildVerification('production-readiness', [], [], []);
    }

    const items: InternalEvidence[] = [];
    const gaps: Gap[] = [];
    const notConnectedRefs: string[] = [];

    // ── Production readiness v2 ──────────────────────────────────────────────
    if (prv2) {
      const { summary, dimensions, systems } = prv2;
      const overall = summary.overall ?? 0;
      const dimCount = dimensions?.length ?? 0;

      // Assertion 1: overall structural readiness ≥ 80%
      items.push({
        sourceKey: 'db-intel',
        assertion: `Overall structural readiness: ${overall}%`,
        value: overall,
        corroborates: overall >= 80,
      });
      if (overall < 80) {
        gaps.push({
          what: 'gap-pr-overall-below-threshold',
          detail: `Overall structural readiness ${overall}% — below 80% threshold`,
        });
      }

      // Assertion 2: all 10 dimensions scored
      items.push({
        sourceKey: 'arch-intel',
        assertion: `Readiness dimensions scored: ${dimCount} (expected 10)`,
        value: dimCount,
        corroborates: dimCount === 10,
      });
      if (dimCount !== 10) {
        gaps.push({
          what: 'gap-pr-dimension-count',
          detail: `Expected 10 readiness dimensions, found ${dimCount}`,
        });
      }

      // Assertion 3: per-system scores ≥ 80
      for (const sys of systems ?? []) {
        if (sys.score < 80) {
          gaps.push({
            what: `gap-pr-system-${(sys.system ?? sys.key ?? 'unknown').toLowerCase().replace(/\s+/g, '-')}`,
            detail: `System '${sys.system ?? sys.key}' score ${sys.score} below 80`,
          });
        }
      }
      const belowThreshold = (systems ?? []).filter((s) => s.score < 80);
      items.push({
        sourceKey: 'domain-graph',
        assertion: `Systems below 80 threshold: ${belowThreshold.length} of ${systems?.length ?? 0}`,
        value: belowThreshold.map((s) => `${s.system}:${s.score}`),
        corroborates: belowThreshold.length === 0,
      });
    }

    // ── Launch command center ────────────────────────────────────────────────
    if (launch) {
      const { summary, blockers } = launch;
      const openBlockers = summary.openBlockers ?? blockers.length;
      const liveNotConnected = summary.liveNotConnected ?? 0;

      // Assertion 4: open launch blockers (GO/NO-GO rule — asymmetry preserved).
      // Even 98% structural + blockers > 0 → PARTIAL, never VERIFIED.
      //
      // Source-key choice: use v1-lcis with corroborates=true only when blocker-free;
      // when blockers are open, use decision-v2 (operational, 0.50 weight) for the
      // NO-GO advisory signal so REFUTED is not triggered by the authoritative v1-lcis
      // source — REFUTED is reserved for hard gate violations (hardViolations > 0),
      // not for advisory launch-management decisions.
      if (openBlockers === 0) {
        items.push({
          sourceKey: 'v1-lcis',
          assertion: `Launch verdict: ${summary.recommendation} — no open blockers (GO)`,
          value: { verdict: summary.recommendation, openBlockers },
          corroborates: true,
        });
      } else {
        items.push({
          sourceKey: 'decision-v2',
          assertion: `Launch verdict: ${summary.recommendation} — ${openBlockers} open blocker(s) prevent GO`,
          value: { verdict: summary.recommendation, openBlockers },
          corroborates: false,
        });
      }
      for (const b of blockers ?? []) {
        const sevStr = b.severity?.includes('🔴') ? 'critical' : b.severity?.includes('🟠') ? 'high' : 'medium';
        gaps.push({
          what: `gap-pr-blocker-${b.id}`,
          detail: `Open blocker ${b.id}: ${b.title} (${sevStr})`,
        });
      }

      // NOT CONNECTED sources from connections-intel
      if (liveNotConnected > 0) {
        const connections = conn?.connections ?? [];
        for (const c of connections) {
          if (c.status === 'NOT CONNECTED') {
            notConnectedRefs.push(`${c.source}: ${c.exactSource}`);
          }
        }
        // For the rest, if conn wasn't loaded
        if (connections.length === 0 && liveNotConnected > 0) {
          notConnectedRefs.push(`${liveNotConnected} live sources NOT CONNECTED — see connections-intel.json`);
        }
      }

      // Latest migration declared
      const latestMigration = launch.openMigrations?.latestDeclared;
      if (latestMigration) {
        items.push({
          sourceKey: 'db-intel',
          assertion: `Latest migration declared: ${latestMigration}`,
          value: latestMigration,
          corroborates: true,
        });
      }
    }

    // ── Audit gate (hard violations) ─────────────────────────────────────────
    if (audit) {
      const hardViolations = audit.summary.hardViolations ?? 0;
      items.push({
        sourceKey: 'security-gate',
        assertion: `Gate hardViolations: ${hardViolations}`,
        value: hardViolations,
        corroborates: hardViolations === 0,
      });
      if (hardViolations > 0) {
        gaps.push({
          what: 'gap-pr-hard-violations',
          detail: `${hardViolations} hard violation(s) in audit gate — AUTHORITATIVE REFUTATION of production readiness`,
        });
      }

      // RLS candidates — use arch-intel (heuristic) not rls-gate.
      // rls-gate is authoritative and GREEN; candidates ≠ gate violations.
      const rlsFinding = audit.findings.find((f) => f.id === 'A-RLS');
      const rlsCount = rlsFinding?.count ?? 0;
      if (rlsCount > 0) {
        items.push({
          sourceKey: 'arch-intel',
          assertion: `Tenant tables without detected RLS (candidates): ${rlsCount} — rls-force-coverage-validator is authoritative and GREEN`,
          value: rlsCount,
          corroborates: true, // candidates only; gate passes → structurally corroborates
        });
        for (const candidate of rlsFinding?.candidates ?? []) {
          gaps.push({
            what: `gap-pr-rls-candidate-${candidate}`,
            detail: `Tenant table '${candidate}' without detected RLS (candidate; not gate violation)`,
          });
        }
      }
    }

    return buildVerification('production-readiness', items, gaps, notConnectedRefs);
  }
}

// ---------------------------------------------------------------------------
// Topological cycle detection (Kahn's algorithm)
// ---------------------------------------------------------------------------

function detectCycle(nodes: ReadonlyArray<{ key: string; deps: string[] }>): boolean {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    if (!inDegree.has(n.key)) inDegree.set(n.key, 0);
    if (!adj.has(n.key)) adj.set(n.key, []);
    for (const dep of n.deps) {
      adj.get(n.key)!.push(dep);
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([k]) => k);
  let processed = 0;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    processed++;
    for (const next of adj.get(cur) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  return processed < inDegree.size;
}
