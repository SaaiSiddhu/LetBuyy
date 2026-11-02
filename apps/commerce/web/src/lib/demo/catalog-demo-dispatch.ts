/** Public synthetic data dispatch only. Package/catalog authority stays in theme-engine and Gateway. */
import type { ProductModel } from '@letbuyy/commerce-core';
import type { StorefrontCollectionSummary } from '@letbuyy/api-client';
import type { StoreNavigation } from '@letbuyy/tenant-core';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import { catalogDemoNavigationTarget, resolveCatalogDemoRoute, type CatalogDemoRoute } from './catalog-demo-route';
import { isCatalogDemoVersion } from './catalog-demo-versions';
import { THREADLINE_DEMO_PRODUCTS, THREADLINE_DEMO_COLLECTIONS, THREADLINE_DEMO_NAVIGATION, withThreadlineDemoContent } from './threadline-demo';
import { PLAYFIELD_DEMO_PRODUCTS, PLAYFIELD_DEMO_COLLECTIONS, PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS, PLAYFIELD_DEMO_NAVIGATION, withPlayfieldDemoContent } from './playfield-demo';
import { CIRCUIT_DEMO_PRODUCTS, CIRCUIT_DEMO_COLLECTIONS, CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS, CIRCUIT_DEMO_NAVIGATION, withCircuitDemoContent } from './circuit-demo';
import { PANTRY_DEMO_PRODUCTS, PANTRY_DEMO_COLLECTIONS, PANTRY_DEMO_COLLECTION_PRODUCT_IDS, PANTRY_DEMO_NAVIGATION, withPantryDemoContent } from './pantry-demo';
import { HABITAT_DEMO_PRODUCTS, HABITAT_DEMO_COLLECTIONS, HABITAT_DEMO_COLLECTION_PRODUCT_IDS, HABITAT_DEMO_NAVIGATION, withHabitatDemoContent } from './habitat-demo';
import { KINDRED_DEMO_PRODUCTS, KINDRED_DEMO_COLLECTIONS, KINDRED_DEMO_COLLECTION_PRODUCT_IDS, KINDRED_DEMO_NAVIGATION, withKindredDemoContent } from './kindred-demo';
import { MADEYOURS_DEMO_PRODUCTS, MADEYOURS_DEMO_COLLECTIONS, MADEYOURS_DEMO_COLLECTION_PRODUCT_IDS, MADEYOURS_DEMO_NAVIGATION, withMadeYoursDemoContent } from './madeyours-demo';
import { DEWDROP_DEMO_PRODUCTS, DEWDROP_DEMO_COLLECTIONS, DEWDROP_DEMO_COLLECTION_PRODUCT_IDS, DEWDROP_DEMO_NAVIGATION, withDewdropDemoContent } from './dewdrop-demo';
import { TRAILMARK_DEMO_PRODUCTS, TRAILMARK_DEMO_COLLECTIONS, TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS, TRAILMARK_DEMO_NAVIGATION, withTrailmarkDemoContent } from './trailmark-demo';
import { MARGINALIA_DEMO_PRODUCTS, MARGINALIA_DEMO_COLLECTIONS, MARGINALIA_DEMO_COLLECTION_PRODUCT_IDS, MARGINALIA_DEMO_NAVIGATION, withMarginaliaDemoContent } from './marginalia-demo';

export type CatalogDemoContent = {
    slug: string;
    name: string;
    route: CatalogDemoRoute;
    version: string;
    products: ProductModel[];
    collections: Array<StorefrontCollectionSummary & { handle?: string; product_count: number }>;
    navigation: StoreNavigation;
    template: Record<string, unknown>;
    /** Absent means membership is not supplied; callers must never substitute all products. */
    collectionProductIds?: Record<string, string[]>;
};
type DemoSource = Omit<CatalogDemoContent, 'slug' | 'name' | 'route' | 'version' | 'template'> & {
    apply: (input: Record<string, unknown>) => Record<string, unknown>;
};
const sources: Record<string, DemoSource> = {
    'letbuyy-sense': { products: THREADLINE_DEMO_PRODUCTS, collections: THREADLINE_DEMO_COLLECTIONS, navigation: THREADLINE_DEMO_NAVIGATION, collectionProductIds: Object.fromEntries(THREADLINE_DEMO_COLLECTIONS.map((collection, index) => [collection.id, [THREADLINE_DEMO_PRODUCTS[index].id]])), apply: withThreadlineDemoContent },
    'letbuyy-bloom': { products: PLAYFIELD_DEMO_PRODUCTS, collections: PLAYFIELD_DEMO_COLLECTIONS, navigation: PLAYFIELD_DEMO_NAVIGATION, collectionProductIds: PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS, apply: withPlayfieldDemoContent },
    'letbuyy-forge': { products: CIRCUIT_DEMO_PRODUCTS, collections: CIRCUIT_DEMO_COLLECTIONS, navigation: CIRCUIT_DEMO_NAVIGATION, collectionProductIds: CIRCUIT_DEMO_COLLECTION_PRODUCT_IDS, apply: withCircuitDemoContent },
    'letbuyy-refresh': { products: PANTRY_DEMO_PRODUCTS, collections: PANTRY_DEMO_COLLECTIONS, navigation: PANTRY_DEMO_NAVIGATION, collectionProductIds: PANTRY_DEMO_COLLECTION_PRODUCT_IDS, apply: withPantryDemoContent },
    'letbuyy-craft': { products: HABITAT_DEMO_PRODUCTS, collections: HABITAT_DEMO_COLLECTIONS, navigation: HABITAT_DEMO_NAVIGATION, collectionProductIds: HABITAT_DEMO_COLLECTION_PRODUCT_IDS, apply: withHabitatDemoContent },
    'letbuyy-summit': { products: KINDRED_DEMO_PRODUCTS, collections: KINDRED_DEMO_COLLECTIONS, navigation: KINDRED_DEMO_NAVIGATION, collectionProductIds: KINDRED_DEMO_COLLECTION_PRODUCT_IDS, apply: withKindredDemoContent },
    'letbuyy-nova': { products: MADEYOURS_DEMO_PRODUCTS, collections: MADEYOURS_DEMO_COLLECTIONS, navigation: MADEYOURS_DEMO_NAVIGATION, collectionProductIds: MADEYOURS_DEMO_COLLECTION_PRODUCT_IDS, apply: withMadeYoursDemoContent },
    'letbuyy-aura': { products: DEWDROP_DEMO_PRODUCTS, collections: DEWDROP_DEMO_COLLECTIONS, navigation: DEWDROP_DEMO_NAVIGATION, collectionProductIds: DEWDROP_DEMO_COLLECTION_PRODUCT_IDS, apply: withDewdropDemoContent },
    'letbuyy-ride': { products: TRAILMARK_DEMO_PRODUCTS, collections: TRAILMARK_DEMO_COLLECTIONS, navigation: TRAILMARK_DEMO_NAVIGATION, collectionProductIds: TRAILMARK_DEMO_COLLECTION_PRODUCT_IDS, apply: withTrailmarkDemoContent },
    'letbuyy-dawn': { products: MARGINALIA_DEMO_PRODUCTS, collections: MARGINALIA_DEMO_COLLECTIONS, navigation: MARGINALIA_DEMO_NAVIGATION, collectionProductIds: MARGINALIA_DEMO_COLLECTION_PRODUCT_IDS, apply: withMarginaliaDemoContent },
};

/** A v1 package must never acquire a different theme's v2 artwork or sample facts. */
function freezeSample(value: unknown): void {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
    for (const nested of Object.values(value)) freezeSample(nested);
    Object.freeze(value);
}
const trustedContexts = new WeakSet<object>();
export function isTrustedCatalogDemoContent(value: unknown): value is CatalogDemoContent {
    return Boolean(value && typeof value === 'object' && trustedContexts.has(value));
}

export function resolveCatalogDemoContent(slug: string, catalogVersion: string, template: Record<string, unknown>, path = '/'): CatalogDemoContent | null {
    const source = Object.prototype.hasOwnProperty.call(sources, slug) ? sources[slug] : undefined;
    if (!source || !isCatalogDemoVersion(catalogVersion)) return null;
    const result = LiquidThemePackageBundleSchema.safeParse(template.liquidBundle);
    if (!result.success || result.data.package.slug !== slug || result.data.package.version !== catalogVersion) return null;
    const content: CatalogDemoContent = {
        slug, name: result.data.package.name, route: resolveCatalogDemoRoute(path), version: catalogVersion,
        products: structuredClone(source.products), collections: structuredClone(source.collections),
        navigation: structuredClone(source.navigation),
        collectionProductIds: source.collectionProductIds ? structuredClone(source.collectionProductIds) : undefined,
        template: source.apply(structuredClone(template)),
    };
    content.navigation.footer = [...(content.navigation.footer || []),
        { id: 'catalog-demo-about', label: 'About this sample shop', href: '/pages/about', isDefault: false, isVisible: true },
        { id: 'catalog-demo-journal', label: 'Sample journal', href: '/blog', isDefault: false, isVisible: true },
        { id: 'catalog-demo-contact', label: 'Contact', href: '/contact', isDefault: false, isVisible: true },
    ];
    const normalizeLinks = (items: NonNullable<StoreNavigation['main']>): NonNullable<StoreNavigation['main']> => items.map(item => {
        const target = catalogDemoNavigationTarget(item.href, 'https://catalog-demo.invalid', slug, catalogVersion);
        const href = item.href.startsWith('#') ? item.href : target ? new URL(target, 'https://catalog-demo.invalid').searchParams.get('demo_path') || '/' : '#demo-link-unavailable';
        return { ...item, href, ...(item.children ? { children: normalizeLinks(item.children) } : {}) };
    });
    for (const key of ['main','footer','policies'] as const) content.navigation[key] = normalizeLinks(content.navigation[key] || []);
    freezeSample(content);
    trustedContexts.add(content);
    return content;
}

/** Signed/bounded visitor identity is supplied by the trusted server demo adapter. */
export function catalogDemoStateNamespace(slug: string, version: string, visitorId: string): string | null {
    if (!Object.prototype.hasOwnProperty.call(sources, slug) || !isCatalogDemoVersion(version) || !/^[a-zA-Z0-9_-]{16,120}$/.test(visitorId)) return null;
    return `catalog-demo:${slug}:${version}:${visitorId}`;
}
/** Unknown or unsupplied membership stays unavailable, including a valid empty collection. */
export function resolveCatalogDemoCollection(content: CatalogDemoContent, identity: string): ProductModel[] | null {
    const collection = content.collections.find(item => item.id === identity || ('handle' in item && item.handle === identity));
    if (!collection) return null;
    const ids = content.collectionProductIds?.[collection.id];
    if (!ids) return null;
    const products = ids.map(id => content.products.find(product => product.id === id));
    return products.every((product): product is ProductModel => Boolean(product)) ? products : null;
}
