import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const THEME_BUNDLE_SOURCE = readFileSync('packages/theme-engine/src/theme-bundle.ts', 'utf8');
const COMPOSITION_SOURCE = readFileSync('apps/customer_web/src/lib/theme-engine/composition-engine.tsx', 'utf8');
const ISLAND_SOURCE = readFileSync('apps/customer_web/src/lib/theme-engine/liquid-hydration-islands.tsx', 'utf8');

test('Liquid bundle contract publishes hydration island tags', () => {
  assert.match(THEME_BUNDLE_SOURCE, /export const LIQUID_HYDRATION_ISLANDS/);
  assert.match(THEME_BUNDLE_SOURCE, /tag: 'lb-add-to-cart'/);
  assert.match(THEME_BUNDLE_SOURCE, /tag: 'lb-cart-drawer'/);
  assert.match(THEME_BUNDLE_SOURCE, /tag: 'lb-search'/);
  assert.match(THEME_BUNDLE_SOURCE, /tag: 'lb-variant-picker'/);
  assert.match(THEME_BUNDLE_SOURCE, /type LiquidHydrationIslandKind/);
});

test('Liquid fixture carries cart search and variant hydration islands', () => {
  assert.match(THEME_BUNDLE_SOURCE, /<lb-variant-picker data-lb-island="variant-picker"/);
  assert.match(THEME_BUNDLE_SOURCE, /data-lb-variant-option/);
  assert.match(THEME_BUNDLE_SOURCE, /<lb-add-to-cart data-lb-island="add-to-cart"/);
  assert.match(THEME_BUNDLE_SOURCE, /data-lb-add-to-cart-status/);
  assert.match(THEME_BUNDLE_SOURCE, /<lb-search data-lb-island="search"/);
  assert.match(THEME_BUNDLE_SOURCE, /<lb-cart-drawer data-lb-island="cart-drawer"/);
});

test('storefront Liquid renderer mounts the hydration island runtime', () => {
  assert.match(COMPOSITION_SOURCE, /import LiquidHydrationIslands from '\.\/liquid-hydration-islands'/);
  assert.match(COMPOSITION_SOURCE, /<LiquidHydrationIslands basePath=\{basePath\} storeId=\{storeId\} \/>/);
  assert.match(COMPOSITION_SOURCE, /data-theme-renderer="liquid"/);
});

test('hydration runtime defines small web components for Liquid interactivity', () => {
  assert.match(ISLAND_SOURCE, /'use client'/);
  assert.match(ISLAND_SOURCE, /customElements\.define\(name, constructor\)/);
  assert.match(ISLAND_SOURCE, /defineLiquidIsland\('lb-add-to-cart', LbAddToCartElement\)/);
  assert.match(ISLAND_SOURCE, /defineLiquidIsland\('lb-cart-drawer', LbCartDrawerElement\)/);
  assert.match(ISLAND_SOURCE, /defineLiquidIsland\('lb-search', LbSearchElement\)/);
  assert.match(ISLAND_SOURCE, /defineLiquidIsland\('lb-variant-picker', LbVariantPickerElement\)/);
  assert.match(ISLAND_SOURCE, /const CART_STORAGE_KEY = 'lb_cart'/);
  assert.match(ISLAND_SOURCE, /const CART_OPEN_EVENT = 'letbuyy:cart:open'/);
  assert.match(ISLAND_SOURCE, /const VARIANT_CHANGED_EVENT = 'letbuyy:variant:changed'/);
  assert.match(ISLAND_SOURCE, /ensureLiquidCartDrawer\(root, basePath\)/);
});

test('F7-Lane-B lb-logout island: registered, POSTs to logout URL, falls back to native form', () => {
  // lb-logout must be in the island registry.
  assert.match(ISLAND_SOURCE, /defineLiquidIsland\('lb-logout', LbLogoutElement\)/);
  // Island class must exist.
  assert.match(ISLAND_SOURCE, /class LbLogoutElement/);
  // Island must read the logout URL from data-logout-url.
  assert.match(ISLAND_SOURCE, /dataset\.logoutUrl/);
  // fetch POST is the JS-enhanced path.
  assert.match(ISLAND_SOURCE, /method: 'POST'/);
  assert.match(ISLAND_SOURCE, /credentials: 'include'/);
  // Redirect to /customers/login on success.
  assert.match(ISLAND_SOURCE, /\/customers\/login/);
  // Native form.submit() is the no-JS fallback (called when fetch fails).
  assert.match(ISLAND_SOURCE, /form\.submit\(\)/);
  // Island must be ART-17 compliant (Web Component, not a React section renderer).
  // Verify it extends LiquidIslandBase (the guarded HTMLElement base).
  assert.match(ISLAND_SOURCE, /LbLogoutElement extends LiquidIslandBase/);
});
