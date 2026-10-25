'use client'


import { useCopy } from '@/components/i18n/useCopy'
import Copy from '@/components/i18n/Copy'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@letbuyy/ui'
import Link from '@/components/i18n/LocaleLink'
import { getActiveTocHeading, getTocScrollTop } from '@/lib/resources/toc-scroll'

interface Heading {
  id: string
  text: string
  level: 2 | 3
}

interface Props {
  headings: Heading[]
  readingTime: number
  updatedAt: string
}

export default function TableOfContents({ headings, readingTime, updatedAt }: Props) {
  const { t, locale } = useCopy()
  const [active, setActive] = useState<string>('')
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const tocRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const targets = headings.flatMap(heading => {
      const element = document.getElementById(heading.id)
      return element ? [{ id: heading.id, element }] : []
    })
    if (!targets.length) return
    let frame = 0
    const update = () => {
      frame = 0
      setActive(getActiveTocHeading(targets.map(target => ({
        id: target.id,
        top: target.element.getBoundingClientRect().top,
      })), 112))
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [headings])

  // scrollIntoView also scrolls ancestor containers, including the article
  // viewport. Only move this rail; reading progress must never move the page.
  useEffect(() => {
    const rail = tocRef.current
    const link = itemRefs.current[active]
    if (!active || !rail || !link || rail.clientHeight === 0) return
    const railBounds = rail.getBoundingClientRect()
    const linkBounds = link.getBoundingClientRect()
    rail.scrollTop = getTocScrollTop({
      scrollTop: rail.scrollTop,
      viewportTop: railBounds.top + rail.clientTop,
      viewportHeight: rail.clientHeight,
      contentHeight: rail.scrollHeight,
      itemTop: linkBounds.top,
      itemBottom: linkBounds.bottom,
    })
  }, [active])

  function handleShare() {
    if (navigator.share) {
      navigator.share({ url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }

  function handlePrint() {
    window.print()
  }

  if (headings.length === 0) return null

  const h2Only = headings.filter(h => h.level === 2)
  const updated = new Date(updatedAt).toLocaleDateString(locale.hreflang, { month: 'short', year: 'numeric' })

  return (
    <nav ref={tocRef} className="arc-toc" aria-label={t("Table of contents")}>
      <p className="arc-toc-label"><Copy text={"Contents"} /></p>

      {headings.map(h => {
        const num = h.level === 2 ? String(h2Only.indexOf(h) + 1).padStart(2, '0') : null
        const isActive = active === h.id
        return (
          <a
            key={h.id}
            ref={el => { itemRefs.current[h.id] = el }}
            href={`#${h.id}`}
            className={`arc-toc-item${h.level === 3 ? ' h3' : ''}${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'location' : undefined}
          >
            {num && <span className="arc-toc-num">{num}</span>}
            <span>{h.text}</span>
          </a>
        )
      })}

      <div className="arc-toc-divider" />

      {/* Reading progress lives in the floating dock now — the rail only
          carries the standing facts. */}
      <div className="arc-toc-meta">
        <div className="arc-toc-meta-row">
          <svg className="arc-toc-meta-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {readingTime} <Copy text={"min read"} /></div>
        <div className="arc-toc-meta-row">
          <svg className="arc-toc-meta-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <Copy text={"Updated"} />{' '}{updated}
        </div>
      </div>

      <div className="arc-toc-actions-divider" />

      {/* Utility actions */}
      <div className="arc-toc-actions">
        <Button unstyled type="button" className="arc-toc-action-btn" onClick={handleShare}>
          <svg className="arc-toc-action-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <Copy text={"Share"} /></Button>
        <Button unstyled type="button" className="arc-toc-action-btn" onClick={handlePrint}>
          <svg className="arc-toc-action-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <Copy text={"Print"} /></Button>
      </div>

      <Link href="/resources" className="arc-toc-back">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <Copy text={"Back to Resources"} /></Link>
    </nav>
  )
}
