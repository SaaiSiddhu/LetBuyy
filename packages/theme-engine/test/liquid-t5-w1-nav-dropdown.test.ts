// T5/W1 — the header nav falls back to linklists.main_menu when no explicit `link` blocks are
// configured, and renders one level of nested children as a <details> dropdown. This exercises the
// real regression this phase found and fixed: toLiquidDrop's recursive depth cap (MAX_LIQUID_DROP_
// DEPTH=4, a deliberate security/DoS guard also covered by qi-security.test.ts's SEC-4, which this
// file must never touch) sits exactly at the depth a nav item's OWN nested `.links` array needs —
// before the fix, `link.links` was silently undefined for every item, not merely empty, dropping
// every submenu regardless of content. The fix is a scoped +2 depth budget passed only for the
// linklists conversion (theme-renderer.ts's `toLiquidDrop(..., MAX_LIQUID_DROP_DEPTH + 2)` call) —
// +1 alone only rescues the empty children-array shell, not the child objects' own entries — not a
// change to the global default SEC-4 asserts.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '22222222-2222-4222-8222-222222222222';

async function renderHeader(linklists: Record<string, unknown>) {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  // The fixture's own header instance may carry example `link` blocks (blocks intentionally win
  // over the linklist per T5/W1's documented precedence) — clear them so this test exercises the
  // linklist fallback path specifically, the thing this test is actually about.
  const headerSection = bundle.templates?.header?.sections?.['header-default'];
  if (headerSection) {
    headerSection.blocks = {};
    headerSection.block_order = [];
  }

  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidContext: { linklists },
    liquidBundle: bundle,
  });
}

test('T5/W1: header renders linklists.main_menu when section has no link blocks', async () => {
  const result = await renderHeader({
    main_menu: { handle: 'main_menu', title: 'Main Menu', links: [
      { title: 'Sneakers', url: '/collections/sneakers', active: false, links: [] },
    ] },
  });
  const header = result.liquid?.header ?? '';
  const nav = header.split('lb-header__nav-links')[1]?.split('lb-header__nav-foot')[0] || '';
  assert.match(nav, /Sneakers/);
  assert.match(nav, /\/store\/local-kicks\/collections\/sneakers/);
});

test('T5/W1: a nav item with nested children renders as a <details> dropdown, not a plain link', async () => {
  const result = await renderHeader({
    main_menu: { handle: 'main_menu', title: 'Main Menu', links: [
      {
        title: 'Shop by style', url: '/collections/all', active: false,
        links: [
          { title: 'New arrivals', url: '/collections/new-arrivals', active: false, links: [] },
          { title: 'All products', url: '/collections/all-products', active: false, links: [] },
        ],
      },
    ] },
  });
  const header = result.liquid?.header ?? '';
  const nav = header.split('lb-header__nav-links')[1]?.split('lb-header__nav-foot')[0] || '';
  assert.match(nav, /<details class="lb-header__nav-item" data-lb-nav-dropdown(?:="")?>/);
  assert.match(nav, /<summary[^>]*>Shop by style/);
  assert.match(nav, /class="lb-header__nav-submenu"[^>]*>.*New arrivals.*All products/s);
});

test('T5/W1: a nav item with no children renders as a plain link, no dropdown wrapper', async () => {
  const result = await renderHeader({
    main_menu: { handle: 'main_menu', title: 'Main Menu', links: [
      { title: 'Products', url: '/products', active: false, links: [] },
    ] },
  });
  const header = result.liquid?.header ?? '';
  const nav = header.split('lb-header__nav-links')[1]?.split('lb-header__nav-foot')[0] || '';
  assert.doesNotMatch(nav, /<details/);
  assert.match(nav, /<a href="\/store\/local-kicks\/products">Products<\/a>/);
});

test('T5/W1: link.active renders aria-current="page" on both flat links and dropdown summaries', async () => {
  const result = await renderHeader({
    main_menu: { handle: 'main_menu', title: 'Main Menu', links: [
      { title: 'Products', url: '/products', active: true, links: [] },
      { title: 'Shop', url: '/shop', active: false, links: [
        { title: 'Child', url: '/child', active: true, links: [] },
      ] },
    ] },
  });
  const header = result.liquid?.header ?? '';
  const nav = header.split('lb-header__nav-links')[1]?.split('lb-header__nav-foot')[0] || '';
  assert.match(nav, /<a href="\/store\/local-kicks\/products" aria-current="page">Products<\/a>/);
  assert.match(nav, /<a href="\/store\/local-kicks\/child" aria-current="page">Child<\/a>/);
});

test('T5/W1: explicit link blocks still override the linklist when present (backward compatibility)', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  // T6/W0 — the fixture no longer ships example link blocks by default (see theme-bundle.ts's
  // header-default), so this test constructs its own blocks explicitly to exercise the override
  // path — a store that HAS configured blocks (through the editor, not this fixture's defaults)
  // must still have them win over the linklist. This is the mutation T6/W0 explicitly permits this
  // one test to keep; liquid-l4-chrome.test.ts's "nav link URLs are validated" test uses the same
  // pattern for the same reason.
  bundle.templates.header.sections['header-default'].blocks = {
    'header-configured': { type: 'link', settings: { label: 'Configured link', href: '/configured' } },
  };
  bundle.templates.header.sections['header-default'].block_order = ['header-configured'];
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidContext: { linklists: { main_menu: { handle: 'main_menu', title: 'Main Menu', links: [
      { title: 'Should not appear', url: '/nope', active: false, links: [] },
    ] } } },
    liquidBundle: bundle,
  });
  const header = result.liquid?.header ?? '';
  const nav = header.split('lb-header__nav-links')[1]?.split('lb-header__nav-foot')[0] || '';
  assert.match(nav, /Configured link/, 'the explicitly-configured block must render');
  assert.doesNotMatch(nav, /Should not appear/, 'the linklist must not win once blocks are configured');
});

// T6/W0 — unlike every other test in this file, this one renders the SHIPPED fixture completely
// unmutated (no block-clearing, no injected blocks) so a regression that reintroduces default
// header/footer link blocks — silently making linklists unreachable again, as T5 shipped it — is
// caught by the suite itself rather than requiring a live database inspection to notice.
test('T6/W0: the shipped (unmutated) fixture renders merchant navigation from linklists by default', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.deepEqual(
    bundle.templates.header.sections['header-default'].block_order,
    [],
    'the shipped fixture must not carry default header link blocks — they would silently beat linklists',
  );
  assert.deepEqual(
    bundle.templates.footer.sections['footer-default'].block_order,
    [],
    'the shipped fixture must not carry default footer link blocks — they would silently beat linklists',
  );

  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidContext: { linklists: { main_menu: { handle: 'main_menu', title: 'Main Menu', links: [
      { title: 'Real Merchant Nav', url: '/real-nav', active: false, links: [] },
    ] } } },
    liquidBundle: bundle, // unmutated — the shipped fixture, exactly as generate-examples.mjs writes it
  });

  const header = result.liquid?.header ?? '';
  const nav = header.split('lb-header__nav-links')[1]?.split('lb-header__nav-foot')[0] || '';
  assert.match(nav, /Real Merchant Nav/, 'a fresh store must render its real navigation by default');
});

// T6/W0 — bounds the linklists depth override itself (theme-renderer.ts's
// `toLiquidDrop(input.liquidContext?.linklists, 0, MAX_LIQUID_DROP_DEPTH + 2)`). The override is
// deliberately +2, not unbounded: it rescues exactly one level of nav nesting (a child item's own
// title/url/active/links), and a grandchild — the nav item's child's OWN nested `.links` — must
// still be dropped, the same way SEC-4 (qi-security.test.ts) proves the unraised global default
// drops content past its own bound. This does not touch SEC-4 or the global default.
test('T6/W0: the linklists depth override is bounded — a THIRD level of nesting (grandchildren) does not survive', async () => {
  const result = await renderHeader({
    main_menu: { handle: 'main_menu', title: 'Main Menu', links: [
      {
        title: 'Level 1', url: '/level-1', active: false,
        links: [
          {
            title: 'Level 2', url: '/level-2', active: false,
            links: [
              { title: 'Level 3 should not appear', url: '/level-3', active: false, links: [] },
            ],
          },
        ],
      },
    ] },
  });
  const header = result.liquid?.header ?? '';
  const nav = header.split('lb-header__nav-links')[1]?.split('lb-header__nav-foot')[0] || '';
  assert.match(nav, /Level 1/, 'the top-level item must render');
  assert.match(nav, /Level 2/, 'one level of nested children must render');
  assert.doesNotMatch(nav, /Level 3 should not appear/, 'a second level of nesting (grandchildren) must not survive — the override is bounded, not unbounded recursion');
});
