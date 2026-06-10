import type { Context, Hono } from 'hono';
import type { Env } from '../../index';
import { resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { isInternalApiSecretRequest } from '../../lib/internal-secret';
import {
    buildMarketplaceAutomatedChecks,
    createMarketplaceReviewRecord,
} from '../../lib/marketplace-review-records';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import {
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    parseAppStoreJsonRecord as parseJsonRecord,
    planMarketplaceAppUpdate,
    type AppEngineJsonRecord,
} from '@letbuyy/shared-types';
import { getRequestId } from './shared';

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
    'created_by',
    'updated_by',
    'created_at',
    'updated_at',
    'deleted_at',
].join(', ');

type AppStoreContext = Context<{ Bindings: Env }>;

async function resolveDeveloperApp(c: AppStoreContext, appId: string) {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return { error: c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403) };
    }

    const { data: developer, error: developerError } = await db
        .from('app_developers')
        .select('id, status')
        .eq('user_id', customUser.id)
        .maybeSingle();

    if (developerError) {
        return { error: c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500) };
    }
    if (!developer) {
        return { error: c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403) };
    }

    const { data: app, error: appError } = await db
        .from('marketplace_apps')
        .select('id, developer_id, name, slug, tagline, description, category_id, app_url, privacy_policy_url, terms_url, documentation_url, pricing_model, status, version, api_scopes, updated_at')
        .eq('id', appId)
        .eq('developer_id', developer.id)
        .maybeSingle();

    if (appError) {
        return { error: c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500) };
    }
    if (!app) {
        return { error: c.json({ error: { code: 'NOT_FOUND', message: 'App not found for this developer' } }, 404) };
    }

    return { db, customUser, developer, app: app as unknown as AppEngineJsonRecord };
}

function normalizeChangelog(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map((item) => stringOrNull(item)).filter((item): item is string => Boolean(item)).slice(0, 20)
        : [];
}

function normalizedScopeUpdate(body: AppEngineJsonRecord, currentScopes: unknown): string[] {
    const current = stringArray(currentScopes);
    const explicit = Array.isArray(body.scopes_granted || body.scopesGranted)
        ? stringArray(body.scopes_granted || body.scopesGranted)
        : null;
    const revokeScope = stringOrNull(body.revoke_scope || body.revokeScope);
    if (explicit) return [...new Set(explicit)].slice(0, 50);
    if (!revokeScope) return current;
    return current.filter((scope) => scope !== revokeScope);
}

async function createUpdateReview(input: {
    c: AppStoreContext;
    db: ReturnType<typeof getSupabaseAdmin>;
    app: AppEngineJsonRecord;
    developerId: string;
    actorId: string;
    versionId: string | null;
    version: string | null;
    releaseNotes: string | null;
    automatedChecks: AppEngineJsonRecord;
}) {
    const review = await createMarketplaceReviewRecord(input.db, {
        submissionType: 'app',
        resourceId: String(input.app.id),
        resourceSlug: stringOrNull(input.app.slug) || null,
        resourceName: stringOrNull(input.app.name) || 'App update',
        partnerUserId: input.actorId,
        appDeveloperId: input.developerId,
        actorId: input.actorId,
        automatedChecks: buildMarketplaceAutomatedChecks({
            source: 'app_lifecycle.update',
            checks: [
                {
                    name: 'listing_update_payload',
                    status: 'passed',
                    message: 'Submitted listing fields passed the app update contract.',
                },
                {
                    name: 'version_payload',
                    status: input.versionId ? 'passed' : 'warning',
                    message: input.versionId ? 'A version record was submitted for review.' : 'Listing metadata changed without a version payload.',
                },
                {
                    name: 'rollout_configuration',
                    status: 'passed',
                    message: 'Rollout percentage is bounded between 0 and 100.',
                },
            ],
            metadata: {
                app_id: input.app.id,
                app_version_id: input.versionId,
                version: input.version,
                release_notes: input.releaseNotes,
                automated_checks: input.automatedChecks,
            },
        }),
        metadata: {
            source_route: '/app-store/developers/apps/:id',
            app_version_id: input.versionId,
            version: input.version,
        },
    });

    await new EventExecutionAdapter(input.db).emitDomainEvent({
        storeId: null,
        aggregateType: 'app',
        aggregateId: String(input.app.id),
        eventType: 'app.submitted',
        payload: {
            app_id: String(input.app.id),
            partner_id: input.developerId,
            review_id: review.id,
            app_version_id: input.versionId,
            version: input.version,
            update_type: input.versionId ? 'version' : 'listing',
        },
        idempotencyKey: `app.updated:${String(input.app.id)}:${review.id}`,
        requestId: getRequestId(input.c),
        actorId: input.actorId,
    });

    return review;
}

export function registerAppStoreAppLifecycleRoutes(router: Hono<{ Bindings: Env }>) {
    router.patch('/developers/:id/approval', async (c) => {
        if (!isInternalApiSecretRequest(c.env, c.req)) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Internal authorization required' } }, 403);
        }

        const developerId = c.req.param('id');
        const body = await c.req.json() as AppEngineJsonRecord;
        const decision = stringOrNull(body.status || body.decision);
        if (decision !== 'approved' && decision !== 'rejected') {
            return c.json({ error: { code: 'VALIDATION', message: 'status must be approved or rejected' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const now = new Date().toISOString();
        const { data: developer, error } = await db
            .from('app_developers')
            .update({
                status: decision,
                verified: decision === 'approved',
                kyc_status: decision === 'approved' ? 'approved' : 'rejected',
                approved_at: decision === 'approved' ? now : null,
                approved_by: stringOrNull(body.approved_by || body.actor_id),
                approval_notes: stringOrNull(body.notes || body.approval_notes),
            })
            .eq('id', developerId)
            .select('*')
            .single();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        return c.json(success({ developer }));
    });

    router.patch('/installations/:id/scopes', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const installationId = c.req.param('id');
        const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: installation, error: installationError } = await db
            .from('app_installations')
            .select('id, app_id, store_id, installed_by, status, scopes_granted, config, marketplace_apps(id, name, slug, icon_url, tagline, pricing_model, app_url)')
            .eq('id', installationId)
            .neq('status', 'uninstalled')
            .maybeSingle();

        if (installationError) {
            return c.json({ error: { code: 'DB_ERROR', message: installationError.message } }, 500);
        }
        if (!installation) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App installation not found' } }, 404);
        }

        const storeId = stringOrNull(body.store_id || body.storeId);
        if (storeId && installation.store_id !== storeId) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Installation does not belong to this store' } }, 403);
        }

        const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const nextScopes = normalizedScopeUpdate(body, installation.scopes_granted);
        const revokedScope = stringOrNull(body.revoke_scope || body.revokeScope);
        const config = parseJsonRecord(installation.config);
        const oauth = parseJsonRecord(config.oauth);
        const { data: updated, error } = await db
            .from('app_installations')
            .update({
                scopes_granted: nextScopes,
                config: {
                    ...config,
                    oauth: {
                        ...oauth,
                        scopes: nextScopes,
                        scope_revocations: [
                            ...(
                                Array.isArray(oauth.scope_revocations)
                                    ? oauth.scope_revocations
                                    : []
                            ),
                            ...(revokedScope ? [{ scope: revokedScope, revoked_at: new Date().toISOString(), actor_id: customUser.id }] : []),
                        ],
                    },
                },
            })
            .eq('id', installation.id)
            .select('id, app_id, store_id, status, scopes_granted, config, installed_at, uninstalled_at, marketplace_apps(id, name, slug, icon_url, tagline, pricing_model, app_url)')
            .single();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        return c.json(success(updated));
    });

    router.get('/developers/apps/:id/versions', authMiddleware, async (c) => {
        const resolved = await resolveDeveloperApp(c, c.req.param('id'));
        if ('error' in resolved) return resolved.error;

        const { data: versions, error } = await resolved.db
            .from('app_versions')
            .select(APP_VERSION_SELECT)
            .eq('app_id', c.req.param('id'))
            .eq('developer_id', resolved.developer.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        return c.json(success({ app: resolved.app, versions: versions || [] }));
    });

    router.patch('/developers/apps/:id', authMiddleware, async (c) => {
        const resolved = await resolveDeveloperApp(c, c.req.param('id'));
        if ('error' in resolved) return resolved.error;
        const body = await c.req.json() as AppEngineJsonRecord;

        const plan = planMarketplaceAppUpdate(body, {
            slug: String(resolved.app.slug),
            name: String(resolved.app.name),
            version: stringOrNull(resolved.app.version),
            status: stringOrNull(resolved.app.status),
        });
        if (!plan.ok) {
            return c.json({ error: { code: 'VALIDATION', message: plan.message } }, 400);
        }

        const { data: app, error: updateError } = await resolved.db
            .from('marketplace_apps')
            .update(plan.value.update)
            .eq('id', c.req.param('id'))
            .eq('developer_id', resolved.developer.id)
            .select('id, developer_id, name, slug, tagline, description, category_id, app_url, privacy_policy_url, terms_url, documentation_url, pricing_model, status, version, api_scopes, updated_at')
            .single();

        if (updateError) {
            return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
        }

        let versionRow: AppEngineJsonRecord | null = null;
        if (plan.value.version) {
            const checks = {
                manifest: plan.value.version.manifest ? 'validated' : 'not_provided',
                rollout_percentage: plan.value.version.rollout_percentage,
            };
            const { data: insertedVersion, error: versionError } = await resolved.db
                .from('app_versions')
                .insert({
                    app_id: c.req.param('id'),
                    developer_id: resolved.developer.id,
                    version: plan.value.version.version,
                    release_notes: plan.value.version.release_notes,
                    changelog: plan.value.version.changelog,
                    rollout_percentage: plan.value.version.rollout_percentage,
                    rollout_cohort: plan.value.version.rollout_cohort,
                    status: plan.value.requiresReview ? 'in_review' : 'draft',
                    manifest: plan.value.version.manifest || {},
                    automated_checks: checks,
                    submitted_at: plan.value.requiresReview ? new Date().toISOString() : null,
                    created_by: resolved.customUser.id,
                    updated_by: resolved.customUser.id,
                })
                .select(APP_VERSION_SELECT)
                .single();

            if (versionError) {
                const status = versionError.code === '23505' ? 409 : 500;
                const message = versionError.code === '23505' ? 'This version already exists for the app' : versionError.message;
                return c.json({ error: { code: status === 409 ? 'CONFLICT' : 'DB_ERROR', message } }, status);
            }
            versionRow = insertedVersion as unknown as AppEngineJsonRecord;
        }

        let reviewRecord = null;
        if (plan.value.requiresReview) {
            reviewRecord = await createUpdateReview({
                c,
                db: resolved.db,
                app: app as unknown as AppEngineJsonRecord,
                developerId: String(resolved.developer.id),
                actorId: resolved.customUser.id,
                versionId: versionRow ? String(versionRow.id) : null,
                version: versionRow ? String(versionRow.version) : stringOrNull(app.version),
                releaseNotes: versionRow ? stringOrNull(versionRow.release_notes) : null,
                automatedChecks: versionRow ? parseJsonRecord(versionRow.automated_checks) : {},
            });
            if (versionRow) {
                await resolved.db
                    .from('app_versions')
                    .update({ review_record_id: reviewRecord.id, updated_by: resolved.customUser.id })
                    .eq('id', versionRow.id);
                versionRow = { ...versionRow, review_record_id: reviewRecord.id };
            }
        }

        return c.json(success({ app, version: versionRow, review_record: reviewRecord }));
    });

    router.post('/developers/apps/:id/versions', authMiddleware, async (c) => {
        const resolved = await resolveDeveloperApp(c, c.req.param('id'));
        if ('error' in resolved) return resolved.error;
        const body = await c.req.json() as AppEngineJsonRecord;

        const plan = planMarketplaceAppUpdate(body, {
            slug: String(resolved.app.slug),
            name: String(resolved.app.name),
            version: stringOrNull(resolved.app.version),
            status: stringOrNull(resolved.app.status),
        });
        if (!plan.ok || !plan.value.version) {
            return c.json({ error: { code: 'VALIDATION', message: plan.ok ? 'version and release_notes are required' : plan.message } }, 400);
        }

        const { data: updatedApp, error: appError } = await resolved.db
            .from('marketplace_apps')
            .update({ version: plan.value.version.version, api_scopes: plan.value.update.api_scopes })
            .eq('id', c.req.param('id'))
            .eq('developer_id', resolved.developer.id)
            .select('id, developer_id, name, slug, status, version, api_scopes, updated_at')
            .single();

        if (appError) {
            return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
        }

        const checks = {
            manifest: plan.value.version.manifest ? 'validated' : 'not_provided',
            rollout_percentage: plan.value.version.rollout_percentage,
        };
        const { data: versionRow, error: versionError } = await resolved.db
            .from('app_versions')
            .insert({
                app_id: c.req.param('id'),
                developer_id: resolved.developer.id,
                version: plan.value.version.version,
                release_notes: plan.value.version.release_notes,
                changelog: normalizeChangelog(plan.value.version.changelog),
                rollout_percentage: plan.value.version.rollout_percentage,
                rollout_cohort: plan.value.version.rollout_cohort,
                status: plan.value.requiresReview ? 'in_review' : 'draft',
                manifest: plan.value.version.manifest || {},
                automated_checks: checks,
                submitted_at: plan.value.requiresReview ? new Date().toISOString() : null,
                created_by: resolved.customUser.id,
                updated_by: resolved.customUser.id,
            })
            .select(APP_VERSION_SELECT)
            .single();

        if (versionError) {
            const status = versionError.code === '23505' ? 409 : 500;
            const message = versionError.code === '23505' ? 'This version already exists for the app' : versionError.message;
            return c.json({ error: { code: status === 409 ? 'CONFLICT' : 'DB_ERROR', message } }, status);
        }
        const versionRecord = versionRow as unknown as AppEngineJsonRecord;

        const reviewRecord = plan.value.requiresReview
            ? await createUpdateReview({
                c,
                db: resolved.db,
                app: updatedApp as unknown as AppEngineJsonRecord,
                developerId: String(resolved.developer.id),
                actorId: resolved.customUser.id,
                versionId: String(versionRecord.id),
                version: String(versionRecord.version),
                releaseNotes: stringOrNull(versionRecord.release_notes),
                automatedChecks: checks,
            })
            : null;

        if (reviewRecord) {
            await resolved.db
                .from('app_versions')
                .update({ review_record_id: reviewRecord.id, updated_by: resolved.customUser.id })
                .eq('id', versionRecord.id);
        }

        return c.json(success({
            app: updatedApp,
            version: reviewRecord ? { ...versionRecord, review_record_id: reviewRecord.id } : versionRecord,
            review_record: reviewRecord,
        }), 201);
    });
}
