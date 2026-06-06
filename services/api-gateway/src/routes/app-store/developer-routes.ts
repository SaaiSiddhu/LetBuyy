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
    planMarketplaceAppSubmission,
    type AppEngineJsonRecord,
    type AppManifestRegistrationPlan,
} from '@letbuyy/app-engine';
import { sha256Hex } from '@letbuyy/auth-core';
import {
    getRequestId,
    partnerRequestCode,
    partnerStoreFromMembership,
    partnerStoreFromOwnedSite,
    sumMinor,
} from './shared';

const DEVELOPER_CREDENTIAL_TARGET = '/v1/app';
const DEVELOPER_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~-';

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

        return c.json(success({ developer, apps: apps || [], review_records: reviewRecords || [] }));
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
            .select('id, site_id, app_id, partner_id, installation_id, billing_mode, status, name, amount_minor, currency, revenue_share_bps, partner_amount_minor, platform_fee_minor, partner_gst_bps, partner_gst_minor, payout_rail, provider, provider_mode, approved_at, activated_at, idempotency_key, metadata, created_at, updated_at')
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

        const collaboratorAccess = {
            request_code: partnerRequestCode(developerId),
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
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
            review_records: reviewRecords || [],
            charges: chargeRows,
            payouts: payoutRows,
            development_stores: Array.from(developmentStoresById.values()),
            collaborator_access: collaboratorAccess,
            analytics,
        }));
    });

    // POST /app-store/partners/collaborator-code — Mint a short-lived partner request code
    router.post('/partners/collaborator-code', authMiddleware, requireRoleCategory('partner'), async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: developer, error } = await db
            .from('app_developers')
            .select('id')
            .eq('user_id', customUser.id)
            .maybeSingle();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        if (!developer?.id) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
        }

        return c.json(success({
            request_code: partnerRequestCode(String(developer.id)),
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            scopes: ['read_products', 'write_themes', 'read_orders', 'app_collaboration'],
            managed_stores: [],
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

        const submission = planMarketplaceAppSubmission(body, developer.id);
        if (!submission.ok) {
            return c.json({ error: { code: 'VALIDATION', message: submission.message } }, 400);
        }

        const manifestInput = developerManifestInput(body);
        const manifestPlan = manifestInput ? planAppManifestRegistration('pending_app_id', manifestInput) : null;
        if (manifestPlan && !manifestPlan.ok) {
            return c.json({ error: { code: 'VALIDATION', message: manifestPlan.message } }, 400);
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
        const redirectUris = normalizeDeveloperRedirectUris(body.oauth_redirect_uris || body.redirect_uris || body.redirectUris);
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
                        source: 'platform-console.app_submission',
                        checks: [
                            {
                                name: 'schema_validation',
                                status: 'passed',
                                message: 'App submission payload matched the marketplace contract.',
                            },
                            {
                                name: 'developer_profile',
                                status: 'passed',
                                message: 'Submitting user owns an app developer profile.',
                            },
                            {
                                name: 'built_for_letbuyy_quality_gate',
                                status: Object.keys(parseJsonRecord(body.quality_gate || body.built_for_letbuyy || body.builtForLetBuyy)).length > 0
                                    ? 'passed'
                                    : 'warning',
                                message: 'Built-for-LetBuyy evidence is optional until listing review requests the badge.',
                            },
                            {
                                name: 'extension_lifecycle_contract',
                                status: 'passed',
                                message: 'Review packet includes WS13 extension lifecycle, sandbox, revocation, and observability requirements.',
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

    // GET /app-store/developers/:id — Get developer profile + apps
    router.get('/developers/:id', async (c) => {
        const devId = c.req.param('id');
        const db = getSupabaseAdmin(c);

        const { data: developer, error } = await db
            .from('app_developers')
            .select('id, company_name, website_url, description, verified, created_at')
            .eq('id', devId)
            .single();

        if (error || !developer) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Developer not found' } }, 404);
        }

        const { data: apps } = await db
            .from('marketplace_apps')
            .select('id, name, slug, icon_url, tagline, pricing_model, install_count, rating_avg, review_count')
            .eq('developer_id', devId)
            .eq('status', 'published')
            .order('install_count', { ascending: false });

        return c.json(success({ ...developer, apps: apps || [] }));
    });
}
