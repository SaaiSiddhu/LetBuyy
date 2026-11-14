import type { Author } from './types'
import { BRAND_ASSETS } from '../brand-assets'

export const AUTHORS: Author[] = [
  {
    slug: 'letbuyy-team',
    name: 'LetBuyy',
    role: 'Product documentation',
    bio: 'Guides published by LetBuyy. Product instructions describe supported workflows and their setup requirements; they are not independent professional advice or verified customer results.',
    avatar: BRAND_ASSETS.mark,
  },
]

// Retire unsupported person profiles without breaking previously published links.
export const RETIRED_AUTHOR_SLUGS = ['priya-commerce', 'arjun-developer', 'neha-payments', 'ravi-operations'] as const

export function getAuthor(slug: string): Author {
  return AUTHORS.find(a => a.slug === slug) ?? AUTHORS[0]
}
