import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Card, Page } from '@letbuyy/ui';
import MarketplaceArtwork, { artworkForHref, type MarketplaceArtworkKind } from './marketplace-artwork';

export interface ResourceLink { title: string; description: string; href: string; label?: string; artwork?: MarketplaceArtworkKind }
export function resourceAction(href: string): string {
    if (href.startsWith('/guides/')) return 'Read the guide';
    if (href.startsWith('/themes/category/')) return 'Explore this category';
    if (href.startsWith('/themes')) return 'Browse themes';
    if (href.startsWith('/collections')) return 'Explore collections';
    if (href.startsWith('/legal')) return 'View document';
    if (href.startsWith('/dashboard')) return 'Open your library';
    if (href.startsWith('/pricing')) return 'Understand pricing';
    if (href.startsWith('/developer') || href.startsWith('/for-creators')) return 'Explore creator resources';
    if (href.startsWith('/faq')) return 'Find an answer';
    if (href.startsWith('/docs')) return 'Explore documentation';
    if (href.startsWith('/contact') || href.startsWith('/support')) return 'Get support';
    return 'Explore this resource';
}
export function ResourceGrid({ items }: { items: ResourceLink[] }) {
    return <div className="marketplace-resource-grid">{items.map(item => <Card as="article" key={item.href} layout="stack" className="marketplace-resource-card marketplace-illustrated-resource">
        <div className="marketplace-resource-art"><MarketplaceArtwork kind={item.artwork || artworkForHref(item.href)} /></div>
        <div className="marketplace-resource-copy"><h3><Link href={item.href}>{item.title}</Link></h3><p>{item.description}</p>
        <Link href={item.href} className="marketplace-text-link" aria-label={`${item.label || resourceAction(item.href)}: ${item.title}`}>{item.label || resourceAction(item.href)} <ArrowRight size={16} aria-hidden="true" /></Link></div>
    </Card>)}</div>;
}
export default function MarketplaceContentPage({ title, intro, eyebrow = 'LetBuyy Themes', children, parent, artwork = 'discover', headingActions, className = '', breadcrumbLabel }: {
    title: string; intro: string; eyebrow?: string; children: ReactNode; parent?: { label: string; href: string }; artwork?: MarketplaceArtworkKind; headingActions?: ReactNode; className?: string; breadcrumbLabel?: string;
}) {
    return <Page className={`marketplace marketplace-content-page ${className}`}><div className="marketplace-container">
        <nav className="marketplace-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Themes home</Link><span aria-hidden="true">/</span>{parent && <><Link href={parent.href}>{parent.label}</Link><span aria-hidden="true">/</span></>}<span aria-current="page">{breadcrumbLabel || title}</span></nav>
        <header className="marketplace-content-heading marketplace-illustrated-heading"><div><p className="marketplace-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="marketplace-intro">{intro}</p>{headingActions && <div className="marketplace-heading-actions">{headingActions}</div>}</div><MarketplaceArtwork kind={artwork} priority /></header>
        <div className="marketplace-content-sections">{children}</div>
    </div></Page>;
}
