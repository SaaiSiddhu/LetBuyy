import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const THEME_BUNDLE_SOURCE = 'packages/theme-engine/src/theme-bundle.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('Liquid theme bundle contract publishes literal portable theme paths', () => {
  const source = read(THEME_BUNDLE_SOURCE);

  assert.match(source, /THEME_LIQUID_BUNDLE_SCHEMA_VERSION = '2026-06-liquid-sections'/);
  assert.match(source, /layout: 'layout\/theme\.liquid'/);
  assert.match(source, /settingsSchema: 'config\/settings_schema\.json'/);
  assert.match(source, /settingsData: 'config\/settings_data\.json'/);
  assert.match(source, /templates: 'templates\/\*\.json'/);
  assert.match(source, /sections: 'sections\/\*\.liquid'/);
  assert.match(source, /blocks: 'blocks\/\*\.liquid'/);
  assert.match(source, /locales: 'locales\/\*\.json'/);
});

test('Liquid sections require schema blocks and support app blocks', () => {
  const source = read(THEME_BUNDLE_SOURCE);

  assert.match(source, /ThemeLiquidSectionFileSchema/);
  assert.match(source, /Liquid section files must include \{% schema %\} and \{% endschema %\} blocks/);
  assert.match(source, /ThemeLiquidAppBlockSchema/);
  assert.match(source, /type: z\.literal\('@app'\)/);
  assert.match(source, /function isLiquidAppBlockType\(blockType: string\)/);
  assert.match(source, /blockType === '@app' \|\| blockType\.startsWith\('app:'\)/);
});

test('Liquid bundle fixture includes a zero-code-change spotlight section', () => {
  const source = read(THEME_BUNDLE_SOURCE);

  assert.match(source, /createMinimalLiquidThemeBundleFixture/);
  assert.match(source, /slug: 'liquid-starter'/);
  assert.match(source, /path: 'sections\/spotlight\.liquid'/);
  assert.match(source, /path: 'blocks\/badge\.liquid'/);
  assert.match(source, /Zero storefront code change/);
  assert.match(source, /renderer_version: THEME_LIQUID_RENDERER_VERSION/);
});
