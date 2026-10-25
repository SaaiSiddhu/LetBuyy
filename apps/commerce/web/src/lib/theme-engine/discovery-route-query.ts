import {
    StorefrontDiscoveryQuerySchema,
    storefrontDiscoveryQueryFromEntries,
    type StorefrontDiscoveryQuery,
} from '@letbuyy/commerce-core';

/** These are existing routing/capability controls, never catalogue filters or navigation state. */
const TRANSPORT_KEYS = new Set(['theme_preview_token', 'variant', 'editor', 'token']);
export class StorefrontDiscoveryQueryError extends Error {
    readonly code = 'INVALID_DISCOVERY_QUERY';
    constructor() { super('Check the product filter values and try again.'); this.name = 'StorefrontDiscoveryQueryError'; }
}

/** Next repeated query values stay arrays; the canonical schema rejects repeated scalar fields. */
export function discoveryRouteQuery(input?: Record<string, unknown> | URLSearchParams): StorefrontDiscoveryQuery {
    const raw = input instanceof URLSearchParams
        ? storefrontDiscoveryQueryFromEntries(input)
        : input === undefined ? {} : input;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new StorefrontDiscoveryQueryError();
    const explicitPreview = raw.theme_preview_token;
    if (explicitPreview !== undefined && (typeof explicitPreview !== 'string' || explicitPreview.length > 200)) throw new StorefrontDiscoveryQueryError();
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) if (!TRANSPORT_KEYS.has(key) && value !== undefined) values[key] = value;
    if (Object.hasOwn(values, 'q')) {
        if (Object.hasOwn(values, 'search') && values.search !== values.q) throw new StorefrontDiscoveryQueryError();
        values.search = values.q;
        delete values.q;
    }
    const parsed = StorefrontDiscoveryQuerySchema.safeParse(values);
    if (!parsed.success) throw new StorefrontDiscoveryQueryError();
    return parsed.data;
}

/** Compatibility context for account/CMS/error consumers; multivalues use route.discoveryQuery. */
export function scalarDiscoveryQuery(query: StorefrontDiscoveryQuery): Record<string, string> {
    return Object.fromEntries(Object.entries(query).flatMap(([key, value]) => value === undefined || Array.isArray(value) ? [] : [[key, String(value)]]));
}
