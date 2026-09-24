// SSR ↔ Client parity tests for all 10 lb-* hydration islands.
//
// The existing liquid-hydration-islands.test.mjs covers islands 1-4 (add-to-cart, cart-drawer,
// search, variant-picker) and lb-logout structural assertions. This file fills the genuine
// coverage gaps:
//   • Islands 5-9: lb-review-form, lb-wishlist-toggle, lb-cart, lb-customer-settings,
//     lb-address-manager in LIQUID_HYDRATION_ISLANDS, defineLiquidIsland, and SSR markup.
//   • lb-logout in LIQUID_HYDRATION_CUSTOM_ELEMENTS / DOMPurify ADD_TAGS (structural, not registry).
//   • tagNameCheck regex covers all 10 lb-* tags.
//   • LiquidIslandBase SSR-safe guard for islands 5-9 + lb-logout.
//   • Required data-* attributes emitted per island in the SSR Liquid template strings.
//
// All assertions are against real source files — no mocks, no tautologies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const BUNDLE_SRC = 'packages/theme-engine/src/theme-bundle.ts';
const ISLAND_SRC = 'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx';
const RENDERER_SRC = 'packages/theme-engine/src/theme-renderer.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

// ============================================================
// LIQUID_HYDRATION_ISLANDS registry — islands 5-9
// (islands 1-4 already covered in liquid-hydration-islands.test.mjs)
// ============================================================

test('LIQUID_HYDRATION_ISLANDS registry includes all 9 interactive islands with tag and kind', () => {
  const src = read(BUNDLE_SRC);

  // Islands 5-9 — the coverage gap.
  const expectedTags = [
    'lb-review-form',
    'lb-wishlist-toggle',
    'lb-cart',
    'lb-customer-settings',
    'lb-address-manager',
  ];
  const expectedKinds = [
    'review-form',
    'wishlist-toggle',
    'cart',
    'customer-settings',
    'address-manager',
  ];

  for (const tag of expectedTags) {
    assert.ok(src.includes(`tag: '${tag}'`), `LIQUID_HYDRATION_ISLANDS must have tag: '${tag}'`);
  }
  for (const kind of expectedKinds) {
    assert.ok(src.includes(`kind: '${kind}'`), `LIQUID_HYDRATION_ISLANDS must have kind: '${kind}'`);
  }
});

test('lb-logout is NOT in LIQUID_HYDRATION_ISLANDS (it is structural, not a stateful interactive island)', () => {
  // lb-logout bypasses the interactive-island registry because it wraps a no-JS <form method="post">
  // and only performs a single action (POST logout). It IS in LIQUID_HYDRATION_CUSTOM_ELEMENTS and
  // DOMPurify ADD_TAGS so the sanitizer preserves it. Testing that it is absent from the registry
  // pins the design intent and guards against accidental inclusion.
  const src = read(BUNDLE_SRC);
  const islandsBlock = src.match(/export const LIQUID_HYDRATION_ISLANDS = \{[\s\S]*?\} as const;/)?.[0] ?? '';
  assert.ok(islandsBlock.length > 0, 'LIQUID_HYDRATION_ISLANDS block must be extractable');
  assert.ok(!islandsBlock.includes('lb-logout'), 'lb-logout must NOT appear in LIQUID_HYDRATION_ISLANDS');
});

// ============================================================
// Client-side defineLiquidIsland calls — islands 5-9 + lb-logout
// ============================================================

test('registerLiquidHydrationIslands is exported and registers all 10 islands', () => {
  const src = read(ISLAND_SRC);

  assert.match(src, /export function registerLiquidHydrationIslands/);

  // Islands 5-9 (the gaps not covered by the existing test file).
  assert.match(src, /defineLiquidIsland\('lb-review-form', LbReviewFormElement\)/);
  assert.match(src, /defineLiquidIsland\('lb-wishlist-toggle', LbWishlistToggleElement\)/);
  assert.match(src, /defineLiquidIsland\('lb-cart', LbCartElement\)/);
  assert.match(src, /defineLiquidIsland\('lb-customer-settings', LbCustomerSettingsElement\)/);
  assert.match(src, /defineLiquidIsland\('lb-address-manager', LbAddressManagerElement\)/);
  // lb-logout — registered inside registerLiquidHydrationIslands (F7-Lane-B).
  assert.match(src, /defineLiquidIsland\('lb-logout', LbLogoutElement\)/);
});

test('LiquidIslandBase guard prevents ReferenceError on server SSR pass for islands 5-9 and lb-logout', () => {
  const src = read(ISLAND_SRC);

  // The server-safe base must check typeof HTMLElement at module scope.
  assert.match(src, /const LiquidIslandBase/);
  assert.match(src, /typeof HTMLElement !== 'undefined'/);

  // Every island must extend LiquidIslandBase — not bare HTMLElement — so the module
  // evaluates safely during Next.js SSR without a ReferenceError.
  assert.match(src, /class LbReviewFormElement extends LiquidIslandBase/);
  assert.match(src, /class LbWishlistToggleElement extends LiquidIslandBase/);
  assert.match(src, /class LbCartElement extends LiquidIslandBase/);
  assert.match(src, /class LbCustomerSettingsElement extends LiquidIslandBase/);
  assert.match(src, /class LbAddressManagerElement extends LiquidIslandBase/);
  assert.match(src, /class LbLogoutElement extends LiquidIslandBase/);
});

// ============================================================
// LIQUID_HYDRATION_CUSTOM_ELEMENTS in theme-renderer — all 10 tags
// ============================================================

test('LIQUID_HYDRATION_CUSTOM_ELEMENTS in theme-renderer.ts lists all 10 lb-* tags', () => {
  const src = read(RENDERER_SRC);
  const block = src.match(/const LIQUID_HYDRATION_CUSTOM_ELEMENTS = \[[\s\S]*?\] as const;/)?.[0] ?? '';
  assert.ok(block.length > 0, 'LIQUID_HYDRATION_CUSTOM_ELEMENTS array must be extractable');

  const required = [
    'lb-add-to-cart',
    'lb-cart-drawer',
    'lb-search',
    'lb-variant-picker',
    'lb-review-form',
    'lb-wishlist-toggle',
    'lb-cart',
    'lb-customer-settings',
    'lb-address-manager',
    'lb-logout',
  ];
  for (const tag of required) {
    assert.ok(block.includes(`'${tag}'`), `LIQUID_HYDRATION_CUSTOM_ELEMENTS must include '${tag}'`);
  }
});

// ============================================================
// DOMPurify sanitizer config — tagNameCheck covers all 10 lb-* tags
// ============================================================

test('DOMPurify tagNameCheck line covers all 10 lb-* island tag suffixes', () => {
  const src = read(RENDERER_SRC);
  // Extract just the tagNameCheck line; the regex literal itself does not contain '/'.
  const tagCheckLine = src.match(/tagNameCheck:\s*.+/)?.[0] ?? '';
  assert.ok(tagCheckLine.length > 0, 'tagNameCheck property must exist in CUSTOM_ELEMENT_HANDLING');

  const suffixes = [
    'add-to-cart',
    'cart-drawer',
    'search',
    'variant-picker',
    'review-form',
    'wishlist-toggle',
    'cart',
    'customer-settings',
    'address-manager',
    'logout',
  ];
  for (const suffix of suffixes) {
    assert.ok(tagCheckLine.includes(suffix), `tagNameCheck regex must include suffix '${suffix}'`);
  }
});

test('data-logout-url is explicitly listed in DOMPurify ADD_ATTR (not just a comment)', () => {
  const src = read(RENDERER_SRC);
  const addAttrBlock = src.match(/ADD_ATTR:\s*\[[\s\S]*?\],/)?.[0] ?? '';
  assert.ok(addAttrBlock.length > 0, 'ADD_ATTR array must be extractable');
  assert.ok(
    addAttrBlock.includes("'data-logout-url'"),
    'data-logout-url must be in ADD_ATTR so the sanitizer preserves it on lb-logout elements',
  );
});

// ============================================================
// SSR markup → required data-* attributes per island
// ============================================================

test('lb-review-form SSR markup emits data-lb-island, data-product-id, data-store-id', () => {
  // LbReviewFormElement.connectedCallback guards on !dataset.productId || !dataset.storeId;
  // missing either attribute silently disables the island.
  const src = read(BUNDLE_SRC);
  assert.match(src, /lb-review-form[^>]*data-lb-island="review-form"/);
  assert.match(src, /lb-review-form[^>]*data-product-id/);
  assert.match(src, /lb-review-form[^>]*data-store-id/);
});

test('lb-wishlist-toggle SSR markup emits data-lb-island, data-product-id, data-store-id, data-in-wishlist', () => {
  const src = read(BUNDLE_SRC);
  assert.match(src, /lb-wishlist-toggle[^>]*data-lb-island="wishlist-toggle"/);
  assert.match(src, /lb-wishlist-toggle[^>]*data-product-id/);
  assert.match(src, /lb-wishlist-toggle[^>]*data-store-id/);
  assert.match(src, /lb-wishlist-toggle[^>]*data-in-wishlist/);
});

test('lb-cart SSR markup emits data-lb-island="cart" and data-base-path for the checkout link', () => {
  // LbCartElement renders a checkout anchor using this.baseHref = this.dataset.basePath || inferBasePath();
  // The SSR attribute is critical so the link renders correctly without a JS inference round-trip.
  const src = read(BUNDLE_SRC);
  assert.match(src, /lb-cart\s+data-lb-island="cart"\s+data-base-path/);
});

test('lb-customer-settings SSR markup emits data-lb-island, data-email, data-name, data-phone, data-base-path', () => {
  // These five attributes drive the profile-form pre-fill in LbCustomerSettingsElement.render().
  // A missing data-email/data-name/data-phone leaves the pre-fill blank.
  const src = read(BUNDLE_SRC);
  assert.match(src, /data-lb-island="customer-settings"/);
  assert.match(src, /data-email="{{ customer\.email/);
  assert.match(src, /data-name="{{ customer\.name/);
  assert.match(src, /data-phone="{{ customer\.phone/);
  // data-base-path needed so LbCustomerSettingsElement can route profile/password API calls.
  const csBlock = src.match(/lb-customer-settings[\s\S]*?data-base-path[^"]*"([^"]*)"/)?.[0] ?? '';
  assert.ok(csBlock.length > 0, 'lb-customer-settings SSR must emit data-base-path');
  assert.match(src, /lb-customer-settings[\s\S]*?data-base-path="\/store\/\{\{ shop\.subdomain \}\}"/);
});

test('lb-address-manager SSR markup emits data-lb-island="address-manager" and data-base-path', () => {
  const src = read(BUNDLE_SRC);
  assert.match(src, /data-lb-island="address-manager"/);
  // data-base-path lets LbAddressManagerElement route /api/customer/addresses calls.
  assert.match(src, /lb-address-manager[\s\S]*?data-base-path="\/store\/\{\{ shop\.subdomain \}\}"/);
});

test('lb-logout SSR markup emits data-logout-url and wraps a no-JS <form method="post">', () => {
  // lb-logout is a progressive-enhancement wrapper:
  // • JS path: LbLogoutElement.performLogout() fetches data-logout-url then redirects.
  // • No-JS path: the inner <form method="post"> submits natively.
  // Both paths must be present in the SSR output.
  const src = read(BUNDLE_SRC);

  assert.match(src, /lb-logout/);
  assert.match(src, /data-logout-url="{{ routes\.account_logout_url }}"/);
  // No-JS form must be present inside lb-logout.
  assert.match(src, /<form method="post" action="{{ routes\.account_logout_url }}"/);

  // Confirm the submit button is physically nested inside lb-logout (not orphaned).
  const logoutIsland = src.match(/lb-logout[\s\S]*?<\/lb-logout>/)?.[0] ?? '';
  assert.ok(logoutIsland.length > 0, 'lb-logout closing tag must be present in theme-bundle SSR');
  assert.ok(
    logoutIsland.includes('<button type="submit"'),
    'submit button must be nested inside lb-logout so native form submission works without JS',
  );
});
