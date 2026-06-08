// ============================================================
// ONBOARDING — 6-step wizard (Doc 03 + Doc 09 § 4)
// ============================================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { getRequestId } from '../lib/tenant-context';
import {
    StartOnboardingSchema,
    CheckSubdomainSchema,
    STEP_SCHEMAS,
} from '../schemas/onboarding.schema';
import { isComingSoonSiteType, isLegacySiteType, legacySiteTypeCreationEnabled } from '@letbuyy/tenant-core';

const router = new Hono<{ Bindings: Env }>();

const MobileOnboardingProgressSchema = z.object({
    site_type: z.enum(['store', 'portfolio', 'resume', 'landing', 'blog']).default('store'),
    business_type: z.enum(['new', 'existing']),
    channels: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
    product_type: z.string().trim().min(1).max(80),
    category: z.string().trim().min(1).max(80),
});

function platformDomain(env: Env): string {
    return (env.NEXT_PUBLIC_PLATFORM_DOMAIN || env.LETBUYY_PLATFORM_DOMAIN || env.PLATFORM_ROOT_DOMAIN || 'letbuyy.com')
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^\.+|\.+$/g, '') || 'letbuyy.com';
}

function adminUrl(env: Env, urlPath = ''): string {
    const base = (env.NEXT_PUBLIC_ADMIN_URL || `https://admin.${platformDomain(env)}`).replace(/\/+$/, '');
    return `${base}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
}

function storefrontUrl(env: Env, subdomain: string): string {
    const rootDomain = (env.NEXT_PUBLIC_STORE_ROOT_DOMAIN || env.STOREFRONT_ROOT_DOMAIN || platformDomain(env))
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^\.+|\.+$/g, '') || 'letbuyy.com';
    return `https://${subdomain}.${rootDomain}`;
}

function legacySiteTypeCreationAllowed(env: Env): boolean {
    return legacySiteTypeCreationEnabled(env.LETBUYY_ENABLE_LEGACY_SITE_TYPES);
}

function legacySiteTypeCreationResponse(siteType: string) {
    return {
        success: false,
        error: {
            code: 'LEGACY_SITE_TYPE_DISABLED',
            message: `${siteType} site creation is legacy-gated. Existing sites remain supported, but new portfolio/resume acquisition requires LETBUYY_ENABLE_LEGACY_SITE_TYPES=true.`,
        },
    };
}

function comingSoonSiteTypeCreationResponse(siteType: string) {
    return {
        success: false,
        error: {
            code: 'SITE_TYPE_COMING_SOON',
            message: `${siteType} site creation is coming soon. Online Store is available today.`,
        },
    };
}

async function emitStoreCreatedEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        store: { id?: string; subdomain?: string | null; store_name?: string | null };
        ownerUserId: string;
        requestId: string;
    },
): Promise<void> {
    if (!input.store.id) return;

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.store.id,
        aggregateType: 'store',
        aggregateId: input.store.id,
        eventType: 'store.created',
        payload: {
            site_id: input.store.id,
            store_slug: input.store.subdomain || input.store.store_name || input.store.id,
            owner_user_id: input.ownerUserId,
        },
        idempotencyKey: `store.created:${input.store.id}`,
        requestId: input.requestId,
        actorId: input.ownerUserId,
    });
}

// POST /onboarding/start — Start a new onboarding attempt
router.post('/start', validate('json', StartOnboardingSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as { site_type: string };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (isComingSoonSiteType(body.site_type)) {
        return c.json(comingSoonSiteTypeCreationResponse(body.site_type), 403);
    }

    if (isLegacySiteType(body.site_type) && !legacySiteTypeCreationAllowed(c.env)) {
        return c.json(legacySiteTypeCreationResponse(body.site_type), 403);
    }

    // Check if user already has an in-progress attempt
    const { data: existing } = await db
        .from('onboarding_attempts')
        .select('id, current_step')
        .eq('user_id', customUser.id)
        .eq('status', 'in_progress')
        .single();

    if (existing) {
        return c.json(success({
            attempt_id: existing.id,
            current_step: existing.current_step,
            resumed: true,
        }));
    }

    const { data, error } = await db
        .from('onboarding_attempts')
        .insert({
            user_id: customUser.id,
            requested_name: 'mobile-onboarding',
            requested_subdomain: `mobile-${customUser.id.slice(0, 8)}`,
            site_type: body.site_type,
            current_step: 1,
            status: 'in_progress',
        })
        .select()
        .single();

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({
        attempt_id: data.id,
        current_step: 1,
        total_steps: 6,
        site_type: body.site_type,
        steps: [
            { step: 1, name: 'choose_type', status: 'current' },
            { step: 2, name: 'name_store', status: 'pending' },
            { step: 3, name: 'pick_template', status: 'pending' },
            { step: 4, name: 'survey', status: 'pending' },
            { step: 5, name: 'customize', status: 'pending' },
            { step: 6, name: 'launch', status: 'pending' },
        ],
    }), 201);
});

// GET /onboarding/status — Get current onboarding progress
router.get('/status', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data } = await db
        .from('onboarding_attempts')
        .select('*, onboarding_progress(*)')
        .eq('user_id', customUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!data) {
        return c.json(success({ onboarding_completed: false, attempt: null }));
    }

    return c.json(success({
        onboarding_completed: data.status === 'completed',
        attempt: data,
    }));
});

// POST /onboarding/mobile-progress — Persist mobile wizard steps 1-4
router.post('/mobile-progress', validate('json', MobileOnboardingProgressSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as z.infer<typeof MobileOnboardingProgressSchema>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (isComingSoonSiteType(body.site_type)) {
        return c.json(comingSoonSiteTypeCreationResponse(body.site_type), 403);
    }

    if (isLegacySiteType(body.site_type) && !legacySiteTypeCreationAllowed(c.env)) {
        return c.json(legacySiteTypeCreationResponse(body.site_type), 403);
    }

    const surveyData = {
        source: 'mobile-merchant-app',
        business_type: body.business_type,
        channels: body.channels,
        product_type: body.product_type,
        category: body.category,
    };

    const { data: existing } = await db
        .from('onboarding_attempts')
        .select('id')
        .eq('user_id', customUser.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const row = {
        site_type: body.site_type,
        current_step: 5,
        completed_steps: [1, 2, 3, 4],
        survey_data: surveyData,
        last_activity_at: new Date().toISOString(),
    };

    const query = existing?.id
        ? db
            .from('onboarding_attempts')
            .update(row)
            .eq('id', existing.id)
            .select('id, current_step, completed_steps, survey_data')
            .single()
        : db
            .from('onboarding_attempts')
            .insert({
                ...row,
                user_id: customUser.id,
                requested_name: 'mobile-onboarding',
                requested_subdomain: `mobile-${customUser.id.slice(0, 8)}`,
                status: 'in_progress',
            })
            .select('id, current_step, completed_steps, survey_data')
            .single();

    const { data, error } = await query;

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({
        attempt_id: data.id,
        current_step: data.current_step,
        completed_steps: data.completed_steps,
        survey_data: data.survey_data,
    }));
});

// PUT /onboarding/:attemptId/step/:step — Submit step data
router.put('/:attemptId/step/:step', async (c) => {
    const auth = c.get('auth');
    const attemptId = c.req.param('attemptId');
    const stepNum = parseInt(c.req.param('step'));
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (stepNum < 1 || stepNum > 6) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Step must be 1-6' } }, 400);
    }

    // Validate step data with corresponding schema
    const schema = STEP_SCHEMAS[stepNum];
    const rawBody = await c.req.json();
    const result = schema.safeParse(rawBody);

    if (!result.success) {
        return c.json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid step data',
                details: result.error.issues.map((i: any) => ({ field: i.path.join('.'), message: i.message })),
            },
        }, 400);
    }

    // Verify attempt ownership
    const { data: attempt } = await db
        .from('onboarding_attempts')
        .select('*')
        .eq('id', attemptId)
        .eq('user_id', customUser.id)
        .eq('status', 'in_progress')
        .single();

    if (!attempt) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Onboarding attempt not found' } }, 404);
    }

    // Save step data
    const stepData = result.data as Record<string, unknown>;
    const updatedSteps = [...(attempt.completed_steps || [])];
    if (!updatedSteps.includes(stepNum)) updatedSteps.push(stepNum);

    const updates: Record<string, unknown> = {
        current_step: Math.min(stepNum + 1, 6),
        completed_steps: updatedSteps,
        last_activity_at: new Date().toISOString(),
    };

    // Merge step-specific fields into the attempt
    if (stepNum === 1) {
        const nextSiteType = String(stepData.site_type || '');
        if (isComingSoonSiteType(nextSiteType)) {
            return c.json(comingSoonSiteTypeCreationResponse(nextSiteType), 403);
        }
        if (isLegacySiteType(nextSiteType) && !legacySiteTypeCreationAllowed(c.env)) {
            return c.json(legacySiteTypeCreationResponse(nextSiteType), 403);
        }
        updates.site_type = nextSiteType;
    }
    if (stepNum === 2) {
        updates.store_name = stepData.store_name;
        updates.subdomain = stepData.subdomain;
    }
    if (stepNum === 3) updates.template_id = stepData.template_id;
    if (stepNum === 4) updates.survey_data = stepData;

    await db.from('onboarding_attempts').update(updates).eq('id', attemptId);

    // Track step progress
    await db.from('onboarding_progress').upsert({
        attempt_id: attemptId,
        step_number: stepNum,
        step_name: ['choose_type', 'name_store', 'pick_template', 'survey', 'customize', 'launch'][stepNum - 1],
        completed_at: new Date().toISOString(),
        step_data: stepData,
    }, { onConflict: 'attempt_id,step_number' });

    return c.json(success({
        step: stepNum,
        status: 'completed',
        next_step: stepNum < 6 ? stepNum + 1 : null,
        progress_pct: Math.round((updatedSteps.length / 6) * 100),
    }));
});

// POST /onboarding/:attemptId/complete — Finalize onboarding & create store
router.post('/:attemptId/complete', async (c) => {
    const auth = c.get('auth');
    const attemptId = c.req.param('attemptId');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: attempt } = await db
        .from('onboarding_attempts')
        .select('*')
        .eq('id', attemptId)
        .eq('user_id', customUser.id)
        .eq('status', 'in_progress')
        .single();

    if (!attempt) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Attempt not found' } }, 404);
    }

    const attemptSiteType = String(attempt.site_type || 'store');
    if (isComingSoonSiteType(attemptSiteType)) {
        return c.json(comingSoonSiteTypeCreationResponse(attemptSiteType), 403);
    }
    if (isLegacySiteType(attemptSiteType) && !legacySiteTypeCreationAllowed(c.env)) {
        return c.json(legacySiteTypeCreationResponse(attemptSiteType), 403);
    }

    // Create the store
    const { data: store, error: storeError } = await db
        .from('sites')
        .insert({
            user_id: customUser.id,
            custom_user_id: customUser.id,
            store_name: attempt.store_name || 'My Store',
            subdomain: attempt.subdomain || `store-${Date.now()}`,
            site_type: attemptSiteType,
            status: 'draft',
            trial_status: 'active',
            trial_started_at: new Date().toISOString(),
            trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

    if (storeError) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: storeError.message } }, 500);
    }

    await emitStoreCreatedEvent(db, {
        store,
        ownerUserId: customUser.id,
        requestId: getRequestId(c),
    });

    // Save survey data if present
    if (attempt.survey_data && Object.keys(attempt.survey_data).length > 0) {
        await db.from('store_surveys').insert({
            store_id: store.id,
            ...attempt.survey_data,
        });
    }

    // Mark attempt as completed
    await db.from('onboarding_attempts').update({
        status: 'completed',
        store_id: store.id,
        completed_at: new Date().toISOString(),
    }).eq('id', attemptId);

    // Mark user profile onboarding as completed
    await db.from('user_profiles').update({
        onboarding_completed: true,
    }).eq('id', customUser.id);

    return c.json(success({
        store,
        urls: {
            admin: adminUrl(c.env, `/stores/${store.id}`),
            storefront: storefrontUrl(c.env, store.subdomain),
        },
    }), 201);
});

// POST /onboarding/check-subdomain — Check subdomain availability
router.post('/check-subdomain', validate('json', CheckSubdomainSchema), async (c) => {
    const body = c.get('validatedBody') as { subdomain: string };
    const db = getSupabaseAdmin(c);

    const { data: existing } = await db
        .from('sites')
        .select('id')
        .eq('subdomain', body.subdomain)
        .limit(1);

    return c.json(success({
        subdomain: body.subdomain,
        available: !existing || existing.length === 0,
    }));
});

// GET /onboarding/templates — List available templates
router.get('/templates', async (c) => {
    const siteType = c.req.query('site_type') || 'store';
    const db = getSupabaseAdmin(c);

    if (isComingSoonSiteType(siteType) || (isLegacySiteType(siteType) && !legacySiteTypeCreationAllowed(c.env))) {
        return c.json(success([]));
    }

    const { data, error } = await db
        .from('themes')
        .select('id, name, slug, site_type, category, preview_url, thumbnail_url, is_premium, price')
        .eq('site_type', siteType)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

export default router;
