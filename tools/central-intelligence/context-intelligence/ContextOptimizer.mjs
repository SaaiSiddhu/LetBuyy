/**
 * LCIS Context Intelligence — ContextOptimizer
 *
 * Implements a PageRank-based file importance ranker over the file dependency
 * graph produced by RepositoryGraphBuilder.  Supports:
 *
 *   • Global ranking  — unseeded PageRank reflecting structural centrality
 *   • Personalized ranking — seeds biased toward a query's relevant files,
 *     focusing the probability mass on the task at hand
 *   • Token-budget selection — greedy pick of top-ranked files that fit a
 *     token budget (estimated as chars / 4)
 *
 * PageRank parameters:
 *   damping d = 0.85, iterations = 30, convergence ε = 1e-6
 *
 * This is the core of the "Aider repo-map concept" reimplemented cleanly —
 * no Aider dependency, no external code, pure JS.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import graphBuilder from './RepositoryGraphBuilder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const OUT_DIR = resolve(REPO_ROOT, 'graphify-out/context-intelligence');
const CACHE_PATH = resolve(OUT_DIR, 'importance-ranking.json');

const DAMPING = 0.85;
const ITERATIONS = 30;
const EPSILON = 1e-6;

/**
 * Pure PageRank over a set of files with an optional personalization vector.
 *
 * @param {string[]} files
 * @param {Map<string, string[]>} adj      file → [outgoing file dependencies]
 * @param {Map<string, string[]>} radj     file → [incoming file dependents]
 * @param {Map<string, number>} [seeds]    file → personalization weight (unnormalized)
 * @returns {Map<string, number>}          file → PageRank score
 */
function pageRank(files, adj, radj, seeds) {
  const N = files.length;
  if (N === 0) return new Map();

  // Index for O(1) lookup
  const idx = new Map(files.map((f, i) => [f, i]));

  // Out-degree per file
  const outDeg = files.map(f => adj.get(f)?.length ?? 0);

  // Personalisation vector (uniform if no seeds)
  const pVec = new Float64Array(N).fill(1 / N);
  if (seeds && seeds.size > 0) {
    let total = 0;
    for (const [, w] of seeds) total += w;
    for (const [f, w] of seeds) {
      const i = idx.get(f);
      if (i !== undefined) pVec[i] = w / total;
    }
    // Re-normalise in case seeds map to unknown files
    let sum = 0;
    for (let i = 0; i < N; i++) sum += pVec[i];
    if (sum > 0) for (let i = 0; i < N; i++) pVec[i] /= sum;
    else pVec.fill(1 / N); // all seeds unknown — fall back to uniform
  }

  // Initial rank
  let rank = new Float64Array(N).fill(1 / N);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const next = new Float64Array(N);

    // Dangling node mass (nodes with no out-edges)
    let danglingMass = 0;
    for (let i = 0; i < N; i++) {
      if (outDeg[i] === 0) danglingMass += rank[i];
    }

    for (let j = 0; j < N; j++) {
      // Contributions from in-edges
      let inflow = 0;
      const ins = radj.get(files[j]) ?? [];
      for (const src of ins) {
        const si = idx.get(src);
        if (si !== undefined && outDeg[si] > 0) {
          inflow += rank[si] / outDeg[si];
        }
      }
      next[j] =
        DAMPING * (inflow + danglingMass * pVec[j]) +
        (1 - DAMPING) * pVec[j];
    }

    // Convergence check
    let delta = 0;
    for (let i = 0; i < N; i++) delta += Math.abs(next[i] - rank[i]);
    rank = next;
    if (delta < EPSILON) break;
  }

  return new Map(files.map((f, i) => [f, rank[i]]));
}

class ContextOptimizer {
  constructor() {
    this._globalRanking = null; // Map<file, score>
    this._adjMap = null;        // Map<string, string[]>
    this._radjMap = null;       // Map<string, string[]>
    this._files = null;
    this._symbols = null;
  }

  /** Lazy-initialise adjacency maps from RepositoryGraphBuilder */
  _init() {
    if (this._adjMap) return;
    graphBuilder.load();
    if (!graphBuilder.isLoaded()) return; // graph absent

    const { files, edges } = graphBuilder.getFileGraph();
    this._files = files;

    const adj = new Map();
    const radj = new Map();
    for (const e of edges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from).push(e.to);
      if (!radj.has(e.to)) radj.set(e.to, []);
      radj.get(e.to).push(e.from);
    }
    this._adjMap = adj;
    this._radjMap = radj;

    // Pre-load symbol index for keyword → file matching
    this._symbols = new Map();
    for (const f of files) {
      const syms = graphBuilder.getSymbolsForFile(f).map(s => s.toLowerCase());
      this._symbols.set(f, syms);
    }
  }

  _requireGraph() {
    this._init();
    if (!this._adjMap) {
      throw {
        status: 'NOT_BUILT',
        artifact: 'graphify-out/graph.json',
        command: 'graphify update .  (or: pnpm graph:update)',
      };
    }
  }

  /**
   * Personalized PageRank biased toward `seedFiles`.
   * @param {string[]} [seedFiles]
   * @returns {Array<{file:string, score:number, rank:number}>}
   */
  rankFiles(seedFiles = []) {
    this._requireGraph();
    const seeds = new Map(seedFiles.filter(f => this._adjMap.has(f) || this._radjMap.has(f))
      .map(f => [f, 1]));
    const scores = pageRank(this._files, this._adjMap, this._radjMap, seeds.size ? seeds : null);
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([file, score], i) => ({ file, score, rank: i + 1 }));
  }

  /**
   * Unseeded global PageRank — structural importance.
   * Cached after first computation.
   * @returns {Array<{file:string, score:number, rank:number}>}
   */
  rankGlobally() {
    this._requireGraph();
    if (!this._globalRanking) {
      const scores = pageRank(this._files, this._adjMap, this._radjMap, null);
      this._globalRanking = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([file, score], i) => ({ file, score, rank: i + 1 }));
    }
    return this._globalRanking;
  }

  /**
   * Map query keywords to seed files via symbol/path matching, then run
   * personalized PageRank.
   *
   * Matching strategy (in priority order):
   *   1. Exact path substring match
   *   2. Filename contains a query token
   *   3. File exports a symbol matching a query token
   *
   * @param {string} query
   * @returns {Array<{file:string, score:number, rank:number}>}
   */
  rankForQuery(query) {
    this._requireGraph();
    if (!query || !query.trim()) return this.rankGlobally();

    const tokens = query
      .toLowerCase()
      .split(/[\s\-_/,.()+:]+/)
      .filter(t => t.length >= 3); // ignore very short tokens

    const seeds = new Map();

    for (const file of this._files) {
      const fileLower = file.toLowerCase();
      const fileParts = fileLower.split('/');
      const fileName = fileParts[fileParts.length - 1];

      let weight = 0;
      for (const token of tokens) {
        // Path substring
        if (fileLower.includes(token)) weight += 2;
        // Filename match (extra boost)
        if (fileName.includes(token)) weight += 3;
        // Symbol match
        const syms = this._symbols.get(file) ?? [];
        if (syms.some(s => s.includes(token))) weight += 1;
      }
      if (weight > 0) seeds.set(file, weight);
    }

    return this.rankFiles([...seeds.keys()]);
  }

  /**
   * Greedy selection of top-ranked files that fit within `tokenBudget`.
   * Estimates token count as Math.ceil(fileChars / 4) where fileChars is
   * a heuristic derived from symbol count when the file isn't read.
   *
   * @param {Array<{file:string, score:number, rank:number}>} rankedFiles
   * @param {number} tokenBudget
   * @returns {Array<{file:string, score:number, rank:number, estimatedTokens:number}>}
   */
  selectWithinBudget(rankedFiles, tokenBudget) {
    const selected = [];
    let used = 0;

    for (const entry of rankedFiles) {
      const est = this._estimateFileTokens(entry.file);
      if (used + est <= tokenBudget) {
        selected.push({ ...entry, estimatedTokens: est });
        used += est;
      }
      if (used >= tokenBudget) break;
    }
    return selected;
  }

  /**
   * Heuristic token estimate for a file.
   * Tries to stat the file; falls back to symbol-count * 30 tokens / symbol.
   * @param {string} file relative path from repo root
   * @returns {number} estimated token count
   */
  _estimateFileTokens(file) {
    try {
      const abs = resolve(REPO_ROOT, file);
      if (existsSync(abs)) {
        const content = readFileSync(abs, 'utf8');
        return this.estimateTokens(content);
      }
    } catch { /* file unreadable */ }
    // Fallback: symbols * avg tokens per symbol
    const symCount = graphBuilder.getSymbolsForFile(file).length;
    return Math.max(100, symCount * 30);
  }

  /**
   * Estimate token count for arbitrary text (chars / 4).
   * @param {string} text
   * @returns {number}
   */
  estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
  }

  /**
   * Write global ranking to graphify-out/context-intelligence/importance-ranking.json.
   */
  cache() {
    this._requireGraph();
    const ranked = this.rankGlobally();
    mkdirSync(OUT_DIR, { recursive: true });
    const payload = {
      generatedAt: new Date().toISOString(),
      totalFiles: this._files.length,
      // Store top-500 to keep file manageable
      top500: ranked.slice(0, 500),
    };
    writeFileSync(CACHE_PATH, JSON.stringify(payload), 'utf8');
    return { written: CACHE_PATH, topFile: ranked[0]?.file };
  }
}

export default new ContextOptimizer();
