/**
 * IncidentOperationsService — LCOS Phase 6 Incident Intelligence.
 *
 * Answers "What is broken?" by observing the structural incident model, runbook coverage,
 * blast radius, and recovery status. READ-ONLY: observes/analyzes/reports. Never deploys,
 * executes, mutates, writes, fixes, or remediates. No network/DB/file IO of its own.
 *
 * Honesty contract (enforced):
 *  - Live incident VALUES (open incidents, outage status) → NOT_CONNECTED, value=null, confidence=0
 *  - Structural topology/runbook/blast facts → CONNECTED, real evidence, confidence > 0
 */
import { type LcisEngine } from '@letbuyy/lcis-core';
import {
  LiveSignalRegistry,
  OperationalEvidenceBuilder,
  OperationalFindingBuilder,
  OperationalHealthCalculator,
  OperationsArtifactStore,
  SignalCorrelator,
  TelemetryNormalizer,
  defaultNow,
  operations,
  type IncidentReport,
  type LiveSignal,
  type OperationalFact,
  type OperationalFinding,
} from '../shared/index';

// ── Constants ────────────────────────────────────────────────────────────────

/** The 8 money/ledger domains that follow recovery Protocol A. */
const MONEY_DOMAINS = new Set([
  'payments', 'refunds', 'payouts', 'gift-cards',
  'shipping', 'inventory', 'orders', 'operations',
]);

/** Domains considered critical for blast radius analysis. */
const CRITICAL_DOMAINS = ['payments', 'orders', 'authentication', 'identity'];

// ── Types ────────────────────────────────────────────────────────────────────

interface RunbookEntry {
  domain: string;
  label?: string;
  detection?: { signals?: string[]; source?: string };
  recovery?: string[];
  owner?: string[];
}

interface RunbooksArtifact {
  summary?: { domains?: number; generatedAt?: string };
  runbooks?: Record<string, RunbookEntry>;
}

interface IncidentIntelArtifact {
  domain?: string;
  label?: string;
  blastRadius?: {
    domains?: number;
    affected?: string[];
    routes?: number;
    rpcs?: number;
    tables?: number;
  };
  answers?: {
    whichTables?: string[];
    whichRpcs?: string[];
    whatFailed?: string;
    whichMerchants?: string;
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

export class IncidentOperationsService {
  private readonly store: OperationsArtifactStore;
  private readonly correlator: SignalCorrelator;
  private readonly eb = new OperationalEvidenceBuilder();
  private readonly fb = new OperationalFindingBuilder();
  private readonly tn = new TelemetryNormalizer();
  private readonly hc = new OperationalHealthCalculator();
  private readonly reg = new LiveSignalRegistry();

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.store = new OperationsArtifactStore(core);
    this.correlator = new SignalCorrelator(core);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private runbooksArtifact(): RunbooksArtifact | null {
    const raw = this.store.runbooks();
    return raw as RunbooksArtifact | null;
  }

  private incidentIntel(): IncidentIntelArtifact | null {
    const raw = this.store.incidents();
    return raw as IncidentIntelArtifact | null;
  }

  private runbookEntries(): [string, RunbookEntry][] {
    const rb = this.runbooksArtifact();
    if (!rb?.runbooks) return [];
    return Object.entries(rb.runbooks);
  }

  private isMoneyDomain(key: string): boolean {
    return MONEY_DOMAINS.has(key);
  }

  // ── detectIncidents ──────────────────────────────────────────────────────

  /**
   * Detects incidents. Live open-incident VALUES are NOT_CONNECTED (no live incident store).
   * Structural incident model for payments is CONNECTED (from incident-intelligence-v5.json).
   */
  detectIncidents(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // 1. Live open incidents — NOT_CONNECTED (no incident table in repo)
    findings.push(
      this.fb.build({
        id: 'INCIDENT-LIVE-OPEN-INCIDENTS',
        area: 'incident',
        kind: 'open-incidents',
        severity: 'info',
        subject: 'live-incident-store',
        title: 'Open incidents: NOT CONNECTED',
        detail:
          'No live incident store is wired. Open incidents cannot be observed without an external incident ' +
          'tracker (PagerDuty, a site_incidents table, or an ops channel). ' +
          'Value=null. Source: NOT_CONNECTED — requires SUPABASE_SERVICE_ROLE_KEY (if using a DB table) ' +
          'or an external incident API.',
        status: 'NOT_CONNECTED',
        evidence: [this.eb.notConnected('open-incidents', 'SUPABASE_SERVICE_ROLE_KEY')],
        confidence: 0,
      }),
    );

    // 2. Structural incident model — CONNECTED (payments example in artifact)
    const intel = this.incidentIntel();
    if (intel?.domain) {
      const blastEvidence = [
        this.eb.artifact(
          'incident-intelligence-v5',
          'blastRadius',
          `payments blast: ${intel.blastRadius?.domains ?? '?'} domains, ${intel.blastRadius?.routes ?? '?'} routes, ${intel.blastRadius?.rpcs ?? '?'} RPCs, ${intel.blastRadius?.tables ?? '?'} tables`,
        ),
      ];
      findings.push(
        this.fb.build({
          id: 'INCIDENT-MODEL-PAYMENTS-STRUCTURAL',
          area: 'incident',
          kind: 'incident-model',
          severity: 'info',
          subject: 'payments',
          title: 'Structural incident model present: payments domain',
          detail:
            `incident-intelligence-v5.json contains a structural model for the payments domain. ` +
            `Blast radius: ${intel.blastRadius?.domains ?? '?'} affected domains, ` +
            `${intel.blastRadius?.routes ?? '?'} routes, ${intel.blastRadius?.rpcs ?? '?'} RPCs, ` +
            `${intel.blastRadius?.tables ?? '?'} tables. ` +
            `Failed type: ${intel.answers?.whatFailed ?? 'unknown'}. ` +
            `Merchant scope: ${intel.answers?.whichMerchants ?? 'ALL tenants'}.`,
          status: 'CONNECTED',
          evidence: blastEvidence,
        }),
      );
    }

    // 3. Structural: 22 runbooks define the incident detection schema
    const rb = this.runbooksArtifact();
    const runbookCount = rb?.summary?.domains ?? this.runbookEntries().length;
    if (runbookCount > 0) {
      findings.push(
        this.fb.build({
          id: 'INCIDENT-RUNBOOK-SCHEMA-CONNECTED',
          area: 'incident',
          kind: 'incident-schema',
          severity: 'info',
          subject: 'runbooks',
          title: `${runbookCount} domain runbooks define the incident detection schema`,
          detail:
            `graphify-out/runbooks.json contains ${runbookCount} domain runbooks (generated ${rb?.summary?.generatedAt ?? 'unknown'}). ` +
            `Each runbook has 5 sections: detection → diagnosis → recovery → rollback → verification. ` +
            `All detection signals reference NOT CONNECTED live sources (Cloudflare Analytics Engine + Supabase).`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('runbooks', 'summary.domains', `${runbookCount} domain runbooks`),
          ],
        }),
      );
    }

    return findings;
  }

  // ── detectOutages ────────────────────────────────────────────────────────

  /**
   * Detects outage patterns. Live outage status is NOT_CONNECTED. Structural SPOF pattern
   * for queue-workers is CONNECTED and is a critical finding.
   */
  detectOutages(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // 1. Live worker outage status — NOT_CONNECTED
    findings.push(
      this.fb.build({
        id: 'OUTAGE-LIVE-WORKER-STATUS',
        area: 'incident',
        kind: 'live-outage-status',
        severity: 'info',
        subject: 'letbuyy-api',
        title: 'Live worker health: NOT CONNECTED',
        detail:
          'Live worker error rates and health cannot be observed without Cloudflare Analytics Engine. ' +
          'Value=null. Source: NOT_CONNECTED — requires CF_ANALYTICS_API_TOKEN + CF_ACCOUNT_ID ' +
          '(Cloudflare Analytics Engine, dataset RUNTIME_TELEMETRY).',
        status: 'NOT_CONNECTED',
        evidence: [this.eb.notConnected('worker-health', 'CF_ANALYTICS_API_TOKEN')],
        confidence: 0,
      }),
    );

    // 2. Live queue depth — NOT_CONNECTED
    findings.push(
      this.fb.build({
        id: 'OUTAGE-LIVE-QUEUE-DEPTH',
        area: 'incident',
        kind: 'live-queue-depth',
        severity: 'info',
        subject: 'all-queues',
        title: 'Live queue depth: NOT CONNECTED',
        detail:
          'Queue backlog depth cannot be observed without Cloudflare Queues API. ' +
          'Value=null. Source: NOT_CONNECTED — requires CLOUDFLARE_API_TOKEN + CF_ACCOUNT_ID ' +
          '(Cloudflare Queues API: GET /accounts/:id/queues/:name/messages).',
        status: 'NOT_CONNECTED',
        evidence: [this.eb.notConnected('queue-depth', 'CLOUDFLARE_API_TOKEN')],
        confidence: 0,
      }),
    );

    // 3. Structural SPOF — queue-workers is the SINGLE consumer of ALL 5 queues (CRITICAL, CONNECTED)
    const queueGraph = this.store.queueGraph();
    const uniqueConsumers = new Set<string>();
    for (const edge of queueGraph) {
      for (const c of edge.consumers ?? []) uniqueConsumers.add(c);
    }
    const isSingleConsumerSpof = uniqueConsumers.size === 1 && uniqueConsumers.has('letbuyy-queue-workers');
    const queueCount = queueGraph.length;

    if (queueGraph.length > 0) {
      findings.push(
        this.fb.build({
          id: 'OUTAGE-SPOF-QUEUE-WORKERS',
          area: 'incident',
          kind: 'spof-outage-pattern',
          severity: isSingleConsumerSpof ? 'critical' : 'high',
          subject: 'letbuyy-queue-workers',
          title: `letbuyy-queue-workers is the single consumer of all ${queueCount} queues (SPOF)`,
          detail:
            `Structural SPOF: letbuyy-queue-workers is the ONLY consumer for all ${queueCount} queues ` +
            `(EVENT_QUEUE, ANALYTICS_QUEUE, SEARCH_QUEUE, NOTIFICATION_QUEUE, RUNTIME_QUEUE). ` +
            `A failure of this single worker backs up all queues simultaneously, impacting all 22 domains. ` +
            `Dead-letter queues: letbuyy-dead-letters-staging, letbuyy-staging-dead-letter-queue. ` +
            `Source: graphify-out/runtime-intel.json (queueGraph). ` +
            `This pattern is CONNECTED (structural topology); live queue depth is NOT_CONNECTED.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.worker(
              'letbuyy-queue-workers',
              `single consumer for ${queueCount} queues; SPOF for all 22 domains`,
            ),
            this.eb.artifact('runtime-intel', 'queueGraph', `${queueCount} queues, single consumer`),
          ],
        }),
      );
    }

    // 4. Structural: money domain outage pattern (CONNECTED — 8 of 22 domains)
    const moneyDomainKeys = this.runbookEntries()
      .filter(([key]) => this.isMoneyDomain(key))
      .map(([key]) => key);

    if (moneyDomainKeys.length > 0) {
      findings.push(
        this.fb.build({
          id: 'OUTAGE-MONEY-DOMAIN-PATTERN',
          area: 'incident',
          kind: 'outage-pattern',
          severity: 'critical',
          subject: 'money-domains',
          title: `${moneyDomainKeys.length} money domains share a critical outage pattern (ledger-fail + do-not-retry)`,
          detail:
            `Protocol A (money domains): ${moneyDomainKeys.join(', ')}. ` +
            `Detection: ledger_balance_breaks() > 0 OR failed/abandoned ratio on payment_transactions. ` +
            `Recovery rule: DO NOT retry money mutations until reconciled — run refresh_money_ledger_site_reconciliation, ` +
            `verify ledger_balance_breaks() = 0, then replay DLQ. ` +
            `Detection signals are NOT_CONNECTED (requires SUPABASE_SERVICE_ROLE_KEY). ` +
            `Source: graphify-out/runbooks.json → recovery arrays (structural).`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('runbooks', 'recovery', `money-domain recovery Protocol A for ${moneyDomainKeys.length} domains`),
            this.eb.rpc('ledger_balance_breaks', 'money-domain outage detection signal (NOT_CONNECTED value)'),
            this.eb.rpc('refresh_money_ledger_site_reconciliation', 'money-domain recovery RPC'),
          ],
        }),
      );
    }

    // 5. Structural: single deploy pipeline SPOF (from production-readiness-v2)
    const pr = this.store.productionReadiness();
    if (pr) {
      findings.push(
        this.fb.build({
          id: 'OUTAGE-DEPLOY-PIPELINE-SPOF',
          area: 'incident',
          kind: 'infrastructure-spof',
          severity: 'high',
          subject: 'deploy-pipeline',
          title: 'Single deploy pipeline is a SPOF (mitigated by gates)',
          detail:
            'production-readiness-v2.json → infra:deploy evidence: ' +
            '"single pipeline = SPOF (mitigated by gates)". ' +
            'Rollback policy: fail-closed (rollback-integrity-validator); migrations forward-fix-only. ' +
            'Gate: verify-health-gates.mjs must pass before rollback.',
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('production-readiness-v2', 'infra:deploy', 'single pipeline SPOF'),
          ],
        }),
      );
    }

    return findings;
  }

  // ── detectBlastRadius ────────────────────────────────────────────────────

  /**
   * Detects structural blast radius for critical domains by REUSING SignalCorrelator
   * (which delegates to lcis-core's BlastRadiusService). Does NOT reimplement blast traversal.
   */
  detectBlastRadius(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    for (const domainKey of CRITICAL_DOMAINS) {
      const correlation = this.correlator.correlateDomain(domainKey);

      if (correlation === null) {
        // Domain not in graph — still report as an info-level finding
        findings.push(
          this.fb.build({
            id: `BLAST-RADIUS-${domainKey.toUpperCase()}-NOT-IN-GRAPH`,
            area: 'incident',
            kind: 'blast-radius',
            severity: 'info',
            subject: domainKey,
            title: `Blast radius for '${domainKey}': not found in code graph`,
            detail:
              `SignalCorrelator.correlateDomain('${domainKey}') returned null — ` +
              `the domain key is not present in the current graphify-out/domain-intel.json. ` +
              `Run 'pnpm graph:domain' to refresh.`,
            status: 'UNKNOWN',
            evidence: [
              this.eb.artifact('domain-intel', domainKey, 'domain not found in graph'),
            ],
          }),
        );
        continue;
      }

      const isMoney = MONEY_DOMAINS.has(domainKey);
      const isTenant = true; // all domains share multi-tenant schema
      const severity = isMoney ? 'critical' : correlation.impactedDomains >= 5 ? 'high' : 'medium';

      const evidenceItems = [
        this.eb.artifact(
          'domain-intel',
          domainKey,
          `blast: ${correlation.impactedDomains} domains, ${correlation.tables.length} tables, ${correlation.workers.length} workers`,
        ),
      ];
      if (correlation.tables.length > 0) {
        evidenceItems.push(this.eb.table(correlation.tables[0]!, `top affected table in ${domainKey} blast`));
      }
      if (correlation.workers.length > 0) {
        evidenceItems.push(this.eb.worker(correlation.workers[0]!, `worker in ${domainKey} blast`));
      }

      findings.push(
        this.fb.build({
          id: `BLAST-RADIUS-${domainKey.toUpperCase()}`,
          area: 'incident',
          kind: 'blast-radius',
          severity,
          subject: domainKey,
          title: `${domainKey} blast radius: ${correlation.impactedDomains} domains, ${correlation.tables.length} tables`,
          detail:
            `Structural blast radius for '${domainKey}' (via lcis-core BlastRadiusService): ` +
            `${correlation.impactedDomains} impacted domains (${correlation.affected.slice(0, 5).join(', ')}${correlation.affected.length > 5 ? '...' : ''}), ` +
            `${correlation.tables.length} tables, ${correlation.workers.length} workers, ${correlation.queues.length} queues. ` +
            `Money risk: ${correlation.money}. Tenant risk: ${isTenant} (ALL tenants share schema; isolation = RLS + verifySiteOwnership). ` +
            `Source: graphify-out/domain-intel.json (CONNECTED, structural graph traversal).`,
          status: 'CONNECTED',
          evidence: evidenceItems,
        }),
      );
    }

    // Also include the hard-coded payments blast from incident-intelligence-v5.json
    // (authoritative numbers: 11 domains, 49 routes, 103 RPCs, 205 tables)
    const intel = this.incidentIntel();
    if (intel?.blastRadius && intel.domain === 'payments') {
      const br = intel.blastRadius;
      findings.push(
        this.fb.build({
          id: 'BLAST-RADIUS-PAYMENTS-AUTHORITATIVE',
          area: 'incident',
          kind: 'blast-radius-authoritative',
          severity: 'critical',
          subject: 'payments',
          title: `Payments authoritative blast: ${br.domains} domains, ${br.routes} routes, ${br.rpcs} RPCs, ${br.tables} tables`,
          detail:
            `incident-intelligence-v5.json authoritative payments blast radius: ` +
            `${br.domains} downstream domains (${(br.affected ?? []).join(', ')}), ` +
            `${br.routes} routes, ${br.rpcs} RPCs, ${br.tables} tables across 3 graph layers. ` +
            `All tables are money/ledger tables — cross-tenant by default (ALL tenants share schema). ` +
            `Source: graphify-out/incident-intelligence-v5.json (CONNECTED).`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(
              'incident-intelligence-v5',
              'blastRadius',
              `${br.domains} domains, ${br.routes} routes, ${br.rpcs} RPCs, ${br.tables} tables`,
            ),
          ],
        }),
      );
    }

    return findings;
  }

  // ── detectRecoveryStatus ─────────────────────────────────────────────────

  /**
   * Detects structural runbook coverage (CONNECTED) and live recovery progress (NOT_CONNECTED).
   * Money/tenant domains without a runbook produce gap findings.
   */
  detectRecoveryStatus(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const entries = this.runbookEntries();
    const coveredDomains = new Set(entries.map(([key]) => key));

    // 1. Runbook coverage count — CONNECTED structural fact
    if (entries.length > 0) {
      findings.push(
        this.fb.build({
          id: 'RECOVERY-RUNBOOK-COVERAGE-STRUCTURAL',
          area: 'incident',
          kind: 'runbook-coverage',
          severity: 'info',
          subject: 'all-domains',
          title: `${entries.length} of 22 domains have a runbook (structural coverage: CONNECTED)`,
          detail:
            `graphify-out/runbooks.json covers ${entries.length} domains with 5-section runbooks ` +
            `(detection, diagnosis, recovery, rollback, verification). ` +
            `Rollback command is uniform across all domains: production-rollback.mjs --worker letbuyy-api. ` +
            `Gate: verify-health-gates.mjs. Policy: fail-closed; forward-fix-only migrations. ` +
            `Source: graphify-out/runbooks.json (CONNECTED).`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('runbooks', 'summary.domains', `${entries.length} domains covered`),
          ],
        }),
      );
    }

    // 2. Per-domain runbook confirmation for money domains (CONNECTED)
    for (const [key, rb] of entries) {
      if (!this.isMoneyDomain(key)) continue;
      const hasMoneyRecovery =
        (rb.recovery ?? []).some((s) => s.includes('reconcil') || s.includes('ledger'));
      findings.push(
        this.fb.build({
          id: `RECOVERY-MONEY-RUNBOOK-${key.toUpperCase()}`,
          area: 'incident',
          kind: 'money-runbook',
          severity: 'info',
          subject: key,
          title: `${rb.label ?? key}: money-domain runbook present (Protocol A${hasMoneyRecovery ? ' ✓' : ' — recovery steps verify'})`,
          detail:
            `${rb.label ?? key} has a runbook with ${(rb.recovery ?? []).length} recovery steps. ` +
            (hasMoneyRecovery
              ? 'Recovery Protocol A confirmed: ledger reconciliation step present before DLQ replay. '
              : 'Recovery steps found (check for ledger reconciliation step). ') +
            `Detection signals: ${(rb.detection?.signals ?? []).slice(0, 2).join('; ')}. ` +
            `All signals NOT CONNECTED (source: Cloudflare Analytics Engine + Supabase). ` +
            `Source: graphify-out/runbooks.json → ${key}.recovery (CONNECTED).`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact('runbooks', `${key}.recovery`, `${(rb.recovery ?? []).length} steps`),
          ],
        }),
      );
    }

    // 3. Live recovery progress — NOT_CONNECTED (requires live incident tracker)
    findings.push(
      this.fb.build({
        id: 'RECOVERY-LIVE-PROGRESS-NOT-CONNECTED',
        area: 'incident',
        kind: 'live-recovery-progress',
        severity: 'info',
        subject: 'recovery-tracker',
        title: 'Live recovery progress: NOT CONNECTED',
        detail:
          'Actual recovery progress (current step, elapsed time, who is on-call) cannot be observed ' +
          'without a live incident tracker. Value=null. Source: NOT_CONNECTED — requires an external ' +
          'incident API or SUPABASE_SERVICE_ROLE_KEY if using a site_incidents table.',
        status: 'NOT_CONNECTED',
        evidence: [this.eb.notConnected('recovery-progress', 'SUPABASE_SERVICE_ROLE_KEY')],
        confidence: 0,
      }),
    );

    // 4. Live ledger health (post-recovery verification signal) — NOT_CONNECTED
    findings.push(
      this.fb.build({
        id: 'RECOVERY-LEDGER-HEALTH-NOT-CONNECTED',
        area: 'incident',
        kind: 'live-ledger-health',
        severity: 'info',
        subject: 'ledger_balance_breaks',
        title: 'Post-recovery ledger verification (ledger_balance_breaks): NOT CONNECTED',
        detail:
          'The money-domain recovery verification step requires ledger_balance_breaks() = 0. ' +
          'This RPC value is NOT CONNECTED — requires SUPABASE_SERVICE_ROLE_KEY. ' +
          'Source: Supabase RPC ledger_balance_breaks(); env var: SUPABASE_SERVICE_ROLE_KEY.',
        status: 'NOT_CONNECTED',
        evidence: [this.eb.notConnected('ledger_balance_breaks', 'SUPABASE_SERVICE_ROLE_KEY')],
        confidence: 0,
      }),
    );

    // 5. Gap: money/tenant domains without a runbook
    for (const moneyKey of MONEY_DOMAINS) {
      if (!coveredDomains.has(moneyKey)) {
        findings.push(
          this.fb.build({
            id: `RECOVERY-GAP-MISSING-RUNBOOK-${moneyKey.toUpperCase()}`,
            area: 'incident',
            kind: 'runbook-gap',
            severity: 'high',
            subject: moneyKey,
            title: `Money domain '${moneyKey}' has no runbook — gap in recovery coverage`,
            detail:
              `'${moneyKey}' is a money/ledger domain (requires Protocol A recovery) but was not found ` +
              `in graphify-out/runbooks.json. This is a gap: an incident in this domain has no ` +
              `documented detection → diagnosis → recovery → rollback → verification chain. ` +
              `Run 'pnpm graph:domain' to refresh the domain graph, then 'pnpm graph:reports' to regenerate runbooks.`,
            status: 'CONNECTED',
            evidence: [
              this.eb.artifact('runbooks', moneyKey, 'domain not found in runbook artifact'),
            ],
          }),
        );
      }
    }

    return findings;
  }

  // ── generateIncidentReport ───────────────────────────────────────────────

  /**
   * Generates the full IncidentReport via operations(). Collects all facts + findings +
   * signals (byArea('incident')) + health + summary. Identifies money/tenant domains
   * without runbooks as CONNECTED gap findings.
   */
  generateIncidentReport(): IncidentReport {
    const incidentFindings = this.detectIncidents();
    const outageFindings = this.detectOutages();
    const blastFindings = this.detectBlastRadius();
    const recoveryFindings = this.detectRecoveryStatus();

    const allFindings: OperationalFinding[] = [
      ...incidentFindings,
      ...outageFindings,
      ...blastFindings,
      ...recoveryFindings,
    ];

    // ── Facts ──────────────────────────────────────────────────────────────

    const facts: OperationalFact[] = [];

    // Runbook count (CONNECTED structural fact)
    const entries = this.runbookEntries();
    const rb = this.runbooksArtifact();
    facts.push(
      this.tn.fact('incident', 'runbook-count', 'runbooks', `${entries.length} domain runbooks`, {
        value: entries.length,
        status: entries.length > 0 ? 'CONNECTED' : 'UNKNOWN',
        at: rb?.summary?.generatedAt ?? null,
        evidence: [this.eb.artifact('runbooks', 'summary.domains', `${entries.length} runbooks`)],
      }),
    );

    // Money domain count (CONNECTED)
    const moneyCount = entries.filter(([key]) => this.isMoneyDomain(key)).length;
    facts.push(
      this.tn.fact('incident', 'money-domain-runbooks', 'money-domains', `${moneyCount} of ${MONEY_DOMAINS.size} money domains have runbooks`, {
        value: moneyCount,
        status: 'CONNECTED',
        at: null,
        evidence: [this.eb.artifact('runbooks', 'runbooks', `${moneyCount} money-domain runbooks`)],
      }),
    );

    // Live open incidents (NOT_CONNECTED)
    facts.push(
      this.tn.fact('incident', 'open-incidents', 'live-incident-store', 'live open incident count (NOT CONNECTED)', {
        value: null,
        status: 'NOT_CONNECTED',
        at: null,
        evidence: [this.eb.notConnected('open-incidents', 'SUPABASE_SERVICE_ROLE_KEY')],
      }),
    );

    // Payments blast radius (CONNECTED from artifact)
    const intel = this.incidentIntel();
    if (intel?.blastRadius) {
      facts.push(
        this.tn.fact('incident', 'payments-blast-radius', 'payments', `${intel.blastRadius.domains} domains affected`, {
          value: intel.blastRadius.domains ?? null,
          status: 'CONNECTED',
          at: null,
          evidence: [this.eb.artifact('incident-intelligence-v5', 'blastRadius.domains', `${intel.blastRadius.domains}`)],
        }),
      );
      facts.push(
        this.tn.fact('incident', 'payments-blast-tables', 'payments', `${intel.blastRadius.tables} tables in blast`, {
          value: intel.blastRadius.tables ?? null,
          status: 'CONNECTED',
          at: null,
          evidence: [this.eb.artifact('incident-intelligence-v5', 'blastRadius.tables', `${intel.blastRadius.tables}`)],
        }),
      );
    }

    // Queue SPOF fact (CONNECTED)
    const queueGraph = this.store.queueGraph();
    facts.push(
      this.tn.fact('incident', 'queue-consumer-spof', 'letbuyy-queue-workers', `single consumer for ${queueGraph.length} queues`, {
        value: queueGraph.length,
        status: queueGraph.length > 0 ? 'CONNECTED' : 'UNKNOWN',
        at: null,
        evidence: [this.eb.worker('letbuyy-queue-workers', `single consumer for ${queueGraph.length} queues`)],
      }),
    );

    // ── Signals (byArea 'incident') ────────────────────────────────────────

    const incidentSignals = this.reg.byArea('incident');
    const signals: LiveSignal[] = incidentSignals.map((sig) => {
      const ev =
        sig.detectability === 'NOT_CONNECTED'
          ? [this.eb.notConnected(sig.key, sig.requiresEnvVar[0] ?? 'UNKNOWN_ENV_VAR')]
          : [this.eb.artifact(sig.dataSource.replace('graphify-out/', '').replace('.json', ''), sig.key, sig.label)];
      return this.tn.signalToLive(sig, ev);
    });

    // ── Health ─────────────────────────────────────────────────────────────

    const health = this.hc.forArea('incident', allFindings, signals);

    // ── All evidence (for the top-level artifact envelope) ─────────────────

    const topLevelEvidence = [
      this.eb.artifact('incident-intelligence-v5', 'payments', 'structural incident model'),
      this.eb.artifact('runbooks', 'summary', `${entries.length} domain runbooks`),
      this.eb.artifact('runtime-intel', 'queueGraph', 'queue-workers SPOF structural topology'),
      this.eb.notConnected('open-incidents', 'SUPABASE_SERVICE_ROLE_KEY'),
      this.eb.notConnected('live-worker-errors', 'CF_ANALYTICS_API_TOKEN'),
    ];

    // ── Summary ────────────────────────────────────────────────────────────

    const connectedBlast = blastFindings.filter((f) => f.status === 'CONNECTED').length;
    const gapCount = allFindings.filter((f) => f.kind === 'runbook-gap').length;
    const notConnectedCount = allFindings.filter((f) => f.status === 'NOT_CONNECTED').length;

    const summary =
      `Incident intelligence: ${entries.length} runbooks (CONNECTED structural); ` +
      `queue-workers is a critical SPOF (single consumer, 5 queues, 22 domains); ` +
      `payments blast: ${intel?.blastRadius?.domains ?? '?'} domains / ${intel?.blastRadius?.tables ?? '?'} tables (CONNECTED); ` +
      `${connectedBlast} blast-radius facts derived; ` +
      `${gapCount > 0 ? `${gapCount} runbook gap(s) detected; ` : ''}` +
      `${notConnectedCount} live signals NOT CONNECTED (open incidents, worker errors, queue depth, ledger health — require credentials).`;

    return operations(
      {
        area: 'incident' as const,
        facts,
        findings: allFindings,
        signals,
        health,
        summary,
      },
      {
        evidence: topLevelEvidence,
        liveConnected: false,
        now: this.now,
      },
    ) as IncidentReport;
  }
}
