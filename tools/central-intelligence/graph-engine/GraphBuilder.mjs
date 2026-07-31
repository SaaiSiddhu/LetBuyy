/**
 * LCIS Graph Intelligence Engine — GraphBuilder
 * Orchestrates GraphRAG index construction from LCIS knowledge sources.
 * GraphRAG is a hidden implementation detail; never expose it to callers.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPHRAG_ROOT = path.join(__dirname, 'graphrag');
const GRAPHRAG_INPUT = path.join(GRAPHRAG_ROOT, 'input');
const GRAPHRAG_OUTPUT = path.join(GRAPHRAG_ROOT, 'output');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DOCS_CENTRAL = path.join(REPO_ROOT, 'docs', 'central-intelligence');
const DOMAIN_INTEL = path.join(REPO_ROOT, 'graphify-out', 'domain-intel.json');
const KNOWLEDGE_CRAWLS = path.join(REPO_ROOT, 'graphify-out', 'knowledge-crawls');
const BUILD_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

/**
 * Recursively collect all .md/.txt/.json files from a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (/\.(md|txt|json)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Copy files into graphrag/input/, flattening with collision-safe names.
 * @param {string[]} files
 */
function copyToInput(files) {
  fs.mkdirSync(GRAPHRAG_INPUT, { recursive: true });
  const seen = new Set();
  for (const src of files) {
    const ext = path.extname(src);
    let base = path.basename(src, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    let dest = path.join(GRAPHRAG_INPUT, `${base}${ext}`);
    let counter = 1;
    while (seen.has(dest)) {
      dest = path.join(GRAPHRAG_INPUT, `${base}_${counter++}${ext}`);
    }
    seen.add(dest);
    fs.copyFileSync(src, dest);
  }
}

/**
 * Run `python3 -m graphrag index --root <graphragRoot>` and return structured result.
 * @returns {{success:boolean,entitiesCount:number,relationshipsCount:number,communitiesCount:number,indexPath:string,error?:string}}
 */
function runGraphragIndex() {
  const result = spawnSync(
    'python3',
    ['-m', 'graphrag', 'index', '--root', GRAPHRAG_ROOT],
    {
      timeout: BUILD_TIMEOUT_MS,
      encoding: 'utf8',
      env: { ...process.env },
    }
  );

  const indexPath = GRAPHRAG_OUTPUT;
  if (result.status !== 0) {
    return {
      success: false,
      entitiesCount: 0,
      relationshipsCount: 0,
      communitiesCount: 0,
      indexPath,
      error: (result.stderr || result.stdout || 'graphrag index exited non-zero').trim(),
    };
  }

  // Parse entity/relationship/community counts from stdout if present.
  const stdout = result.stdout || '';
  const entityMatch = stdout.match(/entities[:\s]+(\d+)/i);
  const relMatch = stdout.match(/relationships[:\s]+(\d+)/i);
  const commMatch = stdout.match(/communit(?:y|ies)[:\s]+(\d+)/i);

  return {
    success: true,
    entitiesCount: entityMatch ? parseInt(entityMatch[1], 10) : countParquetRows('entities'),
    relationshipsCount: relMatch ? parseInt(relMatch[1], 10) : countParquetRows('relationships'),
    communitiesCount: commMatch ? parseInt(commMatch[1], 10) : countParquetRows('communities'),
    indexPath,
  };
}

/**
 * Rough row count from parquet file presence (file count as proxy when pyarrow unavailable).
 * @param {string} kind
 * @returns {number}
 */
function countParquetRows(kind) {
  const dir = path.join(GRAPHRAG_OUTPUT, 'artifacts');
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(kind) && f.endsWith('.parquet'));
  return files.length > 0 ? -1 : 0; // -1 means "present but unread"
}

class GraphBuilder {
  /**
   * Build index from an arbitrary input directory.
   * @param {string} inputPath - directory containing source documents
   */
  build(inputPath) {
    const files = collectFiles(inputPath);
    if (files.length === 0) {
      return { success: false, entitiesCount: 0, relationshipsCount: 0, communitiesCount: 0, indexPath: GRAPHRAG_OUTPUT, error: `No documents found in ${inputPath}` };
    }
    fs.rmSync(GRAPHRAG_INPUT, { recursive: true, force: true });
    copyToInput(files);
    return runGraphragIndex();
  }

  /**
   * Build from LCIS central-intelligence docs + domain-intel.json.
   */
  buildFromLCIS() {
    const files = collectFiles(DOCS_CENTRAL);

    // Also include domain-intel.json if present.
    if (fs.existsSync(DOMAIN_INTEL)) {
      files.push(DOMAIN_INTEL);
    }

    if (files.length === 0) {
      return { success: false, entitiesCount: 0, relationshipsCount: 0, communitiesCount: 0, indexPath: GRAPHRAG_OUTPUT, error: `No LCIS documents found in ${DOCS_CENTRAL}` };
    }

    fs.rmSync(GRAPHRAG_INPUT, { recursive: true, force: true });
    copyToInput(files);
    return runGraphragIndex();
  }

  /**
   * Build from graphify-out/knowledge-crawls/.
   */
  buildFromKnowledge() {
    const files = collectFiles(KNOWLEDGE_CRAWLS);
    if (files.length === 0) {
      return { success: false, entitiesCount: 0, relationshipsCount: 0, communitiesCount: 0, indexPath: GRAPHRAG_OUTPUT, error: `No knowledge crawls found in ${KNOWLEDGE_CRAWLS}` };
    }
    fs.rmSync(GRAPHRAG_INPUT, { recursive: true, force: true });
    copyToInput(files);
    return runGraphragIndex();
  }

  /**
   * Full build: LCIS docs + domain intel + knowledge crawls.
   */
  buildFull() {
    const files = [
      ...collectFiles(DOCS_CENTRAL),
      ...(fs.existsSync(DOMAIN_INTEL) ? [DOMAIN_INTEL] : []),
      ...collectFiles(KNOWLEDGE_CRAWLS),
    ];

    if (files.length === 0) {
      return { success: false, entitiesCount: 0, relationshipsCount: 0, communitiesCount: 0, indexPath: GRAPHRAG_OUTPUT, error: 'No source documents found for full build' };
    }

    fs.rmSync(GRAPHRAG_INPUT, { recursive: true, force: true });
    copyToInput(files);
    return runGraphragIndex();
  }

  /**
   * Return the current build status without triggering a build.
   * @returns {{built:boolean,indexPath:string,lastBuilt:string|null,inputFileCount:number}}
   */
  getStatus() {
    const artifactsDir = path.join(GRAPHRAG_OUTPUT, 'artifacts');
    const built = fs.existsSync(artifactsDir) && fs.readdirSync(artifactsDir).length > 0;
    let lastBuilt = null;
    if (built) {
      const stats = fs.statSync(artifactsDir);
      lastBuilt = stats.mtime.toISOString();
    }
    const inputFiles = fs.existsSync(GRAPHRAG_INPUT) ? fs.readdirSync(GRAPHRAG_INPUT).length : 0;
    return { built, indexPath: GRAPHRAG_OUTPUT, lastBuilt, inputFileCount: inputFiles };
  }

  /**
   * Delete the graphrag input and output directories.
   * @returns {{cleaned:boolean,message:string}}
   */
  clean() {
    fs.rmSync(GRAPHRAG_INPUT, { recursive: true, force: true });
    fs.rmSync(GRAPHRAG_OUTPUT, { recursive: true, force: true });
    return { cleaned: true, message: 'GraphRAG input and output directories removed.' };
  }
}

export default new GraphBuilder();
