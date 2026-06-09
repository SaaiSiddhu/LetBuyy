function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

const PLATFORM_ROOT_DOMAINS = ['letbuyy.com', 'letbuyy.store'] as const;
const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.store';
const LOCAL_DEVELOPER_PORTAL_URL = 'http://127.0.0.1:9004';

function normalizeOrigin(rawValue: string | undefined): string | null {
    const value = rawValue?.trim();
    if (!value) return null;

    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
        return new URL(withProtocol).origin;
    } catch {
        return null;
    }
}

function getVercelDeploymentOrigin(): string | null {
    const vercelEnv = process.env.VERCEL_ENV?.trim();
    const productionOrigin = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
    const branchOrigin = normalizeOrigin(process.env.VERCEL_BRANCH_URL);
    const deploymentOrigin = normalizeOrigin(process.env.VERCEL_URL);

    if (vercelEnv === 'production') {
        return productionOrigin ?? deploymentOrigin ?? branchOrigin;
    }

    return branchOrigin ?? deploymentOrigin ?? productionOrigin;
}

function getKnownPlatformRoot(hostname: string): string | null {
    const normalized = hostname.toLowerCase().replace(/^www\./, '');
    return PLATFORM_ROOT_DOMAINS.find((root) => normalized === root || normalized.endsWith(`.${root}`)) ?? null;
}

function getBrowserDeveloperPortalOrigin(): string | null {
    if (typeof window === 'undefined') return null;

    const { hostname, protocol, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return LOCAL_DEVELOPER_PORTAL_URL;
    }

    const platformRoot = getKnownPlatformRoot(hostname);
    if (!platformRoot) return origin;

    return `${protocol}//developer.${platformRoot}`;
}

function getConfiguredPlatformRootDomain(): string {
    return (
        process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim()
        || process.env.PLATFORM_ROOT_DOMAIN?.trim()
        || DEFAULT_PLATFORM_ROOT_DOMAIN
    );
}

function getServerDeveloperPortalOrigin(): string {
    return `https://developer.${getConfiguredPlatformRootDomain()}`;
}

export function getDeveloperPortalUrl(path = ''): string {
    const configured = (
        process.env.NEXT_PUBLIC_DEVELOPER_PORTAL_URL?.trim()
        || getBrowserDeveloperPortalOrigin()
        || getVercelDeploymentOrigin()
        || getServerDeveloperPortalOrigin()
    );
    const base = trimTrailingSlash(configured);
    if (!path) return base;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
