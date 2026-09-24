// ============================================================
// REVIEW SERVICE — Storefront read helper for product reviews.
// Reads the canonical product_reviews projection through the Hono
// worker (storefront.productReviews); never queries the DB directly.
// Mirrors ProductService/CustomerService: gateway-only, defensive
// mapping, empty result on failure (never throws into the render path).
// ============================================================

import { createStorefrontApiClient, storefrontReadInit } from './api/client';
import type { ProductReviewData, ProductReviewItem } from './theme-engine/types';

const REVIEWS_REVALIDATE_SECONDS = 60;

export const ReviewService = {
    async getProductReviews(
        storeId: string,
        productId: string,
        subdomain?: string,
    ): Promise<ProductReviewData> {
        if (!storeId || !productId) return emptyReviewData();

        try {
            const payload = await createStorefrontApiClient(
                storefrontReadInit(REVIEWS_REVALIDATE_SECONDS, [
                    `storefront:${subdomain ?? storeId}:reviews:${productId}`,
                ]),
            ).storefront.productReviews({ product_id: productId, store_id: storeId });
            return mapReviewPayload(payload);
        } catch (error) {
            console.error('[ReviewService] Worker reviews fetch failed:', error);
            return emptyReviewData();
        }
    },
};

// ============= HELPERS =============

function emptyReviewData(): ProductReviewData {
    return { reviews: [], rating: 0, reviewCount: 0 };
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function mapReviewItem(value: unknown): ProductReviewItem {
    const review = asRecord(value);
    return {
        id: String(review.id ?? ''),
        author: typeof review.customer_name === 'string' && review.customer_name
            ? review.customer_name
            : 'Anonymous',
        rating: Number(review.rating) || 0,
        title: stringOrNull(review.title),
        body: stringOrNull(review.body),
        images: Array.isArray(review.images)
            ? review.images.filter((image): image is string => typeof image === 'string')
            : [],
        isVerified: review.is_verified === true,
        helpfulCount: Number(review.helpful_count) || 0,
        createdAt: stringOrNull(review.created_at),
    };
}

function mapReviewPayload(payload: unknown): ProductReviewData {
    const record = asRecord(payload);
    const reviews = Array.isArray(record.reviews) ? record.reviews.map(mapReviewItem) : [];
    const summary = asRecord(record.summary);
    return {
        reviews,
        rating: Number(summary.averageRating) || 0,
        reviewCount: Number(summary.totalReviews) || reviews.length,
    };
}
