'use client'

import { createContext, useContext } from 'react'

/** Captured server-rendered identity; a stale-form refusal, never authority. */
export const MerchantSecurityContext = createContext<{ actorId: string; store: string; siteId?:string } | null>(null)

export function useMerchantSecurityContext(store: string) {
    const context = useContext(MerchantSecurityContext)
    if (!context || context.store !== store) throw new Error('Reload this store before changing account security.')
    return context
}
