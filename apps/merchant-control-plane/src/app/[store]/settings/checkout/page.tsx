'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

interface CheckoutSettings {
    contact_method: 'email' | 'phone' | 'both'
    customer_accounts: 'disabled' | 'optional' | 'required'
    full_name: 'required_both' | 'required_last' | 'optional'
    company_name: 'hidden' | 'optional' | 'required'
    order_notes: boolean
    tip_option: boolean
}

const DEFAULTS: CheckoutSettings = {
    contact_method: 'email',
    customer_accounts: 'optional',
    full_name: 'required_last',
    company_name: 'hidden',
    order_notes: false,
    tip_option: false,
}

export default function CheckoutSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [siteSettings, setSiteSettings] = useState<Record<string, unknown>>({})
    const [settings, setSettings] = useState<CheckoutSettings>(DEFAULTS)

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
                const checkout = (siteSettings.checkout as Partial<CheckoutSettings>) || {}
                setSettings({ ...DEFAULTS, ...checkout })
            }
            setLoading(false)
        }
        load()
    }, [store])

    const handleSave = useCallback(async () => {
        setSaving(true)
        setSuccess(false)

        const nextSettings = { ...siteSettings, checkout: settings }
        await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site_settings: nextSettings }),
        })
        setSiteSettings(nextSettings)

        setSaving(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
    }, [store, settings, siteSettings])

    const updateField = <K extends keyof CheckoutSettings>(key: K, value: CheckoutSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 120, height: 28 }} /></div>
                {[1, 2, 3].map(i => <div key={i} className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 80 }} /></div>)}
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Checkout</h1>
            </div>

            {success && (
                <div className="settings-toast success">
                    <MaterialIcon name="check_circle" />
                    Checkout settings saved successfully.
                </div>
            )}

            <div className="settings-card">
                <h2>Customer contact method</h2>
                <div className="settings-form-group">
                    <label>Customers can check out using</label>
                    <select
                        value={settings.contact_method}
                        onChange={(e) => updateField('contact_method', e.target.value as CheckoutSettings['contact_method'])}
                    >
                        <option value="email">Email</option>
                        <option value="phone">Phone number</option>
                        <option value="both">Email or phone number</option>
                    </select>
                </div>
            </div>

            <div className="settings-card">
                <h2>Customer accounts</h2>
                <div className="settings-form-group">
                    <label>Account creation</label>
                    <select
                        value={settings.customer_accounts}
                        onChange={(e) => updateField('customer_accounts', e.target.value as CheckoutSettings['customer_accounts'])}
                    >
                        <option value="disabled">Accounts are disabled</option>
                        <option value="optional">Accounts are optional</option>
                        <option value="required">Accounts are required</option>
                    </select>
                </div>
            </div>

            <div className="settings-card">
                <h2>Form options</h2>
                <div className="settings-form-group">
                    <label>Full name</label>
                    <select
                        value={settings.full_name}
                        onChange={(e) => updateField('full_name', e.target.value as CheckoutSettings['full_name'])}
                    >
                        <option value="required_both">Require first and last name</option>
                        <option value="required_last">Only require last name</option>
                        <option value="optional">Optional</option>
                    </select>
                </div>
                <div className="settings-form-group" style={{ marginTop: 12 }}>
                    <label>Company name</label>
                    <select
                        value={settings.company_name}
                        onChange={(e) => updateField('company_name', e.target.value as CheckoutSettings['company_name'])}
                    >
                        <option value="hidden">Hidden</option>
                        <option value="optional">Optional</option>
                        <option value="required">Required</option>
                    </select>
                </div>
            </div>

            <div className="settings-card">
                <h2>Additional options</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="checkbox"
                            id="order-notes"
                            checked={settings.order_notes}
                            onChange={(e) => updateField('order_notes', e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                        />
                        <label htmlFor="order-notes" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            Allow customers to add order notes
                        </label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="checkbox"
                            id="tip-option"
                            checked={settings.tip_option}
                            onChange={(e) => updateField('tip_option', e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                        />
                        <label htmlFor="tip-option" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            Show tipping option at checkout
                        </label>
                    </div>
                </div>
            </div>

            <div className="settings-info-banner">
                <MaterialIcon name="info" />
                <span>These settings control how customers interact with your checkout process.</span>
            </div>

            <div className="settings-save-bar">
                <button onClick={handleSave} className="settings-btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}
