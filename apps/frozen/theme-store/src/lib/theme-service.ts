import 'server-only';
import { createThemeMarketplaceApiClient } from '@/lib/api/client';
import type {
    ThemeDeveloperListingInput,
    ThemeDownloadGroup,
    ThemeMarketplaceSettings,
    ThemeMarketplaceSettingsInput,
    ThemePreviewSessionResult,
    ThemePurchaseOrderInput,
    ThemePurchaseOrderResult,
    ThemePurchaseReceipt,
    ThemeReviewCreateInput,
    ThemeReviewListResult,
    ThemeSavedSearchInput,
    ThemePurchaseVerifyInput,
    ThemePurchaseVerifyResult,
} from '@letbuyy/api-client';
import type { AuthSessionUser } from '@letbuyy/shared-types';
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
        appendIfPresent(query, 'layout', filters.layout);
        appendIfPresent(query, 'tag', filters.tag);
        appendIfPresent(query, 'feature', filters.feature);
        appendIfPresent(query, 'price_min', filters.priceMin);
        appendIfPresent(query, 'price_max', filters.priceMax);

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

    async getSessionUser(): Promise<AuthSessionUser | null> {
        const api = await getThemeApi();
        if (!api) return null;

        const session = await api.auth.session().catch(() => null);
        if (!session || !session.authenticated || !session.user) return null;

        return session.user;
    },

    async uploadThemePackage(bundle: Record<string, unknown>): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.uploadPackage({ bundle }).then((result) => result as unknown as Record<string, unknown>);
    },

    async getUserPurchases(): Promise<Record<string, unknown>[]> {
        const api = await getThemeApi(true);
        if (!api) return [];

        return api.themes.purchases().catch(() => []);
    },

    async getThemeDownloads(): Promise<ThemeDownloadGroup[]> {
        const api = await getThemeApi(true);
        if (!api) return [];

        return api.themes.downloads().catch(() => []);
    },

    async getThemeReceipt(purchaseId: string): Promise<(ThemePurchaseReceipt & Record<string, unknown>) | null> {
        const api = await getThemeApi(true);
        if (!api) return null;

        return api.themes.receipt(purchaseId).then((receipt) => receipt as ThemePurchaseReceipt & Record<string, unknown>).catch(() => null);
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

    async installTheme(slug: string, storeId: string, configOverrides: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.install(slug, {
            store_id: storeId,
            config_overrides: configOverrides,
        }).then((result) => result as unknown as Record<string, unknown>);
    },

    async getThemeReleases(slug: string, storeId: string): Promise<Record<string, unknown>[]> {
        const api = await getThemeApi(true);
        if (!api) return [];

        return api.themes.releases(slug, storeId).then((releases) => releases as unknown as Record<string, unknown>[]).catch(() => []);
    },

    async rollbackThemeRelease(slug: string, storeId: string, releaseId: string, expectedCurrentReleaseId: string): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.rollbackRelease(slug, releaseId, {
            store_id: storeId,
            expected_current_release_id: expectedCurrentReleaseId,
            idempotency_key: `marketplace-rollback:${expectedCurrentReleaseId}:${releaseId}`,
            make_store_live: true,
            rollback_message: 'Marketplace rollback',
        }).then((result) => result as unknown as Record<string, unknown>);
    },

    async createThemePreviewSession(slug: string, storeId: string): Promise<ThemePreviewSessionResult> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.previewSession(slug, {
            store_id: storeId,
            ttl_seconds: 900,
        });
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

    async getThemeReviews(slug: string): Promise<ThemeReviewListResult> {
        const api = await getThemeApi();
        if (!api) {
            return {
                reviews: [],
                summary: { average: 0, total: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
            };
        }

        return api.themes.reviews(slug).catch(() => ({
            reviews: [],
            summary: { average: 0, total: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
        }));
    },

    async createThemeReview(slug: string, input: ThemeReviewCreateInput): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.createReview(slug, input).then((review) => review as Record<string, unknown>);
    },

    async createSavedSearch(input: ThemeSavedSearchInput): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.createSavedSearch(input).then((savedSearch) => savedSearch as Record<string, unknown>);
    },

    async reportTheme(slug: string, input: { reason: string; details?: string }): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.report(slug, input).then((report) => report as Record<string, unknown>);
    },

    async requestThemeRefund(slug: string, input: { purchase_id: string; reason?: string }): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.refund(slug, input).then((refund) => refund as Record<string, unknown>);
    },

    async getMarketplaceSettings(): Promise<ThemeMarketplaceSettings | null> {
        const api = await getThemeApi(true);
        if (!api) return null;

        return api.themes.settings().catch(() => null);
    },

    async updateMarketplaceSettings(input: ThemeMarketplaceSettingsInput): Promise<ThemeMarketplaceSettings> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.updateSettings(input);
    },

    async createDeveloperListing(input: ThemeDeveloperListingInput): Promise<Record<string, unknown>> {
        const api = await getThemeApi(true);
        if (!api) {
            throw new Error('Authentication required');
        }

        return api.themes.createDeveloperListing(input).then((listing) => listing as Record<string, unknown>);
    },

    async getDeveloperDashboard(): Promise<Record<string, unknown> | null> {
        const api = await getThemeApi(true);
        if (!api) return null;

        return api.themes.developerDashboard().then((dashboard) => dashboard as Record<string, unknown>).catch(() => null);
    },

    async getCollections(): Promise<Record<string, unknown>[]> {
        const api = await getThemeApi();
        if (!api) return [];

        return api.themes.collections().then((collections) => collections as Record<string, unknown>[]).catch(() => []);
    },

    async getThemeSuggestions(query: string): Promise<{ themes: string[]; tags: string[]; industries: string[]; features: string[] }> {
        const api = await getThemeApi();
        if (!api || !query.trim()) return { themes: [], tags: [], industries: [], features: [] };

        const suggestions = await api.themes.suggestions(query).catch(() => null);
        if (!suggestions) return { themes: [], tags: [], industries: [], features: [] };

        return {
            themes: suggestions.themes.map((theme) => theme.name).filter(Boolean),
            tags: suggestions.tags,
            industries: suggestions.industries,
            features: suggestions.features,
        };
    },

    async getCollection(slug: string): Promise<Record<string, unknown> | null> {
        const api = await getThemeApi();
        if (!api) return null;

        return api.themes.collection(slug).then((collection) => collection as Record<string, unknown>).catch(() => null);
    },

    async getAuthor(handle: string): Promise<Record<string, unknown> | null> {
        const api = await getThemeApi();
        if (!api) return null;

        return api.themes.author(handle).then((author) => author as Record<string, unknown>).catch(() => null);
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
