/**
 * LCIS V2 — ResponseSynthesizer
 *
 * Merges V1 structural data and V2 live/memory findings into a single
 * typed answer object.  No external deps — pure transformation logic.
 *
 * Answer schema:
 *   {
 *     question:           string,
 *     answer:             string,
 *     confidence:         'HIGH' | 'MEDIUM' | 'LOW',
 *     sources:            Array<{name,type,excerpt,url}>,
 *     structuralFindings: unknown[],
 *     liveFindings:       unknown[],
 *     recommendations:    string[],
 *     timestamp:          string   // ISO-8601
 *   }
 *
 * @module ResponseSynthesizer
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely stringify an arbitrary value into a short excerpt (≤ 300 chars).
 */
function toExcerpt(value) {
  if (value === null || value === undefined) return '';
  const raw =
    typeof value === 'string'
      ? value
      : JSON.stringify(value, null, 0);
  return raw.length > 300 ? raw.slice(0, 297) + '…' : raw;
}

/**
 * Derive a human-readable source name from a path or key string.
 */
function labelFrom(identifier) {
  if (!identifier) return 'Unknown';
  return String(identifier)
    .replace(/^\/api\//, '')
    .replace(/[?&].*$/, '')          // strip query string
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Guess the source type from its identifier.
 */
function typeFrom(identifier) {
  const id = String(identifier || '');
  if (id.startsWith('/api/')) return 'v1-structural';
  if (id.includes('memory') || id.includes('graph')) return 'v2-intelligence';
  if (id.includes('live') || id.includes('telemetry')) return 'live-data';
  return 'intelligence';
}

// ---------------------------------------------------------------------------
// ResponseSynthesizer
// ---------------------------------------------------------------------------

class ResponseSynthesizer {
  /**
   * Rank sources by data richness — prefer arrays/objects over scalars.
   * @param {Array<{name:string, data:unknown}>} sources
   * @returns {Array<{name:string, data:unknown}>}
   */
  rankSources(sources) {
    return [...sources].sort((a, b) => {
      const scoreOf = (s) => {
        if (!s.data) return 0;
        if (Array.isArray(s.data)) return s.data.length + 2;
        if (typeof s.data === 'object') return Object.keys(s.data).length + 1;
        return 1;
      };
      return scoreOf(b) - scoreOf(a);
    });
  }

  /**
   * Merge structural (V1) and live (V2) findings into consolidated arrays.
   * @param {unknown[]} structural - raw V1 data objects
   * @param {unknown[]} live       - raw V2 memory / graph entries
   * @returns {{structuralFindings:unknown[], liveFindings:unknown[]}}
   */
  mergeStructuralAndLive(structural, live) {
    const structuralFindings = structural
      .filter(Boolean)
      .flatMap((item) => {
        if (Array.isArray(item)) return item;
        if (item && typeof item === 'object') return [item];
        return [];
      });

    const liveFindings = (live || [])
      .filter(Boolean)
      .flatMap((item) => {
        if (Array.isArray(item)) return item;
        if (item && typeof item === 'object') return [item];
        return [];
      });

    return { structuralFindings, liveFindings };
  }

  /**
   * Derive answer prose and recommendations from ranked sources.
   * @param {Array<{path?:string, data:unknown}>} sources - already ranked
   * @returns {{answer:string, recommendations:string[]}}
   */
  formatAnswer(sources) {
    if (!sources || sources.length === 0) {
      return {
        answer:
          'No data was available from the LCIS V1 or V2 intelligence layers for this question. ' +
          'Ensure the V1 server is running on port 3333 and graphify-out artefacts are present.',
        recommendations: ['Run pnpm graph:omega to rebuild all intelligence layers.'],
      };
    }

    // Build answer from the richest source
    const top = sources[0];
    const topData = top?.data;
    let answer = '';

    if (typeof topData === 'string') {
      answer = topData;
    } else if (topData && typeof topData === 'object') {
      // Look for common prose keys in LCIS response shapes
      const proseKeys = [
        'answer', 'summary', 'description', 'explanation',
        'verdict', 'status', 'message', 'insight',
      ];
      for (const key of proseKeys) {
        if (typeof topData[key] === 'string') {
          answer = topData[key];
          break;
        }
      }
      if (!answer) {
        answer = `Structural analysis complete. ${sources.length} intelligence source(s) consulted.`;
      }
    } else {
      answer = `Intelligence retrieved from ${sources.length} source(s).`;
    }

    // Build recommendations from all sources
    const recommendations = [];
    for (const src of sources) {
      if (!src.data || typeof src.data !== 'object') continue;
      const data = src.data;
      const recKeys = ['recommendations', 'actions', 'next_steps', 'fixes', 'blockers'];
      for (const key of recKeys) {
        const val = data[key];
        if (Array.isArray(val)) {
          recommendations.push(...val.filter((v) => typeof v === 'string').slice(0, 3));
        } else if (typeof val === 'string') {
          recommendations.push(val);
        }
      }
    }

    return { answer, recommendations: [...new Set(recommendations)].slice(0, 10) };
  }

  /**
   * Compute confidence level based on source count and data richness.
   * @param {Array<{data:unknown}>} rankedSources
   * @returns {'HIGH'|'MEDIUM'|'LOW'}
   */
  #computeConfidence(rankedSources) {
    const nonEmpty = rankedSources.filter((s) => {
      if (!s.data) return false;
      if (Array.isArray(s.data)) return s.data.length > 0;
      if (typeof s.data === 'object') return Object.keys(s.data).length > 0;
      return true;
    });
    if (nonEmpty.length >= 3) return 'HIGH';
    if (nonEmpty.length >= 1) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Format the answer for a specific consumer (claude | human | api).
   * Currently a pass-through — extend for format-specific rendering.
   * @param {object} answer
   * @param {'claude'|'human'|'api'} consumer
   * @returns {object}
   */
  formatForConsumer(answer, consumer = 'api') {
    if (consumer === 'claude') {
      // Return a terse version for LLM chaining
      return {
        question: answer.question,
        answer: answer.answer,
        confidence: answer.confidence,
        structuralFindings: answer.structuralFindings?.slice(0, 5),
        recommendations: answer.recommendations,
        timestamp: answer.timestamp,
      };
    }
    return answer;
  }

  /**
   * Master synthesis entry point.
   *
   * @param {string} question
   * @param {{
   *   v1:   Array<{path:string, data:unknown}>,
   *   v2:   {memory:unknown[], graph:unknown},
   *   agent?: string,
   *   agentResult?: unknown
   * }} sources
   * @returns {object}  Full answer schema
   */
  synthesize(question, sources = {}) {
    const { v1 = [], v2 = {}, agentResult } = sources;

    // Build a flat ranked list of all raw source objects
    const rawSources = [
      ...v1.map((s) => ({ path: s.path, data: s.data })),
      ...(v2.memory || []).map((m, i) => ({
        path: `memory[${i}]`,
        data: m,
      })),
      ...(v2.graph ? [{ path: 'graph', data: v2.graph }] : []),
      ...(agentResult ? [{ path: 'agent', data: agentResult }] : []),
    ];

    const ranked = this.rankSources(rawSources);

    // Structural = V1 paths; live = V2 memory + graph
    const v1Data = v1.map((s) => s.data);
    const v2Data = [
      ...(v2.memory || []),
      ...(v2.graph ? [v2.graph] : []),
      ...(agentResult ? [agentResult] : []),
    ];
    const { structuralFindings, liveFindings } = this.mergeStructuralAndLive(v1Data, v2Data);

    const { answer, recommendations } = this.formatAnswer(ranked);
    const confidence = this.#computeConfidence(ranked);

    // Build typed source list
    const typedSources = ranked.slice(0, 8).map((s) => ({
      name: labelFrom(s.path),
      type: typeFrom(s.path),
      excerpt: toExcerpt(s.data),
      url:
        s.path && s.path.startsWith('/')
          ? `http://localhost:3333${s.path}`
          : null,
    }));

    return {
      question,
      answer,
      confidence,
      sources: typedSources,
      structuralFindings,
      liveFindings,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }
}

export default new ResponseSynthesizer();
