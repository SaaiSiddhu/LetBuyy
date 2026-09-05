import { Hono, type Context } from 'hono';
import * as bcrypt from 'bcryptjs';
import type { Env } from '../../index';
import { hmacSha256Hex } from '../../lib/crypto';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { verifyInternalAppRequest } from '../../lib/internal-auth';
import { validate } from '../../middleware/validation';
import { getCustomerSession } from '../../middleware/customer-session';
import { enforceCustomerAuthRateLimit } from '../../middleware/rateLimit';
import { CreateStorefrontProductReviewSchema, type CreateStorefrontProductReviewInput } from '../../schemas/review.schema';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import { issueCustomerSession, LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS, LETBUYY_CUSTOMER_SESSION_COOKIE } from '@letbuyy/auth-core';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';
import { registerCustomerRegistrationRoute } from './customer-registration';
import { registerCustomerAddressRoutes } from './customer-address-routes';
import { registerBuyerAccountRoutes, BUYER_ACCOUNT_COLUMNS } from './buyer-account-routes';

export type AppContext = Context<{ Bindings: Env }>;
type SqlRecord = Record<string, unknown>;
type DatabaseErrorLike = { message?: string; details?: string; hint?: string } | null | undefined;
const CUSTOMER_PASSWORD_RESET_TTL_SECONDS = 60 * 60; const CUSTOMER_PASSWORD_RESET_TOKEN_BYTES = 32;

export type StorefrontCustomerEngagementDependencies = {
    loadPublishedStore: (c: AppContext, subdomain: string) => Promise<PublishedStoreRecord | null>;
    hydrateStorefrontOrderItems: (c: AppContext, orders: SqlRecord[]) => Promise<SqlRecord[]>;
    orderItemsRelationalReadsEnabled: (env: Pick<Env, 'ORDER_ITEMS_RELATIONAL_READS'>) => boolean;
    isMissingColumnError: (error: DatabaseErrorLike, columnName: string) => boolean;
    isMissingTableError: (error: DatabaseErrorLike, tableName: string) => boolean;
    requireValidTurnstile: (c: AppContext, body: unknown) => Promise<Response | null>;
};

type CustomerWishlistBody = {
    customer_id?: string;
    store_id?: string;
    product_id?: string;
    variant_id?: string | null;
};

type CustomerWishlistSyncBody = {
    customer_id?: string;
    store_id?: string;
    product_ids?: string[];
};

type CustomerActivityBody = {
    customer_id?: string;
    store_id?: string;
    activity_type?: string;
    metadata?: Record<string, unknown>;
};

export type CustomerLifecycleBody = {
    customer_id?: string;
    store_id?: string;
    subdomain?: string;
    email?: string;
    email_or_phone?: string;
    full_name?: string | null;
    phone?: string | null;
    password_hash?: string;
    password?: string;
    token?: string;
    reset_token?: string;
    reset_url?: string | null;
    turnstile_token?: string | null;
    turnstileToken?: string | null;
    order_total?: number | string;
    order_id?: string;
};

export type StoreCustomerAuthRow = {
    id: string;
    store_id: string;
    email: string;
    full_name?: string | null;
    phone?: string | null;
    status?: string | null;
    password_hash?: string | null;
    login_count?: number | string | null;
    accepts_marketing?: boolean | null;
    updated_at?: string | null;
};

export type VerifiedStoreCustomer = { id: string; store_id: string; email: string };

type CustomerProfileBody = {
    customer_id?: string;
    store_id?: string;
    full_name?: string | null;
    phone?: string | null;
    accepts_marketing?: boolean;
};

export type CustomerAddressBody = {
    customer_id?: string;
    store_id?: string;
    customer_email?: string;
    customer_phone?: string | null;
    label?: string | null;
    full_name?: string;
    address_line1?: string;
    address_line2?: string | null;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string | null;
    landmark?: string | null;
    is_default?: boolean;
};

type StorefrontReviewBody = CreateStorefrontProductReviewInput;

async function getVerifiedStoreCustomer(c: AppContext, storeId: string, customerId: string): Promise<VerifiedStoreCustomer | null> {
    const session = getCustomerSession(c);
    if (session) {
        if (session.storeId !== storeId || session.customerId !== customerId) {
            return null;
        }
    } else {
        return null;
    }

    const db = getSupabaseAdmin(c);
    const { data } = await db
        .from('store_customers')
        .select('id, store_id, email')
        .eq('id', customerId)
        .eq('store_id', storeId)
        .single<VerifiedStoreCustomer>();

    return data || null;
}

async function verifyStoreCustomer(c: AppContext, storeId: string, customerId: string): Promise<boolean> {
    return Boolean(await getVerifiedStoreCustomer(c, storeId, customerId));
}

function normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
}

function normalizeContact(value: string): string {
    return value.toLowerCase().trim();
}

async function requireStorefrontInternal(c: AppContext): Promise<Response | null> {
    if (await verifyInternalAppRequest(c, 'storefront')) return null;

    return c.json(
        {
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid internal storefront signature',
            },
        },
        401,
    );
}

function publicCustomerProfile(customer: StoreCustomerAuthRow): Record<string, unknown> {
    return {
        id: customer.id,
        store_id: customer.store_id,
        email: customer.email,
        full_name: customer.full_name || null,
        phone: customer.phone || null,
        status: customer.status || 'active',
        accepts_marketing: Boolean(customer.accepts_marketing),
        updated_at: customer.updated_at || null,
    };
}

function buildCookie(name: string, value: string, maxAgeSeconds: number, options: { httpOnly?: boolean } = {}): string {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        'Path=/',
        `Max-Age=${maxAgeSeconds}`,
        `Expires=${new Date(Date.now() + maxAgeSeconds * 1000).toUTCString()}`,
        'SameSite=Lax',
        'Secure',
    ];

    if (options.httpOnly) parts.push('HttpOnly');
    return parts.join('; ');
}

function randomCsrfToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomUrlSafeToken(byteCount: number): string {
    const bytes = new Uint8Array(byteCount);
    crypto.getRandomValues(bytes);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizePasswordResetToken(value: string | null | undefined): string | null {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (
        !normalized ||
        normalized !== value ||
        normalized.length < 24 ||
        normalized.length > 256 ||
        !/^[A-Za-z0-9._~-]+$/.test(normalized)
    ) {
        return null;
    }

    return normalized;
}

async function hashCustomerPasswordResetToken(
    secret: string,
    storeId: string,
    email: string,
    token: string
): Promise<string> {
    return hmacSha256Hex(secret, `customer-password-reset.${storeId}.${normalizeEmail(email)}.${token}`);
}

function customerPasswordResetBaseUrl(c: AppContext): string {
    return c.env.CUSTOMER_PASSWORD_RESET_URL
        || c.env.STOREFRONT_BASE_URL
        || c.env.NEXT_PUBLIC_STOREFRONT_URL
        || 'https://store.letbuyy.com/account/reset-password';
}

function customerPasswordResetUrl(c: AppContext, storeId: string, email: string, token: string, requestedUrl?: string | null): string {
    const base = requestedUrl || customerPasswordResetBaseUrl(c);

    try {
        const url = new URL(base);
        if (url.pathname === '/' || !url.pathname) {
            url.pathname = '/account/reset-password';
        }
        url.searchParams.set('store_id', storeId);
        url.searchParams.set('email', normalizeEmail(email));
        url.searchParams.set('token', token);
        return url.toString();
    } catch {
        const url = new URL('https://store.letbuyy.com/account/reset-password');
        url.searchParams.set('store_id', storeId);
        url.searchParams.set('email', normalizeEmail(email));
        url.searchParams.set('token', token);
        return url.toString();
    }
}

function isConfiguredResetEmailProvider(c: AppContext): boolean {
    const apiKey = c.env.RESEND_API_KEY;
    return Boolean(apiKey && !apiKey.toLowerCase().includes('replace-with') && !apiKey.toLowerCase().includes('placeholder'));
}

async function sendCustomerPasswordResetEmail(
    c: AppContext,
    input: { email: string; fullName?: string | null; resetUrl: string; expiresAt: string }
): Promise<void> {
    if (!isConfiguredResetEmailProvider(c)) return;

    const recipientName = input.fullName?.trim() || 'there';
    const from = c.env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>';
    const subject = 'Reset your LetBuyy store password';
    const text = [
        `Hi ${recipientName},`,
        '',
        'Use this link to reset your customer account password:',
        input.resetUrl,
        '',
        `This link expires at ${input.expiresAt}. If you did not request it, ignore this email.`,
    ].join('\n');

    await sendResendEmail({
        apiKey: c.env.RESEND_API_KEY,
        from,
        to: input.email,
        subject,
        text,
    }).catch(() => undefined);
}

async function insertCustomerActivity(
    c: AppContext,
    customerId: string,
    storeId: string,
    activityType: string,
    metadata: Record<string, unknown>
): Promise<void> {
    const db = getSupabaseAdmin(c);
    await db.from('customer_activity_log').insert({
        customer_id: customerId,
        store_id: storeId,
        activity_type: activityType,
        metadata,
    });
}

async function resolveCredentialStoreId(
    c: AppContext,
    body: CustomerLifecycleBody,
    loadPublishedStore: StorefrontCustomerEngagementDependencies['loadPublishedStore'],
): Promise<string | null> {
    if (body.store_id) return body.store_id;
    if (!body.subdomain) return null;

    const store = await loadPublishedStore(c, body.subdomain);
    return store?.id || null;
}

export function registerStorefrontCustomerEngagementRoutes(
    router: Hono<{ Bindings: Env }>,
    dependencies: StorefrontCustomerEngagementDependencies,
): void {
    const {
        loadPublishedStore,
        hydrateStorefrontOrderItems,
        orderItemsRelationalReadsEnabled,
        isMissingColumnError,
        isMissingTableError,
        requireValidTurnstile,
    } = dependencies;

    router.post('/customer/find-or-create', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json() as CustomerLifecycleBody;

        if (!body.store_id || !body.email) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const email = normalizeEmail(body.email);
        const { data: existing, error: existingError } = await db
            .from('store_customers')
            .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
            .eq('store_id', body.store_id)
            .eq('email', email)
            .maybeSingle<StoreCustomerAuthRow>();

        if (existingError) {
            return c.json(dbFailureBody(), 500);
        }

        if (existing) {
            const updates: Record<string, unknown> = {};
            if (body.full_name && !existing.full_name) updates.full_name = body.full_name;
            if (body.phone && !existing.phone) updates.phone = body.phone;

            if (!Object.keys(updates).length) {
                return c.json(success({ customer: publicCustomerProfile(existing), created: false }));
            }

            const { data: updated, error } = await db
                .from('store_customers')
                .update(updates)
                .eq('id', existing.id)
                .eq('store_id', body.store_id)
                .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
                .single<StoreCustomerAuthRow>();

            if (error) {
                return c.json(dbFailureBody(), 500);
            }

            return c.json(success({ customer: publicCustomerProfile(updated), created: false }));
        }

        const { data: created, error } = await db
            .from('store_customers')
            .insert({
                store_id: body.store_id,
                email,
                full_name: body.full_name || null,
                phone: body.phone || null,
                status: 'active',
                password_hash: null,
            })
            .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
            .single<StoreCustomerAuthRow>();

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        await insertCustomerActivity(c, created.id, body.store_id, 'account_created', { source: 'checkout' });
        return c.json(success({ customer: publicCustomerProfile(created), created: true }), 201);
    });

    router.post('/customer/password', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json() as CustomerLifecycleBody;

        if (!body.store_id || !body.email || (!body.password && !body.password_hash)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email and password are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const passwordHash = body.password
            ? await bcrypt.hash(body.password, 10)
            : body.password_hash;

        const { data, error } = await db
            .from('store_customers')
            .update({
                status: 'active',
            })
            .eq('store_id', body.store_id)
            .eq('email', normalizeEmail(body.email))
            .select('id')
            .single();

        if (error || !data) {
            return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
        }

        const { error: credentialError } = await db
            .from('customer_credentials')
            .upsert(
                {
                    store_id: body.store_id,
                    email_or_phone: normalizeEmail(body.email),
                    password_hash: passwordHash,
                    customer_id: data.id,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'store_id,email_or_phone' },
            );

        if (credentialError) {
            return c.json({ success: false, error: { code: 'CREDENTIAL_ERROR', message: 'Unable to save customer credential' } }, 500);
        }

        await insertCustomerActivity(c, data.id, body.store_id, 'password_set', {});
        return c.json(success({ customer_id: data.id }));
    });

    router.post('/customer/password/request-reset', async (c) => {
        const body = await c.req.json() as CustomerLifecycleBody;

        if (!body.store_id || !body.email) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
        }

        const rateLimited = await enforceCustomerAuthRateLimit(c, {
            storeId: body.store_id,
            email: body.email,
            operation: 'customer-password-request-reset',
        });
        if (rateLimited) return rateLimited;

        if (!c.env.CUSTOMER_SESSION_SECRET) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'CUSTOMER_RESET_MISCONFIGURED',
                        message: 'Customer reset signing is not configured',
                    },
                },
                500,
            );
        }

        const db = getSupabaseAdmin(c);
        const email = normalizeEmail(body.email);
        const { data: customer, error: customerError } = await db
            .from('store_customers')
            .select('id, store_id, email, full_name, status')
            .eq('store_id', body.store_id)
            .eq('email', email)
            .maybeSingle<StoreCustomerAuthRow>();

        if (customerError) {
            return c.json(dbFailureBody(), 500);
        }

        if (!customer || customer.status === 'disabled') {
            return c.json(success({ accepted: true }));
        }

        const token = randomUrlSafeToken(CUSTOMER_PASSWORD_RESET_TOKEN_BYTES);
        const tokenHash = await hashCustomerPasswordResetToken(c.env.CUSTOMER_SESSION_SECRET, body.store_id, email, token);
        const expiresAt = new Date(Date.now() + CUSTOMER_PASSWORD_RESET_TTL_SECONDS * 1000).toISOString();

        const { error: credentialError } = await db
            .from('customer_credentials')
            .upsert(
                {
                    store_id: body.store_id,
                    email_or_phone: email,
                    reset_token_hash: tokenHash,
                    reset_expires_at: expiresAt,
                    reset_used_at: null,
                },
                { onConflict: 'store_id,email_or_phone' },
            );

        if (credentialError) {
            return c.json(dbFailureBody(), 500);
        }

        await sendCustomerPasswordResetEmail(c, {
            email,
            fullName: customer.full_name,
            resetUrl: customerPasswordResetUrl(c, body.store_id, email, token, body.reset_url),
            expiresAt,
        });

        await insertCustomerActivity(c, customer.id, body.store_id, 'password_reset_requested', {});
        return c.json(success({ accepted: true }));
    });

    router.post('/customer/password/confirm-reset', async (c) => {
        const body = await c.req.json() as CustomerLifecycleBody;
        const resetToken = normalizePasswordResetToken(body.token || body.reset_token);

        if (!body.store_id || !body.email || !body.password || !resetToken) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email, reset token and password are required' } }, 400);
        }

        const rateLimited = await enforceCustomerAuthRateLimit(c, {
            storeId: body.store_id,
            email: body.email,
            operation: 'customer-password-confirm-reset',
        });
        if (rateLimited) return rateLimited;

        if (body.password.length < 8 || body.password.length > 128) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Password must be 8 to 128 characters' } }, 400);
        }

        if (!c.env.CUSTOMER_SESSION_SECRET) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'CUSTOMER_RESET_MISCONFIGURED',
                        message: 'Customer reset signing is not configured',
                    },
                },
                500,
            );
        }

        const db = getSupabaseAdmin(c);
        const email = normalizeEmail(body.email);
        const tokenHash = await hashCustomerPasswordResetToken(c.env.CUSTOMER_SESSION_SECRET, body.store_id, email, resetToken);
        const now = new Date().toISOString();
        const { data: credential, error: credentialError } = await db
            .from('customer_credentials')
            .select('id')
            .eq('store_id', body.store_id)
            .eq('email_or_phone', email)
            .eq('reset_token_hash', tokenHash)
            .is('reset_used_at', null)
            .gt('reset_expires_at', now)
            .maybeSingle<{ id: string }>();

        if (credentialError) {
            return c.json(dbFailureBody(), 500);
        }

        if (!credential) {
            return c.json({ success: false, error: { code: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired' } }, 400);
        }

        const passwordHash = await bcrypt.hash(body.password, 10);
        const { data: customer, error: customerError } = await db
            .from('store_customers')
            .update({
                password_hash: passwordHash,
                status: 'active',
            })
            .eq('store_id', body.store_id)
            .eq('email', email)
            .neq('status', 'disabled')
            .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
            .single<StoreCustomerAuthRow>();

        if (customerError || !customer) {
            return c.json({ success: false, error: { code: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired' } }, 400);
        }

        const { error: consumeError } = await db
            .from('customer_credentials')
            .update({
                password_hash: passwordHash,
                reset_token_hash: null,
                reset_used_at: now,
            })
            .eq('id', credential.id)
            .eq('store_id', body.store_id);

        if (consumeError) {
            return c.json(dbFailureBody(), 500);
        }

        await insertCustomerActivity(c, customer.id, body.store_id, 'password_reset_completed', {});

        const responseBody = success({ customer: publicCustomerProfile(customer), customer_id: customer.id });
        const issuedSession = await issueCustomerSession(
            {
                storeId: body.store_id,
                customerId: customer.id,
            },
            c.env.CUSTOMER_SESSION_SECRET,
        );
        const csrfToken = randomCsrfToken();
        const response = c.json(responseBody);
        response.headers.append(
            'Set-Cookie',
            buildCookie(LETBUYY_CUSTOMER_SESSION_COOKIE, issuedSession.token, LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS, {
                httpOnly: true,
            }),
        );
        response.headers.append(
            'Set-Cookie',
            buildCookie('letbuyy_csrf', csrfToken, LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS),
        );
        response.headers.set('X-CSRF-Token', csrfToken);
        return response;
    });

    router.get('/customer/by-email', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const storeId = c.req.query('store_id');
        const email = c.req.query('email');

        if (!storeId || !email) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('store_customers')
            .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
            .eq('store_id', storeId)
            .eq('email', normalizeEmail(email))
            .single<StoreCustomerAuthRow>();

        if (error || !data) {
            return c.json(success({ customer: null }));
        }

        return c.json(success({ customer: publicCustomerProfile(data) }));
    });

    router.get('/customer/status', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const storeId = c.req.query('store_id');
        const email = c.req.query('email');

        if (!storeId || !email) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data } = await db
            .from('store_customers')
            .select('id, status')
            .eq('store_id', storeId)
            .eq('email', normalizeEmail(email))
            .single();

        if (!data) {
            return c.json(success({ exists: false, hasPassword: false, status: 'none' }));
        }

        const { data: credential } = await db
            .from('customer_credentials')
            .select('id')
            .eq('store_id', storeId)
            .eq('email_or_phone', normalizeEmail(email))
            .maybeSingle();

        return c.json(success({
            exists: true,
            hasPassword: Boolean(credential?.id),
            status: data.status || 'active',
        }));
    });

    registerCustomerRegistrationRoute(router, { requireValidTurnstile, normalizeEmail, publicCustomerProfile, buildCookie, randomCsrfToken, insertCustomerActivity });

    router.post('/customer/login', async (c) => {
        const body = await c.req.json() as CustomerLifecycleBody;

        if (!body.store_id || !body.email || !body.password) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email and password are required' } }, 400);
        }

        const rateLimited = await enforceCustomerAuthRateLimit(c, {
            storeId: body.store_id,
            email: body.email,
            operation: 'customer-login',
        });
        if (rateLimited) return rateLimited;

        const turnstileRejected = await requireValidTurnstile(c, body);
        if (turnstileRejected) return turnstileRejected;

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('store_customers')
            .select('id, store_id, email, full_name, phone, status, login_count, accepts_marketing, updated_at')
            .eq('store_id', body.store_id)
            .eq('email', normalizeEmail(body.email))
            .single<StoreCustomerAuthRow>();

        if (error || !data) {
            return c.json(success({ customer: null }));
        }

        if (data.status === 'disabled') {
            return c.json({ success: false, error: { code: 'CUSTOMER_DISABLED', message: 'Account is disabled. Contact the store for assistance.' } }, 403);
        }

        const { data: credential } = await db
            .from('customer_credentials')
            .select('password_hash')
            .eq('store_id', body.store_id)
            .eq('email_or_phone', normalizeEmail(body.email))
            .maybeSingle<{ password_hash?: string | null }>();

        if (!credential?.password_hash) {
            return c.json(success({ customer: null }));
        }

        const isValid = await bcrypt.compare(body.password, credential.password_hash);
        if (!isValid) return c.json(success({ customer: null }));

        await db
            .from('store_customers')
            .update({
                last_login_at: new Date().toISOString(),
                login_count: Number(data.login_count || 0) + 1,
            })
            .eq('id', data.id)
            .eq('store_id', body.store_id);

        await insertCustomerActivity(c, data.id, body.store_id, 'login', { method: 'password' });

        const responseBody = success({ customer: publicCustomerProfile(data) });
        if (!c.env.CUSTOMER_SESSION_SECRET) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'CUSTOMER_SESSION_MISCONFIGURED',
                        message: 'Customer session signing is not configured',
                    },
                },
                500,
            );
        }

        const issuedSession = await issueCustomerSession(
            {
                storeId: body.store_id,
                customerId: data.id,
            },
            c.env.CUSTOMER_SESSION_SECRET,
        );
        const csrfToken = randomCsrfToken();
        const response = c.json(responseBody);
        response.headers.append(
            'Set-Cookie',
            buildCookie(LETBUYY_CUSTOMER_SESSION_COOKIE, issuedSession.token, LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS, {
                httpOnly: true,
            }),
        );
        response.headers.append(
            'Set-Cookie',
            buildCookie('letbuyy_csrf', csrfToken, LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS),
        );
        response.headers.set('X-CSRF-Token', csrfToken);
        return response;
    });

    router.post('/customer/login-success', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json() as CustomerLifecycleBody;

        if (!body.customer_id || !body.store_id) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id and store_id are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data: customer, error: customerError } = await db
            .from('store_customers')
            .select('id, login_count')
            .eq('id', body.customer_id)
            .eq('store_id', body.store_id)
            .single();

        if (customerError || !customer) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const { error } = await db
            .from('store_customers')
            .update({
                last_login_at: new Date().toISOString(),
                login_count: Number(customer.login_count || 0) + 1,
            })
            .eq('id', body.customer_id)
            .eq('store_id', body.store_id);

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        await insertCustomerActivity(c, body.customer_id, body.store_id, 'login', { method: 'password' });
        return c.json(success({ recorded: true }));
    });

    router.post('/customer/order-credential', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json() as CustomerLifecycleBody;
        const storeId = await resolveCredentialStoreId(c, body, loadPublishedStore);

        if (!storeId || !body.email_or_phone || (!body.password && !body.password_hash)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store, email_or_phone and password are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const passwordHash = body.password
            ? await bcrypt.hash(body.password, 10)
            : body.password_hash;

        const { error } = await db
            .from('customer_credentials')
            .upsert(
                {
                    store_id: storeId,
                    email_or_phone: normalizeContact(body.email_or_phone),
                    password_hash: passwordHash,
                },
                { onConflict: 'store_id,email_or_phone' }
            );

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ saved: true, store_id: storeId }));
    });

    router.post('/customer/order-credential/login', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json() as CustomerLifecycleBody;
        const storeId = await resolveCredentialStoreId(c, body, loadPublishedStore);

        if (!storeId || !body.email_or_phone || !body.password) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store, email_or_phone and password are required' } }, 400);
        }

        const emailOrPhone = normalizeContact(body.email_or_phone);
        const db = getSupabaseAdmin(c);
        const { data: credential } = await db
            .from('customer_credentials')
            .select('id, password_hash, login_count')
            .eq('store_id', storeId)
            .eq('email_or_phone', emailOrPhone)
            .single();

        if (!credential?.password_hash) return c.json(success({ valid: false }));

        const isValid = await bcrypt.compare(body.password, credential.password_hash);
        if (!isValid) return c.json(success({ valid: false }));

        await db
            .from('customer_credentials')
            .update({
                last_login_at: new Date().toISOString(),
                login_count: Number(credential.login_count || 0) + 1,
            })
            .eq('id', credential.id)
            .eq('store_id', storeId);

        return c.json(success({ valid: true, store_id: storeId }));
    });

    router.post('/customer/order-credential/login-success', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json() as CustomerLifecycleBody;
        const storeId = await resolveCredentialStoreId(c, body, loadPublishedStore);

        if (!storeId || !body.email_or_phone) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store and email_or_phone are required' } }, 400);
        }

        const emailOrPhone = body.email_or_phone.toLowerCase().trim();
        const db = getSupabaseAdmin(c);
        const { data: credential, error: credentialError } = await db
            .from('customer_credentials')
            .select('id, login_count')
            .eq('store_id', storeId)
            .eq('email_or_phone', emailOrPhone)
            .single();

        if (credentialError || !credential) {
            return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer credential not found' } }, 404);
        }

        const { error } = await db
            .from('customer_credentials')
            .update({
                last_login_at: new Date().toISOString(),
                login_count: Number(credential.login_count || 0) + 1,
            })
            .eq('id', credential.id)
            .eq('store_id', storeId);

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ recorded: true, store_id: storeId }));
    });

    router.post('/customer/order-stats', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json() as CustomerLifecycleBody;

        if (!body.store_id || !body.email || body.order_total === undefined || !body.order_id) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email, order_total and order_id are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data: customer, error: customerError } = await db
            .from('store_customers')
            .select('id, total_orders, total_spent')
            .eq('store_id', body.store_id)
            .eq('email', normalizeEmail(body.email))
            .maybeSingle();

        if (customerError) {
            return c.json(dbFailureBody(), 500);
        }

        if (!customer) {
            return c.json(success({ updated: false }));
        }

        const orderTotal = Number(body.order_total || 0);
        const { error } = await db
            .from('store_customers')
            .update({
                total_orders: Number(customer.total_orders || 0) + 1,
                total_spent: Number(customer.total_spent || 0) + orderTotal,
                last_order_at: new Date().toISOString(),
            })
            .eq('id', customer.id)
            .eq('store_id', body.store_id);

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        await insertCustomerActivity(c, customer.id, body.store_id, 'order_placed', {
            orderId: body.order_id,
            orderTotal,
        });

        return c.json(success({ updated: true }));
    });

    router.get('/customer/wishlist', async (c) => {
        const customerId = c.req.query('customer_id');
        const storeId = c.req.query('store_id');

        if (!customerId || !storeId) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id and store_id are required' } }, 400);
        }

        if (!(await verifyStoreCustomer(c, storeId, customerId))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('customer_wishlists')
            .select('product_id')
            .eq('customer_id', customerId)
            .eq('store_id', storeId);

        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success({ product_ids: (data || []).map((row) => row.product_id) }));
    });

    router.get('/customer/orders', async (c) => {
        const storeId = c.req.query('store_id');
        const customerId = getCustomerSession(c)?.customerId || c.req.query('customer_id');

        if (!storeId || !customerId) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and customer session are required' } }, 400);
        }

        const customer = await getVerifiedStoreCustomer(c, storeId, customerId);
        if (!customer) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('orders')
            // T14/W4: tax + gst_invoice_number for the customer order-detail drop (subtotal/discount/shipping_cost/payment_method/tracking_number are a separate, pre-existing, out-of-scope gap -- see CAP registry).
            .select(orderItemsRelationalReadsEnabled(c.env) ? 'id, store_id, order_number, status, total, tax, gst_invoice_number, created_at' : 'id, order_number, status, total, tax, gst_invoice_number, created_at, items')
            .eq('store_id', storeId)
            .eq('customer_email', normalizeEmail(customer.email))
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) return c.json(dbFailureBody(), 500);
        const hydrated = await hydrateStorefrontOrderItems(c, (data || []) as unknown as SqlRecord[]);
        // store_id was added to the SELECT only to satisfy the order_items hydration guard above.
        const orders = hydrated.map(({ store_id: _storeId, ...rest }) => rest);
        return c.json(success({ orders }));
    });

    router.get('/:subdomain/orders/contact', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const contact = c.req.query('contact');
        const store = await loadPublishedStore(c, c.req.param('subdomain'));

        if (!contact || !store) {
            return c.json(success({ orders: [], hasOrders: false, hasPassword: false }));
        }

        const rateLimited = await enforceCustomerAuthRateLimit(c, {
            storeId: store.id,
            contact,
            operation: 'guest-order-tracking',
        });
        if (rateLimited) return rateLimited;

        const normalizedContact = normalizeContact(contact);
        const db = getSupabaseAdmin(c);
        let query = db
            .from('orders')
            .select(orderItemsRelationalReadsEnabled(c.env)
                ? 'id, store_id, order_number, customer_email, customer_phone, status, payment_status, fulfillment_status, total, currency, created_at, updated_at'
                : '*')
            .eq('store_id', store.id)
            .order('created_at', { ascending: false });

        query = normalizedContact.includes('@')
            ? query.eq('customer_email', normalizedContact)
            : query.eq('customer_phone', normalizedContact);

        const [{ data: orders, error }, { data: credential }] = await Promise.all([
            query,
            db
                .from('customer_credentials')
                .select('id')
                .eq('store_id', store.id)
                .eq('email_or_phone', normalizedContact)
                .maybeSingle(),
        ]);

        if (error) return c.json(dbFailureBody(), 500);
        const hydratedOrders = await hydrateStorefrontOrderItems(c, (orders || []) as unknown as SqlRecord[]);

        return c.json(success({
            orders: hydratedOrders,
            hasOrders: hydratedOrders.length > 0,
            hasPassword: Boolean(credential),
            store_id: store.id,
        }));
    });

    router.post('/customer/wishlist', async (c) => {
        const body = await c.req.json() as CustomerWishlistBody;

        if (!body.customer_id || !body.store_id || !body.product_id) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and product_id are required' } }, 400);
        }

        if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const db = getSupabaseAdmin(c);
        const { error } = await db.from('customer_wishlists').upsert(
            {
                customer_id: body.customer_id,
                store_id: body.store_id,
                product_id: body.product_id,
                variant_id: body.variant_id || null,
            },
            { onConflict: 'customer_id,product_id' }
        );

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ saved: true }));
    });

    router.delete('/customer/wishlist', async (c) => {
        const body = await c.req.json() as CustomerWishlistBody;

        if (!body.customer_id || !body.store_id || !body.product_id) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and product_id are required' } }, 400);
        }

        if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const db = getSupabaseAdmin(c);
        const { error } = await db
            .from('customer_wishlists')
            .delete()
            .eq('customer_id', body.customer_id)
            .eq('store_id', body.store_id)
            .eq('product_id', body.product_id);

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ removed: true }));
    });

    router.post('/customer/wishlist/sync', async (c) => {
        const body = await c.req.json() as CustomerWishlistSyncBody;

        if (!body.customer_id || !body.store_id || !Array.isArray(body.product_ids)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and product_ids are required' } }, 400);
        }

        if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const productIds = Array.from(new Set(body.product_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)));
        if (!productIds.length) return c.json(success({ synced: 0 }));

        const db = getSupabaseAdmin(c);
        const { error } = await db.from('customer_wishlists').upsert(
            productIds.map((productId) => ({
                customer_id: body.customer_id,
                store_id: body.store_id,
                product_id: productId,
            })),
            { onConflict: 'customer_id,product_id' }
        );

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ synced: productIds.length }));
    });

    router.post('/customer/activity', async (c) => {
        const body = await c.req.json() as CustomerActivityBody;

        if (!body.customer_id || !body.store_id || !body.activity_type) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and activity_type are required' } }, 400);
        }

        if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const db = getSupabaseAdmin(c);
        const { error } = await db.from('customer_activity_log').insert({
            customer_id: body.customer_id,
            store_id: body.store_id,
            activity_type: body.activity_type,
            metadata: body.metadata || {},
        });

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ logged: true }));
    });

    router.patch('/customer/profile', async (c) => {
        const body = await c.req.json() as CustomerProfileBody;

        if (!body.customer_id || !body.store_id) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id and store_id are required' } }, 400);
        }

        if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const updates: Record<string, unknown> = {};
        if (body.full_name !== undefined) updates.full_name = body.full_name;
        if (body.phone !== undefined) updates.phone = body.phone;
        if (body.accepts_marketing !== undefined) updates.accepts_marketing = body.accepts_marketing;

        if (!Object.keys(updates).length) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'No profile fields were provided' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('store_customers')
            .update(updates)
            .eq('id', body.customer_id)
            .eq('store_id', body.store_id)
            .select('id, email, full_name, phone, accepts_marketing, updated_at')
            .single();

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ customer: data }));
    });

    router.post('/reviews', validate('json', CreateStorefrontProductReviewSchema), async (c) => {
        const body = c.get('validatedBody') as StorefrontReviewBody;
        const turnstileRejected = await requireValidTurnstile(c, body);
        if (turnstileRejected) return turnstileRejected;

        const db = getSupabaseAdmin(c);

        const { data: product, error: productError } = await db
            .from('products')
            .select('id, store_id, is_active, status')
            .eq('id', body.product_id)
            .eq('store_id', body.store_id)
            .maybeSingle();

        if (productError) {
            return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to validate product' } }, 500);
        }

        if (!product) {
            return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found for this store' } }, 404);
        }

        const productRecord = product as { is_active?: boolean | null; status?: string | null };
        if (productRecord.is_active === false || productRecord.status === 'archived') {
            return c.json({ success: false, error: { code: 'PRODUCT_UNAVAILABLE', message: 'This product is not accepting reviews' } }, 400);
        }

        if (body.customer_email) {
            const buildDuplicateQuery = (includeDeletedAtFilter: boolean) => {
                let request = db
                    .from('product_reviews')
                    .select('id')
                    .eq('product_id', body.product_id)
                    .eq('store_id', body.store_id)
                    .eq('customer_email', body.customer_email!)
                    .limit(1);

                if (includeDeletedAtFilter) request = request.is('deleted_at', null);
                return request.maybeSingle();
            };

            let { data: existing, error: duplicateError } = await buildDuplicateQuery(true);
            if (isMissingColumnError(duplicateError, 'deleted_at')) {
                ({ data: existing, error: duplicateError } = await buildDuplicateQuery(false));
            }

            if (isMissingTableError(duplicateError, 'product_reviews')) {
                return c.json({ success: false, error: { code: 'REVIEWS_UNAVAILABLE', message: 'Product reviews are not available yet' } }, 503);
            }

            if (duplicateError) {
                return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to validate review' } }, 500);
            }

            if (existing) {
                return c.json({ success: false, error: { code: 'CONFLICT', message: 'You have already reviewed this product' } }, 409);
            }
        }

        const reviewPayload = {
            store_id: body.store_id,
            product_id: body.product_id,
            customer_name: body.customer_name || 'Anonymous',
            customer_email: body.customer_email || null,
            rating: body.rating,
            title: body.title || null,
            body: body.body || null,
            is_verified: Boolean(body.is_verified),
            is_approved: false,
        };

        let { data, error } = await db
            .from('product_reviews')
            .insert({
                ...reviewPayload,
                status: 'pending',
            })
            .select()
            .single();

        if (isMissingColumnError(error, 'status')) {
            ({ data, error } = await db
                .from('product_reviews')
                .insert(reviewPayload)
                .select()
                .single());
        }

        if (isMissingTableError(error, 'product_reviews')) {
            return c.json({ success: false, error: { code: 'REVIEWS_UNAVAILABLE', message: 'Product reviews are not available yet' } }, 503);
        }

        if (error) {
            return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to submit review' } }, 500);
        }

        return c.json(success({
            review: data,
            message: 'Review submitted! It will appear after approval.',
        }), 201);
    });

    // ROUTE-1: the address book lives in its own module. Both helpers are INJECTED, never copied.
    // normalizeEmail because two definitions of what an email is, is how two files start disagreeing;
    // getVerifiedStoreCustomer because it is the check binding a session to this store AND this
    // customer, and a second copy of a tenant-isolation check is a second copy to get wrong.
    registerCustomerAddressRoutes(router, { normalizeEmail, getVerifiedStoreCustomer });

    // BUYER-3 (D-8): the marketplace buyer realm's data operations. Registered here because this is
    // where the storefront band is composed, but they share nothing with the per-store customer
    // lifecycle above — a buyer is platform-level and carries no store_id at all.
    registerBuyerAccountRoutes(router, {
        normalizeEmail,
        requireStorefrontInternal,
        loadBuyerByEmail: async (c, email) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .select(BUYER_ACCOUNT_COLUMNS)
            .eq('email', email)
            .maybeSingle(),
        insertBuyer: async (c, row) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .insert(row)
            .select(BUYER_ACCOUNT_COLUMNS)
            .single(),
        setBuyerPassword: async (c, id, passwordHash) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .update({ password_hash: passwordHash, status: 'active' })
            .eq('id', id)
            .select(BUYER_ACCOUNT_COLUMNS)
            .single(),
        loadBuyerById: async (c, id) => getSupabaseAdmin(c)
            .from('buyer_accounts')
            .select(BUYER_ACCOUNT_COLUMNS)
            .eq('id', id)
            .maybeSingle(),
        findOrCreateStoreCustomer: async (c, storeId, email) => {
            const db = getSupabaseAdmin(c);
            const existing = await db
                .from('store_customers')
                .select('id')
                .eq('store_id', storeId)
                .eq('email', email)
                .maybeSingle<{ id: string }>();
            if (existing.error) return { data: null, error: existing.error };
            if (existing.data) return { data: existing.data, error: null };
            // store_customers is UNIQUE (store_id, email), so a concurrent create loses the race
            // rather than duplicating. onConflict returns the winner instead of failing.
            return db
                .from('store_customers')
                .upsert({ store_id: storeId, email }, { onConflict: 'store_id,email' })
                .select('id')
                .single<{ id: string }>();
        },
        linkBuyerToStoreCustomer: async (c, link) => {
            // ignoreDuplicates: migration 223's unique indexes already guarantee one link per
            // store_customers row and one per (buyer, site). Re-linking is a no-op, not an error --
            // a shopper returning to a seller they already have an account with must not fail.
            const { error } = await getSupabaseAdmin(c)
                .from('buyer_store_customers')
                .upsert(
                    {
                        buyer_account_id: link.buyerAccountId,
                        store_customer_id: link.storeCustomerId,
                        site_id: link.siteId,
                    },
                    { onConflict: 'buyer_account_id,store_customer_id', ignoreDuplicates: true },
                );
            return { error };
        },
    });

}
