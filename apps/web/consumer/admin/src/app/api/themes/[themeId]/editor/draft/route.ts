import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/themes/[themeId]/editor/draft?store_name=xxx
 *
 * Auto-save draft every N seconds when the editor is dirty.
 * Body: { draftConfig }
 */
export async function POST(
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
        const { draftConfig } = body

        if (!draftConfig) {
            return NextResponse.json(
                { error: 'draftConfig is required in body' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Get store id
        const { data: store, error: storeError } = await supabase
            .from('sites')
            .select('id')
            .eq('store_name', storeName)
            .single()

        if (storeError || !store) {
            return NextResponse.json(
                { error: 'Store not found' },
                { status: 404 }
            )
        }

        // UPSERT draft (unique on store_id + theme_id)
        const { error: upsertError } = await supabase
            .from('theme_editor_drafts')
            .upsert(
                {
                    store_id: store.id,
                    theme_id: themeId,
                    draft_config: draftConfig,
                    auto_saved_at: new Date().toISOString(),
                },
                {
                    onConflict: 'store_id,theme_id',
                }
            )

        if (upsertError) {
            console.error('[API /themes/editor/draft POST] Upsert error:', upsertError)
            return NextResponse.json(
                { error: 'Failed to save draft' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            savedAt: new Date().toISOString(),
        })
    } catch (err) {
        console.error('[API /themes/editor/draft POST] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
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

        if (!storeName) {
            return NextResponse.json(
                { error: 'store_name query parameter is required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        const { data: store } = await supabase
            .from('sites')
            .select('id')
            .eq('store_name', storeName)
            .single()

        if (!store) {
            return NextResponse.json(
                { error: 'Store not found' },
                { status: 404 }
            )
        }

        await supabase
            .from('theme_editor_drafts')
            .delete()
            .eq('store_id', store.id)
            .eq('theme_id', themeId)

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[API /themes/editor/draft DELETE] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
