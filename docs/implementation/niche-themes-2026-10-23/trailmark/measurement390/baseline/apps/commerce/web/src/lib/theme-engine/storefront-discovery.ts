import {
    StorefrontDiscoveryMetadataSchema, StorefrontDiscoveryQuerySchema,
    STOREFRONT_DISCOVERY_FILTER_KEYS, clearStorefrontDiscoveryFilterUrl, storefrontDiscoveryUrl,
    type ProductModel, type StorefrontDiscoveryMetadata, type StorefrontDiscoveryQuery, type StorefrontDiscoveryFilterKey,
} from '@letbuyy/commerce-core';
import type { PaginatedResponse } from '@letbuyy/shared-types';
import type { SectionRenderData, StorefrontRouteContext } from './types';
import { discoveryRouteQuery } from './discovery-route-query';

export type StorefrontDiscoveryProductPage = PaginatedResponse<ProductModel> & { discovery?: StorefrontDiscoveryMetadata };
/** App render metadata, carried with the same page response rather than attached to domain products. */
export type DiscoverySectionData = SectionRenderData & { discoveryPage?: StorefrontDiscoveryProductPage };
const filterKeys = STOREFRONT_DISCOVERY_FILTER_KEYS.filter((key): key is StorefrontDiscoveryFilterKey => STOREFRONT_DISCOVERY_FILTER_KEYS.includes(key));
export function hasDiscoveryFilters(query: StorefrontDiscoveryQuery): boolean { return filterKeys.some(key => query[key] !== undefined); }
const legacyFilters = new Set<StorefrontDiscoveryFilterKey>(['category', 'country_of_origin', 'collection_id', 'size', 'color', 'min_price', 'max_price']);
export class StorefrontDiscoveryUnsupportedError extends Error {
    readonly code = 'UNSUPPORTED_DISCOVERY_FILTER';
    constructor() { super('These product filters are unavailable. Clear those filters and try again.'); this.name = 'StorefrontDiscoveryUnsupportedError'; }
}
const unavailable = () => new Error('Product discovery is temporarily unavailable. Please try again.');

export function validateDiscoveryProductPage(page: StorefrontDiscoveryProductPage, requested: StorefrontDiscoveryQuery): StorefrontDiscoveryProductPage {
    if (!Array.isArray(page.data) || !Number.isInteger(page.total) || page.total < 0
        || page.page !== requested.page || page.limit !== requested.limit || page.data.length > page.limit || page.data.length > page.total
        || typeof page.has_more !== 'boolean' || page.has_more !== (page.page * page.limit < page.total)) throw unavailable();
    if (page.discovery === undefined) {
        // The existing basic/apparel API remains usable. New niche filters need response proof.
        if (filterKeys.some(key => !legacyFilters.has(key) && requested[key] !== undefined)) throw new StorefrontDiscoveryUnsupportedError();
        return page;
    }
    const parsed = StorefrontDiscoveryMetadataSchema.safeParse(page.discovery);
    if (!parsed.success) throw unavailable();
    const metadata = parsed.data;
    if (storefrontDiscoveryUrl('/products', metadata.query) !== storefrontDiscoveryUrl('/products', requested)
        || metadata.matches.length !== page.data.length
        || new Set(page.data.map(product => product.id)).size !== page.data.length
        || metadata.matches.some((match, index) => match.product_id !== page.data[index].id || new Set(match.variant_ids).size !== match.variant_ids.length)
        || metadata.facets.some(facet => facet.count > page.total || !StorefrontDiscoveryQuerySchema.shape[facet.key].safeParse(facet.value).success)) throw unavailable();
    return { ...page, discovery: metadata };
}

export function routeDiscoveryQuery(route: StorefrontRouteContext): StorefrontDiscoveryQuery {
    const query = route.discoveryQuery ? StorefrontDiscoveryQuerySchema.parse(route.discoveryQuery) : discoveryRouteQuery(route.searchParams);
    const selected = StorefrontDiscoveryQuerySchema.shape.collection_id.safeParse(route.searchParams?.collection_id);
    if (!selected.success || selected.data && query.collection_id && selected.data !== query.collection_id) throw new Error('Check the selected collection and try again.');
    return selected.data ? { ...query, collection_id: selected.data } : query;
}
export function findDiscoveryPage(data: Map<string, SectionRenderData>): StorefrontDiscoveryProductPage | undefined {
    for (const row of data.values()) if ('discoveryPage' in row && row.discoveryPage) return (row as DiscoverySectionData).discoveryPage;
    return undefined;
}

const labels: Partial<Record<StorefrontDiscoveryFilterKey, string>> = {
    category: 'Category', country_of_origin: 'Country of origin', collection_id: 'Collection', size: 'Size', color: 'Color', min_price: 'Minimum price', max_price: 'Maximum price',
    age_band: 'Age recommendation', interest: 'Interest', electronics_kind: 'Accessory type', connector: 'Connector', power_input_w: 'Power input (W)', power_output_w: 'Power output (W)', power_capacity_w: 'Capacity (W)', pass_through_output_w: 'Pass-through output (W)', data_rate_mbps: 'Data rate (Mbps)', length_mm: 'Length (mm)',
    pack_size: 'Pack size', material: 'Material', finish: 'Finish', max_width_cm: 'Maximum width (cm)', max_depth_cm: 'Maximum depth (cm)', occasion: 'Occasion', recipient: 'Recipient', personalization_method: 'Personalization method', routine_stage: 'Routine stage', format: 'Format', shade: 'Shade', activity: 'Activity', equipment_type: 'Equipment type', length_value: 'Equipment length', length_unit: 'Length unit', books_kind: 'Product type', books_author: 'Author', books_subject: 'Subject', books_language: 'Language', books_format: 'Book format', books_ruling: 'Ruling',
};
const electronics = new Set<StorefrontDiscoveryFilterKey>(['electronics_kind','connector','power_input_w','power_output_w','power_capacity_w','pass_through_output_w','data_rate_mbps','length_mm']);
const sortChoices = [ ['display_order','Featured'], ['price-asc','Price: low to high'], ['price-desc','Price: high to low'], ['newest','Newest'], ['name','Name'] ];

/** Pure projection from ONE response. Missing metadata never advertises a niche capability. */
export function projectDiscoveryPage(page: StorefrontDiscoveryProductPage, path: string, query: StorefrontDiscoveryQuery, fixedCollection = false) {
    const metadata = page.discovery;
    const enabled = Boolean(metadata);
    const activeQuery = metadata?.query ?? query;
    const clearKey = (key: StorefrontDiscoveryFilterKey, value?: string) => key === 'length_value' || key === 'length_unit'
        ? storefrontDiscoveryUrl(path, activeQuery, { page: 1, length_value: undefined, length_unit: undefined })
        : clearStorefrontDiscoveryFilterUrl(path, activeQuery, key, value);
    const activeFilters = filterKeys.flatMap(key => {
        const value = activeQuery[key];
        if (value === undefined || key === 'length_unit' || fixedCollection && key === 'collection_id') return [];
        return (Array.isArray(value) ? value : [value]).map(item => {
            const raw = String(item);
            const supplied = metadata?.facets.find(facet => facet.key === key && facet.value === raw);
            const label = key === 'length_value' ? `${raw} ${activeQuery.length_unit}` : supplied?.label ?? raw;
            return { key, value: raw, label: `${labels[key] ?? key}: ${label}`, clear_url: clearKey(key, raw) };
        });
    });
    const clearPatch = Object.fromEntries(filterKeys.filter(key => !(fixedCollection && key === 'collection_id')).map(key => [key, undefined]));
    const facets = (metadata?.facets ?? []).map(facet => { const selected = activeQuery[facet.key]; return { ...facet, group_label: labels[facet.key] ?? facet.key, selected: Array.isArray(selected) ? selected.some(value => value === facet.value) : String(selected) === facet.value }; });
    // Preserve selected zero-result values, without claiming a positive facet count.
    if (metadata) for (const filter of activeFilters) if (!facets.some(facet => facet.key === filter.key && facet.value === filter.value)) facets.push({ key: filter.key, value: filter.value, label: filter.value, count: 0, group_label: labels[filter.key] ?? filter.key, selected: true });
    const options = (key: StorefrontDiscoveryFilterKey) => facets.filter(facet => facet.key === key).map(({value,label,count,selected}) => ({value,label,count,selected}));
    const suppliedOptions = (key: StorefrontDiscoveryFilterKey) => options(key).filter(option => metadata?.facets.some(facet => facet.key === key && facet.value === option.value));
    const has = (...keys: StorefrontDiscoveryFilterKey[]) => Boolean(metadata?.facets.some(facet => keys.includes(facet.key)));
    const toyAgeBands = suppliedOptions('age_band'), toyInterests = suppliedOptions('interest');
    const sortOptions = sortChoices.map(([value,label]) => ({value,label,selected: activeQuery.sort === value}));
    const pages = Math.ceil(page.total / page.limit);
    const pagination = { total: page.total, page: page.page, limit: page.limit, pages, has_more: page.has_more,
        previous_url: page.page > 1 ? storefrontDiscoveryUrl(path, activeQuery, {page:page.page-1}) : null,
        next_url: page.has_more ? storefrontDiscoveryUrl(path, activeQuery, {page:page.page+1}) : null };
    return {
        query: activeQuery,
        collection: {
            total: page.total, pagination,
            capabilities: { discovery: enabled, toys_filters: Boolean(toyAgeBands.length || toyInterests.length), toys_age_band: toyAgeBands.length > 0, toys_interest: toyInterests.length > 0,
                electronics_filters: has(...electronics), food_filters: has('pack_size'), furniture_filters: has('material','finish','max_width_cm','max_depth_cm'), gift_filters: has('occasion','recipient'), personalization_filters: has('personalization_method'), beauty_filters: has('routine_stage','format','shade'), sports_filters: has('activity','equipment_type','length_value','length_unit'), books_filters: has('books_kind','books_author','books_subject','books_language','books_format','books_ruling') },
            discovery_facets: facets, discovery_query_fields: Object.entries(activeQuery).flatMap(([key,value]) => value === undefined || key === 'page' ? [] : (Array.isArray(value) ? value : [value]).map(item => ({key,value:String(item)}))),
            active_filters: activeFilters, sort_options: sortOptions, clear_filters_url: storefrontDiscoveryUrl(path, activeQuery, {...clearPatch,page:1}),
            toy_facets: {age_bands: toyAgeBands, interests: toyInterests},
            electronics_facets: facets.filter(facet => electronics.has(facet.key)), electronics_active_filters: activeFilters.filter(filter => electronics.has(filter.key)),
            food_filters: {enabled:has('pack_size'),pack_sizes: suppliedOptions('pack_size'),sort_options: enabled ? sortOptions : [],clear_pack_url: enabled && activeQuery.pack_size ? clearKey('pack_size') : null},
            furniture_filters_available: has('material','finish','max_width_cm','max_depth_cm'), furniture_facets: facets.filter(facet => ['material','finish','max_width_cm','max_depth_cm'].includes(facet.key)),
            beauty_filters_enabled: has('routine_stage','format','shade'), beauty_facets: facets.filter(facet => ['routine_stage','format','shade'].includes(facet.key)),
            sports_filters_enabled: has('activity','equipment_type','length_value','length_unit'), sports_facets: {activities:suppliedOptions('activity').map(option=>option.value),equipment_types:suppliedOptions('equipment_type').map(option=>option.value),length_units:suppliedOptions('length_unit').map(option=>option.value)},
        },
        shop: { gift_discovery_enabled: has('occasion','recipient'), gift_occasions: suppliedOptions('occasion'), gift_recipients: suppliedOptions('recipient') },
    };
}

/** Matching witnesses remain sidecars; persisted product price is never replaced. */
export function productDiscoveryWitness(page: StorefrontDiscoveryProductPage | undefined, productId: string) {
    const match = page?.discovery?.matches.find(candidate => candidate.product_id === productId);
    return match ? { matching_variant_ids: match.variant_ids, matching_price: match.price } : {};
}
