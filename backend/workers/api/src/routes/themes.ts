import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { dbErrorBody, errorBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
    InstallThemeSchema,
    PreviewTokenSchema,
    PublishThemeSchema,
    RollbackThemeReleaseSchema,
    SaveThemeDraftSchema,
    ThemePurchaseOrderSchema,
    ThemePurchaseVerifySchema,
    ThemeStoreQuerySchema,
    type InstallThemeInput,
    type PreviewTokenInput,
    type PublishThemeInput,
    type RollbackThemeReleaseInput,
    type SaveThemeDraftInput,
    type ThemePurchaseOrderInput,
    type ThemePurchaseVerifyInput,
} from '../schemas/theme.schema';
import { EventService } from '../services/event.service';
import { ThemeService } from '../services/theme.service';

const router = new Hono<{ Bindings: Env }>();
const SUPPORTED_THEME_SLUGS = ['urban-kicks'];

router.use('/', optionalAuth);
router.use('/:slug/editor', authMiddleware);
router.use('/:slug/editor/*', authMiddleware);
router.use('/:slug/publish', authMiddleware);
router.use('/:slug/preview-session', authMiddleware);
router.use('/:slug/releases', authMiddleware);
router.use('/:slug/releases/*', authMiddleware);
router.use('/:slug/install', authMiddleware);
router.use('/:slug/purchase', authMiddleware);
router.use('/:slug/purchase/*', authMiddleware);
router.use('/purchases/list', authMiddleware);
router.use('/installations/list', authMiddleware);

type ThemePurchaseTheme = {
    id: string;
    slug?: string | null;
    name: string;
    is_premium?: boolean | null;
    letbuyy_pricing_type?: string | null;
    letbuyy_price_inr?: number | string | null;
    letbuyy_price_usd?: number | string | null;
};

type ThemePurchaseRecord = {
    id: string;
    status?: string | null;
    provider_order_id?: string | null;
    provider_payment_id?: string | null;
    payment_idempotency_key?: string | null;
};

type RazorpayOrderCreateResponse = {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string };
};

function getRequestId(c: Context<{ Bindings: Env }>): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

// GET /themes — List available themes (public)
router.get('/', async (c) => {
    const auth = c.get('auth');
    const category = c.req.query('category');
    const siteType = c.req.query('site_type');
    const pricing = c.req.query('pricing');
    const industry = c.req.query('industry');
    const search = c.req.query('search');
    const sort = c.req.query('sort') || 'popular';
    const storeId = c.req.query('store_id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('themes')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .in('slug', SUPPORTED_THEME_SLUGS);

    if (category) query = query.eq('category', category);
    if (siteType) query = query.contains('supported_site_types', [siteType]);
    if (pricing) query = query.eq('letbuyy_pricing_type', pricing);
    if (industry) query = query.contains('industry', [industry]);
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

    switch (sort) {
        case 'rating':
            query = query.order('rating_avg', { ascending: false });
            break;
        case 'recent':
            query = query.order('created_at', { ascending: false });
            break;
        case 'name':
            query = query.order('name', { ascending: true });
            break;
        case 'price_low':
            query = query.order('letbuyy_price_inr', { ascending: true });
            break;
        case 'price_high':
            query = query.order('letbuyy_price_inr', { ascending: false });
            break;
        case 'popular':
            query = query.order('install_count', { ascending: false });
            break;
        default:
            query = query.order('sort_order', { ascending: true });
            break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    if (!storeId) {
        return c.json(paginated(data || [], count || 0, page, limit));
    }

    if (!auth) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required for store-scoped theme state' } }, 401);
    }

    const queryResult = ThemeStoreQuerySchema.safeParse({ store_id: storeId });
    if (!queryResult.success) {
        return c.json(
            { error: { code: 'VALIDATION_ERROR', message: 'Invalid store_id' } },
            400
        );
    }

    const service = new ThemeService(db);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const store = await service.verifyStoreOwner(queryResult.data.store_id, customUser.id);

    const { data: installations } = await db
        .from('store_themes')
        .select('theme_id, is_active')
        .eq('store_id', queryResult.data.store_id);

    const installedThemeIds = new Set((installations || []).map((row) => row.theme_id as string));
    const activeThemeIds = new Set(
        (installations || [])
            .filter((row) => row.is_active)
            .map((row) => row.theme_id as string)
    );

    const enriched = (data || []).map((theme) => ({
        ...theme,
        installed: installedThemeIds.has(theme.id),
        active: activeThemeIds.has(theme.id) || store.theme_id === theme.slug,
    }));

    return c.json({
        ...paginated(enriched, count || 0, page, limit),
        current_theme: store.theme_id || null,
        store_status: store.status || null,
    });
});

// GET /themes/categories — List unique theme categories
router.get('/categories', async (c) => {
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('themes')
        .select('category')
        .eq('is_active', true)
        .not('category', 'is', null);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    // Deduplicate
    const categories = [...new Set((data || []).map((t) => t.category).filter(Boolean))];
    return c.json(success(categories));
});

// GET /themes/industries — List unique theme industries
router.get('/industries', async (c) => {
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('themes')
        .select('industry')
        .eq('is_active', true)
        .not('industry', 'is', null);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    const industries = [
        ...new Set(
            (data || [])
                .flatMap((row) => Array.isArray(row.industry) ? row.industry : [])
                .filter(Boolean)
        ),
    ];

    return c.json(success(industries.sort()));
});

// GET /themes/purchases/list — List user's purchased themes
router.get('/purchases/list', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data, error } = await db
        .from('theme_purchases')
        .select('*, themes(*)')
        .eq('user_id', customUser.id)
        .order('purchased_at', { ascending: false });

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json(success(data || []));
});

// GET /themes/installations/list — List theme installations for user's stores
router.get('/installations/list', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: sites, error: sitesError } = await db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`)
        .is('deleted_at', null);

    if (sitesError) {
        return c.json(dbErrorBody(), 500);
    }

    const siteIds = (sites || []).map((site) => site.id as string);
    if (siteIds.length === 0) {
        return c.json(success([]));
    }

    const { data, error } = await db
        .from('store_themes')
        .select('*, themes(*), sites(subdomain, custom_domain)')
        .in('store_id', siteIds)
        .order('installed_at', { ascending: false });

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json(success(data || []));
});

// GET /themes/:slug/schema — Return editable schemas for a theme
router.get('/:slug/schema', async (c) => {
    const slug = c.req.param('slug');
    const db = getSupabaseAdmin(c);
    const service = new ThemeService(db);
    return c.json(success(await service.getEditableSchema(slug)));
});

// GET /themes/:slug/editor?store_id=... — Load store-scoped theme editor state
router.get('/:slug/editor', async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const parsed = ThemeStoreQuerySchema.safeParse({
        store_id: c.req.query('store_id'),
    });

    if (!parsed.success) {
        return c.json(
            { error: { code: 'VALIDATION_ERROR', message: 'store_id query parameter is required' } },
            400
        );
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeService(db);
    return c.json(success(await service.loadEditor(slug, parsed.data.store_id, customUser.id)));
});

// PUT /themes/:slug/editor/draft — Save a store-scoped theme draft
router.put('/:slug/editor/draft', validate('json', SaveThemeDraftSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as SaveThemeDraftInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeService(db);
    return c.json(success(await service.saveDraft(slug, body, customUser.id, getRequestId(c))));
});

// DELETE /themes/:slug/editor/draft?store_id=... — Discard a store-scoped draft
router.delete('/:slug/editor/draft', async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const parsed = ThemeStoreQuerySchema.safeParse({
        store_id: c.req.query('store_id'),
    });

    if (!parsed.success) {
        return c.json(
            { error: { code: 'VALIDATION_ERROR', message: 'store_id query parameter is required' } },
            400
        );
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeService(db);
    return c.json(success(await service.deleteDraft(slug, parsed.data.store_id, customUser.id, getRequestId(c))));
});

// POST /themes/:slug/publish — Publish a saved draft to the live store config
router.post('/:slug/publish', validate('json', PublishThemeSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as PublishThemeInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeService(db);
    return c.json(success(await service.publish(slug, body, customUser.id, getRequestId(c))));
});

// POST /themes/:slug/preview-session — Create a signed draft preview token
router.post('/:slug/preview-session', validate('json', PreviewTokenSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as PreviewTokenInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeService(db);
    return c.json(success(await service.createPreviewSession(slug, body, customUser.id, getRequestId(c))), 201);
});

// GET /themes/:slug/releases?store_id=... — List immutable release history
router.get('/:slug/releases', async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const parsed = ThemeStoreQuerySchema.safeParse({
        store_id: c.req.query('store_id'),
    });

    if (!parsed.success) {
        return c.json(
            { error: { code: 'VALIDATION_ERROR', message: 'store_id query parameter is required' } },
            400
        );
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeService(db);
    return c.json(success(await service.listReleases(slug, parsed.data.store_id, customUser.id)));
});

// POST /themes/:slug/releases/:releaseId/rollback — Publish a new release from an older snapshot
router.post('/:slug/releases/:releaseId/rollback', validate('json', RollbackThemeReleaseSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const releaseId = c.req.param('releaseId');
    const body = c.get('validatedBody') as RollbackThemeReleaseInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeService(db);
    return c.json(success(await service.rollbackRelease(slug, releaseId, body, customUser.id, getRequestId(c))));
});

// GET /themes/:slug — Get theme details by slug
router.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('themes')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    // Fetch reviews
    const { data: reviews } = await db
        .from('theme_reviews')
        .select('*')
        .eq('theme_id', data.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(10);

    return c.json(success({ ...data, reviews: reviews || [] }));
});

// POST /themes/:slug/install — Install/apply a theme to a store
router.post('/:slug/install', validate('json', InstallThemeSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as InstallThemeInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const service = new ThemeService(db);
    return c.json(success(await service.installTheme(slug, body, customUser.id, getRequestId(c))), 201);
});

// POST /themes/:slug/purchase — Create a server-priced Razorpay order for a paid theme
router.post('/:slug/purchase', validate('json', ThemePurchaseOrderSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as ThemePurchaseOrderInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: theme, error: themeError } = await db
        .from('themes')
        .select('id, slug, name, is_premium, letbuyy_pricing_type, letbuyy_price_inr, letbuyy_price_usd')
        .eq('slug', slug)
        .single();

    if (themeError || !theme) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    const purchasableTheme = theme as ThemePurchaseTheme;
    const pricingType = purchasableTheme.letbuyy_pricing_type || (purchasableTheme.is_premium ? 'one_time' : 'free');
    const priceInr = Number(purchasableTheme.letbuyy_price_inr || 0);
    const amountPaise = Math.round(priceInr * 100);

    const { data: existingPurchase } = await db
        .from('theme_purchases')
        .select('id, status, provider_order_id, provider_payment_id, payment_idempotency_key')
        .eq('user_id', customUser.id)
        .eq('theme_id', purchasableTheme.id)
        .maybeSingle();

    const existing = existingPurchase as ThemePurchaseRecord | null;
    if (existing?.status === 'completed') {
        return c.json(success({
            purchase_id: existing.id,
            theme: purchasableTheme.name,
            status: 'completed',
            already_purchased: true,
        }));
    }

    if (pricingType === 'free' || amountPaise <= 0) {
        const { data: freePurchase, error } = await db
            .from('theme_purchases')
            .upsert(
                {
                    user_id: customUser.id,
                    theme_id: purchasableTheme.id,
                    price_paid_inr: 0,
                    price_paid_usd: 0,
                    currency: body.currency,
                    payment_method: 'free',
                    payment_provider: 'free',
                    status: 'completed',
                    payment_processed_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,theme_id' }
            )
            .select('id, status')
            .single();

        if (error || !freePurchase) {
            throw new Error('Unable to record free theme purchase');
        }

        return c.json(success({
            purchase_id: freePurchase.id,
            theme: purchasableTheme.name,
            status: 'completed',
            payment_required: false,
        }), 201);
    }

    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
        return c.json({ error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } }, 503);
    }

    if (
        existing?.status === 'pending' &&
        existing.provider_order_id &&
        body.idempotency_key &&
        existing.payment_idempotency_key === body.idempotency_key
    ) {
        return c.json(success({
            purchase_id: existing.id,
            theme: purchasableTheme.name,
            status: 'pending',
            provider: 'razorpay',
            razorpay_order_id: existing.provider_order_id,
            amount: amountPaise,
            currency: body.currency,
            key_id: c.env.RAZORPAY_KEY_ID,
            idempotent_replay: true,
        }));
    }

    const requestId = getRequestId(c);
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)}`,
        },
        body: JSON.stringify({
            amount: amountPaise,
            currency: body.currency,
            receipt: `theme_${purchasableTheme.id.slice(0, 8)}_${Date.now()}`,
            notes: {
                theme_id: purchasableTheme.id,
                theme_slug: slug,
                user_id: customUser.id,
                idempotency_key: body.idempotency_key || '',
                request_id: requestId,
            },
        }),
    });

    const razorpayOrder = (await razorpayResponse.json()) as RazorpayOrderCreateResponse;
    if (!razorpayResponse.ok || !razorpayOrder.id) {
        return c.json(
            errorBody('PAYMENT_PROVIDER_ERROR', 'Failed to create theme payment order'),
            502
        );
    }

    const { data: purchase, error } = await db
        .from('theme_purchases')
        .upsert(
            {
                user_id: customUser.id,
                theme_id: purchasableTheme.id,
                price_paid_inr: priceInr,
                price_paid_usd: purchasableTheme.letbuyy_price_usd || 0,
                currency: body.currency,
                payment_method: 'razorpay',
                payment_provider: 'razorpay',
                payment_id: razorpayOrder.id,
                provider_order_id: razorpayOrder.id,
                payment_idempotency_key: body.idempotency_key || null,
                status: 'pending',
            },
            { onConflict: 'user_id,theme_id' }
        )
        .select('id, status, provider_order_id')
        .single();

    if (error || !purchase) {
        throw new Error('Unable to record pending theme purchase');
    }

    const events = new EventService(db);
    await events.emitDomainEvent({
        storeId: null,
        aggregateType: 'theme_purchase',
        aggregateId: String(purchase.id),
        eventType: 'theme.purchase.payment_order_created',
        idempotencyKey: `theme.purchase.order:${razorpayOrder.id}`,
        requestId,
        actorId: customUser.id,
        payload: {
            theme_id: purchasableTheme.id,
            theme_slug: slug,
            provider: 'razorpay',
            provider_order_id: razorpayOrder.id,
            amount: razorpayOrder.amount ?? amountPaise,
            currency: razorpayOrder.currency || body.currency,
        },
    });

    return c.json(success({
        purchase_id: purchase.id,
        theme: purchasableTheme.name,
        status: 'pending',
        provider: 'razorpay',
        razorpay_order_id: razorpayOrder.id,
        amount: razorpayOrder.amount ?? amountPaise,
        currency: razorpayOrder.currency || body.currency,
        key_id: c.env.RAZORPAY_KEY_ID,
    }), 201);
});

// POST /themes/:slug/purchase/verify — Verify Razorpay signature and complete purchase
router.post('/:slug/purchase/verify', validate('json', ThemePurchaseVerifySchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as ThemePurchaseVerifyInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!c.env.RAZORPAY_KEY_SECRET) {
        return c.json({ error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } }, 503);
    }

    const expected = await hmacSha256Hex(
        c.env.RAZORPAY_KEY_SECRET,
        `${body.razorpay_order_id}|${body.razorpay_payment_id}`
    );

    if (!timingSafeEqualHex(expected, body.razorpay_signature)) {
        return c.json({ error: { code: 'PAYMENT_SIGNATURE_INVALID', message: 'Payment verification failed' } }, 400);
    }

    const { data: theme, error: themeError } = await db
        .from('themes')
        .select('id, slug, name')
        .eq('slug', slug)
        .single();

    if (themeError || !theme) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    const { data: purchase, error } = await db
        .from('theme_purchases')
        .update({
            status: 'completed',
            payment_method: 'razorpay',
            payment_provider: 'razorpay',
            payment_id: body.razorpay_payment_id,
            provider_payment_id: body.razorpay_payment_id,
            payment_signature: body.razorpay_signature,
            payment_processed_at: new Date().toISOString(),
            license_key: `LB-THEME-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
        })
        .eq('user_id', customUser.id)
        .eq('theme_id', theme.id)
        .eq('provider_order_id', body.razorpay_order_id)
        .select('id, status, provider_payment_id')
        .single();

    if (error || !purchase) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Pending theme purchase not found' } }, 404);
    }

    const requestId = getRequestId(c);
    const events = new EventService(db);
    await events.emitDomainEvent({
        storeId: null,
        aggregateType: 'theme_purchase',
        aggregateId: String(purchase.id),
        eventType: 'theme.purchase.completed',
        idempotencyKey: `theme.purchase.completed:razorpay:${body.razorpay_payment_id}`,
        requestId,
        actorId: customUser.id,
        payload: {
            theme_id: theme.id,
            theme_slug: slug,
            provider: 'razorpay',
            provider_order_id: body.razorpay_order_id,
            provider_payment_id: body.razorpay_payment_id,
        },
    });

    await events.emitAuditEvent({
        actorId: customUser.id,
        action: 'theme.purchase.complete',
        resourceType: 'theme_purchase',
        resourceId: String(purchase.id),
        requestId,
        afterState: {
            theme_id: theme.id,
            theme_slug: slug,
            status: 'completed',
            provider: 'razorpay',
        },
    });

    return c.json(success({
        purchase_id: purchase.id,
        theme: theme.name,
        status: purchase.status,
        provider_payment_id: purchase.provider_payment_id,
    }));
});

export default router;
