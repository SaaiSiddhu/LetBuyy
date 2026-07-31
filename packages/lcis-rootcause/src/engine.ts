/**
 * RootCauseEngine — the LRAS composition facade. diagnose(text) runs the deterministic
 * pipeline: classify → affected (twin) → structural signals → recent changes (LCTS) →
 * hypotheses (RC01..RC08) → owners → remediation (EINS) → verdict. Pure composition.
 *
 * Anti-hallucination: zero surviving hypotheses → verdict UNKNOWN with the exact missing
 * signals named; a taxonomy miss is an UNKNOWN symptom, never a guessed one.
 */
import { type LcisEngine, evidence, getEngine, notConnected } from '@letbuyy/lcis-core';
import { AffectedService } from './affected/index';
import { AttributionService } from './attribution/index';
import { ChangeCorrelationService } from './correlation/index';
import { HypothesisService } from './hypothesis/index';
import { RemediationService } from './remediation/index';
import {
  defaultNow,
  rootcause,
  type CauseHypothesis,
  type Diagnosis,
  type DiagnosisVerdict,
  type HypothesisInput,
  type Symptom,
  type SymptomKind,
} from './shared/index';
import { SymptomService } from './symptom/index';

export interface RootCauseEngine {
  readonly core: LcisEngine;
  readonly symptom: SymptomService;
  readonly affected: AffectedService;
  readonly correlation: ChangeCorrelationService;
  readonly hypothesis: HypothesisService;
  readonly attribution: AttributionService;
  readonly remediation: RemediationService;
  diagnose(symptomText: string): Diagnosis;
}

export interface RootCauseEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

/** Fixed, deterministic map: symptom kind → the live signals that would sharpen the diagnosis. */
const KIND_SIGNALS: Readonly<Record<SymptomKind, readonly { signal: string; source: string }[]>> = {
  'orders-failing': [
    { signal: 'money.razorpay-status', source: 'razorpay adapter (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)' },
    { signal: 'db.engine-health', source: 'postgres adapter (SUPABASE_MGMT_TOKEN, SUPABASE_PROJECT_REF)' },
  ],
  'checkout-broken': [
    { signal: 'money.razorpay-status', source: 'razorpay adapter (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)' },
    { signal: 'realtime.health', source: 'realtime adapter (SUPABASE_URL, SUPABASE_ANON_KEY)' },
  ],
  'queue-backlog': [
    { signal: 'edge.queue-backlog', source: 'Cloudflare GraphQL Analytics API (POST-only — structurally unreachable via the GET boundary)' },
    { signal: 'edge.queue-detail', source: 'queues adapter (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)' },
  ],
  'high-latency': [
    { signal: 'edge.ae-values', source: 'Analytics Engine SQL API (POST /analytics_engine/sql — structurally unreachable via the GET boundary)' },
  ],
  'deployment-failed': [
    { signal: 'ci.workflows', source: 'github-actions adapter (GITHUB_TOKEN, GITHUB_REPOSITORY)' },
    { signal: 'deploy.vercel', source: 'vercel adapter (VERCEL_TOKEN)' },
  ],
  'worker-crashed': [
    { signal: 'edge.worker-detail', source: 'workers adapter (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)' },
    { signal: 'edge.cron-runs', source: 'Workers logs/analytics (POST-only — structurally unreachable via the GET boundary)' },
  ],
  unknown: [],
};

/** Fixed map: symptom kind → external providers on the affected path. */
const KIND_PROVIDERS: Readonly<Record<SymptomKind, readonly string[]>> = {
  'orders-failing': ['Razorpay'],
  'checkout-broken': ['Razorpay'],
  'queue-backlog': ['Cloudflare'],
  'high-latency': ['Cloudflare'],
  'deployment-failed': ['Cloudflare', 'Vercel'],
  'worker-crashed': ['Cloudflare'],
  unknown: [],
};

class RootCauseEngineImpl implements RootCauseEngine {
  readonly core: LcisEngine;
  readonly symptom: SymptomService;
  readonly affected: AffectedService;
  readonly correlation: ChangeCorrelationService;
  readonly hypothesis: HypothesisService;
  readonly attribution: AttributionService;
  readonly remediation: RemediationService;
  private readonly now: () => string;

  constructor(opts: RootCauseEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    const core = this.core;
    const now = this.now;
    this.symptom = new SymptomService();
    this.affected = new AffectedService(core, now);
    this.correlation = new ChangeCorrelationService(core, now);
    this.hypothesis = new HypothesisService();
    this.attribution = new AttributionService(core, now);
    this.remediation = new RemediationService(core, now);
  }

  diagnose(symptomText: string): Diagnosis {
    const symptom: Symptom = this.symptom.classify(symptomText);
    const affected = this.affected.affectedFrom(symptom);
    const structure = this.affected.structuralSignals(affected);
    const recentChanges = this.correlation.correlate(affected);

    const notConnectedSignals = [
      ...KIND_SIGNALS[symptom.kind],
      ...(recentChanges.connection === 'NOT_CONNECTED'
        ? [{ signal: 'change-timeline', source: 'graphify-out/memory-intel.json (run pnpm graph:memory)' }]
        : []),
    ];

    const input: HypothesisInput = {
      symptom,
      affected,
      recentChanges,
      structure,
      notConnectedSignals,
      externalProviders: KIND_PROVIDERS[symptom.kind],
    };

    const hypotheses: readonly CauseHypothesis[] =
      symptom.kind === 'unknown' ? [] : this.hypothesis.evaluate(input);

    const verdict: DiagnosisVerdict =
      symptom.kind === 'unknown' || hypotheses.length === 0
        ? 'UNKNOWN'
        : affected.systems.length === 0 || hypotheses.every((h) => h.connection === 'NOT_CONNECTED')
          ? 'PARTIAL'
          : 'DIAGNOSED';

    const likelyOwners = this.attribution.ownersFor(affected.domains);

    const topChange = hypotheses.find((h) => h.category === 'change');
    const firstChange = recentChanges.changes[0] ?? null;
    const recommendedRollback =
      topChange !== undefined && firstChange !== null
        ? this.remediation.rollbackFor(firstChange.subject, firstChange.kind)
        : topChange !== undefined && recentChanges.migrations.length > 0
          ? this.remediation.rollbackFor(recentChanges.migrations[0]!, 'migration')
          : null;

    const verificationPlan = symptom.kind === 'unknown' ? [] : this.remediation.verificationFor(symptom);

    const missingSignals = [
      ...(symptom.kind === 'unknown'
        ? [{ signal: 'symptom-taxonomy-match', source: 'SYMPTOM_TAXONOMY (packages/lcis-rootcause/src/shared/taxonomy.ts) — no term matched; refine the symptom text' }]
        : []),
      ...notConnectedSignals,
    ];

    const summary =
      `Diagnosis for "${symptomText}": ${verdict}. ` +
      (verdict === 'UNKNOWN'
        ? `No evidence-backed hypothesis could be formed — ${missingSignals.length} missing signal(s) named; nothing is guessed.`
        : `${hypotheses.length} evidence-backed hypothesis(es) — top: ${hypotheses[0]!.cause} ` +
          `(confidence ${hypotheses[0]!.confidence.toFixed(2)}). ${affected.systems.length} affected system(s), ` +
          `${recentChanges.changes.length} correlated change(s)` +
          (likelyOwners.length > 0 ? `, likely owner(s): ${likelyOwners.join(', ')}` : ', no owner resolved') +
          '.') +
      ' Live signals NOT_CONNECTED are named, never fabricated.';

    return rootcause(
      {
        symptom,
        verdict,
        hypotheses,
        affected,
        recentChanges,
        likelyOwners,
        recommendedRollback,
        verificationPlan,
        missingSignals,
        summary,
      },
      {
        evidence: [
          evidence('artifact-field', 'lcis-rootcause:pipeline', `classify→affected(${affected.systems.length})→changes(${recentChanges.changes.length})→hypotheses(${hypotheses.length})`, 'packages/lcis-rootcause'),
          ...notConnectedSignals.slice(0, 4).map((s) => notConnected(s.signal, s.source)),
        ],
        liveConnected: false,
        now: this.now,
      },
    );
  }
}

export function createRootCauseEngine(opts?: RootCauseEngineOptions): RootCauseEngine {
  return new RootCauseEngineImpl(opts);
}

let shared: RootCauseEngine | null = null;

/** Process-wide singleton LRAS engine. */
export function getRootCauseEngine(opts?: RootCauseEngineOptions): RootCauseEngine {
  if (shared === null) shared = createRootCauseEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetRootCauseEngine(): void {
  shared = null;
}
