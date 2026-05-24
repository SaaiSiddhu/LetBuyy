'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Invoice {
    id: string
    amount_paid: number
    currency: string
    status: string
    billing_period: string
    created_at: string
}

interface PaymentMethodInfo {
    id: string
    provider: string
    detail: string
    is_default: boolean
}

type PaymentConfigPayload = {
    data?: {
        cod_enabled: boolean
        payment_settings: {
            razorpay: {
                key_id: string | null
                verified: boolean
                secret_configured: boolean
            } | null
        }
    }
}

export default function BillingSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInfo[]>([])
    const [subscription, setSubscription] = useState<{ plan: string; status: string; current_period_end: string } | null>(null)

    useEffect(() => {
        async function load() {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/billing`, {
                cache: 'no-store',
            })
            const payload = await response.json()
            const data = payload.data

            const sub = data?.subscription
            if (sub) setSubscription(sub)

            const invoiceData = data?.invoices || []

            if (invoiceData) {
                setInvoices(invoiceData.map((inv: Record<string, unknown>) => ({
                    id: inv.id as string,
                    amount_paid: (inv.amount_paid as number) || 0,
                    currency: 'INR',
                    status: inv.status as string,
                    billing_period: inv.billing_period as string,
                    created_at: inv.created_at as string,
                })))
            }

            const paymentPayload = { data: data?.payment } as PaymentConfigPayload
            if (paymentPayload.data) {
                const configuredMethods: PaymentMethodInfo[] = []
                const razorpay = paymentPayload.data.payment_settings.razorpay

                if (razorpay?.secret_configured) {
                    configuredMethods.push({
                        id: 'razorpay',
                        provider: 'Razorpay',
                        detail: razorpay.key_id || 'Configured',
                        is_default: razorpay.verified,
                    })
                }

                if (paymentPayload.data.cod_enabled) {
                    configuredMethods.push({
                        id: 'cod',
                        provider: 'Cash on Delivery',
                        detail: 'Available at checkout',
                        is_default: !razorpay?.secret_configured,
                    })
                }

                setPaymentMethods(configuredMethods)
            }

            setLoading(false)
        }
        load()
    }, [store])

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 80, height: 28 }} /></div>
                <div className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 100 }} /></div>
                <div className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 120 }} /></div>
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Billing</h1>
            </div>

            {/* Subscription summary */}
            {subscription ? (
                <div className="settings-card">
                    <h2>Current subscription</h2>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{subscription.plan} Plan</div>
                            {subscription.current_period_end && (
                                <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>
                                    Next billing: {new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </div>
                            )}
                        </div>
                        <span className="settings-badge connected">{subscription.status}</span>
                    </div>
                </div>
            ) : (
                <div className="settings-info-banner">
                    <span className="material-symbols-outlined">info</span>
                    <span>Billing management will be available once you upgrade from the free trial.</span>
                </div>
            )}

            {/* Payment method */}
            <div className="settings-card">
                <h2>Payment method</h2>
                {paymentMethods.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--text-hint)', display: 'block', marginBottom: 8 }}>credit_card</span>
                        <p style={{ marginBottom: 12 }}>No payment method on file.</p>
                        <button className="settings-btn-secondary">Add payment method</button>
                    </div>
                ) : (
                    paymentMethods.map(pm => (
                        <div key={pm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-hint)' }}>credit_card</span>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{pm.provider}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>{pm.detail}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {pm.is_default && <span className="settings-badge connected">Default</span>}
                                <button className="settings-btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }}>Remove</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Billing history */}
            <div className="settings-card">
                <h2>Billing history</h2>
                {invoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--text-hint)', display: 'block', marginBottom: 8 }}>receipt_long</span>
                        <p>No invoices yet.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-hint)', fontWeight: 500 }}>Date</th>
                                    <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-hint)', fontWeight: 500 }}>Period</th>
                                    <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-hint)', fontWeight: 500 }}>Amount</th>
                                    <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-hint)', fontWeight: 500 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(inv => (
                                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '10px 0', color: 'var(--text-primary)' }}>
                                            {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '10px 0', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                            {inv.billing_period || '—'}
                                        </td>
                                        <td style={{ padding: '10px 0', color: 'var(--text-primary)', textAlign: 'right', fontWeight: 500 }}>
                                            ₹{(inv.amount_paid / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '10px 0', textAlign: 'right' }}>
                                            <span className={`settings-badge ${inv.status === 'active' || inv.status === 'paid' ? 'connected' : 'pending'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
