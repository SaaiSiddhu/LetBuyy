import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'

/**
 * POST /api/themes/install
 * 
 * Installs a theme to a store:
 * 1. Creates/updates a store_themes record
 * 2. Updates the sites.theme_id to the new theme slug
 * 3. Updates sites.template_config.themeSettings with theme colors
 * 
 * Body: { storeId: string, themeSlug: string }
 */
export async function POST(request: NextRequest) {
    try {
        const { storeId, themeSlug } = await request.json()

        if (!storeId || !themeSlug) {
            return NextResponse.json(
                { error: 'storeId and themeSlug are required' },
                { status: 400 }
            )
        }

        const response = await workerFetch(`/themes/${themeSlug}/install`, {
            method: 'POST',
            body: JSON.stringify({
                store_id: storeId,
                config_overrides: {},
            }),
        })
        const payload = await readWorkerJson(response)
        const theme = payload.data?.theme

        return NextResponse.json({
            success: true,
            theme: {
                name: theme?.name || themeSlug,
                slug: theme?.slug || themeSlug,
            }
        })
    } catch (err) {
        return workerErrorResponse(err)
    }
}
