'use client'

/**
 * AICustomizationPanel — Phase AC: Merchant AI Theme Customization UI.
 *
 * Renders structured suggestion chips → deterministic client-side proposal
 * → PREVIEW diff (proposed token changes) → explicit Apply / Reject.
 *
 * ── MODEL BOUNDARY (NOT-CONNECTED) ───────────────────────────────────────────
 *   This panel makes ZERO real LLM or model provider calls.
 *   Palette and typography proposals are computed DETERMINISTICALLY using:
 *     • deterministicPalette(seed, variant) → ExperienceTokens (WCAG-AA guaranteed)
 *     • suggestTypographyPairing(intent)    → FontPairing (known fonts only)
 *   Free-text understanding (mapping "earthy and warm" → { primaryColor: '#...' })
 *   requires a real language model and is NOT-CONNECTED.
 *   See MODEL_BOUNDARY (imported from @letbuyy/theme-engine) for the exact seam.
 *
 * ── RISK-DUAL-N01 (paramount) ────────────────────────────────────────────────
 *   Apply mutates ONLY the draft instance (settings_data.current token overlay).
 *   section_definitions / block_definitions / layout / locales / renderer are
 *   NEVER touched by AI suggestions. The proposal goes through the existing
 *   draft path — it is diffable, reversible, and never a blind overwrite.
 *
 * ── NO-AUTO-APPLY LAW ────────────────────────────────────────────────────────
 *   canApply is true only when:
 *     (a) a proposal has been computed (proposal !== null), AND
 *     (b) the proposal type is 'token-overlay' (not-connected cannot apply), AND
 *     (c) panelState is 'preview' (blocked while computing/applying/applied).
 *   The Apply button carries aria-disabled when canApply is false — never hidden.
 *
 * ── DETERMINISM LAW ──────────────────────────────────────────────────────────
 *   proposeThemeCustomization is PURE — no random source, no clock source, no network.
 *   djb2Hash is a pure integer accumulator — same input → same output always.
 *   Same intent + same currentTokens → identical proposalHash.
 *
 * ── VALIDATED OUTPUT LAW ─────────────────────────────────────────────────────
 *   deterministicPalette throws (fail-closed) if the generated palette fails
 *   WCAG 2.1 AA (textColor/backgroundColor ≥ 4.5:1). The panel catches this
 *   and surfaces an error state rather than emitting an invalid palette.
 *
 * ── Foreign WIP isolation ────────────────────────────────────────────────────
 *   No import from the online-store editor page, the ExperiencePicker component,
 *   the app globals stylesheet, the letbuyy api-client package, or the
 *   settings localization page. All are unchanged foreign-WIP files.
 */

import { useState, useCallback, useId } from 'react'
import {
    AlertTriangle,
    Badge,
    Banner,
    Button,
    Check,
    Info,
    Input,
    Palette,
    Skeleton,
    Sparkles,
    Table,
    useToast,
    X,
} from '@letbuyy/ui'
import {
    deterministicPalette,
    suggestTypographyPairing,
    MODEL_BOUNDARY,
} from '@letbuyy/theme-engine'
import type {
    ExperienceTokens,
    FontPairing,
    FontPairingIntent,
    PaletteVariant,
} from '@letbuyy/theme-engine'

// ── Intent types (structured keyword/enum — NOT free-text NLU) ────────────────

/** Palette suggestion: shifts the colour system toward a given aesthetic. */
export interface AIPaletteIntent {
    type: 'palette'
    /** Aesthetic variant for deterministicPalette(). */
    variant: Exclude<PaletteVariant, 'neutral'>
}

/** Typography suggestion: swaps the heading+body font pair. */
export interface AITypographyIntent {
    type: 'typography'
    /** Design intent for suggestTypographyPairing(). */
    intent: Exclude<FontPairingIntent, 'neutral'>
}

/**
 * Section-order and accessibility suggestions: NOT-CONNECTED.
 * These intents require the gateway AI route (POST /v1/theme-ai/parse-brief)
 * which does not yet exist. They surface the NOT-CONNECTED state honestly.
 */
export interface AINotConnectedIntent {
    type: 'section' | 'accessibility'
}

export type AIIntent = AIPaletteIntent | AITypographyIntent | AINotConnectedIntent

// ── Proposal types ────────────────────────────────────────────────────────────

/** A single token key diff entry. */
export interface TokenDiffEntry {
    key: string
    previousValue: unknown
    newValue: unknown
}

/**
 * A valid token overlay proposal — the result of a deterministic computation.
 * The overlay contains only the changed token keys.
 */
export interface AITokenOverlayProposal {
    type: 'token-overlay'
    /** The intent that produced this proposal. */
    intent: AIPaletteIntent | AITypographyIntent
    /** Token keys to update in settings_data.current. */
    overlay: Partial<ExperienceTokens>
    /** Diff entries for the preview table (only changed keys). */
    diff: TokenDiffEntry[]
    /**
     * djb2 hash of JSON.stringify({ intent, overlay }).
     * Deterministic: same intent + same overlay → same hash.
     * Used as a CAS guard in the Apply request.
     */
    proposalHash: string
}

/**
 * A NOT-CONNECTED proposal — the selected intent requires a gateway AI route
 * that is not yet deployed.
 */
export interface AINotConnectedProposal {
    type: 'not-connected'
    seam: string
    envVar: string
    gatewayRoute: string
}

export type AIProposal = AITokenOverlayProposal | AINotConnectedProposal

// ── Panel state machine ────────────────────────────────────────────────────────

export type AIPanelState =
    | 'idle'       // No chip selected yet
    | 'computing'  // Computing proposal client-side (deterministicPalette / suggestTypographyPairing)
    | 'preview'    // Proposal computed; showing diff; waiting for Apply or Reject
    | 'applying'   // POST to same-origin proxy in-flight
    | 'applied'    // Draft successfully updated
    | 'error'      // Computing or applying failed

// ── Static catalogs ───────────────────────────────────────────────────────────

const PALETTE_CHIPS: Array<{ id: string; label: string; description: string; variant: Exclude<PaletteVariant, 'neutral'> }> = [
    { id: 'warm', label: 'Warm', description: 'Shift colours toward red/orange warmth', variant: 'warm' },
    { id: 'cool', label: 'Cool', description: 'Shift colours toward blue/green calm', variant: 'cool' },
    { id: 'bold', label: 'Bold', description: 'Maximum saturation and contrast', variant: 'bold' },
    { id: 'muted', label: 'Muted', description: 'Desaturated, quiet tones', variant: 'muted' },
]

const TYPOGRAPHY_CHIPS: Array<{ id: string; label: string; description: string; intent: Exclude<FontPairingIntent, 'neutral'> }> = [
    { id: 'editorial', label: 'Editorial', description: 'Serif heading + clean sans body', intent: 'editorial' },
    { id: 'technical', label: 'Technical', description: 'Uniform sans for heading and body', intent: 'technical' },
    { id: 'artisanal', label: 'Artisanal', description: 'Humanist serif + neutral sans body', intent: 'artisanal' },
    { id: 'friendly', label: 'Friendly', description: 'Rounded sans for heading and body', intent: 'friendly' },
]

const NOT_CONNECTED_CHIPS: Array<{ id: string; label: string; seam: string; intent: AINotConnectedIntent }> = [
    { id: 'section', label: 'Add section', seam: 'Section ordering requires the gateway AI route', intent: { type: 'section' } },
    { id: 'accessibility', label: 'Fix accessibility', seam: 'Accessibility analysis requires the gateway AI route', intent: { type: 'accessibility' } },
]

// ── Deterministic hash (djb2) — NO Math.random, NO Date.now ──────────────────

/**
 * djb2 hash of a string. Deterministic: same input → same hex string output.
 * Used for proposal CAS guard (proposalHash). Never uses random or time.
 */
function djb2Hash(input: string): string {
    let h = 5381
    for (let i = 0; i < input.length; i++) {
        h = (((h << 5) + h) + input.charCodeAt(i)) | 0
    }
    return (h >>> 0).toString(16).padStart(8, '0')
}

// ── Core proposal engine (deterministic, no network) ─────────────────────────

const COLOR_OVERLAY_KEYS = [
    'primaryColor',
    'secondaryColor',
    'accentColor',
    'backgroundColor',
    'textColor',
    'surfaceColor',
] as const satisfies ReadonlyArray<keyof ExperienceTokens>

const TYPOGRAPHY_OVERLAY_KEYS = [
    'fontFamily',
    'headingFontFamily',
] as const satisfies ReadonlyArray<keyof ExperienceTokens>

/** Default seed for palette generation when the merchant has no primaryColor set. */
const DEFAULT_SEED = '#'.concat('6366F1')

/**
 * Compute a deterministic AI proposal from a structured intent and the current
 * token values. This function is PURE and DETERMINISTIC:
 *   - Same intent + same currentTokens → same proposalHash.
 *   - No Math.random(), no Date.now(), no network calls.
 *
 * RISK-DUAL-N01: returns only a token overlay for settings_data.current;
 * never proposes changes to section_definitions or any structural document key.
 *
 * NOT-CONNECTED: returns an AINotConnectedProposal for section/accessibility
 * intents that require the gateway AI route.
 */
export function proposeThemeCustomization(
    intent: AIIntent,
    currentTokens: Record<string, unknown>,
): AIProposal {
    // Validate / extract seed colour from current tokens.
    const rawSeed = typeof currentTokens.primaryColor === 'string'
        ? currentTokens.primaryColor
        : DEFAULT_SEED
    const seed = /^#[0-9A-Fa-f]{6}$/.test(rawSeed) ? rawSeed : DEFAULT_SEED

    if (intent.type === 'palette') {
        // deterministicPalette is WCAG-AA guaranteed (throws if invariant broken).
        const proposed: ExperienceTokens = deterministicPalette(seed, intent.variant)
        const overlay: Partial<ExperienceTokens> = Object.fromEntries(
            COLOR_OVERLAY_KEYS.map(k => [k, proposed[k]])
        ) as Partial<ExperienceTokens>
        const diff: TokenDiffEntry[] = COLOR_OVERLAY_KEYS
            .filter(k => proposed[k] !== currentTokens[k])
            .map(k => ({ key: k, previousValue: currentTokens[k], newValue: proposed[k] }))
        const proposalHash = djb2Hash(JSON.stringify({ intent, overlay }))
        return { type: 'token-overlay', intent, overlay, diff, proposalHash }
    }

    if (intent.type === 'typography') {
        const pairing: FontPairing = suggestTypographyPairing(intent.intent)
        const overlay: Partial<ExperienceTokens> = {
            fontFamily: pairing.fontFamily,
            headingFontFamily: pairing.headingFontFamily,
        }
        const diff: TokenDiffEntry[] = TYPOGRAPHY_OVERLAY_KEYS
            .filter(k => pairing[k] !== currentTokens[k])
            .map(k => ({ key: k, previousValue: currentTokens[k], newValue: pairing[k] }))
        const proposalHash = djb2Hash(JSON.stringify({ intent, overlay }))
        return { type: 'token-overlay', intent, overlay, diff, proposalHash }
    }

    // NOT-CONNECTED seam: section ordering and accessibility analysis require
    // a gateway AI route (POST /v1/theme-ai/parse-brief) that does not yet exist.
    return {
        type: 'not-connected',
        seam: intent.type === 'section'
            ? 'Section ordering requires the gateway AI route (POST /v1/theme-ai/parse-brief)'
            : 'Accessibility analysis requires the gateway AI route (POST /v1/theme-ai/parse-brief)',
        envVar: MODEL_BOUNDARY.envVar,
        gatewayRoute: MODEL_BOUNDARY.gatewayRoute,
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function friendlyError(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        const rec = payload as Record<string, unknown>
        const errObj =
            rec.error && typeof rec.error === 'object' ? (rec.error as Record<string, unknown>) : null
        const msg =
            typeof rec.message === 'string' ? rec.message
            : typeof errObj?.message === 'string' ? errObj.message
            : null
        if (msg) return msg
    }
    return fallback
}

function formatTokenValue(v: unknown): string {
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    if (v === undefined || v === null) return '—'
    return JSON.stringify(v)
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AICustomizationPanelProps {
    /** Theme slug used in API paths (e.g. "letbuyy-core"). */
    themeSlug: string
    /** Resolved store ID (UUID). Used as the store_name query param for the proxy. */
    storeId: string
    /**
     * Current token values from settings_data.current of the merchant's draft.
     * Used to compute a delta diff (only changed keys shown in preview).
     * Optional — falls back to safe defaults when absent.
     */
    currentTokens?: Record<string, unknown>
    /**
     * Called after the draft is successfully updated with AI-proposed tokens.
     * The caller (editor) should reload the draft / refresh the preview.
     */
    onDraftApplied?: () => void
    /**
     * Base URL for same-origin API calls (default: '' = relative).
     * Override in tests / Storybook with a mock base.
     */
    apiBase?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * AICustomizationPanel
 *
 * Workflow:
 *   1. Merchant selects a structured suggestion chip (palette or typography).
 *   2. proposeThemeCustomization() computes the diff DETERMINISTICALLY (client-side).
 *   3. A preview table shows which token keys would change and their new values.
 *   4. Merchant clicks Apply → POST /api/themes/:slug/editor/ai-customization.
 *      The proxy saves the token overlay to the draft via merchantApiFetch.
 *   5. Merchant clicks Reject → discard proposal, return to idle.
 *
 * Free-text input is present but clearly labelled NOT-CONNECTED. It does not
 * trigger any computation — the model seam is not implemented locally.
 *
 * Section and accessibility chips are shown as NOT-CONNECTED; clicking them
 * surfaces an informational disclosure rather than a broken request.
 */
export default function AICustomizationPanel({
    themeSlug,
    storeId,
    currentTokens = {},
    onDraftApplied,
    apiBase = '',
}: AICustomizationPanelProps) {
    const { notify } = useToast()
    const diffTableId = useId()
    const freeTextId = useId()
    const panelLabelId = useId()

    const [panelState, setPanelState] = useState<AIPanelState>('idle')
    const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null)
    const [proposal, setProposal] = useState<AIProposal | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // ── canApply: gating (NO-AUTO-APPLY enforcement) ──────────────────────────
    //
    // Apply is only possible when:
    //  (a) proposal is not null (preview has been computed),
    //  (b) proposal.type is 'token-overlay' (not-connected cannot be applied),
    //  (c) panelState is 'preview' (never while computing/applying/applied).
    const canApply = Boolean(
        proposal !== null &&
        proposal.type === 'token-overlay' &&
        panelState === 'preview'
    )

    // ── Chip selection (synchronous computation — no network) ─────────────────

    const handleSelectIntent = useCallback((chipId: string, intent: AIIntent) => {
        if (panelState === 'computing' || panelState === 'applying') return

        setSelectedIntentId(chipId)
        setErrorMessage(null)
        setPanelState('computing')

        try {
            const result = proposeThemeCustomization(intent, currentTokens)
            setProposal(result)
            setPanelState('preview')
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not compute suggestion.'
            setErrorMessage(msg)
            setProposal(null)
            setPanelState('error')
        }
    }, [panelState, currentTokens])

    // ── Reject: discard proposal, return to idle ──────────────────────────────

    const handleReject = useCallback(() => {
        setProposal(null)
        setSelectedIntentId(null)
        setErrorMessage(null)
        setPanelState('idle')
    }, [])

    // ── Apply: POST proposal overlay to the same-origin proxy ────────────────

    const handleApply = useCallback(async () => {
        if (!canApply || proposal?.type !== 'token-overlay') return

        setPanelState('applying')
        setErrorMessage(null)

        try {
            const url =
                `${apiBase}/api/themes/${encodeURIComponent(themeSlug)}/editor/ai-customization` +
                `?store_name=${encodeURIComponent(storeId)}`

            const res = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intent: proposal.intent,
                    overlay: proposal.overlay,
                    proposalHash: proposal.proposalHash,
                }),
            })

            const payload = await res.json().catch(() => null) as Record<string, unknown> | null

            if (!res.ok) {
                const msg = friendlyError(payload, 'Failed to apply suggestion. Try again.')
                setErrorMessage(msg)
                setPanelState('error')
                return
            }

            setPanelState('applied')
            notify({ title: 'Suggestion applied', description: 'Draft updated. Publish when ready.', variant: 'success' })
            onDraftApplied?.()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Apply request failed.'
            setErrorMessage(msg)
            setPanelState('error')
        }
    }, [canApply, proposal, apiBase, themeSlug, storeId, notify, onDraftApplied])

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <section
            role="region"
            aria-labelledby={panelLabelId}
            aria-label="AI theme suggestions"
            className="flex flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-5)]"
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-[var(--lb-space-2)]">
                <Sparkles
                    className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-primary)]"
                    aria-hidden="true"
                />
                <h2
                    id={panelLabelId}
                    className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]"
                >
                    AI suggestions
                </h2>
                {panelState === 'applied' && (
                    <Badge
                        label="Applied"
                        variant="success"
                        aria-label="AI suggestion applied to draft"
                    />
                )}
            </div>

            {/* ── Disclosure banner (always visible) ─────────────────────── */}
            <Banner variant="info" title="Deterministic suggestions only">
                <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Suggestions are computed deterministically — same input always gives the same result.
                    Free-text AI understanding is <strong>not yet connected</strong> (requires{' '}
                    <code className="font-mono text-[length:var(--lb-font-size-caption)]">{MODEL_BOUNDARY.envVar}</code>).
                </p>
            </Banner>

            {/* ── Error state ────────────────────────────────────────────── */}
            {errorMessage && (
                <Banner variant="critical" title="Suggestion error" aria-live="assertive">
                    <p className="m-0 text-[length:var(--lb-font-size-caption)]">{errorMessage}</p>
                </Banner>
            )}

            {/* ── Palette suggestion chips ────────────────────────────────── */}
            <div className="flex flex-col gap-[var(--lb-space-2)]">
                <div className="flex items-center gap-[var(--lb-space-1)]">
                    <Palette
                        className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]"
                        aria-hidden="true"
                    />
                    <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                        Palette
                    </span>
                </div>
                <div
                    role="group"
                    aria-label="Palette suggestions"
                    className="flex flex-wrap gap-[var(--lb-space-2)]"
                >
                    {PALETTE_CHIPS.map(chip => {
                        const isSelected = selectedIntentId === chip.id && proposal !== null
                        return (
                            <Button
                                unstyled
                                key={chip.id}
                                type="button"
                                onClick={() => handleSelectIntent(chip.id, { type: 'palette', variant: chip.variant })}
                                aria-pressed={isSelected}
                                aria-label={`Suggest ${chip.label} palette: ${chip.description}`}
                                disabled={panelState === 'applying'}
                                className={[
                                    'inline-flex items-center gap-[var(--lb-space-1)]',
                                    'rounded-[var(--lb-radius-md)]',
                                    'border px-[var(--lb-space-3)] py-[var(--lb-space-1)]',
                                    'text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)]',
                                    'transition-colors focus-visible:outline focus-visible:outline-2',
                                    'focus-visible:outline-[var(--lb-color-focus-ring)] focus-visible:outline-offset-2',
                                    'disabled:opacity-50 disabled:cursor-not-allowed',
                                    isSelected
                                        ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]'
                                        : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)]',
                                ].join(' ')}
                            >
                                {isSelected && (
                                    <Check
                                        className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                                        aria-hidden="true"
                                    />
                                )}
                                {chip.label}
                            </Button>
                        )
                    })}
                </div>
            </div>

            {/* ── Typography suggestion chips ─────────────────────────────── */}
            <div className="flex flex-col gap-[var(--lb-space-2)]">
                <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                    Typography
                </span>
                <div
                    role="group"
                    aria-label="Typography suggestions"
                    className="flex flex-wrap gap-[var(--lb-space-2)]"
                >
                    {TYPOGRAPHY_CHIPS.map(chip => {
                        const isSelected = selectedIntentId === chip.id && proposal !== null
                        return (
                            <Button
                                unstyled
                                key={chip.id}
                                type="button"
                                onClick={() => handleSelectIntent(chip.id, { type: 'typography', intent: chip.intent })}
                                aria-pressed={isSelected}
                                aria-label={`Suggest ${chip.label} typography: ${chip.description}`}
                                disabled={panelState === 'applying'}
                                className={[
                                    'inline-flex items-center gap-[var(--lb-space-1)]',
                                    'rounded-[var(--lb-radius-md)]',
                                    'border px-[var(--lb-space-3)] py-[var(--lb-space-1)]',
                                    'text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)]',
                                    'transition-colors focus-visible:outline focus-visible:outline-2',
                                    'focus-visible:outline-[var(--lb-color-focus-ring)] focus-visible:outline-offset-2',
                                    'disabled:opacity-50 disabled:cursor-not-allowed',
                                    isSelected
                                        ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]'
                                        : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-hovered)]',
                                ].join(' ')}
                            >
                                {isSelected && (
                                    <Check
                                        className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                                        aria-hidden="true"
                                    />
                                )}
                                {chip.label}
                            </Button>
                        )
                    })}
                </div>
            </div>

            {/* ── NOT-CONNECTED chips ─────────────────────────────────────── */}
            <div className="flex flex-col gap-[var(--lb-space-2)]">
                <div className="flex items-center gap-[var(--lb-space-1)]">
                    <Info
                        className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]"
                        aria-hidden="true"
                    />
                    <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                        Coming soon (requires gateway AI route)
                    </span>
                </div>
                <div
                    role="group"
                    aria-label="Not yet connected suggestions"
                    className="flex flex-wrap gap-[var(--lb-space-2)]"
                >
                    {NOT_CONNECTED_CHIPS.map(chip => (
                        <Button
                            unstyled
                            key={chip.id}
                            type="button"
                            onClick={() => handleSelectIntent(chip.id, chip.intent)}
                            aria-pressed={selectedIntentId === chip.id && proposal !== null}
                            aria-label={`${chip.label} (not yet connected — requires gateway AI route)`}
                            aria-describedby={`nc-${chip.id}-desc`}
                            className="inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lb-color-focus-ring)] focus-visible:outline-offset-2"
                        >
                            {chip.label}
                        </Button>
                    ))}
                    {NOT_CONNECTED_CHIPS.map(chip => (
                        <span
                            key={`nc-${chip.id}-desc`}
                            id={`nc-${chip.id}-desc`}
                            className="sr-only"
                        >
                            {chip.seam}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Free-text input (NOT-CONNECTED) ────────────────────────── */}
            <div className="flex flex-col gap-[var(--lb-space-2)]">
                <label
                    htmlFor={freeTextId}
                    className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]"
                >
                    Describe changes in your own words
                    <span className="ml-[var(--lb-space-1)] inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-[var(--lb-space-0-5)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                        Not yet connected
                    </span>
                </label>
                <Input
                    unstyled
                    id={freeTextId}
                    type="text"
                    disabled
                    placeholder="Free-text AI understanding is not yet connected"
                    aria-label="Free-text theme customization (AI understanding not yet connected — structured chips above are available)"
                    aria-disabled="true"
                    className="w-full rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-disabled)] placeholder:text-[color:var(--lb-color-text-disabled)] focus-visible:outline-none cursor-not-allowed"
                />
                <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Free-text understanding requires{' '}
                    <code className="font-mono">{MODEL_BOUNDARY.envVar}</code>.
                    Use the structured chips above for deterministic suggestions.
                </p>
            </div>

            {/* ── Loading skeleton (computing) ────────────────────────────── */}
            {panelState === 'computing' && (
                <div aria-busy="true" aria-label="Computing suggestion" className="flex flex-col gap-[var(--lb-space-2)]">
                    <Skeleton className="h-[var(--lb-size-6)] w-full" aria-hidden="true" />
                    <Skeleton className="h-[var(--lb-size-6)] w-4/5" aria-hidden="true" />
                </div>
            )}

            {/* ── NOT-CONNECTED proposal disclosure ──────────────────────── */}
            {proposal?.type === 'not-connected' && (
                <Banner variant="warning" title="Not yet connected" aria-live="polite">
                    <p className="m-0 text-[length:var(--lb-font-size-caption)]">
                        {proposal.seam}.
                        Set <code className="font-mono">{proposal.envVar}</code> and deploy the gateway route to enable this suggestion.
                    </p>
                </Banner>
            )}

            {/* ── Preview diff ────────────────────────────────────────────── */}
            {proposal?.type === 'token-overlay' && panelState !== 'idle' && (
                <div
                    role="region"
                    aria-label="Proposed changes preview"
                    className="flex flex-col gap-[var(--lb-space-3)]"
                >
                    <h3 className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        Proposed changes
                    </h3>
                    {proposal.diff.length === 0 ? (
                        <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                            No token changes — current theme already matches this suggestion.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table
                                id={diffTableId}
                                aria-label="Token changes preview"
                                className="w-full border-collapse text-[length:var(--lb-font-size-caption)]"
                            >
                                <thead>
                                    <tr className="border-b border-[var(--lb-color-border)]">
                                        <th scope="col" className="py-[var(--lb-space-2)] pr-[var(--lb-space-4)] text-left font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                                            Token
                                        </th>
                                        <th scope="col" className="py-[var(--lb-space-2)] pr-[var(--lb-space-4)] text-left font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                                            Current
                                        </th>
                                        <th scope="col" className="py-[var(--lb-space-2)] text-left font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                                            Proposed
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {proposal.diff.map(entry => (
                                        <tr
                                            key={entry.key}
                                            className="border-b border-[var(--lb-color-border)] last:border-b-0"
                                        >
                                            <td className="py-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-mono text-[color:var(--lb-color-text)]">
                                                {entry.key}
                                            </td>
                                            <td className="py-[var(--lb-space-2)] pr-[var(--lb-space-4)]">
                                                <span className="inline-flex items-center gap-[var(--lb-space-1)] font-mono text-[color:var(--lb-color-text-subdued)]">
                                                    {typeof entry.previousValue === 'string' && /^#[0-9A-Fa-f]{6}$/.test(entry.previousValue) && (
                                                        <span
                                                            aria-hidden="true"
                                                            style={{ background: entry.previousValue }}
                                                            className="inline-block h-[var(--lb-size-4)] w-[var(--lb-size-4)] rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)]"
                                                        />
                                                    )}
                                                    {formatTokenValue(entry.previousValue)}
                                                </span>
                                            </td>
                                            <td className="py-[var(--lb-space-2)]">
                                                <span className="inline-flex items-center gap-[var(--lb-space-1)] font-mono text-[color:var(--lb-color-primary)]">
                                                    {typeof entry.newValue === 'string' && /^#[0-9A-Fa-f]{6}$/.test(entry.newValue) && (
                                                        <span
                                                            aria-hidden="true"
                                                            style={{ background: entry.newValue }}
                                                            className="inline-block h-[var(--lb-size-4)] w-[var(--lb-size-4)] rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)]"
                                                        />
                                                    )}
                                                    {formatTokenValue(entry.newValue)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* ── Apply / Reject actions ──────────────────────────── */}
                    {panelState !== 'applied' && (
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button
                                type="button"
                                onClick={handleApply}
                                disabled={!canApply || panelState === 'applying'}
                                aria-disabled={!canApply || panelState === 'applying'}
                                aria-label="Apply AI suggestion to draft (requires review first)"
                                aria-busy={panelState === 'applying'}
                            >
                                {panelState === 'applying' ? 'Applying…' : 'Apply to draft'}
                            </Button>
                            <Button
                                type="button"
                                unstyled
                                onClick={handleReject}
                                disabled={panelState === 'applying'}
                                aria-label="Reject AI suggestion and discard preview"
                                className="inline-flex h-[var(--lb-size-control)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-hovered)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lb-color-focus-ring)] disabled:opacity-50"
                            >
                                <X
                                    className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                                    aria-hidden="true"
                                />
                                Reject
                            </Button>
                        </div>
                    )}

                    {/* ── Applied success state ────────────────────────────── */}
                    {panelState === 'applied' && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-success)]"
                        >
                            <Check
                                className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                                aria-hidden="true"
                            />
                            Applied to draft. Publish when ready.
                        </div>
                    )}
                </div>
            )}

            {/* ── RISK-DUAL-N01 note (developer reference only) ─────────────
                AI Apply mutates only settings_data.current (token overlay).
                section_definitions / block_definitions / layout / locales /
                renderer are NEVER touched by any code path in this component.
                The proxy route forwards to applyExperienceToDocument in
                STYLE_ONLY mode exclusively for palette/typography intents.
            */}
        </section>
    )
}
