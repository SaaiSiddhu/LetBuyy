'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

interface PolicyField {
    key: string
    label: string
    value: string
}

export default function PoliciesSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [policies, setPolicies] = useState<PolicyField[]>([
        { key: 'refund_policy', label: 'Refund policy', value: '' },
        { key: 'privacy_policy', label: 'Privacy policy', value: '' },
        { key: 'terms_of_service', label: 'Terms of service', value: '' },
        { key: 'shipping_policy', label: 'Shipping policy', value: '' },
    ])

    useEffect(() => {
        async function load() {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
            })
            const payload = await response.json()
            const data = payload.data

            if (data) {
                setPolicies(p => p.map(policy => ({
                    ...policy,
                    value: (data as Record<string, string>)[policy.key] || '',
                })))
            }
            setLoading(false)
        }
        load()
    }, [store])

    const handleSave = async () => {
        setSaving(true)
        const update: Record<string, string> = {}
        policies.forEach(p => { update[p.key] = p.value })
        await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
        })
        setSaving(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
    }

    const updatePolicy = (key: string, value: string) => {
        setPolicies(p => p.map(policy =>
            policy.key === key ? { ...policy, value } : policy
        ))
    }

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 100, height: 28 }} /></div>
                {[1, 2].map(i => <div key={i} className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 100 }} /></div>)}
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Policies</h1>
            </div>

            {success && (
                <div className="settings-toast success">
                    <MaterialIcon name="check_circle" />
                    Policies saved successfully.
                </div>
            )}

            <div className="settings-info-banner">
                <MaterialIcon name="info" />
                <span>These policies will appear on your storefront and during checkout. Clear policies build customer trust.</span>
            </div>

            {policies.map(policy => (
                <div key={policy.key} className="settings-card">
                    <h2>{policy.label}</h2>
                    <div className="settings-form-group">
                        <textarea
                            value={policy.value}
                            onChange={(e) => updatePolicy(policy.key, e.target.value)}
                            rows={5}
                            placeholder={`Enter your ${policy.label.toLowerCase()}...`}
                        />
                    </div>
                </div>
            ))}

            <div className="settings-save-bar">
                <button onClick={handleSave} className="settings-btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}
