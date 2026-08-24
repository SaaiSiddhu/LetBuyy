// S5 — Compose the LetBuyy Core home page: banner carousel, category pills, featured products,
// video, and social proof, using sections that already existed and already rendered.
//   W1: banner-carousel + testimonials (chosen social proof) are composed into templates.index;
//       every composed section type exists in the bundle; every setting key any composed section
//       writes is declared in that section's own schema (the migration-193 failure class); the
//       whole template renders through LiquidRenderer without throwing; banner-carousel exercises
//       the real 2+-slide carousel path.
//   W2: video — decision (b), a NEW Liquid-only section (sections/video-hero.liquid). No sanitizer
//       change: iframe/src/width/height/title/loading/sandbox were already in
//       LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG's ADD_TAGS/ADD_ATTR before this phase. The video URL
//       setting reuses the existing 'url' field type (already declared in
//       ThemeBundleSettingFieldSchema, already has a working editor control) rather than the
//       Phase-U 'video'/'video_url' ExtendedFieldType, which belongs to a different, parallel
//       type system (theme-registry.ts) this portable bundle does not use. A hostile videoUrl is
//       neutralised by the same two-layer defence image_url/asset_url already rely on: the new
//       video_url filter (identical safeLiquidUrl scheme allowlist) plus Liquid's own
//       outputEscape:'escape' on `{{ }}` output — proven here, not assumed. video-hero is
//       deliberately NOT added to THEME_LIQUID_PORTABLE_SECTION_PARITY: it has no React
//       counterpart and adding it would create a permanent, unclosable parity failure.
//   W3: every section this phase composed declares at least one preset (Add-section panel
//       reachability) and every setting TYPE it uses already has a SchemaFormRenderer control.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  createLetbuyyCoreLiquidThemeBundleFixture,
  LiquidRenderer,
  DEFAULT_THEME_SETTINGS,
  THEME_LIQUID_PORTABLE_SECTION_PARITY,
} from '../src/index.ts';

const STORE_ID = 's5-home-store-000000000000';
const JS_URL_PAYLOAD = 'javascript:window.__S5_PWNED__=1//';
const DATA_URL_PAYLOAD = 'data:text/html,<script>window.__S5_PWNED__=1</script>';
// A quote-breakout / onerror= attribute-injection attempt riding on an otherwise-valid https URL
// (so the scheme allowlist alone would NOT catch it — only Liquid's own output-escaping does).
const ATTR_BREAKOUT_PAYLOAD = 'https://evil.example/x" onerror="window.__S5_PWNED__=1" data-x="';

// Mirrors liquid-s1-w5-adversarial-security.test.ts / liquid-s3-render-parity-closure.test.ts's
// assertNeutralised exactly (same technique: parse into a real DOM, prove no live executable
// node/attribute exists, not a string search).
function assertNeutralised(html: string, label: string) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const { document } = dom.window;
  assert.equal(document.querySelectorAll('script').length, 0, `${label}: no live <script> element may exist`);
  for (const el of document.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      assert.doesNotMatch(attr.name, /^on/i, `${label}: no live on* handler may exist (found ${attr.name} on <${el.tagName.toLowerCase()}>)`);
    }
  }
  assert.equal((dom.window as unknown as Record<string, unknown>).__S5_PWNED__, undefined, `${label}: the payload must never actually execute`);
}

async function renderIndex() {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 's5-store', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'letbuyy-core-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: createLetbuyyCoreLiquidThemeBundleFixture(),
  });
}

// Renders one real section from the ACTUAL letbuyy-core Liquid bundle fixture, same technique as
// S3's renderCoreSection — not a synthetic bundle, so this proves what actually ships.
async function renderCoreSection(sectionType: string, settings: Record<string, unknown>) {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const sectionKey = 'target';
  bundle.templates['__s5_test__'] = {
    name: 'S5 test',
    layout: 'theme',
    sections: {
      [sectionKey]: { type: sectionType, settings, blocks: {}, block_order: [], disabled: false },
    },
    order: [sectionKey],
  };

  const renderer = new LiquidRenderer();
  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 's5-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'letbuyy-core-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: '__s5_test__', type: 'page', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: '__s5_test__',
    liquidContext: {},
    liquidBundle: bundle,
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings?.join(', ')}`);
  const section = result.liquid?.sections.find((s) => s.id === sectionKey);
  assert.ok(section, 'target section must be present in the render result');
  return section!.html;
}

// ─── W1: composition ────────────────────────────────────────────────────────────────────────────

test('W1: templates.index composes banner-carousel and testimonials (the chosen social-proof section)', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const types = Object.values(bundle.templates.index.sections).map((s) => s.type);
  assert.ok(types.includes('banner-carousel'), 'banner-carousel must be composed into the home template');
  assert.ok(types.includes('testimonials'), 'testimonials must be composed into the home template');
  assert.equal(types.includes('trust-badges'), false, 'only ONE social-proof section should be composed, not trust-badges too');
  assert.equal(types.includes('brand-marquee'), false, 'only ONE social-proof section should be composed, not brand-marquee too');
});

test('W1: every section type composed into templates.index exists in bundle.sections', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const missing: string[] = [];
  for (const [sectionId, section] of Object.entries(bundle.templates.index.sections)) {
    if (!bundle.sections[section.type]) missing.push(`${sectionId} (${section.type})`);
  }
  assert.deepEqual(missing, [], `composed section types with no bundle.sections definition: ${missing.join(', ')}`);
});

test('W1: every setting key in every templates.index section (and its blocks) is declared in that section/block schema', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const undeclared: string[] = [];
  for (const [sectionId, section] of Object.entries(bundle.templates.index.sections)) {
    const schema = bundle.sections[section.type]?.schema;
    assert.ok(schema, `${sectionId}: no schema found for type "${section.type}"`);
    const declaredSettingKeys = new Set((schema!.settings || []).map((f) => f.id));
    for (const key of Object.keys(section.settings || {})) {
      if (!declaredSettingKeys.has(key)) undeclared.push(`${sectionId}.${key}`);
    }
    for (const [blockId, block] of Object.entries(section.blocks || {})) {
      // '@app' blocks are a framework-level extension slot (extension_handle/slot), not a
      // declared-settings block type — same exemption resolveLiquidAppBlockHtml applies.
      if (block.type === '@app') continue;
      // A block's settings can be declared in EITHER of two valid places in this bundle format:
      // inline on the section's own `blocks` array (the createLiquidSectionFile()/liquidInlineBlock
      // pool shape), OR on the bundle's top-level shared `blocks` map (the `{{ block.content | raw
      // }}`-rendering shape category-grid/featured-products/product-grid/spotlight use — verified
      // by reading bundle.blocks['category'|'product-card'|'badge'] directly, not assumed).
      const sectionBlockSchema = (schema!.blocks || []).find((b) => b.type === block.type);
      const topLevelBlockSchema = bundle.blocks?.[block.type]?.schema;
      assert.ok(sectionBlockSchema || topLevelBlockSchema, `${sectionId}.${blockId}: no schema found anywhere for block type "${block.type}"`);
      const declaredBlockKeys = new Set([
        ...((sectionBlockSchema?.settings || []).map((f) => f.id)),
        ...((topLevelBlockSchema?.settings || []).map((f) => f.id)),
      ]);
      for (const key of Object.keys(block.settings || {})) {
        if (!declaredBlockKeys.has(key)) undeclared.push(`${sectionId}.${blockId}.${key}`);
      }
    }
  }
  assert.deepEqual(undeclared, [], `undeclared settings would make the editor reject these: ${undeclared.join(', ')}`);
});

test('W1: the home template renders end-to-end through LiquidRenderer without throwing', async () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const expectedSectionIds = Object.keys(bundle.templates.index.sections);
  const result = await renderIndex();
  assert.equal(result.status, 'rendered', `warnings: ${result.warnings?.join(', ')}`);
  const renderedIds = (result.liquid?.sections || []).map((s) => s.id);
  assert.deepEqual(new Set(renderedIds), new Set(expectedSectionIds));
});

test('W1: banner-carousel renders with 2+ slides — the real carousel path, not the single-image fallback', async () => {
  const result = await renderIndex();
  const section = result.liquid?.sections.find((s) => s.id === 'banner-carousel-default');
  assert.ok(section, 'banner-carousel-default must render as part of the home template');
  assert.match(section!.html, /Monsoon-ready sneakers, restocked/);
  assert.match(section!.html, /Apparel drop: up to 30% off/);
});

// ─── W2: video ──────────────────────────────────────────────────────────────────────────────────

test('W2: video-hero is NOT in THEME_LIQUID_PORTABLE_SECTION_PARITY — it has no React counterpart', () => {
  const liquidTypes = THEME_LIQUID_PORTABLE_SECTION_PARITY.map((e) => e.liquidSectionType);
  assert.equal(liquidTypes.includes('video-hero' as never), false);
});

test('W2: video-hero declares heading (text), subheading (textarea) and videoUrl (url) — the existing, already-controlled field types', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const schema = bundle.sections['video-hero']?.schema;
  assert.ok(schema);
  const byId = Object.fromEntries((schema!.settings || []).map((f) => [f.id, f.type]));
  assert.equal(byId.heading, 'text');
  assert.equal(byId.subheading, 'textarea');
  assert.equal(byId.videoUrl, 'url');
});

test('W2: an unset videoUrl renders no <iframe> at all (matches the established "no fabricated URL" convention)', async () => {
  const html = await renderCoreSection('video-hero', { heading: 'See it move' });
  assert.doesNotMatch(html, /<iframe/);
});

test('W2: a real https embed URL renders a real, intact <iframe src="...">', async () => {
  const html = await renderCoreSection('video-hero', {
    heading: 'See it move',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  });
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const iframe = dom.window.document.querySelector('iframe');
  assert.ok(iframe, 'a valid https videoUrl must render a real <iframe>');
  assert.equal(iframe!.getAttribute('src'), 'https://www.youtube.com/embed/dQw4w9WgXcQ');
});

test('W2 ADVERSARIAL: a javascript: video URL is neutralised (empty src, no navigation)', async () => {
  const html = await renderCoreSection('video-hero', { heading: 'x', videoUrl: JS_URL_PAYLOAD });
  assertNeutralised(html, 'javascript: videoUrl');
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const iframe = dom.window.document.querySelector('iframe');
  if (iframe) assert.doesNotMatch(iframe.getAttribute('src') || '', /javascript:/i);
});

test('W2 ADVERSARIAL: a data: video URL is neutralised', async () => {
  const html = await renderCoreSection('video-hero', { heading: 'x', videoUrl: DATA_URL_PAYLOAD });
  assertNeutralised(html, 'data: videoUrl');
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const iframe = dom.window.document.querySelector('iframe');
  if (iframe) assert.doesNotMatch(iframe.getAttribute('src') || '', /data:/i);
});

test('W2 ADVERSARIAL: an onerror=/attribute-breakout video URL is neutralised — no live onerror attribute is ever created', async () => {
  const html = await renderCoreSection('video-hero', { heading: 'x', videoUrl: ATTR_BREAKOUT_PAYLOAD });
  assertNeutralised(html, 'attribute-breakout videoUrl');
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const iframes = dom.window.document.querySelectorAll('iframe');
  assert.equal(iframes.length <= 1, true, 'the breakout attempt must not create a second element');
});

// ─── W3: editability ────────────────────────────────────────────────────────────────────────────

test('W3: every section this phase composed declares at least one preset (Add-section panel reachability)', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  for (const type of ['banner-carousel', 'testimonials', 'video-hero']) {
    const schema = bundle.sections[type]?.schema;
    assert.ok(schema, `${type}: schema must exist`);
    assert.ok((schema!.presets || []).length >= 1, `${type}: must declare at least one preset`);
  }
});

test('W3: every setting TYPE used across templates.index sections already has a SchemaFormRenderer control', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const usedTypes = new Set<string>();
  for (const section of Object.values(bundle.templates.index.sections)) {
    const schema = bundle.sections[section.type]?.schema;
    for (const field of schema?.settings || []) usedTypes.add(field.type);
    for (const block of schema?.blocks || []) {
      for (const field of block.settings || []) usedTypes.add(field.type);
    }
  }
  const renderer = readFileSync(
    new URL('../../../apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx', import.meta.url),
    'utf8',
  );
  const missing: string[] = [];
  for (const type of usedTypes) {
    if (!new RegExp(`case '${type}':`).test(renderer)) missing.push(type);
  }
  assert.deepEqual(missing, [], `setting types with no editor control (a "dead control" per the parity phase's finding): ${missing.join(', ')}`);
});

test('W3: video-hero\'s new video_url Liquid filter is registered in theme-renderer.ts, reusing safeLiquidUrl (no new sanitisation logic)', () => {
  const renderer = readFileSync(new URL('../src/theme-renderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /registerFilter\('video_url', \(value: unknown\) => safeLiquidUrl\(value\)\)/);
});
