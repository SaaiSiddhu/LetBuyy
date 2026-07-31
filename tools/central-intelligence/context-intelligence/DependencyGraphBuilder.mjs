/**
 * LCIS Context Intelligence — DependencyGraphBuilder
 *
 * Builds a module/package-level dependency graph by combining:
 *   1. Cross-file edges from RepositoryGraphBuilder (imports_from / imports /
 *      re_exports) collapsed into workspace-package edges.
 *   2. package.json files across apps/*, services/*, packages/* to capture
 *      declared dependencies (both workspace: and external).
 *
 * A "module" here is a workspace package identified by its package.json name
 * or, for files that don't belong to any package, the top-level directory
 * segment (e.g. "apps/identity-platform").
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import graphBuilder from './RepositoryGraphBuilder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const OUT_DIR = resolve(REPO_ROOT, 'graphify-out/context-intelligence');
const CACHE_PATH = resolve(OUT_DIR, 'dependency-graph.json');

/** Roots that host workspace packages */
const WORKSPACE_ROOTS = ['apps', 'services', 'packages'];

/** Locate all package.json files under workspace roots */
function findPackageJsons() {
  const results = [];
  for (const root of WORKSPACE_ROOTS) {
    const rootPath = resolve(REPO_ROOT, root);
    if (!existsSync(rootPath)) continue;
    try {
      // One level deep (app/service/package directories)
      const out = execSync(`find "${rootPath}" -maxdepth 2 -name "package.json" -not -path "*/node_modules/*"`, {
        encoding: 'utf8',
        timeout: 15000,
      });
      out.trim().split('\n').filter(Boolean).forEach(p => results.push(p));
    } catch {
      // Non-fatal — continue with what we have
    }
  }
  return results;
}

/** Convert a source_file path to a workspace package name */
function fileToPackage(file, filePackageMap) {
  if (!file) return null;
  for (const [prefix, pkgName] of filePackageMap) {
    if (file.startsWith(prefix)) return pkgName;
  }
  // Fallback: first two path segments (e.g. apps/identity-platform)
  const parts = file.split('/');
  if (parts.length >= 2 && WORKSPACE_ROOTS.includes(parts[0])) {
    return `${parts[0]}/${parts[1]}`;
  }
  return null;
}

class DependencyGraphBuilder {
  constructor() {
    /** @type {Map<string, Set<string>>} module → modules it depends on */
    this._deps = null;
    /** @type {Map<string, Set<string>>} module → modules that depend on it */
    this._dependents = null;
    /** @type {Map<string, object>} module name → package.json metadata */
    this._pkgMeta = null;
    this._built = false;
  }

  build() {
    if (this._built) return this;

    graphBuilder.load();

    // ── collect workspace packages ─────────────────────────────────────────
    const pkgJsonPaths = findPackageJsons();
    this._pkgMeta = new Map();
    /** Map<dirPrefix, packageName> sorted by prefix length descending */
    const filePackageMap = new Map();

    for (const pkgPath of pkgJsonPaths) {
      try {
        const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (!pkgJson.name) continue;
        // Relative dir prefix from repo root (no leading slash)
        const dirPrefix = pkgPath.replace(REPO_ROOT + '/', '').replace('/package.json', '');
        this._pkgMeta.set(pkgJson.name, {
          name: pkgJson.name,
          version: pkgJson.version,
          path: dirPrefix,
          dependencies: Object.keys(pkgJson.dependencies || {}),
          devDependencies: Object.keys(pkgJson.devDependencies || {}),
          peerDependencies: Object.keys(pkgJson.peerDependencies || {}),
        });
        filePackageMap.set(dirPrefix + '/', pkgJson.name);
      } catch {
        // Malformed package.json — skip
      }
    }

    // Sort by prefix length descending so longest match wins
    const sortedMap = new Map(
      [...filePackageMap.entries()].sort((a, b) => b[0].length - a[0].length)
    );

    // ── build declared dependency edges from package.json ─────────────────
    this._deps = new Map();
    this._dependents = new Map();

    const addEdge = (from, to) => {
      if (!from || !to || from === to) return;
      if (!this._deps.has(from)) this._deps.set(from, new Set());
      this._deps.get(from).add(to);
      if (!this._dependents.has(to)) this._dependents.set(to, new Set());
      this._dependents.get(to).add(from);
    };

    for (const [, meta] of this._pkgMeta) {
      const allDeps = [
        ...meta.dependencies,
        ...meta.devDependencies,
        ...meta.peerDependencies,
      ];
      for (const dep of allDeps) {
        // Only track workspace dependencies (those that match a known package name)
        if (this._pkgMeta.has(dep)) {
          addEdge(meta.name, dep);
        }
      }
    }

    // ── supplement with code-graph cross-package edges ─────────────────────
    if (graphBuilder.isLoaded()) {
      const { edges } = graphBuilder.getFileGraph();
      for (const edge of edges) {
        const fromPkg = fileToPackage(edge.from, sortedMap);
        const toPkg = fileToPackage(edge.to, sortedMap);
        if (fromPkg && toPkg && fromPkg !== toPkg) {
          addEdge(fromPkg, toPkg);
        }
      }
    }

    this._built = true;
    return this;
  }

  /** @returns {string[]} modules that `module` depends on */
  getModuleDependencies(module) {
    this._requireBuilt();
    return [...(this._deps.get(module) ?? [])];
  }

  /** @returns {string[]} modules that depend on `module` */
  getDependents(module) {
    this._requireBuilt();
    return [...(this._dependents.get(module) ?? [])];
  }

  /**
   * Returns modules with the highest in-degree (most depended-upon).
   * These are the shared infrastructure packages.
   * @param {number} [top=10]
   * @returns {Array<{module:string, inDegree:number, outDegree:number}>}
   */
  getCriticalModules(top = 10) {
    this._requireBuilt();
    const inDeg = new Map();
    const outDeg = new Map();
    for (const [mod, deps] of this._deps) {
      outDeg.set(mod, (outDeg.get(mod) || 0) + deps.size);
      for (const dep of deps) {
        inDeg.set(dep, (inDeg.get(dep) || 0) + 1);
      }
    }
    const all = new Set([...inDeg.keys(), ...outDeg.keys(), ...this._pkgMeta.keys()]);
    return [...all]
      .map(m => ({ module: m, inDegree: inDeg.get(m) || 0, outDegree: outDeg.get(m) || 0 }))
      .sort((a, b) => b.inDegree - a.inDegree)
      .slice(0, top);
  }

  /**
   * Detect import cycles using iterative DFS (Tarjan-inspired — finds SCCs
   * with more than one member, each of which represents a cycle).
   * @returns {Array<string[]>} list of cycle groups (each group is a set of modules in a cycle)
   */
  detectCycles() {
    this._requireBuilt();
    const index = new Map();
    const lowlink = new Map();
    const onStack = new Set();
    const stack = [];
    const sccs = [];
    let counter = 0;

    const strongConnect = (v) => {
      index.set(v, counter);
      lowlink.set(v, counter);
      counter++;
      stack.push(v);
      onStack.add(v);

      const neighbours = this._deps.get(v) ?? new Set();
      for (const w of neighbours) {
        if (!index.has(w)) {
          strongConnect(w);
          lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
        } else if (onStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
        }
      }

      if (lowlink.get(v) === index.get(v)) {
        const scc = [];
        let w;
        do {
          w = stack.pop();
          onStack.delete(w);
          scc.push(w);
        } while (w !== v);
        if (scc.length > 1) sccs.push(scc);
      }
    };

    const allModules = new Set([...this._deps.keys(), ...this._dependents.keys()]);
    for (const m of allModules) {
      if (!index.has(m)) strongConnect(m);
    }
    return sccs;
  }

  getStats() {
    if (!this._built) {
      return { status: 'NOT_BUILT', command: 'Call DependencyGraphBuilder.build() first.' };
    }
    const allMods = new Set([...this._deps.keys(), ...this._dependents.keys(), ...this._pkgMeta.keys()]);
    let edgeCount = 0;
    for (const [, deps] of this._deps) edgeCount += deps.size;
    const cycles = this.detectCycles();
    return {
      moduleCount: allMods.size,
      workspacePackageCount: this._pkgMeta.size,
      edgeCount,
      cycleCount: cycles.length,
      cycleGroups: cycles.length > 0 ? cycles : [],
    };
  }

  /**
   * Write cache to graphify-out/context-intelligence/dependency-graph.json.
   */
  cache() {
    this._requireBuilt();
    mkdirSync(OUT_DIR, { recursive: true });
    const payload = {
      generatedAt: new Date().toISOString(),
      stats: this.getStats(),
      criticalModules: this.getCriticalModules(20),
      deps: Object.fromEntries([...this._deps].map(([m, s]) => [m, [...s]])),
      dependents: Object.fromEntries([...this._dependents].map(([m, s]) => [m, [...s]])),
      packages: Object.fromEntries([...this._pkgMeta]),
    };
    writeFileSync(CACHE_PATH, JSON.stringify(payload), 'utf8');
    return { written: CACHE_PATH, stats: payload.stats };
  }

  _requireBuilt() {
    if (!this._built) {
      throw { status: 'NOT_BUILT', command: 'Call DependencyGraphBuilder.build() first.' };
    }
  }
}

export default new DependencyGraphBuilder();
