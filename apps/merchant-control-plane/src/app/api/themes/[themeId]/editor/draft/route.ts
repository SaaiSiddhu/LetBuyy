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

        const body = await request.json()
        const { draftConfig } = body
        const templateKey = readTemplateKey(body?.templateKey || body?.template_key || queryTemplateKey)
        const baseVersion = readPositiveInt(body?.baseVersion || body?.base_version)

        if (!draftConfig) {
            return NextResponse.json(
                { error: 'draftConfig is required in body' },
                { status: 400 }
            )
        }

        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().themes.saveDraft(themeId, {
            store_id: resolved.storeId,
            template_key: templateKey,
            template_config: draftConfig,
            base_version: baseVersion,
            client: 'admin-web',
        })

        return NextResponse.json({
            success: true,
            savedAt: payload.saved_at || new Date().toISOString(),
            version: payload.version,
            templateKey,
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

        await createMerchantApiClient().themes.deleteDraft(themeId, resolved.storeId, {
            query: { template_key: templateKey },
        })

        return NextResponse.json({ success: true, templateKey })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
