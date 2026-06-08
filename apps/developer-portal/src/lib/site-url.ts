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

export function getDeveloperPortalUrl(path = ''): string {
    const configured = process.env.NEXT_PUBLIC_DEVELOPER_PORTAL_URL?.trim() || getVercelDeploymentOrigin();
    if (!configured) {
        throw new Error('NEXT_PUBLIC_DEVELOPER_PORTAL_URL is not configured; refusing to use a hardcoded developer portal host');
    }
    const base = trimTrailingSlash(configured);
    if (!path) return base;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
