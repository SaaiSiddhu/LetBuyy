import { authorizeFreshStorefrontPurchase, issueHostedStorefrontAdmission, resolveCheckoutRecoverySite } from '../../lib/storefront-visitor-access';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { hmacSha256Hex, sha256Hex } from '../../lib/crypto';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import { normalizeStorefrontHandle, type PublishedStoreRecord } from '@letbuyy/tenant-core';
import { CommerceChannelSchema, DEFAULT_PLATFORM_DOMAIN, type CommerceChannel } from '@letbuyy/shared-types';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { authenticateStorefrontBuyerSession, getStorefrontBuyerSession } from '../../middleware/storefront-buyer-session';
import { acceptCartProductFacts, loadCartFactSources, type CartFactAcceptance } from '../../lib/cart-product-facts';
import { PersonalizationReviewContextSchema, PersonalizationReviewQuerySchema, personalizationReviewFingerprint, readPersonalizationFacts, type PersonalizationCartDraft, type ProductFactSnapshot } from '@letbuyy/commerce-core';
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
    channel: CommerceChannelSchema.unwrap().optional(),
    lines: z.array(StorefrontCartLineInputSchema).max(250).default([]),
    coupon_codes: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
}).strict();

const StorefrontCartBuyerIdentitySchema = z.object({
    customer_id: z.string().uuid().optional().nullable(),
    buyer_email: z.string().trim().email().max(254).optional().nullable(),
    channel: CommerceChannelSchema.unwrap().optional(),
}).strict();

const StorefrontCartDiscountCodesSchema = z.object({
    coupon_codes: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
}).strict();

type StorefrontCartLineInput = z.infer<typeof StorefrontCartLineInputSchema>;
type StorefrontCartMutationInput = z.infer<typeof StorefrontCartMutationSchema>;
type SalesOrigin = 'storefront' | 'marketplace';

type StorefrontServerCartLine = {
    id: string;
    product_id: string;
    variant_id?: string | null;
    marketplace_listing_id?: string | null;
    title: string;
    sku?: string | null;
    image_url?: string | null;
    quantity: number;
    unit_price: number;
    compare_price?: number | null;
    currency: string;
    properties: Record<string, unknown>;
    line_total: number;
    personalization?: PersonalizationCartDraft;
    niche_snapshot?: ProductFactSnapshot;
    product_version?: number;
    configuration_fingerprint?: string | null;
    snapshot_fingerprint?: string;
    catalog_source?: CartFactAcceptance['catalog_source'];
};

type StorefrontServerCart = {
    id: string;
    store_id: string;
    customer_id?: string | null;
    buyer_email?: string | null;
    cart_token: string;
    status: string;
    channel: CommerceChannel;
    sales_origin: SalesOrigin;
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
    'sales_origin',
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
    const productVariant = line.variant_id ? `${line.product_id}:${line.variant_id}` : line.product_id;
    return line.marketplace_listing_id ? `${productVariant}:${line.marketplace_listing_id}` : productVariant;
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
        sales_origin: row.sales_origin === 'marketplace' ? 'marketplace' : 'storefront',
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

/** Provenance is private to server cart acceptance and the locked order writer. */
function publicCart(cart: StorefrontServerCart): StorefrontServerCart {
    return { ...cart, lines: cart.lines.map(({ catalog_source: _source, ...line }) => line) };
}

async function loadCartByToken(c: AppContext, storeId: string, cartToken: string, includeClosed = false): Promise<{ cart: StorefrontServerCart | null; error: unknown }> {
    c.header('Cache-Control', 'no-store');
    const db = getSupabaseAdmin(c);
    let query = db.from('carts').select(CART_SELECT)
        .eq('store_id', storeId).eq('session_id', cartToken).is('deleted_at', null);
    if (!includeClosed) query = query.eq('status', 'active');
    const { data, error } = await query.maybeSingle();

    if (error) return { cart: null, error };
    const cart = data ? cartFromRow(data as unknown as DbRecord) : null;
    // The random token identifies a cart; it cannot retire current storefront
    // policy. Marketplace origin comes from the stored row, never body.channel.
    if (cart && cart.sales_origin === 'storefront') await authorizeFreshStorefrontPurchase(c, storeId);
    return { cart, error: null };
}

async function hydrateCartLines(
    c: AppContext,
    store: PublishedStoreRecord,
    lines: StorefrontCartLineInput[],
    salesOrigin: SalesOrigin,
    queryPublicProducts: StorefrontCartRouteDependencies['queryPublicProducts'],
): Promise<{ lines: StorefrontServerCartLine[]; error?: Response }> {
    // Review each draft against canonical rows BEFORE deriving a merge key.
    const mergedLines = lines;
    if (mergedLines.length === 0) return { lines: [] };

    if (salesOrigin === 'marketplace') {
        if (mergedLines.some((line) => !line.marketplace_listing_id)) {
            return {
                lines: [],
                error: c.json({ success: false, error: { code: 'MARKETPLACE_LISTING_REQUIRED', message: 'Every marketplace cart line must identify its approved listing.' } }, 400),
            };
        }

        const db = getSupabaseAdmin(c);
        const listingLines = [...new Map(mergedLines.map(line => [`${line.product_id}:${line.marketplace_listing_id}`, line])).values()];
        const listingChecks = await Promise.all(listingLines.map(async (line) => {
            const { data, error } = await db.rpc('marketplace_listing_detail', {
                p_listing_id: line.marketplace_listing_id,
            });
            if (error) return { line, failed: true, listing: null as DbRecord | null };
            const listing = Array.isArray(data) ? data[0] : data;
            return {
                line,
                failed: false,
                listing: listing && typeof listing === 'object' ? listing as DbRecord : null,
            };
        }));
        if (listingChecks.some((check) => check.failed)) {
            return { lines: [], error: c.json(dbFailureBody(), 503) };
        }
        const unavailable = listingChecks.some(({ line, listing }) =>
            !listing
            || String(listing.listing_id) !== line.marketplace_listing_id
            || String(listing.product_id) !== line.product_id
            || String(listing.site_id) !== store.id,
        );
        if (unavailable) {
            return {
                lines: [],
                error: c.json({ success: false, error: { code: 'MARKETPLACE_LISTING_UNAVAILABLE', message: 'One or more marketplace listings are no longer available.' } }, 409),
            };
        }
    } else if (mergedLines.some((line) => line.marketplace_listing_id)) {
        return {
            lines: [],
            error: c.json({ success: false, error: { code: 'SALES_ORIGIN_MISMATCH', message: 'Marketplace listings must use the marketplace cart route.' } }, 400),
        };
    }

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

    const variantsFor = (product: DbRecord) => Array.isArray(product.variants) ? product.variants as DbRecord[] : [];
    if (mergedLines.some(line => line.variant_id && !variantsFor(productsById.get(line.product_id) || {}).some(variant => variant.id === line.variant_id))) {
        return { lines: [], error: c.json({ success: false, error: { code: 'VARIANT_NOT_FOUND', message: 'A selected variant is unavailable for this product.' } }, 400) };
    }

    let sources: Awaited<ReturnType<typeof loadCartFactSources>>;
    try { sources = await loadCartFactSources(c.env, store.id, requestId(c), productIds); }
    catch { return { lines: [], error: c.json(dbFailureBody(), 503) }; }
    const acceptedLines = new Map<string, StorefrontServerCartLine>();
    const stockByKey = new Map<string, number>();
    for (const line of mergedLines) {
            const source = sources.get(line.product_id);
            if (!source) return { lines: [], error: c.json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'A cart product is unavailable.' } }, 409) };
            const accepted = await acceptCartProductFacts(source, line.variant_id || null, line.personalization);
            if (!('prepared' in accepted)) return { lines: [], error: c.json({ success: false, error: accepted.error }, 409) };
            const { prepared } = accepted;
            const key = `${lineId(line)}${prepared.configuration_fingerprint ? `:${prepared.configuration_fingerprint}` : ''}`;
            const quantity = Math.min((acceptedLines.get(key)?.quantity || 0) + line.quantity, 99);
            const product = productsById.get(line.product_id) || {};
            const variant = line.variant_id ? variantsFor(product).find(row => row.id === line.variant_id) : undefined;
            const unitPrice = variant && variant.price != null ? numberValue(variant.price) : numberValue(product.price);
            const title = stringValue(product.name) || 'Product';

            acceptedLines.set(key, {
                id: key,
                product_id: line.product_id,
                variant_id: line.variant_id || null,
                marketplace_listing_id: line.marketplace_listing_id || null,
                title,
                sku: stringValue(product.sku),
                image_url: imageUrl(product),
                quantity,
                unit_price: unitPrice,
                compare_price: numberValue(product.compare_at_price) || null,
                currency: currencyValue(product),
                properties: line.properties,
                line_total: unitPrice * quantity,
                ...(line.personalization ? { personalization: line.personalization } : {}),
                niche_snapshot: prepared.snapshot,
                product_version: prepared.product_version,
                configuration_fingerprint: prepared.configuration_fingerprint,
                snapshot_fingerprint: prepared.snapshot_fingerprint,
                catalog_source: accepted.catalog_source,
            });
            stockByKey.set(`${line.product_id}:${line.variant_id || ''}`, accepted.available);
    }
    const quantities = new Map<string, number>();
    for (const line of acceptedLines.values()) {
        const key = `${line.product_id}:${line.variant_id || ''}`;
        quantities.set(key, (quantities.get(key) || 0) + line.quantity);
    }
    if ([...quantities].some(([key, quantity]) => quantity > Math.min(99, stockByKey.get(key) || 0))) {
        return { lines: [], error: c.json({ success: false, error: { code: 'INSUFFICIENT_INVENTORY', message: 'The combined quantity for a selected product exceeds current availability.' } }, 409) };
    }
    return { lines: [...acceptedLines.values()] };
}

function requestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function cartLinesToInput(lines: StorefrontServerCartLine[]): StorefrontCartLineInput[] {
    return lines.map((line) => ({
        product_id: line.product_id,
        variant_id: line.variant_id || null,
        marketplace_listing_id: line.marketplace_listing_id || null,
        quantity: line.quantity,
        properties: line.properties || {},
        ...(line.personalization ? { personalization: line.personalization } : {}),
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

async function createCheckoutHandoff(
    c: AppContext,
    store: PublishedStoreRecord,
    cart: StorefrontServerCart,
    bindBuyer: boolean,
): Promise<Response> {
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
        salesOrigin: cart.sales_origin,
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

    if (bindBuyer) {
        const buyer = getStorefrontBuyerSession(c);
        if (!buyer || buyer.siteId !== store.id) {
            return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);
        }
        const { error } = await getSupabaseAdmin(c).rpc('bind_hosted_checkout_buyer', {
            p_site_id: store.id,
            p_cart_id: cart.id,
            p_cart_token: cart.cart_token,
            p_channel: cart.channel,
            p_buyer_account_id: buyer.buyerAccountId,
            p_buyer_session_epoch: buyer.sessionEpoch,
        });
        if (error) {
            if (error.message?.includes('buyer session is no longer active')) {
                return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);
            }
            if (error.message?.includes('already bound') || error.message?.includes('no longer available') || error.message?.includes('conflicts')) {
                return c.json({ success: false, error: { code: 'CHECKOUT_IDENTITY_CONFLICT', message: 'This checkout cannot be linked to the current account.' } }, 409);
            }
            return c.json({ success: false, error: { code: 'CHECKOUT_UNAVAILABLE', message: 'Secure checkout is temporarily unavailable.' } }, 503);
        }
    }

    const accessAdmission = cart.sales_origin === 'storefront'
        ? await issueHostedStorefrontAdmission(c, store.id, signature, Math.floor(Date.parse(expiresAt) / 1000))
        : null;
    const db = getSupabaseAdmin(c);
    const { data: persistedHandoff, error } = await db
        .from('carts')
        .update({
            checkout_handoff: {
                storefront_admission: accessAdmission,
                checkout_url: checkoutUrl.toString(),
                expires_at: expiresAt,
                signed_at: new Date().toISOString(),
                channel: cart.channel,
                cart_content_digest: cartContentDigest,
            },
        })
        .eq('store_id', store.id)
        .eq('id', cart.id)
        .select('id')
        .maybeSingle();
    if (error || !persistedHandoff) return c.json({ success: false, error: { code: 'CHECKOUT_UNAVAILABLE', message: 'Secure checkout is temporarily unavailable.' } }, 503);

    return c.json(success({
        checkout_url: checkoutUrl.toString(),
        expires_at: expiresAt,
        cart_digest: cartContentDigest,
        signature,
    }));
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
                event_id: crypto.randomUUID(),
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
                schema_version: 1,
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
    salesOrigin: SalesOrigin,
    queryPublicProducts: StorefrontCartRouteDependencies['queryPublicProducts'],
): Promise<Response> {
    if (salesOrigin === 'storefront') await authorizeFreshStorefrontPurchase(c, store.id);
    const existing = await loadCartByToken(c, store.id, cartToken, true);
    if (existing.error) return c.json(dbFailureBody(), 500);
    if (existing.cart && existing.cart.status !== 'active') {
        return c.json({ success: false, error: { code: 'CART_STATE_CONFLICT', message: 'A completed or closed cart cannot be changed. Start a new cart for another purchase.' } }, 409);
    }
    if (existing.cart && existing.cart.sales_origin !== salesOrigin) {
        return c.json({ success: false, error: { code: 'SALES_ORIGIN_IMMUTABLE', message: 'A cart cannot change its sales origin.' } }, 409);
    }

    const hydrated = await hydrateCartLines(c, store, input.lines, salesOrigin, queryPublicProducts);
    if (hydrated.error) return hydrated.error;

    const payload = {
        store_id: store.id,
        customer_id: input.customer_id || null,
        buyer_email: input.buyer_email || null,
        channel: input.channel,
        sales_origin: salesOrigin,
        session_id: cartToken,
        items: hydrated.lines,
        fact_acceptance_version: 1,
        coupon_code: input.coupon_codes[0] || null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    payload.channel = input.channel || existing.cart?.channel || 'web';

    const db = getSupabaseAdmin(c);
    const result = existing.cart
        ? await db
            .from('carts')
            .update(payload)
            .eq('store_id', store.id)
            .eq('session_id', cartToken)
            .eq('id', existing.cart.id)
            .eq('status', 'active')
            .is('deleted_at', null)
            .select(CART_SELECT)
            .maybeSingle()
        : await db
            .from('carts')
            .insert({ ...payload, status: 'active', session_id: cartToken })
            .select(CART_SELECT)
            .single();

    if (result.error) return c.json(dbFailureBody(), 500);
    if (!result.data) return existing.cart
        ? c.json({ success: false, error: { code: 'CART_STATE_CONFLICT', message: 'Cart changed before it could be updated.' } }, 409)
        : c.json(dbFailureBody(), 500);
    const cart = cartFromRow(result.data as unknown as DbRecord);
    if (!existing.cart) {
        await emitCartEvent(c, cart, 'cart.created', `cart.created:${store.id}:${cart.id}`);
    }
    if (cart.buyer_email) {
        await emitCartEvent(c, cart, 'cart.email_captured', `cart.email_captured:${store.id}:${cart.id}:${cart.buyer_email}`);
        await enqueueAbandonmentCheck(c, cart);
    }
    return c.json(success(publicCart(cart)), existing.cart ? 200 : 201);
}

/** Capability-bound receipt planner, separate from live storefront admission.
 * A store lookup never authorizes a read: the exact site+cart token must select
 * one cart first, then only that cart's session/order can contribute a receipt.
 * No identity/contact/address/payment metadata is projected. */
async function readCheckoutRecoveryReceipt(c:AppContext,subdomain:string,rawToken:string,normalizeToken:(value:string)=>string|null):Promise<Response>{
        const handle = normalizeStorefrontHandle(subdomain);
        if (!handle) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
        // Recovery returns only the already committed cart/order receipt below.
        // Store publication/navigation mode cannot erase that independent capability.
        const store = await resolveCheckoutRecoverySite(c, handle);
        c.header('Cache-Control', 'no-store');
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizeToken(rawToken);
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const db = getSupabaseAdmin(c);
        const { data: carts, error: cartError } = await db
            .from('carts')
            .select('id, store_id, session_id, status, deleted_at')
            .eq('store_id', store.id)
            .eq('session_id', cartToken)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(2);
        if (cartError) return c.json(dbFailureBody(), 500);
        if (!carts || carts.length === 0) {
            return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart not found' } }, 404);
        }
        if (carts.length > 1) {
            return c.json({ success: false, error: { code: 'CART_REFERENCE_AMBIGUOUS', message: 'Checkout status needs support review.' } }, 409);
        }

        const cart = carts[0] as { id: string; status: string };
        const { data: session, error: sessionError } = await db
            .from('checkout_sessions')
            .select('checkout_state, order_id')
            .eq('site_id', store.id)
            .eq('cart_id', cart.id)
            .is('deleted_at', null)
            .maybeSingle();
        if (sessionError) return c.json(dbFailureBody(), 500);

        const state = (session as { checkout_state?: string; order_id?: string | null } | null)?.checkout_state || null;
        const orderId = (session as { order_id?: string | null } | null)?.order_id || null;
        let order: { id: string; order_number: string; total: number; currency: string; status: string } | null = null;
        if (state === 'completed' && orderId) {
            const { data, error } = await db
                .from('orders')
                .select('id, order_number, total, currency, status')
                .eq('store_id', store.id)
                .eq('id', orderId)
                .is('deleted_at', null)
                .maybeSingle();
            if (error) return c.json(dbFailureBody(), 500);
            order = data as typeof order;
        }

        return c.json(success({
            cart_status: cart.status,
            checkout_state: state,
            ...(order ? { order } : {}),
        }));
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

    router.get('/:subdomain/products/:productId/personalization-review', async (c) => {
        c.header('Cache-Control', 'no-store');
        const identity = z.string().uuid().safeParse(c.req.param('productId'));
        const query = PersonalizationReviewQuerySchema.safeParse(c.req.query());
        if (!identity.success || !query.success || (c.req.queries('variant_id')?.length || 0) > 1) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Supply a product UUID and a single canonical variant UUID when required.' } }, 400);
        }
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
        await authorizeFreshStorefrontPurchase(c, store.id);
        const productId = identity.data.toLowerCase();
        const visible = await queryPublicProducts(c, store.id, { limit: 1, paginated: false, ids: [productId] });
        if (visible.error) return c.json(dbFailureBody(), 503);
        if (!visible.data.some(product => product.id === productId)) return c.json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product is unavailable.' } }, 404);
        let sources: Awaited<ReturnType<typeof loadCartFactSources>>;
        try { sources = await loadCartFactSources(c.env, store.id, requestId(c), [productId]); }
        catch { return c.json(dbFailureBody(), 503); }
        const source = sources.get(productId);
        if (!source) return c.json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product is unavailable.' } }, 404);
        const variants = Array.isArray(source.variants) ? source.variants as DbRecord[] : [];
        const variantId = query.data.variant_id ?? null;
        if (variants.length && !variantId) return c.json({ success: false, error: { code: 'VARIANT_REQUIRED', message: 'Select a current variant before reviewing.' } }, 409);
        if (variantId && !variants.some(variant => variant.id === variantId)) return c.json({ success: false, error: { code: 'VARIANT_NOT_FOUND', message: 'The selected variant is unavailable for this product.' } }, 404);
        const inventory = Array.isArray(source.inventory) ? source.inventory as DbRecord[] : [];
        if (numberValue(inventory.find(level => (level.variant_id ?? null) === variantId)?.available) < 1) return c.json({ success: false, error: { code: 'VARIANT_UNAVAILABLE', message: 'The selected product is currently unavailable.' } }, 409);
        const metadata = source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata) ? source.metadata as DbRecord : {};
        const facts = readPersonalizationFacts(metadata);
        if (!facts) return c.json({ success: false, error: { code: 'PERSONALIZATION_UNAVAILABLE', message: 'Personalization is currently unavailable for this product.' } }, 409);
        const fingerprint = await personalizationReviewFingerprint({ product_id: productId, variant_id: variantId, product_version: source.version, facts });
        const context = PersonalizationReviewContextSchema.safeParse({ product_id: productId, variant_id: variantId, facts, facts_revision: facts.revision, review_fingerprint: fingerprint });
        if (!context.success) return c.json(dbFailureBody(), 503);
        return c.json(success(context.data));
    });

    router.post('/:subdomain/cart', validate('json', StorefrontCartMutationSchema), async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const body = c.get('validatedBody') as StorefrontCartMutationInput;
        const requestedToken = body.cart_token ? normalizePublicRouteToken(body.cart_token) : null;
        if (body.cart_token && !requestedToken) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);
        }

        const cartToken = requestedToken || createCartToken();
        return persistCart(c, store, cartToken, body, 'storefront', queryPublicProducts);
    });

    const MarketplaceCartMutationSchema = StorefrontCartMutationSchema.extend({
        lines: z.array(StorefrontCartLineInputSchema.extend({
            marketplace_listing_id: z.string().uuid(),
        })).max(250).default([]),
    }).strict();

    router.post('/:subdomain/marketplace-cart', validate('json', MarketplaceCartMutationSchema), async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const body = c.get('validatedBody') as StorefrontCartMutationInput;
        const requestedToken = body.cart_token ? normalizePublicRouteToken(body.cart_token) : null;
        if (body.cart_token && !requestedToken) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);
        }

        const cartToken = requestedToken || createCartToken();
        return persistCart(c, store, cartToken, body, 'marketplace', queryPublicProducts);
    });

    router.get('/:subdomain/cart/:cartToken', async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const { cart, error } = await loadCartByToken(c, store.id, cartToken);
        if (error) return c.json(dbFailureBody(), 500);
        if (!cart) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart not found' } }, 404);
        return c.json(success(publicCart(cart)));
    });

    router.patch('/:subdomain/cart/:cartToken', validate('json', StorefrontCartMutationSchema), async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const body = c.get('validatedBody') as StorefrontCartMutationInput;
        return persistCart(c, store, cartToken, body, 'storefront', queryPublicProducts);
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
        }, existing.cart.sales_origin, queryPublicProducts);
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
        }, existing.cart.sales_origin, queryPublicProducts);
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

        return createCheckoutHandoff(c, store, cart, false);
    });

    router.post('/:subdomain/cart/:cartToken/checkout-url', async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const { cart, error } = await loadCartByToken(c, store.id, cartToken);
        if (error) return c.json(dbFailureBody(), 500);
        if (!cart) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart not found' } }, 404);
        if (cart.lines.length === 0) return c.json({ success: false, error: { code: 'EMPTY_CART', message: 'Cart has no checkout lines' } }, 409);

        const token = c.req.header(LETBUYY_STOREFRONT_SESSION_HEADER);
        if (token) {
            const rejected = await authenticateStorefrontBuyerSession(c, token, store.id);
            if (rejected) return rejected;
        }
        return createCheckoutHandoff(c, store, cart, Boolean(token));
    });

    // A random cart token is the buyer's recovery capability. Return only the minimal completion
    // receipt; never expose contact/address/session data through this unauthenticated recovery read.
    // The marketplace mobile app uses it after resume to distinguish an unsubmitted cart from an
    // order that committed just before the app was closed or lost its response.
    router.get('/:subdomain/cart/:cartToken/checkout-status', async (c) => {
        return readCheckoutRecoveryReceipt(c, c.req.param('subdomain'), c.req.param('cartToken'), normalizePublicRouteToken);
    });

    router.delete('/:subdomain/cart/:cartToken', async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const existing = await loadCartByToken(c, store.id, cartToken, true);
        if (existing.error) return c.json(dbFailureBody(), 503);
        if (!existing.cart) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart not found' } }, 404);
        if (existing.cart.status !== 'active') return c.json({ success: false, error: { code: 'CART_STATE_CONFLICT', message: 'A completed or closed cart cannot be cleared.' } }, 409);
        // A conversion can commit after the read. Only an active matching row
        // may be cleared; never write status=active or acknowledge a lost race.
        const { data, error } = await getSupabaseAdmin(c).from('carts')
            .update({ items: [], coupon_code: null })
            .eq('store_id', store.id).eq('id', existing.cart.id)
            .eq('session_id', cartToken).eq('status', 'active').is('deleted_at', null)
            .select(CART_SELECT).maybeSingle();
        if (error) return c.json(dbFailureBody(), 503);
        if (!data) return c.json({ success: false, error: { code: 'CART_STATE_CONFLICT', message: 'Cart changed before it could be cleared.' } }, 409);
        return c.json(success(publicCart(cartFromRow(data as unknown as DbRecord))));
    });
}
