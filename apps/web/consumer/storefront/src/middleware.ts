import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
    matcher: [
        /*
         * Match all paths except for:
         * 1. /api routes
         * 2. /_next (Next.js internals)
         * 3. /_static (inside /public)
         * 4. all root files inside /public (e.g. /favicon.ico)
         */
        '/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)',
    ],
};

export default async function middleware(req: NextRequest) {
    const url = req.nextUrl;
    const hostname = req.headers.get('host') || '';
    const path = url.pathname;

    console.log(`[Middleware] Host: ${hostname}, Path: ${path}`);

    // 0. Allow direct /store/[subdomain] path access for testing (Vercel/localhost)
    // This allows: letbuyy-storefront.vercel.app/store/dohi to work
    if (path.startsWith('/store/') && path.split('/').filter(Boolean).length >= 2) {
        console.log(`[Middleware] Path-based store access allowed: ${path}`);
        return NextResponse.next();
    }

    let subdomain = '';

    // 1. Cloudflare Worker: Check X-Store-Subdomain or X-Forwarded-Host header
    const cfSubdomain = req.headers.get('x-store-subdomain');
    const forwardedHost = req.headers.get('x-forwarded-host');

    if (cfSubdomain && cfSubdomain.trim() !== '') {
        subdomain = cfSubdomain.trim();
        console.log(`[Middleware] CF Worker subdomain from header: ${subdomain}`);
    } else if (forwardedHost && forwardedHost.endsWith('.letbuyy.store')) {
        // Extract subdomain from X-Forwarded-Host (e.g., "dohi.letbuyy.store" -> "dohi")
        subdomain = forwardedHost.split('.')[0];
        console.log(`[Middleware] CF Worker subdomain from X-Forwarded-Host: ${subdomain}`);
    }
    // 2. Subdomain access: {store}.letbuyy.store (ONLY valid method)
    else if (hostname.endsWith('.letbuyy.store') && !hostname.startsWith('www.')) {
        const parts = hostname.split('.');
        // mystore.letbuyy.store -> parts=['mystore', 'letbuyy', 'store']
        if (parts.length >= 3) {
            subdomain = parts[0];
            console.log(`[Middleware] Subdomain detected: ${subdomain}`);
        }
    }
    // 3. Localhost development: {store}.localhost:3000
    else if (hostname.includes('localhost')) {
        const parts = hostname.split('.');
        // test.localhost:3000 -> parts=['test', 'localhost:3000']
        if (parts.length > 1) {
            subdomain = parts[0];
            console.log(`[Middleware] Localhost subdomain: ${subdomain}`);
        }
    }
    // 4. Vercel direct access (vercel.app domain): show root page or redirect
    else if (hostname.includes('vercel.app')) {
        if (path === '/' || path === '') {
            console.log(`[Middleware] Vercel root access, showing landing page`);
            return NextResponse.next();
        }
    }

    // If subdomain is 'storefront', show the landing page (don't rewrite to a store)
    // storefront.letbuyy.store is the landing page URL
    if (subdomain === 'storefront') {
        console.log(`[Middleware] Storefront landing page subdomain, showing root`);
        return NextResponse.next();
    }

    // If we have a store subdomain, rewrite to /store/[subdomain]/[path]
    if (subdomain) {
        const rewriteUrl = `/store/${subdomain}${path}`;
        console.log(`[Middleware] Rewriting to: ${rewriteUrl}`);
        return NextResponse.rewrite(new URL(rewriteUrl, req.url));
    }

    // No store found
    // In development: rewrite bare store paths to /store/demo/...
    // But NOT the root path — root shows the landing page
    if (hostname.includes('localhost')) {
        const storeRoutes = ['/cart', '/checkout', '/product', '/products', '/orders', '/shop', '/privacy', '/returns', '/shipping', '/terms'];
        const isStoreRoute = storeRoutes.some(r => path === r || path.startsWith(r + '/'));

        if (isStoreRoute) {
            const rewriteUrl = `/store/demo${path}`;
            console.log(`[Middleware] Dev fallback → ${rewriteUrl}`);
            return NextResponse.rewrite(new URL(rewriteUrl, req.url));
        }
    }

    console.log(`[Middleware] No store subdomain, showing landing page`);
    return NextResponse.next();
}
