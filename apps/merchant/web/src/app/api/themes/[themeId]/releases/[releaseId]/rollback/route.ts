import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { getSessionUser } from '@/lib/auth/session'
import { RollbackThemeReleaseSchema } from '@letbuyy/theme-engine'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string; releaseId: string }> }
) {
    try {
        const { themeId, releaseId } = await params
        const body = await request.json().catch(() => ({}))
        const { searchParams } = new URL(request.url)
        const storeName = body.store_name || body.store_id || searchParams.get('store_name') || searchParams.get('store_id')

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name is required' },
                { status: 400 }
            )
        }

        const actor = await getSessionUser()
        if (!actor) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in before restoring a release.' } }, { status: 401 })
        if (body.actorId !== actor.id) return NextResponse.json({ error: { code: 'THEME_EDITOR_CONTEXT_CHANGED', message: 'Your account changed. Reload releases before restoring.' } }, { status: 403 })
        const resolved = await resolveOwnedStoreId(String(storeName))
        if (resolved.error) return resolved.error

        const parsed = RollbackThemeReleaseSchema.safeParse({
            store_id: resolved.storeId,
            expected_current_release_id: body.expected_current_release_id,
            idempotency_key: body.idempotency_key,
            make_store_live: body.make_store_live !== false,
            rollback_message: body.rollback_message,
        })
        if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'A reviewed current release and stable retry key are required.' } }, { status: 400 })
        const payload = await createMerchantApiClient().themes.rollbackRelease(themeId, releaseId, parsed.data)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to rollback theme release')
    }
}
