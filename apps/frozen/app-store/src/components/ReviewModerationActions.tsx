'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, Button, CheckCircle2, Input, ShieldAlert, XCircle } from '@letbuyy/ui';

type ModerationAction = 'publish' | 'dismiss' | 'reject' | 'flag';

interface ReviewModerationActionsProps {
    appId: string;
    reviewId: string;
}

const actionCopy: Record<ModerationAction, { label: string; reason: string }> = {
    publish: {
        label: 'Publish',
        reason: 'Review meets marketplace policy.',
    },
    dismiss: {
        label: 'Dismiss reports',
        reason: 'Reports reviewed and no policy violation found.',
    },
    reject: {
        label: 'Reject',
        reason: 'Review rejected by marketplace moderation.',
    },
    flag: {
        label: 'Keep flagged',
        reason: 'Review requires additional marketplace investigation.',
    },
};

export function ReviewModerationActions({ appId, reviewId }: ReviewModerationActionsProps) {
    const router = useRouter();
    const [pendingAction, setPendingAction] = useState<ModerationAction | null>(null);
    const [reason, setReason] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function submitAction(action: ModerationAction) {
        setPendingAction(action);
        setMessage(null);
        setError(null);
        try {
            const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'moderate_review',
                    review_id: reviewId,
                    moderation_action: action,
                    reason: reason.trim() || actionCopy[action].reason,
                }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error || 'Moderation action failed');
            }
            setMessage(`${actionCopy[action].label} applied.`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Moderation action failed');
        } finally {
            setPendingAction(null);
        }
    }

    return (
        <div className="moderation-review-actions">
            <Input
                className="moderation-review-actions__reason-input"
                label="Decision note"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional note for audit history"
            />
            <div className="marketplace-row marketplace-row--wrap">
                <Button size="sm" variant="secondary" loading={pendingAction === 'publish'} onClick={() => submitAction('publish')}>
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Publish
                </Button>
                <Button size="sm" variant="outline" loading={pendingAction === 'dismiss'} onClick={() => submitAction('dismiss')}>
                    <ShieldAlert size={14} aria-hidden="true" />
                    Dismiss
                </Button>
                <Button size="sm" variant="destructive" loading={pendingAction === 'reject'} onClick={() => submitAction('reject')}>
                    <XCircle size={14} aria-hidden="true" />
                    Reject
                </Button>
                <Button size="sm" variant="outline" loading={pendingAction === 'flag'} onClick={() => submitAction('flag')}>
                    <AlertTriangle size={14} aria-hidden="true" />
                    Keep flagged
                </Button>
            </div>
            {message && <p className="moderation-review-actions__success">{message}</p>}
            {error && <p className="moderation-review-actions__error">{error}</p>}
        </div>
    );
}
