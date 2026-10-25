/** Editorial illustrations only; these are not screenshots of active templates or integrations. */
export const THEME_ARTWORK = {
  free: '/illustrations/resources/theme-free-v1.webp',
  marketplace: '/illustrations/resources/theme-marketplace-v1.webp',
  custom: '/illustrations/resources/theme-custom-v1.webp',
} as const

export const SECTION_ARTWORK = [
  { label: 'Hero image', src: '/illustrations/resources/section-hero-v1.webp' },
  { label: 'Product grid', src: '/illustrations/resources/section-products-v1.webp' },
  { label: 'Image with text', src: '/illustrations/resources/section-image-text-v1.webp' },
  { label: 'Newsletter signup', src: '/illustrations/resources/section-newsletter-v1.webp' },
] as const

export interface EditorialArtwork {
  src: string
  thumbnailSrc: string
  alt: string
  caption: string
  width: number
  height: number
}

function artwork(src: string, alt: string, caption: string, width = 1536, height = 1024): EditorialArtwork {
  return { src: `/illustrations/${src}`, thumbnailSrc: `/illustrations/resources/thumbnails/${src.slice(src.lastIndexOf('/') + 1)}`, alt, caption, width, height }
}

const SCENES = {
  store: artwork('resources/guide-first-store-v1.webp', 'A storefront on a laptop and phone beside products and a launch checklist.', 'Choose a theme, prepare your products, and bring your store to life.'),
  products: artwork('resources/section-products-v1.webp', 'An editorial storefront product collection.', 'Show the product clearly, then help the buyer decide.'),
  search: artwork('resources/reading-search-discovery-v1.webp', 'A magnifying glass connects a search field to illustrated product cards.', 'Connect the way people search with the products they can discover.'),
  audience: artwork('resources/reading-growth-audience-v1.webp', 'Customer portrait cards, a thank-you note and a megaphone beside a parcel.', 'Build relationships from the first introduction to the next order.'),
  email: artwork('resources/section-newsletter-v1.webp', 'An editorial newsletter signup composition.', 'Turn an introduction into a lasting connection.'),
  payments: artwork('resources/reading-payments-choice-v1.webp', 'A phone with a conceptual QR code beside a parcel, banknotes and coins.', 'Two payment paths, one customer journey: pay digitally or pay on delivery.'),
  documents: artwork('resources/reading-tax-documents-v1.webp', 'Invoice sheets, a calculator and a folder beside a small parcel.', 'Keep sales, invoices and the supporting records connected.'),
  fulfillment: artwork('resources/reading-fulfillment-v1.webp', 'A packing workspace with parcels, a scanner and a miniature delivery van.', 'Follow the work from available stock to a prepared parcel and delivery.'),
  inventory: artwork('capabilities/inventory-scene-v1.webp', 'An illustrated inventory and stock-management workspace.', 'Understand what is in stock, where it belongs and what needs attention.', 640, 585),
  ai: artwork('resources/ai-commerce-studio-v1.webp', 'A smoked-glass lens connects three carefully arranged product cards.', 'Bring product context into focus before choosing the next action.'),
  aiOperations: artwork('resources/ai-operations-studio-v1.webp', 'Task sheets connect to a prepared parcel beside a scanner and a small clock.', 'Connect routine tasks to the work that needs to happen next.'),
  aiCopilot: artwork('resources/ai-copilot-studio-v1.webp', 'A conversation tablet is connected to a merchant notebook beside a product parcel.', 'A useful conversation starts with the context of your business.'),
  aiRecommendations: artwork('resources/ai-recommendations-studio-v1.webp', 'A ceramic cup product card connects to complementary linen and glassware cards.', 'Help buyers discover products that make sense together.'),
  aiWorkflow: artwork('resources/ai-workflow-studio-v1.webp', 'Three connected cards illustrate an order event, a decision and a message action.', 'Follow a workflow from its trigger through a decision to an action.'),
  developer: artwork('resources/reading-developer-connections-v1.webp', 'A code laptop connects through small modules to a parcel and a key.', 'Connect requests, events and access to the work your store needs.'),
  developerApi: artwork('resources/developer-api-studio-v1.webp', 'A request card and access key connect through a glass gate to product records.', 'An authenticated request connects your application to structured store data.'),
  developerWebhooks: artwork('resources/developer-webhooks-studio-v1.webp', 'An order event travels through a signed envelope to a receiving tray.', 'Follow a commerce event from its source to a receiving application.'),
  developerIntegrations: artwork('resources/developer-integrations-studio-v1.webp', 'Glass bridges connect an inventory ledger, product catalog and invoice folio.', 'Connect business records through deliberate mapping and sync patterns.'),
  liquid: artwork('resources/guide-liquid-v1.webp', 'A template editor and a merchant-customizable storefront.', 'From Liquid templates to a merchant-customizable storefront.'),
  apps: artwork('resources/guide-apps-v1.webp', 'An editorial arrangement of connected commerce tools.', 'A connected view of shipping, marketing, analytics, operations, and support.'),
  themes: artwork('resources/theme-custom-v1.webp', 'A custom storefront design study on responsive screens.', 'One design layer. A storefront that feels like you.'),
  learning: artwork('resources/reading-learning-journey-v1.webp', 'An open field guide unfolds toward a storefront, parcel and checklist.', 'A few useful guides. A clearer path from learning to doing.'),
  lifecycle: artwork('resources/reading-customer-lifecycle-v1.webp', 'An envelope and customer cards connect back to a carefully packed parcel.', 'Keep the conversation going before and after an order.'),
  returns: artwork('resources/reading-returns-care-v1.webp', 'An open return parcel, shipping label and conversation card beside a return arrow.', 'Make the return journey as clear as the purchase.'),
} as const

/** Each published article has an intentional subject, rather than a category fallback. */
const ARTICLE_ARTWORK: Record<string, EditorialArtwork> = {
  'how-to-start-an-online-store-india': SCENES.store,
  'product-page-optimization': SCENES.products,
  'reducing-cart-abandonment': SCENES.payments,
  'store-seo-checklist': SCENES.search,
  'how-product-reviews-increase-conversion': SCENES.audience,
  'first-100-orders-guide': SCENES.audience,
  'd2c-brand-launch-guide': SCENES.store,
  'email-marketing-ecommerce': SCENES.email,
  'social-commerce-india': SCENES.audience,
  'retention-strategies-india': SCENES.lifecycle,
  'upi-vs-cod-india': SCENES.payments,
  'gst-for-ecommerce-india': SCENES.documents,
  'invoicing-india-merchants': SCENES.documents,
  'refunds-returns-policy-india': SCENES.returns,
  'razorpay-integration-guide': SCENES.payments,
  'inventory-management-guide': SCENES.inventory,
  'order-fulfillment-guide': SCENES.fulfillment,
  'shipping-india-guide': SCENES.fulfillment,
  'multi-warehouse-inventory': SCENES.inventory,
  'understanding-fulfillment': SCENES.fulfillment,
  'ai-commerce-explained': SCENES.ai,
  'automating-operations-ai': SCENES.aiOperations,
  'commerce-copilot-guide': SCENES.aiCopilot,
  'ai-product-recommendations': SCENES.aiRecommendations,
  'workflow-automation-merchants': SCENES.aiWorkflow,
  'letbuyy-api-getting-started': SCENES.developerApi,
  'webhooks-complete-guide': SCENES.developerWebhooks,
  'building-first-letbuyy-app': SCENES.apps,
  'liquid-theming-guide': SCENES.liquid,
  'custom-integrations-guide': SCENES.developerIntegrations,
  'building-first-letbuyy-store': SCENES.store,
  'introduction-to-apps': SCENES.apps,
  'how-themes-work': SCENES.themes,
  'letbuyy-platform-overview': SCENES.apps,
  'merchant-web-guide': SCENES.apps,
}

export function getArticleArtwork(slug: string): EditorialArtwork | undefined {
  return ARTICLE_ARTWORK[slug]
}

export type EditorialScene = keyof typeof SCENES

export function getEditorialScene(scene: EditorialScene): EditorialArtwork {
  return SCENES[scene]
}

const PATH_SCENES: Record<string, EditorialScene> = {
  'start-selling-online': 'store',
  'first-100-orders': 'audience',
  'payments-mastery': 'payments',
  'scale-your-operations': 'fulfillment',
  'developer-foundations': 'developer',
}

export function getLearningPathArtwork(slug: string): EditorialArtwork | undefined {
  const scene = PATH_SCENES[slug]
  return scene ? SCENES[scene] : undefined
}
