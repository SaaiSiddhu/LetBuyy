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
});

test('LiquidRenderer renders blocks before sections and strips schema tags', () => {
  const source = read(THEME_RENDERER_SOURCE);

  assert.match(source, /function renderLiquidSectionBlocks/);
  assert.match(source, /stripLiquidSchemaBlocks\(sectionFile\.source\)/);
  assert.match(source, /content: block\.html/);
  assert.match(source, /content_for_layout: contentForLayout/);
});

test('LiquidRenderer keeps app blocks as explicit injectable slots', () => {
  const source = read(THEME_RENDERER_SOURCE);

  assert.match(source, /isLiquidAppBlockType\(block\.type\)/);
  assert.match(source, /resolveLiquidAppBlockHtml/);
  assert.match(source, /typeof block\.settings\.slot === 'string' \? block\.settings\.slot : ''/);
  assert.match(source, /data-letbuyy-app-block/);
  assert.match(source, /rendererKey: isLiquidAppBlockType\(block\.type\) \? 'liquid\.app-block'/);
});
