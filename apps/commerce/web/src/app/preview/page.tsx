import { CartProvider } from '@/context/cart-context';
import { CustomerAuthProvider } from '@/context/customer-auth-context';
import { WishlistProvider } from '@/context/wishlist-context';
import {
    URBAN_KICKS_DEMO_SUBDOMAIN,
    getUrbanKicksDemoProduct,
    getUrbanKicksDemoReviews,
} from '@/lib/demo/urban-kicks-demo';
import { ProductService } from '@/lib/product-service';
import { StoreService } from '@/lib/store-service';
import { buildSectionDataPlan } from '@/lib/theme-engine/data-binding-engine';
import StorefrontCompositionEngine, { StorefrontSectionGroupRenderer } from '@/lib/theme-engine/composition-engine';
import { createProductDetailFallbackSection, createProductListingFallbackSection } from '@/lib/theme-engine/product-route';
import type { SectionRenderData, StorefrontRouteContext } from '@/lib/theme-engine/types';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import type { ProductModel } from '@letbuyy/commerce-core';
import type { StoreModel } from '@letbuyy/tenant-core';
import { DEFAULT_THEME_SETTINGS, type SectionModel, type ThemeSettings } from '@letbuyy/theme-engine';
import { EmptyState, Package } from '@letbuyy/ui';
import StorefrontPreviewBridge from './storefront-preview-bridge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FONT_MAP: Record<string, string> = {
    Inter: 'var(--font-inter)',
    Outfit: 'var(--font-outfit)',
    Poppins: 'var(--font-poppins)',
    Lora: 'var(--font-lora)',
    'Space Grotesk': 'var(--font-space-grotesk)',
    'Playfair Display': 'var(--font-playfair)',
    Nunito: 'var(--font-nunito)',
    'Open Sans': 'var(--font-open-sans)',
    'DM Sans': 'var(--font-dm-sans)',
    Montserrat: 'var(--font-montserrat)',
};

const COLOR_PATTERN = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\(\s*[0-9]{1,3}%?\s*,\s*[0-9]{1,3}%?\s*,\s*[0-9]{1,3}%?(?:\s*,\s*(?:0|1|0?\.[0-9]+))?\s*\))$/;
const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const MAX_SETTINGS_DATA_LENGTH = 12000;

type PreviewSearchParams = {
    demo?: string | string[];
    subdomain?: string | string[];
    store?: string | string[];
    storeName?: string | string[];
    theme_preview_token?: string | string[];
    viewport?: string | string[];
    settings_data?: string | string[];
    settings_data_b64?: string | string[];
    draft_settings?: string | string[];
    // S6/W2 — dev-only, demo-only engine override for the concurrent-load harness. Never consulted
    // outside the already non-production-gated Urban Kicks demo path (see isDemoPreview below) — a
    // real merchant's preview always renders through its store's own canary resolution, untouched.
    engine?: string | string[];
    // S6/W2 — demo-only surface selector ('index' default, 'product', 'collection') so the load
    // harness can cover more than the home template. Same isDemoPreview gate as `engine`: a real
    // merchant's preview always renders its own 'index' template, exactly as before this phase.
    route_type?: string | string[];
};

type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function singleParam(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

function normalizeSubdomain(value: string | undefined): string | undefined {
    const normalized = value?.trim().toLowerCase();
    if (!normalized || !SUBDOMAIN_PATTERN.test(normalized)) return undefined;
    return normalized;
}

function isUrbanKicksDemoPreview(query: PreviewSearchParams | undefined): boolean {
    return singleParam(query?.demo) === 'urban-kicks';
}

// S6/W2 — 'liquid' forces templateConfig.liquidRenderingCanary=true, 'react' forces it false, so the
// concurrent-load harness can A/B the SAME demo content (theme, sections, products) on the SAME
// route, differing ONLY in render engine. Any other/absent value is a no-op (undefined): the store's
// own canary resolution is used unchanged, exactly as today.
function resolveEngineOverride(value: string | undefined): boolean | undefined {
    if (value === 'liquid') return true;
    if (value === 'react') return false;
    return undefined;
}

// S6/W2 — demo-only surface selector. Unrecognised/absent values fall back to 'index', the route
// this page has always rendered.
function resolveDemoRouteType(value: string | undefined): 'index' | 'product' | 'collection' {
    if (value === 'product' || value === 'collection') return value;
    return 'index';
}

function normalizeViewport(value: string | undefined): PreviewViewport {
    return value === 'tablet' || value === 'mobile' ? value : 'desktop';
}

function normalizeColor(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (trimmed.length > 64 || !COLOR_PATTERN.test(trimmed)) return undefined;
    return trimmed;
}

function normalizeFont(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    return FONT_MAP[value] ? value : undefined;
}

function normalizeBorderRadius(value: unknown): number | undefined {
    const numeric = typeof value === 'number'
        ? value
        : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isFinite(numeric)) return undefined;
    return Math.min(Math.max(Math.round(numeric), 0), 32);
}

function normalizeBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
}

function decodeSettingsPayload(query: PreviewSearchParams): unknown {
    const rawJson = singleParam(query.settings_data) || singleParam(query.draft_settings);
    if (rawJson && rawJson.length <= MAX_SETTINGS_DATA_LENGTH) {
        try {
            return JSON.parse(rawJson);
        } catch {
            return {};
        }
    }

    const rawBase64 = singleParam(query.settings_data_b64);
    if (!rawBase64 || rawBase64.length > MAX_SETTINGS_DATA_LENGTH) return {};

    try {
        const normalized = rawBase64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
        return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    } catch {
        return {};
    }
}

function extractDraftThemeSettings(payload: unknown): Partial<ThemeSettings> {
    const root = asRecord(payload);
    const configSettingsData = asRecord(asRecord(asRecord(root.config).settings_data).current);
    const settingsData = asRecord(asRecord(root.settings_data).current);
    const current = asRecord(root.current);
    const themeSettings = asRecord(root.themeSettings);
    const candidate = {
        ...root,
        ...themeSettings,
        ...current,
        ...settingsData,
        ...configSettingsData,
    };
    const draft: Partial<ThemeSettings> = {};

    const primaryColor = normalizeColor(candidate.primaryColor);
    if (primaryColor) draft.primaryColor = primaryColor;

    const secondaryColor = normalizeColor(candidate.secondaryColor);
    if (secondaryColor) draft.secondaryColor = secondaryColor;

    const accentColor = normalizeColor(candidate.accentColor);
    if (accentColor) draft.accentColor = accentColor;

    const backgroundColor = normalizeColor(candidate.backgroundColor);
    if (backgroundColor) draft.backgroundColor = backgroundColor;

    const textColor = normalizeColor(candidate.textColor);
    if (textColor) draft.textColor = textColor;

    const surfaceColor = normalizeColor(candidate.surfaceColor);
    if (surfaceColor) draft.surfaceColor = surfaceColor;

    const fontFamily = normalizeFont(candidate.fontFamily);
    if (fontFamily) draft.fontFamily = fontFamily;

    const headingFontFamily = normalizeFont(candidate.headingFontFamily);
    if (headingFontFamily) draft.headingFontFamily = headingFontFamily;

    const borderRadius = normalizeBorderRadius(candidate.borderRadius);
    if (borderRadius !== undefined) draft.borderRadius = borderRadius;

    const enableAnimations = normalizeBoolean(candidate.enableAnimations);
    if (enableAnimations !== undefined) draft.enableAnimations = enableAnimations;

    const enableShadows = normalizeBoolean(candidate.enableShadows);
    if (enableShadows !== undefined) draft.enableShadows = enableShadows;

    const isDark = normalizeBoolean(candidate.isDark);
    if (isDark !== undefined) draft.isDark = isDark;

    return draft;
}

function applyDraftThemeSettings(store: StoreModel, draftThemeSettings: Partial<ThemeSettings>): StoreModel {
    if (Object.keys(draftThemeSettings).length === 0) return store;

    return {
        ...store,
        templateConfig: {
            ...store.templateConfig,
            themeSettings: {
                ...store.templateConfig.themeSettings,
                ...draftThemeSettings,
            },
        },
    };
}

function cssColor(value: unknown, fallback: string): string {
    return normalizeColor(value) || fallback;
}

function cssRadius(value: unknown): number {
    return normalizeBorderRadius(value) ?? DEFAULT_THEME_SETTINGS.borderRadius;
}

function buildThemeCss(themeSettings: ThemeSettings): string {
    const isDark = Boolean(themeSettings.isDark);
    const primaryColor = cssColor(themeSettings.primaryColor, DEFAULT_THEME_SETTINGS.primaryColor);
    const secondaryColor = cssColor(themeSettings.secondaryColor, DEFAULT_THEME_SETTINGS.secondaryColor);
    const accentColor = cssColor(themeSettings.accentColor, primaryColor);
    const backgroundColor = cssColor(themeSettings.backgroundColor, isDark ? primaryColor : DEFAULT_THEME_SETTINGS.backgroundColor);
    const textColor = cssColor(themeSettings.textColor, isDark ? 'rgb(255 255 255)' : DEFAULT_THEME_SETTINGS.textColor);
    const surfaceColor = cssColor(themeSettings.surfaceColor, isDark ? 'rgb(30 41 59)' : DEFAULT_THEME_SETTINGS.surfaceColor || 'rgb(249 250 251)');
    const fontCss = FONT_MAP[themeSettings.fontFamily] || FONT_MAP.Inter;
    const headingFontCss = FONT_MAP[themeSettings.headingFontFamily] || fontCss;
    const radius = cssRadius(themeSettings.borderRadius);

    return `
        :root {
          --primary: ${primaryColor};
          --secondary: ${secondaryColor};
          --accent: ${accentColor};
          --background: ${backgroundColor};
          --text: ${textColor};
          --radius: ${radius}px;
          --font-main: ${fontCss}, system-ui, sans-serif;
          --font-heading: ${headingFontCss}, system-ui, sans-serif;
          --enable-animations: ${themeSettings.enableAnimations ? 1 : 0};
          --enable-shadows: ${themeSettings.enableShadows ? 1 : 0};
          --is-dark: ${isDark ? 1 : 0};
          --text-secondary: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'};
          --text-muted: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
          --text-hint: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
          --text-inverse: ${isDark ? 'rgb(0 0 0)' : 'rgb(255 255 255)'};
          --border-color: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          --surface: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'};
          --surface-hover: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
          --card-bg: ${isDark ? surfaceColor : 'rgb(255 255 255)'};
          --card-bg-secondary: ${isDark ? 'rgba(255,255,255,0.08)' : surfaceColor};
          --card-text: ${isDark ? 'rgb(248 250 252)' : 'rgb(17 24 39)'};
          --card-text-muted: ${isDark ? 'rgb(148 163 184)' : 'rgb(107 114 128)'};
          --card-border: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgb(229 231 235)'};
          --header-bg-scrolled: ${isDark ? surfaceColor : 'rgb(255 255 255)'};
          --header-shadow: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'};
          --footer-bg: ${isDark ? backgroundColor : 'rgb(15 23 42)'};
          --footer-text: ${isDark ? textColor : 'rgb(255 255 255)'};
          --footer-text-muted: rgba(255,255,255,0.6);
          --input-bg: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgb(249 250 251)'};
          --input-border: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgb(229 231 235)'};
          --input-text: ${textColor};
          --input-placeholder: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
        }

        body {
          background-color: var(--background);
          color: var(--text);
          font-family: var(--font-main);
        }

        h1, h2, h3, h4, h5, h6 {
          font-family: var(--font-heading);
          font-weight: 600;
          letter-spacing: 0;
        }
    `;
}

// This route renders a complete storefront and deliberately ignores publish status, so it needs a
// preview credential minted for THAT store before anything is loaded. The theme preview session
// token is that credential and it is verified upstream, not here: the gateway hashes it and matches
// it against theme_preview_sessions filtered by the requested store and an unexpired expires_at, so
// a missing token, an expired token, or a token minted for another store resolves to no store at all
// — and a gateway that errors or is unreachable also resolves to no store (SEC-R1).
//
// The check has to live at this call site because the request never has a tenant host: the theme
// editor loads /preview on the platform origin (and deployment hostnames resolve to no tenant at
// all), so the proxy's host-driven storefront access gate cannot run for it and the store is named
// in ?subdomain= instead. The previous fallback to StoreService.getStoreBySubdomainAnyStatus — a
// loader whose whole purpose is to ignore status — therefore handed any anonymous caller a full
// render of any store it named, password-gated, preview_only, offline and unpublished ones included
// (ART-08). It is removed rather than made conditional: no store may be fetched at all until the
// credential has proven the caller may see it.
async function loadPreviewStore(subdomain: string | undefined, previewToken: string, useDemoStore: boolean): Promise<StoreModel | null> {
    if (useDemoStore) {
        return StoreService.getUrbanKicksDemoStore();
    }

    if (!subdomain || !previewToken) return null;

    return StoreService.getPreviewStoreBySubdomain(subdomain, previewToken);
}

async function loadProductsForStore(store: StoreModel, subdomain: string | undefined, useDemoStore: boolean): Promise<ProductModel[]> {
    if (store.siteType !== 'store') return [];

    if (useDemoStore) {
        return store.selectedProductIds.length > 0
            ? ProductService.getUrbanKicksDemoProducts(store.selectedProductIds)
            : ProductService.getUrbanKicksDemoProducts();
    }

    if (!subdomain) return [];

    return store.selectedProductIds.length > 0
        ? ProductService.getProductsByIds(store.selectedProductIds, subdomain)
        : ProductService.getProductsByStoreSubdomain(subdomain);
}

function buildSectionGroupData(sections: SectionModel[], products: ProductModel[]): Map<string, SectionRenderData> {
    return new Map(sections.map((section) => [section.id, { products }]));
}

function PreviewUnavailable() {
    return (
        <main className="storefront-preview-empty">
            <div className="storefront-preview-empty__card">
                <EmptyState
                    kind="generic"
                    icon={<Package aria-hidden="true" />}
                    title="Storefront preview is not available"
                    body="Use a valid preview token, store subdomain, or the Urban Kicks demo preview."
                />
                <a className="storefront-preview-empty__link" href={`/preview?demo=urban-kicks&subdomain=${URBAN_KICKS_DEMO_SUBDOMAIN}`}>
                    Open Urban Kicks demo
                </a>
            </div>
        </main>
    );
}

export default async function PreviewPage({
    searchParams,
}: {
    searchParams?: Promise<PreviewSearchParams>;
}) {
    const query = await searchParams;
    const isDemoPreview = isUrbanKicksDemoPreview(query);
    const requestedSubdomain = normalizeSubdomain(
        singleParam(query?.subdomain) || singleParam(query?.store) || singleParam(query?.storeName),
    );
    const subdomain = isDemoPreview ? (requestedSubdomain || URBAN_KICKS_DEMO_SUBDOMAIN) : requestedSubdomain;
    const viewport = normalizeViewport(singleParam(query?.viewport));
    const previewToken = subdomain
        ? await resolveThemePreviewToken(subdomain, singleParam(query?.theme_preview_token))
        : '';
    const store = await loadPreviewStore(subdomain, previewToken, isDemoPreview);

    if (!store) return <PreviewUnavailable />;

    const draftThemeSettings = extractDraftThemeSettings(decodeSettingsPayload(query || {}));
    let previewStore = applyDraftThemeSettings(store, draftThemeSettings);
    // S6/W2 — demo-only engine override for the concurrent-load harness (see resolveEngineOverride).
    // Gated on isDemoPreview: a real merchant's ?subdomain= preview never reaches this branch, so its
    // store's own liquidRenderingCanary resolution is never touched by this query param.
    if (isDemoPreview) {
        const engineOverride = resolveEngineOverride(singleParam(query?.engine));
        if (engineOverride !== undefined) {
            previewStore = {
                ...previewStore,
                templateConfig: { ...previewStore.templateConfig, liquidRenderingCanary: engineOverride },
            };
        }
    }
    // S6/W2 — demo-only surface selector. routeType stays 'index' (today's only behaviour) for every
    // real merchant preview; product/collection route contexts mirror exactly what
    // app/store/[subdomain]/product/[productId]/page.tsx and .../collections/[slug]/page.tsx build,
    // using the same demo product fixture the 'index'-route demo path already relies on.
    const routeType = isDemoPreview ? resolveDemoRouteType(singleParam(query?.route_type)) : 'index';
    const demoProduct = routeType !== 'index' ? (getUrbanKicksDemoProduct('demo-air-runner-90') || null) : null;
    const routeContext: StorefrontRouteContext = routeType === 'product' && demoProduct
        ? {
            type: 'product',
            path: '/preview',
            subdomain: subdomain || '',
            resourceId: demoProduct.id,
            fallbackSections: [createProductDetailFallbackSection()],
        }
        : routeType === 'collection'
            ? {
                type: 'collection',
                path: '/preview',
                subdomain: subdomain || '',
                resourceId: 'sneakers',
                fallbackSections: [createProductListingFallbackSection('Sneakers')],
            }
            : {
                type: 'index',
                path: '/preview',
                subdomain: subdomain || '',
            };
    const renderPlan = resolveStorefrontTemplate(previewStore, routeContext);
    const products = await loadProductsForStore(previewStore, subdomain, isDemoPreview);
    let sectionData: Map<string, SectionRenderData>;
    if (routeType === 'product' && demoProduct) {
        const demoReviewData = getUrbanKicksDemoReviews(demoProduct.id);
        const reviews = {
            reviews: demoReviewData.reviews.map((r) => ({
                id: r.id,
                author: r.customer_name,
                rating: r.rating,
                title: r.title,
                body: r.body,
                images: r.images,
                isVerified: r.is_verified,
                helpfulCount: r.helpful_count,
                createdAt: r.created_at,
            })),
            rating: demoReviewData.summary.averageRating,
            reviewCount: demoReviewData.summary.totalReviews,
        };
        sectionData = new Map(renderPlan.template.sections.map((section) => [section.id, { product: demoProduct, reviews }]));
    } else if (routeType === 'collection') {
        const collectionProducts = products.filter((product) => product.category === 'Sneakers');
        sectionData = new Map(renderPlan.template.sections.map((section) => [section.id, { products: collectionProducts }]));
    } else {
        sectionData = await buildSectionDataPlan({
            store: previewStore,
            sections: renderPlan.template.sections,
            route: renderPlan.route,
        });
    }
    const headerSections = renderPlan.sectionGroups.header;
    const footerSections = renderPlan.sectionGroups.footer;
    const sectionGroupData = buildSectionGroupData([...headerSections, ...footerSections], products);
    const sectionIds = [
        ...headerSections,
        ...renderPlan.template.sections,
        ...footerSections,
    ].map((section) => section.id);
    const isDark = Boolean(previewStore.templateConfig.themeSettings.isDark);

    const content = (
        <div className={`storefront-preview-route__canvas min-h-screen flex flex-col ${isDark ? 'dark' : ''}`}>
            <StorefrontSectionGroupRenderer
                store={previewStore}
                plan={renderPlan}
                groupKey="header"
                sectionData={sectionGroupData}
                editorMode
            />
            <main className="flex-grow">
                <StorefrontCompositionEngine
                    store={previewStore}
                    plan={renderPlan}
                    sectionData={sectionData}
                    editorMode
                />
            </main>
            <StorefrontSectionGroupRenderer
                store={previewStore}
                plan={renderPlan}
                groupKey="footer"
                sectionData={sectionGroupData}
                editorMode
            />
        </div>
    );

    return (
        <>
            <style>{buildThemeCss(previewStore.templateConfig.themeSettings)}</style>
            <StorefrontPreviewBridge initialViewport={viewport} sectionIds={sectionIds} />
            <div
                className={`storefront-preview-route storefront-preview-route--${viewport}`}
                data-letbuyy-preview-route="true"
                data-letbuyy-preview-subdomain={subdomain || ''}
                data-letbuyy-preview-viewport={viewport}
            >
                {previewStore.siteType === 'store' ? (
                    <CustomerAuthProvider storeId={previewStore.id}>
                        <CartProvider>
                            <WishlistProvider storeId={previewStore.id}>
                                {content}
                            </WishlistProvider>
                        </CartProvider>
                    </CustomerAuthProvider>
                ) : content}
            </div>
        </>
    );
}
