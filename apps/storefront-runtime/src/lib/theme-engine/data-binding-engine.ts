import { ProductService } from '@/lib/product-service';
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
]);
const PRODUCT_RENDERER_KEYS = new Set([
    'core.product-grid',
    'core.featured-products',
    'core.product-detail',
    'liquid.section.product-grid',
    'liquid.section.featured-products',
    'liquid.section.product-detail',
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
}: {
    store: StoreModel;
    sections: SectionModel[];
    route: StorefrontRouteContext;
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

    const products = allProductIds.size > 0
        ? await ProductService.getProductsByIds(Array.from(allProductIds), route.subdomain)
        : await ProductService.getProductsByStoreSubdomain(route.subdomain);

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
