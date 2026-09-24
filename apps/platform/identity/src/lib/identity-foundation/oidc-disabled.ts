import { NextResponse } from 'next/server'
import { features } from '@/lib/config/features'

type PublicJwk = Record<string, unknown> & {
    kty?: string
    kid?: string
    alg?: string
    use?: string
}

type PublicJwks = {
    keys: PublicJwk[]
}

const PRIVATE_JWK_FIELDS = new Set(['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'])
const SUPPORTED_IDENTITY_REALMS = new Set(['merchant', 'customer', 'admin', 'partner', 'service'])

function normalizeRealm(input: string | null | undefined): string {
    const realm = String(input || 'merchant').trim().toLowerCase()
    return SUPPORTED_IDENTITY_REALMS.has(realm) ? realm : 'merchant'
}

function parseJson(raw: string | undefined): unknown {
    if (!raw?.trim()) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

function hasPrivateJwkMaterial(jwk: Record<string, unknown>): boolean {
    return Object.keys(jwk).some((key) => PRIVATE_JWK_FIELDS.has(key))
}

function sanitizePublicJwk(value: unknown): PublicJwk | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null

    const jwk = value as Record<string, unknown>
    if (hasPrivateJwkMaterial(jwk)) return null
    if (typeof jwk.kty !== 'string' || typeof jwk.kid !== 'string') return null
    if (jwk.use !== undefined && jwk.use !== 'sig') return null
    if (typeof jwk.alg !== 'string' || !['ES256', 'EdDSA'].includes(jwk.alg)) return null

    return jwk as PublicJwk
}

export function configuredIdentityPublicJwks(realmInput?: string | null): PublicJwks | null {
    const realm = normalizeRealm(realmInput)
    const realmEnvKey = `LETBUYY_IDENTITY_${realm.toUpperCase()}_PUBLIC_JWKS`
    const parsed = parseJson(process.env[realmEnvKey]) || parseJson(process.env.LETBUYY_IDENTITY_PUBLIC_JWKS)

    if (!parsed || typeof parsed !== 'object') return null

    const rawKeys = Array.isArray((parsed as PublicJwks).keys)
        ? (parsed as PublicJwks).keys
        : [parsed]
    const keys = rawKeys
        .map(sanitizePublicJwk)
        .filter((key): key is PublicJwk => Boolean(key))

    if (keys.length === 0) return null

    return { keys }
}

export function identityProviderEnabled(): boolean {
    return features.identityFoundation.FEATURE_IDENTITY_PROVIDER
}

export function disabledIdentityProviderResponse(): NextResponse {
    return NextResponse.json(
        {
            error: {
                code: 'IDENTITY_PROVIDER_DISABLED',
                message: 'Identity provider is disabled.',
            },
        },
        {
            status: 404,
            headers: {
                'Cache-Control': 'no-store',
            },
        },
    )
}

function identityProviderOrigin(request?: Request): string {
    const configuredOrigin =
        process.env.IDENTITY_PROVIDER_ORIGIN ||
        process.env.NEXT_PUBLIC_IDENTITY_PROVIDER_ORIGIN ||
        process.env.NEXT_PUBLIC_ACCOUNTS_URL

    if (configuredOrigin) return configuredOrigin.replace(/\/+$/, '')
    if (request) return new URL(request.url).origin
    return 'http://identity.localhost'
}

export function oidcSkeletonResponse(endpoint: string, request?: Request): NextResponse {
    if (!identityProviderEnabled()) return disabledIdentityProviderResponse()

    if (endpoint === 'openid-configuration') {
        const origin = identityProviderOrigin(request)

        return NextResponse.json(
            {
                issuer: `${origin}/realms/merchant`,
                authorization_endpoint: `${origin}/oauth2/authorize`,
                token_endpoint: `${origin}/oauth2/token`,
                userinfo_endpoint: `${origin}/oauth2/userinfo`,
                jwks_uri: `${origin}/.well-known/jwks.json`,
                response_types_supported: ['code'],
                grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials', 'urn:ietf:params:oauth:grant-type:device_code'],
                code_challenge_methods_supported: ['S256'],
                jwks_rotation_source: 'configured-public-jwks',
                implemented: false,
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            },
        )
    }

    if (endpoint === 'jwks' && features.identityFoundation.FEATURE_NEW_KEY_SERVICE) {
        const realm = request ? normalizeRealm(new URL(request.url).searchParams.get('realm')) : 'merchant'
        const jwks = configuredIdentityPublicJwks(realm)
        if (!jwks) {
            return NextResponse.json(
                {
                    error: {
                        code: 'IDENTITY_JWKS_NOT_CONFIGURED',
                        message: 'Identity public JWKS is not configured.',
                    },
                    implemented: false,
                },
                {
                    status: 501,
                    headers: {
                        'Cache-Control': 'no-store',
                    },
                },
            )
        }

        return NextResponse.json(
            {
                ...jwks,
                realm,
                jwks_rotation_source: 'configured-public-jwks',
                implemented: false,
            },
            {
                headers: {
                    'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
                },
            },
        )
    }

    return NextResponse.json(
        {
            error: {
                code: 'IDENTITY_PROVIDER_NOT_CONFIGURED',
                message: `${endpoint} is not configured.`,
            },
        },
        {
            status: 501,
            headers: {
                'Cache-Control': 'no-store',
            },
        },
    )
}
