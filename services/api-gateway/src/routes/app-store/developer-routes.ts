import type { Hono } from 'hono';
import type { Env } from '../../index';
import { resolveCustomUser } from '../../lib/auth-user';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import { requireRoleCategory } from '../../middleware/rbac';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import {
    buildMarketplaceAutomatedChecks,
    createMarketplaceReviewRecord,
    type MarketplaceReviewRecord,
} from '../../lib/marketplace-review-records';
import {
    LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
    LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
    createAppExtensionDeveloperHandoff,
    createAppExtensionReviewChecklist,
    appStoreStringOrNull as stringOrNull,
    parseAppStoreJsonRecord as parseJsonRecord,
    planAppDeveloperRegistration,
    planAppManifestRegistration,
    buildMarketplaceAppSubmissionChecks,
    planMarketplaceAppSubmission,
    type AppEngineJsonRecord,
    type AppManifestRegistrationPlan,
} from '@letbuyy/shared-types';
import { sha256Hex } from '@letbuyy/auth-core';
import {
    appBillingModeForPricingModel,
} from '@letbuyy/billing-core';
import {
    AppPricingPlanInputSchema,
    AppPricingPlanUpdateSchema,
    type AppPricingPlanInput,
    type AppPricingPlanUpdate,
} from '@letbuyy/shared-types';
import {
    getRequestId,
    partnerStoreFromMembership,
    partnerStoreFromOwnedSite,
    sumMinor,
} from './shared';

const DEVELOPER_CREDENTIAL_TARGET = '/v1/app';
const DEVELOPER_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~-';
const APP_PRICING_PLAN_SELECT = [
    'id',
    'app_id',
    'developer_id',
    'plan_slug',
    'name',
    'description',
    'pricing_model',
    'billing_mode',
    'currency',
    'amount_minor',
    'interval',
    'trial_days',
    'usage_meter',
    'usage_unit',
    'included_usage',
    'usage_unit_amount_minor',
    'features',
    'limits',
    'is_default',
    'status',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
].join(', ');

const APP_VERSION_SELECT = [
    'id',
    'app_id',
    'developer_id',
    'version',
    'release_notes',
    'changelog',
    'rollout_percentage',
    'rollout_cohort',
    'status',
    'manifest',
    'automated_checks',
    'review_record_id',
    'submitted_at',
    'released_at',
    'created_at',
    'updated_at',
    'deleted_at',
].join(', ');

function randomDeveloperCredential(prefix: string, length = 64): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let token = '';
    for (const byte of bytes) token += DEVELOPER_KEY_ALPHABET[byte % DEVELOPER_KEY_ALPHABET.length];
    return `${prefix}_${token}`;
}

function developerManifestInput(body: AppEngineJsonRecord): unknown | null {
    const config = parseJsonRecord(body.config);
    return body.manifest
        || body.app_manifest
        || body.appManifest
        || config.manifest
        || config.app_manifest
        || config.appManifest
        || null;
}

function normalizeDeveloperRedirectUris(value: unknown): string[] {
    const raw = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
    const uris = raw
        .map((item) => stringOrNull(item))
        .filter((item): item is string => Boolean(item))
        .map((item) => {
            try {
                const url = new URL(item);
                return url.protocol === 'https:' ? url.toString() : null;
            } catch {
                return null;
            }
        })
        .filter((item): item is string => Boolean(item));
    return [...new Set(uris)].slice(0, 20);
}

function amountMajorToMinor(value: unknown): number {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

function planSlug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120) || 'plan';
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function appPricingPlanRow(input: {
    appId: string;
    developerId: string;
    actorId: string;
    plan: AppPricingPlanInput | AppPricingPlanUpdate;
}): AppEngineJsonRecord {
    const pricingModel = typeof input.plan.pricing_model === 'string' ? input.plan.pricing_model : 'free';
    const billingMode = input.plan.billing_mode || appBillingModeForPricingModel(pricingModel);
    return {
        app_id: input.appId,
        developer_id: input.developerId,
        ...(input.plan.plan_slug !== undefined ? { plan_slug: planSlug(input.plan.plan_slug) } : {}),
        ...(input.plan.name !== undefined ? { name: input.plan.name } : {}),
        ...(input.plan.description !== undefined ? { description: input.plan.description || null } : {}),
        ...(input.plan.pricing_model !== undefined ? { pricing_model: pricingModel } : {}),
        ...(input.plan.billing_mode !== undefined || input.plan.pricing_model !== undefined ? { billing_mode: billingMode } : {}),
        ...(input.plan.currency !== undefined ? { currency: 'INR' } : {}),
        ...(input.plan.amount_minor !== undefined ? { amount_minor: Math.max(0, Math.round(Number(input.plan.amount_minor) || 0)) } : {}),
        ...(input.plan.interval !== undefined ? { interval: input.plan.interval } : {}),
        ...(input.plan.trial_days !== undefined ? { trial_days: Math.max(0, Math.min(365, Math.round(Number(input.plan.trial_days) || 0))) } : {}),
        ...(input.plan.usage_meter !== undefined ? { usage_meter: input.plan.usage_meter || null } : {}),
        ...(input.plan.usage_unit !== undefined ? { usage_unit: input.plan.usage_unit || null } : {}),
        ...(input.plan.included_usage !== undefined ? { included_usage: Math.max(0, Math.round(Number(input.plan.included_usage) || 0)) } : {}),
        ...(input.plan.usage_unit_amount_minor !== undefined ? { usage_unit_amount_minor: Math.max(0, Math.round(Number(input.plan.usage_unit_amount_minor) || 0)) } : {}),
        ...(input.plan.features !== undefined ? { features: input.plan.features } : {}),
        ...(input.plan.limits !== undefined ? { limits: input.plan.limits } : {}),
        ...(input.plan.is_default !== undefined ? { is_default: input.plan.is_default } : {}),
        ...(input.plan.status !== undefined ? { status: input.plan.status } : {}),
        ...(input.plan.sort_order !== undefined ? { sort_order: input.plan.sort_order } : {}),
        updated_by: input.actorId,
    };
}

function submittedPricingPlans(body: AppEngineJsonRecord, pricingModel: string): { ok: true; plans: AppPricingPlanInput[] } | { ok: false; message: string } {
    const rawPlans = Array.isArray(body.pricing_plans) ? body.pricing_plans : [];
    if (rawPlans.length > 0) {
        const plans: AppPricingPlanInput[] = [];
        for (const rawPlan of rawPlans.slice(0, 12)) {
            const parsed = AppPricingPlanInputSchema.safeParse(rawPlan);
            if (!parsed.success) {
                return { ok: false, message: parsed.error.issues[0]?.message || 'Invalid pricing plan' };
            }
            plans.push(parsed.data);
        }
        return { ok: true, plans };
    }

    if (pricingModel === 'free') {
        return {
            ok: true,
            plans: [AppPricingPlanInputSchema.parse({
                plan_slug: 'free',
                name: 'Free',
                pricing_model: 'free',
                amount_minor: 0,
                interval: 'none',
                is_default: true,
                status: 'active',
            })],
        };
    }

    const monthlyMinor = amountMajorToMinor(body.price_monthly);
    const yearlyMinor = amountMajorToMinor(body.price_yearly);
    const trialDays = Math.max(0, Math.min(365, Math.round(Number(body.trial_days) || 0)));
    const fallbackMinor = monthlyMinor || yearlyMinor || amountMajorToMinor(body.price_inr);
    if (!fallbackMinor && pricingModel !== 'freemium') return { ok: true, plans: [] };

    if (pricingModel === 'one_time') {
        return {
            ok: true,
            plans: [AppPricingPlanInputSchema.parse({
                plan_slug: 'one-time',
                name: 'One-time',
                pricing_model: 'one_time',
                billing_mode: 'one_time',
                amount_minor: fallbackMinor,
                interval: 'none',
                trial_days: 0,
                is_default: true,
                status: 'active',
            })],
        };
    }

    if (pricingModel === 'usage') {
        return {
            ok: true,
            plans: [AppPricingPlanInputSchema.parse({
                plan_slug: 'usage',
                name: 'Usage',
                pricing_model: 'usage',
                billing_mode: 'usage',
                amount_minor: fallbackMinor,
                interval: 'monthly',
                trial_days: trialDays,
                usage_meter: 'usage_events',
                usage_unit: 'event',
                usage_unit_amount_minor: fallbackMinor,
                is_default: true,
                status: 'active',
            })],
        };
    }

    const plans: AppPricingPlanInput[] = [];
    if (monthlyMinor) {
        plans.push(AppPricingPlanInputSchema.parse({
            plan_slug: 'monthly',
            name: 'Monthly',
            pricing_model: pricingModel === 'freemium' ? 'freemium' : 'recurring',
            billing_mode: 'recurring',
            amount_minor: monthlyMinor,
            interval: 'monthly',
            trial_days: trialDays,
            is_default: true,
            status: 'active',
        }));
    }
    if (yearlyMinor) {
        plans.push(AppPricingPlanInputSchema.parse({
            plan_slug: 'annual',
            name: 'Annual',
            pricing_model: pricingModel === 'freemium' ? 'freemium' : 'recurring',
            billing_mode: 'recurring',
            amount_minor: yearlyMinor,
            interval: 'yearly',
            trial_days: trialDays,
            is_default: plans.length === 0,
            status: 'active',
            sort_order: 10,
        }));
    }
    return { ok: true, plans };
}

async function mintDeveloperAppCredentials(input: {
    scopes: string[];
    issuedAt: string;
}): Promise<{
    oauthClientId: string;
    clientSecret: string;
    apiKey: string;
    apiKeyPrefix: string;
    persistedConfig: AppEngineJsonRecord;
}> {
    const oauthClientId = `lb_app_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const clientSecret = randomDeveloperCredential('lb_client_secret', 72);
    const apiKey = randomDeveloperCredential('lb_app_key', 72);
    const apiKeyPrefix = apiKey.slice(0, 18);

    return {
        oauthClientId,
        clientSecret,
        apiKey,
        apiKeyPrefix,
        persistedConfig: {
            credential_kind: 'developer_api_credentials',
            oauth_client_id: oauthClientId,
            client_secret_hash: await sha256Hex(clientSecret),
            api_key_hash: await sha256Hex(apiKey),
            api_key_prefix: apiKeyPrefix,
            scopes: input.scopes,
            issued_at: input.issuedAt,
            plaintext_persisted: false,
        },
    };
}

async function persistDeveloperAppCredentials(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        appId: string;
        credentialConfig: AppEngineJsonRecord;
    },
): Promise<{ ok: true } | { ok: false; message: string }> {
    const { data: existing, error: existingError } = await db
        .from('app_extensions')
        .select('id')
        .eq('app_id', input.appId)
        .eq('type', 'api_endpoint')
        .eq('target', DEVELOPER_CREDENTIAL_TARGET)
        .limit(1)
        .maybeSingle();

    if (existingError) return { ok: false, message: existingError.message };

    if (existing?.id) {
        const { error } = await db
            .from('app_extensions')
            .update({
                label: 'App API credentials',
                config: input.credentialConfig,
            })
            .eq('id', existing.id);
        return error ? { ok: false, message: error.message } : { ok: true };
    }

    const { error } = await db
        .from('app_extensions')
        .insert({
            app_id: input.appId,
            type: 'api_endpoint',
            target: DEVELOPER_CREDENTIAL_TARGET,
            label: 'App API credentials',
            sort_order: -100,
            config: input.credentialConfig,
        });

    return error ? { ok: false, message: error.message } : { ok: true };
}

async function persistSubmittedAppManifest(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        appId: string;
        plan: AppManifestRegistrationPlan;
    },
): Promise<{ ok: true; extensionRows: AppEngineJsonRecord[]; functionRows: AppEngineJsonRecord[] } | { ok: false; message: string }> {
    const extensionRows = input.plan.extensionRecords.map((record) => ({
        ...record,
        app_id: input.appId,
    }));
    const functionRows = input.plan.functionRecords.map((record, index) => ({
        app_id: input.appId,
        type: 'api_endpoint',
        target: `app-function:${record.handle}`,
        label: record.name,
        sort_order: 1000 + index,
        config: {
            manifest_schema_version: input.plan.manifest.schema_version,
            manifest_app_slug: input.plan.manifest.app.slug,
            manifest_app_version: input.plan.manifest.app.version,
            function_handle: record.handle,
            hooks: record.hooks,
            runtime: 'wasm',
            wasm_module_url: record.wasm_module_url,
            wasm_sha256: record.wasm_sha256,
            timeout_ms: record.timeout_ms,
            memory_limit_kb: record.memory_limit_kb,
            input_schema: record.config.input_schema,
            output_schema: record.config.output_schema,
        },
    }));
    const rows = [...extensionRows, ...functionRows];

    if (rows.length === 0) {
        return { ok: true, extensionRows: [], functionRows: [] };
    }

    const { data, error } = await db
        .from('app_extensions')
        .insert(rows)
        .select();

    if (error) return { ok: false, message: error.message };

    const inserted = Array.isArray(data) ? data as AppEngineJsonRecord[] : [];
    return {
        ok: true,
        extensionRows: inserted.filter((row) => stringOrNull(row.target)?.startsWith('app-function:') !== true),
        functionRows: inserted.filter((row) => stringOrNull(row.target)?.startsWith('app-function:') === true),
    };
}

export function registerAppStoreDeveloperRoutes(router: Hono<{ Bindings: Env }>): void {
    // GET /app-store/developers/me — Get current user's developer profile
    router.get('/developers/me', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error } = await db
            .from('app_developers')
            .select('*')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        return c.json(success({ developer: developer || null }));
    });

    // POST /app-store/developers/register — Register current user as an app developer
    router.post('/developers/register', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const body = await c.req.json() as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const registration = planAppDeveloperRegistration(body, customUser.id);
        if (!registration.ok) {
            return c.json({ error: { code: 'VALIDATION', message: registration.message } }, 400);
        }

        const { data: developer, error } = await db
            .from('app_developers')
            .insert(registration.value)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return c.json({ error: { code: 'CONFLICT', message: 'Developer profile already exists for this account or company' } }, 409);
            }
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        return c.json(success({ developer }), 201);
    });

    // POST /app-store/developers/apps/manifest/validate — Validate an app manifest without creating a marketplace listing
    router.post('/developers/apps/manifest/validate', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const body = await c.req.json() as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
        }

        const manifestInput = developerManifestInput(body) || body;
        const plan = planAppManifestRegistration('manifest_validation_preview', manifestInput);
        if (!plan.ok) {
            return c.json({ error: { code: 'VALIDATION', message: plan.message } }, 400);
        }

        return c.json(success({
            valid: true,
            schema_version: LETBUYY_APP_MANIFEST_SCHEMA_VERSION,
            manifest: plan.value.manifest,
            extension_records: plan.value.extensionRecords,
            function_records: plan.value.functionRecords,
            counts: {
                extensions: plan.value.extensionRecords.length,
                functions: plan.value.functionRecords.length,
            },
        }));
    });

    // GET /app-store/developers/apps — List current developer profile and submitted apps
    router.get('/developers/apps', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id, company_name, status, verified')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
        }

        const { data: apps, error: appsError } = await db
            .from('marketplace_apps')
            .select('id, name, slug, tagline, icon_url, status, install_count, rating_avg, review_count, pricing_model, price_inr, created_at')
            .eq('developer_id', developer.id)
            .order('created_at', { ascending: false });

        if (appsError) {
            return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
        }

        const appRows = (apps || []) as unknown as AppEngineJsonRecord[];
        const appIds = appRows.map((app) => stringOrNull(app.id)).filter((id): id is string => Boolean(id));
        const { data: pricingPlans, error: pricingPlanError } = appIds.length > 0
            ? await db
                .from('app_pricing_plans')
                .select(APP_PRICING_PLAN_SELECT)
                .in('app_id', appIds)
                .eq('developer_id', developer.id)
                .is('deleted_at', null)
                .order('sort_order', { ascending: true })
            : { data: [], error: null };

        if (pricingPlanError) {
            return c.json({ error: { code: 'DB_ERROR', message: pricingPlanError.message } }, 500);
        }

        const { data: appVersions, error: appVersionsError } = appIds.length > 0
            ? await db
                .from('app_versions')
                .select(APP_VERSION_SELECT)
                .in('app_id', appIds)
                .eq('developer_id', developer.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
            : { data: [], error: null };

        if (appVersionsError) {
            return c.json({ error: { code: 'DB_ERROR', message: appVersionsError.message } }, 500);
        }

        const { data: reviewRecords, error: reviewError } = await db
            .from('marketplace_review_records')
            .select([
                'id',
                'submission_type',
                'resource_id',
                'resource_slug',
                'resource_name',
                'partner_user_id',
                'app_developer_id',
                'status',
                'automated_checks',
                'submitted_at',
                'reviewed_by',
                'reviewed_at',
                'review_notes',
                'metadata',
                'created_at',
                'updated_at',
                'deleted_at',
            ].join(', '))
            .eq('app_developer_id', developer.id)
            .order('submitted_at', { ascending: false });

        if (reviewError) {
            return c.json({ error: { code: 'DB_ERROR', message: reviewError.message } }, 500);
        }

        return c.json(success({ developer, apps: apps || [], app_versions: appVersions || [], pricing_plans: pricingPlans || [], review_records: reviewRecords || [] }));
    });

    // GET /app-store/developers/apps/:id/pricing-plans — List pricing plans for an owned app
    router.get('/developers/apps/:id/pricing-plans', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const appId = c.req.param('id');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
        }

        const { data: app, error: appError } = await db
            .from('marketplace_apps')
            .select('id, name, slug, pricing_model')
            .eq('id', appId)
            .eq('developer_id', developer.id)
            .maybeSingle();

        if (appError) {
            return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
        }

        if (!app) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App not found for this developer' } }, 404);
        }

        const { data: plans, error: plansError } = await db
            .from('app_pricing_plans')
            .select(APP_PRICING_PLAN_SELECT)
            .eq('app_id', appId)
            .eq('developer_id', developer.id)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (plansError) {
            return c.json({ error: { code: 'DB_ERROR', message: plansError.message } }, 500);
        }

        return c.json(success({ app, plans: plans || [] }));
    });

    // GET /app-store/developers/apps/:id/usage — Usage rollups and recent metered events for an owned app
    router.get('/developers/apps/:id/usage', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const appId = c.req.param('id');
        const rawLimit = Number(c.req.query('limit') || 25);
        const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.round(rawLimit))) : 25;
        const meterName = stringOrNull(c.req.query('meter_name'));
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
        }

        const { data: app, error: appError } = await db
            .from('marketplace_apps')
            .select('id, name, slug, pricing_model')
            .eq('id', appId)
            .eq('developer_id', developer.id)
            .maybeSingle();

        if (appError) {
            return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
        }

        if (!app) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App not found for this developer' } }, 404);
        }

        let rollupsQuery = db
            .from('app_usage_meter_rollups')
            .select('*')
            .eq('app_id', appId)
            .is('deleted_at', null)
            .order('period_start', { ascending: false })
            .limit(limit);
        let eventsQuery = db
            .from('app_usage_events')
            .select('*')
            .eq('app_id', appId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (meterName) {
            rollupsQuery = rollupsQuery.eq('meter_name', meterName);
            eventsQuery = eventsQuery.eq('meter_name', meterName);
        }

        const [{ data: rollups, error: rollupsError }, { data: events, error: eventsError }] = await Promise.all([
            rollupsQuery,
            eventsQuery,
        ]);

        if (rollupsError || eventsError) {
            return c.json({ error: { code: 'DB_ERROR', message: rollupsError?.message || eventsError?.message || 'Usage query failed' } }, 500);
        }

        return c.json(success({ app_id: appId, app, rollups: rollups || [], events: events || [] }));
    });

    // POST /app-store/developers/apps/:id/pricing-plans — Create a pricing plan for an owned app
    router.post('/developers/apps/:id/pricing-plans', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const appId = c.req.param('id');
        const body = await c.req.json();
        const input = AppPricingPlanInputSchema.safeParse(body);
        if (!input.success) {
            return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid pricing plan' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
        }

        const { data: app, error: appError } = await db
            .from('marketplace_apps')
            .select('id')
            .eq('id', appId)
            .eq('developer_id', developer.id)
            .maybeSingle();

        if (appError) {
            return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
        }

        if (!app) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App not found for this developer' } }, 404);
        }

        if (input.data.is_default) {
            await db
                .from('app_pricing_plans')
                .update({ is_default: false, updated_by: customUser.id })
                .eq('app_id', appId)
                .eq('developer_id', developer.id)
                .is('deleted_at', null);
        }

        const { data: plan, error: insertError } = await db
            .from('app_pricing_plans')
            .insert({
                ...appPricingPlanRow({ appId, developerId: developer.id, actorId: customUser.id, plan: input.data }),
                created_by: customUser.id,
            })
            .select(APP_PRICING_PLAN_SELECT)
            .single();

        if (insertError) {
            return c.json({ error: { code: 'DB_ERROR', message: insertError.message } }, 500);
        }

        return c.json(success(plan), 201);
    });

    // PATCH /app-store/developers/apps/:id/pricing-plans/:planId — Update a pricing plan for an owned app
    router.patch('/developers/apps/:id/pricing-plans/:planId', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const appId = c.req.param('id');
        const planId = c.req.param('planId');
        const body = await c.req.json();
        const input = AppPricingPlanUpdateSchema.safeParse(body);
        if (!input.success) {
            return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid pricing plan' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
        }

        if (input.data.is_default) {
            await db
                .from('app_pricing_plans')
                .update({ is_default: false, updated_by: customUser.id })
                .eq('app_id', appId)
                .eq('developer_id', developer.id)
                .is('deleted_at', null);
        }

        const { data: plan, error: updateError } = await db
            .from('app_pricing_plans')
            .update(appPricingPlanRow({ appId, developerId: developer.id, actorId: customUser.id, plan: input.data }))
            .eq('id', planId)
            .eq('app_id', appId)
            .eq('developer_id', developer.id)
            .is('deleted_at', null)
            .select(APP_PRICING_PLAN_SELECT)
            .maybeSingle();

        if (updateError) {
            return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
        }

        if (!plan) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Pricing plan not found for this app' } }, 404);
        }

        return c.json(success(plan));
    });

    // DELETE /app-store/developers/apps/:id/pricing-plans/:planId — Archive a pricing plan for an owned app
    router.delete('/developers/apps/:id/pricing-plans/:planId', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const appId = c.req.param('id');
        const planId = c.req.param('planId');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
        }

        const { data: plan, error: updateError } = await db
            .from('app_pricing_plans')
            .update({
                status: 'archived',
                deleted_at: new Date().toISOString(),
                is_default: false,
                updated_by: customUser.id,
            })
            .eq('id', planId)
            .eq('app_id', appId)
            .eq('developer_id', developer.id)
            .is('deleted_at', null)
            .select(APP_PRICING_PLAN_SELECT)
            .maybeSingle();

        if (updateError) {
            return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
        }

        if (!plan) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Pricing plan not found for this app' } }, 404);
        }

        return c.json(success(plan));
    });

    // GET /app-store/partners/dashboard — Partner console aggregate over listings, payouts, stores, and analytics
    router.get('/partners/dashboard', authMiddleware, requireRoleCategory('partner'), async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id, user_id, company_name, slug, website_url, support_email, logo_url, description, verified, status, created_at, updated_at')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
        }

        const developerId = stringOrNull(developer.id) || '';
        const { data: apps, error: appsError } = await db
            .from('marketplace_apps')
            .select('id, name, slug, tagline, icon_url, status, install_count, rating_avg, review_count, pricing_model, price_inr, supported_site_types, created_at, updated_at')
            .eq('developer_id', developerId)
            .order('created_at', { ascending: false });

        if (appsError) {
            return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
        }

        const appRows = (apps || []) as unknown as AppEngineJsonRecord[];
        const appIds = appRows.map((app) => stringOrNull(app.id)).filter((id): id is string => Boolean(id));

        const { data: pricingPlans, error: pricingPlanError } = appIds.length > 0
            ? await db
                .from('app_pricing_plans')
                .select(APP_PRICING_PLAN_SELECT)
                .in('app_id', appIds)
                .eq('developer_id', developerId)
                .is('deleted_at', null)
                .order('sort_order', { ascending: true })
            : { data: [], error: null };

        if (pricingPlanError) {
            return c.json({ error: { code: 'DB_ERROR', message: pricingPlanError.message } }, 500);
        }

        const { data: appVersions, error: appVersionsError } = appIds.length > 0
            ? await db
                .from('app_versions')
                .select(APP_VERSION_SELECT)
                .in('app_id', appIds)
                .eq('developer_id', developerId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
            : { data: [], error: null };

        if (appVersionsError) {
            return c.json({ error: { code: 'DB_ERROR', message: appVersionsError.message } }, 500);
        }

        const { data: reviewRecords, error: reviewError } = await db
            .from('marketplace_review_records')
            .select([
                'id',
                'submission_type',
                'resource_id',
                'resource_slug',
                'resource_name',
                'partner_user_id',
                'app_developer_id',
                'status',
                'automated_checks',
                'submitted_at',
                'reviewed_by',
                'reviewed_at',
                'review_notes',
                'metadata',
                'created_at',
                'updated_at',
                'deleted_at',
            ].join(', '))
            .or(`app_developer_id.eq.${developerId},partner_user_id.eq.${customUser.id}`)
            .order('submitted_at', { ascending: false })
            .limit(25);

        if (reviewError) {
            return c.json({ error: { code: 'DB_ERROR', message: reviewError.message } }, 500);
        }

        const { data: charges, error: chargesError } = await db
            .from('app_billing_charges')
            .select('id, site_id, app_id, partner_id, installation_id, pricing_plan_id, billing_mode, status, name, amount_minor, currency, trial_days, trial_starts_at, trial_ends_at, billing_starts_at, revenue_share_bps, partner_amount_minor, platform_fee_minor, partner_gst_bps, partner_gst_minor, payout_rail, provider, provider_mode, approved_at, activated_at, idempotency_key, metadata, created_at, updated_at')
            .eq('partner_id', developerId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(25);

        if (chargesError) {
            return c.json({ error: { code: 'DB_ERROR', message: chargesError.message } }, 500);
        }

        const { data: payouts, error: payoutsError } = await db
            .from('partner_payout_ledger_entries')
            .select('id, partner_id, site_id, app_id, installation_id, charge_id, billing_mode, amount_minor, currency, revenue_share_bps, partner_amount_minor, platform_fee_minor, status, rail, metadata, created_at, updated_at')
            .eq('partner_id', developerId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(25);

        if (payoutsError) {
            return c.json({ error: { code: 'DB_ERROR', message: payoutsError.message } }, 500);
        }

        const { data: installations, error: installationsError } = appIds.length > 0
            ? await db
                .from('app_installations')
                .select('id, app_id, store_id, status, scopes_granted, installed_at, uninstalled_at')
                .in('app_id', appIds)
            : { data: [], error: null };

        if (installationsError) {
            return c.json({ error: { code: 'DB_ERROR', message: installationsError.message } }, 500);
        }

        const { data: memberships, error: membershipsError } = await db
            .from('site_memberships')
            .select('id, site_id, status, role_slugs, permissions, created_at, sites(id, name, store_name, subdomain, site_type, status, created_at)')
            .eq('custom_user_id', customUser.id)
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(25);

        if (membershipsError) {
            return c.json({ error: { code: 'DB_ERROR', message: membershipsError.message } }, 500);
        }

        const { data: ownedSites, error: ownedSitesError } = await db
            .from('sites')
            .select('id, name, store_name, subdomain, site_type, status, created_at')
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (ownedSitesError) {
            return c.json({ error: { code: 'DB_ERROR', message: ownedSitesError.message } }, 500);
        }

        const chargeRows = (charges || []) as unknown as AppEngineJsonRecord[];
        const payoutRows = (payouts || []) as unknown as AppEngineJsonRecord[];
        const installationRows = (installations || []) as unknown as AppEngineJsonRecord[];
        const membershipStores = ((memberships || []) as unknown as AppEngineJsonRecord[])
            .map(partnerStoreFromMembership)
            .filter((store) => stringOrNull(store.id));
        const ownedDevelopmentStores = ((ownedSites || []) as unknown as AppEngineJsonRecord[])
            .map(partnerStoreFromOwnedSite)
            .filter((store) => stringOrNull(store.id));
        const developmentStoresById = new Map<string, AppEngineJsonRecord>();

        [...membershipStores, ...ownedDevelopmentStores].forEach((store) => {
            const id = stringOrNull(store.id);
            if (id && !developmentStoresById.has(id)) developmentStoresById.set(id, store);
        });

        const { data: activeCode } = await db
            .from('app_collaborator_codes')
            .select('code_prefix, expires_at, scopes')
            .eq('developer_id', developerId)
            .eq('status', 'active')
            .gt('expires_at', new Date().toISOString())
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const collaboratorAccess = {
            request_code: stringOrNull(activeCode?.code_prefix) ? `${activeCode?.code_prefix}...` : 'NO_ACTIVE_CODE',
            expires_at: stringOrNull(activeCode?.expires_at) || new Date().toISOString(),
            has_active_code: Boolean(activeCode),
            scopes: ['read_products', 'write_themes', 'read_orders', 'app_collaboration'],
            managed_stores: membershipStores.filter((store) => store.managed === true),
        };

        const analytics = {
            total_apps: appRows.length,
            published_apps: appRows.filter((app) => app.status === 'published').length,
            active_installations: installationRows.filter((installation) => installation.status === 'active').length,
            uninstalls: installationRows.filter((installation) => installation.status === 'uninstalled').length,
            charges: chargeRows.length,
            gross_amount_minor: sumMinor(chargeRows, 'amount_minor'),
            partner_earnings_minor: sumMinor(payoutRows, 'partner_amount_minor'),
            partner_gst_minor: sumMinor(chargeRows, 'partner_gst_minor'),
            payout_pending_minor: sumMinor(payoutRows.filter((row) => ['pending', 'processing'].includes(String(row.status))), 'partner_amount_minor'),
            payout_released_minor: sumMinor(payoutRows.filter((row) => row.status === 'released'), 'partner_amount_minor'),
            currency: 'INR',
        };

        return c.json(success({
            developer,
            apps: appRows,
            app_versions: appVersions || [],
            pricing_plans: pricingPlans || [],
            review_records: reviewRecords || [],
            charges: chargeRows,
            payouts: payoutRows,
            development_stores: Array.from(developmentStoresById.values()),
            collaborator_access: collaboratorAccess,
            analytics,
        }));
    });

    // POST /app-store/developers/apps — Submit a new marketplace app for review
    router.post('/developers/apps', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const body = await c.req.json() as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        const issuedAt = new Date().toISOString();

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer } = await db
            .from('app_developers')
            .select('id, status')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (!developer) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
        }

        if (developer.status !== 'approved' && body.save_as_draft !== true) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Developer approval is required before submitting apps for review' } }, 403);
        }

        const submission = planMarketplaceAppSubmission(body, developer.id);
        if (!submission.ok) {
            return c.json({ error: { code: 'VALIDATION', message: submission.message } }, 400);
        }

        const pricingPlans = submittedPricingPlans(body, String(submission.value.pricing_model || 'free'));
        if (!pricingPlans.ok) {
            return c.json({ error: { code: 'VALIDATION', message: pricingPlans.message } }, 400);
        }

        const manifestInput = developerManifestInput(body);
        const manifestPlan = manifestInput ? planAppManifestRegistration('pending_app_id', manifestInput) : null;
        if (manifestPlan && !manifestPlan.ok) {
            return c.json({ error: { code: 'VALIDATION', message: manifestPlan.message } }, 400);
        }
        const redirectUris = normalizeDeveloperRedirectUris(body.oauth_redirect_uris || body.redirect_uris || body.redirectUris);
        const submissionChecks = submission.value.status === 'draft'
            ? null
            : buildMarketplaceAppSubmissionChecks({
                submission: submission.value,
                manifest: manifestPlan?.ok ? manifestPlan.value.manifest : null,
                redirectUris,
                developerStatus: stringOrNull(developer.status),
            });
        if (submissionChecks?.hardFailed) {
            const failed = submissionChecks.checks
                .filter((check) => check.status === 'failed')
                .map((check) => `${check.name}: ${check.message}`)
                .join('; ');
            return c.json({ error: { code: 'VALIDATION', message: failed || 'Submission checks failed' } }, 400);
        }

        const { data: existingSlug } = await db
            .from('marketplace_apps')
            .select('id')
            .eq('slug', submission.value.slug)
            .maybeSingle();

        if (existingSlug) {
            return c.json({ error: { code: 'CONFLICT', message: 'This app slug is already taken' } }, 409);
        }

        const credentials = await mintDeveloperAppCredentials({
            scopes: submission.value.api_scopes || [],
            issuedAt,
        });
        const { data: app, error } = await db
            .from('marketplace_apps')
            .insert({
                ...submission.value,
                oauth_client_id: credentials.oauthClientId,
                oauth_redirect_uris: redirectUris,
            })
            .select('id, name, status, slug, oauth_client_id, oauth_redirect_uris, api_scopes, version')
            .single();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        const credentialPersistence = await persistDeveloperAppCredentials(db, {
            appId: app.id,
            credentialConfig: credentials.persistedConfig,
        });

        if (!credentialPersistence.ok) {
            return c.json({ error: { code: 'DB_ERROR', message: credentialPersistence.message } }, 500);
        }

        let insertedPricingPlans: AppEngineJsonRecord[] = [];
        if (pricingPlans.plans.length > 0) {
            const defaultIndex = Math.max(0, pricingPlans.plans.findIndex((plan) => plan.is_default));
            const rows = pricingPlans.plans.map((plan, index) => ({
                ...appPricingPlanRow({ appId: app.id, developerId: developer.id, actorId: customUser.id, plan }),
                is_default: index === defaultIndex,
                sort_order: plan.sort_order || index * 10,
                created_by: customUser.id,
            }));
            const { data: planRows, error: pricingPlanError } = await db
                .from('app_pricing_plans')
                .insert(rows)
                .select(APP_PRICING_PLAN_SELECT);
            if (pricingPlanError) {
                return c.json({ error: { code: 'DB_ERROR', message: pricingPlanError.message } }, 500);
            }
            insertedPricingPlans = (planRows || []) as unknown as AppEngineJsonRecord[];
        }

        let manifestPersistence: { extensionRows: AppEngineJsonRecord[]; functionRows: AppEngineJsonRecord[] } | null = null;
        if (manifestInput && manifestPlan?.ok) {
            const concretePlan = planAppManifestRegistration(app.id, manifestInput);
            if (!concretePlan.ok) {
                return c.json({ error: { code: 'VALIDATION', message: concretePlan.message } }, 400);
            }
            const persistedManifest = await persistSubmittedAppManifest(db, {
                appId: app.id,
                plan: concretePlan.value,
            });
            if (!persistedManifest.ok) {
                return c.json({ error: { code: 'DB_ERROR', message: persistedManifest.message } }, 500);
            }
            manifestPersistence = {
                extensionRows: persistedManifest.extensionRows,
                functionRows: persistedManifest.functionRows,
            };
        }

        let reviewRecord: MarketplaceReviewRecord | null = null;
        if (submission.value.status !== 'draft') {
            try {
                reviewRecord = await createMarketplaceReviewRecord(db, {
                    submissionType: 'app',
                    resourceId: app.id,
                    resourceSlug: submission.value.slug,
                    resourceName: submission.value.name,
                    partnerUserId: customUser.id,
                    appDeveloperId: developer.id,
                    actorId: customUser.id,
                    automatedChecks: buildMarketplaceAutomatedChecks({
                        source: 'admin-web.app_submission',
                        checks: [
                            {
                                name: 'built_for_letbuyy_quality_gate',
                                status: Object.keys(parseJsonRecord(body.quality_gate || body.built_for_letbuyy || body.builtForLetBuyy)).length > 0
                                    ? 'passed'
                                    : 'warning',
                                message: 'Built-for-LetBuyy evidence is optional until listing review requests the badge.',
                            },
                            ...(submissionChecks?.checks || []),
                            {
                                name: 'extension_lifecycle_contract',
                                status: manifestPlan?.ok ? 'passed' : 'warning',
                                message: manifestPlan?.ok
                                    ? 'Review packet includes WS13 extension lifecycle, sandbox, revocation, and observability requirements.'
                                    : 'No manifest extensions were submitted for lifecycle review.',
                            },
                        ],
                        metadata: {
                            app_url: submission.value.app_url,
                            pricing_model: submission.value.pricing_model,
                            extension_lifecycle_version: LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
                            extension_lifecycle_review: createAppExtensionReviewChecklist(),
                            extension_developer_handoff: createAppExtensionDeveloperHandoff(),
                        },
                    }),
                    metadata: {
                        source_route: '/app-store/developers/apps',
                        submitted_status: submission.value.status,
                        extension_lifecycle_version: LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
                    },
                });

                await new EventExecutionAdapter(db).emitDomainEvent({
                    storeId: null,
                    aggregateType: 'app',
                    aggregateId: app.id,
                    eventType: 'app.submitted',
                    payload: {
                        app_id: app.id,
                        partner_id: developer.id,
                        review_id: reviewRecord.id,
                    },
                    idempotencyKey: `app.submitted:${app.id}:${reviewRecord.id}`,
                    requestId: getRequestId(c),
                    actorId: customUser.id,
                });
            } catch (reviewError) {
                const message = reviewError instanceof Error ? reviewError.message : 'Failed to create marketplace review record';
                return c.json({ error: { code: 'DB_ERROR', message } }, 500);
            }
        }

        return c.json(success({
            app,
            review_record: reviewRecord,
            manifest: manifestPlan?.ok ? {
                schema_version: manifestPlan.value.manifest.schema_version,
                app: manifestPlan.value.manifest.app,
                scopes: manifestPlan.value.manifest.scopes,
                extension_count: manifestPlan.value.extensionRecords.length,
                function_count: manifestPlan.value.functionRecords.length,
                persisted_extension_records: manifestPersistence?.extensionRows.length || 0,
                persisted_function_records: manifestPersistence?.functionRows.length || 0,
            } : null,
            credentials: {
                oauth_client_id: credentials.oauthClientId,
                client_secret: credentials.clientSecret,
                api_key: credentials.apiKey,
                api_key_prefix: credentials.apiKeyPrefix,
                issued_at: issuedAt,
                persisted: 'hash_only',
                show_once: true,
            },
            pricing_plans: insertedPricingPlans,
        }), 201);
    });

    // POST /app-store/developers/apps/:id/api-key — Rotate a show-once developer API key for an owned app
    router.post('/developers/apps/:id/api-key', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const appId = c.req.param('id');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        const issuedAt = new Date().toISOString();

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error: developerError } = await db
            .from('app_developers')
            .select('id')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (developerError) {
            return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
        }

        const { data: app, error: appError } = await db
            .from('marketplace_apps')
            .select('id, oauth_client_id, api_scopes')
            .eq('id', appId)
            .eq('developer_id', developer.id)
            .maybeSingle();

        if (appError) {
            return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
        }

        if (!app) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App not found for this developer' } }, 404);
        }

        const credentials = await mintDeveloperAppCredentials({
            scopes: Array.isArray(app.api_scopes) ? app.api_scopes.filter((scope): scope is string => typeof scope === 'string') : [],
            issuedAt,
        });
        const oauthClientId = stringOrNull(app.oauth_client_id) || credentials.oauthClientId;

        const credentialPersistence = await persistDeveloperAppCredentials(db, {
            appId: app.id,
            credentialConfig: {
                ...credentials.persistedConfig,
                oauth_client_id: oauthClientId,
            },
        });

        if (!credentialPersistence.ok) {
            return c.json({ error: { code: 'DB_ERROR', message: credentialPersistence.message } }, 500);
        }

        if (!stringOrNull(app.oauth_client_id)) {
            const { error: updateError } = await db
                .from('marketplace_apps')
                .update({ oauth_client_id: oauthClientId })
                .eq('id', app.id);
            if (updateError) {
                return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
            }
        }

        return c.json(success({
            app_id: app.id,
            oauth_client_id: oauthClientId,
            api_key: credentials.apiKey,
            api_key_prefix: credentials.apiKeyPrefix,
            issued_at: issuedAt,
            persisted: 'hash_only',
            show_once: true,
        }));
    });

    // GET /app-store/developers/:id — Public approved developer profile and published apps
    router.get('/developers/:id', async (c) => {
        const profileId = c.req.param('id');
        const db = getSupabaseAdmin(c);
        const developerQuery = db
            .from('app_developers')
            .select('id, company_name, slug, logo_url, website_url, support_email, description, verified, status, created_at, updated_at')
            .eq('status', 'approved');
        const { data: developer, error } = await (isUuid(profileId)
            ? developerQuery.eq('id', profileId)
            : developerQuery.eq('slug', profileId)
        ).maybeSingle();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        if (!developer) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Developer not found' } }, 404);
        }

        const { data: apps, error: appsError } = await db
            .from('marketplace_apps')
            .select('id, name, slug, icon_url, tagline, pricing_model, install_count, rating_avg, review_count, created_at')
            .eq('developer_id', developer.id)
            .eq('status', 'published')
            .order('install_count', { ascending: false });

        if (appsError) {
            return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
        }

        return c.json(success({ developer, apps: apps || [] }));
    });

}
