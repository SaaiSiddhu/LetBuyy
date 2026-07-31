/**
 * LCIS V2 — AgentFramework
 *
 * Base class for all LCIS V2 agents. Every agent shares the same intelligence
 * pipeline: Memory → Graph → V1 LCIS → Health. One failing source degrades
 * gracefully; it never crashes the agent.
 *
 * @module AgentFramework
 */

import MemoryRetriever from '../memory-engine/MemoryRetriever.mjs';
import GraphQueryEngine from '../graph-engine/GraphQueryEngine.mjs';
import BrowserIntelligenceEngine from '../browser-intelligence/BrowserIntelligenceEngine.mjs';
import KnowledgeAcquisitionService from '../knowledge-engine/KnowledgeAcquisitionService.mjs';
import HealthService from '../observability/HealthService.mjs';

const LCIS_V1_URL = process.env.LCIS_V1_URL || 'http://localhost:3333';
const FETCH_TIMEOUT_MS = 10_000;

/**
 * @typedef {{
 *   agent: string,
 *   question: string,
 *   answer: string,
 *   sources: Array<{type:string,ref:string,score?:number}>,
 *   confidence: number,
 *   executionMs: number,
 *   toolsUsed: string[],
 * }} AgentResponse
 */

export class AgentFramework {
  /**
   * @param {string} name
   * @param {string[]} capabilities
   */
  constructor(name, capabilities = []) {
    this.name = name;
    this.capabilities = capabilities;
    this._logger = [];
  }

  // ── Shared intelligence context ───────────────────────────────────────────

  /**
   * Assemble a context window for a question by querying all intelligence
   * sources in parallel. Each source failure is caught individually and logged
   * as a degraded source — it never throws.
   *
   * @param {string} question
   * @returns {Promise<{
   *   memory: Awaited<ReturnType<MemoryRetriever['retrieveForContext']>>|null,
   *   graph: ReturnType<GraphQueryEngine['queryLocal']>|null,
   *   lcis: unknown|null,
   *   health: Awaited<ReturnType<HealthService['getHealth']>>|null,
   *   sources: Array<{type:string,ref:string,score?:number}>,
   * }>}
   */
  async assembleContext(question) {
    const [memoryResult, graphResult, healthResult] = await Promise.allSettled([
      MemoryRetriever.retrieveForContext(question),
      Promise.resolve(GraphQueryEngine.queryLocal(question)),
      HealthService.getHealth(),
    ]);

    const memory = memoryResult.status === 'fulfilled'
      ? memoryResult.value
      : (this.log(`assembleContext: memory degraded — ${memoryResult.reason?.message}`, 'warn'), null);

    const graph = graphResult.status === 'fulfilled'
      ? graphResult.value
      : (this.log(`assembleContext: graph degraded — ${graphResult.reason?.message}`, 'warn'), null);

    const health = healthResult.status === 'fulfilled'
      ? healthResult.value
      : (this.log(`assembleContext: health degraded — ${healthResult.reason?.message}`, 'warn'), null);

    // Derive LCIS V1 endpoint from the question — use /api/search-v2 as default
    const lcis = await this.useLCISV1(`/api/search-v2?q=${encodeURIComponent(question)}`).catch((err) => {
      this.log(`assembleContext: lcis degraded — ${err.message}`, 'warn');
      return null;
    });

    // Aggregate source metadata
    const sources = [];
    if (memory) {
      for (const s of memory.sources.slice(0, 5)) {
        sources.push({ type: 'memory', ref: s.source, score: s.score });
      }
    }
    if (graph?.success) {
      sources.push({ type: 'graph', ref: `graphrag:local:${question.slice(0, 60)}` });
    }
    if (lcis) {
      sources.push({ type: 'lcis-v1', ref: `${LCIS_V1_URL}/api/search-v2` });
    }
    if (health) {
      sources.push({ type: 'health', ref: 'HealthService' });
    }

    return { memory, graph, lcis, health, sources };
  }

  /**
   * Execute a question through the agent pipeline:
   * 1. Assemble context
   * 2. Call agent-specific tools (subclass overrides `_gatherTools`)
   * 3. Synthesise answer
   *
   * @param {string} question
   * @param {{ maxTokens?: number, includeHealth?: boolean }} [options]
   * @returns {Promise<AgentResponse>}
   */
  async execute(question, options = {}) {
    const startMs = Date.now();
    const toolsUsed = [];

    const ctx = await this.assembleContext(question);
    toolsUsed.push('memory', 'graph', 'lcis-v1', 'health');

    // Subclass hook — additional domain-specific tools
    let extraData = null;
    if (typeof this._gatherTools === 'function') {
      try {
        extraData = await this._gatherTools(question, ctx, options);
        if (extraData?._toolsUsed) {
          toolsUsed.push(...extraData._toolsUsed);
        }
      } catch (err) {
        this.log(`execute: _gatherTools failed — ${err.message}`, 'warn');
      }
    }

    const answer = this._synthesise(question, ctx, extraData);
    const confidence = this._computeConfidence(ctx, extraData);
    const executionMs = Date.now() - startMs;

    return {
      agent: this.name,
      question,
      answer,
      sources: ctx.sources,
      confidence,
      executionMs,
      toolsUsed: [...new Set(toolsUsed)],
    };
  }

  // ── Individual intelligence tools ─────────────────────────────────────────

  /**
   * Query memory across all collections.
   * @param {string} query
   */
  async useMemory(query) {
    return MemoryRetriever.retrieveForContext(query);
  }

  /**
   * Query the GraphRAG knowledge graph (local entity-level query).
   * @param {string} query
   */
  useGraph(query) {
    return GraphQueryEngine.queryLocal(query);
  }

  /**
   * Capture browser evidence for a URL.
   * @param {string} url
   */
  async useBrowser(url) {
    return BrowserIntelligenceEngine.captureEvidence(url, `${this.name}-${Date.now()}`);
  }

  /**
   * Search the knowledge corpus.
   * @param {string} query
   */
  async useKnowledge(query) {
    // KnowledgeAcquisitionService doesn't expose a search method — route via memory
    return MemoryRetriever.retrieve(query, { limit: 10 });
  }

  /**
   * Fetch a V1 LCIS API endpoint with a hard timeout.
   * @param {string} endpoint  e.g. '/api/runbook?domain=payments'
   * @returns {Promise<unknown>}
   */
  async useLCISV1(endpoint) {
    const url = `${LCIS_V1_URL}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`V1 LCIS ${endpoint} returned HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Structured logger. Messages are buffered in `this._logger`.
   * @param {string} message
   * @param {'info'|'warn'|'error'} [level]
   */
  log(message, level = 'info') {
    const entry = { level, message, ts: new Date().toISOString(), agent: this.name };
    this._logger.push(entry);
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[LCIS][${this.name}][${level.toUpperCase()}] ${message}`);
  }

  // ── Synthesis helpers (overridable by subclasses) ─────────────────────────

  /**
   * Build a plain-text answer from assembled context.
   * Subclasses may override for richer synthesis.
   * @param {string} question
   * @param {Awaited<ReturnType<AgentFramework['assembleContext']>>} ctx
   * @param {unknown} extraData
   * @returns {string}
   */
  _synthesise(question, ctx, extraData) {
    const parts = [];

    if (ctx.graph?.success && ctx.graph.answer) {
      parts.push(`[Graph] ${ctx.graph.answer.slice(0, 1000)}`);
    }
    if (ctx.memory?.context) {
      parts.push(`[Memory] ${ctx.memory.context.slice(0, 800)}`);
    }
    if (ctx.lcis) {
      const lcisText = typeof ctx.lcis === 'string'
        ? ctx.lcis.slice(0, 500)
        : JSON.stringify(ctx.lcis).slice(0, 500);
      parts.push(`[LCIS V1] ${lcisText}`);
    }
    if (extraData && typeof extraData === 'object' && extraData._summary) {
      parts.push(`[Domain] ${String(extraData._summary).slice(0, 600)}`);
    }

    return parts.length > 0
      ? parts.join('\n\n')
      : `Agent ${this.name} could not find sufficient context for: ${question}`;
  }

  /**
   * Compute a 0–1 confidence score from available sources.
   * @param {Awaited<ReturnType<AgentFramework['assembleContext']>>} ctx
   * @param {unknown} _extraData
   * @returns {number}
   */
  _computeConfidence(ctx, _extraData) {
    let score = 0;
    let total = 0;

    if (ctx.memory !== null) {
      score += ctx.memory.relevanceScore ?? 0;
      total++;
    }
    if (ctx.graph !== null) {
      score += ctx.graph.success ? 0.7 : 0.1;
      total++;
    }
    if (ctx.lcis !== null) {
      score += 0.6;
      total++;
    }
    if (ctx.health !== null) {
      score += ctx.health.overall === 'HEALTHY' ? 0.8 : 0.4;
      total++;
    }

    return total > 0 ? Math.round((score / total) * 1000) / 1000 : 0;
  }
}

export default AgentFramework;
