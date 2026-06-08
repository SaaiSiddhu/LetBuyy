function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export function getThemeMarketplaceUrl(path = ''): string {
    const configured = process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL?.trim();
    if (!configured) {
        throw new Error('NEXT_PUBLIC_THEME_MARKETPLACE_URL is not configured; refusing to use a hardcoded theme marketplace host');
    }
    const base = trimTrailingSlash(configured);
    if (!path) return base;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
