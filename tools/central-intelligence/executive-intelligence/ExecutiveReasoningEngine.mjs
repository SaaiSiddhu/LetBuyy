/**
 * LCIS V3 Phase 20 — ExecutiveReasoningEngine
 *
 * Executive-level synthesis: combines ReasoningEngine + IntelligenceCorrelationEngine
 * + OperationsReasoningEngine + ArchitectureIntelligenceEngine + V1 LCIS to answer
 * the four executive questions:
 *   1. What should happen next?
 *   2. What is the highest-priority risk?
 *   3. What should leadership know?
 *   4. What is the synthesised state across domains?
 *
 * Honesty contract: structural data CONNECTED; every live value labeled
 * NOT CONNECTED + exact source. No fabrications.
 *
 * @module ExecutiveReasoningEngine
 */

// ── Priority levels ───────────────────────────────────────────────────────────
/** @typedef {'P0'|'P1'|'P2'|'P3'} Priority */
/** @typedef {'engineering'|'operations'|'security'|'leadership'} Owner */

/**
 * @typedef {{
 *   question: string,
 *   conclusion: string,
 *   priority: Priority,
 *   evidence: Array<{source: string, fact: string}>,
 *   confidence: 'HIGH'|'MEDIUM'|'LOW',
 *   recommendedOwner: Owner,
 *   timestamp: string
 * }} ExecutiveInsight
 */

// ── Lazy primitive loaders ────────────────────────────────────────────────────

async function getReasoningEngine() {
  try {
    const m = await import('../reasoning/ReasoningEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getCorrelationEngine() {
  try {
    const m = await import('../correlation/IntelligenceCorrelationEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getRiskScorer() {
  try {
    const m = await import('../correlation/RiskScorer.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getOpsEngine() {
  try {
    const m = await import('../autonomous-operations/OperationsReasoningEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getArchEngine() {
  try {
    const m = await import('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getMemoryRetriever() {
  try {
    const m = await import('../memory-engine/MemoryRetriever.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── V1 LCIS fetch helper ─────────────────────────────────────────────────────

async function fetchV1(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`http://localhost:3333${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Confidence mapper ─────────────────────────────────────────────────────────

function mapConfidence(raw) {
  if (!raw) return 'LOW';
  const s = String(raw).toUpperCase();
  if (s === 'HIGH') return 'HIGH';
  if (s === 'MEDIUM' || s === 'MED') return 'MEDIUM';
  return 'LOW';
}

// ── Priority from risk score ──────────────────────────────────────────────────

function scoreToPriority(score) {
  if (score >= 80) return 'P0';
  if (score >= 60) return 'P1';
  if (score >= 35) return 'P2';
  return 'P3';
}

// ── Owner inference ───────────────────────────────────────────────────────────

function inferOwner(question = '', evidence = []) {
  const text = (question + ' ' + evidence.map(e => e.fact).join(' ')).toLowerCase();
  if (/security|auth|rls|jwt|hmac|cve|vuln/.test(text)) return 'security';
  if (/deploy|infra|queue|worker|cron|outage|incident/.test(text)) return 'operations';
  if (/revenue|launch|merchant|investor|strategy|roadmap/.test(text)) return 'leadership';
  return 'engineering';
}

// ── Main class ────────────────────────────────────────────────────────────────

class ExecutiveReasoningEngine {
  constructor() {
    this._cache = new Map();
    this._cacheTtl = 60_000; // 1 min
  }

  _cached(key, fn) {
    const hit = this._cache.get(key);
    if (hit && Date.now() - hit.ts < this._cacheTtl) return Promise.resolve(hit.value);
    return fn().then(v => { this._cache.set(key, { value: v, ts: Date.now() }); return v; });
  }

  /**
   * Executive-level synthesis for an arbitrary question.
   * Fans out to all available primitives with Promise.allSettled, synthesises.
   * @param {string} question
   * @returns {Promise<ExecutiveInsight>}
   */
  async reason(question) {
    const [
      reasoningEng,
      correlationEng,
      riskScorerEng,
      opsEng,
      archEng,
      memRetriever,
      v1Domains,
    ] = await Promise.allSettled([
      getReasoningEngine(),
      getCorrelationEngine(),
      getRiskScorer(),
      getOpsEngine(),
      getArchEngine(),
      getMemoryRetriever(),
      fetchV1('/api/domains'),
    ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

    const evidence = [];
    let confidence = 'LOW';
    let conclusion = 'Insufficient connected data to synthesise an executive conclusion.';
    let priority = 'P3';
    let riskScore = 0;

    // ── Reasoning primitive ──────────────────────────────────────────────────
    const reasoningResult = await (async () => {
      if (!reasoningEng?.reason) return null;
      try { return await reasoningEng.reason(question); } catch { return null; }
    })();

    if (reasoningResult) {
      (reasoningResult.evidence ?? []).forEach(e =>
        evidence.push({ source: 'ReasoningEngine', fact: e.fact ?? String(e) })
      );
      confidence = mapConfidence(reasoningResult.confidence ?? 'MEDIUM');
      conclusion = reasoningResult.hypothesis ?? conclusion;
    }

    // ── Risk scoring ─────────────────────────────────────────────────────────
    const riskResult = await (async () => {
      if (!riskScorerEng?.score) return null;
      try { return await riskScorerEng.score({ target: question }); } catch { return null; }
    })();

    if (riskResult) {
      riskScore = riskResult.score ?? riskResult.riskScore ?? 0;
      evidence.push({ source: 'RiskScorer', fact: `Composite risk score: ${riskScore}/100` });
      priority = scoreToPriority(riskScore);
    }

    // ── Correlation signals ───────────────────────────────────────────────────
    const corrResult = await (async () => {
      if (!correlationEng?.correlate) return null;
      try { return await correlationEng.correlate({ event: question }); } catch { return null; }
    })();

    if (corrResult) {
      (corrResult.rootCauseCandidates ?? []).slice(0, 3).forEach(c =>
        evidence.push({ source: 'CorrelationEngine', fact: `Root cause candidate: ${c.candidate} (confidence: ${c.confidence})` })
      );
      if (corrResult.riskScore && corrResult.riskScore > riskScore) {
        riskScore = corrResult.riskScore;
        priority = scoreToPriority(riskScore);
      }
    }

    // ── Autonomous ops ────────────────────────────────────────────────────────
    const opsResult = await (async () => {
      if (!opsEng?.assess) return null;
      try { return await opsEng.assess(); } catch { return null; }
    })();

    if (opsResult) {
      const findings = opsResult.findings ?? opsResult.anomalies ?? [];
      findings.slice(0, 3).forEach(f =>
        evidence.push({ source: 'OperationsReasoningEngine', fact: String(f.description ?? f.finding ?? f) })
      );
      if (evidence.length > 3 && confidence === 'LOW') confidence = 'MEDIUM';
    }

    // ── Architecture risks ────────────────────────────────────────────────────
    const archResult = await (async () => {
      if (!archEng?.getRisks) return null;
      try { return await archEng.getRisks(); } catch { return null; }
    })();

    if (archResult) {
      const risks = Array.isArray(archResult) ? archResult : (archResult.risks ?? []);
      risks.slice(0, 3).forEach(r =>
        evidence.push({ source: 'ArchitectureIntelligenceEngine', fact: String(r.description ?? r.risk ?? r) })
      );
    }

    // ── Memory recall ─────────────────────────────────────────────────────────
    const memResult = await (async () => {
      if (!memRetriever?.retrieve) return null;
      try { return await memRetriever.retrieve(question, { limit: 3 }); } catch { return null; }
    })();

    if (memResult) {
      const hits = Array.isArray(memResult) ? memResult : (memResult.results ?? []);
      hits.slice(0, 3).forEach(h =>
        evidence.push({ source: 'MemoryRetriever', fact: String(h.content ?? h.text ?? h.fact ?? h) })
      );
      if (hits.length > 0 && confidence === 'LOW') confidence = 'MEDIUM';
    }

    // ── V1 domain context ─────────────────────────────────────────────────────
    if (v1Domains) {
      const domainNames = Array.isArray(v1Domains)
        ? v1Domains.map(d => d.key ?? d.name ?? d).join(', ')
        : (v1Domains.domains ?? []).map(d => d.key ?? d.name).join(', ');
      if (domainNames) {
        evidence.push({ source: 'V1LCIS:/api/domains', fact: `Active business domains: ${domainNames}` });
      }
    }

    // ── Final conclusion upgrade if evidence is strong ────────────────────────
    if (reasoningResult?.hypothesis) {
      conclusion = reasoningResult.hypothesis;
      if (evidence.length >= 5) confidence = 'HIGH';
    }

    const recommendedOwner = inferOwner(question, evidence);

    return {
      question,
      conclusion,
      priority,
      evidence,
      confidence,
      recommendedOwner,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * What should happen next across all domains?
   * Pulls the execution state from V1 + ops recommendations.
   * @returns {Promise<ExecutiveInsight>}
   */
  async whatShouldHappenNext() {
    return this._cached('whatShouldHappenNext', async () => {
      const [opsEng, v1Exec, v1Decision] = await Promise.allSettled([
        getOpsEngine(),
        fetchV1('/api/execution'),
        fetchV1('/api/decision-engine'),
      ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

      const evidence = [];
      let actions = [];

      // V1 execution blockers
      if (v1Exec) {
        const blockers = v1Exec.blockers ?? v1Exec.openBlockers ?? [];
        blockers.slice(0, 5).forEach(b =>
          evidence.push({ source: 'V1LCIS:/api/execution', fact: String(b.description ?? b.action ?? b) })
        );
        const nextActions = v1Exec.nextActions ?? v1Exec.actions ?? [];
        actions.push(...nextActions.slice(0, 5).map(a => String(a.action ?? a)));
      }

      // V1 decision engine
      if (v1Decision) {
        const ranked = v1Decision.rankedActions ?? v1Decision.recommendations ?? [];
        ranked.slice(0, 5).forEach(r =>
          evidence.push({ source: 'V1LCIS:/api/decision-engine', fact: String(r.action ?? r.recommendation ?? r) })
        );
        if (actions.length === 0) {
          actions.push(...ranked.slice(0, 3).map(r => String(r.action ?? r.recommendation ?? r)));
        }
      }

      // Ops recommendations
      const opsRecommendations = await (async () => {
        if (!opsEng?.getEngineeringRecommendations) return [];
        try {
          const recs = await opsEng.getEngineeringRecommendations();
          return Array.isArray(recs) ? recs : (recs.recommendations ?? []);
        } catch { return []; }
      })();

      opsRecommendations.slice(0, 3).forEach(r =>
        evidence.push({ source: 'OperationsReasoningEngine', fact: String(r.recommendation ?? r.action ?? r) })
      );

      if (actions.length === 0) {
        actions = opsRecommendations.slice(0, 3).map(r => String(r.action ?? r));
      }

      const conclusion = actions.length > 0
        ? `Top pending actions: (1) ${actions.slice(0, 3).join(' → (next) ')}`
        : 'No blocking actions found in connected sources. Check V1 LCIS at :3333 for live execution state.';

      return {
        question: 'What should happen next?',
        conclusion,
        priority: evidence.length >= 3 ? 'P1' : 'P2',
        evidence,
        confidence: evidence.length >= 5 ? 'HIGH' : evidence.length >= 2 ? 'MEDIUM' : 'LOW',
        recommendedOwner: 'engineering',
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * What is the highest-priority risk across all domains?
   * @returns {Promise<ExecutiveInsight>}
   */
  async highestPriorityRisk() {
    return this._cached('highestPriorityRisk', async () => {
      const [riskScorerEng, archEng, v1Security, v1Production] = await Promise.allSettled([
        getRiskScorer(),
        getArchEngine(),
        fetchV1('/api/security-intelligence'),
        fetchV1('/api/production-readiness-v2'),
      ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

      const evidence = [];
      let topRisk = null;
      let riskScore = 0;

      // Risk scorer across domains
      const DOMAINS = ['payments', 'orders', 'auth', 'identity', 'checkout', 'tenancy', 'webhooks', 'inventory'];
      const domainScores = await Promise.allSettled(
        DOMAINS.map(async d => {
          if (!riskScorerEng?.score) return null;
          try { return { domain: d, ...(await riskScorerEng.score({ target: d })) }; } catch { return null; }
        })
      ).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean));

      domainScores.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      if (domainScores[0]) {
        topRisk = domainScores[0];
        riskScore = topRisk.score ?? 0;
        evidence.push({
          source: 'RiskScorer',
          fact: `Highest risk domain: ${topRisk.domain} (score ${riskScore}/100)`,
        });
        domainScores.slice(1, 3).forEach(d =>
          evidence.push({ source: 'RiskScorer', fact: `Risk score for ${d.domain}: ${d.score ?? 0}/100` })
        );
      }

      // Architecture risks
      const archRisks = await (async () => {
        if (!archEng?.getRisks) return [];
        try {
          const r = await archEng.getRisks();
          return Array.isArray(r) ? r : (r.risks ?? []);
        } catch { return []; }
      })();

      archRisks.slice(0, 3).forEach(r =>
        evidence.push({ source: 'ArchitectureIntelligenceEngine', fact: String(r.description ?? r.risk ?? r) })
      );

      // V1 security intelligence
      if (v1Security) {
        const controls = v1Security.controls ?? v1Security.findings ?? [];
        controls.filter(c => c.status === 'FAIL' || c.severity === 'HIGH').slice(0, 3).forEach(c =>
          evidence.push({ source: 'V1LCIS:/api/security-intelligence', fact: String(c.description ?? c.name ?? c) })
        );
      }

      // V1 production readiness
      if (v1Production) {
        const blockers = v1Production.blockers ?? v1Production.noGoItems ?? [];
        blockers.slice(0, 3).forEach(b =>
          evidence.push({ source: 'V1LCIS:/api/production-readiness-v2', fact: String(b.description ?? b.blocker ?? b) })
        );
        if (blockers.length > 0 && riskScore < 70) riskScore = 70;
      }

      const conclusion = topRisk
        ? `Highest priority risk: ${topRisk.domain} domain (composite score ${riskScore}/100). ${archRisks[0] ? `Architecture concern: ${archRisks[0].description ?? archRisks[0].risk ?? archRisks[0]}` : ''}`
        : 'Risk scorer not connected. Check V1 LCIS at :3333/api/security-intelligence for live risk assessment.';

      return {
        question: 'What is the highest-priority risk?',
        conclusion,
        priority: scoreToPriority(riskScore),
        evidence,
        confidence: evidence.length >= 5 ? 'HIGH' : evidence.length >= 2 ? 'MEDIUM' : 'LOW',
        recommendedOwner: inferOwner('risk security', evidence),
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Executive leadership summary of overall platform state.
   * @returns {Promise<ExecutiveInsight>}
   */
  async whatLeadershipShouldKnow() {
    return this._cached('whatLeadershipShouldKnow', async () => {
      const [v1Readiness, v1Launch, v1Executive, v1ProductionHealth] = await Promise.allSettled([
        fetchV1('/api/production-readiness-v2'),
        fetchV1('/api/launch-command-center'),
        fetchV1('/api/executive-center'),
        fetchV1('/api/production-health'),
      ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

      const evidence = [];
      const keyFacts = [];

      if (v1Readiness) {
        const pct = v1Readiness.structuralPercent ?? v1Readiness.overallPercent ?? 0;
        keyFacts.push(`Platform structural readiness: ${pct}%`);
        evidence.push({ source: 'V1LCIS:/api/production-readiness-v2', fact: `Structural readiness: ${pct}%` });
        const verdict = v1Readiness.verdict ?? v1Readiness.launchVerdict ?? 'UNKNOWN';
        evidence.push({ source: 'V1LCIS:/api/production-readiness-v2', fact: `Launch verdict: ${verdict}` });
      }

      if (v1Launch) {
        const status = v1Launch.status ?? v1Launch.goNoGo ?? 'UNKNOWN';
        keyFacts.push(`Launch status: ${status}`);
        evidence.push({ source: 'V1LCIS:/api/launch-command-center', fact: `Launch command center status: ${status}` });
        const blockers = v1Launch.blockers ?? [];
        if (blockers.length > 0) {
          evidence.push({ source: 'V1LCIS:/api/launch-command-center', fact: `${blockers.length} launch blocker(s) active` });
        }
      }

      if (v1Executive) {
        const findings = v1Executive.keyFindings ?? v1Executive.findings ?? [];
        findings.slice(0, 3).forEach(f =>
          evidence.push({ source: 'V1LCIS:/api/executive-center', fact: String(f.description ?? f.finding ?? f) })
        );
      }

      if (v1ProductionHealth) {
        const status = v1ProductionHealth.status ?? v1ProductionHealth.overall ?? 'UNKNOWN';
        const color = v1ProductionHealth.color ?? v1ProductionHealth.signal ?? '';
        keyFacts.push(`Production health: ${status}${color ? ` (${color})` : ''}`);
        evidence.push({ source: 'V1LCIS:/api/production-health', fact: `Production health: ${status} ${color}` });
      }

      const notConnected = [];
      if (!v1Readiness) notConnected.push('V1LCIS /api/production-readiness-v2 (start: pnpm graph:v3)');
      if (!v1Launch) notConnected.push('V1LCIS /api/launch-command-center (start: pnpm graph:omega)');
      if (notConnected.length > 0) {
        evidence.push({ source: 'NOT CONNECTED', fact: `Live sources not connected: ${notConnected.join('; ')}` });
      }

      const conclusion = keyFacts.length > 0
        ? keyFacts.join(' | ')
        : 'V1 LCIS at :3333 not reachable. Start with: cd tools/graph-server && node server.mjs';

      return {
        question: 'What should leadership know?',
        conclusion,
        priority: 'P1',
        evidence,
        confidence: evidence.filter(e => e.source !== 'NOT CONNECTED').length >= 3 ? 'HIGH' : 'MEDIUM',
        recommendedOwner: 'leadership',
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Synthesise cross-domain intelligence for a set of domains.
   * @param {string[]} domains
   * @returns {Promise<ExecutiveInsight>}
   */
  async synthesizeAcrossDomains(domains) {
    const [riskScorerEng, correlationEng, v1Domains] = await Promise.allSettled([
      getRiskScorer(),
      getCorrelationEngine(),
      fetchV1('/api/domains'),
    ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

    const evidence = [];
    const domainList = domains?.length ? domains : ['payments', 'orders', 'auth', 'checkout'];

    // Risk per domain
    const riskResults = await Promise.allSettled(
      domainList.map(async d => {
        if (!riskScorerEng?.score) return { domain: d, score: 0 };
        try { return { domain: d, ...(await riskScorerEng.score({ target: d })) }; } catch { return { domain: d, score: 0 }; }
      })
    ).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean));

    riskResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    riskResults.forEach(r =>
      evidence.push({ source: 'RiskScorer', fact: `${r.domain}: ${r.score ?? 0}/100` })
    );

    // Cross-domain correlation
    if (correlationEng?.correlate) {
      for (const d of domainList.slice(0, 3)) {
        try {
          const corr = await correlationEng.correlate({ event: `cross-domain analysis: ${d}` });
          if (corr?.correlatedSignals?.length) {
            evidence.push({
              source: 'CorrelationEngine',
              fact: `${d} has ${corr.correlatedSignals.length} correlated signals`,
            });
          }
        } catch { /* degrade */ }
      }
    }

    // V1 domain metadata
    if (v1Domains) {
      const all = Array.isArray(v1Domains) ? v1Domains : (v1Domains.domains ?? []);
      const relevant = all.filter(d => domainList.includes(d.key ?? d.name));
      relevant.forEach(d =>
        evidence.push({ source: 'V1LCIS:/api/domains', fact: `Domain ${d.key ?? d.name}: ${d.description ?? d.summary ?? 'no summary'}` })
      );
    }

    const topRisk = riskResults[0];
    const conclusion = topRisk
      ? `Across ${domainList.length} domains, highest risk is ${topRisk.domain} (${topRisk.score ?? 0}/100). Evidence from ${evidence.length} sources.`
      : `Cross-domain synthesis for [${domainList.join(', ')}] — risk scorer not connected.`;

    return {
      question: `Cross-domain synthesis: ${domainList.join(', ')}`,
      conclusion,
      priority: scoreToPriority(topRisk?.score ?? 0),
      evidence,
      confidence: evidence.length >= 6 ? 'HIGH' : evidence.length >= 3 ? 'MEDIUM' : 'LOW',
      recommendedOwner: inferOwner(domainList.join(' '), evidence),
      timestamp: new Date().toISOString(),
    };
  }
}

export default new ExecutiveReasoningEngine();
