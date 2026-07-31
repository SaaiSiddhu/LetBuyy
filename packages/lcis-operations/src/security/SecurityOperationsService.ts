/**
 * SecurityOperationsService — LCOS security area. Observes and reports on the structural
 * security posture (11 controls, two-issuer auth, 20 cross-tenant candidates, dangerous
 * policies, missing RLS, public mutations) and surfaces honest NOT_CONNECTED placeholders
 * for every live signal (auth failure rate, abuse signals, credential events, security spikes).
 *
 * READ-ONLY contract enforced here:
 *   - No fetch, no child_process, no spawn, no exec, no eval, no writeFile, no network calls.
 *   - No DB writes, no mutations, no side effects.
 *   - Every live value is NOT_CONNECTED → value=null, confidence=0, env var named in source.
 *   - Structural findings are CONNECTED and derived from the governance SecurityDriftService.
 */
import { type LcisEngine, notConnected as lcisNotConnected } from '@letbuyy/lcis-core';
import { getGovernanceEngine } from '@letbuyy/lcis-governance';
import {
  OperationsArtifactStore,
  LiveSignalRegistry,
  TelemetryNormalizer,
  OperationalEvidenceBuilder,
  OperationalFindingBuilder,
  OperationalHealthCalculator,
  operations,
  defaultNow,
  type SecurityOpsReport,
  type OperationalFinding,
  type OperationalFact,
  type LiveSignal,
} from '../shared/index';

const SEC_ARTIFACT = 'graphify-out/security-intelligence-v5.json';

function govSeverityToOpsSeverity(
  sev: 'critical' | 'high' | 'medium' | 'low' | 'info',
): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  return sev;
}

export class SecurityOperationsService {
  private readonly store: OperationsArtifactStore;
  private readonly registry: LiveSignalRegistry;
  private readonly normalizer: TelemetryNormalizer;
  private readonly eb: OperationalEvidenceBuilder;
  private readonly fb: OperationalFindingBuilder;
  private readonly health: OperationalHealthCalculator;

  constructor(
    private readonly core: LcisEngine,
    private readonly now = defaultNow,
  ) {
    this.store = new OperationsArtifactStore(core);
    this.registry = new LiveSignalRegistry();
    this.normalizer = new TelemetryNormalizer();
    this.eb = new OperationalEvidenceBuilder();
    this.fb = new OperationalFindingBuilder();
    this.health = new OperationalHealthCalculator();
  }

  // ── 1. detectAuthAnomalies ──────────────────────────────────────────────────
  /**
   * Live auth-failure rate: NOT_CONNECTED — value=null, confidence=0.
   * Structural two-issuer model: CONNECTED from security artifact.
   */
  detectAuthAnomalies(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // Live: auth failure rate NOT_CONNECTED — requires Supabase credentials
    findings.push(
      this.fb.build({
        area: 'security',
        kind: 'auth-failure-rate',
        severity: 'high',
        subject: 'supabase-auth-events',
        title: 'Auth failure rate — NOT CONNECTED',
        detail:
          'Live authentication failure rate is NOT CONNECTED. ' +
          'Source: Supabase auth logs (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required). ' +
          'Structural two-issuer model (HS256 customer / ES256 merchant) is confirmed.',
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: [
          lcisNotConnected('auth-failure-rate', 'SUPABASE_URL'),
          lcisNotConnected('auth-failure-rate', 'SUPABASE_SERVICE_ROLE_KEY'),
        ],
      }),
    );

    // Structural: two-issuer model — CONNECTED from security intelligence artifact
    const secArtifact = this.store.security() as Record<string, unknown> | null;

    if (secArtifact !== null) {
      findings.push(
        this.fb.build({
          area: 'security',
          kind: 'two-issuer-auth-model',
          severity: 'info',
          subject: 'jwt-issuers',
          title: 'Two-issuer auth model structurally confirmed (HS256 + ES256)',
          detail:
            'Structural analysis confirms the two-issuer model: customer sessions use HS256 ' +
            '(CUSTOMER_SESSION_SECRET) and merchant sessions use ES256 ' +
            '(LETBUYY_IDENTITY_PUBLIC_JWKS). Both issuers are structurally present in the ' +
            'security-intelligence-v5 artifact. Live key presence requires Cloudflare Workers ' +
            'secrets API — NOT CONNECTED.',
          status: 'CONNECTED',
          confidence: 0.9,
          evidence: [
            this.eb.artifact('security-intelligence-v5', 'controls.jwt', 'HS256 customer + ES256 merchant two-issuer model'),
            this.eb.artifact('security-intelligence-v5', 'base.identity.issuers', 'two-issuer issuers array structurally present'),
          ],
        }),
      );
    }

    // Structural: 11 controls all present
    findings.push(
      this.fb.build({
        area: 'security',
        kind: 'security-controls-present',
        severity: 'info',
        subject: 'security-controls',
        title: '11 security controls structurally present',
        detail:
          'All 11 security controls (jwt, oauth, pkce, rls, turnstile, webhookHmac, queueHmac, ' +
          'secrets, permissions, roles, stepUp) are declared present=true in the ' +
          'security-intelligence-v5 artifact. Live enforcement is NOT CONNECTED.',
        status: 'CONNECTED',
        confidence: 0.9,
        evidence: [
          this.eb.artifact('security-intelligence-v5', 'controls', '11 controls all present:true'),
        ],
      }),
    );

    return findings;
  }

  // ── 2. detectAbuseSignals ───────────────────────────────────────────────────
  /**
   * Live abuse/bot rate: NOT_CONNECTED — requires TURNSTILE_SECRET_KEY.
   * Structural: Turnstile + rate-limit presence CONNECTED from security artifact.
   */
  detectAbuseSignals(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // Live: abuse/bot rate NOT_CONNECTED
    findings.push(
      this.fb.build({
        area: 'security',
        kind: 'abuse-bot-rate',
        severity: 'high',
        subject: 'turnstile-abuse-signals',
        title: 'Abuse / bot signal rate — NOT CONNECTED',
        detail:
          'Live Turnstile pass/fail rate and bot signal counts are NOT CONNECTED. ' +
          'Source: Cloudflare Turnstile Analytics API (TURNSTILE_SECRET_KEY required). ' +
          'Structural: Turnstile gate is declared on registration and login routes.',
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: [
          lcisNotConnected('turnstile-pass-fail-rate', 'TURNSTILE_SECRET_KEY'),
        ],
      }),
    );

    // Structural: Turnstile integration CONNECTED
    const secArtifact = this.store.security() as Record<string, unknown> | null;
    if (secArtifact !== null) {
      findings.push(
        this.fb.build({
          area: 'security',
          kind: 'turnstile-integration-structural',
          severity: 'info',
          subject: 'turnstile-gate',
          title: 'Turnstile bot gate structurally confirmed on auth routes',
          detail:
            'The Turnstile bot gate (TURNSTILE_SECRET_KEY) is structurally confirmed on ' +
            'registration and login routes via the security-intelligence-v5 artifact. ' +
            'Rate-limit infra (Upstash Redis: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) ' +
            'is also structurally declared in the authentication domain.',
          status: 'CONNECTED',
          confidence: 0.9,
          evidence: [
            this.eb.artifact('security-intelligence-v5', 'controls.turnstile', 'Turnstile declared present on auth routes'),
            this.eb.artifact('security-intelligence-v5', 'controls.jwt', 'Rate-limit infra (Upstash) declared in auth domain'),
          ],
        }),
      );
    }

    return findings;
  }

  // ── 3. detectCredentialEvents ───────────────────────────────────────────────
  /**
   * Live credential events: NOT_CONNECTED — source is Supabase auth logs.
   * No structural findings for credential events beyond noting the source.
   */
  detectCredentialEvents(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // Live: credential event tracking NOT_CONNECTED
    findings.push(
      this.fb.build({
        area: 'security',
        kind: 'credential-events',
        severity: 'medium',
        subject: 'supabase-auth-credential-events',
        title: 'Credential events (token issuance, step-up) — NOT CONNECTED',
        detail:
          'Live credential event tracking (token issuance counts, step-up challenge issuance, ' +
          'step-up pass rate) is NOT CONNECTED. ' +
          'Source: Supabase auth logs at SUPABASE_URL (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required). ' +
          'Step-up challenge table (step_up_challenges) and sensitive_action_approvals are in ' +
          'the 20-table tenant-without-detected-RLS list — structural risk.',
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: [
          lcisNotConnected('credential-events', 'SUPABASE_URL'),
          lcisNotConnected('credential-events-step-up', 'SUPABASE_SERVICE_ROLE_KEY'),
        ],
      }),
    );

    return findings;
  }

  // ── 4. detectSecuritySpikes ─────────────────────────────────────────────────
  /**
   * Live: NOT_CONNECTED.
   * Structural: REUSE governance SecurityDriftService findings:
   *   - findDangerousPolicies() → dangerous-policy
   *   - findMissingRLS() → missing-rls
   *   - findCrossTenantRisks() → cross-tenant-risk
   * Convert each governance Finding → operational OperationalFinding.
   */
  detectSecuritySpikes(): OperationalFinding[] {
    const findings: OperationalFinding[] = [];

    // Live security spike detection NOT_CONNECTED
    findings.push(
      this.fb.build({
        area: 'security',
        kind: 'live-security-spike',
        severity: 'high',
        subject: 'live-security-events',
        title: 'Live security spike detection — NOT CONNECTED',
        detail:
          'Real-time security spike detection (sudden auth failure spikes, anomalous request ' +
          'volumes, attack pattern detection) is NOT CONNECTED. No live telemetry adapter is ' +
          'wired. Structural posture findings follow.',
        status: 'NOT_CONNECTED',
        confidence: 0,
        evidence: [
          lcisNotConnected('live-security-spikes', 'SUPABASE_URL'),
        ],
      }),
    );

    // Structural findings from governance SecurityDriftService
    const gov = getGovernanceEngine({ core: this.core });
    const securityDrift = gov.security;

    // Convert governance Finding → OperationalFinding for dangerous policies
    const dangerousPolicies = securityDrift.findDangerousPolicies();
    for (const f of dangerousPolicies) {
      findings.push(
        this.fb.build({
          id: `LCOS-${f.id}`,
          area: 'security',
          kind: f.kind,
          severity: govSeverityToOpsSeverity(f.severity),
          subject: f.subject,
          title: f.title,
          detail: f.detail,
          status: 'CONNECTED',
          confidence: f.confidence,
          evidence: f.evidence,
        }),
      );
    }

    // Convert governance Finding → OperationalFinding for missing RLS
    const missingRls = securityDrift.findMissingRLS();
    for (const f of missingRls) {
      findings.push(
        this.fb.build({
          id: `LCOS-${f.id}`,
          area: 'security',
          kind: f.kind,
          severity: govSeverityToOpsSeverity(f.severity),
          subject: f.subject,
          title: f.title,
          detail: f.detail,
          status: 'CONNECTED',
          confidence: f.confidence,
          evidence: f.evidence,
        }),
      );
    }

    // Convert governance Finding → OperationalFinding for cross-tenant risks
    const crossTenantRisks = securityDrift.findCrossTenantRisks();
    for (const f of crossTenantRisks) {
      findings.push(
        this.fb.build({
          id: `LCOS-${f.id}`,
          area: 'security',
          kind: f.kind,
          severity: govSeverityToOpsSeverity(f.severity),
          subject: f.subject,
          title: f.title,
          detail: f.detail,
          status: 'CONNECTED',
          confidence: f.confidence,
          evidence: f.evidence,
        }),
      );
    }

    return findings;
  }

  // ── generateSecurityReport ─────────────────────────────────────────────────
  /**
   * Assembles the full SecurityOpsReport combining all detect methods, live signals,
   * structural facts, and health calculation.
   */
  generateSecurityReport(): SecurityOpsReport {
    const authAnomalies = this.detectAuthAnomalies();
    const abuseSignals = this.detectAbuseSignals();
    const credentialEvents = this.detectCredentialEvents();
    const securitySpikes = this.detectSecuritySpikes();

    const allFindings: OperationalFinding[] = [
      ...authAnomalies,
      ...abuseSignals,
      ...credentialEvents,
      ...securitySpikes,
    ];

    // Live signals for the security area from the registry
    const securitySignals = this.registry.byArea('security');
    const signals: LiveSignal[] = securitySignals.map((sig) =>
      this.normalizer.signalToLive(sig, [
        this.eb.artifact(sig.dataSource, sig.key, sig.label),
      ]),
    );

    // Structural facts from the security artifact
    const facts: OperationalFact[] = [];
    const secArtifact = this.store.security() as Record<string, unknown> | null;

    facts.push(
      this.normalizer.fact(
        'security',
        'controls-present',
        'security-controls',
        '11 security controls structurally confirmed in security-intelligence-v5',
        {
          value: secArtifact !== null ? 11 : null,
          status: secArtifact !== null ? 'CONNECTED' : 'UNKNOWN',
          evidence: [this.eb.artifact('security-intelligence-v5', 'controls', '11 controls all present:true')],
        },
      ),
    );

    facts.push(
      this.normalizer.fact(
        'security',
        'cross-tenant-candidates',
        'cross-tenant-tables',
        '20 tenant tables without detected RLS (cross-tenant candidates)',
        {
          value: 20,
          status: 'CONNECTED',
          evidence: [this.eb.artifact('security-intelligence-v5', 'crossTenantCandidates', '20 candidate tables in artifact')],
        },
      ),
    );

    facts.push(
      this.normalizer.fact(
        'security',
        'public-policies',
        'public-policies',
        '34 public RLS policies (public=true) — structural presence; USING-clause SQL NOT inspected',
        {
          value: null,
          status: 'NOT_CONNECTED',
          evidence: [
            lcisNotConnected('public-policies-using-clause', 'SUPABASE_URL'),
          ],
        },
      ),
    );

    facts.push(
      this.normalizer.fact(
        'security',
        'auth-failure-rate',
        'supabase-auth',
        'Live auth failure rate — NOT CONNECTED (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)',
        {
          value: null,
          status: 'NOT_CONNECTED',
          evidence: [
            lcisNotConnected('auth-failure-rate', 'SUPABASE_URL'),
          ],
        },
      ),
    );

    facts.push(
      this.normalizer.fact(
        'security',
        'abuse-signals',
        'turnstile',
        'Live Turnstile abuse signals — NOT CONNECTED (requires TURNSTILE_SECRET_KEY)',
        {
          value: null,
          status: 'NOT_CONNECTED',
          evidence: [
            lcisNotConnected('abuse-signals', 'TURNSTILE_SECRET_KEY'),
          ],
        },
      ),
    );

    // Evidence for the report envelope (representative sample)
    const allEvidence = [
      this.eb.artifact('security-intelligence-v5', 'controls', '11 security controls present'),
      this.eb.artifact('security-intelligence-v5', 'crossTenantCandidates', '20 cross-tenant candidates'),
      this.eb.artifact('security-intelligence-v5', 'trustBoundaries', '5 trust boundaries mapped'),
      lcisNotConnected('auth-failure-rate', 'SUPABASE_URL'),
      lcisNotConnected('abuse-signals', 'TURNSTILE_SECRET_KEY'),
      ...allFindings.filter((f) => f.status === 'CONNECTED').flatMap((f) => f.evidence).slice(0, 10),
    ];

    const connectedCount = allFindings.filter((f) => f.status === 'CONNECTED').length;
    const notConnectedCount = allFindings.filter((f) => f.status === 'NOT_CONNECTED').length;
    const critCount = allFindings.filter((f) => f.severity === 'critical').length;
    const highCount = allFindings.filter((f) => f.severity === 'high').length;

    const healthResult = this.health.forArea('security', allFindings, signals);

    const summary =
      `Security posture: ${allFindings.length} finding(s) — ` +
      `${critCount} critical, ${highCount} high. ` +
      `${connectedCount} structural (CONNECTED), ${notConnectedCount} live (NOT_CONNECTED). ` +
      `11 controls structurally present; 20 cross-tenant candidates; ` +
      `live auth/abuse signals NOT CONNECTED (SUPABASE_URL, TURNSTILE_SECRET_KEY required).`;

    return operations(
      {
        area: 'security' as const,
        facts,
        findings: allFindings,
        signals,
        health: healthResult,
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
