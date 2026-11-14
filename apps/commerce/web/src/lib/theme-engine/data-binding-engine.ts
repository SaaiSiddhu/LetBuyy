import { ProductService } from '@/lib/product-service';
import { URBAN_KICKS_DEMO_SUBDOMAIN } from '@/lib/demo/urban-kicks-demo';
import type { ProductModel } from '@letbuyy/commerce-core';
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
    const configuredProductIds = getStringArray(section.settings.productIds);
    const idsToUse = configuredProductIds.length > 0 ? configuredProductIds : store.selectedProductIds;

    if (idsToUse.length === 0) return products;

    return idsToUse
        .map((id) => productsById.get(id))
        .filter((product): product is ProductModel => product !== undefined);
}

function sectionRequestsProductData(section: SectionModel): boolean {
    if (PRODUCT_SECTION_TYPES.has(section.type)) return true;
    if (section.rendererKey && PRODUCT_RENDERER_KEYS.has(section.rendererKey)) return true;
    if (getStringArray(section.settings.productIds).length > 0) return true;

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
}: {
    store: StoreModel;
    sections: SectionModel[];
    route: StorefrontRouteContext;
    // Caller-authorized, bounded catalog (for private editor previews).
    preloadedProducts?: ProductModel[];
}): Promise<Map<string, SectionRenderData>> {
    const dataBySectionId = new Map<string, SectionRenderData>();

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
    const productFilters = {
        ...(route.searchParams?.category ? { category: route.searchParams.category } : {}),
        ...(route.searchParams?.search ? { search: route.searchParams.search } : {}),
        ...(route.searchParams?.country_of_origin ? { country_of_origin: route.searchParams.country_of_origin } : {}),
        ...(route.searchParams?.page ? { page: Number(route.searchParams.page) || 1 } : {}),
    };
    const products = preloadedProducts ?? (isUrbanKicksDemo
        ? await ProductService.getUrbanKicksDemoProducts(allProductIds.size > 0 ? Array.from(allProductIds) : undefined)
        : allProductIds.size > 0
            ? await ProductService.getProductsByIds(Array.from(allProductIds), route.subdomain, productFilters)
            : await ProductService.getProductsByStoreSubdomain(route.subdomain, {
                ...productFilters,
                ...(route.searchParams?.page ? { page: Number(route.searchParams.page) || 1 } : {}),
            }));

    const productsById = new Map(products.map((product) => [product.id, product]));
    for (const section of productSections) {
        const sectionProducts = getProductsForSection(section, store, products, productsById);
        dataBySectionId.set(section.id, {
            products: sectionProducts,
            ...(sectionRequestsSingleProduct(section, route) ? { product: sectionProducts[0] || products[0] } : {}),
        });
    }

    return dataBySectionId;
}
