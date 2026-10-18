import { NextRequest, NextResponse } from 'next/server'
import { PublishThemeSchema } from '@letbuyy/theme-engine'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function readTemplateKey(value: unknown): string {
    return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value.trim())
        ? value.trim()
        : 'index'
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
        const baseVersion = body.baseVersion ?? body.base_version
        const idempotencyKey = body.idempotencyKey ?? body.idempotency_key
        const publishMessage = typeof body?.publishMessage === 'string'
            ? body.publishMessage
            : typeof body?.publish_message === 'string' ? body.publish_message : undefined
        const templateConfig = readPublishTemplateConfig(body)

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const api = createMerchantApiClient()
        const parsed = PublishThemeSchema.safeParse({
            store_id: resolved.storeId,
            template_key: templateKey,
            ...(templateConfig ? { template_config: templateConfig } : {}),
            base_version: baseVersion,
            idempotency_key: idempotencyKey,
            make_store_live: true,
            publish_message: publishMessage,
        })
        if (!parsed.success) return NextResponse.json({ error: 'The saved draft version and retry key are required.' }, { status: 400 })
        const publishPayload = await api.themes.publish(themeId, parsed.data)

        const savedAt = publishPayload.release.published_at

        return NextResponse.json({
            success: true,
            savedAt,
            templateKey,
            release: publishPayload.release,
            version: publishPayload.version,
            replayed: publishPayload.replayed,
            currentVersion: publishPayload.current_version,
        })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
