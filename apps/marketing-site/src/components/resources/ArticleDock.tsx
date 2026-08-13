'use client'

import Link from '@/components/i18n/LocaleLink'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@letbuyy/ui'

interface Heading {
  id: string
  text: string
  level: 2 | 3
}

interface DockNext {
  slug: string
  title: string
  category: string
}

/**
 * Floating reading dock. Carries progress, the contents sheet and the article
 * actions so the top of the page stays clean — on mobile this replaces the
 * accordion that used to push the headline below the fold.
 */
export default function ArticleDock({
  headings,
  next,
}: {
  headings: Heading[]
  next?: DockNext | null
}) {
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      const pct = max > 0 ? (el.scrollTop / max) * 100 : 0
      setProgress(Math.min(100, Math.max(0, pct)))
      // Stay out of the way until the reader has committed to the article
      setVisible(el.scrollTop > 240)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // The dock is fixed, so reserve room for it — otherwise it sits on top of
  // the last row of the footer once the reader hits the bottom.
  useEffect(() => {
    const previous = document.body.style.paddingBottom
    document.body.style.paddingBottom = '88px'
    return () => {
      document.body.style.paddingBottom = previous
    }
  }, [])

  // Dismiss the sheet on Escape or an outside click
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onClick)
    }
  }, [open])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable — leave the label unchanged */
    }
  }

  const jumpTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    setOpen(false)
    const top = el.getBoundingClientRect().top + window.scrollY - 96
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const circumference = 2 * Math.PI * 9

  return (
    <div className={`adock${visible ? ' is-visible' : ''}`} ref={sheetRef}>
      {open && headings.length > 0 && (
        <div className="adock-sheet" role="dialog" aria-label="Table of contents">
          <p className="adock-sheet-title">On this page</p>
          <ol className="adock-sheet-list">
            {headings.map((h, i) => (
              <li key={h.id} className={h.level === 3 ? 'is-sub' : undefined}>
                <Button unstyled type="button" className="adock-sheet-link" onClick={() => jumpTo(h.id)}>
                  <span className="adock-sheet-num">{String(i + 1).padStart(2, '0')}</span>
                  {h.text}
                </Button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="adock-bar">
        {/* Progress ring doubles as the contents trigger */}
        {headings.length > 0 && (
          <Button
            unstyled
            type="button"
            className={`adock-contents${open ? ' is-open' : ''}`}
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
          >
            <span className="adock-ring" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" className="adock-ring-track" />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  className="adock-ring-fill"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress / 100)}
                />
              </svg>
              <span className="adock-ring-pct">{Math.round(progress)}</span>
            </span>
            <span className="adock-contents-label">Contents</span>
          </Button>
        )}

        <span className="adock-divider" aria-hidden="true" />

        <Button unstyled type="button" className="adock-icon" onClick={copyLink} aria-label="Copy link">
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          )}
        </Button>

        <Button
          unstyled
          type="button"
          className="adock-icon"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </Button>

        {next && (
          <Link href={`/resources/${next.category}/${next.slug}`} className="adock-next">
            <span className="adock-next-label">Next</span>
            <span className="adock-next-title">{next.title}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}
