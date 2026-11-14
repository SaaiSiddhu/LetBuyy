import Link from '@/components/i18n/LocaleLink'

import Copy from '@/components/i18n/Copy'
import { Fragment, type ReactElement } from 'react'
import type { ContentBlock } from '@/lib/resources/types'
import { Table } from '@letbuyy/ui'
import { HeadingAnchor } from './HeadingAnchor'
import ArticleSectionVisual from './ArticleSectionVisual'
import type { SectionVisual } from '@/lib/resources/section-visuals'
import { resourceHeadingId } from '@/lib/resources/headings'

const CALLOUT_ICONS: Record<string, ReactElement> = {
  tip: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
}

const AI_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75z M6 16l.5 1.5L8 18l-1.5.5L6 20l-.5-1.5L4 18l1.5-.5z" />
  </svg>
)

const CHECK_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function ArticleBody({ body, id = 'article-body', visuals = {} }: { body: ContentBlock[]; id?: string; visuals?: Record<string, SectionVisual> }) {
  const firstPIndex = body.findIndex((b) => b.type === 'p')

  return (
    <div className="arc-body" id={id}>
      {body.map((block, i) => {
        switch (block.type) {

          case 'p': {
            const isLead = i === firstPIndex
            return <Fragment key={i}>
              <p className={isLead ? 'arc-body-p-lead' : 'arc-body-p'}>{block.text}</p>
              {block.references?.length ? <ul className="arc-body-ul" aria-label="References">
                {block.references.filter(reference => /^(https:\/\/|\/(?!\/))/.test(reference.href)).map(reference => <li key={reference.href}><Link href={reference.href}>{reference.label}</Link></li>)}
              </ul> : null}
            </Fragment>
          }

          case 'h2': {
            const id = block.id ?? resourceHeadingId(block.text)
            return (
              <Fragment key={i}><h2 id={id} className="arc-body-h2">
                {block.text}
                <HeadingAnchor id={id} />
              </h2>{visuals[id] && <ArticleSectionVisual visual={visuals[id]} />}</Fragment>
            )
          }

          case 'h3': {
            const id = block.id ?? resourceHeadingId(block.text)
            return (
              <h3 key={i} id={id} className="arc-body-h3">
                {block.text}
                <HeadingAnchor id={id} />
              </h3>
            )
          }

          case 'ul':
            return (
              <ul key={i} className="arc-body-ul">
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            )

          case 'ol':
            return (
              <ol key={i} className="arc-body-ol">
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ol>
            )

          case 'callout':
            return (
              <div key={i} className={`arc-callout arc-callout-${block.variant}`} role="note">
                <span className={`arc-callout-icon-wrap arc-callout-icon-${block.variant}`}>
                  {CALLOUT_ICONS[block.variant]}
                </span>
                <div>
                  <p className="arc-callout-title">{block.title}</p>
                  <p className="arc-callout-text">{block.text}</p>
                </div>
              </div>
            )

          case 'code':
            return (
              <pre key={i} className="arc-code-block">
                <code className={`language-${block.lang}`}>{block.text}</code>
              </pre>
            )

          case 'blockquote':
            return (
              <blockquote key={i} className="arc-blockquote">
                <span className="arc-blockquote-mark" aria-hidden="true">&ldquo;</span>
                <p className="arc-blockquote-text">{block.text}</p>
                {block.cite && <cite className="arc-blockquote-cite">— {block.cite}</cite>}
              </blockquote>
            )

          case 'table':
            return (
              <div key={i} className="arc-table-wrap">
                <Table className="arc-table">
                  <thead>
                    <tr>
                      {block.headers.map((h, j) => <th key={j}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => <td key={k}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )

          // ── V4 Rich Blocks ──

          case 'insight':
            return (
              <div key={i} className="arc-insight-block" role="note">
                <div className="arc-insight-eyebrow">
                  <span className="arc-insight-line" aria-hidden="true" />
                  <Copy text={"Key Insight"} /></div>
                <p className="arc-insight-title">{block.title}</p>
                <p className="arc-insight-text">{block.text}</p>
              </div>
            )

          case 'checklist':
            return (
              <div key={i} className="arc-checklist-block">
                {block.title && <p className="arc-checklist-title">{block.title}</p>}
                <div className="arc-checklist-items">
                  {block.items.map((item, j) => (
                    <div key={j} className="arc-checklist-item">
                      <div className={`arc-checklist-check${item.checked ? ' done' : ''}`} aria-hidden="true">
                        {item.checked && CHECK_ICON}
                      </div>
                      <p className="arc-checklist-text">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )

          case 'metric':
            return (
              <div key={i} className="arc-metric-block" role="group" aria-label="Key metrics">
                {block.metrics.map((m, j) => (
                  <div key={j} className="arc-metric-card">
                    <p className="arc-metric-label">{m.label}</p>
                    <p className="arc-metric-value">{m.value}</p>
                    {m.change && (
                      <p className={`arc-metric-change ${m.positive !== false ? 'pos' : 'neg'}`}>
                        {m.change}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )

          case 'timeline':
            return (
              <div key={i} className="arc-timeline-block" role="list">
                {block.items.map((item, j) => (
                  <div key={j} className="arc-timeline-item" role="listitem">
                    <div className="arc-timeline-dot" aria-hidden="true">{j + 1}</div>
                    <div className="arc-timeline-content">
                      <p className="arc-timeline-step">{item.step}</p>
                      <p className="arc-timeline-title">{item.title}</p>
                      <p className="arc-timeline-text">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )

          case 'commerce-example':
            return (
              <div key={i} className="arc-commerce-block" role="note">
                <p className="arc-commerce-eyebrow"><Copy text={"Commerce Example"} /></p>
                <p className="arc-commerce-scenario">{block.scenario}</p>
                <p className="arc-commerce-result">{block.result}</p>
                {block.metric && (
                  <span className="arc-commerce-metric">{block.metric}</span>
                )}
              </div>
            )

          case 'ai-recommendation':
            return (
              <div key={i} className="arc-ai-block" role="note">
                <div className="arc-ai-eyebrow">
                  {AI_ICON}
                  <Copy text={"AI Recommendation"} /></div>
                <p className="arc-ai-title">{block.title}</p>
                <div className="arc-ai-items">
                  {block.items.map((item, j) => (
                    <div key={j} className="arc-ai-item">
                      <span className="arc-ai-dot" aria-hidden="true" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )

          default:
            return null
        }
      })}
    </div>
  )
}
