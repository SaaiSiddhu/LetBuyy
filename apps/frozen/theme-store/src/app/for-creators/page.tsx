import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Card, Check, Info, Package, Monitor, FileText, ShieldCheck } from '@letbuyy/ui';
import MarketplaceContentPage, { ResourceGrid } from '@/components/marketplace-content-page';

export const metadata: Metadata = { title: 'Theme creator guidance', robots: { index: false, follow: true } };

const PREPARATION = [
    { title: 'Prepare the package', text: 'Start with a useful website type and content that demonstrates the pages your theme supports.', href: '#creator-checklist', label: 'Check the essentials' },
    { title: 'Tell the design’s story', text: 'Bring actual screenshots, clear feature descriptions, setup notes, and the right version details.', href: '/developer/listings/new', label: 'Open the listing builder' },
    { title: 'Follow the review', text: 'Check your listing’s current status and feedback in the author workspace. Submission and publication are separate.', href: '/developer', label: 'Visit the author workspace' },
];

const CHECKLIST = [
    { title: 'Package essentials', icon: Package, items: [
        ['Identify the version', 'Provide a clear theme name, slug, version, and website type.'],
        ['Describe what is included', 'List supported platforms, page types, sections, and known limitations.'],
        ['Use representative content', 'Show the design with realistic images, product names, and long text.'],
    ] },
    { title: 'Screenshots & presentation', icon: Monitor, items: [
        ['Show the actual theme', 'Use screenshots from the package and version you are describing.'],
        ['Cover the customer journey', 'Include relevant desktop and mobile views beyond the homepage.'],
        ['Explain the setup', 'Include documentation, change history, and available sample URLs.'],
    ] },
    { title: 'Quality & usability', icon: FileText, items: [
        ['Test the supported pages', 'Check navigation, image crops, long titles, and the important content journey.'],
        ['Check keyboard and mobile use', 'Review focus, controls, readable text, and narrow layouts.'],
        ['Support any measured claim', 'Identify the tested version, method, date, and results for performance or accessibility claims.'],
    ] },
    { title: 'Rights & ongoing support', icon: ShieldCheck, items: [
        ['Confirm asset permissions', 'Document rights to the code, fonts, images, and demo material.'],
        ['Make support easy to find', 'Provide setup guidance, a support route, and known limitations.'],
        ['Review the terms', 'Read the creator review document and confirm the scope of any commercial commitments.'],
    ] },
];

export default function CreatorsPage() {
    return <MarketplaceContentPage className="marketplace-creator-page" artwork="create" breadcrumbLabel="For creators" title="Prepare your theme for review." eyebrow="Creator resources" intro="Turn a considered design into a clear, useful listing. Prepare the package, show how it works, and give reviewers the details they need." headingActions={<><a href="#creator-checklist" className="marketplace-action">Start with the checklist<ArrowRight size={18} aria-hidden="true"/></a><Link href="/developer" className="marketplace-text-link">Open author workspace</Link></>}>
        <aside className="creator-review-note" aria-label="Preparation guidance"><Info size={20} aria-hidden="true"/><div><strong>Preparation and review guidance</strong><p>This page supports the author workspace. Programme activation, publication, commercial terms, and payout arrangements require separate approval.</p></div></aside>

        <section aria-labelledby="creator-process"><div className="creator-section-heading"><p className="marketplace-eyebrow">A clear way forward</p><h2 id="creator-process">From package to a useful listing.</h2></div><ol className="creator-process">{PREPARATION.map((step,index)=><li key={step.title}><span className="creator-step-number" aria-hidden="true">0{index+1}</span><h3>{step.title}</h3><p>{step.text}</p><Link href={step.href} className="marketplace-text-link">{step.label}<ArrowRight size={15} aria-hidden="true"/></Link></li>)}</ol></section>

        <section id="creator-checklist" aria-labelledby="creator-checklist-heading"><div className="creator-section-heading"><p className="marketplace-eyebrow">Before you submit</p><h2 id="creator-checklist-heading">The submission checklist.</h2><p>Review these details against the package and version you are sharing.</p></div><div className="creator-checklist-layout"><div className="creator-checklist-groups">{CHECKLIST.map(group=><Card as="article" className="creator-checklist-group" key={group.title}><h3><group.icon size={20} aria-hidden="true"/>{group.title}</h3><ul>{group.items.map(([title,text])=><li key={title}><Check size={15} aria-hidden="true"/><div><strong>{title}</strong><p>{text}</p></div></li>)}</ul></Card>)}</div><aside className="creator-reference-panel"><div><p className="marketplace-eyebrow">Know before you submit</p><h3>Rights and commercial terms</h3><p>License tiers, distribution terms, support commitments, and commercial programme terms require the responsible approval.</p><Link href="/legal/creator-agreement" className="marketplace-text-link">Read the creator review document<ArrowRight size={16} aria-hidden="true"/></Link></div><div><h3>Keep the listing accurate.</h3><p>A visual preset and a complete package are different things. A submitted record is not automatically a published theme.</p><Link href="/developer" className="marketplace-text-link">Check your listing status<ArrowRight size={16} aria-hidden="true"/></Link></div></aside></div></section>

        <section aria-labelledby="creator-toolkit"><div className="creator-section-heading"><p className="marketplace-eyebrow">Keep working</p><h2 id="creator-toolkit">Your creator toolkit.</h2></div><ResourceGrid items={[
            {title:'Author workspace',description:'Return to your listing records, current status, and review feedback using the appropriate account.',href:'/developer',label:'Open the workspace'},
            {title:'Listing builder',description:'Bring together the theme metadata, screenshots, supported platforms, and package information.',href:'/developer/listings/new',label:'Prepare a listing'},
            {title:'Technical reference',description:'Review the documented marketplace API surfaces and their purpose.',href:'/docs/api',label:'Read the reference'},
        ]}/></section>

        <section className="creator-help-strip" aria-labelledby="creator-help"><div><h2 id="creator-help">Need a hand with your submission?</h2><p>Include your listing slug, version, current state, and the question you need answered.</p></div><Link className="marketplace-action marketplace-action-secondary" href="/contact">View contact options<ArrowRight size={16} aria-hidden="true"/></Link></section>
    </MarketplaceContentPage>;
}
