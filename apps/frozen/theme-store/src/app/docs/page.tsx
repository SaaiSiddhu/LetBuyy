import type { Metadata } from 'next';
import Link from 'next/link';
import MarketplaceContentPage, { ResourceGrid } from '@/components/marketplace-content-page';
export const metadata:Metadata={title:'Theme documentation'};
export default function DocsPage(){return <MarketplaceContentPage artwork="learn" title="Your theme, from first look to live store." eyebrow="Documentation" intro="Understand the tools, records, and next steps behind your LetBuyy theme journey.">
    <section><h2>Start with the task in front of you</h2><ResourceGrid items={[
        {title:'Choose and evaluate',description:'Use store layouts and features to narrow the catalog. Save candidates, compare them, and inspect the current version’s screenshots and available sample.',href:'/guides/choose-the-right-theme'},
        {title:'Add and customize',description:'Choose the correct store, add a private library instance, and use the merchant editor to bring in your own content. Adding and publishing are separate actions.',href:'/guides/install-and-publish'},
        {title:'Review before publication',description:'Check the draft’s navigation, images, product information, mobile layout, and customer journey before making a separate publish decision.',href:'/guides/before-you-publish'},
        {title:'Maintain and recover',description:'Review the installed version, read the changelog, and check updates or eligible prior releases through the existing theme workflow.',href:'/guides/updates-and-rollback'},
    ]}/></section>
    <section><h2>Know where your records live</h2><ResourceGrid items={[
        {title:'Your theme library',description:'Find your account’s theme workspace and continue with the store you are authorized to manage.',href:'/dashboard'},
        {title:'Installations and releases',description:'Inspect installed versions, open the merchant theme library, and review eligible release actions.',href:'/dashboard/installations'},
        {title:'Purchases and licenses',description:'Review confirmed purchase records and available receipts and license information.',href:'/dashboard/purchases'},
        {title:'Standalone downloads',description:'Check the actual files available for your entitlement and platform. Store installation and artifact downloads are different capabilities.',href:'/dashboard/downloads'},
    ]}/></section>
    <section className="marketplace-content-note"><h2>Building a theme package?</h2><p>Prepare accurate metadata, test the supported page types, document asset permissions, and review submission requirements before using the author workspace.</p><div className="marketplace-hero-actions"><Link className="marketplace-text-link" href="/for-creators">Creator guidance</Link><Link className="marketplace-text-link" href="/docs/api">Technical API reference</Link></div></section>
</MarketplaceContentPage>;}
