import { createMiddleware } from 'hono/factory';
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

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    unavailable?: boolean;
}

const memoryStore = new Map<string, RateLimitEntry>();
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
    keyGenerator?: (c: any) => string;
}

export interface DirectRateLimitOptions {
    key: string;
    windowMs?: number;
    max?: number;
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
