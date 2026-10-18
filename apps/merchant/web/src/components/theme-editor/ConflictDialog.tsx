'use client'

import { Button, ConfirmDialog } from '@letbuyy/ui'

export type ConflictSource = 'autosave' | 'manual-save'
export interface ConflictDialogProps {
    open: boolean
    source?: ConflictSource
    replacementVersion?: number | null
    busy?: boolean
    onReload: () => void
    onForce: () => void
    onDismiss: () => void
}

/** Review first, then explicitly replace one exact revision. Escape/cancel
 * retains local edits. Reload is a separate deliberate action; no save can
 * remove the canonical version guard. */
export default function ConflictDialog({ open, source = 'autosave', replacementVersion = null, busy = false, onReload, onForce, onDismiss }: ConflictDialogProps) {
    const description = replacementVersion === null
        ? `${source === 'autosave' ? 'Autosave stopped' : 'Save stopped'} because another session changed this draft. Review the latest saved version before choosing to replace it with your local edits.`
        : `The server is at draft version ${replacementVersion}. Confirm replacement with your local edits. Any later save from another session will stop this replacement.`
    return (
        <ConfirmDialog
            open={open}
            title="Draft conflict"
            description={description}
            confirmLabel={busy ? 'Checking draft…' : replacementVersion === null ? 'Review latest version' : `Replace version ${replacementVersion}`}
            cancelLabel="Keep editing locally"
            destructive={replacementVersion !== null}
            onConfirm={() => { if (!busy) onForce() }}
            onClose={onDismiss}
        >
            <div aria-busy={busy}>
                <p className="theme-os-muted" role="status" aria-live="polite">Your local edits are retained until you explicitly reload or complete a replacement.</p>
                <Button type="button" variant="secondary" disabled={busy} onClick={onReload}>Reload latest and discard local edits</Button>
            </div>
        </ConfirmDialog>
    )
}
