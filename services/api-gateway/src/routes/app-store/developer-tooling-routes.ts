import type { Context, Hono } from 'hono';
import type { Env } from '../../index';
import { resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import { requireRoleCategory } from '../../middleware/rbac';
import {
    appStoreStringOrNull as stringOrNull,
    parseAppStoreJsonRecord as parseJsonRecord,
    type AppEngineJsonRecord,
} from '@letbuyy/app-engine';
import { enqueueMarketplaceAnalyticsEvent } from './shared';
import {
    AppTelemetryEventInputSchema,
    AppWebhookEndpointInputSchema,
    AppWebhookEndpointUpdateSchema,
    PartnerCollaboratorRedeemInputSchema,
} from '@letbuyy/shared-types';
import { sha256Hex } from '@letbuyy/auth-core';

type AppStoreContext = Context<{ Bindings: Env }>;
type LoadedDeveloperApp = {
    db: ReturnType<typeof getSupabaseAdmin>;
    customUser: { id: string };
    developer: AppEngineJsonRecord;
    app: AppEngineJsonRecord;
};

const WEBHOOK_SELECT = 'id, app_id, name, event, event_types, url, is_active, status, last_delivery_at, created_at, updated_at';

function numberValue(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function dayKey(value: unknown): string | null {
    const raw = stringOrNull(value);
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function clampDays(value: string | undefined): number {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 30;
    return Math.max(1, Math.min(90, parsed));
}

function randomToken(prefix: string, length = 32): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let token = '';
    for (const byte of bytes) token += alphabet[byte % alphabet.length];
    return `${prefix}_${token}`;
}

function safeHttpsUrl(value: string): string | null {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
}

async function loadPartner(c: AppStoreContext) {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return { error: c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403) };
    }

    const { data: developer, error } = await db
        .from('app_developers')
        .select('id, user_id, company_name, status')
        .eq('user_id', customUser.id)
        .maybeSingle();

    if (error) {
        return { error: c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500) };
    }
    if (!developer) {
        return { error: c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404) };
    }
    // SECURITY: only APPROVED developers may use partner tooling. requireRoleCategory
    // gates entry, but loadPartner is the data-loading backstop for every partner route,
    // so enforce approval here too (defense-in-depth against any unguarded call site).
    if ((developer as { status?: string }).status !== 'approved') {
        return { error: c.json({ error: { code: 'FORBIDDEN', message: 'Developer account is not approved' } }, 403) };
    }

    return { db, customUser, developer: developer as AppEngineJsonRecord, auth };
}

async function loadDeveloperApp(c: AppStoreContext, appId: string) {
    const partner = await loadPartner(c);
    if ('error' in partner) return partner;

    const { data: app, error } = await partner.db
        .from('marketplace_apps')
        .select('id, developer_id, name, slug, app_url, status, install_count, rating_avg, review_count')
        .eq('id', appId)
        .eq('developer_id', partner.developer.id)
        .maybeSingle();

    if (error) {
        return { error: c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500) };
    }
    if (!app) {
        return { error: c.json({ error: { code: 'NOT_FOUND', message: 'App not found for this developer' } }, 404) };
    }

    return { ...partner, app: app as AppEngineJsonRecord };
}

function emptyPoint(metricDate: string, appId?: string | null): AppEngineJsonRecord {
    return {
        metric_date: metricDate,
        app_id: appId || null,
        installs: 0,
        uninstalls: 0,
        active_installations: 0,
        reviews: 0,
        usage_events: 0,
        api_requests: 0,
        api_errors: 0,
        gross_amount_minor: 0,
        partner_amount_minor: 0,
        payout_released_minor: 0,
        currency: 'INR',
    };
}

function increment(points: Map<string, AppEngineJsonRecord>, metricDate: string | null, key: string, value = 1) {
    if (!metricDate) return;
    const point = points.get(metricDate) || emptyPoint(metricDate);
    point[key] = numberValue(point[key]) + value;
    points.set(metricDate, point);
}

export function registerAppStoreDeveloperToolingRoutes(router: Hono<{ Bindings: Env }>) {
    // GET /app-store/partners/analytics — Partner install/revenue/usage time-series
    router.get('/partners/analytics', authMiddleware, requireRoleCategory('partner'), async (c) => {
        const loaded = await loadPartner(c);
        if ('error' in loaded) return loaded.error;
        const days = clampDays(c.req.query('days'));
        const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
        const sinceIso = since.toISOString();
        const developerId = String(loaded.developer.id);

        const { data: apps, error: appsError } = await loaded.db
            .from('marketplace_apps')
            .select('id, status')
            .eq('developer_id', developerId);
        if (appsError) return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
        const appRows = (apps || []) as AppEngineJsonRecord[];
        const appIds = appRows.map((app) => stringOrNull(app.id)).filter((id): id is string => Boolean(id));
        const points = new Map<string, AppEngineJsonRecord>();
        for (let offset = 0; offset < days; offset += 1) {
            const key = new Date(since.getTime() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            points.set(key, emptyPoint(key));
        }

        const [{ data: installs }, { data: charges }, { data: payouts }, { data: usage }, { data: apiUsage }] = await Promise.all([
            appIds.length > 0
                ? loaded.db.from('app_installations').select('id, status, installed_at, uninstalled_at').in('app_id', appIds).gte('installed_at', sinceIso)
                : Promise.resolve({ data: [] }),
            loaded.db.from('app_billing_charges').select('amount_minor, partner_amount_minor, created_at').eq('partner_id', developerId).gte('created_at', sinceIso).is('deleted_at', null),
            loaded.db.from('partner_payout_ledger_entries').select('partner_amount_minor, status, created_at').eq('partner_id', developerId).gte('created_at', sinceIso).is('deleted_at', null),
            appIds.length > 0
                ? loaded.db.from('app_usage_events').select('id, created_at').in('app_id', appIds).gte('created_at', sinceIso).is('deleted_at', null)
                : Promise.resolve({ data: [] }),
            loaded.db.from('app_api_usage_metrics').select('metric_date, request_count, error_count').eq('developer_id', developerId).gte('metric_date', since.toISOString().slice(0, 10)).is('deleted_at', null),
        ]);

        for (const row of (installs || []) as AppEngineJsonRecord[]) {
            increment(points, dayKey(row.installed_at), 'installs');
            if (row.status === 'uninstalled') increment(points, dayKey(row.uninstalled_at), 'uninstalls');
        }
        for (const row of (charges || []) as AppEngineJsonRecord[]) {
            increment(points, dayKey(row.created_at), 'gross_amount_minor', numberValue(row.amount_minor));
            increment(points, dayKey(row.created_at), 'partner_amount_minor', numberValue(row.partner_amount_minor));
        }
        for (const row of (payouts || []) as AppEngineJsonRecord[]) {
            if (row.status === 'released') increment(points, dayKey(row.created_at), 'payout_released_minor', numberValue(row.partner_amount_minor));
        }
        for (const row of (usage || []) as AppEngineJsonRecord[]) {
            increment(points, dayKey(row.created_at), 'usage_events');
        }
        for (const row of (apiUsage || []) as AppEngineJsonRecord[]) {
            increment(points, stringOrNull(row.metric_date), 'api_requests', numberValue(row.request_count));
            increment(points, stringOrNull(row.metric_date), 'api_errors', numberValue(row.error_count));
        }

        const sortedPoints = Array.from(points.values()).sort((a, b) => String(a.metric_date).localeCompare(String(b.metric_date)));
        return c.json(success({
            points: sortedPoints,
            totals: {
                total_apps: appIds.length,
                published_apps: appRows.filter((app) => app.status === 'published').length,
                active_installations: (installs || []).filter((row: AppEngineJsonRecord) => row.status === 'active').length,
                uninstalls: sortedPoints.reduce((sum, row) => sum + numberValue(row.uninstalls), 0),
                charges: (charges || []).length,
                gross_amount_minor: sortedPoints.reduce((sum, row) => sum + numberValue(row.gross_amount_minor), 0),
                partner_earnings_minor: sortedPoints.reduce((sum, row) => sum + numberValue(row.partner_amount_minor), 0),
                partner_gst_minor: 0,
                payout_pending_minor: 0,
                payout_released_minor: sortedPoints.reduce((sum, row) => sum + numberValue(row.payout_released_minor), 0),
                currency: 'INR',
            },
        }));
    });

    // GET /app-store/developers/apps/:id/api-usage — Per-app API usage metrics
    router.get('/developers/apps/:id/api-usage', authMiddleware, async (c) => {
        const loaded = await loadDeveloperApp(c, c.req.param('id'));
        if ('error' in loaded) return loaded.error;
        const loadedApp = loaded as LoadedDeveloperApp;
        const days = clampDays(c.req.query('days'));
        const sinceKey = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { data, error } = await loadedApp.db
            .from('app_api_usage_metrics')
            .select('id, developer_id, app_id, metric_date, route_group, method, request_count, error_count, avg_latency_ms, p95_latency_ms, metadata, created_at, updated_at')
            .eq('app_id', loadedApp.app.id)
            .gte('metric_date', sinceKey)
            .is('deleted_at', null)
            .order('metric_date', { ascending: false });
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success({ app_id: loadedApp.app.id, metrics: data || [] }));
    });

    router.get('/developers/apps/:id/webhooks', authMiddleware, async (c) => {
        const loaded = await loadDeveloperApp(c, c.req.param('id'));
        if ('error' in loaded) return loaded.error;
        const loadedApp = loaded as LoadedDeveloperApp;
        const { data, error } = await loadedApp.db
            .from('app_webhooks')
            .select(WEBHOOK_SELECT)
            .eq('app_id', loadedApp.app.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success({ webhooks: data || [] }));
    });

    router.post('/developers/apps/:id/webhooks', authMiddleware, async (c) => {
        const loaded = await loadDeveloperApp(c, c.req.param('id'));
        if ('error' in loaded) return loaded.error;
        const loadedApp = loaded as LoadedDeveloperApp;
        const parsed = AppWebhookEndpointInputSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid webhook' } }, 400);
        const targetUrl = safeHttpsUrl(parsed.data.url);
        if (!targetUrl) return c.json({ error: { code: 'VALIDATION', message: 'Webhook URL must be HTTPS' } }, 400);

        const eventTypes = parsed.data.event_types.length > 0 ? parsed.data.event_types : [parsed.data.event];
        const { data, error } = await loadedApp.db
            .from('app_webhooks')
            .insert({
                app_id: loadedApp.app.id,
                name: parsed.data.name || parsed.data.event,
                event: parsed.data.event,
                event_types: eventTypes,
                url: targetUrl,
                status: parsed.data.status,
                is_active: parsed.data.status === 'active',
                secret: randomToken('whsec', 40),
                created_by: loadedApp.customUser.id,
                updated_by: loadedApp.customUser.id,
            })
            .select(WEBHOOK_SELECT)
            .single();
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success(data), 201);
    });

    router.patch('/developers/apps/:id/webhooks/:webhookId', authMiddleware, async (c) => {
        const loaded = await loadDeveloperApp(c, c.req.param('id'));
        if ('error' in loaded) return loaded.error;
        const loadedApp = loaded as LoadedDeveloperApp;
        const parsed = AppWebhookEndpointUpdateSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid webhook update' } }, 400);
        const patch: AppEngineJsonRecord = { updated_by: loadedApp.customUser.id, updated_at: new Date().toISOString() };
        if (parsed.data.name !== undefined) patch.name = parsed.data.name || null;
        if (parsed.data.event !== undefined) patch.event = parsed.data.event;
        if (parsed.data.event_types !== undefined) patch.event_types = parsed.data.event_types;
        if (parsed.data.status !== undefined) {
            patch.status = parsed.data.status;
            patch.is_active = parsed.data.status === 'active';
        }
        if (parsed.data.url !== undefined) {
            const targetUrl = safeHttpsUrl(parsed.data.url);
            if (!targetUrl) return c.json({ error: { code: 'VALIDATION', message: 'Webhook URL must be HTTPS' } }, 400);
            patch.url = targetUrl;
        }
        const { data, error } = await loadedApp.db
            .from('app_webhooks')
            .update(patch)
            .eq('id', c.req.param('webhookId'))
            .eq('app_id', loadedApp.app.id)
            .is('deleted_at', null)
            .select(WEBHOOK_SELECT)
            .maybeSingle();
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404);
        return c.json(success(data));
    });

    router.delete('/developers/apps/:id/webhooks/:webhookId', authMiddleware, async (c) => {
        const loaded = await loadDeveloperApp(c, c.req.param('id'));
        if ('error' in loaded) return loaded.error;
        const loadedApp = loaded as LoadedDeveloperApp;
        const { data, error } = await loadedApp.db
            .from('app_webhooks')
            .update({ status: 'disabled', is_active: false, deleted_at: new Date().toISOString(), updated_by: loadedApp.customUser.id })
            .eq('id', c.req.param('webhookId'))
            .eq('app_id', loadedApp.app.id)
            .select(WEBHOOK_SELECT)
            .maybeSingle();
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404);
        return c.json(success(data));
    });

    router.post('/partners/collaborator-code', authMiddleware, requireRoleCategory('partner'), async (c) => {
        const loaded = await loadPartner(c);
        if ('error' in loaded) return loaded.error;
        const code = randomToken('lbc', 24);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const scopes = ['read_products', 'write_themes', 'read_orders', 'app_collaboration'];
        const { error } = await loaded.db.from('app_collaborator_codes').insert({
            developer_id: loaded.developer.id,
            code_prefix: code.slice(0, 12),
            code_hash: await sha256Hex(code),
            scopes,
            expires_at: expiresAt,
            created_by: loaded.customUser.id,
            updated_by: loaded.customUser.id,
        });
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success({ request_code: code, expires_at: expiresAt, has_active_code: true, scopes, managed_stores: [] }));
    });

    router.post('/partners/collaborator-code/redeem', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        const parsed = PartnerCollaboratorRedeemInputSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid collaborator code' } }, 400);
        const ownsStore = await verifySiteOwnership(db, parsed.data.site_id, customUser.id, auth.user.storeId);
        if (!ownsStore) return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);

        const { data: codeRow, error: codeError } = await db
            .from('app_collaborator_codes')
            .select('id, developer_id, scopes, expires_at, status')
            .eq('code_hash', await sha256Hex(parsed.data.request_code))
            .eq('status', 'active')
            .is('deleted_at', null)
            .maybeSingle();
        if (codeError) return c.json({ error: { code: 'DB_ERROR', message: codeError.message } }, 500);
        if (!codeRow || Date.parse(String(codeRow.expires_at)) <= Date.now()) {
            return c.json({ error: { code: 'INVALID_CODE', message: 'Collaborator code is invalid or expired' } }, 400);
        }

        const { data: existingSeat, error: existingSeatError } = await db
            .from('app_partner_agency_seats')
            .select('id')
            .eq('developer_id', codeRow.developer_id)
            .eq('site_id', parsed.data.site_id)
            .eq('status', 'active')
            .is('deleted_at', null)
            .maybeSingle();
        if (existingSeatError) return c.json({ error: { code: 'DB_ERROR', message: existingSeatError.message } }, 500);

        const seatRow = {
            developer_id: codeRow.developer_id,
            site_id: parsed.data.site_id,
            collaborator_code_id: codeRow.id,
            seat_user_id: customUser.id,
            scopes: Array.isArray(codeRow.scopes) ? codeRow.scopes : [],
            status: 'active',
            updated_by: customUser.id,
        };
        const seatMutation = existingSeat
            ? db.from('app_partner_agency_seats').update(seatRow).eq('id', existingSeat.id).select().single()
            : db.from('app_partner_agency_seats').insert({
                ...seatRow,
                created_by: customUser.id,
            }).select().single();
        const { data: seat, error: seatError } = await seatMutation;
        if (seatError) return c.json({ error: { code: 'DB_ERROR', message: seatError.message } }, 500);
        await db.from('app_collaborator_codes').update({
            status: 'redeemed',
            redeemed_at: new Date().toISOString(),
            redeemed_by: customUser.id,
            redeemed_site_id: parsed.data.site_id,
            updated_by: customUser.id,
        }).eq('id', codeRow.id);
        return c.json(success({ accepted: true, seat }));
    });

    router.get('/partners/tiers', authMiddleware, requireRoleCategory('partner'), async (c) => {
        const loaded = await loadPartner(c);
        if ('error' in loaded) return loaded.error;
        const developerId = String(loaded.developer.id);
        const { data: apps } = await loaded.db.from('marketplace_apps').select('id, status, install_count, rating_avg').eq('developer_id', developerId);
        const appRows = (apps || []) as AppEngineJsonRecord[];
        const publishedApps = appRows.filter((app) => app.status === 'published').length;
        const installs = appRows.reduce((sum, app) => sum + numberValue(app.install_count), 0);
        const avgRating = appRows.length > 0 ? appRows.reduce((sum, app) => sum + numberValue(app.rating_avg), 0) / appRows.length : 0;
        const tier = publishedApps >= 3 && installs >= 1000 && avgRating >= 4 ? 'gold' : publishedApps >= 1 && installs >= 100 ? 'silver' : 'bronze';
        const tierRow = {
            developer_id: developerId,
            tier,
            status: 'active',
            criteria: { published_apps: publishedApps, installs, avg_rating: avgRating },
            metrics: { published_apps: publishedApps, installs, avg_rating: avgRating },
            reason: `${tier} tier from current marketplace metrics`,
            updated_by: loaded.customUser.id,
        };
        const { data: existingTier, error: existingTierError } = await loaded.db
            .from('app_partner_tiers')
            .select('id')
            .eq('developer_id', developerId)
            .eq('status', 'active')
            .is('deleted_at', null)
            .maybeSingle();
        if (existingTierError) return c.json({ error: { code: 'DB_ERROR', message: existingTierError.message } }, 500);

        const tierMutation = existingTier
            ? loaded.db.from('app_partner_tiers').update(tierRow).eq('id', existingTier.id).select().maybeSingle()
            : loaded.db.from('app_partner_tiers').insert({
                ...tierRow,
                created_by: loaded.customUser.id,
            }).select().maybeSingle();
        const { data, error } = await tierMutation;
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success({ tiers: data ? [data] : [] }));
    });

    router.get('/partners/sandbox-stores', authMiddleware, requireRoleCategory('partner'), async (c) => {
        const loaded = await loadPartner(c);
        if ('error' in loaded) return loaded.error;
        const { data, error } = await loaded.db
            .from('app_sandbox_stores')
            .select('id, developer_id, site_id, name, subdomain, status, provisioning_mode, expires_at, metadata, created_at')
            .eq('developer_id', loaded.developer.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success({ stores: data || [] }));
    });

    router.post('/partners/sandbox-stores', authMiddleware, requireRoleCategory('partner'), async (c) => {
        const loaded = await loadPartner(c);
        if ('error' in loaded) return loaded.error;
        const body = parseJsonRecord(await c.req.json().catch(() => ({})));
        const name = stringOrNull(body.name) || `${loaded.developer.company_name || 'Partner'} sandbox`;
        const mode = ['sandbox', 'test_store', 'manual'].includes(String(body.provisioning_mode)) ? String(body.provisioning_mode) : 'sandbox';
        const { data, error } = await loaded.db
            .from('app_sandbox_stores')
            .insert({
                developer_id: loaded.developer.id,
                name,
                status: 'requested',
                provisioning_mode: mode,
                metadata: { provisioning: 'human_approval_required' },
                created_by: loaded.customUser.id,
                updated_by: loaded.customUser.id,
            })
            .select('id, developer_id, site_id, name, subdomain, status, provisioning_mode, expires_at, metadata, created_at')
            .single();
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success(data), 201);
    });

    router.post('/apps/:id/demo-session', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        const appId = c.req.param('id');
        const { data: app, error: appError } = await db
            .from('marketplace_apps')
            .select('id, developer_id, app_url, status')
            .eq('id', appId)
            .eq('status', 'published')
            .maybeSingle();
        if (appError) return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
        if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
        const appUrl = safeHttpsUrl(String(app.app_url || ''));
        if (!appUrl) return c.json({ error: { code: 'DEMO_UNAVAILABLE', message: 'Demo is not available for this app' } }, 404);
        const demoUrl = new URL(appUrl);
        demoUrl.searchParams.set('letbuyy_demo', 'true');
        const { data, error } = await db.from('app_demo_sessions').insert({
            app_id: app.id,
            developer_id: app.developer_id,
            site_id: auth.user.storeId || null,
            demo_url: demoUrl.toString(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            created_by: customUser.id,
            updated_by: customUser.id,
        }).select('id, app_id, developer_id, site_id, demo_url, status, expires_at, metadata, created_at').single();
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        return c.json(success({ session: data }), 201);
    });

    router.post('/telemetry/events', async (c) => {
        const parsed = AppTelemetryEventInputSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid telemetry event' } }, 400);
        const db = getSupabaseAdmin(c);
        const metadata = parseJsonRecord(parsed.data.metadata);
        const { data, error } = await db.from('app_telemetry_events').insert({
            app_id: parsed.data.app_id || null,
            site_id: parsed.data.site_id || null,
            event_type: parsed.data.event_type,
            source: parsed.data.source || 'marketplace',
            session_id: parsed.data.session_id || null,
            metadata,
            occurred_at: parsed.data.occurred_at || new Date().toISOString(),
        }).select('id').maybeSingle();
        if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        if (data?.id) {
            try {
                const queued = await enqueueMarketplaceAnalyticsEvent({
                    db,
                    env: c.env,
                    executionCtx: c.executionCtx,
                    eventId: data.id,
                    eventType: `marketplace.telemetry.${parsed.data.event_type}`,
                    siteId: parsed.data.site_id || null,
                    aggregateType: parsed.data.app_id ? 'marketplace_app' : 'marketplace_telemetry',
                    aggregateId: parsed.data.app_id || data.id,
                    occurredAt: parsed.data.occurred_at || new Date().toISOString(),
                    idempotencyKey: `marketplace.telemetry:${data.id}`,
                    payload: {
                        telemetry_event_id: data.id,
                        app_id: parsed.data.app_id || null,
                        event_type: parsed.data.event_type,
                        source: parsed.data.source || 'marketplace',
                        session_id: parsed.data.session_id || null,
                        metadata,
                    },
                });
                return c.json(success({ accepted: true, event_id: data.id, queued }), 202);
            } catch (queueError) {
                return c.json({
                    error: {
                        code: 'ANALYTICS_QUEUE_ERROR',
                        message: queueError instanceof Error ? queueError.message : 'Telemetry event queue enqueue failed',
                    },
                }, 500);
            }
        }
        return c.json(success({ accepted: true, event_id: null, queued: false }), 202);
    });
}
