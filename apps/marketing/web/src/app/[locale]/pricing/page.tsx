import type { Metadata } from 'next'
import Header from '@/components/Header'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
    title: 'Pricing',
    description:
        'LetBuyy Launch plan starts at ₹299/month. 0% commission forever. UPI, COD, and GST-ready payments built in. Start with a 7-day free trial.',
    alternates: {
        canonical: '/pricing',
    },
    openGraph: {
        title: 'LetBuyy pricing — Launch from ₹299/month',
        description:
            'Launch and Growth plans available now. Scale and Commerce OS coming soon. 0% commission forever. India-first commerce platform.',
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
        title: 'LetBuyy pricing — Launch from ₹299/month',
        description:
            'Launch and Growth plans live now. 0% commission. UPI, COD, GST-ready. 7-day free trial.',
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
