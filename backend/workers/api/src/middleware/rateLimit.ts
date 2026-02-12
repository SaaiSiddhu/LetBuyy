import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory rate limit store (per Worker isolate)
// For production, use Cloudflare Durable Objects or KV
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.resetAt < now) store.delete(key);
    }
}, 60_000);

interface RateLimitOptions {
    windowMs?: number;  // Time window in ms (default: 60s)
    max?: number;       // Max requests per window (default: 60)
    keyGenerator?: (c: any) => string;
}

export function rateLimit(options: RateLimitOptions = {}) {
    const {
        windowMs = 60_000,
        max = 60,
        keyGenerator = (c) => {
            const auth = c.get('auth');
            return auth?.user?.id || c.req.header('CF-Connecting-IP') || 'anonymous';
        },
    } = options;

    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const key = keyGenerator(c);
        const now = Date.now();

        let entry = store.get(key);

        if (!entry || entry.resetAt < now) {
            entry = { count: 0, resetAt: now + windowMs };
            store.set(key, entry);
        }

        entry.count++;

        // Set rate limit headers
        c.header('X-RateLimit-Limit', max.toString());
        c.header('X-RateLimit-Remaining', Math.max(0, max - entry.count).toString());
        c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

        if (entry.count > max) {
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

// Pre-configured rate limiters
export const strictRateLimit = rateLimit({ windowMs: 60_000, max: 10 }); // 10 per minute
export const authRateLimit = rateLimit({ windowMs: 300_000, max: 20 });  // 20 per 5 minutes
