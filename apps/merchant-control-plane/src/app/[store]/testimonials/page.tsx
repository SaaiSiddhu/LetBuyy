'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon, Star } from '@letbuyy/ui'

interface Testimonial {
    id: string
    author_name: string
    author_title: string | null
    author_company: string | null
    author_avatar: string | null
    content: string
    rating: number | null
    is_featured: boolean
    is_visible: boolean
    display_order: number
    created_at: string
}

export default function TestimonialsPage() {
    const { store } = useParams<{ store: string }>()
    const [items, setItems] = useState<Testimonial[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({ author_name: '', author_title: '', author_company: '', content: '', rating: '5' })

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/testimonials`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setItems(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const handleSave = async () => {
        if (!formData.author_name || !formData.content) return
        setSaving(true)
        const payload = {
            author_name: formData.author_name, content: formData.content,
            author_title: formData.author_title || null,
            author_company: formData.author_company || null,
            rating: formData.rating ? parseInt(formData.rating) : null,
        }
        await fetch(
            editingId
                ? `/api/stores/${encodeURIComponent(store)}/content/testimonials/${encodeURIComponent(editingId)}`
                : `/api/stores/${encodeURIComponent(store)}/content/testimonials`,
            {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )
        setSaving(false); setShowForm(false); setEditingId(null)
        setFormData({ author_name: '', author_title: '', author_company: '', content: '', rating: '5' })
        load()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/content/testimonials/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        load()
    }
    const startEdit = (t: Testimonial) => { setEditingId(t.id); setFormData({ author_name: t.author_name, author_title: t.author_title || '', author_company: t.author_company || '', content: t.content, rating: t.rating ? String(t.rating) : '5' }); setShowForm(true) }
    const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }
    const renderStars = (rating: number | null) => {
        const safeRating = rating || 0
        return Array.from({ length: 5 }, (_, index) => (
            <Star
                key={index}
                size={16}
                fill={index < safeRating ? '#f59e0b' : 'none'}
                stroke={index < safeRating ? '#f59e0b' : 'var(--border)'}
                strokeWidth={index < safeRating ? 0 : 2}
            />
        ))
    }

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Testimonials</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Testimonials</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ author_name: '', author_title: '', author_company: '', content: '', rating: '5' }) }} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <MaterialIcon name="add" style={{ fontSize: 16 }} />Add testimonial
                </button>
            </div>

            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Edit Testimonial' : 'New Testimonial'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <input type="text" placeholder="Author name" value={formData.author_name} onChange={e => setFormData(f => ({ ...f, author_name: e.target.value }))} style={inputStyle} />
                        <input type="text" placeholder="Title/Role" value={formData.author_title} onChange={e => setFormData(f => ({ ...f, author_title: e.target.value }))} style={inputStyle} />
                        <input type="text" placeholder="Company" value={formData.author_company} onChange={e => setFormData(f => ({ ...f, author_company: e.target.value }))} style={inputStyle} />
                        <select value={formData.rating} onChange={e => setFormData(f => ({ ...f, rating: e.target.value }))} style={inputStyle}>
                            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} Star{n > 1 ? 's' : ''}</option>)}
                        </select>
                        <textarea placeholder="Testimonial content" value={formData.content} onChange={e => setFormData(f => ({ ...f, content: e.target.value }))} rows={4} style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical' }} />
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.author_name || !formData.content} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (saving || !formData.author_name) ? 0.5 : 1 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {items.length === 0 && !showForm ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No testimonials yet</h2><p>Collect and display client testimonials and recommendations.</p></div></div></div>
            ) : items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {items.map(t => (
                        <div key={t.id} className="products-list-card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>{renderStars(t.rating)}</div>
                            <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{t.content}"</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.author_name.charAt(0)}</div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.author_name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>{[t.author_title, t.author_company].filter(Boolean).join(' • ')}</div>
                                </div>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                    <button onClick={() => startEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><MaterialIcon name="edit" style={{ fontSize: 18 }} /></button>
                                    <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><MaterialIcon name="delete" style={{ fontSize: 18 }} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
