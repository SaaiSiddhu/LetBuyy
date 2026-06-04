'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MaterialIcon, Search } from '@letbuyy/ui'
import { getMerchantCommandItems, normalizeSiteType, type MerchantCommandItem } from './merchantNavigation'

interface CommandPaletteProps {
    store: string
    storeName: string
    siteType: string
    onClose: () => void
}

const searchChips = ['Apps', 'Customers', 'Orders', 'Products', 'Sales channels']

export default function CommandPalette({ store, storeName, siteType, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState('')
    const [highlighted, setHighlighted] = useState(0)
    const [entityCommands, setEntityCommands] = useState<MerchantCommandItem[]>([])
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

    const normalizedSiteType = normalizeSiteType(siteType)
    const allCommands = getMerchantCommandItems(siteType, store)

    // Filter
    const normalizedQuery = query.trim().toLowerCase()
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
            const commands = await searchStoreEntities(store, normalizedQuery, controller.signal)
            if (!controller.signal.aborted) {
                setEntityCommands(commands)
            }
        }

        loadEntityCommands()

        return () => controller.abort()
    }, [normalizedQuery, normalizedSiteType, store])

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
                <div className="admin-cmd-header">
                    <div className="admin-cmd-input-wrapper">
                        <MaterialIcon name="search" />
                        <input
                            ref={inputRef}
                            className="admin-cmd-input"
                            type="text"
                            placeholder="Search"
                            value={query}
                            onChange={(e) => {
                                const nextQuery = e.target.value
                                setQuery(nextQuery)
                                setHighlighted(0)
                                if (nextQuery.trim().length < 2) {
                                    setEntityCommands([])
                                }
                            }}
                            autoComplete="off"
                        />
                        <button className="admin-cmd-filter" type="button" aria-label="Filter search">
                            <MaterialIcon name="filter_list" />
                        </button>
                        <button className="admin-cmd-close-mobile" type="button" onClick={onClose} aria-label="Close search">
                            <MaterialIcon name="close" />
                        </button>
                    </div>

                    <div className="admin-cmd-chips" aria-label="Search categories">
                        {searchChips.map((chip) => (
                            <button
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
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results */}
                <div className="admin-cmd-results">
                    {normalizedQuery.length === 0 ? (
                        <div className="admin-cmd-empty-state">
                            <Search aria-hidden="true" />
                            <p>Find anything in {displayStoreName}</p>
                        </div>
                    ) : flatItems.length === 0 ? (
                        <div className="admin-cmd-empty-state">
                            <Search aria-hidden="true" />
                            <p>No results for “{query.trim()}”</p>
                        </div>
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

async function searchStoreEntities(store: string, query: string, signal: AbortSignal): Promise<MerchantCommandItem[]> {
    const encodedStore = encodeURIComponent(store)
    const [products, orders, customers] = await Promise.all([
        fetchJsonRows<ProductSearchRow>(`/api/stores/${encodedStore}/products?status=all&limit=12&sort=created_at&order=desc`, signal),
        fetchJsonRows<OrderSearchRow>(`/api/stores/${encodedStore}/orders?status=all&payment_status=all&limit=6&search=${encodeURIComponent(query)}`, signal),
        fetchJsonRows<CustomerSearchRow>(`/api/stores/${encodedStore}/customers?limit=6&search=${encodeURIComponent(query)}`, signal),
    ])

    return [
        ...products
            .filter((product) => productMatches(product, query))
            .slice(0, 6)
            .map((product) => productCommand(store, product)),
        ...orders.slice(0, 6).map((order) => orderCommand(store, order)),
        ...customers.slice(0, 6).map((customer) => customerCommand(store, customer)),
    ]
}

async function fetchJsonRows<T>(url: string, signal: AbortSignal): Promise<T[]> {
    try {
        const response = await fetch(url, { signal, cache: 'no-store' })
        const payload = await response.json().catch(() => null) as { data?: unknown } | null
        return response.ok && Array.isArray(payload?.data) ? payload.data as T[] : []
    } catch {
        return []
    }
}

function productMatches(product: ProductSearchRow, query: string) {
    const haystack = [
        readString(product.name),
        readString(product.vendor),
        readString(product.product_type),
        readString(product.category),
        readString(product.status),
    ].join(' ').toLowerCase()

    return haystack.includes(query)
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
        href: `/${store}/orders`,
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
        href: `/${store}/customers`,
        section: 'Customers',
        pathHint: email || '/customers',
        keywords: [name, email, readString(customer.id)].filter(Boolean).map((value) => value.toLowerCase()),
    }
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}
