import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const cacheHelperSource = readFileSync('services/api-gateway/src/lib/storefront-cache.ts', 'utf8');
const storefrontRouteSource = readStorefrontRouteSource();
const themesRouteSource = readFileSync('services/api-gateway/src/routes/themes.ts', 'utf8');
const gatewayIndexSource = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const wranglerSource = readFileSync('services/api-gateway/wrangler.toml', 'utf8');

function assertIncludesAll(source, needles, context) {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${context} is missing ${needle}`);
  }
}

test('storefront cache helper wraps Cloudflare Cache API with rollback flag and cache headers', () => {
  assertIncludesAll(cacheHelperSource, [
    'STOREFRONT_CACHE_TTL_SECONDS = 60',
    'STOREFRONT_CACHE_SWR_SECONDS = 300',
    "STOREFRONT_CACHE_VERSION_PREFIX = 'storefront-cache-version'",
    "normalizedCacheFlag(env.STOREFRONT_CACHE) !== 'off'",
    "cacheState !== 'BYPASS' ? cacheControlHeader",
    'caches.default',
    'c.env.CACHE.get(storefrontCacheVersionKey(handle))',
    'cache.put(storefrontCacheVersionKey(handle), version)',
    'cache.match(request)',
    'cache.put(request, response.clone())',
    'cache.delete(storefrontCacheRequest(key))',
    "'Cache-Control'",
    "'X-Storefront-Cache'",
    "'Cache-Tag'",
  ], 'storefront cache helper');
});

test('api gateway exposes STOREFRONT_CACHE flag and defaults it on with off rollback available', () => {
  assert.match(gatewayIndexSource, /STOREFRONT_CACHE\?: string/);
  assert.equal((wranglerSource.match(/STOREFRONT_CACHE = "on"/g) || []).length, 3);
});

test('public storefront REST reads are cached with request-normalized keys', () => {
  assertIncludesAll(storefrontRouteSource, [
    'cachedJson',
    "storefrontRequestCacheKey(c, 'bootstrap'",
    "storefrontRequestCacheKey(c, 'products'",
    "storefrontRequestCacheKey(c, 'products-by-ids'",
    "storefrontRequestCacheKey(c, 'product-detail'",
    "storefrontRequestCacheKey(c, 'categories'",
    "storefrontRequestCacheKey(c, 'navigation'",
    "storefrontRequestCacheKey(c, 'pages'",
    "storefrontRequestCacheKey(c, 'policies'",
    "storefrontRequestCacheKey(c, 'policy'",
    "storefrontRequestCacheKey(c, 'page'",
    "storefrontRequestCacheKey(c, 'blog'",
    "storefrontRequestCacheKey(c, 'blog-detail'",
  ], 'cached storefront REST routes');
});

test('cached storefront responses carry store-scoped tags for provider purge support', () => {
  assertIncludesAll(storefrontRouteSource, [
    'function storefrontCacheTags',
    '`storefront:${storeId}`',
    '`storefront:${handle}`',
    "'storefront:bootstrap'",
    "'storefront:products'",
    "'storefront:navigation'",
    "'storefront:pages'",
    "'storefront:policies'",
    "'storefront:blog'",
  ], 'storefront cache tags');
});

test('theme publish and rollback bump store cache versions and purge the legacy bootstrap key', () => {
  assertIncludesAll(themesRouteSource, [
    'bumpStorefrontCacheVersion',
    'purgeStorefrontCache',
    'storefrontCacheKey',
    'async function purgeThemeStorefrontCache',
    ".select('subdomain,store_name,custom_domain')",
    'await bumpStorefrontCacheVersion(c, handles)',
    "storefrontCacheKey('storefront-rest', 'bootstrap', '0', handle)",
    'await purgeThemeStorefrontCache(c, body.store_id)',
  ], 'theme storefront cache invalidation');
});
