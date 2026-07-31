/**
 * LCIS Memory Engine — MemoryIngestionPipeline
 *
 * Orchestrates ingestion from multiple sources with idempotency,
 * failure isolation, and persistent state tracking.
 *
 * @module MemoryIngestionPipeline
 */

import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import MemoryIndexer from './MemoryIndexer.mjs';
import MemoryService from './MemoryService.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const STATE_PATH = join(REPO_ROOT, 'graphify-out', 'memory-pipeline-state.json');

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   lastRun: string|null,
 *   documentsIngested: number,
 *   failedDocuments: number,
 *   collectionCounts: Record<string,number>,
 *   runs: Array<{at:string,source:string,collection:string,ingested:number,failed:number}>
 * }} PipelineState
 */

/**
 * Load persisted pipeline state from disk.
 * @returns {PipelineState}
 */
function loadState() {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    } catch {
      // corrupt state — start fresh
    }
  }
  return {
    lastRun: null,
    documentsIngested: 0,
    failedDocuments: 0,
    collectionCounts: {},
    runs: [],
  };
}

/**
 * Persist pipeline state to disk.
 * @param {PipelineState} state
 */
function saveState(state) {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Chunk / ID helpers
// ---------------------------------------------------------------------------

const CHUNK_MAX_CHARS = 1000;
const CHUNK_OVERLAP_CHARS = 100;

/**
 * Split text into overlapping ~1000-char chunks.
 * @param {string} text
 * @returns {string[]}
 */
function chunkText(text) {
  const paragraphs = text.split(/\n\s*\n/);
  /** @type {string[]} */
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const pieces =
      trimmed.length > CHUNK_MAX_CHARS
        ? splitBySize(trimmed, CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS)
        : [trimmed];

    for (const piece of pieces) {
      if ((current + '\n\n' + piece).length > CHUNK_MAX_CHARS && current.length > 0) {
        chunks.push(current.trim());
        const overlapStart = Math.max(0, current.length - CHUNK_OVERLAP_CHARS);
        current = current.slice(overlapStart) + '\n\n' + piece;
      } else {
        current = current ? current + '\n\n' + piece : piece;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length >= 20);
}

/**
 * @param {string} text
 * @param {number} maxSize
 * @param {number} overlap
 * @returns {string[]}
 */
function splitBySize(text, maxSize, overlap) {
  const result = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    result.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }
  return result;
}

/**
 * Deterministic point id — truncated SHA-256 of source key + content.
 * @param {string} sourceKey
 * @param {string} content
 * @returns {string}
 */
function makePointId(sourceKey, content) {
  return createHash('sha256')
    .update(sourceKey + '\x00' + content)
    .digest('hex')
    .slice(0, 32);
}

// ---------------------------------------------------------------------------
// MemoryIngestionPipeline
// ---------------------------------------------------------------------------

class MemoryIngestionPipeline {
  /** @type {PipelineState} */
  #state;

  constructor() {
    this.#state = loadState();
  }

  /**
   * Run all indexers (full ingestion pipeline from repository sources).
   * Source identifier is the indexAll run; individual chunks are idempotent.
   * @param {string} [source='repository']
   * @returns {Promise<{ingested:number,failed:number,collectionCounts:Record<string,number>}>}
   */
  async run(source = 'repository') {
    const counts = await MemoryIndexer.indexAll();
    const ingested = counts.total;
    const failed = 0; // indexAll logs failures internally and continues

    const collectionCounts = await this.#collectStats();

    this.#state.lastRun = new Date().toISOString();
    this.#state.documentsIngested += ingested;
    this.#state.failedDocuments += failed;
    this.#state.collectionCounts = collectionCounts;
    this.#state.runs.push({
      at: this.#state.lastRun,
      source,
      collection: 'all',
      ingested,
      failed,
    });
    saveState(this.#state);

    console.log(`[MemoryIngestionPipeline] run(${source}) complete — ${ingested} chunks ingested`);
    return { ingested, failed, collectionCounts };
  }

  /**
   * Fetch text from a URL and ingest into the given collection.
   * @param {string} url
   * @param {string} collection
   * @param {Record<string,unknown>} [metadata]
   * @returns {Promise<{ingested:number,failed:number}>}
   */
  async runFromUrl(url, collection, metadata = {}) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`[MemoryIngestionPipeline] runFromUrl: HTTP ${response.status} for ${url}`);
    }
    const text = await response.text();
    return this.runFromText(text, collection, { ...metadata, source: url });
  }

  /**
   * Ingest raw text into the given collection with idempotent point ids.
   * @param {string} text
   * @param {string} collection
   * @param {Record<string,unknown>} [metadata]
   * @returns {Promise<{ingested:number,failed:number}>}
   */
  async runFromText(text, collection, metadata = {}) {
    const sourceKey = String(metadata.source ?? 'inline');
    const chunks = chunkText(text);

    const documents = chunks.map((chunk, idx) => ({
      id: makePointId(sourceKey + ':' + idx, chunk),
      text: chunk,
      payload: {
        source: sourceKey,
        type: 'text',
        domain: collection,
        timestamp: Date.now(),
        chunkIndex: idx,
        totalChunks: chunks.length,
        ...metadata,
      },
    }));

    let ingested = 0;
    let failed = 0;

    try {
      const result = await MemoryService.ingestBatch(documents, collection);
      ingested = result.ingested;
      failed = result.skipped;
    } catch (err) {
      console.error(`[MemoryIngestionPipeline] runFromText failed for ${sourceKey}:`, err.message);
      failed = documents.length;
    }

    const collectionCounts = await this.#collectStats();
    this.#state.lastRun = new Date().toISOString();
    this.#state.documentsIngested += ingested;
    this.#state.failedDocuments += failed;
    this.#state.collectionCounts = collectionCounts;
    this.#state.runs.push({
      at: this.#state.lastRun,
      source: sourceKey,
      collection,
      ingested,
      failed,
    });
    saveState(this.#state);

    return { ingested, failed };
  }

  /**
   * Verify the contents of a collection by checking point count.
   * @param {string} collection
   * @returns {Promise<{collection:string,pointsCount:number,ok:boolean}>}
   */
  async verify(collection) {
    const stats = await MemoryService.getCollectionStats();
    const info = stats[collection];
    if (!info) {
      return { collection, pointsCount: 0, ok: false };
    }
    return {
      collection,
      pointsCount: info.pointsCount,
      ok: info.pointsCount >= 0 && info.status !== 'error',
    };
  }

  /**
   * Return the current pipeline status.
   * @returns {{lastRun:string|null,documentsIngested:number,failedDocuments:number,collectionCounts:Record<string,number>}}
   */
  getStatus() {
    return {
      lastRun: this.#state.lastRun,
      documentsIngested: this.#state.documentsIngested,
      failedDocuments: this.#state.failedDocuments,
      collectionCounts: { ...this.#state.collectionCounts },
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Collect point counts across all collections.
   * @returns {Promise<Record<string,number>>}
   */
  async #collectStats() {
    try {
      const stats = await MemoryService.getCollectionStats();
      /** @type {Record<string,number>} */
      const counts = {};
      for (const [name, info] of Object.entries(stats)) {
        counts[name] = info.pointsCount;
      }
      return counts;
    } catch {
      return {};
    }
  }
}

export default new MemoryIngestionPipeline();
