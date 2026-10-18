'use client'

/**
 * ConflictDialog — Phase R editor shell.
 *
 * Surfaces a clear reload/merge prompt when the draft CAS route returns HTTP 409
 * (code: 'CONFLICT'), meaning another session saved a newer base_version.
 * Never performs a silent overwrite — the merchant must explicitly choose.
 *
 * Two paths:
 *   • Reload from server — discard local changes, fetch the latest server draft.
 *   • Keep my changes  — force-save without a base_version, overwriting the server draft.
 *
 * Wraps @letbuyy/ui ConfirmDialog. No new CSS classes — uses existing theme-os-* tokens.
 */

import { ConfirmDialog } from '@letbuyy/ui'

export type ConflictSource = 'autosave' | 'manual-save'

export interface ConflictDialogProps {
    open: boolean
    /** Where the CONFLICT was detected: background autosave vs explicit manual save. */
    source?: ConflictSource
    /** Reload from server — clears local state and re-fetches the editor. */
    onReload: () => void
    /** Keep my changes — force-saves without a base_version, overwriting the server draft. */
    onForce: () => void
}

const DESCRIPTIONS: Record<ConflictSource, string> = {
    'autosave': (
        'Another session has saved a newer version of this draft. ' +
        'Reload to get the latest changes, or keep your local edits and overwrite the server draft.'
    ),
    'manual-save': (
        'A version CONFLICT was detected — the server draft is newer than expected. ' +
        'Reload from the server to preserve the latest changes, or force-save to overwrite it with your edits.'
    ),
}

/**
 * Rendered when a draft PUT returns HTTP 409 with error code 'CONFLICT'.
 *
 * Safe light-dismiss contract (Escape / backdrop-click):
 *   → triggers onReload ("Reload from server") — the safe, non-destructive default.
 *
 * Explicit destructive action:
 *   → "Keep my changes" is the primary confirm button, mapped to onForce.
 *   → Force-save only executes when the merchant clicks the button intentionally.
 *
 * Mapping: onConfirm={onForce}, onClose={onReload}
 * This ensures Escape/outside-click always resolves to the safe path (reload),
 * and overwriting the server draft requires a deliberate button click.
 */
export default function ConflictDialog({ open, source = 'autosave', onReload, onForce }: ConflictDialogProps) {
    return (
        <ConfirmDialog
            open={open}
            title="Draft conflict"
            description={DESCRIPTIONS[source]}
            confirmLabel="Keep my changes"
            cancelLabel="Reload from server"
            onConfirm={onForce}
            onClose={onReload}
        />
    )
}
