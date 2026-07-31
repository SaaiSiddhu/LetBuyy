/**
 * LCIS Memory Engine — MemoryIndexer
 *
 * Reads governance docs, runbooks, security docs, and LCIS knowledge files
 * from the repository and ingests them into the memory engine collections.
 *
 * @module MemoryIndexer
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import MemoryService from './MemoryService.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root resolved relative to this file location */
const REPO_ROOT = join(__dirname, '..', '..', '..');

const CHUNK_MAX_CHARS = 1000;
const CHUNK_OVERLAP_CHARS = 100;

// ---------------------------------------------------------------------------
// Chunking helpers
// ---------------------------------------------------------------------------

/**
 * Split markdown text into overlapping chunks of ~CHUNK_MAX_CHARS characters.
 * Splits on blank lines first; if a paragraph is still too large it is hard-split.
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

    // Hard-split oversize paragraphs
    const pieces = trimmed.length > CHUNK_MAX_CHARS
      ? splitBySize(trimmed, CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS)
      : [trimmed];

    for (const piece of pieces) {
      if ((current + '\n\n' + piece).length > CHUNK_MAX_CHARS && current.length > 0) {
        chunks.push(current.trim());
        // Carry overlap from tail of current chunk
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
 * Hard-split a long string into size-bounded slices with overlap.
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

// ---------------------------------------------------------------------------
// File utilities
// ---------------------------------------------------------------------------

/**
 * Recursively collect all .md files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function collectMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (extname(entry) === '.md') {
      files.push(full);
    }
  }
  return files;
}

/**
 * Safely read a file; returns empty string on error.
 * @param {string} filePath
 * @returns {string}
 */
function safeRead(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (err) {
    console.warn(`[MemoryIndexer] Cannot read ${filePath}: ${err.message}`);
    return '';
  }
}

// ---------------------------------------------------------------------------
// MemoryIndexer
// ---------------------------------------------------------------------------

class MemoryIndexer {
  /**
   * Index a single document into a collection.
   * Chunks the text and ingests each chunk with metadata.
   * @param {string} filePath - Absolute path to the file
   * @param {string} collection - Target collection name
   * @param {Record<string,unknown>} [extraMetadata]
   * @returns {Promise<number>} Number of chunks ingested
   */
  async indexDocument(filePath, collection, extraMetadata = {}) {
    const text = safeRead(filePath);
    if (!text) return 0;

    const chunks = chunkText(text);
    const relativePath = filePath.replace(REPO_ROOT + '/', '');

    const documents = chunks.map((chunk, idx) => ({
      // Stable id: deterministic from path + chunk index
      id: `${Buffer.from(relativePath + ':' + idx).toString('base64url').slice(0, 36)}`,
      text: chunk,
      payload: {
        source: relativePath,
        type: 'markdown',
        domain: collection,
        timestamp: Date.now(),
        chunkIndex: idx,
        totalChunks: chunks.length,
        filename: basename(filePath),
        ...extraMetadata,
      },
    }));

    const { ingested } = await MemoryService.ingestBatch(documents, collection);
    return ingested;
  }

  /**
   * Index core governance documents into the 'architecture' collection.
   * Reads: AGENTS.md, GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md, CLAUDE.md
   * @returns {Promise<number>} Total chunks ingested
   */
  async indexGovernanceDocs() {
    const targets = [
      { path: join(REPO_ROOT, 'AGENTS.md'), meta: { docType: 'agents-rulebook' } },
      {
        path: join(REPO_ROOT, 'GOVERNANCE_REWRITE_2026_06_10', 'LETBUYY_CONSTITUTION.md'),
        meta: { docType: 'constitution' },
      },
      { path: join(REPO_ROOT, 'CLAUDE.md'), meta: { docType: 'claude-context' } },
    ];

    let total = 0;
    for (const { path, meta } of targets) {
      if (existsSync(path)) {
        const n = await this.indexDocument(path, 'architecture', meta);
        total += n;
        console.log(`[MemoryIndexer] indexGovernanceDocs: ${path} → ${n} chunks`);
      } else {
        console.warn(`[MemoryIndexer] indexGovernanceDocs: not found — ${path}`);
      }
    }
    return total;
  }

  /**
   * Index all .md files under docs/governance/ and docs/central-intelligence/ into 'runbooks'.
   * @returns {Promise<number>}
   */
  async indexRunbooks() {
    const dirs = [
      join(REPO_ROOT, 'docs', 'governance'),
      join(REPO_ROOT, 'docs', 'central-intelligence'),
    ];

    let total = 0;
    for (const dir of dirs) {
      const files = collectMarkdownFiles(dir);
      for (const file of files) {
        const n = await this.indexDocument(file, 'runbooks', { docType: 'runbook' });
        total += n;
      }
      if (files.length > 0) {
        console.log(`[MemoryIndexer] indexRunbooks: ${dir} → ${files.length} files`);
      }
    }
    return total;
  }

  /**
   * Index security and observability documentation into the 'security' collection.
   * @returns {Promise<number>}
   */
  async indexSecurityDocs() {
    const dirs = [
      join(REPO_ROOT, 'infrastructure', 'security'),
      join(REPO_ROOT, 'infrastructure', 'observability'),
    ];

    let total = 0;
    for (const dir of dirs) {
      const files = collectMarkdownFiles(dir);
      for (const file of files) {
        const n = await this.indexDocument(file, 'security', { docType: 'security' });
        total += n;
      }
      if (files.length > 0) {
        console.log(`[MemoryIndexer] indexSecurityDocs: ${dir} → ${files.length} files`);
      }
    }
    return total;
  }

  /**
   * Index docs/central-intelligence/*.md into 'architecture'.
   * @returns {Promise<number>}
   */
  async indexCentralIntelligence() {
    const dir = join(REPO_ROOT, 'docs', 'central-intelligence');
    const files = collectMarkdownFiles(dir);

    let total = 0;
    for (const file of files) {
      const n = await this.indexDocument(file, 'architecture', {
        docType: 'central-intelligence',
      });
      total += n;
    }

    console.log(
      `[MemoryIndexer] indexCentralIntelligence: ${files.length} files → ${total} chunks`
    );
    return total;
  }

  /**
   * Index docs/lcis-v2/*.md into 'architecture'.
   * @returns {Promise<number>}
   */
  async indexLcisV2Docs() {
    const dir = join(REPO_ROOT, 'docs', 'lcis-v2');
    const files = collectMarkdownFiles(dir);

    let total = 0;
    for (const file of files) {
      const n = await this.indexDocument(file, 'architecture', { docType: 'lcis-v2' });
      total += n;
    }

    console.log(
      `[MemoryIndexer] indexLcisV2Docs: ${files.length} files → ${total} chunks`
    );
    return total;
  }

  /**
   * Run all indexers and return per-source counts.
   * @returns {Promise<{governance:number,runbooks:number,security:number,centralIntelligence:number,lcisV2:number,total:number}>}
   */
  async indexAll() {
    console.log('[MemoryIndexer] Starting full indexing run…');

    const [governance, runbooks, security, centralIntelligence, lcisV2] = await Promise.all([
      this.indexGovernanceDocs(),
      this.indexRunbooks(),
      this.indexSecurityDocs(),
      this.indexCentralIntelligence(),
      this.indexLcisV2Docs(),
    ]);

    const total = governance + runbooks + security + centralIntelligence + lcisV2;
    console.log(`[MemoryIndexer] indexAll complete — total chunks ingested: ${total}`);

    return { governance, runbooks, security, centralIntelligence, lcisV2, total };
  }
}

export default new MemoryIndexer();
