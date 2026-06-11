import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { configuredIdentityPublicJwks } from '../lib/identity-foundation/oidc-disabled'

const oidcSource = readFileSync(
    new URL('../lib/identity-foundation/oidc-disabled.ts', import.meta.url),
    'utf8',
)

function withIdentityJwksEnv<T>(env: Record<string, string | undefined>, run: () => T): T {
    const previous = {
        LETBUYY_IDENTITY_PUBLIC_JWKS: process.env.LETBUYY_IDENTITY_PUBLIC_JWKS,
        LETBUYY_IDENTITY_MERCHANT_PUBLIC_JWKS: process.env.LETBUYY_IDENTITY_MERCHANT_PUBLIC_JWKS,
    }

    try {
        for (const [key, value] of Object.entries(env)) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
        return run()
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
    }
}

test('OIDC JWKS helper serves only configured public signing keys', () => {
    const publicJwk = {
        kty: 'EC',
        kid: 'merchant-active',
        use: 'sig',
        alg: 'ES256',
        crv: 'P-256',
        x: 'public-x',
        y: 'public-y',
    }

    const jwks = withIdentityJwksEnv(
        { LETBUYY_IDENTITY_PUBLIC_JWKS: JSON.stringify({ keys: [publicJwk] }) },
        () => configuredIdentityPublicJwks('merchant'),
    )

    assert.deepEqual(jwks, { keys: [publicJwk] })
})

test('OIDC JWKS helper rejects private or unsupported key material', () => {
    const privateJwk = {
        kty: 'EC',
        kid: 'merchant-private',
        use: 'sig',
        alg: 'ES256',
        crv: 'P-256',
        x: 'public-x',
        y: 'public-y',
        d: 'private-key-material',
    }

    const jwks = withIdentityJwksEnv(
        { LETBUYY_IDENTITY_PUBLIC_JWKS: JSON.stringify({ keys: [privateJwk] }) },
        () => configuredIdentityPublicJwks('merchant'),
    )

    assert.equal(jwks, null)
})

test('OIDC scaffold has no disabled/fake JWKS coordinates', () => {
    assert.doesNotMatch(oidcSource, /DISABLED_JWKS/)
    assert.doesNotMatch(oidcSource, /disabled-x-coordinate|disabled-y-coordinate/)
    assert.match(oidcSource, /IDENTITY_JWKS_NOT_CONFIGURED/)
    assert.match(oidcSource, /configured-public-jwks/)
    assert.match(oidcSource, /PRIVATE_JWK_FIELDS/)
})
