import Header from '@/components/Header'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

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
