'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Skill {
    id: string; name: string; category: string | null; proficiency: number; display_order: number
}

export default function SkillsPage() {
    const { store } = useParams<{ store: string }>()
    const supabase = createClient()
    const [items, setItems] = useState<Skill[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [storeId, setStoreId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({ name: '', category: '', proficiency: '80' })

    const load = useCallback(async () => {
        const { data: s } = await supabase.from('sites').select('id').eq('store_name', store).single()
        if (!s) { setLoading(false); return }
        setStoreId(s.id)
        const { data } = await supabase.from('skills').select('*').eq('site_id', s.id).order('display_order', { ascending: true })
        setItems(data || [])
        setLoading(false)
    }, [store, supabase])

    useEffect(() => { load() }, [load])

    const handleSave = async () => {
        if (!storeId || !formData.name) return
        setSaving(true)
        const payload = { site_id: storeId, name: formData.name, category: formData.category || null, proficiency: parseInt(formData.proficiency) || 80 }
        if (editingId) await supabase.from('skills').update(payload).eq('id', editingId)
        else await supabase.from('skills').insert(payload)
        setSaving(false); setShowForm(false); setEditingId(null); setFormData({ name: '', category: '', proficiency: '80' }); load()
    }

    const handleDelete = async (id: string) => { if (!confirm('Delete?')) return; await supabase.from('skills').delete().eq('id', id); load() }
    const startEdit = (s: Skill) => { setEditingId(s.id); setFormData({ name: s.name, category: s.category || '', proficiency: String(s.proficiency) }); setShowForm(true) }
    const iS: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }
    const grouped = items.reduce<Record<string, Skill[]>>((a, s) => { const c = s.category || 'Other'; if (!a[c]) a[c] = []; a[c].push(s); return a }, {})
    const pC = (p: number) => p >= 80 ? '#22c55e' : p >= 60 ? '#3b82f6' : p >= 40 ? '#f59e0b' : '#ef4444'

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Skills</h1></div><div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Skills</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', category: '', proficiency: '80' }) }} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>Add skill
                </button>
            </div>

            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Edit Skill' : 'New Skill'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <input type="text" placeholder="Skill name" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} style={iS} />
                        <input type="text" placeholder="Category" value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))} style={iS} />
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}><span>Proficiency</span><span>{formData.proficiency}%</span></label>
                            <input type="range" min="0" max="100" value={formData.proficiency} onChange={e => setFormData(f => ({ ...f, proficiency: e.target.value }))} style={{ width: '100%' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.name} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (saving || !formData.name) ? 0.5 : 1 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {items.length === 0 && !showForm ? (
                <div className="products-empty-card"><div className="products-empty-inner"><div className="products-empty-text"><h2>No skills yet</h2><p>List your professional skills and proficiency levels.</p></div></div></div>
            ) : items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {Object.entries(grouped).map(([cat, skills]) => (
                        <div key={cat} className="products-list-card" style={{ padding: 20 }}>
                            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{cat}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {skills.map(s => (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontSize: 14, fontWeight: 500, minWidth: 120 }}>{s.name}</span>
                                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                            <div style={{ width: `${s.proficiency}%`, height: '100%', borderRadius: 4, background: pC(s.proficiency) }} />
                                        </div>
                                        <span style={{ fontSize: 12, color: 'var(--text-hint)', minWidth: 36, textAlign: 'right' }}>{s.proficiency}%</span>
                                        <button onClick={() => startEdit(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span></button>
                                        <button onClick={() => handleDelete(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
