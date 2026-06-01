import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'

/**
 * POST /api/themes/install
 * 
 * Installs a theme to a store:
 * 1. Creates/updates a store_themes record
 * 2. Updates the sites.theme_id to the new theme slug
 * 3. Updates sites.template_config.themeSettings with theme colors
 * 
 * Body: { storeId: string, themeSlug?: string, bundle?: object }
 */
export async function POST(request: NextRequest) {
    try {
        const { storeId, themeSlug, bundle } = await request.json()

        if (!storeId || (!themeSlug && !bundle)) {
            return NextResponse.json(
                { error: 'storeId and themeSlug or bundle are required' },
                { status: 400 }
            )
        }

        const client = createMerchantApiClient()
        const upload = bundle
            ? await client.themes.uploadPackage({
                bundle: bundle as Record<string, unknown>,
                submission_mode: 'private_install',
            })
            : null
        const installSlug = upload?.theme.slug || themeSlug

        if (!installSlug) {
            return NextResponse.json(
                { error: 'Theme slug could not be resolved' },
                { status: 400 }
            )
        }

        const payload = await client.themes.install(installSlug, {
            store_id: storeId,
            config_overrides: {},
        })
        const theme = payload.theme

        return NextResponse.json({
            success: true,
            theme: {
                name: theme?.name || installSlug,
                slug: theme?.slug || installSlug,
            },
            uploaded: upload || undefined,
        })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
