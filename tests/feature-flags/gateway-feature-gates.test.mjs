import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gatewayIndex = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const featureFlags = readFileSync('services/api-gateway/src/middleware/featureFlags.ts', 'utf8');
const storefrontRoute = readFileSync('services/api-gateway/src/routes/storefront.ts', 'utf8');
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

test('checkout app functions do not execute when extensions are disabled', () => {
  const evaluationIndex = storefrontRoute.indexOf("isGatewayFeatureEnabled(c.env, 'FEATURE_EXTENSIONS')");
  const executeIndex = storefrontRoute.indexOf('evaluateCheckoutAppFunctions(c,');
  assert.notEqual(evaluationIndex, -1);
  assert.notEqual(executeIndex, -1);
  assert.ok(evaluationIndex < executeIndex, 'feature check must precede checkout function execution');
  assert.match(storefrontRoute, /extensionFunctions: \(functionEvaluation\?\.executions \|\| \[\]\)\.map/);
});
