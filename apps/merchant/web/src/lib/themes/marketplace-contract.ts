import type { ThemeCatalogResponse, ThemeListQuery } from '@letbuyy/api-client';
import { JsonRecordSchema, ThemeSchema, type ThemeEditableSchemaResponse } from '@letbuyy/shared-types';
import { InstallThemeSchema, ThemeBundlePackageMetadataSchema, ThemeSlugParamSchema, confirmThemeInstallReceipt, confirmThemeInstallLibraryReadback } from '@letbuyy/theme-engine';

// Transport schemas derive existing public Zod validators. No app-local commerce DTO.
const text = ThemeBundlePackageMetadataSchema.shape.name;
const positiveInteger = ThemeBundlePackageMetadataSchema.shape.version_number.unwrap();
export const MarketplaceQuerySchema = ThemeSlugParamSchema.omit({ slug: true }).extend({
    search: text.max(120).optional(), category: text.max(80).optional(), feature: text.max(100).optional(),
    theme_slug: ThemeSlugParamSchema.shape.slug.optional(),
    sort: text.refine(value => ['portfolio', 'name', 'new'].includes(value), 'Choose a supported sort').default('portfolio'),
    page: positiveInteger.max(500).default(1), limit: positiveInteger.max(50).default(12),
});
export const MarketplaceInstallSchema = InstallThemeSchema.omit({ store_id: true, config_overrides: true, expected_version: true, expected_package_id: true, expected_package_version_id: true }).extend({
    store_name: ThemeSlugParamSchema.shape.slug.optional(),
    storeId: InstallThemeSchema.shape.store_id.optional(),
    themeSlug: ThemeSlugParamSchema.shape.slug.optional(),
    expectedVersion: InstallThemeSchema.shape.expected_version,
    expectedPackageId: InstallThemeSchema.shape.expected_package_id,
    expectedPackageVersionId: InstallThemeSchema.shape.expected_package_version_id,
    bundle: JsonRecordSchema.optional(),
}).refine(value => Boolean(value.store_name || value.storeId), 'Choose a destination store')
    .refine(value => Boolean(value.themeSlug) !== Boolean(value.bundle), 'Choose a theme or a package');

export function marketplaceQuery(params: URLSearchParams) {
    return MarketplaceQuerySchema.safeParse({
        search: params.get('search') || undefined, category: params.get('category') || undefined,
        feature: params.get('feature') || undefined, sort: params.get('sort') || 'portfolio',
        theme_slug: params.get('theme_slug') || undefined,
        page: Number(params.get('page') || 1), limit: Number(params.get('limit') || 12),
    });
}
export function gatewayCatalogQuery(query: ReturnType<typeof MarketplaceQuerySchema.parse>): ThemeListQuery {
    const { theme_slug: _detail, ...filters } = query;
    void _detail;
    return { ...filters, sort: query.sort === 'portfolio' ? 'portfolio' : query.sort };
}
export type MarketplaceCatalog = Omit<ThemeCatalogResponse, 'data' | 'current_theme' | 'current_theme_record' | 'store_status'> & {
    themes: ThemeCatalogResponse['data']; currentTheme: ThemeCatalogResponse['current_theme_record'];
    storeStatus: string | null; storeId: string | null; categories?: string[];
    selectedTheme?: ThemeCatalogResponse['data'][number] | null; selectedThemeStatus?: 'ready' | 'missing' | 'unavailable';
    selectedRuntime?: ThemeEditableSchemaResponse['theme'] | null;
    selectedRuntimeStatus?: 'ready' | 'unavailable';
};
export function payloadError(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') return fallback;
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error;
    return error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message : fallback;
}
/** Translate persisted marketplace price column names into the shared Theme contract. */
export function normalizeCatalogTheme(theme: ThemeCatalogResponse['data'][number]): ThemeCatalogResponse['data'][number] {
    const record = theme as unknown as Record<string, unknown>;
    const pricingValue = record.pricing_type ?? record.letbuyy_pricing_type;
    const amountValue = record.price_inr ?? record.letbuyy_price_inr ?? record.price;
    if (pricingValue == null || amountValue == null) throw new Error('Catalog pricing could not be confirmed.');
    const pricing = ThemeSchema.shape.pricing_type.safeParse(pricingValue);
    const amount = ThemeSchema.shape.price_inr.safeParse(amountValue);
    if (!pricing.success || !amount.success || (pricing.data === 'free' && (record.is_premium === true || amount.data !== 0))) throw new Error('Catalog pricing could not be confirmed.');
    return { ...theme, pricing_type: pricing.data, price_inr: amount.data };
}
export function editorHandoff(store: string, slug: string, instanceId: string, versionId?: string | null) {
    const params = new URLSearchParams({ theme_instance_id: instanceId });
    if (versionId) params.set('theme_package_version_id', versionId);
    return `/${encodeURIComponent(store)}/online-store/themes/${encodeURIComponent(slug)}/editor?${params}`;
}
/** Shared canonical receipt validation for merchant and standalone marketplace transports. */
export const confirmMarketplaceInstallReceipt = confirmThemeInstallReceipt;
/** Receipt + owned-library readback, independent of potentially filtered catalog pages. */
export async function addMarketplaceTheme(input: { store: string; slug: string; version?: string; packageId?: string; packageVersionId?: string; bundle?: unknown }) {
    const response = await fetch('/api/themes/install', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_name: input.store, themeSlug: input.bundle ? undefined : input.slug, expectedVersion: input.version,
            expectedPackageId: input.packageId, expectedPackageVersionId: input.packageVersionId, bundle: input.bundle }) });
    let wire: unknown;
    try { wire = await response.json(); } catch { throw new Error('The theme service did not return a confirmed installation. Check your library and retry.'); }
    if (!response.ok) throw new Error(payloadError(wire, 'Adding the theme was not confirmed. Retry the same theme.'));
    const confirmed = confirmMarketplaceInstallReceipt(wire, { slug: input.bundle ? undefined : input.slug, version: input.version, packageId: input.packageId, packageVersionId: input.packageVersionId });
    const read = await fetch(`/api/themes/library?store_name=${encodeURIComponent(input.store)}`, { cache: 'no-store' });
    const payload: unknown = await read.json();
    if (!read.ok) throw new Error('The theme service acknowledged Add, but library readback is unavailable. Retry to confirm the same installation.');
    confirmThemeInstallLibraryReadback(payload, confirmed.receipt);
    return { receipt: confirmed.receipt, href: editorHandoff(input.store, confirmed.slug, confirmed.instanceId, confirmed.packageVersionId) };
}
