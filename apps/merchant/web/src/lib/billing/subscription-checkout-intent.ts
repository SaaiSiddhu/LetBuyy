type CheckoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'length' | 'key'>
type CheckoutLocks = Pick<LockManager, 'request'>
export type SubscriptionCheckoutBody = { store_id: string; plan_slug: string; billing_period: string; site_type: string; coupon_code?: string }
export type SubscriptionCheckoutIntent = { slot: string; key: string; actorId: string; body: SubscriptionCheckoutBody; returnPath?: string; legacySlot?: string }
const legacyPrefix = 'letbuyy:subscription-checkout:v1:'
const actorSlot = (actor: string) => 'letbuyy:subscription-checkout:v2:' + actor
function internalReturnPath(value: unknown): value is string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return false
    try { return new URL(value, 'https://checkout.example.invalid').origin === 'https://checkout.example.invalid' } catch { return false }
}
const fingerprint = (body: SubscriptionCheckoutBody) => JSON.stringify([body.store_id, body.plan_slug, body.billing_period, body.site_type, body.coupon_code || null])
export function matchesSubscriptionCheckoutIntent(intent: SubscriptionCheckoutIntent, actorId: string, body: SubscriptionCheckoutBody): boolean {
    return intent.actorId === actorId && fingerprint(intent.body) === fingerprint(body)
}
export class PendingSubscriptionCheckoutError extends Error {
    constructor(public readonly intent: SubscriptionCheckoutIntent) {
        super('A previous checkout is still pending. Recover its original details before starting another checkout.')
        this.name = 'PendingSubscriptionCheckoutError'
    }
}
function read(actorId: string, storage: CheckoutStorage, desired?: SubscriptionCheckoutBody): SubscriptionCheckoutIntent | null {
    const slot = actorSlot(actorId), raw = storage.getItem(slot)
    if (raw) {
        let value: SubscriptionCheckoutIntent
        try { value = JSON.parse(raw) } catch { throw new Error('Pending checkout details cannot be read. Keep this browser data and contact support.') }
        if (!value || value.actorId !== actorId || value.slot !== slot || typeof value.key !== 'string' || value.key.length < 8 || value.key.length > 200
            || !value.body || !['store_id', 'plan_slug', 'billing_period', 'site_type'].every(k => typeof value.body[k as keyof SubscriptionCheckoutBody] === 'string')
            || (value.returnPath !== undefined && !internalReturnPath(value.returnPath))) {
            throw new Error('Pending checkout details are unavailable. Keep this browser data and contact support.')
        }
        return value
    }
    const retained: SubscriptionCheckoutIntent[] = []
    for (let index = 0; index < storage.length; index++) {
        const legacySlot = storage.key(index)
        if (!legacySlot?.startsWith(legacyPrefix)) continue
        let parts: unknown
        try { parts = JSON.parse(legacySlot.slice(legacyPrefix.length)) } catch { continue }
        if (!Array.isArray(parts) || parts[0] !== actorId) continue
        if (parts.length !== 6 || !parts.slice(1, 5).every(v => typeof v === 'string')) throw new Error('An older checkout is pending. Reopen its original details or contact support.')
        const key = storage.getItem(legacySlot)
        if (!key) continue
        retained.push({slot, key, actorId, legacySlot, body: {store_id: parts[1], plan_slug: parts[2], billing_period: parts[3], site_type: parts[4], ...(typeof parts[5] === 'string' && parts[5] ? {coupon_code: parts[5]} : {})}})
    }
    return retained.find(value => desired && fingerprint(value.body) === fingerprint(desired)) || retained[0] || null
}
export async function readPendingSubscriptionCheckoutIntent(actorId: string, storage: CheckoutStorage, locks: CheckoutLocks) {
    return locks.request(actorSlot(actorId), () => read(actorId, storage))
}
// Local retry metadata contains public checkout terms only. Current account,
// ownership, plan, amounts and activation authority remain server-owned.
export async function retainSubscriptionCheckoutIntent(actorId: string, body: SubscriptionCheckoutBody, storage: CheckoutStorage, locks: CheckoutLocks,
    mint = () => crypto.randomUUID(), returnPath?: string): Promise<SubscriptionCheckoutIntent> {
    if (returnPath !== undefined && !internalReturnPath(returnPath)) throw new Error('Pending checkout return path is invalid.')
    const slot = actorSlot(actorId)
    return locks.request(slot, () => {
        const previous = read(actorId, storage, body)
        if (previous && fingerprint(previous.body) !== fingerprint(body)) throw new PendingSubscriptionCheckoutError(previous)
        const intent = previous || {slot, key: `subscription-checkout:${mint()}`, actorId, body: {...body}, ...(returnPath ? {returnPath} : {})}
        // Persist the exact body before dispatch. One actor lock coordinates all
        // stores/terms/tabs; ambiguity cannot mint a second logical checkout.
        storage.setItem(slot, JSON.stringify(intent))
        return intent
    })
}
export async function completeSubscriptionCheckoutIntent(intent: SubscriptionCheckoutIntent, storage: CheckoutStorage, locks: CheckoutLocks) {
    await locks.request(intent.slot, () => {
        const live = read(intent.actorId, storage)
        if (live?.key !== intent.key) return
        storage.removeItem(intent.slot)
        if (intent.legacySlot && storage.getItem(intent.legacySlot) === intent.key) storage.removeItem(intent.legacySlot)
    })
}
