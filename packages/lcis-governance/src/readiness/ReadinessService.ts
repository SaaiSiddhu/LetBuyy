/**
 * ReadinessService — GDIS Phase 5 production & operational readiness evaluation.
 *
 * Evaluates 10 ReadinessFactors per domain/service, surfacing UNKNOWN factors honestly
 * (never fabricated, never counted as pass). Reuses core.verification.verifyProductionReadiness()
 * for launch readiness — no reimplementation.
 *
 * Factor weights (out of 1.0, sum of KNOWN factors used as denominator):
 *   owner        0.15  — explicit owner in domain-intel
 *   runbook      0.15  — runbook subject present (operational)
 *   tests        0.12  — graph nodes matching test file pattern
 *   rollback     0.10  — UNKNOWN (no artifact encodes this)
 *   coverage     0.10  — tests present + breadth proxy
 *   documentation 0.10 — memory.search doc hit for domain
 *   healthcheck  0.08  — UNKNOWN (worker declared ✓, live probe NOT CONNECTED)
 *   monitoring   0.08  — UNKNOWN (no monitoring-intent artifact)
 *   alerts       0.07  — UNKNOWN (no alert-config artifact)
 *   security     0.05  — tenant tables have RLS + securityDefiner posture present
 *
 * UNKNOWN factors appear in `unknowns`, are excluded from the denominator, and
 * push the band toward 'unknown' when too few factors are known.
 */

import type { LcisEngine } from '@letbuyy/lcis-core';
import { evidence, notConnected } from '@letbuyy/lcis-core';
import {
  GovernanceArtifactStore,
  GovernanceEvidenceBuilder,
  governance,
  defaultNow,
  type ReadinessReport,
  type ReadinessScore,
  type ReadinessFactor,
  type ReadinessFactorKey,
  type ReadinessBand,
} from '../shared/index';

// ── weights ────────────────────────────────────────────────────────────────────

const WEIGHTS: Record<ReadinessFactorKey, number> = {
  owner: 0.15,
  runbook: 0.15,
  tests: 0.12,
  rollback: 0.10,
  coverage: 0.10,
  documentation: 0.10,
  healthcheck: 0.08,
  monitoring: 0.08,
  alerts: 0.07,
  security: 0.05,
};

// ── internal helpers ───────────────────────────────────────────────────────────

function scoreBand(score: number, knownCount: number): ReadinessBand {
  // If fewer than 4 KNOWN factors, the picture is too incomplete to rate
  if (knownCount < 4) return 'unknown';
  if (score >= 80) return 'ready';
  if (score >= 50) return 'conditional';
  return 'not-ready';
}

/**
 * Compute 0..100 readiness score over only the KNOWN factors.
 * Passed factors contribute their weight; the denominator is the sum of KNOWN-factor weights.
 */
function computeScore(factors: readonly ReadinessFactor[]): number {
  const known = factors.filter((f) => f.present !== 'UNKNOWN');
  if (known.length === 0) return 0;
  const denominator = known.reduce((s, f) => s + f.weight, 0);
  if (denominator === 0) return 0;
  const numerator = known.filter((f) => f.present === true).reduce((s, f) => s + f.weight, 0);
  return Math.round((numerator / denominator) * 100);
}

function unknownKeys(factors: readonly ReadinessFactor[]): readonly ReadinessFactorKey[] {
  return factors.filter((f) => f.present === 'UNKNOWN').map((f) => f.key);
}

// ── ReadinessService ───────────────────────────────────────────────────────────

export class ReadinessService {
  private readonly gov: GovernanceArtifactStore;
  private readonly eb: GovernanceEvidenceBuilder;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.gov = new GovernanceArtifactStore(core);
    this.eb = new GovernanceEvidenceBuilder();
  }

  // ── factor builders ─────────────────────────────────────────────────────────

  private factorOwner(domainKey: string, owners: readonly string[]): ReadinessFactor {
    const present = owners.length > 0;
    return {
      key: 'owner',
      present,
      weight: WEIGHTS.owner,
      evidence: [
        this.eb.domain(domainKey, present ? `owners: ${owners.join(', ')}` : 'no owners declared'),
      ],
    };
  }

  private factorRunbook(domainKey: string, runbookSubjects: readonly string[]): ReadinessFactor {
    const key = domainKey.toLowerCase();
    const present = runbookSubjects.some((s) => s === key || s.includes(key) || key.includes(s));
    return {
      key: 'runbook',
      present,
      weight: WEIGHTS.runbook,
      evidence: [
        this.eb.domain(domainKey, present ? 'runbook subject found' : 'no runbook subject found'),
      ],
    };
  }

  private factorTests(domainKey: string): ReadinessFactor {
    // search the code graph for test files / test nodes referencing this domain
    const hits = this.core.graph.search(`test ${domainKey}`, 20);
    const testHits = hits.filter((n) => {
      const id = (n.id ?? '').toLowerCase();
      const label = (n.label ?? '').toLowerCase();
      return id.includes('test') || id.includes('spec') || label.includes('test') || label.includes('spec');
    });
    const present = testHits.length > 0;
    return {
      key: 'tests',
      present,
      weight: WEIGHTS.tests,
      evidence: [
        evidence(
          'graph-node',
          `test:${domainKey}`,
          present ? `${testHits.length} test node(s) found` : 'no test nodes found',
          'graphify-out/graph.json',
        ),
      ],
    };
  }

  /** Rollback: UNKNOWN — no artifact encodes rollback presence. */
  private factorRollback(): ReadinessFactor {
    return {
      key: 'rollback',
      present: 'UNKNOWN',
      weight: WEIGHTS.rollback,
      evidence: [notConnected('rollback-presence', 'ROLLBACK_ARTIFACT_NOT_IN_GRAPHIFY_OUT')],
    };
  }

  private factorCoverage(domainKey: string): ReadinessFactor {
    // proxy: breadth of test hits (>=3 test nodes = covered)
    const hits = this.core.graph.search(`test ${domainKey}`, 30);
    const testHits = hits.filter((n) => {
      const id = (n.id ?? '').toLowerCase();
      const label = (n.label ?? '').toLowerCase();
      return id.includes('test') || id.includes('spec') || label.includes('test') || label.includes('spec');
    });
    const present = testHits.length >= 3;
    return {
      key: 'coverage',
      present,
      weight: WEIGHTS.coverage,
      evidence: [
        evidence(
          'graph-node',
          `coverage:${domainKey}`,
          `${testHits.length} test node(s) — coverage present if ≥3`,
          'graphify-out/graph.json',
        ),
      ],
    };
  }

  private factorDocumentation(domainKey: string): ReadinessFactor {
    const hits = this.core.memory.search(domainKey, { limit: 5 });
    const present = hits.length > 0;
    return {
      key: 'documentation',
      present,
      weight: WEIGHTS.documentation,
      evidence: [
        evidence(
          'doc',
          `doc:${domainKey}`,
          present ? `${hits.length} memory hit(s)` : 'no memory hits',
          'docs/',
        ),
      ],
    };
  }

  /**
   * Healthcheck: UNKNOWN — worker binding is declared in infra-intel (structural), but
   * a live healthcheck probe requires a connected runtime (NOT CONNECTED).
   */
  private factorHealthcheck(): ReadinessFactor {
    return {
      key: 'healthcheck',
      present: 'UNKNOWN',
      weight: WEIGHTS.healthcheck,
      evidence: [notConnected('healthcheck-live-probe', 'HEALTHCHECK_PROBE_NOT_CONNECTED')],
    };
  }

  /** Monitoring: UNKNOWN — no monitoring-intent artifact in graphify-out. */
  private factorMonitoring(): ReadinessFactor {
    return {
      key: 'monitoring',
      present: 'UNKNOWN',
      weight: WEIGHTS.monitoring,
      evidence: [notConnected('monitoring-config', 'MONITORING_ARTIFACT_NOT_IN_GRAPHIFY_OUT')],
    };
  }

  /** Alerts: UNKNOWN — no alert-config artifact in graphify-out. */
  private factorAlerts(): ReadinessFactor {
    return {
      key: 'alerts',
      present: 'UNKNOWN',
      weight: WEIGHTS.alerts,
      evidence: [notConnected('alert-config', 'ALERT_CONFIG_NOT_IN_GRAPHIFY_OUT')],
    };
  }

  private factorSecurity(domainKey: string): ReadinessFactor {
    const tables = this.gov.tables();
    const policies = this.gov.policies();
    const functions = this.gov.functions();

    // tenant tables in this domain should have RLS
    const tenantTables = tables.filter((t) => t.tenant);
    const rlsOk = tenantTables.every((t) => t.rls);
    // at least one securityDefiner function exists (global posture)
    const hasSecDef = functions.some((f) => f.securityDefiner);
    // policies > 0 (there are policies protecting tenant data)
    const hasPolicies = policies.length > 0;

    const present = rlsOk && hasSecDef && hasPolicies;

    const ev = [
      this.eb.domain(
        domainKey,
        `RLS on all tenant tables: ${rlsOk}, securityDefiner present: ${hasSecDef}, policies: ${policies.length}`,
      ),
    ];
    if (tenantTables.length > 0) {
      ev.push(this.eb.table(tenantTables[0]!.name, `rls=${tenantTables[0]!.rls}, tenant=true`));
    }

    return {
      key: 'security',
      present,
      weight: WEIGHTS.security,
      evidence: ev,
    };
  }

  // ── domain readiness ─────────────────────────────────────────────────────────

  async evaluateDomainReadiness(domainKey: string): Promise<ReadinessScore> {
    const domains = this.gov.domains();
    const domain = domains.find((d) => d.key === domainKey);
    const runbookSubjects = this.gov.runbookSubjects();

    const owners = domain?.owners ?? [];
    const factors: ReadinessFactor[] = [
      this.factorOwner(domainKey, owners),
      this.factorRunbook(domainKey, runbookSubjects),
      this.factorTests(domainKey),
      this.factorRollback(),
      this.factorCoverage(domainKey),
      this.factorDocumentation(domainKey),
      this.factorHealthcheck(),
      this.factorMonitoring(),
      this.factorAlerts(),
      this.factorSecurity(domainKey),
    ];

    const score = computeScore(factors);
    const unknowns = unknownKeys(factors);
    const knownCount = factors.length - unknowns.length;
    const band = scoreBand(score, knownCount);

    const allEvidence = factors.flatMap((f) => [...f.evidence]);

    const summary = domain
      ? `Domain '${domainKey}': score=${score}/100, band=${band}, ${unknowns.length} UNKNOWN factor(s)`
      : `Domain '${domainKey}' not found in domain-intel; scoring on available artifacts`;

    return governance(
      {
        subject: domainKey,
        score,
        factors,
        band,
        unknowns,
        summary,
      },
      { evidence: allEvidence, now: this.now },
    );
  }

  // ── service (worker) readiness ───────────────────────────────────────────────

  async evaluateServiceReadiness(workerName: string): Promise<ReadinessScore> {
    const workers = this.gov.workers();
    const worker = workers.find((w) => w.name === workerName || w.file.includes(workerName));
    const runbookSubjects = this.gov.runbookSubjects();
    const ownership = this.gov.ownership();

    // owner: look for ownership entry covering the worker file
    const ownerEntry = worker
      ? ownership.find((o) => o.path && worker.file.includes(o.path.replace(/\*/g, '').replace('@', '')))
      : undefined;
    const owners = ownerEntry?.owners ?? [];

    const factorOwner: ReadinessFactor = {
      key: 'owner',
      present: owners.length > 0,
      weight: WEIGHTS.owner,
      evidence: [
        worker
          ? this.eb.worker(worker.name, owners.length > 0 ? `owners: ${owners.join(', ')}` : 'no owners')
          : evidence('worker', workerName, 'worker not found in infra-intel', 'graphify-out/infra-intel.json'),
      ],
    };

    const factorRunbook: ReadinessFactor = {
      key: 'runbook',
      present: runbookSubjects.some((s) => s.includes(workerName.toLowerCase()) || workerName.toLowerCase().includes(s)),
      weight: WEIGHTS.runbook,
      evidence: [evidence('artifact-field', `runbook:${workerName}`, 'runbook subject check', 'graphify-out/runbooks.json')],
    };

    // healthcheck: UNKNOWN (live probe NOT CONNECTED)
    const factorHealthcheck: ReadinessFactor = {
      key: 'healthcheck',
      present: 'UNKNOWN',
      weight: WEIGHTS.healthcheck,
      evidence: [notConnected(`healthcheck:${workerName}`, 'HEALTHCHECK_PROBE_NOT_CONNECTED')],
    };

    const factorMonitoring: ReadinessFactor = {
      key: 'monitoring',
      present: 'UNKNOWN',
      weight: WEIGHTS.monitoring,
      evidence: [notConnected(`monitoring:${workerName}`, 'MONITORING_ARTIFACT_NOT_IN_GRAPHIFY_OUT')],
    };

    // tests: graph search for worker-specific test nodes
    const testHits = this.core.graph.search(`test ${workerName}`, 20).filter((n) => {
      const id = (n.id ?? '').toLowerCase();
      return id.includes('test') || id.includes('spec');
    });
    const factorTests: ReadinessFactor = {
      key: 'tests',
      present: testHits.length > 0,
      weight: WEIGHTS.tests,
      evidence: [evidence('graph-node', `test:${workerName}`, `${testHits.length} test node(s)`, 'graphify-out/graph.json')],
    };

    // security: global posture (same as domain)
    const factorSecurity: ReadinessFactor = {
      key: 'security',
      present: this.gov.functions().some((f) => f.securityDefiner) && this.gov.policies().length > 0,
      weight: WEIGHTS.security,
      evidence: [evidence('artifact-field', `security:${workerName}`, 'securityDefiner + policies global posture', 'graphify-out/db-intel.json')],
    };

    const factors: ReadinessFactor[] = [
      factorOwner,
      factorRunbook,
      factorHealthcheck,
      factorMonitoring,
      factorTests,
      factorSecurity,
    ];

    const score = computeScore(factors);
    const unknowns = unknownKeys(factors);
    const knownCount = factors.length - unknowns.length;
    const band = scoreBand(score, knownCount);
    const allEvidence = factors.flatMap((f) => [...f.evidence]);

    return governance(
      {
        subject: workerName,
        score,
        factors,
        band,
        unknowns,
        summary: `Worker '${workerName}': score=${score}/100, band=${band}, ${unknowns.length} UNKNOWN`,
      },
      { evidence: allEvidence, now: this.now },
    );
  }

  // ── launch readiness ─────────────────────────────────────────────────────────

  async evaluateLaunchReadiness(): Promise<ReadinessReport> {
    // REUSE core.verification.verifyProductionReadiness() — do NOT reimplement
    const verification = await this.core.verification.verifyProductionReadiness();
    const systems = this.gov.readinessSystems();

    // Translate each readiness system into a ReadinessScore
    const scores: ReadinessScore[] = systems.map((sys) => {
      const normalized = Math.min(100, Math.max(0, Math.round(sys.score * 100)));
      const band: ReadinessBand = normalized >= 80 ? 'ready' : normalized >= 50 ? 'conditional' : 'not-ready';

      // Build a minimal factor set from the system score
      const blockerCount = Array.isArray(sys.blockers) ? sys.blockers.length : 0;
      const factors: ReadinessFactor[] = [
        {
          key: 'owner',
          present: 'UNKNOWN',
          weight: WEIGHTS.owner,
          evidence: [notConnected(`owner:${sys.key}`, 'READINESS_SYSTEM_OWNER_NOT_RESOLVED')],
        },
        {
          key: 'tests',
          present: normalized >= 50,
          weight: WEIGHTS.tests,
          evidence: [evidence('artifact-field', `readiness:${sys.key}`, `system score=${sys.score}`, 'graphify-out/production-readiness-v2.json')],
        },
        {
          key: 'monitoring',
          present: 'UNKNOWN',
          weight: WEIGHTS.monitoring,
          evidence: [notConnected(`monitoring:${sys.key}`, 'MONITORING_ARTIFACT_NOT_IN_GRAPHIFY_OUT')],
        },
      ];

      const unknowns = unknownKeys(factors);
      const ev = [
        evidence('artifact-field', `system:${sys.key}`, `score=${sys.score}, blockers=${blockerCount}`, 'graphify-out/production-readiness-v2.json'),
        ...verification.evidence,
      ];

      return governance(
        {
          subject: sys.system,
          score: normalized,
          factors,
          band,
          unknowns,
          summary: `System '${sys.system}': readiness=${normalized}/100, ${blockerCount} blocker(s)`,
        },
        { evidence: ev, now: this.now },
      );
    });

    const overall = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0;
    const allEvidence = [...verification.evidence, ...scores.flatMap((s) => [...s.evidence]).slice(0, 10)];

    return governance(
      {
        scores,
        overall,
        summary: `Launch readiness: ${overall}/100 across ${scores.length} system(s); verification=${verification.status} confidence=${verification.confidence.toFixed(2)}`,
      },
      { evidence: allEvidence, now: this.now },
    );
  }

  // ── operational readiness ────────────────────────────────────────────────────

  async evaluateOperationalReadiness(): Promise<ReadinessReport> {
    const domains = this.gov.domains();
    const runbookSubjects = this.gov.runbookSubjects();

    const scores: ReadinessScore[] = domains.map((d) => {
      const hasRunbook = runbookSubjects.some((s) => s === d.key.toLowerCase() || s.includes(d.key.toLowerCase()));

      const factors: ReadinessFactor[] = [
        {
          key: 'runbook',
          present: hasRunbook,
          weight: WEIGHTS.runbook,
          evidence: [this.eb.domain(d.key, hasRunbook ? 'runbook found' : 'no runbook')],
        },
        {
          key: 'healthcheck',
          present: 'UNKNOWN',
          weight: WEIGHTS.healthcheck,
          evidence: [notConnected(`healthcheck:${d.key}`, 'HEALTHCHECK_PROBE_NOT_CONNECTED')],
        },
        {
          key: 'monitoring',
          present: 'UNKNOWN',
          weight: WEIGHTS.monitoring,
          evidence: [notConnected(`monitoring:${d.key}`, 'MONITORING_ARTIFACT_NOT_IN_GRAPHIFY_OUT')],
        },
        {
          key: 'alerts',
          present: 'UNKNOWN',
          weight: WEIGHTS.alerts,
          evidence: [notConnected(`alerts:${d.key}`, 'ALERT_CONFIG_NOT_IN_GRAPHIFY_OUT')],
        },
      ];

      const score = computeScore(factors);
      const unknowns = unknownKeys(factors);
      const knownCount = factors.length - unknowns.length;
      const band = scoreBand(score, knownCount);
      const allEvidence = factors.flatMap((f) => [...f.evidence]);

      return governance(
        {
          subject: d.key,
          score,
          factors,
          band,
          unknowns,
          summary: `Operational readiness for '${d.key}': score=${score}/100, band=${band}`,
        },
        { evidence: allEvidence, now: this.now },
      );
    });

    const overall = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0;
    const allEvidence = scores.flatMap((s) => [...s.evidence]).slice(0, 15);

    return governance(
      {
        scores,
        overall,
        summary: `Operational readiness: ${overall}/100 across ${scores.length} domain(s); many UNKNOWN (healthcheck/monitoring/alerts NOT CONNECTED)`,
      },
      { evidence: allEvidence, now: this.now },
    );
  }

  // ── recovery readiness ───────────────────────────────────────────────────────

  async evaluateRecoveryReadiness(): Promise<ReadinessReport> {
    const domains = this.gov.domains();
    const runbookSubjects = this.gov.runbookSubjects();

    const scores: ReadinessScore[] = domains.map((d) => {
      const hasRunbook = runbookSubjects.some((s) => s === d.key.toLowerCase() || s.includes(d.key.toLowerCase()));

      const factors: ReadinessFactor[] = [
        // Rollback: UNKNOWN — no artifact encodes rollback presence (honest)
        {
          key: 'rollback',
          present: 'UNKNOWN',
          weight: WEIGHTS.rollback,
          evidence: [notConnected(`rollback:${d.key}`, 'ROLLBACK_ARTIFACT_NOT_IN_GRAPHIFY_OUT')],
        },
        {
          key: 'runbook',
          present: hasRunbook,
          weight: WEIGHTS.runbook,
          evidence: [this.eb.domain(d.key, hasRunbook ? 'runbook found' : 'no runbook')],
        },
      ];

      const score = computeScore(factors);
      const unknowns = unknownKeys(factors);
      const knownCount = factors.length - unknowns.length;
      const band = scoreBand(score, knownCount);
      const allEvidence = factors.flatMap((f) => [...f.evidence]);

      return governance(
        {
          subject: d.key,
          score,
          factors,
          band,
          unknowns,
          summary: `Recovery readiness for '${d.key}': rollback=UNKNOWN (artifact absent), runbook=${hasRunbook}`,
        },
        { evidence: allEvidence, now: this.now },
      );
    });

    const overall = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0;
    const allEvidence = scores.flatMap((s) => [...s.evidence]).slice(0, 15);

    return governance(
      {
        scores,
        overall,
        summary: `Recovery readiness: rollback presence is UNDETERMINABLE (not in artifacts); runbook coverage drives the score`,
      },
      { evidence: allEvidence, now: this.now },
    );
  }

  // ── security readiness ───────────────────────────────────────────────────────

  async evaluateSecurityReadiness(): Promise<ReadinessReport> {
    const domains = this.gov.domains();
    const tables = this.gov.tables();
    const policies = this.gov.policies();
    const functions = this.gov.functions();

    const hasSecDef = functions.some((f) => f.securityDefiner);
    const hasPolicies = policies.length > 0;

    const scores: ReadinessScore[] = domains.map((d) => {
      // Find tenant tables that could belong to this domain (by name overlap with domain tables)
      const domainTableNames = new Set(d.tables.map((t) => t.toLowerCase()));
      const domainTenantTables = tables.filter(
        (t) => t.tenant && domainTableNames.has(t.name.toLowerCase()),
      );
      // If domain has declared tables, check those; else use global tenant RLS status
      const rlsOk = domainTenantTables.length > 0
        ? domainTenantTables.every((t) => t.rls)
        : tables.filter((t) => t.tenant).every((t) => t.rls);

      const present = rlsOk && hasSecDef && hasPolicies;

      const ev = [
        this.eb.domain(
          d.key,
          `domain tenant tables: ${domainTenantTables.length}, RLS ok: ${rlsOk}, securityDefiner: ${hasSecDef}, policies: ${policies.length}`,
        ),
      ];
      if (domainTenantTables.length > 0) {
        ev.push(this.eb.table(domainTenantTables[0]!.name, `rls=${domainTenantTables[0]!.rls}`));
      }

      const factors: ReadinessFactor[] = [
        {
          key: 'security',
          present,
          weight: WEIGHTS.security,
          evidence: ev,
        },
      ];

      const score = computeScore(factors);
      const unknowns = unknownKeys(factors);
      const knownCount = factors.length - unknowns.length;
      const band = scoreBand(score, knownCount < 4 ? 0 : knownCount); // 1 factor → unknown band

      const allEvidence = factors.flatMap((f) => [...f.evidence]);

      return governance(
        {
          subject: d.key,
          score,
          factors,
          band,
          unknowns,
          summary: `Security readiness for '${d.key}': rls=${rlsOk}, secDef=${hasSecDef}, policies=${policies.length}`,
        },
        { evidence: allEvidence, now: this.now },
      );
    });

    const overall = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0;
    const allEvidence = scores.flatMap((s) => [...s.evidence]).slice(0, 15);

    return governance(
      {
        scores,
        overall,
        summary: `Security readiness: ${overall}/100 across ${scores.length} domain(s)`,
      },
      { evidence: allEvidence, now: this.now },
    );
  }

  // ── full readiness report ────────────────────────────────────────────────────

  async generateReadinessReport(): Promise<ReadinessReport> {
    const domains = this.gov.domains();

    const scores = await Promise.all(
      domains.map((d) => this.evaluateDomainReadiness(d.key)),
    );

    const overall = scores.length > 0
      ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length)
      : 0;

    const ready = scores.filter((s) => s.band === 'ready').length;
    const conditional = scores.filter((s) => s.band === 'conditional').length;
    const notReady = scores.filter((s) => s.band === 'not-ready').length;
    const unknown = scores.filter((s) => s.band === 'unknown').length;

    const allEvidence = scores.flatMap((s) => [...s.evidence]).slice(0, 20);

    return governance(
      {
        scores,
        overall,
        summary:
          `Full readiness report: ${scores.length} domains, overall=${overall}/100 ` +
          `(ready=${ready}, conditional=${conditional}, not-ready=${notReady}, unknown=${unknown}). ` +
          `UNKNOWN factors (rollback/healthcheck/monitoring/alerts) are surfaced, not fabricated.`,
      },
      { evidence: allEvidence, now: this.now },
    );
  }
}
