import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(testDir, '../../../..', path), 'utf8');
}

test('foundation tenant kernel exposes fail-closed site GUC and query predicate guards', () => {
    const tenantSource = source('lib/tenant-context.ts');
    const tenantCoreSource = repositorySource('packages/tenant-core/src/index.ts');

    assert.match(tenantCoreSource, /export const TENANT_SITE_GUC = 'app\.site_id'/);
    assert.match(tenantCoreSource, /tenantGucSetLocalStatement/);
    assert.match(tenantCoreSource, /requireSiteIdPredicate/);
    assert.match(tenantCoreSource, /site_id = public\.current_site_id\(\)/);
    assert.match(tenantSource, /export \{ TENANT_SITE_GUC \}/);
    assert.match(tenantSource, /export function tenantSetLocalStatement/);
    assert.match(tenantSource, /export function assertTenantScopedQuery/);
});

test('products are isolated by owned store for read, update, and delete paths', () => {
    const routeSource = source('routes/products.ts');
    const adapterSource = source('execution/product-execution.adapter.ts');

    assert.match(routeSource, /\.in\('store_id',\s*ownedStoreIds\)/);
    assert.match(routeSource, /verifyStoreOwnership\(db,\s*query\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('products'\)\s*[\s\S]*\.eq\('id',\s*productId\)/);
    // Phase 2 / F2.5: owner passes via verifyStoreOwnership on the product's own store_id; a
    // non-owner falls through to assertStaffPermission on that same store_id.
    assert.match(routeSource, /const storeId = String\(product\.store_id\)/);
    assert.match(routeSource, /verifyStoreOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /assertStaffPermission\(c,\s*storeId,\s*customUser\.id,\s*'products:read'\)/);
    assert.match(routeSource, /service\.updateProduct\(productId,\s*customUser\.id,\s*body as Record<string, unknown>,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /service\.softDelete\(productId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(adapterSource, /private async getOwnedProduct/);
    // APPID-FIX2: the lookup itself now carries the store predicate (resolveOwnedStoreIds ->
    // .in('store_id', storeIds)) instead of fetching the row unscoped and checking ownership after --
    // the unscoped shape is refused outright by the tenant query guard, not merely "not proven isolated".
    assert.match(adapterSource, /resolveOwnedStoreIds\(userId,\s*sessionStoreId\)/);
    assert.match(adapterSource, /\.eq\('id',\s*productId\)\s*\.in\('store_id',\s*storeIds\)/);
});

test('orders are isolated by owned store before listing, reading, and mutating', () => {
    const routeSource = source('routes/orders.ts');
    const tenantSource = source('lib/tenant-context.ts');

    assert.match(routeSource, /\.in\('store_id',\s*ownedStoreIds\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*query\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('orders'\)\s*[\s\S]*\.eq\('id',\s*orderId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*order\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /const tenant = await resolveTenantContextForOrder\(c,\s*orderId\)/);
    assert.match(routeSource, /const tenant = await resolveTenantContextForOwnedSite\(c,\s*body\.store_id\)/);
    assert.match(tenantSource, /export async function resolveTenantContextForOrder/);
    assert.match(tenantSource, /\.from\('orders'\)\s*[\s\S]*\.select\('id, store_id'\)\s*[\s\S]*\.eq\('id',\s*orderId\)/);
    assert.match(tenantSource, /return resolveTenantContextForOwnedSite\(c,\s*order\.store_id as string\)/);
    assert.match(tenantSource, /verifySiteOwnership\(db,\s*siteId,\s*customUser\.id,\s*authUser\.storeId\)/);
});

test('customers require owned store scope before exposing profiles, orders, or addresses', () => {
    const routeSource = source('routes/customers.ts');
    const tenantSource = source('lib/tenant-context.ts');

    assert.match(tenantSource, /export interface OwnedStoreScope/);
    assert.match(tenantSource, /export async function resolveOwnedStoreScope/);
    assert.match(tenantSource, /verifySiteOwnership\(db,\s*siteId,\s*customUser\.id,\s*authUser\.storeId\)/);
    assert.match(routeSource, /import \{ resolveOwnedStoreScope \} from '\.\.\/lib\/tenant-context'/);
    assert.match(routeSource, /async function hasOwnedStoreScope\(c: CustomerRouteContext,\s*storeId: string\)/);
    assert.match(routeSource, /await resolveOwnedStoreScope\(c,\s*storeId\)/);
    assert.doesNotMatch(routeSource, /async function verifyStoreOwnership/);
    assert.match(routeSource, /if \(!\(await hasOwnedStoreScope\(c,\s*storeId\)\)\)/);
    assert.match(routeSource, /if \(!\(await hasOwnedStoreScope\(c,\s*q\.store_id\)\)\)/);
    assert.match(routeSource, /if \(!\(await hasOwnedStoreScope\(c,\s*body\.store_id\)\)\)/);
    assert.match(routeSource, /if \(!\(await hasOwnedStoreScope\(c,\s*existingSegment\.store_id\)\)\)/);
    assert.match(routeSource, /router\.post\('\/',\s*validate\('json',\s*CreateCustomerSchema\)/);
    assert.match(routeSource, /\.from\('store_customers'\)\.insert\(\{\s*store_id:\s*body\.store_id,\s*\.\.\.payload\s*\}\)/);
    assert.match(routeSource, /replaceCustomerTags\(db,\s*body\.store_id,\s*email,\s*tags,\s*actorId\)/);
    assert.match(routeSource, /\.from\('orders'\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)\s*[\s\S]*\.eq\('customer_email',\s*email\)/);
    assert.match(routeSource, /\.from\('customer_addresses'\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)\s*[\s\S]*\.eq\('customer_email',\s*email\)/);
    assert.match(routeSource, /\.from\('customer_addresses'\)\s*[\s\S]*\.select\('store_id'\)\s*[\s\S]*\.eq\('id',\s*addressId\)\s*[\s\S]*\.eq\('customer_email',\s*email\)/);
    assert.match(routeSource, /hasOwnedStoreScope\(c,\s*ownedAddress\.store_id\)/);
    assert.match(routeSource, /router\.get\('\/:email\/data-export'/);
    assert.match(routeSource, /\.from\('customer_credentials'\)\s*[\s\S]*\.select\('id,email_or_phone,last_login_at,login_count,created_at,updated_at'\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)\s*[\s\S]*\.eq\('email_or_phone',\s*email\)/);
    assert.doesNotMatch(routeSource, /data-export[\s\S]{0,2600}password_hash/);
    assert.match(routeSource, /\.from\('customer_credentials'\)\s*[\s\S]*\.delete\(\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)\s*[\s\S]*\.eq\('email_or_phone',\s*customer\.email\.toLowerCase\(\)\)/);
    assert.match(routeSource, /\.from\('orders'\)\s*[\s\S]*\.update\(\{[\s\S]*customer_email:\s*redactedEmail[\s\S]*customer_phone:\s*null[\s\S]*\}\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)\s*[\s\S]*\.eq\('customer_email',\s*customer\.email\)/);
    assert.match(routeSource, /router\.patch\('\/:email'/);
    assert.match(routeSource, /router\.get\('\/:email\/notes'/);
    assert.match(routeSource, /router\.put\('\/:email\/tags'/);
    assert.match(routeSource, /router\.post\('\/:email\/email'/);
    assert.match(routeSource, /router\.post\('\/:email\/merge'/);
    assert.match(routeSource, /router\.get\('\/segments'/);
    assert.match(routeSource, /router\.post\('\/segments'/);
    assert.match(routeSource, /router\.post\('\/segments\/preview'/);
    assert.match(routeSource, /router\.get\('\/segments\/:id\/customers'/);
    assert.match(routeSource, /\.from\('customer_segments'\)\s*[\s\S]*\.eq\('store_id',\s*q\.store_id\)/);
    assert.match(routeSource, /\.from\('customer_segments'\)\s*[\s\S]*\.insert\(\{[\s\S]*store_id:\s*body\.store_id/);
    assert.match(routeSource, /\.from\('customer_segments'\)\s*[\s\S]*\.eq\('id',\s*id\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)/);
    assert.match(routeSource, /\.from\('customer_notes'\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)\s*[\s\S]*\.eq\('customer_email',\s*email\)/);
    assert.match(routeSource, /\.from\('customer_tags'\)\s*[\s\S]*\.eq\('store_id',\s*body\.store_id\)\s*[\s\S]*\.eq\('customer_email',\s*email\)/);
    assert.match(routeSource, /\.from\('orders'\)\.update\(\{\s*customer_email:\s*targetEmail\s*\}\)\.eq\('store_id',\s*body\.store_id\)\.eq\('customer_email',\s*sourceEmail\)/);
    assert.match(routeSource, /\.from\('store_customers'\)\s*[\s\S]*\.update\(\{[\s\S]*email:\s*redactedSourceEmail[\s\S]*status:\s*'disabled'[\s\S]*deleted_at:\s*now/);
    assert.match(routeSource, /sendResendEmail/);
});

test('coupons are isolated by owned store for CRUD and validation', () => {
    const routeSource = source('routes/coupons.ts');

    assert.match(routeSource, /\.in\('store_id',\s*ownedStoreIds\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*query\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('coupons'\)\s*[\s\S]*\.select\('\*'\)\s*[\s\S]*\.eq\('id',\s*couponId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*data\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.select\('id, store_id'\)\s*[\s\S]*\.eq\('id',\s*couponId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedCoupon\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /if \(!customUser \|\| !\(await verifySiteOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)\)\)/);
    assert.match(routeSource, /\.from\('coupons'\)\s*[\s\S]*\.eq\('store_id',\s*body\.store_id\)\s*[\s\S]*\.eq\('code',\s*body\.code\.toUpperCase\(\)\)/);
    assert.match(routeSource, /pricing_authority:\s*plan\.pricingAuthority/);
});

test('categories are isolated by owned store for tree reads and mutations', () => {
    const routeSource = source('routes/categories.ts');

    assert.match(routeSource, /\.in\('store_id',\s*ownedStoreIds\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('product_categories'\)\s*[\s\S]*\.eq\('id',\s*categoryId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*data\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.select\('id, store_id'\)\s*[\s\S]*\.eq\('id',\s*categoryId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedCategory\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
});

test('media metadata reads, updates, and deletes require owned store access', () => {
    const routeSource = source('routes/media.ts');

    assert.match(routeSource, /if \(!storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('media'\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('media'\)\s*[\s\S]*\.select\('store_id'\)\s*[\s\S]*\.eq\('id',\s*mediaId\)/);
    assert.match(routeSource, /\.from\('media'\)\s*[\s\S]*\.select\('store_id, url'\)\s*[\s\S]*\.eq\('id',\s*mediaId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedMedia\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
});

test('pages, policies, and navigation require owned store checks before content changes', () => {
    const routeSource = source('routes/pages.ts');

    assert.match(routeSource, /async function requireOwnedStore/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /const ownership = await requireOwnedStore\(c,\s*query\.store_id\)/);
    assert.match(routeSource, /const ownership = await requireOwnedStore\(c,\s*body\.store_id\)/);
    assert.match(routeSource, /\.from\('storefront_pages'\)\s*[\s\S]*\.eq\('id',\s*pageId\)\s*[\s\S]*\.is\('deleted_at',\s*null\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedPage\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('navigation_menu_items'\)\s*[\s\S]*\.eq\('store_id',\s*ownedPage\.store_id\)\s*[\s\S]*\.eq\('target_resource_id',\s*pageId\)/);
    assert.match(routeSource, /\.from\('storefront_policies'\)\s*[\s\S]*\.select\('id,store_id,policy_type,slug,title,body,status,seo,published_at,updated_at'\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*policy\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
});

test('the requireOwnedSite ownership gate has one canonical definition per shape, not one per route file', () => {
    const customDomainsSource = source('routes/custom-domains.ts');
    const domainsSource = source('routes/domains.ts');
    const growthRoutesSource = source('routes/app-store/growth-routes.ts');
    const tenantSource = source('lib/tenant-context.ts');

    for (const routeSource of [customDomainsSource, domainsSource, growthRoutesSource]) {
        assert.doesNotMatch(routeSource, /async function requireOwnedSite/);
    }

    assert.match(customDomainsSource, /import \{ requireOwnedSite \} from '\.\.\/lib\/tenant-context'/);
    assert.match(domainsSource, /import \{ requireOwnedSite \} from '\.\.\/lib\/tenant-context'/);
    assert.match(growthRoutesSource, /import \{ requireOwnedSiteOrError \} from '\.\.\/\.\.\/lib\/tenant-context'/);

    assert.match(tenantSource, /export async function requireOwnedSite\(c: AppContext,\s*siteId: string\)/);
    assert.match(tenantSource, /export async function requireOwnedSiteOrError\(c: AppContext,\s*requestedSiteId\?: string \| null\)/);

    // custom-domains.ts / domains.ts shape: customer-missing and not-owner fold into one 404, never split.
    assert.match(tenantSource, /code: 'STORE_NOT_FOUND', message: 'Store not found or access denied' \} \}, 404\)/);
    // growth-routes.ts shape: distinct 403 FORBIDDEN / 400 VALIDATION branches, plus the site_id fallback.
    assert.match(tenantSource, /code: 'FORBIDDEN', message: 'User profile not found' \}/);
    assert.match(tenantSource, /code: 'VALIDATION', message: 'site_id is required' \}/);
    assert.match(tenantSource, /code: 'FORBIDDEN', message: 'Not authorized for this store' \}/);
    assert.match(tenantSource, /stringOrNull\(requestedSiteId\) \|\| stringOrNull\(auth\.user\.storeId\)/);
});

test('theme editor instances, drafts, releases, and installs are isolated by owned store', () => {
    const routeSource = source('routes/themes.ts');
    const adapterSource = source('execution/theme-execution.adapter.ts');

    assert.match(routeSource, /service\.verifyStoreOwner\(queryResult\.data\.store_id,\s*customUser\.id\)/);
    assert.match(routeSource, /service\.loadEditor\(slug,\s*parsed\.data\.store_id,\s*customUser\.id,\s*parsed\.data\.template_key\)/);
    assert.match(routeSource, /service\.saveDraft\(slug,\s*body,\s*customUser\.id,\s*getRequestId\(c\)\)/);
    assert.match(routeSource, /service\.deleteDraft\(slug,\s*parsed\.data\.store_id,\s*customUser\.id,\s*getRequestId\(c\),\s*parsed\.data\.template_key\)/);
    assert.match(routeSource, /service\.publish\(slug,\s*body,\s*customUser\.id,\s*getRequestId\(c\)\)/);
    assert.match(routeSource, /service\.rollbackRelease\(slug,\s*releaseId,\s*body,\s*customUser\.id,\s*getRequestId\(c\)\)/);
    assert.match(adapterSource, /async verifyStoreOwner\(storeId: string,\s*userId: string\)/);
    assert.match(adapterSource, /\.from\('sites'\)\s*[\s\S]*\.eq\('id',\s*storeId\)\s*[\s\S]*\.or\(`custom_user_id\.eq\.\$\{userId\},user_id\.eq\.\$\{userId\}`\)/);
    assert.match(adapterSource, /throw new ForbiddenError\('Store not found or not owned by this user'\)/);
    assert.match(adapterSource, /await this\.verifyStoreOwner\(input\.store_id,\s*userId\)/);
    assert.match(adapterSource, /await this\.verifyStoreOwner\(storeId,\s*userId\)/);
    assert.match(adapterSource, /\.from\('theme_releases'\)\s*[\s\S]*\.eq\('id',\s*releaseId\)\s*[\s\S]*\.eq\('store_id',\s*input\.store_id\)/);
});
