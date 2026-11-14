import { NextRequest, NextResponse } from 'next/server';
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client';
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store';
import { validateMerchantMutationRequest } from '@/lib/api/request-origin';
const admitted = /^tickets(?:\/[0-9a-f-]{36}(?:\/messages)?|\/recovery)?$/i;
async function handle(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; segments?: string[] }> },
) {
    try {
        const { store, segments = [] } = await params,
            path = segments.join('/');
        if (
            !admitted.test(path) ||
            (request.method === 'GET' && path.endsWith('/messages')) ||
            (request.method === 'GET' && path.endsWith('/recovery'))
        )
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (request.method === 'POST') {
            const denied = validateMerchantMutationRequest(request);
            if (denied) return denied;
            if (
                path !== 'tickets' &&
                !path.endsWith('/messages') &&
                !path.endsWith('/recovery')
            )
                return NextResponse.json(
                    { error: 'Not found' },
                    { status: 404 },
                );
        }
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store));
        if (resolved.error) return resolved.error;
        const query = new URLSearchParams(request.nextUrl.searchParams);
        query.set('site_id', resolved.storeId);
        const body =
            request.method === 'POST' ? await request.json() : undefined;
        const response = await merchantApiFetch(
            '/merchant/support/' +
                path +
                (request.method === 'GET' ? '?' + query : ''),
            {
                method: request.method,
                requireSession: true,
                headers: {
                    'X-Idempotency-Key':
                        request.headers.get('X-Idempotency-Key') || '',
                },
                ...(body
                    ? {
                          body: JSON.stringify({
                              ...body,
                              site_id: resolved.storeId,
                          }),
                      }
                    : {}),
            },
        );
        return new NextResponse(await response.text(), {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        return merchantApiErrorResponse(error, 'Support is unavailable');
    }
}
export const GET = handle;
export const POST = handle;
