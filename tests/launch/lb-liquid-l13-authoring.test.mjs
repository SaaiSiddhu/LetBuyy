// L13 — Theme Authoring (engine: compile-on-publish + desync guard). Structural guard.
// Behavioral proof: liquid-l13-authoring.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compiler = readFileSync(resolve(ROOT, 'packages/theme-engine/src/portable-to-liquid.ts'), 'utf8');

test('L13: editor entry points (compile-on-publish + desync guard) are exported', () => {
  assert.match(compiler, /export function compilePortableConfigForPublish/);
  assert.match(compiler, /export function liquidBundlePublishWouldDesync/);
});

test('L13: publish patch sets rendererEngine liquid + carries the validated bundle', () => {
  assert.match(compiler, /rendererEngine: 'liquid'/);
  assert.match(compiler, /liquidBundle: bundle/);
});
