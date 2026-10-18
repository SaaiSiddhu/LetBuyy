import type { SetMerchantLoyaltyInput, MerchantLoyaltySnapshot } from '@letbuyy/api-client'

export type LoyaltyIntent = Omit<SetMerchantLoyaltyInput, 'store_id'>
export interface PendingLoyaltySave { key: string; actorId: string; store: string; intent: LoyaltyIntent }
const integer = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 10000
const decimal = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= BigInt('9223372036854775807')
const version = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
export const loyaltyPendingName = (actorId: string, store: string) => `letbuyy.loyalty.v1.${encodeURIComponent(actorId)}.${encodeURIComponent(store)}`

export function readPendingLoyaltySave(actorId: string, store: string): PendingLoyaltySave | null {
    const raw = localStorage.getItem(loyaltyPendingName(actorId, store))
    if (!raw) return null
    const record = JSON.parse(raw) as PendingLoyaltySave
    const intent = record?.intent
    if (record.actorId !== actorId || record.store !== store || typeof record.key !== 'string' || record.key.length < 8 || record.key.length > 200 ||
        !intent || typeof intent.is_active !== 'boolean' || !integer(intent.earn_rate_bps) || !integer(intent.redeem_cap_bps) || !decimal(intent.point_value_minor) ||
        (intent.expected_updated_at !== null && !version(intent.expected_updated_at))) {
        throw new Error('The previous save could not be recovered. Reload current saved settings before editing.')
    }
    return record
}

/** Save before sending any bytes. Keep one captured command across a lost reply/reload. */
export function prepareLoyaltySave(actorId: string, store: string, intent: LoyaltyIntent): PendingLoyaltySave {
    const existing = readPendingLoyaltySave(actorId, store)
    if (existing) return existing
    const record = { key: crypto.randomUUID(), actorId, store, intent }
    const name = loyaltyPendingName(actorId, store)
    localStorage.setItem(name, JSON.stringify(record))
    if (localStorage.getItem(name) !== JSON.stringify(record)) throw new Error('Another tab is saving these settings. Reload current saved settings.')
    return record
}

/** A late acknowledgement cannot remove another tab's newer pending save. */
export function completeLoyaltySave(record: PendingLoyaltySave) {
    const name = loyaltyPendingName(record.actorId, record.store)
    const current = localStorage.getItem(name)
    if (current && (JSON.parse(current) as PendingLoyaltySave).key === record.key) localStorage.removeItem(name)
}

export function isLoyaltySnapshot(value: unknown): value is MerchantLoyaltySnapshot {
    if (!value || typeof value !== 'object') return false
    const snapshot = value as MerchantLoyaltySnapshot
    if (typeof snapshot.store_id !== 'string' || typeof snapshot.enrolled !== 'boolean' || typeof snapshot.value_decrease_allowed !== 'boolean' ||
        snapshot.valuation_policy !== 'block_decrease_while_outstanding' || typeof snapshot.outstanding_points !== 'string' || !/^-?(0|[1-9][0-9]*)$/.test(snapshot.outstanding_points)) return false
    const program = snapshot.program
    return snapshot.enrolled ? Boolean(program && program.site_id === snapshot.store_id && typeof program.is_active === 'boolean' && integer(program.earn_rate_bps) && integer(program.redeem_cap_bps) && decimal(program.point_value_minor) && version(program.updated_at)) : program === null
}

export function percentageToBps(value: string): number | null {
    if (!/^(0|[1-9][0-9]?|100)(\.[0-9]{1,2})?$/.test(value)) return null
    const [whole, fraction = ''] = value.split('.')
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
    return result <= 10000 ? result : null
}
export function bpsToPercentage(value: number): string { return (value / 100).toFixed(2).replace(/\.00$/, '') }
export function validPointValue(value: string): boolean { return decimal(value) }
export function formatLoyaltyPaise(value: string | bigint): string {
    const amount = BigInt(value), negative = amount < BigInt(0), absolute = negative ? -amount : amount
    return `${negative ? '-' : ''}₹${(absolute / BigInt(100)).toLocaleString('en-IN')}.${(absolute % BigInt(100)).toString().padStart(2, '0')}`
}
