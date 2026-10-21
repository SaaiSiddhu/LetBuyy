/**
 * /[store]/online-store/themes/update — Phase AB: Theme safe-update page.
 *
 * Server component wrapper. Reads [store] from params, reuses the authenticated
 * store resolution from the layout and
 * passes the result to UpdatePageClient for rendering.
 *
 * This file is NOT a client component ("use client" is absent at the top
 * level) — it is a Next.js server component. The client interaction is
 * delegated entirely to UpdatePageClient.
 *
 * Does NOT import from:
 *   - editor/page.tsx (foreign WIP)
 *   - ExperiencePicker.tsx (foreign WIP)
 *   - globals.css (foreign WIP)
 *   - @letbuyy/api-client src/index.ts (foreign WIP — no direct api-client edit)
 *   - settings/localization/page.tsx (foreign WIP)
 */

import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import UpdatePageClient from './UpdatePageClient'

interface UpdatePageProps {
    params: Promise<{ store: string }>
    searchParams?: Promise<{ themeSlug?: string }>
}

export default async function ThemeUpdatePage({ params, searchParams }: UpdatePageProps) {
    const { store } = await params
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const themeSlug = resolvedSearchParams.themeSlug || ''

    // Reuse the authenticated request's layout reads; avoid an HTTP round trip
    // through the full theme catalog merely to recover the store ID.
    let storeId: string | null = null
    let fetchError: string | null = null
    try {
        const user = await getSessionUser()
        const owned = user ? await getStoreForUser(store, user.id) : null
        storeId = owned?.id || null
        if (!storeId) fetchError = 'Could not load store information.'
    } catch {
        fetchError = 'Could not load store information.'
    }

    return (
        <UpdatePageClient
            store={store}
            storeId={storeId}
            themeSlug={themeSlug}
            fetchError={fetchError}
        />
    )
}
