#!/usr/bin/env node
'use strict';

/**
 * Generate the Flutter Dart token file from the canonical TypeScript source
 * (`packages/typescript/ui/src/mobile-tokens.ts`), so the mobile app and the
 * web design system share one source of truth and cannot drift.
 *
 *   node scripts/generators/generate-mobile-tokens.mjs          # write the Dart file
 *   node scripts/generators/generate-mobile-tokens.mjs --check  # CI drift gate
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const uiRoot = join(root, 'packages', 'typescript', 'ui');
const uiRequire = createRequire(join(uiRoot, 'package.json'));
const ts = uiRequire('typescript');

const sourcePath = join(uiRoot, 'src', 'mobile-tokens.ts');
const dartPath = join(root, 'apps', 'mobile', 'merchant-app', 'lib', 'theme', 'letbuyy_color_tokens.dart');
const check = process.argv.includes('--check');

const moduleCache = new Map();
function resolveLocalModule(fromFile, specifier) {
    const base = resolve(dirname(fromFile), specifier);
    if (extname(base)) return base;
    if (existsSync(`${base}.ts`)) return `${base}.ts`;
    if (existsSync(`${base}.tsx`)) return `${base}.tsx`;
    throw new Error(`Could not resolve ${specifier} from ${fromFile}`);
}
function loadTsModule(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath);
    const source = readFileSync(filePath, 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true,
        },
        fileName: filePath,
    }).outputText;
    const module = { exports: {} };
    const sandbox = {
        module,
        exports: module.exports,
        require: (specifier) => {
            if (specifier.startsWith('.')) return loadTsModule(resolveLocalModule(filePath, specifier));
            throw new Error(`Unexpected external import in mobile-token generator: ${specifier}`);
        },
    };
    vm.runInNewContext(output, sandbox, { filename: filePath });
    moduleCache.set(filePath, module.exports);
    return module.exports;
}

const { letbuyyMobileColorTokens: colors, letbuyyMobileSpacingTokens: spacing } = loadTsModule(sourcePath);

function hexToDart(hex) {
    const clean = String(hex).replace('#', '').toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(clean)) throw new Error(`Unexpected colour value: ${hex}`);
    return `Color(0xFF${clean})`;
}

const groupBreaks = new Set(['accentPink', 'success', 'slate950', 'white']);
const colorLines = Object.entries(colors)
    .map(([name, value]) => `${groupBreaks.has(name) ? '\n' : ''}  static const Color ${name} = ${hexToDart(value)};`)
    .join('\n');
const spacingLines = Object.entries(spacing)
    .map(([name, value]) => `  static const double ${name} = ${value};`)
    .join('\n');

const dart = `// GENERATED FILE — DO NOT EDIT.
// Source: packages/typescript/ui/src/mobile-tokens.ts
// Regenerate: node scripts/generators/generate-mobile-tokens.mjs
//
// Canonical LetBuyy mobile color tokens. Brand and status values are derived
// from the shared web design-system primitives, so web and mobile cannot drift.
// Screens should reference these tokens (or theme-aware accessors backed by
// them) instead of repeating raw brand hex values.

import 'package:flutter/material.dart';

class LetbuyyColorTokens {
  LetbuyyColorTokens._();

${colorLines}
}

class LetbuyySpacingTokens {
  LetbuyySpacingTokens._();

${spacingLines}
}
`;

if (check) {
    const current = existsSync(dartPath) ? readFileSync(dartPath, 'utf8') : '';
    if (current.trim() !== dart.trim()) {
        process.stderr.write('Mobile token drift detected: letbuyy_color_tokens.dart is out of sync with mobile-tokens.ts.\nRun: node scripts/generators/generate-mobile-tokens.mjs\n');
        process.exit(1);
    }
    process.stdout.write('Mobile tokens are in sync with the canonical source.\n');
} else {
    writeFileSync(dartPath, dart);
    process.stdout.write(`Generated ${dartPath} (${Object.keys(colors).length} colours, ${Object.keys(spacing).length} spacing).\n`);
}
