import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

const SUPPORTED_ADMIN_THEME_SLUGS = new Set(['urban-kicks'])

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
        let workerPath = '/themes'

        // If store_name provided, fetch the store's current theme info
        if (storeName) {
            const resolved = await resolveOwnedStoreId(storeName)
            if (resolved.error) return resolved.error

            storeId = resolved.storeId
            workerPath = `/themes?store_id=${encodeURIComponent(resolved.storeId)}`
        }

        const workerResponse = await workerFetch(workerPath)
        const payload = await readWorkerJson(workerResponse)
        const allThemes = Array.isArray(payload.data)
            ? payload.data as Record<string, unknown>[]
            : []
        const themes = allThemes.filter((theme) => (
            typeof theme.slug === 'string' && SUPPORTED_ADMIN_THEME_SLUGS.has(theme.slug)
        ))
        const currentThemeSlug = typeof payload.current_theme === 'string'
            ? payload.current_theme
            : null

        currentTheme = themes.find((theme) => (
            (currentThemeSlug && theme.slug === currentThemeSlug) ||
            theme.active === true
        )) || null

        return NextResponse.json({
            themes,
            currentTheme,
            storeStatus: payload.store_status || null,
            storeId,
        })
    } catch (err) {
        return workerErrorResponse(err)
    }
}
