'use client'
import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'
import Image from 'next/image'
import type { SectionVisual } from '@/lib/resources/section-visuals'
import styles from './article-section-visual.module.css'

export default function ArticleSectionVisual({ visual }: { visual: SectionVisual }) {
  const { t } = useCopy()
  return <figure className={styles.figure} data-section-visual>
    <Image src={visual.src} alt={t(visual.alt)} width={visual.width} height={visual.height} sizes="(max-width: 767px) 85vw, 560px" loading="eager" unoptimized />
    <figcaption><span className={styles.label}><Copy text={visual.label} /></span><span><Copy text={visual.caption} /></span><small><Copy text={"Concept illustration"} /></small></figcaption>
  </figure>
}
