/**
 * LCIS V2 Reasoning Engine — DeploymentReasoner
 *
 * Reasons about deployments: risk assessment, impact prediction, GO/NO-GO decisions,
 * and incident correlation.
 *
 * Uses V1 /api/change-impact, /api/blast, /api/deployment-state + DependencyReasoner.
 * Live deploy values are NOT CONNECTED unless Vercel/Cloudflare adapters are wired.
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

let _depReasoner = null;
async function depReasoner() {
  if (!_depReasoner) {
    const m = await import('./DependencyReasoner.mjs');
    _depReasoner = m.default;
  }
  return _depReasoner;
}

/** Canonical runtimes that have their own deploy pipeline */
const CANONICAL_RUNTIMES = [
  'apps/customer_web',
  'apps/merchant_web',
  'apps/identity-platform',
  'apps/marketing-site',
  'apps/admin_web',
  'services/api-gateway',
  'services/queue-workers',
  'services/webhook-service',
];

/** Components that always trigger GO/NO-GO review */
const BLOCK_TRIGGERS = [
  { pattern: /payment|checkout|ledger|razorpay/i, reason: 'Money critical path', severity: 'BLOCK' },
  { pattern: /getSupabaseAdmin|supabase.*admin/i, reason: 'Tenant DB admin (115 files blast radius)', severity: 'BLOCK' },
  { pattern: /shared.?types|api.?client/i, reason: 'Cross-app shared type contract', severity: 'REVIEW' },
  { pattern: /rls|policy|security.?definer/i, reason: 'RLS / auth boundary', severity: 'BLOCK' },
  { pattern: /jwt|jwks|session.*secret/i, reason: 'Auth token issuer', severity: 'BLOCK' },
  { pattern: /create_checkout_order|confirm_order_payment/i, reason: 'Canonical money RPC', severity: 'BLOCK' },
  { pattern: /validate.?governance|scripts\/validate/i, reason: 'Governance gate script', severity: 'REVIEW' },
];

function evaluateTriggers(components) {
  const hits = [];
  for (const comp of (components ?? [])) {
    for (const t of BLOCK_TRIGGERS) {
      if (t.pattern.test(comp)) {
        hits.push({ component: comp, ...t });
      }
    }
  }
  return hits;
}

class DeploymentReasoner {
  /**
   * Reason about a deployment object.
   * @param {{ components?: string[], commit?: string, branch?: string, app?: string }} deployment
   * @returns {Promise<ReasoningResult>}
   */
  async reason(deployment) {
    const components = deployment?.components ?? [];
    const question = `What is the risk of deploying [${components.slice(0, 3).join(', ')}${components.length > 3 ? `…+${components.length - 3}` : ''}]?`;
    const evidence = [];
    const reasoningChain = [];

    const [riskResult, impactResult] = await Promise.allSettled([
      this.assessDeploymentRisk(components),
      this.predictImpact(components),
    ]);

    const risk = riskResult.status === 'fulfilled' ? riskResult.value : null;
    const impact = impactResult.status === 'fulfilled' ? impactResult.value : null;

    reasoningChain.push(`1. Evaluate ${components.length} changed components against block-trigger rules.`);
    reasoningChain.push(`2. Query blast radius and change-impact for each component.`);
    reasoningChain.push(`3. Synthesise GO/NO-GO decision with evidence chain.`);

    if (risk) {
      evidence.push({ source: 'deployment-risk-assessment', fact: `Overall deployment risk: ${risk.risk} (score=${risk.score}). Blockers: ${risk.blockers.join('; ') || 'none'}`, weight: 0.90 });
    }

    if (impact) {
      evidence.push({ source: 'impact-prediction', fact: `Predicted impact: ${impact.affectedServices.length} services, ${impact.affectedDomains.length} domains, merchant impact: ${impact.merchantImpact}`, weight: 0.85 });
    }

    const [deployState] = await Promise.allSettled([fetchV1('/api/deployment-state')]);
    const state = deployState.status === 'fulfilled' ? deployState.value : null;
    if (state) {
      evidence.push({ source: 'deployment-state', fact: `Current HEAD: ${JSON.stringify(state.head ?? state.latest ?? '?').slice(0, 80)}. Latest migration: ${state.latestMigration ?? 'unknown'}.`, weight: 0.72 });
    } else {
      evidence.push({ source: 'deployment-state', fact: `Deployment state NOT CONNECTED — Vercel/Cloudflare adapter not wired.`, weight: 0.05 });
    }

    const triggers = evaluateTriggers(components);
    if (triggers.some(t => t.severity === 'BLOCK')) {
      evidence.push({ source: 'block-trigger-rules', fact: `BLOCK triggers hit: ${triggers.filter(t => t.severity === 'BLOCK').map(t => `${t.component} (${t.reason})`).join('; ')}`, weight: 0.95 });
    }

    const highCount = evidence.filter(e => e.weight >= 0.8).length;
    const confidence = highCount >= 3 ? 'HIGH' : highCount >= 2 ? 'MEDIUM' : 'LOW';

    return {
      question,
      hypothesis: risk?.risk === 'CRITICAL'
        ? `Deployment is HIGH RISK — ${triggers.find(t => t.severity === 'BLOCK')?.reason ?? 'money/auth boundary touched'}. Requires ARB sign-off.`
        : `Deployment appears within normal risk envelope. Validate with governance gate before merge.`,
      evidence,
      confidence,
      mostLikelyAffected: impact?.affectedServices ?? [],
      recommendedInvestigation: [
        `1. Run governance gate: node scripts/validate-governance.mjs`,
        `2. Build affected apps: pnpm --filter <app> build`,
        `3. Full blast radius: curl ${V1_BASE}/api/blast?q=${encodeURIComponent(components[0] ?? '')}`,
        `4. Check launch blockers: curl ${V1_BASE}/api/launch-command-center`,
      ],
      reasoningChain,
    };
  }

  /**
   * Assess risk of deploying a set of changed components.
   * @param {string[]} changedComponents
   * @returns {Promise<{ risk: string, score: number, blockers: string[], changedCount: number }>}
   */
  async assessDeploymentRisk(changedComponents) {
    const components = changedComponents ?? [];
    const triggers = evaluateTriggers(components);
    const dr = await depReasoner().catch(() => null);

    let score = 0.2;
    const blockers = [];

    // Block triggers
    const blockHits = triggers.filter(t => t.severity === 'BLOCK');
    const reviewHits = triggers.filter(t => t.severity === 'REVIEW');
    if (blockHits.length) { score += 0.35 * Math.min(blockHits.length, 2); blockers.push(...blockHits.map(t => `${t.component}: ${t.reason}`)); }
    if (reviewHits.length) { score += 0.1; blockers.push(...reviewHits.map(t => `REVIEW: ${t.component}: ${t.reason}`)); }

    // Blast radius for each changed component
    if (dr) {
      const changeRisks = await Promise.allSettled(components.slice(0, 5).map(c => dr.assessChangeRisk(c)));
      for (const r of changeRisks) {
        if (r.status === 'fulfilled') {
          score += r.value.score * 0.15;
          if (r.value.risk === 'CRITICAL' || r.value.risk === 'HIGH') {
            blockers.push(...r.value.blockers.slice(0, 2));
          }
        }
      }
    }

    // Canonical runtime count
    const touchedRuntimes = components.filter(c => CANONICAL_RUNTIMES.some(r => c.includes(r)));
    if (touchedRuntimes.length > 2) { score += 0.15; blockers.push(`${touchedRuntimes.length} canonical runtimes affected — multi-app deploy risk`); }

    score = Math.min(1.0, score);
    const risk = score >= 0.75 ? 'CRITICAL' : score >= 0.5 ? 'HIGH' : score >= 0.3 ? 'MEDIUM' : 'LOW';

    return { risk, score: Math.round(score * 100) / 100, blockers: [...new Set(blockers)], changedCount: components.length };
  }

  /**
   * Predict what services, domains, and merchants will be affected.
   * @param {string[]} changedComponents
   * @returns {Promise<{ affectedServices: string[], affectedDomains: string[], merchantImpact: string, downtime: string }>}
   */
  async predictImpact(changedComponents) {
    const components = changedComponents ?? [];

    const blastResults = await Promise.allSettled(
      components.slice(0, 5).map(c => fetchV1(`/api/blast?q=${encodeURIComponent(c)}`))
    );

    const affectedSet = new Set();
    const domainSet = new Set();

    for (const r of blastResults) {
      if (r.status === 'fulfilled' && r.value?.affected) {
        for (const a of r.value.affected) affectedSet.add(a);
      }
      if (r.status === 'fulfilled' && r.value?.domains) {
        for (const d of r.value.domains) domainSet.add(d);
      }
    }

    const [crossData] = await Promise.allSettled([fetchV1('/api/domains')]);
    const allDomains = crossData.status === 'fulfilled' ? (crossData.value?.domains ?? []) : [];

    // Determine merchant impact from domain overlap
    const moneyDomains = [...domainSet].filter(d => /payment|checkout|order|inventory/i.test(d));
    const merchantImpact = moneyDomains.length > 0
      ? `ALL merchants (payment/order domains affected: ${moneyDomains.join(', ')})`
      : domainSet.size > 3
      ? 'All merchants (broad domain impact)'
      : 'Scoped merchant impact — verify with affected domain owners';

    const touchedRuntimes = components.filter(c => CANONICAL_RUNTIMES.some(r => c.includes(r)));
    const downtime = touchedRuntimes.some(r => r.includes('api-gateway'))
      ? 'Full API downtime during gateway deploy (rolling deploy recommended)'
      : touchedRuntimes.length > 0
      ? 'Partial service interruption — affected apps during deploy slot'
      : 'No expected downtime (library/worker change)';

    return {
      affectedServices: [...affectedSet].slice(0, 10),
      affectedDomains: [...domainSet].slice(0, 8),
      merchantImpact,
      downtime,
    };
  }

  /**
   * GO/NO-GO reasoning for a deployment.
   * @param {{ components?: string[], readiness?: object }} deployment
   * @returns {Promise<{ decision: 'GO'|'NO-GO'|'CONDITIONAL', reasons: string[], gates: string[] }>}
   */
  async shouldBlock(deployment) {
    const components = deployment?.components ?? [];
    const [riskResult, launchData, govData] = await Promise.allSettled([
      this.assessDeploymentRisk(components),
      fetchV1('/api/launch-command-center'),
      fetchV1('/api/production-readiness-v2'),
    ]);

    const risk = riskResult.status === 'fulfilled' ? riskResult.value : null;
    const launch = launchData.status === 'fulfilled' ? launchData.value : null;
    const readiness = govData.status === 'fulfilled' ? govData.value : null;

    const reasons = [];
    const gates = [
      'node scripts/validate-governance.mjs (107 validators must be GREEN)',
      'pnpm --filter <affected-app> build (no build errors)',
    ];

    let verdict = 'GO';

    if (risk?.risk === 'CRITICAL') {
      verdict = 'NO-GO';
      reasons.push(`CRITICAL risk score (${risk.score}) — ${risk.blockers.slice(0, 3).join('; ')}`);
    } else if (risk?.risk === 'HIGH') {
      verdict = 'CONDITIONAL';
      reasons.push(`HIGH risk score (${risk.score}) — requires peer review + ARB`);
      gates.push('ARB review required (money/auth boundary touched)');
    }

    if (launch?.blockers?.length) {
      const openBlockers = launch.blockers.filter(b => !b.resolved);
      if (openBlockers.length > 0) {
        verdict = verdict === 'GO' ? 'CONDITIONAL' : verdict;
        reasons.push(`${openBlockers.length} launch blockers open: ${openBlockers.slice(0, 2).map(b => b.id ?? b.name ?? JSON.stringify(b).slice(0, 40)).join(', ')}`);
        gates.push('Resolve all launch blockers before deploy');
      }
    }

    if (readiness?.overall < 80) {
      verdict = verdict === 'GO' ? 'CONDITIONAL' : verdict;
      reasons.push(`Structural readiness ${readiness.overall}% (target ≥ 80%)`);
    }

    if (!launch) reasons.push('Launch Command Center NOT CONNECTED — cannot verify blocker state');

    if (reasons.length === 0) reasons.push('No blockers detected — standard gates apply');

    return { decision: verdict, reasons, gates };
  }

  /**
   * Correlate a deployment to recent incidents to detect if it caused them.
   * @param {{ timestamp?: number, commit?: string, components?: string[] }} deployment
   * @returns {Promise<Array<{ incident: string, correlation: string, confidence: string }>>}
   */
  async correlateToIncidents(deployment) {
    const [incidentData, memData] = await Promise.allSettled([
      fetchV1('/api/incident-timeline?domain=all'),
      fetchV1(`/api/memory?mode=incident&q=deployment+regression`),
    ]);

    const incidents = incidentData.status === 'fulfilled' ? (incidentData.value?.incidents ?? incidentData.value ?? []) : [];
    const memoryHits = memData.status === 'fulfilled' ? (memData.value?.results ?? []) : [];

    const correlations = [];
    const deployTs = deployment?.timestamp ? new Date(deployment.timestamp).getTime() : null;

    for (const incident of (Array.isArray(incidents) ? incidents : []).slice(0, 10)) {
      const incidentTs = incident.timestamp ? new Date(incident.timestamp).getTime() : null;
      const timeDelta = deployTs && incidentTs ? Math.abs(incidentTs - deployTs) / 60000 : null; // minutes

      const isClose = timeDelta !== null && timeDelta < 30; // within 30 minutes
      const componentOverlap = (deployment?.components ?? []).some(c =>
        JSON.stringify(incident).toLowerCase().includes(c.toLowerCase().split('/').pop() ?? c)
      );

      if (isClose || componentOverlap) {
        correlations.push({
          incident: incident.name ?? incident.type ?? incident.domain ?? JSON.stringify(incident).slice(0, 60),
          correlation: timeDelta !== null
            ? `${Math.round(timeDelta)}min after deploy${componentOverlap ? ' + component overlap' : ''}`
            : componentOverlap ? 'Component overlap' : 'Temporal proximity',
          confidence: (isClose && componentOverlap) ? 'HIGH' : isClose ? 'MEDIUM' : 'LOW',
        });
      }
    }

    // Augment from memory
    for (const hit of memoryHits.slice(0, 3)) {
      correlations.push({
        incident: (hit.content ?? hit.text ?? '').slice(0, 80),
        correlation: 'Memory: similar deployment-caused incident in history',
        confidence: 'LOW',
      });
    }

    if (correlations.length === 0) {
      correlations.push({
        incident: 'No incidents found in timeline',
        correlation: incidents.length === 0
          ? 'Incident timeline NOT CONNECTED — wire telemetry adapter'
          : 'No temporal or component correlation detected',
        confidence: 'LOW',
      });
    }

    return correlations.slice(0, 8);
  }
}

export default new DeploymentReasoner();
