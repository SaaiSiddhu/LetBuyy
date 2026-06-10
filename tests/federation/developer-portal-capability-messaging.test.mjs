import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

const reference = read('apps/developer-portal/src/lib/reference.ts');
const homePage = read('apps/developer-portal/src/app/page.tsx');
const sdkPage = read('apps/developer-portal/src/app/sdk/page.tsx');
const appEngine = read('packages/shared-types/src/app-platform.ts');
const themeRenderer = read('packages/theme-engine/src/theme-renderer.ts');
const storefrontGraphQL = read('services/api-gateway/src/graphql/storefront.ts');
const ws12Ledger = read('docs/archive/root-residue/2026-06-06-foundation-v2/CODEX_WS12_LEDGER.md');
const masterLedger = read('docs/archive/root-residue/2026-06-06-foundation-v2/CODEX_MASTER_EXECUTION_LEDGER.md');
const ctoReport = read('docs/LETBUYY_CTO_WAR_ROOM_REPORT.md');
const deepAuditReport = read('docs/LETBUYY_DEEP_AUDIT_REPORT.md');

test('developer portal states Liquid plus JSON theme capability from shipped source', () => {
  assert.match(themeRenderer, /import \{ Liquid \} from 'liquidjs'/);
  assert.match(themeRenderer, /export class LiquidRenderer/);
  assert.match(themeRenderer, /status: 'rendered'/);

  for (const marker of [
    'JSON-contract package upload',
    'LiquidJS-backed renderer',
    'renderer.engine = liquid',
    'home, product, collection, page, cart, and blog templates',
    'Merchant editor drafts are scoped by `template_key`',
  ]) {
    assert.ok(reference.includes(marker), `developer reference is missing ${marker}`);
  }

  assert.ok(homePage.includes('Liquid plus JSON-contract themes'));
  assert.ok(sdkPage.includes('LiquidJS rendering support'));
  assert.ok(sdkPage.includes('Liquid or JSON sections'));
});

test('developer portal limits checkout functions to advisory operations', () => {
  for (const marker of [
    'apply_discount_code',
    'select_shipping_method',
    'allow_payment_methods',
    'validation_error',
  ]) {
    assert.ok(appEngine.includes(marker), `shared app-platform is missing ${marker}`);
  }

  assert.ok(reference.includes('Checkout Functions are advisory only'));
  assert.ok(reference.includes('they cannot set arbitrary totals, taxes, line prices, or payment amounts'));
  assert.ok(sdkPage.includes('Checkout Functions can advise coupons, shipping, payment method availability, and validation only'));
  assert.doesNotMatch(reference, /can set arbitrary totals/i);
  assert.doesNotMatch(reference, /can mutate checkout totals/i);
  assert.doesNotMatch(reference, /can override payment amounts/i);
});

test('GraphQL cart messaging points to the persisted cart-token contract', () => {
  assert.match(storefrontGraphQL, /cartTokenFromVariables/);
  assert.match(storefrontGraphQL, /\/cart\/\$\{encodeURIComponent\(cartToken\)\}/);
  assert.doesNotMatch(storefrontGraphQL, /CART_NOT_SUPPORTED/);
  assert.doesNotMatch(storefrontGraphQL, /data\.cart\s*=\s*null/);

  for (const marker of [
    'StorefrontQuery.cart -> persisted cart token',
    'GET|POST|PATCH|DELETE /v1/storefront/:subdomain/cart',
  ]) {
    assert.ok(reference.includes(marker), `developer reference is missing ${marker}`);
  }

  assert.ok(homePage.includes('persisted cart token'));
  assert.doesNotMatch(ws12Ledger, /returns `cart: null`/);
  assert.doesNotMatch(masterLedger, /returns `cart: null`/);
});

test('current audit docs no longer claim Liquid is unsupported', () => {
  assert.doesNotMatch(ctoReport, /unsupported Liquid renderer/i);
  assert.doesNotMatch(deepAuditReport, /Liquid unsupported/i);
  assert.ok(ctoReport.includes('LiquidJS renderer is implemented'));
  assert.ok(deepAuditReport.includes('implemented LiquidJS rendering'));
});
