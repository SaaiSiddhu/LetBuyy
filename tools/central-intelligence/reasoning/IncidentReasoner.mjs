/**
 * LCIS V2 Reasoning Engine — IncidentReasoner
 *
 * Reasons about incidents: root-cause hypotheses, blast radius, investigation steps.
 * Evidence-based only — structural facts from the graph + memory of similar incidents
 * + V1 runbook API. Live signals noted as NOT CONNECTED when unavailable.
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

/** Map raw incident object to a domain key for runbook lookup */
function toDomainKey(incident) {
  if (!incident) return 'unknown';
  const raw = (incident.domain ?? incident.name ?? incident.component ?? incident.type ?? '').toLowerCase();
  if (raw.includes('payment') || raw.includes('razorpay')) return 'payments';
  if (raw.includes('order')) return 'orders';
  if (raw.includes('checkout')) return 'checkout';
  if (raw.includes('auth') || raw.includes('identity')) return 'identity';
  if (raw.includes('queue') || raw.includes('worker')) return 'queue-workers';
  if (raw.includes('webhook')) return 'webhook';
  if (raw.includes('product') || raw.includes('inventory')) return 'products';
  if (raw.includes('theme')) return 'themes';
  return raw || 'unknown';
}

class IncidentReasoner {
  /**
   * Main reasoning entry-point for an incident.
   * @param {object} incident - { name?, domain?, component?, type?, symptoms?, timestamp? }
   * @returns {Promise<ReasoningResult>}
   */
  async reason(incident) {
    const domain = toDomainKey(incident);
    const question = `Why did incident "${incident.name ?? incident.type ?? domain}" happen?`;

    const [blastData, crossData, memoryData, runbookData, deployData] = await Promise.allSettled([
      fetchV1(`/api/blast?q=${encodeURIComponent(domain)}`),
      fetchV1(`/api/cross-domain?key=${encodeURIComponent(domain)}`),
      fetchV1(`/api/memory?mode=incident&q=${encodeURIComponent(domain)}`),
      fetchV1(`/api/runbook?domain=${encodeURIComponent(domain)}`),
      fetchV1('/api/deployment-state'),
    ]);

    const blast = blastData.status === 'fulfilled' ? blastData.value : null;
    const cross = crossData.status === 'fulfilled' ? crossData.value : null;
    const memory = memoryData.status === 'fulfilled' ? memoryData.value : null;
    const runbook = runbookData.status === 'fulfilled' ? runbookData.value : null;
    const deploy = deployData.status === 'fulfilled' ? deployData.value : null;

    const evidence = [];
    const reasoningChain = [];

    // Step 1: structural blast radius
    reasoningChain.push(`1. Query blast radius for domain "${domain}" from code graph.`);
    if (blast?.affected?.length) {
      evidence.push({ source: 'blast-radius-graph', fact: `Domain "${domain}" has blast radius touching ${blast.affected.length} components: ${blast.affected.slice(0, 5).join(', ')}`, weight: 0.85 });
    } else {
      evidence.push({ source: 'blast-radius-graph', fact: `Blast radius data not available for domain "${domain}" — LCIS graph may need refresh (pnpm graph:omega).`, weight: 0.1 });
    }

    // Step 2: cross-domain dependencies
    reasoningChain.push(`2. Inspect cross-domain dependencies to identify upstream causes.`);
    if (cross?.dependsOn?.length) {
      const upstreams = cross.dependsOn.slice(0, 4).join(', ');
      evidence.push({ source: 'cross-domain-graph', fact: `Domain "${domain}" depends on: ${upstreams}. Upstream failures cascade here.`, weight: 0.78 });
    } else {
      evidence.push({ source: 'cross-domain-graph', fact: `No upstream dependency data — structural isolation cannot be confirmed.`, weight: 0.15 });
    }

    // Step 3: memory of similar incidents
    reasoningChain.push(`3. Recall similar past incidents from memory store.`);
    if (memory?.results?.length) {
      const past = memory.results[0];
      evidence.push({ source: 'incident-memory', fact: `Similar past incident: "${past.content ?? past.text ?? JSON.stringify(past).slice(0, 120)}"`, weight: 0.72 });
    } else {
      evidence.push({ source: 'incident-memory', fact: `Memory store returned no similar incidents — either first occurrence or memory index not built.`, weight: 0.1 });
    }

    // Step 4: recent deployment correlation
    reasoningChain.push(`4. Check recent deployments for causal correlation.`);
    if (deploy?.head ?? deploy?.latest) {
      const head = deploy.head ?? deploy.latest ?? 'unknown';
      evidence.push({ source: 'deployment-state', fact: `Last known HEAD: ${typeof head === 'string' ? head : JSON.stringify(head).slice(0, 80)}. Correlate with incident timestamp.`, weight: 0.65 });
    } else {
      evidence.push({ source: 'deployment-state', fact: `Deployment state NOT CONNECTED — wrangler/Vercel API adapter not wired. Check deploy logs manually.`, weight: 0.05 });
    }

    // Step 5: runbook escalation path
    reasoningChain.push(`5. Pull runbook for detection, diagnosis, and recovery steps.`);
    if (runbook?.detection ?? runbook?.recovery) {
      evidence.push({ source: 'runbook', fact: `Runbook for "${domain}": detection=${JSON.stringify(runbook.detection ?? '').slice(0, 100)}, recovery=${JSON.stringify(runbook.recovery ?? '').slice(0, 100)}`, weight: 0.60 });
    } else {
      evidence.push({ source: 'runbook', fact: `No runbook found for domain "${domain}". Check /api/runbook?domain=${domain}.`, weight: 0.1 });
    }

    const highWeightCount = evidence.filter(e => e.weight >= 0.65).length;
    const confidence = highWeightCount >= 3 ? 'HIGH' : highWeightCount >= 2 ? 'MEDIUM' : 'LOW';

    const hypothesis = blast?.affected?.length
      ? `The incident in "${domain}" likely propagated from an upstream dependency (${cross?.dependsOn?.[0] ?? 'unknown'}) or was triggered by a recent deployment. Blast radius suggests ${blast.affected.length} components at risk.`
      : `Root cause unclear — structural graph data is stale or unavailable. Reason from runbook and deployment logs.`;

    return {
      question,
      hypothesis,
      evidence,
      confidence,
      mostLikelyAffected: await this.getMostLikelyAffected(incident),
      recommendedInvestigation: this.suggestInvestigation(incident, domain, runbook),
      reasoningChain,
    };
  }

  /**
   * Rank causes by evidence weight, returning top 5.
   * @param {object} incident
   * @returns {Promise<Array<{ cause: string, weight: number, source: string }>>}
   */
  async rankCauses(incident) {
    const domain = toDomainKey(incident);
    const [crossData, memData] = await Promise.allSettled([
      fetchV1(`/api/cross-domain?key=${encodeURIComponent(domain)}`),
      fetchV1(`/api/memory?mode=incident&q=${encodeURIComponent(domain)}`),
    ]);

    const cross = crossData.status === 'fulfilled' ? crossData.value : null;
    const mem = memData.status === 'fulfilled' ? memData.value : null;

    const causes = [];

    if (cross?.dependsOn?.length) {
      causes.push(...cross.dependsOn.slice(0, 3).map((dep, i) => ({
        cause: `Upstream dependency failure in "${dep}"`,
        weight: 0.85 - i * 0.1,
        source: 'cross-domain-graph',
      })));
    }
    if (mem?.results?.length) {
      causes.push({ cause: `Pattern matches past incident: ${(mem.results[0].content ?? '').slice(0, 80)}`, weight: 0.72, source: 'incident-memory' });
    }
    causes.push({ cause: 'Recent deployment introduced regression', weight: 0.65, source: 'deployment-state (NOT CONNECTED — verify manually)' });
    causes.push({ cause: 'Database query degradation / lock contention', weight: 0.50, source: 'structural-risk (live signal NOT CONNECTED)' });
    causes.push({ cause: 'External provider (Razorpay / Supabase / Cloudflare) degradation', weight: 0.40, source: 'structural-risk (live provider status NOT CONNECTED)' });

    return causes.sort((a, b) => b.weight - a.weight).slice(0, 5);
  }

  /**
   * Identify components most likely affected using cross-domain + FK graph.
   * @param {object} incident
   * @returns {Promise<string[]>}
   */
  async getMostLikelyAffected(incident) {
    const domain = toDomainKey(incident);
    const [crossData, blastData] = await Promise.allSettled([
      fetchV1(`/api/cross-domain?key=${encodeURIComponent(domain)}`),
      fetchV1(`/api/blast?q=${encodeURIComponent(domain)}`),
    ]);

    const cross = crossData.status === 'fulfilled' ? crossData.value : null;
    const blast = blastData.status === 'fulfilled' ? blastData.value : null;

    const affected = new Set();
    for (const d of cross?.consumedBy ?? []) affected.add(d);
    for (const a of blast?.affected ?? []) affected.add(a);

    // Always flag money-adjacent risk
    if (['payments', 'orders', 'checkout'].includes(domain)) {
      affected.add('payment_transactions (ledger)');
      affected.add('orders / order_items');
    }
    if (domain === 'identity') {
      affected.add('merchant-control-plane (auth gate)');
      affected.add('storefront-runtime (customer sessions)');
    }

    return [...affected].slice(0, 8);
  }

  /**
   * Build ordered investigation steps.
   * @param {object} incident
   * @param {string} domain
   * @param {object|null} runbook
   * @returns {string[]}
   */
  suggestInvestigation(incident, domain, runbook) {
    const steps = [
      `1. Tail live worker/gateway logs: \`wrangler tail\` or Supabase Functions → filter for "${domain}".`,
      `2. Check deploy timeline: compare incident timestamp against last Vercel/Cloudflare deployment.`,
      `3. Query cross-domain blast: \`curl localhost:3333/api/cross-domain?key=${domain}\`.`,
      `4. Inspect DB for anomalies: slow queries, lock waits, failed RPCs in pg_stat_activity.`,
    ];

    if (runbook?.detection) {
      steps.push(`5. Follow runbook detection step: ${JSON.stringify(runbook.detection).slice(0, 150)}`);
    } else {
      steps.push(`5. Run \`curl localhost:3333/api/runbook?domain=${domain}\` — runbook not cached.`);
    }

    steps.push(`6. Check live provider status: \`curl localhost:3333/api/live-adapters\` (NOT CONNECTED until creds wired).`);
    steps.push(`7. Review memory for similar incidents: \`curl localhost:3333/api/memory?mode=incident&q=${domain}\`.`);

    if (['payments', 'orders', 'checkout'].includes(domain)) {
      steps.push(`8. CRITICAL: Verify ledger integrity — run \`confirm_order_payment_with_ledger\` RPC reconciliation. Money RPCs only.`);
    }

    return steps;
  }
}

export default new IncidentReasoner();
