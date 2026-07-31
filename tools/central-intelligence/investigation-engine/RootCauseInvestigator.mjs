/**
 * RootCauseInvestigator — autonomous root-cause investigation.
 *
 * Orchestrates:
 *  - RootCauseAnalyzer (temporal + structural + historical correlation)
 *  - IntelligenceCorrelationEngine (cross-signal correlation)
 *  - IncidentReasoner (ranked causes + investigation suggestions)
 *  - DeploymentReasoner (correlate incident to recent deployments)
 *  - MemoryRetriever (recall similar past incidents from 'incidents' collection)
 *
 * Returns ranked RootCauseCandidate[] with full reasoning chains.
 */

const V1_BASE = 'http://localhost:3333';

// ─── lazy module loader ──────────────────────────────────────────────────────

const _cache = new Map();

async function loadModule(specifier) {
  if (_cache.has(specifier)) return _cache.get(specifier);
  try {
    const mod = (await import(specifier)).default;
    _cache.set(specifier, mod);
    return mod;
  } catch {
    _cache.set(specifier, null);
    return null;
  }
}

// ─── V1 fetch helper ─────────────────────────────────────────────────────────

async function fetchV1(endpoint, timeout = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${V1_BASE}${endpoint}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function extractDomain(incident) {
  if (!incident) return 'unknown';
  return (
    incident.domain ||
    incident.component ||
    incident.service ||
    incident.subject ||
    (typeof incident === 'string' ? incident : 'unknown')
  );
}

function normalizeCandidates(raw, source) {
  if (!raw) return [];
  // handle arrays directly
  if (Array.isArray(raw)) {
    return raw.map((c, i) => ({
      id: c.id || `${source}-${i}`,
      cause: c.cause || c.description || c.name || String(c),
      confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
      reasoning: c.reasoning || c.chain || c.rationale || [],
      source,
      evidence: c.evidence || [],
      relatedDeployment: c.relatedDeployment || null,
    }));
  }
  // handle object with candidates/results field
  const arr = raw.candidates || raw.results || raw.causes || raw.rootCauses || [];
  return normalizeCandidates(arr, source);
}

// ─── RootCauseInvestigator ───────────────────────────────────────────────────

class RootCauseInvestigator {
  /**
   * Full root-cause investigation for an incident.
   * Returns ranked candidates with reasoning chains.
   */
  async investigate(incident) {
    const domain = extractDomain(incident);

    // Collect signals first
    const sc = await loadModule('../correlation/SignalCollector.mjs');
    let signals = [];
    if (sc) {
      try {
        const collected = await sc.collectAll({ windowMs: 60 * 60 * 1000 });
        signals = Array.isArray(collected) ? collected : [];
      } catch {
        // graceful
      }
    }

    // Run all sources in parallel
    const [rcaResult, correlationResult, reasoningResult, deploymentResult, memoryResult] =
      await Promise.allSettled([
        this._runRootCauseAnalyzer(incident, signals),
        this._runCorrelationEngine(incident),
        this._runIncidentReasoner(incident, domain),
        this.correlateToDeployment(incident),
        this.recallSimilar(incident),
      ]);

    // Merge candidates from all sources
    let allCandidates = [
      ...(rcaResult.status === 'fulfilled' ? rcaResult.value : []),
      ...(correlationResult.status === 'fulfilled' ? correlationResult.value : []),
      ...(reasoningResult.status === 'fulfilled' ? reasoningResult.value : []),
    ];

    // Augment candidates with deployment correlation
    const deployCorr = deploymentResult.status === 'fulfilled' ? deploymentResult.value : null;
    if (deployCorr?.correlated) {
      allCandidates = allCandidates.map((c) => ({
        ...c,
        relatedDeployment: deployCorr.deployment || null,
        reasoning: [
          ...c.reasoning,
          `Correlated to deployment: ${deployCorr.deployment?.subject || 'recent commit'}`,
        ],
      }));
    }

    // Augment with similar past incidents
    const similar = memoryResult.status === 'fulfilled' ? memoryResult.value : [];
    if (similar.length > 0) {
      allCandidates = allCandidates.map((c) => ({
        ...c,
        reasoning: [
          ...c.reasoning,
          `Similar past incidents recalled: ${similar.length} (source: incidents memory collection)`,
        ],
        similarIncidents: similar,
      }));
    }

    // De-duplicate by cause string (case-insensitive), keeping highest confidence
    const deduped = new Map();
    for (const c of allCandidates) {
      const key = (c.cause || '').toLowerCase().trim();
      if (!deduped.has(key) || deduped.get(key).confidence < c.confidence) {
        deduped.set(key, c);
      }
    }

    const ranked = this.rankCandidates([...deduped.values()]);

    // Get investigation suggestions from IncidentReasoner
    let suggestions = [];
    const v1rb = await fetchV1(`/api/runbook?domain=${encodeURIComponent(domain)}`);
    const ir = await loadModule('../reasoning/IncidentReasoner.mjs');
    if (ir && ranked.length > 0) {
      try {
        suggestions = ir.suggestInvestigation(incident, domain, v1rb || {});
        if (!Array.isArray(suggestions)) suggestions = [suggestions].filter(Boolean);
      } catch {
        // graceful
      }
    }

    return {
      domain,
      candidates: ranked,
      suggestions,
      deploymentCorrelation: deployCorr,
      similarIncidents: similar,
      confidence: ranked.length > 0 ? ranked[0].confidence : 0,
      investigatedAt: new Date().toISOString(),
    };
  }

  /**
   * Rank candidates by confidence (descending), then by evidence count.
   */
  rankCandidates(candidates) {
    return [...candidates].sort((a, b) => {
      const confDiff = (b.confidence || 0) - (a.confidence || 0);
      if (Math.abs(confDiff) > 0.01) return confDiff;
      return (b.evidence?.length || 0) - (a.evidence?.length || 0);
    });
  }

  /**
   * Correlate the incident to recent deployments via DeploymentReasoner.
   */
  async correlateToDeployment(incident) {
    const dr = await loadModule('../reasoning/DeploymentReasoner.mjs');
    if (!dr) return { correlated: false, reason: 'DeploymentReasoner unavailable' };

    try {
      const deployState = await fetchV1('/api/deployment-state');
      const correlation = await dr.correlateToIncidents(deployState || {});
      return {
        correlated: !!(correlation && Object.keys(correlation).length > 0),
        deployment: deployState,
        correlation,
      };
    } catch (err) {
      return { correlated: false, reason: err.message };
    }
  }

  /**
   * Recall similar past incidents from the 'incidents' memory collection.
   */
  async recallSimilar(incident) {
    const mr = await loadModule('../memory-engine/MemoryRetriever.mjs');
    if (!mr) return [];

    const domain = extractDomain(incident);
    const query =
      typeof incident === 'string'
        ? incident
        : `${domain} incident ${incident.error || incident.message || incident.description || ''}`.trim();

    try {
      const results = await mr.retrieve(query, {
        collections: ['incidents'],
        limit: 5,
        minScore: 0.5,
      });
      return Array.isArray(results) ? results : results?.results || [];
    } catch {
      // Qdrant not wired
      return [];
    }
  }

  /**
   * Confidence score for a single candidate.
   * Looks at: evidence count, source agreement, deployment correlation.
   */
  getConfidence(candidate) {
    if (!candidate) return 0;
    if (typeof candidate.confidence === 'number') return candidate.confidence;

    let score = 0.3; // base
    const evidenceBoost = Math.min((candidate.evidence?.length || 0) * 0.1, 0.3);
    const reasoningBoost = Math.min((candidate.reasoning?.length || 0) * 0.05, 0.2);
    const deployBoost = candidate.relatedDeployment ? 0.15 : 0;
    const similarBoost = (candidate.similarIncidents?.length || 0) > 0 ? 0.05 : 0;

    score += evidenceBoost + reasoningBoost + deployBoost + similarBoost;
    return Math.min(score, 0.95);
  }

  // ─── private orchestration helpers ─────────────────────────────────────────

  async _runRootCauseAnalyzer(incident, signals) {
    const rca = await loadModule('../correlation/RootCauseAnalyzer.mjs');
    if (!rca) return [];
    try {
      const result = await rca.analyze(incident, signals);
      return normalizeCandidates(result, 'RootCauseAnalyzer');
    } catch {
      return [];
    }
  }

  async _runCorrelationEngine(incident) {
    const ice = await loadModule('../correlation/IntelligenceCorrelationEngine.mjs');
    if (!ice) return [];
    try {
      const result = await ice.getRootCauseCandidates(incident);
      return normalizeCandidates(result, 'IntelligenceCorrelationEngine');
    } catch {
      return [];
    }
  }

  async _runIncidentReasoner(incident, domain) {
    const ir = await loadModule('../reasoning/IncidentReasoner.mjs');
    if (!ir) return [];
    try {
      const [rankedCauses, mostAffected] = await Promise.allSettled([
        ir.rankCauses(incident),
        ir.getMostLikelyAffected(incident),
      ]);

      const causes = rankedCauses.status === 'fulfilled' ? rankedCauses.value : [];
      const affected = mostAffected.status === 'fulfilled' ? mostAffected.value : [];

      const candidates = normalizeCandidates(causes, 'IncidentReasoner');

      // Tag most likely affected onto all candidates
      if (affected.length > 0) {
        return candidates.map((c) => ({
          ...c,
          mostLikelyAffected: affected,
          reasoning: [...c.reasoning, `Most likely affected: ${JSON.stringify(affected).slice(0, 100)}`],
        }));
      }
      return candidates;
    } catch {
      return [];
    }
  }
}

export default new RootCauseInvestigator();
