/**
 * KnowledgeFreshnessService — tracks when each source was last crawled and
 * determines freshness based on per-source refreshIntervalHours thresholds.
 * State persisted to graphify-out/knowledge-state.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import KnowledgeSourceRegistry from './KnowledgeSourceRegistry.mjs';
import KnowledgeAcquisitionService from './KnowledgeAcquisitionService.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../../../graphify-out');
const STATE_FILE = resolve(OUTPUT_DIR, 'knowledge-state.json');

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
}

function loadState() {
  ensureOutputDir();
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  ensureOutputDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

class KnowledgeFreshnessService {
  /**
   * Check freshness of all registered sources.
   * @returns {Array<{source:string,lastCrawled:string|null,ageHours:number|null,status:'FRESH'|'STALE'|'MISSING'}>}
   */
  checkFreshness() {
    const state = loadState();
    const now = Date.now();

    return KnowledgeSourceRegistry.getSources().map((src) => {
      const entry = state[src.key];

      if (!entry?.lastCrawled) {
        return {
          source: src.key,
          lastCrawled: null,
          ageHours: null,
          status: 'MISSING',
        };
      }

      const lastTs = new Date(entry.lastCrawled).getTime();
      const ageMs = now - lastTs;
      const ageHours = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10;
      const thresholdHours = src.refreshIntervalHours;
      const status = ageHours <= thresholdHours ? 'FRESH' : 'STALE';

      return {
        source: src.key,
        lastCrawled: entry.lastCrawled,
        ageHours,
        status,
      };
    });
  }

  /**
   * Return keys of sources that are STALE or MISSING.
   * @returns {string[]}
   */
  getStaleSourceKeys() {
    return this.checkFreshness()
      .filter((r) => r.status === 'STALE' || r.status === 'MISSING')
      .map((r) => r.source);
  }

  /**
   * Trigger a crawl for every stale or missing source sequentially.
   * @returns {Promise<Array<{source:string,documentsAcquired:number,errors:number}>>}
   */
  async forceRefreshStale() {
    const stale = this.getStaleSourceKeys();
    if (stale.length === 0) {
      console.log('[KnowledgeFreshnessService] All sources are FRESH — no refresh needed.');
      return [];
    }

    console.log(`[KnowledgeFreshnessService] Refreshing ${stale.length} stale source(s): ${stale.join(', ')}`);
    const results = [];

    for (const key of stale) {
      const result = await KnowledgeAcquisitionService.crawlSource(key);
      results.push(result);
    }

    return results;
  }

  /**
   * Record the crawl timestamp for a source.
   * @param {string} sourceKey
   * @param {string} timestamp — ISO 8601
   */
  setLastCrawled(sourceKey, timestamp) {
    const state = loadState();
    state[sourceKey] = {
      ...(state[sourceKey] ?? {}),
      lastCrawled: timestamp,
    };
    saveState(state);
  }

  /**
   * Get the last crawled timestamp for a source.
   * @param {string} sourceKey
   * @returns {string|null}
   */
  getLastCrawled(sourceKey) {
    const state = loadState();
    return state[sourceKey]?.lastCrawled ?? null;
  }
}

export default new KnowledgeFreshnessService();
