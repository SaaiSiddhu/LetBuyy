'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Category {
    id: string
    name: string
    slug: string
    description: string | null
    image_url: string | null
    parent_id: string | null
    display_order: number
    is_visible: boolean
    product_count: number
    created_at: string
}

export default function CategoriesPage() {
    const { store } = useParams<{ store: string }>()
    const supabase = createClient()

    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ name: '', slug: '', description: '' })
    const [storeId, setStoreId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const loadCategories = useCallback(async () => {
        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .eq('store_name', store)
            .single()

        if (!storeData) { setLoading(false); return }
        setStoreId(storeData.id)

        const { data } = await supabase
            .from('product_categories')
            .select('*')
            .eq('store_id', storeData.id)
            .order('display_order', { ascending: true })

        setCategories(data || [])
        setLoading(false)
    }, [store, supabase])

    useEffect(() => { loadCategories() }, [loadCategories])

    const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const handleSave = async () => {
        if (!storeId || !formData.name) return
        setSaving(true)

        const slug = formData.slug || generateSlug(formData.name)
        const payload = {
            store_id: storeId,
            name: formData.name,
            slug,
            description: formData.description || null,
        }

        if (editingId) {
            await supabase.from('product_categories').update(payload).eq('id', editingId)
        } else {
            await supabase.from('product_categories').insert(payload)
        }

        setSaving(false)
        setShowForm(false)
        setEditingId(null)
        setFormData({ name: '', slug: '', description: '' })
        loadCategories()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this category?')) return
        await supabase.from('product_categories').delete().eq('id', id)
        loadCategories()
    }

    const startEdit = (cat: Category) => {
        setEditingId(cat.id)
        setFormData({ name: cat.name, slug: cat.slug, description: cat.description || '' })
        setShowForm(true)
    }

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ padding: '24px 32px' }}>
                <div className="products-page-header"><h1>Categories</h1></div>
                <div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} />
            </div>
        )
    }

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Categories</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', slug: '', description: '' }) }}
                    className="setup-plan-banner-btn" style={{
                        background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px',
                        borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6
                    }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                    Add category
                </button>
            </div>

            {/* Inline form */}
            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
                        {editingId ? 'Edit Category' : 'New Category'}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <input type="text" placeholder="Category name" value={formData.name}
                            onChange={e => setFormData(f => ({ ...f, name: e.target.value, slug: f.slug || '' }))}
                            style={{
                                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                                background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14
                            }} />
                        <input type="text" placeholder="Slug (auto-generated)" value={formData.slug || generateSlug(formData.name)}
                            onChange={e => setFormData(f => ({ ...f, slug: e.target.value }))}
                            style={{
                                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                                background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 13
                            }} />
                        <textarea placeholder="Description (optional)" value={formData.description}
                            onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                            rows={3}
                            style={{
                                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                                background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical'
                            }} />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.name} style={{
                                background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px',
                                borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                                opacity: (saving || !formData.name) ? 0.5 : 1
                            }}>
                                {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                border: '1px solid var(--border)', padding: '8px 20px',
                                borderRadius: 8, fontSize: 13, cursor: 'pointer'
                            }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {categories.length === 0 && !showForm ? (
                <div className="products-empty-card">
                    <div className="products-empty-inner">
                        <div className="products-empty-text">
                            <h2>No categories yet</h2>
                            <p>Organize your products by creating categories.</p>
                        </div>
                    </div>
                </div>
            ) : categories.length > 0 && (
                <div className="products-list-card">
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Slug</th>
                                <th>Products</th>
                                <th>Visible</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => (
                                <tr key={cat.id}>
                                    <td><span style={{ fontWeight: 500 }}>{cat.name}</span></td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>/{cat.slug}</td>
                                    <td>{cat.product_count || 0}</td>
                                    <td>
                                        <span className={`product-status-badge ${cat.is_visible ? 'active' : 'draft'}`}>
                                            <span className="product-status-dot" />
                                            {cat.is_visible ? 'Visible' : 'Hidden'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => startEdit(cat)} title="Edit" style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--text-secondary)', padding: 4
                                            }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                                            </button>
                                            <button onClick={() => handleDelete(cat.id)} title="Delete" style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--danger)', padding: 4
                                            }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                            </button>
                                        </div>
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
