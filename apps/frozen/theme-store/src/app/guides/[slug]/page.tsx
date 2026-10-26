import type { Metadata } from 'next';
import { artworkForHref } from '@/components/marketplace-artwork';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MarketplaceContentPage, { ResourceGrid } from '@/components/marketplace-content-page';
import { findMarketplaceGuide, MARKETPLACE_GUIDES } from '@/lib/marketplace-content';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const guide = findMarketplaceGuide((await params).slug);
    return guide ? {title:guide.title,description:guide.summary} : {title:'Guide not found',robots:{index:false}};
}
export default async function GuidePage({ params }: Props) {
    const guide = findMarketplaceGuide((await params).slug);
    if (!guide) notFound();
    const related = MARKETPLACE_GUIDES.filter(item => guide.related.includes(item.slug));
    return <MarketplaceContentPage artwork={artworkForHref(`/guides/${guide.slug}`)} title={guide.title} intro={guide.summary} eyebrow={guide.topic} parent={{label:'Theme guides',href:'/guides'}}>
        <div className="marketplace-reading-layout">
            <aside className="marketplace-contents"><nav aria-label="On this page"><strong>In this guide</strong>{guide.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav><Link href="/guides" className="marketplace-text-link">All theme guides</Link></aside>
            <article className="marketplace-article"><div className="marketplace-content-note"><strong>What you’ll leave with</strong><p>{guide.outcome}</p></div>
                {guide.sections.map(section => <section key={section.id} id={section.id} className="marketplace-detail-anchor"><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.checklist && <ul className="marketplace-checklist">{section.checklist.map(item => <li key={item}>{item}</li>)}</ul>}</section>)}
                <div className="marketplace-guide-next"><p>Ready for the next step?</p><Link href={guide.next.href} className="marketplace-action">{guide.next.label}</Link><Link href="/support" className="marketplace-text-link">Get help with this step</Link></div>
            </article>
        </div>
        <section><h2>Keep going</h2><ResourceGrid items={related.map(item=>({title:item.title,description:item.summary,href:`/guides/${item.slug}`}))} /></section>
    </MarketplaceContentPage>;
}
