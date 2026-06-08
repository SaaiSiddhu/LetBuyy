'use client';

import { useState } from 'react';
import { Button, Loader2, ShieldAlert } from '@letbuyy/ui';

interface ReportActionButtonProps {
    appId: string;
    reviewId?: string;
    label: string;
    kind: 'listing' | 'review';
}

interface ReportResponse {
    data?: { accepted?: boolean };
    error?: { message?: string };
}

export function ReportActionButton({ appId, reviewId, label, kind }: ReportActionButtonProps) {
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const report = async () => {
        if (submitting) return;
        setSubmitting(true);
        setNotice(null);
        setError(null);

        try {
            const response = await fetch(kind === 'review' ? `/api/apps/${appId}/reviews` : `/api/apps/${appId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(kind === 'review'
                    ? { action: 'report_review', review_id: reviewId, reason_code: 'merchant_report' }
                    : { action: 'report_listing', reason_code: 'merchant_report' }),
            });
            const payload = await response.json().catch(() => null) as ReportResponse | null;
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Report could not be submitted.');
            }
            setNotice('Report submitted for moderation.');
        } catch (reportError) {
            setError(reportError instanceof Error ? reportError.message : 'Report could not be submitted.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="report-action-wrap">
            <Button
                unstyled
                className="report-action"
                type="button"
                onClick={() => { void report(); }}
                disabled={submitting || (kind === 'review' && !reviewId)}
            >
                {submitting ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ShieldAlert size={13} aria-hidden="true" />}
                {label}
            </Button>
            {notice && <div className="marketplace-toast marketplace-toast--success" role="status">{notice}</div>}
            {error && (
                <div className="marketplace-banner marketplace-banner--critical" role="alert">
                    <strong>Report failed</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
