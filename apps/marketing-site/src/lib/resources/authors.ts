import type { Author } from './types'

export const AUTHORS: Author[] = [
  {
    slug: 'letbuyy-team',
    name: 'LetBuyy Team',
    role: 'Platform',
    bio: 'The LetBuyy editorial team — merchants, engineers, and commerce obsessives building India\'s best commerce OS.',
    avatar: '/icons/letbuyy-mark.svg',
    twitter: 'https://x.com/letbuyy',
    linkedin: 'https://linkedin.com/company/letbuyy',
  },
  {
    slug: 'priya-commerce',
    name: 'Priya Sharma',
    role: 'Commerce Lead',
    bio: 'Commerce strategist with 8 years helping Indian D2C brands scale from 0 to 10 crore ARR. Previously at Meesho and Nykaa.',
    avatar: '/icons/letbuyy-mark.svg',
    twitter: 'https://x.com/letbuyy',
  },
  {
    slug: 'arjun-developer',
    name: 'Arjun Mehta',
    role: 'Developer Relations',
    bio: 'Builds developer tools and writes about APIs, webhooks, and extending the LetBuyy platform.',
    avatar: '/icons/letbuyy-mark.svg',
    linkedin: 'https://linkedin.com/company/letbuyy',
  },
  {
    slug: 'neha-payments',
    name: 'Neha Gupta',
    role: 'Payments & Compliance',
    bio: 'GST consultant and payments specialist focused on making India-first commerce frictionless for merchants of all sizes.',
    avatar: '/icons/letbuyy-mark.svg',
  },
  {
    slug: 'ravi-operations',
    name: 'Ravi Krishnan',
    role: 'Operations',
    bio: 'Supply chain and operations expert who has helped over 200 Indian brands streamline fulfillment and reduce return rates.',
    avatar: '/icons/letbuyy-mark.svg',
  },
]

export function getAuthor(slug: string): Author {
  return AUTHORS.find(a => a.slug === slug) ?? AUTHORS[0]
}
