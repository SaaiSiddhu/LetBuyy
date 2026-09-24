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
    color: 'rgb(20 184 166)',
    accent: 'rgba(20,184,166,0.12)',
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
    color: 'rgb(139 92 246)',
    accent: 'rgba(139,92,246,0.12)',
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
    color: 'rgb(16 185 129)',
    accent: 'rgba(16,185,129,0.12)',
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
    color: 'rgb(245 158 11)',
    accent: 'rgba(245,158,11,0.12)',
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
    color: 'rgb(59 130 246)',
    accent: 'rgba(59,130,246,0.12)',
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
