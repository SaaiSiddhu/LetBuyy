'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'

import { useState } from 'react'
import { Button } from '@letbuyy/ui'

interface Heading {
  id: string
  text: string
  level: 2 | 3
}

export default function MobileTOC({ headings }: { headings: Heading[] }) {
    const { t } = useCopy()
  const [open, setOpen] = useState(false)

  if (headings.length === 0) return null

  return (
    <nav className="arc-mobile-toc" aria-label={t("Table of contents")}>
      <Button
        unstyled
        type="button"
        className="arc-mob-toc-btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="mob-toc-list"
      >
        <span><Copy text={"Contents"} /></span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Button>
      <div id="mob-toc-list" className={`arc-mob-toc-list${open ? ' open' : ''}`}>
        {headings.map(h => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={`arc-mob-toc-a${h.level === 3 ? ' h3' : ''}`}
            onClick={() => setOpen(false)}
          >
            {h.text}
          </a>
        ))}
      </div>
    </nav>
  )
}
