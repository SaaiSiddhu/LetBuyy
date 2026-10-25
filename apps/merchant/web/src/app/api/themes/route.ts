import { NextRequest, NextResponse } from 'next/server'
import { LetbuyyApiError } from '@letbuyy/api-client'
import { ThemeEditableSchemaResponseSchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { gatewayCatalogQuery, marketplaceQuery, normalizeCatalogTheme } from '@/lib/themes/marketplace-contract'

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
        const query = marketplaceQuery(searchParams)
        if (!query.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Choose valid catalog filters and pagination.' } }, { status: 400 })

        let currentTheme = null
        let storeId = null

        // If store_name provided, fetch the store's current theme info
        if (storeName) {
            const resolved = await resolveOwnedStoreId(storeName)
            if (resolved.error) return resolved.error

            storeId = resolved.storeId
        }

        const client = createMerchantApiClient()
        const [payload, categories, selected] = await Promise.all([
            client.themes.listCatalog({ ...gatewayCatalogQuery(query.data), ...(storeId ? { store_id: storeId } : {}) }),
            client.themes.categories().catch(() => null),
            query.data.theme_slug ? client.themes.get(query.data.theme_slug)
                .then(async theme => {
                    const schema = await client.themes.schema(theme.slug).catch(() => null)
                    const identity = ThemeEditableSchemaResponseSchema.shape.theme.safeParse(schema?.theme)
                    const runtime = identity.success && identity.data.id === theme.id && identity.data.slug === theme.slug
                        && identity.data.theme_package_id && identity.data.theme_package_version_id ? identity.data : null
                    return { theme, runtime, status: 'ready' as const }
                })
                .catch((error: unknown) => ({ theme: null, runtime: null, status: error instanceof LetbuyyApiError && error.status === 404 ? 'missing' as const : 'unavailable' as const }))
                : Promise.resolve(null),
        ])
        const themes = payload.data.map(normalizeCatalogTheme)
        const currentThemeSlug = payload.current_theme

        currentTheme = payload.current_theme_record || themes.find((theme) => (
            (currentThemeSlug && theme.slug === currentThemeSlug) ||
            theme.active === true
        )) || null

        return NextResponse.json({
            themes,
            currentTheme,
            storeStatus: payload.store_status,
            storeId,
            total: payload.total, page: payload.page, limit: payload.limit, has_more: payload.has_more,
            categories: categories || [], categories_available: categories !== null,
            ...(selected ? { selectedTheme: selected.theme ? normalizeCatalogTheme(selected.theme) : null, selectedThemeStatus: selected.status,
                selectedRuntime: selected.runtime, selectedRuntimeStatus: selected.runtime ? 'ready' : 'unavailable' } : {}),
        })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
