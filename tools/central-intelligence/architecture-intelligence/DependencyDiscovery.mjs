/**
 * DependencyDiscovery.mjs — LCIS Architecture Intelligence
 * Discovers internal package dependencies across the LetBuyy monorepo.
 * Sources: package.json files in apps/ services/ packages/ + optional graph.json import edges.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

async function readJsonSafe(filePath) {
  try { return JSON.parse(await readFile(filePath, 'utf8')); } catch { return null; }
}
async function exists(p) { try { await stat(p); return true; } catch { return false; } }

const INTERNAL_SCOPE = '@letbuyy/';

// High-blast-radius packages known from CLAUDE.md / codebase constitution
const KNOWN_CRITICAL = new Set(['shared-types', 'api-client', 'auth-core', 'ui', 'theme-engine', 'tenant-core']);

class DependencyDiscovery {
  #depGraph = null;     // Map<packageName, { internal: string[], external: string[] }>
  #reverseDeps = null;  // Map<packageName, Set<string>> — who depends on packageName

  async #buildGraph() {
    if (this.#depGraph) return;
    this.#depGraph = new Map();
    this.#reverseDeps = new Map();

    const roots = ['apps', 'services', 'packages'];
    for (const root of roots) {
      const dir = join(REPO_ROOT, root);
      let entries = [];
      try { entries = await readdir(dir); } catch { continue; }
      for (const entry of entries) {
        const pkgPath = join(dir, entry, 'package.json');
        if (!await exists(pkgPath)) continue;
        const pkg = await readJsonSafe(pkgPath);
        if (!pkg) continue;
        const pkgName = pkg.name ?? `${INTERNAL_SCOPE}${entry}`;
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
        const internal = Object.keys(allDeps).filter(d => d.startsWith(INTERNAL_SCOPE));
        const external = Object.keys(pkg.dependencies ?? {}).filter(d => !d.startsWith(INTERNAL_SCOPE));
        this.#depGraph.set(pkgName, { internal, external, path: `${root}/${entry}`, rawName: entry });
        for (const dep of internal) {
          if (!this.#reverseDeps.has(dep)) this.#reverseDeps.set(dep, new Set());
          this.#reverseDeps.get(dep).add(pkgName);
        }
      }
    }

    // Optionally augment with graph.json import edges (best-effort)
    const graphPath = join(REPO_ROOT, 'graphify-out', 'graph.json');
    const graph = await readJsonSafe(graphPath);
    if (graph && Array.isArray(graph.edges)) {
      for (const edge of graph.edges) {
        if (edge.type !== 'import') continue;
        const { from, to } = edge;
        if (!from || !to) continue;
        // Only internal cross-package edges (path contains node_modules/@letbuyy or packages/)
        if (!to.includes('/packages/') && !to.includes('@letbuyy')) continue;
        const fromPkg = this.#inferPackageName(from);
        const toPkg = this.#inferPackageName(to);
        if (!fromPkg || !toPkg || fromPkg === toPkg) continue;
        if (!this.#depGraph.has(fromPkg)) this.#depGraph.set(fromPkg, { internal: [], external: [], path: from, rawName: fromPkg });
        const entry = this.#depGraph.get(fromPkg);
        if (!entry.internal.includes(toPkg)) entry.internal.push(toPkg);
        if (!this.#reverseDeps.has(toPkg)) this.#reverseDeps.set(toPkg, new Set());
        this.#reverseDeps.get(toPkg).add(fromPkg);
      }
    }
  }

  #inferPackageName(filePath) {
    // e.g. "packages/shared-types/src/index.ts" → "@letbuyy/shared-types"
    const pkgMatch = filePath.match(/packages\/([^/]+)/);
    if (pkgMatch) return `${INTERNAL_SCOPE}${pkgMatch[1]}`;
    const appMatch = filePath.match(/apps\/([^/]+)/);
    if (appMatch) return `${INTERNAL_SCOPE}${appMatch[1]}`;
    const svcMatch = filePath.match(/services\/([^/]+)/);
    if (svcMatch) return `${INTERNAL_SCOPE}${svcMatch[1]}`;
    return null;
  }

  async discover() {
    await this.#buildGraph();
    const result = {};
    for (const [name, info] of this.#depGraph.entries()) {
      result[name] = {
        ...info,
        dependentCount: this.#reverseDeps.get(name)?.size ?? 0,
        dependents: [...(this.#reverseDeps.get(name) ?? [])],
      };
    }
    return result;
  }

  async getInternalDependencies(pkg) {
    await this.#buildGraph();
    // Accept either "@letbuyy/foo" or "foo"
    const key = pkg.startsWith(INTERNAL_SCOPE) ? pkg : `${INTERNAL_SCOPE}${pkg}`;
    return this.#depGraph.get(key)?.internal ?? [];
  }

  async getExternalDependencies(pkg) {
    await this.#buildGraph();
    const key = pkg.startsWith(INTERNAL_SCOPE) ? pkg : `${INTERNAL_SCOPE}${pkg}`;
    return this.#depGraph.get(key)?.external ?? [];
  }

  async getHighBlastRadius() {
    await this.#buildGraph();
    const results = [];
    for (const [name, dependents] of this.#reverseDeps.entries()) {
      const shortName = name.replace(INTERNAL_SCOPE, '');
      results.push({
        package: name,
        dependentCount: dependents.size,
        dependents: [...dependents],
        isCritical: KNOWN_CRITICAL.has(shortName),
        blastRadius: dependents.size >= 5 ? 'high' : dependents.size >= 2 ? 'medium' : 'low',
      });
    }
    return results.sort((a, b) => b.dependentCount - a.dependentCount);
  }

  async getChangeRisk(pkg) {
    await this.#buildGraph();
    const key = pkg.startsWith(INTERNAL_SCOPE) ? pkg : `${INTERNAL_SCOPE}${pkg}`;
    const dependents = this.#reverseDeps.get(key);
    const count = dependents?.size ?? 0;
    return {
      package: key,
      dependentCount: count,
      riskLevel: count >= 8 ? 'critical' : count >= 5 ? 'high' : count >= 2 ? 'medium' : 'low',
      dependents: [...(dependents ?? [])],
    };
  }
}

export default new DependencyDiscovery();
