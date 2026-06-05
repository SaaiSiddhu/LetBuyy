import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('gateway mounts date-based API versioning before v1 routes', () => {
  const index = read('services/api-gateway/src/index.ts');
  const apiVersion = read('services/api-gateway/src/middleware/apiVersion.ts');

  assert.match(index, /import \{ apiVersioning \} from '\.\/middleware\/apiVersion'/);
  assert.match(index, /api\.use\('\/\*', apiVersioning\)/);
  assert.match(apiVersion, /CURRENT_API_VERSION = '2026-06-01'/);
  assert.match(apiVersion, /SUPPORTED_API_VERSIONS = \['2026-01-01', CURRENT_API_VERSION\]/);
  assert.match(apiVersion, /X-LetBuyy-API-Version/);
  assert.match(apiVersion, /UNSUPPORTED_API_VERSION/);
});

test('gateway exposes and accepts API version and query-cost headers through CORS', () => {
  const index = read('services/api-gateway/src/index.ts');

  assert.match(index, /X-LetBuyy-API-Version', 'LetBuyy-API-Version/);
  assert.match(index, /X-RateLimit-Cost/);
  assert.match(index, /X-RateLimit-Policy/);
});

test('query-cost limiter uses a leaky bucket and throttles over-cost requests', () => {
  const rateLimit = read('services/api-gateway/src/middleware/rateLimit.ts');
  const index = read('services/api-gateway/src/index.ts');

  assert.match(rateLimit, /calculateQueryCost/);
  assert.match(rateLimit, /evaluateLeakyBucket/);
  assert.match(rateLimit, /pointsPerSecond/);
  assert.match(rateLimit, /QUERY_COST_RATE_LIMITED/);
  assert.match(rateLimit, /429/);
  assert.match(rateLimit, /X-RateLimit-Cost/);
  assert.match(index, /queryCostRateLimit\(\{\s+pointsPerSecond: 20,\s+capacity: 200,\s+skip: shouldSkipGatewayQueryCostLimit,/);
});

test('query-cost calculation accounts for pagination, expansions, and heavy routes', () => {
  const rateLimit = read('services/api-gateway/src/middleware/rateLimit.ts');

  assert.match(rateLimit, /parseLimitFromQuery/);
  assert.match(rateLimit, /countCsvQueryParam\(input\.queryString, 'include'\) \* 2/);
  assert.match(rateLimit, /countCsvQueryParam\(input\.queryString, 'expand'\) \* 2/);
  assert.match(rateLimit, /path\.includes\('\/analytics'\)/);
  assert.match(rateLimit, /path\.includes\('\/export'\)/);
  assert.match(rateLimit, /path\.includes\('\/operations'\)/);
});
