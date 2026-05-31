import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/**
 * GET /api/themes/[themeId]/editor?store_name=xxx
 *
 * Load all editor data: store info, template config, draft config, and schemas.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const editor = await createWorkerApiClient().themes.editor(themeId, resolved.storeId)

        return NextResponse.json({
            store: editor.store,
            theme: editor.theme,
            templateConfig: editor.template_config,
            draftConfig: editor.draft?.exists ? editor.template_config : null,
            draftSavedAt: editor.draft?.updated_at || null,
            release: editor.release || null,
            sectionSchemas: editor.schemas?.sections || {},
            themeSettingsSchema: editor.schemas?.settings || {},
            version: editor.version,
        })
    } catch (err) {
        return workerErrorResponse(err)
    }
}

/**
 * PUT /api/themes/[themeId]/editor?store_name=xxx
 *
 * Save editor changes to the live store (publish).
 * Body: { templateConfig }
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const body = await request.json()
        const { templateConfig } = body

        if (!templateConfig) {
            return NextResponse.json(
                { error: 'templateConfig is required in body' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const api = createWorkerApiClient()
        await api.themes.saveDraft(themeId, {
            store_id: resolved.storeId,
            template_config: templateConfig,
            client: 'admin-web',
        })

        const publishPayload = await api.themes.publish(themeId, {
            store_id: resolved.storeId,
            make_store_live: true,
        })

        const savedAt = new Date().toISOString()

        return NextResponse.json({
            success: true,
            savedAt,
            release: publishPayload.release || null,
        })
    } catch (err) {
        return workerErrorResponse(err)
    }
}
