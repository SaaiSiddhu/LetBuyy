function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export function getDeveloperPortalUrl(path = ''): string {
    const configured = process.env.NEXT_PUBLIC_DEVELOPER_PORTAL_URL?.trim();
    if (!configured) {
        throw new Error('NEXT_PUBLIC_DEVELOPER_PORTAL_URL is not configured; refusing to use a hardcoded developer portal host');
    }
    const base = trimTrailingSlash(configured);
    if (!path) return base;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
