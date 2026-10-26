import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Input } from '@letbuyy/ui';
import MarketplaceContentPage from '@/components/marketplace-content-page';
import MarketplaceFaqs from '@/components/marketplace-faqs';
import { MARKETPLACE_FAQS } from '@/lib/marketplace-content';
export const metadata: Metadata = { title: 'Theme marketplace FAQs', description: 'Answers about choosing, purchasing, installing and managing LetBuyy themes.' };
export default async function FaqPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
    const params=await searchParams; const query=typeof params?.q==='string'?params.q.trim().slice(0,80):'';
    const items=MARKETPLACE_FAQS.filter(item=>`${item.question} ${item.answer}`.toLowerCase().includes(query.toLowerCase()));
    const groups=Array.from(new Set(items.map(item=>item.category)));
    return <MarketplaceContentPage title="Good questions. Clear answers." eyebrow="Frequently asked questions" intro="Understand what happens before you choose a theme, when you add it, and after it reaches your store.">
        <form action="/faq" method="get" role="search" className="marketplace-resource-search"><Input label="Search questions and answers" name="q" type="search" defaultValue={query} maxLength={80} placeholder="Try downloads, refund, or mobile" /><Button type="submit">Find an answer</Button></form>
        <nav className="marketplace-category-nav" aria-label="FAQ topics">{groups.map((group,index)=><a key={group} href={`#faq-topic-${index}`}>{group}</a>)}</nav>
        {groups.map((group,index)=><section className="marketplace-detail-anchor" key={group} id={`faq-topic-${index}`}><h2>{group}</h2><MarketplaceFaqs expanded={Boolean(query)} items={items.filter(item=>item.category===group)} /></section>)}
        {!items.length && <div className="marketplace-content-note" role="status"><h2>No matching answers</h2><p>Try another word or browse the full question list.</p><Link href="/faq" className="marketplace-text-link">Show all questions</Link></div>}
        <div className="marketplace-content-note"><h2>Need help with your own account or store?</h2><p>Use the support center to find the right workflow and the details to include when contacting us.</p><Link href="/support" className="marketplace-action">Visit support</Link></div>
    </MarketplaceContentPage>;
}
