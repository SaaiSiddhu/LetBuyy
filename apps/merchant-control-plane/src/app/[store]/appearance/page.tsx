'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

export default function AppearancePage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        primary_color: '#6366f1', font_family: 'Inter', border_radius: '8',
        logo_url: '', favicon_url: '', custom_css: ''
    })

    const load = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        const s = payload.data
        if (!s) { setLoading(false); return }
        const settings = (s.site_settings || {}) as Record<string, unknown>
        setForm({
            primary_color: String(settings.primary_color || '#6366f1'),
            font_family: String(settings.font_family || 'Inter'),
            border_radius: String(settings.border_radius || '8'),
            logo_url: String(settings.logo_url || ''),
            favicon_url: String(settings.favicon_url || ''),
            custom_css: String(settings.custom_css || ''),
        })
        setLoading(false)
    }, [store])

    useEffect(() => { load() }, [load])

    const handleSave = async () => {
        setSaving(true)
        await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                site_settings: { ...form, border_radius: parseInt(form.border_radius) },
            }),
        })
        setSaving(false)
    }

    const iS: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }
    const fonts = ['Inter', 'Roboto', 'Outfit', 'Poppins', 'DM Sans', 'Space Grotesk', 'Playfair Display', 'Lora', 'Merriweather']

    if (loading) return <div className="setup-dashboard" style={{ padding: '24px 32px' }}><div className="products-page-header"><h1>Appearance</h1></div><div className="admin-skeleton" style={{ height: 400, borderRadius: 14 }} /></div>

    return (
        <div className="setup-dashboard" style={{ maxWidth: 720, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Appearance</h1>
                <button onClick={handleSave} disabled={saving} style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Saving...' : 'Save changes'}
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Colors */}
                <div className="products-list-card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Brand Colors</h3>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} style={{ width: 48, height: 48, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>Primary Color</div>
                            <input type="text" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} style={{ ...iS, width: 120, fontSize: 13, fontFamily: 'monospace', marginTop: 4 }} />
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                            {['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'].map(c => (
                                <button key={c} onClick={() => setForm(f => ({ ...f, primary_color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.primary_color === c ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Typography */}
                <div className="products-list-card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Typography</h3>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Font Family</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {fonts.map(f => (
                            <button key={f} onClick={() => setForm(d => ({ ...d, font_family: f }))} style={{ padding: '10px 14px', borderRadius: 8, border: form.font_family === f ? '2px solid var(--text-primary)' : '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontFamily: f, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Border Radius */}
                <div className="products-list-card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Border Radius</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input type="range" min="0" max="24" value={form.border_radius} onChange={e => setForm(f => ({ ...f, border_radius: e.target.value }))} style={{ flex: 1 }} />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 40 }}>{form.border_radius}px</span>
                        <div style={{ width: 48, height: 48, background: 'var(--bg-tertiary)', borderRadius: `${form.border_radius}px`, border: '1px solid var(--border)' }} />
                    </div>
                </div>

                {/* Branding */}
                <div className="products-list-card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Branding</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Logo URL</label><input type="url" placeholder="https://..." value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} style={iS} /></div>
                        <div><label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Favicon URL</label><input type="url" placeholder="https://..." value={form.favicon_url} onChange={e => setForm(f => ({ ...f, favicon_url: e.target.value }))} style={iS} /></div>
                    </div>
                </div>

                {/* Custom CSS */}
                <div className="products-list-card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Custom CSS</h3>
                    <textarea value={form.custom_css} onChange={e => setForm(f => ({ ...f, custom_css: e.target.value }))} rows={6} placeholder="/* Add custom CSS */" style={{ ...iS, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }} />
                </div>
            </div>
        </div>
    )
}
