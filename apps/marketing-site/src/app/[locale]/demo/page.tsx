import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
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
        /* A lead form has no business in search results competing with the
           pages that explain the product. */
        robots: { index: false, follow: true },
    }
}

const ASSURANCES = [
    { value: '30 min', label: 'on a call or screen share' },
    { value: 'No card', label: 'nothing to pay, ever, for a demo' },
    { value: 'Your data', label: 'we set it up against your own catalogue' },
]

export default async function DemoPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale: segment } = await params
    const locale = getLocale(segment)

    return (
        <>
            <Header />
            <main className="demo">
                <section className="demo-hero">
                    <div className="container demo-hero-inner">
                        <div className="demo-hero-copy">
                            <p className="demo-eyebrow">Request a demo</p>
                            <h1 className="demo-title">
                                See it running on your own products.
                            </h1>
                            <p className="demo-lead">
                                Thirty minutes with someone who builds LetBuyy. We set up a storefront
                                against your catalogue, take a live UPI and COD order through checkout,
                                and show the GST invoice it produces — then answer whatever you ask.
                            </p>

                            <dl className="demo-assurances">
                                {ASSURANCES.map(item => (
                                    <div key={item.value}>
                                        <dt>{item.value}</dt>
                                        <dd>{item.label}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </div>
                </section>

                <section className="demo-body">
                    <div className="container">
                        <DemoRequestForm locale={locale.segment} />
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
