/**
 * LCIS V2 Reasoning Engine — ReasoningEngine (Facade)
 *
 * The unified entry-point for all LCIS reasoning. Classifies a question,
 * dispatches to the appropriate specialised reasoner, and combines results
 * into a structured ReasoningResult.
 *
 * Reasoning is EVIDENCE-BASED: structural facts from the code graph +
 * architecture intelligence + memory recall + live signals (if connected).
 * If a live signal is needed but NOT CONNECTED, that is stated explicitly —
 * results are never fabricated.
 *
 * All specialised reasoners are lazy-loaded so startup has zero I/O cost.
 *
 * @module ReasoningEngine
 */

/** @typedef {'HIGH'|'MEDIUM'|'LOW'} Confidence */
/** @typedef {{ source: string, fact: string, weight: number }} Evidence */
/**
 * @typedef {{
 *   question: string,
 *   hypothesis: string,
 *   evidence: Evidence[],
 *   confidence: Confidence,
 *   mostLikelyAffected: string[],
 *   recommendedInvestigation: string[],
 *   reasoningChain: string[]
 * }} ReasoningResult
 */

const V1_BASE = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

// ── Lazy reasoner registry ────────────────────────────────────────────────────

let _incident = null;
let _dependency = null;
let _architecture = null;
let _operational = null;
let _deployment = null;
let _security = null;

async function incidentReasoner()    { if (!_incident)      { const m = await import('./IncidentReasoner.mjs');      _incident      = m.default; } return _incident; }
async function dependencyReasoner()  { if (!_dependency)    { const m = await import('./DependencyReasoner.mjs');    _dependency    = m.default; } return _dependency; }
async function architectureReasoner(){ if (!_architecture)  { const m = await import('./ArchitectureReasoner.mjs');  _architecture  = m.default; } return _architecture; }
async function operationalReasoner() { if (!_operational)   { const m = await import('./OperationalReasoner.mjs');   _operational   = m.default; } return _operational; }
async function deploymentReasoner()  { if (!_deployment)    { const m = await import('./DeploymentReasoner.mjs');    _deployment    = m.default; } return _deployment; }
async function securityReasoner()    { if (!_security)      { const m = await import('./SecurityReasoner.mjs');      _security      = m.default; } return _security; }

// ── Question classifier ───────────────────────────────────────────────────────

/** @typedef {'incident'|'dependency'|'architecture'|'operational'|'deployment'|'security'|'general'} ReasoningDomain */

const CLASSIFIERS = [
  { domain: /** @type {ReasoningDomain} */ ('incident'),     pattern: /incident|outage|down|failed|failure|broke|error|crash|why.*(happen|fail|break)/i },
  { domain: /** @type {ReasoningDomain} */ ('deployment'),   pattern: /deploy|release|ship|rollout|regression|revert|merge|PR|pull.request/i },
  { domain: /** @type {ReasoningDomain} */ ('security'),     pattern: /security|CVE|vuln|attack|exploit|RLS|jwt|auth|token|hack|breach|HMAC/i },
  { domain: /** @type {ReasoningDomain} */ ('dependency'),   pattern: /depend|blast.radius|break.if|impact.of|what.breaks|change.risk|critical.path/i },
  { domain: /** @type {ReasoningDomain} */ ('architecture'), pattern: /architecture|layer|anti.pattern|coupling|god.module|refactor|design|pattern|structure/i },
  { domain: /** @type {ReasoningDomain} */ ('operational'),  pattern: /operat|degrad|slow|latency|metric|alert|runbook|diagnos|monitor|SLO|SLA|on.call/i },
];

/**
 * Classify a free-form question to a reasoning domain.
 * @param {string} question
 * @returns {ReasoningDomain}
 */
function classify(question) {
  const q = (question ?? '').toLowerCase();
  for (const { domain, pattern } of CLASSIFIERS) {
    if (pattern.test(q)) return domain;
  }
  return 'general';
}

// ── Evidence helpers ──────────────────────────────────────────────────────────

/**
 * Pull supplementary context from LCIS V1 memory endpoint.
 * @param {string} query
 * @returns {Promise<Evidence[]>}
 */
async function fetchMemoryEvidence(query) {
  try {
    const res = await fetch(`${V1_BASE}/api/memory?mode=recall&q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results ?? []).slice(0, 3).map(r => ({
      source: 'memory-recall',
      fact: (r.content ?? r.text ?? JSON.stringify(r)).slice(0, 120),
      weight: Math.min(0.75, (r.score ?? 0.5)),
    }));
  } catch {
    return [];
  }
}

/**
 * Build a minimal fallback result when no specialised reasoner matches.
 * @param {string} question
 * @returns {ReasoningResult}
 */
function generalResult(question) {
  return {
    question,
    hypothesis: `No specialised reasoner matched. Use domain-specific methods: reason(q, context), whyDidThisHappen(incident), whatCaused(symptom), etc.`,
    evidence: [{ source: 'classifier', fact: 'Question did not match incident/dependency/architecture/operational/deployment/security patterns.', weight: 0.3 }],
    confidence: 'LOW',
    mostLikelyAffected: [],
    recommendedInvestigation: [
      `Rephrase with domain context: "why did [incident] happen", "what breaks if [component] changes", "is [CVE] affecting us".`,
      `Or call specific methods: whyDidThisHappen(), whatCaused(), whatIsAffected(), whatToInvestigate().`,
    ],
    reasoningChain: ['Question classified as general — no domain match.'],
  };
}

// ── ReasoningEngine ───────────────────────────────────────────────────────────

class ReasoningEngine {
  /**
   * Classify a question and dispatch to the appropriate specialised reasoner.
   * @param {string} question
   * @param {object} [context] - Optional additional context
   * @param {object} [context.incident]    - Incident object
   * @param {string} [context.component]   - Component name
   * @param {string} [context.subject]     - Subject to explain
   * @param {string[]} [context.components] - Changed component list
   * @param {object} [context.deployment]  - Deployment object
   * @param {object} [context.advisory]    - CVE/security advisory
   * @returns {Promise<ReasoningResult>}
   */
  async reason(question, context = {}) {
    const domain = classify(question);

    const [memoryEvidence] = await Promise.allSettled([fetchMemoryEvidence(question)]);
    const extraEvidence = memoryEvidence.status === 'fulfilled' ? memoryEvidence.value : [];

    /** @type {ReasoningResult} */
    let result;

    switch (domain) {
      case 'incident':
        result = await (await incidentReasoner()).reason(context.incident ?? { name: question });
        break;
      case 'dependency':
        result = await (await dependencyReasoner()).reason(context.component ?? question);
        break;
      case 'architecture':
        result = await (await architectureReasoner()).reason(question);
        break;
      case 'operational':
        result = await (await operationalReasoner()).reason(question);
        break;
      case 'deployment':
        result = await (await deploymentReasoner()).reason(context.deployment ?? { components: context.components ?? [] });
        break;
      case 'security':
        result = context.advisory
          ? await (await securityReasoner()).reasonAboutVulnerability(context.advisory)
            .then(v => ({
              question,
              hypothesis: v.reason,
              evidence: v.evidence,
              confidence: v.affected === true ? 'HIGH' : v.affected === false ? 'MEDIUM' : 'LOW',
              mostLikelyAffected: [],
              recommendedInvestigation: [v.recommendation],
              reasoningChain: ['Classified as security', 'Dispatched to SecurityReasoner.reasonAboutVulnerability'],
            }))
          : await (await securityReasoner()).reason(question);
        break;
      default:
        result = generalResult(question);
    }

    // Merge memory evidence
    if (extraEvidence.length > 0) {
      result = { ...result, evidence: [...result.evidence, ...extraEvidence] };
    }

    return result;
  }

  /**
   * Explain a subject (entity, domain, component) in structured form.
   * @param {string} subject
   * @returns {Promise<ReasoningResult>}
   */
  async explain(subject) {
    const question = `Explain "${subject}"`;
    const evidence = [];
    const reasoningChain = [];

    reasoningChain.push(`1. Fetch LCIS explain endpoint for "${subject}".`);
    const [explainData, workspaceData] = await Promise.allSettled([
      fetch(`${V1_BASE}/api/explain?node=${encodeURIComponent(subject)}`, { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${V1_BASE}/api/workspace?domain=${encodeURIComponent(subject)}`, { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const explain = explainData.status === 'fulfilled' ? explainData.value : null;
    const workspace = workspaceData.status === 'fulfilled' ? workspaceData.value : null;

    if (explain) {
      evidence.push({ source: 'lcis-explain-api', fact: `Purpose: ${explain.purpose ?? 'N/A'}. Importance: ${explain.importance ?? 'N/A'}. Owner: ${explain.owner ?? 'unknown'}.`, weight: 0.90 });
      if (explain.failureImpact) evidence.push({ source: 'lcis-explain-api', fact: `Failure impact: ${explain.failureImpact}`, weight: 0.85 });
    } else {
      evidence.push({ source: 'lcis-explain-api', fact: `Explain API NOT CONNECTED — LCIS may be offline. Start: cd tools/central-intelligence && pnpm dev.`, weight: 0.05 });
    }

    reasoningChain.push(`2. Fetch workspace (6 perspectives) for "${subject}".`);
    if (workspace) {
      evidence.push({ source: 'lcis-workspace', fact: `Workspace perspectives available: ${Object.keys(workspace).filter(k => workspace[k]).slice(0, 5).join(', ')}`, weight: 0.75 });
    }

    const [depResult] = await Promise.allSettled([
      (await dependencyReasoner()).reason(subject),
    ]);

    if (depResult.status === 'fulfilled') {
      evidence.push(...depResult.value.evidence.slice(0, 2));
      reasoningChain.push(...depResult.value.reasoningChain.slice(0, 2));
    }

    reasoningChain.push(`3. Synthesise: explain → workspace → dependency posture.`);

    return {
      question,
      hypothesis: explain?.purpose ?? `"${subject}" — explanation not yet indexed in LCIS (run pnpm graph:omega to build).`,
      evidence,
      confidence: explain ? 'HIGH' : 'LOW',
      mostLikelyAffected: explain?.dependents ?? [],
      recommendedInvestigation: [
        `curl ${V1_BASE}/api/explain?node=${encodeURIComponent(subject)}`,
        `curl ${V1_BASE}/api/workspace?domain=${encodeURIComponent(subject)}`,
        `pnpm graph:intel blast "${subject}"`,
      ],
      reasoningChain,
    };
  }

  /**
   * Root-cause reasoning for an incident.
   * @param {object} incident - { name?, domain?, component?, type?, symptoms?, timestamp? }
   * @returns {Promise<ReasoningResult>}
   */
  async whyDidThisHappen(incident) {
    return (await incidentReasoner()).reason(incident);
  }

  /**
   * Identify what caused a given symptom.
   * @param {string} symptom - e.g. "payments are failing", "checkout is slow"
   * @returns {Promise<ReasoningResult>}
   */
  async whatCaused(symptom) {
    // Parse symptom into a synthetic incident
    const domain = /payment|razorpay/i.test(symptom) ? 'payments'
      : /checkout/i.test(symptom) ? 'checkout'
      : /order/i.test(symptom) ? 'orders'
      : /auth|jwt|session/i.test(symptom) ? 'identity'
      : /queue|worker/i.test(symptom) ? 'queue-workers'
      : /webhook/i.test(symptom) ? 'webhooks'
      : /slow|latency|timeout/i.test(symptom) ? 'performance'
      : 'unknown';

    return (await incidentReasoner()).reason({ name: symptom, domain, type: 'symptom' });
  }

  /**
   * Identify what is most likely affected by a component change or incident.
   * @param {string} component
   * @returns {Promise<ReasoningResult>}
   */
  async whatIsAffected(component) {
    return (await dependencyReasoner()).whatBreaksIf(component);
  }

  /**
   * Determine what engineers should investigate given a problem description.
   * @param {string} problem
   * @returns {Promise<ReasoningResult>}
   */
  async whatToInvestigate(problem) {
    const domain = classify(problem);
    const evidence = [];
    const reasoningChain = [`1. Classify problem "${problem.slice(0, 60)}" → domain: ${domain}.`];

    let baseResult;
    switch (domain) {
      case 'incident':    baseResult = await (await incidentReasoner()).reason({ name: problem }); break;
      case 'operational': baseResult = await (await operationalReasoner()).reason(problem); break;
      case 'security':    baseResult = await (await securityReasoner()).reason(problem); break;
      case 'deployment':  baseResult = await (await deploymentReasoner()).reason({ components: [] }); break;
      default:            baseResult = await (await dependencyReasoner()).reason(problem);
    }

    reasoningChain.push(`2. Dispatch to ${domain} reasoner.`);
    reasoningChain.push(`3. Merge investigation steps.`);

    return {
      ...baseResult,
      question: `What should engineers investigate? Problem: "${problem}"`,
      reasoningChain: [...reasoningChain, ...baseResult.reasoningChain],
    };
  }

  /**
   * Return the highest-risk dependency in the codebase.
   * Falls back to KNOWN_HOTSPOTS if graph is unavailable — always returns data.
   * @returns {Promise<{ name: string, risk: string, weight: number, reason: string }>}
   */
  async highestRiskDependency() {
    const deps = await (await dependencyReasoner()).getHighestRiskDependencies();
    return deps[0] ?? { name: 'getSupabaseAdmin', risk: 'CRITICAL', weight: 0.99, reason: 'Known CLAUDE.md hotspot: 115 files depend on this function' };
  }
}

export default new ReasoningEngine();
