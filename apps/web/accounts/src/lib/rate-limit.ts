import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Create Redis client (only if configured)
const redis = process.env.UPSTASH_REDIS_REST_URL
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
    : null

/**
 * Rate limiter configurations for different auth endpoints.
 * Uses sliding window algorithm for smooth rate limiting.
 */
const limiters: Record<string, Ratelimit | null> = {
    // Lookup: 10 requests per 15 minutes
    lookup: redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '15 m'), prefix: 'rl:lookup' })
        : null,

    // Signup: 3 requests per hour
    signup: redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'rl:signup' })
        : null,

    // Login: 5 requests per 15 minutes
    login: redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'rl:login' })
        : null,

    // Send magic link: 3 per 15 minutes
    'send-magic': redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '15 m'), prefix: 'rl:magic' })
        : null,

    // Send reset: 3 per 15 minutes
    'send-reset': redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '15 m'), prefix: 'rl:reset' })
        : null,

    // Set password: 5 per 15 minutes
    'set-password': redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'rl:setpw' })
        : null,

    // Reset password: 5 per 15 minutes
    'reset-password': redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'rl:resetpw' })
        : null,

    // Verify: 10 per 15 minutes
    verify: redis
        ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '15 m'), prefix: 'rl:verify' })
        : null,
}

/**
 * Check rate limit for a given endpoint and identifier (usually IP or email).
 * Returns { allowed: true } if the request is allowed, or { allowed: false, retryAfter } if rate limited.
 */
export async function checkRateLimit(
    endpoint: string,
    identifier: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
    const limiter = limiters[endpoint]
    if (!limiter) {
        // No Redis configured — allow all in development
        return { allowed: true }
    }

    const result = await limiter.limit(identifier)

    if (!result.success) {
        return {
            allowed: false,
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        }
    }

    return { allowed: true }
}
