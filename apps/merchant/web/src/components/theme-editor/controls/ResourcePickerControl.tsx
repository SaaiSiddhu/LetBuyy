'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

/**
 * ResourcePickerControl.tsx — Phase W: Searchable resource combobox.
 *
 * Replaces the Phase U id-entry with a live searchable combobox that queries
 * /api/stores/[store]/resource-search (same-origin proxy → gateway).
 *
 * Supports field types: product | collection | blog | page | menu.
 *
 * ARIA pattern (WAI-ARIA 1.2 combobox):
 *   - Search input:  role="combobox", aria-autocomplete="list", aria-expanded,
 *                    aria-controls=listboxId, aria-activedescendant
 *   - Dropdown:      role="listbox", aria-label
 *   - Options:       role="option", aria-selected
 *
 * States:
 *   - idle        — no search term; shows placeholder or selected chip
 *   - loading     — request in-flight after debounce fires
 *   - results     — items returned from gateway
 *   - no-results  — query returned empty array
 *   - error       — gateway/network error
 *
 * NOT-CONNECTED fallback: when storeName is not provided the component falls
 * back to the Phase U id-entry mode with a NOT-CONNECTED badge. This keeps
 * the Phase U contract intact and allows the editor to degrade gracefully when
 * the store context is unavailable.
 *
 * RISK-DUAL-N01: onChange emits the resource id string only; never touches
 *   section_definitions or the schema object.
 *
 * Design ratchet:
 *   - Imports from @letbuyy/ui (Input, Button, MaterialIcon)
 *   - Uses --lb-* design tokens via controls.module.css
 *   - No raw rounded-[Npx] Tailwind classes
 *   - No unsafe innerHTML injection (sanitiser law)
 *   - No import from page.tsx, layout CSS, direct DB clients, or api-client
 */

import { useId, useState, useEffect, useCallback, useRef } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue } from '@/lib/theme-schemas'
import { Button, Input, MaterialIcon } from '@letbuyy/ui'
import styles from './controls.module.css'

/* ── Types ──────────────────────────────────────────────────────────────── */

interface ResourceItem {
    id: string
    title: string
    handle?: string
    slug?: string
}

type SearchState = 'idle' | 'loading' | 'results' | 'no-results' | 'error'

const RESOURCE_LABELS: Record<string, string> = {
    product: 'Product',
    collection: 'Collection',
    blog: 'Blog post',
    page: 'Page',
    menu: 'Navigation menu',
}

/* ── Props ───────────────────────────────────────────────────────────────── */

interface ResourcePickerControlProps {
    field: ExtendedSchemaField
    /** The stored resource identifier (id or handle). */
    value: string
    /** RISK-DUAL-N01: emits the selected resource id; never mutates the schema. */
    onChange: (v: string) => void
    /**
     * Store handle / slug used to build the same-origin proxy URL.
     * Required for live search. Omit to fall back to Phase U id-entry mode
     * (shows NOT-CONNECTED badge).
     */
    storeName?: string
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function ResourcePickerControl({
    field,
    value,
    onChange,
    storeName,
}: ResourcePickerControlProps) {
    const inputId = useId()
    const listboxId = `${inputId}-listbox`
    const error = validateFieldValue(field, value)
    const helpText = field.info || field.description
    const resourceLabel = RESOURCE_LABELS[field.type] ?? field.type

    // ── Not-connected fallback ────────────────────────────────────────────
    // When storeName is not provided, fall back to Phase U id-entry mode with
    // a NOT-CONNECTED badge. This is the graceful-degradation contract.
    if (!storeName) {
        return (
            <div className="te-field">
                <label htmlFor={inputId} className="te-field-label">
                    {field.label}
                    {field.required ? (
                        <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
                    ) : null}
                </label>
                <div className={styles.resourcePickerWrapper}>
                    <span className={styles.resourceTypeHint}>
                        <MaterialIcon name="category" size={11} aria-hidden />
                        {' '}{resourceLabel} ID or handle
                    </span>
                    <Input
                        unstyled
                        id={inputId}
                        type="text"
                        className="te-field-input"
                        value={value}
                        placeholder={`Enter ${resourceLabel.toLowerCase()} ID or handle…`}
                        onChange={(e) => onChange(e.target.value)}
                        aria-required={field.required ? 'true' : undefined}
                        aria-invalid={error ? 'true' : undefined}
                    />
                    {/* NOT-CONNECTED badge — storeName is required for live search */}
                    <span className={styles.notConnectedBadge} aria-live="polite">
                        <MaterialIcon name="cloud_off" size={12} aria-hidden />
                        NOT-CONNECTED — store context required for live search
                    </span>
                </div>
                {error ? (
                    <p className={styles.fieldError} role="alert">
                        <MaterialIcon name="error" size={12} aria-hidden />
                        {' '}{error}
                    </p>
                ) : null}
                {helpText ? <span className="generic-theme-editor__field-help">{helpText}</span> : null}
            </div>
        )
    }

    // ── Live search combobox (storeName is available) ─────────────────────
    return (
        <ResourcePickerCombobox
            inputId={inputId}
            listboxId={listboxId}
            field={field}
            value={value}
            onChange={onChange}
            storeName={storeName}
            resourceLabel={resourceLabel}
            error={error}
            helpText={helpText}
        />
    )
}

/* ── Combobox sub-component (only renders when storeName is provided) ──── */

interface ComboboxProps {
    inputId: string
    listboxId: string
    field: ExtendedSchemaField
    value: string
    onChange: (v: string) => void
    storeName: string
    resourceLabel: string
    error: string | null
    helpText: string | undefined
}

function ResourcePickerCombobox({
    inputId,
    listboxId,
    field,
    value,
    onChange,
    storeName,
    resourceLabel,
    error,
    helpText,
}: ComboboxProps) {
    const [query, setQuery] = useState('')
    const [items, setItems] = useState<ResourceItem[]>([])
    const [state, setState] = useState<SearchState>('idle')
    const [searchError, setSearchError] = useState<string | null>(null)
    const [activeIndex, setActiveIndex] = useState(-1)
    const [isOpen, setIsOpen] = useState(false)
    const [selectedTitle, setSelectedTitle] = useState('')

    const listboxRef = useRef<HTMLUListElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const activeDescendant =
        isOpen && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined

    const beginRead = useReadRequest(JSON.stringify([storeName, field.type, query]))

    // ── Debounced search ────────────────────────────────────────────────
    useEffect(() => {
        const request = beginRead()
        if (!query.trim()) {
            setItems([])
            setState('idle')
            setIsOpen(false)
            setActiveIndex(-1)
            return
        }

        setState('loading')
        setSearchError(null)

        const timer = setTimeout(async () => {
            try {
                const url =
                    `/api/stores/${encodeURIComponent(storeName)}/resource-search` +
                    `?type=${encodeURIComponent(field.type)}` +
                    `&q=${encodeURIComponent(query.trim())}` +
                    `&limit=20`

                const res = await fetch(url, { cache: 'no-store', signal: request.signal })
                const json = await res.json().catch(() => ({ data: [] }))
                if (!request.isCurrent()) return

                if (!res.ok) {
                    const msg = (
                        typeof json?.error?.message === 'string' ? json.error.message
                        : typeof json?.error === 'string' ? json.error
                        : 'Search failed'
                    )
                    throw new Error(msg)
                }

                const fetched: ResourceItem[] = Array.isArray(json.data) ? json.data : []
                setItems(fetched)
                setState(fetched.length === 0 ? 'no-results' : 'results')
                setIsOpen(true)
                setActiveIndex(-1)
            } catch (err) {
                if (!request.isCurrent()) return
                const msg = err instanceof Error ? err.message : 'Search failed'
                setSearchError(msg)
                setState('error')
                setItems([])
                setIsOpen(true)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query, storeName, field.type, beginRead])

    // ── Select ──────────────────────────────────────────────────────────
    const handleSelect = useCallback(
        (item: ResourceItem) => {
            // RISK-DUAL-N01: emit id only; never touches section_definitions
            onChange(item.id)
            setSelectedTitle(item.title)
            setQuery('')
            setItems([])
            setState('idle')
            setIsOpen(false)
            setActiveIndex(-1)
        },
        [onChange]
    )

    // ── Clear ───────────────────────────────────────────────────────────
    const handleClear = useCallback(() => {
        onChange('')
        setSelectedTitle('')
        setQuery('')
        setItems([])
        setState('idle')
        setIsOpen(false)
        setActiveIndex(-1)
        inputRef.current?.focus()
    }, [onChange])

    // ── Keyboard navigation ─────────────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((prev) =>
                    items.length === 0 ? -1 : Math.min(prev + 1, items.length - 1)
                )
                if (!isOpen && items.length > 0) setIsOpen(true)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((prev) => Math.max(prev - 1, 0))
            } else if (e.key === 'Enter') {
                e.preventDefault()
                if (isOpen && activeIndex >= 0 && items[activeIndex]) {
                    handleSelect(items[activeIndex])
                }
            } else if (e.key === 'Escape') {
                e.preventDefault()
                setIsOpen(false)
                setActiveIndex(-1)
            }
        },
        [items, isOpen, activeIndex, handleSelect]
    )

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (
                listboxRef.current &&
                !listboxRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false)
                setActiveIndex(-1)
            }
        }
        document.addEventListener('mousedown', handleOutside)
        return () => document.removeEventListener('mousedown', handleOutside)
    }, [])

    const hasValue = value.length > 0
    const displayTitle = selectedTitle || value

    return (
        <div className="te-field">
            <label htmlFor={inputId} className="te-field-label">
                {field.label}
                {field.required ? (
                    <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
                ) : null}
            </label>

            <div className={styles.resourcePickerCombobox}>
                {/* Selected resource chip */}
                {hasValue ? (
                    <div className={styles.selectedResourceChip}>
                        <MaterialIcon name="category" size={13} aria-hidden />
                        <span className={styles.selectedResourceLabel} title={displayTitle}>
                            {displayTitle}
                        </span>
                        <Button
                            unstyled
                            type="button"
                            className={styles.clearBtn}
                            aria-label={`Clear selected ${resourceLabel.toLowerCase()}`}
                            onClick={handleClear}
                        >
                            <MaterialIcon name="close" size={13} aria-hidden />
                        </Button>
                    </div>
                ) : null}

                {/* Search input — role=combobox */}
                <Input
                    unstyled
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-controls={listboxId}
                    aria-activedescendant={activeDescendant}
                    aria-required={field.required ? 'true' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    className="te-field-input"
                    value={query}
                    placeholder={hasValue ? `Change ${resourceLabel.toLowerCase()}…` : `Search ${resourceLabel.toLowerCase()}s…`}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                />

                {/* Dropdown — role=listbox */}
                {isOpen ? (
                    <ul
                        ref={listboxRef}
                        id={listboxId}
                        role="listbox"
                        aria-label={`${resourceLabel} search results`}
                        className={styles.resourcePickerDropdown}
                    >
                        {state === 'loading' ? (
                            <li className={styles.searchStatus} aria-live="polite">
                                <MaterialIcon name="hourglass_top" size={13} aria-hidden />
                                Searching…
                            </li>
                        ) : state === 'error' ? (
                            <li className={`${styles.searchStatus} ${styles.searchStatusError}`} aria-live="assertive">
                                <MaterialIcon name="error" size={13} aria-hidden />
                                {searchError ?? 'Search failed'}
                            </li>
                        ) : state === 'no-results' ? (
                            <li className={styles.searchStatus} aria-live="polite">
                                No {resourceLabel.toLowerCase()}s found
                            </li>
                        ) : (
                            items.map((item, idx) => (
                                <li
                                    key={item.id}
                                    id={`${listboxId}-opt-${idx}`}
                                    role="option"
                                    aria-selected={item.id === value}
                                    className={[
                                        styles.resourcePickerOption,
                                        idx === activeIndex ? styles.resourcePickerOptionActive : '',
                                    ].join(' ').trim()}
                                    onMouseDown={(e) => {
                                        // Prevent blur on input before select registers
                                        e.preventDefault()
                                        handleSelect(item)
                                    }}
                                >
                                    {item.title}
                                    {item.handle ? (
                                        <span style={{ color: 'var(--lb-color-text-subdued, rgb(102 102 102))', fontSize: 11 }}>
                                            {' '}/ {item.handle}
                                        </span>
                                    ) : null}
                                </li>
                            ))
                        )}
                    </ul>
                ) : null}
            </div>

            {error ? (
                <p className={styles.fieldError} role="alert">
                    <MaterialIcon name="error" size={12} aria-hidden />
                    {' '}{error}
                </p>
            ) : null}
            {helpText ? (
                <span className="generic-theme-editor__field-help">{helpText}</span>
            ) : null}
        </div>
    )
}
