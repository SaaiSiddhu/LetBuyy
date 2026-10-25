import type { CatalogDemoContent } from '../demo/catalog-demo-dispatch';
import { resolveCatalogDemoCollection } from '../demo/catalog-demo-dispatch';
import { assertCatalogDemoScope, selectCatalogDemoProducts } from './catalog-demo-data';
import { ProductService } from '@/lib/product-service';
import { URBAN_KICKS_DEMO_SUBDOMAIN } from '@/lib/demo/urban-kicks-demo';
import type { ProductModel } from '@letbuyy/commerce-core';
import { discoveryRouteQuery } from './discovery-route-query';
import { routeDiscoveryQuery, validateDiscoveryProductPage, hasDiscoveryFilters, type StorefrontDiscoveryProductPage, type DiscoverySectionData } from './storefront-discovery';
import type { SectionModel } from '@letbuyy/theme-engine';
import type { StoreModel } from '@letbuyy/tenant-core';
import type { SectionRenderData, StorefrontRouteContext } from './types';

const PRODUCT_SECTION_TYPES = new Set([
    'productGrid',
    'featuredProducts',
    'product-grid',
    'featured-products',
    'product-detail',
    // T2a/W1c — collection-product-list.liquid (the /products "all products" page AND the /search
    // results page both resolve to this section type) reads `collection.products`, which
    // composition-engine.tsx's collectLiquidProducts() only populates from a section's OWN fetched
    // `products`/`product` SectionRenderData fields. Without this section type registered here,
    // buildSectionDataPlan's early-return at `productSections.length === 0` fired for every request
    // to either page, so `collection.products` was always empty regardless of how many real products
    // the store had — the page rendered its own real, non-fabricated empty state, which read as
    // "products aren't showing" rather than the actual bug (products were never fetched at all).
    'collection-product-list',
]);
const PRODUCT_RENDERER_KEYS = new Set([
    'core.product-grid',
    'core.featured-products',
    'core.product-detail',
    'liquid.section.product-grid',
    'liquid.section.featured-products',
    'liquid.section.product-detail',
    'liquid.section.collection-product-list',
]);

function getStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
}

function getProductsForSection(
    section: SectionModel,
    store: StoreModel,
    products: ProductModel[],
    productsById: Map<string, ProductModel>,
): ProductModel[] {
    const configuredProductIds = [...getStringArray(section.settings.productIds), ...[section.settings.product1, section.settings.product2, section.settings.product3].filter((id): id is string => typeof id === 'string' && id.length > 0)];
    const idsToUse = configuredProductIds.length > 0 ? configuredProductIds : store.selectedProductIds;

    if (configuredProductIds.length === 0 && section.settings.requireSelection === true) return [];
    if (idsToUse.length === 0) return products;

    return idsToUse
        .map((id) => productsById.get(id))
        .filter((product): product is ProductModel => product !== undefined);
}

function sectionRequestsProductData(section: SectionModel): boolean {
    if (PRODUCT_SECTION_TYPES.has(section.type)) return true;
    if (section.rendererKey && PRODUCT_RENDERER_KEYS.has(section.rendererKey)) return true;
    if (getStringArray(section.settings.productIds).length > 0) return true;
    if ([section.settings.product1, section.settings.product2, section.settings.product3].some(id => typeof id === 'string' && id.length > 0)) return true;

    const binding = section.settings.dataBinding;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return false;

    const bindingRecord = binding as Record<string, unknown>;
    return bindingRecord.resource === 'products'
        || bindingRecord.resourceType === 'products'
        || getStringArray(bindingRecord.resources).includes('products');
}

function sectionRequestsSingleProduct(section: SectionModel, route: StorefrontRouteContext): boolean {
    return route.type === 'product'
        || section.type === 'product-detail'
        || section.rendererKey === 'liquid.section.product-detail'
        || section.rendererKey === 'core.product-detail';
}

export async function buildSectionDataPlan({
    store,
    sections,
    route,
    preloadedProducts,
    preloadedDiscoveryPage,
    collection,
    previewToken,
    catalogDemo,
}: {
    store: StoreModel;
    sections: SectionModel[];
    route: StorefrontRouteContext;
    // Caller-authorized, bounded catalog (for private editor previews).
    preloadedProducts?: ProductModel[];
    preloadedDiscoveryPage?: StorefrontDiscoveryProductPage;
    collection?: SectionRenderData['collection'];
    previewToken?: string;
    catalogDemo?: CatalogDemoContent;
}): Promise<Map<string, SectionRenderData>> {
    const dataBySectionId = new Map<string, SectionRenderData>();
    if (catalogDemo) {
        assertCatalogDemoScope(catalogDemo, store.id, route);
        const selected = selectCatalogDemoProducts(catalogDemo, route);
        const productsById = new Map(catalogDemo.products.map(product => [product.id, product]));
        const exactProduct = route.type === 'product' ? productsById.get(route.resourceId || '') : undefined;
        for (const section of sections.filter(sectionRequestsProductData)) {
            const collectionId = section.settings.collectionId;
            const sectionProducts = typeof collectionId === 'string' && collectionId
                ? resolveCatalogDemoCollection(catalogDemo, collectionId) || []
                : section.type === 'collection-product-list' ? selected.products
                    : getProductsForSection(section, { ...store, selectedProductIds: selected.products.map(product => product.id) }, selected.products, productsById);
            dataBySectionId.set(section.id, {
                products: sectionProducts,
                ...(['collection','search'].includes(route.type) ? { pagination: selected.pagination } : {}),
                ...(selected.collection ? { collection: { id: selected.collection.id, title: selected.collection.title, description: selected.collection.description } } : {}),
                ...(exactProduct ? { product: exactProduct } : {}),
            });
        }
        return dataBySectionId;
    }

    if (store.siteType !== 'store') {
        return dataBySectionId;
    }

    const productSections = sections.filter(sectionRequestsProductData);
    if (productSections.length === 0) {
        return dataBySectionId;
    }

    const allProductIds = new Set<string>();
    for (const section of productSections) {
        getStringArray(section.settings.productIds).forEach((id) => allProductIds.add(id));
        [section.settings.product1, section.settings.product2, section.settings.product3].forEach(id => { if (typeof id === 'string' && id) allProductIds.add(id); });
    }
    store.selectedProductIds.forEach((id) => allProductIds.add(id));

    // S6/W2 — pre-existing gap, closed while building the load harness: the demo/preview route
    // (app/preview/page.tsx) already sources its TOP-LEVEL product list from the Urban Kicks demo
    // fixture, not a live backend fetch (see loadProductsForStore there) — but this function, which
    // resolves PER-SECTION product bindings for product-grid/featured-products/product-detail
    // sections, had no equivalent special case and unconditionally hit the real gateway, which is
    // not running in a bare `next start` load-test environment (ECONNREFUSED). Mirrors the exact
    // same demo-subdomain check loadProductsForStore already uses.
    const isUrbanKicksDemo = route.subdomain === URBAN_KICKS_DEMO_SUBDOMAIN;
    const listing = route.type === 'collection' || route.type === 'search';
    const query = listing ? routeDiscoveryQuery(route) : discoveryRouteQuery({ limit: 100, ...(route.type === 'index' ? route.searchParams : {}), ...(route.type === 'index' ? route.discoveryQuery : {}) });
    const identity = route.resourceId || route.resourceSlug;
    const namedCollection = route.type === 'collection' && identity && !['all', 'all-products'].includes(identity);
    const searchUnperformed = route.type === 'search' && !query.search && !hasDiscoveryFilters(query);
    const boundedPreload = preloadedProducts !== undefined && !previewToken;
    let collectionMeta = collection;
    let pageResult = preloadedDiscoveryPage;
    if (pageResult) {
        const requested = namedCollection && collectionMeta ? { ...query, collection_id: collectionMeta.id } : query;
        pageResult = validateDiscoveryProductPage(pageResult, requested);
    } else if (boundedPreload || searchUnperformed) {
        // Caller-authorized bounded data, including [], never authorizes a fresh public read.
    } else if (!isUrbanKicksDemo && namedCollection && identity) {
        const { loadNamedCollectionProductPage } = await import('./collection-discovery');
        const selected = await loadNamedCollectionProductPage(route.subdomain, identity, query, previewToken);
        if (!selected) throw new Error('This collection is unavailable. Choose another collection.');
        collectionMeta = selected.collection;
        pageResult = selected.page;
    } else if (!isUrbanKicksDemo && (listing || preloadedProducts === undefined)) {
        pageResult = await ProductService.getProductPage(route.subdomain, query, previewToken);
    }
    // Presence, not length, decides whether an authorized/preloaded page is used.
    const products = pageResult?.data ?? preloadedProducts ?? (searchUnperformed ? [] : await ProductService.getUrbanKicksDemoProducts(allProductIds.size ? Array.from(allProductIds) : undefined));
    const missingIds = Array.from(allProductIds).filter(id => !products.some(product => product.id === id)).slice(0, 100);
    const extraProducts = !listing && preloadedProducts === undefined && !isUrbanKicksDemo && missingIds.length
        ? previewToken ? await ProductService.getPreviewProducts(route.subdomain, previewToken, missingIds)
            : await ProductService.getProductsByIds(missingIds, route.subdomain)
        : [];
    const productsById = new Map([...products, ...extraProducts].map(product => [product.id, product]));
    const collectionIds = listing || boundedPreload ? [] : [...new Set(productSections.map(section => section.settings.collectionId).filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (collectionIds.length > 12) throw new Error('Use at most twelve collection bindings per page.');
    const collectionProducts = new Map(await Promise.all(collectionIds.map(async id => [id, await ProductService.getCollectionProducts(route.subdomain, id, previewToken)] as const)));
    for (const section of productSections) {
        if (boundedPreload && !listing && typeof section.settings.collectionId === 'string' && section.settings.collectionId && collection?.id !== section.settings.collectionId) throw new Error('This bounded preview collection binding is unavailable.');
        const sectionProducts = listing ? products
            : typeof section.settings.collectionId === 'string' && section.settings.collectionId
                ? collectionProducts.get(section.settings.collectionId) ?? []
                : getProductsForSection(section, store, products, productsById);
        const data: DiscoverySectionData = {
            products: sectionProducts,
            ...(pageResult ? { discoveryPage: pageResult, pagination: { total: pageResult.total, page: pageResult.page, limit: pageResult.limit, has_more: pageResult.has_more } } : {}),
            ...(collectionMeta ? { collection: collectionMeta } : {}),
            ...(sectionRequestsSingleProduct(section, route) ? { product: sectionProducts[0] || products[0] } : {}),
        };
        dataBySectionId.set(section.id, data);
    }

    return dataBySectionId;
}
