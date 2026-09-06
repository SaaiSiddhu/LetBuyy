import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { requireRoleCategory, requireSuperAdmin } from '../middleware/rbac';
import { isAppStoreUuid as isUuid } from '@letbuyy/shared-types';
import {
    AppDiscoveryEventInputSchema,
    AppReviewReplyInputSchema,
    AppTrustReportInputSchema,
} from '@letbuyy/shared-types';
import { registerAppStoreExtensionRoutes } from './app-store/extension-routes';
import { registerAppStoreBillingOAuthRoutes } from './app-store/billing-oauth-routes';
import { registerAppStoreInstallLifecycleRoutes } from './app-store/install-lifecycle-routes';
import { registerAppStoreAppLifecycleRoutes } from './app-store/app-lifecycle-routes';
import { registerAppStoreDeveloperToolingRoutes } from './app-store/developer-tooling-routes';
import { registerAppStoreDeveloperRoutes } from './app-store/developer-routes';
import { registerAppStoreComplianceRoutes } from './app-store/compliance-routes';
import { registerAppStoreGrowthRoutes } from './app-store/growth-routes';
import { enqueueMarketplaceAnalyticsEvent } from './app-store/shared';
import {
    buildReviewSummaryGenerationResult,
    decorateAppsWithParityData,
    decorateCollectionWithSections,
    decorateCollectionsWithSections,
    decorateReviewsWithProvenance,
    getCategoryFeatureGroups,
    getFeatureFilteredAppIds,
    normalizeFeatureHandles,
} from './app-store/parity-data';
import {
    APP_CATEGORY_COLUMN_NAMES,
    appDetailSelect,
    appPublicSelect,
    isMissingAppPricingPlansRelation,
    isMissingColumnError,
    missingColumnFromError,
} from './app-store/schema-drift';
import { scoreMarketplaceSearchResult } from './app-store/search-score';

import {
    appDeveloperOwnerId,
    decorateAppRecord,
    decorateAppRecords,
    isSearchVectorUnavailableError,
    normalizePositiveInt,
    normalizeRatingMin,
    normalizeSearchTerm,
    reviewFraudSignals,
    stringOrNull,
    AppAwardWriteSchema,
    type AppStoreRecord,
} from './app-store/record-shaping';

const router = new Hono<{ Bindings: Env }>();

// GET /app-store/categories — List active app categories
router.get('/categories', async (c) => {
    const db = getSupabaseAdmin(c);
    const omittedColumns = new Set<string>();
    const categoryColumns = () => APP_CATEGORY_COLUMN_NAMES
        .filter((column) => !omittedColumns.has(column))
        .join(', ');

    const buildCategoryQuery = () => db
        .from('app_categories')
        .select(categoryColumns())
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    let result = await buildCategoryQuery();
    for (let attempts = 0; result.error && attempts < APP_CATEGORY_COLUMN_NAMES.length; attempts += 1) {
        const missingColumn = missingColumnFromError(result.error);
        if (
            missingColumn &&
            APP_CATEGORY_COLUMN_NAMES.includes(missingColumn as typeof APP_CATEGORY_COLUMN_NAMES[number]) &&
            !omittedColumns.has(missingColumn)
        ) {
            omittedColumns.add(missingColumn);
            result = await buildCategoryQuery();
            continue;
        }
        break;
    }

    const { data, error } = result;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const categories = (data || []) as unknown as AppStoreRecord[];
    const categoryIds = categories
        .map((category) => typeof category.id === 'string' ? category.id : null)
        .filter((id): id is string => Boolean(id));
    const { data: appCategories, error: countError } = categoryIds.length > 0
        ? await db
            .from('marketplace_apps')
            .select('category_id')
            .eq('status', 'published')
            .in('category_id', categoryIds)
        : { data: [], error: null };

    if (countError) {
        return c.json({ error: { code: 'DB_ERROR', message: countError.message } }, 500);
    }

    const counts = new Map<string, number>();
    for (const item of (appCategories || []) as unknown as AppStoreRecord[]) {
        if (typeof item.category_id === 'string') {
            counts.set(item.category_id, (counts.get(item.category_id) || 0) + 1);
        }
    }

    return c.json(success(categories.map((category) => ({
        ...category,
        group: 'group_name' in category ? category.group_name : null,
        count: typeof category.id === 'string' ? counts.get(category.id) || 0 : 0,
    }))));
});

// GET /app-store/apps — List marketplace apps (public-like, filtered by status=published for non-owners)
router.get('/apps', async (c) => {
    const category = c.req.query('category');
    const collection = c.req.query('collection');
    const search = normalizeSearchTerm(c.req.query('search'));
    const pricing = c.req.query('pricing');
    const ratingMin = normalizeRatingMin(c.req.query('rating_min') || c.req.query('rating'));
    const siteType = c.req.query('site_type');
    const sort = c.req.query('sort') || (search ? 'relevance' : 'popular');
    const page = normalizePositiveInt(c.req.query('page'), 1, 1000);
    const limit = normalizePositiveInt(c.req.query('limit'), 20, 50);
    const offset = (page - 1) * limit;
    const featuredOnly = ['1', 'true', 'yes'].includes((c.req.query('featured') || '').toLowerCase());
    const builtForLetbuyyOnly = ['1', 'true', 'yes'].includes((c.req.query('built_for_letbuyy') || '').toLowerCase());
    const featureHandles = normalizeFeatureHandles([
        c.req.query('feature_handles'),
        c.req.query('feature_handles[]'),
        c.req.queries('feature_handles'),
        c.req.queries('feature_handles[]'),
    ]);
    const db = getSupabaseAdmin(c);
    let collectionAppIds: string[] | null = null;
    let featureAppIds: string[] | null = null;

    if (collection) {
        const { data: collectionRow, error: collectionError } = await db
            .from('app_collections')
            .select('id')
            .eq('slug', collection)
            .eq('status', 'published')
            .is('deleted_at', null)
            .maybeSingle();
        if (collectionError) {
            return c.json({ error: { code: 'DB_ERROR', message: collectionError.message } }, 500);
        }
        if (!collectionRow) {
            return c.json(paginated([], 0, page, limit));
        }
        const { data: items, error: itemsError } = await db
            .from('app_collection_items')
            .select('app_id')
            .eq('collection_id', collectionRow.id)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true });
        if (itemsError) {
            return c.json({ error: { code: 'DB_ERROR', message: itemsError.message } }, 500);
        }
        collectionAppIds = (items || [])
            .map((item) => typeof item.app_id === 'string' ? item.app_id : null)
            .filter((id): id is string => Boolean(id));
        if (collectionAppIds.length === 0) {
            return c.json(paginated([], 0, page, limit));
        }
    }

    try {
        featureAppIds = await getFeatureFilteredAppIds(db, featureHandles);
    } catch (facetError) {
        return c.json({ error: { code: 'DB_ERROR', message: facetError instanceof Error ? facetError.message : 'Feature filter failed' } }, 500);
    }

    if (featureAppIds && featureAppIds.length === 0) {
        return c.json(paginated([], 0, page, limit));
    }

    const useRelevanceWindow = search && sort === 'relevance' && offset < 1000;
    const relevanceWindowEnd = useRelevanceWindow
        ? Math.min(999, Math.max(offset + limit - 1, limit * 4 - 1))
        : offset + limit - 1;

    const buildQuery = (useSearchVector: boolean) => {
        const includePricingPlans = !appListFallbacks.pricingPlans;
        const includeCategoryGroupName = !appListFallbacks.categoryGroupName;
        let query = db
            .from('marketplace_apps')
            .select(appPublicSelect({ includePricingPlans, includeCategoryGroupName }), { count: 'exact' })
            .eq('status', 'published');

        if (includePricingPlans) {
            query = query
                .eq('app_pricing_plans.status', 'active')
                .is('app_pricing_plans.deleted_at', null);
        }

        if (collectionAppIds) query = query.in('id', collectionAppIds);
        if (featureAppIds) query = query.in('id', featureAppIds);
        if (category) query = isUuid(category) ? query.eq('category_id', category) : query.eq('app_categories.slug', category);
        if (pricing === 'paid') {
            query = query.in('pricing_model', ['recurring', 'one_time', 'usage']);
        } else if (pricing) {
            query = query.eq('pricing_model', pricing);
        }
        if (ratingMin) query = query.gte('rating_avg', ratingMin);
        if (featuredOnly) query = query.eq('is_featured', true);
        if (builtForLetbuyyOnly && !appListFallbacks.builtForLetbuyy) query = query.eq('built_for_letbuyy', true);
        if (siteType && !appListFallbacks.supportedSiteTypes) query = query.contains('supported_site_types', [siteType]);
        if (search) {
            query = useSearchVector
                ? query.textSearch('search_vector', search, { type: 'websearch', config: 'simple' })
                : query.or(`name.ilike.%${search}%,tagline.ilike.%${search}%,description.ilike.%${search}%`);
        }

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
            case 'relevance':
                query = query.order('install_count', { ascending: false }).order('rating_avg', { ascending: false });
                break;
            case 'popular':
            default:
                query = query.order('install_count', { ascending: false });
                break;
        }

        return query.range(useRelevanceWindow ? 0 : offset, relevanceWindowEnd);
    };

    const appListFallbacks = {
        pricingPlans: false,
        categoryGroupName: false,
        builtForLetbuyy: false,
        supportedSiteTypes: false,
        searchVector: !search,
    };

    let result = await buildQuery(!appListFallbacks.searchVector);
    for (let attempts = 0; result.error && attempts < 6; attempts += 1) {
        if (!appListFallbacks.searchVector && search && isSearchVectorUnavailableError(result.error)) {
            appListFallbacks.searchVector = true;
            result = await buildQuery(false);
            continue;
        }
        if (!appListFallbacks.pricingPlans && isMissingAppPricingPlansRelation(result.error)) {
            appListFallbacks.pricingPlans = true;
            result = await buildQuery(!appListFallbacks.searchVector);
            continue;
        }
        if (!appListFallbacks.categoryGroupName && isMissingColumnError(result.error, 'group_name')) {
            appListFallbacks.categoryGroupName = true;
            result = await buildQuery(!appListFallbacks.searchVector);
            continue;
        }
        if (!appListFallbacks.builtForLetbuyy && isMissingColumnError(result.error, 'built_for_letbuyy')) {
            appListFallbacks.builtForLetbuyy = true;
            result = await buildQuery(!appListFallbacks.searchVector);
            continue;
        }
        if (!appListFallbacks.supportedSiteTypes && isMissingColumnError(result.error, 'supported_site_types')) {
            appListFallbacks.supportedSiteTypes = true;
            result = await buildQuery(!appListFallbacks.searchVector);
            continue;
        }
        break;
    }

    const { data, error, count } = result;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    let records = decorateAppRecords((data || []) as unknown as AppStoreRecord[]);
    if (useRelevanceWindow) {
        records = records
            .map((app) => ({ ...app, search_score: scoreMarketplaceSearchResult(app, search) }))
            .sort((a, b) => Number(b.search_score || 0) - Number(a.search_score || 0))
            .slice(offset, offset + limit);
    }

    const enrichedRecords = await decorateAppsWithParityData(db, records);
    const visibleRecords = builtForLetbuyyOnly && appListFallbacks.builtForLetbuyy
        ? enrichedRecords.filter((record) => record.built_for_letbuyy !== false)
        : enrichedRecords;
    return c.json(paginated(visibleRecords, count || 0, page, limit));
});

// GET /app-store/categories/:slug/features — Category feature facet groups and counts
router.get('/categories/:slug/features', async (c) => {
    const slug = c.req.param('slug');
    const featureHandles = normalizeFeatureHandles([
        c.req.query('feature_handles'),
        c.req.query('feature_handles[]'),
        c.req.queries('feature_handles'),
        c.req.queries('feature_handles[]'),
    ]);
    const db = getSupabaseAdmin(c);

    try {
        const groups = await getCategoryFeatureGroups(db, slug, featureHandles);
        return c.json(success(groups));
    } catch (facetError) {
        return c.json({ error: { code: 'DB_ERROR', message: facetError instanceof Error ? facetError.message : 'Feature facets failed' } }, 500);
    }
});

// GET /app-store/collections — List published app collections
router.get('/collections', async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('app_collections')
        .select('id, slug, name, description, curation_type, disclosure, status, sort_order, created_at, updated_at')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const collectionIds = (data || []).map((item) => item.id).filter((id): id is string => typeof id === 'string');
    const { data: items, error: itemError } = collectionIds.length > 0
        ? await db
            .from('app_collection_items')
            .select('collection_id')
            .in('collection_id', collectionIds)
            .is('deleted_at', null)
        : { data: [], error: null };

    if (itemError) {
        return c.json({ error: { code: 'DB_ERROR', message: itemError.message } }, 500);
    }

    const counts = new Map<string, number>();
    for (const item of items || []) {
        if (typeof item.collection_id === 'string') {
            counts.set(item.collection_id, (counts.get(item.collection_id) || 0) + 1);
        }
    }

    const collections = (data || []).map((collection) => ({
        ...collection,
        count: counts.get(collection.id) || 0,
    }));
    try {
        return c.json(success(await decorateCollectionsWithSections(db, collections as AppStoreRecord[])));
    } catch (sectionError) {
        return c.json({ error: { code: 'DB_ERROR', message: sectionError instanceof Error ? sectionError.message : 'Collection section lookup failed' } }, 500);
    }
});

// GET /app-store/collections/:slug — Get a published collection and curated apps
router.get('/collections/:slug', async (c) => {
    const slug = c.req.param('slug');
    const db = getSupabaseAdmin(c);
    const { data: collection, error } = await db
        .from('app_collections')
        .select('id, slug, name, description, curation_type, disclosure, status, sort_order, created_at, updated_at')
        .eq('slug', slug)
        .eq('status', 'published')
        .is('deleted_at', null)
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    if (!collection) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, 404);
    }

    const { data: items, error: itemError } = await db
        .from('app_collection_items')
        .select('app_id, sort_order')
        .eq('collection_id', collection.id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (itemError) {
        return c.json({ error: { code: 'DB_ERROR', message: itemError.message } }, 500);
    }

    const appIds = (items || []).map((item) => item.app_id).filter((id): id is string => typeof id === 'string');
    if (appIds.length === 0) {
        return c.json(success(await decorateCollectionWithSections(db, { ...collection, count: 0, apps: [] } as AppStoreRecord)));
    }

    const { data: apps, error: appsError } = await db
        .from('marketplace_apps')
        .select(appPublicSelect({ includePricingPlans: false, includeCategoryGroupName: false }))
        .eq('status', 'published')
        .in('id', appIds);

    if (appsError) {
        return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
    }

    const decoratedApps = await decorateAppsWithParityData(db, decorateAppRecords((apps || []) as unknown as AppStoreRecord[]));
    const byId = new Map(decoratedApps.map((app) => [String(app.id), app]));
    const orderedApps = appIds.map((id) => byId.get(id)).filter((app): app is AppStoreRecord => Boolean(app));
    const collectionWithSections = await decorateCollectionWithSections(db, { ...collection, count: orderedApps.length, apps: orderedApps } as AppStoreRecord);
    return c.json(success(collectionWithSections));
});

// GET /app-store/featured — List active featured app placements
router.get('/featured', async (c) => {
    const placement = c.req.query('placement') || 'home_featured';
    const limit = normalizePositiveInt(c.req.query('limit'), 6, 24);
    const now = new Date().toISOString();
    const db = getSupabaseAdmin(c);
    const { data: placements, error } = await db
        .from('app_featured_placements')
        .select('app_id, disclosure, priority')
        .eq('placement_key', placement)
        .eq('status', 'active')
        .is('deleted_at', null)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('priority', { ascending: false })
        .limit(limit);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const appIds = (placements || []).map((item) => item.app_id).filter((id): id is string => typeof id === 'string');
    if (appIds.length === 0) {
        return c.json(success([]));
    }

    const { data: apps, error: appsError } = await db
        .from('marketplace_apps')
        .select(appPublicSelect({ includePricingPlans: false, includeCategoryGroupName: false }))
        .eq('status', 'published')
        .in('id', appIds);

    if (appsError) {
        return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
    }

    const disclosures = new Map((placements || []).map((item) => [String(item.app_id), item.disclosure]));
    const decoratedApps = await decorateAppsWithParityData(db, decorateAppRecords((apps || []) as unknown as AppStoreRecord[]));
    const byId = new Map<string, AppStoreRecord>(decoratedApps.map((app) => [String(app.id), {
        ...app,
        featured_disclosure: disclosures.get(String(app.id)) || null,
    } as AppStoreRecord]));
    return c.json(success(appIds.map((id) => byId.get(id)).filter((app): app is AppStoreRecord => Boolean(app))));
});

// GET /app-store/apps/:id/recommendations — Recommendations and alternatives for an app
router.get('/apps/:id/recommendations', async (c) => {
    const appId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    let appQuery = db
        .from('marketplace_apps')
        .select('id, slug, category_id, tags, compatibility_tags')
        .eq('status', 'published');
    appQuery = isUuid(appId) ? appQuery.eq('id', appId) : appQuery.eq('slug', appId);
    const { data: app, error } = await appQuery.maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    if (!app) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
    }

    const { data: alternatives, error: alternativesError } = await db
        .from('marketplace_apps')
        .select(appPublicSelect({ includePricingPlans: false, includeCategoryGroupName: false }))
        .eq('status', 'published')
        .eq('category_id', app.category_id)
        .neq('id', app.id)
        .order('rating_avg', { ascending: false })
        .order('install_count', { ascending: false })
        .limit(3);

    if (alternativesError) {
        return c.json({ error: { code: 'DB_ERROR', message: alternativesError.message } }, 500);
    }

    const compatibilityTags = Array.isArray(app.compatibility_tags)
        ? app.compatibility_tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
        : [];
    const tagSeed = compatibilityTags.length > 0
        ? compatibilityTags
        : (Array.isArray(app.tags) ? app.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0) : []);

    let alsoInstalled: AppStoreRecord[] = [];
    if (tagSeed.length > 0) {
        const { data: tagMatches, error: tagError } = await db
            .from('marketplace_apps')
            .select(appPublicSelect({ includePricingPlans: false, includeCategoryGroupName: false }))
            .eq('status', 'published')
            .neq('id', app.id)
            .overlaps('compatibility_tags', tagSeed)
            .order('install_count', { ascending: false })
            .limit(3);
        if (tagError) {
            return c.json({ error: { code: 'DB_ERROR', message: tagError.message } }, 500);
        }
        alsoInstalled = await decorateAppsWithParityData(db, decorateAppRecords((tagMatches || []) as unknown as AppStoreRecord[]));
    }

    return c.json(success({
        app_id: app.id,
        works_with: compatibilityTags,
        alternatives: await decorateAppsWithParityData(db, decorateAppRecords((alternatives || []) as unknown as AppStoreRecord[])),
        also_installed: alsoInstalled,
    }));
});

// POST /app-store/discovery/events — Record discovery/search/click analytics
router.post('/discovery/events', async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = AppDiscoveryEventInputSchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid discovery event' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('app_discovery_events')
        .insert({
            event_type: parsed.data.event_type,
            site_id: parsed.data.site_id || null,
            app_id: parsed.data.app_id || null,
            category_id: parsed.data.category_id || null,
            collection_id: parsed.data.collection_id || null,
            search_query: parsed.data.search_query || null,
            result_count: parsed.data.result_count ?? null,
            request_id: parsed.data.request_id || c.req.header('X-Request-ID') || null,
            metadata: parsed.data.metadata || {},
        })
        .select('id')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    if (data?.id) {
        try {
            const queued = await enqueueMarketplaceAnalyticsEvent({
                db,
                env: c.env,
                executionCtx: c.executionCtx,
                eventId: data.id,
                eventType: `marketplace.discovery.${parsed.data.event_type}`,
                siteId: parsed.data.site_id || null,
                aggregateType: parsed.data.app_id
                    ? 'marketplace_app'
                    : parsed.data.collection_id
                        ? 'app_collection'
                        : parsed.data.category_id
                            ? 'app_category'
                            : 'marketplace_discovery',
                aggregateId: parsed.data.app_id || parsed.data.collection_id || parsed.data.category_id || data.id,
                requestId: parsed.data.request_id || c.req.header('X-Request-ID') || null,
                idempotencyKey: `marketplace.discovery:${data.id}`,
                payload: {
                    discovery_event_id: data.id,
                    event_type: parsed.data.event_type,
                    app_id: parsed.data.app_id || null,
                    category_id: parsed.data.category_id || null,
                    collection_id: parsed.data.collection_id || null,
                    search_query: parsed.data.search_query || null,
                    result_count: parsed.data.result_count ?? null,
                    source: 'app-marketplace',
                    metadata: parsed.data.metadata || {},
                },
            });
            return c.json(success({ accepted: true, id: data.id, queued }), 201);
        } catch (queueError) {
            return c.json({
                error: {
                    code: 'ANALYTICS_QUEUE_ERROR',
                    message: queueError instanceof Error ? queueError.message : 'Discovery event queue enqueue failed',
                },
            }, 500);
        }
    }

    return c.json(success({ accepted: true, id: null, queued: false }), 201);
});

// GET /app-store/review-policies/:slug — Published review/economics policy content
router.get('/review-policies/:slug', async (c) => {
    const slug = c.req.param('slug');
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('app_review_policies')
        .select('id, slug, version, title, summary, sections, status, effective_at, created_at, updated_at')
        .eq('slug', slug)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('effective_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    if (!data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Review policy not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /app-store/partners — Public approved partner directory
router.get('/partners', async (c) => {
    const limit = normalizePositiveInt(c.req.query('limit'), 50, 100);
    const db = getSupabaseAdmin(c);
    const { data: developers, error } = await db
        .from('app_developers')
        .select('id, company_name, slug, website_url, support_email, logo_url, description, verified, status, country, created_at')
        .eq('status', 'approved')
        .order('company_name', { ascending: true })
        .limit(limit);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const developerIds = (developers || [])
        .map((developer) => typeof developer.id === 'string' ? developer.id : null)
        .filter((id): id is string => Boolean(id));
    let includeBuiltForLetbuyy = true;
    const buildDeveloperAppsQuery = () => db
        .from('marketplace_apps')
        .select(includeBuiltForLetbuyy ? 'developer_id, built_for_letbuyy, status' : 'developer_id, status')
        .eq('status', 'published')
        .in('developer_id', developerIds);
    let appsResult = developerIds.length > 0
        ? await buildDeveloperAppsQuery()
        : { data: [], error: null };

    if (appsResult.error && includeBuiltForLetbuyy && isMissingColumnError(appsResult.error, 'built_for_letbuyy')) {
        includeBuiltForLetbuyy = false;
        appsResult = await buildDeveloperAppsQuery();
    }

    const { data: apps, error: appsError } = appsResult;

    if (appsError) {
        return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
    }

    const appCounts = new Map<string, { published_apps: number; built_for_letbuyy_apps: number }>();
    for (const app of (apps || []) as unknown as AppStoreRecord[]) {
        if (typeof app.developer_id !== 'string') continue;
        const current = appCounts.get(app.developer_id) || { published_apps: 0, built_for_letbuyy_apps: 0 };
        current.published_apps += 1;
        if (includeBuiltForLetbuyy && app.built_for_letbuyy === true) current.built_for_letbuyy_apps += 1;
        appCounts.set(app.developer_id, current);
    }

    return c.json(success((developers || []).map((developer) => ({
        ...developer,
        ...(appCounts.get(developer.id) || { published_apps: 0, built_for_letbuyy_apps: 0 }),
    }))));
});

// GET /app-store/reviews/moderation — Ops-only review moderation queue
router.get('/reviews/moderation', authMiddleware, requireRoleCategory('ops'), requireSuperAdmin, async (c) => {
    const status = c.req.query('status');
    const limit = normalizePositiveInt(c.req.query('limit'), 50, 100);
    const db = getSupabaseAdmin(c);
    let query = db
        .from('app_reviews')
        .select('id, app_id, user_name, rating, title, body, status, fraud_score, fraud_flags, reported_count, moderation_reason, created_at, marketplace_apps(id, name, slug)')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status) {
        query = query.eq('status', status);
    } else {
        query = query.or('status.eq.flagged,reported_count.gt.0');
    }

    const { data, error } = await query;
    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ reviews: data || [] }));
});

// PATCH /app-store/reviews/:reviewId/moderation — Resolve a flagged or reported review
router.patch('/reviews/:reviewId/moderation', authMiddleware, requireRoleCategory('ops'), requireSuperAdmin, async (c) => {
    const auth = c.get('auth');
    const reviewId = c.req.param('reviewId');
    const raw = await c.req.json().catch(() => null);
    const action = typeof raw?.action === 'string' ? raw.action : '';
    const reason = stringOrNull(raw?.reason);
    const statusByAction: Record<string, 'published' | 'rejected' | 'flagged'> = {
        publish: 'published',
        dismiss: 'published',
        reject: 'rejected',
        flag: 'flagged',
    };
    const nextStatus = statusByAction[action];
    if (!nextStatus) {
        return c.json({ error: { code: 'VALIDATION', message: 'Unknown moderation action' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data, error } = await db
        .from('app_reviews')
        .update({
            status: nextStatus,
            moderation_reason: reason || (nextStatus === 'published' ? null : 'Marketplace moderation action applied.'),
            moderated_by: customUser.id,
            moderated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .select('id, app_id, user_name, rating, title, body, status, fraud_score, fraud_flags, reported_count, moderation_reason, created_at')
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    if (!data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
    }

    if (nextStatus !== 'flagged') {
        await db
            .from('app_review_reports')
            .update({
                status: nextStatus === 'published' ? 'dismissed' : 'actioned',
                updated_by: customUser.id,
                updated_at: new Date().toISOString(),
            })
            .eq('review_id', reviewId)
            .eq('status', 'open');
    }

    return c.json(success(data));
});

// GET /app-store/apps/:id — Get app details
router.get('/apps/:id', async (c) => {
    const appId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const detailFallbacks = {
        pricingPlans: false,
        categoryGroupName: false,
    };

    const buildDetailQuery = () => {
        let query = db
            .from('marketplace_apps')
            .select(appDetailSelect({
                includePricingPlans: !detailFallbacks.pricingPlans,
                includeCategoryGroupName: !detailFallbacks.categoryGroupName,
            }))
            .eq('status', 'published')
            .in('app_versions.status', ['released', 'approved', 'in_review'])
            .is('app_versions.deleted_at', null);

        if (!detailFallbacks.pricingPlans) {
            query = query
                .eq('app_pricing_plans.status', 'active')
                .is('app_pricing_plans.deleted_at', null);
        }

        return isUuid(appId) ? query.eq('id', appId) : query.eq('slug', appId);
    };

    let result = await buildDetailQuery().single();
    for (let attempts = 0; result.error && attempts < 2; attempts += 1) {
        if (!detailFallbacks.pricingPlans && isMissingAppPricingPlansRelation(result.error)) {
            detailFallbacks.pricingPlans = true;
            result = await buildDetailQuery().single();
            continue;
        }
        if (!detailFallbacks.categoryGroupName && isMissingColumnError(result.error, 'group_name')) {
            detailFallbacks.categoryGroupName = true;
            result = await buildDetailQuery().single();
            continue;
        }
        break;
    }

    const { data, error } = result;

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
    }

    const [enrichedApp] = await decorateAppsWithParityData(db, [decorateAppRecord({ ...(data as unknown as AppStoreRecord) })]);
    return c.json(success(enrichedApp));
});

// GET /app-store/apps/:id/reviews — List reviews
router.get('/apps/:id/reviews', async (c) => {
    const appId = c.req.param('id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    const { data, error, count } = await db
        .from('app_reviews')
        .select('*, app_review_proofs(id, review_id, app_id, site_id, installation_id, proof_type, proof_status, source, external_reference, metadata, created_at)', { count: 'exact' })
        .eq('app_id', appId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const enrichedReviews = await decorateReviewsWithProvenance(db, (data || []) as AppStoreRecord[]);
    return c.json(paginated(enrichedReviews, count || 0, page, limit));
});

// POST /app-store/apps/:id/awards — ops-owned award writer for data-backed marketplace badges
router.post('/apps/:id/awards', authMiddleware, requireRoleCategory('ops'), requireSuperAdmin, async (c) => {
    const appId = c.req.param('id');
    const raw = await c.req.json().catch(() => null);
    const parsed = AppAwardWriteSchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid award payload' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    let appQuery = db.from('marketplace_apps').select('id').is('deleted_at', null);
    appQuery = isUuid(appId) ? appQuery.eq('id', appId) : appQuery.eq('slug', appId);
    const { data: app, error: appError } = await appQuery.maybeSingle();
    if (appError) {
        return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
    }
    if (!app) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
    }

    const award = parsed.data;
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('app_awards')
        .upsert(
            {
                app_id: app.id,
                award_key: award.award_key,
                label: award.label,
                year: award.year,
                blurb: award.blurb || null,
                status: award.status,
                awarded_at: award.status === 'published' ? now : null,
                metadata: { ...(award.metadata || {}), source: 'ops_award_writer' },
                deleted_at: null,
            },
            { onConflict: 'app_id,award_key,year' }
        )
        .select('id, app_id, award_key, label, year, blurb, status, awarded_at, created_at, updated_at')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 200);
});

// DELETE /app-store/apps/:id/awards/:awardKey — ops soft-archive for marketplace awards
router.delete('/apps/:id/awards/:awardKey', authMiddleware, requireRoleCategory('ops'), requireSuperAdmin, async (c) => {
    const appId = c.req.param('id');
    const awardKey = c.req.param('awardKey');
    const parsedAwardKey = z.string().trim().min(2).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/).safeParse(awardKey);
    const parsedYear = c.req.query('year') ? z.coerce.number().int().min(2020).max(2100).safeParse(c.req.query('year')) : null;
    if (!parsedAwardKey.success || (parsedYear && !parsedYear.success)) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid award key or year' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    let appQuery = db.from('marketplace_apps').select('id').is('deleted_at', null);
    appQuery = isUuid(appId) ? appQuery.eq('id', appId) : appQuery.eq('slug', appId);
    const { data: app, error: appError } = await appQuery.maybeSingle();
    if (appError) {
        return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
    }
    if (!app) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
    }

    let updateQuery = db
        .from('app_awards')
        .update({ status: 'archived', deleted_at: new Date().toISOString() })
        .eq('app_id', app.id)
        .eq('award_key', parsedAwardKey.data)
        .is('deleted_at', null)
        .select('id, app_id, award_key, label, year, status, updated_at');

    if (parsedYear?.success) {
        updateQuery = updateQuery.eq('year', parsedYear.data);
    }

    const { data, error } = await updateQuery;
    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    if (!data || data.length === 0) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Award not found' } }, 404);
    }

    return c.json(success({ awards: data }));
});

// POST /app-store/apps/:id/review-summary/generate — ops hook for persisted merchant review summaries
router.post('/apps/:id/review-summary/generate', authMiddleware, requireRoleCategory('ops'), requireSuperAdmin, async (c) => {
    const appId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    try {
        const result = await buildReviewSummaryGenerationResult(db, appId);
        if (!result) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
        }
        return c.json(success(result), result.eligible ? 202 : 200);
    } catch (summaryError) {
        return c.json({ error: { code: 'DB_ERROR', message: summaryError instanceof Error ? summaryError.message : 'Review summary generation failed' } }, 500);
    }
});

// POST /app-store/apps/:id/reviews/:reviewId/reply — Developer reply to a review
router.post('/apps/:id/reviews/:reviewId/reply', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const reviewId = c.req.param('reviewId');
    const raw = await c.req.json().catch(() => null);
    const parsed = AppReviewReplyInputSchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid reply' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: app, error: appError } = await db
        .from('marketplace_apps')
        .select('id, developer_id, app_developers(user_id, status)')
        .eq('id', appId)
        .maybeSingle();

    if (appError) {
        return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
    }
    if (!app) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
    }
    if (appDeveloperOwnerId(app as AppStoreRecord) !== customUser.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Only the app developer can reply to reviews' } }, 403);
    }

    const { data, error } = await db
        .from('app_reviews')
        .update({
            developer_reply: parsed.data.developer_reply,
            developer_replied_at: new Date().toISOString(),
            developer_reply_by: customUser.id,
            updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .eq('app_id', appId)
        .eq('status', 'published')
        .select()
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    if (!data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /app-store/apps/:id/reviews/:reviewId/report — Report a review for moderation
router.post('/apps/:id/reviews/:reviewId/report', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const reviewId = c.req.param('reviewId');
    const raw = await c.req.json().catch(() => null);
    const parsed = AppTrustReportInputSchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid report' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (parsed.data.site_id) {
        const ownsStore = await verifySiteOwnership(db, parsed.data.site_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
        }
    }

    const { data: review, error: reviewError } = await db
        .from('app_reviews')
        .select('id, app_id')
        .eq('id', reviewId)
        .eq('app_id', appId)
        .maybeSingle();

    if (reviewError) {
        return c.json({ error: { code: 'DB_ERROR', message: reviewError.message } }, 500);
    }
    if (!review) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
    }

    const { data: existing } = await db
        .from('app_review_reports')
        .select('id, status')
        .eq('review_id', reviewId)
        .eq('reported_by', customUser.id)
        .eq('status', 'open')
        .is('deleted_at', null)
        .maybeSingle();

    let reportId = stringOrNull(existing?.id);
    if (!reportId) {
        const { data: report, error: insertError } = await db
            .from('app_review_reports')
            .insert({
                app_id: appId,
                review_id: reviewId,
                site_id: parsed.data.site_id || null,
                reported_by: customUser.id,
                reason_code: parsed.data.reason_code,
                reason_text: parsed.data.reason_text || null,
                metadata: parsed.data.metadata || {},
                created_by: customUser.id,
                updated_by: customUser.id,
            })
            .select('id')
            .single();

        if (insertError) {
            return c.json({ error: { code: 'DB_ERROR', message: insertError.message } }, 500);
        }
        reportId = report?.id || null;
    }

    const { data: reportRows } = await db
        .from('app_review_reports')
        .select('id')
        .eq('review_id', reviewId)
        .eq('status', 'open')
        .is('deleted_at', null);
    const reportedCount = reportRows?.length || 1;
    await db
        .from('app_reviews')
        .update({
            reported_count: reportedCount,
            ...(reportedCount >= 3 ? { status: 'flagged', moderation_reason: 'Multiple review reports submitted.' } : {}),
        })
        .eq('id', reviewId);

    if (parsed.data.site_id) {
        await db.from('app_activity_events').insert({
            site_id: parsed.data.site_id,
            app_id: appId,
            actor_id: customUser.id,
            event_type: 'report_submitted',
            summary: 'Review report submitted',
            metadata: { review_id: reviewId, report_id: reportId, reason_code: parsed.data.reason_code },
        });
    }

    return c.json(success({ accepted: true, report_id: reportId, status: 'open' }), 201);
});

// POST /app-store/apps/:id/report — Report a listing for moderation
router.post('/apps/:id/report', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const raw = await c.req.json().catch(() => null);
    const parsed = AppTrustReportInputSchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid report' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (parsed.data.site_id) {
        const ownsStore = await verifySiteOwnership(db, parsed.data.site_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
        }
    }

    const { data: app, error: appError } = await db
        .from('marketplace_apps')
        .select('id')
        .eq('id', appId)
        .maybeSingle();
    if (appError) {
        return c.json({ error: { code: 'DB_ERROR', message: appError.message } }, 500);
    }
    if (!app) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
    }

    const { data: existing } = await db
        .from('app_listing_reports')
        .select('id, status')
        .eq('app_id', appId)
        .eq('reported_by', customUser.id)
        .eq('status', 'open')
        .is('deleted_at', null)
        .maybeSingle();

    let reportId = stringOrNull(existing?.id);
    if (!reportId) {
        const { data: report, error: insertError } = await db
            .from('app_listing_reports')
            .insert({
                app_id: appId,
                site_id: parsed.data.site_id || null,
                reported_by: customUser.id,
                reason_code: parsed.data.reason_code,
                reason_text: parsed.data.reason_text || null,
                metadata: parsed.data.metadata || {},
                created_by: customUser.id,
                updated_by: customUser.id,
            })
            .select('id')
            .single();

        if (insertError) {
            return c.json({ error: { code: 'DB_ERROR', message: insertError.message } }, 500);
        }
        reportId = report?.id || null;
    }

    if (parsed.data.site_id) {
        await db.from('app_activity_events').insert({
            site_id: parsed.data.site_id,
            app_id: appId,
            actor_id: customUser.id,
            event_type: 'report_submitted',
            summary: 'Listing report submitted',
            metadata: { report_id: reportId, reason_code: parsed.data.reason_code },
        });
    }

    return c.json(success({ accepted: true, report_id: reportId, status: 'open' }), 201);
});

// POST /app-store/apps/:id/reviews — Submit a review
router.post('/apps/:id/reviews', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!body.rating || body.rating < 1 || body.rating > 5) {
        return c.json({ error: { code: 'VALIDATION', message: 'rating (1-5) is required' } }, 400);
    }

    if (body.store_id) {
        const ownsStore = await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
        }
    }

    // Require an active installation for this app before accepting a review
    // (verified-install reviews only — no drive-by ratings).
    let installationQuery = db
        .from('app_installations')
        .select('id, store_id')
        .eq('app_id', appId)
        .eq('installed_by', customUser.id)
        .eq('status', 'active');
    if (body.store_id) {
        installationQuery = installationQuery.eq('store_id', body.store_id);
    }
    const { data: installation } = await installationQuery.limit(1);

    if (!installation || installation.length === 0) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'You must have an active installation of this app to review it' } }, 403);
    }

    const isVerified = true;
    const reviewBody = stringOrNull(body.body);
    const duplicateQuery = reviewBody
        ? await db
            .from('app_reviews')
            .select('id')
            .eq('app_id', appId)
            .eq('body', reviewBody)
            .neq('user_id', customUser.id)
            .limit(5)
        : { data: [], error: null };
    if (duplicateQuery.error) {
        return c.json({ error: { code: 'DB_ERROR', message: duplicateQuery.error.message } }, 500);
    }
    const fraud = reviewFraudSignals(body, duplicateQuery.data?.length || 0);

    const { data, error } = await db
        .from('app_reviews')
        .upsert(
            {
                app_id: appId,
                user_id: customUser.id,
                store_id: body.store_id || null,
                user_name: customUser.full_name || customUser.email.split('@')[0] || 'Anonymous',
                rating: body.rating,
                title: body.title || null,
                body: reviewBody,
                is_verified: isVerified,
                verified_installation_id: installation[0]?.id || null,
                status: fraud.status,
                fraud_score: fraud.fraud_score,
                fraud_flags: fraud.fraud_flags,
                moderation_reason: fraud.moderation_reason,
            },
            { onConflict: 'app_id,user_id' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Update app's denormalized rating
    const { data: stats } = await db
        .from('app_reviews')
        .select('rating')
        .eq('app_id', appId)
        .eq('status', 'published');

    if (stats && stats.length > 0) {
        const avgRating = stats.reduce((sum, r) => sum + r.rating, 0) / stats.length;
        await db
            .from('marketplace_apps')
            .update({
                rating_avg: Math.round(avgRating * 100) / 100,
                review_count: stats.length,
            })
            .eq('id', appId);
    }

    const eventSiteId = stringOrNull(body.store_id) || stringOrNull(installation[0]?.store_id);
    const installId = stringOrNull(installation[0]?.id);
    if (installId) {
        const proofPayload = {
            review_id: data.id,
            app_id: appId,
            site_id: eventSiteId || null,
            installation_id: installId,
            proof_type: 'verified_install',
            proof_status: 'verified',
            source: 'letbuyy_installation',
            metadata: { store_id: eventSiteId || null, submitted_by: customUser.id },
        };
        const { data: existingProof } = await db
            .from('app_review_proofs')
            .select('id')
            .eq('review_id', data.id)
            .eq('installation_id', installId)
            .maybeSingle();
        if (existingProof?.id) {
            await db
                .from('app_review_proofs')
                .update({ ...proofPayload, deleted_at: null, updated_at: new Date().toISOString() })
                .eq('id', existingProof.id);
        } else {
            await db.from('app_review_proofs').insert(proofPayload);
        }
    }

    if (eventSiteId) {
        await db.from('app_activity_events').insert({
            site_id: eventSiteId,
            app_id: appId,
            installation_id: installation[0]?.id || null,
            actor_id: customUser.id,
            event_type: 'review_submitted',
            summary: fraud.status === 'flagged' ? 'Review submitted for moderation' : 'Review submitted',
            metadata: {
                review_id: data.id,
                rating: body.rating,
                fraud_score: fraud.fraud_score,
                fraud_flags: fraud.fraud_flags,
            },
        });
    }

    return c.json(success(data), 201);
});

// GET /app-store/installations/:id/activity — Merchant-facing app event history
router.get('/installations/:id/activity', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const installationId = c.req.param('id');
    const requestedStoreId = c.req.query('store_id');
    const limit = normalizePositiveInt(c.req.query('limit'), 50, 100);
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    let installQuery = db
        .from('app_installations')
        .select('id, app_id, store_id, installed_by')
        .eq('id', installationId)
        .eq('installed_by', customUser.id);
    if (requestedStoreId) installQuery = installQuery.eq('store_id', requestedStoreId);

    const { data: installation, error: installError } = await installQuery.maybeSingle();
    if (installError) {
        return c.json({ error: { code: 'DB_ERROR', message: installError.message } }, 500);
    }
    if (!installation) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Installation not found' } }, 404);
    }

    const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }

    const { data, error } = await db
        .from('app_activity_events')
        .select('id, site_id, app_id, installation_id, actor_id, event_type, summary, metadata, created_at')
        .eq('site_id', installation.store_id)
        .eq('app_id', installation.app_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ events: data || [] }));
});

registerAppStoreExtensionRoutes(router);

registerAppStoreBillingOAuthRoutes(router);

registerAppStoreInstallLifecycleRoutes(router);

registerAppStoreComplianceRoutes(router);

registerAppStoreAppLifecycleRoutes(router);

registerAppStoreDeveloperToolingRoutes(router);

registerAppStoreDeveloperRoutes(router);

registerAppStoreGrowthRoutes(router);

export default router;
