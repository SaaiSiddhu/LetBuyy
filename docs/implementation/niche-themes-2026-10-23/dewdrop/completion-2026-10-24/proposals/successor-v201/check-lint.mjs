import { ESLint } from 'eslint';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createLetbuyyBoundaryConfig } from '/Volumes/Projects/LetBuyy/config/eslint/letbuyy-boundaries.mjs';

const appRequire = createRequire(resolve('apps/commerce/web/package.json'));
const nextTypeScript = appRequire('eslint-config-next/typescript');
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [...nextTypeScript, createLetbuyyBoundaryConfig()] });
const paths = ['packages/theme-engine/src/dewdrop-theme-v201.ts', 'packages/theme-engine/test/dewdrop-successor.test.ts'];
const results = await eslint.lintFiles(paths);
const errors = results.reduce((sum, item) => sum + item.errorCount, 0);
const warnings = results.reduce((sum, item) => sum + item.warningCount, 0);
writeFileSync(resolve('docs/implementation/niche-themes-2026-10-23/dewdrop/completion-2026-10-24/proposals/successor-v201/eslint.json'), JSON.stringify({ rules: 'Repository-installed eslint-config-next/typescript plus LetBuyy boundary config', paths, errors, warnings, results }, null, 2) + '\n');
process.stdout.write(`Focused TypeScript/boundary lint: ${errors} errors; ${warnings} warnings.\n`);
process.exitCode = errors || warnings ? 1 : 0;
