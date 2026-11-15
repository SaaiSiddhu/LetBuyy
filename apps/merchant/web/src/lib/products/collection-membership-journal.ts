import { z } from 'zod'
import { ReplaceCollectionMembershipSchema, UuidSchema } from '@letbuyy/shared-types'

// Preserve the original session format and keys, including saves made before a
// store URL changed. Stable site identity decides discovery; the URL is transport.
const PendingMembershipSchema = z.object({
    actorId: UuidSchema, store: z.string().min(1).max(255), storeId: UuidSchema,
    collectionId: UuidSchema, command: ReplaceCollectionMembershipSchema,
    outcome: z.literal('missing').optional(),
}).strict()
export type PendingMembership = z.infer<typeof PendingMembershipSchema>
export const recoveryKey = (actorId: string, store: string, collectionId: string) =>
    `letbuyy.collection-membership.v1:${actorId}:${store}:${collectionId}`

function decode(key: string, raw: string): PendingMembership {
    const saved = PendingMembershipSchema.parse(JSON.parse(raw))
    if (key !== recoveryKey(saved.actorId, saved.store, saved.collectionId)) throw new Error('Saved collection context changed.')
    return saved
}
export function discoverMemberships(storage: Storage, actorId: string, siteId: string, store: string): PendingMembership[] {
    const prefix = `letbuyy.collection-membership.v1:${actorId}:`, found: PendingMembership[] = []
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (!key?.startsWith(prefix)) continue
        const raw = storage.getItem(key)
        if (raw === null) throw new Error('Saved collection recovery changed. Reload this store.')
        // A malformed record for another URL cannot identify this site. Never
        // erase it or expose its contents; block only a matching current URL.
        let header: unknown
        try { header = JSON.parse(raw) } catch {
            if (key.startsWith(`${prefix}${store}:`)) throw new Error('Saved collection recovery could not be read. The original request is retained.')
            continue
        }
        const savedSite = header && typeof header === 'object' && 'storeId' in header ? header.storeId : null
        if (savedSite !== siteId) {
            if (savedSite === null && key.startsWith(`${prefix}${store}:`)) throw new Error('Saved collection recovery could not be read. The original request is retained.')
            continue
        }
        const saved = decode(key, raw)
        if (saved.actorId !== actorId) throw new Error('Saved collection actor changed.')
        found.push(saved)
    }
    return found
}
function current(storage: Storage, pending: PendingMembership): { key: string; saved: PendingMembership } {
    const key = recoveryKey(pending.actorId, pending.store, pending.collectionId), raw = storage.getItem(key)
    if (raw === null) throw new Error('The original collection request is no longer available. Reload collections.')
    const saved = decode(key, raw)
    if (saved.storeId !== pending.storeId || JSON.stringify(saved.command) !== JSON.stringify(pending.command)) {
        throw new Error('Another pending collection save is retained. Reload and review it before clearing this request.')
    }
    return { key, saved }
}
export function retainMembership(storage: Storage, pending: PendingMembership) {
    PendingMembershipSchema.parse(pending)
    if (discoverMemberships(storage, pending.actorId, pending.storeId, pending.store).some(row => row.collectionId === pending.collectionId)) {
        throw new Error('Recover the original product selection before starting another save.')
    }
    const key = recoveryKey(pending.actorId, pending.store, pending.collectionId), raw = JSON.stringify(pending)
    storage.setItem(key, raw)
    if (storage.getItem(key) !== raw) throw new Error('Save recovery storage is unavailable. Keep this selection and retry.')
}
export function markMembershipMissing(storage: Storage, pending: PendingMembership) {
    const { key, saved } = current(storage, pending)
    const raw = JSON.stringify({ ...saved, outcome: 'missing' })
    storage.setItem(key, raw)
    if (storage.getItem(key) !== raw) throw new Error('Save recovery storage is unavailable. Keep the original request.')
}
export function forgetMembershipRecovery(storage: Storage, pending: PendingMembership) {
    const { key } = current(storage, pending)
    storage.removeItem(key)
    if (storage.getItem(key) !== null) throw new Error('The original collection request could not be cleared.')
}
