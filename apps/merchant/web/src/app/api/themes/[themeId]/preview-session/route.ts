import { NextRequest, NextResponse } from 'next/server'
import { ThemeEditorTemplateKeySchema } from '@letbuyy/theme-engine'
import { createMerchantApiClient, merchantApiErrorResponse, MerchantApiRequestError } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { getSessionUser } from '@/lib/auth/session'

function readTemplateKey(value: unknown): string {
    const parsed = ThemeEditorTemplateKeySchema.default('index').safeParse(value ?? undefined)
    if (!parsed.success) throw new MerchantApiRequestError('Invalid theme template key.', 400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid theme template key.' } })
    return parsed.data
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const body = await request.json().catch(() => ({}))
        const { searchParams } = new URL(request.url)
        const storeName = body.store_name || body.store_id || searchParams.get('store_name') || searchParams.get('store_id')
        const templateKey = readTemplateKey(body.templateKey ?? body.template_key ?? searchParams.get('template') ?? searchParams.get('template_key'))

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name is required' },
                { status: 400 }
            )
        }

        const actor = await getSessionUser()
        if (!actor) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in before previewing.' } }, { status: 401 })
        if (body.actorId !== actor.id) return NextResponse.json({ error: { code: 'THEME_EDITOR_CONTEXT_CHANGED', message: 'Your account changed. Reload the editor before previewing.' } }, { status: 403 })

        const resolved = await resolveOwnedStoreId(String(storeName))
        if (resolved.error) return resolved.error
        if (body.storeId !== resolved.storeId) return NextResponse.json({ error: { code: 'THEME_EDITOR_CONTEXT_CHANGED', message: 'The editor store changed. Reload before previewing.' } }, { status: 403 })

        const payload = await createMerchantApiClient().themes.previewSession(themeId, {
            store_id: resolved.storeId,
            template_key: templateKey,
            ttl_seconds: Number(body.ttl_seconds || 900),
        })

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create preview session')
    }
}
