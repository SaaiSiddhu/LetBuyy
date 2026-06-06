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
