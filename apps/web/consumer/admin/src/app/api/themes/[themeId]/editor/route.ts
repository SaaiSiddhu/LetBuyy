import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SECTION_SCHEMAS, THEME_SETTINGS_SCHEMA } from '@/lib/theme-schemas'

/**
 * GET /api/themes/[themeId]/editor?store_name=xxx
 *
 * Load all editor data: store info, template config, draft config, and schemas.
 */
export async function GET(
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

        // Fetch store data
        const { data: store, error: storeError } = await supabase
            .from('sites')
            .select('id, name, store_name, status, theme_id, template_config')
            .eq('store_name', storeName)
            .single()

        if (storeError || !store) {
            return NextResponse.json(
                { error: 'Store not found' },
                { status: 404 }
            )
        }

        // Fetch theme metadata from catalog
        const { data: theme } = await supabase
            .from('themes')
            .select('*')
            .or(`slug.eq.${themeId},id.eq.${themeId}`)
            .single()

        // Check for existing draft
        const { data: draft } = await supabase
            .from('theme_editor_drafts')
            .select('draft_config, auto_saved_at')
            .eq('store_id', store.id)
            .eq('theme_id', themeId)
            .single()

        // Build template config — use stored config or create defaults
        const templateConfig = store.template_config || {
            sections: {
                header: { id: 'header', type: 'header', visible: true, settings: {} },
                footer: { id: 'footer', type: 'footer', visible: true, settings: {} },
                template: [],
            },
            themeSettings: {},
        }

        return NextResponse.json({
            store: {
                id: store.id,
                name: store.name,
                subdomain: store.store_name,
                status: store.status,
            },
            theme: theme || {
                slug: themeId,
                name: themeId,
                version: '1.0.0',
            },
            templateConfig,
            draftConfig: draft?.draft_config || null,
            draftSavedAt: draft?.auto_saved_at || null,
            sectionSchemas: SECTION_SCHEMAS,
            themeSettingsSchema: THEME_SETTINGS_SCHEMA,
        })
    } catch (err) {
        console.error('[API /themes/editor GET] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/themes/[themeId]/editor?store_name=xxx
 *
 * Save editor changes to the live store (publish).
 * Body: { templateConfig }
 */
export async function PUT(
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
        const { templateConfig } = body

        if (!templateConfig) {
            return NextResponse.json(
                { error: 'templateConfig is required in body' },
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

        // Update the live template config
        const { error: updateError } = await supabase
            .from('sites')
            .update({
                template_config: templateConfig,
                updated_at: new Date().toISOString(),
            })
            .eq('id', store.id)

        if (updateError) {
            console.error('[API /themes/editor PUT] Update error:', updateError)
            return NextResponse.json(
                { error: 'Failed to save template config' },
                { status: 500 }
            )
        }

        // Delete any existing draft (it's now published)
        await supabase
            .from('theme_editor_drafts')
            .delete()
            .eq('store_id', store.id)
            .eq('theme_id', themeId)

        const savedAt = new Date().toISOString()

        return NextResponse.json({
            success: true,
            savedAt,
        })
    } catch (err) {
        console.error('[API /themes/editor PUT] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
