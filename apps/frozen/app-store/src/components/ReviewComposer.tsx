'use client';

import { useState } from 'react';
import { Button, Input, Loader2, Select, Star, Textarea } from '@letbuyy/ui';
import { recordMarketplaceEvent } from '@/lib/telemetry';

interface ReviewComposerProps {
    appId: string;
    appName: string;
}

interface ReviewResponse {
    error?: { message?: string };
}

export function ReviewComposer({ appId, appName }: ReviewComposerProps) {
    const [rating, setRating] = useState(5);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const submitReview = async () => {
        setSubmitting(true);
        setNotice(null);
        setError(null);

        try {
            const response = await fetch(`/api/apps/${appId}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, title, body }),
            });
            const payload = await response.json().catch(() => null) as ReviewResponse | null;
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Review submission failed.');
            }
            setTitle('');
            setBody('');
            setNotice('Review submitted for this installed app.');
            recordMarketplaceEvent('review_submitted', { appId, rating });
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Review submission failed.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="review-composer">
            <div className="review-composer__header">
                <Star size={14} aria-hidden="true" />
                <strong>Review {appName}</strong>
            </div>
            <label>
                Rating
                <Select
                    unstyled
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                    options={[5, 4, 3, 2, 1].map((value) => ({ label: `${value} stars`, value: String(value) }))}
                />
            </label>
            <label>
                Title
                <Input unstyled value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
            </label>
            <label>
                Review
                <Textarea unstyled value={body} onChange={(event) => setBody(event.target.value)} rows={3} />
            </label>
            <Button
                unstyled
                className="appstore-header-btn primary"
                type="button"
                onClick={submitReview}
                disabled={submitting}
            >
                {submitting ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Star size={13} aria-hidden="true" />}
                Submit review
            </Button>
            {notice && <div className="marketplace-toast marketplace-toast--success" role="status">{notice}</div>}
            {error && (
                <div className="marketplace-banner marketplace-banner--critical" role="alert">
                    <strong>Could not submit review</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
