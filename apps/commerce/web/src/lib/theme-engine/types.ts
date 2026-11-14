import type { ProductModel } from '@letbuyy/commerce-core';
import type { LiquidThemePackageBundle, SectionModel, ThemeRendererEngine, ThemeSettings } from '@letbuyy/theme-engine';
import type { StoreModel } from '@letbuyy/tenant-core';

export type StorefrontRouteType =
    | 'index'
    | 'product'
    | 'collection'
    | 'page'
    | 'policy'
    | 'blog'
    | 'article'
    | 'cart'
    | 'search'
    | 'list_collections'
    | 'contact'
    | 'customer_account'
    | 'customer_orders'
    | 'customer_wishlist'
    | 'customer_settings'
    | 'customer_addresses'
    | 'customer_order'
    | 'password'
    | 'not_found';

export interface StorefrontRouteContext {
    type: StorefrontRouteType;
    path: string;
    subdomain: string;
    resourceId?: string;
    resourceSlug?: string;
    templateKey?: string;
    fallbackSections?: SectionModel[];
    // T1/W2 — the page request's query string (e.g. ?error=bot_verification after a failed
    // Turnstile challenge), threaded through to the Liquid render context as request.query/error.
    searchParams?: Record<string, string>;
}

export interface StorefrontTemplate {
    id: string;
    type: StorefrontRouteType;
    layoutKey: string;
    sections: SectionModel[];
}

export interface StorefrontSectionGroups {
    header: SectionModel[];
    footer: SectionModel[];
    [key: string]: SectionModel[];
}

export interface StorefrontRenderPlan {
    route: StorefrontRouteContext;
    layoutKey: string;
    rendererEngine?: ThemeRendererEngine;
    liquidBundle?: LiquidThemePackageBundle;
    liquidTemplateKey?: string;
    // True only when this store runs Liquid, the route needed a specific template, the bundle has
    // no match, and there was no fallback content to show instead — a genuine miss with nothing
    // honest to render. Fixed-shape routes with no fallbackSections should notFound() on this
    // instead of silently falling through to the legacy homepage-sections catch-all.
    liquidTemplateMiss: boolean;
    sectionGroups: StorefrontSectionGroups;
    template: StorefrontTemplate;
    themeSettings: ThemeSettings;
    releaseId?: string;
    releaseVersion?: number;
    cacheTags: string[];
}

export interface ProductReviewItem {
    id: string;
    author: string;
    rating: number;
    title: string | null;
    body: string | null;
    images: string[];
    isVerified: boolean;
    helpfulCount: number;
    createdAt: string | null;
}

export interface ProductReviewData {
    reviews: ProductReviewItem[];
    rating: number;
    reviewCount: number;
}

export interface SectionRenderData {
    products?: ProductModel[];
    product?: ProductModel;
    cart?: Record<string, unknown>;
    collection?: { id: string; title: string; description?: string | null };
    reviews?: ProductReviewData;
}

export interface SectionRendererProps {
    store: StoreModel;
    section: SectionModel;
    theme: ThemeSettings;
    data: SectionRenderData;
    route: StorefrontRouteContext;
    basePath: string;
}
