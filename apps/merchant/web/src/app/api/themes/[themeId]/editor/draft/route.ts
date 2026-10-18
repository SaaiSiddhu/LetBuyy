import { NextRequest, NextResponse } from 'next/server'
import { SaveThemeDraftSchema, DiscardThemeDraftSchema } from '@letbuyy/theme-engine'
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

function mergeLiquidDraftConfig(body: Record<string, unknown>, draftConfig: Record<string, unknown>): Record<string, unknown> {
    const liquidBundle = isRecord(body.liquidBundle)
        ? body.liquidBundle
        : isRecord(body.liquid_bundle) ? body.liquid_bundle : undefined
    const liquidRenderingCanary = typeof body.liquidRenderingCanary === 'boolean'
        ? body.liquidRenderingCanary
        : typeof body.liquid_rendering_canary === 'boolean' ? body.liquid_rendering_canary : undefined

    return {
        ...draftConfig,
        ...(liquidBundle ? { liquidBundle } : {}),
        ...(typeof liquidRenderingCanary === 'boolean' ? { liquidRenderingCanary } : {}),
    }
}

/**
 * POST /api/themes/[themeId]/editor/draft?store_name=xxx&template=product
 *
 * Auto-save draft every N seconds when the editor is dirty.
 * Body: { draftConfig, templateKey? }
 */
export async function POST(
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

        const rawBody = await request.json()
        const body = isRecord(rawBody) ? rawBody : {}
        const draftConfig = isRecord(body.draftConfig) ? body.draftConfig : undefined
        const templateKey = readTemplateKey(body?.templateKey || body?.template_key || queryTemplateKey)
        const baseVersion = body.baseVersion ?? body.base_version
        const idempotencyKey = body.idempotencyKey ?? body.idempotency_key

        if (!draftConfig) {
            return NextResponse.json(
                { error: 'draftConfig is required in body' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const parsed = SaveThemeDraftSchema.safeParse({
            store_id: resolved.storeId,
            template_key: templateKey,
            template_config: mergeLiquidDraftConfig(body, draftConfig),
            base_version: baseVersion,
            client: 'admin-web',
            idempotency_key: idempotencyKey,
        })
        if (!parsed.success) return NextResponse.json({ error: 'A valid draft, current version and retry key are required.' }, { status: 400 })
        const payload = await createMerchantApiClient().themes.saveDraft(themeId, parsed.data)

        return NextResponse.json({
            success: true,
            savedAt: payload.saved_at,
            version: payload.version,
            templateKey,
            replayed: payload.replayed,
            currentVersion: payload.current_version,
        })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}

/**
 * DELETE /api/themes/[themeId]/editor/draft?store_name=xxx
 *
 * Discard saved draft (e.g., when user clicks "discard changes").
 */
export async function DELETE(
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

        const body = await request.json().catch(() => ({})) as Record<string, unknown>
        const parsed = DiscardThemeDraftSchema.safeParse({
            store_id: resolved.storeId, template_key: templateKey,
            base_version: body.baseVersion ?? body.base_version,
            idempotency_key: body.idempotencyKey ?? body.idempotency_key,
        })
        if (!parsed.success) return NextResponse.json({ error: 'The current draft version and retry key are required.' }, { status: 400 })
        const result = await createMerchantApiClient().themes.deleteDraft(themeId, resolved.storeId, {
            query: { template_key: templateKey, base_version: parsed.data.base_version, idempotency_key: parsed.data.idempotency_key },
        })

        return NextResponse.json({ success: true, templateKey, ...result })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
