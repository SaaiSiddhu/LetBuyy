
import Copy from '@/components/i18n/Copy'
import type { Metadata } from 'next'
import Link from '@/components/i18n/LocaleLink'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import MarketingIllustration from '@/components/MarketingIllustration'
import DemoRequestForm from '@/components/demo/DemoRequestForm'
import { LOCALES, getLocale } from '@/lib/i18n/locales'
import { buildAlternates } from '@/lib/i18n/routing'
import { getMarketingSiteUrl } from '@/lib/public-urls'

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const { locale: segment } = await params
    const locale = getLocale(segment)
    const alternates = buildAlternates(getMarketingSiteUrl(), '/demo', LOCALES)

    return {
        title: 'Request a demo',
        description:
            'See LetBuyy on a 30-minute call — storefront, payments, GST invoicing and shipping, set up against your own catalogue. No card required.',
        alternates: {
            canonical: alternates.canonicalOf(locale),
            languages: alternates.languages,
        },
        /* A lead form has no business competing in search with the pages that
           explain the product. */
        robots: { index: false, follow: true },
    }
}

export default async function DemoPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale: segment } = await params
    const locale = getLocale(segment)

    return (
        <>
            <Header />
            {/* Reuses the contact page's shell — same hero rhythm, same card
                language — so the two "talk to us" routes read as one thing
                rather than two designs that happen to share a header. */}
            <main className="ctc">
                <section className="ctc-hero">
                    <div className="container">
                        <h1 className="ctc-title"><Copy text={"See it on your own products"} /></h1>
                        <p className="ctc-intro">
                            <Copy text={"Thirty minutes with someone who builds LetBuyy. We set up a storefront against your catalogue, take a live UPI and COD order through checkout, and show the GST invoice it produces — then answer whatever you ask."} /></p>
                        <MarketingIllustration artwork="launch" className="marketing-illustration--demo" />
                    </div>
                </section>

                <section className="ctc-body">
                    <div className="container">
                        <DemoRequestForm locale={locale.segment} />
                    </div>
                </section>

                <section className="ctc-foot">
                    <div className="container">
                        <p className="ctc-foot-note">
                            <Copy text={"Not ready for a call? Read the"} />{' '}
                            <Link href="/resources"><Copy text={"guide library"} /></Link><Copy text={", check"} />{' '}
                            <Link href="/pricing"><Copy text={"pricing"} /></Link><Copy text={", or just"} />{' '}
                            <Link href="/contact"><Copy text={"email us"} /></Link>.
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
