import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'

/**
 * GET /api/themes/[themeId]/sections
 *
 * Returns available section schemas for a given theme from the worker schema registry.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const payload = await createMerchantApiClient().themes.schema(themeId)
        const schemas = payload.schemas?.sections || {}

        return NextResponse.json({
            themeId,
            sections: Object.entries(schemas).map(([type, schema]) => ({
                type,
                name: (schema as { name?: string }).name || type,
                description: (schema as { description?: string }).description || '',
                hasBlocks: Boolean((schema as { blocks_schema?: unknown }).blocks_schema),
                settingsCount: Object.keys((schema as { settings_schema?: Record<string, unknown> }).settings_schema || {}).length,
            })),
            schemas,
        })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
