'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Post {
    id: string; title: string; slug: string; status: 'draft' | 'published' | 'archived'
    excerpt: string | null; content: string | null; featured_image: string | null
    published_at: string | null; created_at: string
}

export default function PostsPage() {
    const { store } = useParams<{ store: string }>()
    const supabase = createClient()
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [storeId, setStoreId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState<string>('all')
    const [formData, setFormData] = useState({ title: '', slug: '', excerpt: '', content: '', status: 'draft' as Post['status'] })

    const load = useCallback(async () => {
        const { data: s } = await supabase.from('sites').select('id').eq('store_name', store).single()
        if (!s) { setLoading(false); return }
        setStoreId(s.id)
        const { data } = await supabase.from('blog_posts').select('*').eq('store_id', s.id).order('created_at', { ascending: false })
        setPosts(data || [])
        setLoading(false)
    }, [store, supabase])

    useEffect(() => { load() }, [load])

    const genSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const handleSave = async () => {
        if (!storeId || !formData.title) return
        setSaving(true)
        const payload = {
            store_id: storeId, title: formData.title,
            slug: formData.slug || genSlug(formData.title),
            excerpt: formData.excerpt || null, content: formData.content || null,
            status: formData.status,
            published_at: formData.status === 'published' ? new Date().toISOString() : null,
        }
        if (editingId) await supabase.from('blog_posts').update(payload).eq('id', editingId)
        else await supabase.from('blog_posts').insert(payload)
        setSaving(false); setShowForm(false); setEditingId(null)
        setFormData({ title: '', slug: '', excerpt: '', content: '', status: 'draft' }); load()
    }

    const handleDelete = async (id: string) => { if (!confirm('Delete this post?')) return; await supabase.from('blog_posts').delete().eq('id', id); load() }
    const startEdit = (p: Post) => { setEditingId(p.id); setFormData({ title: p.title, slug: p.slug, excerpt: p.excerpt || '', content: p.content || '', status: p.status }); setShowForm(true) }
    const iS: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }
    const fD = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
    const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter)

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Blog Posts</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Blog Posts</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ title: '', slug: '', excerpt: '', content: '', status: 'draft' }) }} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>New post
                </button>
            </div>

            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Edit Post' : 'New Post'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <input type="text" placeholder="Post title" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} style={iS} />
                        <input type="text" placeholder="Slug (auto)" value={formData.slug || genSlug(formData.title)} onChange={e => setFormData(f => ({ ...f, slug: e.target.value }))} style={{ ...iS, color: 'var(--text-secondary)', fontSize: 13 }} />
                        <textarea placeholder="Excerpt" value={formData.excerpt} onChange={e => setFormData(f => ({ ...f, excerpt: e.target.value }))} rows={2} style={{ ...iS, resize: 'vertical' }} />
                        <textarea placeholder="Content (Markdown supported)" value={formData.content} onChange={e => setFormData(f => ({ ...f, content: e.target.value }))} rows={10} style={{ ...iS, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                        <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value as Post['status'] }))} style={iS}>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.title} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (saving || !formData.title) ? 0.5 : 1 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {posts.length === 0 && !showForm ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No blog posts yet</h2><p>Start writing to engage with your audience.</p></div></div></div>
            ) : posts.length > 0 && (
                <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {['all', 'draft', 'published', 'archived'].map(f => (
                            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', background: filter === f ? 'var(--text-primary)' : 'var(--bg)', color: filter === f ? 'var(--bg)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                                {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'all' ? `(${posts.length})` : `(${posts.filter(p => p.status === f).length})`}
                            </button>
                        ))}
                    </div>
                    <div className="products-list-card">
                        <table className="products-table">
                            <thead><tr><th>Title</th><th>Status</th><th>Date</th><th style={{ width: 90 }}>Actions</th></tr></thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p.id}>
                                        <td><div><span style={{ fontWeight: 500 }}>{p.title}</span>{p.excerpt && <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.excerpt}</div>}</div></td>
                                        <td><span className={`product-status-badge ${p.status === 'published' ? 'active' : p.status}`}><span className="product-status-dot" />{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span></td>
                                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fD(p.published_at || p.created_at)}</td>
                                        <td><div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span></button>
                                            <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span></button>
                                        </div></td>
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
