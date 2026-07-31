/**
 * LCIS Context Intelligence — RepositoryGraphBuilder
 *
 * Loads graphify-out/graph.json (52 k nodes / 66 k edges) and builds
 * in-memory indexes for:
 *   • file-level adjacency (cross-file dependency edges)
 *   • symbol index (file → exported/defined symbols)
 *   • reverse adjacency (file → dependents)
 *
 * Relations treated as dependency edges:
 *   imports_from, imports, calls, references, re_exports, inherits
 *
 * The 44 MB JSON is parsed once; all derived structures are kept in Maps.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const GRAPH_PATH = resolve(REPO_ROOT, 'graphify-out/graph.json');
const OUT_DIR = resolve(REPO_ROOT, 'graphify-out/context-intelligence');
const CACHE_PATH = resolve(OUT_DIR, 'repo-file-graph.json');

/** Edge types that represent a dependency from source file → target file */
const DEPENDENCY_RELATIONS = new Set([
  'imports_from',
  'imports',
  'calls',
  'references',
  're_exports',
  'inherits',
]);

/** Symbol-producing relations within a file */
const SYMBOL_RELATIONS = new Set(['defines', 'exports', 'method', 'implements', 'extends']);

class RepositoryGraphBuilder {
  constructor() {
    /** @type {Map<string, object>} node id → node */
    this._byId = null;
    /** @type {Map<string, Set<string>>} file → files it depends on */
    this._adj = null;
    /** @type {Map<string, Set<string>>} file → files that depend on it */
    this._radj = null;
    /** @type {Map<string, string[]>} file → symbol labels */
    this._symbols = null;
    /** @type {Array<{from:string,to:string,weight:number}>} file-level edges */
    this._fileEdges = null;
    /** @type {string[]} distinct source files */
    this._files = null;
    /** @type {object|null} raw graph metadata */
    this._meta = null;
    this._loaded = false;
  }

  /**
   * Load and index graph.json. Idempotent — safe to call multiple times.
   * @returns {this}
   */
  load() {
    if (this._loaded) return this;

    if (!existsSync(GRAPH_PATH)) {
      return this; // graceful — isLoaded() returns false
    }

    const raw = readFileSync(GRAPH_PATH, 'utf8');
    const g = JSON.parse(raw);

    // ── node index ─────────────────────────────────────────────────────────
    this._byId = new Map();
    const nodeToFile = new Map(); // node id → source_file
    for (const node of g.nodes) {
      this._byId.set(node.id, node);
      if (node.source_file) nodeToFile.set(node.id, node.source_file);
    }

    // ── symbol index ───────────────────────────────────────────────────────
    // A symbol is the label of any code node whose link to its parent is a
    // symbol-producing relation (defines / exports / method / implements /
    // extends). We also just collect all code-typed nodes per file as a
    // simpler fallback since graphify emits them with their label.
    this._symbols = new Map();
    for (const node of g.nodes) {
      if (node.file_type !== 'code') continue;
      const file = node.source_file;
      if (!file) continue;
      if (!this._symbols.has(file)) this._symbols.set(file, []);
      // label is the symbol name (function, class, variable, export …)
      const label = node.label || node.norm_label;
      if (label && !this._symbols.get(file).includes(label)) {
        this._symbols.get(file).push(label);
      }
    }

    // Supplement with explicit symbol-producing link targets
    for (const link of g.links) {
      if (!SYMBOL_RELATIONS.has(link.relation)) continue;
      const targetNode = this._byId.get(link.target);
      if (!targetNode) continue;
      const file = link.source_file || targetNode.source_file;
      if (!file) continue;
      const label = targetNode.label || targetNode.norm_label;
      if (!label) continue;
      if (!this._symbols.has(file)) this._symbols.set(file, []);
      if (!this._symbols.get(file).includes(label)) {
        this._symbols.get(file).push(label);
      }
    }

    // ── file-level adjacency ───────────────────────────────────────────────
    this._adj = new Map();
    this._radj = new Map();
    const edgeWeights = new Map(); // "from|to" → weight sum

    for (const link of g.links) {
      if (!DEPENDENCY_RELATIONS.has(link.relation)) continue;
      const sf = nodeToFile.get(link.source);
      const tf = nodeToFile.get(link.target);
      if (!sf || !tf || sf === tf) continue;

      const key = `${sf}|${tf}`;
      edgeWeights.set(key, (edgeWeights.get(key) || 0) + (link.weight || 1));

      if (!this._adj.has(sf)) this._adj.set(sf, new Set());
      this._adj.get(sf).add(tf);

      if (!this._radj.has(tf)) this._radj.set(tf, new Set());
      this._radj.get(tf).add(sf);
    }

    // Materialise edge list
    this._fileEdges = [];
    for (const [key, weight] of edgeWeights) {
      const [from, to] = key.split('|');
      this._fileEdges.push({ from, to, weight });
    }

    // ── distinct files ─────────────────────────────────────────────────────
    const fileSet = new Set();
    for (const node of g.nodes) {
      if (node.source_file) fileSet.add(node.source_file);
    }
    this._files = [...fileSet];

    this._meta = {
      builtAtCommit: g.built_at_commit,
      directed: g.directed,
      multigraph: g.multigraph,
      rawNodeCount: g.nodes.length,
      rawEdgeCount: g.links.length,
    };

    this._loaded = true;
    return this;
  }

  /** @returns {boolean} */
  isLoaded() {
    return this._loaded;
  }

  /**
   * Guard helper — throws a structured NOT_BUILT object if graph is absent.
   */
  _requireLoaded() {
    if (!this._loaded) {
      throw {
        status: 'NOT_BUILT',
        artifact: 'graphify-out/graph.json',
        command: 'graphify update .  (or: pnpm graph:update)',
        message: 'graph.json is missing. Run the build command then retry.',
      };
    }
  }

  /**
   * File-level dependency graph, serialisable.
   * @returns {{files:string[], edges:Array<{from:string,to:string,weight:number}>}}
   */
  getFileGraph() {
    this._requireLoaded();
    return {
      files: this._files,
      edges: this._fileEdges,
    };
  }

  /**
   * Files that `file` imports / calls / references.
   * @param {string} file
   * @returns {string[]}
   */
  getFileDependencies(file) {
    this._requireLoaded();
    return [...(this._adj.get(file) ?? [])];
  }

  /**
   * Files that import / call / reference `file`.
   * @param {string} file
   * @returns {string[]}
   */
  getFileDependents(file) {
    this._requireLoaded();
    return [...(this._radj.get(file) ?? [])];
  }

  /**
   * All symbol labels found in `file`.
   * @param {string} file
   * @returns {string[]}
   */
  getSymbolsForFile(file) {
    this._requireLoaded();
    return this._symbols.get(file) ?? [];
  }

  /**
   * High-level statistics.
   * @returns {{status?:string, command?:string} | {nodeCount:number, edgeCount:number, fileCount:number, communityCount:number, fileEdgeCount:number}}
   */
  getStats() {
    if (!this._loaded) {
      return {
        status: 'NOT_BUILT',
        artifact: 'graphify-out/graph.json',
        command: 'graphify update .  (or: pnpm graph:update)',
      };
    }
    const communities = new Set();
    for (const [, node] of this._byId) {
      if (node.community != null) communities.add(node.community);
    }
    return {
      nodeCount: this._byId.size,
      edgeCount: this._meta.rawEdgeCount,
      fileCount: this._files.length,
      communityCount: communities.size,
      fileEdgeCount: this._fileEdges.length,
      builtAtCommit: this._meta.builtAtCommit,
    };
  }

  /**
   * Build, load, and write cache artefact to graphify-out/context-intelligence/repo-file-graph.json.
   * @returns {{written:string, stats:object}}
   */
  buildAndCache() {
    this.load();
    this._requireLoaded();

    mkdirSync(OUT_DIR, { recursive: true });

    const payload = {
      generatedAt: new Date().toISOString(),
      stats: this.getStats(),
      files: this._files,
      // Adjacency as serialisable arrays
      adj: Object.fromEntries([...this._adj].map(([f, s]) => [f, [...s]])),
      radj: Object.fromEntries([...this._radj].map(([f, s]) => [f, [...s]])),
      edges: this._fileEdges,
      // Symbol index — keep top-20 per file to limit size
      symbols: Object.fromEntries(
        [...this._symbols].map(([f, syms]) => [f, syms.slice(0, 20)])
      ),
    };

    writeFileSync(CACHE_PATH, JSON.stringify(payload), 'utf8');
    return { written: CACHE_PATH, stats: payload.stats };
  }
}

export default new RepositoryGraphBuilder();
