const PREVIEW_COOKIE_PREFIX = 'lb_theme_preview_';

export function getThemePreviewCookieName(subdomain: string): string {
    const safeSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 80);
    return `${PREVIEW_COOKIE_PREFIX}${safeSubdomain}`;
}

export function normalizeThemePreviewToken(value: unknown): string {
    return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : '';
}
