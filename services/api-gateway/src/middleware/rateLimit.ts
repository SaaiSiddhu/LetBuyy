import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';

// ============================================================
// RATE LIMITER — Upstash Redis with in-memory fallback
// Uses @upstash/ratelimit for distributed rate limiting
// across Cloudflare Worker isolates.
//
// Fallback: If Redis env vars are missing, uses in-memory store
// (resets per isolate, suitable for development only).
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

function cleanupExpiredEntries(now: number) {
    if (now - lastCleanupAt < 60_000) return;

    lastCleanupAt = now;
    for (const [key, entry] of memoryStore) {
        if (entry.resetAt < now) memoryStore.delete(key);
    }
}

// ─── Rate Limit Options ─────────────────────────────────────────────

interface RateLimitOptions {
    windowMs?: number;   // Time window in ms (default: 60s)
    max?: number;        // Max requests per window (default: 60)
    prefix?: string;     // Key prefix for Redis (default: 'rl')
    keyGenerator?: (c: Context<{ Bindings: Env }>) => string;
}

interface QueryCostRateLimitOptions {
    pointsPerSecond?: number;
    capacity?: number;
    prefix?: string;
    keyGenerator?: (c: Context<{ Bindings: Env }>) => string;
}

export interface DirectRateLimitOptions {
    key: string;
    windowMs?: number;
    max?: number;
    prefix?: string;
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
async function checkRedisRateLimit(
    redisUrl: string,
    redisToken: string,
    key: string,
    windowMs: number,
    max: number
): Promise<RateLimitResult> {
    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / windowMs)}`;

    try {
        // INCR the counter for current window, set expiry on first hit
        const response = await fetch(`${redisUrl}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${redisToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([
                ['INCR', windowKey],
                ['PEXPIRE', windowKey, windowMs.toString()],
            ]),
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
            return { allowed: false, remaining: 0, resetAt: now + windowMs, unavailable: true };
        }

        const results = (await response.json()) as Array<{ result: number }>;
        const count = results[0]?.result ?? 0;
        const remaining = Math.max(0, max - count);
        const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;

        return { allowed: count <= max, remaining, resetAt };
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            service: 'letbuyy-api',
            route: 'middleware.rate_limit',
            status_code: 503,
            reason: 'redis_unavailable',
            error: err instanceof Error ? err.message : 'Redis rate limit request failed',
        }));
        return { allowed: false, remaining: 0, resetAt: now + windowMs, unavailable: true };
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
        const readResponse = await fetch(`${redisUrl}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${redisToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([['GET', key]]),
        });

        if (!readResponse.ok) {
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

        const readResults = (await readResponse.json()) as Array<{ result: string | null }>;
        const rawEntry = readResults[0]?.result;
        const entry = rawEntry ? JSON.parse(rawEntry) as QueryCostLimitEntry : null;
        const result = evaluateLeakyBucket({ entry, now, cost, pointsPerSecond, capacity });
        const ttlMs = Math.max(60_000, Math.ceil((capacity / pointsPerSecond) * 2000));

        const writeResponse = await fetch(`${redisUrl}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${redisToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([['SET', key, JSON.stringify(result.entry), 'PX', ttlMs.toString()]]),
        });

        if (!writeResponse.ok) {
            return {
                ...result,
                allowed: false,
                remaining: 0,
                unavailable: true,
            };
        }

        return result;
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
    env: Pick<Env, 'UPSTASH_REDIS_REST_URL' | 'UPSTASH_REDIS_REST_TOKEN' | 'ENVIRONMENT'>,
    options: DirectRateLimitOptions
): Promise<RateLimitResult> {
    const {
        key,
        windowMs = 60_000,
        max = 60,
        prefix = 'rl',
    } = options;
    const fullKey = `${prefix}:${key}`;
    const redisUrl = env.UPSTASH_REDIS_REST_URL;
    const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
    const useRedis = Boolean(redisUrl && redisToken);
    const isProduction = env.ENVIRONMENT === 'production';

    if (isProduction && !useRedis) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + windowMs,
            unavailable: true,
        };
    }

    const result = useRedis
        ? await checkRedisRateLimit(redisUrl, redisToken, fullKey, windowMs, max)
        : checkMemoryRateLimit(fullKey, windowMs, max);

    if (result.unavailable && !isProduction) {
        return checkMemoryRateLimit(fullKey, windowMs, max);
    }

    return result;
}

export async function checkQueryCostRateLimitKey(
    env: Pick<Env, 'UPSTASH_REDIS_REST_URL' | 'UPSTASH_REDIS_REST_TOKEN' | 'ENVIRONMENT'>,
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
    const isProduction = env.ENVIRONMENT === 'production';

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
    } = options;

    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const clientKey = keyGenerator(c);
        const isProduction = c.env.ENVIRONMENT === 'production';

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
    } = options;

    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        if (c.req.method === 'OPTIONS') {
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
        const isProduction = c.env.ENVIRONMENT === 'production';

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
