import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';

export type AppStoreRecord = Record<string, unknown>;

interface FeatureTagRecord extends AppStoreRecord {
    id: string;
    group_id: string;
    handle: string;
    label: string;
    description?: string | null;
    display_order?: number | null;
}

interface FeatureGroupRecord extends AppStoreRecord {
    id: string;
    category_id: string;
    handle: string;
    label: string;
    description?: string | null;
    display_order?: number | null;
}

interface FeatureAssignmentRecord extends AppStoreRecord {
    app_id: string;
    feature_tag_id: string;
}

interface CollectionSectionRecord extends AppStoreRecord {
    id: string;
    collection_id: string;
    section_type: string;
    sort_order: number;
}

interface StoreProvenanceRecord extends AppStoreRecord {
    id: string;
    name?: string | null;
    store_name?: string | null;
    locale?: string | null;
    gst_state_code?: string | null;
}

interface InstallationProvenanceRecord extends AppStoreRecord {
    id: string;
    app_id: string;
    store_id: string;
    installed_at?: string | null;
}

export interface ReviewSummaryGenerationResult extends AppStoreRecord {
    eligible: boolean;
    generated: boolean;
    reason?: string;
    summary?: string | null;
    existing_summary?: AppStoreRecord | null;
    eligibility_snapshot: AppStoreRecord;
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrZero(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueStrings(values: Iterable<string | null | undefined>): string[] {
    return Array.from(new Set(Array.from(values).filter((value): value is string => Boolean(value))));
}

export function normalizeFeatureHandles(values: Array<string | string[] | null | undefined>): string[] {
    const handles = values.flatMap((value) => {
        if (Array.isArray(value)) return value;
        return value ? value.split(',') : [];
    });

    return uniqueStrings(handles.map((handle) => {
        const normalized = handle.trim().toLowerCase();
        return /^[a-z0-9][a-z0-9-]{1,120}$/.test(normalized) ? normalized : null;
    })).slice(0, 24);
}

export async function getFeatureFilteredAppIds(
    db: SupabaseClient,
    selectedHandles: string[],
): Promise<string[] | null> {
    const handles = normalizeFeatureHandles(selectedHandles);
    if (handles.length === 0) return null;

    const { data: tags, error: tagError } = await db
        .from('app_feature_tags')
        .select('id, handle')
        .in('handle', handles)
        .eq('status', 'published')
        .is('deleted_at', null);

    if (tagError) throw new Error(tagError.message);

    const tagRows = (tags || []) as Array<{ id?: unknown; handle?: unknown }>;
    const tagIds = uniqueStrings(tagRows.map((tag) => stringOrNull(tag.id)));
    const foundHandles = new Set(tagRows.map((tag) => stringOrNull(tag.handle)).filter((handle): handle is string => Boolean(handle)));
    if (tagIds.length === 0 || handles.some((handle) => !foundHandles.has(handle))) return [];

    const { data: assignments, error: assignmentError } = await db
        .from('app_feature_tag_assignments')
        .select('app_id, feature_tag_id')
        .in('feature_tag_id', tagIds)
        .is('deleted_at', null);

    if (assignmentError) throw new Error(assignmentError.message);

    const selected = new Set(tagIds);
    const tagMatchesByApp = new Map<string, Set<string>>();
    for (const row of (assignments || []) as Array<{ app_id?: unknown; feature_tag_id?: unknown }>) {
        const appId = stringOrNull(row.app_id);
        const tagId = stringOrNull(row.feature_tag_id);
        if (!appId || !tagId || !selected.has(tagId)) continue;
        const current = tagMatchesByApp.get(appId) || new Set<string>();
        current.add(tagId);
        tagMatchesByApp.set(appId, current);
    }

    return Array.from(tagMatchesByApp.entries())
        .filter(([, matchedTags]) => matchedTags.size === selected.size)
        .map(([appId]) => appId);
}

export async function getCategoryFeatureGroups(
    db: SupabaseClient,
    categorySlugOrId: string,
    selectedHandles: string[] = [],
): Promise<AppStoreRecord[]> {
    const selected = new Set(normalizeFeatureHandles(selectedHandles));
    let categoryQuery = db
        .from('app_categories')
        .select('id, slug, name')
        .eq('is_active', true);
    categoryQuery = /^[0-9a-f-]{36}$/i.test(categorySlugOrId)
        ? categoryQuery.eq('id', categorySlugOrId)
        : categoryQuery.eq('slug', categorySlugOrId);

    const { data: category, error: categoryError } = await categoryQuery.maybeSingle();
    if (categoryError) throw new Error(categoryError.message);
    if (!category?.id) return [];

    const categoryId = String(category.id);
    const { data: groups, error: groupsError } = await db
        .from('app_feature_groups')
        .select('id, category_id, handle, label, description, display_order')
        .eq('category_id', categoryId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .order('label', { ascending: true });

    if (groupsError) throw new Error(groupsError.message);
    const groupRows = ((groups || []) as FeatureGroupRecord[]).filter((group) => stringOrNull(group.id));
    if (groupRows.length === 0) return [];

    const groupIds = groupRows.map((group) => group.id);
    const { data: tags, error: tagsError } = await db
        .from('app_feature_tags')
        .select('id, group_id, handle, label, description, display_order')
        .in('group_id', groupIds)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .order('label', { ascending: true });

    if (tagsError) throw new Error(tagsError.message);
    const tagRows = ((tags || []) as FeatureTagRecord[]).filter((tag) => stringOrNull(tag.id));
    if (tagRows.length === 0) return [];

    const tagIds = tagRows.map((tag) => tag.id);
    const { data: apps, error: appsError } = await db
        .from('marketplace_apps')
        .select('id')
        .eq('status', 'published')
        .eq('category_id', categoryId);

    if (appsError) throw new Error(appsError.message);
    const appIds = uniqueStrings(((apps || []) as Array<{ id?: unknown }>).map((app) => stringOrNull(app.id)));

    const counts = new Map<string, Set<string>>();
    if (appIds.length > 0) {
        const { data: assignments, error: assignmentsError } = await db
            .from('app_feature_tag_assignments')
            .select('app_id, feature_tag_id')
            .in('feature_tag_id', tagIds)
            .in('app_id', appIds)
            .is('deleted_at', null);

        if (assignmentsError) throw new Error(assignmentsError.message);
        for (const row of (assignments || []) as FeatureAssignmentRecord[]) {
            const appId = stringOrNull(row.app_id);
            const tagId = stringOrNull(row.feature_tag_id);
            if (!appId || !tagId) continue;
            const current = counts.get(tagId) || new Set<string>();
            current.add(appId);
            counts.set(tagId, current);
        }
    }

    const tagsByGroup = new Map<string, AppStoreRecord[]>();
    for (const tag of tagRows) {
        const count = counts.get(tag.id)?.size || 0;
        const groupTags = tagsByGroup.get(tag.group_id) || [];
        groupTags.push({
            ...tag,
            count,
            selected: selected.has(tag.handle),
        });
        tagsByGroup.set(tag.group_id, groupTags);
    }

    return groupRows
        .map((group) => ({
            ...group,
            category_id: categoryId,
            category_slug: stringOrNull(category.slug),
            tags: tagsByGroup.get(group.id) || [],
        }))
        .filter((group) => Array.isArray(group.tags) && group.tags.length > 0);
}

export async function decorateAppsWithParityData(
    db: SupabaseClient,
    apps: AppStoreRecord[],
): Promise<AppStoreRecord[]> {
    if (apps.length === 0) return [];

    const appIds = uniqueStrings(apps.map((app) => stringOrNull(app.id)));
    if (appIds.length === 0) return apps;

    const [features, awards, summaries, featuredIn] = await Promise.all([
        fetchAppFeatureGroups(db, appIds),
        fetchAwardsByApp(db, appIds),
        fetchReviewSummariesByApp(db, appIds),
        fetchFeaturedInByApp(db, appIds),
    ]);

    return apps.map((app) => {
        const appId = stringOrNull(app.id);
        if (!appId) return app;
        const appAwards = awards.get(appId) || [];
        const builtForAward = appAwards.some((award) => stringOrNull(award.award_key) === 'built_for_letbuyy');
        return {
            ...app,
            feature_groups: features.groupsByApp.get(appId) || [],
            feature_tags: features.tagsByApp.get(appId) || [],
            awards: appAwards,
            app_awards: appAwards,
            app_review_summary: summaries.get(appId) || null,
            featured_in: featuredIn.get(appId) || [],
            built_for_letbuyy: builtForAward ? true : app.built_for_letbuyy,
        };
    });
}

export async function decorateCollectionWithSections(
    db: SupabaseClient,
    collection: AppStoreRecord,
): Promise<AppStoreRecord> {
    const collectionId = stringOrNull(collection.id);
    if (!collectionId) return { ...collection, sections: [] };

    const { data, error } = await db
        .from('app_collection_sections')
        .select('id, collection_id, section_type, heading, body, media_url, app_id, cta_label, cta_href, sort_order, metadata, created_at, updated_at')
        .eq('collection_id', collectionId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return {
        ...collection,
        sections: (data || []) as CollectionSectionRecord[],
    };
}

export async function decorateCollectionsWithSections(
    db: SupabaseClient,
    collections: AppStoreRecord[],
): Promise<AppStoreRecord[]> {
    if (collections.length === 0) return [];
    const collectionIds = uniqueStrings(collections.map((collection) => stringOrNull(collection.id)));
    if (collectionIds.length === 0) return collections.map((collection) => ({ ...collection, sections: [] }));

    const { data, error } = await db
        .from('app_collection_sections')
        .select('id, collection_id, section_type, heading, body, media_url, app_id, cta_label, cta_href, sort_order, metadata, created_at, updated_at')
        .in('collection_id', collectionIds)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);

    const sectionsByCollection = new Map<string, CollectionSectionRecord[]>();
    for (const section of (data || []) as CollectionSectionRecord[]) {
        const collectionId = stringOrNull(section.collection_id);
        if (!collectionId) continue;
        const sections = sectionsByCollection.get(collectionId) || [];
        sections.push(section);
        sectionsByCollection.set(collectionId, sections);
    }

    return collections.map((collection) => {
        const collectionId = stringOrNull(collection.id);
        return {
            ...collection,
            sections: collectionId ? sectionsByCollection.get(collectionId) || [] : [],
        };
    });
}

export async function decorateReviewsWithProvenance(
    db: SupabaseClient,
    reviews: AppStoreRecord[],
): Promise<AppStoreRecord[]> {
    if (reviews.length === 0) return [];

    const proofRows = reviews.flatMap((review) => Array.isArray(review.app_review_proofs) ? review.app_review_proofs as AppStoreRecord[] : []);
    const storeIds = uniqueStrings([
        ...reviews.map((review) => stringOrNull(review.store_id)),
        ...proofRows.map((proof) => stringOrNull(proof.site_id)),
    ]);
    const installationIds = uniqueStrings([
        ...reviews.map((review) => stringOrNull(review.verified_installation_id)),
        ...proofRows.map((proof) => stringOrNull(proof.installation_id)),
    ]);
    const appIds = uniqueStrings(reviews.map((review) => stringOrNull(review.app_id)));

    const [stores, installationsById, installationsByAppStore] = await Promise.all([
        fetchStoresById(db, storeIds),
        fetchInstallationsById(db, installationIds),
        fetchInstallationsByAppStore(db, appIds, storeIds),
    ]);

    return reviews.map((review) => {
        const proof = Array.isArray(review.app_review_proofs)
            ? (review.app_review_proofs as AppStoreRecord[]).find((item) => stringOrNull(item.installation_id) || stringOrNull(item.site_id))
            : null;
        const storeId = stringOrNull(review.store_id) || stringOrNull(proof?.site_id);
        const installId = stringOrNull(review.verified_installation_id) || stringOrNull(proof?.installation_id);
        const appId = stringOrNull(review.app_id);
        const store = storeId ? stores.get(storeId) || null : null;
        const installation = installId
            ? installationsById.get(installId) || null
            : (appId && storeId ? installationsByAppStore.get(`${appId}:${storeId}`) || null : null);
        const countryCode = store ? countryCodeFromStore(store) : null;
        const countryLabel = countryCode ? countryName(countryCode) : null;
        const installedAt = stringOrNull(installation?.installed_at);
        const duration = installedAt ? formatUsageDuration(installedAt, stringOrNull(review.created_at)) : null;

        return {
            ...review,
            store_name: stringOrNull(review.store_name) || stringOrNull(store?.store_name) || stringOrNull(store?.name),
            store_country: countryLabel,
            country: countryLabel,
            country_code: countryCode,
            installed_at: installedAt,
            duration_using_app: duration,
            usage_duration: duration,
        };
    });
}

export async function buildReviewSummaryGenerationResult(
    db: SupabaseClient,
    appIdOrSlug: string,
): Promise<ReviewSummaryGenerationResult | null> {
    let appQuery = db
        .from('marketplace_apps')
        .select('id, slug, name, rating_avg, review_count')
        .eq('status', 'published');
    appQuery = /^[0-9a-f-]{36}$/i.test(appIdOrSlug) ? appQuery.eq('id', appIdOrSlug) : appQuery.eq('slug', appIdOrSlug);

    const { data: app, error } = await appQuery.maybeSingle();
    if (error) throw new Error(error.message);
    if (!app?.id) return null;

    const appId = String(app.id);
    const rating = numberOrZero(app.rating_avg);
    const reviewCount = numberOrZero(app.review_count);
    const eligibilitySnapshot = {
        app_id: appId,
        rating_avg: rating,
        review_count: reviewCount,
        threshold: { review_count: 100, rating_avg: 4 },
        evaluated_at: new Date().toISOString(),
    };

    const { data: existingSummary, error: summaryError } = await db
        .from('app_review_summaries')
        .select('id, app_id, summary, source, model, eligibility_snapshot, generated_at, status, created_at, updated_at')
        .eq('app_id', appId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .maybeSingle();
    if (summaryError) throw new Error(summaryError.message);

    if (existingSummary?.summary) {
        return {
            eligible: reviewCount >= 100 && rating >= 4,
            generated: false,
            reason: 'existing_summary',
            summary: String(existingSummary.summary),
            existing_summary: existingSummary as AppStoreRecord,
            eligibility_snapshot: eligibilitySnapshot,
        };
    }

    if (reviewCount < 100 || rating < 4) {
        return {
            eligible: false,
            generated: false,
            reason: 'requires_100_reviews_and_4_rating',
            summary: null,
            existing_summary: null,
            eligibility_snapshot: eligibilitySnapshot,
        };
    }

    return {
        eligible: true,
        generated: false,
        reason: 'SKIPPED_HUMAN_APPROVAL_AI_PROVIDER_KEYS',
        summary: null,
        existing_summary: null,
        eligibility_snapshot: eligibilitySnapshot,
    };
}

async function fetchAppFeatureGroups(db: SupabaseClient, appIds: string[]) {
    const tagsByApp = new Map<string, AppStoreRecord[]>();
    const groupsByApp = new Map<string, AppStoreRecord[]>();

    const { data: assignments, error: assignmentError } = await db
        .from('app_feature_tag_assignments')
        .select('app_id, feature_tag_id')
        .in('app_id', appIds)
        .is('deleted_at', null);
    if (assignmentError) throw new Error(assignmentError.message);

    const assignmentRows = ((assignments || []) as FeatureAssignmentRecord[])
        .filter((assignment) => stringOrNull(assignment.app_id) && stringOrNull(assignment.feature_tag_id));
    const tagIds = uniqueStrings(assignmentRows.map((assignment) => assignment.feature_tag_id));
    if (tagIds.length === 0) return { tagsByApp, groupsByApp };

    const { data: tags, error: tagError } = await db
        .from('app_feature_tags')
        .select('id, group_id, handle, label, description, display_order')
        .in('id', tagIds)
        .eq('status', 'published')
        .is('deleted_at', null);
    if (tagError) throw new Error(tagError.message);

    const tagRows = ((tags || []) as FeatureTagRecord[]).filter((tag) => stringOrNull(tag.id));
    const groupIds = uniqueStrings(tagRows.map((tag) => tag.group_id));
    const { data: groups, error: groupError } = groupIds.length > 0
        ? await db
            .from('app_feature_groups')
            .select('id, category_id, handle, label, description, display_order')
            .in('id', groupIds)
            .eq('status', 'published')
            .is('deleted_at', null)
        : { data: [], error: null };
    if (groupError) throw new Error(groupError.message);

    const tagById = new Map(tagRows.map((tag) => [tag.id, tag]));
    const groupById = new Map(((groups || []) as FeatureGroupRecord[]).map((group) => [group.id, group]));
    const tagsForGroupByApp = new Map<string, Map<string, AppStoreRecord[]>>();

    for (const assignment of assignmentRows) {
        const tag = tagById.get(assignment.feature_tag_id);
        if (!tag) continue;
        const appTags = tagsByApp.get(assignment.app_id) || [];
        appTags.push(tag);
        tagsByApp.set(assignment.app_id, appTags);

        const appGroups = tagsForGroupByApp.get(assignment.app_id) || new Map<string, AppStoreRecord[]>();
        const groupTags = appGroups.get(tag.group_id) || [];
        groupTags.push(tag);
        appGroups.set(tag.group_id, groupTags);
        tagsForGroupByApp.set(assignment.app_id, appGroups);
    }

    for (const [appId, tagGroups] of tagsForGroupByApp.entries()) {
        const appGroups: AppStoreRecord[] = [];
        for (const [groupId, groupTags] of tagGroups.entries()) {
            const group = groupById.get(groupId);
            if (!group) continue;
            appGroups.push({
                ...group,
                tags: groupTags.sort((a, b) => numberOrZero(a.display_order) - numberOrZero(b.display_order)),
            });
        }
        appGroups.sort((a, b) => numberOrZero(a.display_order) - numberOrZero(b.display_order));
        groupsByApp.set(appId, appGroups);
    }

    return { tagsByApp, groupsByApp };
}

async function fetchAwardsByApp(db: SupabaseClient, appIds: string[]): Promise<Map<string, AppStoreRecord[]>> {
    const awardsByApp = new Map<string, AppStoreRecord[]>();
    const { data, error } = await db
        .from('app_awards')
        .select('id, app_id, award_key, label, year, blurb, awarded_at, metadata, created_at, updated_at')
        .in('app_id', appIds)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('awarded_at', { ascending: false });
    if (error) throw new Error(error.message);

    for (const award of (data || []) as AppStoreRecord[]) {
        const appId = stringOrNull(award.app_id);
        if (!appId) continue;
        const awards = awardsByApp.get(appId) || [];
        awards.push(award);
        awardsByApp.set(appId, awards);
    }
    return awardsByApp;
}

async function fetchReviewSummariesByApp(db: SupabaseClient, appIds: string[]): Promise<Map<string, AppStoreRecord>> {
    const summariesByApp = new Map<string, AppStoreRecord>();
    const { data, error } = await db
        .from('app_review_summaries')
        .select('id, app_id, summary, source, model, eligibility_snapshot, generated_at, created_at, updated_at')
        .in('app_id', appIds)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('generated_at', { ascending: false });
    if (error) throw new Error(error.message);

    for (const summary of (data || []) as AppStoreRecord[]) {
        const appId = stringOrNull(summary.app_id);
        if (!appId || summariesByApp.has(appId)) continue;
        summariesByApp.set(appId, summary);
    }
    return summariesByApp;
}

async function fetchFeaturedInByApp(db: SupabaseClient, appIds: string[]): Promise<Map<string, AppStoreRecord[]>> {
    const featuredByApp = new Map<string, AppStoreRecord[]>();
    const { data: items, error: itemError } = await db
        .from('app_collection_items')
        .select('app_id, collection_id, sort_order')
        .in('app_id', appIds)
        .is('deleted_at', null);
    if (itemError) throw new Error(itemError.message);

    const itemRows = ((items || []) as Array<{ app_id?: unknown; collection_id?: unknown; sort_order?: unknown }>)
        .filter((item) => stringOrNull(item.app_id) && stringOrNull(item.collection_id));
    const collectionIds = uniqueStrings(itemRows.map((item) => stringOrNull(item.collection_id)));
    if (collectionIds.length === 0) return featuredByApp;

    const { data: collections, error: collectionError } = await db
        .from('app_collections')
        .select('id, slug, name, description, curation_type, disclosure, status, sort_order, created_at, updated_at')
        .in('id', collectionIds)
        .eq('status', 'published')
        .is('deleted_at', null);
    if (collectionError) throw new Error(collectionError.message);

    const collectionById = new Map(((collections || []) as AppStoreRecord[]).map((collection) => [stringOrNull(collection.id), collection]));
    for (const item of itemRows) {
        const appId = stringOrNull(item.app_id);
        const collectionId = stringOrNull(item.collection_id);
        const collection = collectionId ? collectionById.get(collectionId) : null;
        if (!appId || !collection) continue;
        const appCollections = featuredByApp.get(appId) || [];
        appCollections.push(collection);
        featuredByApp.set(appId, appCollections);
    }

    return featuredByApp;
}

async function fetchStoresById(db: SupabaseClient, storeIds: string[]): Promise<Map<string, StoreProvenanceRecord>> {
    if (storeIds.length === 0) return new Map();
    const { data, error } = await db
        .from('sites')
        .select('id, name, store_name, locale, gst_state_code')
        .in('id', storeIds)
        .is('deleted_at', null);
    if (error) throw new Error(error.message);
    return new Map(((data || []) as StoreProvenanceRecord[]).map((store) => [store.id, store]));
}

async function fetchInstallationsById(db: SupabaseClient, installationIds: string[]): Promise<Map<string, InstallationProvenanceRecord>> {
    if (installationIds.length === 0) return new Map();
    const { data, error } = await db
        .from('app_installations')
        .select('id, app_id, store_id, installed_at')
        .in('id', installationIds);
    if (error) throw new Error(error.message);
    return new Map(((data || []) as InstallationProvenanceRecord[]).map((installation) => [installation.id, installation]));
}

async function fetchInstallationsByAppStore(
    db: SupabaseClient,
    appIds: string[],
    storeIds: string[],
): Promise<Map<string, InstallationProvenanceRecord>> {
    if (appIds.length === 0 || storeIds.length === 0) return new Map();
    const { data, error } = await db
        .from('app_installations')
        .select('id, app_id, store_id, installed_at')
        .in('app_id', appIds)
        .in('store_id', storeIds)
        .order('installed_at', { ascending: true });
    if (error) throw new Error(error.message);

    const byAppStore = new Map<string, InstallationProvenanceRecord>();
    for (const installation of (data || []) as InstallationProvenanceRecord[]) {
        const key = `${installation.app_id}:${installation.store_id}`;
        if (!byAppStore.has(key)) byAppStore.set(key, installation);
    }
    return byAppStore;
}

function countryCodeFromStore(store: StoreProvenanceRecord): string | null {
    const locale = stringOrNull(store.locale);
    const localeCountry = locale?.match(/[-_]([A-Za-z]{2})$/)?.[1]?.toUpperCase() || null;
    if (localeCountry) return localeCountry;
    return stringOrNull(store.gst_state_code) ? 'IN' : null;
}

function countryName(countryCode: string): string {
    if (countryCode === 'IN') return 'India';
    if (countryCode === 'US') return 'United States';
    if (countryCode === 'GB') return 'United Kingdom';
    return countryCode;
}

function formatUsageDuration(installedAt: string, comparedAt: string | null): string | null {
    const start = new Date(installedAt).getTime();
    const end = comparedAt ? new Date(comparedAt).getTime() : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    const days = Math.max(0, Math.floor((end - start) / 86_400_000));
    const years = Math.floor(days / 365);
    if (years >= 2) return `Over ${years} years using the app`;
    if (years === 1) return 'Over 1 year using the app';
    const months = Math.floor(days / 30);
    if (months >= 2) return `Over ${months} months using the app`;
    if (months === 1) return 'Over 1 month using the app';
    return 'Less than 1 month using the app';
}
