'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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
  const [active, setActive] = useState<string>('')
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const tocRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (headings.length === 0) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(e => e.isIntersecting)
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-10% 0% -78% 0%' },
    )
    headings.forEach(h => {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [headings])

  // Auto-scroll the active TOC item into view within the TOC list
  useEffect(() => {
    if (!active || !tocRef.current) return
    const link = itemRefs.current[active]
    if (link) {
      link.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
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
  const updated = new Date(updatedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

  return (
    <nav ref={tocRef} className="arc-toc" aria-label="Table of contents">
      <p className="arc-toc-label">Contents</p>

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
          {readingTime} min read
        </div>
        <div className="arc-toc-meta-row">
          <svg className="arc-toc-meta-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Updated {updated}
        </div>
      </div>

      <div className="arc-toc-actions-divider" />

      {/* Utility actions */}
      <div className="arc-toc-actions">
        <button type="button" className="arc-toc-action-btn" onClick={handleShare}>
          <svg className="arc-toc-action-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
        <button type="button" className="arc-toc-action-btn" onClick={handlePrint}>
          <svg className="arc-toc-action-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print
        </button>
      </div>

      <Link href="/resources" className="arc-toc-back">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to Resources
      </Link>
    </nav>
  )
}
