'use client';

import { MarketplaceUnavailable as SharedMarketplaceUnavailable } from '@letbuyy/ui/marketplace';
import { useRouter } from 'next/navigation';

/**
 * Explicit, retryable error state for when the app catalog backend is
 * unavailable. Replaces the previous silent empty-catalog fallback (H5) so an
 * outage is never presented to merchants as "no apps".
 */
export function MarketplaceUnavailable({
    title = 'App catalog temporarily unavailable',
    body = 'We could not reach the app catalog service right now. This is a temporary issue on our side — please try again.',
    onRetry,
}: {
    title?: string;
    body?: string;
    onRetry?: () => void;
}) {
    const router = useRouter();
    const handleRetry = onRetry ?? (() => router.refresh());
    return (
        <SharedMarketplaceUnavailable
            title={title}
            body={body}
            buttonLabel="Try again"
            onRetry={handleRetry}
            style={{ textAlign: 'center', padding: '48px 16px' }}
            headingStyle={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}
            bodyStyle={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 16, maxWidth: 420, marginInline: 'auto' }}
            buttonStyle={{
                padding: '8px 18px',
                borderRadius: 8,
                border: '1px solid var(--lb-color-border, #d0d0d0)',
                background: 'var(--lb-color-surface, #fff)',
                color: 'var(--text-primary, inherit)',
                fontWeight: 600,
                cursor: 'pointer',
            }}
        />
    );
}
