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
    | 'customer_account'
    | 'customer_orders'
    | 'customer_wishlist'
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
    sectionGroups: StorefrontSectionGroups;
    template: StorefrontTemplate;
    themeSettings: ThemeSettings;
    releaseId?: string;
    releaseVersion?: number;
    cacheTags: string[];
}

export interface SectionRenderData {
    products?: ProductModel[];
    product?: ProductModel;
    cart?: Record<string, unknown>;
    collection?: { id: string; title: string; description?: string | null };
}

export interface SectionRendererProps {
    store: StoreModel;
    section: SectionModel;
    theme: ThemeSettings;
    data: SectionRenderData;
    route: StorefrontRouteContext;
    basePath: string;
}
