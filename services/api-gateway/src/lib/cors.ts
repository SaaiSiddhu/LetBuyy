export type CredentialCorsEnv = {
    CORS_CREDENTIAL_ORIGINS?: string;
};

export const DEFAULT_CREDENTIAL_ORIGIN = 'https://letbuyy.store';

export const PLATFORM_CREDENTIAL_ORIGINS = [
    DEFAULT_CREDENTIAL_ORIGIN,
    'https://accounts.letbuyy.store',
    'https://merchant.letbuyy.store',
    'https://storefront.letbuyy.store',
    'https://apps.letbuyy.store',
    'https://themes.letbuyy.store',
    'https://console.letbuyy.store',
    'https://operations.letbuyy.store',
    'https://developers.letbuyy.store',
    'https://admin.letbuyy.store',
    'https://team.letbuyy.store',
] as const;

export function normalizeCredentialOrigin(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:') return null;
        if (url.username || url.password || url.search || url.hash) return null;
        if (url.pathname !== '' && url.pathname !== '/') return null;
        return url.origin;
    } catch {
        return null;
    }
}

export function parseCredentialOrigins(value: string | undefined): string[] {
    if (!value) return [];

    const origins: string[] = [];
    const seen = new Set<string>();
    for (const entry of value.split(',')) {
        const origin = normalizeCredentialOrigin(entry);
        if (!origin || seen.has(origin)) continue;
        seen.add(origin);
        origins.push(origin);
    }

    return origins;
}

export function resolveCredentialedCorsOrigin(origin: string | undefined, env: CredentialCorsEnv): string {
    if (!origin) return DEFAULT_CREDENTIAL_ORIGIN;

    const normalizedOrigin = normalizeCredentialOrigin(origin);
    if (!normalizedOrigin) return DEFAULT_CREDENTIAL_ORIGIN;

    const allowedOrigins = new Set<string>([
        ...PLATFORM_CREDENTIAL_ORIGINS,
        ...parseCredentialOrigins(env.CORS_CREDENTIAL_ORIGINS),
    ]);

    return allowedOrigins.has(normalizedOrigin) ? normalizedOrigin : DEFAULT_CREDENTIAL_ORIGIN;
}
