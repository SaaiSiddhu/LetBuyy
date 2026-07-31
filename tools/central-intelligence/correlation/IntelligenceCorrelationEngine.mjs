/**
 * LCIS Phase 16 — IntelligenceCorrelationEngine (Facade)
 *
 * The central facade of the Phase 16 correlation layer.  It orchestrates the
 * four specialised subsystems:
 *
 *   SignalCollector      → gather raw signals from every LCIS subsystem
 *   RootCauseAnalyzer   → rank probable root causes for an incident
 *   ImpactPredictor     → forward-propagate a change to affected services/domains
 *   RiskScorer          → composite 0–100 risk score
 *
 * All subsystem imports are lazy and optional.  Promise.allSettled is used
 * throughout so that a failure in any one source does NOT abort the whole
 * correlation.
 *
 * CorrelationResult schema:
 * {
 *   event: object,
 *   correlatedSignals: [{ subsystem, signal, strength }],
 *   rootCauseCandidates: [{ candidate, confidence, evidence }],
 *   impactPrediction: {
 *     services: string[],
 *     domains: string[],
 *     merchants: string,
 *     revenueAtRisk: 'NOT CONNECTED|<description>'
 *   },
 *   riskScore: number,
 *   correlationGraph: { nodes, edges },
 *   timestamp: string
 * }
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GRAPHIFY_OUT = resolve(REPO_ROOT, 'graphify-out');

const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333';

// ── Lazy subsystem accessors ───────────────────────────────────────────────

async function tryImport(rel) {
  try {
    const m = await import(new URL(rel, import.meta.url).href);
    return m.default ?? null;
  } catch { return null; }
}

async function getSignalCollector()    { return tryImport('./SignalCollector.mjs'); }
async function getRootCauseAnalyzer()  { return tryImport('./RootCauseAnalyzer.mjs'); }
async function getImpactPredictor()    { return tryImport('./ImpactPredictor.mjs'); }
async function getRiskScorer()         { return tryImport('./RiskScorer.mjs'); }

// Optional external subsystems (used for richer context)
async function getMemoryRetriever()    { return tryImport('../memory-engine/MemoryRetriever.mjs'); }
async function getGraphExplorer()      { return tryImport('../graph-engine/GraphExplorer.mjs'); }
async function getContextAssembler()   { return tryImport('../context-intelligence/ContextAssembler.mjs'); }
async function getDepGraphBuilder()    { return tryImport('../context-intelligence/DependencyGraphBuilder.mjs'); }
async function getIncidentSvc()        { return tryImport('../observability/IncidentDetectionService.mjs'); }
async function getAnomalySvc()         { return tryImport('../observability/AnomalyDetectionService.mjs'); }
async function getHealthSvc()          { return tryImport('../observability/HealthService.mjs'); }
async function getDriftDetector()      { return tryImport('../architecture-intelligence/ArchitectureDriftDetector.mjs'); }
async function getReasoningEngine()    { return tryImport('../reasoning/ReasoningEngine.mjs'); }

// ── LCIS V1 helper ─────────────────────────────────────────────────────────

async function fetchLCIS(path, params = {}) {
  try {
    const url = new URL(LCIS_BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Correlation graph helpers ──────────────────────────────────────────────

let _graphSeq = 0;

function newNode(type, id, label, data = {}) {
  return { id: id ?? `${type}_${++_graphSeq}`, type, label, ...data };
}

function newEdge(from, to, relation, strength = 0.5) {
  return { from, to, relation, strength };
}

// ── IntelligenceCorrelationEngine ─────────────────────────────────────────

class IntelligenceCorrelationEngine {

  /** Internal correlation-graph state (grows across calls in the same process). */
  #graph = { nodes: [], edges: [] };

  // ── correlate ─────────────────────────────────────────────────────────────

  /**
   * Correlate a platform event against all connected subsystems.
   *
   * @param {{
   *   type: string,
   *   domain?: string,
   *   timestamp?: string,
   *   details?: Record<string,unknown>
   * }} event
   * @returns {Promise<CorrelationResult>}
   */
  async correlate(event) {
    const start = Date.now();
    const component = event.domain ?? event.details?.component ?? event.type ?? '';

    const [collector, rca, predictor, scorer] = await Promise.all([
      getSignalCollector(),
      getRootCauseAnalyzer(),
      getImpactPredictor(),
      getRiskScorer(),
    ]);

    // Gather signals (30-min window)
    const signals = collector
      ? await collector.collectAll({ windowMs: 30 * 60 * 1000 }).catch(() => [])
      : [];

    // Build correlated signal list
    const correlatedSignals = this._correlateSignalsToEvent(event, signals);

    // Root cause candidates
    let rootCauseCandidates = [];
    if (rca) {
      rootCauseCandidates = await rca.analyze(
        { domain: event.domain, detectedAt: event.timestamp, description: event.type, ...event.details },
        signals
      ).catch(() => []);
    }

    // Impact prediction
    let impactPrediction = { services: [], domains: [], merchants: 'unknown', revenueAtRisk: 'NOT CONNECTED' };
    if (predictor) {
      const pred = await predictor.predict({ component, domain: event.domain, type: event.type }).catch(() => null);
      if (pred) {
        impactPrediction = {
          services: pred.affectedServices,
          domains: pred.affectedDomains,
          merchants: pred.affectedMerchants,
          revenueAtRisk: pred.revenueAtRisk,
          confidence: pred.confidence,
          blastRadius: pred.blastRadius,
          note: pred.note,
        };
      }
    }

    // Risk score
    let riskScore = 0;
    if (scorer) {
      const scoreResult = await scorer.score(component).catch(() => null);
      riskScore = scoreResult?.score ?? 0;
    }

    // Update correlation graph
    this._addEventToGraph(event, correlatedSignals, rootCauseCandidates);

    return {
      event,
      correlatedSignals,
      rootCauseCandidates: rootCauseCandidates.map((c) => ({
        candidate: c.cause,
        confidence: c.confidence,
        evidence: c.evidence,
        type: c.type,
      })),
      impactPrediction,
      riskScore,
      correlationGraph: this.getCorrelationGraph(),
      timestamp: new Date().toISOString(),
      processingMs: Date.now() - start,
    };
  }

  // ── correlateIncident ─────────────────────────────────────────────────────

  /**
   * Full incident correlation: link incident → recent deployments + arch drift
   * + anomalies + dependency graph → ranked rootCauseCandidates.
   *
   * @param {{
   *   id?: string,
   *   type?: string,
   *   domain?: string,
   *   detectedAt?: string,
   *   description?: string,
   *   severity?: string,
   *   metrics?: Record<string,unknown>
   * }} incident
   * @returns {Promise<{
   *   incident: object,
   *   rootCauseCandidates: object[],
   *   impactPrediction: object,
   *   riskScore: number,
   *   signals: object[],
   *   timestamp: string
   * }>}
   */
  async correlateIncident(incident) {
    const [collector, rca, predictor, scorer] = await Promise.all([
      getSignalCollector(),
      getRootCauseAnalyzer(),
      getImpactPredictor(),
      getRiskScorer(),
    ]);

    // Collect a broader 2-hour window for incident correlation
    const signals = collector
      ? await collector.collectAll({ windowMs: 2 * 60 * 60 * 1000 }).catch(() => [])
      : [];

    const [rcaResult, impactResult, riskResult] = await Promise.allSettled([
      rca ? rca.analyze(incident, signals) : Promise.resolve([]),
      predictor ? predictor.predict({ component: incident.domain ?? '', domain: incident.domain, type: 'incident' }) : Promise.resolve(null),
      scorer ? scorer.scoreDomain(incident.domain ?? '') : Promise.resolve(null),
    ]);

    const candidates = rcaResult.status === 'fulfilled' ? rcaResult.value : [];
    const impact = impactResult.status === 'fulfilled' ? impactResult.value : null;
    const riskScoreResult = riskResult.status === 'fulfilled' ? riskResult.value : null;

    // Update correlation graph
    this._addEventToGraph(
      { type: 'incident', domain: incident.domain, timestamp: incident.detectedAt, details: incident },
      signals.slice(0, 20),
      candidates
    );

    return {
      incident,
      rootCauseCandidates: candidates,
      impactPrediction: impact ?? { services: [], domains: [], merchants: 'unknown', revenueAtRisk: 'NOT CONNECTED' },
      riskScore: riskScoreResult?.score ?? 0,
      riskBreakdown: riskScoreResult?.breakdown ?? {},
      signals: signals.slice(0, 50),
      timestamp: new Date().toISOString(),
    };
  }

  // ── getRootCauseCandidates ────────────────────────────────────────────────

  /**
   * Return ranked root-cause candidates for an incident, with subsystem
   * agreement counts.
   *
   * @param {object} incident
   * @returns {Promise<Array<{candidate:string,confidence:number,evidence:string[],subsystemsAgreeing:number}>>}
   */
  async getRootCauseCandidates(incident) {
    const [collector, rca] = await Promise.all([getSignalCollector(), getRootCauseAnalyzer()]);
    const signals = collector
      ? await collector.collectAll({ windowMs: 2 * 60 * 60 * 1000 }).catch(() => [])
      : [];
    const candidates = rca
      ? await rca.analyze(incident, signals).catch(() => [])
      : [];

    // Count how many signal types "agree" with each candidate type
    const signalTypes = new Set(signals.filter((s) => s.connected).map((s) => s.subsystem));

    return candidates.map((c) => ({
      candidate: c.cause,
      confidence: c.confidence,
      evidence: c.evidence,
      reasoning: c.reasoning,
      type: c.type,
      subsystemsAgreeing: this._countAgreement(c, signalTypes),
    }));
  }

  // ── predictImpact ─────────────────────────────────────────────────────────

  /**
   * Predict the impact of a change through the dependency + cross-domain graph.
   *
   * @param {{
   *   component?: string,
   *   domain?: string,
   *   type?: 'code'|'schema'|'config'|'deployment',
   *   changedFiles?: string[],
   *   description?: string
   * }} change
   * @returns {Promise<object>}
   */
  async predictImpact(change) {
    const predictor = await getImpactPredictor();
    if (!predictor) {
      return {
        error: 'ImpactPredictor not available',
        services: [],
        domains: [],
        merchants: 'unknown',
        revenueAtRisk: 'NOT CONNECTED',
      };
    }
    return predictor.predict(change);
  }

  // ── getRiskScore ──────────────────────────────────────────────────────────

  /**
   * Compute a composite 0–100 risk score for any target.
   *
   * @param {string|object} target component name, domain key, or change object
   * @returns {Promise<{score:number,breakdown:object,note:string}>}
   */
  async getRiskScore(target) {
    const scorer = await getRiskScorer();
    if (!scorer) return { score: 0, breakdown: {}, note: 'RiskScorer not available' };
    return scorer.score(target);
  }

  // ── getCorrelationGraph ───────────────────────────────────────────────────

  /**
   * Return the in-process correlation graph.
   * Nodes = events; edges = correlation relationships.
   *
   * @returns {{ nodes: object[], edges: object[] }}
   */
  getCorrelationGraph() {
    return {
      nodes: [...this.#graph.nodes],
      edges: [...this.#graph.edges],
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Map raw signals into correlated-signal entries with strength scores.
   */
  _correlateSignalsToEvent(event, signals) {
    const domain = (event.domain ?? '').toLowerCase();
    return signals.map((s) => {
      let strength = 0.3; // base: any signal is weakly correlated
      if (s.payload?.domain === domain || s.subsystem.toLowerCase().includes(domain)) strength += 0.3;
      if (s.connected) strength += 0.2;
      // Temporal proximity: signal within last 15 min gets a boost
      const sigTs = new Date(s.timestamp).getTime();
      const evTs = new Date(event.timestamp ?? Date.now()).getTime();
      const deltaSec = Math.abs(evTs - sigTs) / 1000;
      if (deltaSec < 900) strength += 0.2;
      return {
        subsystem: s.subsystem,
        signal: s.type,
        strength: Math.min(1, strength),
        connected: s.connected,
        timestamp: s.timestamp,
      };
    }).filter((s) => s.strength > 0.2);
  }

  /**
   * Count connected subsystems that agree with a candidate's type/domain.
   */
  _countAgreement(candidate, signalTypes) {
    let count = 0;
    if (candidate.type === 'temporal' && signalTypes.has('GitHistory')) count++;
    if (candidate.type === 'temporal' && signalTypes.has('LCIS_V1')) count++;
    if (candidate.type === 'structural' && signalTypes.has('DependencyGraphBuilder')) count++;
    if (candidate.type === 'structural' && signalTypes.has('GraphExplorer')) count++;
    if (candidate.type === 'historical' && signalTypes.has('MemoryRetriever')) count++;
    if (signalTypes.has('IncidentDetectionService')) count++;
    if (signalTypes.has('AnomalyDetectionService') && candidate.confidence > 0.4) count++;
    return count;
  }

  /**
   * Add an event and its correlations to the internal graph.
   */
  _addEventToGraph(event, signals, candidates) {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.#graph.nodes.push(
      newNode('event', eventId, `${event.type}@${event.domain ?? 'unknown'}`, {
        domain: event.domain,
        timestamp: event.timestamp ?? new Date().toISOString(),
      })
    );

    // Signal nodes
    for (const sig of signals.slice(0, 20)) {
      const sigId = `signal_${sig.subsystem}_${sig.signal}_${Date.now()}`;
      this.#graph.nodes.push(
        newNode('signal', sigId, `${sig.subsystem}:${sig.signal}`, { connected: sig.connected })
      );
      this.#graph.edges.push(newEdge(sigId, eventId, 'correlated_with', sig.strength));
    }

    // Root cause nodes
    for (const cand of candidates.slice(0, 5)) {
      const rcId = `rc_${++_graphSeq}`;
      this.#graph.nodes.push(
        newNode('root_cause', rcId, cand.cause ?? cand.candidate, { confidence: cand.confidence, type: cand.type })
      );
      this.#graph.edges.push(newEdge(rcId, eventId, 'caused', cand.confidence ?? 0.5));
    }

    // Trim graph to last 500 nodes to prevent unbounded growth
    if (this.#graph.nodes.length > 500) {
      this.#graph.nodes = this.#graph.nodes.slice(-500);
      const nodeIds = new Set(this.#graph.nodes.map((n) => n.id));
      this.#graph.edges = this.#graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
    }
  }
}

export default new IntelligenceCorrelationEngine();
