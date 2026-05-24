'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Review {
    id: string
    product_id: string
    product_name?: string
    customer_name: string
    customer_email: string
    rating: number
    title: string
    body: string
    status: 'pending' | 'approved' | 'rejected'
    is_verified: boolean
    created_at: string
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

export default function ReviewsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [reviews, setReviews] = useState<Review[]>([])
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
    const [updating, setUpdating] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        setError(null)
        setActionError(null)

        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/reviews?status=${encodeURIComponent(filter)}&limit=100`,
                { cache: 'no-store' }
            )
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setReviews([])
                setError(getErrorMessage(payload, 'Unable to load reviews'))
                return
            }

            setReviews(Array.isArray(payload?.data) ? payload.data : [])
        } catch {
            setReviews([])
            setError('Unable to load reviews')
        } finally {
            setLoading(false)
        }
    }, [store, filter])

    useEffect(() => { loadData() }, [loadData])

    const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
        setUpdating(id)
        setActionError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/reviews/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setActionError(getErrorMessage(payload, 'Unable to update review'))
                return
            }

            const updatedReview = payload?.data as Partial<Review> | undefined
            setReviews(prev => prev.map(r => r.id === id ? { ...r, ...updatedReview, status } : r))
        } catch {
            setActionError('Unable to update review')
        } finally {
            setUpdating(null)
        }
    }

    const deleteReview = async (id: string) => {
        if (!confirm('Permanently delete this review?')) return
        setUpdating(id)
        setActionError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/reviews/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setActionError(getErrorMessage(payload, 'Unable to delete review'))
                return
            }

            setReviews(prev => prev.filter(r => r.id !== id))
        } catch {
            setActionError('Unable to delete review')
        } finally {
            setUpdating(null)
        }
    }

    const renderStars = (rating: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ color: i < rating ? '#f59e0b' : 'var(--border)', fontSize: 14 }}>★</span>
        ))
    }

    const pendingCount = reviews.filter(r => r.status === 'pending').length

    if (loading) {
        return (
            <div style={{ padding: 32 }}>
                <div className="settings-skeleton" style={{ width: 200, height: 28, marginBottom: 24 }} />
                {[1, 2, 3].map(i => (
                    <div key={i} className="settings-skeleton" style={{ width: '100%', height: 100, marginBottom: 12 }} />
                ))}
            </div>
        )
    }

    return (
        <div style={{ padding: 32, maxWidth: 960 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Product reviews</h1>
                    <p style={{ fontSize: 13, color: 'var(--text-hint)', margin: '4px 0 0' }}>
                        {pendingCount > 0 ? `${pendingCount} review${pendingCount > 1 ? 's' : ''} awaiting moderation` : 'All reviews moderated'}
                    </p>
                </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => { setFilter(f); setLoading(true) }}
                        style={{
                            padding: '8px 16px', fontSize: 13, fontWeight: filter === f ? 600 : 400,
                            background: 'none', border: 'none', cursor: 'pointer',
                            borderBottom: filter === f ? '2px solid var(--primary)' : '2px solid transparent',
                            color: filter === f ? 'var(--text-primary)' : 'var(--text-hint)',
                            textTransform: 'capitalize',
                        }}
                    >
                        {f}
                        {f === 'pending' && pendingCount > 0 && (
                            <span style={{ marginLeft: 6, background: 'var(--danger, #e53e3e)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {(error || actionError) && reviews.length > 0 && (
                <div style={{ marginBottom: 16, padding: 12, border: '1px solid var(--danger, #e53e3e)', borderRadius: 8, color: 'var(--danger, #e53e3e)', fontSize: 13 }}>
                    {actionError || error}
                </div>
            )}

            {/* Reviews list */}
            {error && reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--danger, #e53e3e)', display: 'block', marginBottom: 12 }}>error</span>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: '0 0 8px' }}>Unable to load reviews</p>
                    <p style={{ fontSize: 13, color: 'var(--text-hint)', margin: '0 0 16px' }}>{error}</p>
                    <button
                        type="button"
                        onClick={loadData}
                        style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, background: 'var(--primary)', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}
                    >
                        Retry
                    </button>
                </div>
            ) : reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-hint)', display: 'block', marginBottom: 12 }}>rate_review</span>
                    <p style={{ fontSize: 14, color: 'var(--text-hint)' }}>No {filter !== 'all' ? filter : ''} reviews yet</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {reviews.map(review => (
                        <div key={review.id} style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, position: 'relative' }}>
                            {/* Status badge */}
                            <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                                    background: review.status === 'approved' ? 'rgba(72,187,120,0.1)' : review.status === 'pending' ? 'rgba(236,201,75,0.15)' : 'rgba(229,62,62,0.1)',
                                    color: review.status === 'approved' ? '#38a169' : review.status === 'pending' ? '#d69e2e' : '#e53e3e',
                                }}>
                                    {review.status}
                                </span>
                            </div>

                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div>{renderStars(review.rating)}</div>
                                <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                                    {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>

                            {/* Title */}
                            {review.title && <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>{review.title}</h3>}

                            {/* Body */}
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>{review.body}</p>

                            {/* Meta */}
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-hint)', marginBottom: 12 }}>
                                <span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{review.customer_name}</strong>
                                    {review.is_verified && (
                                        <span style={{ color: '#38a169', marginLeft: 4, fontSize: 11 }}>✓ Verified</span>
                                    )}
                                </span>
                                <span>·</span>
                                <span>{review.product_name}</span>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 6 }}>
                                {review.status !== 'approved' && (
                                    <button
                                        onClick={() => updateStatus(review.id, 'approved')}
                                        disabled={updating === review.id}
                                        style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: '#38a169', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                    >
                                        {updating === review.id ? '...' : 'Approve'}
                                    </button>
                                )}
                                {review.status !== 'rejected' && (
                                    <button
                                        onClick={() => updateStatus(review.id, 'rejected')}
                                        disabled={updating === review.id}
                                        style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--danger, #e53e3e)', border: '1px solid var(--danger, #e53e3e)', borderRadius: 6, cursor: 'pointer' }}
                                    >
                                        Reject
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteReview(review.id)}
                                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--text-hint)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', marginLeft: 'auto' }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
