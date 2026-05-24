import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

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

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const { themeId } = await params
        const editorResponse = await workerFetch(`/themes/${themeId}/editor?store_id=${resolved.storeId}`)
        const editorPayload = await readWorkerJson(editorResponse)
        const config = (editorPayload.data?.template_config || {}) as Record<string, unknown>
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

        const saveResponse = await workerFetch(`/themes/${themeId}/editor/draft`, {
            method: 'PUT',
            body: JSON.stringify({
                store_id: resolved.storeId,
                template_config: updatedConfig,
                client: 'admin-web',
            }),
        })
        await readWorkerJson(saveResponse)

        return NextResponse.json({
            success: true,
            sectionOrder: reordered.map(s => s.id),
        })
    } catch (err) {
        return workerErrorResponse(err)
    }
}
