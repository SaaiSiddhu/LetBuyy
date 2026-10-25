import { localizeMetadata } from '@/lib/i18n/metadata'
import Copy from '@/components/i18n/Copy'
import type { Metadata } from 'next'
import Image from 'next/image'
import { ArrowRight, BookOpen, MessageCircle, ShieldCheck } from '@letbuyy/ui'
import Link from '@/components/i18n/LocaleLink'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import TicketLookup from '@/components/contact/TicketLookup'
import SupportIllustration from '@/components/support/SupportIllustration'
import styles from '@/components/support/support-experience.module.css'
import { getArticleArtwork } from '@/lib/resources/artwork'
import { getAccountsUrl, getSupportEmail } from '@/lib/public-urls'

const sourceMetadata: Metadata = {
  title: 'Support centre — LetBuyy',
  description: 'Find a guide, contact the LetBuyy team, check a support ticket, or read the grievance process.',
  alternates: { canonical: '/support' },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata(sourceMetadata, (await params).locale, "/support")
}


const GUIDES = [
  { title: 'Start your store', detail: 'Store setup, products and launch.', href: '/resources/ecommerce', artwork: 'how-to-start-an-online-store-india' },
  { title: 'Payments and invoices', detail: 'UPI, COD, GST and billing guides.', href: '/resources/payments', artwork: 'upi-vs-cod-india' },
  { title: 'Orders and delivery', detail: 'Stock, fulfillment and shipping.', href: '/resources/operations', artwork: 'order-fulfillment-guide' },
  { title: 'Themes and design', detail: 'Customise your storefront.', href: '/resources/platform/how-themes-work', artwork: 'how-themes-work' },
  { title: 'Developer help', detail: 'APIs, webhooks and integrations.', href: '/resources/developers', artwork: 'letbuyy-api-getting-started' },
  { title: 'AI commerce', detail: 'Understand the tools and use cases.', href: '/resources/ai-commerce', artwork: 'ai-commerce-explained' },
]

export default function SupportPage() {
  return <>
    <Header />
    <main className={styles.support}>
      <div className="container">
        <header className={styles.hero}>
          <div><p className={styles.eyebrow}><BookOpen size={16} aria-hidden="true" /><Copy text={"LETBUYY SUPPORT"} /></p><h1><Copy text={"A clear next step."} /><br /><Copy text={"A little help along the way."} /></h1><p className={styles.intro}><Copy text={"Find a useful guide, talk to the team, or check an existing ticket. Start with the route that fits your question."} /></p><div className={styles.actions}><Link href="/contact#contact-form" className={styles.primary}><Copy text={"Contact the team"} /><ArrowRight size={16} aria-hidden="true" /></Link><a href="#help-guides" className={styles.textLink}><Copy text={"Browse help guides"} /><ArrowRight size={16} aria-hidden="true" /></a></div></div>
          <SupportIllustration kind="support" />
        </header>
        <section className={styles.section} aria-label="Choose a support route">
          <div className={styles.routes}>
            <Link href="/resources" className={styles.route}><BookOpen size={25} aria-hidden="true" /><strong><Copy text={"Find an answer"} /></strong><p><Copy text={"Explore practical guides for setting up and running your store."} /></p><span><Copy text={"Open the library"} /><ArrowRight size={16} aria-hidden="true" /></span></Link>
            <Link href="/contact#contact-form" className={styles.route}><MessageCircle size={25} aria-hidden="true" /><strong><Copy text={"Ask the team"} /></strong><p><Copy text={"Choose a topic in the contact form and explain what you need."} /></p><span><Copy text={"Write a message"} /><ArrowRight size={16} aria-hidden="true" /></span></Link>
            <Link href="/legal/grievance" className={styles.route}><ShieldCheck size={25} aria-hidden="true" /><strong><Copy text={"Raise a concern"} /></strong><p><Copy text={"Read the published grievance process and escalation information."} /></p><span><Copy text={"View the process"} /><ArrowRight size={16} aria-hidden="true" /></span></Link>
          </div>
        </section>
        <section id="help-guides" className={`${styles.section} ${styles.anchor}`} aria-labelledby="help-guides-title">
          <div className={styles.sectionHead}><h2 id="help-guides-title"><Copy text={"What are you working on?"} /></h2><Link href="/resources/search" className={styles.textLink}><Copy text={"Search all guides"} /><ArrowRight size={16} aria-hidden="true" /></Link></div>
          <div className={styles.guides}>{GUIDES.map(guide => {
            const artwork = getArticleArtwork(guide.artwork)!
            return <Link key={guide.href} href={guide.href} className={styles.guide}><Image src={artwork.thumbnailSrc} alt="" width={artwork.width} height={artwork.height} sizes="100px" loading="eager" unoptimized /><span><strong><Copy text={guide.title} /></strong><small><Copy text={guide.detail} /></small></span><ArrowRight size={17} aria-hidden="true" /></Link>
          })}</div>
        </section>
        <section className={styles.section} aria-labelledby="ticket-help-title"><div className={styles.ticketArea}><div><p className={styles.eyebrow}><Copy text={"ALREADY IN TOUCH?"} /></p><h2 id="ticket-help-title"><Copy text={"Check an existing ticket."} /></h2><p><Copy text={"Use your ticket reference and the email address you used when contacting us."} /></p><div className={styles.actions}><a href={`mailto:${getSupportEmail()}`} className={styles.textLink}><Copy text={"Prefer email?"} /><ArrowRight size={16} aria-hidden="true" /></a><a href={getAccountsUrl('/lookup')} className={styles.textLink}><Copy text={"Find your account"} /><ArrowRight size={16} aria-hidden="true" /></a></div></div><TicketLookup /></div></section>
      </div>
    </main>
    <Footer />
  </>
}
