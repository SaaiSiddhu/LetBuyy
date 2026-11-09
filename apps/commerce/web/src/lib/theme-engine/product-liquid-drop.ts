import { buildProductFactPresentation, buildVariantFactPresentation, readProductNicheFacts, readVariantNicheFacts, resolveToyFacts, type ProductModel } from '@letbuyy/commerce-core';
import { encodeVariantOptions, encodeVariantFactPresentation, encodeResolvedToyFacts, MAX_PRODUCT_FACT_CARRIER_BYTES, MAX_VARIANT_FACT_CARRIER_BYTES } from './variant-options-carrier';
const VARIANT_DISPLAY_FIELDS = [
    'id', 'product_id', 'name', 'title', 'price', 'compare_price',
    'prior_lowest_price_30d', 'prior_price_coverage_complete',
    'stock', 'stock_quantity', 'inventory_qty', 'options', 'image', 'image_url',
    'weight', 'weight_unit', 'option1', 'option2', 'option3', 'position',
] as const;

/** Keep the routed PDP subject out of its own recommendations, preserving
 * confirmed other products and their supplied order and availability. */
export function withoutCurrentLiquidProduct(
    products: readonly Record<string, unknown>[],
    currentProduct: Record<string, unknown> | null,
): Record<string, unknown>[] {
    return products.filter(product => !currentProduct || product.id !== currentProduct.id);
}

function variantDisplayFields(variant: NonNullable<ProductModel['variants']>[number]): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const key of VARIANT_DISPLAY_FIELDS) {
        const field = Object.getOwnPropertyDescriptor(variant, key);
        if (field && 'value' in field) {
            output[key] = field.value;
        }
    }
    return output;
}
function productSlug(product: ProductModel | null | undefined): string {
    if (!product) {
        return '';
    }
    const explicitSlug = 'slug' in product && typeof product.slug === 'string' ? product.slug : '';
    if (explicitSlug) {
        return explicitSlug;
    }
    return product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || product.id;
}
export function productToLiquidDrop(product: ProductModel | null | undefined, basePath = ''): Record<string, unknown> | null {
    if (!product) {
        return null;
    }
    const handle = productSlug(product);
    const presentation = buildProductFactPresentation({ facts: product, priceMinor: Math.round(product.price * 100), hasVariants: Boolean(product.variants?.length), hasOptions: Boolean(product.variantOptions?.some(option => option.values.length)), variantCount: product.variants?.length ?? 0 });
    const common = readProductNicheFacts(product);
    let factCarrierBytes = 0;
    const boundedFacts = (value: Record<string, unknown>) => {
        const encoded = encodeVariantFactPresentation(value);
        if (!encoded) {
            return undefined;
        }
        const bytes = new TextEncoder().encode(encoded).byteLength;
        if (factCarrierBytes + bytes > MAX_PRODUCT_FACT_CARRIER_BYTES) {
            return undefined;
        }
        factCarrierBytes += bytes;
        return encoded;
    };
    const resolvedToys: unknown[] = [];
    const variants = (product.variants || []).map(variant => {
        const metadata = 'metadata' in variant ? variant.metadata : variant;
        const facts = buildVariantFactPresentation(metadata, product, Math.round((variant.price ?? product.price) * 100));
        const variantFacts = readVariantNicheFacts(metadata);
        const toys = common.toys || variantFacts.toys ? resolveToyFacts(common.toys, variantFacts.toys) : null;
        resolvedToys.push(toys);
        return { ...variantDisplayFields(variant), options_json: encodeVariantOptions(variant.options), ...facts,
            facts_json: boundedFacts({ ...facts, ...(toys ? { toys } : {}) }),
        };
    });
    // Reserve existing display carriers first. Structured toys may use only the
    // remaining SAME budgets; they cannot evict another variant/niche's facts.
    const productFacts = boundedFacts(presentation);
    const boundedToys = (toys: unknown, flat: string | undefined) => {
        if (!toys) return undefined;
        const encoded = encodeResolvedToyFacts(toys);
        if (!encoded) return undefined;
        const bytes = new TextEncoder().encode(encoded).byteLength;
        const flatBytes = flat ? new TextEncoder().encode(flat).byteLength : 0;
        if (flatBytes + bytes > MAX_VARIANT_FACT_CARRIER_BYTES || factCarrierBytes + bytes > MAX_PRODUCT_FACT_CARRIER_BYTES) return undefined;
        factCarrierBytes += bytes;
        return encoded;
    };
    const publicVariants = variants.map((variant, index) => ({ ...variant, toys_resolved_json: boundedToys(resolvedToys[index], variant.facts_json) }));
    const productToys = boundedToys(common.toys, productFacts);
    return {
        id: product.id,
        handle,
        title: product.name,
        name: product.name,
        description: product.description,
        // T2a — kept as MAJOR units (rupees), matching product-grid.tsx's own `₹{product.price}` and
        // this same field's OTHER consumer, `data-product-price` on the add-to-cart/wishlist islands
        // (whose client-side formatCartMoney also expects major units, no /100). The Liquid
        // `money_with_currency` filter expects MINOR units (matches order/cart data) — templates that
        // display this field convert at the call site (`| times: 100 | money_with_currency: ...`)
        // rather than this drop carrying two differently-scaled fields under one name.
        price: product.price,
        compare_at_price: product.compareAtPrice,
        currency: product.currency || 'INR',
        url: `${basePath}/product/${product.id}`,
        featured_image: product.images[0] || null,
        images: product.images,
        available: product.stock !== null && product.stock > 0 && product.isActive !== false,
        inventory_known: product.stock !== null,
        stock: product.stock,
        tags: product.tags || [],
        apparel: product.apparel ?? null,
        ...presentation,
        facts_json: productFacts,
        toys_resolved_json: productToys,
        variants: publicVariants,
        options: product.variantOptions || [],
        has_options: Boolean(product.variantOptions?.some(option => option.values.length)),
        variant_count: product.variants?.length ?? 0,
        option_summaries: (product.variantOptions || []).map(option => ({ name: option.name, summary: option.values.join(', ') })),
        rating: product.rating ?? 0,
        review_count: product.reviewCount ?? 0,
        reviews: [],
        in_wishlist: false,
    };
}
