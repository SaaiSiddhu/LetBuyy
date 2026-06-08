'use client';

import { useState } from 'react';
import { Button, Loader2, MessageSquare } from '@letbuyy/ui';
import type { MarketplaceAppReview } from '@letbuyy/shared-types';

interface DeveloperReviewReplyPanelProps {
    appId: string;
    reviews: MarketplaceAppReview[];
}

export function DeveloperReviewReplyPanel({ appId, reviews }: DeveloperReviewReplyPanelProps) {
    const [localReviews, setLocalReviews] = useState(reviews);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const submitReply = async (reviewId: string) => {
        const developerReply = drafts[reviewId]?.trim();
        if (!developerReply) return;
        setSubmitting(reviewId);
        setError(null);
        try {
            const response = await fetch(`/api/apps/${appId}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reply_review', review_id: reviewId, developer_reply: developerReply }),
            });
            const payload = await response.json().catch(() => null) as { data?: MarketplaceAppReview; error?: { message?: string } } | null;
            if (!response.ok || !payload?.data) {
                throw new Error(payload?.error?.message || 'Reply could not be saved.');
            }
            setLocalReviews((current) => current.map((review) => review.id === reviewId ? payload.data! : review));
            setDrafts((current) => ({ ...current, [reviewId]: '' }));
        } catch (replyError) {
            setError(replyError instanceof Error ? replyError.message : 'Reply could not be saved.');
        } finally {
            setSubmitting(null);
        }
    };

    if (localReviews.length === 0) {
        return <p className="marketplace-panel-copy">No merchant reviews yet.</p>;
    }

    return (
        <div className="developer-review-reply-panel">
            <div className="developer-review-reply-panel__header">
                <MessageSquare size={15} aria-hidden="true" />
                <strong>Merchant reviews</strong>
            </div>
            {localReviews.slice(0, 3).map((review) => (
                <article key={review.id} className="developer-review-reply-row">
                    <div>
                        <strong>{review.title || `${review.rating} star review`}</strong>
                        <p>{review.body || 'No review body provided.'}</p>
                        {review.developer_reply && (
                            <div className="developer-review-reply-row__published">
                                <span>Response</span>
                                <p>{review.developer_reply}</p>
                            </div>
                        )}
                    </div>
                    {!review.developer_reply && (
                        <label>
                            Response
                            <textarea
                                value={drafts[review.id] || ''}
                                onChange={(event) => setDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                                rows={2}
                                maxLength={2000}
                            />
                            <Button
                                unstyled
                                type="button"
                                className="marketplace-inline-action"
                                onClick={() => { void submitReply(review.id); }}
                                disabled={submitting === review.id || !(drafts[review.id] || '').trim()}
                            >
                                {submitting === review.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <MessageSquare size={13} aria-hidden="true" />}
                                Save response
                            </Button>
                        </label>
                    )}
                </article>
            ))}
            {error && (
                <div className="marketplace-banner marketplace-banner--critical" role="alert">
                    <strong>Could not save reply</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
