import Image from 'next/image';
import Link from 'next/link';
import { EmptyState } from '@letbuyy/ui';
import type { MarketplaceAppCollectionSection } from '@letbuyy/shared-types';

interface MarketplaceCollectionSectionsProps {
    sections?: MarketplaceAppCollectionSection[] | null;
    emptyTitle: string;
    emptyBody: string;
}

export function MarketplaceCollectionSections({
    sections,
    emptyTitle,
    emptyBody,
}: MarketplaceCollectionSectionsProps) {
    const publishedSections = sections || [];

    if (publishedSections.length === 0) {
        return (
            <section className="category-editorial-slot">
                <EmptyState kind="apps" title={emptyTitle} body={emptyBody} />
            </section>
        );
    }

    return (
        <section className="collection-body-sections" aria-label="Editorial body">
            {publishedSections.map((section) => (
                <article key={section.id} className={`collection-body-section collection-body-section--${section.section_type}`}>
                    {section.heading ? <h2>{section.heading}</h2> : null}
                    {section.body ? <p>{section.body}</p> : null}
                    {section.media_url ? (
                        <div className="collection-body-media">
                            <Image src={section.media_url} alt={section.heading || 'Collection media'} width={960} height={540} sizes="(min-width: 900px) 760px, 100vw" />
                        </div>
                    ) : null}
                    {section.app_id ? (
                        <Link className="collection-body-link" href={`/apps/${section.app_id}`}>
                            View app
                        </Link>
                    ) : null}
                    {section.cta_href && section.cta_label ? (
                        <Link className="collection-body-link" href={section.cta_href}>
                            {section.cta_label}
                        </Link>
                    ) : null}
                </article>
            ))}
        </section>
    );
}
