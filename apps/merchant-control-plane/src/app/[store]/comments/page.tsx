'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Comment {
    id: string; post_id: string; post_title?: string; author_name: string
    author_email: string; content: string; status: 'pending' | 'approved' | 'spam'
    created_at: string
}

export default function CommentsPage() {
    const { store } = useParams<{ store: string }>()
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/blog-comments?limit=100`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setComments(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const updateStatus = async (id: string, status: string) => {
        await fetch(`/api/stores/${encodeURIComponent(store)}/blog-comments/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        load()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this comment?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/blog-comments/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        load()
    }

    const fD = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const filtered = filter === 'all' ? comments : comments.filter(c => c.status === filter)

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Comments</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header"><h1>Comments</h1></div>

            {comments.length === 0 ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No comments yet</h2><p>When readers comment on your blog posts, they'll appear here for moderation.</p></div></div></div>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {['all', 'pending', 'approved', 'spam'].map(f => (
                            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', background: filter === f ? 'var(--text-primary)' : 'var(--bg)', color: filter === f ? 'var(--bg)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                                {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? comments.length : comments.filter(c => c.status === f).length})
                            </button>
                        ))}
                    </div>
                    <div className="products-list-card">
                        {filtered.map((c, i) => (
                            <div key={c.id} style={{ padding: '16px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div>
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>{c.author_name}</span>
                                        <span style={{ fontSize: 12, color: 'var(--text-hint)', marginLeft: 8 }}>{c.author_email}</span>
                                    </div>
                                    <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>{fD(c.created_at)}</span>
                                </div>
                                {c.post_title && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>on <strong>{c.post_title}</strong></div>}
                                <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)' }}>{c.content}</p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {c.status !== 'approved' && <button onClick={() => updateStatus(c.id, 'approved')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: '#22c55e22', color: '#22c55e', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Approve</button>}
                                    {c.status !== 'spam' && <button onClick={() => updateStatus(c.id, 'spam')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: '#f59e0b22', color: '#f59e0b', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Spam</button>}
                                    <button onClick={() => handleDelete(c.id)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: '#ef444422', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Delete</button>
                                </div>
                            </div>
                        ))}
                        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-hint)', fontSize: 14 }}>No {filter} comments</div>}
                    </div>
                </>
            )}
        </div>
    )
}
