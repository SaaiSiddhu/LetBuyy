// W3 (PHASE-T3-fix) — the storefront footer must never link to a policy page that 404s.
// `/privacy`, `/terms`, `/shipping`, `/returns` are content-existence-dependent routes (see
// CAPABILITY_BACKLOG.md, T3-fix W3): they 404 unless the store has a published row in
// storefront_policies for that type. Before this fix the footer's Policies column emitted all
// four links unconditionally, regardless of whether any content existed to answer them —
// verifiably true for every store today (0 rows in storefront_policies anywhere), so every
// LetBuyy storefront shipped four dead links plus a fifth ('/policies/shipping-policy', a
// Shopify URL convention this app never served) in the Urban Kicks quick-links fixture.
//
// The fix threads the real published policy-type set through as shop.policies
// (composition-engine.tsx, sourced from ContentService.listPolicies — one gateway call, not
// four) and the footer template gates each link (and the whole "Policies" column) on it. These
// tests exercise the actual Liquid template via LiquidRenderer with shop.policies set directly
// (the same override mechanism liquid-l4-chrome.test.ts uses for shop.name), which is how
// composition-engine.tsx's fetched value reaches the template — the fetch itself is a plain,
// already-typechecked ContentService call, not something a template-level test can usefully
// re-verify.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function renderFooter(policies: string[]) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidContext: { shop: { policies } },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

// The footer also carries an unrelated merchant "quick links" block (rendered from
// section.blocks, not shop.policies) whose fixture href legitimately contains "/shipping" —
// scope every assertion to just the Policies column so that block can never produce a false
// pass or false failure here.
function policiesColumn(footer: string): string {
  const match = footer.match(/<h4>Policies<\/h4>[\s\S]*?<\/nav>/);
  return match ? match[0] : '';
}

test('W3: a store with zero published policies renders no policy link at all', async () => {
  const result = await renderFooter([]);
  const footer = result.liquid?.footer ?? '';
  assert.doesNotMatch(footer, /<h4>Policies<\/h4>/, 'the whole Policies column must be omitted, not an empty heading with no links');
});

test('W3: a store with all four published policies renders all four links', async () => {
  const result = await renderFooter(['privacy', 'terms', 'shipping', 'returns']);
  const column = policiesColumn(result.liquid?.footer ?? '');
  assert.match(column, /\/privacy/);
  assert.match(column, /\/terms/);
  assert.match(column, /\/shipping/);
  assert.match(column, /\/returns/);
});

test('W3: only the published subset renders — no fabricated links for unpublished types', async () => {
  const result = await renderFooter(['privacy']);
  const column = policiesColumn(result.liquid?.footer ?? '');
  assert.match(column, /\/privacy/);
  assert.doesNotMatch(column, /\/terms/);
  assert.doesNotMatch(column, /\/shipping/);
  assert.doesNotMatch(column, /\/returns/);
});

test('W3: the returns link accepts either historical policy_type name (refund or returns)', async () => {
  const viaRefund = await renderFooter(['refund']);
  const viaReturns = await renderFooter(['returns']);
  assert.match(policiesColumn(viaRefund.liquid?.footer ?? ''), /\/returns/, 'policy_type "refund" must still surface the /returns link');
  assert.match(policiesColumn(viaReturns.liquid?.footer ?? ''), /\/returns/, 'policy_type "returns" must surface the /returns link');
});

test('W3: this is driven by real data, not a hardcoded policy set — an unknown/future type does not force any link', async () => {
  const result = await renderFooter(['gift-card-terms']);
  const footer = result.liquid?.footer ?? '';
  const column = policiesColumn(footer);
  assert.match(footer, /<h4>Policies<\/h4>/, 'the column renders because shop.policies is non-empty, even though nothing in it matches a known link');
  assert.doesNotMatch(column, /\/privacy/);
  assert.doesNotMatch(column, /\/terms/);
  assert.doesNotMatch(column, /\/shipping/);
  assert.doesNotMatch(column, /\/returns/);
});

test('T4 W1: the Urban Kicks quick-links fixture carries no policy-shaped dead link', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const footerTemplate = bundle.templates.footer;
  const blocks = footerTemplate?.sections['footer-default']?.blocks ?? {};
  const hrefs = Object.values(blocks).map((block) => (block as { settings?: { href?: string } }).settings?.href);
  assert.ok(!hrefs.includes('/policies/shipping-policy'), 'the fabricated Shopify-convention URL must be gone');
  // T4 W1 — the fixture's own 'footer-policy' quick-link duplicated the Policies column's job
  // through a path shop.policies gating never reached (an unconditional block render), which is
  // exactly the class of dead link this phase closes. Removed entirely rather than re-pointed:
  // the Policies column alone is now the single, data-driven source for policy links.
  assert.ok(!hrefs.includes('/shipping'), 'no quick-link block should duplicate the Policies column\'s job outside its shop.policies gate');
  assert.deepEqual(hrefs, ['/contact'], 'only the real Contact quick link should remain');
});
