import type { Article } from './types'
import { getEditorialScene, type EditorialArtwork, type EditorialScene } from './artwork'
import { getReadingTopics } from './reading-visuals'

const SECTION_SCENES: Record<string, readonly [EditorialScene, EditorialScene]> = {
  'how-to-start-an-online-store-india': ['products', 'fulfillment'],
  'product-page-optimization': ['products', 'audience'],
  'reducing-cart-abandonment': ['payments', 'lifecycle'],
  'store-seo-checklist': ['search', 'learning'],
  'how-product-reviews-increase-conversion': ['audience', 'lifecycle'],
  'first-100-orders-guide': ['audience', 'lifecycle'],
  'd2c-brand-launch-guide': ['themes', 'fulfillment'],
  'email-marketing-ecommerce': ['email', 'lifecycle'],
  'social-commerce-india': ['audience', 'lifecycle'],
  'retention-strategies-india': ['audience', 'lifecycle'],
  'upi-vs-cod-india': ['payments', 'fulfillment'],
  'gst-for-ecommerce-india': ['documents', 'inventory'],
  'invoicing-india-merchants': ['documents', 'developer'],
  'refunds-returns-policy-india': ['lifecycle', 'returns'],
  'razorpay-integration-guide': ['developer', 'payments'],
  'inventory-management-guide': ['inventory', 'fulfillment'],
  'order-fulfillment-guide': ['inventory', 'fulfillment'],
  'shipping-india-guide': ['fulfillment', 'returns'],
  'multi-warehouse-inventory': ['inventory', 'fulfillment'],
  'understanding-fulfillment': ['fulfillment', 'inventory'],
  'ai-commerce-explained': ['ai', 'developer'],
  'automating-operations-ai': ['aiOperations', 'inventory'],
  'commerce-copilot-guide': ['aiCopilot', 'apps'],
  'ai-product-recommendations': ['aiRecommendations', 'products'],
  'workflow-automation-merchants': ['aiWorkflow', 'developer'],
  'letbuyy-api-getting-started': ['developerApi', 'products'],
  'webhooks-complete-guide': ['developerWebhooks', 'documents'],
  'building-first-letbuyy-app': ['apps', 'developer'],
  'custom-integrations-guide': ['apps', 'developerIntegrations'],
  'building-first-letbuyy-store': ['themes', 'fulfillment'],
  'introduction-to-apps': ['apps', 'developer'],
  'letbuyy-platform-overview': ['apps', 'payments'],
  'merchant-web-guide': ['apps', 'fulfillment'],
}

export interface SectionVisual extends EditorialArtwork {
  label: string
}

/** Standard guides gain two supporting scenes; Theme/Liquid keep their bespoke diagrams. */
export function getSectionVisuals(article: Article): Record<string, SectionVisual> {
  const scenes = SECTION_SCENES[article.slug]
  if (!scenes) return {}
  const topics = getReadingTopics(article)
  if (topics.length < 2) return {}
  return Object.fromEntries([topics[0], topics[topics.length - 1]].map((topic, index) => [
    topic.targetId, { ...getEditorialScene(scenes[index]), label: topic.label },
  ]))
}
