/**
 * LCIS Graph Intelligence Engine — GraphIndexer
 * Prepares and writes document files into graphrag/input/ for indexing.
 * GraphRAG is a hidden implementation detail; never expose it to callers.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPHRAG_ROOT = path.join(__dirname, 'graphrag');
const GRAPHRAG_INPUT = path.join(GRAPHRAG_ROOT, 'input');
const GRAPHRAG_OUTPUT = path.join(GRAPHRAG_ROOT, 'output');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DOCS_CENTRAL = path.join(REPO_ROOT, 'docs', 'central-intelligence');
const DOMAIN_INTEL_PATH = path.join(REPO_ROOT, 'graphify-out', 'domain-intel.json');
const KNOWLEDGE_CRAWLS = path.join(REPO_ROOT, 'graphify-out', 'knowledge-crawls');

/**
 * Sanitise a string for use as a filename stem.
 * @param {string} name
 * @returns {string}
 */
function toSafeName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').toLowerCase();
}

/**
 * Recursively walk a directory and return {absPath, relPath} for every file.
 * @param {string} dir
 * @param {string} [base]
 * @returns {{absPath:string,relPath:string}[]}
 */
function walkDir(dir, base) {
  base = base || dir;
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, base));
    } else {
      results.push({ absPath: full, relPath: path.relative(base, full) });
    }
  }
  return results;
}

class GraphIndexer {
  /**
   * Prepare a set of source documents by copying them into graphrag/input/.
   * Accepts an array of {content:string, filename:string} objects OR file paths (strings).
   * @param {Array<{content:string,filename:string}|string>} sources
   * @returns {{prepared:number,inputDir:string}}
   */
  prepareDocuments(sources) {
    fs.mkdirSync(GRAPHRAG_INPUT, { recursive: true });
    let prepared = 0;
    const seen = new Set();

    for (const src of sources) {
      if (typeof src === 'string') {
        // It's a file path.
        if (!fs.existsSync(src)) continue;
        const ext = path.extname(src) || '.txt';
        let base = toSafeName(path.basename(src, ext));
        let dest = path.join(GRAPHRAG_INPUT, `${base}${ext}`);
        let i = 1;
        while (seen.has(dest)) dest = path.join(GRAPHRAG_INPUT, `${base}_${i++}${ext}`);
        seen.add(dest);
        fs.copyFileSync(src, dest);
        prepared++;
      } else if (src && typeof src.content === 'string' && src.filename) {
        const safeName = toSafeName(path.basename(src.filename, path.extname(src.filename)));
        const ext = path.extname(src.filename) || '.txt';
        let dest = path.join(GRAPHRAG_INPUT, `${safeName}${ext}`);
        let i = 1;
        while (seen.has(dest)) dest = path.join(GRAPHRAG_INPUT, `${safeName}_${i++}${ext}`);
        seen.add(dest);
        fs.writeFileSync(dest, src.content, 'utf8');
        prepared++;
      }
    }

    return { prepared, inputDir: GRAPHRAG_INPUT };
  }

  /**
   * Index all architecture documentation from docs/central-intelligence/.
   * @returns {{prepared:number,inputDir:string,filesIndexed:string[]}}
   */
  indexArchitectureDocs() {
    fs.mkdirSync(GRAPHRAG_INPUT, { recursive: true });
    const entries = walkDir(DOCS_CENTRAL);
    const accepted = entries.filter((e) => /\.(md|txt|json)$/i.test(e.absPath));
    const seen = new Set();
    const filesIndexed = [];

    for (const { absPath, relPath } of accepted) {
      const ext = path.extname(absPath);
      let base = toSafeName(relPath.replace(/[/\\]/g, '__').replace(ext, ''));
      let dest = path.join(GRAPHRAG_INPUT, `${base}${ext}`);
      let i = 1;
      while (seen.has(dest)) dest = path.join(GRAPHRAG_INPUT, `${base}_${i++}${ext}`);
      seen.add(dest);
      fs.copyFileSync(absPath, dest);
      filesIndexed.push(relPath);
    }

    return { prepared: filesIndexed.length, inputDir: GRAPHRAG_INPUT, filesIndexed };
  }

  /**
   * Read graphify-out/domain-intel.json and emit one .txt per domain into graphrag/input/.
   * @returns {{prepared:number,inputDir:string,domains:string[]}}
   */
  indexDomainIntel() {
    fs.mkdirSync(GRAPHRAG_INPUT, { recursive: true });

    if (!fs.existsSync(DOMAIN_INTEL_PATH)) {
      return { prepared: 0, inputDir: GRAPHRAG_INPUT, domains: [], error: `domain-intel.json not found at ${DOMAIN_INTEL_PATH}. Run pnpm graph:domain first.` };
    }

    let domainIntel;
    try {
      domainIntel = JSON.parse(fs.readFileSync(DOMAIN_INTEL_PATH, 'utf8'));
    } catch (err) {
      return { prepared: 0, inputDir: GRAPHRAG_INPUT, domains: [], error: `Failed to parse domain-intel.json: ${err.message}` };
    }

    // domain-intel.json structure: { domains: { [key]: { name, description, tables, rpcs, ... } } }
    const domains = domainIntel.domains || domainIntel;
    if (!domains || typeof domains !== 'object') {
      return { prepared: 0, inputDir: GRAPHRAG_INPUT, domains: [], error: 'domain-intel.json does not contain a domains map' };
    }

    const domainNames = [];
    for (const [key, domain] of Object.entries(domains)) {
      const lines = [];
      const name = domain.name || key;
      lines.push(`# Domain: ${name}`);
      if (domain.description) lines.push(`\n${domain.description}`);
      if (domain.tables?.length) lines.push(`\n## Tables\n${domain.tables.join(', ')}`);
      if (domain.rpcs?.length) lines.push(`\n## RPCs\n${domain.rpcs.join(', ')}`);
      if (domain.routes?.length) lines.push(`\n## Routes\n${domain.routes.join(', ')}`);
      if (domain.queues?.length) lines.push(`\n## Queues\n${domain.queues.join(', ')}`);
      if (domain.workers?.length) lines.push(`\n## Workers\n${domain.workers.join(', ')}`);
      if (domain.dependsOn?.length) lines.push(`\n## Depends On\n${domain.dependsOn.join(', ')}`);
      if (domain.consumedBy?.length) lines.push(`\n## Consumed By\n${domain.consumedBy.join(', ')}`);
      if (domain.owner) lines.push(`\n## Owner\n${domain.owner}`);

      const safeName = toSafeName(key);
      const dest = path.join(GRAPHRAG_INPUT, `domain_${safeName}.txt`);
      fs.writeFileSync(dest, lines.join('\n'), 'utf8');
      domainNames.push(key);
    }

    return { prepared: domainNames.length, inputDir: GRAPHRAG_INPUT, domains: domainNames };
  }

  /**
   * Index knowledge crawls from graphify-out/knowledge-crawls/.
   * @returns {{prepared:number,inputDir:string,filesIndexed:string[]}}
   */
  indexKnowledgeCrawls() {
    fs.mkdirSync(GRAPHRAG_INPUT, { recursive: true });
    const entries = walkDir(KNOWLEDGE_CRAWLS);
    const accepted = entries.filter((e) => /\.(md|txt|json)$/i.test(e.absPath));
    const seen = new Set();
    const filesIndexed = [];

    for (const { absPath, relPath } of accepted) {
      const ext = path.extname(absPath);
      let base = toSafeName(relPath.replace(/[/\\]/g, '__').replace(ext, ''));
      let dest = path.join(GRAPHRAG_INPUT, `crawl_${base}${ext}`);
      let i = 1;
      while (seen.has(dest)) dest = path.join(GRAPHRAG_INPUT, `crawl_${base}_${i++}${ext}`);
      seen.add(dest);
      fs.copyFileSync(absPath, dest);
      filesIndexed.push(relPath);
    }

    return { prepared: filesIndexed.length, inputDir: GRAPHRAG_INPUT, filesIndexed };
  }

  /**
   * Return stats about the current input directory.
   * @returns {{inputFileCount:number,inputDir:string,outputExists:boolean,artifactsDir:string}}
   */
  getIndexStats() {
    const inputFiles = fs.existsSync(GRAPHRAG_INPUT)
      ? fs.readdirSync(GRAPHRAG_INPUT).filter((f) => !f.startsWith('.')).length
      : 0;

    const artifactsDir = path.join(GRAPHRAG_OUTPUT, 'artifacts');
    const outputExists = fs.existsSync(artifactsDir) && fs.readdirSync(artifactsDir).length > 0;

    let lastBuilt = null;
    if (outputExists) {
      lastBuilt = fs.statSync(artifactsDir).mtime.toISOString();
    }

    return {
      inputFileCount: inputFiles,
      inputDir: GRAPHRAG_INPUT,
      outputExists,
      artifactsDir,
      lastBuilt,
    };
  }

  /**
   * Return true if the index was built within maxAgeMs milliseconds.
   * @param {number} maxAgeMs
   * @returns {boolean}
   */
  isIndexFresh(maxAgeMs) {
    const artifactsDir = path.join(GRAPHRAG_OUTPUT, 'artifacts');
    if (!fs.existsSync(artifactsDir)) return false;
    const files = fs.readdirSync(artifactsDir);
    if (files.length === 0) return false;
    const stat = fs.statSync(artifactsDir);
    return Date.now() - stat.mtimeMs < maxAgeMs;
  }
}

export default new GraphIndexer();
