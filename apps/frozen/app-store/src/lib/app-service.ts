import 'server-only';

import { createAppMarketplaceApiClient } from '@/lib/api/client';
import { APP_CATEGORIES } from '@/lib/constants/categories';
import { sanitizeMarketplaceSearchQuery } from '@/lib/marketplace-display';
import type {
    AppDiscoveryEventInput,
    AppRequestInput,
    AppBundle,
    AppTelemetryEventInput,
    AppSavedAppsResult,
    AppSavedAppInput,
    MarketplaceApp,
    MarketplaceAppAward,
    MarketplaceAppCategory,
    MarketplaceAppCollection,
    MarketplaceAppFeatureGroup,
    MarketplaceAppRecommendations,
    MarketplaceAppReview,
    AppActivityEvent,
    AppReviewPolicy,
    MarketplaceAppDeveloper,
} from '@letbuyy/shared-types';

export class MarketplaceUnavailableError extends Error {
    constructor(message = 'The app catalog is temporarily unavailable. Please try again.') {
        super(message);
        this.name = 'MarketplaceUnavailableError';
    }
}

export type MarketplaceResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: MarketplaceUnavailableError };

export interface AppFilters {
    category?: string;
    collection?: string;
    featured?: boolean;
    builtForLetbuyy?: boolean;
    sort?: 'popular' | 'rating' | 'recent' | 'name';
    pricingModel?: string;
    ratingMin?: string | number;
    siteType?: string;
    featureHandles?: string[];
    limit?: number;
    offset?: number;
}

export interface AppSearchResult {
    apps: MarketplaceApp[];
    total: number;
    limit: number;
    offset: number;
}

export interface AppAwardWritePayload extends Record<string, unknown> {
    award_key: string;
    label: string;
    year?: number | string;
    blurb?: string | null;
    status?: 'draft' | 'published' | 'archived';
    metadata?: Record<string, unknown>;
}

async function getAppStoreApi(requireSession = false) {
    try {
        return await createAppMarketplaceApiClient({ requireSession });
    } catch {
        return null;
    }
}

function appendIfPresent(params: URLSearchParams, key: string, value: string | number | undefined) {
    if (value !== undefined && value !== '') {
        params.set(key, String(value));
    }
}

function normalizedFeatureHandles(values: string[] | undefined): string[] {
    return Array.from(new Set((values || [])
        .map((value) => value.trim().toLowerCase())
        .filter((value) => /^[a-z0-9][a-z0-9-]{1,120}$/.test(value))))
        .slice(0, 24);
}

export const AppService = {
    async listApps(filters: AppFilters = {}): Promise<MarketplaceResult<AppSearchResult>> {
        const limit = filters.limit ?? 20;
        const offset = filters.offset ?? 0;
        const page = Math.floor(offset / limit) + 1;
        const api = await getAppStoreApi();
        if (!api) return { ok: false, error: new MarketplaceUnavailableError() };

        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            sort: filters.sort || 'popular',
        });

        appendIfPresent(params, 'category', filters.category);
        appendIfPresent(params, 'collection', filters.collection);
        appendIfPresent(params, 'pricing', filters.pricingModel);
        appendIfPresent(params, 'rating_min', filters.ratingMin);
        appendIfPresent(params, 'site_type', filters.siteType);
        if (filters.featured) params.set('featured', 'true');
        if (filters.builtForLetbuyy) params.set('built_for_letbuyy', 'true');

        try {
            const query: Record<string, string | string[]> = Object.fromEntries(params.entries());
            const featureHandles = normalizedFeatureHandles(filters.featureHandles);
            if (featureHandles.length > 0) query['feature_handles[]'] = featureHandles;
            const catalog = await api.appStore.apps(query);
            return {
                ok: true,
                value: { apps: catalog.data, total: catalog.total, limit: catalog.limit, offset },
            };
        } catch {
            return { ok: false, error: new MarketplaceUnavailableError() };
        }
    },

    async searchApps(
        query: string,
        category?: string,
        limit = 20,
        filters: Pick<AppFilters, 'sort' | 'pricingModel'> = {},
        offset = 0,
        ratingMin?: string | number,
        builtForLetbuyy?: boolean,
        featureHandlesInput?: string[],
    ): Promise<MarketplaceResult<AppSearchResult>> {
        const api = await getAppStoreApi();
        if (!api) return { ok: false, error: new MarketplaceUnavailableError() };
        const safeQuery = sanitizeMarketplaceSearchQuery(query);
        const page = Math.floor(offset / limit) + 1;

        const params = new URLSearchParams({
            search: safeQuery,
            limit: String(limit),
            page: String(page),
            sort: filters.sort || 'popular',
        });
        appendIfPresent(params, 'category', category);
        appendIfPresent(params, 'pricing', filters.pricingModel);
        appendIfPresent(params, 'rating_min', ratingMin);
        if (builtForLetbuyy) params.set('built_for_letbuyy', 'true');

        try {
            const queryParams: Record<string, string | string[]> = Object.fromEntries(params.entries());
            const featureHandles = normalizedFeatureHandles(featureHandlesInput);
            if (featureHandles.length > 0) queryParams['feature_handles[]'] = featureHandles;
            const catalog = await api.appStore.apps(queryParams);
            return {
                ok: true,
                value: { apps: catalog.data, total: catalog.total, limit: catalog.limit, offset },
            };
        } catch {
            return { ok: false, error: new MarketplaceUnavailableError() };
        }
    },

    async getAppBySlug(slug: string): Promise<MarketplaceApp | null> {
        const api = await getAppStoreApi();
        if (!api) return null;

        return api.appStore.app(slug).catch(() => null);
    },

    async getAppReviews(appId: string, limit = 10, offset = 0): Promise<{ reviews: MarketplaceAppReview[]; total: number }> {
        const api = await getAppStoreApi();
        if (!api) return { reviews: [], total: 0 };

        const page = Math.floor(offset / limit) + 1;
        const result = await api.appStore.reviews(appId, { page, limit }).catch(() => null);
        return { reviews: result?.data || [], total: result?.total || 0 };
    },

    async getCategories(): Promise<MarketplaceAppCategory[]> {
        const api = await getAppStoreApi();
        if (!api) return [];

        return api.appStore.categories().catch(() => []);
    },

    async getCategoryFeatureFacets(categorySlug: string, selectedHandles: string[] = []): Promise<MarketplaceAppFeatureGroup[]> {
        const api = await getAppStoreApi();
        if (!api) return [];

        const featureHandles = normalizedFeatureHandles(selectedHandles);
        return api.appStore.featureFacets(
            categorySlug,
            featureHandles.length > 0 ? { 'feature_handles[]': featureHandles } : undefined,
        ).catch(() => []);
    },

    async getCollections(): Promise<MarketplaceAppCollection[]> {
        const api = await getAppStoreApi();
        if (!api) return [];

        return api.appStore.collections().catch(() => []);
    },

    async getCollection(slug: string): Promise<MarketplaceAppCollection | null> {
        const api = await getAppStoreApi();
        if (!api) return null;

        return api.appStore.collection(slug).catch(() => null);
    },

    async getFeaturedApps(limit = 6): Promise<MarketplaceApp[]> {
        const api = await getAppStoreApi();
        if (!api) return [];

        return api.appStore.featured({ limit, placement: 'home_featured' }).catch(() => []);
    },

    async getNewThisWeekApps(limit = 6): Promise<MarketplaceApp[]> {
        const api = await getAppStoreApi();
        if (!api) return [];

        return api.appStore.newThisWeek({ limit }).catch(() => []);
    },

    async getBundles(limit = 4): Promise<AppBundle[]> {
        const api = await getAppStoreApi();
        if (!api) return [];

        return api.appStore.bundles({ limit }).catch(() => []);
    },

    async requestApp(input: AppRequestInput): Promise<boolean> {
        const api = await getAppStoreApi();
        if (!api) return false;

        return api.appStore.requestApp(input).then(() => true).catch(() => false);
    },

    async getSavedApps(siteId?: string | null): Promise<AppSavedAppsResult> {
        const api = await getAppStoreApi(true);
        if (!api) return { saved_apps: [], apps: [] };

        return api.appStore.savedApps(siteId ? { store_id: siteId } : undefined).catch(() => ({ saved_apps: [], apps: [] }));
    },

    async saveApp(input: AppSavedAppInput): Promise<AppSavedAppsResult> {
        const api = await getAppStoreApi(true);
        if (!api) throw new MarketplaceUnavailableError('Authentication required to save apps.');

        return api.appStore.saveApp(input);
    },

    async unsaveApp(appId: string, siteId?: string | null): Promise<AppSavedAppsResult> {
        const api = await getAppStoreApi(true);
        if (!api) throw new MarketplaceUnavailableError('Authentication required to save apps.');

        return api.appStore.unsaveApp(appId, siteId ? { store_id: siteId } : undefined);
    },

    async getRecommendations(appId: string): Promise<MarketplaceAppRecommendations | null> {
        const api = await getAppStoreApi();
        if (!api) return null;

        return api.appStore.recommendations(appId).catch(() => null);
    },

    async recordDiscoveryEvent(input: AppDiscoveryEventInput): Promise<boolean> {
        const api = await getAppStoreApi();
        if (!api) return false;

        return api.appStore.recordDiscoveryEvent(input).then(() => true).catch(() => false);
    },

    async recordTelemetryEvent(input: AppTelemetryEventInput): Promise<boolean> {
        const api = await getAppStoreApi();
        if (!api) return false;

        return api.appStore.recordTelemetryEvent(input).then(() => true).catch(() => false);
    },

    async getReviewPolicy(slug = 'app-review-requirements'): Promise<AppReviewPolicy | null> {
        const api = await getAppStoreApi();
        if (!api) return null;

        return api.appStore.reviewPolicy(slug).catch(() => null);
    },

    async getPartnerDirectory(): Promise<Array<MarketplaceAppDeveloper & { published_apps?: number; built_for_letbuyy_apps?: number }>> {
        const api = await getAppStoreApi();
        if (!api) return [];

        return api.appStore.partnerDirectory().catch(() => []);
    },

    async getInstallationActivity(installationId: string, storeId?: string): Promise<AppActivityEvent[]> {
        const api = await getAppStoreApi(true);
        if (!api) return [];

        const result = await api.appStore.installationActivity(installationId, storeId ? { store_id: storeId } : undefined).catch(() => null);
        return result?.events || [];
    },

    async reportReview(appId: string, reviewId: string, input: { reason_code: string; reason_text?: string | null; site_id?: string | null }): Promise<boolean> {
        const api = await getAppStoreApi(true);
        if (!api) return false;

        return api.appStore.reportReview(appId, reviewId, { ...input, metadata: {} }).then(() => true).catch(() => false);
    },

    async reportListing(appId: string, input: { reason_code: string; reason_text?: string | null; site_id?: string | null }): Promise<boolean> {
        const api = await getAppStoreApi(true);
        if (!api) return false;

        return api.appStore.reportListing(appId, { ...input, metadata: {} }).then(() => true).catch(() => false);
    },

    async replyToReview(appId: string, reviewId: string, developerReply: string): Promise<MarketplaceAppReview | null> {
        const api = await getAppStoreApi(true);
        if (!api) return null;

        return api.appStore.replyToReview(appId, reviewId, { developer_reply: developerReply }).catch(() => null);
    },

    async generateReviewSummary(appId: string): Promise<boolean> {
        const api = await getAppStoreApi(true);
        if (!api) return false;

        return api.appStore.generateReviewSummary(appId).then(() => true).catch(() => false);
    },

    async upsertAward(appId: string, input: AppAwardWritePayload): Promise<MarketplaceAppAward | null> {
        const api = await getAppStoreApi(true);
        if (!api) return null;

        return api.appStore.upsertAward(appId, input).catch(() => null);
    },

    async archiveAward(appId: string, awardKey: string, year?: number | string): Promise<boolean> {
        const api = await getAppStoreApi(true);
        if (!api) return false;

        return api.appStore.deleteAward(appId, awardKey, year ? { year } : undefined).then(() => true).catch(() => false);
    },

    async getCategoriesWithFallback(): Promise<MarketplaceAppCategory[]> {
        const liveCategories = await this.getCategories();
        const visibleLiveCategories = liveCategories.filter((category) => category.count === undefined || category.count === null || category.count > 0);
        return visibleLiveCategories.length > 0 ? visibleLiveCategories : APP_CATEGORIES;
    },
};
