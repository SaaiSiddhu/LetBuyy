'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  const railRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const isActive = (href: string) => {
    if (href === '/resources') return pathname === '/resources'
    return pathname.startsWith(href)
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
    <div className="res-nav-bar" ref={barRef} role="navigation" aria-label="Resources navigation">
      <div className="container res-nav-inner">
        {/* Left: label */}
        <Link href="/resources" className="res-nav-label">
          <span className="res-nav-label-dot" aria-hidden="true" />
          Resources
        </Link>

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
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right: search + subscribe */}
        <div className="res-nav-actions">
          <Link href="/resources/search" className="res-nav-search" aria-label="Search resources">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>Search</span>
          </Link>
          <SubscribeButton className="res-nav-subscribe">Subscribe</SubscribeButton>
        </div>
      </div>
    </div>
  )
}
