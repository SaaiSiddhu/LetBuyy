import { SignJWT, importJWK, type JWK } from 'jose'
import {
    LETBUYY_BUYER_SESSION_EPOCH_CLAIM,
    LETBUYY_STOREFRONT_SESSION_AUDIENCE,
    LETBUYY_STOREFRONT_SESSION_TTL_SECONDS,
} from '@letbuyy/auth-core'
import { isProductionIdentityRuntime } from '@/lib/dev-auth-bypass'

const MERCHANT_SESSION_AUDIENCE = 'letbuyy:merchant-session'
const MERCHANT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

// D-8 (2026-09-05): the marketplace buyer realm. A DISTINCT audience is what makes a merchant token
// unusable as a buyer session and vice versa — the realm and token_use claims say what a token is,
// but the audience is what the verifier refuses to accept across realms even if everything else were
// somehow forged consistently. Never reuse the merchant audience here.
const BUYER_SESSION_AUDIENCE = 'letbuyy:buyer-session'
const BUYER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

const DEFAULT_IDENTITY_ISSUER = 'https://accounts.letbuyy.com'

type IdentitySessionAlgorithm = 'EdDSA' | 'ES256'

function identityIssuer(): string {
    return (
        process.env.LETBUYY_IDENTITY_ISSUER ||
        process.env.NEXT_PUBLIC_ACCOUNTS_URL ||
        DEFAULT_IDENTITY_ISSUER
    ).replace(/\/+$/, '')
}

function parsePrivateJwk(): JWK | null {
    const raw = process.env.LETBUYY_IDENTITY_PRIVATE_JWK?.trim()
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw) as JWK
        if (parsed && typeof parsed === 'object') return parsed
    } catch {
        return null
    }

    return null
}

function resolveAlgorithm(jwk: JWK): IdentitySessionAlgorithm {
    return jwk.alg === 'EdDSA' ? 'EdDSA' : 'ES256'
}

export async function createIdentityIssuedMerchantSessionToken(input: {
    userId: string
    deviceId?: string | null
}): Promise<string | null> {
    const privateJwk = parsePrivateJwk()
    if (!privateJwk) {
        if (isProductionIdentityRuntime(process.env)) {
            throw new Error('LETBUYY_IDENTITY_PRIVATE_JWK is required for production merchant session issuance')
        }
        return null
    }

    const alg = resolveAlgorithm(privateJwk)
    const key = await importJWK(privateJwk, alg)
    const nowSeconds = Math.floor(Date.now() / 1000)

    return new SignJWT({
        realm: 'merchant',
        token_use: 'merchant_session',
        device_id: input.deviceId || null,
    })
        .setProtectedHeader({
            alg,
            typ: 'JWT',
            kid: typeof privateJwk.kid === 'string' ? privateJwk.kid : 'identity-platform-active',
        })
        .setIssuer(identityIssuer())
        .setAudience(MERCHANT_SESSION_AUDIENCE)
        .setSubject(input.userId)
        .setIssuedAt(nowSeconds)
        .setExpirationTime(nowSeconds + MERCHANT_SESSION_TTL_SECONDS)
        .setJti(crypto.randomUUID())
        .sign(key)
}

/// Mints a marketplace buyer session (D-8).
///
/// Same asymmetric key and algorithm as the merchant path, deliberately: the existing customer realm
/// is minted HS256 from CUSTOMER_SESSION_SECRET, where the verification key is also the forgery key
/// (ART-05, SEC-R7). D-8 exists to collapse onto the sole asymmetric issuer, so a third copy of that
/// deviation would defeat the point of the decision.
///
/// `subject` is a buyer_accounts.id. The token carries NO site_id and NO store claim, and that is a
/// property to preserve rather than an omission: a buyer identity is platform-level and spans
/// sellers. Putting a site in it would quietly turn it into a tenant credential, and site_id is the
/// tenant boundary — a buyer is not a tenant.
///
/// `sep` is the account's session epoch when the token is issued (APPID-P4a, migration 257). The
/// gateway refuses a token once the account has moved to a later epoch, which is how a password
/// reset and "sign out everywhere" end sessions that are still signed and unexpired.
export async function createIdentityIssuedBuyerSessionToken(input: {
    buyerAccountId: string
    sessionEpoch: number
    deviceId?: string | null
}): Promise<string | null> {
    if (!Number.isInteger(input.sessionEpoch) || input.sessionEpoch < 1) {
        throw new Error('A buyer session token needs the account session epoch')
    }
    const privateJwk = parsePrivateJwk()
    if (!privateJwk) {
        if (isProductionIdentityRuntime(process.env)) {
            throw new Error('LETBUYY_IDENTITY_PRIVATE_JWK is required for production buyer session issuance')
        }
        return null
    }

    const alg = resolveAlgorithm(privateJwk)
    const key = await importJWK(privateJwk, alg)
    const nowSeconds = Math.floor(Date.now() / 1000)

    return new SignJWT({
        realm: 'buyer',
        token_use: 'buyer_session',
        device_id: input.deviceId || null,
        [LETBUYY_BUYER_SESSION_EPOCH_CLAIM]: input.sessionEpoch,
    })
        .setProtectedHeader({
            alg,
            typ: 'JWT',
            kid: typeof privateJwk.kid === 'string' ? privateJwk.kid : 'identity-platform-active',
        })
        .setIssuer(identityIssuer())
        .setAudience(BUYER_SESSION_AUDIENCE)
        .setSubject(input.buyerAccountId)
        .setIssuedAt(nowSeconds)
        .setExpirationTime(nowSeconds + BUYER_SESSION_TTL_SECONDS)
        .setJti(crypto.randomUUID())
        .sign(key)
}

/// Mints a buyer's session AT ONE STOREFRONT (APPID-P4b), after the storefront's server redeemed a
/// first-party authorization code for it. Unlike the platform buyer session it names the site, under
/// its own audience, and lives 7 days rather than 30: the storefront keeps it in a cookie on the
/// store's own host, which for a custom domain is a host the merchant controls. The gateway accepts it
/// only at that site, only through the storefront's own server, and only in the account's current
/// session epoch. The epoch is the one the database confirmed when it redeemed the code.
export async function createIdentityIssuedStorefrontSessionToken(input: {
    buyerAccountId: string
    siteId: string
    sessionEpoch: number
}): Promise<string | null> {
    if (!Number.isInteger(input.sessionEpoch) || input.sessionEpoch < 1) {
        throw new Error('A storefront session token needs the account session epoch')
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.siteId)) {
        throw new Error('A storefront session token needs the site it is for')
    }
    const privateJwk = parsePrivateJwk()
    if (!privateJwk) {
        if (isProductionIdentityRuntime(process.env)) {
            throw new Error('LETBUYY_IDENTITY_PRIVATE_JWK is required for production storefront session issuance')
        }
        return null
    }

    const alg = resolveAlgorithm(privateJwk)
    const key = await importJWK(privateJwk, alg)
    const nowSeconds = Math.floor(Date.now() / 1000)

    return new SignJWT({
        realm: 'buyer',
        token_use: 'storefront_session',
        site_id: input.siteId.toLowerCase(),
        [LETBUYY_BUYER_SESSION_EPOCH_CLAIM]: input.sessionEpoch,
    })
        .setProtectedHeader({
            alg,
            typ: 'JWT',
            kid: typeof privateJwk.kid === 'string' ? privateJwk.kid : 'identity-platform-active',
        })
        .setIssuer(identityIssuer())
        .setAudience(LETBUYY_STOREFRONT_SESSION_AUDIENCE)
        .setSubject(input.buyerAccountId)
        .setIssuedAt(nowSeconds)
        .setExpirationTime(nowSeconds + LETBUYY_STOREFRONT_SESSION_TTL_SECONDS)
        .setJti(crypto.randomUUID())
        .sign(key)
}
