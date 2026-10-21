import { NextRequest, NextResponse } from 'next/server';
import { merchantApiFetch, merchantApiErrorResponse, readMerchantApiJson } from '@/lib/api/client';
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store';
export async function GET(_request: NextRequest, context: {
    params: Promise<{
        store: string;
    }>;
}) {
    try {
        const { store } = await context.params;
        const owned = await resolveOwnedStoreId(store);
        if (owned.error)
            return owned.error;
        const response = await merchantApiFetch(`/store-access?site_id=${encodeURIComponent(owned.storeId)}`, { requireSession: true });
        return NextResponse.json(await readMerchantApiJson(response), { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return merchantApiErrorResponse(error, 'Unable to load storefront access');
    }
}
export async function PUT(request: NextRequest, context: {
    params: Promise<{
        store: string;
    }>;
}) {
    try {
        const { store } = await context.params;
        const owned = await resolveOwnedStoreId(store);
        if (owned.error)
            return owned.error;
        const body = await request.json();
        const response = await merchantApiFetch('/store-access', { method: 'PUT', requireSession: true, headers: { 'X-Idempotency-Key': typeof body.idempotencyKey === 'string' ? body.idempotencyKey : crypto.randomUUID() },
            body: JSON.stringify({ site_id: owned.storeId, access_mode: body.access_mode,
                access_message: body.access_message, ...(body.password ? { password: body.password } : {}) }) });
        return NextResponse.json(await readMerchantApiJson(response), { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return merchantApiErrorResponse(error, 'Unable to save storefront access');
    }
}
