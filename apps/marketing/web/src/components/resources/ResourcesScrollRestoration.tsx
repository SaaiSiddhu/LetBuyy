'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef } from 'react'

/** Start a new resource at the document top, above the sticky category bar. */
export default function ResourcesScrollRestoration() {
  const pathname = usePathname()
  const previousPathname = useRef(pathname)
  const historyNavigation = useRef(false)

  useEffect(() => {
    const onPopState = () => {
      // Let Next restore the reader's position on Back/Forward. A hash-only
      // history entry must not suppress the next article's reset.
      historyNavigation.current = window.location.pathname !== previousPathname.current
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useLayoutEffect(() => {
    if (pathname === previousPathname.current) return
    previousPathname.current = pathname

    const restoreHistory = historyNavigation.current
    historyNavigation.current = false
    if (restoreHistory || window.location.hash) return

    // Next's scroll-and-focus step targets the changing page inside the
    // persistent shell. Run after that step so the shell's sticky nav cannot
    // cover the new title. Instant also overrides global smooth scrolling.
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  return null
}
