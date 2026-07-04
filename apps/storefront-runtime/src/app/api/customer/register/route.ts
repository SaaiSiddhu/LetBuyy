// POST /api/customer/register — Create a shopper account (LB-12). Mirrors /customer/login: calls the
// gateway's token-less first-password register, then re-mints the HS256 customer session locally
// (gateway IDs-only token fails isCustomerSessionPayload). No identity-platform / ES256 involvement.
import { NextRequest, NextResponse } from 'next/server';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { createStorefrontApiClient } from '@/lib/api/client';
import { createSession } from '@/lib/session';

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

// The Liquid customers/register template submits a plain HTML form (application/x-www-form-urlencoded)
// when JavaScript is unavailable; the React path and lb-* islands send JSON. Both must work.
function isFormPost(request: NextRequest): boolean {
    const contentType = request.headers.get('content-type') || '';
    return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

// No-JS form flow: bounce back to the referring page (same-origin only) with query feedback.
function formRedirect(request: NextRequest, params: Record<string, string>): NextResponse {
    let target = '/customers/register';
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

export async function POST(request: NextRequest) {
    const formPost = isFormPost(request);
    try {
        let raw: unknown;
        if (formPost) {
            const form = await request.formData();
            raw = {
                email: form.get('email'),
                password: form.get('password'),
                storeId: form.get('storeId'),
                fullName: form.get('fullName') ?? form.get('name'),
                turnstileToken: form.get('turnstileToken'),
            };
        } else {
            raw = await request.json();
        }
        const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const email = stringValue(body.email);
        const password = stringValue(body.password);
        const storeId = stringValue(body.storeId);
        const fullName = stringValue(body.fullName) || null;
        const turnstileToken = stringValue(body.turnstileToken) || null;

        if (!email || !password || !storeId) {
            if (formPost) return formRedirect(request, { error: 'missing_fields' });
            return NextResponse.json(
                { error: 'Email, password, and storeId are required' },
                { status: 400 }
            );
        }

        const { customer } = await createStorefrontApiClient()
            .storefront
            .registerCustomer({
                store_id: storeId,
                email,
                password,
                full_name: fullName,
                turnstile_token: turnstileToken,
            });

        if (!customer) {
            if (formPost) return formRedirect(request, { error: 'registration_failed' });
            return NextResponse.json({ error: 'Registration failed' }, { status: 502 });
        }

        const customerId = stringValue(customer.id);
        const customerStoreId = stringValue(customer.store_id || storeId);
        const customerEmail = stringValue(customer.email || email);
        const name = stringValue(customer.full_name) || null;

        if (!customerId || !customerStoreId || !customerEmail) {
            if (formPost) return formRedirect(request, { error: 'registration_failed' });
            return NextResponse.json({ error: 'Invalid customer session response' }, { status: 502 });
        }

        await createSession({
            id: customerId,
            storeId: customerStoreId,
            email: customerEmail,
            fullName: name,
        });

        if (formPost) {
            return NextResponse.redirect(new URL('/account', request.url), 303);
        }

        return NextResponse.json({
            success: true,
            customer: { id: customerId, email: customerEmail, fullName: name, storeId: customerStoreId },
        });
    } catch (error: unknown) {
        if (error instanceof LetbuyyApiError) {
            if (error.status === 409 || error.code === 'ACCOUNT_EXISTS') {
                if (formPost) return formRedirect(request, { error: 'account_exists' });
                return NextResponse.json(
                    { error: 'An account with this email already exists. Please sign in.', code: 'ACCOUNT_EXISTS' },
                    { status: 409 }
                );
            }
            if (error.status === 403 || error.status === 429 || error.status === 400) {
                const message = error.code === 'CUSTOMER_AUTH_RATE_LIMITED'
                    ? 'Too many attempts. Please try again later.'
                    : error.code === 'TURNSTILE_REQUIRED'
                        ? 'Bot verification failed'
                        : error.message || 'Registration temporarily unavailable';
                if (formPost) {
                    return formRedirect(request, {
                        error: error.code === 'CUSTOMER_AUTH_RATE_LIMITED'
                            ? 'rate_limited'
                            : error.code === 'TURNSTILE_REQUIRED' ? 'bot_verification' : 'registration_failed',
                    });
                }
                return NextResponse.json({ error: message, code: error.code }, { status: error.status });
            }
        }
        console.error('[API] /customer/register error:', error);
        if (formPost) return formRedirect(request, { error: 'registration_failed' });
        return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }
}
