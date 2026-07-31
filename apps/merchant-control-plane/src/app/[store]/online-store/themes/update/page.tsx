/**
 * /[store]/online-store/themes/update — Phase AB: Theme safe-update page.
 *
 * Server component wrapper. Reads [store] from params, fetches available
 * version information from the same-origin /api/stores/[store] proxy, and
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

import { cookies } from 'next/headers'
import UpdatePageClient from './UpdatePageClient'

interface UpdatePageProps {
    params: Promise<{ store: string }>
    searchParams?: Promise<{ themeSlug?: string }>
}

export default async function ThemeUpdatePage({ params, searchParams }: UpdatePageProps) {
    const { store } = await params
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const themeSlug = resolvedSearchParams.themeSlug || ''

    // Fetch store resolution from the same-origin proxy (server-side)
    // This reads the session cookie automatically via Next.js server component context.
    let storeId: string | null = null
    let fetchError: string | null = null

    try {
        const cookieStore = await cookies()
        const cookieHeader = cookieStore.getAll()
            .map((c) => `${c.name}=${c.value}`)
            .join('; ')

        const apiBase = process.env.NEXT_PUBLIC_APP_URL || ''
        const url = `${apiBase}/api/themes?store_name=${encodeURIComponent(store)}`

        const res = await fetch(url, {
            headers: { Cookie: cookieHeader },
            cache: 'no-store',
        })
        if (res.ok) {
            const data = await res.json().catch(() => null)
            if (data?.storeId) storeId = String(data.storeId)
        }
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
