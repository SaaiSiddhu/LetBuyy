/**
 * /api/stores/[store]/themes/app-blocks — Phase Y: app-block slot editor proxy.
 *
 * Lists installed app extensions that are eligible for placement into an
 * app-block-slot section. Returns the extension_id as each extension's identity
 * (never a block type override).
 *
 * Gateway-proxy-only: resolves store via resolveOwnedStoreId (merchant ES256
 * session, tenancy verified), then forwards the query to the gateway's
 * /themes/app-blocks endpoint. No direct DB access; no @letbuyy/api-client edit.
 *
 * TENANCY: resolveOwnedStoreId verifies the session merchant owns the store.
 *   The gateway further verifies store_id is in scope (verifySiteOwnership).
 *   A site sees only its own app extensions; cross-tenant extension IDs are
 *   rejected at the gateway layer.
 *
 * NOT-CONNECTED: The gateway /themes/app-blocks endpoint does not yet exist.
 *   When the gateway returns 404 (endpoint not deployed), this proxy returns
 *   { data: [], not_connected: true } so AppBlockSlotPanel can show an honest
 *   "No apps installed — NOT-CONNECTED" state rather than crashing.
 *   Missing piece: gateway route GET /themes/app-blocks (reads
 *   app_extension_registrations WHERE surface = 'theme.app_block').
 *
 * RISK-DUAL-N01: read-only. Never mutates section_definitions or block_definitions.
 *
 * Returns:
 *   200  { data: InstalledAppExtension[], not_connected: false }
 *   200  { data: [], not_connected: true }  — gateway 404 (NOT-CONNECTED)
 *   401  when session is missing or store not owned by session merchant
 *   404  when store cannot be resolved
 *   5xx  on unexpected errors (forwarded from gateway or internal)
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params

        // Resolve + verify store ownership (merchant ES256 session only)
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        // Build gateway query — store_id always from the resolved/verified id,
        // never the browser-supplied value (tenancy law)
        const gatewayPath = `/themes/app-blocks?store_id=${encodeURIComponent(resolved.storeId)}`

        // Forward to gateway — no direct DB; gateway enforces verifySiteOwnership
        const gatewayResponse = await merchantApiFetch(gatewayPath, { requireSession: true })

        // Gateway 404 = endpoint not yet deployed (NOT-CONNECTED).
        // Return honest empty state with not_connected flag so AppBlockSlotPanel
        // can display the correct "No apps installed — NOT-CONNECTED" UI.
        if (gatewayResponse.status === 404) {
            return NextResponse.json({ data: [], not_connected: true })
        }

        // Forward other non-ok gateway status verbatim (e.g. 401, 500)
        if (!gatewayResponse.ok) {
            let payload: unknown
            try {
                payload = await gatewayResponse.json()
            } catch {
                payload = { error: { code: 'GATEWAY_ERROR', message: 'App blocks fetch failed' } }
            }
            return NextResponse.json(payload, { status: gatewayResponse.status })
        }

        // Normalise to { data: InstalledAppExtension[], not_connected: false }
        let body: { data?: unknown[] }
        try {
            body = await gatewayResponse.json()
        } catch {
            body = {}
        }

        return NextResponse.json({
            data: Array.isArray(body.data) ? body.data : [],
            not_connected: false,
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'App blocks fetch failed')
    }
}
