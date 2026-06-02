'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

interface Submission {
    id: string; full_name: string; email: string; phone: string | null
    subject: string | null; message: string; status: string; created_at: string
}

export default function ContactPage() {
    const { store } = useParams<{ store: string }>()
    const [items, setItems] = useState<Submission[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Submission | null>(null)

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions?type=contact&limit=100`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setItems(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const markRead = async (id: string) => {
        await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'read' }),
        })
        load()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        setSelected(null); load()
    }

    const fD = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Contact Submissions</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Contact Submissions</h1>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{items.filter(i => i.status === 'new').length} unread</span>
            </div>

            {items.length === 0 ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No submissions yet</h2><p>Contact form submissions from your site will appear here.</p></div></div></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
                    <div className="products-list-card">
                        {items.map((s, i) => (
                            <div key={s.id} onClick={() => { setSelected(s); if (s.status === 'new') markRead(s.id) }}
                                style={{ padding: '14px 20px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: selected?.id === s.id ? 'var(--bg-tertiary)' : s.status === 'new' ? 'var(--bg-secondary)' : 'transparent' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontWeight: s.status === 'new' ? 600 : 400, fontSize: 14 }}>{s.full_name}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>{fD(s.created_at)}</span>
                                </div>
                                {s.subject && <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{s.subject}</div>}
                                <div style={{ fontSize: 12, color: 'var(--text-hint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.message}</div>
                            </div>
                        ))}
                    </div>
                    {selected && (
                        <div className="products-list-card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{selected.subject || 'No subject'}</h3>
                                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-hint)' }}><MaterialIcon name="close" style={{ fontSize: 20 }} /></button>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}><strong>{selected.full_name}</strong> • {selected.email}{selected.phone ? ` • ${selected.phone}` : ''}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 16 }}>{fD(selected.created_at)}</div>
                            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>{selected.message}</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <a href={`mailto:${selected.email}`} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, background: 'var(--text-primary)', color: 'var(--bg)', textDecoration: 'none', fontWeight: 500 }}>Reply</a>
                                <button onClick={() => handleDelete(selected.id)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, background: '#ef444422', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Delete</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
