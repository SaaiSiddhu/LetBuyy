export interface PublicProductPriceHistory {
    compareAtPrice?: number;
    priorLowestPrice30d?: number;
    priorPriceCoverageComplete: boolean;
    variants: Array<Record<string, unknown>>;
}

function finiteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/** Convert gateway price evidence into UI references without trusting seller compare-at fields. */
export function mapPublicProductPriceHistory(data: Record<string, unknown>): PublicProductPriceHistory {
    const currentPrice = finiteNumber(data.price);
    const priorLowestPrice = finiteNumber(data.prior_lowest_price_30d);
    const hasCompletePriceHistory = data.prior_price_coverage_complete === true
        && currentPrice !== null
        && priorLowestPrice !== null;
    const variants = Array.isArray(data.variants)
        ? (data.variants as Array<Record<string, unknown>>).map((variant) => {
            const variantPrice = finiteNumber(variant.price);
            const variantPriorLowest = finiteNumber(variant.prior_lowest_price_30d);
            const variantHasCompleteHistory = variant.prior_price_coverage_complete === true
                && variantPrice !== null
                && variantPriorLowest !== null;
            return {
                ...variant,
                compare_price: variantHasCompleteHistory && variantPriorLowest! > variantPrice!
                    ? variantPriorLowest
                    : null,
            };
        })
        : [];

    return {
        compareAtPrice: hasCompletePriceHistory && priorLowestPrice! > currentPrice! ? priorLowestPrice! : undefined,
        priorLowestPrice30d: hasCompletePriceHistory ? priorLowestPrice! : undefined,
        priorPriceCoverageComplete: hasCompletePriceHistory,
        variants,
    };
}
