import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PUT /api/themes/[themeId]/sections/reorder?store_name=xxx
 *
 * Reorder template sections (not header/footer, which are pinned).
 * Body: { sectionOrder: string[] } — array of section IDs in new order
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        await params // consume params for Next.js
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const body = await request.json()
        const { sectionOrder } = body

        if (!Array.isArray(sectionOrder)) {
            return NextResponse.json(
                { error: 'sectionOrder must be an array of section IDs' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Get store and current template config
        const { data: store, error: storeError } = await supabase
            .from('sites')
            .select('id, template_config')
            .eq('store_name', storeName)
            .single()

        if (storeError || !store) {
            return NextResponse.json(
                { error: 'Store not found' },
                { status: 404 }
            )
        }

        const config = (store.template_config || {}) as Record<string, unknown>
        const sections = (config.sections || {}) as Record<string, unknown>
        const templateSections = (sections.template || []) as Array<{ id: string;[key: string]: unknown }>

        // Reorder template sections based on the new order
        const sectionMap = new Map(templateSections.map(s => [s.id, s]))
        const reordered = sectionOrder
            .map(id => sectionMap.get(id))
            .filter(Boolean) as typeof templateSections

        // Append any sections not in the order (safety net)
        const orderedIds = new Set(sectionOrder)
        for (const section of templateSections) {
            if (!orderedIds.has(section.id)) {
                reordered.push(section)
            }
        }

        // Update config with reordered sections
        const updatedConfig = {
            ...config,
            sections: {
                ...sections,
                template: reordered,
            },
        }

        const { error: updateError } = await supabase
            .from('sites')
            .update({
                template_config: updatedConfig,
                updated_at: new Date().toISOString(),
            })
            .eq('id', store.id)

        if (updateError) {
            console.error('[API /themes/sections/reorder PUT] Update error:', updateError)
            return NextResponse.json(
                { error: 'Failed to reorder sections' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            sectionOrder: reordered.map(s => s.id),
        })
    } catch (err) {
        console.error('[API /themes/sections/reorder PUT] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
