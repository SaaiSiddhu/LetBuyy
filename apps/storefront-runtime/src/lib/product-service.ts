import type { ProductModel } from '@letbuyy/commerce-core';
import type { Product as SharedProduct } from '@letbuyy/shared-types';
import { createStorefrontApiClient, storefrontReadInit } from './api/client';
import {
    getUrbanKicksDemoProduct as getUrbanKicksDemoProductFixture,
    getUrbanKicksDemoProducts as getUrbanKicksDemoProductsFixture,
} from './demo/urban-kicks-demo';

const PRODUCT_LIST_REVALIDATE_SECONDS = 60;
const PRODUCT_DETAIL_REVALIDATE_SECONDS = 30;

export const ProductService = {
    async getUrbanKicksDemoProducts(productIds?: string[]): Promise<ProductModel[]> {
        return getUrbanKicksDemoProductsFixture(productIds);
    },

    async getUrbanKicksDemoProduct(productId: string): Promise<ProductModel | null> {
        return getUrbanKicksDemoProductFixture(productId);
    },

    // Get products by store's selected product IDs
    async getProductsByIds(productIds: string[], subdomain?: string): Promise<ProductModel[]> {
        if (!productIds || productIds.length === 0) return [];

        if (!subdomain) return [];

        try {
            const products = await createStorefrontApiClient(
                storefrontReadInit(PRODUCT_LIST_REVALIDATE_SECONDS, [
                    `storefront:${subdomain}:products`,
                    `storefront:${subdomain}:products:selected`,
                ]),
            ).storefront.productsByIds(subdomain, productIds);
            return products.map(mapWorkerProduct);
        } catch (error) {
            console.error('[ProductService] Worker by-ids fetch failed:', error);
            return [];
        }
    },

    async getProductsByStoreSubdomain(subdomain: string): Promise<ProductModel[]> {
        try {
            const products = await createStorefrontApiClient(
                storefrontReadInit(PRODUCT_LIST_REVALIDATE_SECONDS, [`storefront:${subdomain}:products`]),
            ).storefront.listProducts(subdomain, { limit: 100 });
            return products.data.map(mapWorkerProduct);
        } catch (error) {
            console.error('[ProductService] Worker store fetch failed:', error);
            return [];
        }
    },

    // Get all products for a store
    async getProductsByStoreId(storeId: string): Promise<ProductModel[]> {
        try {
            const products = await createStorefrontApiClient(
                storefrontReadInit(PRODUCT_LIST_REVALIDATE_SECONDS, [`storefront:store:${storeId}:products`]),
            ).storefront.listProductsByStoreId(storeId, { limit: 100 });
            return products.data.map(mapWorkerProduct);
        } catch (error) {
            console.error('[ProductService] Worker store-id fetch failed:', error);
            return [];
        }
    },

    // Get a single product by ID
    async getProductById(productId: string, subdomain?: string): Promise<ProductModel | null> {
        if (!subdomain) return null;

        try {
            const product = await createStorefrontApiClient(
                storefrontReadInit(PRODUCT_DETAIL_REVALIDATE_SECONDS, [
                    `storefront:${subdomain}:products`,
                    `storefront:${subdomain}:product:${productId}`,
                ]),
            ).storefront.getProduct(subdomain, productId);
            return mapWorkerProduct(product);
        } catch (error) {
            console.error('[ProductService] Worker product fetch failed:', error);
            return null;
        }
    },

    // Get all products for a seller (via their sites)
    async getProductsBySellerId(sellerId: string): Promise<ProductModel[]> {
        void sellerId;
        return [];
    }
};

// ============= HELPER FUNCTIONS =============

function mapWorkerProduct(product: SharedProduct): ProductModel {
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

    return {
        id: data.id as string,
        storeId: data.store_id as string,
        name: (data.name as string) || 'Unnamed Product',
        description: (data.description as string) || '',
        price: Number(data.price) || 0,
        compareAtPrice: data.compare_price ? Number(data.compare_price) : data.compare_at_price ? Number(data.compare_at_price) : undefined,
        currency: (data.currency as string) || 'INR',
        images: normalizeImages(data.images),
        category: data.category as string,
        tags: (data.tags as string[]) || [],
        variants: ((data.variants as Array<{ id: string; name: string; options: Record<string, string>; price?: number; stock?: number }>) || []),
        stock: stockValue === undefined || stockValue === null ? 999 : Number(stockValue),
        seoTitle: data.seo_title as string,
        seoDescription: data.seo_description as string,
        isActive: (data.is_active as boolean) ?? data.status === 'active',
        isFeatured: (data.is_featured as boolean) ?? false,
        rating: data.avg_rating ? Number(data.avg_rating) : undefined,
        reviewCount: data.review_count ? Number(data.review_count) : undefined,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    };
}
