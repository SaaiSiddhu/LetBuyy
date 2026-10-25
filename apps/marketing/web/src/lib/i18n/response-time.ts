import { WORKING_DAY_HOURS } from '@letbuyy/shared-types'
import { createCopy } from './copy'

/** Localized presentation of the canonical working-hour promise; routing and SLA arithmetic stay in shared-types. */
export function formatResponseTime(hours: number, language: string): string {
    const t = createCopy(language)
    if (hours <= 1) return t('within the hour')
    if (hours < WORKING_DAY_HOURS + 1) return t('within {count} working hours', { count: hours })
    const days = Math.max(1, Math.round(hours / WORKING_DAY_HOURS))
    return days === 1 ? t('within one working day') : t('within {count} working days', { count: days })
}
