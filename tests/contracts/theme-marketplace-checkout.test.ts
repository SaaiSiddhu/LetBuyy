import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const checkoutPagePath = join(testDir, '../../apps/theme-marketplace/src/app/checkout/page.tsx');
const themeRoutePath = join(testDir, '../../apps/theme-marketplace/src/app/api/themes/[slug]/route.ts');
const themeServicePath = join(testDir, '../../apps/theme-marketplace/src/lib/theme-service.ts');
const apiClientPath = join(testDir, '../../packages/typescript/api-client/src/index.ts');
const gatewayThemesRoutePath = join(testDir, '../../services/api-gateway/src/routes/themes.ts');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('theme marketplace checkout no longer links directly to fake success', () => {
    const source = read(checkoutPagePath);

    assert.doesNotMatch(source, /href=\{`\/checkout\/success\?theme=\$\{theme\.slug\}`\}/);
    assert.doesNotMatch(source, /<Link[\s\S]*Pay \{formatPrice\(theme\.letbuyy_price_usd\)\}/);
    assert.match(source, /async function handlePurchase/);
    assert.match(source, /fetch\(`\/api\/themes\/\$\{theme\.slug\}`/);
    assert.match(source, /action: 'purchase'/);
    assert.match(source, /action: 'verify_purchase'/);
    assert.match(source, /loadRazorpayCheckout/);
    assert.match(source, /window\.Razorpay/);
    assert.match(source, /router\.push\(`\/checkout\/success\?theme=\$\{theme\.slug\}&purchase=/);
});

test('theme marketplace checkout uses the working local payment default and has no dead coupon control', () => {
    const source = read(checkoutPagePath);

    assert.match(source, /PAYMENT_UNAVAILABLE/);
    assert.match(source, /Theme checkout is unavailable/);
    assert.match(source, /local mock provider in development/);
    assert.doesNotMatch(source, /function handleApplyCoupon/);
    assert.doesNotMatch(source, /Theme coupons are not configured/);
    assert.match(source, /paymentMethod\] = useState<'razorpay'>\('razorpay'\)/);
    assert.doesNotMatch(source, /setPaymentMethod\('stripe'\)/);
});

test('theme marketplace API routes proxy purchase and verification to the gateway client', () => {
    const themeRoute = read(themeRoutePath);
    const themeService = read(themeServicePath);
    const apiClient = read(apiClientPath);

    assert.match(apiClient, /purchase: \(slug: string, input: ThemePurchaseOrderInput/);
    assert.match(apiClient, /verifyPurchase: \(slug: string, input: ThemePurchaseVerifyInput/);
    assert.match(apiClient, /`\/themes\/\$\{encodePathSegment\(slug\)\}\/purchase`/);
    assert.match(apiClient, /`\/themes\/\$\{encodePathSegment\(slug\)\}\/purchase\/verify`/);

    assert.match(themeRoute, /export async function POST/);
    assert.match(themeRoute, /body\.action === 'purchase'/);
    assert.match(themeRoute, /ThemeService\.createThemePurchase\(slug/);
    assert.match(themeRoute, /body\.action === 'verify_purchase'/);
    assert.match(themeRoute, /ThemeService\.verifyThemePurchase\(slug/);
    assert.match(themeRoute, /provider_proof/);
    assert.doesNotMatch(themeRoute, /razorpay_signature/);
    assert.match(themeRoute, /LetbuyyApiError/);

    assert.match(themeService, /createThemeMarketplaceApiClient\(\{ requireSession \}\)/);
    assert.match(themeService, /createThemePurchase\(slug: string, input: ThemePurchaseOrderInput/);
    assert.match(themeService, /api\.themes\.purchase\(slug, input\)/);
    assert.match(themeService, /verifyThemePurchase\(slug: string, input: unknown/);
    assert.match(themeService, /api\.themes\.verifyPurchase\(slug, input as ThemePurchaseVerifyInput\)/);
    assert.doesNotMatch(themeService, /razorpay_signature/);
});

test('gateway theme purchase remains server-priced and provider-proof based', () => {
    const source = read(gatewayThemesRoutePath);

    assert.match(source, /amountPaise = Math\.round\(priceInr \* 100\)/);
    assert.match(source, /if \(!c\.env\.RAZORPAY_KEY_ID \|\| !c\.env\.RAZORPAY_KEY_SECRET\)/);
    assert.match(source, /PAYMENT_UNAVAILABLE/);
    assert.match(source, /createRazorpayOrder/);
    assert.match(source, /timingSafeEqualHex\(expected, body\.razorpay_signature\)/);
    assert.match(source, /eventType: 'theme\.purchase\.completed'/);
});
