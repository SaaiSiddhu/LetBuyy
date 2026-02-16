'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface PaymentMethod {
    id: string
    provider: string
    is_active: boolean
    mode: string
}

const PROVIDERS = [
    { value: 'razorpay', label: 'Razorpay', desc: 'UPI, cards, net banking (India)' },
    { value: 'stripe', label: 'Stripe', desc: 'Cards, wallets (Global)' },
    { value: 'paypal', label: 'PayPal', desc: 'PayPal accounts & cards' },
    { value: 'cod', label: 'Cash on Delivery', desc: 'Pay at delivery' },
]

export default function PaymentsSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [storeId, setStoreId] = useState('')
    const [showAdd, setShowAdd] = useState(false)
    const [newProvider, setNewProvider] = useState('razorpay')
    const [newMode, setNewMode] = useState('test')
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

        const { data: paymentData } = await supabase
            .from('payment_methods')
            .select('id, provider, is_active, mode')
            .eq('site_id', storeData.id)

        if (paymentData) setMethods(paymentData)
        setLoading(false)
    }, [store, supabase])

    useEffect(() => { loadData() }, [loadData])

    const handleAdd = async () => {
        setSaving(true)
        await supabase.from('payment_methods').insert({
            site_id: storeId,
            provider: newProvider,
            mode: newMode,
            is_active: true,
        })
        setShowAdd(false)
        setNewProvider('razorpay')
        setNewMode('test')
        setSaving(false)
        await loadData()
    }

    const toggleActive = async (id: string, current: boolean) => {
        await supabase.from('payment_methods').update({ is_active: !current }).eq('id', id)
        setMethods(prev => prev.map(m => m.id === id ? { ...m, is_active: !current } : m))
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Remove this payment provider?')) return
        await supabase.from('payment_methods').delete().eq('id', id)
        setMethods(prev => prev.filter(m => m.id !== id))
    }

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 120, height: 28 }} /></div>
                <div className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 100 }} /></div>
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Payments</h1>
            </div>

            <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>Payment providers</h2>
                    {!showAdd && (
                        <button className="settings-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => setShowAdd(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                            Add provider
                        </button>
                    )}
                </div>

                {showAdd && (
                    <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16 }}>
                        <div className="settings-form-group" style={{ marginBottom: 12 }}>
                            <label>Provider</label>
                            <select value={newProvider} onChange={(e) => setNewProvider(e.target.value)}>
                                {PROVIDERS.map(p => (
                                    <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>
                                ))}
                            </select>
                        </div>
                        <div className="settings-form-group" style={{ marginBottom: 12 }}>
                            <label>Mode</label>
                            <select value={newMode} onChange={(e) => setNewMode(e.target.value)}>
                                <option value="test">Test mode</option>
                                <option value="live">Live mode</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="settings-btn-primary" onClick={handleAdd} disabled={saving} style={{ padding: '7px 14px', fontSize: 12 }}>
                                {saving ? 'Adding...' : 'Add provider'}
                            </button>
                            <button className="settings-btn-secondary" onClick={() => setShowAdd(false)} style={{ padding: '7px 14px', fontSize: 12 }}>Cancel</button>
                        </div>
                    </div>
                )}

                {methods.length === 0 && !showAdd ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--text-hint)', display: 'block', marginBottom: 8 }}>payments</span>
                        <p style={{ marginBottom: 12 }}>No payment providers configured yet.</p>
                    </div>
                ) : (
                    methods.map(method => (
                        <div key={method.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                                    {method.provider.charAt(0).toUpperCase() + method.provider.slice(1)}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                                    {method.mode === 'test' ? 'Test mode' : 'Live mode'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span
                                    className={`settings-badge ${method.is_active ? 'connected' : 'pending'}`}
                                    onClick={() => toggleActive(method.id, method.is_active)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {method.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <button className="settings-btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--danger, #e53e3e)' }} onClick={() => handleDelete(method.id)}>Remove</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="settings-info-banner">
                <span className="material-symbols-outlined">info</span>
                <span>Payment providers allow your customers to pay using credit cards, UPI, net banking, and more.</span>
            </div>
        </div>
    )
}
