// APPID-P4b — identity-platform's half of storefront sign-in: the request it will act on, where it
// will send a buyer back to, and the storefront session it mints. APPID-P4d adds the marketplace app:
// its one exact callback, and which token a redeemed code gets.

import assert from 'node:assert/strict'
import test from 'node:test'
import { exportJWK, generateKeyPair, jwtVerify } from 'jose'
import { callbackWithCode, grantForRedemption, parseAuthorizationRequest, safeContinuePath } from '../lib/auth/buyer-authorization'
import { createIdentityIssuedBuyerSessionToken, createIdentityIssuedStorefrontSessionToken } from '../lib/auth/identity-issued-session'

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

const APP = { ...GOOD, client_id: 'letbuyy-marketplace-app', redirect_uri: 'com.letbuyy.letbuyy:/oauth/callback' }

test('the app is accepted only with its one callback, exactly', () => {
    assert.deepEqual(parseAuthorizationRequest(APP), {
        clientId: 'letbuyy-marketplace-app',
        redirectUri: 'com.letbuyy.letbuyy:/oauth/callback',
        state: GOOD.state,
        codeChallenge: GOOD.code_challenge,
        codeChallengeMethod: 'S256',
    })
    for (const redirect of [
        'com.letbuyy.letbuyy://oauth/callback',
        'com.letbuyy.letbuyy:/oauth/callback?x=1',
        'com.letbuyy.evil:/oauth/callback',
        GOOD.redirect_uri,
    ]) {
        assert.equal(parseAuthorizationRequest({ ...APP, redirect_uri: redirect }), null, redirect)
    }
    assert.equal(parseAuthorizationRequest({ ...APP, code_challenge_method: 'plain' }), null, 'a public client without S256')
})

test('the app callback gets exactly the code and the state, on its own scheme', () => {
    const url = callbackWithCode(APP.redirect_uri, 'C0de_-', 'St4te_-')
    assert.equal(url, 'com.letbuyy.letbuyy:/oauth/callback?code=C0de_-&state=St4te_-')
})

test('a redeemed code gets the token its RECORDED client is owed, and a mismatch gets nothing', () => {
    const buyer = { id: 'buyer-1' }
    assert.deepEqual(
        grantForRedemption({ buyer, client_id: 'letbuyy-storefront', site_id: SITE, session_epoch: 2 }),
        { kind: 'storefront', buyerAccountId: 'buyer-1', siteId: SITE, sessionEpoch: 2 },
    )
    assert.deepEqual(
        grantForRedemption({ buyer, client_id: 'letbuyy-marketplace-app', site_id: null, session_epoch: 3 }),
        { kind: 'app', buyerAccountId: 'buyer-1', sessionEpoch: 3 },
    )
    // A gateway from before APPID-P4d names no client: a storefront code still works, an app code does not.
    assert.deepEqual(
        grantForRedemption({ buyer, site_id: SITE, session_epoch: 1 }),
        { kind: 'storefront', buyerAccountId: 'buyer-1', siteId: SITE, sessionEpoch: 1 },
    )
    assert.equal(grantForRedemption({ buyer, site_id: null, session_epoch: 1 }), null)
    for (const data of [
        { buyer, client_id: 'letbuyy-marketplace-app', site_id: SITE, session_epoch: 1 },
        { buyer, client_id: 'letbuyy-storefront', site_id: null, session_epoch: 1 },
        { buyer, client_id: 'letbuyy-marketplace-app', session_epoch: 1 },
        { buyer, client_id: 'letbuyy-admin', site_id: null, session_epoch: 1 },
        { buyer, client_id: undefined, site_id: SITE, session_epoch: 1 },
        { buyer, client_id: null, site_id: SITE, session_epoch: 1 },
        { buyer, client_id: 'letbuyy-storefront', site_id: SITE, session_epoch: 0 },
        { buyer, client_id: 'letbuyy-storefront', site_id: SITE, session_epoch: 1.5 },
        { buyer: {}, client_id: 'letbuyy-storefront', site_id: SITE, session_epoch: 1 },
        null,
        undefined,
    ]) {
        assert.equal(grantForRedemption(data as Parameters<typeof grantForRedemption>[0]), null, JSON.stringify(data))
    }
})

test('the app gets a platform buyer session: the buyer audience, the epoch, 30 days, and no site', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const saved = { jwk: process.env.LETBUYY_IDENTITY_PRIVATE_JWK, issuer: process.env.LETBUYY_IDENTITY_ISSUER }
    process.env.LETBUYY_IDENTITY_PRIVATE_JWK = JSON.stringify({ ...(await exportJWK(privateKey)), alg: 'ES256', kid: 'test' })
    process.env.LETBUYY_IDENTITY_ISSUER = 'https://accounts.letbuyy.test'
    try {
        const token = await createIdentityIssuedBuyerSessionToken({ buyerAccountId: 'buyer-1', sessionEpoch: 3 })
        assert.ok(token)
        const { payload } = await jwtVerify(token, publicKey, { issuer: 'https://accounts.letbuyy.test', audience: 'letbuyy:buyer-session' })
        assert.equal(payload.token_use, 'buyer_session')
        assert.equal(payload.sub, 'buyer-1')
        assert.equal(payload.sep, 3)
        assert.equal('site_id' in payload, false)
        assert.equal((payload.exp as number) - (payload.iat as number), 30 * 24 * 60 * 60)
    } finally {
        if (saved.jwk === undefined) delete process.env.LETBUYY_IDENTITY_PRIVATE_JWK
        else process.env.LETBUYY_IDENTITY_PRIVATE_JWK = saved.jwk
        if (saved.issuer === undefined) delete process.env.LETBUYY_IDENTITY_ISSUER
        else process.env.LETBUYY_IDENTITY_ISSUER = saved.issuer
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
