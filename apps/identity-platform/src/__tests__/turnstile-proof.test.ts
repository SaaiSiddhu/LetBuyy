import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hmacSha256Hex, sha256Hex } from '@letbuyy/auth-core'
import { verifyTurnstileToken } from '../lib/turnstile'

const MOBILE_TURNSTILE_PROOF_PREFIX = 'lb-mobile-turnstile-v1'

function base64UrlEncodeJson(value: unknown): string {
    const bytes = new TextEncoder().encode(JSON.stringify(value))
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function createProof(input: { secret: string; expOffsetSeconds?: number }) {
    const now = Math.floor(Date.now() / 1000)
    const encodedPayload = base64UrlEncodeJson({
        type: 'letbuyy.mobile_turnstile_proof',
        source: 'mobile-bff',
        provider: 'cloudflare_turnstile',
        status: 'verified',
        token_hash: await sha256Hex('turnstile-response-token'),
        remote_ip_hash: await sha256Hex('203.0.113.10'),
        iat: now,
        exp: now + (input.expOffsetSeconds ?? 120),
        jti: 'mobile-proof-jti-0001',
    })
    const signature = await hmacSha256Hex(input.secret, `${MOBILE_TURNSTILE_PROOF_PREFIX}.${encodedPayload}`)
    return `${MOBILE_TURNSTILE_PROOF_PREFIX}.${encodedPayload}.${signature}`
}

test('identity accepts mobile BFF Turnstile proof without calling Cloudflare again', async () => {
    const previousSecret = process.env.INTERNAL_API_SECRET
    const previousFetch = globalThis.fetch
    process.env.INTERNAL_API_SECRET = 'internal-proof-secret'
    globalThis.fetch = (() => {
        throw new Error('Cloudflare siteverify must not be called for mobile BFF proofs')
    }) as typeof fetch

    try {
        const proof = await createProof({ secret: 'internal-proof-secret' })
        assert.equal(await verifyTurnstileToken(proof, '203.0.113.10'), true)
    } finally {
        if (previousSecret === undefined) delete process.env.INTERNAL_API_SECRET
        else process.env.INTERNAL_API_SECRET = previousSecret
        globalThis.fetch = previousFetch
    }
})

test('identity rejects expired or tampered mobile BFF Turnstile proofs', async () => {
    const previousSecret = process.env.INTERNAL_API_SECRET
    process.env.INTERNAL_API_SECRET = 'internal-proof-secret'

    try {
        const expired = await createProof({ secret: 'internal-proof-secret', expOffsetSeconds: -1 })
        assert.equal(await verifyTurnstileToken(expired), false)

        const valid = await createProof({ secret: 'internal-proof-secret' })
        const parts = valid.split('.')
        parts[2] = `${parts[2].startsWith('a') ? 'b' : 'a'}${parts[2].slice(1)}`
        assert.equal(await verifyTurnstileToken(parts.join('.')), false)
    } finally {
        if (previousSecret === undefined) delete process.env.INTERNAL_API_SECRET
        else process.env.INTERNAL_API_SECRET = previousSecret
    }
})
