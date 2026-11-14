// Domain Center — browser client.
// Calls SAME-ORIGIN app proxy routes (/api/stores/[store]/domains/*), which forward to
// the gateway server-side. Same-origin avoids CORS (the gateway only allows https
// credentialed origins) and CSP entirely — the pattern used across the merchant app.
// Types are the api-client contract (no duplicated DTOs).

import type {
    CustomDomainHealth,
    DomainAvailabilityQuote,
    DomainConnectResult,
    DomainHistoryResult,
    DomainListResult,
    DomainSetPrimaryResult,
    DomainVerifyResult,
} from '@letbuyy/api-client'

interface Envelope<T> {
    data?: T
    error?: string | { message?: string }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        cache: 'no-store',
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    const payload = (await response.json().catch(() => null)) as (Envelope<T> & Record<string, unknown>) | null
    if (!response.ok && response.status !== 202) {
        const message = typeof payload?.error === 'string'
            ? payload.error
            : payload?.error?.message || `Request failed (${response.status})`
        throw new Error(message)
    }
    return (payload?.data ?? (payload as unknown as T))
}

const enc = encodeURIComponent
const base = (store: string) => `/api/stores/${enc(store)}/domains`

export const domainsClient = {
    list: (store: string) =>
        call<DomainListResult>(base(store)),

    connect: (store: string, domain: string) =>
        call<DomainConnectResult>(base(store), {
            method: 'POST',
            body: JSON.stringify({ domain }),
        }),

    verify: (store: string, domain: string) =>
        call<DomainVerifyResult>(`${base(store)}/${enc(domain)}/verify`, { method: 'POST' }),

    health: (store: string, domain: string) =>
        call<CustomDomainHealth>(`${base(store)}/${enc(domain)}`),

    history: (store: string, domain: string) =>
        call<DomainHistoryResult>(`${base(store)}/${enc(domain)}/history`),

    setPrimary: (store: string, domain: string) =>
        call<DomainSetPrimaryResult>(`${base(store)}/${enc(domain)}/primary`, { method: 'POST' }),

    setRedirect: (store: string, domain: string, redirectTo: string | null) =>
        call<{ domain: string; role: string; redirect_to: string | null }>(`${base(store)}/${enc(domain)}`, {
            method: 'PATCH',
            body: JSON.stringify({ redirect_to: redirectTo }),
        }),

    remove: (store: string, domain: string) =>
        call<{ domain: string; released: boolean }>(`${base(store)}/${enc(domain)}`, { method: 'DELETE' }),

    search: (store: string, query: string) =>
        call<DomainAvailabilityQuote>(`${base(store)}?search=${enc(query)}`),
}
