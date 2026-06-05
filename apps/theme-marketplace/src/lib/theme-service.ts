import 'server-only';
import { createThemeMarketplaceApiClient } from '@/lib/api/client';
import type {
    ThemePurchaseOrderInput,
    ThemePurchaseOrderResult,
    ThemePurchaseVerifyInput,
    ThemePurchaseVerifyResult,
} from '@letbuyy/api-client';
import type { ThemeSearchFilters, ThemeSearchResult } from '@letbuyy/theme-engine';

export class MarketplaceUnavailableError extends Error {
    constructor(message = 'The theme catalog is temporarily unavailable. Please try again.') {
        super(message);
        this.name = 'MarketplaceUnavailableError';
    }
}

export type MarketplaceResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: MarketplaceUnavailableError };

function appendIfPresent(params: URLSearchParams, key: string, value: string | number | undefined) {
    if (value !== undefined && value !== '') {
        params.set(key, String(value));
    }
}

async function getThemeApi(requireSession = false) {
    try {
        return await createThemeMarketplaceApiClient({ requireSession });
    } catch {
        return null;
    }
}

export const ThemeService = {
    async listThemes(filters: ThemeSearchFilters = {}): Promise<MarketplaceResult<ThemeSearchResult>> {
        const limit = filters.limit ?? 20;
        const offset = filters.offset ?? 0;
        const page = Math.floor(offset / limit) + 1;
        const api = await getThemeApi();

        if (!api) {
            return { ok: false, error: new MarketplaceUnavailableError() };
        }

        const query = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            sort: filters.sort || 'popular',
        });

        appendIfPresent(query, 'category', filters.category);
        appendIfPresent(query, 'pricing', filters.pricingType);
        appendIfPresent(query, 'site_type', filters.siteType);
        appendIfPresent(query, 'industry', filters.industry);
        appendIfPresent(query, 'search', filters.search);

        try {
            const catalog = await api.themes.listCatalog(Object.fromEntries(query.entries()));
            return {
                ok: true,
                value: {
                    themes: catalog.data as Record<string, unknown>[],
                    total: catalog.total,
                    limit: catalog.limit,
                    offset,
                },
            };
        } catch {
            return { ok: false, error: new MarketplaceUnavailableError() };
        }
    },

    async getThemeBySlug(slug: string): Promise<Record<string, unknown> | null> {
        const api = await getThemeApi();
        if (!api) return null;

        return api.themes.get(slug).then((theme) => theme as Record<string, unknown>).catch(() => null);
    },

    async uploadThemePackage(bundle: Record<string, unknown>): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.uploadPackage({ bundle }).then((result) => result as unknown as Record<string, unknown>);
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
        const api = await getThemeApi(true);
        if (!api) return [];

        return api.themes.purchases().catch(() => []);
    },

    async getUserInstallations(): Promise<Record<string, unknown>[]> {
        const api = await getThemeApi(true);
        if (!api) return [];

        return api.themes.installations().catch(() => []);
    },

    async getUserStores(): Promise<Record<string, unknown>[]> {
        const api = await getThemeApi(true);
        if (!api) return [];

        const stores = await api.stores.list({ limit: 50 }).catch(() => null);
        return stores?.data as Record<string, unknown>[] || [];
    },

    async installTheme(slug: string, storeId: string): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.install(slug, {
            store_id: storeId,
            config_overrides: {},
        }).then((result) => result as unknown as Record<string, unknown>);
    },

    async createThemePurchase(slug: string, input: ThemePurchaseOrderInput): Promise<ThemePurchaseOrderResult> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.purchase(slug, input);
    },

    async verifyThemePurchase(slug: string, input: unknown): Promise<ThemePurchaseVerifyResult> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.verifyPurchase(slug, input as ThemePurchaseVerifyInput);
    },

    async getCategories(): Promise<string[]> {
        const api = await getThemeApi();
        if (!api) return [];

        return api.themes.categories().then((categories) => categories.sort()).catch(() => []);
    },

    async getIndustries(): Promise<string[]> {
        const api = await getThemeApi();
        if (!api) return [];

        return api.themes.industries().then((industries) => industries.sort()).catch(() => []);
    },
};
