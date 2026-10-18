// Browser persistence contains no complaint, subject, reply or credential.
// The hash detects changed intent; only the signed session authorizes a receipt.
export const SUPPORT_PENDING_PREFIX = 'lb_support_pending_v1:';
export interface SupportPending {
    version: 1;
    buyer: string;
    store: string;
    operation: 'create' | 'reply';
    target: string | null;
    key: string;
    hash: string;
}
export interface SupportMutationReceipt {
    key: string; operation: 'create' | 'reply'; ticket_id: string; message_id: string; confirmed_at: string;
}
export const SUPPORT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validSupportKey(value: unknown): value is string {
    return typeof value === 'string' && value.length >= 8 && value.length <= 200 && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
}
export function supportReceipt(value: unknown, key: string, operation: 'create' | 'reply', ticket: string, message?: string): SupportMutationReceipt | null {
    if (!value || typeof value !== 'object' || !validSupportKey(key) || !SUPPORT_UUID.test(ticket)) return null;
    const row = value as Record<string, unknown>;
    if (row.key !== key || row.operation !== operation || row.ticket_id !== ticket || !SUPPORT_UUID.test(String(row.message_id)) || (message && row.message_id !== message)
        || typeof row.confirmed_at !== 'string' || !Number.isFinite(Date.parse(row.confirmed_at))) return null;
    return { key, operation, ticket_id: ticket, message_id: row.message_id as string, confirmed_at: row.confirmed_at };
}
export async function supportIntentHash(operation: 'create' | 'reply', target: string | null, subject: string, body: string): Promise<string> {
    const normalized = operation === 'create' ? { operation, target, subject: subject.trim(), body: body.trim() } : { operation, target, body: body.trim() };
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalized)));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
type PendingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function storageKey(buyer: string, store: string) { return SUPPORT_PENDING_PREFIX + encodeURIComponent(store) + ':' + encodeURIComponent(buyer); }
/** Serialize the read/claim/clear sequence across tabs. localStorage's individual
 * operations alone cannot prevent two tabs from claiming different retry keys. */
export async function withSupportPendingLock<T>(buyer: string, store: string, run: () => T | Promise<T>): Promise<T> {
    if (typeof navigator === 'undefined' || !navigator.locks?.request) throw Error('This browser cannot safely save support actions. Sending is paused.');
    return navigator.locks.request(storageKey(buyer, store), { mode: 'exclusive' }, run);
}
function projectPending(value: unknown, buyer: string, store: string): SupportPending {
    if (!value || typeof value !== 'object') throw Error('Saved support action is unreadable. Sending is paused to prevent duplicates.');
    const row = value as Record<string, unknown>;
    if (row.version !== 1 || row.buyer !== buyer || row.store !== store || !validSupportKey(row.key) || !/^[a-f0-9]{64}$/.test(String(row.hash))
        || !['create','reply'].includes(String(row.operation)) || (row.operation === 'create' ? row.target !== null : !SUPPORT_UUID.test(String(row.target)))) {
        throw Error('Saved support action is unreadable. Sending is paused to prevent duplicates.');
    }
    return { version: 1, buyer, store, operation: row.operation as 'create' | 'reply', target: row.target as string | null, key: row.key, hash: row.hash as string };
}
export function readSupportPending(storage: PendingStorage, buyer: string, store: string): SupportPending | null {
    const raw = storage.getItem(storageKey(buyer, store));
    if (raw === null) return null;
    try { return projectPending(JSON.parse(raw), buyer, store); }
    catch { throw Error('Saved support action is unreadable. Sending is paused to prevent duplicates.'); }
}
export function saveSupportPending(storage: PendingStorage, pending: SupportPending): SupportPending {
    const safe = projectPending(pending, pending.buyer, pending.store);
    const previous = readSupportPending(storage, safe.buyer, safe.store);
    if (previous) {
        if (previous.operation !== safe.operation || previous.target !== safe.target || previous.hash !== safe.hash) throw Error('Recover your saved action before sending different text or choosing another conversation.');
        return previous;
    }
    storage.setItem(storageKey(safe.buyer, safe.store), JSON.stringify(safe));
    if (readSupportPending(storage, safe.buyer, safe.store)?.key !== safe.key) throw Error('The action could not be saved. Sending is paused.');
    return safe;
}
export function clearSupportPending(storage: PendingStorage, pending: SupportPending) {
    if (readSupportPending(storage, pending.buyer, pending.store)?.key !== pending.key) throw Error('The saved action changed. Check its recorded result before continuing.');
    storage.removeItem(storageKey(pending.buyer, pending.store));
}
