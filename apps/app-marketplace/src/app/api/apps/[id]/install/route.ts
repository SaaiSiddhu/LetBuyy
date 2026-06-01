import { NextRequest, NextResponse } from 'next/server';
import { appStoreWorkerFetch, proxyWorkerJson } from '@/lib/api/worker-client';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/apps/[id]/install — Install an app to the user's store
 * Requires authentication (enforced by middleware + session verification)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id: appId } = await params;

    try {
        const body = await request.json().catch(() => ({}));
        const response = await appStoreWorkerFetch(`/app-store/apps/${appId}/install`, {
            method: 'POST',
            requireSession: true,
            body: JSON.stringify({
                store_id: typeof body.store_id === 'string' ? body.store_id : undefined,
                scopes: Array.isArray(body.scopes) ? body.scopes : undefined,
                config: body.config && typeof body.config === 'object' ? body.config : undefined,
                webhook_url: typeof body.webhook_url === 'string' ? body.webhook_url : undefined,
                webhook_event: typeof body.webhook_event === 'string' ? body.webhook_event : undefined,
                webhook_secret: typeof body.webhook_secret === 'string' ? body.webhook_secret : undefined,
            }),
        });
        return proxyWorkerJson(response);
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

    try {
        const storeId = request.nextUrl.searchParams.get('store_id');
        const suffix = storeId ? `?store_id=${encodeURIComponent(storeId)}` : '';
        const response = await appStoreWorkerFetch(`/app-store/apps/${appId}/install${suffix}`, {
            method: 'DELETE',
            requireSession: true,
        });
        return proxyWorkerJson(response);
    } catch (err) {
        console.error('[uninstall] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
