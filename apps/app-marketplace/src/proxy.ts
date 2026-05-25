import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/my-apps', '/developers/register', '/developers/dashboard', '/developers/apps']
const PROTECTED_API_ROUTES = ['/api/apps/install', '/api/developers']

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const session = request.cookies.get('lb_session')?.value

    const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
    if (isProtected && !session) {
        const loginUrl = new URL('https://accounts.letbuyy.store/login')
        loginUrl.searchParams.set('redirect', request.url)
        return NextResponse.redirect(loginUrl)
    }

    const isProtectedApi = PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route))
    if (isProtectedApi && !session) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        )
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
