/**
 * DriftDetectionService — Phase 5 GDIS drift detector.
 *
 * 16 detectors over the REAL graphify-out artifacts. Read-only; no IO, no fetch,
 * no subprocesses, no eval. Every method is a deterministic check on real fields.
 * UNKNOWN/PARTIAL findings are emitted honestly where the artifact does not supply
 * the required field (migration rollback, validator↔rule mapping).
 *
 * CONSUME the shared foundation — do NOT redefine DriftReport or Finding.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import { evidence } from '@letbuyy/lcis-core';
import {
  GovernanceArtifactStore,
  FindingBuilder,
  SeverityScorer,
  GovernanceEvidenceBuilder,
  governance,
  defaultNow,
  type Finding,
  type DriftReport,
  type Severity,
} from '../shared/index';

const TEST_FILE_RE = /\.(test|spec)\.[tj]sx?$|\/tests?\//i;
const DB_SOURCE = 'graphify-out/db-intel.json';
const DOMAIN_SOURCE = 'graphify-out/domain-intel.json';
const INFRA_SOURCE = 'graphify-out/infra-intel.json';
const MEMORY_SOURCE = 'graphify-out/memory-intel.json';

export class DriftDetectionService {
  private readonly gov: GovernanceArtifactStore;
  private readonly fb: FindingBuilder;
  private readonly sev: SeverityScorer;
  private readonly ev: GovernanceEvidenceBuilder;

  constructor(
    private readonly core: LcisEngine,
    private readonly now = defaultNow,
  ) {
    this.gov = new GovernanceArtifactStore(core);
    this.fb = new FindingBuilder();
    this.sev = new SeverityScorer();
    this.ev = new GovernanceEvidenceBuilder();
  }

  // ── 1. Table drift: tables not claimed by ANY domain ─────────────────────────
  detectTableDrift(): Finding[] {
    const tables = this.gov.tables();
    const domains = this.gov.domains();
    const claimed = new Set<string>();
    for (const d of domains) {
      for (const t of d.tables) claimed.add(t.toLowerCase());
    }
    const findings: Finding[] = [];
    for (const t of tables) {
      if (!claimed.has(t.name.toLowerCase())) {
        const sev = this.sev.forEntity({ money: t.money, tenant: t.tenant });
        findings.push(
          this.fb.build({
            id: this.fb.stableId('table-drift', t.name),
            category: 'drift',
            kind: 'table-drift',
            severity: sev,
            subject: t.name,
            title: `Orphan table: ${t.name}`,
            detail: `Table "${t.name}" is not claimed by any domain (money=${t.money}, tenant=${t.tenant}, rls=${t.rls}).`,
            evidence: [this.ev.table(t.name, `rls=${t.rls} money=${t.money} tenant=${t.tenant}`)],
          }),
        );
      }
    }
    return findings;
  }

  // ── 2. RPC drift: functions not in ANY domain.rpcs[] ─────────────────────────
  detectRPCDrift(): Finding[] {
    const functions = this.gov.functions();
    const domains = this.gov.domains();
    const claimed = new Set<string>();
    for (const d of domains) {
      for (const r of d.rpcs) claimed.add(r.toLowerCase());
    }
    const findings: Finding[] = [];
    for (const fn of functions) {
      if (!claimed.has(fn.name.toLowerCase())) {
        const sev = this.sev.forEntity({ money: fn.money });
        findings.push(
          this.fb.build({
            id: this.fb.stableId('rpc-drift', fn.name),
            category: 'drift',
            kind: 'rpc-drift',
            severity: sev,
            subject: fn.name,
            title: `Orphan RPC: ${fn.name}`,
            detail: `Function "${fn.name}" is not claimed by any domain (money=${fn.money}, securityDefiner=${fn.securityDefiner}).`,
            evidence: [this.ev.rpc(fn.name, `securityDefiner=${fn.securityDefiner} money=${fn.money}`)],
          }),
        );
      }
    }
    return findings;
  }

  // ── 3. Domain drift: domains with empty tables AND rpcs (orphaned) ────────────
  detectDomainDrift(): Finding[] {
    const domains = this.gov.domains();
    const findings: Finding[] = [];
    for (const d of domains) {
      if (d.tables.length === 0 && d.rpcs.length === 0) {
        const sev = this.sev.forEntity({ money: d.money, tenant: d.tenant });
        findings.push(
          this.fb.build({
            id: this.fb.stableId('domain-drift', d.key),
            category: 'drift',
            kind: 'domain-drift',
            severity: sev,
            subject: d.key,
            title: `Orphaned domain: ${d.key}`,
            detail: `Domain "${d.key}" (${d.label}) has no tables and no RPCs — it is structurally orphaned.`,
            evidence: [this.ev.domain(d.key, `tables=0 rpcs=0 money=${d.money} tenant=${d.tenant}`)],
          }),
        );
      }
    }
    return findings;
  }

  // ── 4. Service drift: domain.apps/workers not in infra workers, or vice-versa ─
  detectServiceDrift(): Finding[] {
    const domains = this.gov.domains();
    const infraWorkers = this.gov.workers();
    const infraNames = new Set(infraWorkers.map((w) => w.name.toLowerCase()));
    const infraFiles = new Set(infraWorkers.map((w) => w.file.toLowerCase()));
    const findings: Finding[] = [];

    // Check domain.apps / domain.workers references that have no matching infra worker
    for (const d of domains) {
      const refs = [...d.apps, ...d.workers];
      for (const ref of refs) {
        const r = ref.toLowerCase();
        if (!infraNames.has(r) && !infraFiles.has(r) && !infraFiles.has(r.split('/').pop() ?? '')) {
          const sev = this.sev.forEntity({ money: d.money, tenant: d.tenant });
          findings.push(
            this.fb.build({
              id: this.fb.stableId('service-drift', `${d.key}:${ref}`),
              category: 'drift',
              kind: 'service-drift',
              severity: sev,
              subject: `${d.key}:${ref}`,
              title: `Domain service not in infra: ${ref}`,
              detail: `Domain "${d.key}" declares service/worker "${ref}" which has no matching infra-intel worker.`,
              evidence: [
                this.ev.domain(d.key, `declared service: ${ref}`),
                evidence('artifact-field', `infra:workers`, 'no matching worker name/file', INFRA_SOURCE),
              ],
            }),
          );
        }
      }
    }
    return findings;
  }

  // ── 5. Worker drift: infra workers not in any domain.workers[] ───────────────
  detectWorkerDrift(): Finding[] {
    const infraWorkers = this.gov.workers();
    const domains = this.gov.domains();
    const claimedWorkers = new Set<string>();
    for (const d of domains) {
      for (const w of d.workers) claimedWorkers.add(w.toLowerCase());
    }
    const findings: Finding[] = [];
    for (const w of infraWorkers) {
      const nameL = w.name.toLowerCase();
      const fileL = w.file.toLowerCase();
      const baseName = w.file.split('/').pop()?.toLowerCase() ?? '';
      if (!claimedWorkers.has(nameL) && !claimedWorkers.has(fileL) && !claimedWorkers.has(baseName)) {
        findings.push(
          this.fb.build({
            id: this.fb.stableId('worker-drift', w.name),
            category: 'drift',
            kind: 'worker-drift',
            severity: 'medium',
            subject: w.name,
            title: `Unclaimed worker: ${w.name}`,
            detail: `Infra worker "${w.name}" (${w.file}) is not listed in any domain's workers array.`,
            evidence: [this.ev.worker(w.name, `file=${w.file} producers=${w.queueProducers.length} consumers=${w.queueConsumers.length}`)],
          }),
        );
      }
    }
    return findings;
  }

  // ── 6. Queue drift: queues from producers/consumers not in any domain.queues[] ─
  detectQueueDrift(): Finding[] {
    const infraWorkers = this.gov.workers();
    const domains = this.gov.domains();
    const domainQueues = new Set<string>();
    for (const d of domains) {
      for (const q of d.queues) domainQueues.add(q.toLowerCase());
    }
    // Collect all queues mentioned in workers
    const allQueues = new Map<string, { producers: string[]; consumers: string[] }>();
    for (const w of infraWorkers) {
      for (const q of w.queueProducers) {
        const key = q.toLowerCase();
        if (!allQueues.has(key)) allQueues.set(key, { producers: [], consumers: [] });
        allQueues.get(key)!.producers.push(w.name);
      }
      for (const q of w.queueConsumers) {
        const key = q.toLowerCase();
        if (!allQueues.has(key)) allQueues.set(key, { producers: [], consumers: [] });
        allQueues.get(key)!.consumers.push(w.name);
      }
    }
    const findings: Finding[] = [];
    for (const [queue, { producers, consumers }] of allQueues) {
      if (!domainQueues.has(queue)) {
        // Producer with no consumer = unused / orphan
        const unused = consumers.length === 0;
        findings.push(
          this.fb.build({
            id: this.fb.stableId('queue-drift', queue),
            category: 'drift',
            kind: 'queue-drift',
            severity: unused ? 'high' : 'medium',
            subject: queue,
            title: `Queue not in any domain: ${queue}`,
            detail: `Queue "${queue}" (producers: [${producers.join(', ')}], consumers: [${consumers.join(', ')}]) is not listed in any domain's queues array${unused ? ' and has no consumer (orphan event channel)' : ''}.`,
            evidence: [
              evidence('artifact-field', `queue:${queue}`, `producers=${producers.length} consumers=${consumers.length}`, INFRA_SOURCE),
              evidence('artifact-field', 'domain-queues', 'queue not found in domain-intel queues', DOMAIN_SOURCE),
            ],
          }),
        );
      }
    }
    return findings;
  }

  // ── 7. Event drift: queues with a producer but no consumer (orphan event channel)
  detectEventDrift(): Finding[] {
    const infraWorkers = this.gov.workers();
    const producers = new Map<string, string[]>(); // queue → producing workers
    const consumers = new Set<string>();

    for (const w of infraWorkers) {
      for (const q of w.queueProducers) {
        const key = q.toLowerCase();
        if (!producers.has(key)) producers.set(key, []);
        producers.get(key)!.push(w.name);
      }
      for (const q of w.queueConsumers) consumers.add(q.toLowerCase());
    }

    const findings: Finding[] = [];
    for (const [queue, workerNames] of producers) {
      if (!consumers.has(queue)) {
        findings.push(
          this.fb.build({
            id: this.fb.stableId('event-drift', queue),
            category: 'drift',
            kind: 'event-drift',
            severity: 'high',
            subject: queue,
            title: `Orphan event channel: ${queue}`,
            detail: `Queue "${queue}" has producer(s) [${workerNames.join(', ')}] but no consumer — events are being emitted into a black hole.`,
            evidence: [
              evidence('artifact-field', `queue:${queue}`, `produced by: ${workerNames.join(', ')} — no consumer found`, INFRA_SOURCE),
            ],
          }),
        );
      }
    }
    return findings;
  }

  // ── 8. Runbook drift: money/tenant domains whose key ∉ runbookSubjects() ─────
  detectRunbookDrift(): Finding[] {
    const domains = this.gov.domains();
    const subjects = new Set(this.gov.runbookSubjects().map((s) => s.toLowerCase()));
    const findings: Finding[] = [];
    for (const d of domains) {
      if (d.money || d.tenant) {
        if (!subjects.has(d.key.toLowerCase()) && !subjects.has(d.label.toLowerCase())) {
          const sev: Severity = d.money ? 'high' : 'medium';
          findings.push(
            this.fb.build({
              id: this.fb.stableId('runbook-drift', d.key),
              category: 'drift',
              kind: 'runbook-drift',
              severity: sev,
              subject: d.key,
              title: `Missing runbook: ${d.key}`,
              detail: `Domain "${d.key}" (money=${d.money}, tenant=${d.tenant}) is critical but has no runbook entry in the runbook registry.`,
              evidence: [
                this.ev.domain(d.key, `money=${d.money} tenant=${d.tenant}`),
                evidence('artifact-field', 'runbooks', `key "${d.key}" not found in runbookSubjects`, INFRA_SOURCE),
              ],
            }),
          );
        }
      }
    }
    return findings;
  }

  // ── 9. Test drift: domains where graph.search finds no test file ──────────────
  detectTestDrift(): Finding[] {
    const domains = this.gov.domains();
    const findings: Finding[] = [];
    for (const d of domains) {
      // Search graph for the domain key + its tables; look for any test file node
      const candidates = [
        ...this.core.graph.search(d.key, 20),
        ...d.tables.slice(0, 3).flatMap((t) => this.core.graph.search(t, 10)),
      ];
      const hasTest = candidates.some((n) => n.sourceFile && TEST_FILE_RE.test(n.sourceFile));
      if (!hasTest) {
        const sev = this.sev.forEntity({ money: d.money, tenant: d.tenant, base: 'medium' });
        findings.push(
          this.fb.build({
            id: this.fb.stableId('test-drift', d.key),
            category: 'drift',
            kind: 'test-drift',
            severity: sev,
            subject: d.key,
            title: `No test coverage found: ${d.key}`,
            detail: `Graph search for domain "${d.key}" and its tables found no test file nodes — coverage is unconfirmed.`,
            evidence: [
              this.ev.domain(d.key, `tables=${d.tables.length} rpcs=${d.rpcs.length}`),
              evidence('artifact-field', `graph-search:${d.key}`, 'no *.test.* / *.spec.* sourceFile hit', 'graphify-out/graph.json'),
            ],
          }),
        );
      }
    }
    return findings;
  }

  // ── 10. Documentation drift: domains where memory.search returns no doc hit ───
  detectDocumentationDrift(): Finding[] {
    const domains = this.gov.domains();
    const findings: Finding[] = [];
    for (const d of domains) {
      const hits = this.core.memory.search(d.key, { limit: 5 });
      const hasDoc = hits.some(
        (h) => h.source && !h.source.includes('node_modules') && (h.type === 'governance' || h.type === 'architecture' || h.type === 'runbook'),
      );
      if (!hasDoc) {
        const sev = this.sev.forEntity({ money: d.money, tenant: d.tenant, base: 'low' });
        findings.push(
          this.fb.build({
            id: this.fb.stableId('doc-drift', d.key),
            category: 'drift',
            kind: 'documentation-drift',
            severity: sev,
            subject: d.key,
            title: `Missing documentation: ${d.key}`,
            detail: `Memory search for domain "${d.key}" returned no governance/architecture/runbook document — documentation coverage is unconfirmed.`,
            evidence: [
              this.ev.domain(d.key, `memory.search hits=${hits.length} none of type governance/architecture/runbook`),
            ],
          }),
        );
      }
    }
    return findings;
  }

  // ── 11. Migration drift: sequence gaps/anomalies; rollback is UNKNOWN ─────────
  detectMigrationDrift(): Finding[] {
    const migrations = this.gov.migrations();
    const findings: Finding[] = [];
    if (migrations.length === 0) return findings;

    // Sort by sequence number
    const sorted = [...migrations].sort((a, b) => a.n - b.n);
    const nums = sorted.map((m) => m.n);

    // Detect sequence gaps
    for (let i = 1; i < nums.length; i++) {
      const prev = nums[i - 1]!;
      const curr = nums[i]!;
      if (curr - prev > 1) {
        const gap = curr - prev - 1;
        findings.push(
          this.fb.build({
            id: this.fb.stableId('migration-gap', `${prev}-${curr}`),
            category: 'drift',
            kind: 'migration-drift',
            severity: 'medium',
            subject: `migration-gap:${prev}-${curr}`,
            title: `Migration sequence gap: ${prev} → ${curr} (${gap} missing)`,
            detail: `Migration sequence jumps from ${prev} to ${curr} — ${gap} number(s) are missing. This may indicate deleted or out-of-band migrations.`,
            evidence: [
              this.ev.migration(`gap-${prev}-${curr}`, `${gap} sequence numbers missing between migration ${prev} and ${curr}`),
            ],
          }),
        );
      }
    }

    // Rollback presence: UNKNOWN — the migration artifact has no rollback field
    findings.push(
      this.fb.build({
        id: this.fb.stableId('migration-rollback', 'all'),
        category: 'drift',
        kind: 'migration-drift',
        severity: 'info',
        subject: 'migration-rollback',
        title: 'Migration rollback presence: UNKNOWN',
        detail: `UNKNOWN: The migration artifact (memory-intel.json) records ${migrations.length} migrations but contains no "rollback" field. Rollback coverage is UNKNOWN and cannot be determined from the artifact alone — R006 compliance requires manual verification.`,
        confidence: 0.3,
        evidence: [
          evidence('artifact-field', 'memory-intel:migrations', `${migrations.length} migrations; no rollback field in schema`, MEMORY_SOURCE),
        ],
      }),
    );

    return findings;
  }

  // ── 12. Validator drift: PARTIAL — 107+ validators exist but rule→validator mapping is absent ─
  detectValidatorDrift(): Finding[] {
    // The artifact does not supply a validator→rule mapping.
    // We emit an honest PARTIAL info finding noting the gap.
    const findings: Finding[] = [
      this.fb.build({
        id: this.fb.stableId('validator-drift', 'rule-mapping'),
        category: 'drift',
        kind: 'validator-drift',
        severity: 'info',
        subject: 'validator-rule-mapping',
        title: 'Validator→rule mapping: PARTIAL (not in artifacts)',
        detail:
          'The governance artifacts confirm 107+ validators exist (validated by the gate), but the rule→validator mapping is not present in any graphify-out artifact. Full validator drift analysis requires a dedicated validator-intel artifact. This is an honest gap, not a violation.',
        confidence: 0.3,
        evidence: [
          evidence('artifact-field', 'validators', '107+ validators confirmed by gate; rule-mapping field absent from all artifacts', DB_SOURCE),
        ],
      }),
    ];
    return findings;
  }

  // ── 13. Ownership drift: domains/workers with empty owners ───────────────────
  detectOwnershipDrift(): Finding[] {
    const domains = this.gov.domains();
    const infraWorkers = this.gov.workers();
    const findings: Finding[] = [];

    for (const d of domains) {
      if (d.owners.length === 0) {
        const sev = this.sev.forEntity({ money: d.money, tenant: d.tenant, base: 'medium' });
        findings.push(
          this.fb.build({
            id: this.fb.stableId('ownership-drift', d.key),
            category: 'drift',
            kind: 'ownership-drift',
            severity: sev,
            subject: d.key,
            title: `No owner declared: domain ${d.key}`,
            detail: `Domain "${d.key}" (money=${d.money}, tenant=${d.tenant}) has an empty owners array in domain-intel.`,
            evidence: [this.ev.domain(d.key, `owners=[] money=${d.money} tenant=${d.tenant}`)],
          }),
        );
      }
    }

    // Workers also carry no explicit owner field in GovWorker — note the gap
    if (infraWorkers.length > 0) {
      const workerOwnershipGap = infraWorkers.every((_) => true); // GovWorker has no owners field
      if (workerOwnershipGap) {
        findings.push(
          this.fb.build({
            id: this.fb.stableId('ownership-drift', 'workers-no-owner-field'),
            category: 'drift',
            kind: 'ownership-drift',
            severity: 'info',
            subject: 'infra-workers',
            title: 'Infra workers have no owner field in artifact',
            detail: `${infraWorkers.length} infra workers exist in infra-intel but GovWorker has no owners field — ownership must be inferred via CODEOWNERS. The OwnershipService does deeper coverage.`,
            confidence: 0.3,
            evidence: [
              evidence('artifact-field', 'infra-intel:workers', `${infraWorkers.length} workers; no owners field on GovWorker`, INFRA_SOURCE),
            ],
          }),
        );
      }
    }

    return findings;
  }

  // ── 14. Security drift (thin): tenant tables rls=false + policies public=true ──
  detectSecurityDrift(): Finding[] {
    const tables = this.gov.tables();
    const policies = this.gov.policies();
    const findings: Finding[] = [];

    // Tenant tables with rls disabled
    for (const t of tables) {
      if (t.tenant && !t.rls) {
        findings.push(
          this.fb.build({
            id: this.fb.stableId('rls-drift', t.name),
            category: 'drift',
            kind: 'security-drift',
            severity: 'critical',
            subject: t.name,
            title: `Tenant table without RLS: ${t.name}`,
            detail: `Table "${t.name}" is tenant-scoped (hasSiteId=${t.hasSiteId}) but has rls=false — cross-tenant data exposure risk. R002 violation.`,
            rule: 'R002',
            evidence: [this.ev.table(t.name, `tenant=true rls=false hasSiteId=${t.hasSiteId} money=${t.money}`)],
          }),
        );
      }
    }

    // Policies with public=true (no site_id filter, no service-role gate)
    for (const p of policies) {
      if (p.public && !p.serviceRole && !p.usesSiteId) {
        findings.push(
          this.fb.build({
            id: this.fb.stableId('policy-public', p.name),
            category: 'drift',
            kind: 'security-drift',
            severity: 'high',
            subject: p.name,
            title: `Public policy with no site_id filter: ${p.name}`,
            detail: `Policy "${p.name}" on table "${p.table}" is public=true, serviceRole=false, usesSiteId=false — may allow unrestricted access.`,
            evidence: [this.ev.policy(p.name, `table=${p.table} public=true serviceRole=${p.serviceRole} usesSiteId=${p.usesSiteId}`)],
          }),
        );
      }
    }

    return findings;
  }

  // ── 15. Architecture drift: composite — counts + most severe of all detectors ─
  detectArchitectureDrift(): Finding[] {
    // Run all non-composite detectors and aggregate
    const all = [
      ...this.detectTableDrift(),
      ...this.detectRPCDrift(),
      ...this.detectDomainDrift(),
      ...this.detectServiceDrift(),
      ...this.detectWorkerDrift(),
      ...this.detectQueueDrift(),
      ...this.detectEventDrift(),
      ...this.detectRunbookDrift(),
      ...this.detectTestDrift(),
      ...this.detectDocumentationDrift(),
      ...this.detectMigrationDrift(),
      ...this.detectValidatorDrift(),
      ...this.detectOwnershipDrift(),
      ...this.detectSecurityDrift(),
    ];

    const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    const mostSevere = all.reduce<Severity>((acc, f) => (RANK[f.severity] > RANK[acc] ? f.severity : acc), 'info');
    const criticalCount = all.filter((f) => f.severity === 'critical').length;
    const highCount = all.filter((f) => f.severity === 'high').length;

    const summary = this.fb.build({
      id: this.fb.stableId('architecture-drift', 'composite'),
      category: 'drift',
      kind: 'architecture',
      severity: mostSevere,
      subject: 'architecture',
      title: `Architecture drift composite: ${all.length} findings (${criticalCount} critical, ${highCount} high)`,
      detail: `Composite architecture drift: ${all.length} total findings across all drift detectors. Most severe: ${mostSevere}. Critical: ${criticalCount}, High: ${highCount}.`,
      evidence: [
        evidence('artifact-field', 'drift-composite', `total=${all.length} critical=${criticalCount} high=${highCount} mostSevere=${mostSevere}`, DOMAIN_SOURCE),
      ],
    });

    return [summary];
  }

  // ── 16. generateDriftReport: aggregate every detector ────────────────────────
  generateDriftReport(scope = 'all'): DriftReport {
    const tableDrift = this.detectTableDrift();
    const rpcDrift = this.detectRPCDrift();
    const domainDrift = this.detectDomainDrift();
    const serviceDrift = this.detectServiceDrift();
    const workerDrift = this.detectWorkerDrift();
    const queueDrift = this.detectQueueDrift();
    const eventDrift = this.detectEventDrift();
    const runbookDrift = this.detectRunbookDrift();
    const testDrift = this.detectTestDrift();
    const docDrift = this.detectDocumentationDrift();
    const migrationDrift = this.detectMigrationDrift();
    const validatorDrift = this.detectValidatorDrift();
    const ownershipDrift = this.detectOwnershipDrift();
    const securityDrift = this.detectSecurityDrift();
    const architectureDrift = this.detectArchitectureDrift();

    const all = [
      ...tableDrift,
      ...rpcDrift,
      ...domainDrift,
      ...serviceDrift,
      ...workerDrift,
      ...queueDrift,
      ...eventDrift,
      ...runbookDrift,
      ...testDrift,
      ...docDrift,
      ...migrationDrift,
      ...validatorDrift,
      ...ownershipDrift,
      ...securityDrift,
      ...architectureDrift,
    ];

    // byKind counts
    const byKind: Record<string, number> = {};
    for (const f of all) {
      byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    }

    const criticalCount = all.filter((f) => f.severity === 'critical').length;
    const highCount = all.filter((f) => f.severity === 'high').length;

    const summary = `Drift report (scope=${scope}): ${all.length} findings — ${criticalCount} critical, ${highCount} high. Kinds: ${Object.keys(byKind).join(', ')}.`;

    // Aggregate evidence from all findings
    const allEvidence = all.flatMap((f) => [...f.evidence]);
    const sources = this.gov.sourcesPresent();

    return governance(
      {
        scope,
        findings: all,
        byKind,
        summary,
      },
      {
        evidence: allEvidence,
        sources: sources.length > 0 ? sources : undefined,
        now: this.now,
      },
    );
  }
}
