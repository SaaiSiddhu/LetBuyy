import assert from 'node:assert/strict'
import test from 'node:test'
import { AUTH_RATE_LIMITS, checkRateLimitWithLimiters, type RateLimiterPort } from '../lib/rate-limit'

test('verify_otp has a dedicated strict limiter configuration', () => {
    assert.deepEqual(AUTH_RATE_LIMITS.verify_otp, {
        limit: 5,
        window: '15 m',
        prefix: 'rl:verify_otp',
    })
})

test('verify_otp blocks requests after the configured attempt count', async () => {
    let attempts = 0
    const limiter: RateLimiterPort = {
        async limit() {
            attempts += 1
            return {
                success: attempts <= AUTH_RATE_LIMITS.verify_otp.limit,
                reset: Date.now() + 15 * 60 * 1000,
            }
        },
    }

    for (let i = 0; i < AUTH_RATE_LIMITS.verify_otp.limit; i += 1) {
        const result = await checkRateLimitWithLimiters({ verify_otp: limiter }, 'verify_otp', '203.0.113.10')
        assert.equal(result.allowed, true)
    }

    const blocked = await checkRateLimitWithLimiters({ verify_otp: limiter }, 'verify_otp', '203.0.113.10')
    assert.equal(blocked.allowed, false)
    assert.equal(typeof blocked.retryAfter, 'number')
})
