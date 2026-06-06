export interface FormatInrCurrencyOptions {
    maximumFractionDigits?: number
    minimumFractionDigits?: number
    suffix?: string
    requirePositive?: boolean
    emptyValue?: string | null
}

export function formatInrCurrency(
    value: number | null | undefined,
    options: FormatInrCurrencyOptions = {},
): string | null {
    const {
        emptyValue = null,
        maximumFractionDigits,
        minimumFractionDigits,
        requirePositive = false,
        suffix = '',
    } = options

    if (typeof value !== 'number' || !Number.isFinite(value)) return emptyValue
    if (requirePositive && value <= 0) return emptyValue

    const numberFormatOptions: Intl.NumberFormatOptions = {
        currency: 'INR',
        style: 'currency',
    }
    if (maximumFractionDigits !== undefined) {
        numberFormatOptions.maximumFractionDigits = maximumFractionDigits
    }
    if (minimumFractionDigits !== undefined) {
        numberFormatOptions.minimumFractionDigits = minimumFractionDigits
    }

    return `${new Intl.NumberFormat('en-IN', numberFormatOptions).format(value)}${suffix}`
}

export interface FormatDateOptions {
    emptyValue?: string
    invalidValue?: string
    locale?: string
    options?: Intl.DateTimeFormatOptions
}

const INDIA_SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
}

const US_SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
}

const US_LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
}

const INDIA_DATE_WITH_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
}

const INDIA_DAY_MONTH_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
}

export function formatDisplayDate(
    value: Date | string | null | undefined,
    options: FormatDateOptions = {},
): string {
    const {
        emptyValue = '-',
        invalidValue = emptyValue,
        locale = 'en-IN',
        options: dateOptions = INDIA_SHORT_DATE_OPTIONS,
    } = options

    if (!value) return emptyValue

    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return invalidValue

    return new Intl.DateTimeFormat(locale, dateOptions).format(date)
}

export function formatIndiaDate(
    value: Date | string | null | undefined,
    options: Omit<FormatDateOptions, 'locale' | 'options'> = {},
): string {
    return formatDisplayDate(value, {
        ...options,
        locale: 'en-IN',
        options: INDIA_SHORT_DATE_OPTIONS,
    })
}

export function formatUsShortDate(
    value: Date | string | null | undefined,
    options: Omit<FormatDateOptions, 'locale' | 'options'> = {},
): string {
    return formatDisplayDate(value, {
        ...options,
        locale: 'en-US',
        options: US_SHORT_DATE_OPTIONS,
    })
}

export function formatUsLongDate(
    value: Date | string | null | undefined,
    options: Omit<FormatDateOptions, 'locale' | 'options'> = {},
): string {
    return formatDisplayDate(value, {
        ...options,
        locale: 'en-US',
        options: US_LONG_DATE_OPTIONS,
    })
}

export function formatIndiaDateWithTime(
    value: Date | string | null | undefined,
    options: Omit<FormatDateOptions, 'locale' | 'options'> = {},
): string {
    return formatDisplayDate(value, {
        ...options,
        locale: 'en-IN',
        options: INDIA_DATE_WITH_TIME_OPTIONS,
    })
}

export function formatIndiaDayMonthTime(
    value: Date | string | null | undefined,
    options: Omit<FormatDateOptions, 'locale' | 'options'> = {},
): string {
    return formatDisplayDate(value, {
        ...options,
        locale: 'en-IN',
        options: INDIA_DAY_MONTH_TIME_OPTIONS,
    })
}

export function formatIndiaDateTime(
    value: Date | string | null | undefined,
    options: Omit<FormatDateOptions, 'locale' | 'options'> = {},
): string {
    const emptyValue = options.emptyValue ?? '-'
    const invalidValue = options.invalidValue ?? (typeof value === 'string' ? value : emptyValue)

    return formatDisplayDate(value, {
        ...options,
        emptyValue,
        invalidValue,
        locale: 'en-IN',
        options: {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Kolkata',
        },
    })
}

export interface FormatCurrencyOptions extends Intl.NumberFormatOptions {
    locale?: string
    currency?: string
}

export interface FormatNumberOptions extends Intl.NumberFormatOptions {
    locale?: string
}

export interface FormatDateStyleOptions extends Intl.DateTimeFormatOptions {
    locale?: string
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
    }).format(value)
}

export function formatNumber(
    value: number,
    { locale = 'en-IN', ...options }: FormatNumberOptions = {},
) {
    return new Intl.NumberFormat(locale, options).format(value)
}

export function formatDate(
    value: Date | string | number,
    { locale = 'en-IN', ...options }: FormatDateStyleOptions = {},
) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        ...options,
    }).format(new Date(value))
}
