'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface ShippingZone {
    id: string
    name: string
    countries: string[]
}

interface ShippingRate {
    id: string
    zone_id: string
    name: string
    price: number
    min_order_amount: number | null
}

export default function ShippingSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [zones, setZones] = useState<ShippingZone[]>([])
    const [rates, setRates] = useState<ShippingRate[]>([])
    const [storeId, setStoreId] = useState('')
    const [showAdd, setShowAdd] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formName, setFormName] = useState('')
    const [formCountries, setFormCountries] = useState('')
    const [saving, setSaving] = useState(false)
    const supabase = createClient()

    const loadData = useCallback(async () => {
        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .or(`store_name.eq.${store},subdomain.eq.${store}`)
            .single()

        if (!storeData) { setLoading(false); return }
        setStoreId(storeData.id)

        const { data: zonesData } = await supabase
            .from('shipping_zones')
            .select('*')
            .eq('site_id', storeData.id)

        if (zonesData) setZones(zonesData)

        const { data: ratesData } = await supabase
            .from('shipping_rates')
            .select('*')
            .eq('site_id', storeData.id)

        if (ratesData) setRates(ratesData)
        setLoading(false)
    }, [store, supabase])

    useEffect(() => { loadData() }, [loadData])

    const handleAdd = async () => {
        if (!formName.trim()) return
        setSaving(true)
        const countries = formCountries.split(',').map(c => c.trim()).filter(Boolean)
        await supabase.from('shipping_zones').insert({
            site_id: storeId,
            name: formName.trim(),
            countries,
        })
        setShowAdd(false)
        resetForm()
        setSaving(false)
        await loadData()
    }

    const handleUpdate = async () => {
        if (!formName.trim() || !editingId) return
        setSaving(true)
        const countries = formCountries.split(',').map(c => c.trim()).filter(Boolean)
        await supabase.from('shipping_zones').update({
            name: formName.trim(),
            countries,
        }).eq('id', editingId)
        setEditingId(null)
        resetForm()
        setSaving(false)
        await loadData()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this shipping zone and all its rates?')) return
        await supabase.from('shipping_zones').delete().eq('id', id)
        setZones(prev => prev.filter(z => z.id !== id))
        setRates(prev => prev.filter(r => r.zone_id !== id))
    }

    const startEdit = (zone: ShippingZone) => {
        setEditingId(zone.id)
        setFormName(zone.name)
        setFormCountries((zone.countries || []).join(', '))
        setShowAdd(false)
    }

    const resetForm = () => {
        setFormName('')
        setFormCountries('')
    }

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 180, height: 28 }} /></div>
                <div className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 100 }} /></div>
            </div>
        )
    }

    const renderForm = (onSave: () => void, isEditing: boolean) => (
        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16 }}>
            <div className="settings-form-group" style={{ marginBottom: 12 }}>
                <label>Zone name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Domestic, International" />
            </div>
            <div className="settings-form-group" style={{ marginBottom: 12 }}>
                <label>Countries (comma-separated)</label>
                <input type="text" value={formCountries} onChange={(e) => setFormCountries(e.target.value)} placeholder="e.g. India, Nepal, Sri Lanka" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button className="settings-btn-primary" onClick={onSave} disabled={saving} style={{ padding: '7px 14px', fontSize: 12 }}>
                    {saving ? 'Saving...' : isEditing ? 'Update zone' : 'Add zone'}
                </button>
                <button className="settings-btn-secondary" onClick={() => { setShowAdd(false); setEditingId(null); resetForm() }} style={{ padding: '7px 14px', fontSize: 12 }}>Cancel</button>
            </div>
        </div>
    )

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Shipping and delivery</h1>
            </div>

            <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>Shipping zones</h2>
                    {!showAdd && !editingId && (
                        <button className="settings-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => setShowAdd(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                            Add zone
                        </button>
                    )}
                </div>

                {showAdd && renderForm(handleAdd, false)}

                {zones.length === 0 && !showAdd ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--text-hint)', display: 'block', marginBottom: 8 }}>local_shipping</span>
                        <p style={{ marginBottom: 12 }}>No shipping zones configured yet.</p>
                    </div>
                ) : (
                    zones.map(zone => {
                        const zoneRates = rates.filter(r => r.zone_id === zone.id)
                        if (editingId === zone.id) {
                            return <div key={zone.id}>{renderForm(handleUpdate, true)}</div>
                        }
                        return (
                            <div key={zone.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{zone.name}</strong>
                                        {zone.countries?.length > 0 && (
                                            <span style={{ fontSize: 12, color: 'var(--text-hint)', marginLeft: 8 }}>
                                                {zone.countries.join(', ')}
                                            </span>
                                        )}
                                        {zoneRates.length > 0 && (
                                            <span style={{ fontSize: 12, color: 'var(--text-hint)', marginLeft: 8 }}>
                                                · {zoneRates.length} rate{zoneRates.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="settings-btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => startEdit(zone)}>
                                            Edit
                                        </button>
                                        <button className="settings-btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--danger, #e53e3e)' }} onClick={() => handleDelete(zone.id)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <div className="settings-info-banner">
                <span className="material-symbols-outlined">info</span>
                <span>Shipping zones let you define rates for different regions. Customers see rates based on their delivery address.</span>
            </div>
        </div>
    )
}
