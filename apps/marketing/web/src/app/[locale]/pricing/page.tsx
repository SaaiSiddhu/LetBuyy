import { loadPublicPricing } from '@/lib/pricing'
import { BRAND_ASSETS, BRAND_SOCIAL_IMAGE } from '@/lib/brand-assets'
import { localizeMetadata } from '@/lib/i18n/metadata'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

const sourceMetadata: Metadata = {
    title: 'LetBuyy Pricing — Plans for Indian Businesses',
    description:
        'Compare LetBuyy subscription plans for Indian businesses. Review current prices, availability and signup terms. 0% commission on your sales.',
    alternates: {
        canonical: '/pricing',
    },
    openGraph: {
        title: 'LetBuyy Pricing — Plans for Indian Businesses',
        description:
            'Compare current subscription plans and availability for your Indian business.',
        url: '/pricing',
        images: [
            BRAND_SOCIAL_IMAGE,
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'LetBuyy Pricing — Plans for Indian Businesses',
        description:
            'Review current LetBuyy subscription plans and signup terms.',
        images: [BRAND_ASSETS.social],
    },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata(sourceMetadata, (await params).locale, "/pricing")
}


export default async function PricingPage() {
    const initialData = await loadPublicPricing()
    return (
        <>
            <Header />
            <main>
                <Pricing initialData={initialData} headingLevel={1} />
                <FAQ />
                <FinalCTA />
            </main>
            <Footer />
        </>
    )
}
