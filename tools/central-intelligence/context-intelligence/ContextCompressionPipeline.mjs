/**
 * LCIS V2 — ContextCompressionPipeline (Phase 14)
 *
 * Full pipeline: Repository Graph → Dependency Graph → Architecture Graph →
 * Global PageRank → 5 compressed context artifacts.
 *
 * Artifacts written to graphify-out/context-intelligence/:
 *   LCIS_CONTEXT_MAP.json         — compact navigable map (top-300 files by PageRank)
 *   LCIS_ARCHITECTURE_GRAPH.json  — services / domains / layers / queues / workers
 *   LCIS_DEPENDENCY_GRAPH.json    — module nodes + edges + critical modules + cycles
 *   LCIS_IMPORTANCE_RANKING.json  — full file ranking by PageRank score
 *   LCIS_CONTEXT_SUMMARY.md       — human-readable repo overview
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import repoBuilder from './RepositoryGraphBuilder.mjs';
import depBuilder from './DependencyGraphBuilder.mjs';
import archBuilder from './ArchitectureGraphBuilder.mjs';
import optimizer from './ContextOptimizer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const OUT_DIR = resolve(REPO_ROOT, 'graphify-out/context-intelligence');
const GRAPH_PATH = resolve(REPO_ROOT, 'graphify-out/graph.json');

// ── Artifact paths ─────────────────────────────────────────────────────────────
const ARTIFACTS = {
  contextMap:           resolve(OUT_DIR, 'LCIS_CONTEXT_MAP.json'),
  architectureGraph:    resolve(OUT_DIR, 'LCIS_ARCHITECTURE_GRAPH.json'),
  dependencyGraph:      resolve(OUT_DIR, 'LCIS_DEPENDENCY_GRAPH.json'),
  importanceRanking:    resolve(OUT_DIR, 'LCIS_IMPORTANCE_RANKING.json'),
  contextSummary:       resolve(OUT_DIR, 'LCIS_CONTEXT_SUMMARY.md'),
};

// ── Role heuristics ────────────────────────────────────────────────────────────
const ROLE_PATTERNS = [
  { re: /\/api\//,                role: 'api-route' },
  { re: /route\.(ts|tsx|js)$/,    role: 'api-route' },
  { re: /middleware\.(ts|js)$/,   role: 'middleware' },
  { re: /proxy\.(ts|js)$/,        role: 'middleware' },
  { re: /layout\.(tsx|jsx)$/,     role: 'layout' },
  { re: /page\.(tsx|jsx)$/,       role: 'page' },
  { re: /\/components?\//,        role: 'component' },
  { re: /\/hooks?\//,             role: 'hook' },
  { re: /\/lib\//,                role: 'library' },
  { re: /\/utils?\//,             role: 'utility' },
  { re: /\/types?\//,             role: 'types' },
  { re: /\/schemas?\//,           role: 'schema' },
  { re: /\/store\//,              role: 'state' },
  { re: /\/context\//,            role: 'context' },
  { re: /\/services?\//,          role: 'service' },
  { re: /\/workers?\//,           role: 'worker' },
  { re: /wrangler\.toml$/,        role: 'infra-config' },
  { re: /package\.json$/,         role: 'package-manifest' },
  { re: /\.(test|spec)\./,        role: 'test' },
];

function inferRole(filePath) {
  for (const { re, role } of ROLE_PATTERNS) {
    if (re.test(filePath)) return role;
  }
  return 'module';
}

// ── Domain index from path ─────────────────────────────────────────────────────
function inferDomain(filePath) {
  const parts = filePath.split('/');
  if (parts[0] === 'apps' || parts[0] === 'services') return parts[1] || 'root';
  if (parts[0] === 'packages') return `@pkg/${parts[1]}`;
  if (parts[0] === 'tools') return 'tools';
  return parts[0] || 'root';
}

// ── Git HEAD ───────────────────────────────────────────────────────────────────
function getGitHead() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// ── Byte-size of a file ────────────────────────────────────────────────────────
function byteSize(filePath) {
  try { return statSync(filePath).size; } catch { return 0; }
}

class ContextCompressionPipeline {
  constructor() {
    this._ranking = null;
    this._repoStats = null;
    this._archStats = null;
    this._depStats = null;
  }

  /** Return the 5 canonical artifact paths. */
  getArtifactPaths() {
    return { ...ARTIFACTS };
  }

  /**
   * Full pipeline.
   * @returns {Promise<{success:boolean, artifacts:object, stats:object} | {status:string, command:string}>}
   */
  async run() {
    // ── guard: graph.json must exist ──────────────────────────────────────────
    if (!existsSync(GRAPH_PATH)) {
      return {
        status: 'NOT BUILT',
        command: 'pnpm graph:update',
        message: 'graphify-out/graph.json is absent. Run the build command then retry.',
      };
    }

    mkdirSync(OUT_DIR, { recursive: true });

    const t0 = Date.now();

    // ── Stage 1: load repository graph ────────────────────────────────────────
    repoBuilder.load();
    this._repoStats = repoBuilder.getStats();

    // ── Stage 2: build dependency graph ──────────────────────────────────────
    depBuilder.build();
    this._depStats = depBuilder.getStats();

    // ── Stage 3: build architecture graph ────────────────────────────────────
    archBuilder.build();
    this._archStats = archBuilder.getStats();

    // ── Stage 4: global PageRank ──────────────────────────────────────────────
    this._ranking = optimizer.rankGlobally();

    // ── Stage 5: generate 5 artifacts ────────────────────────────────────────
    const r1 = this.generateImportanceRanking();
    const r2 = this.generateContextMap();
    const r3 = this.generateArchitectureGraph();
    const r4 = this.generateDependencyGraph();
    const r5 = this.generateContextSummary();

    const elapsed = Date.now() - t0;

    // Compression ratio: estimated raw repo tokens vs top-300 summary
    const rankingCount = this._ranking.length;
    const top300Count = Math.min(300, rankingCount);
    const estimatedRawTokens = this._repoStats.nodeCount
      ? Math.round(this._repoStats.nodeCount * 12)
      : 0;
    const estimatedSummaryTokens = top300Count * 80; // ~80 tokens per entry
    const compressionRatio = estimatedRawTokens > 0
      ? (estimatedSummaryTokens / estimatedRawTokens).toFixed(4)
      : 'N/A';

    const topFile = this._ranking.length > 0 ? this._ranking[0].file : 'N/A';

    const stats = {
      pipelineMs: elapsed,
      repoStats: this._repoStats,
      depStats: this._depStats,
      archStats: this._archStats,
      rankingCount,
      top300Count,
      estimatedRawTokens,
      estimatedSummaryTokens,
      compressionRatio,
      topFile,
      artifacts: {
        contextMap:        { path: ARTIFACTS.contextMap,        bytes: byteSize(ARTIFACTS.contextMap) },
        architectureGraph: { path: ARTIFACTS.architectureGraph, bytes: byteSize(ARTIFACTS.architectureGraph) },
        dependencyGraph:   { path: ARTIFACTS.dependencyGraph,   bytes: byteSize(ARTIFACTS.dependencyGraph) },
        importanceRanking: { path: ARTIFACTS.importanceRanking, bytes: byteSize(ARTIFACTS.importanceRanking) },
        contextSummary:    { path: ARTIFACTS.contextSummary,    bytes: byteSize(ARTIFACTS.contextSummary) },
      },
    };

    return {
      success: true,
      artifacts: {
        contextMap:        ARTIFACTS.contextMap,
        architectureGraph: ARTIFACTS.architectureGraph,
        dependencyGraph:   ARTIFACTS.dependencyGraph,
        importanceRanking: ARTIFACTS.importanceRanking,
        contextSummary:    ARTIFACTS.contextSummary,
      },
      stats,
    };
  }

  /**
   * LCIS_CONTEXT_MAP.json
   * Compact navigable map: top-300 files by PageRank + domain index + service index.
   */
  generateContextMap() {
    const ranking = this._ranking ?? optimizer.rankGlobally();
    const repoStats = this._repoStats ?? repoBuilder.getStats();

    const topFiles = ranking.slice(0, 300).map(({ file, score, rank }) => {
      const symbols = repoBuilder.isLoaded()
        ? repoBuilder.getSymbolsForFile(file).slice(0, 15)
        : [];
      return {
        path: file,
        importance: parseFloat(score.toExponential(4)),
        rank,
        symbols,
        role: inferRole(file),
        domain: inferDomain(file),
      };
    });

    // Build domain index: domain → [file paths]
    const domainIndex = {};
    for (const entry of topFiles) {
      if (!domainIndex[entry.domain]) domainIndex[entry.domain] = [];
      domainIndex[entry.domain].push(entry.path);
    }

    // Build service index: infer services from top-file domains
    const serviceSet = new Set(
      topFiles.map(e => e.domain).filter(d => d.startsWith('apps/') || d.startsWith('services/'))
    );
    const serviceIndex = [...serviceSet].sort();

    const payload = {
      generatedAt: new Date().toISOString(),
      gitHead: getGitHead(),
      repoStats,
      topFiles,
      domainIndex,
      serviceIndex,
    };

    writeFileSync(ARTIFACTS.contextMap, JSON.stringify(payload, null, 2), 'utf8');
    return { written: ARTIFACTS.contextMap, topFilesCount: topFiles.length };
  }

  /**
   * LCIS_ARCHITECTURE_GRAPH.json
   * Services, domains, layers, queues, workers, edges.
   */
  generateArchitectureGraph() {
    const builder = archBuilder.isBuilt ? archBuilder : archBuilder.build();

    const nodes = builder._nodes ?? [];
    const edges = builder._edges ?? [];
    const layers = builder._built ? builder.getLayers() : {};
    const domains = builder._built ? builder.getDomains() : [];
    const services = builder._built ? builder.getServices() : [];
    const stats = builder.getStats();

    const queues = nodes.filter(n => n.type === 'queue');
    const workers = nodes.filter(n => n.type === 'worker');

    const payload = {
      generatedAt: new Date().toISOString(),
      stats,
      services,
      domains,
      layers,
      queues,
      workers,
      edges,
    };

    writeFileSync(ARTIFACTS.architectureGraph, JSON.stringify(payload, null, 2), 'utf8');
    return { written: ARTIFACTS.architectureGraph, nodeCount: nodes.length, edgeCount: edges.length };
  }

  /**
   * LCIS_DEPENDENCY_GRAPH.json
   * Module nodes + dependency edges + critical modules + cycles.
   */
  generateDependencyGraph() {
    const builder = depBuilder._built ? depBuilder : depBuilder.build();
    const stats = builder.getStats();
    const criticalModules = builder.getCriticalModules(30);
    const cycles = builder.detectCycles();

    // Serialise edges
    const edges = [];
    for (const [mod, deps] of (builder._deps ?? new Map())) {
      for (const dep of deps) {
        edges.push({ from: mod, to: dep });
      }
    }

    // Module nodes with metadata
    const nodes = [];
    const allMods = new Set([
      ...(builder._deps?.keys() ?? []),
      ...(builder._dependents?.keys() ?? []),
      ...(builder._pkgMeta?.keys() ?? []),
    ]);
    for (const mod of allMods) {
      const meta = builder._pkgMeta?.get(mod);
      nodes.push({
        id: mod,
        version: meta?.version ?? null,
        path: meta?.path ?? null,
        inDegree: [...(builder._dependents?.get(mod) ?? [])].length,
        outDegree: [...(builder._deps?.get(mod) ?? [])].length,
      });
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      stats,
      criticalModules,
      cycles,
      nodes,
      edges,
    };

    writeFileSync(ARTIFACTS.dependencyGraph, JSON.stringify(payload, null, 2), 'utf8');
    return { written: ARTIFACTS.dependencyGraph, nodeCount: nodes.length, edgeCount: edges.length };
  }

  /**
   * LCIS_IMPORTANCE_RANKING.json
   * Full file ranking by global PageRank score.
   */
  generateImportanceRanking() {
    const ranking = this._ranking ?? optimizer.rankGlobally();

    const payload = {
      generatedAt: new Date().toISOString(),
      algorithm: 'PageRank(d=0.85, iter=30, ε=1e-6)',
      totalFiles: ranking.length,
      entries: ranking.map(({ file, score, rank }) => ({
        file,
        score: parseFloat(score.toExponential(6)),
        rank,
      })),
    };

    writeFileSync(ARTIFACTS.importanceRanking, JSON.stringify(payload, null, 2), 'utf8');
    return { written: ARTIFACTS.importanceRanking, entryCount: ranking.length };
  }

  /**
   * LCIS_CONTEXT_SUMMARY.md
   * Human-readable repo overview built from the generated artifacts.
   */
  generateContextSummary() {
    const ranking = this._ranking ?? optimizer.rankGlobally();
    const repoStats = this._repoStats ?? repoBuilder.getStats();
    const depStats = this._depStats ?? depBuilder.getStats();
    const archStats = this._archStats ?? archBuilder.getStats();

    const top20 = ranking.slice(0, 20);
    const totalFiles = ranking.length;
    const top300 = Math.min(300, totalFiles);

    // Layer breakdown from architecture
    const layerCounts = archStats.layerCounts ?? {};
    const layerLines = Object.entries(layerCounts)
      .map(([l, c]) => `  - ${l}: ${c} node(s)`)
      .join('\n');

    // Domain list from architecture nodes
    const domains = archBuilder._built
      ? archBuilder.getDomains().map(d => `  - ${d.label ?? d.key} (\`${d.key}\`)`)
      : ['  (architecture graph not available)'];

    // Top-20 files table
    const fileRows = top20.map(({ file, score, rank }) => {
      const role = inferRole(file);
      const symbols = repoBuilder.isLoaded()
        ? repoBuilder.getSymbolsForFile(file).slice(0, 5).join(', ')
        : '';
      return `| ${rank} | \`${file}\` | ${role} | ${score.toExponential(3)} | ${symbols} |`;
    }).join('\n');

    // Compression stats
    const estimatedRawTokens = repoStats.nodeCount ? Math.round(repoStats.nodeCount * 12) : 0;
    const summaryTokens = top300 * 80;
    const ratio = estimatedRawTokens > 0
      ? (summaryTokens / estimatedRawTokens).toFixed(4)
      : 'N/A';

    const gitHead = getGitHead();
    const now = new Date().toISOString();

    const md = `# LCIS Context Summary
> Generated: ${now}  |  Git HEAD: \`${gitHead}\`

## Repository Overview

| Metric | Value |
|--------|-------|
| Total nodes (graph.json) | ${(repoStats.nodeCount ?? 0).toLocaleString()} |
| Total graph edges | ${(repoStats.edgeCount ?? 0).toLocaleString()} |
| Source files indexed | ${(repoStats.fileCount ?? 0).toLocaleString()} |
| File dependency edges | ${(repoStats.fileEdgeCount ?? 0).toLocaleString()} |
| Graph built at commit | \`${repoStats.builtAtCommit ?? 'N/A'}\` |

## Compression Stats

| Metric | Value |
|--------|-------|
| Files ranked | ${totalFiles.toLocaleString()} |
| Context map entries (top-300) | ${top300} |
| Estimated raw repo tokens | ~${estimatedRawTokens.toLocaleString()} |
| Estimated summary tokens | ~${summaryTokens.toLocaleString()} |
| Compression ratio | ${ratio} |

## Architectural Layers

${layerLines || '  (no layer data)'}

## Business Domains (${domains.length})

${domains.join('\n')}

## Module Dependency Graph

| Metric | Value |
|--------|-------|
| Workspace packages | ${depStats.workspacePackageCount ?? 0} |
| Total modules | ${depStats.moduleCount ?? 0} |
| Dependency edges | ${depStats.edgeCount ?? 0} |
| Import cycles detected | ${depStats.cycleCount ?? 0} |

## Top-20 Most Important Files (by PageRank)

| Rank | File | Role | Score | Key Symbols |
|------|------|------|-------|-------------|
${fileRows}

## Artifacts in this Package

| Artifact | Description |
|----------|-------------|
| \`LCIS_CONTEXT_MAP.json\` | Top-${top300} files with paths, roles, symbols, domain grouping — start here for fast lookup |
| \`LCIS_ARCHITECTURE_GRAPH.json\` | All services, domains, queues, workers, and their relations |
| \`LCIS_DEPENDENCY_GRAPH.json\` | Workspace module graph: critical modules, cycles, inDegree/outDegree |
| \`LCIS_IMPORTANCE_RANKING.json\` | Full PageRank file ranking (all ${totalFiles.toLocaleString()} files) |
| \`LCIS_CONTEXT_SUMMARY.md\` | This file — human-readable overview |

## How to Use This Map

1. **Finding a file's role**: Look up \`LCIS_CONTEXT_MAP.json → topFiles[].path\` — each entry includes \`role\`, \`domain\`, and top \`symbols\`.
2. **Blast-radius query**: Use \`domainIndex\` in the context map to find all important files in a domain, then cross-reference with \`LCIS_DEPENDENCY_GRAPH.json → criticalModules\`.
3. **Architecture overview**: \`LCIS_ARCHITECTURE_GRAPH.json → layers\` gives the four-tier view (edge / gateway / async / data).
4. **AI context**: Feed \`LCIS_CONTEXT_MAP.json\` + this summary to any model — it fits under 20k tokens and provides the navigable skeleton of the entire repository.
5. **LCIS OMEGA-FIRST policy**: Always query \`/api/search-v2?q=...\` or \`/api/workspace?domain=X\` before scanning raw files. These surfaces serve data from the same graph that generated this map.
`;

    writeFileSync(ARTIFACTS.contextSummary, md, 'utf8');
    return { written: ARTIFACTS.contextSummary };
  }
}

const pipeline = new ContextCompressionPipeline();
export default pipeline;

// ── CLI entry point ────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  pipeline.run().then(result => {
    console.log(JSON.stringify(result.stats ?? result, null, 2));
  }).catch(err => {
    console.error(JSON.stringify({ error: String(err), stack: err?.stack }, null, 2));
    process.exit(1);
  });
}
