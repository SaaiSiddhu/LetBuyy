import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gatewayIndex = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const rateLimitSource = readFileSync('services/api-gateway/src/middleware/rateLimit.ts', 'utf8');

function blockAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} exists`);
  return source.slice(start, start + 1600);
}

test('gateway uses one general query-cost limiter and skips dedicated limiter paths', () => {
  assert.match(gatewayIndex, /import \{ authRateLimit, queryCostRateLimit \} from '\.\/middleware\/rateLimit'/);
  assert.match(gatewayIndex, /function shouldSkipGatewayQueryCostLimit/);
  assert.match(gatewayIndex, /path\.startsWith\('\/auth\/'\)/);
  assert.match(gatewayIndex, /path === '\/storefront\/graphql'/);
  assert.match(gatewayIndex, /path === '\/graphql\/admin'/);
  assert.match(gatewayIndex, /path === '\/storefront\/customer\/login'/);
  assert.match(gatewayIndex, /path === '\/storefront\/customer\/password\/request-reset'/);
  assert.ok(gatewayIndex.includes('/^\\/storefront\\/[^/]+\\/orders\\/contact$/.test(path)'));
  assert.match(gatewayIndex, /api\.use\('\/\*', queryCostRateLimit\(\{\s+pointsPerSecond: 20,\s+capacity: 200,\s+skip: shouldSkipGatewayQueryCostLimit,\s+\}\)\)/);
  assert.doesNotMatch(gatewayIndex, /api\.use\('\/\*', rateLimit\(\{ max: 300 \}\)\)/);
});

test('Redis fixed-window checks support batched atomic decisions', () => {
  assert.match(rateLimitSource, /FIXED_WINDOW_RATE_LIMIT_SCRIPT/);
  assert.match(rateLimitSource, /\['EVAL', FIXED_WINDOW_RATE_LIMIT_SCRIPT/);
  assert.match(rateLimitSource, /async function checkRateLimitKeys/);

  const customerAuthBlock = blockAfter(rateLimitSource, 'export async function enforceCustomerAuthRateLimit');
  assert.match(customerAuthBlock, /const results = await checkRateLimitKeys/);
  assert.doesNotMatch(customerAuthBlock, /await checkRateLimitKey\(/);
});

test('Redis query-cost limiter uses a single atomic script instead of read-then-write', () => {
  const redisQueryBlock = blockAfter(rateLimitSource, 'async function checkRedisQueryCostLimit');
  assert.match(redisQueryBlock, /QUERY_COST_RATE_LIMIT_SCRIPT/);
  assert.match(redisQueryBlock, /'EVAL',\s+QUERY_COST_RATE_LIMIT_SCRIPT/);
  assert.doesNotMatch(redisQueryBlock, /readResponse/);
  assert.doesNotMatch(redisQueryBlock, /writeResponse/);
});

test('production rate limiting requires Redis instead of non-atomic KV fallback', () => {
  const fixedWindowBlock = blockAfter(rateLimitSource, 'async function checkRateLimitKeys');
  const queryCostBlock = blockAfter(rateLimitSource, 'export async function checkQueryCostRateLimitKey');

  assert.ok(
    fixedWindowBlock.indexOf('if (useRedis)') < fixedWindowBlock.indexOf('if (isProduction)'),
    'fixed-window limits should prefer Redis before production fail-closed',
  );
  assert.ok(
    queryCostBlock.indexOf('if (isProduction && !useRedis)') < queryCostBlock.indexOf('if (!useRedis && env.CACHE)'),
    'query-cost limits should fail closed in production before KV fallback',
  );
});
