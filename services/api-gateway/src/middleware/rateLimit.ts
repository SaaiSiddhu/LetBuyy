import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';

// ============================================================
// RATE LIMITER — Upstash Redis with Cloudflare KV and in-memory fallback.
//
// Fallbacks:
// - Cloudflare KV in deployed Workers when Redis env vars are not configured.
// - In-memory store in local/non-production runtimes only.
// ============================================================

// ─── In-Memory Fallback Store ───────────────────────────────────────

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

interface QueryCostLimitEntry {
    used: number;
    updatedAt: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    unavailable?: boolean;
}

export interface QueryCostRateLimitResult extends RateLimitResult {
    cost: number;
    limit: number;
    policy: string;
    retryAfterMs: number;
}

const memoryStore = new Map<string, RateLimitEntry>();
const queryCostMemoryStore = new Map<string, QueryCostLimitEntry>();
let lastCleanupAt = 0;

type RuntimeEnvironmentFlags = Pick<Env, 'ENVIRONMENT' | 'APP_ENV' | 'NODE_ENV'>;

function runtimeFlagValues(env: RuntimeEnvironmentFlags): string[] {
    return [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());
}

function isLocalRuntime(env: RuntimeEnvironmentFlags): boolean {
    const values = runtimeFlagValues(env);
    return values.includes('local') || values.includes('development');
}

function isProductionRuntime(env: RuntimeEnvironmentFlags): boolean {
    const explicitValues = [env.ENVIRONMENT, env.APP_ENV]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());

    if (explicitValues.includes('production')) return true;
    if (explicitValues.length > 0) return false;

    return env.NODE_ENV?.toLowerCase() === 'production';
}

function cleanupExpiredEntries(now: number) {
    if (now - lastCleanupAt < 60_000) return;

    lastCleanupAt = now;
    for (const [key, entry] of memoryStore) {
        if (entry.resetAt < now) memoryStore.delete(key);
    }
}

function compactStorageKey(key: string): string {
    if (key.length <= 400) return key;

    let hash = 0x811c9dc5;
    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return `${key.slice(0, 240)}:${(hash >>> 0).toString(16)}`;
}

// ─── Rate Limit Options ─────────────────────────────────────────────

interface RateLimitOptions {
    windowMs?: number;   // Time window in ms (default: 60s)
    max?: number;        // Max requests per window (default: 60)
    prefix?: string;     // Key prefix for Redis (default: 'rl')
    keyGenerator?: (c: Context<{ Bindings: Env }>) => string;
    skip?: (c: Context<{ Bindings: Env }>) => boolean;
}

interface QueryCostRateLimitOptions {
    pointsPerSecond?: number;
    capacity?: number;
    prefix?: string;
    keyGenerator?: (c: Context<{ Bindings: Env }>) => string;
    skip?: (c: Context<{ Bindings: Env }>) => boolean;
}

export interface CustomerAuthRateLimitIdentity {
    storeId?: string | null;
    email?: string | null;
    contact?: string | null;
    operation?: string | null;
}

export interface CustomerAuthRateLimitOptions {
    windowMs?: number;
    maxPerIdentity?: number;
    maxPerIp?: number;
    prefix?: string;
    identityGenerator?: (c: Context<{ Bindings: Env }>) => CustomerAuthRateLimitIdentity | Promise<CustomerAuthRateLimitIdentity>;
}

export interface DirectRateLimitOptions {
    key: string;
    windowMs?: number;
    max?: number;
    prefix?: string;
}

interface DirectRateLimitCheckOptions extends DirectRateLimitOptions {
    scope?: string;
}

interface RateLimitBatchResult extends RateLimitResult {
    key: string;
    max: number;
    scope?: string;
}

interface RedisPipelineResult<T> {
    result?: T | null;
    error?: string;
}

export interface DirectQueryCostRateLimitOptions {
    key: string;
    cost: number;
    pointsPerSecond?: number;
    capacity?: number;
    prefix?: string;
}

// ─── Redis-backed Rate Limiting ─────────────────────────────────────

/**
 * Check rate limit using Upstash Redis REST API.
 * Uses sliding window counter pattern via direct HTTP calls
 * to avoid bundling @upstash/ratelimit (keeps worker lean).
 */
const FIXED_WINDOW_RATE_LIMIT_SCRIPT = `
local result = {}
for index = 1, #KEYS do
  local windowMs = tonumber(ARGV[((index - 1) * 2) + 1])
  local count = redis.call('INCR', KEYS[index])
  if count == 1 then
    redis.call('PEXPIRE', KEYS[index], windowMs)
  end
  local ttl = redis.call('PTTL', KEYS[index])
  if ttl < 0 then
    redis.call('PEXPIRE', KEYS[index], windowMs)
    ttl = windowMs
  end
  result[#result + 1] = count
  result[#result + 1] = ttl
end
return result
`;

async function checkRedisRateLimitBatch(
    redisUrl: string,
    redisToken: string,
    checks: DirectRateLimitCheckOptions[]
): Promise<RateLimitBatchResult[]> {
    if (checks.length === 0) return [];

    const now = Date.now();
    const keys = checks.map((check) => compactStorageKey(`${check.prefix || 'rl'}:${check.key}:${Math.floor(now / (check.windowMs || 60_000))}`));
    const args = checks.flatMap((check) => [
        (check.windowMs || 60_000).toString(),
        (check.max || 60).toString(),
    ]);

    try {
        const response = await fetch(`${redisUrl}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${redisToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([['EVAL', FIXED_WINDOW_RATE_LIMIT_SCRIPT, keys.length.toString(), ...keys, ...args]]),
        });

        if (!response.ok) {
            console.error(JSON.stringify({
                level: 'error',
                service: 'letbuyy-api',
                route: 'middleware.rate_limit',
                status_code: 503,
                reason: 'redis_pipeline_failed',
                upstream_status: response.status,
            }));
            return checks.map((check) => ({
                key: check.key,
                max: check.max || 60,
                scope: check.scope,
                allowed: false,
                remaining: 0,
                resetAt: now + (check.windowMs || 60_000),
                unavailable: true,
            }));
        }

        const results = (await response.json()) as Array<RedisPipelineResult<Array<number | string>>>;
        const scriptResult = results[0]?.result;
        if (results[0]?.error || !Array.isArray(scriptResult)) {
            return checks.map((check) => ({
                key: check.key,
                max: check.max || 60,
                scope: check.scope,
                allowed: false,
                remaining: 0,
                resetAt: now + (check.windowMs || 60_000),
                unavailable: true,
            }));
        }

        return checks.map((check, index) => {
            const count = Number(scriptResult[index * 2] || 0);
            const ttl = Number(scriptResult[index * 2 + 1] || 0);
            const windowMs = check.windowMs || 60_000;
            const max = check.max || 60;

            return {
                key: check.key,
                max,
                scope: check.scope,
                allowed: count <= max,
                remaining: Math.max(0, max - count),
                resetAt: now + (Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs),
            };
        });
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            service: 'letbuyy-api',
            route: 'middleware.rate_limit',
            status_code: 503,
            reason: 'redis_unavailable',
            error: err instanceof Error ? err.message : 'Redis rate limit request failed',
        }));
        return checks.map((check) => ({
            key: check.key,
            max: check.max || 60,
            scope: check.scope,
            allowed: false,
            remaining: 0,
            resetAt: now + (check.windowMs || 60_000),
            unavailable: true,
        }));
    }
}

// ─── In-Memory Rate Limiting ────────────────────────────────────────

function checkMemoryRateLimit(
    key: string,
    windowMs: number,
    max: number
): RateLimitResult {
    const now = Date.now();
    cleanupExpiredEntries(now);

    let entry = memoryStore.get(key);

    if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + windowMs };
        memoryStore.set(key, entry);
    }

    entry.count++;

    return {
        allowed: entry.count <= max,
        remaining: Math.max(0, max - entry.count),
        resetAt: entry.resetAt,
    };
}

async function checkKvRateLimit(
    cache: KVNamespace,
    key: string,
    windowMs: number,
    max: number
): Promise<RateLimitResult> {
    const now = Date.now();
    const windowKey = compactStorageKey(`${key}:${Math.floor(now / windowMs)}`);
    const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
    const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000) + 30);

    try {
        const rawCount = await cache.get(windowKey);
        const previousCount = rawCount ? Number.parseInt(rawCount, 10) : 0;
        const count = Number.isFinite(previousCount) ? previousCount + 1 : 1;

        await cache.put(windowKey, count.toString(), { expirationTtl: ttlSeconds });

        return {
            allowed: count <= max,
            remaining: Math.max(0, max - count),
            resetAt,
        };
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            service: 'letbuyy-api',
            route: 'middleware.rate_limit',
            status_code: 503,
            reason: 'kv_unavailable',
            error: err instanceof Error ? err.message : 'KV rate limit request failed',
        }));
        return { allowed: false, remaining: 0, resetAt: now + windowMs, unavailable: true };
    }
}

function parseLimitFromQuery(queryString?: string): number {
    if (!queryString) return 0;
    const params = new URLSearchParams(queryString);
    const rawLimit = params.get('limit') || params.get('page_size') || params.get('first');
    const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function countCsvQueryParam(queryString: string | undefined, key: string): number {
    if (!queryString) return 0;
    const value = new URLSearchParams(queryString).get(key);
    if (!value) return 0;
    return value.split(',').map((item) => item.trim()).filter(Boolean).length;
}

function normalizeRateLimitPart(value: string | null | undefined): string | null {
    const normalized = value?.trim().toLowerCase();
    return normalized || null;
}

function customerAuthClientIp(c: Context<{ Bindings: Env }>): string {
    return c.req.header('CF-Connecting-IP')
        || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
        || 'anonymous';
}

function customerAuthIdentityKey(identity: CustomerAuthRateLimitIdentity): string | null {
    const storeId = normalizeRateLimitPart(identity.storeId);
    const identifier = normalizeRateLimitPart(identity.email) || normalizeRateLimitPart(identity.contact);
    if (!storeId || !identifier) return null;
    return `identity:${storeId}:${identifier}`;
}

function defaultCustomerAuthIdentity(c: Context<{ Bindings: Env }>): CustomerAuthRateLimitIdentity {
    const url = new URL(c.req.url);
    return {
        storeId: url.searchParams.get('store_id'),
        email: url.searchParams.get('email'),
        contact: url.searchParams.get('contact'),
        operation: c.req.path,
    };
}

export async function enforceCustomerAuthRateLimit(
    c: Context<{ Bindings: Env }>,
    identity: CustomerAuthRateLimitIdentity,
    options: Omit<CustomerAuthRateLimitOptions, 'identityGenerator'> = {},
): Promise<Response | null> {
    const {
        windowMs = 15 * 60_000,
        maxPerIdentity = 5,
        maxPerIp = 30,
        prefix = 'rl:customer-auth',
    } = options;
    const operation = normalizeRateLimitPart(identity.operation) || 'customer-auth';
    const checks = [
        {
            key: `${operation}:ip:${customerAuthClientIp(c)}`,
            max: maxPerIp,
            scope: 'ip',
        },
    ];
    const identityKey = customerAuthIdentityKey(identity);
    if (identityKey) {
        checks.push({
            key: `${operation}:${identityKey}`,
            max: maxPerIdentity,
            scope: 'identity',
        });
    }

    const results = await checkRateLimitKeys(c.env, checks.map((check) => ({
        ...check,
        windowMs,
        prefix,
    })));
    let tightestRemaining = Number.POSITIVE_INFINITY;
    let latestResetAt = 0;

    for (const result of results) {
        tightestRemaining = Math.min(tightestRemaining, result.remaining);
        latestResetAt = Math.max(latestResetAt, result.resetAt);

        if (result.unavailable && isProductionRuntime(c.env)) {
            c.header('X-RateLimit-Limit', result.max.toString());
            c.header('X-RateLimit-Remaining', '0');
            c.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_UNAVAILABLE',
                        message: 'Rate limiting infrastructure is unavailable',
                    },
                },
                503,
            );
        }

        if (!result.allowed) {
            const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
            c.header('X-RateLimit-Limit', result.max.toString());
            c.header('X-RateLimit-Remaining', result.remaining.toString());
            c.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());
            c.header('Retry-After', retryAfterSeconds.toString());
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'CUSTOMER_AUTH_RATE_LIMITED',
                        message: 'Too many attempts. Please try again later.',
                        scope: result.scope || 'identity',
                    },
                },
                429,
            );
        }
    }

    c.header('X-Customer-Auth-RateLimit-Remaining', Number.isFinite(tightestRemaining) ? tightestRemaining.toString() : '0');
    if (latestResetAt > 0) {
        c.header('X-Customer-Auth-RateLimit-Reset', Math.ceil(latestResetAt / 1000).toString());
    }

    return null;
}

export function calculateQueryCost(input: {
    method: string;
    path: string;
    queryString?: string;
}): number {
    const method = input.method.toUpperCase();
    const path = input.path.toLowerCase();
    let cost = method === 'GET' || method === 'HEAD' ? 1 : method === 'DELETE' ? 8 : 5;

    const limit = parseLimitFromQuery(input.queryString);
    if (limit > 50) cost += Math.ceil(limit / 50) - 1;

    cost += countCsvQueryParam(input.queryString, 'include') * 2;
    cost += countCsvQueryParam(input.queryString, 'expand') * 2;

    if (path.includes('/analytics') || path.includes('/export')) cost += 15;
    if (path.includes('/operations')) cost += 10;
    if (path.includes('/ai/')) cost += 20;
    if (path.includes('/internal/')) cost += 10;

    return Math.max(1, Math.min(cost, 250));
}

function evaluateLeakyBucket(input: {
    entry: QueryCostLimitEntry | null;
    now: number;
    cost: number;
    pointsPerSecond: number;
    capacity: number;
}): QueryCostRateLimitResult & { entry: QueryCostLimitEntry } {
    const previous = input.entry || { used: 0, updatedAt: input.now };
    const elapsedSeconds = Math.max(0, (input.now - previous.updatedAt) / 1000);
    const leaked = elapsedSeconds * input.pointsPerSecond;
    const used = Math.max(0, previous.used - leaked);
    const nextUsed = used + input.cost;
    const allowed = nextUsed <= input.capacity;
    const storedUsed = allowed ? nextUsed : used;
    const overflow = Math.max(0, nextUsed - input.capacity);
    const retryAfterMs = allowed ? 0 : Math.ceil((overflow / input.pointsPerSecond) * 1000);
    const resetAt = input.now + Math.ceil((storedUsed / input.pointsPerSecond) * 1000);

    return {
        allowed,
        remaining: Math.max(0, Math.floor(input.capacity - storedUsed)),
        resetAt,
        unavailable: false,
        cost: input.cost,
        limit: input.capacity,
        policy: `${input.capacity};w=leaky;rate=${input.pointsPerSecond}`,
        retryAfterMs,
        entry: {
            used: storedUsed,
            updatedAt: input.now,
        },
    };
}

function checkMemoryQueryCostLimit(
    key: string,
    cost: number,
    pointsPerSecond: number,
    capacity: number
): QueryCostRateLimitResult {
    const now = Date.now();
    const result = evaluateLeakyBucket({
        entry: queryCostMemoryStore.get(key) || null,
        now,
        cost,
        pointsPerSecond,
        capacity,
    });
    queryCostMemoryStore.set(key, result.entry);
    return result;
}

async function checkKvQueryCostLimit(
    cache: KVNamespace,
    key: string,
    cost: number,
    pointsPerSecond: number,
    capacity: number
): Promise<QueryCostRateLimitResult> {
    const now = Date.now();
    const storageKey = compactStorageKey(key);

    try {
        const rawEntry = await cache.get(storageKey);
        const entry = rawEntry ? JSON.parse(rawEntry) as QueryCostLimitEntry : null;
        const result = evaluateLeakyBucket({ entry, now, cost, pointsPerSecond, capacity });
        const ttlSeconds = Math.max(60, Math.ceil((capacity / pointsPerSecond) * 2));

        await cache.put(storageKey, JSON.stringify(result.entry), { expirationTtl: ttlSeconds });

        return result;
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            service: 'letbuyy-api',
            route: 'middleware.query_cost_rate_limit',
            status_code: 503,
            reason: 'kv_unavailable',
            error: err instanceof Error ? err.message : 'KV query cost rate limit request failed',
        }));
        return {
            allowed: false,
            remaining: 0,
            resetAt: now + 1000,
            unavailable: true,
            cost,
            limit: capacity,
            policy: `${capacity};w=leaky;rate=${pointsPerSecond}`,
            retryAfterMs: 1000,
        };
    }
}

const QUERY_COST_RATE_LIMIT_SCRIPT = `
local now = tonumber(ARGV[1])
local cost = tonumber(ARGV[2])
local pointsPerSecond = tonumber(ARGV[3])
local capacity = tonumber(ARGV[4])
local ttlMs = tonumber(ARGV[5])
local rawEntry = redis.call('GET', KEYS[1])
local used = 0
local updatedAt = now

if rawEntry then
  local separator = string.find(rawEntry, ':')
  if separator then
    used = tonumber(string.sub(rawEntry, 1, separator - 1)) or 0
    updatedAt = tonumber(string.sub(rawEntry, separator + 1)) or now
  end
end

local elapsedSeconds = math.max(0, (now - updatedAt) / 1000)
local leaked = elapsedSeconds * pointsPerSecond
local currentUsed = math.max(0, used - leaked)
local nextUsed = currentUsed + cost
local allowed = nextUsed <= capacity and 1 or 0
local storedUsed = allowed == 1 and nextUsed or currentUsed
local overflow = math.max(0, nextUsed - capacity)
local retryAfterMs = allowed == 1 and 0 or math.ceil((overflow / pointsPerSecond) * 1000)
local resetInMs = math.ceil((storedUsed / pointsPerSecond) * 1000)

redis.call('SET', KEYS[1], tostring(storedUsed) .. ':' .. tostring(now), 'PX', ttlMs)

return {
  allowed,
  math.floor(math.max(0, capacity - storedUsed)),
  resetInMs,
  retryAfterMs,
}
`;

async function checkRedisQueryCostLimit(
    redisUrl: string,
    redisToken: string,
    key: string,
    cost: number,
    pointsPerSecond: number,
    capacity: number
): Promise<QueryCostRateLimitResult> {
    const now = Date.now();

    try {
        const ttlMs = Math.max(60_000, Math.ceil((capacity / pointsPerSecond) * 2000));
        const response = await fetch(`${redisUrl}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${redisToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([[
                'EVAL',
                QUERY_COST_RATE_LIMIT_SCRIPT,
                '1',
                compactStorageKey(key),
                now.toString(),
                cost.toString(),
                pointsPerSecond.toString(),
                capacity.toString(),
                ttlMs.toString(),
            ]]),
        });

        if (!response.ok) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: now + 1000,
                unavailable: true,
                cost,
                limit: capacity,
                policy: `${capacity};w=leaky;rate=${pointsPerSecond}`,
                retryAfterMs: 1000,
            };
        }

        const results = (await response.json()) as Array<RedisPipelineResult<Array<number | string>>>;
        const scriptResult = results[0]?.result;
        if (results[0]?.error || !Array.isArray(scriptResult)) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: now + 1000,
                unavailable: true,
                cost,
                limit: capacity,
                policy: `${capacity};w=leaky;rate=${pointsPerSecond}`,
                retryAfterMs: 1000,
            };
        }
        const allowed = Number(scriptResult[0] || 0) === 1;
        const remaining = Number(scriptResult[1] || 0);
        const resetInMs = Number(scriptResult[2] || 0);
        const retryAfterMs = Number(scriptResult[3] || 0);

        return {
            allowed,
            remaining: Number.isFinite(remaining) ? Math.max(0, Math.floor(remaining)) : 0,
            resetAt: now + (Number.isFinite(resetInMs) && resetInMs > 0 ? resetInMs : ttlMs),
            unavailable: false,
            cost,
            limit: capacity,
            policy: `${capacity};w=leaky;rate=${pointsPerSecond}`,
            retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
        };
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            service: 'letbuyy-api',
            route: 'middleware.query_cost_rate_limit',
            status_code: 503,
            reason: 'redis_unavailable',
            error: err instanceof Error ? err.message : 'Redis query cost rate limit request failed',
        }));
        return {
            allowed: false,
            remaining: 0,
            resetAt: now + 1000,
            unavailable: true,
            cost,
            limit: capacity,
            policy: `${capacity};w=leaky;rate=${pointsPerSecond}`,
            retryAfterMs: 1000,
        };
    }
}

export async function checkRateLimitKey(
    env: Pick<Env, 'UPSTASH_REDIS_REST_URL' | 'UPSTASH_REDIS_REST_TOKEN' | 'ENVIRONMENT' | 'APP_ENV' | 'NODE_ENV' | 'CACHE'>,
    options: DirectRateLimitOptions
): Promise<RateLimitResult> {
    const [result] = await checkRateLimitKeys(env, [options]);
    return result;
}

async function checkRateLimitKeys(
    env: Pick<Env, 'UPSTASH_REDIS_REST_URL' | 'UPSTASH_REDIS_REST_TOKEN' | 'ENVIRONMENT' | 'APP_ENV' | 'NODE_ENV' | 'CACHE'>,
    checks: DirectRateLimitCheckOptions[],
): Promise<RateLimitBatchResult[]> {
    const {
        windowMs = 60_000,
        prefix = 'rl',
    } = checks[0] || {};
    const redisUrl = env.UPSTASH_REDIS_REST_URL;
    const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
    const useRedis = Boolean(redisUrl && redisToken);
    const isProduction = isProductionRuntime(env);

    if (useRedis) {
        return checkRedisRateLimitBatch(redisUrl, redisToken, checks);
    }

    if (isProduction) {
        return checks.map((check) => ({
            key: check.key,
            max: check.max || 60,
            scope: check.scope,
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + (check.windowMs || windowMs),
            unavailable: true,
        }));
    }

    if (env.CACHE) {
        return Promise.all(checks.map(async (check) => {
            const fullKey = `${check.prefix || prefix}:${check.key}`;
            const result = await checkKvRateLimit(env.CACHE as KVNamespace, fullKey, check.windowMs || windowMs, check.max || 60);
            return {
                ...result,
                key: check.key,
                max: check.max || 60,
                scope: check.scope,
            };
        }));
    }

    return checks.map((check) => {
        const fullKey = `${check.prefix || prefix}:${check.key}`;
        return {
            ...checkMemoryRateLimit(fullKey, check.windowMs || windowMs, check.max || 60),
            key: check.key,
            max: check.max || 60,
            scope: check.scope,
        };
    });
}

export async function checkQueryCostRateLimitKey(
    env: Pick<Env, 'UPSTASH_REDIS_REST_URL' | 'UPSTASH_REDIS_REST_TOKEN' | 'ENVIRONMENT' | 'APP_ENV' | 'NODE_ENV' | 'CACHE'>,
    options: DirectQueryCostRateLimitOptions
): Promise<QueryCostRateLimitResult> {
    const {
        key,
        cost,
        pointsPerSecond = 20,
        capacity = 200,
        prefix = 'rl:query-cost',
    } = options;
    const fullKey = `${prefix}:${key}`;
    const redisUrl = env.UPSTASH_REDIS_REST_URL;
    const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
    const useRedis = Boolean(redisUrl && redisToken);
    const isProduction = isProductionRuntime(env);

    if (isProduction && !useRedis) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 1000,
            unavailable: true,
            cost,
            limit: capacity,
            policy: `${capacity};w=leaky;rate=${pointsPerSecond}`,
            retryAfterMs: 1000,
        };
    }

    if (!useRedis && env.CACHE) {
        return checkKvQueryCostLimit(env.CACHE, fullKey, cost, pointsPerSecond, capacity);
    }

    const result = useRedis
        ? await checkRedisQueryCostLimit(redisUrl, redisToken, fullKey, cost, pointsPerSecond, capacity)
        : checkMemoryQueryCostLimit(fullKey, cost, pointsPerSecond, capacity);

    if (result.unavailable && !isProduction) {
        return checkMemoryQueryCostLimit(fullKey, cost, pointsPerSecond, capacity);
    }

    return result;
}

// ─── Middleware Factory ─────────────────────────────────────────────

export function rateLimit(options: RateLimitOptions = {}) {
    const {
        windowMs = 60_000,
        max = 60,
        prefix = 'rl',
        keyGenerator = (c) => {
            const auth = c.get('auth');
            return auth?.user?.id || c.req.header('CF-Connecting-IP') || 'anonymous';
        },
        skip,
    } = options;

    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        if (skip?.(c)) {
            await next();
            return;
        }

        if (isLocalRuntime(c.env)) {
            await next();
            return;
        }

        const clientKey = keyGenerator(c);
        const isProduction = isProductionRuntime(c.env);

        const result = await checkRateLimitKey(c.env, {
            key: clientKey,
            windowMs,
            max,
            prefix,
        });

        if (result.unavailable) {
            if (isProduction) {
                c.header('X-RateLimit-Limit', max.toString());
                c.header('X-RateLimit-Remaining', '0');
                c.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());
                return c.json(
                    {
                        error: {
                            code: 'RATE_LIMIT_UNAVAILABLE',
                            message: 'Rate limiting infrastructure is unavailable',
                        },
                    },
                    503
                );
            }
        }

        // Set standard rate limit headers
        c.header('X-RateLimit-Limit', max.toString());
        c.header('X-RateLimit-Remaining', result.remaining.toString());
        c.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

        if (!result.allowed) {
            c.header('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000).toString());
            return c.json(
                {
                    error: {
                        code: 'RATE_LIMITED',
                        message: 'Too many requests, please try again later',
                    },
                },
                429
            );
        }

        await next();
    });
}

function defaultQueryCostKey(c: Context<{ Bindings: Env }>): string {
    try {
        const auth = c.get('auth');
        if (auth?.user?.id) return `user:${auth.user.id}`;
    } catch {
        // Auth context is unavailable on public routes.
    }

    return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'anonymous';
}

export function queryCostRateLimit(options: QueryCostRateLimitOptions = {}) {
    const {
        pointsPerSecond = 20,
        capacity = 200,
        prefix = 'rl:query-cost',
        keyGenerator = defaultQueryCostKey,
        skip,
    } = options;

    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        if (c.req.method === 'OPTIONS') {
            await next();
            return;
        }

        if (skip?.(c)) {
            await next();
            return;
        }

        if (isLocalRuntime(c.env)) {
            await next();
            return;
        }

        const url = new URL(c.req.url);
        const cost = calculateQueryCost({
            method: c.req.method,
            path: c.req.path,
            queryString: url.searchParams.toString(),
        });
        const result = await checkQueryCostRateLimitKey(c.env, {
            key: keyGenerator(c),
            cost,
            pointsPerSecond,
            capacity,
            prefix,
        });
        const isProduction = isProductionRuntime(c.env);

        c.header('X-RateLimit-Limit', result.limit.toString());
        c.header('X-RateLimit-Remaining', result.remaining.toString());
        c.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());
        c.header('X-RateLimit-Cost', result.cost.toString());
        c.header('X-RateLimit-Policy', result.policy);

        if (result.unavailable && isProduction) {
            return c.json(
                {
                    error: {
                        code: 'RATE_LIMIT_UNAVAILABLE',
                        message: 'Rate limiting infrastructure is unavailable',
                    },
                },
                503
            );
        }

        if (!result.allowed) {
            c.header('Retry-After', Math.max(1, Math.ceil(result.retryAfterMs / 1000)).toString());
            return c.json(
                {
                    error: {
                        code: 'QUERY_COST_RATE_LIMITED',
                        message: 'Query cost limit exceeded, please retry after the bucket drains',
                        cost: result.cost,
                        limit: result.limit,
                    },
                },
                429
            );
        }

        await next();
    });
}

export function customerAuthRateLimit(options: CustomerAuthRateLimitOptions = {}) {
    const {
        identityGenerator = defaultCustomerAuthIdentity,
        ...limitOptions
    } = options;

    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const blocked = await enforceCustomerAuthRateLimit(c, await identityGenerator(c), limitOptions);
        if (blocked) return blocked;
        await next();
    });
}

// ─── Pre-configured Rate Limiters ───────────────────────────────────

/** 10 requests per minute — for sensitive operations */
export const strictRateLimit = rateLimit({
    windowMs: 60_000,
    max: 10,
    prefix: 'rl:strict',
});

/** 20 requests per 5 minutes — for auth endpoints */
export const authRateLimit = rateLimit({
    windowMs: 300_000,
    max: 20,
    prefix: 'rl:auth',
});

/** 5 requests per minute — for password reset, OTP */
export const sensitiveRateLimit = rateLimit({
    windowMs: 60_000,
    max: 5,
    prefix: 'rl:sensitive',
});
