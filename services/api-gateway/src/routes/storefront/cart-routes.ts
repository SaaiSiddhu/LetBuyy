import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';

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

const StorefrontCartLineInputSchema = z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional().nullable(),
    quantity: z.number().int().min(1).max(99),
    properties: z.record(z.string(), z.unknown()).default({}),
}).strict();

const StorefrontCartMutationSchema = z.object({
    cart_token: z.string().trim().min(1).max(120).optional().nullable(),
    customer_id: z.string().uuid().optional().nullable(),
    lines: z.array(StorefrontCartLineInputSchema).max(250).default([]),
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
    cart_token: string;
    status: string;
    currency: string;
    lines: StorefrontServerCartLine[];
    subtotal: number;
    discount_total: number;
    shipping_total: number;
    tax_total: number;
    total: number;
    coupon_codes: string[];
    expires_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

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

    return {
        id: String(row.id),
        store_id: String(row.store_id),
        customer_id: stringValue(row.customer_id),
        cart_token: String(row.session_id),
        status: stringValue(row.status) || 'active',
        currency,
        lines,
        subtotal,
        discount_total: 0,
        shipping_total: 0,
        tax_total: 0,
        total: subtotal,
        coupon_codes: couponCode ? [couponCode] : [],
        expires_at: stringValue(row.expires_at),
        created_at: stringValue(row.created_at),
        updated_at: stringValue(row.updated_at),
    };
}

async function loadCartByToken(c: AppContext, storeId: string, cartToken: string): Promise<{ cart: StorefrontServerCart | null; error: unknown }> {
    const { data, error } = await getSupabaseAdmin(c)
        .from('carts')
        .select('id, store_id, customer_id, session_id, items, coupon_code, status, expires_at, created_at, updated_at')
        .eq('store_id', storeId)
        .eq('session_id', cartToken)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();

    if (error) return { cart: null, error };
    return { cart: data ? cartFromRow(data as DbRecord) : null, error: null };
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
            .select('id, store_id, customer_id, session_id, items, coupon_code, status, expires_at, created_at, updated_at')
            .single()
        : await db
            .from('carts')
            .insert({ ...payload, session_id: cartToken })
            .select('id, store_id, customer_id, session_id, items, coupon_code, status, expires_at, created_at, updated_at')
            .single();

    if (result.error || !result.data) return c.json(dbFailureBody(), 500);
    return c.json(success(cartFromRow(result.data as DbRecord)), existing.cart ? 200 : 201);
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

    router.delete('/:subdomain/cart/:cartToken', async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const cartToken = normalizePublicRouteToken(c.req.param('cartToken'));
        if (!cartToken) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid cart token' } }, 400);

        const { data, error } = await getSupabaseAdmin(c)
            .from('carts')
            .update({
                items: [],
                coupon_code: null,
                status: 'active',
            })
            .eq('store_id', store.id)
            .eq('session_id', cartToken)
            .select('id, store_id, customer_id, session_id, items, coupon_code, status, expires_at, created_at, updated_at')
            .single();

        if (error || !data) return c.json(dbFailureBody(), 500);
        return c.json(success(cartFromRow(data as DbRecord)));
    });
}
