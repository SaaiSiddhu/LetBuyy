import { identityApiRequest } from './api/client'

export type RateLimiterPort = {
    limit(identifier: string): Promise<{ success: boolean; reset: number }>
}

type AuthRateLimitConfig = {
    limit: number
    window: `${number} ${'s' | 'm' | 'h' | 'd'}`
    prefix: string
}

/**
 * Rate limiter configurations for different auth endpoints.
 * Gateway-owned rate limits keep auth throttling outside the Next app boundary.
 */
export const AUTH_RATE_LIMITS = {
    // Lookup: 10 requests per 15 minutes
    lookup: { limit: 10, window: '15 m', prefix: 'rl:lookup' },

    // Signup: 3 requests per hour
    signup: { limit: 3, window: '1 h', prefix: 'rl:signup' },

    // Login: 5 requests per 15 minutes
    login: { limit: 5, window: '15 m', prefix: 'rl:login' },
    // D-8 buyer realm. Separate buckets rather than reusing signup/login: a shared bucket would let
    // buyer traffic exhaust a merchant's allowance and vice versa, so a burst of marketplace
    // registrations could lock merchants out of their own dashboard.
    'buyer-register': { limit: 3, window: '1 h', prefix: 'rl:buyer-register' },
    'buyer-login': { limit: 5, window: '15 m', prefix: 'rl:buyer-login' },
    // APPID-P4a buyer email verification and password recovery, separate for the same reason. The
    // database also caps each code at 5 wrong attempts and each buyer at 5 codes per hour per purpose.
    'buyer-verify-send': { limit: 3, window: '15 m', prefix: 'rl:buyer-verify-send' },
    'buyer-verify-confirm': { limit: 10, window: '15 m', prefix: 'rl:buyer-verify-confirm' },
    'buyer-recover-send': { limit: 3, window: '15 m', prefix: 'rl:buyer-recover-send' },
    'buyer-recover-confirm': { limit: 5, window: '15 m', prefix: 'rl:buyer-recover-confirm' },
    // APPID-P4b: continuing to a store. The token exchange that follows is server to server and is
    // deliberately not limited by address (every storefront shares a few).
    'buyer-oauth-authorize': { limit: 10, window: '15 m', prefix: 'rl:buyer-oauth-authorize' },

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

    // Account switch: 5 per 15 minutes (SEC-H7 — /switch was previously unthrottled)
    switch: { limit: 5, window: '15 m', prefix: 'rl:switch' },
} satisfies Record<string, AuthRateLimitConfig>

type RateLimitPayload = {
    data?: {
        allowed: boolean
        retryAfter?: number
    }
    allowed?: boolean
    retryAfter?: number
    error?: {
        code?: string
        message?: string
    }
}

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
    if (process.env.NODE_ENV === 'development' && process.env.LETBUYY_REMOTE_RATE_LIMIT !== 'true') {
        return { allowed: true }
    }

    const response = await identityApiRequest<RateLimitPayload>('/auth/custom/rate-limit/check', {
        method: 'POST',
        body: JSON.stringify({ endpoint, identifier }),
    })
    const payload = await response.json().catch(() => null)
    const result = payload?.data || payload

    if (!response.ok || !result) {
        const errorCode = payload?.error?.code
        if (process.env.NODE_ENV === 'development' && (response.status >= 500 || errorCode === 'RATE_LIMIT_UNAVAILABLE')) {
            return { allowed: true }
        }

        return { allowed: false, retryAfter: 60 }
    }

    return {
        allowed: result.allowed === true,
        retryAfter: result.retryAfter,
    }
}
