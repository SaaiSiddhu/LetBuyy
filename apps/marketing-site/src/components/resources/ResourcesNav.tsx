'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

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
  const [searchOpen, setSearchOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/resources') return pathname === '/resources'
    return pathname.startsWith(href)
  }

  return (
    <div className="res-nav-bar" role="navigation" aria-label="Resources navigation">
      <div className="container res-nav-inner">
        {/* Left: label */}
        <Link href="/resources" className="res-nav-label">
          <span className="res-nav-label-dot" aria-hidden="true" />
          Resources
        </Link>

        {/* Center: category links */}
        <div className="res-nav-links">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`res-nav-link${isActive(link.href) ? ' active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
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
          <Link href="/resources/newsletter" className="res-nav-subscribe">
            Subscribe
          </Link>
        </div>
      </div>
    </div>
  )
}
