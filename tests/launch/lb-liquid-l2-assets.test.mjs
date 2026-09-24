// L2 — Asset Pipeline (Full Liquid V1). Structural guard over the renderer source.
// The behavioral proof (CSS survives DOMPurify, sanitizer intact) lives in the executable render test
// packages/theme-engine/test/liquid-l2-assets.test.ts; this guards the wiring + the un-weakened sanitizer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const renderer = readFileSync(resolve(ROOT, 'packages/theme-engine/src/theme-renderer.ts'), 'utf8');

test('L2: renderer injects a theme :root token block + lb-* stylesheet into the head', () => {
  assert.match(renderer, /LIQUID_THEME_BASE_CSS/);
  assert.match(renderer, /\.lb-hero-banner/);
  assert.match(renderer, /buildLiquidThemeHeadAssets/);
  assert.match(renderer, /buildLiquidRootTokenBlock/);
  // tokens map the store settings to the css vars the lb-* stylesheet reads
  assert.match(renderer, /'primaryColor',\s*'--primary'/);
  assert.match(renderer, /'bodyFontFamily',\s*'--font-body'/);
});

test('L2: theme head assets are prepended to content_for_header (head injection point)', () => {
  // SUSTAINED-G2: buildLiquidThemeHeadAssets now also takes the merchant's raw custom CSS
  // (input.storeTemplate.customCss), its own single Phase-AA enforcement point.
  assert.match(renderer, /const themeHeadAssets = buildLiquidThemeHeadAssets\(bundle, input\.storeTemplate\.customCss\)/);
  assert.match(renderer, /const contentForHeader = `\$\{themeHeadAssets\}\$\{embedHeader\}`/);
});

test('L2: DOMPurify forbid-list is NOT weakened by the styling change', () => {
  assert.match(renderer, /FORBID_ATTR:\s*\['style'\]/);
  assert.match(renderer, /FORBID_TAGS:\s*\['base',\s*'embed',\s*'object',\s*'script'\]/);
  assert.match(renderer, /outputEscape:\s*'escape'/);
  // class-based only: the injected stylesheet must not rely on inline style attrs (DOMPurify forbids them)
  assert.doesNotMatch(renderer, /buildLiquidThemeHeadAssets[\s\S]{0,400}style="/);
});

test('L2: token values are sanitized before entering the :root block (no CSS breakout)', () => {
  assert.match(renderer, /function sanitizeCssTokenValue/);
  assert.match(renderer, /replace\(\/\[<>\{\};@\(\)\]\/g/);
});
