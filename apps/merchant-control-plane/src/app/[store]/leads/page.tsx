'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

interface Lead {
    id: string; full_name: string; email: string; phone: string | null
    source: string | null; status: string; data: Record<string, unknown>; created_at: string
}

export default function LeadsPage() {
    const { store } = useParams<{ store: string }>()
    const [items, setItems] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions?type=lead&limit=100`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setItems(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const updateStatus = async (id: string, status: string) => {
        await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        load()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        load()
    }
    const fD = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Leads</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header"><h1>Leads</h1><span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{items.length} total</span></div>

            {items.length === 0 ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No leads yet</h2><p>Form submissions and lead captures will appear here.</p></div></div></div>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {['all', 'new', 'read', 'contacted', 'converted'].map(f => (
                            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', background: filter === f ? 'var(--text-primary)' : 'var(--bg)', color: filter === f ? 'var(--bg)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="products-list-card">
                        <table className="products-table">
                            <thead><tr><th>Name</th><th>Email</th><th>Source</th><th>Date</th><th>Status</th><th style={{ width: 90 }}>Actions</th></tr></thead>
                            <tbody>
                                {filtered.map(l => (
                                    <tr key={l.id}>
                                        <td style={{ fontWeight: 500 }}>{l.full_name}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{l.email}</td>
                                        <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--bg-tertiary)' }}>{l.source || 'form'}</span></td>
                                        <td style={{ fontSize: 13, color: 'var(--text-hint)' }}>{fD(l.created_at)}</td>
                                        <td>
                                            <select value={l.status} onChange={e => updateStatus(l.id, e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                                                <option value="new">New</option>
                                                <option value="read">Read</option>
                                                <option value="contacted">Contacted</option>
                                                <option value="converted">Converted</option>
                                            </select>
                                        </td>
                                        <td><button onClick={() => handleDelete(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><MaterialIcon name="delete" style={{ fontSize: 18 }} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    )
}
