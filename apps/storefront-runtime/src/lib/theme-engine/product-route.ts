import type { SectionModel } from '@letbuyy/theme-engine';

export function createProductListingFallbackSection(title: string): SectionModel {
    return {
        id: 'product-listing',
        type: 'productGrid',
        rendererKey: 'core.product-grid',
        order: 0,
        settings: {
            title,
            subtitle: '',
            columns: 4,
            columnsTablet: 3,
            columnsMobile: 2,
            rows: 12,
            showTitle: true,
            showPrice: true,
            showRating: true,
            showAddToCart: true,
            sortBy: 'newest',
            cardStyle: 'standard',
        },
        blocks: [],
        isVisible: true,
    };
}

export function createProductDetailFallbackSection(): SectionModel {
    return {
        id: 'product-detail',
        type: 'productDetail',
        rendererKey: 'core.product-detail',
        order: 0,
        settings: {
            showReviews: true,
        },
        blocks: [],
        isVisible: true,
    };
}
