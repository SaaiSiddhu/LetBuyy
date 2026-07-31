/**
 * LCIS Memory Engine — MemoryRetriever
 *
 * High-level retrieval layer over MemoryService.
 * Merges results across multiple collections, ranks by score,
 * and constructs context windows for LLM consumption.
 *
 * @module MemoryRetriever
 */

import MemoryService from './MemoryService.mjs';

const DEFAULT_LIMIT = 10;
const DEFAULT_MIN_SCORE = 0.3;
const CHARS_PER_TOKEN = 4;

class MemoryRetriever {
  /**
   * Search across one or more collections and merge results ranked by score.
   * @param {string} query
   * @param {{
   *   collections?: string[],
   *   limit?: number,
   *   minScore?: number,
   *   filter?: Record<string,unknown>
   * }} options
   * @returns {Promise<Array<{id:string,score:number,payload:Record<string,unknown>,collection:string}>>}
   */
  async retrieve(query, {
    collections = MemoryService.collectionNames,
    limit = DEFAULT_LIMIT,
    minScore = DEFAULT_MIN_SCORE,
    filter,
  } = {}) {
    const perCollection = Math.max(1, Math.ceil(limit / collections.length));

    const resultSets = await Promise.allSettled(
      collections.map((col) =>
        MemoryService.search(query, {
          collection: col,
          limit: perCollection,
          filter,
          minScore,
        }).then((hits) => hits.map((h) => ({ ...h, collection: col })))
      )
    );

    /** @type {Array<{id:string,score:number,payload:Record<string,unknown>,collection:string}>} */
    const merged = [];

    for (const result of resultSets) {
      if (result.status === 'fulfilled') {
        merged.push(...result.value);
      } else {
        console.warn('[MemoryRetriever] retrieve: collection search failed:', result.reason?.message);
      }
    }

    // Deduplicate by id, keep highest score
    /** @type {Map<string,typeof merged[0]>} */
    const deduped = new Map();
    for (const hit of merged) {
      const existing = deduped.get(hit.id);
      if (!existing || hit.score > existing.score) {
        deduped.set(hit.id, hit);
      }
    }

    return Array.from(deduped.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Retrieve relevant context for LLM consumption.
   * Concatenates chunk text up to ~maxTokens, returns sources and metadata.
   * @param {string} query
   * @param {number} [maxTokens=2000]
   * @returns {Promise<{
   *   sources: Array<{id:string,collection:string,score:number,source:string}>,
   *   context: string,
   *   totalChunks: number,
   *   relevanceScore: number
   * }>}
   */
  async retrieveForContext(query, maxTokens = 2000) {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const hits = await this.retrieve(query, {
      limit: 20,
      minScore: DEFAULT_MIN_SCORE,
    });

    const sources = [];
    const contextParts = [];
    let usedChars = 0;
    let relevanceSum = 0;

    for (const hit of hits) {
      const text = String(hit.payload.text ?? '');
      const source = String(hit.payload.source ?? 'unknown');

      sources.push({
        id: hit.id,
        collection: hit.collection,
        score: hit.score,
        source,
      });

      relevanceSum += hit.score;

      if (usedChars < maxChars) {
        const remaining = maxChars - usedChars;
        const excerpt = text.slice(0, remaining);
        contextParts.push(`[Source: ${source}]\n${excerpt}`);
        usedChars += excerpt.length;
      }
    }

    const context = contextParts.join('\n\n---\n\n');
    const relevanceScore = hits.length > 0 ? relevanceSum / hits.length : 0;

    return {
      sources,
      context,
      totalChunks: hits.length,
      relevanceScore: Math.round(relevanceScore * 1000) / 1000,
    };
  }

  /**
   * Retrieve incident records for a specific domain.
   * @param {string} domain
   * @param {{limit?:number}} options
   * @returns {Promise<Array<{id:string,score:number,payload:Record<string,unknown>,collection:string}>>}
   */
  async retrieveIncidents(domain, { limit = 5 } = {}) {
    return this.retrieve(`${domain} incident failure error outage`, {
      collections: ['incidents', 'runbooks'],
      limit,
      minScore: 0.2,
    });
  }

  /**
   * Retrieve the most relevant runbook for a given domain.
   * @param {string} domain
   * @returns {Promise<{content:string,source:string,score:number}|null>}
   */
  async retrieveRunbook(domain) {
    const hits = await this.retrieve(`${domain} runbook recovery procedure escalation`, {
      collections: ['runbooks'],
      limit: 3,
      minScore: 0.25,
    });

    if (hits.length === 0) return null;

    const top = hits[0];
    return {
      content: String(top.payload.text ?? ''),
      source: String(top.payload.source ?? 'unknown'),
      score: top.score,
    };
  }

  /**
   * Retrieve security context relevant to a platform component.
   * @param {string} component
   * @returns {Promise<{
   *   hits: Array<{id:string,score:number,payload:Record<string,unknown>,collection:string}>,
   *   summary: string
   * }>}
   */
  async retrieveSecurityContext(component) {
    const hits = await this.retrieve(
      `${component} security authentication authorization RLS JWT webhook`,
      {
        collections: ['security', 'architecture'],
        limit: 8,
        minScore: 0.25,
      }
    );

    const summary = hits
      .slice(0, 3)
      .map((h) => String(h.payload.text ?? '').slice(0, 300))
      .join('\n---\n');

    return { hits, summary };
  }

  /**
   * Find documents similar to an existing point in a collection.
   * @param {string} documentId
   * @param {string} collection
   * @returns {Promise<Array<{id:string,score:number,payload:Record<string,unknown>,collection:string}>>}
   */
  async findSimilar(documentId, collection) {
    // Retrieve the point's text, then re-embed and search
    // Qdrant recommend endpoint is not always available in all client versions,
    // so we read the payload and search by text.
    const points = await MemoryService['_client']?.retrieve(collection, {
      ids: [documentId],
      with_payload: true,
    }).catch(() => null);

    if (!points || points.length === 0) {
      console.warn(`[MemoryRetriever] findSimilar: point ${documentId} not found in ${collection}`);
      return [];
    }

    const text = String(points[0].payload?.text ?? '');
    if (!text) return [];

    const hits = await MemoryService.search(text, {
      collection,
      limit: 11, // +1 because the point itself will appear
      minScore: 0.2,
    });

    // Exclude the source document itself
    return hits
      .filter((h) => h.id !== documentId)
      .slice(0, 10)
      .map((h) => ({ ...h, collection }));
  }
}

export default new MemoryRetriever();
