/**
 * Theme Translations Page — Phase Z server component wrapper.
 *
 * Sibling route to editor/page.tsx (the main theme editor).
 * This file does NOT modify editor/page.tsx — it is a separate route at:
 *   /[store]/online-store/themes/[themeId]/editor/translations
 *
 * Fetches the store localization summary server-side (GET /api/stores/:store/localization)
 * and passes it to TranslationEditorClient for CSR rendering.
 *
 * India-first: the default locale in the summary is always en-IN (enforced by
 * the gateway normalizeLocale helper). The client component defaults to en-IN.
 *
 * Tenancy: the /api/stores/:store/localization proxy route verifies the merchant
 * session owns the store before returning data. No client-supplied store_id is
 * ever trusted.
 */

import { cookies, headers } from 'next/headers'
import TranslationEditorClient from './TranslationEditorClient'
import type { StoreLocalizationSummary } from '@letbuyy/shared-types'

interface TranslationsPageProps {
    params: Promise<{ store: string; themeId: string }>
}

async function fetchLocalization(
    store: string,
    requestHeaders: Record<string, string>,
): Promise<{ data: StoreLocalizationSummary | null; error: string | null }> {
    try {
        // Use the same-origin proxy route so tenancy (session → store ownership) is enforced.
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/stores/${encodeURIComponent(store)}/localization`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...requestHeaders,
                },
                cache: 'no-store',
            },
        )

        if (!res.ok) {
            if (res.status === 401) return { data: null, error: 'Authentication required.' }
            if (res.status === 404) return { data: null, error: 'Store not found.' }
            return { data: null, error: `Localization settings unavailable (${res.status}).` }
        }

        const payload = await res.json()
        return { data: (payload?.data ?? null) as StoreLocalizationSummary | null, error: null }
    } catch {
        return { data: null, error: 'Unable to load localization settings.' }
    }
}

export default async function ThemeTranslationsPage({ params }: TranslationsPageProps) {
    const { store, themeId } = await params
    const decodedStore = decodeURIComponent(store)

    // Forward the request Cookie header so the session is preserved for the proxy call.
    const cookieStore = await cookies()
    const cookieHeader = cookieStore.toString()

    // Forward relevant headers that the proxy uses for authentication.
    const incomingHeaders = await headers()
    const forwardHeaders: Record<string, string> = {}
    if (cookieHeader) forwardHeaders['Cookie'] = cookieHeader
    const xRequestId = incomingHeaders.get('x-request-id')
    if (xRequestId) forwardHeaders['X-Request-ID'] = xRequestId

    const { data: localization, error: fetchError } = await fetchLocalization(decodedStore, forwardHeaders)

    return (
        <TranslationEditorClient
            storeName={decodedStore}
            themeId={themeId}
            localization={localization}
            fetchError={fetchError}
        />
    )
}
