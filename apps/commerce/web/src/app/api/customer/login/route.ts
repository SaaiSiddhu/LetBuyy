// POST /api/customer/login — Authenticate with email/password.
// D10 (E8): Adds no-JS form support mirroring /api/customer/register (D10 pattern).
// JSON path (React islands) is unchanged. Form path (application/x-www-form-urlencoded)
// bounces back to the referring page with query params on error, or redirects to /account on success.
import { NextRequest, NextResponse } from 'next/server';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { createStorefrontApiClient } from '@/lib/api/client';
import { isSameOriginRequest } from '@/lib/buyer-auth/flow';
import { customerSessionMatchesRequestStore } from '@/lib/customer-session-store-scope';
import { createSession } from '@/lib/session';
import { resolveStorefrontAccessContext } from '@/lib/storefront-access';

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

// The Liquid customers/login template submits a plain HTML form (application/x-www-form-urlencoded)
// when JavaScript is unavailable; the React path and lb-* islands send JSON. Both must work.
function isFormPost(request: NextRequest): boolean {
    const contentType = request.headers.get('content-type') || '';
    return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

// No-JS form flow: bounce back to the referring page (same-origin only) with query feedback.
function formRedirect(request: NextRequest, params: Record<string, string>): NextResponse {
    let target = '/customers/login';
    const referer = request.headers.get('referer');
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            if (refererUrl.origin === new URL(request.url).origin) target = refererUrl.pathname;
        } catch { /* keep default target */ }
    }
    const url = new URL(target, request.url);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
}

// T1/W2: see the identical helper in register/route.ts for why a bare /account 404s once the login
// form is reached through the store-prefixed Liquid path.
function accountRedirectUrl(request: NextRequest): URL {
    const referer = request.headers.get('referer');
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            if (refererUrl.origin === new URL(request.url).origin) {
                const storeMatch = refererUrl.pathname.match(/^\/store\/[^/]+/);
                if (storeMatch) return new URL(`${storeMatch[0]}/account`, request.url);
            }
        } catch { /* fall through to the bare default below */ }
    }
    return new URL('/account', request.url);
}

export async function POST(request: NextRequest) {
    const formPost = isFormPost(request);
    if (!isSameOriginRequest(request.headers, request.url)) {
        return NextResponse.json({ error: 'This request could not be verified.' }, {
            status: 403,
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    try {
        let raw: unknown;
        if (formPost) {
            const form = await request.formData();
            raw = {
                email: form.get('email'),
                password: form.get('password'),
                storeId: form.get('storeId'),
                turnstileToken: form.get('turnstileToken'),
            };
        } else {
            raw = await request.json();
        }
        const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const email = stringValue(body.email);
        const password = stringValue(body.password);
        const storeId = stringValue(body.storeId);
        const turnstileToken = stringValue(body.turnstileToken) || null;

        if (!email || !password || !storeId) {
            if (formPost) return formRedirect(request, { error: 'missing_fields' });
            return NextResponse.json(
                { error: 'Email, password, and storeId are required' },
                { status: 400 }
            );
        }

        const storeMatchesHost = await customerSessionMatchesRequestStore({
            headers: request.headers,
            storeId,
            resolveStoreIdForHost: async host => (await resolveStorefrontAccessContext(host))?.site_id ?? null,
        });
        if (!storeMatchesHost) {
            if (formPost) {
                const response = formRedirect(request, { error: 'login_failed' });
                response.headers.set('Cache-Control', 'no-store');
                return response;
            }
            return NextResponse.json(
                { error: 'This request could not be verified for this store.' },
                { status: 403, headers: { 'Cache-Control': 'no-store' } },
            );
        }

        const { customer } = await createStorefrontApiClient()
            .storefront
            .verifyCustomerPassword({
                store_id: storeId,
                email,
                password,
                turnstile_token: turnstileToken,
            });

        if (!customer) {
            if (formPost) return formRedirect(request, { error: 'invalid_credentials' });
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        const customerId = stringValue(customer.id);
        const customerStoreId = stringValue(customer.store_id || storeId);
        const customerEmail = stringValue(customer.email || email);
        const fullName = stringValue(customer.full_name) || null;

        if (!customerId || !customerStoreId || !customerEmail) {
            if (formPost) return formRedirect(request, { error: 'invalid_credentials' });
            return NextResponse.json({ error: 'Invalid customer session response' }, { status: 502 });
        }

        await createSession({
            id: customerId,
            storeId: customerStoreId,
            email: customerEmail,
            fullName,
        });

        if (formPost) {
            return NextResponse.redirect(accountRedirectUrl(request), 303);
        }

        return NextResponse.json({
            success: true,
            customer: {
                id: customerId,
                email: customerEmail,
                fullName,
                storeId: customerStoreId,
            },
        });
    } catch (error: unknown) {
        if (
            error instanceof LetbuyyApiError &&
            (error.status === 403 || error.status === 429 || error.status === 503)
        ) {
            const code = error.code;
            const message = code === 'CUSTOMER_AUTH_RATE_LIMITED'
                ? 'Too many login attempts. Please try again later.'
                : code === 'TURNSTILE_REQUIRED'
                    ? 'Bot verification failed'
                    : error.message || 'Login temporarily unavailable';
            if (formPost) {
                return formRedirect(request, {
                    error: code === 'CUSTOMER_AUTH_RATE_LIMITED' ? 'rate_limited' : 'login_failed',
                });
            }
            return NextResponse.json({ error: message, code }, { status: error.status });
        }

        // 401 from the gateway means invalid credentials (verifyCustomerPassword contract)
        if (error instanceof LetbuyyApiError && error.status === 401) {
            if (formPost) return formRedirect(request, { error: 'invalid_credentials' });
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        if (error instanceof Error && error.message.includes('disabled')) {
            if (formPost) return formRedirect(request, { error: 'login_failed' });
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        console.error('[API] /customer/login error:', error);
        if (formPost) return formRedirect(request, { error: 'login_failed' });
        return NextResponse.json(
            { error: 'Login failed' },
            { status: 500 }
        );
    }
}
