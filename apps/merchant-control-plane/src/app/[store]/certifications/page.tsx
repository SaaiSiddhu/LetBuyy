'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Cert {
    id: string; name: string; issuer: string; credential_id: string | null
    credential_url: string | null; issue_date: string | null; expiry_date: string | null
    display_order: number
}

export default function CertificationsPage() {
    const { store } = useParams<{ store: string }>()
    const [items, setItems] = useState<Cert[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({ name: '', issuer: '', credential_id: '', credential_url: '', issue_date: '', expiry_date: '' })

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/certifications`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setItems(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const handleSave = async () => {
        if (!formData.name || !formData.issuer) return
        setSaving(true)
        const payload = {
            name: formData.name, issuer: formData.issuer,
            credential_id: formData.credential_id || null, credential_url: formData.credential_url || null,
            issue_date: formData.issue_date || null, expiry_date: formData.expiry_date || null,
        }
        await fetch(
            editingId
                ? `/api/stores/${encodeURIComponent(store)}/content/certifications/${encodeURIComponent(editingId)}`
                : `/api/stores/${encodeURIComponent(store)}/content/certifications`,
            {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )
        setSaving(false); setShowForm(false); setEditingId(null)
        setFormData({ name: '', issuer: '', credential_id: '', credential_url: '', issue_date: '', expiry_date: '' }); load()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/content/certifications/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        load()
    }
    const startEdit = (c: Cert) => { setEditingId(c.id); setFormData({ name: c.name, issuer: c.issuer, credential_id: c.credential_id || '', credential_url: c.credential_url || '', issue_date: c.issue_date || '', expiry_date: c.expiry_date || '' }); setShowForm(true) }
    const iS: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }
    const fD = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Certifications</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Certifications</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', issuer: '', credential_id: '', credential_url: '', issue_date: '', expiry_date: '' }) }} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>Add certification
                </button>
            </div>

            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Edit' : 'New'} Certification</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <input type="text" placeholder="Certification name" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} style={iS} />
                        <input type="text" placeholder="Issuing organization" value={formData.issuer} onChange={e => setFormData(f => ({ ...f, issuer: e.target.value }))} style={iS} />
                        <input type="text" placeholder="Credential ID" value={formData.credential_id} onChange={e => setFormData(f => ({ ...f, credential_id: e.target.value }))} style={iS} />
                        <input type="url" placeholder="Credential URL" value={formData.credential_url} onChange={e => setFormData(f => ({ ...f, credential_url: e.target.value }))} style={iS} />
                        <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Issued</label><input type="month" value={formData.issue_date} onChange={e => setFormData(f => ({ ...f, issue_date: e.target.value }))} style={iS} /></div>
                        <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Expires</label><input type="month" value={formData.expiry_date} onChange={e => setFormData(f => ({ ...f, expiry_date: e.target.value }))} style={iS} /></div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.name} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (saving || !formData.name) ? 0.5 : 1 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {items.length === 0 && !showForm ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No certifications yet</h2><p>Showcase your professional certifications and credentials.</p></div></div></div>
            ) : items.length > 0 && (
                <div className="products-list-card">
                    {items.map((c, i) => (
                        <div key={c.id} style={{ padding: '16px 20px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-hint)' }}>verified</span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{c.issuer}{c.credential_id ? ` • ${c.credential_id}` : ''}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 4 }}>Issued {fD(c.issue_date)}{c.expiry_date ? ` • Expires ${fD(c.expiry_date)}` : ''}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                {c.credential_url && <a href={c.credential_url} target="_blank" rel="noopener" style={{ padding: 4, color: 'var(--text-secondary)', display: 'flex' }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span></a>}
                                <button onClick={() => startEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span></button>
                                <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
