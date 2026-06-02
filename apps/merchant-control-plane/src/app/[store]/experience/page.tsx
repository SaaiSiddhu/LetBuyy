'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

interface Experience {
    id: string
    company: string
    role: string
    description: string | null
    location: string | null
    start_date: string | null
    end_date: string | null
    is_current: boolean
    display_order: number
    created_at: string
}

export default function ExperiencePage() {
    const { store } = useParams<{ store: string }>()
    const [items, setItems] = useState<Experience[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({ company: '', role: '', description: '', location: '', start_date: '', end_date: '', is_current: false })

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/work_experience`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setItems(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const handleSave = async () => {
        if (!formData.company || !formData.role) return
        setSaving(true)
        const payload = {
            company: formData.company, role: formData.role,
            description: formData.description || null, location: formData.location || null,
            start_date: formData.start_date || null, end_date: formData.is_current ? null : (formData.end_date || null),
            is_current: formData.is_current,
        }
        await fetch(
            editingId
                ? `/api/stores/${encodeURIComponent(store)}/content/work_experience/${encodeURIComponent(editingId)}`
                : `/api/stores/${encodeURIComponent(store)}/content/work_experience`,
            {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )
        setSaving(false); setShowForm(false); setEditingId(null)
        setFormData({ company: '', role: '', description: '', location: '', start_date: '', end_date: '', is_current: false })
        load()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/content/work_experience/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        load()
    }
    const startEdit = (e: Experience) => { setEditingId(e.id); setFormData({ company: e.company, role: e.role, description: e.description || '', location: e.location || '', start_date: e.start_date || '', end_date: e.end_date || '', is_current: e.is_current }); setShowForm(true) }
    const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Experience</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Experience</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ company: '', role: '', description: '', location: '', start_date: '', end_date: '', is_current: false }) }} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <MaterialIcon name="add" style={{ fontSize: 16 }} />Add experience
                </button>
            </div>

            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Edit Experience' : 'New Experience'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <input type="text" placeholder="Company" value={formData.company} onChange={e => setFormData(f => ({ ...f, company: e.target.value }))} style={inputStyle} />
                        <input type="text" placeholder="Role / Title" value={formData.role} onChange={e => setFormData(f => ({ ...f, role: e.target.value }))} style={inputStyle} />
                        <input type="text" placeholder="Location" value={formData.location} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))} style={inputStyle} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" id="is-current" checked={formData.is_current} onChange={e => setFormData(f => ({ ...f, is_current: e.target.checked }))} />
                            <label htmlFor="is-current" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Currently working here</label>
                        </div>
                        <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Start Date</label><input type="month" value={formData.start_date} onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} /></div>
                        {!formData.is_current && <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>End Date</label><input type="month" value={formData.end_date} onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} /></div>}
                        <textarea placeholder="Description & key achievements" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={4} style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical' }} />
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.company || !formData.role} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (saving || !formData.company) ? 0.5 : 1 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {items.length === 0 && !showForm ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No experience yet</h2><p>Add your work experience, roles, and key achievements.</p></div></div></div>
            ) : items.length > 0 && (
                <div className="products-list-card">
                    {items.map((e, i) => (
                        <div key={e.id} style={{ padding: '16px 20px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <MaterialIcon name="work" style={{ fontSize: 20, color: 'var(--text-hint)' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.role}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{e.company}{e.location ? ` • ${e.location}` : ''}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 4 }}>{fmtDate(e.start_date)} — {e.is_current ? 'Present' : fmtDate(e.end_date)}</div>
                                {e.description && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e.description}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <button onClick={() => startEdit(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><MaterialIcon name="edit" style={{ fontSize: 18 }} /></button>
                                <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><MaterialIcon name="delete" style={{ fontSize: 18 }} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
