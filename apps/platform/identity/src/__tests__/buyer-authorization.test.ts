// APPID-P4b — identity-platform's half of storefront sign-in: the request it will act on, where it
// will send a buyer back to, and the storefront session it mints.

import assert from 'node:assert/strict'
import test from 'node:test'
import { exportJWK, generateKeyPair, jwtVerify } from 'jose'
import { callbackWithCode, parseAuthorizationRequest, safeContinuePath } from '../lib/auth/buyer-authorization'
import { createIdentityIssuedStorefrontSessionToken } from '../lib/auth/identity-issued-session'

const SITE = 'CCCCCCCC-3333-4333-8333-CCCCCCCCCCCC'
const GOOD = {
    response_type: 'code',
    client_id: 'letbuyy-storefront',
    redirect_uri: 'https://store-one.letbuyy.com/api/buyer-auth/callback',
    state: 'a'.repeat(32),
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
}

test('a well-formed request is accepted, and every malformed part refuses it', () => {
    assert.deepEqual(parseAuthorizationRequest(GOOD), {
        clientId: GOOD.client_id,
        redirectUri: GOOD.redirect_uri,
        state: GOOD.state,
        codeChallenge: GOOD.code_challenge,
        codeChallengeMethod: 'S256',
    })
    for (const [field, value] of [
        ['response_type', 'token'],
        ['client_id', 'letbuyy-admin'],
        ['state', 'short'],
        ['state', 'has spaces in it and more'],
        ['state', ['a'.repeat(32), 'b'.repeat(32)]],
        ['code_challenge', 'not-43-characters'],
        ['code_challenge_method', 'plain'],
        ['redirect_uri', `https://x.letbuyy.com/${'a'.repeat(2048)}`],
        ['redirect_uri', undefined],
    ] as const) {
        assert.equal(parseAuthorizationRequest({ ...GOOD, [field]: value }), null, `${field}=${String(value).slice(0, 30)}`)
    }
})

test('the callback gets exactly the code and the state', () => {
    const url = new URL(callbackWithCode(GOOD.redirect_uri, 'C0de_-', 'st.a~te'))
    assert.equal(url.origin + url.pathname, GOOD.redirect_uri)
    assert.deepEqual([...url.searchParams.entries()], [['code', 'C0de_-'], ['state', 'st.a~te']])
})

test('after signing in or recovering, a buyer goes back only to the authorize page', () => {
    assert.equal(safeContinuePath('/buyer/authorize?client_id=x'), '/buyer/authorize?client_id=x')
    for (const bad of [null, '', '/buyer/authorize', '//evil.example/buyer/authorize?x', 'https://evil.example', '/select', '/buyer/authorize?x\\y']) {
        assert.equal(safeContinuePath(bad), null, String(bad))
    }
})

test('a storefront session names its site, carries the epoch, and lasts 7 days under its own audience', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const saved = { jwk: process.env.LETBUYY_IDENTITY_PRIVATE_JWK, issuer: process.env.LETBUYY_IDENTITY_ISSUER }
    process.env.LETBUYY_IDENTITY_PRIVATE_JWK = JSON.stringify({ ...(await exportJWK(privateKey)), alg: 'ES256', kid: 'test' })
    process.env.LETBUYY_IDENTITY_ISSUER = 'https://accounts.letbuyy.test'
    try {
        const token = await createIdentityIssuedStorefrontSessionToken({ buyerAccountId: 'buyer-1', siteId: SITE, sessionEpoch: 2 })
        assert.ok(token)
        const { payload } = await jwtVerify(token, publicKey, { issuer: 'https://accounts.letbuyy.test', audience: 'letbuyy:storefront-session' })
        assert.equal(payload.token_use, 'storefront_session')
        assert.equal(payload.realm, 'buyer')
        assert.equal(payload.site_id, SITE.toLowerCase())
        assert.equal(payload.sep, 2)
        assert.equal((payload.exp as number) - (payload.iat as number), 7 * 24 * 60 * 60)
        await assert.rejects(createIdentityIssuedStorefrontSessionToken({ buyerAccountId: 'b', siteId: 'not-a-site', sessionEpoch: 1 }), /site/)
        await assert.rejects(createIdentityIssuedStorefrontSessionToken({ buyerAccountId: 'b', siteId: SITE, sessionEpoch: 0 }), /session epoch/)
    } finally {
        if (saved.jwk === undefined) delete process.env.LETBUYY_IDENTITY_PRIVATE_JWK
        else process.env.LETBUYY_IDENTITY_PRIVATE_JWK = saved.jwk
        if (saved.issuer === undefined) delete process.env.LETBUYY_IDENTITY_ISSUER
        else process.env.LETBUYY_IDENTITY_ISSUER = saved.issuer
    }
})
