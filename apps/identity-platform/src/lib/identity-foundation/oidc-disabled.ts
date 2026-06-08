import { NextResponse } from 'next/server'
import { features } from '@/lib/config/features'

const MOCK_JWKS = {
    keys: [
        {
            kty: 'EC',
            kid: 'mock-merchant-active-es256-v1',
            use: 'sig',
            alg: 'ES256',
            crv: 'P-256',
            x: 'mock-x-coordinate',
            y: 'mock-y-coordinate',
        },
    ],
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
                mock: true,
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            },
        )
    }

    if (endpoint === 'jwks' && features.identityFoundation.FEATURE_NEW_KEY_SERVICE) {
        return NextResponse.json(
            {
                ...MOCK_JWKS,
                mock: true,
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
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
