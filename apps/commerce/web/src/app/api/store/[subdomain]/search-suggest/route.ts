// T5/W3 — predictive search suggestions for the Liquid header's search overlay.
// GET /api/store/:subdomain/search-suggest?q=...
//
// Tenant boundary: identical mechanism to ProductService.searchProducts, the same method the
// full-page /store/[subdomain]/search results page already uses safely — subdomain resolves to a
// site_id SERVER-SIDE inside the gateway's public /v1/storefront/:subdomain/products route (see
// public-routes.ts), never trusted from anywhere else. This route adds no new tenant-scoping
// mechanism; it is a thinner read over the exact same already-tenant-safe call.
//
// Rate limiting: inherited, not reinvented. Every /v1/* gateway route (including the one this calls)
// already sits behind the gateway's global queryCostRateLimit middleware (services/api-gateway/src/
// index.ts:683, `api.use('/*', queryCostRateLimit(...))`), so this endpoint is rate-limited the
// moment it's called — there is no separate customer-web rate limiter anywhere in this app to
// duplicate (checked: no rate-limit utility exists under apps/commerce/web/src).
//
// Route-ownership lockstep: this route does not touch a database. It calls ProductService, which
// calls createStorefrontApiClient() (a proxy to the api-gateway) — the same pattern store-lookup and
// every other route in this directory uses. No local DB read.
import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/lib/product-service';
import { createStructuredLogger } from '@letbuyy/ui/logging';

const MAX_RESULTS = 6;
const logger = createStructuredLogger('commerce-web');

export async function GET(req: NextRequest, context: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await context.params;
    const query = req.nextUrl.searchParams.get('q')?.trim() || '';

    if (!subdomain || !/^[a-zA-Z0-9-]+$/.test(subdomain)) {
        return NextResponse.json({ error: 'Invalid store' }, { status: 400 });
    }

    if (query.length < 2) {
        return NextResponse.json({ results: [] });
    }

    try {
        const products = await ProductService.searchProducts(subdomain, query);
        const results = products.slice(0, MAX_RESULTS).map((product) => ({
            id: product.id,
            title: product.name,
            price: product.price,
            currency: product.currency || 'INR',
            image: product.images?.[0] || null,
            url: `/store/${subdomain}/product/${product.id}`,
        }));
        return NextResponse.json({ results });
    } catch {
        logger.error('Storefront search suggestions unavailable', { operation: 'search-suggest' });
        return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Search suggestions are unavailable.' } }, { status: 503 });
    }
}
