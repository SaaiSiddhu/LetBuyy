'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'

import Link from '@/components/i18n/LocaleLink'
import { usePathname } from 'next/navigation'
import type { Category } from '@/lib/resources/types'

interface Props {
  categories: Category[]
  activeCategory?: string
}

export default function CategoryNav({ categories, activeCategory }: Props) {
    const { t } = useCopy()
  const pathname = usePathname()
  const isAll = !activeCategory || pathname === '/resources'

  return (
    <nav className="rc-cat-nav" aria-label={t("Resource categories")}>
      <Link
        href="/resources"
        className={`rc-cat-pill${isAll ? ' active' : ''}`}
      >
        <Copy text={"All"} /></Link>
      {categories.map(cat => (
        <Link
          key={cat.slug}
          href={`/resources/${cat.slug}`}
          className={`rc-cat-pill${activeCategory === cat.slug ? ' active' : ''}`}
          style={activeCategory === cat.slug ? { background: cat.color, borderColor: cat.color } : undefined}
        >
          <Copy text={cat.label} />
        </Link>
      ))}
    </nav>
  )
}
