export interface LearningPath {
  slug: string
  title: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  articleSlugs: string[]
  estimatedTime: number
  color: string
  accent: string
}

export const LEARNING_PATHS: LearningPath[] = [
  {
    slug: 'start-selling-online',
    title: 'Start Selling Online',
    description: 'Everything you need to go from idea to first sale — store setup, products, payments, and shipping.',
    level: 'beginner',
    estimatedTime: 60,
    color: 'var(--lb-primitive-color-teal-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-teal-500) 12%, transparent)',
    articleSlugs: [
      'how-to-start-an-online-store-india',
      'product-page-optimization',
      'upi-vs-cod-india',
      'store-seo-checklist',
      'building-first-letbuyy-store',
    ],
  },
  {
    slug: 'first-100-orders',
    title: 'First 100 Orders',
    description: 'Get your first 100 real customers — no ads required. The organic playbook for new Indian D2C brands.',
    level: 'beginner',
    estimatedTime: 45,
    color: 'var(--lb-primitive-color-purple-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-purple-500) 12%, transparent)',
    articleSlugs: [
      'first-100-orders-guide',
      'd2c-brand-launch-guide',
      'social-commerce-india',
      'reducing-cart-abandonment',
      'how-product-reviews-increase-conversion',
    ],
  },
  {
    slug: 'payments-mastery',
    title: 'Payments Mastery',
    description: 'UPI, COD, GST, invoicing, refunds — master India\'s payment landscape and stay compliant.',
    level: 'intermediate',
    estimatedTime: 50,
    color: 'var(--lb-primitive-color-emerald-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-emerald-500) 12%, transparent)',
    articleSlugs: [
      'upi-vs-cod-india',
      'gst-for-ecommerce-india',
      'invoicing-india-merchants',
      'razorpay-integration-guide',
      'refunds-returns-policy-india',
    ],
  },
  {
    slug: 'scale-your-operations',
    title: 'Scale Your Operations',
    description: 'From 10 to 1,000 orders per day — inventory systems, fulfillment operations, and logistics strategy.',
    level: 'intermediate',
    estimatedTime: 48,
    color: 'var(--lb-primitive-color-amber-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-amber-500) 12%, transparent)',
    articleSlugs: [
      'inventory-management-guide',
      'order-fulfillment-guide',
      'shipping-india-guide',
      'multi-warehouse-inventory',
      'understanding-fulfillment',
    ],
  },
  {
    slug: 'developer-foundations',
    title: 'Developer Foundations',
    description: 'Build on LetBuyy — APIs, webhooks, apps, Liquid themes, and custom integrations.',
    level: 'advanced',
    estimatedTime: 56,
    color: 'var(--lb-primitive-color-blue-500)',
    accent: 'color-mix(in srgb, var(--lb-primitive-color-blue-500) 12%, transparent)',
    articleSlugs: [
      'letbuyy-api-getting-started',
      'webhooks-complete-guide',
      'building-first-letbuyy-app',
      'liquid-theming-guide',
      'custom-integrations-guide',
    ],
  },
]

export function getLearningPath(slug: string): LearningPath | undefined {
  return LEARNING_PATHS.find(p => p.slug === slug)
}
