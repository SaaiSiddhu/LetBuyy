'use client'
import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'
import Image from 'next/image'
import { getArticleArtwork } from '@/lib/resources/artwork'
import styles from './resource-artwork.module.css'

export default function ResourceArticleArtwork({ slug, thumbnail = false }: { slug: string; thumbnail?: boolean }) {
  const { t } = useCopy()
  const artwork = getArticleArtwork(slug)
  if (!artwork) return null

  return (
    <figure className={thumbnail ? styles.thumbnail : styles.cover} data-resource-artwork={thumbnail ? 'thumbnail' : 'cover'} aria-hidden={thumbnail || undefined}>
      <Image src={thumbnail ? artwork.thumbnailSrc : artwork.src} alt={thumbnail ? '' : t(artwork.alt)} width={artwork.width} height={artwork.height} sizes={thumbnail ? '(max-width: 640px) 90vw, (max-width: 900px) 45vw, 420px' : '(max-width: 767px) 90vw, 760px'} loading={thumbnail ? 'lazy' : 'eager'} priority={!thumbnail} fetchPriority={thumbnail ? 'low' : 'high'} />
      {!thumbnail && <figcaption><Copy text={artwork.caption} /> <Copy text={"Concept illustration."} /></figcaption>}
    </figure>
  )
}
