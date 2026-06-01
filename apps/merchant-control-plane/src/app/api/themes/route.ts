import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * GET /api/themes?store_name=xxx
 * 
 * Returns the available themes catalog + the store's currently installed theme.
 * Uses store_name (subdomain) to look up the store, matching the admin [store] param pattern.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        let currentTheme = null
        let storeId = null

        // If store_name provided, fetch the store's current theme info
        if (storeName) {
            const resolved = await resolveOwnedStoreId(storeName)
            if (resolved.error) return resolved.error

            storeId = resolved.storeId
        }

        const payload = await createWorkerApiClient().themes.listCatalog(
            storeId ? { store_id: storeId } : undefined
        )
        const themes = payload.data
        const currentThemeSlug = payload.current_theme

        currentTheme = themes.find((theme) => (
            (currentThemeSlug && theme.slug === currentThemeSlug) ||
            theme.active === true
        )) || null

        return NextResponse.json({
            themes,
            currentTheme,
            storeStatus: payload.store_status,
            storeId,
        })
    } catch (err) {
        return workerErrorResponse(err)
    }
}
