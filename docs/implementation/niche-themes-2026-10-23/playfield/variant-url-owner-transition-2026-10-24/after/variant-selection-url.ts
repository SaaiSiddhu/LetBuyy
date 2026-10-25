import { UuidSchema } from '@letbuyy/shared-types';
import type { PickerVariant } from './variant-options-carrier';

export type PickerOptionGroups = ReadonlyMap<string, ReadonlySet<string>>;
const privateQueryKeys = new Set(['subdomain', 'site_id', 'store_id', 'theme_preview_token', 'preview_token', 'token', 'theme_instance_id', 'theme_package_id', 'theme_package_version_id', 'theme_preview_session_id', 'demo_path', 'preview']);
const uuid = (value: unknown): string | null => {
    const parsed = UuidSchema.safeParse(value);
    return parsed.success ? parsed.data.toLowerCase() : null;
};

/** Buyer PDP only. Neither editor/preview nor catalog demo routes can bind this behavior. */
export function buyerVariantUrl(href: string, productId: string): URL | null {
    try {
        const url = new URL(href), id = uuid(productId);
        if (!id || !['http:', 'https:'].includes(url.protocol) || [...url.searchParams.keys()].some(key => privateQueryKeys.has(key))) return null;
        const match = url.pathname.match(/^\/(?:store\/[^/]+\/)?product\/([^/]+)\/?$/);
        return match && uuid(decodeURIComponent(match[1])) === id ? url : null;
    } catch { return null; }
}

/** One complete, unambiguous option tuple and one durable row. No first-match fallback. */
export function uniquePickerVariant(variants: PickerVariant[], groups: PickerOptionGroups, selected: Record<string, string>): PickerVariant | null {
    const names = [...groups.keys()];
    if (!names.length || Object.keys(selected).length !== names.length || names.some(name => !Object.hasOwn(selected, name) || !groups.get(name)!.has(selected[name]))) return null;
    const matches = variants.filter(variant => variant.options && Object.keys(variant.options).length === names.length && names.every(name => variant.options![name] === selected[name]));
    const match = matches.length === 1 ? matches[0] : null;
    if (!match?.id || variants.filter(row => row.id?.toLowerCase() === match.id!.toLowerCase()).length !== 1) return null;
    return match;
}

export function variantFromBuyerUrl(href: string, productId: string, variants: PickerVariant[], groups: PickerOptionGroups): PickerVariant | null {
    const url = buyerVariantUrl(href, productId), values = url?.searchParams.getAll('variant');
    if (!values || values.length !== 1) return null;
    const id = uuid(values[0]);
    if (!id) return null;
    const rows = variants.filter(row => uuid(row.id) === id);
    if (rows.length !== 1 || !rows[0].options) return null;
    return uniquePickerVariant(variants, groups, rows[0].options) === rows[0] ? rows[0] : null;
}

/** Change only one public selection key; unrelated repeated values/hash survive serialization. */
export function buyerUrlWithVariant(href: string, productId: string, variantId: string | null): string | null {
    const url = buyerVariantUrl(href, productId);
    if (!url) return null;
    const id = variantId === null ? null : uuid(variantId);
    if (variantId !== null && !id) return null;
    if (id) url.searchParams.set('variant', id);
    else if (url.searchParams.has('variant')) url.searchParams.delete('variant');
    else return url.href;
    return url.href;
}
