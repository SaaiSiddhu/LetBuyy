// S3 — Render-Parity Closure. Behavioral proof for the 11 real defects the parity harness found
// (docs/evidence/liquid-parity/S1-render-parity.json): 6 React-only gaps (A1-A6), 4 settings neither
// engine honoured (B1-B4), and 1 harness prop-contract crash (C1). Structural guard for the pieces
// that live in Next.js app-layer files this suite cannot import (React section behavior, harness
// fixes) — those are proven instead by apps/storefront-runtime/scripts/liquid-parity-harness.mjs,
// re-run as part of this phase's verification (docs/evidence/liquid-parity/S3-render-parity.json).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  createLetbuyyCoreLiquidThemeBundleFixture,
  LiquidRenderer,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = 's3-parity-store-000000000000';
const IMG_XSS_PAYLOAD = '"><img src=x onerror="window.__S3_PWNED__=1">';
const JS_URL_PAYLOAD = 'javascript:window.__S3_PWNED__=1//';
const DATA_URL_PAYLOAD = 'data:text/html,<script>window.__S3_PWNED__=1</script>';

// Renders one real section from the ACTUAL letbuyy-core Liquid bundle fixture (the same fixture the
// parity harness and the DB-seed generator use) — not a synthetic bundle — so this proves the fixes
// that actually ship, not a stand-in.
async function renderCoreSection(
  sectionType: string,
  settings: Record<string, unknown>,
  blocks: Record<string, { type: string; settings: Record<string, unknown> }> = {},
  liquidContext: Record<string, unknown> = {},
) {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const sectionKey = 'target';
  bundle.templates['__s3_test__'] = {
    name: 'S3 test',
    layout: 'theme',
    sections: {
      [sectionKey]: {
        type: sectionType,
        settings,
        blocks: Object.fromEntries(Object.entries(blocks).map(([id, b]) => [id, { ...b, disabled: false }])),
        block_order: Object.keys(blocks),
        disabled: false,
      },
    },
    order: [sectionKey],
  };

  const renderer = new LiquidRenderer();
  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 's3-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'letbuyy-core-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: '__s3_test__', type: 'page', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: '__s3_test__',
    liquidContext,
    liquidBundle: bundle,
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings?.join(', ')}`);
  const section = result.liquid?.sections.find((s) => s.id === sectionKey);
  assert.ok(section, 'target section must be present in the render result');
  return section!.html;
}

// Mirrors liquid-s1-w5-adversarial-security.test.ts's assertNeutralised exactly (same technique:
// parse into a real DOM and prove no live executable node/attribute exists, not a string search).
function assertNeutralised(html: string, label: string) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const { document } = dom.window;
  assert.equal(document.querySelectorAll('script').length, 0, `${label}: no live <script> element may exist`);
  for (const el of document.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      assert.doesNotMatch(attr.name, /^on/i, `${label}: no live on* handler may exist (found ${attr.name} on <${el.tagName.toLowerCase()}>)`);
    }
  }
  assert.equal((dom.window as unknown as Record<string, unknown>).__S3_PWNED__, undefined, `${label}: the payload must never actually execute`);
}

// ─── A1: hero-banner background image ──────────────────────────────────────────────────────────

test('A1: hero-banner renders the configured background image as a real <img src>', async () => {
  const html = await renderCoreSection('hero-banner', {
    heading: 'Fresh drops',
    ctaText: 'Shop',
    ctaLink: '/products',
    image: 'https://cdn.example/hero.jpg',
  });
  assert.match(html, /<img[^>]*class="lb-hero-banner__bg-image"[^>]*src="https:\/\/cdn\.example\/hero\.jpg"/);
});

test('A1-adversarial: a javascript: hero image URL is neutralised, not emitted as a live src', async () => {
  const html = await renderCoreSection('hero-banner', { heading: 'x', image: JS_URL_PAYLOAD });
  assert.doesNotMatch(html, /src="javascript:/i);
  assertNeutralised(html, 'hero image (javascript: scheme)');
});

test('A1-adversarial: a data: hero image URL is neutralised', async () => {
  const html = await renderCoreSection('hero-banner', { heading: 'x', image: DATA_URL_PAYLOAD });
  assert.doesNotMatch(html, /src="data:text\/html/i);
  assertNeutralised(html, 'hero image (data: scheme)');
});

test('A1-adversarial: an attribute-breakout image payload does not create a live onerror handler', async () => {
  const html = await renderCoreSection('hero-banner', { heading: 'x', image: IMG_XSS_PAYLOAD });
  assertNeutralised(html, 'hero image (attribute breakout)');
});

// ─── B1/B2: hero-banner height + textAlign (structural presence; behavioral diff proven by the
// harness's verifyBehavioralSettingChanges, which this file cannot re-run standalone without the
// Next.js react-jsx harness — see docs/evidence/liquid-parity/S3-render-parity.json) ────────────

test('B1: hero-banner height renders as a real, distinct CSS class per value', async () => {
  const full = await renderCoreSection('hero-banner', { heading: 'x', height: 'full' });
  const small = await renderCoreSection('hero-banner', { heading: 'x', height: 'small' });
  assert.match(full, /lb-hero-banner--height-full/);
  assert.match(small, /lb-hero-banner--height-small/);
  assert.notEqual(full, small);
});

test('B2: hero-banner textAlign renders as a real, distinct CSS class per value', async () => {
  const center = await renderCoreSection('hero-banner', { heading: 'x', textAlign: 'center' });
  const right = await renderCoreSection('hero-banner', { heading: 'x', textAlign: 'right' });
  assert.match(center, /lb-hero-banner--align-center/);
  assert.match(right, /lb-hero-banner--align-right/);
  assert.notEqual(center, right);
});

// ─── B3: about-section layout ───────────────────────────────────────────────────────────────────

test('B3: about-section layout renders as a real, distinct CSS class per value', async () => {
  const left = await renderCoreSection('about-section', { title: 'x', layout: 'left' });
  const center = await renderCoreSection('about-section', { title: 'x', layout: 'center' });
  assert.match(left, /lb-about-section--layout-left/);
  assert.match(center, /lb-about-section--layout-center/);
  assert.notEqual(left, center);
});

// ─── B4: app-block-slot "slot" is internal routing metadata — verified it does not render, and the
// harness's exclusion for it is verified to exist with a justification comment. ──────────────────

test('B4: app-block-slot "slot" is never rendered as visible page content', async () => {
  const html = await renderCoreSection('app-block-slot', { title: 'Apps', slot: 'storefront.home.after-hero' });
  assert.doesNotMatch(html, /storefront\.home\.after-hero/, 'the internal slot key must never leak into rendered output');
});

test('B4: the parity harness documents the "slot" exclusion with a justification, not a general loosening', () => {
  const src = readFileSync(new URL('../../../apps/storefront-runtime/scripts/liquid-parity-harness.mjs', import.meta.url), 'utf8');
  assert.match(src, /PARITY_EXCLUDED_SETTINGS/);
  assert.match(src, /'app-block-slot': new Set\(\['slot'\]\)/);
  assert.match(src, /does NOT loosen the general/);
});

// ─── A2: trust-badges block label as a real heading ────────────────────────────────────────────

test('A2: trust-badges renders each badge label as a heading element, matching TrustBadges.tsx', async () => {
  const html = await renderCoreSection('trust-badges', { title: 'Why shop with us' }, {
    b0: { type: 'badge', settings: { label: 'Free shipping', description: 'On all orders' } },
  });
  assert.match(html, /<h[1-6][^>]*>Free shipping<\/h[1-6]>/);
});

// ─── A3: featured-products empty state ─────────────────────────────────────────────────────────
// T1/W3: featured-products/product-grid no longer take per-item settings via merchant-configured
// blocks (that data was always fabricated — a merchant TYPING a fake title/price/url, never a real
// product). Both now bind the real, tenant-scoped `collection.products` drop, so these tests now
// exercise the 0-products / N-real-products cases via liquidContext rather than block settings.

test('A3 (S3-FIX item 1): featured-products shows the merchant\'s OWN title/subtitle ALWAYS, plus "No featured products" as an additive empty state — not a substitute for the heading', async () => {
  const html = await renderCoreSection('featured-products', {
    title: 'Drop-ready collection',
    subtitle: 'New arrivals weekly',
    viewAllLabel: 'View collection',
    viewAllHref: '/collections/new-arrivals',
  }, {}, { collection: { products: [] } }); // 0 real products
  assert.match(html, /No featured products/);
  assert.match(html, /Drop-ready collection/, 'the merchant\'s own heading must survive an empty catalog — S3-FIX item 1 regression guard');
  assert.match(html, /New arrivals weekly/, 'subtitle must also survive an empty catalog, matching product-grid.liquid\'s shape');
});

test('A3 (S3-FIX item 1): featured-products suppresses the "View collection" link specifically on an empty catalog (defensible: nothing to view), while keeping the heading', async () => {
  const html = await renderCoreSection('featured-products', {
    title: 'Drop-ready collection',
    viewAllLabel: 'View collection',
    viewAllHref: '/collections/new-arrivals',
  }, {}, { collection: { products: [] } });
  assert.match(html, /Drop-ready collection/);
  assert.doesNotMatch(html, /View collection/, 'the view-all link has nothing to point at on an empty catalog — suppressing only this link is the defensible half of the fix');
});

test('A3: featured-products shows the real product card and title when the collection has real products', async () => {
  const html = await renderCoreSection('featured-products', { title: 'Drop-ready collection', productLimit: 3 }, {}, {
    collection: { products: [{ id: 'p1', title: 'Canvas Tote', price: 99900, currency: 'INR', url: '/product/1' }] },
  });
  assert.match(html, /Drop-ready collection/);
  assert.match(html, /Canvas Tote/);
});

// ─── A4: product-grid empty state (title always shown, unlike featured-products) ───────────────

test('A4: product-grid shows "No products found" while still showing its title, matching product-grid.tsx', async () => {
  const html = await renderCoreSection('product-grid', { title: 'Featured Products' }, {}, { collection: { products: [] } });
  assert.match(html, /No products found/);
  assert.match(html, /Featured Products/, 'unlike featured-products, product-grid always shows its title (product-grid.tsx has no early return)');
});

test('A4: product-grid shows real product cards when the collection has real products', async () => {
  const html = await renderCoreSection('product-grid', { title: 'Featured Products', productLimit: 8 }, {}, {
    collection: { products: [{ id: 'p2', title: 'Court Sneaker', price: 349900, currency: 'INR', url: '/product/2' }] },
  });
  assert.match(html, /Featured Products/);
  assert.match(html, /Court Sneaker/);
  assert.doesNotMatch(html, /No products found/);
});

// ─── A5: app-block-slot "Installed app" placeholder ────────────────────────────────────────────

test('A5: app-block-slot falls back to the "Installed app" placeholder when no app has populated the block', async () => {
  const html = await renderCoreSection('app-block-slot', { title: 'Apps' }, {
    b0: { type: '@app', settings: {} },
  });
  assert.match(html, /<h3[^>]*>Installed app<\/h3>/);
});

// ─── A6: skills-section "General" grouping heading ─────────────────────────────────────────────

test('A6: skills-section renders a "General" grouping heading, matching skills-section.tsx\'s ungrouped-skill default', async () => {
  const html = await renderCoreSection('skills-section', { title: 'Skills' }, {
    b0: { type: 'skill', settings: { name: 'Illustration', level: 80 } },
  });
  assert.match(html, /<h3[^>]*>General<\/h3>/);
});

test('A6: skills-section renders no "General" heading when there are no skill blocks at all', async () => {
  const html = await renderCoreSection('skills-section', { title: 'Skills' }, {});
  assert.doesNotMatch(html, /General/);
});

// ─── C1: banner-carousel is a harness fixture bug, not a component defect (structural proof the
// underlying fact still holds — the behavioral zero/one/many-banner proof lives in the harness,
// which needs its Next.js react-jsx import-rewrite machinery to render React and cannot be
// re-executed standalone from this package). ───────────────────────────────────────────────────

test('C1: banner-carousel.tsx is confirmed NOT a standalone registered section (renderer-registry has no entry for it)', () => {
  const registry = readFileSync(new URL('../../../apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(registry, /banner-carousel/, 'if this ever gains a registry entry, the harness fixture-vs-component diagnosis must be re-checked');
});

test('C1: hero.tsx is confirmed the sole real caller, and only invokes BannerCarousel with banners.length > 1', () => {
  const hero = readFileSync(new URL('../../../apps/storefront-runtime/src/components/sections/hero.tsx', import.meta.url), 'utf8');
  assert.match(hero, /banners && banners\.length > 1/);
});

test('C1: the harness fixes the fixture (prop translation), not the component, and proves zero/one/many banners render', () => {
  const src = readFileSync(new URL('../../../apps/storefront-runtime/scripts/liquid-parity-harness.mjs', import.meta.url), 'utf8');
  assert.match(src, /REACT_PROPS_OVERRIDES/);
  assert.match(src, /HARNESS FIXTURE bug, not a defensive-coding/);
  assert.match(src, /verifyBannerCarouselSurvivesBannerCounts/);
});

// ─── S3-FIX item 3: banner-carousel's slide heading closes the last React-only diff ─────────────

test('S3-FIX item 3: banner-carousel renders each slide heading as a real heading element (decision (a) — matches trust-badges/skills-section/portfolio-grid/experience-timeline\'s established per-item-title-as-h3 convention)', async () => {
  const html = await renderCoreSection('banner-carousel', { title: 'Carousel', autoplay: true }, {
    s0: { type: 'slide', settings: { heading: 'Summer Drop', image: 'https://cdn.example/slide.jpg', link: '/collections/summer' } },
  });
  assert.match(html, /<h3[^>]*>Summer Drop<\/h3>/);
});

// ─── Regression guard: the two example bundles stay byte-identical in sections + blocks ─────────

test('the letbuyy-core-liquid and urban-kicks-liquid example bundles remain byte-identical for every touched section', () => {
  const touched = ['hero-banner', 'about-section', 'trust-badges', 'featured-products', 'product-grid', 'skills-section', 'app-block-slot'];
  for (const section of touched) {
    const core = readFileSync(new URL(`../examples/letbuyy-core-liquid/files/sections/${section}.liquid`, import.meta.url), 'utf8');
    const urban = readFileSync(new URL(`../examples/urban-kicks-liquid/files/sections/${section}.liquid`, import.meta.url), 'utf8');
    assert.equal(core, urban, `packages/theme-engine/examples/{letbuyy-core-liquid,urban-kicks-liquid}/files/sections/${section}.liquid must stay byte-identical`);
  }
});
