// Pure presentation adapter; the DTO and inventory calculation remain server-owned.
import { readApparelFacts, readProductNicheFacts, type ProductModel } from '@letbuyy/commerce-core';
import type { Product as SharedProduct } from '@letbuyy/shared-types';
import { mapPublicProductPriceHistory } from './product-price-history';
import { mapPublicProductVariants } from './product-variants';


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
    // The DTO stock is the base edit quantity. Public availability comes from
    // the canonical inventory projection, including active variants/reservations.
    const stockValue = data.catalog_available_quantity;
    const availableStock = typeof stockValue === 'number' && Number.isSafeInteger(stockValue) && stockValue >= 0
        ? stockValue : null;
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
        stock: availableStock,
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
