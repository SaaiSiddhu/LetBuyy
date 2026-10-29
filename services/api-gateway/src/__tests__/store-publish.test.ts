import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

/**
 * Ownership on `sites` is a genuine two-column disjunction (custom_user_id is the current owner
 * column, user_id the legacy one), so it cannot collapse into a single .eq() and has to go through
 * PostgREST's .or(), which takes a RAW filter string that postgrest-js does not quote. These tests
 * used to pin the interpolated literal `custom_user_id.eq.${customUser.id},user_id.eq.${...}`
 * directly — which meant they asserted the UNESCAPED form and would fail the escaped one. They now
 * pin the shared helper instead, and additionally assert that the helper double-quotes and
 * backslash-escapes its value, so the protection the assertion exists for is stronger than before,
 * not weaker.
 */
function assertOwnershipFilterIsEscaped(routeSource: string): void {
    assert.match(routeSource, /function ownedByCustomUserFilter\(customUserId: string\): string \{/);
    assert.match(routeSource, /const value = `"\$\{customUserId\.replace\(\/\["\\\\]\/g, '\\\\\$&'\)\}"`/);
    assert.match(routeSource, /return `custom_user_id\.eq\.\$\{value\},user_id\.eq\.\$\{value\}`/);
    assert.doesNotMatch(routeSource, /\.or\(`custom_user_id\.eq\.\$\{customUser\.id\}/);
}

test('store publish updates only owned sites to published with a timestamp', () => {
    const routeSource = source('routes/stores.ts');

    assert.match(routeSource, /router\.post\('\/:id\/publish'/);
    assert.match(routeSource, /status:\s*'published'/);
    assert.match(routeSource, /published_at:\s*new Date\(\)\.toISOString\(\)/);
    assert.match(routeSource, /\.eq\('id',\s*storeId\)/);
    assert.match(routeSource, /\.or\(ownedByCustomUserFilter\(customUser\.id\)\)/);
    assertOwnershipFilterIsEscaped(routeSource);
    assert.match(routeSource, /Store not found or not owned by you/);
});

test('store health computes mobile readiness from real owned store signals', () => {
    const routeSource = source('routes/stores.ts');

    assert.match(routeSource, /router\.get\('\/:id\/health'/);
    assert.match(routeSource, /\.or\(ownedByCustomUserFilter\(customUser\.id\)\)/);
    assertOwnershipFilterIsEscaped(routeSource);
    assert.match(routeSource, /\.from\('products'\)[\s\S]+\.select\('id',\s*\{ count: 'exact', head: true \}\)/);
    assert.match(routeSource, /\.from\('orders'\)[\s\S]+\.in\('status',\s*\['pending', 'pending_cod', 'confirmed', 'processing'\]\)/);
    assert.match(routeSource, /\.from\('product_reviews'\)[\s\S]+\.eq\('status',\s*'pending'\)/);
    assert.match(routeSource, /api-gateway\.stores\.health/);
    assert.doesNotMatch(routeSource, /Math\.random|fake|sample health/i);
});

test('store PATCH accepts business profile and invoice address fields', () => {
    const routeSource = source('routes/stores.ts');
    const tenantCoreSource = repositorySource('packages/tenant-core/src/index.ts');
    const sharedTypesSource = repositorySource('packages/shared-types/src/index.ts');
    const migrationSource = repositorySource('database/supabase/migrations/122_mobile_business_profile.sql');

    assert.match(routeSource, /router\.patch\('\/:id'/);
    for (const field of [
        'legal_name',
        'gstin',
        'gst_state_code',
        'invoice_prefix',
        'business_profile',
        'invoice_address',
        'invoice_footer',
    ]) {
        assert.match(routeSource, new RegExp(`'${field}'`));
    }
    assert.match(routeSource, /\.update\(updates\)[\s\S]*\.eq\('id',\s*storeId\)/);
    assert.match(routeSource, /\.or\(ownedByCustomUserFilter\(customUser\.id\)\)/);
    assertOwnershipFilterIsEscaped(routeSource);
    assert.match(tenantCoreSource, /business_profile:\s*BusinessProfileSchema\.optional\(\)\.nullable\(\)/);
    assert.match(tenantCoreSource, /invoice_address:\s*AddressSchema\.partial\(\)\.passthrough\(\)\.refine\(/);
    assert.match(sharedTypesSource, /export const BusinessProfileSchema/);
    assert.match(sharedTypesSource, /business_profile:\s*BusinessProfileSchema\.optional\(\)\.nullable\(\)/);
    assert.match(migrationSource, /ALTER TABLE public\.sites[\s\S]*ADD COLUMN IF NOT EXISTS business_profile jsonb/);
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS invoice_address jsonb/);
    assert.match(migrationSource, /sites_business_profile_object_check/);
});

test('public storefront resolver only exposes published stores by handle', () => {
    const routeSource = source('routes/storefront.ts');
    const publicRouteSource = source('routes/storefront/public-routes.ts');

    assert.match(routeSource, /normalizeStorefrontHandle\(handle\)/);
    // A public handle resolves against sites.subdomain and nothing else. The previous
    // `.or(subdomain.eq.${normalized},store_name.eq.${normalized})` could match two different
    // tenants for one handle and, with limit(1) and no ordering, return an arbitrary one — a
    // cross-tenant read. subdomain is NOT NULL + UNIQUE, so .eq() is single-valued, and .eq() is
    // parameter-encoded where .or() takes a raw filter string.
    assert.match(routeSource, /\.eq\('subdomain',\s*normalized\)/);
    assert.doesNotMatch(routeSource, /\.or\(`subdomain\.eq\.\$\{normalized\},store_name\.eq\.\$\{normalized\}`\)/);
    assert.match(routeSource, /if \(options\.publishedOnly\) query = query\.eq\('status',\s*'published'\)/);
    assert.match(publicRouteSource, /router\.get\('\/:subdomain',\s*async \(c\) =>/);
    assert.match(publicRouteSource, /loadSiteByHandle\(c,\s*c\.req\.param\('subdomain'\),\s*\{ publishedOnly:\s*true \}\)/);
});

test('merchant publish proxy requires session and encodes store ids', () => {
    const routeSource = repositorySource('apps/merchant/web/src/app/api/themes/publish/route.ts');

    assert.match(routeSource, /const api = createMerchantApiClient\(\)/);
    assert.match(routeSource, /api\.stores\.publish\(storeId\)/);
    assert.match(routeSource, /api\.stores\.update\(storeId,\s*\{\s*status:\s*'draft'\s*\}\)/);
});

test('storefront proxy rewrites resolved store hosts into store routes', () => {
    const proxySource = repositorySource('apps/commerce/web/src/proxy.ts');

    assert.match(proxySource, /normalizeRequestHost\(req\.headers\.get\('x-forwarded-host'\) \|\| req\.headers\.get\('host'\)\)/);
    // F-ARCHIVEPATH-1: this required NEXT_PUBLIC_STORE_ROOT_DOMAIN to be the LAST argument, so it
    // broke when proxy.ts:410 gained a third — NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES. The property is
    // that the resolver is called with the request host and the configured root domain; whether more
    // configuration follows is not this assertion's business.
    assert.match(proxySource, /resolveStorefrontHost\(\s*host,\s*process\.env\.NEXT_PUBLIC_STORE_ROOT_DOMAIN\b/);
    assert.match(proxySource, /destination\.pathname = `\/store\/\$\{subdomain\}\$\{destination\.pathname\}`/);
    assert.match(proxySource, /NextResponse\.rewrite\(destination,\s*\{ request:\s*\{ headers:\s*requestHeaders \} \}\)/);
});
