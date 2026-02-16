'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface InventoryItem {
    id: string
    name: string
    sku: string | null
    stock: number
    track_inventory: boolean
    images: string[]
}

export default function InventoryPage() {
    const { store } = useParams<{ store: string }>()
    const supabase = createClient()

    const [products, setProducts] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadInventory()
    }, [])

    async function loadInventory() {
        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .eq('store_name', store)
            .single()

        if (!storeData) { setLoading(false); return }

        const { data } = await supabase
            .from('products')
            .select('id, name, sku, stock, track_inventory, images')
            .eq('store_id', storeData.id)
            .order('name', { ascending: true })

        setProducts(data || [])
        setLoading(false)
    }

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    )

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

            {products.length === 0 ? (
                <div className="products-empty-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 48, color: 'var(--text-hint)', marginBottom: 16
                    }}>inventory</span>
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
                            <span className="material-symbols-outlined">search</span>
                            <input
                                type="text"
                                placeholder="Search inventory..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>SKU</th>
                                <th>Available</th>
                                <th>On hand</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        <div className="products-table-name">
                                            {p.images?.[0] ? (
                                                <img src={p.images[0]} alt={p.name} className="products-table-img" />
                                            ) : (
                                                <div className="products-table-img" style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <span className="material-symbols-outlined" style={{
                                                        fontSize: 18, color: 'var(--text-hint)'
                                                    }}>image</span>
                                                </div>
                                            )}
                                            <span>{p.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: p.sku ? 'var(--text-primary)' : 'var(--text-hint)' }}>
                                        {p.sku || '—'}
                                    </td>
                                    <td>{p.stock}</td>
                                    <td>{p.stock}</td>
                                </tr>
                            ))}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{
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
