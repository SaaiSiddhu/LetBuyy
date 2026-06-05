'use client';

import { useRouter } from 'next/navigation';

/**
 * Explicit, retryable error state for when the app catalog backend is
 * unavailable. Replaces the previous silent empty-catalog fallback (H5) so an
 * outage is never presented to merchants as "no apps".
 */
export function MarketplaceUnavailable({
    title = 'App catalog temporarily unavailable',
    body = 'We could not reach the app catalog service right now. This is a temporary issue on our side — please try again.',
}: {
    title?: string;
    body?: string;
}) {
    const router = useRouter();
    return (
        <div role="alert" aria-live="polite" style={{ textAlign: 'center', padding: '48px 16px' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{title}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 16, maxWidth: 420, marginInline: 'auto' }}>
                {body}
            </p>
            <button
                type="button"
                onClick={() => router.refresh()}
                style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--lb-color-border, #d0d0d0)',
                    background: 'var(--lb-color-surface, #fff)',
                    color: 'var(--text-primary, inherit)',
                    fontWeight: 600,
                    cursor: 'pointer',
                }}
            >
                Try again
            </button>
        </div>
    );
}
