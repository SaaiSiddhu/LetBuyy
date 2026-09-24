/**
 * /api/stores/[store]/resource-search — Phase W: same-origin resource search proxy.
 *
 * Gateway-proxy-only: resolves the store via resolveOwnedStoreId (merchant ES256
 * session, tenancy verified), then forwards the query to the gateway's
 * /themes/resource-search endpoint via merchantApiFetch. No direct DB access.
 *
 * TENANCY: resolveOwnedStoreId verifies the session merchant owns the store.
 *   The gateway further verifies store_id is in scope.
 *   Result: only the session merchant's resources are returned; cross-tenant reads
 *   are rejected at both layers.
 *
 * VALID TYPES: product | collection | page | blog | menu
 * RISK-DUAL-N01: read-only; never mutates section_definitions.
 *
 * Returns { data: ResourceItem[], meta: {} }
 * Returns 400 for unknown type or oversized query.
 * Returns 401/404 when store resolution fails.
 * Forwards gateway status codes on error.
 *
 * NOT-CONNECTED: this route depends on the gateway's /themes/resource-search
 * endpoint (Phase W gateway lane). If the gateway route is not yet deployed,
 * this proxy will forward a 404 from the gateway and the UI will show an error
 * state gracefully.
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// Enum-enforced resource types (mirrors the gateway resource-search route)
const VALID_RESOURCE_TYPES = ['product', 'collection', 'page', 'blog', 'menu'] as const
type ResourceType = typeof VALID_RESOURCE_TYPES[number]

function isValidResourceType(v: string | null): v is ResourceType {
    return VALID_RESOURCE_TYPES.includes(v as ResourceType)
}

function parseLimit(raw: string | null): number {
    const n = parseInt(raw ?? '20', 10)
    if (isNaN(n) || n < 1) return 20
    return Math.min(n, 50)
}

/**
 * GET /api/stores/[store]/resource-search?type=<type>&q=<query>&limit=<n>
 *
 * type   — one of: product | collection | page | blog | menu  (required)
 * q      — search query string, max 200 chars
 * limit  — max results, 1–50, default 20
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const { searchParams } = new URL(request.url)

        // Validate type
        const type = searchParams.get('type')
        if (!isValidResourceType(type)) {
            return NextResponse.json(
                { error: { code: 'INVALID_TYPE', message: `type must be one of: ${VALID_RESOURCE_TYPES.join(', ')}` } },
                { status: 400 }
            )
        }

        // Sanitize query (max 200 chars)
        const q = (searchParams.get('q') ?? '').slice(0, 200)
        const limit = parseLimit(searchParams.get('limit'))

        // Resolve + verify store ownership (merchant ES256 session only)
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        // Forward to gateway — no direct DB; gateway enforces tenancy
        const gatewayPath =
            `/themes/resource-search?store_id=${encodeURIComponent(resolved.storeId)}` +
            `&type=${encodeURIComponent(type)}` +
            `&q=${encodeURIComponent(q)}` +
            `&limit=${limit}`

        const gatewayResponse = await merchantApiFetch(gatewayPath, { requireSession: true })

        // Forward non-ok gateway status verbatim
        if (!gatewayResponse.ok) {
            let payload: unknown
            try {
                payload = await gatewayResponse.json()
            } catch {
                payload = { error: { code: 'GATEWAY_ERROR', message: 'Resource search failed' } }
            }
            return NextResponse.json(payload, { status: gatewayResponse.status })
        }

        // Normalise to { data: [], meta: {} }
        let body: { data?: unknown[]; meta?: unknown }
        try {
            body = await gatewayResponse.json()
        } catch {
            body = {}
        }

        return NextResponse.json({
            data: Array.isArray(body.data) ? body.data : [],
            meta: body.meta ?? {},
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Resource search failed')
    }
}
