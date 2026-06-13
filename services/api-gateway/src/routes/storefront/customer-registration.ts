// LB-12 — shopper registration route, extracted from customer-engagement-routes.ts to keep that file
// under the 1500-line route budget. The route is PUBLIC by necessity (a new shopper has no session);
// it is gated by per-IP rate-limit + Turnstile + the not-exists precondition (a token-less first
// password is only set when no credential exists yet — never an overwrite, so never a takeover).
// Issuer model preserved: customer HS256 session via CUSTOMER_SESSION_SECRET; no merchant/admin issuer.
import * as bcrypt from 'bcryptjs';
import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { enforceCustomerAuthRateLimit } from '../../middleware/rateLimit';
import {
    issueCustomerSession,
    LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS,
    LETBUYY_CUSTOMER_SESSION_COOKIE,
} from '@letbuyy/auth-core';
import type { AppContext, CustomerLifecycleBody, StoreCustomerAuthRow } from './customer-engagement-routes';

export interface CustomerRegistrationDeps {
    requireValidTurnstile: (c: AppContext, body: unknown) => Promise<Response | null>;
    normalizeEmail: (email: string) => string;
    publicCustomerProfile: (customer: StoreCustomerAuthRow) => Record<string, unknown>;
    buildCookie: (name: string, value: string, maxAgeSeconds: number, options?: { httpOnly?: boolean }) => string;
    randomCsrfToken: () => string;
    insertCustomerActivity: (c: AppContext, customerId: string, storeId: string, type: string, meta: Record<string, unknown>) => Promise<unknown>;
}

export function registerCustomerRegistrationRoute(
    router: Hono<{ Bindings: Env }>,
    deps: CustomerRegistrationDeps,
): void {
    const { requireValidTurnstile, normalizeEmail, publicCustomerProfile, buildCookie, randomCsrfToken, insertCustomerActivity } = deps;

    router.post('/customer/register', async (c) => {
        const body = await c.req.json() as CustomerLifecycleBody;

        if (!body.store_id || !body.email || !body.password) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email and password are required' } }, 400);
        }

        // Abuse-control order: rate-limit -> Turnstile -> DB -> bcrypt.
        const rateLimited = await enforceCustomerAuthRateLimit(c, {
            storeId: body.store_id,
            email: body.email,
            operation: 'customer-register',
        });
        if (rateLimited) return rateLimited;

        const turnstileRejected = await requireValidTurnstile(c, body);
        if (turnstileRejected) return turnstileRejected;

        if (body.password.length < 8 || body.password.length > 128) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Password must be 8 to 128 characters' } }, 400);
        }

        if (!c.env.CUSTOMER_SESSION_SECRET) {
            return c.json({ success: false, error: { code: 'CUSTOMER_SESSION_MISCONFIGURED', message: 'Customer session signing is not configured' } }, 500);
        }

        const db = getSupabaseAdmin(c);
        const email = normalizeEmail(body.email);

        // Not-exists precondition: a token-less first password is only safe when NO credential exists yet
        // (otherwise this would be an account takeover). Existing accounts must sign in / reset instead.
        const { data: existingCredential, error: credLookupError } = await db
            .from('customer_credentials')
            .select('id, password_hash')
            .eq('store_id', body.store_id)
            .eq('email_or_phone', email)
            .maybeSingle<{ id: string; password_hash?: string | null }>();

        if (credLookupError) {
            return c.json(dbFailureBody(), 500);
        }

        if (existingCredential?.password_hash) {
            return c.json({ success: false, error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists. Please sign in.' } }, 409);
        }

        const passwordHash = await bcrypt.hash(body.password, 10);

        const { data: existingCustomer } = await db
            .from('store_customers')
            .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
            .eq('store_id', body.store_id)
            .eq('email', email)
            .maybeSingle<StoreCustomerAuthRow>();

        if (existingCustomer?.status === 'disabled') {
            return c.json({ success: false, error: { code: 'CUSTOMER_DISABLED', message: 'Account is disabled. Contact the store for assistance.' } }, 403);
        }

        let customer: StoreCustomerAuthRow;
        if (existingCustomer) {
            const { data: updated, error: updateError } = await db
                .from('store_customers')
                .update({
                    password_hash: passwordHash,
                    status: 'active',
                    full_name: body.full_name ?? existingCustomer.full_name,
                    phone: body.phone ?? existingCustomer.phone,
                })
                .eq('id', existingCustomer.id)
                .eq('store_id', body.store_id)
                .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
                .single<StoreCustomerAuthRow>();
            if (updateError || !updated) return c.json(dbFailureBody(), 500);
            customer = updated;
        } else {
            const { data: created, error: createError } = await db
                .from('store_customers')
                .insert({
                    store_id: body.store_id,
                    email,
                    full_name: body.full_name || null,
                    phone: body.phone || null,
                    status: 'active',
                    password_hash: passwordHash,
                })
                .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
                .single<StoreCustomerAuthRow>();
            if (createError || !created) return c.json(dbFailureBody(), 500);
            customer = created;
        }

        if (existingCredential) {
            const { error: credErr } = await db
                .from('customer_credentials')
                .update({ password_hash: passwordHash })
                .eq('id', existingCredential.id)
                .eq('store_id', body.store_id);
            if (credErr) return c.json(dbFailureBody(), 500);
        } else {
            const { error: credErr } = await db
                .from('customer_credentials')
                .insert({ store_id: body.store_id, email_or_phone: email, password_hash: passwordHash });
            if (credErr) return c.json(dbFailureBody(), 500);
        }

        await insertCustomerActivity(c, customer.id, body.store_id, 'registered', { method: 'password' });

        const issuedSession = await issueCustomerSession(
            { storeId: body.store_id, customerId: customer.id },
            c.env.CUSTOMER_SESSION_SECRET,
        );
        const csrfToken = randomCsrfToken();
        const response = c.json(success({ customer: publicCustomerProfile(customer) }));
        response.headers.append(
            'Set-Cookie',
            buildCookie(LETBUYY_CUSTOMER_SESSION_COOKIE, issuedSession.token, LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS, { httpOnly: true }),
        );
        response.headers.append(
            'Set-Cookie',
            buildCookie('letbuyy_csrf', csrfToken, LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS),
        );
        response.headers.set('X-CSRF-Token', csrfToken);
        return response;
    });
}
