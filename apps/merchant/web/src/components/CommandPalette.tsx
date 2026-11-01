'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMerchantRouter as useRouter } from './MerchantNavigationProvider'
import { Button, Input, ListFilter, Search, X, useFocusTrap } from '@letbuyy/ui'
import { MerchantSidebarIcon } from './MerchantSidebarIcon'
import { getMerchantCommandItems, normalizeSiteType, type MerchantCommandItem } from './merchantNavigation'

interface CommandPaletteProps {
    store: string
    storeName: string
    siteType: string
    appPlatformEnabled: boolean
    onClose: () => void
}

const searchChips = ['Apps', 'Customers', 'Orders', 'Products', 'Sales channels']

export default function CommandPalette({ store, storeName, siteType, appPlatformEnabled, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState('')
    const [highlighted, setHighlighted] = useState(0)
    const [entityResult, setEntityResult] = useState<{ scope: string; commands: MerchantCommandItem[]; failedSources: number } | null>(null)
    const [retry, setRetry] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const modalRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    useFocusTrap(modalRef, { active: true, initialFocusRef: inputRef })

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

    const normalizedSiteType = normalizeSiteType(siteType)
    const allCommands = getMerchantCommandItems(siteType, store, appPlatformEnabled)

    // Filter
    const normalizedQuery = query.trim().toLowerCase()
    const searchScope = JSON.stringify([store, normalizedSiteType, normalizedQuery])
    const currentEntityResult = entityResult?.scope === searchScope ? entityResult : null
    const entityCommands = currentEntityResult?.commands ?? []
    const searchingEntities = normalizedSiteType === 'store' && normalizedQuery.length >= 2 && !currentEntityResult
    const routeCommands = normalizedQuery
        ? allCommands.filter((command) => command.keywords.some((keyword) => keyword.includes(normalizedQuery)))
        : []
    const filtered = normalizedQuery.length >= 2
        ? [...routeCommands, ...entityCommands]
        : routeCommands

    // Group by section
    const sections: Record<string, MerchantCommandItem[]> = {}
    filtered.forEach((item) => {
        if (!sections[item.section]) sections[item.section] = []
        sections[item.section].push(item)
    })

    const flatItems = Object.values(sections).flat()
    const displayStoreName = storeName?.trim() || store

    const handleSelect = useCallback((item: MerchantCommandItem) => {
        onClose()
        router.push(item.href)
    }, [onClose, router])

    useEffect(() => {
        if (normalizedSiteType !== 'store' || normalizedQuery.length < 2) {
            return
        }

        const controller = new AbortController()

        async function loadEntityCommands() {
            const result = await searchStoreEntities(store, normalizedQuery, controller.signal)
            if (!controller.signal.aborted) {
                setEntityResult({ scope: searchScope, ...result })
            }
        }

        // One bounded search after typing pauses, rather than three requests per keystroke.
        const timer = setTimeout(() => { void loadEntityCommands() }, 250)

        return () => { clearTimeout(timer); controller.abort() }
    }, [normalizedQuery, normalizedSiteType, store, searchScope, retry])

    // Keyboard navigation
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.target instanceof HTMLElement && e.target.closest('button')) return
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
            <div ref={modalRef} className="admin-cmd-modal" role="dialog" aria-modal="true" aria-label="Search merchant workspace" onClick={(e) => e.stopPropagation()}>
                {/* Search input */}
                <div className="admin-cmd-header">
                    <div className="admin-cmd-input-wrapper">
                        <Search className="letbuyy-icon" aria-hidden="true" />
                        <Input unstyled
                            ref={inputRef}
                            className="admin-cmd-input"
                            type="text"
                            aria-label="Search merchant workspace"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-controls="merchant-command-results"
                            aria-expanded={flatItems.length > 0}
                            aria-activedescendant={flatItems[highlighted] ? `merchant-command-option-${highlighted}` : undefined}
                            placeholder="Search"
                            value={query}
                            onChange={(e) => {
                                const nextQuery = e.target.value
                                setQuery(nextQuery)
                                setHighlighted(0)
                                if (nextQuery.trim().length < 2) {
                                    setEntityResult(null)
                                }
                            }}
                            autoComplete="off"
                        />
                        <span className="admin-cmd-filter" aria-hidden="true">
                            <ListFilter className="letbuyy-icon" />
                        </span>
                        <Button unstyled className="admin-cmd-close-mobile" type="button" onClick={onClose} aria-label="Close search">
                            <X className="letbuyy-icon" aria-hidden="true" />
                        </Button>
                    </div>

                    <div className="admin-cmd-chips" aria-label="Search categories">
                        {searchChips.filter(chip => appPlatformEnabled || chip !== 'Apps').map((chip) => (
                            <Button unstyled
                                key={chip}
                                type="button"
                                className="admin-cmd-chip"
                                onClick={() => {
                                    setQuery(chip)
                                    setHighlighted(0)
                                    inputRef.current?.focus()
                                }}
                            >
                                {chip}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Results */}
                {currentEntityResult && currentEntityResult.failedSources > 0 && (
                    <div className="admin-cmd-search-warning" role="status">
                        {currentEntityResult.failedSources === 3 ? 'Live search is unavailable.' : 'Some live results could not load.'}
                        <Button unstyled type="button" onClick={() => { setEntityResult(null); setRetry(value => value + 1) }}>Retry live search</Button>
                    </div>
                )}
                <div id="merchant-command-results" className="admin-cmd-results" role="listbox" aria-label="Search results">
                    {normalizedQuery.length === 0 ? (
                        <div className="admin-cmd-empty-state">
                            <Search aria-hidden="true" />
                            <p>Find anything in {displayStoreName}</p>
                        </div>
                    ) : flatItems.length === 0 ? (
                        <div className="admin-cmd-empty-state">
                            <Search aria-hidden="true" />
                            <p>{searchingEntities ? 'Searching live records…' : currentEntityResult?.failedSources ? 'No navigation matches. Live records could not be fully searched.' : `No results for “${query.trim()}”`}</p>
                        </div>
                    ) : (
                        Object.entries(sections).map(([section, items]) => (
                            <div key={section} role="group" aria-label={section}>
                                <div className="admin-cmd-section">{section}</div>
                                {items.map((item) => {
                                    const idx = flatItems.indexOf(item)
                                    return (
                                        <Button unstyled
                                            key={`${item.href}:${idx}`}
                                            id={`merchant-command-option-${idx}`}
                                            type="button"
                                            role="option"
                                            aria-selected={idx === highlighted}
                                            className={`admin-cmd-item ${idx === highlighted ? 'highlighted' : ''}`}
                                            onMouseEnter={() => setHighlighted(idx)}
                                            onClick={() => handleSelect(item)}
                                        >
                                            <MerchantSidebarIcon name={item.icon} />
                                            <span className="admin-cmd-item-label">{item.label}</span>
                                            <span className="admin-cmd-item-meta">
                                                {item.shortcut && <kbd className="admin-cmd-item-shortcut">{item.shortcut}</kbd>}
                                                <span className="admin-cmd-item-path">{item.pathHint}</span>
                                            </span>
                                        </Button>
                                    )
                                })}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

interface ProductSearchRow {
    id?: unknown
    name?: unknown
    vendor?: unknown
    product_type?: unknown
    category?: unknown
    status?: unknown
}

interface OrderSearchRow {
    id?: unknown
    order_number?: unknown
    customer_name?: unknown
    customer_email?: unknown
    status?: unknown
}

interface CustomerSearchRow {
    id?: unknown
    full_name?: unknown
    customer_name?: unknown
    email?: unknown
    customer_email?: unknown
}

interface LiveSearchResult {
    commands: MerchantCommandItem[]
    failedSources: number
}

async function searchStoreEntities(store: string, query: string, signal: AbortSignal): Promise<LiveSearchResult> {
    const encodedStore = encodeURIComponent(store)
    const results = await Promise.allSettled([
        fetchJsonRows<ProductSearchRow>(`/api/stores/${encodedStore}/products?status=all&limit=6&search=${encodeURIComponent(query)}`, signal),
        fetchJsonRows<OrderSearchRow>(`/api/stores/${encodedStore}/orders?status=all&payment_status=all&limit=6&search=${encodeURIComponent(query)}`, signal),
        fetchJsonRows<CustomerSearchRow>(`/api/stores/${encodedStore}/customers?limit=6&search=${encodeURIComponent(query)}`, signal),
    ])
    const [products, orders, customers] = results.map(result => result.status === 'fulfilled' ? result.value : []) as [ProductSearchRow[], OrderSearchRow[], CustomerSearchRow[]]

    return { commands: [
        ...products
            .slice(0, 6)
            .map((product) => productCommand(store, product)),
        ...orders.slice(0, 6).map((order) => orderCommand(store, order)),
        ...customers.slice(0, 6).map((customer) => customerCommand(store, customer)),
    ], failedSources: results.filter(result => result.status === 'rejected').length }
}

async function fetchJsonRows<T>(url: string, signal: AbortSignal): Promise<T[]> {
    const response = await fetch(url, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`Live search failed (${response.status})`)
    const payload = await response.json() as { data?: unknown }
    if (!Array.isArray(payload?.data)) throw new Error('Invalid live search response')
    return payload.data as T[]
}

function productCommand(store: string, product: ProductSearchRow): MerchantCommandItem {
    const id = readString(product.id)
    const label = readString(product.name) || 'Untitled product'
    const descriptor = readString(product.product_type) || readString(product.category) || 'Product'

    return {
        label,
        icon: 'products',
        href: id ? `/${store}/products/${encodeURIComponent(id)}` : `/${store}/products`,
        section: 'Products',
        pathHint: descriptor,
        keywords: [label, descriptor, readString(product.vendor), readString(product.status), id].filter(Boolean).map((value) => value.toLowerCase()),
    }
}

function orderCommand(store: string, order: OrderSearchRow): MerchantCommandItem {
    const orderNumber = readString(order.order_number) || readString(order.id)
    const customer = readString(order.customer_name) || readString(order.customer_email)
    const label = orderNumber ? `Order ${orderNumber}` : 'Order'

    return {
        label,
        icon: 'shopping_cart',
        href: readString(order.id) ? `/${store}/orders/${encodeURIComponent(readString(order.id))}` : `/${store}/orders`,
        section: 'Orders',
        pathHint: customer || '/orders',
        keywords: [label, orderNumber, customer, readString(order.status)].filter(Boolean).map((value) => value.toLowerCase()),
    }
}

function customerCommand(store: string, customer: CustomerSearchRow): MerchantCommandItem {
    const name = readString(customer.full_name) || readString(customer.customer_name)
    const email = readString(customer.email) || readString(customer.customer_email)

    return {
        label: name || email || 'Customer',
        icon: 'customers',
        href: email ? `/${store}/customers/${encodeURIComponent(email)}` : `/${store}/customers`,
        section: 'Customers',
        pathHint: email || '/customers',
        keywords: [name, email, readString(customer.id)].filter(Boolean).map((value) => value.toLowerCase()),
    }
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}
