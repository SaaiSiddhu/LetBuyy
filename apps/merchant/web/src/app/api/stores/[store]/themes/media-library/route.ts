/**
 * /api/stores/[store]/themes/media-library — Phase X: same-origin media-library proxy.
 *
 * Gateway-proxy-only: resolves the store via resolveOwnedStoreId (merchant ES256
 * session, tenancy verified), then forwards the query to the gateway's
 * /themes/media-library endpoint via merchantApiFetch. No direct DB access.
 *
 * TENANCY: resolveOwnedStoreId verifies the session merchant owns the store.
 *   The gateway further verifies store_id is in scope (verifySiteOwnership).
 *   A site sees only its own media; cross-tenant media IDs are rejected at the
 *   gateway layer — never resolvable via this proxy contract.
 *
 * VALID TYPES: image | video | all
 * RISK-DUAL-N01: read-only; never mutates section_definitions.
 *
 * Returns { data: MediaItem[], meta: {} }
 * Returns 400 for unknown type.
 * Returns 401/404 when store resolution fails.
 * Forwards gateway status codes on error.
 *
 * NOT-CONNECTED: this route depends on the gateway's /themes/media-library
 * endpoint (Phase X gateway lane). If the gateway route is not yet deployed,
 * this proxy forwards the gateway's error response and the UI shows a graceful
 * NOT-CONNECTED empty state rather than crashing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

// Valid media types (mirrors the gateway media-library route)
const VALID_MEDIA_TYPES = ['image', 'video', 'all'] as const
type MediaType = typeof VALID_MEDIA_TYPES[number]

function isValidMediaType(v: string | null): v is MediaType {
    return VALID_MEDIA_TYPES.includes(v as MediaType)
}

function parseLimit(raw: string | null): number {
    const n = parseInt(raw ?? '50', 10)
    if (isNaN(n) || n < 1) return 50
    return Math.min(n, 100)
}

/**
 * GET /api/stores/[store]/themes/media-library
 *   ?type=<image|video|all>
 *   &q=<query>
 *   &cursor=<opaque-cursor>
 *   &limit=<1-100>
 *
 * type   — media filter: image | video | all (default: all)
 * q      — filename / original_name filter, max 200 chars (forwarded as q= to gateway)
 * cursor — opaque pagination cursor forwarded to gateway
 * limit  — max results 1–100, default 50
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { searchParams } = new URL(request.url)

        // Validate type (default: all)
        const rawType = searchParams.get('type') ?? 'all'
        if (!isValidMediaType(rawType)) {
            return NextResponse.json(
                {
                    error: {
                        code: 'INVALID_TYPE',
                        message: `type must be one of: ${VALID_MEDIA_TYPES.join(', ')}`,
                    },
                },
                { status: 400 }
            )
        }

        // Sanitize inputs (max 200 chars each)
        // NOTE: the browser-facing param is 'q' (matches gateway Zod schema) so
        // the client, proxy, and gateway all use the same param name.
        const search = (searchParams.get('q') ?? '').slice(0, 200)
        const cursor = (searchParams.get('cursor') ?? '').slice(0, 200)
        const limit = parseLimit(searchParams.get('limit'))

        // Resolve + verify store ownership (merchant ES256 session only)
        const resolved = await merchantSecurityScope(request, params, false)
        if (resolved.error) return resolved.error

        // Build gateway query — store_id is always the resolved/verified id,
        // never the browser-supplied value (tenancy law)
        const queryParts = [
            `store_id=${encodeURIComponent(resolved.storeId)}`,
            `type=${encodeURIComponent(rawType)}`,
            `limit=${limit}`,
        ]
        if (search) queryParts.push(`q=${encodeURIComponent(search)}`)
        if (cursor) queryParts.push(`cursor=${encodeURIComponent(cursor)}`)

        const gatewayPath = `/themes/media-library?${queryParts.join('&')}`

        // Forward to gateway — no direct DB; gateway enforces verifySiteOwnership
        const gatewayResponse = await merchantApiFetch(gatewayPath, { requireSession: true, headers: resolved.headers })

        // Forward non-ok gateway status verbatim (e.g. 404 = gateway not yet deployed)
        if (!gatewayResponse.ok) {
            let payload: unknown
            try {
                payload = await gatewayResponse.json()
            } catch {
                payload = { error: { code: 'GATEWAY_ERROR', message: 'Media library fetch failed' } }
            }
            return privateSecurityResponse(NextResponse.json(payload, { status: gatewayResponse.status }))
        }

        // Normalise to { data: [], meta: {} }
        let body: { data?: unknown[]; meta?: unknown }
        try {
            body = await gatewayResponse.json()
        } catch {
            body = {}
        }

        return privateSecurityResponse(NextResponse.json({
            data: Array.isArray(body.data) ? body.data : [],
            meta: body.meta ?? {},
        }))
    } catch (err) {
        return merchantApiErrorResponse(err, 'Media library fetch failed')
    }
}
