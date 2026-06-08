export function emailProviderConfigured(value: string | undefined): boolean {
    const normalized = String(value || '').toLowerCase();
    return Boolean(normalized)
        && !normalized.includes('placeholder')
        && !normalized.includes('replace-with')
        && !normalized.includes('skip_needs_human')
        && !normalized.includes('dev-only');
}

export function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
