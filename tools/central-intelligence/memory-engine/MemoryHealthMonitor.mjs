/**
 * LCIS Memory Engine — MemoryHealthMonitor
 *
 * Monitors the health of the memory engine, runs self-tests,
 * and surfaces diagnostics for the intelligence dashboard.
 *
 * @module MemoryHealthMonitor
 */

import MemoryService from './MemoryService.mjs';

/** A test vector of 1536 dimensions (all 0.1) used for self-test. */
const SELF_TEST_VECTOR = Array.from({ length: 1536 }, () => 0.1);
const SELF_TEST_ID = 'health-monitor-self-test-sentinel';
const SELF_TEST_COLLECTION = 'knowledge';
const STALENESS_DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Latency budget: if any search takes longer than this, report DEGRADED
const LATENCY_WARNING_MS = 2000;

class MemoryHealthMonitor {
  /**
   * Returns overall health status.
   * @returns {Promise<{
   *   status: 'HEALTHY'|'DEGRADED'|'DOWN',
   *   qdrant: 'CONNECTED'|'NOT CONNECTED',
   *   collections: string[],
   *   latencyMs: number,
   *   lastCheck: string
   * }>}
   */
  async getHealth() {
    const raw = await MemoryService.getHealth();
    const lastCheck = new Date().toISOString();

    let status = /** @type {'HEALTHY'|'DEGRADED'|'DOWN'} */ ('HEALTHY');

    if (raw.qdrant === 'NOT CONNECTED') {
      status = 'DOWN';
    } else if (raw.latencyMs > LATENCY_WARNING_MS) {
      status = 'DEGRADED';
    } else if (raw.collections.length < 8) {
      // Some collections missing
      status = 'DEGRADED';
    }

    return {
      status,
      qdrant: raw.qdrant,
      collections: raw.collections,
      latencyMs: raw.latencyMs,
      lastCheck,
    };
  }

  /**
   * Returns extended diagnostics including per-collection stats.
   * @returns {Promise<{
   *   health: Awaited<ReturnType<MemoryHealthMonitor['getHealth']>>,
   *   collectionStats: Record<string,{pointsCount:number,vectorSize:number,status:string}>,
   *   openaiConnected: boolean,
   *   embedModel: string
   * }>}
   */
  async getDiagnostics() {
    const [health, collectionStats] = await Promise.all([
      this.getHealth(),
      MemoryService.getCollectionStats().catch(() => ({})),
    ]);

    const openaiConnected = !!process.env.OPENAI_API_KEY;
    const embedModel = process.env.EMBED_MODEL ?? 'text-embedding-3-small';

    return {
      health,
      collectionStats,
      openaiConnected,
      embedModel,
    };
  }

  /**
   * Run a self-test: insert a sentinel vector → search → delete → verify deletion.
   * Does NOT require OpenAI (uses a pre-built vector directly via internal client).
   * @returns {Promise<'PASS'|'FAIL'>}
   */
  async runSelfTest() {
    try {
      // 1. Insert sentinel directly (bypasses embed; uses internal qdrant upsert)
      await this.#upsertTestVector(SELF_TEST_ID, SELF_TEST_VECTOR, SELF_TEST_COLLECTION);

      // 2. Search for the sentinel by vector
      const results = await this.#searchByVector(
        SELF_TEST_VECTOR,
        SELF_TEST_COLLECTION,
        5
      );

      const found = results.some((r) => r.id === SELF_TEST_ID);
      if (!found) {
        console.warn('[MemoryHealthMonitor] self-test: sentinel not found in search results');
        return 'FAIL';
      }

      // 3. Delete sentinel
      await MemoryService.delete(SELF_TEST_ID, SELF_TEST_COLLECTION);

      // 4. Verify deletion — search again and confirm absent
      const afterDelete = await this.#searchByVector(
        SELF_TEST_VECTOR,
        SELF_TEST_COLLECTION,
        5
      );
      const stillPresent = afterDelete.some((r) => r.id === SELF_TEST_ID);

      if (stillPresent) {
        console.warn('[MemoryHealthMonitor] self-test: sentinel still present after delete');
        return 'FAIL';
      }

      return 'PASS';
    } catch (err) {
      console.error('[MemoryHealthMonitor] self-test failed:', err.message);
      return 'FAIL';
    }
  }

  /**
   * Returns aggregate metrics across all collections.
   * @returns {Promise<{totalDocuments:number,collectionsCount:number,avgSearchLatencyMs:number}>}
   */
  async getMetrics() {
    const [health, collectionStats] = await Promise.all([
      this.getHealth(),
      MemoryService.getCollectionStats().catch(() => ({})),
    ]);

    const totalDocuments = Object.values(collectionStats).reduce(
      (sum, s) => sum + Math.max(0, s.pointsCount),
      0
    );

    const collectionsCount = health.collections.length;

    // Measure search latency with a no-op warm-up probe
    let avgSearchLatencyMs = 0;
    if (health.qdrant === 'CONNECTED') {
      const start = Date.now();
      await MemoryService.getHealth();
      avgSearchLatencyMs = Date.now() - start;
    }

    return {
      totalDocuments,
      collectionsCount,
      avgSearchLatencyMs,
    };
  }

  /**
   * Check whether a collection has been updated within maxAgeMs.
   * Returns true (stale) if the newest document's timestamp is older than maxAgeMs,
   * or if the collection is empty.
   * @param {string} collection
   * @param {number} [maxAgeMs]
   * @returns {Promise<{collection:string,stale:boolean,newestTimestamp:number|null,ageMs:number|null}>}
   */
  async checkStaleness(collection, maxAgeMs = STALENESS_DEFAULT_MAX_AGE_MS) {
    try {
      // Retrieve a sample of recent points to check timestamps
      const stats = await MemoryService.getCollectionStats();
      const info = stats[collection];

      if (!info || info.pointsCount <= 0) {
        return { collection, stale: true, newestTimestamp: null, ageMs: null };
      }

      // We probe via a broad search to get some points with timestamps
      const hits = await MemoryService.search('timestamp staleness check', {
        collection,
        limit: 10,
        minScore: 0,
      });

      if (hits.length === 0) {
        return { collection, stale: true, newestTimestamp: null, ageMs: null };
      }

      const timestamps = hits
        .map((h) => Number(h.payload.timestamp))
        .filter((t) => !isNaN(t) && t > 0);

      if (timestamps.length === 0) {
        return { collection, stale: false, newestTimestamp: null, ageMs: null };
      }

      const newestTimestamp = Math.max(...timestamps);
      const ageMs = Date.now() - newestTimestamp;
      const stale = ageMs > maxAgeMs;

      return { collection, stale, newestTimestamp, ageMs };
    } catch (err) {
      console.error(`[MemoryHealthMonitor] checkStaleness(${collection}) error:`, err.message);
      return { collection, stale: true, newestTimestamp: null, ageMs: null };
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Directly upsert a pre-computed vector into the store (bypasses embedding).
   * Accesses the internal Qdrant client via the service module.
   * @param {string} id
   * @param {number[]} vector
   * @param {string} collection
   * @returns {Promise<void>}
   */
  async #upsertTestVector(id, vector, collection) {
    // We reach into MemoryService's ingest path but supply our own vector.
    // Since MemoryService.ingest() calls embed() internally, we use the
    // lower-level approach: temporarily wrap a no-embed document injection
    // by calling the Qdrant client through a helper that bypasses OpenAI.
    // MemoryService exposes no public raw-upsert, so we replicate it minimally here.
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    const client = new QdrantClient({
      url: process.env.QDRANT_URL ?? 'http://localhost:6333',
      ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
    });

    await client.upsert(collection, {
      wait: true,
      points: [
        {
          id,
          vector,
          payload: {
            text: '__self_test_sentinel__',
            source: 'MemoryHealthMonitor',
            timestamp: Date.now(),
          },
        },
      ],
    });
  }

  /**
   * Search by a raw vector without embedding.
   * @param {number[]} vector
   * @param {string} collection
   * @param {number} limit
   * @returns {Promise<Array<{id:string,score:number}>>}
   */
  async #searchByVector(vector, collection, limit) {
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    const client = new QdrantClient({
      url: process.env.QDRANT_URL ?? 'http://localhost:6333',
      ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
    });

    const results = await client.search(collection, {
      vector,
      limit,
      with_payload: false,
    });

    return results.map((r) => ({ id: String(r.id), score: r.score }));
  }
}

export default new MemoryHealthMonitor();
