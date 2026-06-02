// ============================================================
// PRODUCT REVIEWS — Display & submit reviews for a product
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, ThumbsUp, CheckCircle, Send, Loader2, ChevronDown } from '@letbuyy/ui';
import { useCustomerAuth } from '@/context/customer-auth-context';

interface Review {
    id: string;
    customer_name: string;
    rating: number;
    title: string | null;
    body: string | null;
    images: string[];
    is_verified: boolean;
    helpful_count: number;
    created_at: string;
}

interface ReviewSummary {
    totalReviews: number;
    averageRating: number;
    distribution: { star: number; count: number }[];
}

interface Props {
    productId: string;
    storeId: string;
    primaryColor?: string;
}

function StarRating({
    rating, size = 14, interactive = false, onChange,
}: {
    rating: number; size?: number; interactive?: boolean; onChange?: (r: number) => void;
}) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onChange?.(star)}
                    className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
                >
                    <Star
                        size={size}
                        className={star <= rating ? 'text-amber-400' : 'text-gray-200'}
                        fill={star <= rating ? 'currentColor' : 'none'}
                    />
                </button>
            ))}
        </div>
    );
}

function getApiError(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message;
            if (typeof message === 'string') return message;
        }
    }

    return fallback;
}

export default function ProductReviews({ productId, storeId, primaryColor = '#00B3B3' }: Props) {
    const { isAuthenticated, customer } = useCustomerAuth();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [summary, setSummary] = useState<ReviewSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formRating, setFormRating] = useState(0);
    const [formTitle, setFormTitle] = useState('');
    const [formBody, setFormBody] = useState('');
    const [formName, setFormName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        setLoadError('');

        try {
            const res = await fetch(`/api/reviews?productId=${encodeURIComponent(productId)}&storeId=${encodeURIComponent(storeId)}`);
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                setReviews([]);
                setSummary(null);
                setLoadError(getApiError(data, 'Unable to load reviews'));
                return;
            }

            setReviews(data.reviews || []);
            setSummary(data.summary || null);
        } catch {
            setReviews([]);
            setSummary(null);
            setLoadError('Unable to load reviews');
        } finally {
            setLoading(false);
        }
    }, [productId, storeId]);

    useEffect(() => { fetchReviews(); }, [fetchReviews]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formRating === 0) {
            setError('Please select a rating');
            return;
        }
        setError('');
        setSubmitting(true);
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId,
                    storeId,
                    rating: formRating,
                    title: formTitle || undefined,
                    reviewBody: formBody || undefined,
                    customerName: isAuthenticated ? customer?.fullName || undefined : formName || undefined,
                }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                setError(getApiError(data, res.status === 409 ? 'You have already reviewed this product' : 'Unable to submit review'));
                return;
            }

            setSubmitted(true);
            setShowForm(false);
            setFormRating(0);
            setFormTitle('');
            setFormBody('');
            setFormName('');
        } finally {
            setSubmitting(false);
        }
    };

    const displayedReviews = showAll ? reviews : reviews.slice(0, 3);

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 30) return `${days} days ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return `${Math.floor(days / 365)} years ago`;
    };

    if (loading) {
        return (
            <div className="py-8 flex justify-center">
                <Loader2 size={24} className="animate-spin" style={{ color: primaryColor }} />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="py-8 text-center">
                <Star size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted, #D1D5DB)' }} />
                <p className="font-medium" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                    Unable to load reviews
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted, #9CA3AF)' }}>
                    {loadError}
                </p>
                <button
                    type="button"
                    onClick={fetchReviews}
                    className="mt-4 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                    style={{ backgroundColor: primaryColor }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Customer Reviews</h2>
                {!submitted && !showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
                        style={{ backgroundColor: primaryColor, color: '#fff' }}
                    >
                        Write a Review
                    </button>
                )}
            </div>

            {/* ── Summary Section ───────────────────────── */}
            {summary && summary.totalReviews > 0 && (
                <div className="flex flex-col sm:flex-row gap-6 p-4 rounded-2xl" style={{ backgroundColor: 'var(--surface, #F9FAFB)' }}>
                    {/* Average */}
                    <div className="flex flex-col items-center justify-center min-w-[120px]">
                        <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                            {summary.averageRating}
                        </span>
                        <StarRating rating={Math.round(summary.averageRating)} size={16} />
                        <span className="text-xs mt-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                            {summary.totalReviews} review{summary.totalReviews !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Distribution bars */}
                    <div className="flex-1 space-y-1.5">
                        {summary.distribution.map(({ star, count }) => {
                            const pct = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
                            return (
                                <div key={star} className="flex items-center gap-2 text-sm">
                                    <span className="w-3 text-right font-medium" style={{ color: 'var(--text, inherit)' }}>{star}</span>
                                    <Star size={12} className="text-amber-400" fill="currentColor" />
                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border, #E5E7EB)' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%`, backgroundColor: primaryColor }}
                                        />
                                    </div>
                                    <span className="w-6 text-right text-xs" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Review Form ──────────────────────────── */}
            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-2xl border p-4 space-y-4" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                    <h3 className="font-semibold text-sm">Write Your Review</h3>

                    <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                            Your Rating *
                        </label>
                        <StarRating rating={formRating} size={28} interactive onChange={setFormRating} />
                    </div>

                    {!isAuthenticated && (
                        <input
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            placeholder="Your Name"
                            className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none"
                            style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                        />
                    )}

                    <input
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        placeholder="Review Title (optional)"
                        className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none"
                        style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                    />

                    <textarea
                        value={formBody}
                        onChange={e => setFormBody(e.target.value)}
                        placeholder="Share your experience with this product..."
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none resize-none"
                        style={{ borderColor: 'var(--border, #E5E7EB)', backgroundColor: 'var(--input-bg, #f9fafb)' }}
                    />

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Submit Review
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2.5 text-sm rounded-xl transition-colors"
                            style={{ color: 'var(--text-secondary, #6B7280)' }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* ── Submitted confirmation ───────────────── */}
            {submitted && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 text-green-700 text-sm">
                    <CheckCircle size={18} />
                    <span>Thank you! Your review has been submitted and will appear after approval.</span>
                </div>
            )}

            {/* ── Review Cards ─────────────────────────── */}
            {reviews.length === 0 ? (
                <div className="text-center py-8">
                    <Star size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted, #D1D5DB)' }} />
                    <p className="font-medium" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                        No reviews yet
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted, #9CA3AF)' }}>
                        Be the first to review this product!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {displayedReviews.map(review => (
                        <div
                            key={review.id}
                            className="rounded-2xl border p-4"
                            style={{ borderColor: 'var(--border, #E5E7EB)' }}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <StarRating rating={review.rating} size={14} />
                                        {review.is_verified && (
                                            <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium">
                                                <CheckCircle size={12} /> Verified
                                            </span>
                                        )}
                                    </div>
                                    {review.title && (
                                        <p className="font-semibold text-sm mt-1">{review.title}</p>
                                    )}
                                </div>
                                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted, #9CA3AF)' }}>
                                    {timeAgo(review.created_at)}
                                </span>
                            </div>

                            {review.body && (
                                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                    {review.body}
                                </p>
                            )}

                            <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                    {review.customer_name}
                                </span>
                                {review.helpful_count > 0 && (
                                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted, #9CA3AF)' }}>
                                        <ThumbsUp size={12} /> {review.helpful_count} helpful
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Show More */}
                    {reviews.length > 3 && !showAll && (
                        <button
                            onClick={() => setShowAll(true)}
                            className="w-full text-center py-3 text-sm font-medium rounded-xl transition-colors hover:opacity-80 flex items-center justify-center gap-1"
                            style={{ color: primaryColor }}
                        >
                            <ChevronDown size={16} />
                            Show All {reviews.length} Reviews
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
