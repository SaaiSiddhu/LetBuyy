import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    ShippingServiceabilityQuerySchema,
    planShippingServiceability,
    type ShippingServiceabilityRule,
} from '@letbuyy/checkout-core';
import {
    createLogisticsProvider,
    isLogisticsLiveProviderUnavailableError,
    type LogisticsMode,
    type LogisticsProviderName,
    type LogisticsProviderOptions,
} from '@letbuyy/infrastructure/logistics-adapter';
import type { Env } from '../index';
import { HumanRequiredError } from '../lib/errors';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

const ShippingRatesSchema = ShippingServiceabilityQuerySchema.extend({
    subtotal_minor: z.number().int().min(0).default(0),
}).strict();

function logisticsMode(env: Env): LogisticsMode {
    return env.LOGISTICS_MODE === 'live' ? 'live' : 'sandbox';
}

type ShippingContext = Context<{ Bindings: Env }>;

function carrierSetupError(c: ShippingContext) {
    return c.json({
        error: {
            code: 'CARRIER_SETUP_REQUIRED',
            message: 'Carrier provider setup is not enabled for this environment.',
        },
    }, 503);
}

function logisticsOptions(env: Env, provider: LogisticsProviderName): LogisticsProviderOptions {
    if (logisticsMode(env) === 'sandbox') return { mode: 'sandbox' };
    if (provider === 'shiprocket' && env.SHIPROCKET_TOKEN) return { mode: 'live', credentials: { token: env.SHIPROCKET_TOKEN } };
    if (provider === 'delhivery' && env.DELHIVERY_TOKEN) return { mode: 'live', credentials: { token: env.DELHIVERY_TOKEN } };
    if (provider === 'pickrr' && env.PICKRR_TOKEN) return { mode: 'live', credentials: { token: env.PICKRR_TOKEN } };

    // [HUMAN-REQUIRED] HR-CARRIER-LIVE: install carrier account keys before live Shiprocket/Delhivery/Pickrr calls.
    throw new HumanRequiredError('[HUMAN-REQUIRED] Carrier live credentials are required.');
}

async function assertStoreAccess(c: ShippingContext, storeId: string, authUser: WorkerAuthUser) {
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, authUser);
    if (!customUser || !(await verifySiteOwnership(db, storeId, customUser.id, authUser.storeId))) {
        return { db, authorized: false as const };
    }
    return { db, authorized: true as const, customUser };
}

async function loadRules(db: ReturnType<typeof getSupabaseAdmin>, storeId: string, pincode: string): Promise<ShippingServiceabilityRule[] | null> {
    const { data, error } = await db
        .from('shipping_serviceability_rules')
        .select('provider, pincode, serviceable, cod_available, min_cod_amount_minor, max_cod_amount_minor, min_weight_grams, max_weight_grams, estimated_days_min, estimated_days_max')
        .eq('site_id', storeId)
        .eq('pincode', pincode)
        .is('deleted_at', null);

    if (error) return null;
    return (data || []) as ShippingServiceabilityRule[];
}

router.get('/serviceability/:pincode', async (c) => {
    const pincode = c.req.param('pincode');
    const storeId = c.req.query('store_id');
    const cod = c.req.query('cod') === 'true';
    const orderAmountMinor = Number(c.req.query('order_amount_minor') || 0);
    const weightGrams = Number(c.req.query('weight_grams') || 500);

    if (!storeId) return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    const parsed = ShippingServiceabilityQuerySchema.safeParse({
        store_id: storeId,
        pincode,
        cod,
        order_amount_minor: orderAmountMinor,
        weight_grams: weightGrams,
    });
    if (!parsed.success) return c.json({ error: { code: 'VALIDATION', message: 'Invalid serviceability request' } }, 400);

    const auth = c.get('auth');
    const access = await assertStoreAccess(c, storeId, auth.user);
    if (!access.authorized) return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);

    const rules = await loadRules(access.db, storeId, pincode);
    if (!rules) return c.json({ error: { code: 'SHIPPING_CONFIGURATION_UNAVAILABLE', message: 'Shipping coverage could not be verified. Please retry.' } }, 503);
    return c.json(success(planShippingServiceability(parsed.data, rules)));
});

router.post('/rates', validate('json', ShippingRatesSchema), async (c) => {
    const body = c.get('validatedBody') as z.infer<typeof ShippingRatesSchema>;
    const auth = c.get('auth');
    const access = await assertStoreAccess(c, body.store_id, auth.user);
    if (!access.authorized) return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);

    const rules = await loadRules(access.db, body.store_id, body.pincode);
    if (!rules) return c.json({ error: { code: 'SHIPPING_CONFIGURATION_UNAVAILABLE', message: 'Shipping coverage could not be verified. Please retry.' } }, 503);
    const serviceability = planShippingServiceability(body, rules);
    if (!serviceability.serviceable) {
        return c.json(success({ serviceability, rates: [] }));
    }

    const { data, error } = await access.db
        .from('shipping_rates')
        .select('id, name, type, price, estimated_days_min, estimated_days_max')
        .eq('site_id', body.store_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(10);
    if (error) return c.json({ error: { code: 'SHIPPING_CONFIGURATION_UNAVAILABLE', message: 'Shipping rates could not be verified. Please retry.' } }, 503);

    const rates = (data || []).map((rate) => ({
        id: String(rate.id),
        name: String(rate.name || 'Standard shipping'),
        type: String(rate.type || 'flat'),
        currency: 'INR',
        amount_minor: Math.round(Number(rate.price || 0) * 100),
        estimated_days_min: Number(rate.estimated_days_min || serviceability.estimated_days_min),
        estimated_days_max: Number(rate.estimated_days_max || serviceability.estimated_days_max),
        provider: serviceability.provider,
        cod_available: serviceability.cod_available,
    }));

    return c.json(success({
        serviceability,
        rates,
    }));
});

router.get('/track/:trackingNumber', async (c) => {
    const trackingNumber = c.req.param('trackingNumber');
    const providerName = (c.req.query('provider') || 'shiprocket') as LogisticsProviderName;
    try {
        const provider = createLogisticsProvider(providerName, logisticsOptions(c.env, providerName));
        return c.json(success(await provider.getTracking({ trackingNumber })));
    } catch (error) {
        if (error instanceof HumanRequiredError || isLogisticsLiveProviderUnavailableError(error)) return carrierSetupError(c);
        throw error;
    }
});

export default router;
