'use client'

import { useState } from 'react'
import { Button } from '@letbuyy/ui'

interface Props {
  slug: string
  title: string
  category: string
}

export default function BookmarkButton({ slug, title, category }: Props) {
  const [saved, setSaved] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const bookmarks: string[] = JSON.parse(localStorage.getItem('lb-bookmarks') ?? '[]')
      return bookmarks.includes(slug)
    } catch {
      return false
    }
  })

  function toggle() {
    try {
      const bookmarks: string[] = JSON.parse(localStorage.getItem('lb-bookmarks') ?? '[]')
      const next = saved
        ? bookmarks.filter(s => s !== slug)
        : [...bookmarks, slug]
      localStorage.setItem('lb-bookmarks', JSON.stringify(next))
      setSaved(!saved)
    } catch {}
  }

  return (
    <Button
      unstyled
      type="button"
      onClick={toggle}
      className={`rc-action-btn${saved ? ' active' : ''}`}
      aria-label={saved ? 'Remove bookmark' : 'Bookmark this article'}
      title={saved ? 'Bookmarked' : 'Save for later'}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <span>{saved ? 'Saved' : 'Save'}</span>
    </Button>
  )
}
