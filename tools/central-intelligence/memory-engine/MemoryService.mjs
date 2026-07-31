/**
 * LCIS Memory Engine — MemoryService
 *
 * Hidden implementation detail: backed by Qdrant vector database.
 * Qdrant is NEVER exposed as a first-class concept outside this module.
 *
 * @module MemoryService
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY ?? undefined;
const EMBED_MODEL = process.env.EMBED_MODEL ?? 'text-embedding-3-small';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? undefined;

const VECTOR_SIZE = 1536;
const EMBED_BATCH_SIZE = 100;

/** @type {Record<string,{vectorSize:number,distance:string,description:string}>} */
const COLLECTION_SCHEMA = JSON.parse(
  readFileSync(join(__dirname, 'collections', 'schema.json'), 'utf8')
).collections;

const COLLECTION_NAMES = Object.keys(COLLECTION_SCHEMA);

class MemoryService {
  /** @type {QdrantClient} */
  #client;

  /** @type {boolean} */
  #initialized = false;

  constructor() {
    this.#client = new QdrantClient({
      url: QDRANT_URL,
      ...(QDRANT_API_KEY ? { apiKey: QDRANT_API_KEY } : {}),
    });
  }

  /**
   * Ensure all 8 collections exist in the vector store.
   * Idempotent — safe to call multiple times.
   * @returns {Promise<void>}
   */
  async init() {
    const existing = await this.#client.getCollections();
    const existingNames = new Set(existing.collections.map((c) => c.name));

    for (const [name, spec] of Object.entries(COLLECTION_SCHEMA)) {
      if (!existingNames.has(name)) {
        await this.#client.createCollection(name, {
          vectors: {
            size: spec.vectorSize,
            distance: /** @type {'Cosine'} */ (spec.distance),
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });
        console.log(`[MemoryService] Created collection: ${name}`);
      }
    }

    this.#initialized = true;
  }

  /**
   * Embed text via OpenAI embeddings API.
   * Returns null and logs NOT CONNECTED when OPENAI_API_KEY is absent.
   * @param {string} text
   * @returns {Promise<number[]|null>}
   */
  async embed(text) {
    if (!OPENAI_API_KEY) {
      console.warn('[MemoryService] embed: OPENAI_API_KEY NOT CONNECTED — embeddings disabled');
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: text.slice(0, 8191), // OpenAI token ceiling guard
        dimensions: VECTOR_SIZE,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`[MemoryService] OpenAI embeddings error ${response.status}: ${body}`);
    }

    /** @type {{data:[{embedding:number[]}]}} */
    const json = await response.json();
    return json.data[0].embedding;
  }

  /**
   * Search a collection for documents semantically similar to the query.
   * @param {string} query
   * @param {{collection:string,limit?:number,filter?:Record<string,unknown>,minScore?:number}} options
   * @returns {Promise<Array<{id:string,score:number,payload:Record<string,unknown>}>>}
   */
  async search(query, { collection, limit = 10, filter, minScore = 0.0 }) {
    this.#assertInit();
    this.#assertCollection(collection);

    const vector = await this.embed(query);
    if (!vector) {
      console.warn('[MemoryService] search: embedding unavailable, returning empty results');
      return [];
    }

    const results = await this.#client.search(collection, {
      vector,
      limit,
      score_threshold: minScore,
      with_payload: true,
      ...(filter ? { filter } : {}),
    });

    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: /** @type {Record<string,unknown>} */ (r.payload ?? {}),
    }));
  }

  /**
   * Ingest a single document into a collection.
   * @param {{id:string,text:string,payload?:Record<string,unknown>}} document
   * @param {string} collection
   * @returns {Promise<void>}
   */
  async ingest(document, collection) {
    this.#assertInit();
    this.#assertCollection(collection);

    const vector = await this.embed(document.text);
    if (!vector) {
      console.warn(`[MemoryService] ingest: skipping ${document.id} — embeddings NOT CONNECTED`);
      return;
    }

    await this.#client.upsert(collection, {
      wait: true,
      points: [
        {
          id: document.id,
          vector,
          payload: {
            text: document.text,
            ...(document.payload ?? {}),
          },
        },
      ],
    });
  }

  /**
   * Ingest a batch of documents in chunks of 100.
   * @param {Array<{id:string,text:string,payload?:Record<string,unknown>}>} documents
   * @param {string} collection
   * @returns {Promise<{ingested:number,skipped:number}>}
   */
  async ingestBatch(documents, collection) {
    this.#assertInit();
    this.#assertCollection(collection);

    let ingested = 0;
    let skipped = 0;

    for (let i = 0; i < documents.length; i += EMBED_BATCH_SIZE) {
      const chunk = documents.slice(i, i + EMBED_BATCH_SIZE);
      const points = [];

      for (const doc of chunk) {
        const vector = await this.embed(doc.text);
        if (!vector) {
          skipped++;
          continue;
        }
        points.push({
          id: doc.id,
          vector,
          payload: { text: doc.text, ...(doc.payload ?? {}) },
        });
      }

      if (points.length > 0) {
        await this.#client.upsert(collection, { wait: true, points });
        ingested += points.length;
      }
    }

    return { ingested, skipped };
  }

  /**
   * Delete a point by id from a collection.
   * @param {string} id
   * @param {string} collection
   * @returns {Promise<void>}
   */
  async delete(id, collection) {
    this.#assertInit();
    this.#assertCollection(collection);

    await this.#client.delete(collection, {
      wait: true,
      points: [id],
    });
  }

  /**
   * Returns health status of the memory engine.
   * @returns {Promise<{qdrant:'CONNECTED'|'NOT CONNECTED',collections:string[],latencyMs:number}>}
   */
  async getHealth() {
    const start = Date.now();
    try {
      const info = await this.#client.getCollections();
      const latencyMs = Date.now() - start;
      return {
        qdrant: 'CONNECTED',
        collections: info.collections.map((c) => c.name),
        latencyMs,
      };
    } catch (err) {
      return {
        qdrant: 'NOT CONNECTED',
        collections: [],
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Returns per-collection point counts and vector configuration.
   * @returns {Promise<Record<string,{pointsCount:number,vectorSize:number,status:string}>>}
   */
  async getCollectionStats() {
    this.#assertInit();

    /** @type {Record<string,{pointsCount:number,vectorSize:number,status:string}>} */
    const stats = {};

    for (const name of COLLECTION_NAMES) {
      try {
        const info = await this.#client.getCollection(name);
        stats[name] = {
          pointsCount: info.points_count ?? 0,
          vectorSize: COLLECTION_SCHEMA[name].vectorSize,
          status: info.status ?? 'unknown',
        };
      } catch (err) {
        stats[name] = {
          pointsCount: -1,
          vectorSize: COLLECTION_SCHEMA[name].vectorSize,
          status: 'error',
        };
      }
    }

    return stats;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** @returns {void} */
  #assertInit() {
    if (!this.#initialized) {
      throw new Error('[MemoryService] Not initialized — call init() first');
    }
  }

  /**
   * @param {string} name
   * @returns {void}
   */
  #assertCollection(name) {
    if (!COLLECTION_NAMES.includes(name)) {
      throw new Error(
        `[MemoryService] Unknown collection "${name}". Valid: ${COLLECTION_NAMES.join(', ')}`
      );
    }
  }

  /** Expose collection names for consumers. */
  get collectionNames() {
    return COLLECTION_NAMES;
  }
}

export default new MemoryService();
