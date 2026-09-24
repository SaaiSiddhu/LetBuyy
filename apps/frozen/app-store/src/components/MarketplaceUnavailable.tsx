'use client';

import { MarketplaceUnavailable as SharedMarketplaceUnavailable } from '@letbuyy/ui/marketplace';
import { t } from '@/lib/i18n/messages';
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
    const retryLabel = t('marketplace.error.retry') || 'Try again';
    return (
        <SharedMarketplaceUnavailable
            title={title}
            body={body}
            buttonLabel={retryLabel}
            onRetry={handleRetry}
            className="marketplace-unavailable"
            headingClassName="marketplace-unavailable-heading"
            bodyClassName="marketplace-unavailable-body"
            buttonClassName="appstore-header-btn"
        />
    );
}
