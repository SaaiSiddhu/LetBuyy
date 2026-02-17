import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/themes/install
 * 
 * Installs a theme to a store:
 * 1. Creates/updates a store_themes record
 * 2. Updates the sites.theme_id to the new theme slug
 * 3. Updates sites.template_config.themeSettings with theme colors
 * 
 * Body: { storeId: string, themeSlug: string }
 */
export async function POST(request: NextRequest) {
    try {
        const { storeId, themeSlug } = await request.json()

        if (!storeId || !themeSlug) {
            return NextResponse.json(
                { error: 'storeId and themeSlug are required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // 1. Get the theme by slug
        const { data: theme, error: themeError } = await supabase
            .from('themes')
            .select('*')
            .eq('slug', themeSlug)
            .eq('is_active', true)
            .single()

        if (themeError || !theme) {
            return NextResponse.json(
                { error: 'Theme not found' },
                { status: 404 }
            )
        }

        // 2. Get the store to update its template_config
        const { data: store, error: storeError } = await supabase
            .from('sites')
            .select('id, template_config')
            .eq('id', storeId)
            .single()

        if (storeError || !store) {
            return NextResponse.json(
                { error: 'Store not found' },
                { status: 404 }
            )
        }

        // 3. Build updated template_config with the new theme's colors
        const themeConfig = (theme.config || {}) as Record<string, unknown>
        const colors = (themeConfig.colors || {}) as Record<string, string>
        const fonts = (themeConfig.fonts || {}) as Record<string, string>

        const existingConfig = (store.template_config || {}) as Record<string, unknown>
        const updatedConfig = {
            ...existingConfig,
            themeId: theme.theme_preset_id || themeSlug,
            themeSettings: {
                ...(existingConfig.themeSettings as Record<string, unknown> || {}),
                primaryColor: colors.primary || '#6366f1',
                secondaryColor: colors.secondary || '#8b5cf6',
                accentColor: colors.accent || '#f59e0b',
                backgroundColor: colors.background || '#ffffff',
                textColor: colors.text || '#1f2937',
                fontFamily: fonts.body || 'Inter',
                headingFontFamily: fonts.heading || 'Inter',
            }
        }

        // 4. Update the sites table
        const { error: updateError } = await supabase
            .from('sites')
            .update({
                theme_id: themeSlug,
                template_config: updatedConfig,
            })
            .eq('id', storeId)

        if (updateError) {
            console.error('[API /themes/install] Error updating store:', updateError)
            return NextResponse.json(
                { error: 'Failed to install theme' },
                { status: 500 }
            )
        }

        // 5. Upsert into store_themes
        const { error: storeThemeError } = await supabase
            .from('store_themes')
            .upsert(
                {
                    store_id: storeId,
                    theme_id: theme.id,
                    is_active: true,
                    config_overrides: {},
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'store_id,theme_id' }
            )

        if (storeThemeError) {
            console.error('[API /themes/install] Error upserting store_themes:', storeThemeError)
            // Non-fatal — the theme is already applied to the store
        }

        return NextResponse.json({
            success: true,
            theme: {
                name: theme.name,
                slug: theme.slug,
                version: theme.version,
            }
        })
    } catch (err) {
        console.error('[API /themes/install] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
