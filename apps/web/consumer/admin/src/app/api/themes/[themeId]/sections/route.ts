import { NextRequest, NextResponse } from 'next/server'
import { SECTION_SCHEMAS } from '@/lib/theme-schemas'

/**
 * GET /api/themes/[themeId]/sections
 *
 * Returns available section schemas for a given theme.
 * Since schemas are hard-coded in the registry, themeId is used for
 * future extensibility when different themes may have different available sections.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params

        // For now, all themes use the same section schemas from Urban Kicks.
        // In future, different themes could register different section types.
        const schemas = SECTION_SCHEMAS

        return NextResponse.json({
            themeId,
            sections: Object.entries(schemas).map(([type, schema]) => ({
                type,
                name: schema.name,
                description: schema.description,
                hasBlocks: !!schema.blocks_schema,
                settingsCount: schema.settings_schema.length,
            })),
            schemas,
        })
    } catch (err) {
        console.error('[API /themes/sections GET] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
