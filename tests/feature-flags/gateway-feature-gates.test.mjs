import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const gatewayIndex = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const featureFlags = readFileSync('services/api-gateway/src/middleware/featureFlags.ts', 'utf8');
const storefrontRoute = readStorefrontRouteSource();
const wrangler = readFileSync('services/api-gateway/wrangler.toml', 'utf8');

test('gateway feature flags fail closed in production by default', () => {
  assert.match(featureFlags, /export type GatewayFeatureFlag = 'FEATURE_GRAPHQL' \| 'FEATURE_EXTENSIONS' \| 'FEATURE_LIQUID'/);
  assert.match(featureFlags, /return !isProductionRuntime\(env\)/);
  assert.match(wrangler, /\[env\.production\.vars\][\s\S]*FEATURE_GRAPHQL = "false"/);
  assert.match(wrangler, /\[env\.production\.vars\][\s\S]*FEATURE_EXTENSIONS = "false"/);
  assert.match(wrangler, /\[env\.production\.vars\][\s\S]*FEATURE_LIQUID = "false"/);
});

test('GraphQL and extension routes are mounted behind gateway feature gates', () => {
  for (const fragment of [
    "const graphQLFeatureGate = featureGate(",
    "const extensionsFeatureGate = featureGate(",
    "api.use('/storefront/graphql', graphQLFeatureGate)",
    "api.use('/graphql/storefront', graphQLFeatureGate)",
    "api.use('/admin/graphql', graphQLFeatureGate)",
    "api.use('/graphql/admin', graphQLFeatureGate)",
    "api.use('/storefront/:subdomain/checkout/extensions', extensionsFeatureGate)",
    "api.use('/app-store/installations/:id/extensions', extensionsFeatureGate)",
    "api.use('/app-store/installations/:id/extensions/:registrationId', extensionsFeatureGate)",
  ]) {
    assert.match(gatewayIndex, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.ok(
    gatewayIndex.indexOf("api.use('/storefront/graphql', graphQLFeatureGate)") <
      gatewayIndex.indexOf("api.route('/storefront/graphql', storefrontGraphQLRouter)"),
    'storefront GraphQL gate must run before the route',
  );
  assert.ok(
    gatewayIndex.indexOf("api.use('/admin/graphql', graphQLFeatureGate)") <
      gatewayIndex.indexOf("api.route('/admin/graphql', adminGraphQLRouter)"),
    'admin GraphQL gate must run before the route',
  );
});

test('checkout app functions stay off the buyer order-creation path', () => {
  assert.equal(storefrontRoute.includes('evaluateCheckoutAppFunctions(c,'), false);
  assert.equal(storefrontRoute.includes('CHECKOUT_FUNCTION_VALIDATION'), false);
  assert.equal(storefrontRoute.includes('checkoutDecision'), false);
  assert.match(storefrontRoute, /payment_method: body\.paymentMethod/);
  assert.match(storefrontRoute, /shipping_method: body\.deliveryOption/);
  assert.match(storefrontRoute, /extensionFunctions: \[\]/);
});
