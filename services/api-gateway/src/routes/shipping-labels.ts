import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { ShippingCapabilitiesSchema } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOrder, resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';
import { bytesToBase64, createSimplePdfBytes } from '../lib/simple-pdf';
import {
    createLogisticsProvider,
    isLogisticsLiveProviderUnavailableError,
    type LogisticsAddress,
    type LogisticsMode,
    type LogisticsProviderName,
    type LogisticsProviderOptions,
    type LogisticsParcel,
    type ShippingLabelResult,
} from '@letbuyy/infrastructure/logistics-adapter';

const router = new Hono<{ Bindings: Env }>();
type ShippingLabelContext = Context<{ Bindings: Env }>;

const LogisticsProviderSchema = z.enum(['shiprocket', 'delhivery', 'pickrr']);
const PackageSchema = z.object({
    weight_grams: z.coerce.number().int().min(1).max(50000).default(500),
    length_cm: z.coerce.number().min(1).max(300).optional(),
    width_cm: z.coerce.number().min(1).max(300).optional(),
    height_cm: z.coerce.number().min(1).max(300).optional(),
});

const RateShippingLabelSchema = z.object({
    order_id: z.string().uuid(),
    provider: LogisticsProviderSchema.default('shiprocket'),
    package: PackageSchema.default({ weight_grams: 500 }),
});

const BuyShippingLabelSchema = RateShippingLabelSchema.extend({
    idempotency_key: z.string().min(8).max(160),
});

type RateShippingLabelInput = z.infer<typeof RateShippingLabelSchema>;
type BuyShippingLabelInput = z.infer<typeof BuyShippingLabelSchema>;
type ShippingLabelProviderMode = 'sandbox' | 'live';

interface OrderLabelSnapshot {
    id?: string | null;
    order_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    shipping_address?: unknown;
}

interface ShippingLabelRow {
    id: string;
    site_id: string;
    order_id: string;
    provider: string;
    carrier: string;
    provider_shipment_id?: string | null;
    tracking_number?: string | null;
    tracking_url?: string | null;
    label_url?: string | null;
    label_object_key?: string | null;
    status: string;
    test_mode: boolean;
    package?: unknown;
    idempotency_key?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function firstText(record: Record<string, unknown> | null, keys: readonly string[]): string | null {
    if (!record) return null;
    for (const key of keys) {
        const value = textValue(record[key]);
        if (value) return value;
    }
    return null;
}

function parcelFromInput(input: RateShippingLabelInput): LogisticsParcel {
    return {
        weightGrams: input.package.weight_grams,
        lengthCm: input.package.length_cm,
        widthCm: input.package.width_cm,
        heightCm: input.package.height_cm,
    };
}

function packagePayload(input: RateShippingLabelInput) {
    return {
        weight_grams: input.package.weight_grams,
        length_cm: input.package.length_cm ?? null,
        width_cm: input.package.width_cm ?? null,
        height_cm: input.package.height_cm ?? null,
    };
}

function logisticsMode(c: ShippingLabelContext): LogisticsMode {
    return c.env.LOGISTICS_MODE === 'live' ? 'live' : 'sandbox';
}

function liveLogisticsProviderAvailable(): boolean {
    return false;
}

function shouldBlockLiveLogistics(c: ShippingLabelContext): boolean {
    // A sandbox label is a development artifact, never a production waybill.
    return c.env.ENVIRONMENT === 'production' || (logisticsMode(c) === 'live' && !liveLogisticsProviderAvailable());
}

function carrierSetupError(c: ShippingLabelContext) {
    return c.json({
        error: {
            code: 'CARRIER_SETUP_REQUIRED',
            message: 'Carrier provider setup is not enabled for this environment.',
        },
    }, 503);
}

function logisticsOptions(c: ShippingLabelContext, provider: LogisticsProviderName): LogisticsProviderOptions {
    if (logisticsMode(c) === 'sandbox') return { mode: 'sandbox' };
    if (provider === 'shiprocket') return { mode: 'live', credentials: { token: c.env.SHIPROCKET_TOKEN } };
    if (provider === 'delhivery') return { mode: 'live', credentials: { token: c.env.DELHIVERY_TOKEN } };
    return { mode: 'live', credentials: { token: c.env.PICKRR_TOKEN } };
}

function providerModeFromLogisticsContext(c: ShippingLabelContext): ShippingLabelProviderMode {
    return logisticsMode(c) === 'live' && liveLogisticsProviderAvailable() ? 'live' : 'sandbox';
}

function providerModeFromLogisticsMode(mode: LogisticsMode): ShippingLabelProviderMode {
    return mode === 'live' && liveLogisticsProviderAvailable() ? 'live' : 'sandbox';
}

function estimateRate(input: RateShippingLabelInput, mode: LogisticsMode) {
    const providerFactor: Record<LogisticsProviderName, number> = {
        shiprocket: 1,
        delhivery: 1.08,
        pickrr: 0.96,
    };
    const units = Math.max(1, Math.ceil(input.package.weight_grams / 500));
    const amount = Math.round((45 + units * 15) * providerFactor[input.provider]);
    return {
        provider: input.provider,
        currency: 'INR',
        amount,
        service_level: 'standard',
        estimated_delivery_days: input.provider === 'delhivery' ? 4 : 5,
        test_mode: mode !== 'live',
        provider_mode: providerModeFromLogisticsMode(mode),
    };
}

function buildDestination(order: OrderLabelSnapshot): LogisticsAddress {
    const shippingAddress = recordValue(order.shipping_address);
    const line1 = firstText(shippingAddress, ['line1', 'address_line1', 'address']);
    const city = firstText(shippingAddress, ['city']);
    const state = firstText(shippingAddress, ['state']);
    const postalCode = firstText(shippingAddress, ['zip', 'postal_code', 'pincode']);

    if (!line1 || !city || !state || !postalCode) {
        throw new Error('Shipping label creation requires a complete destination address');
    }

    return {
        name: firstText(shippingAddress, ['name', 'full_name']) || textValue(order.customer_name) || 'Customer',
        phone: firstText(shippingAddress, ['phone']) || textValue(order.customer_phone),
        email: firstText(shippingAddress, ['email']) || textValue(order.customer_email),
        line1,
        line2: firstText(shippingAddress, ['line2', 'address_line2']),
        city,
        state,
        postalCode,
        country: firstText(shippingAddress, ['country']) || 'IN',
    };
}

async function loadOwnedOrder(c: ShippingLabelContext, orderId: string) {
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('orders')
        .select('id,order_number,customer_name,customer_phone,customer_email,shipping_address')
        .eq('id', orderId)
        .eq('store_id', tenant.siteId)
        .maybeSingle();

    if (error) throw new Error('Order lookup for shipping label failed');
    if (!data) throw new Error('Order not found');
    return { tenant, order: data as OrderLabelSnapshot };
}

function labelPdf(order: OrderLabelSnapshot, label: ShippingLabelRow, destination: LogisticsAddress): Uint8Array {
    return createSimplePdfBytes(`Shipping label ${label.tracking_number || label.id}`, [
        `Order: ${textValue(order.order_number) || order.id || label.order_id}`,
        `Carrier: ${label.carrier}`,
        `Tracking: ${label.tracking_number || 'Pending'}`,
        '',
        'Ship to:',
        destination.name,
        destination.line1,
        destination.line2 || '',
        `${destination.city}, ${destination.state} ${destination.postalCode}`,
        destination.country,
    ].filter(Boolean));
}

async function storeLabelPdf(c: ShippingLabelContext, labelId: string, bytes: Uint8Array): Promise<{ key: string | null; url: string | null }> {
    if (!c.env.R2_BUCKET) {
        return { key: null, url: null };
    }

    const key = `shipping-labels/${labelId}.pdf`;
    await c.env.R2_BUCKET.put(key, bytes, {
        httpMetadata: {
            contentType: 'application/pdf',
            contentDisposition: `attachment; filename="shipping-label-${labelId}.pdf"`,
        },
    });
    return { key, url: `/v1/shipping/labels/${labelId}/pdf` };
}

function serializeLabel(row: ShippingLabelRow, pdfBase64?: string | null) {
    return {
        id: row.id,
        site_id: row.site_id,
        order_id: row.order_id,
        provider: row.provider,
        carrier: row.carrier,
        provider_shipment_id: row.provider_shipment_id || null,
        tracking_number: row.tracking_number || null,
        tracking_url: row.tracking_url || null,
        label_url: row.label_url || null,
        status: row.status,
        test_mode: row.test_mode,
        provider_mode: row.test_mode ? 'sandbox' : 'live',
        package: row.package || {},
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        content_type: 'application/pdf',
        pdf_base64: pdfBase64 || null,
    };
}

router.post('/rates', validate('json', RateShippingLabelSchema), async (c) => {
    const body = c.get('validatedBody') as RateShippingLabelInput;
    await loadOwnedOrder(c, body.order_id);
    if (shouldBlockLiveLogistics(c)) return carrierSetupError(c);
    return c.json(success({
        provider_mode: providerModeFromLogisticsContext(c),
        rates: [estimateRate(body, logisticsMode(c))],
    }));
});

router.get('/provider-mode', async (c) => {
    const storeId = c.req.query('store_id');
    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }

    await resolveTenantContextForOwnedSite(c, storeId);

    return c.json(success({
        provider_mode: providerModeFromLogisticsContext(c),
        capabilities: ShippingCapabilitiesSchema.parse({
            provider_mode: 'unavailable',
            manual: true,
            letbuyy_shipping: 'integration_pending',
            own_shiprocket_app: 'integration_pending',
            carrier_booking_available: false,
        }),
    }));
});

router.post('/', validate('json', BuyShippingLabelSchema), async (c) => {
    const body = c.get('validatedBody') as BuyShippingLabelInput;
    const db = getSupabaseAdmin(c);
    const { tenant, order } = await loadOwnedOrder(c, body.order_id);
    if (shouldBlockLiveLogistics(c)) return carrierSetupError(c);

    const existing = await db
        .from('shipping_labels')
        .select('*')
        .eq('site_id', tenant.siteId)
        .eq('idempotency_key', body.idempotency_key)
        .is('deleted_at', null)
        .maybeSingle();

    if (existing.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load shipping label' } }, 500);
    }
    if (existing.data) {
        return c.json(success({ label: serializeLabel(existing.data as ShippingLabelRow) }));
    }

    const destination = buildDestination(order);
    let result: ShippingLabelResult;
    try {
        const provider = createLogisticsProvider(body.provider, logisticsOptions(c, body.provider));
        result = await provider.createLabel({
            orderId: body.order_id,
            orderNumber: textValue(order.order_number) || body.order_id,
            idempotencyKey: body.idempotency_key,
            destination,
            parcels: [parcelFromInput(body)],
            metadata: {
                site_id: tenant.siteId,
                source: 'shipping.labels',
            },
        });
    } catch (error) {
        if (isLogisticsLiveProviderUnavailableError(error)) return carrierSetupError(c);
        throw error;
    }

    const inserted = await db
        .from('shipping_labels')
        .insert({
            site_id: tenant.siteId,
            order_id: body.order_id,
            provider: result.provider,
            carrier: result.carrier,
            provider_shipment_id: result.providerShipmentId,
            tracking_number: result.trackingNumber,
            tracking_url: result.trackingUrl,
            label_url: result.labelUrl,
            status: result.status,
            test_mode: result.testMode,
            package: packagePayload(body),
            idempotency_key: body.idempotency_key,
            created_by: tenant.userId,
            updated_by: tenant.userId,
            metadata: { source: 'shipping-labels.route' },
        })
        .select('*')
        .single();

    if (inserted.error || !inserted.data) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to save shipping label' } }, 500);
    }

    const row = inserted.data as ShippingLabelRow;
    const pdf = labelPdf(order, row, destination);
    const stored = await storeLabelPdf(c, row.id, pdf);
    const update = stored.key
        ? await db
            .from('shipping_labels')
            .update({ label_object_key: stored.key, label_url: stored.url, updated_by: tenant.userId })
            .eq('id', row.id).eq('site_id', tenant.siteId)
            .select('*')
            .single()
        : { data: row, error: null };

    if (update.error || !update.data) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to save shipping label PDF' } }, 500);
    }

    return c.json(success({ label: serializeLabel(update.data as ShippingLabelRow, bytesToBase64(pdf)) }), 201);
});

router.get('/:id/pdf', async (c) => {
    const db = getSupabaseAdmin(c);
    const labelId = c.req.param('id');
    const siteId = c.get('auth').user.storeId || c.req.header('X-Store-ID');
    if (!siteId) return c.json({ error: { code: 'VALIDATION', message: 'Select a store before opening a label.' } }, 400);
    await resolveTenantContextForOwnedSite(c, siteId);
    const { data, error } = await db
        .from('shipping_labels')
        .select('*')
        .eq('id', labelId).eq('site_id', siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Shipping label not found' } }, 404);
    }

    const row = data as ShippingLabelRow;
    await resolveTenantContextForOwnedSite(c, row.site_id);
    if (!row.label_object_key || !c.env.R2_BUCKET) {
        return c.json({ error: { code: 'LABEL_PDF_UNAVAILABLE', message: 'Shipping label PDF is unavailable' } }, 404);
    }

    const object = await c.env.R2_BUCKET.get(row.label_object_key);
    if (!object) {
        return c.json({ error: { code: 'LABEL_PDF_UNAVAILABLE', message: 'Shipping label PDF is unavailable' } }, 404);
    }

    return new Response(object.body, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="shipping-label-${row.id}.pdf"`,
        },
    });
});

router.post('/:id/void', async (c) => {
    const db = getSupabaseAdmin(c);
    const labelId = c.req.param('id');
    const siteId = c.get('auth').user.storeId || c.req.header('X-Store-ID');
    if (!siteId) return c.json({ error: { code: 'VALIDATION', message: 'Select a store before cancelling a label.' } }, 400);
    const tenant = await resolveTenantContextForOwnedSite(c, siteId);
    const { data, error } = await db
        .from('shipping_labels')
        .select('*')
        .eq('id', labelId).eq('site_id', siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Shipping label not found' } }, 404);
    }

    const row = data as ShippingLabelRow;
    // A database flag does not cancel a real shipment at the carrier.
    if (!row.test_mode) return c.json({ error: { code: 'CARRIER_CANCELLATION_REQUIRED', message: 'Cancel this shipment with the carrier and reconcile its status before changing the label.' } }, 409);
    const updated = await db
        .from('shipping_labels')
        .update({ status: 'voided', updated_by: tenant.userId })
        .eq('id', labelId).eq('site_id', siteId)
        .select('*')
        .single();

    if (updated.error || !updated.data) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to void shipping label' } }, 500);
    }

    return c.json(success({ label: serializeLabel(updated.data as ShippingLabelRow) }));
});

export default router;
