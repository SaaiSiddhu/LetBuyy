'use client'

import { usePathname } from 'next/navigation'
import { localeFromPathname } from '@/lib/i18n/routing'
import { useEffect, type ReactNode } from 'react'
import type Lenis from 'lenis'
import { registerSmoothScroll } from '@/lib/smooth-scroll'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import CapabilityMap from '@/components/CapabilityMap'
import Features from '@/components/Features'
import MerchantJourney from '@/components/MerchantJourney'
import FAQ from '@/components/FAQ'
import EcosystemMap from '@/components/EcosystemMap'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

export default function Home({ pricing }: { pricing: ReactNode }) {
  const pathname = usePathname()
  const locale = localeFromPathname(pathname)
  useEffect(() => {
    // Touch scrolling is already native (syncTouch is disabled). Keep the
    // smooth-wheel driver and its frame loop for fine-pointer devices only.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let disposed = false
    let instance: Lenis | null = null
    let frame = 0
    void import('lenis').then(({ default: SmoothWheel }) => {
      if (disposed) return
      const lenis = new SmoothWheel({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
      })
      instance = lenis
      registerSmoothScroll(lenis)
      function raf(time: number) {
        if (disposed) return
        lenis.raf(time)
        frame = requestAnimationFrame(raf)
      }
      frame = requestAnimationFrame(raf)
    }).catch(() => { /* Native scrolling remains available if the optional driver cannot load. */ })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      if (instance) {
        registerSmoothScroll(null)
        instance.destroy()
      }
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
        {pricing}
        <FAQ />
        <EcosystemMap />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
