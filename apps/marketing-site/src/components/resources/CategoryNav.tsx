'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Category } from '@/lib/resources/types'

interface Props {
  categories: Category[]
  activeCategory?: string
}

export default function CategoryNav({ categories, activeCategory }: Props) {
  const pathname = usePathname()
  const isAll = !activeCategory || pathname === '/resources'

  return (
    <nav className="rc-cat-nav" aria-label="Resource categories">
      <Link
        href="/resources"
        className={`rc-cat-pill${isAll ? ' active' : ''}`}
      >
        All
      </Link>
      {categories.map(cat => (
        <Link
          key={cat.slug}
          href={`/resources/${cat.slug}`}
          className={`rc-cat-pill${activeCategory === cat.slug ? ' active' : ''}`}
          style={activeCategory === cat.slug ? { background: cat.color, borderColor: cat.color } : undefined}
        >
          {cat.label}
        </Link>
      ))}
    </nav>
  )
}
