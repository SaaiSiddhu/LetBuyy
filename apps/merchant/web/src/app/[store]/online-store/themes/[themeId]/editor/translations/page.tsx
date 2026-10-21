/**
 * Theme Translations Page — Phase Z server component wrapper.
 *
 * Sibling route to editor/page.tsx (the main theme editor).
 * This file does NOT modify editor/page.tsx — it is a separate route at:
 *   /[store]/online-store/themes/[themeId]/editor/translations
 *
 * Fetches the store localization summary through the private server SDK
 * and passes it to TranslationEditorClient for CSR rendering.
 *
 * India-first: the default locale in the summary is always en-IN (enforced by
 * the gateway normalizeLocale helper). The client component defaults to en-IN.
 *
 * Tenancy: the server session and owned-store resolver verify access before the
 * SDK loads the same authorized gateway localization reader. No client-supplied store_id is
 * ever trusted.
 */

import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { createMerchantApiClient } from '@/lib/api/client'
import TranslationEditorClient from './TranslationEditorClient'
import type { StoreLocalizationSummary } from '@letbuyy/shared-types'

interface TranslationsPageProps {
    params: Promise<{ store: string; themeId: string }>
}

async function fetchLocalization(store: string): Promise<{ data: StoreLocalizationSummary | null; error: string | null }> {
    try {
        const user = await getSessionUser()
        if (!user) return { data: null, error: 'Authentication required.' }
        const owned = await getStoreForUser(store, user.id)
        if (!owned) return { data: null, error: 'Store not found.' }
        const data = await createMerchantApiClient().stores.localization.get(owned.id)
        return { data, error: null }
    } catch {
        return { data: null, error: 'Unable to load localization settings.' }
    }
}

export default async function ThemeTranslationsPage({ params }: TranslationsPageProps) {
    const { store, themeId } = await params
    const decodedStore = decodeURIComponent(store)

    // Reuse the authenticated layout scope and the private SDK transport rather
    // than fetching an environment-dependent web origin with forwarded cookies.
    const { data: localization, error: fetchError } = await fetchLocalization(decodedStore)

    return (
        <TranslationEditorClient
            storeName={decodedStore}
            themeId={themeId}
            localization={localization}
            fetchError={fetchError}
        />
    )
}
