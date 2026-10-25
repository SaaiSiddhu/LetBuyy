'use client'

import Copy from '@/components/i18n/Copy'
import { useCopy } from '@/components/i18n/useCopy'

import Image from 'next/image'
import { useState } from 'react'
import { Button, Check, Plus, ArrowRight } from '@letbuyy/ui'
import type { ChangelogEntry } from '@/lib/resources/types'
import { RELEASE_ARTWORK, RELEASE_LABELS } from '@/lib/resources/changelog-presentation'
import styles from './changelog.module.css'

const ITEM_LABELS = { feature: 'Added', improvement: 'Improved', fix: 'Fixed' }

export default function ChangelogReleases({ entries }: { entries: ChangelogEntry[] }) {
  const { t, locale } = useCopy()
  const [filter, setFilter] = useState('all')
  const tags = [...new Set(entries.map(entry => entry.tag))]
  const visible = filter === 'all' ? entries : entries.filter(entry => entry.tag === filter)

  return (
    <section id="release-history" className={styles.history} aria-labelledby="release-history-title">
      <div className={styles.historyHead}><div><p className={styles.eyebrow}><Copy text={"THE RELEASE JOURNAL"} /></p><h2 id="release-history-title"><Copy text={"What changed."} /></h2></div><p><Copy text={"New features, thoughtful improvements"} /><br /><Copy text={"and fixes along the way."} /></p></div>
      <div className={styles.filters} role="group" aria-label={t("Filter releases")}>
        {['all', ...tags].map(tag => <Button unstyled key={tag} type="button" aria-pressed={filter === tag} className={styles.filter} onClick={() => setFilter(tag)}>{t(tag === 'all' ? 'All updates' : RELEASE_LABELS[tag])}<span>{tag === 'all' ? entries.length : entries.filter(entry => entry.tag === tag).length}</span></Button>)}
      </div>
      <p className={styles.resultCount} role="status">{visible.length} {t(visible.length === 1 ? 'release' : 'releases')} <Copy text={"· Newest first"} /></p>
      <ol className={styles.releases}>
        {visible.map(entry => {
          const art = RELEASE_ARTWORK[entry.version]
          const latest = entry.version === entries[0]?.version
          return <li key={entry.version} className={styles.release} id={`release-${entry.version.replaceAll('.', '-')}`}>
            <div className={styles.stamp}><a href={`#release-${entry.version.replaceAll('.', '-')}`} className={styles.version}>v{entry.version}</a><time dateTime={entry.date}>{new Date(entry.date).toLocaleDateString(locale.hreflang, { day: 'numeric', month: 'short', year: 'numeric' })}</time><span className={styles.type}>{t(RELEASE_LABELS[entry.tag])}</span>{latest && <span className={styles.latest}><Copy text={"Latest release"} /></span>}</div>
            <article className={`${styles.releaseBody}${latest ? ` ${styles.latestBody}` : ''}`} aria-labelledby={`release-title-${entry.version}`}>
              <div className={styles.releaseHeading}><div><span className={styles.releaseKicker}><Copy text={"PRODUCT UPDATE"} /></span><h3 id={`release-title-${entry.version}`}>{t(entry.title)}</h3></div>{art && <Image src={art.src} alt="" width={art.width} height={art.height} sizes="(max-width: 600px) 110px, 170px" loading="eager" unoptimized className={styles.releaseArt} />}</div>
              <ul className={styles.items}>{entry.items.map((item, index) => {
                const Icon = item.type === 'feature' ? Plus : item.type === 'fix' ? Check : ArrowRight
                return <li key={index}><Icon size={16} aria-hidden="true" /><span><span className={styles.itemType}>{t(ITEM_LABELS[item.type])}</span>{t(item.text)}</span></li>
              })}</ul>
            </article>
          </li>
        })}
      </ol>
      <p className={styles.foot}><Copy text={"That is the whole history so far —"} />{' '}{entries.length} <Copy text={"releases since the private beta opened."} /></p>
    </section>
  )
}
