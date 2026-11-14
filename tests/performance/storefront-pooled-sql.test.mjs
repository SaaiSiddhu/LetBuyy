import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const adapterSource = readFileSync('packages/infrastructure/pooled-sql-adapter/index.ts', 'utf8');
const infrastructurePackage = JSON.parse(readFileSync('packages/infrastructure/package.json', 'utf8'));
const infrastructureIndexSource = readFileSync('packages/infrastructure/src/index.ts', 'utf8');
const gatewayIndexSource = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const storefrontRouteSource = readStorefrontRouteSource();
const wranglerSource = readFileSync('services/api-gateway/wrangler.toml', 'utf8');
const lockfileSource = readFileSync('pnpm-lock.yaml', 'utf8');

function assertIncludesAll(source, needles, context) {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${context} is missing ${needle}`);
  }
}

test('infrastructure owns the postgres-backed pooled SQL adapter', () => {
  assert.equal(infrastructurePackage.dependencies.postgres, '^3.4.7');
  assert.equal(infrastructurePackage.exports['./pooled-sql-adapter'], './pooled-sql-adapter/index.ts');
  assert.match(lockfileSource, /postgres@3\.4\.9/);
  assert.ok(infrastructureIndexSource.includes("export * from '../pooled-sql-adapter/index'"));
  assertIncludesAll(adapterSource, [
    "import postgres from 'postgres'",
    'HYPERDRIVE?: HyperdriveConnectionBinding',
    'readonly connectionString: string',
    'STOREFRONT_POOLED_SQL?: string',
    "normalizedFlag(env.STOREFRONT_POOLED_SQL) !== 'off'",
    'env.HYPERDRIVE?.connectionString || env.DATABASE_URL || env.SUPABASE_DB_URL',
    'prepare: false',
    'onnotice: () => undefined',
    'const pooledClients = new Map',
  ], 'pooled SQL adapter');
});

test('api gateway exposes Hyperdrive and rollbackable storefront pooled SQL flags', () => {
  assertIncludesAll(gatewayIndexSource, [
    'HYPERDRIVE?: Hyperdrive',
    'DATABASE_URL?: string',
    'SUPABASE_DB_URL?: string',
    'STOREFRONT_POOLED_SQL?: string',
  ], 'gateway Env');
  assert.equal((wranglerSource.match(/STOREFRONT_POOLED_SQL = "on"/g) || []).length, 3);
});

test('storefront cache-miss hot reads use pooled SQL before Supabase fallback', () => {
  assertIncludesAll(storefrontRouteSource, [
    "import { getPooledSql } from '@letbuyy/infrastructure/pooled-sql-adapter'",
    'async function loadPublishedStoreFromPooledSql',
    'async function loadSiteByHandleFromPooledSql',
    'async function loadCurrentThemeReleaseFromPooledSql',
    'async function queryPublicProductsFromPooledSql',
    'const pooledStore = await loadPublishedStoreFromPooledSql',
    'const pooledSite = await loadSiteByHandleFromPooledSql',
    'const pooledRelease = await loadCurrentThemeReleaseFromPooledSql',
    'const pooledResult = await queryPublicProductsFromPooledSql',
    'return null',
    'getSupabaseAdmin(c)',
  ], 'storefront pooled SQL hot reads');
});

test('pooled catalog reads preserve existing filters and exact-count behavior until P2-4', () => {
  assertIncludesAll(storefrontRouteSource, [
    "filters = ['store_id = $1', 'is_active = true', 'deleted_at is null']",
    'id::text = any',
    'category = $',
    'name ilike $',
    'count(*) over() as __total_count',
    'order by display_order asc',
    'productRowWithoutCount',
  ], 'pooled product catalog query');
});
