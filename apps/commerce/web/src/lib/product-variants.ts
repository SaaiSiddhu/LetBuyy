import type { ProductModel } from '@letbuyy/commerce-core';

/** Adapt the public catalog's positional variant fields to existing Liquid picker contracts. */
export function mapPublicProductVariants(data: Record<string, unknown>, variants: Array<Record<string, unknown>>) {
    const configured = Array.isArray(data.product_options) ? data.product_options as Array<Record<string, unknown>> : [];
    const options = configured.filter(option => typeof option.name === 'string').sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
    const groups = options.length ? options : [1, 2, 3].flatMap(index => {
        const values = [...new Set(variants.map(variant => variant[`option${index}`]).filter((value): value is string => typeof value === 'string' && value.length > 0))];
        return values.length ? [{ name: `Option ${index}`, values, position: index - 1 }] : [];
    });
    return {
        variantOptions: groups.map(option => ({ name: String(option.name), values: Array.isArray(option.values) ? option.values.filter((value): value is string => typeof value === 'string') : [] })),
        variants: variants.map(variant => ({ ...variant, options: Object.fromEntries(groups.flatMap((option, index) => {
            const value = variant[`option${options.length ? index + 1 : Number(option.position) + 1}`];
            return typeof value === 'string' && value.length ? [[String(option.name), value]] : [];
        })) })) as unknown as ProductModel['variants'],
    };
}
