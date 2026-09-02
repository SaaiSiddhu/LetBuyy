'use client'

/**
 * AppBlockSlotPanel — Phase Y app-block slot editor for the theme editor.
 *
 * Renders within an app-block-slot section. Lists installed app block extensions
 * (fetched via the same-origin /api/stores/{storeName}/themes/app-blocks proxy)
 * and lets the merchant:
 *   - Add an app block to the slot (sets block settings: extension_id, app_id, etc.)
 *   - Configure the block's settings (title, slot identifier)
 *   - Remove the block from the slot
 *   - Reorder blocks within the slot
 *
 * NOT-CONNECTED: When the proxy returns not_connected: true (gateway route
 * GET /themes/app-blocks not yet deployed), shows an honest NOT-CONNECTED
 * badge alongside the empty state so the merchant knows no apps have been
 * installed yet (and the live source is not connected). No fabricated content.
 * Missing piece: gateway route GET /themes/app-blocks.
 *
 * RISK-DUAL-N01: every mutation goes through onAddBlock / onUpdateBlockSettings /
 * onRemoveBlock / onMoveBlock callbacks. This component never reads or writes
 * section_definitions or block_definitions. It only operates on block instances
 * within the section.
 *
 * SANDBOX LAW: this component never injects raw app HTML into the DOM.
 * App-provided block HTML is rendered at storefront time through the locked
 * DOMPurify sanitizer (resolveLiquidAppBlockHtml / sanitizeRenderedHtml).
 * No innerHTML assignment is performed here.
 *
 * ISOLATION: each app block is scoped to (site + installed app). The extension_id
 * returned by the proxy comes from app_extension_registrations.id (site-scoped).
 * Cross-tenant extension IDs are impossible — resolveOwnedStoreId enforces tenancy.
 *
 * Design: @letbuyy/ui + --lb-* tokens; mobile-first (~360px); keyboard a11y.
 * ART-17: no new React-per-section; this panel is editor chrome, not a section renderer.
 */

import { useState, useEffect, useId, useCallback } from 'react'
import { Button, Input, MaterialIcon } from '@letbuyy/ui'
import { ChevronUp, ChevronDown, Plus, Trash2, Settings, X } from 'lucide-react'
import type { BlockEntry } from './SectionTreePanel'
import styles from './controls/controls.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>

/**
 * InstalledAppExtension — a theme.app_block extension from the gateway registry.
 * Returned by GET /api/stores/{store}/themes/app-blocks.
 *
 * extension_id is the app-block's identity (maps to block.settings.extension_id).
 * Never used as a block type override — block type stays '@app' or 'app:{ext}'.
 */
type InstalledAppExtension = {
    id: string               // extension_id (app_extension_registrations.id)
    app_id: string
    extension_handle: string
    title: string            // display name shown in the editor
    slot?: string            // preferred slot (e.g. storefront.home.after-hero)
    render_mode?: string     // 'inline' | 'iframe'
}

type AppsResponse = {
    data: InstalledAppExtension[]
    not_connected: boolean
}

type FetchState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'loaded'; extensions: InstalledAppExtension[]; not_connected: boolean }

type AppBlockSlotPanelProps = {
    storeName: string
    sectionId: string
    /**
     * The app-block-slot section instance.
     * section.blocks contains app block instances (type '@app' or 'app:*').
     */
    section: {
        id: string
        type: string
        blocks: BlockEntry[]
        settings: JsonRecord
    }
    /**
     * Add a new app block to the slot.
     * blockType must be '@app' (per isLiquidAppBlockType contract).
     * settings carries extension_id, app_id, extension_handle, slot, title.
     *
     * RISK-DUAL-N01: mutates the template instance block list only.
     * Never passes a type that would override block_definitions.
     */
    onAddBlock: (sectionId: string, blockType: string, settings: JsonRecord) => void
    /**
     * Update settings on an existing block instance.
     * RISK-DUAL-N01: mutates block instance settings only, never block_definitions.
     */
    onUpdateBlockSettings: (sectionId: string, blockId: string, settings: JsonRecord) => void
    /**
     * Remove a block instance from the slot.
     * RISK-DUAL-N01: removes instance, never touches block_definitions.
     */
    onRemoveBlock: (sectionId: string, blockId: string) => void
    /**
     * Reorder a block instance within the slot.
     * RISK-DUAL-N01: reorders instances only.
     */
    onMoveBlock: (sectionId: string, blockId: string, direction: -1 | 1) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true for app block entry types: '@app' or 'app:*'.
 * Mirrors isLiquidAppBlockType from packages/theme-engine/src/theme-bundle.ts.
 */
function isAppBlockEntry(block: BlockEntry): boolean {
    return block.type === '@app' || block.type.startsWith('app:')
}

/**
 * Extracts a display label from a block instance's settings.
 * Falls back to the extension_handle or block id.
 */
function blockDisplayLabel(block: BlockEntry): string {
    const settings = block.settings
    if (typeof settings.title === 'string' && settings.title.trim()) return settings.title.trim()
    if (typeof settings.extension_handle === 'string' && settings.extension_handle.trim()) {
        return settings.extension_handle.trim()
    }
    return `App block (${block.id.slice(0, 8)})`
}

/**
 * Returns the extension_id stored in block settings, or null if absent.
 */
function blockExtensionId(block: BlockEntry): string | null {
    const ext = block.settings.extension_id
    return typeof ext === 'string' && ext.trim() ? ext.trim() : null
}

// ── Sub-components ────────────────────────────────────────────────────────────

type BlockSettingsFormProps = {
    block: BlockEntry
    sectionId: string
    onUpdateBlockSettings: (sectionId: string, blockId: string, settings: JsonRecord) => void
    onClose: () => void
}

/**
 * Inline settings form for an app block instance.
 * Allows editing the block's `title` and `slot` settings.
 *
 * RISK-DUAL-N01: onChange writes to block instance settings only, never to
 * section_definitions or block_definitions.
 *
 * Reuses SchemaFormRenderer-compatible style (te-field* classes) for consistency.
 * A full SchemaFormRenderer-based form requires the extension's settings schema,
 * which is not yet available without a live app runtime (NOT-CONNECTED for schema).
 */
function BlockSettingsForm({ block, sectionId, onUpdateBlockSettings, onClose }: BlockSettingsFormProps) {
    const [title, setTitle] = useState<string>(
        typeof block.settings.title === 'string' ? block.settings.title : ''
    )
    const [slot, setSlot] = useState<string>(
        typeof block.settings.slot === 'string' ? block.settings.slot : 'storefront.home.after-hero'
    )
    const titleId = useId()
    const slotId = useId()

    const handleSave = useCallback(() => {
        // RISK-DUAL-N01: update only the instance settings, never block_definitions
        onUpdateBlockSettings(sectionId, block.id, {
            ...block.settings,
            title: title.trim(),
            slot: slot.trim(),
        })
        onClose()
    }, [sectionId, block.id, block.settings, title, slot, onUpdateBlockSettings, onClose])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
    }

    return (
        <div
            className={styles.appBlockSettingsForm}
            role="group"
            aria-label="App block settings"
            onKeyDown={handleKeyDown}
        >
            <div className="te-field">
                <label className="te-field__label" htmlFor={titleId}>Display title</label>
                <Input
                    unstyled
                    id={titleId}
                    type="text"
                    className="te-field__input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Featured reviews"
                    maxLength={120}
                    autoComplete="off"
                />
            </div>
            <div className="te-field" style={{ marginTop: 'var(--lb-space-2, 8px)' }}>
                <label className="te-field__label" htmlFor={slotId}>Slot identifier</label>
                <Input
                    unstyled
                    id={slotId}
                    type="text"
                    className="te-field__input"
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                    placeholder="storefront.home.after-hero"
                    maxLength={160}
                    autoComplete="off"
                />
                <p className={styles.disclaimerNote}>
                    Slot identifier used in the storefront template.
                </p>
            </div>
            <div
                className={styles.appBlockSettingsActions}
                style={{ marginTop: 'var(--lb-space-3, 12px)', display: 'flex', gap: 'var(--lb-space-2, 8px)' }}
            >
                <Button
                    unstyled
                    type="button"
                    className={styles.appBlockSaveBtn}
                    onClick={handleSave}
                    aria-label="Save app block settings"
                >
                    Save
                </Button>
                <Button
                    unstyled
                    type="button"
                    className={styles.appBlockCancelBtn}
                    onClick={onClose}
                    aria-label="Cancel app block settings"
                >
                    Cancel
                </Button>
            </div>
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AppBlockSlotPanel({
    storeName,
    sectionId,
    section,
    onAddBlock,
    onUpdateBlockSettings,
    onRemoveBlock,
    onMoveBlock,
}: AppBlockSlotPanelProps) {
    const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
    const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
    const [selectedExtensionId, setSelectedExtensionId] = useState<string>('')
    const selectId = useId()

    // ── Fetch installed app extensions ────────────────────────────────────────
    // Raw fetch to same-origin proxy (no @letbuyy/api-client edit)
    useEffect(() => {
        if (!storeName) return
        setFetchState({ status: 'loading' })

        // NOT-CONNECTED: /api/stores/{store}/themes/app-blocks forwards to
        // gateway GET /themes/app-blocks. If gateway 404, proxy returns
        // { data: [], not_connected: true }.
        fetch(`/api/stores/${encodeURIComponent(storeName)}/themes/app-blocks`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(`Fetch failed: ${res.status}`)
                }
                return res.json() as Promise<AppsResponse>
            })
            .then((body) => {
                setFetchState({
                    status: 'loaded',
                    extensions: Array.isArray(body.data) ? body.data : [],
                    not_connected: Boolean(body.not_connected),
                })
            })
            .catch((err: unknown) => {
                setFetchState({
                    status: 'error',
                    message: err instanceof Error ? err.message : 'Failed to load installed apps',
                })
            })
    }, [storeName])

    // ── Derived state ─────────────────────────────────────────────────────────
    // Only app block entries (type '@app' or 'app:*') in the slot
    const appBlocks = section.blocks.filter(isAppBlockEntry)

    // IDs already placed in the slot (to avoid duplicates in the add picker)
    const placedExtensionIds = new Set(
        appBlocks.map((b) => blockExtensionId(b)).filter((id): id is string => id !== null)
    )

    // Available extensions to add (not yet placed)
    const availableExtensions = fetchState.status === 'loaded'
        ? fetchState.extensions.filter((ext) => !placedExtensionIds.has(ext.id))
        : []

    // ── Add block ─────────────────────────────────────────────────────────────
    const handleAddBlock = useCallback(() => {
        if (!selectedExtensionId) return
        const ext = availableExtensions.find((e) => e.id === selectedExtensionId)
        if (!ext) return

        // blockType = '@app' — the extension identity lives in settings (extension_id).
        // Never use a block type override: the type stays '@app' per
        // isLiquidAppBlockType and the RISK-DUAL-N01 isolation contract.
        // RISK-DUAL-N01: onAddBlock mutates the template instance only.
        onAddBlock(sectionId, '@app', {
            extension_id: ext.id,
            app_id: ext.app_id,
            extension_handle: ext.extension_handle,
            slot: ext.slot ?? section.settings.slot ?? 'storefront.home.after-hero',
            title: ext.title,
            render_mode: ext.render_mode ?? 'inline',
        })
        setSelectedExtensionId('')
    }, [selectedExtensionId, availableExtensions, sectionId, section.settings.slot, onAddBlock])

    // ── Render ────────────────────────────────────────────────────────────────

    // Loading state
    if (fetchState.status === 'loading' || fetchState.status === 'idle') {
        return (
            <div className={styles.appBlockSlotWrapper} aria-label="App block slot" aria-busy="true">
                <div className={styles.appBlockLoading} role="status" aria-label="Loading installed apps">
                    <MaterialIcon name="hourglass_empty" size={16} aria-hidden="true" />
                    <span>Loading installed apps&hellip;</span>
                </div>
            </div>
        )
    }

    // Error state
    if (fetchState.status === 'error') {
        return (
            <div className={styles.appBlockSlotWrapper} aria-label="App block slot">
                <div className={styles.appBlockError} role="alert">
                    <MaterialIcon name="error_outline" size={16} aria-hidden="true" />
                    <span>Failed to load apps. {fetchState.message}</span>
                </div>
            </div>
        )
    }

    // Loaded state (not_connected may be true)
    const { extensions, not_connected } = fetchState

    return (
        <div className={styles.appBlockSlotWrapper} aria-label="App block slot">
            {/* NOT-CONNECTED banner */}
            {not_connected && (
                <div className={styles.appBlockNotConnected} role="status" aria-live="polite">
                    <span className={styles.notConnectedBadge}>NOT-CONNECTED</span>
                    <span>
                        No apps installed. The app extensions service is not yet connected.
                        Missing: gateway route GET /themes/app-blocks.
                    </span>
                </div>
            )}

            {/* Empty state — no app blocks in the slot yet */}
            {appBlocks.length === 0 && !not_connected && (
                <div className={styles.appBlockEmpty} role="status">
                    <MaterialIcon name="extension_off" size={20} aria-hidden="true" />
                    <p>No app blocks in this slot.</p>
                    {extensions.length === 0 && (
                        <p className={styles.disclaimerNote}>No apps installed for this store.</p>
                    )}
                </div>
            )}

            {/* Existing app block instances */}
            {appBlocks.length > 0 && (
                <ul className={styles.appBlockList} aria-label="App blocks in slot" role="list">
                    {appBlocks.map((block, index) => {
                        const label = blockDisplayLabel(block)
                        const isExpanded = expandedBlockId === block.id
                        const canMoveUp = index > 0
                        const canMoveDown = index < appBlocks.length - 1

                        return (
                            <li
                                key={block.id}
                                className={[
                                    styles.appBlockItem,
                                    isExpanded ? styles.appBlockItemSelected : '',
                                ].filter(Boolean).join(' ')}
                                aria-label={`App block: ${label}`}
                            >
                                <div className={styles.appBlockItemHeader}>
                                    <span className={styles.appBlockItemIcon} aria-hidden="true">
                                        <MaterialIcon name="extension" size={14} />
                                    </span>
                                    <span className={styles.appBlockItemLabel}>{label}</span>
                                    <div className={styles.appBlockItemActions}>
                                        {/* Configure settings */}
                                        <Button
                                            unstyled
                                            type="button"
                                            aria-label={`Configure settings for ${label}`}
                                            aria-expanded={isExpanded}
                                            tabIndex={0}
                                            onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                                        >
                                            {isExpanded
                                                ? <X size={13} aria-hidden="true" />
                                                : <Settings size={13} aria-hidden="true" />
                                            }
                                        </Button>
                                        {/* Move up */}
                                        <Button
                                            unstyled
                                            type="button"
                                            aria-label={`Move ${label} up`}
                                            tabIndex={0}
                                            disabled={!canMoveUp}
                                            onClick={() => {
                                                // RISK-DUAL-N01: onMoveBlock mutates instance order only
                                                onMoveBlock(sectionId, block.id, -1)
                                            }}
                                        >
                                            <ChevronUp size={13} aria-hidden="true" />
                                        </Button>
                                        {/* Move down */}
                                        <Button
                                            unstyled
                                            type="button"
                                            aria-label={`Move ${label} down`}
                                            tabIndex={0}
                                            disabled={!canMoveDown}
                                            onClick={() => {
                                                // RISK-DUAL-N01: onMoveBlock mutates instance order only
                                                onMoveBlock(sectionId, block.id, 1)
                                            }}
                                        >
                                            <ChevronDown size={13} aria-hidden="true" />
                                        </Button>
                                        {/* Remove */}
                                        <Button
                                            unstyled
                                            type="button"
                                            aria-label={`Remove ${label} from slot`}
                                            tabIndex={0}
                                            onClick={() => {
                                                // RISK-DUAL-N01: onRemoveBlock removes instance only
                                                setExpandedBlockId(null)
                                                onRemoveBlock(sectionId, block.id)
                                            }}
                                        >
                                            <Trash2 size={13} aria-hidden="true" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Inline settings form (expanded state) */}
                                {isExpanded && (
                                    <BlockSettingsForm
                                        block={block}
                                        sectionId={sectionId}
                                        onUpdateBlockSettings={onUpdateBlockSettings}
                                        onClose={() => setExpandedBlockId(null)}
                                    />
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            {/* Add app block affordance */}
            {availableExtensions.length > 0 && (
                <div className={styles.appBlockAddSection} aria-label="Add app block">
                    <label htmlFor={selectId} className={styles.appBlockAddLabel}>
                        Add app block
                    </label>
                    <div className={styles.appBlockAddRow}>
                        <select
                            id={selectId}
                            className={styles.appBlockSelect}
                            value={selectedExtensionId}
                            onChange={(e) => setSelectedExtensionId(e.target.value)}
                            aria-label="Select app extension to add"
                        >
                            <option value="">Select an app&hellip;</option>
                            {availableExtensions.map((ext) => (
                                <option key={ext.id} value={ext.id}>
                                    {ext.title}
                                </option>
                            ))}
                        </select>
                        <Button
                            unstyled
                            type="button"
                            className={styles.appBlockAddBtn}
                            disabled={!selectedExtensionId}
                            onClick={handleAddBlock}
                            aria-label="Add selected app block to slot"
                        >
                            <Plus size={13} aria-hidden="true" />
                            Add
                        </Button>
                    </div>
                    <p className={styles.disclaimerNote}>
                        App blocks render in the storefront slot via the LetBuyy sanitizer.
                        Content is sandboxed and scoped to this store only.
                    </p>
                </div>
            )}

            {/* Loaded, no available extensions to add and some already placed */}
            {!not_connected && extensions.length > 0 && availableExtensions.length === 0 && appBlocks.length > 0 && (
                <p className={styles.disclaimerNote} style={{ marginTop: 'var(--lb-space-2, 8px)' }}>
                    All installed app blocks are already in this slot.
                </p>
            )}
        </div>
    )
}
