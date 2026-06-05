// ============================================================
// STOREFRONT (PUBLIC) — Unauthenticated APIs (Doc 10/09 §21)
// ============================================================
import { Hono } from 'hono';
import type { Context } from 'hono';
import * as bcrypt from 'bcryptjs';
import type { Env } from '../index';
import { dbFailureBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { verifyInternalAppRequest } from '../lib/internal-auth';
import { validate } from '../middleware/validation';
import {
    StorefrontCreateOrderSchema,
    StorefrontCashfreeOrderSchema,
    StorefrontCashfreeVerifySchema,
    StorefrontPayPalCaptureSchema,
    StorefrontPayPalOrderSchema,
    StorefrontRazorpayOrderSchema,
    StorefrontRazorpayVerifySchema,
    StorefrontStripeCheckoutSchema,
} from '../schemas/order.schema';
import {
    CreateStorefrontProductReviewSchema,
    StorefrontProductReviewsQuery,
    type CreateStorefrontProductReviewInput,
    type StorefrontProductReviewsQueryInput,
} from '../schemas/review.schema';
import { OrderExecutionAdapter } from '../execution/order-execution.adapter';
import { PaymentExecutionAdapter } from '../execution/payment-execution.adapter';
import { ProductExecutionAdapter } from '../execution/product-execution.adapter';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { evaluateCheckoutAppFunctions } from '../extensions/app-functions-runtime';
import { createPublicStorefrontTenantContext } from '../lib/tenant-context';
import {
    getCustomerSession,
    isCustomerLegacyAuthEnabled,
    requireCustomerSession,
} from '../middleware/customer-session';
import { createPayPalPaymentProvider } from '@letbuyy/infrastructure/paypal-adapter';
import { createCashfreePaymentProvider } from '@letbuyy/infrastructure/cashfree-adapter';
import { createRazorpayPaymentProvider } from '@letbuyy/infrastructure/razorpay-adapter';
import { createStripePaymentProvider } from '@letbuyy/infrastructure/stripe-adapter';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import {
    planCouponValidation,
    storefrontCouponValidationError,
    type CouponRecord,
} from '@letbuyy/checkout-core';
import {
    emptyPublicReviewsPayload,
    summarizePublicProductReviews,
    type PublicProductReviewRecord,
} from '@letbuyy/commerce-core';
import {
    issueCustomerSession,
    LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS,
    LETBUYY_CUSTOMER_SESSION_COOKIE,
} from '@letbuyy/auth-core';
import {
    buildPublicNavigationTree,
    normalizeStorefrontRoutePage,
    normalizeStorefrontRoutePolicy,
    storefrontPageToNavigationItem,
    type CmsNavigationItemRecord,
    type CmsPolicyRecord,
    type CmsStorefrontPageRevisionRecord,
    type CmsStorefrontRoutePageRecord,
} from '@letbuyy/cms-core';
import {
    mapPublicStorePayload,
    normalizeStorefrontHandle,
    type PublishedStoreRecord,
    type StorefrontSiteRecord,
    type StorefrontThemeReleaseRecord,
} from '@letbuyy/tenant-core';
import { normalizeAppBlockInstance, type AppBlockInstance } from '@letbuyy/app-engine';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;
type StorefrontJsonValue = null | boolean | number | string | StorefrontJsonValue[] | { [key: string]: StorefrontJsonValue };
const CUSTOMER_PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const CUSTOMER_PASSWORD_RESET_TOKEN_BYTES = 32;

router.use('/customer/wishlist', requireCustomerSession);
router.use('/customer/wishlist/*', requireCustomerSession);
router.use('/customer/orders', requireCustomerSession);
router.use('/customer/activity', requireCustomerSession);
router.use('/customer/profile', requireCustomerSession);
router.use('/customer/addresses', requireCustomerSession);
router.use('/customer/addresses/*', requireCustomerSession);

type StorefrontCreateOrderBody = {
    customer: {
        name: string;
        email: string;
        phone?: string;
        gstin?: string;
        address: {
            address: string;
            city: string;
            state: string;
            stateCode?: string;
            pincode: string;
        };
    };
    items: Array<{
        productId: string;
        variantId?: string | null;
        quantity: number;
    }>;
    paymentMethod: 'razorpay' | 'stripe' | 'paypal' | 'cashfree' | 'cod';
    deliveryOption: 'standard' | 'express';
    notes?: string;
    couponCode?: string;
    giftCardCode?: string;
    idempotencyKey: string;
};

type OrderRpcResult = {
    id?: string;
    order_number?: string;
    status?: string;
    total?: number | string;
    gst_invoice_number?: string | null;
    gst_invoice?: StorefrontJsonValue | null;
    place_of_supply_state?: string | null;
};

type StorefrontPaidOrderSnapshot = {
    id?: string;
    store_id?: string;
    site_id?: string;
    order_number?: string;
    customer_id?: string;
    total?: number | string;
    currency?: string | null;
};

type StorefrontRazorpayOrderBody = {
    orderId: string;
    idempotencyKey: string;
    amount?: number;
    amountMinorUnits?: number;
};

type StorefrontRazorpayVerifyBody = {
    orderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    idempotencyKey: string;
};

type StorefrontStripeCheckoutBody = {
    orderId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    idempotencyKey: string;
};

type StorefrontPayPalOrderBody = {
    orderId: string;
    returnUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
};

type StorefrontPayPalCaptureBody = {
    orderId: string;
    paypalOrderId: string;
    idempotencyKey: string;
};

type StorefrontCashfreeOrderBody = {
    orderId: string;
    returnUrl: string;
    notifyUrl?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerName?: string;
    paymentMethods?: string;
    idempotencyKey: string;
    amount?: number;
    amountMinorUnits?: number;
};

type StorefrontCashfreeVerifyBody = {
    orderId: string;
    cashfree_order_id: string;
    cf_payment_id?: string;
    idempotencyKey: string;
};

type ThemePreviewSessionRow = {
    id: string;
    store_id: string;
    theme_id: string;
    draft_id: string | null;
    theme_instance_draft_id?: string | null;
    draft_version: number | null;
    expires_at: string;
};

type ThemeInstanceDraftRow = {
    id: string;
    working_manifest: Record<string, unknown> | null;
    draft_version: number | null;
    auto_saved_at: string | null;
};

type ThemeEditorDraftRow = {
    id: string;
    draft_config: Record<string, unknown> | null;
    version: number | null;
    auto_saved_at: string | null;
};

type StorefrontProductDetail = {
    id: string;
    view_count?: number | null;
};

type RazorpayOrderResponse = {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string };
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

type CustomerLifecycleBody = {
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
    order_total?: number | string;
    order_id?: string;
};

type StoreCustomerAuthRow = {
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

type VerifiedStoreCustomer = {
    id: string;
    store_id: string;
    email: string;
};

type CustomerProfileBody = {
    customer_id?: string;
    store_id?: string;
    full_name?: string | null;
    phone?: string | null;
    accepts_marketing?: boolean;
};

type CustomerAddressBody = {
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

type InternalPaymentReferenceBody = {
    orderId?: string;
    storeId?: string;
    provider?: 'razorpay' | 'stripe' | 'paypal' | 'cashfree';
    paymentReference?: string;
    idempotencyKey?: string | null;
};

type InternalPaymentConfirmBody = {
    orderId?: string;
    provider?: 'razorpay' | 'stripe' | 'paypal' | 'cashfree';
    paymentId?: string;
    providerOrderId?: string | null;
    providerEventId?: string | null;
    idempotencyKey?: string | null;
};

type InternalPaymentFailureBody = {
    orderId?: string;
    provider?: 'razorpay' | 'stripe' | 'paypal' | 'cashfree';
    providerEventId?: string;
    paymentStatus?: 'failed' | 'refunded';
    orderStatus?: 'cancelled' | 'refunded';
    reason?: string | null;
    releaseInventory?: boolean;
    idempotencyKey?: string | null;
};

type NavigationMenuRow = {
    id: string;
    handle: string;
    name: string;
    location: string;
    metadata?: Record<string, unknown> | null;
};

function storefrontJsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function storefrontJsonRecordArray(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
        return value
            .map((item) => storefrontJsonRecord(item))
            .filter((item) => Object.keys(item).length > 0);
    }

    const record = storefrontJsonRecord(value);
    return Object.keys(record).length > 0 ? [record] : [];
}

function firstStorefrontRelatedRecord(value: unknown): Record<string, unknown> {
    return storefrontJsonRecordArray(value)[0] || storefrontJsonRecord(value);
}

function storefrontString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function isMissingColumnError(error: DatabaseErrorLike, columnName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

async function listPublicProductReviews(c: AppContext) {
    const query = c.get('validatedQuery') as StorefrontProductReviewsQueryInput;
    const productId = query.product_id;
    const storeId = query.store_id;

    const db = getSupabaseAdmin(c);
    const buildQuery = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('product_reviews')
            .select('id, customer_name, rating, title, body, images, is_verified, helpful_count, created_at')
            .eq('product_id', productId)
            .eq('store_id', storeId)
            .eq('is_approved', true);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);

        return request
            .order('created_at', { ascending: false })
            .limit(50);
    };

    let { data, error } = await buildQuery(true);

    if (isMissingColumnError(error, 'deleted_at')) {
        ({ data, error } = await buildQuery(false));
    }

    if (error) {
        if (isMissingTableError(error, 'product_reviews')) {
            return c.json(success(emptyPublicReviewsPayload()));
        }

        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to load product reviews' } }, 500);
    }

    const reviews = (data || []) as PublicProductReviewRecord[];
    return c.json(success(summarizePublicProductReviews(reviews)));
}

function getRequestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function requestedAmountMinorUnits(input: { amount?: number; amountMinorUnits?: number }): number | null {
    if (typeof input.amountMinorUnits === 'number') return input.amountMinorUnits;
    if (typeof input.amount === 'number') return Math.round(input.amount * 100);
    return null;
}

function orderAmountMinorUnits(order: { total: number | string; currency?: string | null }): {
    amountMinor: number;
    currency: 'INR';
} | null {
    const currency = (order.currency || 'INR').toUpperCase();
    if (currency !== 'INR') {
        return null;
    }

    return {
        amountMinor: Math.round(Number(order.total) * 100),
        currency: 'INR',
    };
}

function orderEventTotalPayload(totalValue: unknown): { amount_minor: number; currency: 'INR' } | undefined {
    const total = typeof totalValue === 'number' || typeof totalValue === 'string' ? Number(totalValue) : Number.NaN;
    if (!Number.isFinite(total) || total < 0) return undefined;
    return { amount_minor: Math.round(total * 100), currency: 'INR' };
}

async function emitStorefrontOrderCreatedEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        storeId: string;
        order: OrderRpcResult;
        requestId: string;
    },
): Promise<void> {
    if (!input.order.id) return;

    const total = orderEventTotalPayload(input.order.total);
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.storeId,
        aggregateType: 'order',
        aggregateId: input.order.id,
        eventType: 'order.created',
        payload: {
            site_id: input.storeId,
            order_id: input.order.id,
            order_number: input.order.order_number || undefined,
            ...(total ? { total } : {}),
        },
        idempotencyKey: `order.created:${input.storeId}:${input.order.id}:${input.requestId}`,
        requestId: input.requestId,
        actorId: null,
    });
}

async function emitStorefrontOrderPaidEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        storeId?: string | null;
        orderId: string;
        order: StorefrontPaidOrderSnapshot;
        fallbackOrder?: StorefrontPaidOrderSnapshot;
        requestId: string;
        idempotencyKey: string;
    },
): Promise<void> {
    const order = input.order || {};
    const fallbackOrder = input.fallbackOrder || {};
    const storeId = input.storeId || order.site_id || order.store_id || fallbackOrder.site_id || fallbackOrder.store_id;
    if (!storeId) return;

    const total = orderEventTotalPayload(order.total ?? fallbackOrder.total);

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId,
        aggregateType: 'order',
        aggregateId: order.id || input.orderId,
        eventType: 'order.paid',
        payload: {
            site_id: storeId,
            order_id: order.id || input.orderId,
            order_number: order.order_number || fallbackOrder.order_number || undefined,
            customer_id: order.customer_id || fallbackOrder.customer_id || undefined,
            ...(total ? { total } : {}),
        },
        idempotencyKey: `order.paid:${storeId}:${input.orderId}:${input.idempotencyKey}`,
        requestId: input.requestId,
        actorId: null,
    });
}

function getPayPalCredentials(c: AppContext) {
    if (!c.env.PAYPAL_CLIENT_ID || !c.env.PAYPAL_CLIENT_SECRET) {
        return null;
    }

    return {
        clientId: c.env.PAYPAL_CLIENT_ID,
        clientSecret: c.env.PAYPAL_CLIENT_SECRET,
        mode: c.env.PAYPAL_MODE === 'live' ? 'live' as const : 'sandbox' as const,
        webhookId: c.env.PAYPAL_WEBHOOK_ID,
    };
}

function getCashfreeCredentials(c: AppContext) {
    if (!c.env.CASHFREE_APP_ID || !c.env.CASHFREE_SECRET_KEY) {
        return null;
    }

    return {
        appId: c.env.CASHFREE_APP_ID,
        secretKey: c.env.CASHFREE_SECRET_KEY,
        environment: c.env.CASHFREE_ENVIRONMENT === 'production' ? 'production' as const : 'sandbox' as const,
        apiVersion: c.env.CASHFREE_API_VERSION || '2025-01-01',
    };
}

const STOREFRONT_SITE_SELECT: string =
    'id,user_id,custom_user_id,name,store_name,subdomain,site_type,tagline,logo_url,brand_color,custom_domain,currency,locale,theme_id,template_config,status,published_at,created_at,updated_at,seo_title,seo_description';
const STOREFRONT_SITE_RELEASE_SELECT: string =
    `${STOREFRONT_SITE_SELECT},current_theme_release_id,storefront_release_version`;
const STOREFRONT_SITE_COMPAT_SELECT: string =
    'id,user_id,custom_user_id,name,store_name,subdomain,site_type,tagline,logo_url,brand_color,custom_domain,currency,locale,theme_id,template_config,status,published_at,created_at,updated_at';
const STOREFRONT_SITE_RELEASE_COMPAT_SELECT: string =
    `${STOREFRONT_SITE_COMPAT_SELECT},current_theme_release_id,storefront_release_version`;
const PRODUCT_SELECT_FULL: string =
    'id,store_id,name,slug,description,images,price,compare_price,compare_at_price,currency,stock,quantity,stock_quantity,is_active,is_featured,status,category,tags,variants,avg_rating,review_count,display_order,created_at,updated_at,seo_title,seo_description';
const PRODUCT_SELECT_COMPAT: string =
    'id,store_id,name,slug,description,images,price,compare_price,currency,stock,quantity,is_active,is_featured,status,category,tags,variants,display_order,created_at,updated_at,seo_title,seo_description';
const PRODUCT_SELECT_MINIMAL: string =
    'id,store_id,name,description,images,price,category,tags,created_at,updated_at,seo_title,seo_description';

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

type PublicProductQueryOptions = {
    limit: number;
    page?: number;
    ids?: string[];
    category?: string;
    search?: string;
    paginated?: boolean;
};

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isSchemaMismatchError(error: DatabaseErrorLike): boolean {
    const text = databaseErrorText(error);
    return text.includes('does not exist') || text.includes('schema cache') || text.includes('could not find');
}

async function loadPublishedStore(c: AppContext, subdomain: string): Promise<PublishedStoreRecord | null> {
    const db = getSupabaseAdmin(c);
    const handle = normalizeStorefrontHandle(subdomain);
    if (!handle) return null;

    const selectStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id')
            .or(`subdomain.eq.${handle},store_name.eq.${handle}`)
            .eq('status', 'published');

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: store, error } = await selectStore(true).single();

    if (error || !store) {
        ({ data: store } = await selectStore(false).single());
    }

    return store as PublishedStoreRecord | null;
}

async function loadPublishedStoreById(c: AppContext, storeId: string): Promise<PublishedStoreRecord | null> {
    const db = getSupabaseAdmin(c);
    const selectStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id')
            .eq('id', storeId)
            .eq('status', 'published');

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: store, error } = await selectStore(true).single();

    if (error || !store) {
        ({ data: store } = await selectStore(false).single());
    }

    return store as PublishedStoreRecord | null;
}

async function loadSiteByHandle(
    c: AppContext,
    handle: string,
    options: { publishedOnly: boolean }
): Promise<StorefrontSiteRecord | null> {
    const normalized = normalizeStorefrontHandle(handle);
    if (!normalized) return null;

    const db = getSupabaseAdmin(c);
    const selectSite = (selectFields: string, includeDeletedAtFilter: boolean) => {
        let query = db
            .from('sites')
            .select(selectFields)
            .or(`subdomain.eq.${normalized},store_name.eq.${normalized}`)
            .limit(1);

        if (options.publishedOnly) query = query.eq('status', 'published');
        if (includeDeletedAtFilter) query = query.is('deleted_at', null);

        return query;
    };

    let { data, error } = await selectSite(STOREFRONT_SITE_RELEASE_SELECT, true).single();

    if (error || !data) {
        ({ data, error } = await selectSite(STOREFRONT_SITE_RELEASE_COMPAT_SELECT, true).single());
    }

    if (error || !data) {
        ({ data, error } = await selectSite(STOREFRONT_SITE_SELECT, true).single());
    }

    if (error || !data) {
        ({ data, error } = await selectSite(STOREFRONT_SITE_COMPAT_SELECT, true).single());
    }

    if (error || !data) {
        ({ data } = await selectSite(STOREFRONT_SITE_COMPAT_SELECT, false).single());
    }

    return (data as StorefrontSiteRecord | null) || null;
}

async function loadCurrentThemeRelease(c: AppContext, storeId: string): Promise<StorefrontThemeReleaseRecord | null> {
    const db = getSupabaseAdmin(c);
    const baseQuery = (select: string, includeDeletedAtFilter: boolean) => {
        let query = db
            .from('theme_releases')
            .select(select)
            .eq('store_id', storeId)
            .eq('is_current', true)
            .eq('release_status', 'published');

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query.order('release_version', { ascending: false }).limit(1);
    };

    const extendedSelect = 'id, theme_id, theme_instance_id, theme_package_version_id, release_version, release_config, release_manifest, template_snapshot, settings_snapshot, asset_manifest, cache_manifest, data_binding_manifest, schema_manifest_version, engine_version, published_at';
    const legacySelect = 'id, theme_id, release_version, release_config, published_at';
    let { data, error } = await baseQuery(extendedSelect, true).maybeSingle();

    if (error || !data) {
        ({ data, error } = await baseQuery(legacySelect, true).maybeSingle());
    }

    if (error || !data) {
        ({ data } = await baseQuery(legacySelect, false).maybeSingle());
    }

    return (data as StorefrontThemeReleaseRecord | null) || null;
}

function appBlockFromRegistryRegistration(registration: Record<string, unknown>): AppBlockInstance | null {
    const settings = storefrontJsonRecord(registration.settings);
    const appId = storefrontString(registration.app_id);
    const registrationId = storefrontString(registration.id);
    if (!appId || !registrationId) return null;

    const extensionHandle = storefrontString(registration.extension_handle) || registrationId;
    const slot = storefrontString(settings.slot)
        || storefrontString(registration.target)
        || 'storefront.home.after-hero';
    const title = storefrontString(settings.title)
        || storefrontString(settings.label)
        || storefrontString(settings.name)
        || extensionHandle;
    const renderer = storefrontString(registration.renderer);
    const renderMode = renderer === 'iframe' || settings.render_mode === 'iframe' || settings.renderMode === 'iframe'
        ? 'iframe'
        : 'inline';
    const sourceUrl = storefrontString(registration.source_url);
    const iframeUrl = renderMode === 'iframe'
        ? storefrontString(settings.iframe_url) || storefrontString(settings.iframeUrl) || sourceUrl || undefined
        : undefined;

    return normalizeAppBlockInstance({
        id: `app-registry-${registrationId}`,
        app_id: appId,
        extension_id: registrationId,
        slot,
        title,
        render_mode: renderMode,
        iframe_url: iframeUrl,
        settings: {
            ...settings,
            app_id: appId,
            extension_id: registrationId,
            extension_handle: extensionHandle,
            source_entrypoint: storefrontString(registration.source_entrypoint) || undefined,
            manifest_schema_version: storefrontString(registration.manifest_schema_version) || undefined,
            slot,
            title,
            render_mode: renderMode,
        },
        content: {
            heading: settings.heading || settings.headline,
            body: settings.body || settings.description,
            cta_label: settings.cta_label || settings.ctaLabel,
            cta_href: settings.cta_href || settings.ctaHref,
        },
    }, {
        id: `app-registry-${registrationId}`,
        app_id: appId,
        extension_id: registrationId,
        slot,
        title,
    });
}

async function loadPublicStorefrontAppBlocks(c: AppContext, storeId: string): Promise<AppBlockInstance[]> {
    const [registeredBlocks, legacyBlocks] = await Promise.all([
        loadRegisteredThemeAppBlocks(c, storeId),
        loadLegacyStorefrontAppBlocks(c, storeId),
    ]);

    const merged = new Map<string, AppBlockInstance>();
    for (const block of legacyBlocks) merged.set(block.id, block);
    for (const block of registeredBlocks) merged.set(block.id, block);
    return Array.from(merged.values());
}

async function loadRegisteredThemeAppBlocks(c: AppContext, storeId: string): Promise<AppBlockInstance[]> {
    const { data, error } = await getSupabaseAdmin(c)
        .from('app_extension_registrations')
        .select('id, site_id, app_id, installation_id, extension_handle, extension_type, surface, target, renderer, source_url, source_entrypoint, scopes, capabilities, settings, manifest_schema_version, app_version, status, sort_order, created_at, updated_at')
        .eq('site_id', storeId)
        .eq('surface', 'theme.app_block')
        .eq('status', 'enabled')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (error || !Array.isArray(data)) {
        if (isMissingTableError(error, 'app_extension_registrations')) return [];
        return [];
    }

    return data
        .map((registration) => appBlockFromRegistryRegistration(registration as Record<string, unknown>))
        .filter((block): block is AppBlockInstance => block !== null);
}

async function loadLegacyStorefrontAppBlocks(c: AppContext, storeId: string): Promise<AppBlockInstance[]> {
    const { data, error } = await getSupabaseAdmin(c)
        .from('app_installations')
        .select('id, app_id, store_id, config, marketplace_apps(id, name, slug, app_url, app_extensions(id, type, target, label, config, sort_order))')
        .eq('store_id', storeId)
        .eq('status', 'active');

    if (error || !Array.isArray(data)) return [];

    const blocks: AppBlockInstance[] = [];
    for (const installation of data as Record<string, unknown>[]) {
        const app = firstStorefrontRelatedRecord(installation.marketplace_apps);
        const installConfig = storefrontJsonRecord(installation.config);
        const appId = storefrontString(installation.app_id) || storefrontString(app.id);
        if (!appId) continue;

        const appName = storefrontString(app.name) || 'Installed app';
        const extensions = storefrontJsonRecordArray(app.app_extensions)
            .filter((extension) => {
                const type = storefrontString(extension.type);
                return type === 'storefront_block' || type === 'app-block' || type === 'app_block';
            })
            .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0));

        for (const [index, extension] of extensions.entries()) {
            const config = storefrontJsonRecord(extension.config);
            const extensionId = storefrontString(extension.id) || `storefront-block-${index + 1}`;
            const renderMode = config.render_mode === 'iframe' || config.renderMode === 'iframe' ? 'iframe' : 'inline';
            const slot = storefrontString(config.slot)
                || storefrontString(installConfig.default_app_block_slot)
                || storefrontString(extension.target)
                || 'storefront.home.after-hero';
            const title = storefrontString(config.title)
                || storefrontString(extension.label)
                || appName;

            const block = normalizeAppBlockInstance({
                id: `app-${appId}-${extensionId}`,
                app_id: appId,
                extension_id: extensionId,
                slot,
                title,
                render_mode: renderMode,
                iframe_url: config.iframe_url || config.iframeUrl || (renderMode === 'iframe' ? extension.target : undefined),
                settings: {
                    ...config,
                    app_id: appId,
                    extension_id: extensionId,
                    slot,
                    title,
                    render_mode: renderMode,
                },
                content: {
                    heading: config.heading || config.headline,
                    body: config.body || config.description,
                    cta_label: config.cta_label || config.ctaLabel,
                    cta_href: config.cta_href || config.ctaHref,
                },
            }, {
                id: `app-${appId}-${extensionId}`,
                app_id: appId,
                extension_id: extensionId,
                slot,
                title,
            });

            if (block) blocks.push(block);
        }
    }

    return blocks;
}

async function queryPublicProducts(c: AppContext, storeId: string, options: PublicProductQueryOptions) {
    const db = getSupabaseAdmin(c);
    const attempts = [
        { select: PRODUCT_SELECT_FULL, useDeletedAt: true, useActive: true, orderBy: 'display_order' },
        { select: PRODUCT_SELECT_COMPAT, useDeletedAt: true, useActive: true, orderBy: 'display_order' },
        { select: PRODUCT_SELECT_COMPAT, useDeletedAt: false, useActive: true, orderBy: 'display_order' },
        { select: PRODUCT_SELECT_MINIMAL, useDeletedAt: false, useActive: false, orderBy: 'created_at' },
    ];
    let lastError: DatabaseErrorLike = null;

    for (const attempt of attempts) {
        let query = options.paginated
            ? db.from('products').select(attempt.select, { count: 'exact' })
            : db.from('products').select(attempt.select);

        query = query.eq('store_id', storeId);
        if (attempt.useActive) query = query.eq('is_active', true);
        if (attempt.useDeletedAt) query = query.is('deleted_at', null);
        if (options.ids?.length) query = query.in('id', options.ids);
        if (options.category && attempt.select.includes('category')) query = query.eq('category', options.category);
        if (options.search && attempt.select.includes('name')) query = query.ilike('name', `%${options.search}%`);
        query = query.order(attempt.orderBy, { ascending: true });

        const offset = ((options.page || 1) - 1) * options.limit;
        const result = options.paginated
            ? await query.range(offset, offset + options.limit - 1)
            : await query.limit(options.limit);

        if (!result.error) {
            return {
                data: result.data || [],
                count: result.count || (result.data?.length ?? 0),
                error: null,
            };
        }

        lastError = result.error;
        if (!isSchemaMismatchError(result.error)) break;
    }

    if (isSchemaMismatchError(lastError)) {
        return { data: [], count: 0, error: null };
    }

    return { data: [], count: 0, error: lastError };
}

function normalizePublicRouteToken(value: string): string | null {
    const normalized = value.trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-_]{0,120}$/.test(normalized) ? normalized : null;
}

async function listLegacyStorefrontPages(
    c: AppContext,
    storeId: string,
    options: { navOnly?: boolean } = {}
) {
    const db = getSupabaseAdmin(c);
    const attempts = [
        'id,title,slug,page_type,is_homepage,display_order,show_in_nav,status,body,html_content,content,published_at,updated_at',
        'id,title,slug,page_type,is_homepage,display_order,show_in_nav,status,body,content,published_at,updated_at',
        'id,title,slug,page_type,is_homepage,display_order,show_in_nav,status,content,published_at,updated_at',
        'id,title,slug,content,status,created_at,updated_at',
    ];
    let lastError: DatabaseErrorLike = null;

    for (const select of attempts) {
        let query = db
            .from('pages')
            .select(select)
            .eq('store_id', storeId)
            .eq('status', 'published');

        if (options.navOnly && select.includes('show_in_nav')) {
            query = query.eq('show_in_nav', true);
        }

        const result = await query.order(select.includes('display_order') ? 'display_order' : 'updated_at', { ascending: true });

        if (!result.error) {
            return (result.data || []).map((row, index) => {
                const page = row as unknown as CmsStorefrontRoutePageRecord;
                return normalizeStorefrontRoutePage({
                    ...page,
                    page_type: page.page_type || 'page',
                    display_order: page.display_order || index,
                    show_in_nav: page.show_in_nav ?? !options.navOnly,
                });
            });
        }

        lastError = result.error;
        if (!isSchemaMismatchError(result.error)) break;
    }

    if (isSchemaMismatchError(lastError) || isMissingTableError(lastError, 'pages')) {
        return [];
    }

    throw new Error(lastError?.message || 'Failed to load legacy pages');
}

async function listStorefrontPages(c: AppContext, storeId: string, options: { navOnly?: boolean } = {}) {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('storefront_pages')
        .select('id,title,slug,status,page_type,seo,content,assigned_template_key,published_revision_id,published_at,updated_at')
        .eq('store_id', storeId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('published_at', { ascending: false });

    if (!error) {
        const pages = (data || []).map((page) => normalizeStorefrontRoutePage(page as CmsStorefrontRoutePageRecord));
        if (pages.length > 0) return pages;
        return listLegacyStorefrontPages(c, storeId, options);
    }

    if (isMissingTableError(error, 'storefront_pages') || isSchemaMismatchError(error)) {
        return listLegacyStorefrontPages(c, storeId, options);
    }

    throw new Error(error.message);
}

async function loadStorefrontPageBySlug(c: AppContext, storeId: string, slug: string) {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('storefront_pages')
        .select('id,title,slug,status,page_type,seo,content,assigned_template_key,published_revision_id,published_at,updated_at')
        .eq('store_id', storeId)
        .eq('slug', slug)
        .eq('status', 'published')
        .is('deleted_at', null)
        .maybeSingle();

    if (!error && data) {
        const page = data as CmsStorefrontRoutePageRecord;
        let revision: CmsStorefrontPageRevisionRecord | null = null;

        if (page.published_revision_id) {
            const revisionResult = await db
                .from('storefront_page_revisions')
                .select('id,title,slug,seo,content,template_key,created_at')
                .eq('id', page.published_revision_id)
                .eq('store_id', storeId)
                .maybeSingle();

            if (!revisionResult.error && revisionResult.data) {
                revision = revisionResult.data as CmsStorefrontPageRevisionRecord;
            }
        }

        return normalizeStorefrontRoutePage(page, revision);
    }

    if (error && !(isMissingTableError(error, 'storefront_pages') || isSchemaMismatchError(error))) {
        throw new Error(error.message);
    }

    const legacyPages = await listLegacyStorefrontPages(c, storeId);
    return legacyPages.find((page) => page.slug === slug) || null;
}

async function listStorefrontPolicies(c: AppContext, storeId: string) {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('storefront_policies')
        .select('id,policy_type,slug,title,body,status,seo,published_at,updated_at')
        .eq('store_id', storeId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('policy_type', { ascending: true });

    if (!error) return (data || []).map((policy) => normalizeStorefrontRoutePolicy(policy as CmsPolicyRecord));
    if (isMissingTableError(error, 'storefront_policies') || isSchemaMismatchError(error)) return [];
    throw new Error(error.message);
}

async function loadStorefrontPolicy(c: AppContext, storeId: string, token: string) {
    const policies = await listStorefrontPolicies(c, storeId);
    return policies.find((policy) => policy.policy_type === token || policy.slug === token) || null;
}

async function loadNavigationMenu(c: AppContext, storeId: string, location: string) {
    const db = getSupabaseAdmin(c);
    const { data: menu, error } = await db
        .from('navigation_menus')
        .select('id,handle,name,location,metadata')
        .eq('store_id', storeId)
        .eq('location', location)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!error && menu) {
        const activeMenu = menu as NavigationMenuRow;
        const itemResult = await db
            .from('navigation_menu_items')
            .select('id,menu_id,parent_item_id,label,url,target_type,target_resource_id,sort_order,open_in_new_tab,metadata')
            .eq('menu_id', activeMenu.id)
            .eq('store_id', storeId)
            .eq('is_visible', true)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true });

        if (itemResult.error) {
            throw new Error(itemResult.error.message);
        }

        return {
            menu: activeMenu,
            items: buildPublicNavigationTree((itemResult.data || []) as CmsNavigationItemRecord[]),
            source: 'navigation_menus',
        };
    }

    if (error && !(isMissingTableError(error, 'navigation_menus') || isSchemaMismatchError(error))) {
        throw new Error(error.message);
    }

    const pages = await listLegacyStorefrontPages(c, storeId, { navOnly: true });
    return {
        menu: null,
        items: pages.filter((page) => page.show_in_nav).map(storefrontPageToNavigationItem),
        source: 'legacy_pages',
    };
}

async function getVerifiedStoreCustomer(c: AppContext, storeId: string, customerId: string): Promise<VerifiedStoreCustomer | null> {
    const session = getCustomerSession(c);
    if (session) {
        if (session.storeId !== storeId || session.customerId !== customerId) {
            return null;
        }
    } else if (!isCustomerLegacyAuthEnabled(c.env)) {
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
        || 'https://store.letbuyy.store/account/reset-password';
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
        const url = new URL('https://store.letbuyy.store/account/reset-password');
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
    const from = c.env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.store>';
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

async function resolveCredentialStoreId(c: AppContext, body: CustomerLifecycleBody): Promise<string | null> {
    if (body.store_id) return body.store_id;
    if (!body.subdomain) return null;

    const store = await loadPublishedStore(c, body.subdomain);
    return store?.id || null;
}

function hexToBytes(hex: string): Uint8Array {
    const normalized = hex.toLowerCase();
    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < normalized.length; index += 2) {
        bytes[index / 2] = parseInt(normalized.slice(index, index + 2), 16);
    }
    return bytes;
}

function timingSafeEqualHex(leftHex: string, rightHex: string): boolean {
    if (leftHex.length !== rightHex.length) return false;
    if (!/^[a-f0-9]+$/i.test(leftHex) || !/^[a-f0-9]+$/i.test(rightHex)) return false;

    const left = hexToBytes(leftHex);
    const right = hexToBytes(rightHex);
    let diff = 0;
    for (let index = 0; index < left.length; index += 1) {
        diff |= left[index] ^ right[index];
    }
    return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signatureBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function isInternalRequest(c: AppContext): boolean {
    const configuredSecret = c.env.INTERNAL_API_SECRET;
    if (!configuredSecret && c.env.ENVIRONMENT !== 'production') return true;
    if (!configuredSecret) return false;
    return c.req.header('X-Internal-API-Secret') === configuredSecret;
}

function assertProvider(value: unknown): value is 'razorpay' | 'stripe' | 'paypal' | 'cashfree' {
    return value === 'razorpay' || value === 'stripe' || value === 'paypal' || value === 'cashfree';
}

async function loadInternalPayableOrder(c: AppContext, orderId: string, storeId?: string) {
    const db = getSupabaseAdmin(c);

    if (storeId) {
        return new PaymentExecutionAdapter(db).loadStorefrontPayableOrder(orderId, storeId);
    }

    const { data: order } = await db
        .from('orders')
        .select('id, store_id, total, currency, items, customer_email, payment_id, payment_method, payment_status, status, inventory_reserved_at')
        .eq('id', orderId)
        .is('deleted_at', null)
        .single();

    if (!order) throw new Error('Order not found');
    if (order.payment_status === 'paid') throw new Error('Order is already paid');
    if (order.status === 'cancelled' || order.status === 'refunded') throw new Error('Order is not payable');

    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) throw new Error('Order has no payable total');

    return { ...order, total, currency: order.currency || 'INR' };
}

// GET /storefront/internal/orders/:orderId/payable — Internal server-to-worker payable order read
router.get('/internal/orders/:orderId/payable', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const orderId = c.req.param('orderId');
    const storeId = c.req.query('store_id') || undefined;
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || (storeId && !/^[0-9a-f-]{36}$/i.test(storeId))) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid order or store id' } }, 400);
    }

    try {
        const order = await loadInternalPayableOrder(c, orderId, storeId);
        return c.json(success({ order }));
    } catch {
        return c.json({ success: false, error: { code: 'PAYMENT_ORDER_NOT_PAYABLE', message: 'Order is not payable' } }, 409);
    }
});

// POST /storefront/internal/payments/reference — Internal provider reference attach
router.post('/internal/payments/reference', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = await c.req.json() as InternalPaymentReferenceBody;
    if (!body.orderId || !assertProvider(body.provider) || !body.paymentReference) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider and paymentReference are required' } }, 400);
    }

    if (body.storeId) await loadInternalPayableOrder(c, body.orderId, body.storeId);

    const db = getSupabaseAdmin(c);
    await new PaymentExecutionAdapter(db).attachPaymentReference({
        orderId: body.orderId,
        provider: body.provider,
        providerOrderId: body.paymentReference,
        requestId: getRequestId(c),
        idempotencyKey: body.idempotencyKey || null,
    });

    return c.json(success({ attached: true }));
});

// POST /storefront/internal/payments/confirm — Internal provider payment confirmation
router.post('/internal/payments/confirm', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = await c.req.json() as InternalPaymentConfirmBody;
    if (!body.orderId || !assertProvider(body.provider) || !body.paymentId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider and paymentId are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const order = await new PaymentExecutionAdapter(db).confirmPayment({
        orderId: body.orderId,
        provider: body.provider,
        providerPaymentId: body.paymentId,
        providerOrderId: body.providerOrderId || null,
        providerEventId: body.providerEventId || `${body.provider}:storefront:${body.paymentId}`,
        requestId: getRequestId(c),
        idempotencyKey: body.idempotencyKey || null,
    });
    await emitStorefrontOrderPaidEvent(db, {
        orderId: body.orderId,
        order: order as StorefrontPaidOrderSnapshot,
        requestId: getRequestId(c),
        idempotencyKey: body.idempotencyKey || body.providerEventId || body.paymentId,
    });

    return c.json(success({ order }));
});

// POST /storefront/internal/payments/failure — Internal provider payment failure/refund state
router.post('/internal/payments/failure', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = await c.req.json() as InternalPaymentFailureBody;
    if (!body.orderId || !assertProvider(body.provider) || !body.providerEventId || !body.paymentStatus || !body.orderStatus) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider, providerEventId, paymentStatus and orderStatus are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const order = await new PaymentExecutionAdapter(db).recordPaymentFailure({
        orderId: body.orderId,
        provider: body.provider,
        providerEventId: body.providerEventId,
        paymentStatus: body.paymentStatus,
        orderStatus: body.orderStatus,
        reason: body.reason || null,
        releaseInventory: Boolean(body.releaseInventory),
        requestId: getRequestId(c),
        idempotencyKey: body.idempotencyKey || null,
    });

    return c.json(success({ order }));
});

// GET /storefront/lookup?q=handle — Public store lookup for routing/search surfaces
router.get('/lookup', async (c) => {
    const query = normalizeStorefrontHandle(c.req.query('q') || '');
    if (!query) {
        return c.json({
            success: true,
            data: {
                status: 'invalid',
                message: 'Store name must contain 3-80 letters, numbers or hyphens',
            },
        });
    }

    const db = getSupabaseAdmin(c);
    const selectFields = 'store_name,name,status,site_type,subdomain';
    const { data: exactMatch } = await db
        .from('sites')
        .select(selectFields)
        .or(`store_name.eq.${query},subdomain.eq.${query}`)
        .not('status', 'eq', 'suspended')
        .is('deleted_at', null)
        .limit(1);

    const exactSite = exactMatch?.[0];
    if (exactSite) {
        return c.json(success({
            status: 'found',
            store: {
                name: exactSite.name || exactSite.store_name,
                subdomain: exactSite.subdomain || exactSite.store_name,
                status: exactSite.status,
                siteType: exactSite.site_type,
            },
        }));
    }

    const { data: fuzzyMatch } = await db
        .from('sites')
        .select(selectFields)
        .ilike('name', `%${query}%`)
        .not('status', 'eq', 'suspended')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

    const fuzzySite = fuzzyMatch?.[0];
    if (fuzzySite) {
        return c.json(success({
            status: 'found',
            store: {
                name: fuzzySite.name || fuzzySite.store_name,
                subdomain: fuzzySite.subdomain || fuzzySite.store_name,
                status: fuzzySite.status,
                siteType: fuzzySite.site_type,
            },
        }));
    }

    return c.json(success({ status: 'not_found' }));
});

// GET /storefront/directory — Public LetBuyy discovery directory and aggregate stats
router.get('/directory', async (c) => {
    const db = getSupabaseAdmin(c);

    const { data: storesRaw } = await db
        .from('sites')
        .select(`
            store_name,
            name,
            logo_url,
            theme_id,
            status,
            site_type,
            created_at,
            users_custom!sites_custom_user_id_fkey (
                full_name,
                email
            )
        `)
        .in('status', ['draft', 'published'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(12);

    const [storesCount, themesCount, productsCount, ordersCount] = await Promise.all([
        db.from('sites').select('*', { count: 'exact', head: true }).not('status', 'eq', 'suspended').is('deleted_at', null),
        db.from('online_store_themes').select('*', { count: 'exact', head: true }),
        db.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        db.from('orders').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    ]);

    return c.json(success({
        stores: storesRaw || [],
        stats: {
            totalStores: storesCount.count || 0,
            totalThemes: themesCount.count || 0,
            totalProducts: productsCount.count || 0,
            totalOrders: ordersCount.count || 0,
        },
    }));
});

// GET /storefront/store/:storeId — Public published store data by immutable ID.
// Kept for legacy storefront service compatibility; still only returns published stores.
router.get('/store/:storeId', async (c) => {
    const storeId = c.req.param('storeId');
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid store id' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const selectStore = (selectFields: string, includeDeletedAtFilter: boolean) => {
        let query = db
            .from('sites')
            .select(selectFields)
            .eq('id', storeId)
            .eq('status', 'published');

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);

        return query;
    };

    let { data, error } = await selectStore(STOREFRONT_SITE_RELEASE_SELECT, true).single();

    if (error || !data) {
        ({ data, error } = await selectStore(STOREFRONT_SITE_RELEASE_COMPAT_SELECT, true).single());
    }

    if (error || !data) {
        ({ data, error } = await selectStore(STOREFRONT_SITE_SELECT, true).single());
    }

    if (error || !data) {
        ({ data, error } = await selectStore(STOREFRONT_SITE_COMPAT_SELECT, true).single());
    }

    if (error || !data) {
        ({ data } = await selectStore(STOREFRONT_SITE_COMPAT_SELECT, false).single());
    }

    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const store = data as unknown as StorefrontSiteRecord;
    const [release, appBlocks] = await Promise.all([
        loadCurrentThemeRelease(c, store.id),
        loadPublicStorefrontAppBlocks(c, store.id),
    ]);
    return c.json(success({
        ...mapPublicStorePayload(store, release),
        app_blocks: appBlocks,
    }));
});

// GET /storefront/store/:storeId/products — Public published product listing by store ID
router.get('/store/:storeId/products', async (c) => {
    const storeId = c.req.param('storeId');
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid store id' } }, 400);
    }

    const store = await loadPublishedStoreById(c, storeId);

    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 100);
    const { data, error } = await queryPublicProducts(c, storeId, { limit });
    if (error) return c.json(dbFailureBody(), 500);
    return c.json(success(data || []));
});

// GET /storefront/store/:storeId/coupons/validate — Public checkout coupon validation by store ID
router.get('/store/:storeId/coupons/validate', async (c) => {
    const storeId = c.req.param('storeId');
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid store id' } }, 400);
    }

    const store = await loadPublishedStoreById(c, storeId);

    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    return validateCouponForStore(c, storeId);
});

// GET /storefront/reviews — Public approved reviews for a product.
// Keep this before /:subdomain so "reviews" is not treated as a tenant handle.
router.get('/reviews', validate('query', StorefrontProductReviewsQuery), listPublicProductReviews);

// GET /storefront/:subdomain/checkout/extensions — Public enabled checkout UI extensions for a published store.
router.get('/:subdomain/checkout/extensions', async (c) => {
    const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: true });
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const { data, error } = await getSupabaseAdmin(c)
        .from('app_extension_registrations')
        .select('id, site_id, app_id, installation_id, extension_handle, extension_type, surface, target, renderer, source_url, source_entrypoint, scopes, capabilities, settings, manifest_schema_version, app_version, status, enabled_at, disabled_at, revoked_at, sort_order, created_at, updated_at')
        .eq('site_id', store.id)
        .eq('surface', 'checkout.ui')
        .eq('status', 'enabled')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (isMissingTableError(error, 'app_extension_registrations')) {
        return c.json(success({
            store_id: store.id,
            surface: 'checkout.ui',
            extensions: [],
        }));
    }

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({
        store_id: store.id,
        surface: 'checkout.ui',
        extensions: data || [],
    }));
});

// GET /storefront/:subdomain/theme-preview?token=...
// Signed storefront preview for editor iframes. Uses the same public store payload
// shape as live rendering, but swaps the current release config with the draft.
router.get('/:subdomain/theme-preview', async (c) => {
    const token = c.req.query('token') || '';
    if (!token || token.length > 200) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Preview token is required' } }, 400);
    }

    const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: false });
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const db = getSupabaseAdmin(c);
    const tokenHash = await sha256Hex(token);
    let { data: session, error: sessionError } = await db
        .from('theme_preview_sessions')
        .select('id, store_id, theme_id, draft_id, theme_instance_draft_id, draft_version, expires_at')
        .eq('store_id', store.id)
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (isMissingColumnError(sessionError, 'theme_instance_draft_id')) {
        ({ data: session, error: sessionError } = await db
            .from('theme_preview_sessions')
            .select('id, store_id, theme_id, draft_id, draft_version, expires_at')
            .eq('store_id', store.id)
            .eq('token_hash', tokenHash)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle());
    }

    if (isMissingTableError(sessionError, 'theme_preview_sessions')) {
        return c.json({ success: false, error: { code: 'PREVIEW_UNAVAILABLE', message: 'Theme preview sessions are not migrated yet' } }, 503);
    }

    if (sessionError) {
        return c.json(dbFailureBody(), 500);
    }

    if (!session) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Preview session not found or expired' } }, 404);
    }

    const previewSession = session as ThemePreviewSessionRow;
    let draftId = previewSession.theme_instance_draft_id || previewSession.draft_id || '';
    let draftManifest: Record<string, unknown> = {};
    let draftVersion = previewSession.draft_version || 1;
    let draftSavedAt = new Date().toISOString();
    let draftLoaded = false;

    if (previewSession.theme_instance_draft_id) {
        const { data: instanceDraft, error: instanceDraftError } = await db
            .from('theme_instance_drafts')
            .select('id, working_manifest, draft_version, auto_saved_at')
            .eq('id', previewSession.theme_instance_draft_id)
            .eq('store_id', store.id)
            .maybeSingle();

        if (instanceDraftError && !isMissingTableError(instanceDraftError, 'theme_instance_drafts')) {
            return c.json(dbFailureBody(), 500);
        }

        if (instanceDraft) {
            const draftRecord = instanceDraft as ThemeInstanceDraftRow;
            draftId = draftRecord.id;
            draftManifest = draftRecord.working_manifest || {};
            draftVersion = draftRecord.draft_version || previewSession.draft_version || 1;
            draftSavedAt = draftRecord.auto_saved_at || draftSavedAt;
            draftLoaded = true;
        }
    }

    if (!draftLoaded && previewSession.draft_id) {
        const { data: legacyDraft, error: legacyDraftError } = await db
            .from('theme_editor_drafts')
            .select('id, draft_config, version, auto_saved_at')
            .eq('id', previewSession.draft_id)
            .eq('store_id', store.id)
            .eq('theme_id', previewSession.theme_id)
            .maybeSingle();

        if (isMissingTableError(legacyDraftError, 'theme_editor_drafts')) {
            return c.json({ success: false, error: { code: 'PREVIEW_UNAVAILABLE', message: 'Theme editor drafts are not migrated yet' } }, 503);
        }

        if (legacyDraftError) {
            return c.json(dbFailureBody(), 500);
        }

        if (legacyDraft) {
            const draftRecord = legacyDraft as ThemeEditorDraftRow;
            draftId = draftRecord.id;
            draftManifest = draftRecord.draft_config || {};
            draftVersion = draftRecord.version || previewSession.draft_version || 1;
            draftSavedAt = draftRecord.auto_saved_at || draftSavedAt;
            draftLoaded = true;
        }
    }

    if (!draftLoaded) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Preview draft not found' } }, 404);
    }

    const liveRelease = await loadCurrentThemeRelease(c, store.id);
    const previewRelease: StorefrontThemeReleaseRecord = {
        id: previewSession.id,
        theme_id: previewSession.theme_id,
        theme_instance_id: liveRelease?.theme_instance_id || null,
        theme_package_version_id: liveRelease?.theme_package_version_id || null,
        release_version: draftVersion,
        release_config: draftManifest,
        release_manifest: {
            ...(liveRelease?.release_manifest || {}),
            preview: true,
            preview_session_id: previewSession.id,
            draft_id: draftId,
            theme_instance_draft_id: previewSession.theme_instance_draft_id || null,
        },
        template_snapshot: draftManifest,
        settings_snapshot: {},
        asset_manifest: liveRelease?.asset_manifest || {},
        cache_manifest: { tags: [`store:${store.id}`, `theme:${previewSession.theme_id}`, `theme_preview:${previewSession.id}`] },
        data_binding_manifest: liveRelease?.data_binding_manifest || {},
        schema_manifest_version: liveRelease?.schema_manifest_version || '1.0.0',
        engine_version: liveRelease?.engine_version || 'theme-engine-v1',
        published_at: draftSavedAt,
    };

    const appBlocks = await loadPublicStorefrontAppBlocks(c, store.id);

    return c.json(success({
        ...mapPublicStorePayload(store, previewRelease),
        app_blocks: appBlocks,
        theme_preview: {
            session_id: previewSession.id,
            draft_id: draftId,
            theme_instance_draft_id: previewSession.theme_instance_draft_id || null,
            draft_version: draftVersion,
            expires_at: previewSession.expires_at,
        },
    }));
});

// GET /storefront/:subdomain — Public published store data and immutable current release
router.get('/:subdomain', async (c) => {
    const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: true });
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const [release, appBlocks] = await Promise.all([
        loadCurrentThemeRelease(c, store.id),
        loadPublicStorefrontAppBlocks(c, store.id),
    ]);
    return c.json(success({
        ...mapPublicStorePayload(store, release),
        app_blocks: appBlocks,
    }));
});

// GET /storefront/:subdomain/status — Public limited status data for coming-soon routing.
// Draft/suspended stores never expose mutable theme config through this endpoint.
router.get('/:subdomain/status', async (c) => {
    const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: false });
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    return c.json(success({
        id: store.id,
        name: store.name || store.store_name,
        store_name: store.store_name,
        subdomain: store.subdomain || store.store_name,
        site_type: store.site_type,
        tagline: store.tagline,
        logo_url: store.logo_url,
        status: store.status || 'draft',
        published_at: store.published_at || null,
        created_at: store.created_at || null,
        updated_at: store.updated_at || null,
    }));
});

// POST /storefront/:subdomain/orders — Public checkout order creation.
// The subdomain owns tenant resolution; client-submitted store IDs and totals are ignored.
router.post('/:subdomain/orders', validate('json', StorefrontCreateOrderSchema), async (c) => {
    const db = getSupabaseAdmin(c);
    const subdomain = c.req.param('subdomain');
    const body = c.get('validatedBody') as StorefrontCreateOrderBody;
    const store = await loadPublishedStore(c, subdomain);

    if (!store) {
        return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
            404
        );
    }

    const service = new OrderExecutionAdapter(db);
    const tenant = await createPublicStorefrontTenantContext(c, store.id);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: store.id,
        key: body.idempotencyKey,
        scope: 'storefront.checkout.order.create',
        requestBody: { ...body, resolvedStoreId: store.id },
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as any, claim.statusCode as any);
    }

    try {
        const shippingAddress = {
            name: body.customer.name,
            line1: body.customer.address.address,
            city: body.customer.address.city,
            state: body.customer.address.state,
            state_code: body.customer.address.stateCode,
            zip: body.customer.address.pincode,
            country: 'IN',
            phone: body.customer.phone,
            gstin: body.customer.gstin,
        };
        const functionEvaluation = await evaluateCheckoutAppFunctions(c, {
            siteId: store.id,
            requestId: tenant.requestId,
            couponCode: body.couponCode,
            cart: {
                lines: body.items.map((item) => ({
                    product_id: item.productId,
                    variant_id: item.variantId || null,
                    quantity: item.quantity,
                })),
                coupon_code: body.couponCode || null,
                gift_card_code: body.giftCardCode || null,
            },
            checkout: {
                payment_method: body.paymentMethod,
                shipping_method: body.deliveryOption,
                customer: {
                    name: body.customer.name,
                    email: body.customer.email,
                    phone: body.customer.phone,
                    gstin: body.customer.gstin,
                },
                shipping_address: shippingAddress,
            },
        });

        if (functionEvaluation.decision.validationErrors.length > 0) {
            await idempotency.fail(claim.id);
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'CHECKOUT_FUNCTION_VALIDATION',
                        message: functionEvaluation.decision.validationErrors[0]?.message || 'Checkout validation failed',
                        details: functionEvaluation.decision.validationErrors,
                    },
                },
                400
            );
        }

        const order = await service.createOrder(
            {
                customer_name: body.customer.name,
                customer_email: body.customer.email,
                customer_phone: body.customer.phone,
                shipping_address: shippingAddress,
                customer_gstin: body.customer.gstin,
                items: body.items.map((item) => ({
                    product_id: item.productId,
                    variant_id: item.variantId || null,
                    quantity: item.quantity,
                })),
                payment_method: functionEvaluation.decision.paymentMethod,
                shipping_method: functionEvaluation.decision.shippingMethod,
                notes: body.notes,
                coupon_code: functionEvaluation.decision.couponCode,
                gift_card_code: body.giftCardCode,
                idempotency_key: body.idempotencyKey,
            },
            tenant
        ) as OrderRpcResult;

        await emitStorefrontOrderCreatedEvent(db, {
            storeId: store.id,
            order,
            requestId: tenant.requestId,
        });

        const responseBody = success({
            order: {
                id: order.id || '',
                orderNumber: order.order_number || '',
                status: order.status || 'pending',
                total: Number(order.total || 0),
                gstInvoiceNumber: order.gst_invoice_number || null,
                gst_invoice_number: order.gst_invoice_number || null,
                gstInvoice: order.gst_invoice || null,
                gst_invoice: order.gst_invoice || null,
                placeOfSupplyState: order.place_of_supply_state || null,
                place_of_supply_state: order.place_of_supply_state || null,
            },
            extensionFunctions: functionEvaluation.executions.map((execution) => ({
                registrationId: execution.registrationId,
                appId: execution.appId,
                hook: execution.hook,
                handle: execution.handle,
                status: execution.status,
                durationMs: execution.durationMs,
                operations: execution.operations,
                errorCode: execution.errorCode || null,
            })),
        });

        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 201,
            resourceType: 'order',
            resourceId: order.id,
        });

        return c.json(responseBody, 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /storefront/:subdomain/payments/razorpay/order — Public Razorpay order creation.
router.post(
    '/:subdomain/payments/razorpay/order',
    validate('json', StorefrontRazorpayOrderSchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontRazorpayOrderBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentExecutionAdapter(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const amount = orderAmountMinorUnits(order);
        if (!amount) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                400
            );
        }

        const amountMinorUnits = amount.amountMinor;
        const requestedMinorUnits = requestedAmountMinorUnits(body);
        if (requestedMinorUnits !== null && requestedMinorUnits !== amountMinorUnits) {
            return c.json(
                { success: false, error: { code: 'AMOUNT_MISMATCH', message: 'Order amount changed. Please refresh checkout and try again.' } },
                400
            );
        }

        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.razorpay.order:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        try {
            const provider = createRazorpayPaymentProvider({
                keyId: c.env.RAZORPAY_KEY_ID,
                keySecret: c.env.RAZORPAY_KEY_SECRET,
            });
            const intent = await provider.createIntent({
                storeId: store.id,
                orderId: body.orderId,
                amount,
                idempotencyKey: body.idempotencyKey,
                receipt: body.orderId,
                metadata: {
                    source: 'storefront',
                },
            });
            const providerOrderId = intent.references.providerOrderId;

            if (!providerOrderId) {
                await idempotency.fail(claim.id);
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'PAYMENT_PROVIDER_ERROR',
                            message: 'Failed to create Razorpay order',
                        },
                    },
                    502
                );
            }

            await paymentService.attachPaymentReference({
                orderId: body.orderId,
                provider: 'razorpay',
                providerOrderId,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({
                keyId: c.env.RAZORPAY_KEY_ID,
                key_id: c.env.RAZORPAY_KEY_ID,
                razorpayOrderId: providerOrderId,
                razorpay_order_id: providerOrderId,
                amount: intent.amount.amountMinor,
                currency: intent.amount.currency,
            });

            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// POST /storefront/:subdomain/payments/razorpay/verify — Public Razorpay signature verification.
router.post(
    '/:subdomain/payments/razorpay/verify',
    validate('json', StorefrontRazorpayVerifySchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontRazorpayVerifyBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        if (!c.env.RAZORPAY_KEY_SECRET) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentExecutionAdapter(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const amount = orderAmountMinorUnits(order);
        if (!amount) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                400
            );
        }
        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.razorpay.verify:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        if (order.payment_id && order.payment_id !== body.razorpay_order_id) {
            await idempotency.fail(claim.id);
            return c.json(
                { success: false, error: { code: 'PAYMENT_REFERENCE_MISMATCH', message: 'Razorpay order does not match this checkout order' } },
                409
            );
        }

        const provider = createRazorpayPaymentProvider({
            keyId: c.env.RAZORPAY_KEY_ID || 'storefront',
            keySecret: c.env.RAZORPAY_KEY_SECRET,
        });
        const verification = await provider.verify({
            storeId: store.id,
            orderId: body.orderId,
            amount,
            idempotencyKey: body.idempotencyKey,
            providerOrderId: body.razorpay_order_id,
            providerPaymentId: body.razorpay_payment_id,
            signature: body.razorpay_signature,
        });

        if (!verification.verified) {
            await idempotency.fail(claim.id);
            return c.json(
                {
                    success: false,
                    error: {
                        code: verification.failureCode || 'PAYMENT_SIGNATURE_INVALID',
                        message: verification.failureMessage || 'Invalid payment signature',
                    },
                },
                400
            );
        }

        try {
            const confirmedOrder = await paymentService.confirmPayment({
                orderId: body.orderId,
                provider: 'razorpay',
                providerPaymentId: body.razorpay_payment_id,
                providerOrderId: body.razorpay_order_id,
                providerEventId: `razorpay:checkout:${body.razorpay_payment_id}`,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });
            await emitStorefrontOrderPaidEvent(db, {
                storeId: store.id,
                orderId: body.orderId,
                order: confirmedOrder as StorefrontPaidOrderSnapshot,
                fallbackOrder: order,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({ verified: true, order: confirmedOrder });
            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// POST /storefront/:subdomain/payments/cashfree/order — Public Cashfree order creation.
router.post(
    '/:subdomain/payments/cashfree/order',
    validate('json', StorefrontCashfreeOrderSchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontCashfreeOrderBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        const credentials = getCashfreeCredentials(c);
        if (!credentials) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Cashfree is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentExecutionAdapter(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const amount = orderAmountMinorUnits(order);
        if (!amount) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                400
            );
        }

        const requestedMinorUnits = requestedAmountMinorUnits(body);
        if (requestedMinorUnits !== null && requestedMinorUnits !== amount.amountMinor) {
            return c.json(
                { success: false, error: { code: 'AMOUNT_MISMATCH', message: 'Order amount changed. Please refresh checkout and try again.' } },
                400
            );
        }

        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.cashfree.order:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        try {
            const provider = createCashfreePaymentProvider(credentials);
            const intent = await provider.createIntent({
                storeId: store.id,
                orderId: body.orderId,
                amount,
                idempotencyKey: body.idempotencyKey,
                description: `LetBuyy order ${body.orderId}`,
                customer: {
                    email: body.customerEmail,
                    phone: body.customerPhone,
                    name: body.customerName,
                },
                metadata: {
                    return_url: body.returnUrl,
                    notify_url: body.notifyUrl,
                    payment_methods: body.paymentMethods,
                    request_id: getRequestId(c),
                    source: 'storefront',
                },
            });
            const providerOrderId = intent.references.providerOrderId;
            if (!providerOrderId || !intent.clientSecret) {
                await idempotency.fail(claim.id);
                return c.json(
                    { success: false, error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'Failed to create Cashfree order' } },
                    502
                );
            }

            await paymentService.attachPaymentReference({
                orderId: body.orderId,
                provider: 'cashfree',
                providerOrderId,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({
                cashfreeOrderId: providerOrderId,
                cashfree_order_id: providerOrderId,
                paymentSessionId: intent.clientSecret,
                payment_session_id: intent.clientSecret,
                amount: intent.amount.amountMinor,
                currency: intent.amount.currency,
                environment: credentials.environment,
            });

            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// POST /storefront/:subdomain/payments/cashfree/verify — Public Cashfree payment verification.
router.post(
    '/:subdomain/payments/cashfree/verify',
    validate('json', StorefrontCashfreeVerifySchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontCashfreeVerifyBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        const credentials = getCashfreeCredentials(c);
        if (!credentials) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Cashfree is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentExecutionAdapter(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const amount = orderAmountMinorUnits(order);
        if (!amount) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                400
            );
        }

        if (order.payment_id && order.payment_id !== body.cashfree_order_id && order.payment_id !== body.cf_payment_id) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_REFERENCE_MISMATCH', message: 'Cashfree order does not match this checkout order' } },
                409
            );
        }

        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.cashfree.verify:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        const provider = createCashfreePaymentProvider(credentials);
        const verification = await provider.verify({
            storeId: store.id,
            orderId: body.orderId,
            amount,
            idempotencyKey: body.idempotencyKey,
            providerOrderId: body.cashfree_order_id,
            providerPaymentId: body.cf_payment_id,
            metadata: {
                request_id: getRequestId(c),
                source: 'storefront',
            },
        });

        if (!verification.verified || !verification.references.providerPaymentId) {
            await idempotency.fail(claim.id);
            return c.json(
                {
                    success: false,
                    error: {
                        code: verification.failureCode || 'CASHFREE_PAYMENT_NOT_PAID',
                        message: verification.failureMessage || 'Cashfree payment is not paid',
                    },
                },
                400
            );
        }

        try {
            const confirmedOrder = await paymentService.confirmPayment({
                orderId: body.orderId,
                provider: 'cashfree',
                providerPaymentId: verification.references.providerPaymentId,
                providerOrderId: verification.references.providerOrderId || body.cashfree_order_id,
                providerEventId: `cashfree:checkout:${verification.references.providerPaymentId}`,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });
            await emitStorefrontOrderPaidEvent(db, {
                storeId: store.id,
                orderId: body.orderId,
                order: confirmedOrder as StorefrontPaidOrderSnapshot,
                fallbackOrder: order,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({
                verified: true,
                paymentId: verification.references.providerPaymentId,
                payment_id: verification.references.providerPaymentId,
                order: confirmedOrder,
            });
            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// POST /storefront/:subdomain/payments/stripe/checkout — Public Stripe checkout session creation.
router.post(
    '/:subdomain/payments/stripe/checkout',
    validate('json', StorefrontStripeCheckoutSchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontStripeCheckoutBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        if (!c.env.STRIPE_SECRET_KEY) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Stripe is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentExecutionAdapter(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const amount = orderAmountMinorUnits(order);
        if (!amount) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                400
            );
        }

        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.stripe.checkout:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        try {
            const provider = createStripePaymentProvider({ secretKey: c.env.STRIPE_SECRET_KEY });
            const intent = await provider.createIntent({
                storeId: store.id,
                orderId: body.orderId,
                amount,
                idempotencyKey: body.idempotencyKey,
                description: `LetBuyy order ${body.orderId}`,
                customer: {
                    email: body.customerEmail,
                },
                metadata: {
                    success_url: body.successUrl,
                    cancel_url: body.cancelUrl,
                    name: `LetBuyy order ${body.orderId}`,
                    source: 'storefront',
                },
            });
            const providerOrderId = intent.references.providerOrderId;
            if (!providerOrderId || !intent.redirectUrl) {
                await idempotency.fail(claim.id);
                return c.json(
                    { success: false, error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'Failed to create Stripe checkout session' } },
                    502
                );
            }

            await paymentService.attachPaymentReference({
                orderId: body.orderId,
                provider: 'stripe',
                providerOrderId,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({
                sessionId: providerOrderId,
                session_id: providerOrderId,
                url: intent.redirectUrl,
                session_url: intent.redirectUrl,
            });

            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// POST /storefront/:subdomain/payments/paypal/order — Public PayPal order creation.
router.post(
    '/:subdomain/payments/paypal/order',
    validate('json', StorefrontPayPalOrderSchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontPayPalOrderBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        const credentials = getPayPalCredentials(c);
        if (!credentials) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'PayPal is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentExecutionAdapter(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const amount = orderAmountMinorUnits(order);
        if (!amount) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                400
            );
        }

        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.paypal.order:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        try {
            const provider = createPayPalPaymentProvider(credentials);
            const intent = await provider.createIntent({
                storeId: store.id,
                orderId: body.orderId,
                amount,
                idempotencyKey: body.idempotencyKey,
                description: `LetBuyy order ${body.orderId}`,
                metadata: {
                    return_url: body.returnUrl,
                    cancel_url: body.cancelUrl,
                    source: 'storefront',
                },
            });
            const providerOrderId = intent.references.providerOrderId;
            if (!providerOrderId || !intent.redirectUrl) {
                await idempotency.fail(claim.id);
                return c.json(
                    { success: false, error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'Failed to create PayPal order' } },
                    502
                );
            }

            await paymentService.attachPaymentReference({
                orderId: body.orderId,
                provider: 'paypal',
                providerOrderId,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({
                paypalOrderId: providerOrderId,
                paypal_order_id: providerOrderId,
                approvalUrl: intent.redirectUrl,
                approval_url: intent.redirectUrl,
            });

            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// POST /storefront/:subdomain/payments/paypal/capture — Public PayPal capture confirmation.
router.post(
    '/:subdomain/payments/paypal/capture',
    validate('json', StorefrontPayPalCaptureSchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontPayPalCaptureBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        const credentials = getPayPalCredentials(c);
        if (!credentials) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'PayPal is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentExecutionAdapter(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const amount = orderAmountMinorUnits(order);
        if (!amount) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only INR storefront payments are supported' } },
                400
            );
        }

        if (order.payment_id && order.payment_id !== body.paypalOrderId) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_REFERENCE_MISMATCH', message: 'PayPal order does not match this checkout order' } },
                409
            );
        }

        const idempotency = new IdempotencyExecutionAdapter(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.paypal.capture:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        try {
            const provider = createPayPalPaymentProvider(credentials);
            const capture = await provider.capture({
                storeId: store.id,
                orderId: body.orderId,
                amount,
                idempotencyKey: body.idempotencyKey,
                providerOrderId: body.paypalOrderId,
            });

            if (capture.status !== 'paid' || !capture.references.providerPaymentId) {
                await idempotency.fail(claim.id);
                return c.json(
                    {
                        success: false,
                        error: {
                            code: capture.failureCode || 'PAYPAL_CAPTURE_FAILED',
                            message: capture.failureMessage || 'PayPal capture failed',
                        },
                    },
                    400
                );
            }

            const confirmedOrder = await paymentService.confirmPayment({
                orderId: body.orderId,
                provider: 'paypal',
                providerPaymentId: capture.references.providerPaymentId,
                providerOrderId: body.paypalOrderId,
                providerEventId: `paypal:checkout:${capture.references.providerPaymentId}`,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });
            await emitStorefrontOrderPaidEvent(db, {
                storeId: store.id,
                orderId: body.orderId,
                order: confirmedOrder as StorefrontPaidOrderSnapshot,
                fallbackOrder: order,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({
                captured: true,
                captureId: capture.references.providerPaymentId,
                capture_id: capture.references.providerPaymentId,
                status: capture.status,
                order: confirmedOrder,
            });

            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// GET /storefront/:subdomain/products — Public product listing
router.get('/:subdomain/products', async (c) => {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    const { data, count, error } = await queryPublicProducts(c, store.id, {
        page,
        limit,
        paginated: true,
        category: c.req.query('category') || undefined,
        search: c.req.query('search') || undefined,
    });
    if (error) return c.json(dbFailureBody(), 500);
    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /storefront/:subdomain/products/by-ids?ids=a,b — Public product subset scoped by store
router.get('/:subdomain/products/by-ids', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const ids = (c.req.query('ids') || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
        .slice(0, 100);

    if (!ids.length) return c.json(success([]));

    const { data, error } = await queryPublicProducts(c, store.id, { limit: 100, ids });
    if (error) return c.json(dbFailureBody(), 500);
    return c.json(success(data || []));
});

// GET /storefront/:subdomain/products/:slug — Single product scoped by store.
// Accepts either a product slug or UUID to preserve existing storefront URLs.
router.get('/:subdomain/products/:slug', async (c) => {
    const db = getSupabaseAdmin(c);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    const identifier = c.req.param('slug');
    if (!/^[a-z0-9-]{1,120}$/i.test(identifier)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid product identifier' } }, 400);
    }
    const { data } = await db
        .from('products')
        .select('*, product_variants(*)')
        .eq('store_id', store.id)
        .or(`slug.eq.${identifier},id.eq.${identifier}`)
        .eq('is_active', true)
        .single();
    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    await new ProductExecutionAdapter(db).recordStorefrontView(data as StorefrontProductDetail);
    return c.json(success(data));
});

// GET /storefront/:subdomain/coupons/validate — Public checkout coupon validation
router.get('/:subdomain/coupons/validate', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    return validateCouponForStore(c, store.id);
});

async function validateCouponForStore(c: AppContext, storeId: string) {
    const code = (c.req.query('code') || '').trim().toUpperCase();
    const subtotal = Number(c.req.query('subtotal') || 0);

    if (!code || !Number.isFinite(subtotal) || subtotal < 0) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'code and subtotal are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const buildCouponQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('coupons')
            .select('*')
            .eq('store_id', storeId)
            .eq('code', code)
            .eq('is_active', true);

        return includeDeletedAtFilter ? query.is('deleted_at', null).maybeSingle() : query.maybeSingle();
    };

    let { data: coupon, error } = await buildCouponQuery(true);
    if (error && isSchemaMismatchError(error)) {
        ({ data: coupon, error } = await buildCouponQuery(false));
    }

    if (error) return c.json(dbFailureBody(), 500);
    if (!coupon) return c.json(success({ valid: false, error: 'Invalid coupon code' }));

    const plan = planCouponValidation(coupon as CouponRecord, { subtotal, enforceMinimumOrder: true });
    if (!plan.valid) {
        return c.json(success({
            valid: false,
            error: storefrontCouponValidationError(plan.failureCode, plan.coupon.minimumOrderAmount),
        }));
    }

    return c.json(success({
        valid: true,
        coupon: {
            code: plan.coupon.code,
            type: plan.coupon.type,
            value: plan.coupon.value,
            discount: plan.coupon.discount,
            freeShipping: plan.coupon.freeShipping,
        },
    }));
}

// GET /storefront/:subdomain/categories
router.get('/:subdomain/categories', async (c) => {
    const db = getSupabaseAdmin(c);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    const { data } = await db.from('product_categories').select('id,name,slug,image_url,parent_id,product_count').eq('store_id', store.id).eq('is_visible', true).order('display_order');
    return c.json(success(data || []));
});

// GET /storefront/:subdomain/navigation?location=main
router.get('/:subdomain/navigation', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const location = normalizePublicRouteToken(c.req.query('location') || 'main');
    if (!location) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid menu location' } }, 400);
    }

    try {
        const navigation = await loadNavigationMenu(c, store.id, location);
        return c.json(success(navigation));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load navigation' },
        }, 500);
    }
});

// GET /storefront/:subdomain/pages
router.get('/:subdomain/pages', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    try {
        const pages = await listStorefrontPages(c, store.id);
        return c.json(success(pages));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load pages' },
        }, 500);
    }
});

// GET /storefront/:subdomain/policies
router.get('/:subdomain/policies', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    try {
        const policies = await listStorefrontPolicies(c, store.id);
        return c.json(success(policies));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load policies' },
        }, 500);
    }
});

// GET /storefront/:subdomain/policies/:policyType
router.get('/:subdomain/policies/:policyType', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const policyToken = normalizePublicRouteToken(c.req.param('policyType'));
    if (!policyToken) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid policy type' } }, 400);
    }

    try {
        const policy = await loadStorefrontPolicy(c, store.id, policyToken);
        if (!policy) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } }, 404);
        return c.json(success(policy));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load policy' },
        }, 500);
    }
});

// GET /storefront/:subdomain/pages/:slug
router.get('/:subdomain/pages/:slug', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const slug = normalizePublicRouteToken(c.req.param('slug'));
    if (!slug) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid page slug' } }, 400);
    }

    try {
        const page = await loadStorefrontPageBySlug(c, store.id, slug);
        if (!page) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Page not found' } }, 404);
        return c.json(success(page));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load page' },
        }, 500);
    }
});

// POST /storefront/customer/find-or-create — Sessionless checkout customer bootstrap
router.post('/customer/find-or-create', async (c) => {
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

// POST /storefront/customer/password — Persist a server-generated password hash
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
            password_hash: passwordHash,
            status: 'active',
        })
        .eq('store_id', body.store_id)
        .eq('email', normalizeEmail(body.email))
        .select('id')
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
    }

    await insertCustomerActivity(c, data.id, body.store_id, 'password_set', {});
    return c.json(success({ customer_id: data.id }));
});

// POST /storefront/customer/password/request-reset — Create a token-bound reset intent
router.post('/customer/password/request-reset', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;

    if (!body.store_id || !body.email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
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

// POST /storefront/customer/password/confirm-reset — Consume a token-bound reset intent
router.post('/customer/password/confirm-reset', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;
    const resetToken = normalizePasswordResetToken(body.token || body.reset_token);

    if (!body.store_id || !body.email || !body.password || !resetToken) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email, reset token and password are required' } }, 400);
    }

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

// GET /storefront/customer/by-email — Sessionless customer lookup scoped to a store
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

// GET /storefront/customer/status — Check whether a customer exists and has a password
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
        .select('password_hash, status')
        .eq('store_id', storeId)
        .eq('email', normalizeEmail(email))
        .single();

    if (!data) {
        return c.json(success({ exists: false, hasPassword: false, status: 'none' }));
    }

    return c.json(success({
        exists: true,
        hasPassword: Boolean(data.password_hash),
        status: data.status || 'active',
    }));
});

// POST /storefront/customer/login — Verify customer password in the worker boundary
router.post('/customer/login', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;

    if (!body.store_id || !body.email || !body.password) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email and password are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('store_customers')
        .select('id, store_id, email, full_name, phone, status, password_hash, login_count, accepts_marketing, updated_at')
        .eq('store_id', body.store_id)
        .eq('email', normalizeEmail(body.email))
        .single<StoreCustomerAuthRow>();

    if (error || !data || !data.password_hash) {
        return c.json(success({ customer: null }));
    }

    if (data.status === 'disabled') {
        return c.json({ success: false, error: { code: 'CUSTOMER_DISABLED', message: 'Account is disabled. Contact the store for assistance.' } }, 403);
    }

    const isValid = await bcrypt.compare(body.password, data.password_hash);
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
        if (isCustomerLegacyAuthEnabled(c.env)) {
            return c.json(responseBody);
        }

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

// POST /storefront/customer/login-success — Record verified customer login metadata
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

// POST /storefront/customer/order-credential — Persist legacy order-tracking credential
router.post('/customer/order-credential', async (c) => {
    const unauthorized = await requireStorefrontInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json() as CustomerLifecycleBody;
    const storeId = await resolveCredentialStoreId(c, body);

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

// POST /storefront/customer/order-credential/login — Verify legacy order-tracking credential
router.post('/customer/order-credential/login', async (c) => {
    const unauthorized = await requireStorefrontInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json() as CustomerLifecycleBody;
    const storeId = await resolveCredentialStoreId(c, body);

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

// POST /storefront/customer/order-credential/login-success — Record legacy order login metadata
router.post('/customer/order-credential/login-success', async (c) => {
    const unauthorized = await requireStorefrontInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json() as CustomerLifecycleBody;
    const storeId = await resolveCredentialStoreId(c, body);

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

// POST /storefront/customer/order-stats — Reconcile customer order counters after checkout
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

// GET /storefront/customer/wishlist — Session-proxied customer wishlist read
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

// GET /storefront/customer/orders — Session-proxied customer order history
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
        .select('id, order_number, status, total, created_at, items')
        .eq('store_id', storeId)
        .eq('customer_email', normalizeEmail(customer.email))
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) return c.json(dbFailureBody(), 500);
    return c.json(success({ orders: data || [] }));
});

// GET /storefront/:subdomain/orders/contact — Public order tracking lookup by contact
router.get('/:subdomain/orders/contact', async (c) => {
    const unauthorized = await requireStorefrontInternal(c);
    if (unauthorized) return unauthorized;

    const contact = c.req.query('contact');
    const store = await loadPublishedStore(c, c.req.param('subdomain'));

    if (!contact || !store) {
        return c.json(success({ orders: [], hasOrders: false, hasPassword: false }));
    }

    const normalizedContact = normalizeContact(contact);
    const db = getSupabaseAdmin(c);
    let query = db
        .from('orders')
        .select('*')
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

    return c.json(success({
        orders: orders || [],
        hasOrders: Boolean(orders?.length),
        hasPassword: Boolean(credential),
        store_id: store.id,
    }));
});

// POST /storefront/customer/wishlist — Session-proxied customer wishlist add
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

// DELETE /storefront/customer/wishlist — Session-proxied customer wishlist remove
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

// POST /storefront/customer/wishlist/sync — Session-proxied local wishlist sync
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

// POST /storefront/customer/activity — Session-proxied customer activity audit
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

// PATCH /storefront/customer/profile — Session-proxied customer profile update
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

// POST /storefront/reviews — Public review submission; defaults to pending moderation
router.post('/reviews', validate('json', CreateStorefrontProductReviewSchema), async (c) => {
    const body = c.get('validatedBody') as StorefrontReviewBody;
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

// GET /storefront/customer/addresses — Session-proxied customer addresses
router.get('/customer/addresses', async (c) => {
    const storeId = c.req.query('store_id');
    const customerId = getCustomerSession(c)?.customerId || c.req.query('customer_id');

    if (!customerId || !storeId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id and store_id are required' } }, 400);
    }

    const customer = await getVerifiedStoreCustomer(c, storeId, customerId);
    if (!customer) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('customer_addresses')
        .select('*')
        .eq('store_id', storeId)
        .eq('customer_email', normalizeEmail(customer.email))
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ addresses: data || [] }));
});

// POST /storefront/customer/addresses — Session-proxied address create
router.post('/customer/addresses', async (c) => {
    const body = await c.req.json() as CustomerAddressBody;

    if (!body.customer_id || !body.store_id || !body.customer_email || !body.full_name || !body.address_line1 || !body.city || !body.state || !body.postal_code) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Required address fields missing' } }, 400);
    }

    const customer = await getVerifiedStoreCustomer(c, body.store_id, body.customer_id);
    if (!customer) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const customerEmail = normalizeEmail(customer.email);
    if (body.is_default) {
        await db
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('store_id', body.store_id)
            .eq('customer_email', customerEmail);
    }

    const { data, error } = await db
        .from('customer_addresses')
        .insert({
            store_id: body.store_id,
            customer_email: customerEmail,
            customer_phone: body.customer_phone || null,
            label: body.label || 'home',
            full_name: body.full_name,
            address_line1: body.address_line1,
            address_line2: body.address_line2 || null,
            city: body.city,
            state: body.state,
            postal_code: body.postal_code,
            country: body.country || 'IN',
            landmark: body.landmark || null,
            is_default: Boolean(body.is_default),
        })
        .select()
        .single();

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ address: data }), 201);
});

// PATCH /storefront/customer/addresses/:id — Session-proxied address update
router.patch('/customer/addresses/:id', async (c) => {
    const addressId = c.req.param('id');
    const body = await c.req.json() as CustomerAddressBody;

    if (!body.customer_id || !body.store_id || !body.customer_email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and customer_email are required' } }, 400);
    }

    const customer = await getVerifiedStoreCustomer(c, body.store_id, body.customer_id);
    if (!customer) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const customerEmail = normalizeEmail(customer.email);
    if (body.is_default) {
        await db
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('store_id', body.store_id)
            .eq('customer_email', customerEmail);
    }

    const allowed = ['label', 'full_name', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'landmark', 'is_default'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        const value = body[key as keyof CustomerAddressBody];
        if (value !== undefined) updates[key] = value;
    }

    const { data, error } = await db
        .from('customer_addresses')
        .update(updates)
        .eq('id', addressId)
        .eq('store_id', body.store_id)
        .eq('customer_email', customerEmail)
        .select()
        .single();

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ address: data }));
});

// DELETE /storefront/customer/addresses/:id — Session-proxied address delete
router.delete('/customer/addresses/:id', async (c) => {
    const addressId = c.req.param('id');
    const body = await c.req.json() as CustomerAddressBody;

    if (!body.customer_id || !body.store_id || !body.customer_email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and customer_email are required' } }, 400);
    }

    const customer = await getVerifiedStoreCustomer(c, body.store_id, body.customer_id);
    if (!customer) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { error } = await db
        .from('customer_addresses')
        .delete()
        .eq('id', addressId)
        .eq('store_id', body.store_id)
        .eq('customer_email', normalizeEmail(customer.email));

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ deleted: true }));
});

// GET /storefront/:subdomain/blog
router.get('/:subdomain/blog', async (c) => {
    const db = getSupabaseAdmin(c);
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    const { data, count } = await db.from('blog_posts').select('id,title,slug,excerpt,featured_image,published_at,created_at,updated_at,is_pinned,seo_title,seo_description,og_image_url', { count: 'exact' })
        .eq('store_id', store.id).eq('status', 'published').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /storefront/:subdomain/blog/:slug
router.get('/:subdomain/blog/:slug', async (c) => {
    const db = getSupabaseAdmin(c);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const slug = normalizePublicRouteToken(c.req.param('slug'));
    if (!slug) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid blog post slug' } }, 400);
    }

    const { data, error } = await db.from('blog_posts')
        .select('id,title,slug,excerpt,content,content_html,featured_image,published_at,updated_at,seo_title,seo_description,og_image_url,canonical_url')
        .eq('store_id', store.id)
        .eq('status', 'published')
        .eq('slug', slug)
        .maybeSingle();

    if (error) return c.json(dbFailureBody(), 500);
    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Blog post not found' } }, 404);

    return c.json(success({
        id: data.id,
        title: data.title,
        slug: data.slug,
        page_type: 'blog_post',
        content: {
            body: data.content || '',
            html: data.content_html || '',
            image: data.featured_image || '',
            excerpt: data.excerpt || '',
        },
        seo: {
            title: data.seo_title || data.title,
            description: data.seo_description || data.excerpt || '',
            ogImage: data.og_image_url || data.featured_image || '',
            canonicalUrl: data.canonical_url || '',
        },
        published_at: data.published_at,
        updated_at: data.updated_at,
    }));
});

// POST /storefront/:subdomain/contact — Public contact form
router.post('/:subdomain/contact', async (c) => {
    const db = getSupabaseAdmin(c);
    const body = await c.req.json();
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    await db.from('form_submissions').insert({ store_id: store.id, type: 'contact', name: body.name || '', email: body.email || '', message: body.message || '' });
    return c.json(success({ submitted: true }), 201);
});

export default router;
