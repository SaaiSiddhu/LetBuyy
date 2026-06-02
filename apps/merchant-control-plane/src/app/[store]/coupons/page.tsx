'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Coupon as SharedCoupon } from '@letbuyy/shared-types'
import { MaterialIcon } from '@letbuyy/ui'

type CouponDiscountKind = SharedCoupon['type'] | 'fixed_amount'

type CouponRow = Omit<
    Pick<SharedCoupon, 'id' | 'code' | 'value' | 'used_count' | 'starts_at' | 'expires_at' | 'is_active' | 'created_at'>,
    'starts_at' | 'expires_at'
> & {
    type: CouponDiscountKind
    min_purchase: number | null
    max_uses: number | null
    starts_at: string | null
    expires_at: string | null
}

function getErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (typeof error === 'string') return error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            if (typeof message === 'string') return message
        }
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string') return message
    }

    return fallback
}

export default function CouponsPage() {
    const { store } = useParams<{ store: string }>()

    const [coupons, setCoupons] = useState<CouponRow[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        code: '', type: 'percentage' as CouponRow['type'], value: '', min_purchase: '', max_uses: '',
        starts_at: '', expires_at: '', is_active: true
    })

    const loadCoupons = useCallback(async () => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/coupons?status=all&limit=100`, {
            cache: 'no-store',
        })
        const payload = await response.json()

        setCoupons(Array.isArray(payload.data) ? payload.data : [])
        setLoading(false)
    }, [store])

    useEffect(() => { loadCoupons() }, [loadCoupons])

    const handleSave = async () => {
        if (!formData.code || (formData.type !== 'free_shipping' && !formData.value)) return
        setSaving(true)
        setFormError(null)

        const payload = {
            code: formData.code.toUpperCase().trim(),
            type: formData.type,
            value: formData.type === 'free_shipping' ? 0 : parseFloat(formData.value),
            min_purchase: formData.min_purchase ? parseFloat(formData.min_purchase) : null,
            max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
            starts_at: formData.starts_at || null,
            expires_at: formData.expires_at || null,
            is_active: formData.is_active,
        }

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/coupons/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/coupons`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const result = await response.json().catch(() => null)

            if (!response.ok) {
                setFormError(getErrorMessage(result, 'Unable to save coupon'))
                return
            }

            setShowForm(false)
            setEditingId(null)
            resetForm()
            await loadCoupons()
        } catch {
            setFormError('Unable to save coupon')
        } finally {
            setSaving(false)
        }
    }

    const resetForm = () => setFormData({
        code: '', type: 'percentage', value: '', min_purchase: '', max_uses: '',
        starts_at: '', expires_at: '', is_active: true
    })

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this coupon?')) return
        await fetch(`/api/stores/${encodeURIComponent(store)}/coupons/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        loadCoupons()
    }

    const toggleActive = async (coupon: CouponRow) => {
        await fetch(`/api/stores/${encodeURIComponent(store)}/coupons/${encodeURIComponent(coupon.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !coupon.is_active }),
        })
        loadCoupons()
    }

    const startEdit = (c: CouponRow) => {
        setEditingId(c.id)
        setFormError(null)
        setFormData({
            code: c.code, type: c.type, value: String(c.value),
            min_purchase: c.min_purchase ? String(c.min_purchase) : '',
            max_uses: c.max_uses ? String(c.max_uses) : '',
            starts_at: c.starts_at ? c.starts_at.split('T')[0] : '',
            expires_at: c.expires_at ? c.expires_at.split('T')[0] : '',
            is_active: c.is_active,
        })
        setShowForm(true)
    }

    const isExpired = (c: CouponRow) => c.expires_at && new Date(c.expires_at) < new Date()
    const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ padding: '24px 32px' }}>
                <div className="products-page-header"><h1>Coupons</h1></div>
                <div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} />
            </div>
        )
    }

    const inputStyle: React.CSSProperties = {
        padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 14, width: '100%'
    }

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Coupons</h1>
                <button onClick={() => { setShowForm(true); setEditingId(null); setFormError(null); resetForm() }}
                    className="setup-plan-banner-btn" style={{
                        background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 18px',
                        borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6
                    }}>
                    <MaterialIcon name="add" style={{ fontSize: 16 }} />
                    Create coupon
                </button>
            </div>

            {showForm && (
                <div className="products-list-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
                        {editingId ? 'Edit Coupon' : 'New Coupon'}
                    </h3>
                    {formError && (
                        <div style={{ marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>
                            {formError}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Code</label>
                            <input type="text" placeholder="SUMMER20" value={formData.code}
                                onChange={e => setFormData(f => ({ ...f, code: e.target.value }))}
                                style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Type</label>
                            <select value={formData.type}
                                onChange={e => setFormData(f => ({ ...f, type: e.target.value as CouponRow['type'] }))}
                                style={inputStyle}>
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed_amount">Fixed Amount (₹)</option>
                                <option value="free_shipping">Free Shipping</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                                {formData.type === 'percentage' ? 'Discount %' : formData.type === 'free_shipping' ? 'Discount' : 'Discount ₹'}
                            </label>
                            <input type="number" placeholder="20" value={formData.value}
                                onChange={e => setFormData(f => ({ ...f, value: e.target.value }))}
                                disabled={formData.type === 'free_shipping'}
                                style={{ ...inputStyle, opacity: formData.type === 'free_shipping' ? 0.6 : 1 }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Min Purchase (₹)</label>
                            <input type="number" placeholder="Optional" value={formData.min_purchase}
                                onChange={e => setFormData(f => ({ ...f, min_purchase: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Max Uses</label>
                            <input type="number" placeholder="Unlimited" value={formData.max_uses}
                                onChange={e => setFormData(f => ({ ...f, max_uses: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Start Date</label>
                            <input type="date" value={formData.starts_at}
                                onChange={e => setFormData(f => ({ ...f, starts_at: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Expiry Date</label>
                            <input type="date" value={formData.expires_at}
                                onChange={e => setFormData(f => ({ ...f, expires_at: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" id="coupon-active" checked={formData.is_active}
                                onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked }))} />
                            <label htmlFor="coupon-active" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Active</label>
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                            <button onClick={handleSave} disabled={saving || !formData.code || (formData.type !== 'free_shipping' && !formData.value)} style={{
                                background: 'var(--text-primary)', color: 'var(--bg)', padding: '8px 20px',
                                borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                                opacity: (saving || !formData.code || (formData.type !== 'free_shipping' && !formData.value)) ? 0.5 : 1
                            }}>
                                {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditingId(null); setFormError(null) }} style={{
                                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                border: '1px solid var(--border)', padding: '8px 20px',
                                borderRadius: 8, fontSize: 13, cursor: 'pointer'
                            }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {coupons.length === 0 && !showForm ? (
                <div className="products-empty-card">
                    <div className="products-empty-inner">
                        <div className="products-empty-text">
                            <h2>No coupons yet</h2>
                            <p>Create discount codes to offer promotions to your customers.</p>
                        </div>
                    </div>
                </div>
            ) : coupons.length > 0 && (
                <div className="products-list-card">
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Uses</th>
                                <th>Expires</th>
                                <th>Status</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map(c => (
                                <tr key={c.id}>
                                    <td><code style={{ fontWeight: 600, fontSize: 13, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4 }}>{c.code}</code></td>
                                    <td>
                                        {c.type === 'percentage' ? `${c.value}%` :
                                            c.type === 'fixed_amount' ? `₹${c.value}` : 'Free Shipping'}
                                    </td>
                                    <td>{c.used_count || 0}{c.max_uses ? `/${c.max_uses}` : ''}</td>
                                    <td style={{ color: isExpired(c) ? 'var(--danger)' : 'var(--text-secondary)', fontSize: 13 }}>
                                        {formatDate(c.expires_at)}
                                    </td>
                                    <td>
                                        <button onClick={() => toggleActive(c)}
                                            className={`product-status-badge ${isExpired(c) ? 'archived' : c.is_active ? 'active' : 'draft'}`}
                                            style={{ cursor: 'pointer', border: 'none', background: 'none' }}>
                                            <span className="product-status-dot" />
                                            {isExpired(c) ? 'Expired' : c.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => startEdit(c)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                                                <MaterialIcon name="edit" style={{ fontSize: 18 }} />
                                            </button>
                                            <button onClick={() => handleDelete(c.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}>
                                                <MaterialIcon name="delete" style={{ fontSize: 18 }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
