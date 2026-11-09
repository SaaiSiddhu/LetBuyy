import { UuidSchema } from '@letbuyy/shared-types'
export type CommandScope = { actorId: string; siteId: string }
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Locks = { request<T>(name: string, callback: () => Promise<T> | T): Promise<T> }
export type SavedScopedCommand<I> = CommandScope & { format: 1; intent: I }
function freeze<T>(value: T): T {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
}
/** One actor/site slot and one cross-tab execution lease; business authority
 * always remains in the command's live server check and durable receipt. */
export function createScopedCommandJournal<I extends { command: { store_id: string } }>(namespace: string, schema: { parse(value: unknown): I }, label: string) {
    const slot = (s: CommandScope) => `${namespace}:${UuidSchema.parse(s.actorId)}:${UuidSchema.parse(s.siteId)}`
    const unavailable = () => new Error(`The original ${label} request needs recovery. Keep this browser data.`)
    function parse(value: unknown, scope: CommandScope): SavedScopedCommand<I> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable()
        const v = value as Record<string, unknown>
        if (Object.keys(v).sort().join(',') !== 'actorId,format,intent,siteId' || v.format !== 1
            || v.actorId !== scope.actorId || v.siteId !== scope.siteId) throw unavailable()
        let intent: I
        try { intent = schema.parse(v.intent) } catch { throw unavailable() }
        if (intent.command.store_id !== scope.siteId) throw unavailable()
        return freeze({ actorId: UuidSchema.parse(v.actorId), siteId: UuidSchema.parse(v.siteId), format: 1, intent })
    }
    function read(scope: CommandScope, storage: StoragePort) {
        const raw = storage.getItem(slot(scope)); if (raw === null) return null
        let value: unknown; try { value = JSON.parse(raw) } catch { throw unavailable() }
        return parse(value, scope)
    }
    return {
        read: (scope: CommandScope, storage: StoragePort, locks: Locks, check: () => void) => locks.request(slot(scope), () => {
            check(); const value = read(scope, storage); check(); return value
        }),
        retain: (scope: CommandScope, intent: I, storage: StoragePort, locks: Locks, check: () => void) => locks.request(slot(scope), () => {
            check(); if (read(scope, storage)) throw new Error(`Recover the saved ${label} request before starting another change.`)
            const saved = parse({ ...scope, format: 1, intent }, scope), raw = JSON.stringify(saved)
            check(); storage.setItem(slot(scope), raw); if (storage.getItem(slot(scope)) !== raw) throw unavailable(); check(); return saved
        }),
        advance: (saved: SavedScopedCommand<I>, intent: I, storage: StoragePort, locks: Locks, check: () => void) => locks.request(slot(saved), () => {
            check(); const old = read(saved, storage)
            if (!old || JSON.stringify(old) !== JSON.stringify(saved)) throw unavailable()
            const next = parse({ actorId: saved.actorId, siteId: saved.siteId, format: 1, intent }, saved)
            const raw = JSON.stringify(next); check(); storage.setItem(slot(saved), raw)
            if (storage.getItem(slot(saved)) !== raw) throw unavailable()
            check(); return next
        }),
        clear: (saved: SavedScopedCommand<I>, storage: StoragePort, locks: Locks, check: () => void) => locks.request(slot(saved), () => {
            check(); const old = read(saved, storage); if (!old) return
            if (JSON.stringify(old) !== JSON.stringify(saved)) throw unavailable()
            storage.removeItem(slot(saved)); if (storage.getItem(slot(saved)) !== null) throw unavailable(); check()
        }),
        withExecution: <T>(scope: CommandScope, locks: Locks, check: () => void, work: () => Promise<T>) => locks.request(slot(scope) + ':execution', async () => {
            check(); const value = await work(); check(); return value
        }),
    }
}
