import { ProductModel } from '@/types/store';
import { readWorkerJson, workerFetch } from './worker-client';
import {
    getUrbanKicksDemoProduct,
    getUrbanKicksDemoProducts,
    isUrbanKicksDemoSubdomain,
} from './demo/urban-kicks-demo';

export const ProductService = {
    // Get products by store's selected product IDs
    async getProductsByIds(productIds: string[], subdomain?: string): Promise<ProductModel[]> {
        if (!productIds || productIds.length === 0) return [];

        if (!subdomain) return [];
        if (isUrbanKicksDemoSubdomain(subdomain)) {
            return getUrbanKicksDemoProducts(productIds);
        }

        try {
            const response = await workerFetch(
                `/storefront/${encodeURIComponent(subdomain)}/products/by-ids?ids=${encodeURIComponent(productIds.join(','))}`
            );
            const payload = await readWorkerJson(response);
            return readProductArray(payload);
        } catch (error) {
            console.error('[ProductService] Worker by-ids fetch failed:', error);
            return [];
        }
    },

    async getProductsByStoreSubdomain(subdomain: string): Promise<ProductModel[]> {
        if (isUrbanKicksDemoSubdomain(subdomain)) {
            return getUrbanKicksDemoProducts();
        }

        try {
            const response = await workerFetch(`/storefront/${encodeURIComponent(subdomain)}/products?limit=100`);
            const payload = await readWorkerJson(response);
            return readProductArray(payload);
        } catch (error) {
            console.error('[ProductService] Worker store fetch failed:', error);
            return [];
        }
    },

    // Get all products for a store
    async getProductsByStoreId(storeId: string): Promise<ProductModel[]> {
        if (storeId === 'demo-urban-kicks-store') {
            return getUrbanKicksDemoProducts();
        }

        try {
            const response = await workerFetch(`/storefront/store/${encodeURIComponent(storeId)}/products?limit=100`);
            const payload = await readWorkerJson(response);
            return readProductArray(payload);
        } catch (error) {
            console.error('[ProductService] Worker store-id fetch failed:', error);
            return [];
        }
    },

    // Get a single product by ID
    async getProductById(productId: string, subdomain?: string): Promise<ProductModel | null> {
        if (!subdomain) return null;
        if (isUrbanKicksDemoSubdomain(subdomain)) {
            return getUrbanKicksDemoProduct(productId);
        }

        try {
            const response = await workerFetch(
                `/storefront/${encodeURIComponent(subdomain)}/products/${encodeURIComponent(productId)}`
            );
            if (response.status === 404) return null;
            const payload = await readWorkerJson(response);
            return payload?.data ? mapSupabaseToProduct(payload.data as Record<string, unknown>) : null;
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

function readProductArray(payload: unknown): ProductModel[] {
    const data = (payload as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];
    return data.map((d) => mapSupabaseToProduct(d as Record<string, unknown>));
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
        isActive: (data.is_active as boolean) ?? data.status === 'active',
        isFeatured: (data.is_featured as boolean) ?? false,
        rating: data.avg_rating ? Number(data.avg_rating) : undefined,
        reviewCount: data.review_count ? Number(data.review_count) : undefined,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    };
}
