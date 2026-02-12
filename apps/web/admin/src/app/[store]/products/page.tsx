'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'

interface Product {
    id: string
    name: string
    price: number
    status: string
    inventory_count: number
    images: string[]
    created_at: string
}

export default function ProductsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [storeId, setStoreId] = useState<string | null>(null)
    const [showAdd, setShowAdd] = useState(false)
    const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '' })
    const [saving, setSaving] = useState(false)
    const supabase = createClient()

    const loadProducts = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: storeData } = await supabase
            .from('stores')
            .select('id')
            .eq('store_name', store)
            .eq('user_id', user.id)
            .single()

        if (!storeData) return
        setStoreId(storeData.id)

        let query = supabase
            .from('products')
            .select('*')
            .eq('store_id', storeData.id)
            .order('created_at', { ascending: false })

        if (search) {
            query = query.ilike('name', `%${search}%`)
        }

        const { data } = await query
        setProducts(data || [])
        setLoading(false)
    }, [store, search, supabase])

    useEffect(() => { loadProducts() }, [loadProducts])

    const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
        if (selected.size === 0) return
        const ids = Array.from(selected)

        if (action === 'delete') {
            if (!confirm(`Delete ${ids.length} product(s)?`)) return
            for (const id of ids) {
                await supabase.from('products').delete().eq('id', id)
            }
        } else {
            const status = action === 'activate' ? 'active' : 'inactive'
            for (const id of ids) {
                await supabase.from('products').update({ status }).eq('id', id)
            }
        }
        setSelected(new Set())
        loadProducts()
    }

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!storeId) return
        setSaving(true)

        await supabase.from('products').insert({
            store_id: storeId,
            name: newProduct.name,
            price: parseFloat(newProduct.price) || 0,
            description: newProduct.description,
            status: 'active',
        })

        setNewProduct({ name: '', price: '', description: '' })
        setShowAdd(false)
        setSaving(false)
        loadProducts()
    }

    const toggleAll = () => {
        if (selected.size === products.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(products.map(p => p.id)))
        }
    }

    const toggleOne = (id: string) => {
        const next = new Set(selected)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelected(next)
    }

    const formatCurrency = (amt: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt)

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Products</h1>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {products.length} product{products.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                    Add Product
                </button>
            </div>

            {/* Search + Bulk Actions */}
            <div className="mb-4 flex items-center gap-3">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {selected.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-500">{selected.size} selected</span>
                        <button onClick={() => handleBulkAction('activate')} className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200">Activate</button>
                        <button onClick={() => handleBulkAction('deactivate')} className="rounded bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-200">Deactivate</button>
                        <button onClick={() => handleBulkAction('delete')} className="rounded bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Delete</button>
                    </div>
                )}
            </div>

            {/* Add Product Modal */}
            {showAdd && (
                <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950/30">
                    <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Add Product</h3>
                    <form onSubmit={handleAddProduct} className="space-y-3">
                        <input
                            type="text"
                            placeholder="Product name"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct(p => ({ ...p, name: e.target.value }))}
                            required
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Price"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct(p => ({ ...p, price: e.target.value }))}
                            required
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <textarea
                            placeholder="Description (optional)"
                            value={newProduct.description}
                            onChange={(e) => setNewProduct(p => ({ ...p, description: e.target.value }))}
                            rows={2}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <div className="flex gap-2">
                            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Products Table */}
            {products.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">No products yet</p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Add your first product to start selling.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                                <th className="w-10 px-4 py-3">
                                    <input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} className="rounded" />
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Name</th>
                                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                                <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Price</th>
                                <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => (
                                <tr key={product.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                                    <td className="px-4 py-3">
                                        <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleOne(product.id)} className="rounded" />
                                    </td>
                                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                        {product.name}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${product.status === 'active'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                            }`}>
                                            {product.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                                        {formatCurrency(product.price)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                                        {product.inventory_count ?? '∞'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
