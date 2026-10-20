import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productsSource = readFileSync(new URL('../routes/products.ts', import.meta.url), 'utf8');
const ordersSource = readFileSync(new URL('../routes/orders.ts', import.meta.url), 'utf8');
const appStoreSource = readFileSync(new URL('../routes/app-store.ts', import.meta.url), 'utf8');
const rateLimitSource = readFileSync(new URL('../middleware/rateLimit.ts', import.meta.url), 'utf8');
const orderReadCompatSource = readFileSync(new URL('../lib/order-read-compat.ts', import.meta.url), 'utf8');

test('merchant product and order list reads retry without missing optional columns', () => {
    assert.match(productsSource, /function missingColumnFromError/);
    assert.match(productsSource, /const omittedColumns = new Set<string>\(\)/);
    assert.match(productsSource, /PRODUCT_LIST_COLUMN_NAMES\.includes\(missingColumn/);
    assert.match(productsSource, /omittedColumns\.add\(missingColumn\)/);

    // The order-side helper lives in lib/order-read-compat.ts since F-ROUTELEN-1. Assert the whole
    // chain rather than the substring that used to be here: the function is defined in the module,
    // AND the route imports it from that module — so moving it again without updating the route
    // fails here, which a bare `/function missingColumnFromError/` on either file would not.
    assert.match(orderReadCompatSource, /export function missingColumnFromError/);
    assert.match(ordersSource, /missingColumnFromError,[\s\S]*?\} from '\.\.\/lib\/order-read-compat'/);
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

test('query-cost selection has no unsafe KV counter or global failure cooldown', () => {
    // Structural guard only; owned native Worker tests prove atomic admission.
    assert.doesNotMatch(rateLimitSource, /async function checkKvQueryCostLimit/);
    assert.doesNotMatch(rateLimitSource, /queryCostKvUnavailableUntil/);
    assert.match(rateLimitSource, /env.RUNTIME_COORDINATOR/);
    assert.doesNotMatch(rateLimitSource, /warnRateLimitFailOpen\('query_cost_no_backend'\)/);
});
