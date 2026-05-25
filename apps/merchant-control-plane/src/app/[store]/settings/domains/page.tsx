'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function DomainSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [storeData, setStoreData] = useState({
        id: '',
        subdomain: '',
        custom_domain: '',
    })
    const [customDomain, setCustomDomain] = useState('')
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        async function load() {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
            })
            const payload = await response.json()
            const data = payload.data

            if (data) {
                setStoreData({
                    id: data.id,
                    subdomain: data.subdomain || data.store_name || '',
                    custom_domain: data.custom_domain || '',
                })
                setCustomDomain(data.custom_domain || '')
            }
            setLoading(false)
        }
        load()
    }, [store])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setSuccess(false)

        await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custom_domain: customDomain || null }),
        })

        setSaving(false)
        setSuccess(true)
        setStoreData(s => ({ ...s, custom_domain: customDomain }))
        setTimeout(() => setSuccess(false), 3000)
    }

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header">
                    <div className="settings-skeleton" style={{ width: 120, height: 28 }} />
                </div>
                <div className="settings-card">
                    <div className="settings-skeleton" style={{ width: '100%', height: 120 }} />
                </div>
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Domains</h1>
            </div>

            {success && (
                <div className="settings-toast success">
                    <span className="material-symbols-outlined">check_circle</span>
                    Domain settings saved successfully.
                </div>
            )}

            <div className="settings-info-banner">
                <span className="material-symbols-outlined">info</span>
                <span>Connect a custom domain to give your store a professional web address.</span>
            </div>

            {/* Primary domain */}
            <div className="settings-card">
                <h2>Primary domain</h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-hint)' }}>language</span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{storeData.subdomain}.letbuyy.store</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="settings-badge connected">Primary</span>
                        <span className="settings-badge connected">Connected</span>
                    </div>
                </div>
            </div>

            {/* Custom domain */}
            <form onSubmit={handleSave}>
                <div className="settings-card">
                    <h2>Custom domain</h2>
                    <p style={{ marginBottom: 16 }}>
                        Point a CNAME record from your domain to <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>stores.letbuyy.store</code>
                    </p>
                    <div className="settings-form-group">
                        <label>Domain</label>
                        <input
                            type="text"
                            value={customDomain}
                            onChange={(e) => setCustomDomain(e.target.value)}
                            placeholder="e.g. shop.yourdomain.com"
                        />
                    </div>
                </div>

                <div className="settings-save-bar">
                    <button type="submit" className="settings-btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    )
}
