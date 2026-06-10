import type { Metadata } from 'next'
import Header from '@/components/Header'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
    title: 'Pricing',
    description:
        'Compare LetBuyy Free, Basic, Pro and Enterprise packaging. Transaction and platform fees stay 0%; paid pricing and commercial terms remain pending human approval.',
    alternates: {
        canonical: '/pricing',
    },
    openGraph: {
        title: 'LetBuyy pricing and plan comparison',
        description:
            'Review LetBuyy plan packaging for launch-stage merchants, growing stores and governed multi-store teams.',
        url: '/pricing',
        images: [
            {
                url: '/icons/letbuyy-logo-light.svg',
                width: 680,
                height: 220,
                alt: 'LetBuyy pricing',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'LetBuyy pricing and plan comparison',
        description:
            'Compare LetBuyy Free, Basic, Pro and Enterprise packaging without fabricated paid prices.',
        images: ['/icons/letbuyy-logo-light.svg'],
    },
}

export default function PricingPage() {
    return (
        <>
            <Header />
            <main>
                <Pricing />
                <FAQ />
                <FinalCTA />
            </main>
            <Footer />
        </>
    )
}
