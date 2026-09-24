/**
 * Single source of truth for the env var names the storefront runtime accepts
 * for the API gateway base URL.
 *
 * Server components (`lib/api/client.ts`), the request proxy (`proxy.ts`), and
 * the internal store-access client (`lib/storefront-access.ts`) all resolve from
 * THIS ordered list, so setting any one declared name works everywhere instead
 * of some readers silently falling back to the production `api.letbuyy.com`
 * host.
 *
 * Reads use literal `process.env` access (not a dynamic `process.env[key]` loop)
 * so Next.js can still statically inline `NEXT_PUBLIC_*` values in edge/client
 * bundles.
 */
export const STOREFRONT_API_BASE_URL_ENV_KEYS = [
    'LETBUYY_API_BASE_URL',
    'LETBUYY_API_URL',
    'NEXT_PUBLIC_API_BASE_URL',
    'NEXT_PUBLIC_API_URL',
] as const;

/** Candidate API base URL values, in priority order (first declared name wins). */
export function storefrontApiBaseUrlCandidates(): Array<string | undefined> {
    return [
        process.env.LETBUYY_API_BASE_URL,
        process.env.LETBUYY_API_URL,
        process.env.NEXT_PUBLIC_API_BASE_URL,
        process.env.NEXT_PUBLIC_API_URL,
    ];
}

/** First configured (non-empty) API base URL value from the shared keys, or undefined. */
export function readStorefrontApiBaseUrl(): string | undefined {
    return storefrontApiBaseUrlCandidates().find((value) => Boolean(value && value.trim()));
}
