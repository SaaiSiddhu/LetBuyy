'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface CommandPaletteProps {
    store: string
    siteType: string
    onClose: () => void
}

interface CommandItem {
    label: string
    icon: string
    href?: string
    section: string
    action?: () => void
    /** Short path shown on the right, e.g. "/dashboard" */
    shortcut?: string
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

    // Build command list
    const allCommands: CommandItem[] = [
        // Navigation — Pages
        { label: 'Dashboard', icon: 'dashboard', href: `/${store}/dashboard`, section: 'Pages', shortcut: '/dashboard' },
        { label: 'Analytics', icon: 'bar_chart', href: `/${store}/analytics`, section: 'Pages', shortcut: '/analytics' },
        { label: 'Settings', icon: 'settings', href: `/${store}/settings`, section: 'Pages', shortcut: '/settings' },
    ]

    // Add type-specific commands
    if (siteType === 'store') {
        allCommands.push(
            { label: 'Orders', icon: 'shopping_cart', href: `/${store}/orders`, section: 'Pages', shortcut: '/orders' },
            { label: 'Products', icon: 'inventory_2', href: `/${store}/products`, section: 'Pages', shortcut: '/products' },
            { label: 'Customers', icon: 'group', href: `/${store}/customers`, section: 'Pages', shortcut: '/customers' },
            { label: 'Discounts', icon: 'sell', href: `/${store}/coupons`, section: 'Pages', shortcut: '/discounts' },
            { label: 'Gift Cards', icon: 'card_giftcard', href: `/${store}/products/gift-cards`, section: 'Pages', shortcut: '/gift-cards' },
            { label: 'Add a product', icon: 'add_circle', href: `/${store}/products/new`, section: 'Actions' },
            { label: 'Create a discount', icon: 'add_circle', href: `/${store}/coupons/new`, section: 'Actions' },
        )
    } else if (siteType === 'portfolio') {
        allCommands.push(
            { label: 'Projects', icon: 'work', href: `/${store}/projects`, section: 'Pages', shortcut: '/projects' },
            { label: 'Gallery', icon: 'image', href: `/${store}/gallery`, section: 'Pages', shortcut: '/gallery' },
            { label: 'Add a project', icon: 'add_circle', href: `/${store}/projects/new`, section: 'Actions' },
        )
    } else if (siteType === 'blog') {
        allCommands.push(
            { label: 'Posts', icon: 'edit_note', href: `/${store}/posts`, section: 'Pages', shortcut: '/posts' },
            { label: 'Categories', icon: 'category', href: `/${store}/categories`, section: 'Pages', shortcut: '/categories' },
            { label: 'Write a new post', icon: 'add_circle', href: `/${store}/posts/new`, section: 'Actions' },
        )
    }

    // Settings sub-pages
    allCommands.push(
        { label: 'General Settings', icon: 'tune', href: `/${store}/settings/general`, section: 'Settings', shortcut: '/settings/general' },
        { label: 'Plan', icon: 'credit_card', href: `/${store}/settings/plan`, section: 'Settings', shortcut: '/settings/plan' },
        { label: 'Domains', icon: 'language', href: `/${store}/settings/domains`, section: 'Settings', shortcut: '/settings/domains' },
        { label: 'Users & Permissions', icon: 'manage_accounts', href: `/${store}/settings/users`, section: 'Settings', shortcut: '/settings/users' },
    )

    // Filter
    const filtered = query.trim()
        ? allCommands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
        : allCommands

    // Group by section
    const sections: Record<string, CommandItem[]> = {}
    filtered.forEach((item) => {
        if (!sections[item.section]) sections[item.section] = []
        sections[item.section].push(item)
    })

    const flatItems = Object.values(sections).flat()

    const handleSelect = useCallback((item: CommandItem) => {
        onClose()
        if (item.action) {
            item.action()
        } else if (item.href) {
            router.push(item.href)
        }
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

    // Reset highlighted when query changes
    useEffect(() => {
        setHighlighted(0)
    }, [query])

    return (
        <div className="admin-cmd-overlay" onClick={onClose}>
            <div className="admin-cmd-modal" onClick={(e) => e.stopPropagation()}>
                {/* Search input */}
                <div className="admin-cmd-input-wrapper">
                    <span className="material-symbols-outlined">search</span>
                    <input
                        ref={inputRef}
                        className="admin-cmd-input"
                        type="text"
                        placeholder="Search pages, actions, settings..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoComplete="off"
                    />
                    {/* Mobile close button */}
                    <button className="admin-cmd-close-mobile" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Results */}
                <div className="admin-cmd-results">
                    {flatItems.length === 0 ? (
                        <div className="admin-cmd-empty">No results found</div>
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
                                            <span className="material-symbols-outlined">{item.icon}</span>
                                            <span className="admin-cmd-item-label">{item.label}</span>
                                            {item.shortcut && (
                                                <span className="admin-cmd-item-path">{item.shortcut}</span>
                                            )}
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
                </div>
            </div>
        </div>
    )
}
