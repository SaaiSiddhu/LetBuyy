import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Card, Page } from '@letbuyy/ui';

export interface ResourceLink { title: string; description: string; href: string; label?: string }
export function ResourceGrid({ items }: { items: ResourceLink[] }) {
    return <div className="marketplace-resource-grid">{items.map(item => <Card key={item.href} layout="stack" className="marketplace-resource-card">
        <h3><Link href={item.href}>{item.title}</Link></h3><p>{item.description}</p>
        <Link href={item.href} className="marketplace-text-link">{item.label || 'Read more'} <ArrowRight size={16} aria-hidden="true" /></Link>
    </Card>)}</div>;
}
export default function MarketplaceContentPage({ title, intro, eyebrow = 'LetBuyy Themes', children, parent }: {
    title: string; intro: string; eyebrow?: string; children: ReactNode; parent?: { label: string; href: string };
}) {
    return <Page className="marketplace marketplace-content-page"><div className="marketplace-container">
        <nav className="marketplace-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Themes home</Link><span aria-hidden="true">/</span>{parent && <><Link href={parent.href}>{parent.label}</Link><span aria-hidden="true">/</span></>}<span aria-current="page">{title}</span></nav>
        <header className="marketplace-content-heading"><p className="marketplace-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="marketplace-intro">{intro}</p></header>
        <div className="marketplace-content-sections">{children}</div>
    </div></Page>;
}
