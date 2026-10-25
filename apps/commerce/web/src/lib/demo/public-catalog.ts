import type { Theme } from '@letbuyy/shared-types';
import { ThemeSchema } from '@letbuyy/shared-types';
import { ThemeBundlePackageMetadataSchema, ThemeSlugParamSchema } from '@letbuyy/theme-engine';

const text = ThemeBundlePackageMetadataSchema.shape.name;
const integer = ThemeBundlePackageMetadataSchema.shape.version_number.unwrap();
export const PublicCatalogQuerySchema = ThemeSlugParamSchema.omit({ slug: true }).extend({
    search: text.max(120).optional(), category: text.max(80).optional(),
    theme: ThemeSlugParamSchema.shape.slug.optional(),
    sort: text.refine(value => ['portfolio', 'name', 'new'].includes(value)).default('portfolio'),
    page: integer.max(500).default(1),
});
export function publicCatalogQuery(params: Record<string, string | string[] | undefined>) {
    const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
    return PublicCatalogQuerySchema.safeParse({
        search: single(params.search) || undefined, category: single(params.category) || undefined,
        theme: single(params.theme) || undefined, sort: single(params.sort) || 'portfolio',
        page: Number(single(params.page) || 1),
    });
}
export function publicCatalogHref(query: Record<string, string | number | undefined>, changes: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...query, ...changes })) if (value !== undefined && value !== '') params.set(key, String(value));
    return `/theme-preview${params.size ? `?${params}` : ''}`;
}
/** The public API still carries persisted price aliases during canonical projection wiring. */
export function publicThemePrice(theme: Theme): string {
    const record = theme as unknown as Record<string, unknown>;
    const pricingValue = record.pricing_type ?? record.letbuyy_pricing_type;
    const amountValue = record.price_inr ?? record.letbuyy_price_inr ?? record.price;
    if (pricingValue == null || amountValue == null) return 'Pricing unavailable';
    const pricing = ThemeSchema.shape.pricing_type.safeParse(pricingValue);
    const amount = ThemeSchema.shape.price_inr.safeParse(amountValue);
    if (!pricing.success || !amount.success) return 'Pricing unavailable';
    if (pricing.data === 'free') return amount.data === 0 && record.is_premium !== true ? 'Free' : 'Pricing unavailable';
    const formatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount.data);
    return `${formatted}${pricing.data === 'subscription' ? ' · subscription' : ''}`;
}
