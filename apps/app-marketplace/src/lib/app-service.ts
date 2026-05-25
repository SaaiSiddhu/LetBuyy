import { appStoreWorkerFetch } from '@/lib/api/worker-client';

export interface AppFilters {
    category?: string;
    sort?: 'popular' | 'rating' | 'recent' | 'name';
    pricingModel?: string;
    siteType?: string;
    limit?: number;
    offset?: number;
}

export interface AppSearchResult {
    apps: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
}

interface WorkerEnvelope<T> {
    success?: boolean;
    data?: T;
    meta?: {
        page?: number;
        per_page?: number;
        total?: number;
    };
}

async function safeAppStoreFetch(path: string, init?: Parameters<typeof appStoreWorkerFetch>[1]): Promise<Response | null> {
    try {
        return await appStoreWorkerFetch(path, init);
    } catch {
        return null;
    }
}

async function readWorkerEnvelope<T>(response: Response): Promise<WorkerEnvelope<T> | null> {
    return response.json().catch(() => null) as Promise<WorkerEnvelope<T> | null>;
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
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            sort: filters.sort || 'popular',
        });

        appendIfPresent(params, 'category', filters.category);
        appendIfPresent(params, 'pricing', filters.pricingModel);
        appendIfPresent(params, 'site_type', filters.siteType);

        const response = await safeAppStoreFetch(`/app-store/apps?${params.toString()}`);
        if (!response?.ok) return { apps: [], total: 0, limit, offset };

        const payload = await readWorkerEnvelope<Record<string, unknown>[]>(response);

        return {
            apps: payload?.data || [],
            total: payload?.meta?.total || 0,
            limit: payload?.meta?.per_page || limit,
            offset,
        };
    },

    async searchApps(query: string, category?: string, limit = 20): Promise<AppSearchResult> {
        const params = new URLSearchParams({
            search: query,
            limit: String(limit),
            page: '1',
        });
        appendIfPresent(params, 'category', category);

        const response = await safeAppStoreFetch(`/app-store/apps?${params.toString()}`);
        if (!response?.ok) return { apps: [], total: 0, limit, offset: 0 };

        const payload = await readWorkerEnvelope<Record<string, unknown>[]>(response);

        return {
            apps: payload?.data || [],
            total: payload?.meta?.total || 0,
            limit: payload?.meta?.per_page || limit,
            offset: 0,
        };
    },

    async getAppBySlug(slug: string): Promise<Record<string, unknown> | null> {
        const response = await safeAppStoreFetch(`/app-store/apps/${encodeURIComponent(slug)}`);
        if (!response?.ok) return null;

        const payload = await readWorkerEnvelope<Record<string, unknown>>(response);
        return payload?.data || null;
    },

    async getAppReviews(appId: string, limit = 10, offset = 0) {
        const page = Math.floor(offset / limit) + 1;
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        });
        const response = await safeAppStoreFetch(`/app-store/apps/${encodeURIComponent(appId)}/reviews?${params.toString()}`);
        if (!response?.ok) return { reviews: [], total: 0 };

        const payload = await readWorkerEnvelope<Record<string, unknown>[]>(response);
        return { reviews: payload?.data || [], total: payload?.meta?.total || 0 };
    },

    async getCategories() {
        const response = await safeAppStoreFetch('/app-store/categories');
        if (!response?.ok) return [];

        const payload = await readWorkerEnvelope<Record<string, unknown>[]>(response);
        return payload?.data || [];
    },
};
