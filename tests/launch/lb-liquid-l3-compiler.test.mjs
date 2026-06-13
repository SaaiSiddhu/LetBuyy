// L3 — Theme Compiler (Full Liquid V1). Structural guard over the compiler source.
// Behavioral proof (round-trip render, escaping, schema-valid output) is in the executable test
// packages/theme-engine/test/liquid-l3-compiler.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const compiler = read('packages/theme-engine/src/portable-to-liquid.ts');
const index = read('packages/theme-engine/src/index.ts');

test('L3: compiler is exported from the theme-engine package', () => {
  assert.match(index, /export \* from '\.\/portable-to-liquid'/);
  assert.match(compiler, /export function compilePortableToLiquidBundle/);
});

test('L3: compiler always re-validates output (cannot emit an invalid bundle)', () => {
  assert.match(compiler, /parseLiquidThemePackageBundle\(draft\)/);
});

test('L3: compiler is a translator only — no second renderer / runtime', () => {
  // must not introduce script/plugin/remote execution; it only maps types + reuses canonical files
  assert.doesNotMatch(compiler, /eval\(|new Function|child_process|fetch\(|import\(/);
  assert.match(compiler, /PORTABLE_TO_LIQUID_TYPE_OVERRIDES/);
  assert.match(compiler, /resolveLiquidSectionType/);
});

test('L3: merchant settings are reduced to safe plain JSON (no raw injection surface)', () => {
  assert.match(compiler, /function plainSettings/);
  assert.match(compiler, /\^\[A-Za-z_\]\[A-Za-z0-9_\]\*\$/); // safe key allowlist
  assert.match(compiler, /JSON\.parse\(JSON\.stringify/); // plain-JSON clone
});
