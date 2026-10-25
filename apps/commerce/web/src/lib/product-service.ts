import { cache } from 'react';
import { readApparelFacts, readProductNicheFacts, type ProductModel } from '@letbuyy/commerce-core';
import type { Product as SharedProduct } from '@letbuyy/shared-types';
import type { StorefrontProductQuery } from '@letbuyy/api-client';
import { createStorefrontApiClient, storefrontReadInit } from './api/client';
import {
    getUrbanKicksDemoProduct as getUrbanKicksDemoProductFixture,
    getUrbanKicksDemoProducts as getUrbanKicksDemoProductsFixture,
} from './demo/urban-kicks-demo';
import { mapPublicProductPriceHistory } from './product-price-history';
import { mapPublicProductVariants } from './product-variants';
import { discoveryRouteQuery, StorefrontDiscoveryQueryError } from './theme-engine/discovery-route-query';
import { validateDiscoveryProductPage, StorefrontDiscoveryUnsupportedError, type StorefrontDiscoveryProductPage } from './theme-engine/storefront-discovery';

const PRODUCT_LIST_REVALIDATE_SECONDS = 60;
const PRODUCT_DETAIL_REVALIDATE_SECONDS = 30;

/**
 * A catalogue read that failed.
 *
 * These methods used to `return []` on any error, which is indistinguishable
 * downstream from "this store genuinely has no products" — so a gateway outage
 * rendered a live merchant's shop as an empty catalogue, with HTTP 200, and Next
 * ISR-cached that lie for the revalidate window. No alarm fires on a 200.
 *
 * Failing loudly instead lets the storefront error boundary (app/error.tsx) show
 * a real error with a working `reset()` retry, and a thrown render is not cached.
 * Callers that legitimately want degradation (the sitemap, header search) opt in
 * with their own `catch` — and both already do.
 */
export class StorefrontCatalogueError extends Error {
    readonly cause?: unknown;
    constructor(operation: string, cause: unknown) {
        super(`Storefront catalogue read failed: ${operation}`);
        this.name = 'StorefrontCatalogueError';
        this.cause = cause;
    }
}

export const ProductService = {
    async getProductPage(subdomain: string, query: StorefrontProductQuery, previewToken?: string): Promise<StorefrontDiscoveryProductPage> {
        const parsed = discoveryRouteQuery(query);
        try {
            const client = createStorefrontApiClient(previewToken ? { cache: 'no-store' } : storefrontReadInit(PRODUCT_LIST_REVALIDATE_SECONDS, [`storefront:${subdomain}:products`]));
            const page = previewToken ? await client.storefront.themePreviewProductPage(subdomain, previewToken, parsed)
                : await client.storefront.listProducts(subdomain, parsed);
            return validateDiscoveryProductPage({ ...page, data: page.data.map(mapStorefrontProduct) }, parsed);
        } catch (error) {
            if (error instanceof StorefrontDiscoveryQueryError || error instanceof StorefrontDiscoveryUnsupportedError) throw error;
            // A signed preview failure may contain its capability URL. Never retain/emit that cause.
            throw new StorefrontCatalogueError('getProductPage', new Error('Product discovery unavailable'));
        }
    },
    async getUrbanKicksDemoProducts(productIds?: string[]): Promise<ProductModel[]> {
        return getUrbanKicksDemoProductsFixture(productIds);
    },

    async getUrbanKicksDemoProduct(productId: string): Promise<ProductModel | null> {
        return getUrbanKicksDemoProductFixture(productId);
    },

    // Get products by store's selected product IDs
    async getProductsByIds(
        productIds: string[],
        subdomain?: string,
        query: StorefrontProductQuery = {},
    ): Promise<ProductModel[]> {
        if (!productIds || productIds.length === 0) return [];

        if (!subdomain) return [];

        try {
            const products = await createStorefrontApiClient(
                storefrontReadInit(PRODUCT_LIST_REVALIDATE_SECONDS, [
                    `storefront:${subdomain}:products`,
                    `storefront:${subdomain}:products:selected`,
                ]),
            ).storefront.productsByIds(subdomain, productIds, { query });
            return products.map(mapStorefrontProduct);
        } catch (error) {
            console.error('[ProductService] Worker by-ids fetch failed:', error);
            throw new StorefrontCatalogueError('getProductsByIds', error);
        }
    },

    async getProductsByStoreSubdomain(
        subdomain: string,
        query: StorefrontProductQuery = {},
    ): Promise<ProductModel[]> {
        try {
            const products = await createStorefrontApiClient(
                storefrontReadInit(PRODUCT_LIST_REVALIDATE_SECONDS, [`storefront:${subdomain}:products`]),
            ).storefront.listProducts(subdomain, { limit: 100, ...query });
            return products.data.map(mapStorefrontProduct);
        } catch (error) {
            console.error('[ProductService] Worker store fetch failed:', error);
            throw new StorefrontCatalogueError('getProductsByStoreSubdomain', error);
        }
    },

    // A preview capability may render active products before the store is public.
    // The existing theme-preview endpoint validates its store/draft/expiry first.
    async getPreviewProducts(subdomain: string, token: string, selectedIds: string[] = []): Promise<ProductModel[]> {
        try {
            const products = await createStorefrontApiClient({ cache: 'no-store' }).storefront.themePreviewProducts(
                subdomain, token, selectedIds.length ? selectedIds.slice(0, 100) : undefined,
            );
            if (!Array.isArray(products)) throw new Error('Invalid preview catalog response');
            return products.map(mapStorefrontProduct);
        } catch {
            // A failed fetch can contain the capability URL; never emit that object.
            console.error('[ProductService] Preview catalog is unavailable');
            throw new StorefrontCatalogueError('getPreviewProducts', new Error('Preview catalog unavailable'));
        }
    },

    async getCollectionProducts(subdomain: string, collectionId: string, previewToken?: string): Promise<ProductModel[]> {
        const client = createStorefrontApiClient({ cache: 'no-store' });
        const products = previewToken
            ? await client.storefront.themePreviewProducts(subdomain, previewToken, undefined, { query: { collection_id: collectionId } })
            : (await client.storefront.getCollectionWithProducts(subdomain, collectionId)).products;
        return products.map(mapStorefrontProduct);
    },

    // Search products for the storefront /search route. Callers should catch: a failed search
    // degrades to an empty result set with a distinct error state, not a thrown storefront error
    // boundary — a shopper mistyping a query is not the same fact as a catalogue outage.
    async searchProducts(
        subdomain: string,
        term: string,
        filters: { category?: string; country_of_origin?: string; page?: number } = {},
    ): Promise<ProductModel[]> {
        const searchTerm = term.trim();
        if (!searchTerm) return [];

        const products = await createStorefrontApiClient(
            storefrontReadInit(30, [`storefront:${subdomain}:search`]),
        ).storefront.listProducts(subdomain, { search: searchTerm, limit: 50, ...filters });
        return products.data.map(mapStorefrontProduct);
    },

    // Get all products for a store
    async getProductsByStoreId(storeId: string): Promise<ProductModel[]> {
        try {
            const products = await createStorefrontApiClient(
                storefrontReadInit(PRODUCT_LIST_REVALIDATE_SECONDS, [`storefront:store:${storeId}:products`]),
            ).storefront.listProductsByStoreId(storeId, { limit: 100 });
            return products.data.map(mapStorefrontProduct);
        } catch (error) {
            console.error('[ProductService] Worker store-id fetch failed:', error);
            throw new StorefrontCatalogueError('getProductsByStoreId', error);
        }
    },

    // Get a single product by ID
    getProductById: cache(async (productId: string, subdomain?: string): Promise<ProductModel | null> => {
        if (!subdomain) return null;

        try {
            const product = await createStorefrontApiClient(
                storefrontReadInit(PRODUCT_DETAIL_REVALIDATE_SECONDS, [
                    `storefront:${subdomain}:products`,
                    `storefront:${subdomain}:product:${productId}`,
                ]),
            ).storefront.getProduct(subdomain, productId);
            return mapStorefrontProduct(product);
        } catch (error) {
            // `null` from this method means "no such product" and the caller renders
            // a 404. A FETCH FAILURE is a different fact, so it must not reuse that
            // channel — a transient gateway error told shoppers the product did not
            // exist. Not-found still returns null via the happy path above.
            console.error('[ProductService] Worker product fetch failed:', error);
            throw new StorefrontCatalogueError('getProductById', error);
        }
    }),

    // Get all products for a seller (via their sites)
    async getProductsBySellerId(sellerId: string): Promise<ProductModel[]> {
        void sellerId;
        return [];
    }
};

// ============= HELPER FUNCTIONS =============

export function mapStorefrontProduct(product: SharedProduct | Record<string, unknown>): ProductModel {
    return mapSupabaseToProduct(product as unknown as Record<string, unknown>);
}

function normalizeImages(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((image) => {
            if (typeof image === 'string') return image;
            if (image && typeof image === 'object') {
                const record = image as Record<string, unknown>;
                return (record.url || record.src) as string | undefined;
            }
            return undefined;
        })
        .filter((image): image is string => Boolean(image));
}

function mapSupabaseToProduct(data: Record<string, unknown>): ProductModel {
    const stockValue = data.stock ?? data.stock_quantity ?? data.quantity;
    const currentPrice = Number(data.price);
    const priceHistory = mapPublicProductPriceHistory(data);

    return {
        id: data.id as string,
        storeId: data.store_id as string,
        name: (data.name as string) || 'Unnamed Product',
        description: (data.description as string) || '',
        price: Number.isFinite(currentPrice) ? currentPrice : 0,
        compareAtPrice: priceHistory.compareAtPrice,
        priorLowestPrice30d: priceHistory.priorLowestPrice30d,
        priorPriceCoverageComplete: priceHistory.priorPriceCoverageComplete,
        currency: (data.currency as string) || 'INR',
        images: normalizeImages(data.images),
        category: data.category as string,
        countryOfOrigin: data.country_of_origin as string | undefined,
        importerDetails: data.importer_details as string | undefined,
        tags: (data.tags as string[]) || [],
        apparel: readApparelFacts(data.metadata),
        ...readProductNicheFacts(data.metadata),
        ...mapPublicProductVariants(data, priceHistory.variants),
        stock: stockValue === undefined || stockValue === null ? 0 : Number(stockValue),
        seoTitle: data.seo_title as string,
        seoDescription: data.seo_description as string,
        // T2a/W4 — the gateway's product-list endpoint omits both `is_active` and `status` entirely
        // (confirmed via a direct curl of /v1/storefront/{sub}/products), so the old
        // `data.is_active ?? data.status === 'active'` silently collapsed to `false` whenever a
        // product simply lacked those fields — inventing a "Sold out" badge for genuinely
        // in-stock, active products. Product visibility follows the scoped public query;
        // stock remains unavailable when the payload does not supply an actual quantity.
        isActive: data.is_active === false ? false : typeof data.status === 'string' ? data.status === 'active' : true,
        isFeatured: (data.is_featured as boolean) ?? false,
        rating: data.avg_rating ? Number(data.avg_rating) : undefined,
        reviewCount: data.review_count ? Number(data.review_count) : undefined,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    };
}
