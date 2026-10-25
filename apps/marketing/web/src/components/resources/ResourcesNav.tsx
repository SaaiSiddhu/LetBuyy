'use client'


import { useCopy } from '@/components/i18n/useCopy'
import Copy from '@/components/i18n/Copy'

import Link from '@/components/i18n/LocaleLink'
import { usePathname } from 'next/navigation'
import { stripLocale } from '@/lib/i18n/routing'
import { useEffect, useRef } from 'react'
import { SubscribeButton } from './NewsletterModal'

const NAV_LINKS = [
  { label: 'All', href: '/resources' },
  { label: 'Ecommerce', href: '/resources/ecommerce' },
  { label: 'Growth', href: '/resources/growth' },
  { label: 'Payments', href: '/resources/payments' },
  { label: 'Operations', href: '/resources/operations' },
  { label: 'AI Commerce', href: '/resources/ai-commerce' },
  { label: 'Developers', href: '/resources/developers' },
  { label: 'Changelog', href: '/resources/changelog' },
]

export default function ResourcesNav() {
  const { t } = useCopy()
  const pathname = stripLocale(usePathname())
  const railRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const isActive = (href: string) => {
    if (href === '/resources') return pathname === '/resources'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  // Bring the current category into view on the mobile rail. Setting
  // scrollLeft directly rather than scrollIntoView, which would also scroll
  // the page and drag the reader away from the top of the article.
  useEffect(() => {
    const centreActive = () => {
      const rail = railRef.current
      if (!rail) return
      const active = rail.querySelector<HTMLElement>('.res-nav-link.active')
      if (!active) return
      const centred = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2
      rail.scrollLeft = Math.max(0, centred)
    }

    centreActive()
    // The rail only becomes scrollable at narrow widths, so re-centre when the
    // viewport changes rather than only on navigation.
    window.addEventListener('resize', centreActive, { passive: true })
    return () => window.removeEventListener('resize', centreActive)
  }, [pathname])

  // Flag the bar once it is actually stuck to the top, so it can lift off the
  // content. Ratio < 1 means it has hit the viewport edge.
  useEffect(() => {
    const bar = barRef.current
    if (!bar || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => bar.classList.toggle('is-pinned', entry.intersectionRatio < 1),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' },
    )
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="res-nav-bar" ref={barRef} role="navigation" aria-label={t("Resources navigation")}>
      <div className="container res-nav-inner">
        {/* Left: label */}
        <Link href="/resources" className="res-nav-label">
          <span className="res-nav-label-dot" aria-hidden="true" />
          <Copy text={"Resources"} /></Link>

        {/* Center: category rail — wrapper carries the edge fade */}
        <div className="res-nav-rail">
          <div className="res-nav-links" ref={railRef}>
            {NAV_LINKS.map(link => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`res-nav-link${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {t(link.label)}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right: commerce updates */}
        <div className="res-nav-actions">
          <SubscribeButton className="res-nav-subscribe"><Copy text={"Commerce updates"} /></SubscribeButton>
        </div>
      </div>
    </div>
  )
}
