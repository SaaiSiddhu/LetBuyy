import { themeWorkerFetch } from '@/lib/api/worker-client';

export interface ThemeFilters {
    category?: string;
    pricingType?: string;
    siteType?: string;
    industry?: string;
    search?: string;
    sort?: 'popular' | 'rating' | 'recent' | 'name' | 'price_low' | 'price_high';
    limit?: number;
    offset?: number;
}

export interface ThemeSearchResult {
    themes: Record<string, unknown>[];
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

async function readWorkerEnvelope<T>(response: Response): Promise<WorkerEnvelope<T> | null> {
    return response.json().catch(() => null) as Promise<WorkerEnvelope<T> | null>;
}

async function safeThemeFetch(path: string, init?: Parameters<typeof themeWorkerFetch>[1]): Promise<Response | null> {
    try {
        return await themeWorkerFetch(path, init);
    } catch {
        return null;
    }
}

function appendIfPresent(params: URLSearchParams, key: string, value: string | number | undefined) {
    if (value !== undefined && value !== '') {
        params.set(key, String(value));
    }
}

export const ThemeService = {
    async listThemes(filters: ThemeFilters = {}): Promise<ThemeSearchResult> {
        const limit = filters.limit ?? 20;
        const offset = filters.offset ?? 0;
        const page = Math.floor(offset / limit) + 1;
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            sort: filters.sort || 'popular',
        });

        appendIfPresent(params, 'category', filters.category);
        appendIfPresent(params, 'pricing', filters.pricingType);
        appendIfPresent(params, 'site_type', filters.siteType);
        appendIfPresent(params, 'industry', filters.industry);
        appendIfPresent(params, 'search', filters.search);

        const response = await safeThemeFetch(`/themes?${params.toString()}`);
        if (!response?.ok) {
            return { themes: [], total: 0, limit, offset };
        }

        const payload = await readWorkerEnvelope<Record<string, unknown>[]>(response);

        return {
            themes: payload?.data || [],
            total: payload?.meta?.total || 0,
            limit: payload?.meta?.per_page || limit,
            offset,
        };
    },

    async getThemeBySlug(slug: string): Promise<Record<string, unknown> | null> {
        const response = await safeThemeFetch(`/themes/${encodeURIComponent(slug)}`);
        if (!response?.ok) return null;

        const payload = await readWorkerEnvelope<Record<string, unknown>>(response);
        return payload?.data || null;
    },

    async getThemeReviews(themeId: string) {
        const purchases = await this.getUserPurchases();
        const purchasedTheme = purchases.find((purchase) => {
            const theme = purchase.themes as Record<string, unknown> | undefined;
            return theme?.id === themeId;
        });
        const theme = purchasedTheme?.themes as { reviews?: Record<string, unknown>[] } | undefined;

        return { reviews: theme?.reviews || [], total: theme?.reviews?.length || 0 };
    },

    async hasUserPurchased(_userId: string, themeId: string): Promise<boolean> {
        const purchases = await this.getUserPurchases();
        return purchases.some((purchase) => {
            const theme = purchase.themes as Record<string, unknown> | undefined;
            return theme?.id === themeId && purchase.status === 'completed';
        });
    },

    async getUserPurchases(_userId?: string): Promise<Record<string, unknown>[]> {
        const response = await safeThemeFetch('/themes/purchases/list', {
            method: 'GET',
            requireSession: true,
        });
        if (!response?.ok) return [];

        const payload = await readWorkerEnvelope<Record<string, unknown>[]>(response);
        return payload?.data || [];
    },

    async getUserInstallations(): Promise<Record<string, unknown>[]> {
        const response = await safeThemeFetch('/themes/installations/list', {
            method: 'GET',
            requireSession: true,
        });
        if (!response?.ok) return [];

        const payload = await readWorkerEnvelope<Record<string, unknown>[]>(response);
        return payload?.data || [];
    },

    async getCategories(): Promise<string[]> {
        const response = await safeThemeFetch('/themes/categories');
        if (!response?.ok) return [];

        const payload = await readWorkerEnvelope<string[]>(response);
        return (payload?.data || []).sort();
    },

    async getIndustries(): Promise<string[]> {
        const response = await safeThemeFetch('/themes/industries');
        if (!response?.ok) return [];

        const payload = await readWorkerEnvelope<string[]>(response);
        return (payload?.data || []).sort();
    },
};
