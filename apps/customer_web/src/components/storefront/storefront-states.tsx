import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState, Skeleton } from '@letbuyy/ui';

type StorefrontEmptyStateProps = {
    actionHref?: string;
    actionIcon?: ReactNode;
    actionLabel?: string;
    body: string;
    icon: ReactNode;
    title: string;
};

export function StorefrontEmptyState({
    actionHref,
    actionIcon,
    actionLabel,
    body,
    icon,
    title,
}: StorefrontEmptyStateProps) {
    const action = actionHref && actionLabel
        ? (
            <Link className="storefront-empty-state__action" href={actionHref}>
                {actionIcon}
                <span>{actionLabel}</span>
            </Link>
        )
        : undefined;
    const illustration = (
        <div className="storefront-empty-state__icon" aria-hidden="true">
            {icon}
        </div>
    );

    return (
        <EmptyState
            className="storefront-empty-state"
            kind="generic"
            illustration={illustration}
            title={title}
            body={body}
            primaryAction={action}
        />
    );
}

export function StorefrontLoadingState() {
    return (
        <main className="storefront-loading-state" aria-busy="true" aria-label="Loading storefront">
            <div className="storefront-loading-state__hero">
                <Skeleton variant="card" className="storefront-loading-state__hero-card" />
            </div>
            <section className="storefront-loading-state__section">
                <div className="storefront-loading-state__heading">
                    <Skeleton lines={2} />
                </div>
                <div className="storefront-loading-state__grid">
                    <Skeleton variant="card" />
                    <Skeleton variant="card" />
                    <Skeleton variant="card" />
                </div>
            </section>
            <section className="storefront-loading-state__section storefront-loading-state__section--muted">
                <div className="storefront-loading-state__heading">
                    <Skeleton lines={2} />
                </div>
                <Skeleton variant="card" className="storefront-loading-state__wide-card" />
            </section>
        </main>
    );
}

export function StorefrontListLoadingState({ rows = 3 }: { rows?: number }) {
    return (
        <div className="storefront-list-loading-state" aria-busy="true" aria-label="Loading list">
            <div className="storefront-list-loading-state__heading">
                <Skeleton lines={2} />
            </div>
            <Skeleton variant="table" lines={rows} />
        </div>
    );
}
