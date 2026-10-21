import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const cartRoutesPath = join(testDir, '../../services/api-gateway/src/routes/storefront/cart-routes.ts');
const publicRoutesSource = readFileSync(join(testDir, '../../services/api-gateway/src/routes/storefront/public-routes.ts'), 'utf8');
const graphqlSource = readFileSync(join(testDir, '../../services/api-gateway/src/graphql/storefront.ts'), 'utf8');
const cartContextSource = readFileSync(join(testDir, '../../apps/commerce/web/src/context/cart-context.tsx'), 'utf8');
const liquidIslandsSource = readFileSync(join(testDir, '../../apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx'), 'utf8');
const developerReferenceSource = readFileSync(join(testDir, '../../apps/frozen/developer-portal/src/lib/reference.ts'), 'utf8');

function cartRoutesSource(): string {
    assert.equal(existsSync(cartRoutesPath), true, 'cart-routes.ts must exist under the storefront gateway route modules');
    return readFileSync(cartRoutesPath, 'utf8');
}

test('gateway owns server-side storefront cart persistence with opaque cart tokens', () => {
    const source = cartRoutesSource();

    assert.match(source, /export function registerStorefrontCartRoutes/);
    assert.match(source, /router\.post\('\/:subdomain\/cart'/);
    assert.match(source, /router\.get\('\/:subdomain\/cart\/:cartToken'/);
    assert.match(source, /router\.patch\('\/:subdomain\/cart\/:cartToken'/);
    assert.match(source, /router\.delete\('\/:subdomain\/cart\/:cartToken'/);
    assert.match(source, /\.from\('carts'\)/);
    assert.match(source, /session_id: cartToken/);
    assert.match(source, /queryPublicProducts\(c, store\.id, \{[\s\S]*ids: productIds/);
    assert.match(source, /line_total: unitPrice \* line\.quantity/);
    assert.match(publicRoutesSource, /import \{ registerStorefrontCartRoutes \} from '\.\/cart-routes'/);
    assert.match(publicRoutesSource, /registerStorefrontCartRoutes\(router, \{/);
});

test('storefront GraphQL cart reads delegate to the persisted cart REST endpoint', () => {
    assert.doesNotMatch(graphqlSource, /CART_NOT_SUPPORTED/);
    assert.match(graphqlSource, /cartTokenFromVariables/);
    assert.match(graphqlSource, /data\.cart = \(await restGet\(c, delegate, `\/storefront\/\$\{encodeURIComponent\(handle\)\}\/cart\/\$\{encodeURIComponent\(cartToken\)\}`/);
    assert.doesNotMatch(graphqlSource, /data\.cart\s*=\s*null/);
});

test('storefront React cart uses server cart as source of truth and localStorage only as synced cache', () => {
    assert.match(cartContextSource, /CART_TOKEN_STORAGE_KEY = 'lb_cart_token'/);
    assert.match(cartContextSource, /const reconciliation = reconcileStoredCart\(subdomain\)/);
    assert.match(cartContextSource, /const currentToken = window\.localStorage\.getItem\(CART_TOKEN_STORAGE_KEY\)/);
    assert.match(cartContextSource, /storefrontBrowserApiFetch\(subdomain, currentToken \? `\/cart\/\$\{currentToken\}` : '\/cart'/);
    assert.match(cartContextSource, /serverCartToItems/);
    assert.match(cartContextSource, /cartLineInputFromItem/);
    assert.match(cartContextSource, /localStorage\.setItem\(CART_TOKEN_STORAGE_KEY, serverCart\.cart_token\)/);
    assert.match(cartContextSource, /localStorage\.setItem\(CART_STORAGE_KEY, JSON\.stringify\(items\)\)/);
});

test('Liquid hydration islands sync add-to-cart through the same server cart API', () => {
    assert.match(liquidIslandsSource, /CART_TOKEN_STORAGE_KEY = 'lb_cart_token'/);
    assert.match(liquidIslandsSource, /syncLiquidCartToServer/);
    assert.match(liquidIslandsSource, /storefrontBrowserCartFetch/);
    assert.match(liquidIslandsSource, /writeCart\(items, \{ sync: true \}\)/);
});

test('developer docs describe the active server cart contract instead of CART_NOT_SUPPORTED', () => {
    assert.doesNotMatch(developerReferenceSource, /CART_NOT_SUPPORTED/);
    assert.match(developerReferenceSource, /StorefrontQuery\.cart -> persisted cart token/);
    assert.match(developerReferenceSource, /GET\|POST\|PATCH\|DELETE \/v1\/storefront\/:subdomain\/cart/);
});
