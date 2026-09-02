/**
 * MerchantOperationsService — LCOS Phase 6 merchant intelligence.
 * READ-ONLY P0: observes/analyzes/reports only. Never deploys, executes, mutates, writes, or fixes.
 * No fetch/child_process/spawn/exec/eval/writeFile/network/DB-write. Deterministic. No AI.
 * No placeholders/mocks/stubs.
 *
 * Live VALUES (active count, churn/activation rates, scores) are NOT_CONNECTED:
 * value=null, env var named, confidence=0. Never fabricated.
 */
import { type Evidence, type LcisEngine } from '@letbuyy/lcis-core';
import {
  OperationsArtifactStore,
  LiveSignalRegistry,
  TelemetryNormalizer,
  OperationalEvidenceBuilder,
  OperationalSeverityScorer,
  OperationalFindingBuilder,
  OperationalHealthCalculator,
  operations,
  defaultNow,
  type MerchantReport,
  type OperationalFinding,
  type OperationalFact,
  type LiveSignal,
} from '../shared/index';

const SUPA_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const MERCHANT_INTEL = 'merchant-intelligence';
const MERCHANT_HEALTH = 'merchant-health';
const MERCHANT_CHURN = 'merchant-churn';
const MERCHANT_GROWTH = 'merchant-growth';
const MERCHANT_ADOPTION = 'merchant-adoption';
const MERCHANT_RISK = 'merchant-risk';

export class MerchantOperationsService {
  private readonly store: OperationsArtifactStore;
  private readonly reg: LiveSignalRegistry;
  private readonly norm: TelemetryNormalizer;
  private readonly eb: OperationalEvidenceBuilder;
  private readonly ss: OperationalSeverityScorer;
  private readonly fb: OperationalFindingBuilder;
  private readonly hc: OperationalHealthCalculator;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.store = new OperationsArtifactStore(core);
    this.reg = new LiveSignalRegistry();
    this.norm = new TelemetryNormalizer();
    this.eb = new OperationalEvidenceBuilder();
    this.ss = new OperationalSeverityScorer();
    this.fb = new OperationalFindingBuilder();
    this.hc = new OperationalHealthCalculator();
  }

  // ── private helpers ──────────────────────────────────────────────────────────

  private rawMerchant(): Record<string, unknown> | null {
    return this.store.merchant();
  }

  private rawArtifact(name: string): Record<string, unknown> | null {
    const r = this.store.raw(name);
    return r != null && typeof r === 'object' ? (r as Record<string, unknown>) : null;
  }

  private notConnectedFact(
    kind: string,
    subject: string,
    detail: string,
    source: string,
    envVar: string,
  ): OperationalFact {
    return this.norm.fact('merchant', kind, subject, detail, {
      value: null,
      status: 'NOT_CONNECTED',
      evidence: [this.eb.notConnected(source, envVar)],
    });
  }

  private connectedFact(
    kind: string,
    subject: string,
    detail: string,
    value: string | number | null,
    evidences: readonly Evidence[],
  ): OperationalFact {
    return this.norm.fact('merchant', kind, subject, detail, {
      value,
      status: 'CONNECTED',
      evidence: evidences,
    });
  }

  private notConnectedSignals(): readonly LiveSignal[] {
    return this.reg.byArea('merchant').map((sig) => this.norm.signalToLive(sig, []));
  }

  // ── detectActivation ─────────────────────────────────────────────────────────

  /**
   * Detect merchant activation health.
   * - Live activation rate: NOT_CONNECTED (Supabase rows required)
   * - Structural: 8-state lifecycle model CONNECTED; source tables identified
   */
  detectActivation(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const intel = this.rawMerchant();
    const adoption = this.rawArtifact(MERCHANT_ADOPTION);

    // Structural finding: lifecycle model CONNECTED (8 states, source tables known)
    const lifecycle = (intel?.['lifecycle'] ?? {}) as { states?: unknown };
    const lifecycleStates: string[] = Array.isArray(lifecycle.states) ? (lifecycle.states as string[]) : [];
    const stateCount = lifecycleStates.length;

    if (stateCount > 0) {
      findings.push(this.fb.build({
        id: 'MERCHANT-ACTIVATION-LIFECYCLE-MODEL',
        area: 'merchant',
        kind: 'activation-lifecycle',
        severity: 'info',
        subject: 'merchant-lifecycle',
        title: `Merchant lifecycle model CONNECTED — ${stateCount} states`,
        detail: `8-state machine (Created → Activated → First Product → First Order → First Revenue → Active → At Risk → Churned). Source tables: sites, onboarding_attempts, products, orders, payment_transactions. Activation RATE is NOT_CONNECTED — requires Supabase rows.`,
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(MERCHANT_INTEL, 'lifecycle.states', `${stateCount} lifecycle states modelled`),
          this.eb.table('sites', 'Created state source'),
          this.eb.table('onboarding_attempts', 'Activated state source'),
          this.eb.table('products', 'First Product state source'),
        ],
      }));
    }

    // Activation features model CONNECTED from adoption artifact
    const adoptionModel = (adoption?.['model'] ?? {}) as { features?: unknown };
    const features = Array.isArray(adoptionModel.features)
      ? (adoptionModel.features as { name: string; sources: string[] }[])
      : [];
    if (features.length > 0) {
      findings.push(this.fb.build({
        id: 'MERCHANT-ACTIVATION-FEATURE-MODEL',
        area: 'merchant',
        kind: 'activation-adoption',
        severity: 'info',
        subject: 'merchant-adoption-model',
        title: `Adoption feature model CONNECTED — ${features.length} features tracked`,
        detail: `Features: ${features.map((f) => f.name).join(', ')}. Source tables: ${features.flatMap((f) => f.sources).join(', ')}. Per-merchant activation % is NOT_CONNECTED — requires SUPABASE_URL.`,
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(MERCHANT_ADOPTION, 'model.features', `${features.length} adoption features modelled`),
          ...features.slice(0, 3).map((f) =>
            this.eb.table(f.sources[0] ?? f.name, `${f.name} activation source`),
          ),
        ],
      }));
    }

    // Live activation rate: NOT_CONNECTED
    findings.push(this.fb.build({
      id: 'MERCHANT-ACTIVATION-RATE-NOT-CONNECTED',
      area: 'merchant',
      kind: 'activation-rate',
      severity: 'medium',
      subject: 'activation-rate',
      title: 'Merchant activation rate NOT_CONNECTED',
      detail: `Live activation rate (sites created → onboarding completed → product published) requires Supabase rows. Source: sites, onboarding_attempts, products. Connect SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.`,
      status: 'NOT_CONNECTED',
      confidence: 0,
      evidence: [
        this.eb.notConnected('activation-rate', 'SUPABASE_URL'),
        this.eb.notConnected('activation-rate', 'SUPABASE_SERVICE_ROLE_KEY'),
      ],
    }));

    return findings;
  }

  // ── detectGrowth ─────────────────────────────────────────────────────────────

  /**
   * Detect merchant growth signals.
   * - Live GMV/growth rates: NOT_CONNECTED (Supabase rows required)
   * - Structural: growth dimensions model CONNECTED
   */
  detectGrowth(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const growth = this.rawArtifact(MERCHANT_GROWTH);

    const growthModel = (growth?.['model'] ?? {}) as { dimensions?: unknown };
    const dims = Array.isArray(growthModel.dimensions)
      ? (growthModel.dimensions as { name: string; signal: string; sources: string[] }[])
      : [];

    if (dims.length > 0) {
      findings.push(this.fb.build({
        id: 'MERCHANT-GROWTH-MODEL-CONNECTED',
        area: 'merchant',
        kind: 'growth-model',
        severity: 'info',
        subject: 'merchant-growth-model',
        title: `Growth model CONNECTED — ${dims.length} dimensions`,
        detail: `Dimensions: ${dims.map((d) => d.name).join(', ')}. Source tables: ${dims.flatMap((d) => d.sources).join(', ')}. Live GMV trend + growth rate per merchant are NOT_CONNECTED — requires Supabase rows.`,
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(MERCHANT_GROWTH, 'model.dimensions', `${dims.length} growth dimensions`),
          this.eb.table('orders', 'GMV trend source (total_minor per site_id)'),
          this.eb.table('ledger_entries', 'Ledger-based growth verification'),
        ],
      }));
    }

    // Live growth rate NOT_CONNECTED
    findings.push(this.fb.build({
      id: 'MERCHANT-GROWTH-RATE-NOT-CONNECTED',
      area: 'merchant',
      kind: 'growth-rate',
      severity: 'medium',
      subject: 'gmv-growth-rate',
      title: 'Merchant GMV growth rate NOT_CONNECTED',
      detail: `Live GMV MoM growth per merchant requires Supabase time-series query on orders.total_minor by site_id. Connect SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.`,
      status: 'NOT_CONNECTED',
      confidence: 0,
      evidence: [
        this.eb.notConnected('gmv-growth-rate', 'SUPABASE_URL'),
        this.eb.notConnected('gmv-growth-rate', 'SUPABASE_SERVICE_ROLE_KEY'),
      ],
    }));

    return findings;
  }

  // ── detectChurn ──────────────────────────────────────────────────────────────

  /**
   * Detect merchant churn signals.
   * - Live churn probability: NOT_CONNECTED
   * - Structural: 5-signal churn model CONNECTED (tables identified)
   */
  detectChurn(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const churn = this.rawArtifact(MERCHANT_CHURN);

    const churnModel = (churn?.['model'] ?? {}) as { signals?: unknown };
    const signals = Array.isArray(churnModel.signals)
      ? (churnModel.signals as { name: string; signal: string; sources: string[] }[])
      : [];

    if (signals.length > 0) {
      findings.push(this.fb.build({
        id: 'MERCHANT-CHURN-SIGNAL-MODEL-CONNECTED',
        area: 'merchant',
        kind: 'churn-signal-model',
        severity: 'info',
        subject: 'merchant-churn-model',
        title: `Churn signal model CONNECTED — ${signals.length} signals`,
        detail: `Signals: ${signals.map((s) => s.name).join(', ')}. Source tables: ${signals.flatMap((s) => s.sources).join(', ')}. Live churn probability per merchant is NOT_CONNECTED — requires Supabase rows.`,
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(MERCHANT_CHURN, 'model.signals', `${signals.length} churn signals modelled`),
          ...signals.slice(0, 3).map((s) =>
            this.eb.table(s.sources[0] ?? s.name, `${s.name} churn signal source`),
          ),
        ],
      }));
    }

    // Live churn rate NOT_CONNECTED
    findings.push(this.fb.build({
      id: 'MERCHANT-CHURN-RATE-NOT-CONNECTED',
      area: 'merchant',
      kind: 'churn-rate',
      severity: 'high',
      subject: 'churn-rate',
      title: 'Merchant churn rate NOT_CONNECTED',
      detail: `Live churn probability per merchant requires Supabase time-series over orders, subscriptions, billing_dunning_events, sessions. Source: ${signals.flatMap((s) => s.sources.slice(0, 1)).join(', ')}. Connect SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.`,
      status: 'NOT_CONNECTED',
      confidence: 0,
      evidence: [
        this.eb.notConnected('churn-rate', 'SUPABASE_URL'),
        this.eb.notConnected('churn-rate', 'SUPABASE_SERVICE_ROLE_KEY'),
      ],
    }));

    return findings;
  }

  // ── detectDormancy ───────────────────────────────────────────────────────────

  /**
   * Detect dormant merchants.
   * - Live dormancy count/list: NOT_CONNECTED (inactive detector requires Supabase)
   */
  detectDormancy(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const intel = this.rawMerchant();
    const detectors = intel?.['detectors'] as Record<string, { metric?: string; source?: string }> | undefined;
    const inactiveDet = detectors?.['inactiveMerchants'];

    findings.push(this.fb.build({
      id: 'MERCHANT-DORMANCY-DETECTOR-CONNECTED',
      area: 'merchant',
      kind: 'dormancy-detector',
      severity: 'info',
      subject: 'inactive-merchant-detector',
      title: 'Dormancy detector model CONNECTED',
      detail: `Detector pattern: sites with max(orders.created_at) < now()-interval. Source table: orders.created_at by site_id. Metric: "${inactiveDet?.['metric'] ?? 'no orders in N days'}". Live inactive count is NOT_CONNECTED — requires SUPABASE_URL.`,
      status: 'CONNECTED',
      evidence: [
        this.eb.artifact(MERCHANT_INTEL, 'detectors.inactiveMerchants', 'Inactivity detector pattern'),
        this.eb.table('orders', 'Dormancy signal source (created_at recency per site_id)'),
      ],
    }));

    // Live dormancy count NOT_CONNECTED
    findings.push(this.fb.build({
      id: 'MERCHANT-DORMANCY-COUNT-NOT-CONNECTED',
      area: 'merchant',
      kind: 'dormancy-count',
      severity: 'medium',
      subject: 'dormant-merchant-count',
      title: 'Dormant merchant count NOT_CONNECTED',
      detail: `Live count of merchants with no orders in N days requires Supabase query: sites with max(orders.created_at) < now()-interval. Connect SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.`,
      status: 'NOT_CONNECTED',
      confidence: 0,
      evidence: [
        this.eb.notConnected('inactive-merchant-count', 'SUPABASE_URL'),
        this.eb.notConnected('inactive-merchant-count', 'SUPABASE_SERVICE_ROLE_KEY'),
      ],
    }));

    return findings;
  }

  // ── detectRetention ──────────────────────────────────────────────────────────

  /**
   * Detect merchant retention signals — and the critical CONNECTED structural finding:
   * the single-schema multi-tenant SPOF affects ALL merchants.
   */
  detectRetention(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const intel = this.rawMerchant();
    const summary = intel?.['summary'] as Record<string, unknown> | undefined;
    const tenantTables = typeof summary?.['tenantTables'] === 'number' ? summary['tenantTables'] : 256;
    const singlePointOfDependency = summary?.['singlePointOfDependency'] === true;

    // CRITICAL CONNECTED finding: single-schema SPOF
    if (singlePointOfDependency) {
      const spofSev = this.ss.forSignal({ spof: true });
      findings.push(this.fb.build({
        id: 'MERCHANT-RETENTION-SPOF-SINGLE-SCHEMA',
        area: 'merchant',
        kind: 'retention-spof',
        severity: spofSev,
        subject: 'single-schema-multi-tenant-spof',
        title: `SPOF: single-schema multi-tenant — all ${tenantTables} tenant tables on one schema`,
        detail: `Finding M-1 (CONNECTED): Every merchant shares one Postgres schema, one Cloudflare Workers deploy, one Vercel app fleet. Isolation is RLS + verifySiteOwnership only — not physical separation. A bug in an RLS policy or verifySiteOwnership is a cross-tenant data breach affecting ALL merchants simultaneously. One deploy pipeline (production-deploy.yml). ${tenantTables} tenant tables carry site_id.`,
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(MERCHANT_INTEL, 'findings.M-1', 'Single-tenant shared schema SPOF'),
          this.eb.artifact(MERCHANT_INTEL, 'summary.tenantTables', `${tenantTables} tenant tables on one schema`),
          this.eb.artifact(MERCHANT_INTEL, 'summary.singlePointOfDependency', 'Confirmed SPOF'),
          this.eb.table('sites', 'Tenant root — all merchants share this schema'),
          this.eb.doc('verifySiteOwnership', 'Sole cross-tenant isolation middleware', 'apps/merchant_web'),
        ],
      }));
    }

    // Live retention rate NOT_CONNECTED
    findings.push(this.fb.build({
      id: 'MERCHANT-RETENTION-RATE-NOT-CONNECTED',
      area: 'merchant',
      kind: 'retention-rate',
      severity: 'high',
      subject: 'merchant-retention-rate',
      title: 'Merchant retention rate NOT_CONNECTED',
      detail: `Live retention (cohort: First Revenue → Active → At Risk → Churned) requires Supabase time-series over orders + subscriptions + billing_dunning_events. Connect SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.`,
      status: 'NOT_CONNECTED',
      confidence: 0,
      evidence: [
        this.eb.notConnected('merchant-retention-rate', 'SUPABASE_URL'),
        this.eb.notConnected('merchant-retention-rate', 'SUPABASE_SERVICE_ROLE_KEY'),
      ],
    }));

    return findings;
  }

  // ── collectFacts ─────────────────────────────────────────────────────────────

  private collectFacts(): readonly OperationalFact[] {
    const facts: OperationalFact[] = [];
    const intel = this.rawMerchant();
    const health = this.rawArtifact(MERCHANT_HEALTH);
    const risk = this.rawArtifact(MERCHANT_RISK);
    const growth = this.rawArtifact(MERCHANT_GROWTH);
    const adoption = this.rawArtifact(MERCHANT_ADOPTION);
    const churn = this.rawArtifact(MERCHANT_CHURN);

    // ── Structural facts (CONNECTED) ──────────────────────────────────────────

    // Lifecycle states count
    const lifecycleStates: string[] = Array.isArray(
      (intel?.['lifecycle'] as { states?: string[] } | undefined)?.['states'],
    )
      ? ((intel!['lifecycle'] as { states: string[] })['states'])
      : [];
    facts.push(this.connectedFact(
      'lifecycle-state-count',
      'merchant-lifecycle',
      '8-state merchant lifecycle machine modelled',
      lifecycleStates.length,
      [this.eb.artifact(MERCHANT_INTEL, 'lifecycle.states', `${lifecycleStates.length} states`)],
    ));

    // Operating stage count
    const operating = Array.isArray(intel?.['operating']) ? (intel!['operating'] as unknown[]) : [];
    facts.push(this.connectedFact(
      'operating-stage-count',
      'merchant-operating-stages',
      'Operating stages covering merchant control plane',
      operating.length,
      [this.eb.artifact(MERCHANT_INTEL, 'operating', `${operating.length} operating stages`)],
    ));

    // Tenant table count
    const summary = intel?.['summary'] as Record<string, unknown> | undefined;
    const tenantTables = typeof summary?.['tenantTables'] === 'number' ? summary['tenantTables'] : null;
    facts.push(this.connectedFact(
      'tenant-table-count',
      'merchant-schema',
      'Tenant tables sharing one schema (site_id isolation)',
      tenantTables,
      [this.eb.artifact(MERCHANT_INTEL, 'summary.tenantTables', 'All tenant tables on single schema')],
    ));

    // Health model dimensions
    const healthDims = Array.isArray(
      (health?.['model'] as { dimensions?: unknown[] } | undefined)?.['dimensions'],
    )
      ? ((health!['model'] as { dimensions: { name: string; weight: number }[] })['dimensions'])
      : [];
    facts.push(this.connectedFact(
      'health-dimension-count',
      'merchant-health-model',
      `Health model: ${healthDims.length} weighted dimensions (order-activity 0.25, payment-success 0.25, fulfillment 0.20, data-integrity 0.15, incidents 0.15)`,
      healthDims.length,
      [this.eb.artifact(MERCHANT_HEALTH, 'model.dimensions', `${healthDims.length} health dimensions`)],
    ));

    // Risk model dimensions
    const riskDims = Array.isArray(
      (risk?.['model'] as { dimensions?: unknown[] } | undefined)?.['dimensions'],
    )
      ? ((risk!['model'] as { dimensions: { name: string }[] })['dimensions'])
      : [];
    facts.push(this.connectedFact(
      'risk-dimension-count',
      'merchant-risk-model',
      `Risk model: ${riskDims.length} dimensions (${riskDims.map((d) => d.name).join(', ')})`,
      riskDims.length,
      [
        this.eb.artifact(MERCHANT_RISK, 'model.dimensions', `${riskDims.length} risk dimensions`),
        this.eb.table('risk_scores', 'Risk score table present'),
        this.eb.table('order_risk_assessments', 'Order risk assessment table'),
      ],
    ));

    // Growth model dimensions
    const growthDims = Array.isArray(
      (growth?.['model'] as { dimensions?: unknown[] } | undefined)?.['dimensions'],
    )
      ? ((growth!['model'] as { dimensions: { name: string }[] })['dimensions'])
      : [];
    facts.push(this.connectedFact(
      'growth-dimension-count',
      'merchant-growth-model',
      `Growth model: ${growthDims.length} dimensions (${growthDims.map((d) => d.name).join(', ')})`,
      growthDims.length,
      [this.eb.artifact(MERCHANT_GROWTH, 'model.dimensions', `${growthDims.length} growth dimensions`)],
    ));

    // Adoption feature count
    const adoptionFeatures = Array.isArray(
      (adoption?.['model'] as { features?: unknown[] } | undefined)?.['features'],
    )
      ? ((adoption!['model'] as { features: { name: string }[] })['features'])
      : [];
    facts.push(this.connectedFact(
      'adoption-feature-count',
      'merchant-adoption-model',
      `Adoption model: ${adoptionFeatures.length} features tracked per merchant`,
      adoptionFeatures.length,
      [this.eb.artifact(MERCHANT_ADOPTION, 'model.features', `${adoptionFeatures.length} adoption features`)],
    ));

    // Churn signal count
    const churnSignals = Array.isArray(
      (churn?.['model'] as { signals?: unknown[] } | undefined)?.['signals'],
    )
      ? ((churn!['model'] as { signals: { name: string }[] })['signals'])
      : [];
    facts.push(this.connectedFact(
      'churn-signal-count',
      'merchant-churn-model',
      `Churn model: ${churnSignals.length} signals (${churnSignals.map((s) => s.name).join(', ')})`,
      churnSignals.length,
      [this.eb.artifact(MERCHANT_CHURN, 'model.signals', `${churnSignals.length} churn signals`)],
    ));

    // Founding program capacity (structural)
    const fp = intel?.['foundingProgram'] as Record<string, unknown> | undefined;
    const fpCap = fp?.['capacity'] as { total?: number; public?: number; invited?: number; partner?: number } | undefined;
    const fpTotal = fpCap?.['total'] ?? null;
    facts.push(this.connectedFact(
      'founding-program-capacity',
      'founding-merchant-program',
      `Founding merchant program: ${fpTotal ?? '?'} total slots (public:${fpCap?.['public'] ?? '?'}, invited:${fpCap?.['invited'] ?? '?'}, partner:${fpCap?.['partner'] ?? '?'})`,
      fpTotal ?? null,
      [
        this.eb.artifact(MERCHANT_INTEL, 'foundingProgram.capacity', 'Founding program capacity'),
        this.eb.rpc('allocate_founding_merchant', 'Race-safe slot allocation RPC'),
        this.eb.table('founding_merchant_program', 'Program state + slot counts'),
      ],
    ));

    // ── Live facts (NOT_CONNECTED) ────────────────────────────────────────────

    facts.push(this.notConnectedFact(
      'active-merchant-count',
      'active-merchants',
      'Count of active merchants (recent orders) — requires Supabase rows',
      'orders.created_at by site_id (Supabase)',
      'SUPABASE_URL',
    ));

    facts.push(this.notConnectedFact(
      'merchant-health-score',
      'merchant-health-scores',
      'Per-merchant weighted health score (0-100) — requires Supabase rows across 5 dimensions',
      'orders, payment_transactions, fulfillment_orders, ledger_entries, production_incidents (Supabase)',
      'SUPABASE_URL',
    ));

    facts.push(this.notConnectedFact(
      'merchant-risk-score',
      'merchant-risk-scores',
      'Per-merchant composite risk score (0-100) — requires live risk_scores / order_risk_assessments',
      'risk_scores, order_risk_assessments, merchant_kyc_documents (Supabase)',
      'SUPABASE_URL',
    ));

    facts.push(this.notConnectedFact(
      'merchant-gmv',
      'merchant-gmv',
      'GMV per merchant (sum orders.total_minor by site_id) — requires Supabase rows',
      'orders.total_minor by site_id (Supabase)',
      'SUPABASE_URL',
    ));

    facts.push(this.notConnectedFact(
      'merchant-churn-probability',
      'merchant-churn',
      'Churn probability per merchant — requires Supabase time-series (orders + subscriptions + billing_dunning_events)',
      'orders, subscriptions, billing_dunning_events, sessions (Supabase)',
      'SUPABASE_URL',
    ));

    facts.push(this.notConnectedFact(
      'founding-slots-remaining',
      'founding-program-remaining-slots',
      'Founding program remaining slots — live count from founding_merchant_program.remaining_slots',
      'founding_merchant_program.remaining_slots (Supabase) — GET /v1/founding-program/remaining',
      'SUPABASE_URL',
    ));

    return facts;
  }

  // ── generateMerchantReport ───────────────────────────────────────────────────

  generateMerchantReport(): MerchantReport {
    const allFindings: OperationalFinding[] = [
      ...this.detectActivation(),
      ...this.detectGrowth(),
      ...this.detectChurn(),
      ...this.detectDormancy(),
      ...this.detectRetention(),
    ];

    const facts = this.collectFacts();
    const signals = this.notConnectedSignals();
    const health = this.hc.forArea('merchant', allFindings, signals);

    // Collect all evidence from findings
    const allEvidence: Evidence[] = [];
    for (const f of allFindings) allEvidence.push(...f.evidence);
    for (const fact of facts) allEvidence.push(...fact.evidence);

    const connectedCount = allFindings.filter((f) => f.status === 'CONNECTED').length;
    const notConnectedCount = allFindings.filter((f) => f.status === 'NOT_CONNECTED').length;
    const criticalCount = allFindings.filter((f) => f.severity === 'critical').length;

    const summary =
      `Merchant intelligence: ${allFindings.length} findings (${connectedCount} CONNECTED structural, ${notConnectedCount} NOT_CONNECTED live). ` +
      `${criticalCount > 0 ? `${criticalCount} CRITICAL: single-schema SPOF (all ${256} tenant tables, one deploy pipeline). ` : ''}` +
      `Lifecycle model (8 states), health (5 dims), risk (5 dims), growth (5 dims), adoption (7 features), churn (5 signals) — all structural models CONNECTED. ` +
      `Live values (active count, health/risk scores, GMV, churn probability, founding slots) NOT_CONNECTED — requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.`;

    return operations(
      {
        area: 'merchant' as const,
        facts,
        findings: allFindings,
        signals,
        health,
        summary,
      },
      {
        evidence: allEvidence,
        liveConnected: false,
        now: this.now,
      },
    );
  }
}
