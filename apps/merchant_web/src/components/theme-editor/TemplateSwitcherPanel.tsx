'use client'

/**
 * TemplateSwitcherPanel — Phase V editor shell.
 *
 * Presents the full list of available store templates (from the TEMPLATE_TYPE_REGISTRY
 * via caller-supplied props) and any named alternate variants for the currently-selected
 * base template type.  Lets the merchant switch which template is being edited in the
 * theme editor.
 *
 * RISK-DUAL-N01 contract (strictly enforced, matching ThemeDocument V2 invariant):
 *   • onChange emits ONLY a template key string.
 *   • onCreateAlternate emits ONLY the base-type string — it is a *signal of intent*.
 *     The actual ThemeDocumentTemplate instance creation is handled in the editor's
 *     existing draft path, never here.  This component NEVER touches section_definitions
 *     or block_definitions — those are READ-ONLY type catalogs (RISK-DUAL-N01).
 *
 * Design rules:
 *   • @letbuyy/ui components only (Select, Button, SelectOption).
 *   • --lb-* design tokens only — no raw px, hex, or rounded-[...px] classes.
 *   • Mobile-first 360px layout.
 *   • Handles loading / empty / error / disabled states.
 *   • Slash-containing keys (e.g. 'customers/login') are passed through without
 *     transformation: they are used directly as HTML <option value="..."> values.
 *     The browser handles any string value correctly; no encoding/escaping is applied.
 *   • Keyboard accessible: alternate-variant list uses role="listbox" + role="option"
 *     + aria-selected + tabIndex + Enter/Space key handler.
 *   • No import from page.tsx or globals.css.
 *   • No direct DB / gateway / Supabase calls.
 *
 * Integration note:
 *   The editor wiring (mounting this component inside page.tsx and binding onChange
 *   to the template-selection state) rides as WIP alongside the foreign page.tsx edits,
 *   identical in pattern to Phase R (ConflictDialog / SectionTreePanel). The component
 *   is standalone and testable without page.tsx.
 */

import { useCallback, useId } from 'react'
import { Select, Button, type SelectOption } from '@letbuyy/ui'
import { Plus } from 'lucide-react'

// ── Public types ──────────────────────────────────────────────────────────────

/** One template option surfaced to the switcher's main <select>. */
export interface TemplateSwitcherOption {
    /** The canonical template key (may contain '/', e.g. 'customers/login'). */
    key: string
    /** Human-readable label shown in the <select> (e.g. 'Login page'). */
    label: string
    /**
     * Base template type from the TEMPLATE_TYPE_REGISTRY
     * (e.g. 'customers/login', 'product', 'index').
     * Used by the caller to group or filter options; not rendered directly.
     */
    type: string
}

/** A named alternate variant for a given base template type. */
export interface TemplateSwitcherVariant {
    /**
     * Full alternate template key, e.g. 'product.custom', 'page.contact'.
     * May contain a '.' suffix; never contains '..' or leading '/'.
     */
    key: string
    /** Human-readable label, e.g. 'Custom product (custom)'. */
    label: string
}

export interface TemplateSwitcherPanelProps {
    /** All available template options (base types + any already-existing alternates). */
    templateOptions: TemplateSwitcherOption[]
    /** The currently-selected template key. */
    selectedKey: string
    /**
     * Called when the merchant selects a different template key.
     *
     * Emits ONLY the key string — NEVER mutates section_definitions or block_definitions.
     * RISK-DUAL-N01: the calling editor writes the new selectedKey into its own state
     * and re-renders; no document-level write occurs here.
     */
    onChange: (key: string) => void
    /**
     * When true the switcher is non-interactive (e.g. while an autosave is in flight
     * or the editor draft is loading).
     */
    disabled?: boolean
    /**
     * Named alternate variants for the currently-selected base template type.
     * When provided and non-empty, they are shown as a keyboard-accessible variant list
     * below the main <select>.  An empty array hides the section.
     */
    alternateVariants?: TemplateSwitcherVariant[]
    /**
     * Called when the merchant clicks "New variant".
     *
     * Receives the BASE TYPE string (e.g. 'product') — this is an intent signal only.
     * The caller is responsible for prompting the merchant for a suffix name and then
     * creating the new ThemeDocumentTemplate instance via the existing draft path.
     * RISK-DUAL-N01: this handler MUST NOT write to section_definitions.
     *
     * When undefined the "New variant" affordance is not rendered.
     */
    onCreateAlternate?: (baseType: string) => void
    /** When true, shows a loading skeleton instead of the select. */
    loading?: boolean
    /** Error message shown below the switcher (e.g. 'Failed to load templates'). */
    error?: string
}

// ── Hook — useTemplateSwitcher ────────────────────────────────────────────────

/**
 * Splits a template key into its base type and optional suffix.
 *
 * Semantics mirror parseTemplateKey from the Lane-A template-registry:
 *   'product.custom'    → { baseType: 'product',        suffix: 'custom' }
 *   'index'             → { baseType: 'index',          suffix: null     }
 *   'customers/login'   → { baseType: 'customers/login', suffix: null    }
 *   'not_found'         → { baseType: 'not_found',      suffix: null     }
 *   'page.contact'      → { baseType: 'page',           suffix: 'contact'}
 *
 * The separator is '.' (dot) — '/' (slash) is part of the base type for
 * customer-facing template keys such as 'customers/login'.
 *
 * Pure + deterministic; no side-effects; no I/O; no document mutation.
 *
 * @note The `use*` prefix follows React hook naming convention intentionally.
 * This allows the function to be promoted to a full hook (calling useState /
 * useEffect) in a future phase without a rename or API break. It contains no
 * hook calls and is safe to invoke conditionally or outside React component
 * bodies. ESLint react-hooks/rules-of-hooks callers should suppress if needed,
 * or wait for the hook promotion to land.
 */
export function useTemplateSwitcher(selectedKey: string): { baseType: string; suffix: string | null } {
    const dotIdx = selectedKey.indexOf('.')
    if (dotIdx === -1) {
        return { baseType: selectedKey, suffix: null }
    }
    const suffix = selectedKey.slice(dotIdx + 1) || null
    return { baseType: selectedKey.slice(0, dotIdx), suffix }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Convert TemplateSwitcherOption[] to the SelectOption[] shape expected by @letbuyy/ui. */
function toSelectOptions(opts: TemplateSwitcherOption[]): SelectOption[] {
    return opts.map((opt) => ({
        // value is the raw key string — slash-containing keys are passed through as-is.
        value: opt.key,
        label: opt.label,
    }))
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * TemplateSwitcherPanel
 *
 * Standalone component — does not import from page.tsx, globals.css, or any
 * gateway/DB layer. Mount it in the editor and bind onChange/onCreateAlternate.
 */
export default function TemplateSwitcherPanel({
    templateOptions,
    selectedKey,
    onChange,
    disabled = false,
    alternateVariants,
    onCreateAlternate,
    loading = false,
    error,
}: TemplateSwitcherPanelProps) {
    const panelId = useId()
    const { baseType } = useTemplateSwitcher(selectedKey)

    // Forward the native <select> change to the caller's onChange with only the key.
    const handleSelectChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            if (disabled) return
            // RISK-DUAL-N01: emit key string only — no document shape, no section_definitions.
            onChange(e.target.value)
        },
        [disabled, onChange],
    )

    const handleVariantClick = useCallback(
        (key: string) => {
            if (!disabled) {
                // RISK-DUAL-N01: emit key string only.
                onChange(key)
            }
        },
        [disabled, onChange],
    )

    // Signal create-alternate intent: sends baseType string to the caller.
    // The caller handles the actual ThemeDocumentTemplate creation via the draft path.
    // RISK-DUAL-N01: never mutates section_definitions.
    const handleCreateAlternate = useCallback(() => {
        if (!disabled) {
            onCreateAlternate?.(baseType)
        }
    }, [disabled, onCreateAlternate, baseType])

    // ── Loading skeleton ───────────────────────────────────────────────────

    if (loading) {
        return (
            <div
                id={panelId}
                className="flex flex-col gap-[var(--lb-space-3)] min-w-0 w-full"
                role="status"
                aria-busy="true"
                aria-label="Loading templates"
            >
                <div
                    className="h-[var(--lb-size-control-md)] w-full rounded-[var(--lb-radius-lg)] bg-[color:var(--lb-color-surface-hovered)] animate-pulse"
                    aria-hidden="true"
                />
            </div>
        )
    }

    // ── Empty state ────────────────────────────────────────────────────────

    if (templateOptions.length === 0) {
        return (
            <div
                id={panelId}
                className="flex flex-col gap-[var(--lb-space-2)] min-w-0 w-full"
                role="status"
                aria-label="No templates available"
            >
                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    No templates available
                </p>
            </div>
        )
    }

    const selectOptions = toSelectOptions(templateOptions)
    const hasVariants = Array.isArray(alternateVariants) && alternateVariants.length > 0

    return (
        <div
            id={panelId}
            className="flex flex-col gap-[var(--lb-space-3)] min-w-0 w-full"
        >
            {/* ── Primary template <select> ─────────────────────────────── */}
            <Select
                label="Template"
                options={selectOptions}
                value={selectedKey}
                onChange={handleSelectChange}
                disabled={disabled}
                error={error}
                controlSize="sm"
                aria-label="Select template"
            />

            {/* ── Alternate variants list ───────────────────────────────── */}
            {hasVariants && (
                <div
                    className="flex flex-col gap-[var(--lb-space-2)]"
                    aria-label="Alternate template variants"
                >
                    <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        Variants
                    </p>
                    {/*
                     * role="listbox" so that assistive technology announces it as a selection
                     * list, not a generic list.  Each option uses role="option" + aria-selected.
                     */}
                    <ul
                        role="listbox"
                        aria-label="Template variants"
                        aria-multiselectable="false"
                        className="m-0 list-none p-0 flex flex-col gap-[var(--lb-space-1)]"
                    >
                        {alternateVariants!.map((variant) => {
                            const isSelected = variant.key === selectedKey
                            return (
                                <li
                                    key={variant.key}
                                    role="option"
                                    aria-selected={isSelected}
                                    tabIndex={disabled ? -1 : 0}
                                    className={
                                        isSelected
                                            ? 'cursor-default rounded-[var(--lb-radius-md)] bg-[color:var(--lb-color-surface-selected)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]'
                                            : 'cursor-pointer rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)] hover:bg-[color:var(--lb-color-surface-hovered)]'
                                    }
                                    onClick={() => handleVariantClick(variant.key)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            handleVariantClick(variant.key)
                                        }
                                    }}
                                >
                                    {variant.label}
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            {/* ── Create-alternate affordance ───────────────────────────── */}
            {onCreateAlternate !== undefined && (
                /*
                 * Signals create-alternate *intent* to the caller (receives baseType string).
                 * RISK-DUAL-N01: the caller creates the ThemeDocumentTemplate instance via
                 * the existing draft path — this button NEVER writes to section_definitions.
                 */
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCreateAlternate}
                    disabled={disabled}
                    aria-label={`Create new variant for ${baseType} template`}
                    className="self-start"
                    type="button"
                >
                    <Plus
                        className="h-[var(--lb-size-icon-sm)] w-[var(--lb-size-icon-sm)] mr-[var(--lb-space-1)]"
                        aria-hidden="true"
                    />
                    New variant
                </Button>
            )}
        </div>
    )
}
