'use client';

import { MarketplaceUnavailable as SharedMarketplaceUnavailable } from '@letbuyy/ui/marketplace';
import { useRouter } from 'next/navigation';

/**
 * Explicit, retryable error state for when the theme catalog backend is
 * unavailable. Replaces the previous silent empty-catalog fallback (H5) so an
 * outage is never presented to merchants as "no themes".
 */
export default function MarketplaceUnavailable({
    title = 'Theme catalog temporarily unavailable',
    body = 'We could not reach the theme catalog service right now. This is a temporary issue on our side — please try again.',
}: {
    title?: string;
    body?: string;
}) {
    const router = useRouter();
    return (
        <SharedMarketplaceUnavailable
            title={title}
            body={body}
            onRetry={() => router.refresh()}
            className="text-center py-16"
            headingClassName="text-lg font-bold text-text-heading mb-2"
            bodyClassName="text-sm text-text-muted mb-4 max-w-md mx-auto"
            buttonClassName="btn-primary text-sm py-2.5 px-6"
        />
    );
}
