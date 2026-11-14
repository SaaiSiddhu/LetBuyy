export type CredentialCorsEnv = {
    CORS_CREDENTIAL_ORIGINS?: string;
    /**
     * Apex domain the platform credentialed origins are generated from. Defaults
     * to `DEFAULT_PLATFORM_CREDENTIAL_DOMAIN` (`letbuyy.com`). Point this at a
     * new apex (e.g. `letbuyy.com`) to move the whole credentialed allowlist and
     * default origin in one config change — no source edit required.
     */
    LETBUYY_PLATFORM_DOMAIN?: string;
};

/** Current platform apex; the future `letbuyy.com` cutover overrides this via env. */
export const DEFAULT_PLATFORM_CREDENTIAL_DOMAIN = 'letbuyy.com';

/** Backwards-compatible static fallback origin (the `letbuyy.com` apex). */
export const DEFAULT_CREDENTIAL_ORIGIN = 'https://letbuyy.com';

/**
 * Subdomain labels (alongside the bare apex) that receive credentialed CORS. The
 * allowlist is generated from the configured apex so adding a new apex later is a
 * config change rather than a code change.
 */
export const PLATFORM_CREDENTIAL_SUBDOMAINS = [
    // The canonical public marketing host is www, while the apex redirects.
    'www',
    'accounts',
    'merchant',
    'storefront',
    'apps',
    'themes',
    'console',
    'operations',
    'developers',
    'admin',
    'team',
] as const;

function normalizePlatformCredentialDomain(value: string | undefined): string {
    const trimmed = (value ?? '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^\.+|\.+$/g, '');
    return trimmed || DEFAULT_PLATFORM_CREDENTIAL_DOMAIN;
}

/** Build the credentialed origin allowlist (apex first) for a given apex domain. */
export function buildPlatformCredentialOrigins(domain: string | undefined = DEFAULT_PLATFORM_CREDENTIAL_DOMAIN): string[] {
    const apex = normalizePlatformCredentialDomain(domain);
    return [
        `https://${apex}`,
        ...PLATFORM_CREDENTIAL_SUBDOMAINS.map((label) => `https://${label}.${apex}`),
    ];
}

/** Default credentialed origin (apex). Env-overridable via `LETBUYY_PLATFORM_DOMAIN`. */
export function resolveDefaultCredentialOrigin(env: CredentialCorsEnv = {}): string {
    return `https://${normalizePlatformCredentialDomain(env.LETBUYY_PLATFORM_DOMAIN)}`;
}

/** Backwards-compatible static allowlist for the default (`letbuyy.com`) apex. */
export const PLATFORM_CREDENTIAL_ORIGINS = buildPlatformCredentialOrigins(DEFAULT_PLATFORM_CREDENTIAL_DOMAIN);

/**
 * Loopback hosts are the one place plain http is legitimate: a developer's own
 * machine, unreachable from anywhere else. Everything remote stays https-only.
 */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLoopbackHost(hostname: string): boolean {
    return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

export function normalizeCredentialOrigin(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
        const url = new URL(trimmed);

        /* https everywhere except loopback. Without the carve-out every
           http://localhost:PORT entry in CORS_CREDENTIAL_ORIGINS was silently
           dropped, so no local app could ever obtain a credentialed origin and
           every browser call from localhost failed preflight.

           This does not widen production: an origin still has to appear in the
           configured allowlist to be returned, and a production
           CORS_CREDENTIAL_ORIGINS does not list localhost. A remote http origin
           such as http://merchant.example.com remains rejected. */
        const loopback = isLoopbackHost(url.hostname);
        if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) return null;

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
    const defaultOrigin = resolveDefaultCredentialOrigin(env);
    if (!origin) return defaultOrigin;

    const normalizedOrigin = normalizeCredentialOrigin(origin);
    if (!normalizedOrigin) return defaultOrigin;

    const allowedOrigins = new Set<string>([
        ...buildPlatformCredentialOrigins(env.LETBUYY_PLATFORM_DOMAIN),
        ...parseCredentialOrigins(env.CORS_CREDENTIAL_ORIGINS),
    ]);

    return allowedOrigins.has(normalizedOrigin) ? normalizedOrigin : defaultOrigin;
}
