/**
 * GET /api/themes/[themeId]/update-preview — Phase AB: same-origin update-preview proxy.
 *
 * Resolves the store via resolveOwnedStoreId (merchant ES256 session, tenancy
 * verified), then forwards the request to the gateway's
 * GET /themes/:slug/update-preview endpoint via merchantApiFetch.
 * No direct DB access.
 *
 * TENANCY: resolveOwnedStoreId verifies the session merchant owns the store.
 *   The gateway further verifies verifySiteOwnership inside the route handler.
 *   A merchant can only preview the diff for a store they own — cross-tenant
 *   store_id values are rejected at resolveOwnedStoreId (401/404).
 *
 * RISK-DUAL-N01: read-only preview; never mutates section_definitions.
 *   The diff describes changes to instance content (settings, blocks) —
 *   the shared section_definitions catalog is not touched.
 *
 * NOT-CONNECTED: this proxy depends on the gateway's Phase AB update-preview
 *   route (Lane B). If that route is not yet deployed, the gateway returns a
 *   non-OK response that this proxy forwards verbatim. The UI renders a
 *   graceful error state rather than crashing.
 *
 * Query params (proxy contract with UI):
 *   store_id          — raw store id; resolved to verified storeId before forwarding
 *   target_version_id — the bundle version UUID to preview updating to
 *
 * Gateway contract (forwarded as):
 *   store_id                  — resolved.storeId (UUID)
 *   target_package_version_id — target bundle version UUID (gateway Zod field name)
 *
 * Response reshaping:
 *   The gateway returns { diff: ThemeUpdateDiff, diff_hash: string } where
 *   ThemeUpdateDiff has gateway-native fields (sections, requiresDuplicateBeforeApply).
 *   This proxy reshapes to the UI's ThemeUpdateDiff shape (rows, requiresDuplicate,
 *   compatible, diffHash) so the UI component does not depend on gateway internals.
 *
 * Returns { diff: UIThemeUpdateDiff } on success.
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// ── UI-facing ThemeUpdateDiff shape (mirrors ThemeUpdatePanel.tsx types) ───────
// Kept here as a local interface so this file is self-documenting without
// importing from the UI component (which is a client component).

interface UISectionDiffRow {
    templateKey: string
    sectionType: string
    action: 'added' | 'removed' | 'retained' | 'incompatible'
    lostContent?: string[]
}

interface UIThemeUpdateDiff {
    rows: UISectionDiffRow[]
    compatible: boolean
    requiresDuplicate: boolean
    diffHash: string
}

/** Flatten gateway lostContent ({settings, blocks}) to a string[] for the UI. */
function flattenLostContent(
    lostContent: Record<string, unknown> | undefined,
): string[] | undefined {
    if (!lostContent) return undefined
    const settingKeys = Object.keys(
        (lostContent.settings as Record<string, unknown> | undefined) ?? {}
    )
    const blockDescriptors = (
        (lostContent.blocks as Array<Record<string, unknown>>) ?? []
    ).map((b) => `block:${b.type as string}`)
    const all = [...settingKeys, ...blockDescriptors]
    return all.length > 0 ? all : undefined
}

/** Reshape gateway ThemeUpdateDiff to the UI-facing ThemeUpdateDiff. */
function reshapeDiff(gatewayDiff: Record<string, unknown>, diffHash: string): UIThemeUpdateDiff {
    const gatewaySections = Array.isArray(gatewayDiff.sections)
        ? (gatewayDiff.sections as Array<Record<string, unknown>>)
        : []

    const rows: UISectionDiffRow[] = gatewaySections.map((section) => ({
        templateKey: section.templateKey as string,
        sectionType: section.type as string,
        action: section.action as UISectionDiffRow['action'],
        lostContent: flattenLostContent(
            section.lostContent as Record<string, unknown> | undefined
        ),
    }))

    return {
        rows,
        // compatible: true is implied by a 200 OK response — the gateway returns
        // 422 (UpdateVersionRejectedError / UpdateDowngradeError) for incompatible
        // or unknown schema versions, never a 200 with incompatible=false.
        compatible: true,
        requiresDuplicate: Boolean(gatewayDiff.requiresDuplicateBeforeApply),
        diffHash,
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)

        // store_id from query (browser-supplied)
        const rawStoreId = searchParams.get('store_id') || searchParams.get('store_name')
        if (!rawStoreId) {
            return NextResponse.json(
                { error: { code: 'MISSING_STORE', message: 'store_id query parameter is required' } },
                { status: 400 }
            )
        }

        // UI param name: target_version_id (proxy's own contract with the UI component).
        const targetVersionId = searchParams.get('target_version_id')
        if (!targetVersionId) {
            return NextResponse.json(
                { error: { code: 'MISSING_TARGET_VERSION', message: 'target_version_id query parameter is required' } },
                { status: 400 }
            )
        }

        // Tenancy: resolve + verify the merchant owns this store
        const resolved = await resolveOwnedStoreId(rawStoreId)
        if (resolved.error) return resolved.error

        // Forward to gateway — always use resolved.storeId (never raw browser param).
        // Gateway Zod schema requires `target_package_version_id` (not target_version_id).
        const gatewayPath =
            `/themes/${encodeURIComponent(themeId)}/update-preview` +
            `?store_id=${encodeURIComponent(resolved.storeId)}` +
            `&target_package_version_id=${encodeURIComponent(targetVersionId)}`

        const gatewayResponse = await merchantApiFetch(gatewayPath, { requireSession: true })

        if (!gatewayResponse.ok) {
            let payload: unknown
            try { payload = await gatewayResponse.json() } catch {
                payload = { error: { code: 'GATEWAY_ERROR', message: 'Update preview failed' } }
            }
            return NextResponse.json(payload, { status: gatewayResponse.status })
        }

        const body = await gatewayResponse.json().catch(() => ({})) as Record<string, unknown>

        // Reshape gateway response to match the UI's ThemeUpdateDiff type.
        // Gateway returns: { slug, target_package_version_id, diff: ThemeUpdateDiff, diff_hash }
        // UI expects:      { diff: { rows, compatible, requiresDuplicate, diffHash } }
        const gatewayDiff = body.diff as Record<string, unknown> | undefined
        const diffHash = body.diff_hash as string | undefined

        if (!gatewayDiff || !diffHash) {
            return NextResponse.json(
                { error: { code: 'GATEWAY_ERROR', message: 'Update preview response missing diff or diff_hash' } },
                { status: 502 }
            )
        }

        const shapedDiff = reshapeDiff(gatewayDiff, diffHash)
        return NextResponse.json({ ...body, diff: shapedDiff })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Update preview failed')
    }
}
