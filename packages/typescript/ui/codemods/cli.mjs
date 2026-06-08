#!/usr/bin/env node
'use strict';

/**
 * @letbuyy/ui migrator — runs the design-system codemods over a target path.
 *
 *   node codemods/cli.mjs --list
 *   node codemods/cli.mjs <codemod> <path...> [--dry]
 *   node codemods/cli.mjs token-alias-rename ../../../apps --dry
 *
 * Each codemod is a pure ({ path, source }) => string transform (see common.cjs).
 * This wrapper walks .ts/.tsx/.css files under each path and applies the
 * transform, writing changes in place (or counting them with --dry).
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const codemodDir = dirname(fileURLToPath(import.meta.url));

const CODEMODS = [
    'data-table-to-table',
    'index-table-to-table',
    'badge-danger-to-critical',
    'page-aliases-to-canonical',
    'text-style-to-text',
    'token-alias-rename',
    'tailwind-default-color-to-token',
];

const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mts', '.cts']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'build', '.git']);

function walk(target, out) {
    let stat;
    try {
        stat = statSync(target);
    } catch {
        return out;
    }
    if (stat.isFile()) {
        if (EXTENSIONS.has(extname(target))) out.push(target);
        return out;
    }
    if (stat.isDirectory()) {
        for (const entry of readdirSync(target)) {
            if (SKIP_DIRS.has(entry)) continue;
            walk(join(target, entry), out);
        }
    }
    return out;
}

function main() {
    const args = process.argv.slice(2);
    if (args.includes('--list') || args.length === 0) {
        process.stdout.write(`Available codemods:\n${CODEMODS.map((c) => `  - ${c}`).join('\n')}\n`);
        process.stdout.write('\nUsage: node codemods/cli.mjs <codemod> <path...> [--dry]\n');
        return;
    }

    const dry = args.includes('--dry');
    const positional = args.filter((a) => !a.startsWith('--'));
    const [name, ...paths] = positional;

    if (!CODEMODS.includes(name)) {
        process.stderr.write(`Unknown codemod "${name}". Run with --list to see options.\n`);
        process.exit(1);
    }
    if (paths.length === 0) {
        process.stderr.write('Provide at least one file or directory path.\n');
        process.exit(1);
    }

    const transform = require(`./${name}.cjs`);
    const files = paths.flatMap((p) => walk(p, []));
    let changed = 0;

    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        const output = transform({ path: file, source });
        if (output !== source) {
            changed += 1;
            if (!dry) writeFileSync(file, output);
            process.stdout.write(`${dry ? 'would change' : 'changed'}: ${file}\n`);
        }
    }

    process.stdout.write(`\n${name}: ${changed} file(s) ${dry ? 'would be ' : ''}changed (scanned ${files.length}).\n`);
}

main();
