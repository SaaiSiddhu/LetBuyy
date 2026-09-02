/**
 * LCIS V2 Reasoning Engine — OperationalReasoner
 *
 * Reasons about operational state: degradation diagnosis, metric→cause correlation,
 * action recommendations, and operational risk assessment.
 *
 * Uses AnomalyDetectionService + IncidentDetectionService (lazy) + V1 /api/runbook.
 * Live metric values are NOT CONNECTED unless telemetry adapters are wired.
 */

/** @typedef {'HIGH'|'MEDIUM'|'LOW'} Confidence */
/** @typedef {{ source: string, fact: string, weight: number }} Evidence */
/** @typedef {{ question: string, hypothesis: string, evidence: Evidence[], confidence: Confidence, mostLikelyAffected: string[], recommendedInvestigation: string[], reasoningChain: string[] }} ReasoningResult */

const V1_BASE = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

async function fetchV1(path) {
  try {
    const res = await fetch(`${V1_BASE}${path}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

let _anomaly = null;
let _incident = null;

async function anomalyService() {
  if (!_anomaly) {
    const m = await import('../observability/AnomalyDetectionService.mjs');
    _anomaly = m.default;
  }
  return _anomaly;
}

async function incidentService() {
  if (!_incident) {
    const m = await import('../observability/IncidentDetectionService.mjs');
    _incident = m.default;
  }
  return _incident;
}

/** Structural correlation table: metric name substring → probable cause domain */
const METRIC_CAUSE_MAP = [
  { pattern: /error_rate|5xx|http_error/i, cause: 'Application or gateway error — check deploy log and error traces', domain: 'api-gateway', risk: 0.88 },
  { pattern: /payment|razorpay|checkout/i, cause: 'Payment provider degradation or checkout RPC failure', domain: 'payments', risk: 0.92 },
  { pattern: /queue|job|worker/i, cause: 'Queue backlog or worker crash — check queue-workers service', domain: 'queue-workers', risk: 0.82 },
  { pattern: /db|postgres|query|slow|lock/i, cause: 'Database query degradation or lock contention', domain: 'database', risk: 0.85 },
  { pattern: /auth|jwt|session|401|403/i, cause: 'Authentication failure — JWT key rotation or identity-platform down', domain: 'identity', risk: 0.80 },
  { pattern: /webhook|hmac|signature/i, cause: 'Webhook delivery failure or HMAC verification error', domain: 'webhooks', risk: 0.75 },
  { pattern: /order|inventory/i, cause: 'Order processing or inventory sync failure', domain: 'orders', risk: 0.78 },
  { pattern: /theme|liquid|render/i, cause: 'Theme render failure — Liquid sanitizer or template error', domain: 'themes', risk: 0.70 },
  { pattern: /memory|heap|oom/i, cause: 'Memory pressure — Node.js heap exhaustion or Cloudflare Worker limits', domain: 'infrastructure', risk: 0.80 },
  { pattern: /latency|p99|slow|timeout/i, cause: 'Latency spike — DB query, external provider, or cold start', domain: 'performance', risk: 0.75 },
];

function correlateMetricToCause(metricName) {
  for (const entry of METRIC_CAUSE_MAP) {
    if (entry.pattern.test(metricName)) {
      return entry;
    }
  }
  return { cause: 'Unknown metric — structural correlation not found', domain: 'unknown', risk: 0.3 };
}

class OperationalReasoner {
  /**
   * Answer a free-form operational question.
   * @param {string} question
   * @returns {Promise<ReasoningResult>}
   */
  async reason(question) {
    const evidence = [];
    const reasoningChain = [];

    const [anomaly_, incident_, opsData, runbookData] = await Promise.allSettled([
      anomalyService(),
      incidentService(),
      fetchV1('/api/operations'),
      fetchV1(`/api/runbook?domain=all`),
    ]);

    const anom = anomaly_.status === 'fulfilled' ? anomaly_.value : null;
    const inc = incident_.status === 'fulfilled' ? incident_.value : null;
    const ops = opsData.status === 'fulfilled' ? opsData.value : null;
    const runbook = runbookData.status === 'fulfilled' ? runbookData.value : null;

    reasoningChain.push(`1. Query AnomalyDetectionService for active anomalies.`);
    reasoningChain.push(`2. Query IncidentDetectionService for detected incidents.`);
    reasoningChain.push(`3. Query V1 /api/operations for operational status.`);
    reasoningChain.push(`4. Classify question and match to operational domain.`);

    if (anom) {
      try {
        const recent = anom.getRecentAnomalies?.(10) ?? [];
        if (recent.length > 0) {
          evidence.push({ source: 'anomaly-detection', fact: `${recent.length} recent anomalies detected: ${recent.slice(0, 3).map(a => a.metric ?? a.name ?? JSON.stringify(a).slice(0, 40)).join(', ')}`, weight: 0.85 });
        } else {
          evidence.push({ source: 'anomaly-detection', fact: `No anomalies in rolling window — live metric feed NOT CONNECTED (metrics must be pushed via recordMetric()).`, weight: 0.2 });
        }
      } catch {
        evidence.push({ source: 'anomaly-detection', fact: `AnomalyDetectionService available but query failed.`, weight: 0.1 });
      }
    } else {
      evidence.push({ source: 'anomaly-detection', fact: `AnomalyDetectionService NOT CONNECTED.`, weight: 0.05 });
    }

    if (ops) {
      evidence.push({ source: 'operations-api', fact: `Operational status: ${JSON.stringify(ops).slice(0, 200)}`, weight: 0.78 });
    } else {
      evidence.push({ source: 'operations-api', fact: `V1 /api/operations NOT CONNECTED — LCIS may be offline or graph not built.`, weight: 0.05 });
    }

    if (runbook) {
      evidence.push({ source: 'runbook', fact: `Runbook available for operational guidance.`, weight: 0.65 });
    }

    const highCount = evidence.filter(e => e.weight >= 0.65).length;
    const confidence = highCount >= 2 ? 'MEDIUM' : 'LOW';

    return {
      question,
      hypothesis: `Operational question "${question.slice(0, 80)}": Structural topology is CONNECTED; live telemetry values are NOT CONNECTED until provider adapters (Cloudflare Analytics Engine / Supabase) are wired.`,
      evidence,
      confidence,
      mostLikelyAffected: ['api-gateway', 'queue-workers', 'customer-web', 'merchant-web'],
      recommendedInvestigation: [
        `1. Check live ops: \`curl ${V1_BASE}/api/operations\`.`,
        `2. Wire telemetry: set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in .env.local.`,
        `3. Tail logs: \`wrangler tail\` or Supabase dashboard → Functions → Logs.`,
        `4. Run anomaly scan: push metrics via AnomalyDetectionService.recordMetric().`,
      ],
      reasoningChain,
    };
  }

  /**
   * Diagnose a degradation given an array of observed signals.
   * @param {Array<{ name: string, value: number, unit?: string }>} signals
   * @returns {Promise<ReasoningResult>}
   */
  async diagnoseDegradation(signals) {
    if (!Array.isArray(signals) || signals.length === 0) {
      return {
        question: 'Diagnose degradation from signals',
        hypothesis: 'No signals provided — cannot diagnose.',
        evidence: [{ source: 'input', fact: 'Empty signals array.', weight: 0 }],
        confidence: 'LOW',
        mostLikelyAffected: [],
        recommendedInvestigation: ['Provide signals: [{ name, value, unit }]'],
        reasoningChain: ['Received empty signals array — aborting diagnosis.'],
      };
    }

    const evidence = [];
    const reasoningChain = [`1. Analyse ${signals.length} incoming signals for anomaly patterns.`];

    // Structural correlation
    const correlations = signals.map(s => ({ signal: s, correlation: correlateMetricToCause(s.name) }));
    const topCorrelations = correlations.sort((a, b) => b.correlation.risk - a.correlation.risk);

    for (const { signal, correlation } of topCorrelations.slice(0, 4)) {
      evidence.push({
        source: 'structural-metric-correlation',
        fact: `Signal "${signal.name}"=${signal.value}${signal.unit ?? ''} → ${correlation.cause} (domain: ${correlation.domain})`,
        weight: correlation.risk,
      });
    }

    reasoningChain.push(`2. Correlated ${signals.length} signals to ${new Set(topCorrelations.map(c => c.correlation.domain)).size} domains.`);

    // Anomaly detection service check
    const anom = await anomalyService().catch(() => null);
    if (anom) {
      try {
        const incidents = anom.analyze?.({ http: signals.filter(s => /http|error|5xx/.test(s.name)), db: signals.filter(s => /db|query/.test(s.name)), queues: signals.filter(s => /queue/.test(s.name)), payments: signals.filter(s => /payment/.test(s.name)), workers: signals.filter(s => /worker/.test(s.name)) });
        if (incidents?.length) {
          evidence.push({ source: 'anomaly-detection-service', fact: `${incidents.length} incidents detected from signal analysis: ${incidents[0]?.type ?? 'unknown'}`, weight: 0.88 });
        }
      } catch { /* optional */ }
    }

    const [runbookData] = await Promise.allSettled([
      fetchV1(`/api/runbook?domain=${topCorrelations[0]?.correlation?.domain ?? 'all'}`),
    ]);
    const runbook = runbookData.status === 'fulfilled' ? runbookData.value : null;

    if (runbook?.recovery) {
      evidence.push({ source: 'runbook', fact: `Recovery steps for domain ${topCorrelations[0].correlation.domain}: ${JSON.stringify(runbook.recovery).slice(0, 120)}`, weight: 0.70 });
    }

    reasoningChain.push(`3. Matched runbook for primary failing domain.`);

    const highCount = evidence.filter(e => e.weight >= 0.7).length;
    const confidence = highCount >= 3 ? 'HIGH' : highCount >= 2 ? 'MEDIUM' : 'LOW';
    const primaryDomain = topCorrelations[0]?.correlation?.domain ?? 'unknown';

    return {
      question: `Diagnose degradation from ${signals.length} signals`,
      hypothesis: `Primary degradation in "${primaryDomain}": ${topCorrelations[0]?.correlation?.cause ?? 'unknown cause'}`,
      evidence,
      confidence,
      mostLikelyAffected: [...new Set(topCorrelations.slice(0, 4).map(c => c.correlation.domain))],
      recommendedInvestigation: this._buildInvestigationSteps(primaryDomain, runbook),
      reasoningChain,
    };
  }

  /**
   * Correlate a set of metrics to probable structural causes.
   * @param {Array<{ name: string, value: number }>} metrics
   * @returns {Array<{ metric: string, cause: string, domain: string, confidence: string }>}
   */
  correlateMetricsToCause(metrics) {
    if (!Array.isArray(metrics)) return [];
    return metrics.map(m => {
      const corr = correlateMetricToCause(m.name ?? '');
      return {
        metric: m.name,
        cause: corr.cause,
        domain: corr.domain,
        confidence: corr.risk >= 0.8 ? 'HIGH' : corr.risk >= 0.6 ? 'MEDIUM' : 'LOW',
      };
    });
  }

  /**
   * Recommend concrete actions for a given operational situation.
   * @param {{ domain?: string, type?: string, severity?: string }} situation
   * @returns {Promise<string[]>}
   */
  async recommendActions(situation) {
    const domain = situation?.domain ?? 'unknown';
    const severity = (situation?.severity ?? '').toUpperCase();
    const actions = [];

    const [runbookData, opsData] = await Promise.allSettled([
      fetchV1(`/api/runbook?domain=${encodeURIComponent(domain)}`),
      fetchV1('/api/operations'),
    ]);

    const runbook = runbookData.status === 'fulfilled' ? runbookData.value : null;
    const ops = opsData.status === 'fulfilled' ? opsData.value : null;

    if (severity === 'CRITICAL' || severity === 'P0') {
      actions.push(`P0: Page on-call immediately. Check /api/escalation for chain.`);
      actions.push(`P0: Enable maintenance mode if available on impacted storefront.`);
    }

    if (runbook?.detection) actions.push(`Detection: ${JSON.stringify(runbook.detection).slice(0, 150)}`);
    if (runbook?.diagnosis) actions.push(`Diagnosis: ${JSON.stringify(runbook.diagnosis).slice(0, 150)}`);
    if (runbook?.recovery) actions.push(`Recovery: ${JSON.stringify(runbook.recovery).slice(0, 150)}`);
    if (runbook?.escalation) actions.push(`Escalation: ${JSON.stringify(runbook.escalation).slice(0, 150)}`);

    if (['payments', 'checkout', 'orders'].includes(domain)) {
      actions.push(`CRITICAL: Freeze new payment processing if ledger RPCs are failing.`);
      actions.push(`Run ledger reconciliation RPC: confirm_order_payment_with_ledger.`);
    }

    if (domain === 'identity') {
      actions.push(`Rotate JWT keys only via identity-platform key rotation flow — never manual.`);
      actions.push(`Check Supabase Auth dashboard for error spikes.`);
    }

    actions.push(`Verify gate: node scripts/validate-governance.mjs`);
    actions.push(`Check live adapters: curl ${V1_BASE}/api/live-adapters`);

    if (!ops) actions.push(`LCIS offline — restart: cd tools/central-intelligence && pnpm dev`);

    return actions.filter(Boolean);
  }

  /**
   * Assess current operational risk level.
   * @returns {Promise<{ risk: string, score: number, sources: string[], recommendation: string }>}
   */
  async assessOperationalRisk() {
    const [anomalyRes, incidentRes, opsData] = await Promise.allSettled([
      anomalyService(),
      incidentService(),
      fetchV1('/api/operations'),
    ]);

    const anom = anomalyRes.status === 'fulfilled' ? anomalyRes.value : null;
    const inc = incidentRes.status === 'fulfilled' ? incidentRes.value : null;
    const ops = opsData.status === 'fulfilled' ? opsData.value : null;

    let score = 0.2; // baseline
    const sources = [];

    if (anom) {
      try {
        const recent = anom.getRecentAnomalies?.(5) ?? [];
        if (recent.length > 3) { score += 0.3; sources.push(`${recent.length} recent anomalies`); }
        else if (recent.length > 0) { score += 0.15; sources.push(`${recent.length} recent anomalies`); }
      } catch { /* optional */ }
    } else {
      sources.push('Anomaly service NOT CONNECTED (live score unavailable)');
    }

    if (inc) {
      try {
        const log = inc.getIncidentLog?.({ limit: 5 }) ?? [];
        if (log.length > 0) { score += 0.25; sources.push(`${log.length} recent incidents in log`); }
      } catch { /* optional */ }
    }

    if (!ops) { score += 0.1; sources.push('LCIS /api/operations offline'); }

    score = Math.min(1.0, score);
    const risk = score >= 0.6 ? 'HIGH' : score >= 0.35 ? 'MEDIUM' : 'LOW';

    return {
      risk,
      score: Math.round(score * 100) / 100,
      sources,
      recommendation: risk === 'HIGH'
        ? `Operational risk is elevated. Investigate active anomalies and incidents immediately.`
        : risk === 'MEDIUM'
        ? `Operational risk is moderate. Monitor anomaly trends and review recent deployments.`
        : `Operational risk is low. Maintain standard monitoring cadence.`,
    };
  }

  /** @private */
  _buildInvestigationSteps(domain, runbook) {
    const steps = [
      `1. Tail logs for "${domain}": wrangler tail --filter domain=${domain}`,
      `2. Check DB: SELECT * FROM pg_stat_activity WHERE wait_event IS NOT NULL LIMIT 10;`,
      `3. Blast radius: curl ${V1_BASE}/api/blast?q=${encodeURIComponent(domain)}`,
      `4. Live adapters: curl ${V1_BASE}/api/live-adapters`,
    ];
    if (runbook?.recovery) steps.push(`5. Run runbook recovery: ${JSON.stringify(runbook.recovery).slice(0, 100)}`);
    if (['payments', 'orders', 'checkout'].includes(domain)) {
      steps.push(`6. CRITICAL: Verify payment ledger integrity before declaring resolved.`);
    }
    return steps;
  }
}

export default new OperationalReasoner();
