import { NextRequest, NextResponse } from 'next/server'
import { SaveThemeDraftSchema, DiscardThemeDraftSchema, ThemeEditorTemplateKeySchema } from '@letbuyy/theme-engine'
import { createMerchantApiClient, merchantApiErrorResponse, MerchantApiRequestError } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { getSessionUser } from '@/lib/auth/session'

function readTemplateKey(value: unknown): string {
    const parsed = ThemeEditorTemplateKeySchema.default('index').safeParse(value ?? undefined)
    if (!parsed.success) throw new MerchantApiRequestError('Invalid theme template key.', 400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid theme template key.' } })
    return parsed.data
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
        const queryTemplateKey = readTemplateKey(searchParams.get('template') ?? searchParams.get('template_key'))

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const rawBody = await request.json()
        const body = isRecord(rawBody) ? rawBody : {}
        const draftConfig = isRecord(body.draftConfig) ? body.draftConfig : undefined
        const templateKey = readTemplateKey(body?.templateKey ?? body?.template_key ?? queryTemplateKey)
        const baseVersion = body.baseVersion ?? body.base_version
        const idempotencyKey = body.idempotencyKey ?? body.idempotency_key
        const actor = await getSessionUser()
        if (!actor) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in before saving.' } }, { status: 401 })
        if (body.actorId !== actor.id) return NextResponse.json({ error: { code: 'THEME_EDITOR_CONTEXT_CHANGED', message: 'Your account changed. Reload the editor before saving.' } }, { status: 403 })

        if (!draftConfig) {
            return NextResponse.json(
                { error: 'draftConfig is required in body' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error
        if (body.storeId !== resolved.storeId) return NextResponse.json({ error: { code: 'THEME_EDITOR_CONTEXT_CHANGED', message: 'The editor store changed. Reload before saving.' } }, { status: 403 })

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
        const templateKey = readTemplateKey(searchParams.get('template') ?? searchParams.get('template_key'))

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
