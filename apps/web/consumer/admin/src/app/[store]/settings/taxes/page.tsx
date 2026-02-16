'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

export default function TaxesSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [taxData, setTaxData] = useState({ tax_inclusive: false })
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [storeId, setStoreId] = useState('')
    const supabase = createClient()

    useEffect(() => {
        async function load() {
            // Store ownership is already validated by the server-side [store]/layout.tsx
            const { data } = await supabase
                .from('sites')
                .select('id, tax_inclusive')
                .or(`store_name.eq.${store},subdomain.eq.${store}`)
                .single()

            if (data) {
                setStoreId(data.id)
                setTaxData({ tax_inclusive: data.tax_inclusive || false })
            }
            setLoading(false)
        }
        load()
    }, [store, supabase])

    const handleSave = async () => {
        setSaving(true)
        await supabase.from('sites').update({ tax_inclusive: taxData.tax_inclusive }).eq('id', storeId)
        setSaving(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
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

            <div className="settings-info-banner">
                <span className="material-symbols-outlined">info</span>
                <span>GST rates are automatically applied based on product categories. Advanced tax configuration will be available soon.</span>
            </div>

            <div className="settings-save-bar">
                <button onClick={handleSave} className="settings-btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}
