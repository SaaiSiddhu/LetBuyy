'use client'

import { usePathname } from 'next/navigation'
import { localeFromPathname } from '@/lib/i18n/routing'
import { useEffect } from 'react'
import Lenis from 'lenis'
import { registerSmoothScroll } from '@/lib/smooth-scroll'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import CapabilityMap from '@/components/CapabilityMap'
import Features from '@/components/Features'
import MerchantJourney from '@/components/MerchantJourney'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import EcosystemMap from '@/components/EcosystemMap'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

export default function Home() {
  const pathname = usePathname()
  const locale = localeFromPathname(pathname)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    })

    // Expose the instance so components can scroll without Lenis undoing it.
    registerSmoothScroll(lenis)

    let frame = 0
    function raf(time: number) {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }

    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      registerSmoothScroll(null)
      lenis.destroy()
    }
  }, [])

  return (
    <>
      <Header />
      <main className="marketing-home" lang={locale.language.bcp47}>
        <Hero />
        <CapabilityMap />
        <MerchantJourney />
        <Features />
        <Pricing />
        <FAQ />
        <EcosystemMap />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
