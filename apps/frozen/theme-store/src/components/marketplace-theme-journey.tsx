import Image from 'next/image';
import Link from 'next/link';
import { MousePointer2 } from 'lucide-react';
import { ArrowRight, Check, Monitor, Smartphone, Card } from '@letbuyy/ui';

/** Decorative, code-native illustrations; these are examples, not live editor controls. */
function StoreWindow() {
    return <div className="journey-store">
        <div className="journey-window-bar"><i /><i /><i /><span /></div>
        <div className="journey-store-nav"><b>YOUR BRAND</b><span>Shop&nbsp;&nbsp; About</span></div>
        <div className="journey-store-hero"><div><small>EVERYDAY, REIMAGINED</small><strong>A little more you.</strong><i /></div><div className="journey-photo"><Image src="/showcase/living.webp" alt="" fill sizes="180px" /></div></div>
        <div className="journey-store-products"><i /><i /><i /></div>
    </div>;
}

function JourneyIllustration({ kind }: { kind: 'choose' | 'personalise' | 'prepare' }) {
    return <div className={`journey-art journey-art-${kind}`} aria-hidden="true">
        {kind === 'choose' && <>
            <div className="journey-sample-behind"><div className="journey-window-bar"><i /><i /><i /></div><div className="journey-photo"><Image src="/showcase/wardrobe.webp" alt="" fill sizes="110px" /></div></div>
            <StoreWindow />
            <div className="journey-floating-label"><Monitor /><span>Explore the details</span></div>
            <MousePointer2 className="journey-cursor" />
        </>}
        {kind === 'personalise' && <>
            <StoreWindow />
            <div className="journey-editor"><span>Make it yours</span><div className="journey-swatches"><i /><i /><i /><i /></div><div className="journey-editor-line" /><div className="journey-editor-line" /><div className="journey-type"><b>Aa</b><span>Your type.<br />Your personality.</span></div></div>
            <MousePointer2 className="journey-cursor" />
        </>}
        {kind === 'prepare' && <>
            <StoreWindow />
            <div className="journey-phone"><div className="journey-phone-speaker" /><div className="journey-photo"><Image src="/showcase/living-detail.webp" alt="" fill sizes="90px" /></div><b>Your next chapter.</b><i /><i /></div>
            <div className="journey-review"><span><Check /> Pages &amp; content</span><span><Check /> Navigation</span><span><Smartphone /> Mobile experience</span></div>
        </>}
    </div>;
}

const STEPS = [
    { kind: 'choose', label: 'Choose', title: 'Find a look that fits.', description: 'Explore a sample and look beyond the first screen. Consider your products, content, and customer journey.', href: '/guides/choose-the-right-theme', link: 'Find the right theme' },
    { kind: 'personalise', label: 'Personalise', title: 'Put your brand into it.', description: 'Add a theme to your store library, then bring your colours, images, and content into the merchant editor.', href: '/guides/install-and-publish', link: 'Learn how to get started' },
    { kind: 'prepare', label: 'Prepare to publish', title: 'Check every little detail.', description: 'Review your pages, links, and desktop and mobile layouts before you change your live design.', href: '/guides/before-you-publish', link: 'Open the launch checklist' },
] as const;

export default function MarketplaceThemeJourney() {
    return <section className="marketplace-section marketplace-container marketplace-journey" aria-labelledby="how-it-works">
        <div className="marketplace-section-heading journey-heading">
            <div><p className="marketplace-eyebrow">From first look to your own look</p><h2 id="how-it-works">Your next look, in three steps.</h2><p>Find your starting point. Bring your brand. Take it live when you’re ready.</p></div>
            <Link href="/guides" className="marketplace-text-link">All theme guides <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <ol className="journey-steps">{STEPS.map((step, index) => <li key={step.kind}>
            <Card as="article" className="journey-card" layout="stack">
                <JourneyIllustration kind={step.kind} />
                <div className="journey-card-copy"><p className="journey-step-label"><span aria-hidden="true">0{index + 1}</span>{step.label}</p><h3>{step.title}</h3><p>{step.description}</p><Link href={step.href} className="marketplace-text-link">{step.link}<ArrowRight size={18} aria-hidden="true" /></Link></div>
            </Card>
        </li>)}</ol>
    </section>;
}
