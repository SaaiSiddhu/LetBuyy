import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/plans?site_type=store&slug=starter
 * 
 * Fetches plans from the database, filtered by site_type.
 * Optionally filter by slug for a specific plan.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const siteType = searchParams.get('site_type')
        const slug = searchParams.get('slug')

        if (!siteType) {
            return NextResponse.json(
                { error: 'site_type parameter is required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        let query = supabase
            .from('plans')
            .select('*')
            .eq('site_type', siteType)
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (slug) {
            query = query.eq('slug', slug)
        }

        const { data: plans, error } = await query

        if (error) {
            console.error('[API /plans] Supabase error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch plans' },
                { status: 500 }
            )
        }

        return NextResponse.json({ plans: plans || [] })
    } catch (err) {
        console.error('[API /plans] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
