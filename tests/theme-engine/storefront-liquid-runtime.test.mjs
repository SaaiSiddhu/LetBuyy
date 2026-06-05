import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const TEMPLATE_RESOLVER_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts';
const COMPOSITION_ENGINE_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx';
const STOREFRONT_TYPES_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/types.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('storefront render plans can carry validated portable Liquid bundles', () => {
  const typesSource = read(STOREFRONT_TYPES_SOURCE);
  const resolverSource = read(TEMPLATE_RESOLVER_SOURCE);

  assert.match(typesSource, /rendererEngine\?: ThemeRendererEngine/);
  assert.match(typesSource, /liquidBundle\?: LiquidThemePackageBundle/);
  assert.match(resolverSource, /LiquidThemePackageBundleSchema\.safeParse/);
  assert.match(resolverSource, /rendererEngine: 'liquid'/);
});

test('storefront resolver builds ordered Liquid section and block models from template JSON', () => {
  const resolverSource = read(TEMPLATE_RESOLVER_SOURCE);

  assert.match(resolverSource, /function coerceLiquidTemplate/);
  assert.match(resolverSource, /orderedKeys\(template\.sections, template\.order\)/);
  assert.match(resolverSource, /orderedKeys\(section\.blocks, section\.block_order\)/);
  assert.match(resolverSource, /rendererKey: `liquid\.section\.\$\{section\.type\}`/);
  assert.match(resolverSource, /rendererKey: isLiquidAppBlockType\(block\.type\) \? 'liquid\.app-block'/);
});

test('storefront composition engine renders Liquid plans without the React section registry', () => {
  const source = read(COMPOSITION_ENGINE_SOURCE);

  assert.match(source, /createThemeRenderer\('liquid'\)/);
  assert.match(source, /plan\.rendererEngine !== 'liquid'/);
  assert.match(source, /result\.liquid\.contentForLayout/);
  assert.match(source, /data-theme-renderer="liquid"/);
  assert.match(source, /dangerouslySetInnerHTML=\{\{ __html: html \}\}/);
});
