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
  'razorpay-integration-guide': [["Provider account", 0], ["Connect", 1], ["Verify payment", 2]],
  'inventory-management-guide': [['Prioritise stock', 0], ['Reorder points', 1], ['Locations', 4]],
  'order-fulfillment-guide': [['The workflow', 0], ['Pack', 1], ['Dispatch', 2]],
  'shipping-india-guide': [['Couriers', 0], ['Parcel weight', 2], ['Tracking', 3]],
  'multi-warehouse-inventory': [['When to expand', 0], ['Allocate stock', 2], ['Transfers', 3]],
  'understanding-fulfillment': [['Self-fulfillment', 0], ['Logistics partner', 1], ['Choose a partner', 2]],
  'ai-commerce-explained': [["Commerce tools", 0], ["Product copy", 1], ["Limits", 2]],
  'automating-operations-ai': [["First automation", 0], ["Stock alerts", 1]],
  'commerce-copilot-guide': [["Useful prompts", 0], ["Daily work", 1]],
  'ai-product-recommendations': [["How it works", 0], ["Placement", 1]],
  'workflow-automation-merchants': [["Build a workflow", 0], ["Test", 1]],
  'letbuyy-api-getting-started': [["Authenticate", 0], ["Endpoints", 1], ["Pagination", 2]],
  'webhooks-complete-guide': [["Contracts", 0], ["Verify signatures", 1], ["Reliability", 2]],
  'building-first-letbuyy-app': [["App types", 0], ["Credentials", 1]],
  'liquid-theming-guide': [['Syntax', 0], ['Architecture', 3], ['Customisation', 4]],
  'custom-integrations-guide': [['Recipes', 0], ['Sync patterns', 1]],
  'building-first-letbuyy-store': [["Your account", 0], ["Choose a theme", 2], ["Publish", 4]],
  'introduction-to-apps': [["Choose tools", 0], ["Installation", 1]],
  'how-themes-work': [['Theme types', 0], ['The editor', 1], ['Publish', 3]],
  'letbuyy-platform-overview': [["Core surfaces", 0], ["India-first", 1], ["Roadmap", 2]],
  'merchant-web-guide': [["Products", 0], ["Orders", 1], ["Customers", 2]],
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
