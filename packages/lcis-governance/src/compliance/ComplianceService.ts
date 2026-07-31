/**
 * ComplianceService — Phase 4 of GDIS.
 *
 * Evaluates rules R001..R008 against the REAL governance artifacts.  Every
 * evaluation is deterministic (same artifacts + same now → same output),
 * read-only (no fetch / IO / mutations), and honest (PARTIAL/UNKNOWN where a
 * structural check cannot determine the answer).
 */
import { type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import {
  GovernanceArtifactStore,
  GovernanceRuleRegistry,
  RULES,
  FindingBuilder,
  SeverityScorer,
  GovernanceEvidenceBuilder,
  governance,
  defaultNow,
  ConfidenceCalculator,
  type ComplianceReport,
  type ComplianceStatus,
  type RuleEvaluation,
  type Finding,
} from '../shared/index';

const DOMAIN_SRC = 'graphify-out/domain-intel.json';
const DB_SRC = 'graphify-out/db-intel.json';
const INFRA_SRC = 'graphify-out/infra-intel.json';
const MEMORY_SRC = 'graphify-out/memory-intel.json';

export class ComplianceService {
  private readonly gov: GovernanceArtifactStore;
  private readonly reg: GovernanceRuleRegistry;
  private readonly fb: FindingBuilder;
  private readonly scorer: SeverityScorer;
  private readonly eb: GovernanceEvidenceBuilder;
  private readonly conf: ConfidenceCalculator;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.gov = new GovernanceArtifactStore(core);
    this.reg = new GovernanceRuleRegistry();
    this.fb = new FindingBuilder();
    this.scorer = new SeverityScorer();
    this.eb = new GovernanceEvidenceBuilder();
    this.conf = new ConfidenceCalculator();
  }

  // ── R001 ─ Money functions must be SECURITY DEFINER + idempotency + FOR UPDATE ──

  evaluateArchitectureCompliance(): RuleEvaluation {
    const rule = this.reg.get('R001')!;
    const fns = this.gov.functions().filter((f) => f.money);

    const violations: Finding[] = [];
    for (const fn of fns) {
      const missing: string[] = [];
      if (!fn.securityDefiner) missing.push('SECURITY DEFINER');
      if (!fn.hasIdempotency) missing.push('idempotency');
      if (!fn.forUpdate) missing.push('FOR UPDATE');
      if (missing.length === 0) continue;

      const ev = [
        this.eb.rpc(fn.name, `money=true, securityDefiner=${fn.securityDefiner}, hasIdempotency=${fn.hasIdempotency}, forUpdate=${fn.forUpdate}`),
      ];
      violations.push(
        this.fb.build({
          id: this.fb.stableId('R001', fn.name),
          category: 'compliance',
          kind: 'R001',
          severity: 'critical',
          subject: fn.name,
          title: `Money function missing: ${missing.join(', ')}`,
          detail: `${fn.name} is a money function but lacks: ${missing.join(', ')}. All three (SECURITY DEFINER, idempotency key, FOR UPDATE lock) are required by the canonical-ledger-only model.`,
          rule: 'R001',
          evidence: ev,
        }),
      );
    }

    const ev = [evidence('artifact-field', 'db-intel:functions', `${fns.length} money functions evaluated`, DB_SRC)];
    const status: ComplianceStatus = violations.length === 0 ? 'COMPLIANT' : 'VIOLATED';
    return {
      rule,
      status,
      violations,
      checked: fns.length,
      passed: fns.length - violations.length,
      evidence: ev,
    };
  }

  // ── R002 ─ Tenant tables must have RLS ───────────────────────────────────────

  evaluateSecurityCompliance(): RuleEvaluation {
    const rule = this.reg.get('R002')!;
    const tenantTables = this.gov.tables().filter((t) => t.tenant);

    const violations: Finding[] = [];
    for (const t of tenantTables) {
      if (t.rls) continue;
      const ev = [this.eb.table(t.name, `tenant=true, rls=false`)];
      violations.push(
        this.fb.build({
          id: this.fb.stableId('R002', t.name),
          category: 'compliance',
          kind: 'R002',
          severity: this.scorer.forEntity({ tenant: true }),
          subject: t.name,
          title: `Tenant table missing RLS: ${t.name}`,
          detail: `Table ${t.name} is tenant-scoped (tenant=true) but row-level security is disabled (rls=false). Cross-tenant data leakage is possible.`,
          rule: 'R002',
          evidence: ev,
        }),
      );
    }

    const ev = [evidence('artifact-field', 'db-intel:tables', `${tenantTables.length} tenant tables evaluated`, DB_SRC)];
    const status: ComplianceStatus = violations.length === 0 ? 'COMPLIANT' : 'VIOLATED';
    return {
      rule,
      status,
      violations,
      checked: tenantTables.length,
      passed: tenantTables.length - violations.length,
      evidence: ev,
    };
  }

  // ── R004 ─ Public APIs must have tests ───────────────────────────────────────

  evaluateTestingCompliance(): RuleEvaluation {
    const rule = this.reg.get('R004')!;
    const domains = this.gov.domains();

    const violations: Finding[] = [];
    let checked = 0;
    for (const d of domains) {
      // Only evaluate domains that have routes (public API surface)
      if (d.routes.length === 0) continue;
      checked++;
      // Use graph search to detect test coverage: look for nodes referencing this domain key
      const hits = this.core.graph.search(d.key, 20);
      const hasTestHit = hits.some((n) => {
        const id = (n.id ?? '').toLowerCase();
        const label = (n.label ?? '').toLowerCase();
        return (
          id.includes('test') ||
          id.includes('spec') ||
          id.includes('.test.') ||
          id.includes('.spec.') ||
          label.includes('test') ||
          label.includes('spec')
        );
      });

      if (hasTestHit) continue;

      const ev = [
        this.eb.domain(d.key, `routes=${d.routes.length}, graph search for '${d.key}' found no test nodes`),
      ];
      violations.push(
        this.fb.build({
          id: this.fb.stableId('R004', d.key),
          category: 'compliance',
          kind: 'R004',
          severity: 'high',
          subject: d.key,
          title: `No test coverage detected for domain: ${d.key}`,
          detail: `Domain ${d.key} exposes ${d.routes.length} route(s) but no test file nodes were found via graph search. At least one test covering public routes is required.`,
          rule: 'R004',
          evidence: ev,
        }),
      );
    }

    const ev = [evidence('artifact-field', 'domain-intel:domains', `${checked} domains with routes evaluated`, DOMAIN_SRC)];
    const status: ComplianceStatus = violations.length === 0 ? 'COMPLIANT' : violations.length < checked ? 'VIOLATED' : 'VIOLATED';
    return {
      rule,
      status: checked === 0 ? 'UNKNOWN' : status,
      violations,
      checked,
      passed: checked - violations.length,
      evidence: ev,
    };
  }

  // ── R005 ─ Critical services must have owners ─────────────────────────────────

  evaluateOwnershipCompliance(): RuleEvaluation {
    const rule = this.reg.get('R005')!;
    const criticalDomains = this.gov.domains().filter((d) => d.money || d.tenant);

    const violations: Finding[] = [];
    for (const d of criticalDomains) {
      if (d.owners.length > 0) continue;
      const ev = [
        this.eb.domain(d.key, `money=${d.money}, tenant=${d.tenant}, owners=[]`),
      ];
      violations.push(
        this.fb.build({
          id: this.fb.stableId('R005', d.key),
          category: 'compliance',
          kind: 'R005',
          severity: this.scorer.forEntity({ money: d.money, tenant: d.tenant }),
          subject: d.key,
          title: `Critical domain has no owner: ${d.key}`,
          detail: `Domain ${d.key} is ${d.money ? 'money-critical' : 'tenant-critical'} but declares no owners. An owner is required for on-call escalation, incident response, and governance accountability.`,
          rule: 'R005',
          evidence: ev,
        }),
      );
    }

    const ev = [evidence('artifact-field', 'domain-intel:domains', `${criticalDomains.length} critical domains evaluated`, DOMAIN_SRC)];
    const status: ComplianceStatus = violations.length === 0 ? 'COMPLIANT' : 'VIOLATED';
    return {
      rule,
      status,
      violations,
      checked: criticalDomains.length,
      passed: criticalDomains.length - violations.length,
      evidence: ev,
    };
  }

  // ── R007 ─ Domains must have documentation ───────────────────────────────────

  evaluateGovernanceCompliance(): RuleEvaluation {
    const rule = this.reg.get('R007')!;
    const domains = this.gov.domains();

    const violations: Finding[] = [];
    for (const d of domains) {
      // Use memory search to find documentation hits for this domain key
      const hits = this.core.memory.search(d.key, { limit: 5 });
      const hasDocs = hits.some((h) => h.score > 0 && (h.type === 'governance' || h.type === 'architecture'));
      if (hasDocs) continue;

      const ev = [
        this.eb.domain(d.key, `memory search for '${d.key}' returned no governance/architecture doc hits`),
      ];
      violations.push(
        this.fb.build({
          id: this.fb.stableId('R007', d.key),
          category: 'compliance',
          kind: 'R007',
          severity: 'medium',
          subject: d.key,
          title: `Domain undocumented: ${d.key}`,
          detail: `Domain ${d.key} has no governance or architecture documentation found in the memory corpus. Documentation is required for maintainability, onboarding, and operational intelligence.`,
          rule: 'R007',
          evidence: ev,
        }),
      );
    }

    const ev = [evidence('artifact-field', 'domain-intel:domains', `${domains.length} domains evaluated for documentation`, DOMAIN_SRC)];
    const status: ComplianceStatus = violations.length === 0 ? 'COMPLIANT' : 'VIOLATED';
    return {
      rule,
      status: domains.length === 0 ? 'UNKNOWN' : status,
      violations,
      checked: domains.length,
      passed: domains.length - violations.length,
      evidence: ev,
    };
  }

  // ── R003, R006, R008 ─ Operational evaluations ───────────────────────────────

  evaluateOperationalCompliance(): readonly RuleEvaluation[] {
    return [this._evalR003(), this._evalR006(), this._evalR008()];
  }

  private _evalR003(): RuleEvaluation {
    const rule = this.reg.get('R003')!;
    const criticalDomains = this.gov.domains().filter((d) => d.money || d.tenant);
    const runbookSubjects = this.gov.runbookSubjects();

    const violations: Finding[] = [];
    for (const d of criticalDomains) {
      const key = d.key.toLowerCase();
      const label = d.label?.toLowerCase() ?? '';
      const covered = runbookSubjects.some(
        (s) => s === key || s === label || key.includes(s) || s.includes(key),
      );
      if (covered) continue;

      const ev = [
        this.eb.domain(d.key, `money=${d.money}, tenant=${d.tenant}, not found in runbookSubjects=[${runbookSubjects.slice(0, 5).join(',')}...]`),
      ];
      violations.push(
        this.fb.build({
          id: this.fb.stableId('R003', d.key),
          category: 'compliance',
          kind: 'R003',
          severity: 'high',
          subject: d.key,
          title: `Critical domain has no runbook: ${d.key}`,
          detail: `Domain ${d.key} is ${d.money ? 'money-critical' : 'tenant-critical'} but does not appear in runbookSubjects. An operational runbook is required for incident response.`,
          rule: 'R003',
          evidence: ev,
        }),
      );
    }

    const ev = [
      evidence('artifact-field', 'domain-intel:domains', `${criticalDomains.length} critical domains checked against runbooks`, DOMAIN_SRC),
      evidence('artifact-field', 'runbooks:subjects', `${runbookSubjects.length} runbook subjects found`, INFRA_SRC),
    ];
    const status: ComplianceStatus = violations.length === 0 ? 'COMPLIANT' : 'VIOLATED';
    return {
      rule,
      status: criticalDomains.length === 0 ? 'UNKNOWN' : status,
      violations,
      checked: criticalDomains.length,
      passed: criticalDomains.length - violations.length,
      evidence: ev,
    };
  }

  private _evalR006(): RuleEvaluation {
    const rule = this.reg.get('R006')!;
    // PARTIAL — rollback presence is NOT determinable from artifacts alone.
    // The migration artifacts record type/name/decision but do not carry a rollback
    // script reference or a reversible/irreversible flag in the graphify schema.
    const migrations = this.gov.migrations();
    const ev = [
      evidence('artifact-field', 'memory-intel:migrations', `${migrations.length} migrations found; rollback presence NOT determinable from artifact fields`, MEMORY_SRC),
      notConnected('migration.rollback', 'graphify-out/memory-intel.json#migrations[].rollback'),
    ];
    return {
      rule,
      status: 'PARTIAL',
      violations: [],
      checked: migrations.length,
      passed: 0,
      evidence: ev,
    };
  }

  private _evalR008(): RuleEvaluation {
    const rule = this.reg.get('R008')!;
    // PARTIAL — healthcheck binding is declared in worker/cron topology but whether a
    // live probe succeeds is NOT CONNECTED (requires runtime telemetry, not artifacts).
    const workers = this.gov.workers();
    const ev = [
      evidence('artifact-field', 'infra-intel:workers', `${workers.length} workers found; healthcheck topology declared but live probe NOT CONNECTED`, INFRA_SRC),
      notConnected('worker.healthcheck.liveProbe', 'OTEL_EXPORTER_OTLP_ENDPOINT or CLOUDFLARE_ANALYTICS_DATASET'),
    ];
    return {
      rule,
      status: 'PARTIAL',
      violations: [],
      checked: workers.length,
      passed: 0,
      evidence: ev,
    };
  }

  // ── Full report ───────────────────────────────────────────────────────────────

  generateComplianceReport(): ComplianceReport {
    const arch = this.evaluateArchitectureCompliance();
    const sec = this.evaluateSecurityCompliance();
    const testing = this.evaluateTestingCompliance();
    const ownership = this.evaluateOwnershipCompliance();
    const gov = this.evaluateGovernanceCompliance();
    const [r003, r006, r008] = this.evaluateOperationalCompliance();

    const evaluations: readonly RuleEvaluation[] = [arch, sec, r003!, testing, ownership, r006!, gov, r008!];

    // Score: (COMPLIANT count / (COMPLIANT + VIOLATED + PARTIAL)) × 100
    // UNKNOWN excluded from denominator.
    const compliantCount = evaluations.filter((e) => e.status === 'COMPLIANT').length;
    const violatedCount = evaluations.filter((e) => e.status === 'VIOLATED').length;
    const partialCount = evaluations.filter((e) => e.status === 'PARTIAL').length;
    const denominator = compliantCount + violatedCount + partialCount;
    const score = denominator === 0 ? 0 : Math.round((compliantCount / denominator) * 100);

    const violations: readonly Finding[] = evaluations.flatMap((e) => [...e.violations]);

    const sourcesPresent = this.gov.sourcesPresent();
    const allEvidence = evaluations.flatMap((e) => [...e.evidence]);
    const uniqueSources = [...new Set([...sourcesPresent, ...allEvidence.map((e) => e.source ?? '').filter(Boolean)])];

    const summary =
      `Compliance score: ${score}/100. ` +
      `${compliantCount} COMPLIANT, ${violatedCount} VIOLATED, ${partialCount} PARTIAL. ` +
      `${violations.length} total violation(s). ` +
      (violations.length > 0
        ? `Top violation: ${violations[0]!.title}`
        : 'No violations detected in evaluated rules.');

    return governance(
      {
        evaluations,
        score,
        violations,
        summary,
      },
      {
        evidence: allEvidence,
        sources: uniqueSources,
        confidence: this.conf.structural(),
        now: this.now,
      },
    );
  }
}
