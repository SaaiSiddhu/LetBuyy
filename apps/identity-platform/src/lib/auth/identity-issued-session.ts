import { SignJWT, importJWK, type JWK } from 'jose'
import { isProductionIdentityRuntime } from '@/lib/dev-auth-bypass'

const MERCHANT_SESSION_AUDIENCE = 'letbuyy:merchant-session'
const MERCHANT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
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
