import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const THEME_RENDERER_SOURCE = 'packages/theme-engine/src/theme-renderer.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('LiquidRenderer uses LiquidJS behind the ThemeRenderer seam', () => {
  const source = read(THEME_RENDERER_SOURCE);

  assert.match(source, /import \{ Liquid \} from 'liquidjs'/);
  assert.match(source, /export class LiquidRenderer implements ThemeRenderer/);
  assert.match(source, /status: 'rendered'/);
  assert.match(source, /liquid\?: LiquidRenderedTheme/);
  assert.match(source, /outputEscape:\s*'escape'/);
});

test('LiquidRenderer renders blocks before sections and strips schema tags', () => {
  const source = read(THEME_RENDERER_SOURCE);

  assert.match(source, /function renderLiquidSectionBlocks/);
  assert.match(source, /stripLiquidSchemaBlocks\(sectionFile\.source\)/);
  assert.match(source, /content: block\.html/);
  assert.match(source, /content_for_layout: contentForLayout/);
  assert.match(source, /layoutHtml\s*[:=]\s*await sanitizeRenderedHtml\(String\((?:rawL|l)ayoutHtml\), \{ wholeDocument: true \}\)/);
});

test('LiquidRenderer keeps snippets first-party-scoped and provides the t filter', () => {
  const rendererSource = read(THEME_RENDERER_SOURCE);
  const bundleSource = read('packages/theme-engine/src/theme-bundle.ts');

  assert.match(rendererSource, /engine\.registerFilter\('t'/);
  // SUSTAINED-G3: the t filter delegates to the single canonical, tested, India-first,
  // prototype-pollution-guarded translation resolver — not a second, duplicate inline lookup.
  assert.match(rendererSource, /import \{ tLocale \} from '\.\/theme-locale'/);
  assert.match(rendererSource, /tLocale\(key, locale, bundle\.locales/);
  assert.match(bundleSource, /'\{% render'/);
  assert.match(bundleSource, /Liquid source contains forbidden fragment/);
});

test('LiquidRenderer exposes schema-valid inline blocks to section scope', () => {
  const source = read(THEME_RENDERER_SOURCE);

  assert.match(source, /const inlineBlockAllowed = sectionFile\?\.schema\.blocks\.some/);
  assert.match(source, /settings: block\.settings,\s+html: '',\s+isAppBlock: false/s);
});

test('LiquidRenderer keeps app blocks as explicit injectable slots', () => {
  const source = read(THEME_RENDERER_SOURCE);

  assert.match(source, /isLiquidAppBlockType\(block\.type\)/);
  assert.match(source, /resolveLiquidAppBlockHtml/);
  assert.match(source, /typeof block\.settings\.slot === 'string' \? block\.settings\.slot : ''/);
  assert.match(source, /data-letbuyy-app-block/);
  assert.match(source, /rendererKey: isLiquidAppBlockType\(block\.type\) \? 'liquid\.app-block'/);
});

test('LiquidRenderer sanitizes rendered HTML through DOMPurify instead of regex replacement', () => {
  const source = read(THEME_RENDERER_SOURCE);
  const sanitizer = source.match(/export async function sanitizeRenderedHtml[\s\S]*?\n}/)?.[0] || '';

  assert.match(source, /LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG/);
  assert.match(source, /import\('dompurify'\)/);
  assert.doesNotMatch(sanitizer, /\.replace\(/);
});
