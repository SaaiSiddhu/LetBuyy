/**
 * CustomerOperationsService — LCOS Phase 6.
 *
 * READ-ONLY. Observes/analyzes/reports customer operations from structural artifacts.
 * Never fetches, spawns, executes, writes, or mutates anything.
 *
 * HONESTY CONTRACT:
 *  - Journey structure (stages, tables, RPCs, routes, failure points) → CONNECTED
 *  - All live rates (conversion, traffic, abandonment, search, sessions) → NOT_CONNECTED
 *    value=null, confidence=0, requiresEnvVar named exactly
 *
 * Sources:
 *  - customer-intelligence.json (8 graph models)
 *  - customer-journey-intelligence.json (8-stage funnel)
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
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
  type CustomerReport,
  type OperationalFinding,
  type OperationalFact,
  type LiveSignal,
} from '../shared/index';

// ── Artifact shape types (narrow, read-only) ─────────────────────────────────

interface JourneyStage {
  stage: string;
  domains: string[];
  risk: string;
  money: boolean;
  routes: string[];
  tables: number;
  rpcs: number;
  externalDependencies: string[];
  failurePoints: string[];
  dropoffMetric: string;
}

interface JourneyIntelligence {
  summary: {
    stages: number;
    funnel: string[];
    criticalStages: string[];
    externalDependencies: string[];
    dropoffNote: string;
    generatedAt: string;
  };
  stages: JourneyStage[];
}

interface GraphEntry {
  metric: string;
  sources: string[];
  value: string;
  stages?: string[];
}

interface CustomerIntelligence {
  summary: {
    graphs: number;
    graphsBacked: number;
    liveDataNote: string;
    generatedAt: string;
  };
  graphs: {
    funnel: GraphEntry;
    conversion: GraphEntry;
    refund: GraphEntry;
    retention: GraphEntry;
    risk: GraphEntry;
    journey: GraphEntry;
    abandonment: GraphEntry;
    loyalty: GraphEntry;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const ARTIFACT_CUSTOMER = 'customer-intelligence';
const ARTIFACT_JOURNEY = 'customer-journey-intelligence';
const CF_AE_ENV = ['CF_ANALYTICS_API_TOKEN', 'CF_ACCOUNT_ID'] as const;
const SUPA_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

// ── Service ──────────────────────────────────────────────────────────────────

export class CustomerOperationsService {
  private readonly store: OperationsArtifactStore;
  private readonly registry: LiveSignalRegistry;
  private readonly normalizer: TelemetryNormalizer;
  private readonly eb: OperationalEvidenceBuilder;
  private readonly severity: OperationalSeverityScorer;
  private readonly fb: OperationalFindingBuilder;
  private readonly health: OperationalHealthCalculator;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.store = new OperationsArtifactStore(core);
    this.registry = new LiveSignalRegistry();
    this.normalizer = new TelemetryNormalizer();
    this.eb = new OperationalEvidenceBuilder();
    this.severity = new OperationalSeverityScorer();
    this.fb = new OperationalFindingBuilder();
    this.health = new OperationalHealthCalculator();
  }

  // ── Private artifact readers (returns null when absent — honest) ────────────

  private journeyArtifact(): JourneyIntelligence | null {
    const raw = this.store.raw(ARTIFACT_JOURNEY) as JourneyIntelligence | null;
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  }

  private customerArtifact(): CustomerIntelligence | null {
    const raw = this.store.customer() as CustomerIntelligence | null;
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  }

  private stages(): readonly JourneyStage[] {
    return this.journeyArtifact()?.stages ?? [];
  }

  // ── Structural journey facts ───────────────────────────────────────────────

  private buildJourneyFacts(): readonly OperationalFact[] {
    const ji = this.journeyArtifact();
    if (!ji) return [];
    const facts: OperationalFact[] = [];

    // Top-level funnel fact
    facts.push(
      this.normalizer.fact('customer', 'journey-funnel', 'customer-journey', '8-stage funnel: Landing→Product→Cart→Checkout→Payment→Order→Tracking→Refund', {
        value: ji.summary.stages,
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(ARTIFACT_JOURNEY, 'summary.funnel', `funnel: ${ji.summary.funnel.join('→')}`),
        ],
      }),
    );

    // Critical stages fact
    facts.push(
      this.normalizer.fact('customer', 'critical-stages', 'customer-journey', `Critical stages (money+ledger): ${ji.summary.criticalStages.join(', ')}`, {
        value: ji.summary.criticalStages.join(', '),
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(ARTIFACT_JOURNEY, 'summary.criticalStages', ji.summary.criticalStages.join(', ')),
        ],
      }),
    );

    // Per-stage structural facts
    for (const s of ji.stages) {
      facts.push(
        this.normalizer.fact('customer', 'stage-topology', s.stage, `${s.tables} tables, ${s.rpcs} RPCs, risk=${s.risk}, money=${s.money}, externalDeps=${s.externalDependencies.length}`, {
          value: `tables:${s.tables} rpcs:${s.rpcs}`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(ARTIFACT_JOURNEY, `stages[${s.stage}]`, `tables=${s.tables} rpcs=${s.rpcs} risk=${s.risk} money=${s.money}`),
          ],
        }),
      );

      // Per-stage dropoff metric — NOT_CONNECTED (live analytics required)
      facts.push(
        this.normalizer.fact('customer', 'stage-dropoff', s.stage, s.dropoffMetric, {
          value: null,
          status: 'NOT_CONNECTED',
          evidence: [
            this.eb.notConnected(`${s.stage}.dropoff`, CF_AE_ENV[0]),
          ],
        }),
      );
    }

    return facts;
  }

  // ── Graph model facts (CONNECTED model, NOT_CONNECTED rates) ───────────────

  private buildGraphFacts(): readonly OperationalFact[] {
    const ci = this.customerArtifact();
    if (!ci) return [];
    const facts: OperationalFact[] = [];

    const graphs = ci.graphs;
    const graphEntries: Array<[string, GraphEntry]> = [
      ['funnel', graphs.funnel],
      ['conversion', graphs.conversion],
      ['refund', graphs.refund],
      ['retention', graphs.retention],
      ['risk', graphs.risk],
      ['journey', graphs.journey],
      ['abandonment', graphs.abandonment],
      ['loyalty', graphs.loyalty],
    ];

    for (const [key, g] of graphEntries) {
      // Structural model — CONNECTED
      facts.push(
        this.normalizer.fact('customer', 'graph-model', key, `${g.metric} — sources: ${g.sources.join(', ')}`, {
          value: g.sources.length,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(ARTIFACT_CUSTOMER, `graphs.${key}`, `metric: ${g.metric}`),
          ],
        }),
      );

      // Live rate — NOT_CONNECTED
      const isCloudflare = g.sources.includes('analytics_event_stream');
      const envVar = isCloudflare ? CF_AE_ENV[0] : SUPA_ENV[0];
      facts.push(
        this.normalizer.fact('customer', 'graph-rate', key, `${g.metric} rate — live-query-required (${g.sources[0]})`, {
          value: null,
          status: 'NOT_CONNECTED',
          evidence: [
            this.eb.notConnected(`${key}.rate`, envVar),
          ],
        }),
      );
    }

    return facts;
  }

  // ── Detect: Conversion Drops ───────────────────────────────────────────────

  detectConversionDrops(): OperationalFinding[] {
    const ci = this.customerArtifact();
    const ji = this.journeyArtifact();

    const findings: OperationalFinding[] = [];

    // Structural: model is present and can be queried when connected
    if (ci) {
      findings.push(
        this.fb.build({
          id: 'CONVERSION-MODEL-CONNECTED',
          area: 'customer',
          kind: 'conversion-model',
          severity: 'info',
          subject: 'conversion-funnel',
          title: 'Conversion funnel model is structurally CONNECTED',
          detail: `Sources: ${ci.graphs.conversion.sources.join(', ')}. Live rate requires ${SUPA_ENV[0]}.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(ARTIFACT_CUSTOMER, 'graphs.conversion', 'sessions→orders ratio model present'),
          ],
        }),
      );
    }

    // NOT_CONNECTED: actual conversion rate
    findings.push(
      this.fb.build({
        id: 'CONVERSION-RATE-NOT-CONNECTED',
        area: 'customer',
        kind: 'conversion-drop',
        severity: 'high',
        subject: 'session-to-order-rate',
        title: 'Session-to-order conversion rate NOT CONNECTED',
        detail: `Live conversion rate requires ${CF_AE_ENV[0]} (analytics_event_stream) or ${SUPA_ENV[0]} (sessions, checkout_sessions, orders). Rate=null until connected.`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('session-to-order-rate', CF_AE_ENV[0]),
          this.eb.notConnected('checkout_sessions.count', SUPA_ENV[0]),
        ],
      }),
    );

    // Payment stage: structural risk flag (CONNECTED — we know it's critical+money)
    if (ji) {
      const payStage = ji.stages.find((s) => s.stage === 'Payment');
      if (payStage) {
        findings.push(
          this.fb.build({
            id: 'CONVERSION-PAYMENT-STAGE-RISK',
            area: 'customer',
            kind: 'conversion-drop',
            severity: this.severity.forSignal({ money: true }),
            subject: 'Payment',
            title: 'Payment stage is critical money risk — highest RPC count (25)',
            detail: `Failure points: ${payStage.failurePoints.join('; ')}. External: ${payStage.externalDependencies.join(', ')}.`,
            status: 'CONNECTED',
            evidence: [
              this.eb.artifact(ARTIFACT_JOURNEY, 'stages[Payment]', `tables=${payStage.tables} rpcs=${payStage.rpcs}`),
            ],
          }),
        );
      }
    }

    return findings;
  }

  // ── Detect: Traffic Anomalies ─────────────────────────────────────────────

  detectTrafficAnomalies(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // Structural: Landing stage is the traffic entry point
    const ji = this.journeyArtifact();
    if (ji) {
      const landing = ji.stages.find((s) => s.stage === 'Landing');
      if (landing) {
        findings.push(
          this.fb.build({
            id: 'TRAFFIC-LANDING-TOPOLOGY',
            area: 'customer',
            kind: 'traffic-topology',
            severity: 'info',
            subject: 'Landing',
            title: 'Traffic entry point (Landing stage) structurally modeled',
            detail: `${landing.tables} tables, ${landing.rpcs} RPCs, routes: ${landing.routes.slice(0, 4).join(', ')}…, external: ${landing.externalDependencies.join(', ')}.`,
            status: 'CONNECTED',
            evidence: [
              this.eb.artifact(ARTIFACT_JOURNEY, 'stages[Landing]', `tables=${landing.tables} rpcs=${landing.rpcs}`),
            ],
          }),
        );

        // CDN/Vercel dependency — structural risk
        if (landing.externalDependencies.includes('CDN/Vercel')) {
          findings.push(
            this.fb.build({
              id: 'TRAFFIC-CDN-SPOF',
              area: 'customer',
              kind: 'traffic-spof',
              severity: this.severity.forSignal({ spof: true }),
              subject: 'CDN/Vercel',
              title: 'CDN/Vercel is a single external dependency for the Landing stage',
              detail: 'If CDN/Vercel is unavailable, the entire traffic entry point fails. Live availability is NOT_CONNECTED.',
              status: 'CONNECTED',
              evidence: [
                this.eb.artifact(ARTIFACT_JOURNEY, 'stages[Landing].externalDependencies', 'CDN/Vercel'),
              ],
            }),
          );
        }
      }
    }

    // NOT_CONNECTED: live traffic/session counts
    findings.push(
      this.fb.build({
        id: 'TRAFFIC-SESSIONS-NOT-CONNECTED',
        area: 'customer',
        kind: 'traffic-anomaly',
        severity: 'medium',
        subject: 'analytics_event_stream',
        title: 'Live traffic / session counts NOT CONNECTED',
        detail: `Requires ${CF_AE_ENV[0]} + ${CF_AE_ENV[1]} (Cloudflare Analytics Engine — analytics_event_stream). Value=null.`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('analytics_event_stream.sessions', CF_AE_ENV[0]),
          this.eb.notConnected('CF_ACCOUNT_ID', CF_AE_ENV[1]),
        ],
      }),
    );

    return findings;
  }

  // ── Detect: Search Failures ───────────────────────────────────────────────

  detectSearchFailures(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // Structural: SEARCH_QUEUE is modeled at Product stage
    const ji = this.journeyArtifact();
    if (ji) {
      const product = ji.stages.find((s) => s.stage === 'Product');
      if (product) {
        findings.push(
          this.fb.build({
            id: 'SEARCH-QUEUE-DEPENDENCY',
            area: 'customer',
            kind: 'search-dependency',
            severity: 'medium',
            subject: 'SEARCH_QUEUE',
            title: 'SEARCH_QUEUE is a structural external dependency at the Product stage',
            detail: `Product stage: ${product.tables} tables, ${product.rpcs} RPCs. Failure point: ${product.failurePoints.join('; ')}. Routes: ${product.routes.join(', ')}.`,
            status: 'CONNECTED',
            evidence: [
              this.eb.artifact(ARTIFACT_JOURNEY, 'stages[Product].externalDependencies', 'SEARCH_QUEUE'),
            ],
          }),
        );
      }
    }

    // NOT_CONNECTED: live search error telemetry
    findings.push(
      this.fb.build({
        id: 'SEARCH-TELEMETRY-NOT-CONNECTED',
        area: 'customer',
        kind: 'search-failure',
        severity: 'medium',
        subject: 'search-telemetry',
        title: 'Search failure telemetry NOT CONNECTED — no search telemetry adapter modeled',
        detail: `Search telemetry (query error rate, zero-result rate) is not modeled in the customer-intelligence artifact. Live values would require ${CF_AE_ENV[0]} or ${SUPA_ENV[0]}.`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('search.error-rate', CF_AE_ENV[0]),
          this.eb.notConnected('search.zero-result-rate', SUPA_ENV[0]),
        ],
      }),
    );

    return findings;
  }

  // ── Detect: Session Anomalies ─────────────────────────────────────────────

  detectSessionAnomalies(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // Structural: session-scoped model exists across multiple stages
    const ci = this.customerArtifact();
    if (ci) {
      findings.push(
        this.fb.build({
          id: 'SESSION-MODEL-CONNECTED',
          area: 'customer',
          kind: 'session-topology',
          severity: 'info',
          subject: 'sessions',
          title: 'Session model CONNECTED — sessions + checkout_sessions span the funnel',
          detail: `Conversion graph sources: ${ci.graphs.conversion.sources.join(', ')}.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(ARTIFACT_CUSTOMER, 'graphs.conversion.sources', 'sessions, checkout_sessions, orders, store_customers'),
          ],
        }),
      );
    }

    // NOT_CONNECTED: live session anomaly detection
    findings.push(
      this.fb.build({
        id: 'SESSION-ANOMALY-NOT-CONNECTED',
        area: 'customer',
        kind: 'session-anomaly',
        severity: 'medium',
        subject: 'sessions',
        title: 'Live session anomaly detection NOT CONNECTED',
        detail: `Session counts, duration, bounce rates require ${SUPA_ENV[0]} (sessions table) or ${CF_AE_ENV[0]} (analytics_event_stream). Value=null.`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('sessions.count', SUPA_ENV[0]),
          this.eb.notConnected('analytics_event_stream.session-duration', CF_AE_ENV[0]),
        ],
      }),
    );

    // Risk: checkout_sessions → risk scoring pipeline
    findings.push(
      this.fb.build({
        id: 'SESSION-RISK-MODEL-CONNECTED',
        area: 'customer',
        kind: 'session-risk',
        severity: 'info',
        subject: 'risk-scores',
        title: 'Customer risk model structurally CONNECTED (per-order, not per-account)',
        detail: 'Sources: order_risk_assessments, risk_scores, risk_signals. Live scores require Supabase.',
        status: 'CONNECTED',
        evidence: [
          this.eb.artifact(ARTIFACT_CUSTOMER, 'graphs.risk.sources', 'order_risk_assessments, risk_scores, risk_signals'),
        ],
      }),
    );

    return findings;
  }

  // ── Detect: Abandonment ───────────────────────────────────────────────────

  detectAbandonment(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];
    const ci = this.customerArtifact();

    // Structural: abandonment graph model is CONNECTED
    if (ci) {
      findings.push(
        this.fb.build({
          id: 'ABANDONMENT-MODEL-CONNECTED',
          area: 'customer',
          kind: 'abandonment-model',
          severity: 'info',
          subject: 'abandonment-graph',
          title: 'Abandonment graph model CONNECTED — carts + checkout_sessions + wishlists',
          detail: `Sources: ${ci.graphs.abandonment.sources.join(', ')}. Metric: ${ci.graphs.abandonment.metric}.`,
          status: 'CONNECTED',
          evidence: [
            this.eb.artifact(ARTIFACT_CUSTOMER, 'graphs.abandonment', 'carts/checkouts not converted'),
          ],
        }),
      );
    }

    // NOT_CONNECTED: live cart abandonment rate
    findings.push(
      this.fb.build({
        id: 'ABANDONMENT-CART-RATE-NOT-CONNECTED',
        area: 'customer',
        kind: 'abandonment-rate',
        severity: 'high',
        subject: 'carts',
        title: 'Cart abandonment rate NOT CONNECTED',
        detail: `Requires ${SUPA_ENV[0]} (carts not converted to checkout_sessions). No cart abandonment recovery system is implemented. Value=null.`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('carts.abandonment-rate', SUPA_ENV[0]),
        ],
      }),
    );

    // NOT_CONNECTED: live checkout abandonment rate
    findings.push(
      this.fb.build({
        id: 'ABANDONMENT-CHECKOUT-RATE-NOT-CONNECTED',
        area: 'customer',
        kind: 'abandonment-rate',
        severity: 'high',
        subject: 'checkout_sessions',
        title: 'Checkout abandonment rate NOT CONNECTED',
        detail: `Requires ${SUPA_ENV[0]} (checkout_sessions not converted to orders). Value=null.`,
        status: 'NOT_CONNECTED',
        evidence: [
          this.eb.notConnected('checkout_sessions.abandonment-rate', SUPA_ENV[0]),
        ],
      }),
    );

    // Structural: Checkout stage multi-domain complexity (structural risk for abandonment)
    const ji = this.journeyArtifact();
    if (ji) {
      const checkout = ji.stages.find((s) => s.stage === 'Checkout');
      if (checkout) {
        findings.push(
          this.fb.build({
            id: 'ABANDONMENT-CHECKOUT-COMPLEXITY',
            area: 'customer',
            kind: 'abandonment-risk',
            severity: this.severity.forSignal({ money: true }),
            subject: 'Checkout',
            title: 'Checkout stage has highest structural complexity — elevated abandonment risk',
            detail: `${checkout.tables} tables, ${checkout.rpcs} RPCs across domains: ${checkout.domains.join(', ')}. Failure points: ${checkout.failurePoints.join('; ')}.`,
            status: 'CONNECTED',
            evidence: [
              this.eb.artifact(ARTIFACT_JOURNEY, 'stages[Checkout]', `tables=${checkout.tables} rpcs=${checkout.rpcs} risk=${checkout.risk}`),
            ],
          }),
        );
      }
    }

    return findings;
  }

  // ── Generate customer report ──────────────────────────────────────────────

  generateCustomerReport(): CustomerReport {
    const journeyFacts = this.buildJourneyFacts();
    const graphFacts = this.buildGraphFacts();
    const allFacts: readonly OperationalFact[] = [...journeyFacts, ...graphFacts];

    const allFindings: OperationalFinding[] = [
      ...this.detectConversionDrops(),
      ...this.detectTrafficAnomalies(),
      ...this.detectSearchFailures(),
      ...this.detectSessionAnomalies(),
      ...this.detectAbandonment(),
    ];

    // Signals: all customer-area signals from the registry
    const customerSignals = this.registry.byArea('customer');
    const signals: LiveSignal[] = customerSignals.map((sig) => {
      const ev = sig.detectability === 'NOT_CONNECTED'
        ? [this.eb.notConnected(sig.key, sig.requiresEnvVar[0] ?? 'unknown')]
        : [this.eb.artifact(sig.dataSource, sig.key, sig.label)];
      return this.normalizer.signalToLive(sig, ev);
    });

    const healthResult = this.health.forArea('customer', allFindings, signals);

    // Collect all evidence for the envelope
    const allEvidence = [
      ...allFacts.flatMap((f) => [...f.evidence]),
      ...allFindings.flatMap((f) => [...f.evidence]),
    ];

    // Structural summary
    const ji = this.journeyArtifact();
    const ci = this.customerArtifact();
    const stageCount = ji?.summary.stages ?? 0;
    const criticalStages = ji?.summary.criticalStages.join(', ') ?? 'unknown';
    const graphCount = ci?.summary.graphsBacked ?? 0;
    const connectedFindings = allFindings.filter((f) => f.status === 'CONNECTED').length;
    const notConnectedFindings = allFindings.filter((f) => f.status === 'NOT_CONNECTED').length;

    const summary =
      `Customer operations: ${stageCount}-stage journey (critical: ${criticalStages}), ` +
      `${graphCount} intelligence graphs structurally CONNECTED. ` +
      `${connectedFindings} structural findings, ${notConnectedFindings} NOT_CONNECTED (live rates require CF_ANALYTICS_API_TOKEN or SUPABASE_URL). ` +
      `Health: ${healthResult.band} (live signals not connected — values null until adapters credentialed).`;

    const body = {
      area: 'customer' as const,
      facts: allFacts,
      findings: allFindings,
      signals,
      health: healthResult,
      summary,
    };

    const stamped = operations(body, {
      evidence: allEvidence,
      liveConnected: false,
      now: this.now,
    });

    return stamped as unknown as CustomerReport;
  }
}
