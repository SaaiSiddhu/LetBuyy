import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/themes?store_name=xxx
 * 
 * Returns the available themes catalog + the store's currently installed theme.
 * Uses store_name (subdomain) to look up the store, matching the admin [store] param pattern.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        const supabase = await createClient()

        // Fetch all active themes from the catalog
        const { data: themes, error: themesError } = await supabase
            .from('themes')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        if (themesError) {
            console.error('[API /themes] Error fetching themes:', themesError)
            return NextResponse.json(
                { error: 'Failed to fetch themes' },
                { status: 500 }
            )
        }

        let currentTheme = null
        let storeStatus = null
        let storeId = null

        // If store_name provided, fetch the store's current theme info
        if (storeName) {
            const { data: store, error: storeError } = await supabase
                .from('sites')
                .select('id, name, store_name, status, theme_id, template_config')
                .eq('store_name', storeName)
                .single()

            if (!storeError && store) {
                storeId = store.id
                storeStatus = store.status

                // Find the matching theme from the catalog by theme_id (slug)
                if (store.theme_id) {
                    currentTheme = (themes || []).find(
                        (t: Record<string, unknown>) => t.slug === store.theme_id || t.id === store.theme_id
                    )
                }

                // If no match found, build a default from template_config
                if (!currentTheme && store.template_config) {
                    const tc = store.template_config as Record<string, unknown>
                    const ts = (tc.themeSettings || {}) as Record<string, unknown>
                    currentTheme = {
                        name: (tc.themeId as string) || 'Custom Theme',
                        slug: 'custom',
                        version: '1.0.0',
                        category: 'custom',
                        author: 'Custom',
                        config: {
                            colors: {
                                primary: ts.primaryColor || '#6366f1',
                                secondary: ts.secondaryColor || '#8b5cf6',
                                background: ts.backgroundColor || '#ffffff',
                                text: ts.textColor || '#1f2937',
                                accent: ts.accentColor || '#f59e0b',
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            themes: themes || [],
            currentTheme,
            storeStatus,
            storeId,
        })
    } catch (err) {
        console.error('[API /themes] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
