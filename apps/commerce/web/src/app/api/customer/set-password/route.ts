// POST /api/customer/set-password — request or complete a store-scoped password reset.
import { NextRequest, NextResponse } from 'next/server';
import { createStorefrontApiClient } from '@/lib/api/client';
import { isSameOriginRequest } from '@/lib/buyer-auth/flow';
import { createSession } from '@/lib/session';
import { resolveStorefrontAccessContext } from '@/lib/storefront-access';
import { isInvalidCustomerResetError } from '@/lib/customer-reset-errors';

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function json(body: Record<string, unknown>, status = 200) {
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
    if (!isSameOriginRequest(request.headers, request.url)) {
        return json({ error: 'This request could not be verified.' }, 403);
    }

    try {
        const raw: unknown = await request.json();
        const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const action = stringValue(body.action);
        const email = stringValue(body.email);
        const password = typeof body.password === 'string' ? body.password : '';
        const storeId = stringValue(body.storeId);
        const resetToken = stringValue(body.resetToken);

        if (!email || !storeId || (action !== 'request_reset' && (!password || !resetToken))) {
            return json({ error: 'Required password reset fields are missing.' }, 400);
        }
        if (email.length > 256 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ error: 'Enter a valid email address.' }, 400);
        }

        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
        const site = await resolveStorefrontAccessContext(host);
        if (!site || site.site_id.toLowerCase() !== storeId.toLowerCase()) {
            return json({ error: 'This request could not be verified for this store.' }, 403);
        }

        const storefront = createStorefrontApiClient().storefront;
        if (action === 'request_reset') {
            await storefront.requestCustomerPasswordReset({
                store_id: site.site_id,
                email,
                reset_url: stringValue(body.resetUrl) || null,
            });
            return json({ success: true, accepted: true });
        }

        if (password.length < 8 || password.length > 128) {
            return json({ error: 'Password must be between 8 and 128 characters.' }, 400);
        }

        const { customer } = await storefront.confirmCustomerPasswordReset({
            store_id: site.site_id,
            email,
            token: resetToken,
            password,
        });
        if (!customer) return json({ error: 'Reset link is invalid or expired.' }, 400);

        const customerId = stringValue(customer.id);
        const customerStoreId = stringValue(customer.store_id);
        const customerEmail = stringValue(customer.email);
        const fullName = stringValue(customer.full_name) || null;
        if (!customerId || customerStoreId.toLowerCase() !== site.site_id.toLowerCase() || !customerEmail) {
            return json({ error: 'Could not create a store account session.' }, 502);
        }

        await createSession({ id: customerId, storeId: site.site_id, email: customerEmail, fullName });
        return json({
            success: true,
            customer: { id: customerId, email: customerEmail, fullName, storeId: site.site_id },
        });
    } catch (error) {
        if (isInvalidCustomerResetError(error)) {
            return json({ error: 'Reset link is invalid or expired.' }, 400);
        }
        // Avoid logging request payloads, reset tokens, or provider error details.
        return json({ error: 'Password reset is temporarily unavailable. Please try again.' }, 500);
    }
}
