'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface GeneralData {
    id: string
    store_name: string
    name: string
    description: string
    subdomain: string
    custom_domain: string
    currency: string
    site_type: string
}

export default function GeneralSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [data, setData] = useState<GeneralData>({
        id: '',
        store_name: '',
        name: '',
        description: '',
        subdomain: '',
        custom_domain: '',
        currency: 'INR',
        site_type: 'store',
    })

    // Load store data on mount — createClient() inside effect to avoid re-creation
    useEffect(() => {
        async function load() {
            const supabase = createClient()
            // Store ownership is already validated by the server-side [store]/layout.tsx
            const { data: storeData } = await supabase
                .from('sites')
                .select('id, name, store_name, subdomain, custom_domain, currency, site_type, description')
                .or(`store_name.eq.${store},subdomain.eq.${store}`)
                .single()

            if (storeData) {
                setData({
                    id: storeData.id,
                    store_name: storeData.store_name || '',
                    name: storeData.name || storeData.store_name || '',
                    description: storeData.description || '',
                    subdomain: storeData.subdomain || storeData.store_name || '',
                    custom_domain: storeData.custom_domain || '',
                    currency: storeData.currency || 'INR',
                    site_type: storeData.site_type || 'store',
                })
            }
            setLoading(false)
        }
        load()
    }, [store])

    const handleSave = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setSuccess(false)

        const supabase = createClient()
        await supabase.from('sites').update({
            name: data.name,
            description: data.description,
            currency: data.currency,
        }).eq('id', data.id)

        setSaving(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
    }, [data])

    const handleDelete = useCallback(async () => {
        if (!confirm(`Are you sure you want to delete "${data.name}"? This cannot be undone.`)) return
        if (!confirm('This will permanently delete all products, orders, and pages. Proceed?')) return

        const supabase = createClient()
        await supabase.from('sites').delete().eq('id', data.id)
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store'
        window.location.href = accountsUrl
    }, [data])

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header">
                    <div className="settings-skeleton" style={{ width: 120, height: 28 }} />
                </div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="settings-card">
                        <div className="settings-skeleton" style={{ width: '60%', height: 20, marginBottom: 16 }} />
                        <div className="settings-skeleton" style={{ width: '100%', height: 40 }} />
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>General</h1>
            </div>

            {success && (
                <div className="settings-toast success">
                    <span className="material-symbols-outlined">check_circle</span>
                    Settings saved successfully.
                </div>
            )}

            <form onSubmit={handleSave}>
                {/* Store details */}
                <div className="settings-card">
                    <h2>Store details</h2>
                    <div className="settings-form-grid">
                        <div className="settings-form-group">
                            <label>Store name</label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={(e) => setData(s => ({ ...s, name: e.target.value }))}
                            />
                        </div>
                        <div className="settings-form-group">
                            <label>Store handle</label>
                            <input
                                type="text"
                                value={data.store_name}
                                disabled
                                className="disabled"
                            />
                            <p className="settings-form-hint">This is your unique store identifier and cannot be changed.</p>
                        </div>
                    </div>
                    <div className="settings-form-group full">
                        <label>Store description</label>
                        <textarea
                            value={data.description}
                            onChange={(e) => setData(s => ({ ...s, description: e.target.value }))}
                            rows={3}
                            placeholder="Tell customers about your business..."
                        />
                    </div>
                </div>

                {/* Store currency */}
                <div className="settings-card">
                    <h2>Store currency</h2>
                    <div className="settings-form-group">
                        <label>Currency</label>
                        <select
                            value={data.currency}
                            onChange={(e) => setData(s => ({ ...s, currency: e.target.value }))}
                        >
                            <option value="INR">₹ Indian Rupee (INR)</option>
                            <option value="USD">$ US Dollar (USD)</option>
                            <option value="EUR">€ Euro (EUR)</option>
                            <option value="GBP">£ British Pound (GBP)</option>
                        </select>
                    </div>
                </div>

                {/* Site type */}
                <div className="settings-card">
                    <h2>Site type</h2>
                    <div className="settings-form-group">
                        <label>Type</label>
                        <input
                            type="text"
                            value={data.site_type.charAt(0).toUpperCase() + data.site_type.slice(1)}
                            disabled
                            className="disabled"
                        />
                        <p className="settings-form-hint">Your site type was set during creation and cannot be changed.</p>
                    </div>
                </div>

                {/* Save button */}
                <div className="settings-save-bar">
                    <button type="submit" className="settings-btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>

            {/* Danger zone */}
            <div className="settings-card danger">
                <h2>Danger zone</h2>
                <p>Permanently delete this store and all associated data including products, orders, and pages.</p>
                <button onClick={handleDelete} className="settings-btn-danger">
                    Delete store
                </button>
            </div>
        </div>
    )
}
