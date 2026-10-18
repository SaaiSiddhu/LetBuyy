import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function readTemplateKey(value: unknown): string {
    return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value.trim())
        ? value.trim()
        : 'index'
}

function readPositiveInt(value: unknown): number | undefined {
    const numeric = typeof value === 'number'
        ? value
        : typeof value === 'string' ? Number(value) : Number.NaN

    return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readPublishTemplateConfig(body: Record<string, unknown>): Record<string, unknown> | undefined {
    const templateConfig = isRecord(body.templateConfig)
        ? body.templateConfig
        : isRecord(body.template_config) ? body.template_config : undefined
    if (!templateConfig) return undefined

    const liquidBundle = isRecord(body.liquidBundle)
        ? body.liquidBundle
        : isRecord(body.liquid_bundle) ? body.liquid_bundle : undefined
    const liquidRenderingCanary = typeof body.liquidRenderingCanary === 'boolean'
        ? body.liquidRenderingCanary
        : typeof body.liquid_rendering_canary === 'boolean' ? body.liquid_rendering_canary : undefined

    return {
        ...templateConfig,
        ...(liquidBundle ? { liquidBundle } : {}),
        ...(typeof liquidRenderingCanary === 'boolean' ? { liquidRenderingCanary } : {}),
    }
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
 * Publish the already-saved editor draft to the live store.
 * Body: { templateKey?, baseVersion?, publishMessage? }
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

        const rawBody = await request.json().catch(() => ({}))
        const body = isRecord(rawBody) ? rawBody : {}
        const templateKey = readTemplateKey(body?.templateKey || body?.template_key || queryTemplateKey)
        const baseVersion = readPositiveInt(body?.baseVersion || body?.base_version)
        const publishMessage = typeof body?.publishMessage === 'string'
            ? body.publishMessage
            : typeof body?.publish_message === 'string' ? body.publish_message : undefined
        const templateConfig = readPublishTemplateConfig(body)

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const api = createMerchantApiClient()
        const publishPayload = await api.themes.publish(themeId, {
            store_id: resolved.storeId,
            template_key: templateKey,
            ...(templateConfig ? { template_config: templateConfig } : {}),
            base_version: baseVersion,
            make_store_live: true,
            publish_message: publishMessage,
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
