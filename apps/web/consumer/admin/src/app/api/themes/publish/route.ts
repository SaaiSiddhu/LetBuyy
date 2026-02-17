import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/themes/publish
 * 
 * Toggles a store's status between 'published' and 'draft'.
 * 
 * Body: { storeId: string, action: 'publish' | 'unpublish' }
 */
export async function POST(request: NextRequest) {
    try {
        const { storeId, action } = await request.json()

        if (!storeId || !action) {
            return NextResponse.json(
                { error: 'storeId and action are required' },
                { status: 400 }
            )
        }

        if (!['publish', 'unpublish'].includes(action)) {
            return NextResponse.json(
                { error: 'action must be "publish" or "unpublish"' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        const newStatus = action === 'publish' ? 'published' : 'draft'

        const { data, error } = await supabase
            .from('sites')
            .update({ status: newStatus })
            .eq('id', storeId)
            .select('id, status')
            .single()

        if (error) {
            console.error('[API /themes/publish] Error updating store status:', error)
            return NextResponse.json(
                { error: 'Failed to update store status' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            status: data.status,
        })
    } catch (err) {
        console.error('[API /themes/publish] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
