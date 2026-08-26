import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { hmacSha256Hex, sha256Hex } from '../../lib/crypto';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';
import { CommerceChannelSchema, DEFAULT_PLATFORM_DOMAIN, type CommerceChannel } from '@letbuyy/shared-types';
import {
    canonicalCheckoutCartBinding,
    canonicalCheckoutHandoffPayload,
    StorefrontCartLineInputSchema,
} from '@letbuyy/checkout-core';

type AppContext = Context<{ Bindings: Env }>;
type DbRecord = Record<string, unknown>;
type PublicProductQueryResult = {
    data: DbRecord[];
    count: number;
    error: unknown;
};

type StorefrontCartRouteDependencies = {
    loadPublishedStore: (c: AppContext, subdomain: string) => Promise<PublishedStoreRecord | null>;
    queryPublicProducts: (
        c: AppContext,
        storeId: string,
        options: { limit: number; paginated?: boolean; ids?: string[] },
    ) => Promise<PublicProductQueryResult>;
    normalizePublicRouteToken: (value: string) => string | null;
};

// T10/W3 — StorefrontCartLineInputSchema now lives in @letbuyy/checkout-core, the single source
// of truth for this wire shape (previously a local duplicate here, which the storefront client
// diverged from — see cart-context.tsx's matching comment for the full incident).
const StorefrontCartMutationSchema = z.object({
    cart_token: z.string().trim().min(1).max(120).optional().nullable(),
    customer_id: z.string().uuid().optional().nullable(),
    buyer_email: z.string().trim().email().max(254).optional().nullable(),
    channel: CommerceChannelSchema.optional().default('web'),
    lines: z.array(StorefrontCartLineInputSchema).max(250).default([]),
    coupon_codes: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
}).strict();

const StorefrontCartBuyerIdentitySchema = z.object({
    customer_id: z.string().uuid().optional().nullable(),
    buyer_email: z.string().trim().email().max(254).optional().nullable(),
    channel: CommerceChannelSchema.optional().default('web'),
}).strict();

const StorefrontCartDiscountCodesSchema = z.object({
    coupon_codes: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
}).strict();

type StorefrontCartLineInput = z.infer<typeof StorefrontCartLineInputSchema>;
type StorefrontCartMutationInput = z.infer<typeof StorefrontCartMutationSchema>;

type StorefrontServerCartLine = {
    id: string;
    product_id: string;
    variant_id?: string | null;
    title: string;
    sku?: string | null;
    image_url?: string | null;
    quantity: number;
    unit_price: number;
    compare_price?: number | null;
    currency: string;
    properties: Record<string, unknown>;
    line_total: number;
};

type StorefrontServerCart = {
    id: string;
    store_id: string;
    customer_id?: string | null;
    buyer_email?: string | null;
    cart_token: string;
    status: string;
    channel: CommerceChannel;
    currency: string;
    lines: StorefrontServerCartLine[];
    subtotal: number;
    discount_total: number;
    shipping_total: number;
    tax_total: number;
    total: number;
    coupon_codes: string[];
    checkout_handoff?: Record<string, unknown>;
    abandonment_enqueued_at?: string | null;
    expires_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

const CART_SELECT = [
    'id',
    'store_id',
    'customer_id',
    'buyer_email',
    'session_id',
    'items',
    'coupon_code',
    'status',
    'channel',
    'checkout_handoff',
    'abandonment_enqueued_at',
    'expires_at',
    'created_at',
    'updated_at',
].join(', ');

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}

function imageUrl(product: DbRecord): string | null {
    const featured = stringValue(product.featured_image);
    if (featured) return featured;

    const images = Array.isArray(product.images) ? product.images : [];
    return stringValue(images[0]);
}

function currencyValue(product: DbRecord): string {
    const currency = stringValue(product.currency);
    return currency && /^[A-Z]{3}$/.test(currency) ? currency : 'INR';
}

function lineId(line: StorefrontCartLineInput): string {
    return line.variant_id ? `${line.product_id}:${line.variant_id}` : line.product_id;
}

function createCartToken(): string {
    return `ct_${crypto.randomUUID().replace(/-/g, '')}`;
}

function normalizeCartItems(value: unknown): StorefrontServerCartLine[] {
    return Array.isArray(value)
        ? value
            .filter((item): item is StorefrontServerCartLine => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
            .map((item) => ({
                ...item,
                quantity: Math.max(1, Math.min(Number(item.quantity || 1), 99)),
                unit_price: numberValue(item.unit_price),
                line_total: numberValue(item.line_total),
                properties: item.properties && typeof item.properties === 'object' && !Array.isArray(item.properties)
                    ? item.properties as Record<string, unknown>
                    : {},
            }))
        : [];
}

function cartFromRow(row: DbRecord): StorefrontServerCart {
    const lines = normalizeCartItems(row.items);
    const subtotal = lines.reduce((total, line) => total + line.line_total, 0);
    const currency = lines[0]?.currency || 'INR';
    const couponCode = stringValue(row.coupon_code);
    const parsedChannel = CommerceChannelSchema.safeParse(row.channel);

    return {
        id: String(row.id),
        store_id: String(row.store_id),
        customer_id: stringValue(row.customer_id),
        buyer_email: stringValue(row.buyer_email),
        cart_token: String(row.session_id),
        status: stringValue(row.status) || 'active',
        channel: parsedChannel.success ? parsedChannel.data : 'web',
        currency,
        lines,
        subtotal,
        discount_total: 0,
        shipping_total: 0,
        tax_total: 0,
        total: subtotal,
        coupon_codes: couponCode ? [couponCode] : [],
        checkout_handoff: row.checkout_handoff && typeof row.checkout_handoff === 'object' && !Array.isArray(row.checkout_handoff)
            ? row.checkout_handoff as Record<string, unknown>
            : {},
        abandonment_enqueued_at: stringValue(row.abandonment_enqueued_at),
        expires_at: stringValue(row.expires_at),
        created_at: stringValue(row.created_at),
        updated_at: stringValue(row.updated_at),
    };
}

async function loadCartByToken(c: AppContext, storeId: string, cartToken: string): Promise<{ cart: StorefrontServerCart | null; error: unknown }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('carts')
        .select(CART_SELECT)
        .eq('store_id', storeId)
        .eq('session_id', cartToken)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();

    if (error) return { cart: null, error };
    return { cart: data ? cartFromRow(data as unknown as DbRecord) : null, error: null };
}

async function hydrateCartLines(
    c: AppContext,
    store: PublishedStoreRecord,
    lines: StorefrontCartLineInput[],
    queryPublicProducts: StorefrontCartRouteDependencies['queryPublicProducts'],
): Promise<{ lines: StorefrontServerCartLine[]; error?: Response }> {
    const quantities = new Map<string, StorefrontCartLineInput>();
    for (const line of lines) {
        const id = lineId(line);
        const existing = quantities.get(id);
        quantities.set(id, {
            ...line,
            quantity: Math.min((existing?.quantity || 0) + line.quantity, 99),
        });
    }

    const mergedLines = Array.from(quantities.values());
    if (mergedLines.length === 0) return { lines: [] };

    const productIds = Array.from(new Set(mergedLines.map((line) => line.product_id)));
    const products = await queryPublicProducts(c, store.id, {
        limit: productIds.length,
        paginated: false,
        ids: productIds,
    });

    if (products.error) return { lines: [], error: c.json(dbFailureBody(), 500) };

    const productsById = new Map(products.data.map((product) => [String(product.id), product]));
    const missing = productIds.filter((productId) => !productsById.has(productId));
    if (missing.length > 0) {
        return {
            lines: [],
            error: c.json({
                success: false,
                error: {
                    code: 'PRODUCT_NOT_FOUND',
                    message: 'One or more cart products are unavailable.',
                    product_ids: missing,
                },
            }, 404),
        };
    }

    return {
        lines: mergedLines.map((line) => {
            const product = productsById.get(line.product_id) || {};
            const unitPrice = numberValue(product.price);
            const title = stringValue(product.name) || 'Product';

            return {
                id: lineId(line),
                product_id: line.product_id,
                variant_id: line.variant_id || null,
                title,
                sku: stringValue(product.sku),
                image_url: imageUrl(product),
                quantity: line.quantity,
                unit_price: unitPrice,
                compare_price: numberValue(product.compare_at_price) || null,
                currency: currencyValue(product),
                properties: line.properties,
                line_total: unitPrice * line.quantity,
            };
        }),
    };
}

function requestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function cartLinesToInput(lines: StorefrontServerCartLine[]): StorefrontCartLineInput[] {
    return lines.map((line) => ({
        product_id: line.product_id,
        variant_id: line.variant_id || null,
        quantity: line.quantity,
        properties: line.properties || {},
    }));
}

function checkoutOrigin(c: AppContext): string {
    const explicit = c.env.CHECKOUT_ORIGIN || c.env.NEXT_PUBLIC_STOREFRONT_URL || c.env.STOREFRONT_BASE_URL;
    if (explicit) return explicit.trim().replace(/\/+$/, '');

    const rawDomain = c.env.LETBUYY_PLATFORM_DOMAIN
        || c.env.NEXT_PUBLIC_PLATFORM_DOMAIN
        || c.env.PLATFORM_ROOT_DOMAIN
        || DEFAULT_PLATFORM_DOMAIN;
    const domain = rawDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\.+|\.+$/g, '');
    return `https://checkout.${domain || DEFAULT_PLATFORM_DOMAIN}`;
}

function checkoutSigningSecret(c: AppContext): string | null {
    const configured = c.env.CHECKOUT_SIGNING_SECRET || c.env.STORE_ACCESS_SIGNING_KEY;
    if (configured && !configured.startsWith('SKIP_NEEDS_HUMAN_')) return configured;
    if (c.env.ENVIRONMENT === 'production' || c.env.APP_ENV === 'production') return null;
    return 'letbuyy-local-sandbox-checkout-handoff-secret';
}

async function emitCartEvent(
    c: AppContext,
    cart: StorefrontServerCart,
    eventType: 'cart.created' | 'cart.email_captured' | 'cart.abandoned',
    idempotencyKey: string,
    metadata: Record<string, unknown> = {},
): Promise<void> {
    await new EventExecutionAdapter(getSupabaseAdmin(c)).emitDomainEvent({
        storeId: cart.store_id,
        aggregateType: 'cart',
        aggregateId: cart.id,
        eventType,
        payload: {
            site_id: cart.store_id,
            cart_id: cart.id,
            channel: cart.channel,
            buyer_email: cart.buyer_email || undefined,
            cart_token: cart.cart_token,
            line_count: cart.lines.length,
            subtotal_minor: Math.round(cart.subtotal * 100),
            ...metadata,
        },
        idempotencyKey,
        requestId: requestId(c),
    });
}

async function enqueueAbandonmentCheck(c: AppContext, cart: StorefrontServerCart): Promise<void> {
    if (!cart.buyer_email || cart.lines.length === 0) return;

    const availableAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const db = getSupabaseAdmin(c);
    const { error } = await db
        .from('platform_queue_jobs')
        .upsert(
            {
                site_id: cart.store_id,
                queue_name: 'analytics-events',
                job_type: 'cart.abandonment_check',
                payload: {
                    site_id: cart.store_id,
                    cart_id: cart.id,
                    cart_token: cart.cart_token,
                    channel: cart.channel,
                    buyer_email: cart.buyer_email,
                },
                idempotency_key: `cart.abandonment_check:${cart.store_id}:${cart.id}`,
                request_id: requestId(c),
                available_at: availableAt,
            },
            { onConflict: 'queue_name,idempotency_key' },
        )
        .select('id')
        .single();

    if (error && !String(error.message || '').includes('schema cache')) {
        throw new Error(`Cart abandonment enqueue failed: ${error.message}`);
    }

    await db
        .from('carts')
        .update({ abandonment_enqueued_at: new Date().toISOString() })
        .eq('store_id', cart.store_id)
        .eq('id', cart.id);

    await emitCartEvent(c, cart, 'cart.abandoned', `cart.abandoned:${cart.store_id}:${cart.id}`, {
        scheduled_check_at: availableAt,
        reason: 'abandonment_check_enqueued',
    });
}

async function persistCart(
    c: AppContext,
    store: PublishedStoreRecord,
    cartToken: string,
    input: StorefrontCartMutationInput,
    queryPublicProducts: StorefrontCartRouteDependencies['queryPublicProducts'],
): Promise<Response> {
    const hydrated = await hydrateCartLines(c, store, input.lines, queryPublicProducts);
    if (hydrated.error) return hydrated.error;

    const payload = {
        store_id: store.id,
        customer_id: input.customer_id || null,
        buyer_email: input.buyer_email || null,
        channel: input.channel || 'web',
        session_id: cartToken,
        items: hydrated.lines,
        coupon_code: input.coupon_codes[0] || null,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const existing = await loadCartByToken(c, store.id, cartToken);
    if (existing.error) return c.json(dbFailureBody(), 500);

    const db = getSupabaseAdmin(c);
    const result = existing.cart
        ? await db
            .from('carts')
            .update(payload)
            .eq('store_id', store.id)
            .eq('session_id', cartToken)
            .select(CART_SELECT)
            .single()
        : await db
            .from('carts')
            .insert({ ...payload, session_id: cartToken })
            .select(CART_SELECT)
            .single();

    if (result.error || !result.data) return c.json(dbFailureBody(), 500);
    const cart = cartFromRow(result.data as unknown as DbRecord);
    if (!existing.cart) {
        await emitCartEvent(c, cart, 'cart.created', `cart.created:${store.id}:${cart.id}`);
    }
    if (cart.buyer_email) {
        await emitCartEvent(c, cart, 'cart.email_captured', `cart.email_captured:${store.id}:${cart.id}:${cart.buyer_email}`);
        await enqueueAbandonmentCheck(c, cart);
    }
    return c.json(success(cart), existing.cart ? 200 : 201);
}

export function registerStorefrontCartRoutes(
    router: Hono<{ Bindings: Env }>,
    dependencies: StorefrontCartRouteDependencies,
): void {
    const {
        loadPublishedStore,
        queryPublicProducts,
        normalizePublicRouteToken,
    } = dependencies;

    router.post('/:subdomain/cart', validate('json', StorefrontCartMutationSchema), async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const body = c.get('validatedBody') as StorefrontCartMutationInput;
        const requestedToken = body.cart_token ? normalizePublicRouteToken(body.cart_token) : null;
        if (body.cart_token && !requestedToken) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);
        }

        const cartToken = requestedToken || createCartToken();
        return persistCart(c, store, cartToken, body, queryPublicProducts);
    });

    router.get('/:subdomain/cart/:cartToken', async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const { cart, error } = await loadCartByToken(c, store.id, cartToken);
        if (error) return c.json(dbFailureBody(), 500);
        if (!cart) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart not found' } }, 404);
        return c.json(success(cart));
    });

    router.patch('/:subdomain/cart/:cartToken', validate('json', StorefrontCartMutationSchema), async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const body = c.get('validatedBody') as StorefrontCartMutationInput;
        return persistCart(c, store, cartToken, body, queryPublicProducts);
    });

    router.put('/:subdomain/cart/:cartToken/buyer-identity', validate('json', StorefrontCartBuyerIdentitySchema), async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const existing = await loadCartByToken(c, store.id, cartToken);
        if (existing.error) return c.json(dbFailureBody(), 500);
        if (!existing.cart) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart not found' } }, 404);

        const body = c.get('validatedBody') as z.infer<typeof StorefrontCartBuyerIdentitySchema>;
        return persistCart(c, store, cartToken, {
            cart_token: cartToken,
            customer_id: body.customer_id || existing.cart.customer_id || null,
            buyer_email: body.buyer_email || existing.cart.buyer_email || null,
            channel: body.channel || existing.cart.channel,
            lines: cartLinesToInput(existing.cart.lines),
            coupon_codes: existing.cart.coupon_codes,
        }, queryPublicProducts);
    });

    router.post('/:subdomain/cart/:cartToken/discount-codes', validate('json', StorefrontCartDiscountCodesSchema), async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const existing = await loadCartByToken(c, store.id, cartToken);
        if (existing.error) return c.json(dbFailureBody(), 500);
        if (!existing.cart) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart not found' } }, 404);

        const body = c.get('validatedBody') as z.infer<typeof StorefrontCartDiscountCodesSchema>;
        return persistCart(c, store, cartToken, {
            cart_token: cartToken,
            customer_id: existing.cart.customer_id || null,
            buyer_email: existing.cart.buyer_email || null,
            channel: existing.cart.channel,
            lines: cartLinesToInput(existing.cart.lines),
            coupon_codes: body.coupon_codes,
        }, queryPublicProducts);
    });

    router.get('/:subdomain/cart/:cartToken/checkout-url', async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const { cart, error } = await loadCartByToken(c, store.id, cartToken);
        if (error) return c.json(dbFailureBody(), 500);
        if (!cart) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart not found' } }, 404);
        if (cart.lines.length === 0) return c.json({ success: false, error: { code: 'EMPTY_CART', message: 'Cart has no checkout lines' } }, 409);

        const secret = checkoutSigningSecret(c);
        if (!secret) {
            // [HUMAN-REQUIRED] Production checkout URL signing secret must be installed before live checkout handoff.
            return c.json({ success: false, error: { code: 'CHECKOUT_SIGNING_UNAVAILABLE', message: 'Checkout handoff is unavailable.' } }, 503);
        }

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const cartContentDigest = await sha256Hex(canonicalCheckoutCartBinding({
            siteId: store.id,
            cartId: cart.id,
            cartToken: cart.cart_token,
            channel: cart.channel,
            expiresAt,
            couponCodes: cart.coupon_codes,
            lines: cart.lines,
        }));
        const signaturePayload = canonicalCheckoutHandoffPayload({
            siteId: store.id,
            cartId: cart.id,
            cartToken: cart.cart_token,
            channel: cart.channel,
            expiresAt,
            cartContentDigest,
            couponCodes: cart.coupon_codes,
            lines: cart.lines,
        });
        const signature = await hmacSha256Hex(secret, signaturePayload);
        const checkoutUrl = new URL('/checkout', checkoutOrigin(c));
        checkoutUrl.searchParams.set('site_id', store.id);
        checkoutUrl.searchParams.set('cart_id', cart.id);
        checkoutUrl.searchParams.set('cart_token', cart.cart_token);
        checkoutUrl.searchParams.set('channel', cart.channel);
        checkoutUrl.searchParams.set('expires_at', expiresAt);
        checkoutUrl.searchParams.set('cart_digest', cartContentDigest);
        checkoutUrl.searchParams.set('signature', signature);

        const db = getSupabaseAdmin(c);
        await db
            .from('carts')
            .update({
                checkout_handoff: {
                    checkout_url: checkoutUrl.toString(),
                    expires_at: expiresAt,
                    signed_at: new Date().toISOString(),
                    channel: cart.channel,
                    cart_content_digest: cartContentDigest,
                },
            })
            .eq('store_id', store.id)
            .eq('id', cart.id);

        return c.json(success({
            checkout_url: checkoutUrl.toString(),
            expires_at: expiresAt,
            cart_digest: cartContentDigest,
            signature,
        }));
    });

    router.delete('/:subdomain/cart/:cartToken', async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('carts')
            .update({
                items: [],
                coupon_code: null,
                status: 'active',
            })
            .eq('store_id', store.id)
            .eq('session_id', cartToken)
            .select(CART_SELECT)
            .single();

        if (error || !data) return c.json(dbFailureBody(), 500);
        return c.json(success(cartFromRow(data as unknown as DbRecord)));
    });
}
