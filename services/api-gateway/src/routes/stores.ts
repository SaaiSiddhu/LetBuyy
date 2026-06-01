import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { CreateStoreSchema, PaymentConfigSchema, UpdateStoreSchema } from '../schemas/store.schema';
import { verifyRazorpayCredentials as verifyRazorpayCredentialsWithAdapter } from '@letbuyy/infrastructure/razorpay-adapter';

const router = new Hono<{ Bindings: Env }>();

type PaymentSettings = {
    mode?: 'shared' | 'ownAccount';
    gateways?: string[];
    razorpay?: {
        key_id?: string;
        key_secret_ciphertext?: string;
        test_mode?: boolean;
        verified?: boolean;
        connected_at?: string;
        updated_at?: string;
    };
};

function base64EncodeBytes(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function maskKeyId(keyId?: string): string | null {
    if (!keyId) return null;
    if (keyId.length <= 8) return keyId;
    return `${keyId.slice(0, 8)}...${keyId.slice(-4)}`;
}

async function importPaymentEncryptionKey(secret: string): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
    return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt']);
}

async function encryptPaymentSecret(secret: string, encryptionKey: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importPaymentEncryptionKey(encryptionKey);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(secret)
    );

    return `${base64EncodeBytes(iv)}:${base64EncodeBytes(new Uint8Array(ciphertext))}`;
}

async function verifyRazorpayCredentials(keyId: string, keySecret: string): Promise<boolean> {
    return verifyRazorpayCredentialsWithAdapter({ keyId, keySecret });
}

function sanitizePaymentSettings(settings: PaymentSettings | null | undefined) {
    const razorpay = settings?.razorpay;

    return {
        mode: settings?.mode || 'shared',
        gateways: settings?.gateways || ['razorpay'],
        razorpay: razorpay
            ? {
                key_id: maskKeyId(razorpay.key_id),
                test_mode: Boolean(razorpay.test_mode),
                verified: Boolean(razorpay.verified),
                connected_at: razorpay.connected_at || null,
                updated_at: razorpay.updated_at || null,
                secret_configured: Boolean(razorpay.key_secret_ciphertext),
            }
            : null,
    };
}

function isMissingDeletedAtError(error: { message?: string } | null | undefined): boolean {
    return Boolean(error?.message?.includes('sites.deleted_at') && error.message.includes('does not exist'));
}

function isMissingSitesPaymentColumnError(error: { message?: string } | null | undefined): boolean {
    const message = error?.message || '';
    return (
        message.includes('sites.payment_settings') ||
        message.includes('sites.online_payment_enabled') ||
        message.includes('sites.cod_enabled')
    ) && message.includes('does not exist');
}

function defaultPaymentConfig(storeId: string) {
    return {
        store_id: storeId,
        online_payment_enabled: true,
        cod_enabled: true,
        payment_settings: sanitizePaymentSettings(null),
        schema_ready: false,
    };
}

// GET /stores/:id/payment-config — Return masked tenant payment config
router.get('/:id/payment-config', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildPaymentQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id, payment_settings, online_payment_enabled, cod_enabled')
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildPaymentQuery(true).single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildPaymentQuery(false).single());
    }

    if (isMissingSitesPaymentColumnError(error)) {
        const buildOwnershipQuery = (includeDeletedAtFilter: boolean) => {
            const query = db
                .from('sites')
                .select('id')
                .eq('id', storeId)
                .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

            return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
        };

        let ownershipResult = await buildOwnershipQuery(true).single();
        if (isMissingDeletedAtError(ownershipResult.error)) {
            ownershipResult = await buildOwnershipQuery(false).single();
        }

        if (ownershipResult.error || !ownershipResult.data) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
        }

        return c.json(success(defaultPaymentConfig(storeId)));
    }

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success({
        store_id: data.id,
        online_payment_enabled: data.online_payment_enabled !== false,
        cod_enabled: data.cod_enabled !== false,
        payment_settings: sanitizePaymentSettings(data.payment_settings as PaymentSettings | null),
    }));
});

// POST /stores/:id/payment-config — Save seller-owned Razorpay credentials
router.post('/:id/payment-config', validate('json', PaymentConfigSchema), async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const body = c.get('validatedBody') as {
        key_id: string;
        key_secret: string;
        test_mode: boolean;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!c.env.PAYMENT_CONFIG_ENCRYPTION_KEY) {
        return c.json(
            {
                error: {
                    code: 'PAYMENT_CONFIG_UNAVAILABLE',
                    message: 'Payment credential encryption is not configured',
                },
            },
            503
        );
    }

    const buildPaymentQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id, payment_settings, cod_enabled')
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: store, error: storeError } = await buildPaymentQuery(true).single();

    if (isMissingDeletedAtError(storeError)) {
        ({ data: store, error: storeError } = await buildPaymentQuery(false).single());
    }

    if (isMissingSitesPaymentColumnError(storeError)) {
        return c.json(
            {
                error: {
                    code: 'PAYMENT_SCHEMA_MISSING',
                    message: 'Payment settings require the latest sites payment columns before credentials can be saved',
                },
            },
            503
        );
    }

    if (storeError || !store) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    const keySecretCiphertext = await encryptPaymentSecret(
        body.key_secret,
        c.env.PAYMENT_CONFIG_ENCRYPTION_KEY
    );

    let verified = false;
    try {
        verified = await verifyRazorpayCredentials(body.key_id, body.key_secret);
    } catch {
        verified = false;
    }

    const now = new Date().toISOString();
    const existingSettings = (store.payment_settings || {}) as PaymentSettings;
    const paymentSettings: PaymentSettings = {
        ...existingSettings,
        mode: 'ownAccount',
        gateways: Array.from(new Set([...(existingSettings.gateways || []), 'razorpay'])),
        razorpay: {
            key_id: body.key_id,
            key_secret_ciphertext: keySecretCiphertext,
            test_mode: body.test_mode,
            verified,
            connected_at: existingSettings.razorpay?.connected_at || now,
            updated_at: now,
        },
    };

    const updatePaymentSettings = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .update({
                payment_settings: paymentSettings,
                online_payment_enabled: true,
                cod_enabled: store.cod_enabled !== false,
                updated_at: now,
            })
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await updatePaymentSettings(true)
        .select('id, payment_settings, online_payment_enabled, cod_enabled')
        .single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await updatePaymentSettings(false)
            .select('id, payment_settings, online_payment_enabled, cod_enabled')
            .single());
    }

    if (isMissingSitesPaymentColumnError(error)) {
        return c.json(
            {
                error: {
                    code: 'PAYMENT_SCHEMA_MISSING',
                    message: 'Payment settings require the latest sites payment columns before credentials can be saved',
                },
            },
            503
        );
    }

    if (error || !data) {
        return c.json({ error: { code: 'DB_ERROR', message: error?.message || 'Unable to save payment config' } }, 500);
    }

    return c.json(success({
        store_id: data.id,
        online_payment_enabled: data.online_payment_enabled !== false,
        cod_enabled: data.cod_enabled !== false,
        payment_settings: sanitizePaymentSettings(data.payment_settings as PaymentSettings | null),
    }));
});

// GET /stores — List all stores for the authenticated user
router.get('/', async (c) => {
    const auth = c.get('auth');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    const offset = (page - 1) * limit;

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildListQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('*', { count: 'exact' })
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`)
            .order('created_at', { ascending: false });

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error, count } = await buildListQuery(true).range(offset, offset + limit - 1);

    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildListQuery(false).range(offset, offset + limit - 1));
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /stores/public/:subdomain — Public store data (no auth required)
router.get('/public/:subdomain', async (c) => {
    const subdomain = c.req.param('subdomain');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('sites')
        .select(
            'id, name, subdomain, tagline, logo_url, custom_domain, site_type, currency, locale, theme_id, template_config, description, published_at'
        )
        .eq('subdomain', subdomain)
        .eq('status', 'published')
        .is('deleted_at', null)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /stores/handle/:handle — Resolve an owned store by admin URL handle
router.get('/handle/:handle', async (c) => {
    const auth = c.get('auth');
    const handle = c.req.param('handle').toLowerCase().trim();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildHandleQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id, name, store_name, subdomain, site_type, status, custom_user_id, trial_ends_at, trial_status, theme_id, theme_settings, custom_domain')
            .or(`store_name.eq.${handle},subdomain.eq.${handle}`)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildHandleQuery(true).maybeSingle();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildHandleQuery(false).maybeSingle());
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    if (!data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /stores/:id — Get a specific store
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildStoreQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('*')
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildStoreQuery(true).single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildStoreQuery(false).single());
    }

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /stores — Create a new store
// FIX: Uses Zod validation with reserved subdomain blocking
router.post('/', validate('json', CreateStoreSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as {
        name: string; subdomain: string; site_type: string;
        tagline?: string; locale?: string; theme_id: string; template_config: Record<string, unknown>;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    // Check subdomain uniqueness
    const { data: existing } = await db
        .from('sites')
        .select('id')
        .or(`subdomain.eq.${body.subdomain},store_name.eq.${body.subdomain}`)
        .limit(1);

    if (existing && existing.length > 0) {
        return c.json({ error: { code: 'CONFLICT', message: 'Subdomain already taken' } }, 409);
    }

    const { data, error } = await db
        .from('sites')
        .insert({
            custom_user_id: customUser.id,
            name: body.name,
            store_name: body.subdomain,
            subdomain: body.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            site_type: body.site_type,
            status: 'draft',
            tagline: body.tagline || null,
            locale: body.locale || 'en-IN',
            theme_id: body.theme_id,
            template_config: body.template_config,
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// PATCH /stores/:id — Update a store
router.patch('/:id', validate('json', UpdateStoreSchema), async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const body = c.get('validatedBody') as Record<string, unknown>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    // Filter to only accepted fields (schema already validates)
    const updates: Record<string, unknown> = {};
    const allowed = [
        'name', 'description', 'tagline', 'status', 'theme_id', 'template_config',
        'site_settings', 'logo_url', 'custom_domain', 'currency', 'locale',
        'refund_policy', 'privacy_policy', 'terms_of_service', 'shipping_policy',
        'seo_title', 'seo_description',
        'tax_inclusive',
    ];
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    // Publish timestamp
    if (updates.status === 'published') {
        updates.published_at = new Date().toISOString();
    }

    const updateStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .update(updates)
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await updateStore(true)
        .select()
        .single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await updateStore(false)
            .select()
            .single());
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /stores/:id/publish — Publish a store
router.post('/:id/publish', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const publishUpdates = {
        status: 'published',
        published_at: new Date().toISOString(),
    };
    const publishStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .update(publishUpdates)
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await publishStore(true)
        .select()
        .single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await publishStore(false)
            .select()
            .single());
    }

    if (error || !data) {
        return c.json(
            { error: { code: 'NOT_FOUND', message: 'Store not found or not owned by you' } },
            404
        );
    }

    return c.json(success(data));
});

// DELETE /stores/:id — Soft delete with deleted_at timestamp
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { error } = await db
        .from('sites')
        .update({
            status: 'suspended',
            deleted_at: new Date().toISOString(),
        })
        .eq('id', storeId)
        .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
