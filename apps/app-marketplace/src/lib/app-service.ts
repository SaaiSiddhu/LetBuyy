import 'server-only';

import { createAppMarketplaceApiClient } from '@/lib/api/client';
import type { MarketplaceApp, MarketplaceAppCategory, MarketplaceAppReview } from '@letbuyy/shared-types';

export interface AppFilters {
    category?: string;
    sort?: 'popular' | 'rating' | 'recent' | 'name';
    pricingModel?: string;
    siteType?: string;
    limit?: number;
    offset?: number;
}

export interface AppSearchResult {
    apps: MarketplaceApp[];
    total: number;
    limit: number;
    offset: number;
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

export const AppService = {
    async listApps(filters: AppFilters = {}): Promise<AppSearchResult> {
        const limit = filters.limit ?? 20;
        const offset = filters.offset ?? 0;
        const page = Math.floor(offset / limit) + 1;
        const api = await getAppStoreApi();
        if (!api) return { apps: [], total: 0, limit, offset };

        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            sort: filters.sort || 'popular',
        });

        appendIfPresent(params, 'category', filters.category);
        appendIfPresent(params, 'pricing', filters.pricingModel);
        appendIfPresent(params, 'site_type', filters.siteType);

        const catalog = await api.appStore.apps(Object.fromEntries(params.entries())).catch(() => null);
        if (!catalog) return { apps: [], total: 0, limit, offset };

        return {
            apps: catalog.data,
            total: catalog.total,
            limit: catalog.limit,
            offset,
        };
    },

    async searchApps(query: string, category?: string, limit = 20): Promise<AppSearchResult> {
        const api = await getAppStoreApi();
        if (!api) return { apps: [], total: 0, limit, offset: 0 };

        const params = new URLSearchParams({
            search: query,
            limit: String(limit),
            page: '1',
        });
        appendIfPresent(params, 'category', category);

        const catalog = await api.appStore.apps(Object.fromEntries(params.entries())).catch(() => null);
        if (!catalog) return { apps: [], total: 0, limit, offset: 0 };

        return {
            apps: catalog.data,
            total: catalog.total,
            limit: catalog.limit,
            offset: 0,
        };
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
};
