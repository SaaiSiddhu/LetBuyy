'use client'

import { useEffect, useRef } from 'react'

export default function ReadingProgress() {
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fill = fillRef.current
    if (!fill) return

    function onScroll() {
      const el = document.documentElement
      const scrollTop = el.scrollTop || document.body.scrollTop
      const scrollHeight = el.scrollHeight - el.clientHeight
      const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0
      if (fill) fill.style.width = `${Math.min(pct, 100).toFixed(2)}%`
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="arc-progress" aria-hidden="true">
      <div ref={fillRef} className="arc-progress-fill" />
    </div>
  )
}
