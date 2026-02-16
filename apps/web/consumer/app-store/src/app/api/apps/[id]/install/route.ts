import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifySession } from '@/lib/auth/session';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/apps/[id]/install — Install an app to the user's store
 * Requires authentication (enforced by middleware + session verification)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id: appId } = await params;

    // 1. Verify user is authenticated
    const session = await verifySession();
    if (!session || !session.storeId) {
        return NextResponse.json(
            { error: 'Authentication required. Please link a store to install apps.' },
            { status: 401 }
        );
    }

    const supabase = await createSupabaseServerClient();

    try {
        // 2. Verify the app exists and is published
        const { data: app, error: appError } = await supabase
            .from('marketplace_apps')
            .select('id, name, status, pricing_model, api_scopes')
            .eq('id', appId)
            .single();

        if (appError || !app) {
            return NextResponse.json(
                { error: 'App not found' },
                { status: 404 }
            );
        }

        if (app.status !== 'published') {
            return NextResponse.json(
                { error: 'This app is not available for installation' },
                { status: 400 }
            );
        }

        // 3. Check if already installed
        const { data: existing } = await supabase
            .from('app_installations')
            .select('id, status')
            .eq('app_id', appId)
            .eq('store_id', session.storeId)
            .single();

        if (existing && existing.status === 'active') {
            return NextResponse.json(
                { error: 'App is already installed on this store' },
                { status: 409 }
            );
        }

        // 4. Upsert into app_installations (handles reinstall of previously uninstalled apps)
        const { data: installation, error: installError } = await supabase
            .from('app_installations')
            .upsert(
                {
                    app_id: appId,
                    store_id: session.storeId,
                    installed_by: session.userId,
                    status: 'active',
                    scopes_granted: app.api_scopes || [],
                    config: {},
                    installed_at: new Date().toISOString(),
                    uninstalled_at: null,
                },
                { onConflict: 'app_id,store_id' }
            )
            .select()
            .single();

        if (installError) {
            console.error('[install] Error installing app:', installError.message);
            return NextResponse.json(
                { error: 'Failed to install app' },
                { status: 500 }
            );
        }

        // 5. install_count is auto-updated via the update_app_install_count() trigger

        return NextResponse.json({
            success: true,
            message: `${app.name} installed successfully`,
            installation: {
                id: installation.id,
                appId: installation.app_id,
                storeId: installation.store_id,
                status: installation.status,
                installedAt: installation.installed_at,
            },
        });
    } catch (err) {
        console.error('[install] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/apps/[id]/install — Uninstall an app from the user's store
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id: appId } = await params;

    // 1. Verify user is authenticated
    const session = await verifySession();
    if (!session || !session.storeId) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    const supabase = await createSupabaseServerClient();

    try {
        // 2. Find the active installation
        const { data: installation, error: findError } = await supabase
            .from('app_installations')
            .select('id, status')
            .eq('app_id', appId)
            .eq('store_id', session.storeId)
            .eq('status', 'active')
            .single();

        if (findError || !installation) {
            return NextResponse.json(
                { error: 'App is not installed on this store' },
                { status: 404 }
            );
        }

        // 3. Soft-delete: set status to 'uninstalled' and record timestamp
        const { error: uninstallError } = await supabase
            .from('app_installations')
            .update({
                status: 'uninstalled',
                uninstalled_at: new Date().toISOString(),
            })
            .eq('id', installation.id);

        if (uninstallError) {
            console.error('[uninstall] Error uninstalling app:', uninstallError.message);
            return NextResponse.json(
                { error: 'Failed to uninstall app' },
                { status: 500 }
            );
        }

        // 4. install_count is auto-updated via the update_app_install_count() trigger

        return NextResponse.json({
            success: true,
            message: 'App uninstalled successfully',
        });
    } catch (err) {
        console.error('[uninstall] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
