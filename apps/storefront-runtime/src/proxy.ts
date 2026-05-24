import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getThemePreviewCookieName, normalizeThemePreviewToken } from './lib/theme-preview-cookie'

export const config = {
    matcher: [
        '/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)',
    ],
}

export async function proxy(req: NextRequest) {
    const url = req.nextUrl
    const hostname = req.headers.get('host') || ''
    const path = url.pathname
    const previewToken = normalizeThemePreviewToken(url.searchParams.get('theme_preview_token'))

    if (path.startsWith('/store/') && path.split('/').filter(Boolean).length >= 2) {
        const subdomain = path.split('/').filter(Boolean)[1]
        return withPreviewCookie(NextResponse.next(), subdomain, previewToken)
    }

    let subdomain = ''
    const cfSubdomain = req.headers.get('x-store-subdomain')
    const forwardedHost = req.headers.get('x-forwarded-host')

    if (cfSubdomain && cfSubdomain.trim() !== '') {
        subdomain = cfSubdomain.trim()
    } else if (forwardedHost && forwardedHost.endsWith('.letbuyy.store')) {
        subdomain = forwardedHost.split('.')[0]
    } else if (hostname.endsWith('.letbuyy.store') && !hostname.startsWith('www.')) {
        const parts = hostname.split('.')
        if (parts.length >= 3) {
            subdomain = parts[0]
        }
    } else if (hostname.includes('localhost')) {
        const parts = hostname.split('.')
        if (parts.length > 1) {
            subdomain = parts[0]
        }
    } else if (hostname.includes('vercel.app') && (path === '/' || path === '')) {
        return NextResponse.next()
    }

    if (subdomain === 'storefront') {
        return NextResponse.next()
    }

    if (subdomain) {
        return withPreviewCookie(
            NextResponse.rewrite(new URL(`/store/${subdomain}${path}`, req.url)),
            subdomain,
            previewToken,
        )
    }

    return NextResponse.next()
}

function withPreviewCookie(response: NextResponse, subdomain: string, token: string): NextResponse {
    if (!token || !subdomain) return response

    response.cookies.set(getThemePreviewCookieName(subdomain), token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60,
        path: '/',
    })

    return response
}
