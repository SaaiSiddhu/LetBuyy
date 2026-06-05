import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('REST shim internal subrequest marker is nonce-backed and not client-cloned', () => {
  const restShim = read('services/api-gateway/src/graphql/rest-shim.ts');
  const adminGraphQL = read('services/api-gateway/src/graphql/admin.ts');
  const storefrontGraphQL = read('services/api-gateway/src/graphql/storefront.ts');
  const gatewayIndex = read('services/api-gateway/src/index.ts');

  assert.match(restShim, /LETBUYY_INTERNAL_SUBREQUEST_HEADER = 'X-LetBuyy-Internal-Subrequest'/);
  assert.match(restShim, /activeRestShimSubrequests = new Map<string, number>\(\)/);
  assert.match(restShim, /crypto\.randomUUID\(\)/);
  assert.match(restShim, /headers\.set\(LETBUYY_INTERNAL_SUBREQUEST_HEADER,\s*registerRestShimSubrequest\(\)\)/);
  assert.match(restShim, /export function isGraphQLRestShimSubrequest/);
  assert.doesNotMatch(adminGraphQL, /X-LetBuyy-Internal-Subrequest/);
  assert.doesNotMatch(storefrontGraphQL, /X-LetBuyy-Internal-Subrequest/);
  assert.doesNotMatch(gatewayIndex.match(/allowHeaders: \[[\s\S]*?\]/)?.[0] || '', /X-LetBuyy-Internal-Subrequest/);
});

test('internal GraphQL REST shim subrequests bypass per-field logging and gateway query-cost limiting', () => {
  const gatewayIndex = read('services/api-gateway/src/index.ts');
  const observability = read('services/api-gateway/src/middleware/observability.ts');
  const adminGraphQL = read('services/api-gateway/src/graphql/admin.ts');

  assert.match(gatewayIndex, /LETBUYY_INTERNAL_SUBREQUEST_HEADER,\s*isGraphQLRestShimSubrequest/);
  assert.match(gatewayIndex, /c\.req\.header\?\.\(LETBUYY_INTERNAL_SUBREQUEST_HEADER\)/);
  assert.match(gatewayIndex, /if \(isGraphQLRestShimSubrequest\(header\)\) return true/);
  assert.match(gatewayIndex, /skip: shouldSkipGatewayQueryCostLimit/);

  const skipIndex = observability.indexOf('if (isGraphQLRestShimSubrequest(c.req.header(LETBUYY_INTERNAL_SUBREQUEST_HEADER)))');
  assert.ok(skipIndex > 0, 'observability middleware must check the internal shim marker');
  assert.ok(
    skipIndex < observability.indexOf('writeStructuredRuntimeLog(fields)'),
    'observability logging must skip internal shim subrequests before log writes',
  );
  assert.match(observability, /return;\s*}\s*const latencyMs/);
  assert.match(adminGraphQL, /const ADMIN_CONNECTION_FIELDS = \[/);
  assert.match(adminGraphQL, /Promise\.all\(ADMIN_CONNECTION_FIELDS\.map/);
});
