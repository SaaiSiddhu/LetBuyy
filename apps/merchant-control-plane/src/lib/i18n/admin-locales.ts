export const DEFAULT_ADMIN_LOCALE = 'en-IN';

export const SUPPORTED_ADMIN_LOCALES = [
    { code: 'en-IN', language: 'English', region: 'India', direction: 'ltr' },
    { code: 'hi-IN', language: 'Hindi', region: 'India', direction: 'ltr' },
    { code: 'bn-IN', language: 'Bengali', region: 'India', direction: 'ltr' },
    { code: 'mr-IN', language: 'Marathi', region: 'India', direction: 'ltr' },
    { code: 'ta-IN', language: 'Tamil', region: 'India', direction: 'ltr' },
    { code: 'te-IN', language: 'Telugu', region: 'India', direction: 'ltr' },
    { code: 'kn-IN', language: 'Kannada', region: 'India', direction: 'ltr' },
    { code: 'gu-IN', language: 'Gujarati', region: 'India', direction: 'ltr' },
    { code: 'ml-IN', language: 'Malayalam', region: 'India', direction: 'ltr' },
] as const;

export type AdminLocaleCode = typeof SUPPORTED_ADMIN_LOCALES[number]['code'];

export const ADMIN_I18N_NAMESPACES = [
    'common',
    'navigation',
    'settings',
    'products',
    'orders',
    'customers',
    'themes',
] as const;

const SUPPORTED_BY_CODE = new Map<string, AdminLocaleCode>(
    SUPPORTED_ADMIN_LOCALES.map((locale) => [locale.code.toLowerCase(), locale.code]),
);

export function normalizeAdminLocale(value?: string | null): AdminLocaleCode {
    const normalized = (value || DEFAULT_ADMIN_LOCALE).trim().replace(/_/g, '-').toLowerCase();
    const exact = SUPPORTED_BY_CODE.get(normalized);
    if (exact) return exact;

    const language = normalized.split('-')[0];
    const languageMatch = SUPPORTED_ADMIN_LOCALES.find((locale) => locale.code.toLowerCase().startsWith(`${language}-`));
    return languageMatch?.code || DEFAULT_ADMIN_LOCALE;
}

export function getAdminLocaleOptions(): Array<{ value: AdminLocaleCode; label: string }> {
    return SUPPORTED_ADMIN_LOCALES.map((locale) => ({
        value: locale.code,
        label: `${locale.language} (${locale.code})`,
    }));
}

