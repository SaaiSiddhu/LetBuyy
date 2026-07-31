/**
 * KnowledgeAcquisitionService — orchestrates Python crawler processes and
 * ingests their output into the LCIS memory pipeline.
 *
 * Crawl4AI is a hidden implementation detail; callers see only this service.
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import MemoryIngestionPipeline from '../memory-engine/MemoryIngestionPipeline.mjs';
import KnowledgeSourceRegistry from './KnowledgeSourceRegistry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRAWLERS_DIR = resolve(__dirname, 'crawlers');
const OUTPUT_DIR = resolve(__dirname, '../../../graphify-out/knowledge-crawls');

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Spawn a child process and collect stdout/stderr.
 * @param {string} cmd
 * @param {string[]} args
 * @param {object} env
 * @returns {Promise<{exitCode:number,stdout:string,stderr:string}>}
 */
function runProcess(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });

    proc.on('error', (err) => {
      resolve({ exitCode: 1, stdout, stderr: stderr + '\n' + err.message });
    });
  });
}

class KnowledgeAcquisitionService {
  #schedules = new Map(); // sourceKey → NodeJS.Timer

  /**
   * Run the crawler for a single source.
   * @param {string} sourceKey
   * @returns {Promise<{source:string,documentsAcquired:number,errors:number}>}
   */
  async crawlSource(sourceKey) {
    const src = KnowledgeSourceRegistry.getSource(sourceKey);
    if (!src) throw new Error(`crawlSource: unknown source key '${sourceKey}'`);

    const crawlerScript = resolve(CRAWLERS_DIR, `${sourceKey}-crawler.py`);
    if (!existsSync(crawlerScript)) {
      throw new Error(`crawlSource: no crawler script at ${crawlerScript}`);
    }

    ensureOutputDir();

    console.log(`[KnowledgeAcquisitionService] [${new Date().toISOString()}] Starting crawl for source '${sourceKey}'`);

    const { exitCode, stdout, stderr } = await runProcess('python3', [crawlerScript]);

    if (exitCode !== 0) {
      console.error(`[KnowledgeAcquisitionService] Crawler '${sourceKey}' exited with code ${exitCode}:\n${stderr}`);
      return { source: sourceKey, documentsAcquired: 0, errors: 1 };
    }

    const outputPath = resolve(OUTPUT_DIR, `${sourceKey}-latest.json`);

    // Try to extract structured status from crawler stdout (last JSON line)
    let crawlerStatus = null;
    const jsonLines = stdout.split('\n').filter((l) => l.trim().startsWith('{'));
    if (jsonLines.length > 0) {
      try {
        crawlerStatus = JSON.parse(jsonLines[jsonLines.length - 1]);
      } catch { /* ignore parse errors */ }
    }

    const documentsAcquired = crawlerStatus?.documentsCount ?? 0;
    const errors = crawlerStatus?.errorsCount ?? 0;

    console.log(`[KnowledgeAcquisitionService] Crawl '${sourceKey}' complete: ${documentsAcquired} docs, ${errors} errors`);

    // Ingest the output into the memory pipeline
    if (existsSync(outputPath)) {
      await this.ingestCrawlOutput(outputPath);
    }

    return { source: sourceKey, documentsAcquired, errors };
  }

  /**
   * Crawl all registered sources sequentially.
   * @returns {Promise<Array<{source:string,documentsAcquired:number,errors:number}>>}
   */
  async crawlAll() {
    const keys = KnowledgeSourceRegistry.getActiveSourceKeys();
    console.log(`[KnowledgeAcquisitionService] [${new Date().toISOString()}] crawlAll: ${keys.length} sources`);

    const results = [];
    for (const key of keys) {
      try {
        const result = await this.crawlSource(key);
        results.push(result);
      } catch (err) {
        console.error(`[KnowledgeAcquisitionService] crawlAll: source '${key}' threw: ${err.message}`);
        results.push({ source: key, documentsAcquired: 0, errors: 1 });
      }
    }

    return results;
  }

  /**
   * Read a crawler's JSON output file and ingest each document into the
   * MemoryIngestionPipeline using the document's declared collection.
   * @param {string} outputPath — absolute path to {source}-latest.json
   */
  async ingestCrawlOutput(outputPath) {
    if (!existsSync(outputPath)) {
      throw new Error(`ingestCrawlOutput: file not found: ${outputPath}`);
    }

    let crawlResult;
    try {
      crawlResult = JSON.parse(readFileSync(outputPath, 'utf8'));
    } catch (err) {
      throw new Error(`ingestCrawlOutput: failed to parse ${outputPath}: ${err.message}`);
    }

    const documents = crawlResult?.documents ?? [];
    const collection = crawlResult?.collection ?? 'knowledge';
    const source = crawlResult?.source ?? 'unknown';

    console.log(`[KnowledgeAcquisitionService] Ingesting ${documents.length} documents from '${source}' into collection '${collection}'`);

    let ingested = 0;
    let failed = 0;

    for (const doc of documents) {
      if (!doc.content || doc.content.length < 100) continue;

      try {
        await MemoryIngestionPipeline.runFromText(doc.content, {
          id: doc.id,
          url: doc.url,
          source: doc.source ?? source,
          collection,
          timestamp: doc.timestamp,
          contentLength: doc.contentLength ?? doc.content.length,
        });
        ingested++;
      } catch (err) {
        console.warn(`[KnowledgeAcquisitionService] Failed to ingest doc ${doc.id ?? doc.url}: ${err.message}`);
        failed++;
      }
    }

    console.log(`[KnowledgeAcquisitionService] Ingestion complete: ${ingested} ingested, ${failed} failed`);
  }

  /**
   * Return the crawl status for each registered source based on the latest output files.
   * @returns {Array<{source:string,outputFile:string,exists:boolean,documentsCount:number|null,crawledAt:string|null}>}
   */
  getSourceStatus() {
    const keys = KnowledgeSourceRegistry.getActiveSourceKeys();
    return keys.map((key) => {
      const outputPath = resolve(OUTPUT_DIR, `${key}-latest.json`);
      if (!existsSync(outputPath)) {
        return { source: key, outputFile: outputPath, exists: false, documentsCount: null, crawledAt: null };
      }

      try {
        const data = JSON.parse(readFileSync(outputPath, 'utf8'));
        return {
          source: key,
          outputFile: outputPath,
          exists: true,
          documentsCount: data.documentsCount ?? null,
          crawledAt: data.crawledAt ?? null,
        };
      } catch {
        return { source: key, outputFile: outputPath, exists: true, documentsCount: null, crawledAt: null };
      }
    });
  }

  /**
   * Schedule a recurring crawl for a source using setInterval.
   * Replaces any existing schedule for the same sourceKey.
   * @param {string} sourceKey
   * @param {number} intervalMs
   */
  scheduleRefresh(sourceKey, intervalMs) {
    if (this.#schedules.has(sourceKey)) {
      clearInterval(this.#schedules.get(sourceKey));
    }

    const timer = setInterval(async () => {
      console.log(`[KnowledgeAcquisitionService] [${new Date().toISOString()}] Scheduled refresh firing for '${sourceKey}'`);
      try {
        await this.crawlSource(sourceKey);
      } catch (err) {
        console.error(`[KnowledgeAcquisitionService] Scheduled refresh for '${sourceKey}' failed: ${err.message}`);
      }
    }, intervalMs);

    // Allow the process to exit even if a timer is pending
    if (timer.unref) timer.unref();

    this.#schedules.set(sourceKey, timer);
    console.log(`[KnowledgeAcquisitionService] Scheduled '${sourceKey}' every ${intervalMs}ms`);
  }
}

export default new KnowledgeAcquisitionService();
