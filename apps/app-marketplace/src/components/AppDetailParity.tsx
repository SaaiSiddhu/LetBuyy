import Link from 'next/link';
import { EmptyState, ShieldCheck, Star } from '@letbuyy/ui';
import type { MarketplaceAppAward, MarketplaceAppFeatureGroup } from '@letbuyy/shared-types';

interface MetaStripItem {
    label: string;
    value: string;
    detail?: string;
}

export function MetaStrip({ items }: { items: MetaStripItem[] }) {
    return (
        <dl className="app-meta-strip">
            {items.map((item) => (
                <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                    {item.detail ? <span>{item.detail}</span> : null}
                </div>
            ))}
        </dl>
    );
}

export function WorksWithChips({
    categorySlug,
    items,
}: {
    categorySlug?: string | null;
    items: string[];
}) {
    if (items.length === 0) return null;

    return (
        <section className="marketplace-card marketplace-section">
            <div className="marketplace-section-header">
                <h2>Works with</h2>
                <p>Compatibility signals declared by the partner or recommendation service.</p>
            </div>
            <div className="app-chip-list">
                {items.map((item) => (
                    <Link key={item} href={categorySlug ? `/categories/${categorySlug}/all?q=${encodeURIComponent(item)}` : '/search'}>
                        {item}
                    </Link>
                ))}
            </div>
        </section>
    );
}

export function FeatureTagGroups({
    categorySlug,
    features,
    groups,
}: {
    categorySlug?: string | null;
    features?: string[];
    groups?: MarketplaceAppFeatureGroup[];
}) {
    const featureGroups = groups || [];
    const fallbackFeatures = features || [];
    if (featureGroups.length === 0 && fallbackFeatures.length === 0) return null;

    return (
        <section className="marketplace-card marketplace-section">
            <div className="marketplace-section-header">
                <h2>Show features</h2>
                <p>Feature tags are assigned from the published category taxonomy.</p>
            </div>
            {featureGroups.length > 0 ? (
                <div className="feature-tag-groups">
                    {featureGroups.map((group) => (
                        <div key={group.id} className="feature-tag-group">
                            <h3>{group.label}</h3>
                            <div className="app-chip-list">
                                {(group.tags || []).map((tag) => (
                                    <Link
                                        key={tag.handle}
                                        href={categorySlug
                                            ? `/categories/${categorySlug}/all?feature_handles[]=${encodeURIComponent(tag.handle)}`
                                            : `/search?feature_handles[]=${encodeURIComponent(tag.handle)}`}
                                    >
                                        {tag.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="app-chip-list">
                    {fallbackFeatures.map((feature) => (
                        <Link
                            key={feature}
                            href={categorySlug ? `/categories/${categorySlug}/all?q=${encodeURIComponent(feature)}` : `/search?q=${encodeURIComponent(feature)}`}
                        >
                            {feature}
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}

export function WhatMerchantsThink({ summary }: { summary?: string | null }) {
    return (
        <section className="marketplace-card marketplace-section">
            <div className="marketplace-section-header">
                <h2>What merchants think</h2>
                <p>Summaries render only from persisted, approved source data.</p>
            </div>
            {summary ? (
                <div className="merchant-think-summary">
                    <Star size={18} fill="currentColor" stroke="currentColor" aria-hidden="true" />
                    <p>{summary}</p>
                    <div className="merchant-think-summary__feedback" aria-label="Summary feedback">
                        <span>Helpful</span>
                        <span>Not helpful</span>
                    </div>
                </div>
            ) : (
                <EmptyState
                    kind="apps"
                    title="No merchant summary yet"
                    body="This slot stays empty until an approved summary is persisted from real review data."
                />
            )}
        </section>
    );
}

export function BuiltForLetbuyySentence({
    awardedAt,
    award,
}: {
    awardedAt?: string | null;
    award?: MarketplaceAppAward | null;
}) {
    return (
        <div className="quality-badge quality-badge--detail">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
                <strong>{award?.label || 'Built for LetBuyy'}</strong>
                <span>{award?.blurb || (awardedAt ? `Awarded ${awardedAt}` : 'Meets LetBuyy marketplace quality signals.')}</span>
            </div>
            <Link href="/developers/review-requirements">Learn more</Link>
        </div>
    );
}
