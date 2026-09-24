// APPID-P4a — every buyer token identity-platform issues carries the account's session epoch, and the
// wording identity-platform shows for the gateway's code outcomes.
//
// The gateway's half (it reads the same claim, refuses any epoch but the account's current one, and
// counts a token without the claim as epoch 1) is in
// services/api-gateway/src/__tests__/buyer-email-verification-routes.test.ts. Both halves name the
// claim through LETBUYY_BUYER_SESSION_EPOCH_CLAIM, so they cannot drift apart silently.

import assert from 'node:assert/strict'
import test from 'node:test'
import { exportJWK, generateKeyPair, jwtVerify } from 'jose'
import { LETBUYY_BUYER_SESSION_EPOCH_CLAIM } from '@letbuyy/auth-core'
import { createIdentityIssuedBuyerSessionToken } from '../lib/auth/identity-issued-session'
import { buyerSessionEpoch } from '../lib/auth/buyer-session'
import { buyerEmailCodeFailure } from '../lib/auth/buyer-email-code'

const BUYER_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

async function withSigningKey<T>(run: (verify: (token: string) => Promise<Record<string, unknown>>) => Promise<T>): Promise<T> {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const saved = {
        LETBUYY_IDENTITY_PRIVATE_JWK: process.env.LETBUYY_IDENTITY_PRIVATE_JWK,
        LETBUYY_IDENTITY_ISSUER: process.env.LETBUYY_IDENTITY_ISSUER,
    }
    process.env.LETBUYY_IDENTITY_PRIVATE_JWK = JSON.stringify({ ...(await exportJWK(privateKey)), alg: 'ES256', kid: 'test' })
    process.env.LETBUYY_IDENTITY_ISSUER = 'https://accounts.letbuyy.test'
    try {
        return await run(async (token) => (await jwtVerify(token, publicKey, {
            issuer: 'https://accounts.letbuyy.test',
            audience: 'letbuyy:buyer-session',
        })).payload as Record<string, unknown>)
    } finally {
        for (const [key, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
    }
}

test('the claim the gateway reads is the one identity-platform writes', () => {
    assert.equal(LETBUYY_BUYER_SESSION_EPOCH_CLAIM, 'sep')
})

test('a buyer token carries the epoch it was issued in, signed', async () => {
    await withSigningKey(async (verify) => {
        const token = await createIdentityIssuedBuyerSessionToken({ buyerAccountId: BUYER_ID, sessionEpoch: 3 })
        assert.ok(token)
        const claims = await verify(token)
        assert.equal(claims[LETBUYY_BUYER_SESSION_EPOCH_CLAIM], 3)
        assert.equal(claims.sub, BUYER_ID)
        assert.equal(claims.realm, 'buyer')
        assert.ok(!('site_id' in claims), 'a buyer token is not a tenant credential')
    })
})

test('a token cannot be minted without a real epoch', async () => {
    await withSigningKey(async () => {
        for (const sessionEpoch of [0, -1, 1.5, Number.NaN]) {
            await assert.rejects(
                createIdentityIssuedBuyerSessionToken({ buyerAccountId: BUYER_ID, sessionEpoch }),
                /session epoch/,
                `epoch ${sessionEpoch}`,
            )
        }
    })
})

test("the epoch from the gateway's buyer record, and 1 when a gateway from before 257 sends none", () => {
    assert.equal(buyerSessionEpoch(4), 4)
    for (const missing of [undefined, null, 0, -2, 1.5, '4']) {
        assert.equal(buyerSessionEpoch(missing), 1, `value ${JSON.stringify(missing)}`)
    }
})

test("the gateway's code outcomes map to identity-platform's own words", () => {
    const failure = (code: string, signedIn = true) => buyerEmailCodeFailure({ success: false, error: { code, message: 'gateway wording' } }, { signedIn })
    assert.deepEqual(failure('CODE_INVALID'), { status: 400, error: 'That code is incorrect or has already been used.' })
    assert.equal(failure('CODE_EXPIRED').status, 400)
    assert.equal(failure('CODE_LOCKED').status, 429)
    assert.equal(failure('ADDRESS_CHANGED').status, 409)
    assert.equal(failure('TOO_MANY_CODES').status, 429)
    assert.equal(failure('EMAIL_UNAVAILABLE').status, 503)
    assert.equal(failure('BUYER_DISABLED').status, 403)
    // Signed in, the gateway's 401 means the session ended. Without a session it can only mean
    // identity-platform's own signature was refused, which is not something to tell a buyer.
    assert.equal(failure('UNAUTHORIZED', true).status, 401)
    assert.equal(failure('UNAUTHORIZED', false).status, 503)
    assert.equal(buyerEmailCodeFailure(null, { signedIn: true }).status, 503)
    for (const code of ['CODE_INVALID', 'CODE_LOCKED', 'SOMETHING_NEW']) {
        assert.ok(!failure(code).error.includes('gateway wording'), 'the gateway message is never passed through')
    }
})
