export interface FormatCurrencyOptions extends Intl.NumberFormatOptions {
    locale?: string;
    currency?: string;
}

export interface FormatNumberOptions extends Intl.NumberFormatOptions {
    locale?: string;
}

export interface FormatDateOptions extends Intl.DateTimeFormatOptions {
    locale?: string;
}

export function formatCurrency(
    value: number,
    { locale = 'en-IN', currency = 'INR', ...options }: FormatCurrencyOptions = {},
) {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
        ...options,
    }).format(value);
}

export function formatNumber(
    value: number,
    { locale = 'en-IN', ...options }: FormatNumberOptions = {},
) {
    return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(
    value: Date | string | number,
    { locale = 'en-IN', ...options }: FormatDateOptions = {},
) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        ...options,
    }).format(new Date(value));
}
