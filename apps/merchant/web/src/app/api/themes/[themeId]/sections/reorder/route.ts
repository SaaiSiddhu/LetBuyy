import { NextRequest, NextResponse } from 'next/server'
import { ReorderThemeDraftSchema } from '@letbuyy/theme-engine'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

/** Reorder the selected template through the canonical draft CAS writer.
 * The caller retains sectionOrder, baseVersion and idempotencyKey on retry. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ themeId: string }> }) {
    try {
        const storeName = new URL(request.url).searchParams.get('store_name')
        if (!storeName) return NextResponse.json({ error: 'store_name query parameter is required' }, { status: 400 })
        const { sectionOrder, baseVersion, idempotencyKey, templateKey } = await request.json()
        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error
        const parsed = ReorderThemeDraftSchema.safeParse({
            store_id: resolved.storeId, template_key: templateKey || 'index', section_order: sectionOrder,
            base_version: baseVersion, idempotency_key: idempotencyKey, client: 'admin-web',
        })
        if (!parsed.success) return NextResponse.json({ error: 'A valid section order, current version and stable retry key are required.' }, { status: 400 })
        const { themeId } = await params
        const saved = await createMerchantApiClient().themes.reorderDraft(themeId, parsed.data)
        return NextResponse.json({ success: true, version: saved.version, currentVersion: saved.current_version,
            replayed: saved.replayed, sectionOrder: saved.section_order })
    } catch (err) { return merchantApiErrorResponse(err) }
}
