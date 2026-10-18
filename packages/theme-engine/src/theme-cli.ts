#!/usr/bin/env -S node --import tsx/esm
// H6 — Theme CLI
//
// Provides a COMMANDS map and a main() entry-point wrapping the real SDK capabilities.
// HONESTY CONTRACT: every command delegates to real SDK functions — no stubs, no pretend work.
//
// Usage (requires tsx):
//   npx tsx packages/theme-engine/src/theme-cli.ts validate bundle.json
//   npx tsx packages/theme-engine/src/theme-cli.ts lint bundle.json
//   npx tsx packages/theme-engine/src/theme-cli.ts compile portable-config.json
//   npx tsx packages/theme-engine/src/theme-cli.ts export bundle.json
//
// Or via the bin entry (if tsx is globally available):
//   letbuyy-theme validate bundle.json

import { readFileSync } from 'node:fs';
import { validateTheme, lintTheme, compileTheme } from './theme-sdk';
import { exportThemeBundleToFiles } from './theme-artifact-exporter';
import type { PortableThemeTemplateConfig } from './portable-to-liquid';

// ---- Command signatures ----

export interface ValidateCommandResult {
  ok: boolean;
  issues: string[];
}

export interface LintCommandResult {
  rule: string;
  level: string;
  sectionType: string;
  message: string;
}

export interface CompileCommandResult {
  slug: string;
  warnings: string[];
  sectionCount: number;
}

export interface ExportCommandFile {
  path: string;
  sizeBytes: number;
}

// ---- COMMANDS map ----

/**
 * COMMANDS is a Record mapping command name → async function that accepts an input JSON string
 * and returns a structured result. This is the testable surface; the main() function is I/O glue.
 *
 * All commands call REAL SDK functions — no stub implementations.
 */
export const COMMANDS: Record<string, (input: string) => Promise<unknown>> = {
  /**
   * validate — parse + validate a LiquidThemePackageBundle JSON string.
   * Returns {ok: boolean, issues: string[]}.
   */
  validate: async (input: string): Promise<ValidateCommandResult> => {
    const parsed: unknown = JSON.parse(input);
    const result = validateTheme(parsed);
    return { ok: result.ok, issues: result.issues };
  },

  /**
   * lint — validate then lint a LiquidThemePackageBundle JSON string.
   * Returns the array of ThemeLintIssue objects (empty = no issues).
   */
  lint: async (input: string): Promise<LintCommandResult[]> => {
    const parsed: unknown = JSON.parse(input);
    const validation = validateTheme(parsed);
    if (!validation.ok || !validation.bundle) {
      // Can't lint an invalid bundle; return validation issues as lint errors
      return validation.issues.map((msg) => ({
        rule: 'validation-error',
        level: 'error',
        sectionType: 'bundle',
        message: msg,
      }));
    }
    const issues = lintTheme(validation.bundle);
    return issues.map((i) => ({
      rule: i.rule,
      level: i.level,
      sectionType: i.sectionType,
      message: i.message,
    }));
  },

  /**
   * compile — compile a PortableThemeTemplateConfig JSON string into a LiquidThemePackageBundle.
   * Returns {slug, warnings, sectionCount}.
   */
  compile: async (input: string): Promise<CompileCommandResult> => {
    const config = JSON.parse(input) as PortableThemeTemplateConfig;
    const result = compileTheme(config);
    return {
      slug: result.bundle.package.slug,
      warnings: result.warnings,
      sectionCount: Object.keys(result.bundle.sections).length,
    };
  },

  /**
   * export — validate a LiquidThemePackageBundle JSON string then export its file list.
   * Returns an array of {path, sizeBytes} file descriptors (contents omitted from stdout for brevity).
   */
  export: async (input: string): Promise<ExportCommandFile[]> => {
    const parsed: unknown = JSON.parse(input);
    const validation = validateTheme(parsed);
    if (!validation.ok || !validation.bundle) {
      throw new Error(`Bundle is invalid: ${validation.issues.join('; ')}`);
    }
    const files = exportThemeBundleToFiles(validation.bundle);
    return files.map((f) => ({
      path: f.path,
      sizeBytes: Buffer.byteLength(f.contents, 'utf8'),
    }));
  },
};

// ---- main() entry-point ----

export async function main(): Promise<void> {
  const [, , cmd, inputFile] = process.argv;

  if (!cmd || !(cmd in COMMANDS)) {
    const available = Object.keys(COMMANDS).join(' | ');
    process.stderr.write(
      `Usage: letbuyy-theme <${available}> <input-file.json>\n`
        + `Available commands: ${available}\n`,
    );
    process.exit(1);
  }

  if (!inputFile) {
    process.stderr.write(`Error: no input file path provided for command "${cmd}".\n`);
    process.exit(1);
  }

  let input: string;
  try {
    input = readFileSync(inputFile, 'utf8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: could not read input file "${inputFile}": ${msg}\n`);
    process.exit(1);
  }

  try {
    const result = await COMMANDS[cmd](input);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error running command "${cmd}": ${msg}\n`);
    process.exit(1);
  }
}

// Only invoke main() when run directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('theme-cli.ts')) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Unhandled error: ${msg}\n`);
    process.exit(1);
  });
}
