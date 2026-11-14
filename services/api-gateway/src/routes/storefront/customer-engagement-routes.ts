import { Hono, type Context } from 'hono';
import * as bcrypt from 'bcryptjs';
import type { Env } from '../../index';
import { hmacSha256Hex } from '../../lib/crypto';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { verifyInternalAppRequest } from '../../lib/internal-auth';
import { chooseCustomerPasswordResetUrl } from '../../lib/customer-password-reset-url';
import { resolveCustomerResetSiteByHost } from '../../lib/customer-reset-store-by-host';
import { validate } from '../../middleware/validation';
import { getCustomerSession, recordCustomerSessionIssued } from '../../middleware/customer-session';
import { enforceCustomerAuthRateLimit } from '../../middleware/rateLimit';
import { CreateStorefrontProductReviewSchema, type CreateStorefrontProductReviewInput } from '../../schemas/review.schema';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import { issueCustomerSession, LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS, LETBUYY_CUSTOMER_SESSION_COOKIE } from '@letbuyy/auth-core';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';
import { registerCustomerRegistrationRoute } from './customer-registration';
import { registerCustomerAddressRoutes } from './customer-address-routes';
import { registerBuyerRealmRoutes } from './buyer-realm-wiring';

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
        .eq('status', 'active')
        .is('deleted_at', null)
        .single<VerifiedStoreCustomer>();

    return data || null;
}

async function verifyStoreCustomer(c: AppContext, storeId: string, customerId: string): Promise<boolean> {
    return Boolean(await getVerifiedStoreCustomer(c, storeId, customerId));
}

// Wishlist write bounds. `customer_wishlists.product_id` is `text NOT NULL` with NO foreign key to
// `products` (000_baseline.sql:8914), so whatever a caller sends is what gets stored — and the sync
// route writes one row per id. Without these two bounds a single authenticated request can create
// as many rows as it lists, each holding a string of any length. The repository's own precedent for
// a buyer-submitted array is `items: z.array(...).min(1).max(50)` in @letbuyy/checkout-core; a
// wishlist merged from a device deserves more room than a cart, not less, hence 200.
//
// These are LENGTH bounds, not format bounds. `products.id` is `uuid`, so requiring a UUID would be
// the stronger fix — but this column is `text` deliberately, and rejecting a shape existing clients
// may already send is a behaviour change that needs live data to justify. See CAP-C68.
export const WISHLIST_SYNC_MAX_IDS = 200;
export const WISHLIST_PRODUCT_ID_MAX_LENGTH = 64;

export function isBoundedProductId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= WISHLIST_PRODUCT_ID_MAX_LENGTH;
}

// Activity-log write bounds, the same shape as the wishlist bounds above and for the same reason.
// `customer_activity_log` declares `activity_type text NOT NULL` with no CHECK and no length, and
// `metadata jsonb DEFAULT '{}'` with no size (000_baseline.sql:8855), so whatever a caller sends is
// stored verbatim. The route is behind requireCustomerSession + csrfProtection (storefront.ts:74,80)
// and RLS was corrected by migration 163 — neither is the gap. The gap is size.
//
// `activity_type` is bounded by LENGTH, not restricted to an enum: this endpoint has no first-party
// caller anywhere in apps/** or either api-client, so there is no set to enumerate from and a closed
// list would be invented rather than derived.
export const ACTIVITY_TYPE_MAX_LENGTH = 64;
export const ACTIVITY_METADATA_MAX_BYTES = 4096;

export function isBoundedActivityType(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= ACTIVITY_TYPE_MAX_LENGTH;
}

// Measures the SERIALISED size, because that is what is stored and what costs. A deeply nested or
// cyclic object cannot be serialised at all; treating that as over-size refuses it rather than
// letting it reach the driver.
export function isBoundedActivityMetadata(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    try {
        return new TextEncoder().encode(JSON.stringify(value)).length <= ACTIVITY_METADATA_MAX_BYTES;
    } catch {
        return false;
    }
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

async function customerPasswordResetUrl(c: AppContext, storeId: string, email: string, token: string, requestedUrl?: string | null): Promise<string> {
    const base = await chooseCustomerPasswordResetUrl({
        storeId,
        requestedUrl,
        fallbackUrl: customerPasswordResetBaseUrl(c),
        storeRootDomain: c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,
        resolveSiteByHost: (host, rootDomain) => resolveCustomerResetSiteByHost(c, host, rootDomain),
    });

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

    // Guest checkout may ask the CRM to materialize an order contact, but the browser must not
    // choose that contact. Use the order as the source of truth and constrain the lookup by both
    // the supplied tenant scope and globally unique order id before writing the profile.
    router.post('/customer/from-order', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json() as { store_id?: unknown; order_id?: unknown };
        if (typeof body.store_id !== 'string' || !body.store_id.trim()
            || typeof body.order_id !== 'string' || !body.order_id.trim()) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and order_id are required' } }, 400);
        }

        const storeId = body.store_id.trim();
        const orderId = body.order_id.trim();
        if (storeId.length > 100 || orderId.length > 100) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and order_id are invalid' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data: order, error: orderError } = await db
            .from('orders')
            .select('id, store_id, customer_email, customer_name, customer_phone')
            .eq('id', orderId)
            .eq('store_id', storeId)
            .maybeSingle<{ id: string; store_id: string; customer_email: string | null; customer_name: string | null; customer_phone: string | null }>();

        if (orderError) return c.json(dbFailureBody(), 500);
        if (!order?.customer_email) {
            return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
        }

        const email = normalizeEmail(order.customer_email);
        const { data: existing, error: existingError } = await db
            .from('store_customers')
            .select('id, store_id, email, full_name, phone, status, accepts_marketing, updated_at')
            .eq('store_id', order.store_id)
            .eq('email', email)
            .maybeSingle<StoreCustomerAuthRow>();

        if (existingError) return c.json(dbFailureBody(), 500);
        if (existing) {
            const updates: Record<string, unknown> = {};
            if (order.customer_name && !existing.full_name) updates.full_name = order.customer_name;
            if (order.customer_phone && !existing.phone) updates.phone = order.customer_phone;
            if (Object.keys(updates).length) {
                const { error } = await db.from('store_customers')
                    .update(updates)
                    .eq('id', existing.id)
                    .eq('store_id', order.store_id);
                if (error) return c.json(dbFailureBody(), 500);
            }
            return c.json(success({ created: false }));
        }

        const { data: created, error: createError } = await db
            .from('store_customers')
            .insert({
                store_id: order.store_id,
                email,
                full_name: order.customer_name || null,
                phone: order.customer_phone || null,
                status: 'active',
                password_hash: null,
            })
            .select('id')
            .single<{ id: string }>();

        if (createError) return c.json(dbFailureBody(), 500);
        await insertCustomerActivity(c, created.id, order.store_id, 'account_created', { source: 'checkout' });
        return c.json(success({ created: true }), 201);
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
            .is('deleted_at', null)
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
            resetUrl: await customerPasswordResetUrl(c, body.store_id, email, token, body.reset_url),
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
        const passwordHash = await bcrypt.hash(body.password, 10);
        const { data: customerData, error: resetError } = await db.rpc('confirm_customer_password_reset', {
            p_store_id: body.store_id,
            p_email: email,
            p_reset_token_hash: tokenHash,
            p_password_hash: passwordHash,
        });

        if (resetError) return c.json(dbFailureBody(), 500);
        const customer = customerData as StoreCustomerAuthRow | null;
        if (!customer?.id || customer.store_id !== body.store_id || customer.email !== email || customer.status !== 'active') {
            return c.json({ success: false, error: { code: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired' } }, 400);
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
        recordCustomerSessionIssued(c, 'password_reset');
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

    registerCustomerRegistrationRoute(router);

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
        recordCustomerSessionIssued(c, 'password_login');
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
            // Every column here is read by mapOrderDetailDrop in apps/commerce/web/src/lib/customer-drop.ts.
            // Before F-ORDERDETAIL-1 the list stopped after created_at, so the nine fields below fell back
            // to 0 / '' / null / 'cod' / 'pending' and the customer order-detail page rendered a zero
            // subtotal, no discount, no shipping cost, an always-COD payment method and an always-pending
            // payment status for every order (CAP-C51). Adding a read here without adding the column is
            // the failure mode; the test in customer-order-detail-fields.test.ts fails if they drift apart.
            .select(orderItemsRelationalReadsEnabled(c.env)
                ? 'id, store_id, order_number, status, total, tax, gst_invoice_number, created_at, subtotal, discount, shipping_cost, payment_method, payment_status, tracking_number, carrier, shipping_address, currency'
                : 'id, order_number, status, total, tax, gst_invoice_number, created_at, items, subtotal, discount, shipping_cost, payment_method, payment_status, tracking_number, carrier, shipping_address, currency')
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

        if (!body.customer_id || !body.store_id || !isBoundedProductId(body.product_id)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `customer_id, store_id and product_id (at most ${WISHLIST_PRODUCT_ID_MAX_LENGTH} characters) are required` } }, 400);
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

        if (!body.customer_id || !body.store_id || !isBoundedProductId(body.product_id)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `customer_id, store_id and product_id (at most ${WISHLIST_PRODUCT_ID_MAX_LENGTH} characters) are required` } }, 400);
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

        if (body.product_ids.length > WISHLIST_SYNC_MAX_IDS) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `product_ids may contain at most ${WISHLIST_SYNC_MAX_IDS} entries` } }, 400);
        }

        if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const productIds = Array.from(new Set(body.product_ids.filter(isBoundedProductId)));
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

        if (!body.customer_id || !body.store_id || !isBoundedActivityType(body.activity_type)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `customer_id, store_id and activity_type (at most ${ACTIVITY_TYPE_MAX_LENGTH} characters) are required` } }, 400);
        }

        if (!isBoundedActivityMetadata(body.metadata)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `metadata must be a JSON object of at most ${ACTIVITY_METADATA_MAX_BYTES} bytes` } }, 400);
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

    router.get('/customer/profile', async (c) => {
        const session = getCustomerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'CUSTOMER_SESSION_REQUIRED', message: 'A valid customer session is required' } }, 401);

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('store_customers')
            .select('id, email, full_name, phone, accepts_marketing')
            .eq('id', session.customerId)
            .eq('store_id', session.storeId)
            .eq('status', 'active')
            .is('deleted_at', null)
            .maybeSingle();

        if (error) return c.json(dbFailureBody(), 500);
        if (!data) return c.json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer account is unavailable' } }, 404);
        return c.json(success({ customer: data }));
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
            .is('deleted_at', null)
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

        // A verified badge and authenticated reviewer identity come only from the signed
        // customer session plus the matching active store_customer row. Never trust these fields
        // from an anonymous request body.
        const session = getCustomerSession(c);
        let verifiedCustomer: { email: string; full_name: string | null } | null = null;
        if (session) {
            if (session.storeId !== body.store_id) {
                return c.json({ success: false, error: { code: 'CUSTOMER_SESSION_REQUIRED', message: 'A valid customer session is required' } }, 401);
            }
            const { data: customer, error: customerError } = await db
                .from('store_customers')
                .select('email, full_name, status, deleted_at')
                .eq('id', session.customerId)
                .eq('store_id', session.storeId)
                .maybeSingle();
            if (customerError) return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to validate customer session' } }, 500);
            if (!customer || (customer as { status?: string; deleted_at?: string | null }).status !== 'active' || (customer as { deleted_at?: string | null }).deleted_at != null) {
                return c.json({ success: false, error: { code: 'CUSTOMER_SESSION_REQUIRED', message: 'A valid customer session is required' } }, 401);
            }
            verifiedCustomer = customer as { email: string; full_name: string | null };
        }

        const customerEmail = verifiedCustomer?.email ?? body.customer_email ?? null;

        if (customerEmail) {
            const buildDuplicateQuery = (includeDeletedAtFilter: boolean) => {
                let request = db
                    .from('product_reviews')
                    .select('id')
                    .eq('product_id', body.product_id)
                    .eq('store_id', body.store_id)
                    .eq('customer_email', customerEmail)
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
            customer_name: verifiedCustomer?.full_name || body.customer_name || 'Anonymous',
            customer_email: customerEmail,
            rating: body.rating,
            title: body.title || null,
            body: body.body || null,
            is_verified: Boolean(verifiedCustomer),
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

        const savedReview = data as { id?: string | null; status?: string | null } | null;
        return c.json(success({
            review: { id: savedReview?.id ?? null, status: savedReview?.status ?? 'pending' },
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
    // CAP-FB-* (D-8/D-9): the buyer realm's wiring lives in its own module. It shares nothing
    // with the per-store customer lifecycle above -- a buyer is platform-level and carries no
    // store_id -- and keeping it here pushed this file past the 1500-line budget twice.
    registerBuyerRealmRoutes(router, { normalizeEmail, hydrateStorefrontOrderItems, orderItemsRelationalReadsEnabled, requireValidTurnstile });

}
