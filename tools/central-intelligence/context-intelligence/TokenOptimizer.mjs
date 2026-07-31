/**
 * LCIS V2 — TokenOptimizer (Phase 14)
 *
 * Token budget estimation and file-level compression for context assembly.
 *
 * Token estimation:   chars / 4  (industry-standard approximation for code)
 * Compression model:  symbol-level summary instead of full source
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');

/** Extensions treated as text/code for token counting */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.toml', '.yaml', '.yml',
  '.sql', '.graphql', '.gql', '.css', '.scss',
  '.html', '.htm', '.txt', '.env', '.sh',
]);

/** Directories to skip during repo walk */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.turbo', 'dist', 'build',
  '.cache', 'coverage', '__pycache__', '.vercel', 'graphify-out',
]);

/** Token estimate from character count */
function charsToTokens(chars) {
  return Math.ceil(chars / 4);
}

/**
 * Recursively walk a directory collecting text file sizes.
 * @param {string} dir
 * @param {object} acc  — accumulator {totalBytes, fileCount, byExtension}
 */
function walkDir(dir, acc) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      walkDir(full, acc);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) continue;
      try {
        const sz = statSync(full).size;
        acc.totalBytes += sz;
        acc.fileCount += 1;
        acc.byExtension[ext] = (acc.byExtension[ext] || 0) + sz;
      } catch { /* skip unreadable */ }
    }
  }
}

class TokenOptimizer {
  constructor() {
    this._repoTokenEstimate = null;  // cached after first estimate
    this._lastAssemblyTokens = null;
  }

  /**
   * Estimate total token count across the whole repository (text files only).
   * Skips node_modules, .git, .next, dist, graphify-out.
   * @returns {{totalBytes:number, totalTokens:number, fileCount:number, byExtension:object}}
   */
  estimateRepoTokens() {
    if (this._repoTokenEstimate) return this._repoTokenEstimate;

    const acc = { totalBytes: 0, fileCount: 0, byExtension: {} };
    walkDir(REPO_ROOT, acc);

    const totalTokens = charsToTokens(acc.totalBytes);
    const byExtensionTokens = {};
    for (const [ext, bytes] of Object.entries(acc.byExtension)) {
      byExtensionTokens[ext] = charsToTokens(bytes);
    }

    this._repoTokenEstimate = {
      totalBytes: acc.totalBytes,
      totalTokens,
      fileCount: acc.fileCount,
      byExtension: byExtensionTokens,
    };
    return this._repoTokenEstimate;
  }

  /**
   * Estimate token count for a context assembly (array of file entries or a
   * pre-serialised string/object).
   * @param {string|object|Array} assembly
   * @returns {number}  estimated tokens
   */
  estimateAssemblyTokens(assembly) {
    let chars = 0;
    if (typeof assembly === 'string') {
      chars = assembly.length;
    } else {
      chars = JSON.stringify(assembly).length;
    }
    this._lastAssemblyTokens = charsToTokens(chars);
    return this._lastAssemblyTokens;
  }

  /**
   * Compression ratio: assembly tokens / repo total tokens.
   * Call after estimateRepoTokens() and estimateAssemblyTokens().
   * @returns {number|null}
   */
  compressionRatio() {
    const repo = this._repoTokenEstimate;
    const assembly = this._lastAssemblyTokens;
    if (!repo || !assembly || repo.totalTokens === 0) return null;
    return parseFloat((assembly / repo.totalTokens).toFixed(6));
  }

  /**
   * Greedy selection of highest-ranked files that fit within a token budget.
   *
   * @param {Array<{file:string, score:number, rank:number}>} rankedFiles
   *   Files sorted descending by score (highest first).
   * @param {number} budget  Maximum tokens allowed.
   * @returns {Array<{file:string, score:number, rank:number, estimatedTokens:number}>}
   */
  optimizeForBudget(rankedFiles, budget) {
    const selected = [];
    let used = 0;

    for (const entry of rankedFiles) {
      const filePath = resolve(REPO_ROOT, entry.file);
      let fileTokens = 0;

      if (existsSync(filePath)) {
        try {
          const sz = statSync(filePath).size;
          fileTokens = charsToTokens(sz);
        } catch {
          fileTokens = 200; // fallback estimate
        }
      } else {
        fileTokens = 200;
      }

      if (used + fileTokens > budget) continue;
      used += fileTokens;
      selected.push({ ...entry, estimatedTokens: fileTokens });

      if (used >= budget) break;
    }

    return selected;
  }

  /**
   * Produce a compact, symbol-level summary of a single file —
   * NOT the full source. Output is a short text block listing the file's
   * exported/defined symbols with their inferred kinds.
   *
   * @param {string} filePath  Absolute or repo-relative path.
   * @returns {string}  Compact summary string.
   */
  summarizeFile(filePath) {
    const absPath = filePath.startsWith('/') ? filePath : resolve(REPO_ROOT, filePath);
    if (!existsSync(absPath)) {
      return `// [NOT FOUND] ${filePath}`;
    }

    let src = '';
    try {
      src = readFileSync(absPath, 'utf8');
    } catch {
      return `// [UNREADABLE] ${filePath}`;
    }

    const lines = src.split('\n');
    const symbols = [];

    // Extract exports / function / class / const declarations
    const SYMBOL_RE = /^(?:export\s+(?:default\s+)?)?(?:(async\s+)?function\*?\s+(\w+)|class\s+(\w+)|const\s+(\w+)\s*=|let\s+(\w+)\s*=|var\s+(\w+)\s*=|type\s+(\w+)\s*=|interface\s+(\w+)\s*\{|enum\s+(\w+)\s*\{)/;
    const EXPORT_RE = /^export\s*\{([^}]+)\}/;
    const DEFAULT_EXPORT_RE = /^export\s+default\s+/;

    for (const line of lines) {
      const stripped = line.trim();
      const m = SYMBOL_RE.exec(stripped);
      if (m) {
        const name = m[2] || m[3] || m[4] || m[5] || m[6] || m[7] || m[8] || m[9];
        if (name) {
          const kind = stripped.includes('class ') ? 'class'
            : stripped.includes('function') ? 'function'
            : stripped.includes('interface') ? 'interface'
            : stripped.includes('enum') ? 'enum'
            : stripped.includes('type ') ? 'type'
            : 'const';
          symbols.push(`${kind} ${name}`);
        }
      }
      const em = EXPORT_RE.exec(stripped);
      if (em) {
        em[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
          .forEach(n => symbols.push(`export ${n}`));
      }
      if (DEFAULT_EXPORT_RE.test(stripped)) {
        symbols.push('export default');
      }
    }

    // Deduplicate preserving order
    const seen = new Set();
    const unique = symbols.filter(s => {
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });

    const ext = extname(filePath);
    const relPath = filePath.startsWith(REPO_ROOT)
      ? filePath.slice(REPO_ROOT.length + 1)
      : filePath;
    const sizeKB = (statSync(absPath).size / 1024).toFixed(1);

    const header = `// ${relPath} [${sizeKB}KB, ${lines.length} lines]`;
    const body = unique.length > 0
      ? unique.map(s => `//   ${s}`).join('\n')
      : `//   (no named exports detected)`;

    return `${header}\n${body}`;
  }

  /**
   * Overall stats for the optimizer, including cached estimates.
   * @returns {object}
   */
  getStats() {
    return {
      repoTokenEstimate: this._repoTokenEstimate
        ? {
            totalTokens: this._repoTokenEstimate.totalTokens,
            fileCount: this._repoTokenEstimate.fileCount,
            totalBytes: this._repoTokenEstimate.totalBytes,
          }
        : null,
      lastAssemblyTokens: this._lastAssemblyTokens,
      compressionRatio: this.compressionRatio(),
    };
  }
}

export default new TokenOptimizer();
