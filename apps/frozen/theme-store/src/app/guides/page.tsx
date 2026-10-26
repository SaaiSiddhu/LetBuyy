import type { Metadata } from 'next';
import { Button, Input } from '@letbuyy/ui';
import Link from 'next/link';
import MarketplaceContentPage, { ResourceGrid } from '@/components/marketplace-content-page';
import { MARKETPLACE_GUIDES } from '@/lib/marketplace-content';
export const metadata: Metadata = { title: 'Theme guides', description: 'Practical guides to choosing, previewing, customizing and managing LetBuyy themes.' };
export default async function GuidesPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
    const params = await searchParams;
    const query = typeof params?.q === 'string' ? params.q.trim().slice(0, 80) : '';
    const guides = MARKETPLACE_GUIDES.filter(guide => !query || `${guide.title} ${guide.topic} ${guide.summary} ${guide.sections.map(section => `${section.title} ${section.paragraphs.join(' ')}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    return <MarketplaceContentPage title="A little guidance. A better starting point." eyebrow="Theme guides" intro="From your first shortlist to a new published look: practical steps for each part of your theme journey.">
        <form action="/guides" method="get" role="search" className="marketplace-resource-search"><Input label="Search theme guides" name="q" type="search" defaultValue={query} maxLength={80} placeholder="Try preview, license, or updates" /><Button type="submit">Search guides</Button></form>
        <section aria-labelledby="guide-results"><h2 id="guide-results">{query ? `Guides matching “${query}”` : 'Choose your next step'}</h2>{guides.length ? <ResourceGrid items={guides.map(guide => ({title:guide.title,description:guide.summary,href:`/guides/${guide.slug}`,label:guide.topic}))} /> : <div className="marketplace-content-note" role="status"><h3>No matching guides</h3><p>Try a broader phrase, such as theme, preview, or purchase.</p><Link href="/guides" className="marketplace-text-link">See all guides</Link></div>}</section>
        <div className="marketplace-content-note"><h2>Looking for a quick answer?</h2><p>Find answers about saved themes, licenses, missing demos, downloads, and store access.</p><Link href="/faq" className="marketplace-text-link">Browse frequently asked questions</Link></div>
    </MarketplaceContentPage>;
}
