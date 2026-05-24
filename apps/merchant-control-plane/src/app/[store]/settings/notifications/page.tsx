'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface NotificationPref {
    key: string
    label: string
    description: string
    icon: string
    enabled: boolean
}

const DEFAULT_PREFS: NotificationPref[] = [
    { key: 'new_order', label: 'New order', description: 'When a customer places an order', icon: 'shopping_bag', enabled: true },
    { key: 'order_fulfilled', label: 'Order fulfilled', description: 'When an order is marked as fulfilled', icon: 'inventory', enabled: false },
    { key: 'low_inventory', label: 'Low inventory', description: 'When a product has low stock', icon: 'warning', enabled: true },
    { key: 'new_customer', label: 'New customer', description: 'When a customer creates an account', icon: 'person_add', enabled: false },
    { key: 'new_review', label: 'New review', description: 'When a customer leaves a product review', icon: 'rate_review', enabled: false },
    { key: 'form_submission', label: 'Form submission', description: 'When someone submits a contact form', icon: 'mail', enabled: true },
]

export default function NotificationsSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [siteSettings, setSiteSettings] = useState<Record<string, unknown>>({})
    const [prefs, setPrefs] = useState<NotificationPref[]>(DEFAULT_PREFS)

    useEffect(() => {
        async function load() {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
            })
            const payload = await response.json()
            const data = payload.data

            if (data) {
                const siteSettings = (data.site_settings as Record<string, unknown>) || {}
                setSiteSettings(siteSettings)
                const saved = (siteSettings.notifications as Record<string, boolean>) || {}
                // Merge saved preferences with defaults
                setPrefs(DEFAULT_PREFS.map(p => ({
                    ...p,
                    enabled: saved[p.key] !== undefined ? saved[p.key] : p.enabled,
                })))
            }
            setLoading(false)
        }
        load()
    }, [store])

    const togglePref = (key: string) => {
        setPrefs(prev => prev.map(p =>
            p.key === key ? { ...p, enabled: !p.enabled } : p
        ))
    }

    const handleSave = useCallback(async () => {
        setSaving(true)
        setSuccess(false)

        // Build notifications map
        const notifMap: Record<string, boolean> = {}
        prefs.forEach(p => { notifMap[p.key] = p.enabled })

        const nextSettings = { ...siteSettings, notifications: notifMap }
        await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site_settings: nextSettings }),
        })
        setSiteSettings(nextSettings)

        setSaving(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
    }, [store, prefs, siteSettings])

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 150, height: 28 }} /></div>
                <div className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 200 }} /></div>
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Notifications</h1>
            </div>

            {success && (
                <div className="settings-toast success">
                    <span className="material-symbols-outlined">check_circle</span>
                    Notification preferences saved.
                </div>
            )}

            <div className="settings-card">
                <h2>Staff notifications</h2>
                <p style={{ marginBottom: 16 }}>Choose which notifications you receive when something happens in your store.</p>

                {prefs.map(item => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-hint)' }}>{item.icon}</span>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>{item.description}</div>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={() => togglePref(item.key)}
                            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                    </div>
                ))}
            </div>

            <div className="settings-card">
                <h2>Customer notifications</h2>
                <p>Emails are automatically sent to customers for order confirmations, shipping updates, and account creation.</p>
            </div>

            <div className="settings-save-bar">
                <button onClick={handleSave} className="settings-btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}
