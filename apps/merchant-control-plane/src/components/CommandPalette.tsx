'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState, MaterialIcon, Search } from '@letbuyy/ui'
import { getMerchantCommandItems, type MerchantCommandItem } from './merchantNavigation'

interface CommandPaletteProps {
    store: string
    siteType: string
    onClose: () => void
}

export default function CommandPalette({ store, siteType, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState('')
    const [highlighted, setHighlighted] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onClose])

    const allCommands = getMerchantCommandItems(siteType, store)

    // Filter
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = normalizedQuery
        ? allCommands.filter((command) => command.keywords.some((keyword) => keyword.includes(normalizedQuery)))
        : allCommands

    // Group by section
    const sections: Record<string, MerchantCommandItem[]> = {}
    filtered.forEach((item) => {
        if (!sections[item.section]) sections[item.section] = []
        sections[item.section].push(item)
    })

    const flatItems = Object.values(sections).flat()

    const handleSelect = useCallback((item: MerchantCommandItem) => {
        onClose()
        router.push(item.href)
    }, [onClose, router])

    // Keyboard navigation
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlighted((h) => Math.min(h + 1, flatItems.length - 1))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlighted((h) => Math.max(h - 1, 0))
            } else if (e.key === 'Enter') {
                e.preventDefault()
                if (flatItems[highlighted]) {
                    handleSelect(flatItems[highlighted])
                }
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [highlighted, flatItems, handleSelect])

    return (
        <div className="admin-cmd-overlay" onClick={onClose}>
            <div className="admin-cmd-modal" onClick={(e) => e.stopPropagation()}>
                {/* Search input */}
                <div className="admin-cmd-input-wrapper">
                    <MaterialIcon name="search" />
                    <input
                        ref={inputRef}
                        className="admin-cmd-input"
                        type="text"
                        placeholder="Search pages, actions, settings..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setHighlighted(0)
                        }}
                        autoComplete="off"
                    />
                    {/* Mobile close button */}
                    <button className="admin-cmd-close-mobile" onClick={onClose}>
                        <MaterialIcon name="close" />
                    </button>
                </div>

                {/* Results */}
                <div className="admin-cmd-results">
                    {flatItems.length === 0 ? (
                        <EmptyState
                            className="admin-cmd-empty-state"
                            icon={<Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No results found"
                            body="Try searching for a page, setting, or action."
                        />
                    ) : (
                        Object.entries(sections).map(([section, items]) => (
                            <div key={section}>
                                <div className="admin-cmd-section">{section}</div>
                                {items.map((item) => {
                                    const idx = flatItems.indexOf(item)
                                    return (
                                        <div
                                            key={item.label}
                                            className={`admin-cmd-item ${idx === highlighted ? 'highlighted' : ''}`}
                                            onMouseEnter={() => setHighlighted(idx)}
                                            onClick={() => handleSelect(item)}
                                        >
                                            <MaterialIcon name={item.icon} />
                                            <span className="admin-cmd-item-label">{item.label}</span>
                                            <span className="admin-cmd-item-meta">
                                                {item.shortcut && <kbd className="admin-cmd-item-shortcut">{item.shortcut}</kbd>}
                                                <span className="admin-cmd-item-path">{item.pathHint}</span>
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer — desktop only */}
                <div className="admin-cmd-footer">
                    <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
                    <span><kbd>↵</kbd> Select</span>
                    <span><kbd>Esc</kbd> Close</span>
                    <span><kbd>g</kbd> then <kbd>p</kbd> Jump</span>
                </div>
            </div>
        </div>
    )
}
