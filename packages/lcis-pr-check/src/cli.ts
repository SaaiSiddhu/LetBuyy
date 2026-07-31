/**
 * cli.ts — LCIS PR Check command-line interface.
 *
 * Usage:
 *   lcis-pr-check --files <comma-list>
 *   lcis-pr-check --files-from <path>       (one path per line)
 *   echo "file1\nfile2" | lcis-pr-check      (stdin)
 *
 * Flags:
 *   --format <markdown|json|summary>   default: markdown
 *   --out <file>                        write output to file (explicit export only)
 *   --symbols <comma-list>              optional symbol names for blast-radius
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { analyzePr } from './analyze';
import { renderComment, renderJson, renderSummary } from './comment';
import type { PrReport } from './types';

export type OutputFormat = 'markdown' | 'json' | 'summary';

export interface CliIo {
  stdin(): string;
  stdout(text: string): void;
  stderr(text: string): void;
  exit(code: number): never;
}

const defaultIo: CliIo = {
  stdin: () => readFileSync('/dev/stdin', 'utf8'),
  stdout: (text) => process.stdout.write(text + '\n'),
  stderr: (text) => process.stderr.write(text + '\n'),
  exit: (code) => process.exit(code),
};

/**
 * Resolve the user-supplied `--out` path against a root (cwd), refusing any path that escapes the
 * root (traversal or absolute-outside-root), is empty, or contains a null byte. The `--out` write
 * is the ONLY file write in this otherwise read-only tool, and in CI the argv can derive from
 * untrusted PR metadata, so the path is treated as untrusted.
 * (Intentionally duplicated in lcis-cli to keep the engine core, lcis-core, IO-free.)
 */
export function safeOutputPath(p: string, root: string = process.cwd()): string {
  if (typeof p !== 'string' || p.length === 0) throw new Error('refusing to write: output path is empty');
  if (p.includes('\0')) throw new Error('refusing to write: output path contains a null byte');
  const resolved = resolve(root, p);
  const rel = relative(root, resolved);
  if (rel === '') throw new Error(`refusing to write to the working directory itself: ${p}`);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`refusing to write outside the working directory: ${p}`);
  }
  return resolved;
}

function parseArgs(argv: string[]): {
  files: string[];
  symbols: string[];
  format: OutputFormat;
  out: string | null;
} {
  const files: string[] = [];
  const symbols: string[] = [];
  let format: OutputFormat = 'markdown';
  let out: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--files') {
      const next = argv[++i] ?? '';
      files.push(...next.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--files-from') {
      const path = argv[++i] ?? '';
      const content = readFileSync(path, 'utf8');
      files.push(...content.split('\n').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--symbols') {
      const next = argv[++i] ?? '';
      symbols.push(...next.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--format') {
      const next = (argv[++i] ?? 'markdown') as OutputFormat;
      if (!['markdown', 'json', 'summary'].includes(next)) {
        throw new Error(`Invalid --format '${next}'. Must be: markdown | json | summary`);
      }
      format = next;
    } else if (arg === '--out') {
      out = argv[++i] ?? null;
    }
  }

  return { files, symbols, format, out };
}

function render(report: PrReport, format: OutputFormat): string {
  switch (format) {
    case 'json':    return renderJson(report);
    case 'summary': return renderSummary(report);
    default:        return renderComment(report);
  }
}

export async function run(argv: string[] = process.argv.slice(2), io: CliIo = defaultIo): Promise<void> {
  try {
    let { files, symbols, format, out } = parseArgs(argv);

    // If no --files / --files-from, try stdin
    if (files.length === 0 && !process.stdin.isTTY) {
      const stdinContent = io.stdin();
      files = stdinContent.split('\n').map((s) => s.trim()).filter(Boolean);
    }

    if (files.length === 0) {
      io.stderr('lcis-pr-check: no changed files provided. Use --files, --files-from, or pipe via stdin.');
      io.stderr('Usage: lcis-pr-check --files file1.ts,file2.ts [--symbols Sym1,Sym2] [--format markdown|json|summary] [--out report.md]');
      io.exit(1);
    }

    const report = await analyzePr({ changedFiles: files, changedSymbols: symbols });
    const output = render(report, format);

    if (out !== null) {
      writeFileSync(safeOutputPath(out), output, 'utf8');
      io.stderr(`lcis-pr-check: report written to ${out}`);
    } else {
      io.stdout(output);
    }
  } catch (err) {
    io.stderr(`lcis-pr-check error: ${err instanceof Error ? err.message : String(err)}`);
    io.exit(1);
  }
}

// Guard: only run as entry point when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    process.stderr.write(`lcis-pr-check fatal: ${String(err)}\n`);
    process.exit(1);
  });
}
