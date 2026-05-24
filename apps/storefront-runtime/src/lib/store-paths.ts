export function getStoreBasePath(subdomain?: string | null) {
    return subdomain ? `/store/${subdomain}` : '';
}

export function resolveStoreHref(subdomain: string | null | undefined, href: string) {
    if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
        return href;
    }

    const basePath = getStoreBasePath(subdomain);
    if (!basePath || href.startsWith('/store/')) {
        return href;
    }

    if (href === '/') {
        return basePath;
    }

    if (href.startsWith('/')) {
        return `${basePath}${href}`;
    }

    return href;
}
