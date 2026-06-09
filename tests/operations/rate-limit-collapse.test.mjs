import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gatewayIndex = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const rateLimitSource = readFileSync('services/api-gateway/src/middleware/rateLimit.ts', 'utf8');

function blockAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} exists`);
  return source.slice(start, start + 2600);
}

test('gateway uses one general query-cost limiter and skips dedicated limiter paths', () => {
  assert.match(gatewayIndex, /import \{ appOAuthRateLimit, authRateLimit, queryCostRateLimit \} from '\.\/middleware\/rateLimit'/);
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

test('production rate limiting prefers Redis, then explicit KV, then logged fail-open', () => {
  const fixedWindowBlock = blockAfter(rateLimitSource, 'async function checkRateLimitKeys');
  const queryCostBlock = blockAfter(rateLimitSource, 'export async function checkQueryCostRateLimitKey');
  const fixedWindowRedisIndex = fixedWindowBlock.indexOf('if (useRedis)');
  const fixedWindowKvFallbackIndex = fixedWindowBlock.indexOf('const useKvFallback = Boolean(env.CACHE) && (isProduction || kvRateLimitFallbackEnabled(env))');
  const fixedWindowFailOpenIndex = fixedWindowBlock.indexOf("warnRateLimitFailOpen('no_backend')");
  const queryCostRedisIndex = queryCostBlock.indexOf('if (useRedis)');
  const queryCostKvFallbackIndex = queryCostBlock.indexOf('const useKvFallback = Boolean(env.CACHE) && kvRateLimitFallbackEnabled(env)');
  const queryCostFailOpenIndex = queryCostBlock.indexOf("warnRateLimitFailOpen('query_cost_no_backend')");

  assert.notEqual(fixedWindowRedisIndex, -1, 'fixed-window limits must check Redis first');
  assert.notEqual(fixedWindowKvFallbackIndex, -1, 'fixed-window KV fallback must stay explicitly guarded');
  assert.ok(
    fixedWindowRedisIndex < fixedWindowKvFallbackIndex,
    'fixed-window limits should prefer Redis before KV fallback',
  );
  assert.ok(
    fixedWindowKvFallbackIndex < fixedWindowFailOpenIndex,
    'fixed-window limits should only fail open after Redis and KV are unavailable',
  );
  assert.notEqual(queryCostRedisIndex, -1, 'query-cost limits must check Redis first');
  assert.notEqual(queryCostKvFallbackIndex, -1, 'query-cost KV fallback must stay explicitly guarded');
  assert.ok(
    queryCostRedisIndex < queryCostKvFallbackIndex,
    'query-cost limits should prefer Redis before KV fallback',
  );
  assert.ok(
    queryCostKvFallbackIndex < queryCostFailOpenIndex,
    'query-cost limits should only fail open after Redis and KV are unavailable',
  );
});
