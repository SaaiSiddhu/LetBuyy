import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleHelp } from 'lucide-react';
import { ArrowRight, Mail, FileText, ShieldCheck } from '@letbuyy/ui';
import MarketplaceContentPage from '@/components/marketplace-content-page';
import MarketplaceContactForm from '@/components/marketplace-contact-form';

export const metadata: Metadata = { title: 'Contact theme support' };
const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@letbuyy.com';

export default function ContactPage() {
    return <MarketplaceContentPage className="marketplace-contact-page" artwork="support" breadcrumbLabel="Contact" title="Let’s find your next step." eyebrow="Contact theme support" intro="A question about a theme, your store, or a listing? Share the details below and prepare an email for our support team." headingActions={<a href="#contact-form" className="marketplace-text-link">Write your message<ArrowRight size={17} aria-hidden="true"/></a>}>
        <section className="contact-page-layout" aria-label="Contact theme support">
            <MarketplaceContactForm recipient={email}/>
            <aside className="contact-page-aside">
                <div className="contact-support-card"><Mail size={22} aria-hidden="true"/><h2>Prefer to email directly?</h2><p>Use your own email app and include the theme name and relevant reference.</p><a href={`mailto:${email}`} className="marketplace-text-link">{email}<ArrowRight size={15} aria-hidden="true"/></a></div>
                <div className="contact-support-card"><FileText size={22} aria-hidden="true"/><h2>A few details help.</h2><ul><li>Theme name, slug, and version.</li><li>The page or step where you need help.</li><li>What you expected and what happened.</li><li>A purchase or listing reference, if relevant.</li></ul></div>
                <div className="contact-support-card"><CircleHelp size={22} aria-hidden="true"/><h2>Find an answer now.</h2><p>Our guides explain choosing, adding, and managing a theme.</p><Link href="/support" className="marketplace-text-link">Visit the support center<ArrowRight size={15} aria-hidden="true"/></Link><Link href="/faq" className="marketplace-text-link">Browse common questions<ArrowRight size={15} aria-hidden="true"/></Link></div>
                <div className="contact-privacy-note"><ShieldCheck size={18} aria-hidden="true"/><p>Keep passwords, payment credentials, session cookies, private preview links, and unrelated customer information out of your message.</p></div>
            </aside>
        </section>
        <section className="contact-policy-strip"><div><h2>Privacy, policies, or rights?</h2><p>Choose that topic in the form, or review the policy directory for scope and accountable-contact information.</p></div><div><Link href="/legal" className="marketplace-text-link">Legal and privacy<ArrowRight size={15} aria-hidden="true"/></Link><Link href="/legal/grievance" className="marketplace-text-link">Grievance information<ArrowRight size={15} aria-hidden="true"/></Link></div></section>
    </MarketplaceContentPage>;
}
