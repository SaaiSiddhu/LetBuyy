import type { Category } from './types'

export const CATEGORIES: Category[] = [
  {
    slug: 'ecommerce',
    label: 'Ecommerce',
    description: 'Store setup, product catalogs, pricing strategies, and conversion optimization for Indian merchants.',
    icon: 'ShoppingBag',
    color: 'rgb(20 184 166)',
    accent: 'rgba(20,184,166,0.12)',
  },
  {
    slug: 'growth',
    label: 'Growth',
    description: 'SEO, marketing campaigns, customer retention, loyalty programs, and organic acquisition strategies.',
    icon: 'TrendingUp',
    color: 'rgb(139 92 246)',
    accent: 'rgba(139,92,246,0.12)',
  },
  {
    slug: 'payments',
    label: 'Payments',
    description: 'UPI, COD, GST compliance, invoicing, settlements, and building trust with Indian buyers.',
    icon: 'IndianRupee',
    color: 'rgb(16 185 129)',
    accent: 'rgba(16,185,129,0.12)',
  },
  {
    slug: 'operations',
    label: 'Operations',
    description: 'Inventory management, order processing, shipping logistics, and fulfillment for Indian supply chains.',
    icon: 'Package',
    color: 'rgb(245 158 11)',
    accent: 'rgba(245,158,11,0.12)',
  },
  {
    slug: 'ai-commerce',
    label: 'AI Commerce',
    description: 'AI agents, workflow automation, intelligent recommendations, and the future of merchant operations.',
    icon: 'Sparkles',
    color: 'rgb(167 139 250)',
    accent: 'rgba(167,139,250,0.12)',
  },
  {
    slug: 'developers',
    label: 'Developers',
    description: 'APIs, webhooks, apps, Liquid themes, custom integrations, and building on the LetBuyy platform.',
    icon: 'Code2',
    color: 'rgb(59 130 246)',
    accent: 'rgba(59,130,246,0.12)',
  },
  {
    slug: 'platform',
    label: 'Platform',
    description: 'LetBuyy product updates, feature announcements, roadmap highlights, and platform guides.',
    icon: 'Rocket',
    color: 'rgb(236 72 153)',
    accent: 'rgba(236,72,153,0.12)',
  },
]

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find(c => c.slug === slug)
}
