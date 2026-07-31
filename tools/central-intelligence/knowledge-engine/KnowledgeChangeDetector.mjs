/**
 * KnowledgeChangeDetector — SHA-256 hash-based change detection for crawled URLs.
 * Persists hashes to graphify-out/knowledge-hashes.json.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../../../graphify-out');
const HASH_FILE = resolve(OUTPUT_DIR, 'knowledge-hashes.json');

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
}

function loadHashes() {
  ensureOutputDir();
  if (!existsSync(HASH_FILE)) return {};
  try {
    return JSON.parse(readFileSync(HASH_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveHashes(store) {
  ensureOutputDir();
  writeFileSync(HASH_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

class KnowledgeChangeDetector {
  /**
   * Returns true if the content for this URL differs from the stored hash.
   * @param {string} url
   * @param {string} newContent
   * @returns {boolean}
   */
  hasChanged(url, newContent) {
    const store = loadHashes();
    const entry = store[url];
    if (!entry) return true; // never seen
    return entry.hash !== sha256(newContent);
  }

  /**
   * Record the hash for a URL (with timestamp).
   * @param {string} url
   * @param {string} content
   */
  recordHash(url, content) {
    const store = loadHashes();
    store[url] = {
      hash: sha256(content),
      recordedAt: new Date().toISOString(),
    };
    saveHashes(store);
  }

  /**
   * Given a crawl output object, return the list of URLs whose content changed.
   * @param {{documents: Array<{url:string,content:string}>}} crawlOutput
   * @returns {string[]}
   */
  getChangedUrls(crawlOutput) {
    const docs = crawlOutput?.documents ?? [];
    return docs
      .filter((doc) => this.hasChanged(doc.url, doc.content ?? ''))
      .map((doc) => doc.url);
  }

  /**
   * Remove hash entries older than olderThanMs milliseconds.
   * @param {number} olderThanMs
   * @returns {number} count of purged entries
   */
  purgeOldHashes(olderThanMs) {
    const store = loadHashes();
    const cutoff = Date.now() - olderThanMs;
    let purged = 0;
    for (const [url, entry] of Object.entries(store)) {
      if (new Date(entry.recordedAt).getTime() < cutoff) {
        delete store[url];
        purged++;
      }
    }
    if (purged > 0) saveHashes(store);
    return purged;
  }
}

export default new KnowledgeChangeDetector();
