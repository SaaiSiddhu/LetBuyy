'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

interface Project {
    id: string
    title: string
    description: string | null
    url: string | null
    image_url: string | null
    technologies: string[]
    display_order: number
    is_visible: boolean
    start_date: string | null
    end_date: string | null
    created_at: string
}

export default function ProjectsPage() {
    const { store } = useParams<{ store: string }>()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({ title: '', description: '', url: '', technologies: '' })

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/projects`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        setProjects(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const handleSave = async () => {
        if (!formData.title) return
        setSaving(true)
        const payload = {
            title: formData.title,
            description: formData.description || null,
            url: formData.url || null,
            technologies: formData.technologies ? formData.technologies.split(',').map(t => t.trim()) : [],
        }
        await fetch(
            editingId
                ? `/api/stores/${encodeURIComponent(store)}/content/projects/${encodeURIComponent(editingId)}`
                : `/api/stores/${encodeURIComponent(store)}/content/projects`,
            {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }
        )
        setSaving(false); setShowForm(false); setEditingId(null)
        setFormData({ title: '', description: '', url: '', technologies: '' })
        load()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this project?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/content/projects/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        load()
    }

    const startEdit = (p: Project) => {
        setEditingId(p.id)
        setFormData({ title: p.title, description: p.description || '', url: p.url || '', technologies: (p.technologies || []).join(', ') })
        setShowForm(true)
    }

    const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Projects</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Projects</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ title: '', description: '', url: '', technologies: '' }) }} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <MaterialIcon name="add" style={{ fontSize: 16 }} />Add project
                </button>
            </div>

            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Edit Project' : 'New Project'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <input type="text" placeholder="Project title" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
                        <textarea placeholder="Description" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        <input type="url" placeholder="Project URL" value={formData.url} onChange={e => setFormData(f => ({ ...f, url: e.target.value }))} style={inputStyle} />
                        <input type="text" placeholder="Technologies (comma-separated)" value={formData.technologies} onChange={e => setFormData(f => ({ ...f, technologies: e.target.value }))} style={inputStyle} />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.title} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (saving || !formData.title) ? 0.5 : 1 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {projects.length === 0 && !showForm ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No projects yet</h2><p>Add case studies and portfolio projects to showcase your work.</p></div></div></div>
            ) : projects.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {projects.map(p => (
                        <div key={p.id} className="products-list-card" style={{ padding: 16 }}>
                            {p.image_url && <img src={p.image_url} alt={p.title} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />}
                            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>{p.title}</h3>
                            {p.description && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>}
                            {p.technologies?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                                    {p.technologies.map((t, i) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{t}</span>)}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                {p.url && <a href={p.url} target="_blank" rel="noopener" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}><MaterialIcon name="open_in_new" style={{ fontSize: 18 }} /></a>}
                                <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><MaterialIcon name="edit" style={{ fontSize: 18 }} /></button>
                                <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><MaterialIcon name="delete" style={{ fontSize: 18 }} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
