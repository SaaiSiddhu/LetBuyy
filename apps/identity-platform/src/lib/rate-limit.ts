import { createUpstashSlidingWindowLimiter, type RateLimiterPort } from '@letbuyy/runtime-composition/identity-runtime-adapter'

const redisConfig = {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
}

type AuthRateLimitConfig = {
    limit: number
    window: `${number} ${'s' | 'm' | 'h' | 'd'}`
    prefix: string
}

/**
 * Rate limiter configurations for different auth endpoints.
 * Uses sliding window algorithm for smooth rate limiting.
 */
export const AUTH_RATE_LIMITS = {
    // Lookup: 10 requests per 15 minutes
    lookup: { limit: 10, window: '15 m', prefix: 'rl:lookup' },

    // Signup: 3 requests per hour
    signup: { limit: 3, window: '1 h', prefix: 'rl:signup' },

    // Login: 5 requests per 15 minutes
    login: { limit: 5, window: '15 m', prefix: 'rl:login' },

    // Send magic link: 3 per 15 minutes
    'send-magic': { limit: 3, window: '15 m', prefix: 'rl:magic' },

    // Send reset: 3 per 15 minutes
    'send-reset': { limit: 3, window: '15 m', prefix: 'rl:reset' },

    // Set password: 5 per 15 minutes
    'set-password': { limit: 5, window: '15 m', prefix: 'rl:setpw' },

    // Reset password: 5 per 15 minutes
    'reset-password': { limit: 5, window: '15 m', prefix: 'rl:resetpw' },

    // Verify: 10 per 15 minutes
    verify: { limit: 10, window: '15 m', prefix: 'rl:verify' },

    // OTP verification: 5 attempts per 15 minutes
    verify_otp: { limit: 5, window: '15 m', prefix: 'rl:verify_otp' },
} satisfies Record<string, AuthRateLimitConfig>

const limiters: Record<string, RateLimiterPort | null> = Object.fromEntries(
    Object.entries(AUTH_RATE_LIMITS).map(([endpoint, config]) => [
        endpoint,
        createUpstashSlidingWindowLimiter({ ...redisConfig, ...config }),
    ])
)

export async function checkRateLimitWithLimiters(
    registeredLimiters: Record<string, RateLimiterPort | null>,
    endpoint: string,
    identifier: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
    const limiter = registeredLimiters[endpoint]
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

/**
 * Check rate limit for a given endpoint and identifier (usually IP or email).
 * Returns { allowed: true } if the request is allowed, or { allowed: false, retryAfter } if rate limited.
 */
export async function checkRateLimit(
    endpoint: string,
    identifier: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
    return checkRateLimitWithLimiters(limiters, endpoint, identifier)
}
