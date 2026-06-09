import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productsSource = readFileSync(new URL('../routes/products.ts', import.meta.url), 'utf8');
const ordersSource = readFileSync(new URL('../routes/orders.ts', import.meta.url), 'utf8');
const appStoreSource = readFileSync(new URL('../routes/app-store.ts', import.meta.url), 'utf8');
const rateLimitSource = readFileSync(new URL('../middleware/rateLimit.ts', import.meta.url), 'utf8');

test('merchant product and order list reads retry without missing optional columns', () => {
    assert.match(productsSource, /function missingColumnFromError/);
    assert.match(productsSource, /const omittedColumns = new Set<string>\(\)/);
    assert.match(productsSource, /PRODUCT_LIST_COLUMN_NAMES\.includes\(missingColumn/);
    assert.match(productsSource, /omittedColumns\.add\(missingColumn\)/);

    assert.match(ordersSource, /function missingColumnFromError/);
    assert.match(ordersSource, /const omittedColumns = new Set<string>\(\)/);
    assert.match(ordersSource, /ORDER_LIST_COLUMN_NAMES\.includes\(missingColumn/);
    assert.match(ordersSource, /omittedColumns\.add\(missingColumn\)/);
});

test('public app-store discovery retries without missing migrated columns and relations', () => {
    assert.match(appStoreSource, /APP_CATEGORY_COLUMN_NAMES/);
    assert.match(appStoreSource, /missingColumnFromError\(result\.error\)/);
    assert.match(appStoreSource, /isMissingAppPricingPlansRelation/);
    assert.match(appStoreSource, /appPublicSelect\(\{\s*includePricingPlans,\s*includeCategoryGroupName\s*\}/);
    assert.match(appStoreSource, /appListFallbacks\.pricingPlans = true/);
    assert.match(appStoreSource, /appListFallbacks\.categoryGroupName = true/);
    assert.match(appStoreSource, /appListFallbacks\.builtForLetbuyy = true/);
    assert.match(appStoreSource, /appListFallbacks\.supportedSiteTypes = true/);
});

test('query-cost KV failures are short-circuited and throttled after quota exhaustion', () => {
    assert.match(rateLimitSource, /let queryCostKvUnavailableUntil = 0/);
    assert.match(rateLimitSource, /queryCostKvBackoffMs/);
    assert.match(rateLimitSource, /message\.includes\('limit exceeded'\)/);
    assert.match(rateLimitSource, /now < queryCostKvUnavailableUntil/);
    assert.match(rateLimitSource, /lastQueryCostKvUnavailableLogAt/);
    assert.match(rateLimitSource, /suppressed_until/);
    assert.match(rateLimitSource, /const useKvFallback = Boolean\(env\.CACHE\) && \(isProduction \|\| kvRateLimitFallbackEnabled\(env\)\)/);
    assert.match(rateLimitSource, /query-cost checks only use KV when explicitly enabled/);
    assert.match(rateLimitSource, /query-cost checks write on every request/);
    assert.match(rateLimitSource, /const useKvFallback = Boolean\(env\.CACHE\) && kvRateLimitFallbackEnabled\(env\)/);
});
