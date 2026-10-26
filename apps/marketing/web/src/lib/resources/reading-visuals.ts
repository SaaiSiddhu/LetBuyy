import { resourceHeadingId } from './headings'
import type { Article, ContentBlock } from './types'

type TopicSelection = readonly [label: string, headingIndex: number]

/** Short labels for the actual sections readers can explore; no invented metrics or states. */
const TOPICS: Record<string, readonly TopicSelection[]> = {
  'how-to-start-an-online-store-india': [['Plan', 0], ['Build', 3], ['Launch', 6]],
  'product-page-optimization': [['Photography', 1], ['Product copy', 2], ['Trust', 4]],
  'reducing-cart-abandonment': [['Find the friction', 0], ['Recover carts', 1]],
  'store-seo-checklist': [['Technical SEO', 0], ['Product pages', 2], ['Content', 4]],
  'how-product-reviews-increase-conversion': [['Build trust', 0], ['Collect reviews', 1], ['Respond', 3]],
  'first-100-orders-guide': [['Your network', 1], ['Community', 2], ['Keep customers', 4]],
  'd2c-brand-launch-guide': [['Find your niche', 0], ['Brand identity', 1], ['Launch', 3]],
  'email-marketing-ecommerce': [['The channel', 0], ['Build your list', 1], ['Email flows', 2]],
  'social-commerce-india': [['Instagram', 0], ['WhatsApp', 1], ['Content', 2]],
  'retention-strategies-india': [['Retention', 0], ['Loyalty', 1], ['Re-engagement', 2]],
  'upi-vs-cod-india': [['UPI', 1], ['Cash on delivery', 2], ['Payment mix', 4]],
  'gst-for-ecommerce-india': [['The basics', 0], ['Monthly filing', 3], ['Input credit', 4]],
  'invoicing-india-merchants': [['Invoice fields', 0], ['HSN codes', 1], ['E-invoices', 2]],
  'refunds-returns-policy-india': [['Expectations', 0], ['Your policy', 1], ['Return costs', 2]],
  'razorpay-integration-guide': [['Connect', 1], ['Configure COD', 2], ['Enable UPI', 3]],
  'inventory-management-guide': [['Prioritise stock', 0], ['Reorder points', 1], ['Locations', 4]],
  'order-fulfillment-guide': [['The workflow', 0], ['Pack', 1], ['Dispatch', 2]],
  'shipping-india-guide': [['Couriers', 0], ['Parcel weight', 2], ['Tracking', 3]],
  'multi-warehouse-inventory': [['When to expand', 0], ['Allocate stock', 2], ['Transfers', 3]],
  'understanding-fulfillment': [['Self-fulfillment', 0], ['Logistics partner', 1], ['Choose a partner', 2]],
  'ai-commerce-explained': [['Useful tasks', 0], ['Commerce tools', 1], ['Use cases', 2]],
  'automating-operations-ai': [['The ladder', 0], ['First automation', 1], ['Stock alerts', 2]],
  'commerce-copilot-guide': [['Store context', 0], ['Useful prompts', 1], ['Daily work', 2]],
  'ai-product-recommendations': [['How it works', 0], ['Types', 1], ['Placement', 2]],
  'workflow-automation-merchants': [['Workflow ideas', 0], ['Build a workflow', 1]],
  'letbuyy-api-getting-started': [['Authenticate', 0], ['Endpoints', 1], ['Pagination', 3]],
  'webhooks-complete-guide': [['Events', 0], ['Verify signatures', 2], ['Reliability', 3]],
  'building-first-letbuyy-app': [['App types', 0], ['Authorise', 2], ['Embed', 3]],
  'liquid-theming-guide': [['Syntax', 0], ['Architecture', 3], ['Customisation', 4]],
  'custom-integrations-guide': [['Recipes', 0], ['Sync patterns', 1]],
  'building-first-letbuyy-store': [['Choose a theme', 2], ['Add a product', 3], ['Publish', 7]],
  'introduction-to-apps': [['Categories', 0], ['Installation', 1], ['Choose tools', 2]],
  'how-themes-work': [['Theme types', 0], ['The editor', 1], ['Publish', 3]],
  'letbuyy-platform-overview': [['Core surfaces', 0], ['Connections', 1], ['India-first', 2]],
  'merchant-web-guide': [['Dashboard', 0], ['Products', 1], ['Orders', 2]],
}

export interface ReadingTopic {
  label: string
  heading: string
  targetId: string
  excerpt: string
}

function getExcerpt(blocks: ContentBlock[]): string {
  for (const block of blocks) {
    if (block.type === 'p') return block.text
    if (block.type === 'ul' || block.type === 'ol') return block.items.slice(0, 2).join(' · ')
    if (block.type === 'callout') return block.text
  }
  return 'Explore the examples and explanation in this section.'
}

export function getReadingTopics(article: Article): ReadingTopic[] {
  const headings = article.body.flatMap((block, index) => block.type === 'h2' ? [{ text: block.text, id: block.id, index }] : [])
  return (TOPICS[article.slug] ?? []).flatMap(([label, headingIndex]) => {
    const heading = headings[headingIndex]
    if (!heading) return []
    const nextHeading = headings[headingIndex + 1]?.index ?? article.body.length
    return [{
      label,
      heading: heading.text,
      targetId: heading.id ?? resourceHeadingId(heading.text),
      excerpt: getExcerpt(article.body.slice(heading.index + 1, nextHeading)),
    }]
  })
}
