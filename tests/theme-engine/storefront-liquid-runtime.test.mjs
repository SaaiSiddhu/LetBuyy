import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const TEMPLATE_RESOLVER_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts';
const COMPOSITION_ENGINE_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx';
const DATA_BINDING_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts';
const STOREFRONT_TYPES_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/types.ts';
const STOREFRONT_GLOBALS_SOURCE = 'apps/storefront-runtime/src/app/globals.css';

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
  assert.match(resolverSource, /function coerceLiquidTemplateSections/);
  assert.match(resolverSource, /orderedKeys\(template\.sections, template\.order\)/);
  assert.match(resolverSource, /orderedKeys\(section\.blocks, section\.block_order\)/);
  assert.match(resolverSource, /rendererKey: `liquid\.section\.\$\{section\.type\}`/);
  assert.match(resolverSource, /rendererKey: isLiquidAppBlockType\(block\.type\) \? 'liquid\.app-block'/);
});

test('storefront resolver and composition engine render full Liquid documents with Liquid chrome', () => {
  const resolverSource = read(TEMPLATE_RESOLVER_SOURCE);
  const source = read(COMPOSITION_ENGINE_SOURCE);

  assert.match(resolverSource, /function resolveLiquidSectionGroups/);
  assert.match(resolverSource, /header: coerceLiquidTemplateSections\(bundle, 'header'\)/);
  assert.match(resolverSource, /footer: coerceLiquidTemplateSections\(bundle, 'footer'\)/);
  assert.match(source, /createThemeRenderer\('liquid'\)/);
  assert.match(source, /plan\.rendererEngine !== 'liquid'/);
  assert.match(source, /result\.liquid\.layoutHtml/);
  assert.doesNotMatch(source, /return result\.liquid\.contentForLayout/);
  assert.match(source, /data-theme-renderer="liquid"/);
  assert.match(source, /dangerouslySetInnerHTML=\{\{ __html: html \}\}/);
});

test('Liquid storefront plans bind catalog data and cart drops without fabricating server cart state', () => {
  const dataBindingSource = read(DATA_BINDING_SOURCE);
  const compositionSource = read(COMPOSITION_ENGINE_SOURCE);
  const typesSource = read(STOREFRONT_TYPES_SOURCE);
  const cssSource = read(STOREFRONT_GLOBALS_SOURCE);

  assert.match(dataBindingSource, /'liquid\.section\.product-grid'/);
  assert.match(dataBindingSource, /'liquid\.section\.featured-products'/);
  assert.match(dataBindingSource, /'liquid\.section\.product-detail'/);
  assert.match(dataBindingSource, /function sectionRequestsSingleProduct/);
  assert.match(typesSource, /cart\?: Record<string, unknown>/);
  assert.match(compositionSource, /function collectLiquidCart/);
  assert.match(compositionSource, /source: 'browser_hydrated'/);
  assert.match(compositionSource, /sync_url: `\/api\/storefront\/\$\{plan\.route\.subdomain\}\/cart`/);
  assert.match(cssSource, /\.lb-theme/);
  assert.match(cssSource, /\.lb-header/);
  assert.match(cssSource, /\.lb-product-grid__items/);
});

test('storefront composition engine maps installed app blocks into Liquid app slots', () => {
  const source = read(COMPOSITION_ENGINE_SOURCE);

  assert.match(source, /normalizeAppBlockInstances\(input\)/);
  assert.match(source, /function buildLiquidAppBlocks/);
  assert.match(source, /\[block\.slot, source\]/);
  assert.match(source, /\[`app:\$\{block\.extension_id\}`, source\]/);
  assert.match(source, /liquidAppBlocks: buildLiquidAppBlocks\(store\.templateConfig\.appBlocks\)/);
  assert.match(source, /data-app-block-slot/);
});
