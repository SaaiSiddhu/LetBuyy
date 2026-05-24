'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Collection {
    id: string
    title: string
    description: string | null
    image_url: string | null
    is_active: boolean
    created_at: string
    product_count?: number
}

export default function CollectionsPage() {
    const { store } = useParams<{ store: string }>()

    const [collections, setCollections] = useState<Collection[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [creating, setCreating] = useState(false)

    const loadCollections = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setCollections(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => {
        loadCollections()
    }, [loadCollections])

    async function handleCreate() {
        if (!newTitle.trim()) return
        setCreating(true)

        await fetch(`/api/stores/${encodeURIComponent(store)}/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: newTitle.trim(),
                description: newDesc.trim() || null,
            }),
        })

        setNewTitle('')
        setNewDesc('')
        setShowCreate(false)
        loadCollections()
        setCreating(false)
    }

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
                <div className="products-page-header"><h1>Collections</h1></div>
                <div className="admin-skeleton" style={{ height: 200, borderRadius: 14 }} />
            </div>
        )
    }

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Collections</h1>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{
                        background: 'var(--text-primary)', color: 'var(--bg)',
                        padding: '8px 18px', borderRadius: 8, fontSize: 13,
                        fontWeight: 600, border: 'none', cursor: 'pointer'
                    }}
                >
                    Create collection
                </button>
            </div>

            {/* Create collection inline form */}
            {showCreate && (
                <div className="product-form-card" style={{ marginBottom: 20 }}>
                    <h3>New collection</h3>
                    <div className="product-field">
                        <label className="product-label">Title</label>
                        <input
                            type="text"
                            className="product-input"
                            placeholder="e.g. Summer Sale"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                        />
                    </div>
                    <div className="product-field">
                        <label className="product-label">Description</label>
                        <textarea
                            className="product-textarea"
                            placeholder="What is this collection about?"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            style={{ minHeight: 80 }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                            onClick={handleCreate}
                            disabled={creating || !newTitle.trim()}
                            style={{
                                background: 'var(--text-primary)', color: 'var(--bg)',
                                padding: '8px 18px', borderRadius: 8, fontSize: 13,
                                fontWeight: 600, border: 'none', cursor: 'pointer',
                                opacity: creating ? 0.6 : 1
                            }}
                        >
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                        <button
                            onClick={() => { setShowCreate(false); setNewTitle(''); setNewDesc('') }}
                            style={{
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                border: '1px solid var(--border)', padding: '8px 16px',
                                borderRadius: 8, fontSize: 13, cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {collections.length === 0 && !showCreate ? (
                <div className="products-empty-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 48, color: 'var(--text-hint)', marginBottom: 16
                    }}>folder_special</span>
                    <h2 style={{
                        fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px'
                    }}>No collections yet</h2>
                    <p style={{
                        fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px', maxWidth: 400, marginInline: 'auto'
                    }}>
                        Organize your products into collections to make it easier for customers to find what they&apos;re looking for.
                    </p>
                    <button
                        onClick={() => setShowCreate(true)}
                        style={{
                            background: 'var(--text-primary)', color: 'var(--bg)',
                            padding: '9px 20px', borderRadius: 8, fontSize: 13,
                            fontWeight: 600, border: 'none', cursor: 'pointer'
                        }}
                    >
                        Create collection
                    </button>
                </div>
            ) : collections.length > 0 && (
                <div className="products-list-card">
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Products</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {collections.map(c => (
                                <tr key={c.id}>
                                    <td>
                                        <div className="products-table-name">
                                            {c.image_url ? (
                                                <img src={c.image_url} alt={c.title} className="products-table-img" />
                                            ) : (
                                                <div className="products-table-img" style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <span className="material-symbols-outlined" style={{
                                                        fontSize: 18, color: 'var(--text-hint)'
                                                    }}>folder</span>
                                                </div>
                                            )}
                                            <span>{c.title}</span>
                                        </div>
                                    </td>
                                    <td>{c.product_count ?? 0} products</td>
                                    <td>
                                        <span className={`product-status-badge ${c.is_active ? 'active' : 'draft'}`}>
                                            <span className="product-status-dot" />
                                            {c.is_active ? 'Active' : 'Inactive'}
                                        </span>
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
