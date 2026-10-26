import type { Metadata } from 'next';
import Link from 'next/link';
import MarketplaceContentPage,{ResourceGrid} from '@/components/marketplace-content-page';
import MarketplaceFaqs from '@/components/marketplace-faqs';
import {MARKETPLACE_FAQS} from '@/lib/marketplace-content';
export const metadata:Metadata={title:'Theme support center'};
export default function SupportPage(){return <MarketplaceContentPage title="Let’s find the next useful step." eyebrow="Support center" intro="Get help choosing a theme, checking a purchase, adding a design, or managing an installed version.">
    <section><h2>What do you need help with?</h2><ResourceGrid items={[
        {title:'Choosing or previewing',description:'Understand public samples, store-specific previews, and what to do when a demo version is unavailable.',href:'/guides/preview-a-theme'},
        {title:'Adding a theme',description:'Check the account, selected store, package version, and private library result before trying again.',href:'/guides/install-and-publish'},
        {title:'Purchase or license records',description:'Check the purchase outcome and available receipt or license before repeating a payment.',href:'/dashboard/purchases'},
        {title:'Files and downloads',description:'Review entitlement and available platform files. An expired link or missing format is different from a failed store installation.',href:'/legal/delivery'},
        {title:'Updates and release recovery',description:'Read the changelog, inspect the current store release, and review the eligible update or rollback action.',href:'/guides/updates-and-rollback'},
        {title:'Creator submissions',description:'Understand draft, submitted, and reviewed listing states and the information needed for a review.',href:'/for-creators'},
    ]}/></section>
    <section><h2>Common things to check first</h2><MarketplaceFaqs items={MARKETPLACE_FAQS.filter(item=>['missing-demo','no-store','downloads','receipt','rollback'].includes(item.id))}/></section>
    <section className="marketplace-reading-layout"><div><h2>Help us understand the issue</h2><p>A clear description makes it easier to identify whether the problem belongs to the listing, your store, a purchase, or an available package file.</p><ol className="marketplace-checklist"><li>Theme name, slug, and version.</li><li>Affected page or workflow and the store you manage, if relevant.</li><li>What you expected, what happened, and the steps that reproduce it.</li><li>The relevant purchase, installation, or listing reference.</li></ol></div><aside className="marketplace-content-note"><h3>Keep private information private</h3><p>Do not send passwords, payment credentials, session cookies, private preview tokens, or unrelated customer information.</p><Link className="marketplace-text-link" href="/contact">View contact options</Link></aside></section>
    <section><h2>Know who can help</h2><p>Use marketplace support for access, purchase records, entitlement, or installation concerns. Check the listing’s author and documentation for theme-specific behavior. Custom design work and feature requests need a separate scope.</p><div className="marketplace-hero-actions"><Link className="marketplace-action" href="/contact">Contact support</Link><Link className="marketplace-text-link" href="/legal/support">Support and update information</Link><Link className="marketplace-text-link" href="/legal/grievance">Grievance information</Link></div></section>
</MarketplaceContentPage>;}
