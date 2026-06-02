'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

interface InventoryItem {
    id: string
    product_id: string
    product_name: string
    variant_title?: string | null
    variant_id?: string | null
    location_id?: string | null
    sku: string | null
    available: number
    on_hand: number
    track_inventory: boolean
    images: string[]
}

function getErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (typeof error === 'string') return error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            if (typeof message === 'string') return message
        }
    }

    return fallback
}

export default function InventoryPage() {
    const { store } = useParams<{ store: string }>()

    const [products, setProducts] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [quantity, setQuantity] = useState('')
    const [savingId, setSavingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const loadInventory = useCallback(async () => {
        setError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory/levels?limit=100`)
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setProducts([])
                setError(getErrorMessage(payload, 'Unable to load inventory'))
                return
            }

            setProducts(Array.isArray(payload?.data) ? payload.data : [])
        } catch {
            setProducts([])
            setError('Unable to load inventory')
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => {
        loadInventory()
    }, [loadInventory])

    const filtered = products.filter(p =>
        p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const startEdit = (item: InventoryItem) => {
        setEditingId(item.id)
        setQuantity(String(item.available))
        setError(null)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setQuantity('')
        setError(null)
    }

    const saveStock = async (item: InventoryItem) => {
        const nextQuantity = Number(quantity)
        if (!Number.isFinite(nextQuantity) || nextQuantity < 0 || !Number.isInteger(nextQuantity)) {
            setError('Stock must be a non-negative whole number')
            return
        }

        const adjustment = Math.trunc(nextQuantity) - Number(item.available || 0)
        if (adjustment === 0) {
            cancelEdit()
            return
        }

        setSavingId(item.id)
        setError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: item.product_id,
                    variant_id: item.variant_id || null,
                    location_id: item.location_id || null,
                    adjustment,
                    reason: 'correction',
                    notes: 'Adjusted from admin inventory screen',
                }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setError(getErrorMessage(payload, 'Unable to adjust inventory'))
                return
            }

            cancelEdit()
            await loadInventory()
        } catch {
            setError('Unable to adjust inventory')
        } finally {
            setSavingId(null)
        }
    }

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
                <div className="products-page-header"><h1>Inventory</h1></div>
                <div className="admin-skeleton" style={{ height: 200, borderRadius: 14 }} />
            </div>
        )
    }

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Inventory</h1>
            </div>

            {error && products.length === 0 ? (
                <div className="products-empty-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <MaterialIcon name="error" style={{ fontSize: 48, color: 'var(--danger)', marginBottom: 16 }} />
                    <h2 style={{
                        fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px'
                    }}>Unable to load inventory</h2>
                    <p style={{
                        fontSize: 14, color: 'var(--text-secondary)', margin: 0, maxWidth: 400, marginInline: 'auto'
                    }}>
                        {error}
                    </p>
                    <button
                        type="button"
                        onClick={loadInventory}
                        className="setup-plan-banner-btn"
                        style={{ marginTop: 18 }}
                    >
                        Retry
                    </button>
                </div>
            ) : products.length === 0 ? (
                <div className="products-empty-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <MaterialIcon name="inventory" style={{ fontSize: 48, color: 'var(--text-hint)', marginBottom: 16 }} />
                    <h2 style={{
                        fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px'
                    }}>No inventory to track</h2>
                    <p style={{
                        fontSize: 14, color: 'var(--text-secondary)', margin: 0, maxWidth: 400, marginInline: 'auto'
                    }}>
                        Add products to your store to start tracking inventory levels.
                    </p>
                </div>
            ) : (
                <div className="products-list-card">
                    <div className="products-toolbar">
                        <div className="products-search">
                            <MaterialIcon name="search" />
                            <input
                                type="text"
                                placeholder="Search inventory..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{ padding: '0 16px 12px', color: 'var(--danger)', fontSize: 13 }}>
                            {error}
                        </div>
                    )}

                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>SKU</th>
                                <th>Available</th>
                                <th>On hand</th>
                                <th style={{ width: 160 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        <div className="products-table-name">
                                            {p.images?.[0] ? (
                                                <img src={p.images[0]} alt={p.product_name} className="products-table-img" />
                                            ) : (
                                                <div className="products-table-img" style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <MaterialIcon name="image" style={{ fontSize: 18, color: 'var(--text-hint)' }} />
                                                </div>
                                            )}
                                            <span>
                                                {p.product_name}
                                                {p.variant_title ? ` / ${p.variant_title}` : ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ color: p.sku ? 'var(--text-primary)' : 'var(--text-hint)' }}>
                                        {p.sku || '—'}
                                    </td>
                                    <td>
                                        {editingId === p.id ? (
                                            <input
                                                type="number"
                                                min={0}
                                                value={quantity}
                                                onChange={e => setQuantity(e.target.value)}
                                                style={{
                                                    width: 92,
                                                    padding: '7px 10px',
                                                    borderRadius: 8,
                                                    border: '1px solid var(--border)',
                                                    background: 'var(--bg)',
                                                    color: 'var(--text-primary)',
                                                    fontSize: 13,
                                                }}
                                            />
                                        ) : p.available}
                                    </td>
                                    <td>{p.on_hand}</td>
                                    <td>
                                        {editingId === p.id ? (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    onClick={() => saveStock(p)}
                                                    disabled={savingId === p.id}
                                                    className="setup-plan-banner-btn"
                                                    style={{
                                                        background: 'var(--text-primary)',
                                                        color: 'var(--bg)',
                                                        padding: '6px 10px',
                                                        borderRadius: 8,
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        opacity: savingId === p.id ? 0.6 : 1,
                                                    }}
                                                >
                                                    {savingId === p.id ? 'Saving' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    disabled={savingId === p.id}
                                                    style={{
                                                        background: 'var(--bg-secondary)',
                                                        color: 'var(--text-primary)',
                                                        border: '1px solid var(--border)',
                                                        padding: '6px 10px',
                                                        borderRadius: 8,
                                                        fontSize: 12,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(p)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    padding: 4,
                                                    fontSize: 13,
                                                }}
                                            >
                                                <MaterialIcon name="edit" style={{ fontSize: 17 }} />
                                                Adjust
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{
                                        textAlign: 'center', padding: '40px 16px',
                                        color: 'var(--text-hint)', fontSize: 14
                                    }}>
                                        No items found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
