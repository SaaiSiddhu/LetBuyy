import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const customerRoutesPath = join(repoRoot, 'services/api-gateway/src/routes/storefront/customer-engagement-routes.ts');
const rateLimitPath = join(repoRoot, 'services/api-gateway/src/middleware/rateLimit.ts');
const storefrontLoginApiPath = join(repoRoot, 'apps/commerce/web/src/app/api/customer/login/route.ts');
const customerAuthContextPath = join(repoRoot, 'apps/commerce/web/src/context/customer-auth-context.tsx');
const accountSheetPath = join(repoRoot, 'apps/commerce/web/src/components/account/account-bottom-sheet.tsx');
const internalPaymentContractPath = join(repoRoot, 'tests/contracts/storefront-internal-payment-routes.test.ts');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('gateway customer login rate limits before Turnstile and database password work', () => {
    const source = read(customerRoutesPath);
    const routeStart = source.indexOf("router.post('/customer/login'");
    assert.notEqual(routeStart, -1, 'customer login route must exist');
    const routeEnd = source.indexOf("router.post('/customer/login-success'", routeStart);
    const block = source.slice(routeStart, routeEnd === -1 ? undefined : routeEnd);

    const rateLimitIndex = block.indexOf('enforceCustomerAuthRateLimit(c,');
    const turnstileIndex = block.indexOf('requireValidTurnstile(c, body)');
    const dbIndex = block.indexOf('const db = getSupabaseAdmin(c)');
    const compareIndex = block.indexOf('bcrypt.compare(body.password');

    assert.notEqual(rateLimitIndex, -1);
    assert.notEqual(turnstileIndex, -1);
    assert.notEqual(dbIndex, -1);
    assert.notEqual(compareIndex, -1);
    assert.ok(rateLimitIndex < turnstileIndex, 'rate limit must run before Turnstile provider work');
    assert.ok(turnstileIndex < dbIndex, 'Turnstile must run before DB password lookup');
    assert.ok(dbIndex < compareIndex, 'password compare must happen after protected lookup');
    assert.match(block, /operation:\s*'customer-login'/);
    assert.match(block, /storeId:\s*body\.store_id/);
    assert.match(block, /email:\s*body\.email/);
});

test('customer auth rate limits fail closed in any production runtime flag', () => {
    const source = read(rateLimitPath);

    assert.match(source, /function isProductionRuntime/);
    assert.match(source, /'ENVIRONMENT' \| 'APP_ENV' \| 'NODE_ENV'/);
    assert.doesNotMatch(source, /env\.ENVIRONMENT === 'production'/);
    assert.match(source, /if \(result\.unavailable && isProductionRuntime\(c\.env\)\)/);
    assert.match(source, /const isProduction = isProductionRuntime\(env\)/);
});

test('storefront web login forwards Turnstile and preserves gateway abuse-control failures', () => {
    const route = read(storefrontLoginApiPath);
    const context = read(customerAuthContextPath);
    const sheet = read(accountSheetPath);

    assert.match(route, /turnstile_token:\s*turnstileToken/);
    assert.match(route, /LetbuyyApiError/);
    assert.match(route, /error\.status === 403 \|\| error\.status === 429 \|\| error\.status === 503/);
    assert.match(route, /CUSTOMER_AUTH_RATE_LIMITED|TURNSTILE_REQUIRED/);
    assert.match(context, /body:\s*JSON\.stringify\(\{ email, password, storeId: sid, turnstileToken \}\)/);
    assert.match(sheet, /<TurnstileWidget ref=\{turnstileRef\} onVerify=\{setTurnstileToken\}/);
    assert.match(sheet, /login\(email, password, storeId, turnstileToken\)/);
});

test('storefront internal endpoint fail-closed coverage remains active with login hardening', () => {
    const source = read(internalPaymentContractPath);

    assert.match(source, /name: 'staging'/);
    assert.match(source, /name: 'production'/);
    assert.match(source, /isInternalApiSecretRequest\(environment\.env/);
    assert.match(source, /configured shared secret/);
});
