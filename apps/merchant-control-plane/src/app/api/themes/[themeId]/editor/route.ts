import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function readTemplateKey(value: unknown): string {
    return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value.trim())
        ? value.trim()
        : 'index'
}

/**
 * GET /api/themes/[themeId]/editor?store_name=xxx&template=product
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
        const templateKey = readTemplateKey(searchParams.get('template') || searchParams.get('template_key'))

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const editor = await createMerchantApiClient().themes.editor(themeId, resolved.storeId, {
            query: { template_key: templateKey },
        })

        return NextResponse.json({
            store: editor.store,
            theme: editor.theme,
            templateKey: editor.template_key || templateKey,
            templates: editor.templates || [],
            templateConfig: editor.template_config,
            draftConfig: editor.draft?.exists ? editor.template_config : null,
            draftSavedAt: editor.draft?.updated_at || null,
            release: editor.release || null,
            sectionSchemas: editor.schemas?.sections || {},
            themeSettingsSchema: editor.schemas?.settings || {},
            version: editor.version,
        })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}

/**
 * PUT /api/themes/[themeId]/editor?store_name=xxx
 *
 * Save editor changes to the live store (publish).
 * Body: { templateConfig, templateKey? }
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')
        const queryTemplateKey = readTemplateKey(searchParams.get('template') || searchParams.get('template_key'))

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const body = await request.json()
        const { templateConfig } = body
        const templateKey = readTemplateKey(body?.templateKey || body?.template_key || queryTemplateKey)

        if (!templateConfig) {
            return NextResponse.json(
                { error: 'templateConfig is required in body' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const api = createMerchantApiClient()
        await api.themes.saveDraft(themeId, {
            store_id: resolved.storeId,
            template_key: templateKey,
            template_config: templateConfig,
            client: 'admin-web',
        })

        const publishPayload = await api.themes.publish(themeId, {
            store_id: resolved.storeId,
            template_key: templateKey,
            make_store_live: true,
        })

        const savedAt = new Date().toISOString()

        return NextResponse.json({
            success: true,
            savedAt,
            templateKey,
            release: publishPayload.release || null,
        })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
