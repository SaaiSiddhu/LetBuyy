'use client'


import { useCopy } from '@/components/i18n/useCopy'
import Copy from '@/components/i18n/Copy'

import Image from 'next/image'
import { useId, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { ArrowRight, BookOpen, Button } from '@letbuyy/ui'
import type { EditorialArtwork } from '@/lib/resources/artwork'
import type { ReadingTopic } from '@/lib/resources/reading-visuals'
import styles from './article-visual-overview.module.css'

export default function ArticleVisualOverview({ artwork, topics }: { artwork: EditorialArtwork; topics: ReadingTopic[] }) {
  const { t } = useCopy()
  const [active, setActive] = useState(0)
  const id = useId()

  function changeTopic(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % topics.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + topics.length) % topics.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = topics.length - 1
    else return
    event.preventDefault()
    setActive(next)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  function readSection(event: MouseEvent<HTMLAnchorElement>, targetId: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const heading = document.getElementById(targetId)
    if (!heading) return
    event.preventDefault()
    const navHeight = document.querySelector('.res-nav-bar')?.getBoundingClientRect().height ?? 0
    const top = heading.getBoundingClientRect().top + window.scrollY - navHeight - 16
    window.history.pushState(window.history.state, '', `#${targetId}`)
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }

  return (
    <section className={styles.overview} aria-label={t("Illustrated guide overview")} data-reading-visual>
      <div className={styles.eyebrow}><BookOpen size={15} aria-hidden="true" /><span><Copy text={"The guide, illustrated"} /></span></div>
      <figure className={styles.figure}>
        <div className={styles.canvas}>
          <Image src={artwork.src} alt={t(artwork.alt)} width={artwork.width} height={artwork.height} sizes="(max-width: 767px) 90vw, 760px" loading="eager" unoptimized />
        </div>
        <figcaption>{t(artwork.caption)}<span className={styles.concept}><Copy text={"Concept illustration"} /></span></figcaption>
      </figure>
      <p className={styles.prompt}><Copy text={"Explore an idea, then read the detail."} /></p>
      <div className={styles.tabs} role="tablist" aria-label={t("Ideas in this guide")}>
        {topics.map((topic, index) => (
          <Button unstyled key={topic.targetId} type="button" role="tab" id={`${id}-tab-${index}`} aria-selected={active === index} aria-controls={`${id}-panel-${index}`} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => changeTopic(event, index)} className={styles.tab}>
            <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{t(topic.label)}
          </Button>
        ))}
      </div>
      <div className={styles.panels}>
        {topics.map((topic, index) => (
          <div key={topic.targetId} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} aria-hidden={active !== index} inert={active !== index} className={`${styles.panel}${active === index ? ` ${styles.selected}` : ''}`}>
            <h2 className={styles.topicHeading}>{topic.heading}</h2>
            <p className={styles.excerpt}>{t(topic.excerpt)}</p>
            <a href={`#${topic.targetId}`} onClick={event => readSection(event, topic.targetId)} className={styles.readLink} aria-label={t("Read section: {heading}", { heading: topic.heading })}><Copy text={"Read this section"} /><ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        ))}
      </div>
    </section>
  )
}
