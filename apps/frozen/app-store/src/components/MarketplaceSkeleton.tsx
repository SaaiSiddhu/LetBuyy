interface MarketplaceSkeletonProps {
    titleWidth?: 'short' | 'medium' | 'long';
    cards?: number;
    showToolbar?: boolean;
}

export function MarketplaceSkeleton({
    titleWidth = 'medium',
    cards = 6,
    showToolbar = true,
}: MarketplaceSkeletonProps) {
    const titleClass = titleWidth === 'short'
        ? 'marketplace-skeleton-title marketplace-skeleton-line--short'
        : titleWidth === 'long'
            ? 'marketplace-skeleton-title marketplace-skeleton-line--full'
            : 'marketplace-skeleton-title';

    return (
        <div className="marketplace-skeleton-page" aria-busy="true" aria-live="polite">
            <div className="marketplace-skeleton-header">
                <div className={`skeleton ${titleClass}`} />
                <div className="skeleton marketplace-skeleton-copy" />
            </div>
            {showToolbar && (
                <div className="marketplace-skeleton-toolbar">
                    <div className="skeleton marketplace-skeleton-pill" />
                    <div className="skeleton marketplace-skeleton-pill" />
                    <div className="skeleton marketplace-skeleton-pill" />
                </div>
            )}
            <div className="marketplace-skeleton-grid">
                {Array.from({ length: cards }).map((_, index) => (
                    <div className="marketplace-skeleton-card" key={index}>
                        <div className="marketplace-skeleton-card-row">
                            <div className="skeleton marketplace-skeleton-icon" />
                            <div className="marketplace-stack">
                                <div className="skeleton marketplace-skeleton-line marketplace-skeleton-line--medium" />
                                <div className="skeleton marketplace-skeleton-line marketplace-skeleton-line--short" />
                            </div>
                        </div>
                        <div className="skeleton marketplace-skeleton-line marketplace-skeleton-line--full" />
                        <div className="skeleton marketplace-skeleton-line marketplace-skeleton-line--medium" />
                    </div>
                ))}
            </div>
        </div>
    );
}
