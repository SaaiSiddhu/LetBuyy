'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Education {
    id: string
    institution: string
    degree: string
    field_of_study: string | null
    start_date: string | null
    end_date: string | null
    grade: string | null
    description: string | null
    display_order: number
    created_at: string
}

export default function EducationPage() {
    const { store } = useParams<{ store: string }>()
    const supabase = createClient()
    const [items, setItems] = useState<Education[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [storeId, setStoreId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', grade: '', description: '' })

    const load = useCallback(async () => {
        const { data: s } = await supabase.from('sites').select('id').eq('store_name', store).single()
        if (!s) { setLoading(false); return }
        setStoreId(s.id)
        const { data } = await supabase.from('education').select('*').eq('site_id', s.id).order('display_order', { ascending: true })
        setItems(data || [])
        setLoading(false)
    }, [store, supabase])

    useEffect(() => { load() }, [load])

    const handleSave = async () => {
        if (!storeId || !formData.institution || !formData.degree) return
        setSaving(true)
        const payload = {
            site_id: storeId, institution: formData.institution, degree: formData.degree,
            field_of_study: formData.field_of_study || null,
            start_date: formData.start_date || null, end_date: formData.end_date || null,
            grade: formData.grade || null, description: formData.description || null,
        }
        if (editingId) await supabase.from('education').update(payload).eq('id', editingId)
        else await supabase.from('education').insert(payload)
        setSaving(false); setShowForm(false); setEditingId(null)
        setFormData({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', grade: '', description: '' })
        load()
    }

    const handleDelete = async (id: string) => { if (!confirm('Delete?')) return; await supabase.from('education').delete().eq('id', id); load() }
    const startEdit = (e: Education) => { setEditingId(e.id); setFormData({ institution: e.institution, degree: e.degree, field_of_study: e.field_of_study || '', start_date: e.start_date || '', end_date: e.end_date || '', grade: e.grade || '', description: e.description || '' }); setShowForm(true) }
    const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Education</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Education</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', grade: '', description: '' }) }} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>Add education
                </button>
            </div>

            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Edit Education' : 'New Education'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <input type="text" placeholder="Institution" value={formData.institution} onChange={e => setFormData(f => ({ ...f, institution: e.target.value }))} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
                        <input type="text" placeholder="Degree (e.g. B.Tech)" value={formData.degree} onChange={e => setFormData(f => ({ ...f, degree: e.target.value }))} style={inputStyle} />
                        <input type="text" placeholder="Field of Study" value={formData.field_of_study} onChange={e => setFormData(f => ({ ...f, field_of_study: e.target.value }))} style={inputStyle} />
                        <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Start</label><input type="month" value={formData.start_date} onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} /></div>
                        <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>End</label><input type="month" value={formData.end_date} onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} /></div>
                        <input type="text" placeholder="Grade / GPA" value={formData.grade} onChange={e => setFormData(f => ({ ...f, grade: e.target.value }))} style={inputStyle} />
                        <textarea placeholder="Description" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical' }} />
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.institution || !formData.degree} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (saving || !formData.institution) ? 0.5 : 1 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {items.length === 0 && !showForm ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No education yet</h2><p>Add your academic qualifications, degrees, and certifications.</p></div></div></div>
            ) : items.length > 0 && (
                <div className="products-list-card">
                    {items.map((e, i) => (
                        <div key={e.id} style={{ padding: '16px 20px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-hint)' }}>school</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.degree}{e.field_of_study ? ` in ${e.field_of_study}` : ''}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{e.institution}{e.grade ? ` • ${e.grade}` : ''}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 4 }}>{fmtDate(e.start_date)} — {fmtDate(e.end_date) || 'Present'}</div>
                                {e.description && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e.description}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <button onClick={() => startEdit(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span></button>
                                <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
