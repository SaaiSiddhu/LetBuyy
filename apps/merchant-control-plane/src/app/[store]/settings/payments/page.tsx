'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type SanitizedPaymentSettings = {
    mode: 'shared' | 'ownAccount'
    gateways: string[]
    razorpay: {
        key_id: string | null
        test_mode: boolean
        verified: boolean
        connected_at: string | null
        updated_at: string | null
        secret_configured: boolean
    } | null
}

type PaymentConfig = {
    store_id: string
    online_payment_enabled: boolean
    cod_enabled: boolean
    payment_settings: SanitizedPaymentSettings
}

type PaymentConfigPayload = {
    data?: PaymentConfig
    error?: string | { message?: string }
}

function getPayloadError(payload: PaymentConfigPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

export default function PaymentsSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [config, setConfig] = useState<PaymentConfig | null>(null)
    const [keyId, setKeyId] = useState('')
    const [keySecret, setKeySecret] = useState('')
    const [testMode, setTestMode] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/payment-config`, {
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as PaymentConfigPayload | null

            if (!response.ok || !payload?.data) {
                throw new Error(getPayloadError(payload, 'Unable to load payment settings'))
            }

            setConfig(payload.data)
            setTestMode(payload.data.payment_settings.razorpay?.test_mode ?? true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load payment settings')
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => {
        void loadData()
    }, [loadData])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)
        setSuccess(null)

        if (!keyId.trim() || !keySecret.trim()) {
            setError('Enter both Razorpay key ID and key secret.')
            return
        }

        setSaving(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/payment-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key_id: keyId.trim(),
                    key_secret: keySecret.trim(),
                    test_mode: testMode,
                }),
            })
            const payload = (await response.json().catch(() => null)) as PaymentConfigPayload | null

            if (!response.ok || !payload?.data) {
                throw new Error(getPayloadError(payload, 'Unable to save payment settings'))
            }

            setConfig(payload.data)
            setKeyId('')
            setKeySecret('')
            setSuccess(
                payload.data.payment_settings.razorpay?.verified
                    ? 'Razorpay is connected and verified.'
                    : 'Razorpay keys were saved, but verification did not complete. Re-check the credentials before going live.'
            )
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save payment settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header">
                    <div className="settings-skeleton" style={{ width: 120, height: 28 }} />
                </div>
                <div className="settings-card">
                    <div className="settings-skeleton" style={{ width: '100%', height: 180 }} />
                </div>
            </div>
        )
    }

    const razorpay = config?.payment_settings.razorpay

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Payments</h1>
            </div>

            {error && (
                <div className="settings-info-banner" style={{ borderColor: 'var(--danger, #e53e3e)' }}>
                    <span className="material-symbols-outlined">error</span>
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="settings-info-banner">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>{success}</span>
                </div>
            )}

            <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Razorpay account</h2>
                        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                            Connect the seller Razorpay account used by storefront checkout and Flutter builder flows.
                        </p>
                    </div>
                    <span className={`settings-badge ${razorpay?.verified ? 'connected' : 'pending'}`}>
                        {razorpay?.verified ? 'Verified' : razorpay?.secret_configured ? 'Saved' : 'Not connected'}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <div className="settings-info-banner" style={{ margin: 0 }}>
                        <span className="material-symbols-outlined">key</span>
                        <span>{razorpay?.key_id || 'No key configured'}</span>
                    </div>
                    <div className="settings-info-banner" style={{ margin: 0 }}>
                        <span className="material-symbols-outlined">payments</span>
                        <span>{config?.online_payment_enabled ? 'Online payments enabled' : 'Online payments disabled'}</span>
                    </div>
                    <div className="settings-info-banner" style={{ margin: 0 }}>
                        <span className="material-symbols-outlined">local_shipping</span>
                        <span>{config?.cod_enabled ? 'COD available' : 'COD disabled'}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="settings-form-group" style={{ marginBottom: 12 }}>
                        <label>Razorpay key ID</label>
                        <input
                            value={keyId}
                            onChange={(event) => setKeyId(event.target.value)}
                            placeholder={testMode ? 'rzp_test_...' : 'rzp_live_...'}
                            autoComplete="off"
                        />
                    </div>

                    <div className="settings-form-group" style={{ marginBottom: 12 }}>
                        <label>Razorpay key secret</label>
                        <input
                            value={keySecret}
                            onChange={(event) => setKeySecret(event.target.value)}
                            placeholder="Paste key secret"
                            type="password"
                            autoComplete="new-password"
                        />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
                        <input
                            checked={testMode}
                            onChange={(event) => setTestMode(event.target.checked)}
                            type="checkbox"
                        />
                        Use Razorpay test mode
                    </label>

                    <button className="settings-btn-primary" disabled={saving} type="submit">
                        {saving ? 'Saving...' : razorpay?.secret_configured ? 'Update Razorpay keys' : 'Connect Razorpay'}
                    </button>
                </form>
            </div>

            <div className="settings-info-banner">
                <span className="material-symbols-outlined">shield_lock</span>
                <span>Secrets are sent to the LetBuyy API worker and stored encrypted. The admin UI only receives masked payment settings.</span>
            </div>
        </div>
    )
}
