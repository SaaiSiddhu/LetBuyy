import { NextRequest, NextResponse } from 'next/server';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';

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
        const idempotencyKey = request.headers.get('idempotency-key') ?? request.headers.get('x-idempotency-key') ?? undefined;
        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.install(appId, {
                store_id: typeof body.store_id === 'string' ? body.store_id : undefined,
                scopes: Array.isArray(body.scopes) ? body.scopes : undefined,
                config: body.config && typeof body.config === 'object' ? body.config : undefined,
                webhook_url: typeof body.webhook_url === 'string' ? body.webhook_url : undefined,
                webhook_event: typeof body.webhook_event === 'string' ? body.webhook_event : undefined,
                // webhook_secret intentionally not forwarded: the gateway generates the signing secret server-side (M5).
        }, idempotencyKey ? { idempotencyKey } : undefined);
        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        logger.error('app install failed', { appId, error: err instanceof Error ? err.message : String(err) });
        return appMarketplaceErrorResponse(err, 'Internal server error');
    }
}

/**
 * DELETE /api/apps/[id]/install — Uninstall an app from the user's store
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id: appId } = await params;

    try {
        const storeId = request.nextUrl.searchParams.get('store_id');
        const idempotencyKey = request.headers.get('idempotency-key') ?? request.headers.get('x-idempotency-key') ?? undefined;
        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.uninstall(appId, storeId ? { store_id: storeId } : undefined, idempotencyKey ? { idempotencyKey } : undefined);
        return NextResponse.json({ data });
    } catch (err) {
        logger.error('app uninstall failed', { appId, error: err instanceof Error ? err.message : String(err) });
        return appMarketplaceErrorResponse(err, 'Internal server error');
    }
}
