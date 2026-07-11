/**
 * POST /api/themes/[themeId]/update — Phase AB: same-origin theme-safe-update proxy.
 *
 * Resolves the store via resolveOwnedStoreId (merchant ES256 session, tenancy
 * verified), then forwards the update request to the gateway's
 * POST /themes/:slug/update endpoint via merchantApiFetch.
 * No direct DB access.
 *
 * TENANCY: resolveOwnedStoreId verifies the session merchant owns the store.
 *   store_id is always taken from the resolved session, never from the raw
 *   request body — cross-tenant requests are rejected at the proxy level.
 *   The gateway further enforces verifySiteOwnership before any DB write.
 *
 * CAS guard: confirm_diff_hash from the body is validated (must be a 64-char
 *   lowercase hex SHA-256) and forwarded to the gateway. A stale hash causes
 *   the gateway to return 409 which this proxy forwards. The UI then prompts
 *   the merchant to re-preview before retrying.
 *
 * RISK-DUAL-N01: the gateway's update path mutates the store's template
 *   instance config (release_config in a new theme_releases row) — never
 *   the shared section_definitions catalog. This proxy is a pure forwarding
 *   layer; it performs no document mutation.
 *
 * NOT-CONNECTED: this proxy depends on the gateway's Phase AB update route
 *   (Lane B). If not yet deployed, the gateway's error is forwarded verbatim.
 *
 * Body (proxy contract with UI):
 *   store_id                 — raw store id; replaced with verified storeId
 *   target_bundle_version_id — UUID of the target bundle version
 *   confirm_diff_hash        — SHA-256 hex (64 lowercase hex chars) of preview diff (CAS guard)
 *   make_store_live          — boolean (default: true)
 *   update_message           — optional string (max 500 chars)
 *   idempotency_key          — string (min 1, max 200); required
 *
 * Gateway contract (forwarded as):
 *   store_id                 — resolved.storeId (verified UUID)
 *   target_package_version_id — target bundle UUID (gateway Zod field name)
 *   confirm_diff_hash        — forwarded verbatim
 *   make_store_live          — forwarded
 *   publish_message          — update_message renamed to gateway's field name
 *   idempotency_key          — forwarded unconditionally (required, validated at proxy)
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params

        const rawBody = await request.json().catch(() => null)
        if (!isRecord(rawBody)) {
            return NextResponse.json(
                { error: { code: 'INVALID_BODY', message: 'Request body must be a JSON object' } },
                { status: 400 }
            )
        }

        // store_id: accept from body (UI sends it) but ALWAYS replace with resolved id
        const rawStoreId = typeof rawBody.store_id === 'string'
            ? rawBody.store_id
            : typeof rawBody.store_name === 'string' ? rawBody.store_name : ''

        if (!rawStoreId) {
            return NextResponse.json(
                { error: { code: 'MISSING_STORE', message: 'store_id is required' } },
                { status: 400 }
            )
        }

        const targetBundleVersionId = typeof rawBody.target_bundle_version_id === 'string'
            ? rawBody.target_bundle_version_id
            : ''
        if (!targetBundleVersionId) {
            return NextResponse.json(
                { error: { code: 'MISSING_TARGET_VERSION', message: 'target_bundle_version_id is required' } },
                { status: 400 }
            )
        }

        const confirmDiffHash = typeof rawBody.confirm_diff_hash === 'string'
            ? rawBody.confirm_diff_hash
            : ''
        // Tighten proxy guard to exactly 64 lowercase hex chars — same requirement as
        // the gateway's Zod schema (.length(64).regex(/^[0-9a-f]{64}$/)).
        if (!confirmDiffHash || !/^[0-9a-f]{64}$/.test(confirmDiffHash)) {
            return NextResponse.json(
                { error: { code: 'MISSING_DIFF_HASH', message: 'confirm_diff_hash is required (64 lowercase hex chars)' } },
                { status: 400 }
            )
        }

        // idempotency_key is required by the gateway (z.string().min(1).max(255)).
        // Validate at the proxy boundary so the error message is clear.
        const idempotencyKey = typeof rawBody.idempotency_key === 'string'
            ? rawBody.idempotency_key.trim()
            : ''
        if (!idempotencyKey) {
            return NextResponse.json(
                { error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'idempotency_key is required (min 1 char)' } },
                { status: 400 }
            )
        }

        const makeStoreLive = rawBody.make_store_live !== false

        // Proxy receives update_message from the UI; gateway field is publish_message.
        const updateMessage = typeof rawBody.update_message === 'string'
            ? rawBody.update_message.slice(0, 500)
            : undefined

        // Tenancy: resolve + verify — always use resolved storeId in gateway payload
        const resolved = await resolveOwnedStoreId(rawStoreId)
        if (resolved.error) return resolved.error

        const gatewayPath = `/themes/${encodeURIComponent(themeId)}/update`

        const gatewayBody: Record<string, unknown> = {
            store_id: resolved.storeId,       // always the verified id
            target_package_version_id: targetBundleVersionId, // gateway Zod field name
            confirm_diff_hash: confirmDiffHash,
            make_store_live: makeStoreLive,
            idempotency_key: idempotencyKey,  // always forwarded (validated non-empty above)
        }
        // publish_message is the gateway's field name for what the UI calls update_message.
        if (updateMessage) gatewayBody.publish_message = updateMessage

        const gatewayResponse = await merchantApiFetch(gatewayPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gatewayBody),
            requireSession: true,
        })

        if (!gatewayResponse.ok) {
            let payload: unknown
            try { payload = await gatewayResponse.json() } catch {
                payload = { error: { code: 'GATEWAY_ERROR', message: 'Theme update failed' } }
            }
            return NextResponse.json(payload, { status: gatewayResponse.status })
        }

        const body = await gatewayResponse.json().catch(() => ({ success: true }))
        return NextResponse.json(body)
    } catch (err) {
        return merchantApiErrorResponse(err, 'Theme update failed')
    }
}
