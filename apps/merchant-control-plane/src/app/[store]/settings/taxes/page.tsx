'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface TaxRate {
    id: string
    name: string
    rate: number
    country: string
    state: string | null
    is_compound: boolean
    is_shipping: boolean
    priority: number
    is_active: boolean
    created_at: string
}

export default function TaxesSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [taxData, setTaxData] = useState({ tax_inclusive: false })
    const [taxRates, setTaxRates] = useState<TaxRate[]>([])
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)

    // Add/Edit form state
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formName, setFormName] = useState('')
    const [formRate, setFormRate] = useState('')
    const [formCountry, setFormCountry] = useState('IN')
    const [formState, setFormState] = useState('')
    const [formCompound, setFormCompound] = useState(false)
    const [formShipping, setFormShipping] = useState(false)
    const [formActive, setFormActive] = useState(true)

    const loadData = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/taxes`, {
            cache: 'no-store',
        })
        const payload = await response.json()
        const data = payload.data

        setTaxData({ tax_inclusive: Boolean(data?.tax_inclusive) })
        setTaxRates(Array.isArray(data?.rates) ? data.rates : [])
        setLoading(false)
    }, [store])

    useEffect(() => { loadData() }, [loadData])

    const handleSaveSettings = async () => {
        setSaving(true)
        await fetch(`/api/stores/${encodeURIComponent(store)}/taxes`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tax_inclusive: taxData.tax_inclusive }),
        })
        setSaving(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
    }

    const resetForm = () => {
        setFormName('')
        setFormRate('')
        setFormCountry('IN')
        setFormState('')
        setFormCompound(false)
        setFormShipping(false)
        setFormActive(true)
        setEditingId(null)
        setShowForm(false)
    }

    const handleAddRate = async () => {
        if (!formName.trim() || !formRate) return
        setSaving(true)
        await fetch(`/api/stores/${encodeURIComponent(store)}/taxes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            name: formName.trim(),
            rate: parseFloat(formRate) / 100,
            country: formCountry || 'IN',
            state: formState || null,
            is_compound: formCompound,
            is_shipping: formShipping,
            is_active: formActive,
            }),
        })
        resetForm()
        setSaving(false)
        await loadData()
    }

    const handleUpdateRate = async () => {
        if (!formName.trim() || !formRate || !editingId) return
        setSaving(true)
        await fetch(`/api/stores/${encodeURIComponent(store)}/taxes/${encodeURIComponent(editingId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formName.trim(),
                rate: parseFloat(formRate) / 100,
                country: formCountry || 'IN',
                state: formState || null,
                is_compound: formCompound,
                is_shipping: formShipping,
                is_active: formActive,
            }),
        })
        resetForm()
        setSaving(false)
        await loadData()
    }

    const handleDeleteRate = async (id: string) => {
        if (!confirm('Delete this tax rate?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/taxes/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        setTaxRates(prev => prev.filter(r => r.id !== id))
    }

    const startEdit = (rate: TaxRate) => {
        setEditingId(rate.id)
        setFormName(rate.name)
        setFormRate(String(Math.round(rate.rate * 10000) / 100))
        setFormCountry(rate.country)
        setFormState(rate.state || '')
        setFormCompound(rate.is_compound)
        setFormShipping(rate.is_shipping)
        setFormActive(rate.is_active)
        setShowForm(true)
    }

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 140, height: 28 }} /></div>
                <div className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 80 }} /></div>
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Taxes and duties</h1>
            </div>

            {success && (
                <div className="settings-toast success">
                    <span className="material-symbols-outlined">check_circle</span>
                    Tax settings saved.
                </div>
            )}

            {/* Tax inclusive toggle */}
            <div className="settings-card">
                <h2>Tax region</h2>
                <p style={{ marginBottom: 16 }}>India (default)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                        type="checkbox"
                        id="tax-inclusive"
                        checked={taxData.tax_inclusive}
                        onChange={(e) => setTaxData({ tax_inclusive: e.target.checked })}
                        style={{ accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="tax-inclusive" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        All prices include tax
                    </label>
                </div>
            </div>

            {/* Tax rates CRUD */}
            <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>Tax rates</h2>
                    {!showForm && (
                        <button className="settings-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => { resetForm(); setShowForm(true) }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                            Add tax rate
                        </button>
                    )}
                </div>

                {showForm && (
                    <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div className="settings-form-group">
                                <label>Tax name</label>
                                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. GST 18%" />
                            </div>
                            <div className="settings-form-group">
                                <label>Rate (%)</label>
                                <input type="number" step="0.01" value={formRate} onChange={e => setFormRate(e.target.value)} placeholder="e.g. 18" />
                            </div>
                            <div className="settings-form-group">
                                <label>Country</label>
                                <input type="text" value={formCountry} onChange={e => setFormCountry(e.target.value)} placeholder="IN" />
                            </div>
                            <div className="settings-form-group">
                                <label>State (optional)</label>
                                <input type="text" value={formState} onChange={e => setFormState(e.target.value)} placeholder="e.g. TN" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                                <input type="checkbox" checked={formCompound} onChange={e => setFormCompound(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                                Compound tax
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                                <input type="checkbox" checked={formShipping} onChange={e => setFormShipping(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                                Apply to shipping
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                                <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                                Active
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="settings-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={editingId ? handleUpdateRate : handleAddRate} disabled={saving}>
                                {saving ? 'Saving...' : editingId ? 'Update' : 'Add rate'}
                            </button>
                            <button className="settings-btn-secondary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={resetForm}>Cancel</button>
                        </div>
                    </div>
                )}

                {taxRates.length === 0 && !showForm ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--text-hint)', display: 'block', marginBottom: 8 }}>receipt_long</span>
                        <p style={{ marginBottom: 12 }}>No tax rates configured yet.</p>
                        <p style={{ fontSize: 12, color: 'var(--text-hint)' }}>Add GST or other tax rates to apply to your products.</p>
                    </div>
                ) : (
                    <div>
                        {taxRates.map(rate => (
                            <div key={rate.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{rate.name}</strong>
                                    <span style={{ fontSize: 13, color: 'var(--primary)', marginLeft: 8, fontWeight: 600 }}>
                                        {Math.round(rate.rate * 10000) / 100}%
                                    </span>
                                    <span style={{ fontSize: 12, color: 'var(--text-hint)', marginLeft: 8 }}>
                                        {rate.country}{rate.state ? ` / ${rate.state}` : ''}
                                    </span>
                                    {rate.is_compound && <span style={{ fontSize: 10, color: 'var(--text-hint)', marginLeft: 6, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>Compound</span>}
                                    {rate.is_shipping && <span style={{ fontSize: 10, color: 'var(--text-hint)', marginLeft: 6, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>+Shipping</span>}
                                    {!rate.is_active && <span style={{ fontSize: 10, color: 'var(--danger, #e53e3e)', marginLeft: 6 }}>Inactive</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="settings-btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => startEdit(rate)}>Edit</button>
                                    <button className="settings-btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--danger, #e53e3e)' }} onClick={() => handleDeleteRate(rate.id)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="settings-info-banner">
                <span className="material-symbols-outlined">info</span>
                <span>Tax rates are applied during checkout. Compound taxes are calculated on top of other taxes. Enable "Apply to shipping" to tax shipping costs.</span>
            </div>

            <div className="settings-save-bar">
                <button onClick={handleSaveSettings} className="settings-btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}
