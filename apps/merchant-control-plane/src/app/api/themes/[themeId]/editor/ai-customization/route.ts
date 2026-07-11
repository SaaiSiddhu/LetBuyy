/**
 * Phase AC — AI Customization Proxy: same-origin proxy for AI theme suggestions.
 *
 * Exposes two handlers:
 *
 *   GET  /api/themes/[themeId]/editor/ai-customization
 *        Returns a static catalog of suggestions (no auth beyond session required).
 *        The catalog describes the structured chip inputs (PaletteVariant,
 *        FontPairingIntent) and the not-connected seams.
 *        No gateway call — the catalog is derived from the deterministic SDK.
 *
 *   POST /api/themes/[themeId]/editor/ai-customization?store_name=xxx
 *        Applies a token overlay to the draft.
 *        Requires merchant session (resolveOwnedStoreId verifies ownership).
 *        Body: { intent, overlay: Partial<ExperienceTokens>, proposalHash }
 *        Forwards to the gateway's AI-customization endpoint.
 *
 * ── TENANCY ──────────────────────────────────────────────────────────────────
 *   resolveOwnedStoreId verifies the session merchant owns the store.
 *   The gateway further enforces verifySiteOwnership on every route.
 *   store_id is always resolved.storeId (never the raw browser param).
 *
 * ── NOT-CONNECTED ────────────────────────────────────────────────────────────
 *   This proxy forwards to POST /themes/:themeId/ai-customization on the gateway.
 *   That gateway route does NOT yet exist (Phase AC, Lane A, pending deployment).
 *   When the gateway returns 404 or 503, this proxy returns a structured
 *   NOT_CONNECTED response (HTTP 503) so the UI can render an honest error state
 *   rather than a generic network failure.
 *
 *   To connect: deploy services/api-gateway/src/routes/themes/theme-ai-customization-route.ts
 *   and set THEME_AI_PROVIDER_API_KEY in the gateway environment.
 *   Gateway route: POST /themes/:themeId/ai-customization
 *
 * ── RISK-DUAL-N01 ────────────────────────────────────────────────────────────
 *   This proxy only forwards token overlay payloads (settings_data.current).
 *   It never emits a payload that touches section_definitions, block_definitions,
 *   layout, locales, or renderer. The gateway route enforces this at the
 *   applyExperienceToDocument(STYLE_ONLY) level for palette/typography intents.
 *
 * ── NO DIRECT DB ─────────────────────────────────────────────────────────────
 *   Uses merchantApiFetch (→ gateway) and resolveOwnedStoreId (→ API client).
 *   Never imports or calls Supabase / database drivers directly.
 *   Uses merchantApiFetch, not the typed API wrapper, per the proxy pattern.
 *
 * ── Foreign WIP isolation ────────────────────────────────────────────────────
 *   No imports from the gateway index, the stores gateway route,
 *   the letbuyy api-client package, or the app globals stylesheet.
 *   All are unchanged foreign-WIP files.
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// ── Static suggestions catalog (GET, no gateway call) ─────────────────────────

const SUGGESTIONS_CATALOG = Object.freeze({
    palette: [
        { id: 'warm', label: 'Warm', description: 'Shift colours toward red/orange warmth', variant: 'warm' },
        { id: 'cool', label: 'Cool', description: 'Shift colours toward blue/green calm', variant: 'cool' },
        { id: 'bold', label: 'Bold', description: 'Maximum saturation and contrast', variant: 'bold' },
        { id: 'muted', label: 'Muted', description: 'Desaturated, quiet tones', variant: 'muted' },
    ],
    typography: [
        { id: 'editorial', label: 'Editorial', description: 'Serif heading + clean sans body', intent: 'editorial' },
        { id: 'technical', label: 'Technical', description: 'Uniform sans for heading and body', intent: 'technical' },
        { id: 'artisanal', label: 'Artisanal', description: 'Humanist serif + neutral sans body', intent: 'artisanal' },
        { id: 'friendly', label: 'Friendly', description: 'Rounded sans for heading and body', intent: 'friendly' },
    ],
    /** Suggestions that require the NOT-CONNECTED gateway AI route. */
    notConnected: [
        {
            id: 'section',
            label: 'Add section',
            seam: 'Section ordering requires the gateway AI route (POST /v1/theme-ai/parse-brief)',
        },
        {
            id: 'accessibility',
            label: 'Fix accessibility',
            seam: 'Accessibility analysis requires the gateway AI route (POST /v1/theme-ai/parse-brief)',
        },
    ],
    /** MODEL_BOUNDARY stub (mirrors theme-engine MODEL_BOUNDARY). */
    modelBoundary: Object.freeze({
        status: 'NOT_CONNECTED' as const,
        envVar: 'THEME_AI_PROVIDER_API_KEY',
        gatewayRoute: 'POST /v1/theme-ai/parse-brief (does not exist)',
        seams: [
            'NL brief → ThemeBrief (requires LLM)',
            'NL colour mood → seed hex (requires LLM)',
            'NL section intent → SectionGoal[] (requires LLM)',
        ],
        deterministic: [
            'ThemeBrief → generateTheme() → GenerateThemeResult',
            'seed hex + PaletteVariant → deterministicPalette() → ExperienceTokens',
            'SectionGoal[] → generateSectionOrder() → string[]',
        ],
    }),
})

// ── GET /api/themes/[themeId]/editor/ai-customization ────────────────────────

/**
 * GET handler — returns the static suggestions catalog.
 *
 * No authentication required beyond a valid merchant session cookie.
 * No gateway call — the catalog is purely static.
 * The themeId param is unused (catalog is theme-agnostic) but validated for
 * URL consistency.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        if (!themeId || typeof themeId !== 'string') {
            return NextResponse.json(
                { error: { code: 'MISSING_THEME', message: 'themeId is required' } },
                { status: 400 }
            )
        }

        return NextResponse.json({ suggestions: SUGGESTIONS_CATALOG })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Failed to load AI suggestions catalog')
    }
}

// ── POST /api/themes/[themeId]/editor/ai-customization?store_name=xxx ────────

/**
 * POST handler — applies a token overlay to the draft.
 *
 * Body: {
 *   intent:       { type: 'palette' | 'typography' | 'section' | 'accessibility'; ... }
 *   overlay:      Partial<ExperienceTokens>  — the proposed token changes
 *   proposalHash: string                     — djb2 CAS guard from proposeThemeCustomization()
 * }
 *
 * Forwards to the gateway's AI-customization endpoint via merchantApiFetch.
 * If the gateway route is not yet deployed (404/503), returns a structured
 * NOT_CONNECTED response so the UI can render an honest error state.
 *
 * RISK-DUAL-N01: the overlay contains only token keys (settings_data.current).
 *   Never forwards a payload that touches section_definitions or structural keys.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ themeId: string }> }
) {
    try {
        const { themeId } = await params
        const { searchParams } = new URL(request.url)
        const storeName = searchParams.get('store_name')

        if (!storeName) {
            return NextResponse.json(
                { error: { code: 'MISSING_STORE', message: 'store_name query parameter is required' } },
                { status: 400 }
            )
        }

        // Parse and validate body
        let body: Record<string, unknown>
        try {
            const raw = await request.json()
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
                return NextResponse.json(
                    { error: { code: 'INVALID_BODY', message: 'Request body must be a JSON object' } },
                    { status: 400 }
                )
            }
            body = raw as Record<string, unknown>
        } catch {
            return NextResponse.json(
                { error: { code: 'INVALID_JSON', message: 'Could not parse request body as JSON' } },
                { status: 400 }
            )
        }

        const intent = body.intent
        const overlay = body.overlay
        const proposalHash = body.proposalHash

        if (!intent || typeof intent !== 'object') {
            return NextResponse.json(
                { error: { code: 'MISSING_INTENT', message: 'intent is required' } },
                { status: 400 }
            )
        }
        if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
            return NextResponse.json(
                { error: { code: 'MISSING_OVERLAY', message: 'overlay is required and must be an object' } },
                { status: 400 }
            )
        }
        if (typeof proposalHash !== 'string' || proposalHash.length === 0) {
            return NextResponse.json(
                { error: { code: 'MISSING_HASH', message: 'proposalHash is required' } },
                { status: 400 }
            )
        }

        // Tenancy: resolve + verify the merchant owns this store.
        // Always use resolved.storeId — never the raw browser-supplied storeName.
        const resolved = await resolveOwnedStoreId(storeName)
        if (resolved.error) return resolved.error

        // Forward to the gateway AI-customization route via merchantApiFetch.
        // NOT-CONNECTED: this gateway route does not yet exist (Phase AC, Lane A).
        // When it returns 404 or 503, surface a structured NOT_CONNECTED error.
        const gatewayPath = `/themes/${encodeURIComponent(themeId)}/ai-customization`
        const gatewayResponse = await merchantApiFetch(gatewayPath, {
            method: 'POST',
            requireSession: true,
            body: JSON.stringify({
                store_id: resolved.storeId,  // always resolved (never raw)
                intent,
                overlay,
                proposal_hash: proposalHash,
            }),
        })

        // NOT-CONNECTED: gateway route not yet deployed.
        if (gatewayResponse.status === 404 || gatewayResponse.status === 503) {
            return NextResponse.json(
                {
                    error: {
                        code: 'NOT_CONNECTED',
                        message:
                            'The AI customization gateway route is not yet deployed. ' +
                            'Set THEME_AI_PROVIDER_API_KEY and deploy ' +
                            'services/api-gateway/src/routes/themes/theme-ai-customization-route.ts.',
                        envVar: SUGGESTIONS_CATALOG.modelBoundary.envVar,
                        gatewayRoute: 'POST /themes/:themeId/ai-customization (does not exist)',
                    },
                },
                { status: 503 }
            )
        }

        // For all other gateway responses (success or other errors), forward verbatim.
        let payload: unknown
        try { payload = await gatewayResponse.json() } catch {
            payload = { error: { code: 'GATEWAY_ERROR', message: 'AI customization request failed' } }
        }
        return NextResponse.json(payload, { status: gatewayResponse.status })
    } catch (err) {
        return merchantApiErrorResponse(err, 'AI customization request failed')
    }
}
