import type { Category } from './types'

export const CATEGORIES: Category[] = [
  {
    slug: 'ecommerce',
    label: 'Ecommerce',
    description: 'Store setup, product catalogs, pricing strategies, and conversion optimization for Indian merchants.',
    icon: 'ShoppingBag',
    color: 'var(--lb-primitive-color-teal-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-teal-500) 12%, transparent)',
  },
  {
    slug: 'growth',
    label: 'Growth',
    description: 'SEO, marketing campaigns, customer retention, loyalty programs, and organic acquisition strategies.',
    icon: 'TrendingUp',
    color: 'var(--lb-primitive-color-purple-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-purple-500) 12%, transparent)',
  },
  {
    slug: 'payments',
    label: 'Payments',
    description: 'UPI, COD, GST compliance, invoicing, settlements, and building trust with Indian buyers.',
    icon: 'IndianRupee',
    color: 'var(--lb-primitive-color-emerald-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-emerald-500) 12%, transparent)',
  },
  {
    slug: 'operations',
    label: 'Operations',
    description: 'Inventory management, order processing, shipping logistics, and fulfillment for Indian supply chains.',
    icon: 'Package',
    color: 'var(--lb-primitive-color-amber-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-amber-500) 12%, transparent)',
  },
  {
    slug: 'ai-commerce',
    label: 'AI Commerce',
    description: 'AI agents, workflow automation, intelligent recommendations, and the future of merchant operations.',
    icon: 'Sparkles',
    color: 'var(--lb-primitive-color-purple-400)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-purple-400) 12%, transparent)',
  },
  {
    slug: 'developers',
    label: 'Developers',
    description: 'APIs, webhooks, apps, Liquid themes, custom integrations, and building on the LetBuyy platform.',
    icon: 'Code2',
    color: 'var(--lb-primitive-color-blue-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-blue-500) 12%, transparent)',
  },
  {
    slug: 'platform',
    label: 'Platform',
    description: 'LetBuyy product updates, feature announcements, roadmap highlights, and platform guides.',
    icon: 'Rocket',
    color: 'var(--lb-primitive-color-pink-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-pink-500) 12%, transparent)',
  },
]

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find(c => c.slug === slug)
}
