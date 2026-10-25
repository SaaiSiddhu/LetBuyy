import { ESLint } from 'eslint';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createLetbuyyBoundaryConfig } from '../../../../../config/eslint/letbuyy-boundaries.mjs';

const appRequire = createRequire(resolve('apps/commerce/web/package.json'));
const nextTypeScript = appRequire('eslint-config-next/typescript');
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [...nextTypeScript, createLetbuyyBoundaryConfig()] });
const paths = ['packages/theme-engine/src/threadline-theme-v201.ts', 'packages/theme-engine/test/threadline-successor.test.ts'];
const results = await eslint.lintFiles(paths);
const errors = results.reduce((sum, item) => sum + item.errorCount, 0);
const warnings = results.reduce((sum, item) => sum + item.warningCount, 0);
writeFileSync(resolve('docs/implementation/threadline-2026-10-22/completion-2026-10-24/main-leaf-01/eslint.json'), JSON.stringify({ rules: 'Repository-installed eslint-config-next/typescript plus LetBuyy boundary config', paths, errors, warnings, results }, null, 2) + '\n');
process.stdout.write(`Focused TypeScript/boundary lint: ${errors} errors; ${warnings} warnings.\n`);
process.exitCode = errors || warnings ? 1 : 0;
