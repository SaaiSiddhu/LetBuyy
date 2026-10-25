'use client'

import { useEffect, useState } from 'react'
import { Button } from '@letbuyy/ui'
import type { LegalClause } from '@/lib/legal/types'
import { clauseNumber } from '@/lib/legal/format'
import { usePathname } from 'next/navigation'
import { getDictionaryForSegment, localeFromPathname } from '@/lib/i18n'

/**
 * Clause index. A sticky rail on desktop; a collapsible panel on mobile, where
 * a fifteen-clause list would otherwise push the document itself below the
 * fold.
 *
 * The active clause is tracked with an IntersectionObserver rather than scroll
 * maths — clause heights vary by an order of magnitude here (a two-line clause
 * next to a thirteen-item list), which defeats any threshold based on offset.
 */
export default function LegalContents({ clauses }: { clauses: LegalClause[] }) {
    const dict = getDictionaryForSegment(localeFromPathname(usePathname()).segment)
    const [activeId, setActiveId] = useState<string>(clauses[0]?.id ?? '')
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const headings = clauses
            .map(clause => document.getElementById(clause.id))
            .filter((el): el is HTMLElement => Boolean(el))

        if (!headings.length) return

        const observer = new IntersectionObserver(
            entries => {
                // Among everything currently on screen, the highest one wins —
                // otherwise a tall clause scrolling out keeps the marker behind.
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

                if (visible[0]) setActiveId(visible[0].target.id)
            },
            {
                // Ignore the band under the sticky header, and treat the top
                // third of the viewport as "current".
                rootMargin: '-88px 0px -66% 0px',
                threshold: 0,
            },
        )

        headings.forEach(heading => observer.observe(heading))
        return () => observer.disconnect()
    }, [clauses])

    return (
        <aside className="lgl-toc" aria-label={dict.legal.clauseIndex}>
            <div className="lgl-toc-inner">
                <Button
                    unstyled
                    type="button"
                    className="lgl-toc-trigger"
                    aria-expanded={mobileOpen}
                    onClick={() => setMobileOpen(open => !open)}
                >
                    <span className="lgl-toc-trigger-label">{dict.legal.contents}</span>
                    <span className="lgl-toc-trigger-count">{clauses.length}</span>
                    <span className="lgl-toc-trigger-chev" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </span>
                </Button>

                <p className="lgl-toc-label" aria-hidden="true">
                    {dict.legal.contents}
                </p>

                <ol className={`lgl-toc-list${mobileOpen ? ' is-open' : ''}`}>
                    {clauses.map((clause, index) => (
                        <li key={clause.id}>
                            <a
                                href={`#${clause.id}`}
                                className={`lgl-toc-link${activeId === clause.id ? ' is-active' : ''}`}
                                aria-current={activeId === clause.id ? 'true' : undefined}
                                onClick={() => setMobileOpen(false)}
                            >
                                <span className="lgl-toc-num">{clauseNumber(index)}</span>
                                <span className="lgl-toc-text">{clause.heading}</span>
                            </a>
                        </li>
                    ))}
                </ol>
            </div>
        </aside>
    )
}
