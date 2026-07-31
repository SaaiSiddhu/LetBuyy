/**
 * LCIS Context Intelligence — ContextAssembler
 *
 * Given a query/task + token budget, assembles the MINIMAL relevant context
 * from the repository WITHOUT loading full source files.
 *
 * The output is a compact, structured summary with:
 *   • selected files (path, top exported symbols, 1-line role, key dependencies)
 *   • overall repository summary
 *   • token budget accounting
 *   • coverage signal
 *
 * The key insight: an AI reasoning about the codebase needs to know WHICH
 * files matter and WHAT they export/import — not their full content.  This
 * assembler produces exactly that in a budget-respecting way.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import graphBuilder from './RepositoryGraphBuilder.mjs';
import optimizer from './ContextOptimizer.mjs';
import archBuilder from './ArchitectureGraphBuilder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const DOMAIN_PATH = resolve(REPO_ROOT, 'graphify-out/domain-intel.json');
const INFRA_PATH = resolve(REPO_ROOT, 'graphify-out/infra-intel.json');
const RUNBOOKS_PATH = resolve(REPO_ROOT, 'graphify-out/runbooks.json');

/** Default token budget if none supplied */
const DEFAULT_BUDGET = 8000;

/** Number of symbols to include per file in the compact summary */
const MAX_SYMBOLS_PER_FILE = 8;
/** Max dependencies to list per file */
const MAX_DEPS_PER_FILE = 5;

/**
 * Derive a 1-line role description for a file from its path and symbols.
 * Pure heuristic — no LLM call.
 */
function inferRole(file, symbols) {
  const lower = file.toLowerCase();
  const segments = lower.split('/');

  // Known structural patterns
  if (lower.includes('/api/') && lower.endsWith('/route.ts')) return 'Next.js API route handler';
  if (lower.includes('/app/') && lower.endsWith('/page.tsx')) return 'Next.js page component';
  if (lower.includes('/app/') && lower.endsWith('/layout.tsx')) return 'Next.js layout component';
  if (lower.includes('middleware')) return 'Request middleware / host routing';
  if (lower.includes('proxy')) return 'Request proxy / middleware';
  if (lower.includes('wrangler.toml')) return 'Cloudflare Worker configuration';
  if (lower.includes('package.json')) return 'Package manifest';
  if (lower.includes('supabase') || lower.includes('/db/')) return 'Database access / Supabase client';
  if (lower.includes('/auth/')) return 'Authentication logic';
  if (lower.includes('/components/')) return 'UI component';
  if (lower.includes('/hooks/')) return 'React hook';
  if (lower.includes('/lib/') || lower.includes('/utils/')) return 'Shared utility / library';
  if (lower.includes('/types/') || lower.includes('types.ts')) return 'Type definitions';
  if (lower.includes('/config/') || lower.endsWith('config.ts')) return 'Configuration';
  if (lower.includes('/actions/')) return 'Server action / mutation';
  if (lower.includes('/store/') || lower.includes('store.ts')) return 'State store';
  if (lower.includes('worker') && lower.includes('.ts')) return 'Queue / background worker';
  if (lower.endsWith('.sql')) return 'SQL migration / schema';
  if (lower.endsWith('.test.') || lower.endsWith('.spec.')) return 'Test file';
  if (segments.includes('scripts')) return 'Build / maintenance script';

  // Fallback to file name
  const filename = segments[segments.length - 1].replace(/\.[^.]+$/, '');
  return `Module: ${filename}`;
}

/**
 * Build a compact single-file context entry.
 * Reads the actual file for a line count and first-comment heuristic only.
 */
function buildFileEntry(file, score, rankedFiles) {
  const symbols = graphBuilder.getSymbolsForFile(file).slice(0, MAX_SYMBOLS_PER_FILE);
  const dependsOn = graphBuilder.getFileDependencies(file).slice(0, MAX_DEPS_PER_FILE);
  const role = inferRole(file, symbols);

  let lineCount = null;
  try {
    const abs = resolve(REPO_ROOT, file);
    if (existsSync(abs)) {
      const content = readFileSync(abs, 'utf8');
      lineCount = content.split('\n').length;
    }
  } catch { /* unreadable */ }

  return {
    path: file,
    role,
    symbols,
    dependsOn,
    importanceScore: parseFloat(score.toFixed(8)),
    lines: lineCount,
  };
}

class ContextAssembler {
  /**
   * Assemble minimal context for a natural-language query.
   *
   * @param {string} query
   * @param {{tokenBudget?:number}} [opts]
   * @returns {{
   *   query:string,
   *   tokenBudget:number,
   *   estimatedTokens:number,
   *   files:object[],
   *   summary:string,
   *   coverage:string,
   *   graphLoaded:boolean
   * }}
   */
  assemble(query, opts = {}) {
    const budget = opts.tokenBudget ?? DEFAULT_BUDGET;

    graphBuilder.load();
    if (!graphBuilder.isLoaded()) {
      return {
        query,
        tokenBudget: budget,
        estimatedTokens: 0,
        files: [],
        summary: 'Repository graph not built.',
        coverage: '0%',
        graphLoaded: false,
        status: 'NOT_BUILT',
        command: 'graphify update .  (or: pnpm graph:update)',
      };
    }

    // ── rank ───────────────────────────────────────────────────────────────
    const ranked = query && query.trim()
      ? optimizer.rankForQuery(query)
      : optimizer.rankGlobally();

    // ── select within budget ───────────────────────────────────────────────
    const selected = optimizer.selectWithinBudget(ranked, budget);

    // ── build compact entries ──────────────────────────────────────────────
    const files = selected.map(({ file, score }) =>
      buildFileEntry(file, score, ranked)
    );

    const estimatedTokens = selected.reduce((s, e) => s + (e.estimatedTokens || 0), 0);
    const stats = graphBuilder.getStats();
    const coveragePct = stats.fileCount > 0
      ? ((files.length / stats.fileCount) * 100).toFixed(1)
      : '0';

    const summary = [
      `Repository: ${stats.fileCount} files, ${stats.nodeCount} symbols, ${stats.edgeCount} edges.`,
      `Context for "${query}": ${files.length} files selected (≈${estimatedTokens} tokens / ${budget} budget).`,
      `Top file: ${files[0]?.path ?? 'n/a'} — ${files[0]?.role ?? ''}`,
    ].join(' ');

    return {
      query,
      tokenBudget: budget,
      estimatedTokens,
      files,
      summary,
      coverage: `${coveragePct}%`,
      graphLoaded: true,
      totalRepoFiles: stats.fileCount,
      filesSelected: files.length,
    };
  }

  /**
   * Assemble context focused on a specific business domain.
   * Seeds the ranker with files known to belong to the domain's routes/rpcs.
   *
   * @param {string} domainKey  e.g. 'payments', 'orders', 'themes'
   * @param {{tokenBudget?:number}} [opts]
   */
  assembleForDomain(domainKey, opts = {}) {
    graphBuilder.load();

    // Load domain intel
    let domain = null;
    if (existsSync(DOMAIN_PATH)) {
      try {
        const data = JSON.parse(readFileSync(DOMAIN_PATH, 'utf8'));
        domain = (data.domains || []).find(d => d.key === domainKey);
      } catch { /* use query fallback */ }
    }

    if (!domain) {
      return this.assemble(domainKey, opts);
    }

    // Build a query string from domain metadata
    const queryTokens = [
      domainKey,
      ...(domain.tables || []).slice(0, 5),
      ...(domain.rpcs || []).slice(0, 5),
      ...(domain.routes || []).slice(0, 3),
    ].join(' ');

    const ctx = this.assemble(queryTokens, opts);
    ctx.domain = domain.key;
    ctx.domainLabel = domain.label || domainKey;
    return ctx;
  }

  /**
   * Assemble context for an active incident in a given domain.
   * Supplements domain files with runbook-referenced files.
   *
   * @param {string} incidentDomain
   * @param {{tokenBudget?:number}} [opts]
   */
  assembleForIncident(incidentDomain, opts = {}) {
    const budget = opts.tokenBudget ?? DEFAULT_BUDGET;

    // Pull runbook hints
    let runbookFiles = [];
    if (existsSync(RUNBOOKS_PATH)) {
      try {
        const runbooks = JSON.parse(readFileSync(RUNBOOKS_PATH, 'utf8'));
        const rb = (Array.isArray(runbooks) ? runbooks : Object.values(runbooks))
          .find(r => r.domain === incidentDomain || r.key === incidentDomain);
        if (rb) {
          runbookFiles = (rb.files || rb.affectedFiles || []).slice(0, 10);
        }
      } catch { /* non-fatal */ }
    }

    const ctx = this.assembleForDomain(incidentDomain, { tokenBudget: budget });
    ctx.runbookFiles = runbookFiles;
    ctx.incident = true;
    return ctx;
  }

  /**
   * Produce a repository overview: the most structurally important files.
   * Useful as a starting context for any task that doesn't have a specific query.
   *
   * @param {{tokenBudget?:number, top?:number}} [opts]
   */
  explainRepo(opts = {}) {
    const budget = opts.tokenBudget ?? DEFAULT_BUDGET;

    graphBuilder.load();
    if (!graphBuilder.isLoaded()) {
      return {
        status: 'NOT_BUILT',
        command: 'graphify update .  (or: pnpm graph:update)',
        overview: null,
      };
    }

    const ranked = optimizer.rankGlobally();
    const selected = optimizer.selectWithinBudget(ranked, budget);
    const files = selected.map(({ file, score }) => buildFileEntry(file, score, ranked));
    const stats = graphBuilder.getStats();

    // Architecture layer summary
    let layers = {};
    try {
      archBuilder.build();
      layers = archBuilder.getLayers();
    } catch { /* non-fatal if infra/domain data absent */ }

    return {
      type: 'repository-overview',
      tokenBudget: budget,
      estimatedTokens: selected.reduce((s, e) => s + (e.estimatedTokens || 0), 0),
      stats: {
        totalFiles: stats.fileCount,
        totalSymbols: stats.nodeCount,
        totalEdges: stats.edgeCount,
        communities: stats.communityCount,
      },
      architectureLayers: Object.fromEntries(
        Object.entries(layers).map(([l, nodes]) => [l, nodes.length])
      ),
      mostImportantFiles: files,
      summary: `LetBuyy monorepo — ${stats.fileCount} files, ${stats.nodeCount} symbols. Top ${files.length} files by structural importance shown.`,
    };
  }
}

export default new ContextAssembler();
