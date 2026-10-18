const pending = new Map<string, string>()

/** Persist a logical retry key before sending; a lost reply or reload reuses it. */
export async function staffMutationKey(store: string, operation: string, intent: unknown) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([store, operation, intent])))
    const name = 'letbuyy.staff.v1.' + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    // Fail visibly if persistent storage is unavailable: do not send a request whose retry key could be lost.
    const stored = localStorage.getItem(name)
    const key = pending.get(name) || stored || crypto.randomUUID()
    localStorage.setItem(name, key)
    pending.set(name, key)
    return { key, complete: () => { localStorage.removeItem(name); pending.delete(name) } }
}
