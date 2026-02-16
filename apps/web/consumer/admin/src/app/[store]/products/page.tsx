'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Product {
    id: string
    name: string
    status: string
    stock: number
    price: number
    compare_price: number | null
    images: string[]
    category: string | null
    product_type: string | null
    vendor: string | null
    is_active: boolean
    created_at: string
}

type TabFilter = 'all' | 'active' | 'draft' | 'archived'

export default function ProductsPage() {
    const { store } = useParams<{ store: string }>()
    const supabase = createClient()

    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [storeId, setStoreId] = useState<string | null>(null)

    const loadProducts = useCallback(async () => {
        // Store ownership is already validated by the server-side [store]/layout.tsx
        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .eq('store_name', store)
            .single()

        if (!storeData) {
            setLoading(false)
            return
        }

        setStoreId(storeData.id)

        let query = supabase
            .from('products')
            .select('id, name, status, stock, price, compare_price, images, category, product_type, vendor, is_active, created_at')
            .eq('store_id', storeData.id)
            .order('created_at', { ascending: false })

        if (activeTab === 'active') {
            query = query.eq('is_active', true)
        } else if (activeTab === 'draft') {
            query = query.eq('is_active', false)
        }

        const { data } = await query
        setProducts(data || [])
        setLoading(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store, activeTab])

    useEffect(() => {
        loadProducts()
    }, [loadProducts])

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getStatusBadge = (product: Product) => {
        const status = product.is_active ? 'active' : 'draft'
        return (
            <span className={`product-status-badge ${status}`}>
                <span className="product-status-dot" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        )
    }

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ padding: '24px 32px' }}>
                <div className="products-page-header">
                    <h1>Products</h1>
                </div>
                <div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} />
            </div>
        )
    }

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            {/* Page header */}
            <div className="products-page-header">
                <h1>Products</h1>
                {products.length > 0 && (
                    <Link href={`/${store}/products/new`} className="setup-plan-banner-btn" style={{
                        background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px',
                        borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none'
                    }}>
                        Add product
                    </Link>
                )}
            </div>

            {products.length === 0 ? (
                /* ——— Empty State ——— */
                <>
                    <div className="products-empty-card">
                        <div className="products-empty-inner">
                            <div className="products-empty-text">
                                <h2>Add your products</h2>
                                <p>
                                    Start by stocking your store with products your customers will love.
                                </p>
                                <div className="products-empty-actions">
                                    <Link href={`/${store}/products/new`} className="setup-plan-banner-btn" style={{
                                        background: 'var(--text-primary)', color: 'var(--bg)', padding: '9px 20px',
                                        borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                                        display: 'inline-flex', alignItems: 'center', gap: 6
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                        Add product
                                    </Link>
                                    <button className="setup-plan-banner-btn" style={{
                                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                        border: '1px solid var(--border)', padding: '9px 20px',
                                        borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                        display: 'inline-flex', alignItems: 'center', gap: 6
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                                        Import
                                    </button>
                                </div>
                            </div>
                            <div className="products-empty-images">
                                <div className="products-empty-img"><span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-hint)' }}>edit</span></div>
                                <div className="products-empty-img"><span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-hint)' }}>deployed_code</span></div>
                                <div className="products-empty-img"><span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-hint)' }}>checkroom</span></div>
                                <div className="products-empty-img"><span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-hint)' }}>steps</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="products-sourcing">
                        <h3>Find products to sell</h3>
                        <p>
                            Have dropshipping or print on demand products shipped directly
                            from the supplier to your customer, and only pay for what you sell.
                        </p>
                        <button className="setup-plan-banner-btn" style={{
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            border: '1px solid var(--border)', padding: '8px 16px',
                            borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer'
                        }}>
                            Browse product sourcing apps
                        </button>
                    </div>
                </>
            ) : (
                /* ——— Products list ——— */
                <div className="products-list-card">
                    {/* Tabs */}
                    <div className="products-tabs">
                        {(['all', 'active', 'draft', 'archived'] as TabFilter[]).map(tab => (
                            <button
                                key={tab}
                                className={`products-tab ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Search + filters */}
                    <div className="products-toolbar">
                        <div className="products-search">
                            <span className="material-symbols-outlined">search</span>
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Status</th>
                                <th>Inventory</th>
                                <th>Type</th>
                                <th>Vendor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(product => (
                                <tr key={product.id} style={{ cursor: 'pointer' }}>
                                    <td>
                                        <Link
                                            href={`/${store}/products/${product.id}`}
                                            style={{ textDecoration: 'none', color: 'inherit' }}
                                        >
                                            <div className="products-table-name">
                                                {product.images?.[0] ? (
                                                    <img
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        className="products-table-img"
                                                    />
                                                ) : (
                                                    <div className="products-table-img" style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <span className="material-symbols-outlined" style={{
                                                            fontSize: 18, color: 'var(--text-hint)'
                                                        }}>image</span>
                                                    </div>
                                                )}
                                                <span>{product.name}</span>
                                            </div>
                                        </Link>
                                    </td>
                                    <td>{getStatusBadge(product)}</td>
                                    <td>{product.stock} in stock</td>
                                    <td>{product.product_type || product.category || '—'}</td>
                                    <td>{product.vendor || '—'}</td>
                                </tr>
                            ))}

                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{
                                        textAlign: 'center', padding: '40px 16px',
                                        color: 'var(--text-hint)', fontSize: 14
                                    }}>
                                        No products found
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
