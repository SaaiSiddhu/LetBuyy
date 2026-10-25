type PublicUrlKey =
    | 'accounts'
    | 'admin'
    | 'appMarketplace'
    | 'developerPortal'
    | 'marketing'
    | 'themeMarketplace';

const PUBLIC_URLS: Record<PublicUrlKey, { envName: string; value: string | undefined }> = {
    accounts: { envName: 'NEXT_PUBLIC_ACCOUNTS_URL', value: process.env.NEXT_PUBLIC_ACCOUNTS_URL },
    admin: { envName: 'NEXT_PUBLIC_ADMIN_URL', value: process.env.NEXT_PUBLIC_ADMIN_URL },
    appMarketplace: { envName: 'NEXT_PUBLIC_APP_MARKETPLACE_URL', value: process.env.NEXT_PUBLIC_APP_MARKETPLACE_URL },
    developerPortal: { envName: 'NEXT_PUBLIC_DEVELOPER_PORTAL_URL', value: process.env.NEXT_PUBLIC_DEVELOPER_PORTAL_URL },
    marketing: { envName: 'NEXT_PUBLIC_MARKETING_URL', value: process.env.NEXT_PUBLIC_MARKETING_URL },
    themeMarketplace: { envName: 'NEXT_PUBLIC_THEME_MARKETPLACE_URL', value: process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL },
};

const PLATFORM_ROOT_DOMAINS = ['letbuyy.com'] as const;
const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com';

const LOCAL_BROWSER_URLS: Record<PublicUrlKey, string> = {
    accounts: 'http://127.0.0.1:9002',
    admin: 'http://127.0.0.1:9001',
    appMarketplace: 'http://127.0.0.1:9003',
    developerPortal: 'http://127.0.0.1:9004',
    marketing: 'http://127.0.0.1:9006',
    themeMarketplace: 'http://127.0.0.1:9005',
};

const PLATFORM_SUBDOMAINS: Record<PublicUrlKey, string | null> = {
    accounts: 'accounts',
    admin: 'admin',
    appMarketplace: 'apps',
    developerPortal: 'developer',
    marketing: null,
    themeMarketplace: 'themes',
};

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

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

function getConfiguredPlatformRootDomain(): string {
    return (
        process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim()
        || process.env.PLATFORM_ROOT_DOMAIN?.trim()
        || DEFAULT_PLATFORM_ROOT_DOMAIN
    );
}

function getPlatformOrigin(key: PublicUrlKey, rootDomain: string, protocol = 'https:'): string {
    const subdomain = PLATFORM_SUBDOMAINS[key];
    return subdomain ? `${protocol}//${subdomain}.${rootDomain}` : `${protocol}//${rootDomain}`;
}

function getBrowserPublicOrigin(key: PublicUrlKey): string | null {
    if (typeof window === 'undefined') return null;

    const { hostname, origin, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return LOCAL_BROWSER_URLS[key];
    }

    const platformRoot = getKnownPlatformRoot(hostname);
    if (platformRoot) return getPlatformOrigin(key, platformRoot, protocol);

    return key === 'appMarketplace' ? origin : null;
}

function getServerPublicOrigin(key: PublicUrlKey): string {
    return getPlatformOrigin(key, getConfiguredPlatformRootDomain());
}

function appendPath(base: string, path: string): string {
    if (!path) return base;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getConfiguredPublicUrl(key: PublicUrlKey, path = ''): string {
    const config = PUBLIC_URLS[key];
    const configured = (
        config.value?.trim()
        || getBrowserPublicOrigin(key)
        || (key === 'appMarketplace' ? getVercelDeploymentOrigin() : null)
        || getServerPublicOrigin(key)
    );
    if (!configured) {
        throw new Error(`${config.envName} is not configured; refusing to use a hardcoded public host`);
    }
    return appendPath(trimTrailingSlash(configured), path);
}

export function getAppMarketplaceUrl(path = ''): string {
    return getConfiguredPublicUrl('appMarketplace', path);
}

export function getAccountsUrl(path = ''): string {
    return getConfiguredPublicUrl('accounts', path);
}

export function getMarketingUrl(path = ''): string {
    return getConfiguredPublicUrl('marketing', path);
}

export function getAdminUrl(path = ''): string {
    return getConfiguredPublicUrl('admin', path);
}

export function getThemeMarketplaceUrl(path = ''): string {
    return getConfiguredPublicUrl('themeMarketplace', path);
}

export function getDeveloperPortalUrl(path = ''): string {
    return getConfiguredPublicUrl('developerPortal', path);
}

export function getSupportEmail(): string | null {
    const configured = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
    return configured || null;
}
