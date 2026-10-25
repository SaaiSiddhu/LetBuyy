import { localizeMetadata } from '@/lib/i18n/metadata'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

const sourceMetadata: Metadata = {
    title: 'Pricing',
    description:
        'LetBuyy Launch plan starts at ₹299/month. 0% commission forever. UPI, COD, and GST-ready payments built in. Review plans before paying.',
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
            'Launch and Growth plans live now. 0% commission. UPI, COD, GST-ready. Review plans before paying.',
        images: ['/icons/letbuyy-logo-light.svg'],
    },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata(sourceMetadata, (await params).locale, "/pricing")
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
