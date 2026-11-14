import type { Article } from './types'
import { matchResourceArticles } from './resource-search'

export const ARTICLES: Article[] = [
  // ── ECOMMERCE ─────────────────────────────────────────────────────────────
  {
    slug: 'how-to-start-an-online-store-india',
    category: 'ecommerce',
    title: "How To Start an Online Store in India (2026 Guide)",
    subtitle: "Everything you need to launch, sell, and grow — from GST registration to your first order.",
    description: "A complete step-by-step guide to starting an online store in India in 2026, covering GST, payments, logistics, and marketing.",
    author: "letbuyy-team",
    publishedAt: '2026-05-01',
    updatedAt: "2026-11-03",
    tags: ['store-setup', 'india', 'beginners', 'gst'],
    readingTime: 12,
    featured: true,
    body: [
  {
    "type": "p",
    "text": "Starting an online store requires decisions about products, customers, payments, fulfilment and applicable tax obligations. Use this guide as a planning checklist, then confirm requirements for your own business.",
    "references": [
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      },
      {
        "label": "The Complete Store SEO Checklist for Indian Merchants",
        "href": "/resources/ecommerce/store-seo-checklist"
      }
    ]
  },
  {
    "type": "metric",
    "metrics": [
      {
        "label": "Demand research",
        "value": "Customers",
        "change": "Validate demand",
        "positive": true
      },
      {
        "label": "Payment choices",
        "value": "Measure",
        "change": "Use your own data",
        "positive": true
      },
      {
        "label": "Delivery coverage",
        "value": "Reach",
        "change": "Check serviceability",
        "positive": true
      }
    ]
  },
  {
    "type": "h2",
    "text": "Step 1: Decide What You're Selling"
  },
  {
    "type": "p",
    "text": "Before choosing a platform, compare products using customer demand, sourcing, achievable margins and the requirements that apply. Examples to research include clothing, handmade goods and business supplies. Validate demand and costs for the products you can actually offer."
  },
  {
    "type": "insight",
    "title": "Undersaturated categories win in Tier 2 India",
    "text": "Choose products using customer demand, achievable margins, sourcing and the requirements that apply to the category. No category or city tier guarantees growth."
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "India Advantage",
    "text": "Validate demand in the locations you can serve. Interview potential customers and compare alternatives; neither a city tier nor a category label establishes demand or a predictable growth window."
  },
  {
    "type": "h2",
    "text": "Step 2: Check Registration and Tax Requirements",
    "id": "validate-demand-in-the-locations-you-can-serve-interview-potential-customers-and-compare-alternatives-neither-a-city-tier-nor-a-category-label-establishes-demand-or-a-predictable-growth-window"
  },
  {
    "type": "p",
    "text": "GST registration depends on the supplies, turnover, state and sales channel involved. Check the current rules and any conditional exemptions with a qualified tax adviser before accepting orders."
  },
  {
    "type": "checklist",
    "title": "GST Registration Checklist",
    "items": [
      {
        "text": "PAN card of the business owner or entity",
        "checked": true
      },
      {
        "text": "Aadhaar card for identity verification",
        "checked": true
      },
      {
        "text": "Bank account statement or cancelled cheque",
        "checked": true
      },
      {
        "text": "Proof of business address (rent agreement or utility bill)",
        "checked": false
      },
      {
        "text": "Digital signature certificate (for company/LLP)",
        "checked": false
      },
      {
        "text": "MOA/AOA if registering a Private Limited company",
        "checked": false
      }
    ]
  },
  {
    "type": "ul",
    "items": [
      "Sole proprietor: No separate registration needed. GST under your PAN.",
      "Partnership / LLP: Register with MCA first, then GST.",
      "Private Limited: Recommended for brands expecting VC or large scale."
    ]
  },
  {
    "type": "p",
    "text": "Confirm the registrations and records required for your chosen business structure with a qualified adviser. Do not treat every partnership, LLP or sole proprietor as having the same registration path."
  },
  {
    "type": "h2",
    "text": "Step 3: Choose Your Platform"
  },
  {
    "type": "p",
    "text": "Your platform is your commerce operating system. It affects everything: your checkout experience, theme flexibility, payment gateway options, and how much time you spend on operations vs. growth."
  },
  {
    "type": "p",
    "text": "Compare the current total cost, catalog tools, payment eligibility, delivery setup, export options and support of each platform. Check each provider directly; this guide does not certify competitors or promise every feature on every LetBuyy plan."
  },
  {
    "type": "commerce-example",
    "scenario": "Illustrative planning example, not a verified customer case study: a clothing seller reviews checkout steps, payment options and invoice requirements before changing platforms.",
    "result": "Record a baseline and compare completed orders under comparable conditions. No conversion or revenue increase is promised by this example.",
    "metric": "Illustrative workflow"
  },
  {
    "type": "h2",
    "text": "Step 4: Set Up Your Store"
  },
  {
    "type": "p",
    "text": "Create a draft store, complete its business settings and test the buyer journey before publishing. Account creation alone does not enable payments, shipping or customer notifications."
  },
  {
    "type": "p",
    "text": "Use the email signup form, verify the email code and set your password. Continue through onboarding to choose an online store, display name, subdomain and industry. The store starts as a draft."
  },
  {
    "type": "h2",
    "text": "Step 5: Configure Payments"
  },
  {
    "type": "p",
    "text": "Offer payment methods that suit your customers and provider eligibility. Measure successful payments and fulfilment outcomes in your own store; national payment volumes are not your store's payment mix."
  },
  {
    "type": "metric",
    "metrics": [
      {
        "label": "UPI",
        "value": "Measure",
        "change": "Your store's payment mix"
      },
      {
        "label": "Cash on Delivery",
        "value": "Track",
        "change": "Your delivery outcomes"
      },
      {
        "label": "Cards & Wallets",
        "value": "Compare",
        "change": "Your customer needs"
      }
    ]
  },
  {
    "type": "callout",
    "variant": "info",
    "title": "COD Strategy",
    "text": "Decide COD eligibility using your delivery coverage, order history and costs. Explain any restrictions before checkout and monitor return-to-origin separately from customer returns."
  },
  {
    "type": "h2",
    "text": "Step 6: Sort Your Logistics"
  },
  {
    "type": "p",
    "text": "Compare courier coverage for your customers' PIN codes, tracking support, failed-delivery handling and total costs. Use your own shipment outcomes rather than an unsupported national benchmark."
  },
  {
    "type": "p",
    "text": "Compare actual courier quotes, serviceable PIN codes, pickup options, insurance, tracking and return costs for your shipments. No courier is universally cheapest or best for a revenue band."
  },
  {
    "type": "p",
    "text": "Compare actual courier quotes, serviceable PIN codes, pickup options, insurance, tracking and return costs for your shipments. No courier is universally cheapest or best for a revenue band."
  },
  {
    "type": "h2",
    "text": "Step 7: Launch and Validate"
  },
  {
    "type": "p",
    "text": "Don't aim for perfection before launch. Aim for your first 10 orders. Real customer feedback is worth more than any amount of internal testing. Launch to your existing network first — WhatsApp groups, Instagram, college alumni networks — before spending on ads."
  },
  {
    "type": "checklist",
    "title": "Pre-Launch Checklist",
    "items": [
      {
        "text": "Test checkout end-to-end on mobile (iPhone and Android)",
        "checked": false
      },
      {
        "text": "Place a real test order with UPI and verify GST invoice",
        "checked": false
      },
      {
        "text": "Check that all product images load fast on 4G",
        "checked": false
      },
      {
        "text": "Set up WhatsApp Business number for support",
        "checked": false
      },
      {
        "text": "Write 5 WhatsApp messages to send to your first potential buyers",
        "checked": false
      },
      {
        "text": "Announce on Instagram Story with swipe-up link to store",
        "checked": false
      }
    ]
  },
  {
    "type": "callout",
    "variant": "success",
    "title": "First 10 Orders Milestone",
    "text": "Getting 10 orders from people who don't know you personally is the single most important validation milestone for any Indian D2C brand. Everything before that is planning. Everything after that is execution."
  }
],
    relatedSlugs: ['first-100-orders-guide', 'upi-vs-cod-india', 'gst-for-ecommerce-india', 'store-seo-checklist'],
  },
  {
    slug: 'product-page-optimization',
    category: 'ecommerce',
    title: "Product Page Optimization: The Complete Guide",
    subtitle: "Turn browsers into buyers with product pages that build trust, answer objections, and convert.",
    description: "Learn how to optimize your product pages for Indian buyers — better images, descriptions, reviews, and trust signals that convert.",
    author: "letbuyy-team",
    publishedAt: '2026-05-10',
    updatedAt: "2026-11-03",
    tags: ['conversion', 'product-pages', 'ux', 'copywriting'],
    readingTime: 9,
    body: [
  {
    "type": "p",
    "text": "A useful product page answers questions about fit, price, delivery, returns and product quality. Compare conversion within your own traffic and product mix rather than relying on an uncited national benchmark.",
    "references": [
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      },
      {
        "label": "The Complete Store SEO Checklist for Indian Merchants",
        "href": "/resources/ecommerce/store-seo-checklist"
      }
    ]
  },
  {
    "type": "h2",
    "text": "The Anatomy of a High-Converting Product Page"
  },
  {
    "type": "p",
    "text": "Before optimizing anything, understand what a buyer needs to answer before purchasing: Does this product solve my problem? Is the quality real? Can I trust this seller? What happens if I need to return it? Is the price fair?"
  },
  {
    "type": "h2",
    "text": "Photography: Your Most Important Asset"
  },
  {
    "type": "p",
    "text": "In physical retail, customers pick products up. Online, photography does that work. Every product needs at minimum: a clean white background shot, 2–3 lifestyle shots showing the product in use, a close-up showing texture and quality, and a scale reference shot."
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "Mobile-First Photography",
    "text": "Test product images and text on small mobile screens as well as desktop. Keep details readable and supply useful angles without making the page unnecessarily heavy."
  },
  {
    "type": "h2",
    "text": "Write Descriptions That Answer Questions, Not Just Describe"
  },
  {
    "type": "p",
    "text": "Most product descriptions are written from a seller's perspective (\"High-quality cotton kurta\"). Buyers read from their own perspective (\"Will this fabric breathe in Delhi summer?\"). Rewrite every description as a set of answers to objections."
  },
  {
    "type": "ol",
    "items": [
      "Lead with the primary benefit (not a feature)",
      "Address the #1 objection in paragraph 2",
      "List key specs in scannable bullet points",
      "End with a care/use instruction to reduce returns",
      "Add a single urgency signal if genuine (limited stock, sale ends)"
    ]
  },
  {
    "type": "h2",
    "text": "Reviews Are Your Best Sales Team"
  },
  {
    "type": "p",
    "text": "Genuine reviews can answer questions that product copy misses. Make review requests optional and easy, and measure their effect without promising a fixed conversion lift."
  },
  {
    "type": "h2",
    "text": "Trust Signals That Matter for India"
  },
  {
    "type": "ul",
    "items": [
      "Secure payment badge with UPI, Razorpay, and COD logos",
      "GST invoice availability (critical for business buyers)",
      "7-day or 14-day return policy displayed prominently",
      "WhatsApp support link for pre-purchase questions",
      "Real stock counts (creates urgency without fake pressure)",
      "Delivery estimate by PIN code"
    ]
  },
  {
    "type": "h2",
    "text": "The Price Anchoring Effect"
  },
  {
    "type": "p",
    "text": "Display the actual selling price and applicable charges clearly. If you show an MRP or discount, use accurate, supportable amounts and verify the requirements that apply to the product. Test how customers understand the presentation using your own data."
  }
],
    relatedSlugs: ['reducing-cart-abandonment', 'how-product-reviews-increase-conversion', 'store-seo-checklist'],
  },
  {
    slug: 'reducing-cart-abandonment',
    category: 'ecommerce',
    title: "Reducing Cart Abandonment: 12 Proven Strategies for Indian Stores",
    subtitle: "Find friction in your checkout and help interested shoppers complete their order.",
    description: "Tactical guide to reducing cart abandonment rates for Indian ecommerce stores with COD, UPI, and WhatsApp recovery.",
    author: "letbuyy-team",
    publishedAt: '2026-04-22',
    updatedAt: "2026-10-30",
    tags: ['conversion', 'cart', 'recovery', 'whatsapp'],
    readingTime: 8,
    body: [
  {
    "type": "p",
    "text": "Cart abandonment has several possible causes: unexpected costs, payment problems, delivery uncertainty or a shopper who is not ready to buy. Diagnose your own checkout before choosing a recovery tactic.",
    "references": [
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      },
      {
        "label": "The Complete Store SEO Checklist for Indian Merchants",
        "href": "/resources/ecommerce/store-seo-checklist"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Understand Why Indian Buyers Abandon"
  },
  {
    "type": "ul",
    "items": [
      "No COD option available (top reason in Tier 2/3)",
      "Unexpected shipping charges at checkout",
      "Page loaded too slowly on mobile",
      "No WhatsApp or phone support for last-minute questions",
      "Forced account creation before purchase",
      "UPI app switch friction on mobile browsers"
    ]
  },
  {
    "type": "h2",
    "text": "The 12 Strategies"
  },
  {
    "type": "h3",
    "text": "1. Offer COD at All Tiers"
  },
  {
    "type": "p",
    "text": "Choose COD eligibility using your delivery coverage, costs, product category and actual order history. Explain restrictions before checkout; do not assume a universal order-value limit will improve revenue."
  },
  {
    "type": "h3",
    "text": "2. Show Final Price Before Checkout"
  },
  {
    "type": "p",
    "text": "Display estimated shipping costs on the product page or cart — not as a surprise at checkout. \"Free shipping above ₹499\" shown early converts better than the same offer revealed at checkout."
  },
  {
    "type": "h3",
    "text": "3. WhatsApp Cart Recovery"
  },
  {
    "type": "p",
    "text": "Where permitted and supported by your provider, test an opt-in reminder with a clear way to stop messages. Measure recovery against a comparable group; no open-rate or recovery guarantee applies."
  },
  {
    "type": "h3",
    "text": "4. Simplify the Checkout to 2 Steps"
  },
  {
    "type": "p",
    "text": "Collect only the fields required for the order and its fulfilment. Explain why information is needed, support accessible input and test completion rather than assuming every field has the same effect."
  },
  {
    "type": "h3",
    "text": "5. Guest Checkout Always"
  },
  {
    "type": "p",
    "text": "Never force account creation before a first purchase. Offer to \"save your details\" after the order is confirmed — that's when trust is highest and consent feels natural."
  },
  {
    "type": "callout",
    "variant": "info",
    "title": "LetBuyy Checkout",
    "text": "Test the actual checkout for the payment methods, addresses and guest/account requirements your store supports. Provider configuration, eligibility and failure recovery matter more than an unmeasured optimization claim."
  },
  {
    "type": "h3",
    "text": "6. Add PIN Code Delivery Estimate on Cart Page"
  },
  {
    "type": "p",
    "text": "\"Estimated delivery: 3–5 business days\" is vague. \"Estimated delivery to 400001: Tuesday, June 24\" with a live PIN code checker is concrete — and converts."
  },
  {
    "type": "h3",
    "text": "7. Show Micro Social Proof at Checkout"
  },
  {
    "type": "p",
    "text": "Use genuine, traceable customer feedback if you have permission to publish it. Never invent order counts, recent-purchase notifications or customer outcomes to create urgency."
  },
  {
    "type": "h3",
    "text": "8. Sticky Exit Intent on Mobile"
  },
  {
    "type": "p",
    "text": "When a mobile user scrolls up (classic exit signal), show a sticky bottom bar: \"Wait — your order qualifies for free shipping. Complete it now.\" Keep it dismissible and non-intrusive."
  }
],
    relatedSlugs: ['product-page-optimization', 'first-100-orders-guide', 'store-seo-checklist'],
  },
  {
    slug: 'store-seo-checklist',
    category: 'ecommerce',
    title: "The Complete Store SEO Checklist for Indian Merchants",
    subtitle: "Rank on Google India, drive organic traffic, and build a channel that doesn't depend on ads.",
    description: "A comprehensive SEO checklist for Indian ecommerce stores — covering technical SEO, on-page optimization, and local signals.",
    author: "letbuyy-team",
    publishedAt: '2026-03-15',
    updatedAt: "2026-10-30",
    tags: ['seo', 'technical-seo', 'organic', 'google'],
    readingTime: 10,
    body: [
  {
    "type": "p",
    "text": "Search can help shoppers discover useful product and category pages. Its contribution varies by store, audience and measurement; use your own organic landing-page and order data rather than an uncited revenue-share promise.",
    "references": [
      {
        "label": "Google Search Central — SEO Starter Guide",
        "href": "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"
      },
      {
        "label": "Google Search Central — Core Web Vitals",
        "href": "https://developers.google.com/search/docs/appearance/core-web-vitals"
      },
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Technical SEO: The Foundation"
  },
  {
    "type": "ul",
    "items": [
      "Core Web Vitals: assess LCP, INP and CLS using real-user field data; keep lab diagnostics separate",
      "Mobile usability: check navigation, reading and checkout on real small screens",
      "HTTPS everywhere — no mixed content warnings",
      "Sitemap.xml submitted to Google Search Console",
      "Crawling and indexing: review robots.txt separately from page noindex directives",
      "Canonical tags on all paginated category pages",
      "Structured data: Product, BreadcrumbList, Organization"
    ]
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "India Speed Reality",
    "text": "Test on slower connections and lower-powered devices as well as your own laptop. Keep field data separate from simulated lab results and investigate the actual largest visible content and interaction delays."
  },
  {
    "type": "h2",
    "text": "On-Page SEO: Category Pages"
  },
  {
    "type": "p",
    "text": "A category page should help shoppers understand the selection and find a suitable product. Use a clear heading, useful descriptive text and distinct metadata. Write what the task requires; no fixed word count or ranking result is promised."
  },
  {
    "type": "h2",
    "text": "On-Page SEO: Product Pages"
  },
  {
    "type": "ul",
    "items": [
      "Unique title: [Product Name] — [Key Feature] | [Brand]",
      "Meta description that includes price and a call to action",
      "H1 matches what people search, not your internal product name",
      "Describe informative images with useful alt text; use empty alt for purely decorative images",
      "Use truthful product markup with matching visible price and availability; include ratings only when genuine and eligible",
      "Write original product information that answers actual buyer questions; do not pad it to meet a word quota"
    ]
  },
  {
    "type": "h2",
    "text": "Local and India-Specific SEO Signals"
  },
  {
    "type": "p",
    "text": "Describe the countries, languages and service areas your business actually supports. Keep contact facts accurate, use genuine language versions and assess Google Business Profile eligibility for the real business; do not invent local offices or assume a domain suffix guarantees visibility."
  },
  {
    "type": "h2",
    "text": "Content SEO: Build a Resources Hub"
  },
  {
    "type": "p",
    "text": "Build guides around genuine customer questions and link them to relevant products or categories. Match the page to the searcher's task and measure useful visits; article length alone does not guarantee rankings or sales."
  }
],
    relatedSlugs: ['d2c-brand-launch-guide', 'email-marketing-ecommerce', 'how-to-start-an-online-store-india'],
  },
  {
    slug: 'how-product-reviews-increase-conversion',
    category: 'ecommerce',
    title: "How Product Reviews Help Shoppers Decide",
    subtitle: "The psychology of social proof — and a practical playbook for collecting more reviews.",
    description: "A practical guide to collecting genuine reviews, answering shopper questions and measuring outcomes without promising a fixed conversion lift.",
    author: "letbuyy-team",
    publishedAt: '2026-04-01',
    updatedAt: "2026-10-30",
    tags: ['reviews', 'social-proof', 'conversion', 'trust'],
    readingTime: 7,
    body: [
  {
    "type": "p",
    "text": "Genuine reviews can help shoppers judge fit, quality and delivery experience. Their effect depends on the product, audience and review quality. This guide does not claim a universal conversion increase or report a verified customer experiment.",
    "references": [
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      },
      {
        "label": "The Complete Store SEO Checklist for Indian Merchants",
        "href": "/resources/ecommerce/store-seo-checklist"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Why Indian Buyers Trust Reviews More Than Ads"
  },
  {
    "type": "p",
    "text": "India has a strong word-of-mouth culture. Before ecommerce, buying decisions were made at the recommendation of neighbors, family, or trusted shopkeepers. Reviews are digital word-of-mouth — and they carry disproportionate weight in categories like fashion, electronics, and cosmetics."
  },
  {
    "type": "h2",
    "text": "The Review Collection Playbook"
  },
  {
    "type": "ol",
    "items": [
      "After delivery, ask consenting customers for an honest review through a supported channel; compare response rates using your own data",
      "Ask for honest feedback without requiring a positive rating; disclose any permitted incentive and follow the platform's review policy",
      "Add a QR code inside your packaging linking to the review page",
      "Respond to every review publicly — shows buyers you're engaged",
      "Feature top reviews in your product images as overlays"
    ]
  },
  {
    "type": "callout",
    "variant": "warning",
    "title": "Never Buy Fake Reviews",
    "text": "Fake reviews erode trust when discovered — and buyers are increasingly sophisticated at spotting them. A single credible bad review responded to well is worth more than ten suspicious 5-star reviews."
  },
  {
    "type": "h2",
    "text": "Display Strategy: Show Reviews Where They Convert"
  },
  {
    "type": "p",
    "text": "Don't just put reviews at the bottom of the page. Surface star ratings near the price, show 2–3 top reviews immediately under the add-to-cart button, and display review counts in search results via structured data."
  },
  {
    "type": "h2",
    "text": "Handling Negative Reviews"
  },
  {
    "type": "p",
    "text": "Publish genuine feedback without manipulating the rating distribution. Respond helpfully to criticism and record how issues were resolved. A particular average rating is not a guarantee of trust or sales."
  }
],
    relatedSlugs: ['product-page-optimization', 'reducing-cart-abandonment', 'retention-strategies-india'],
  },

  // ── GROWTH ────────────────────────────────────────────────────────────────
  {
    slug: 'first-100-orders-guide',
    category: 'growth',
    title: "How to Get Your First 100 Orders",
    subtitle: "A tactical playbook for new Indian D2C brands — no ad budget required.",
    description: "Step-by-step guide to getting your first 100 orders as a new Indian ecommerce brand using organic, WhatsApp, and community channels.",
    author: "letbuyy-team",
    publishedAt: '2026-05-15',
    updatedAt: "2026-10-30",
    tags: ['growth', 'beginners', 'organic', 'whatsapp'],
    readingTime: 10,
    featured: true,
    body: [
  {
    "type": "p",
    "text": "Your first 100 orders are the hardest. Not because the market is saturated — but because you have no social proof, no word-of-mouth, and no algorithm working for you yet. Everything is activation energy. This guide shows you how to build it.",
    "references": [
      {
        "label": "Product Page Optimization: The Complete Guide",
        "href": "/resources/ecommerce/product-page-optimization"
      },
      {
        "label": "Customer Retention Strategies That Work for Indian Brands",
        "href": "/resources/growth/retention-strategies-india"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Why 100 Orders is the Magic Number"
  },
  {
    "type": "p",
    "text": "At 100 orders you have enough data to know: which products actually sell, what your real return rate is, which acquisition channel works for your brand, and what your unit economics look like at small scale. Everything before 100 is hypothesis. After 100, you're operating on evidence."
  },
  {
    "type": "h2",
    "text": "Orders 1–10: Your Personal Network"
  },
  {
    "type": "p",
    "text": "Your first 10 orders should come from people who know you. Not because they're doing you a favor — but because getting them to pay full price validates that your positioning works. If people who like you won't pay for it, strangers definitely won't."
  },
  {
    "type": "ul",
    "items": [
      "Post on your personal Instagram and WhatsApp story with a real story behind the brand",
      "Message 50 people personally (not a broadcast) — explain the product, ask for their honest opinion",
      "Offer an early-supporter discount (15%) to the first 20 buyers — not a freebie, still paid",
      "Ask every buyer to share a photo with the product on their stories"
    ]
  },
  {
    "type": "h2",
    "text": "Orders 10–50: Community and WhatsApp Groups"
  },
  {
    "type": "p",
    "text": "India has the world's most active WhatsApp group ecosystem. Local resident welfare groups, college alumni chats, professional networks, hobby groups — all of them are potential buyers for the right product."
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "WhatsApp Group Outreach",
    "text": "Respect group rules and contribute useful information before sharing a relevant product. Ask for permission where required and measure whether the audience finds the contribution useful."
  },
  {
    "type": "h2",
    "text": "Orders 50–100: Instagram Organic and Influencer Seeding"
  },
  {
    "type": "p",
    "text": "At 50 orders you have enough testimonials and product photos to build social proof. Use them to create Instagram content that answers questions your buyers had before purchasing. This becomes your content strategy."
  },
  {
    "type": "ol",
    "items": [
      "DM 50 micro-influencers (5K–50K followers) in your niche — offer free product, no paid contract",
      "Post 3 times per week: 1 product post, 1 behind-the-scenes, 1 customer story",
      "Use Instagram Stories daily — polls, questions, \"swipe up\" to your product",
      "Reply to every comment within 2 hours for the first 3 months"
    ]
  },
  {
    "type": "h2",
    "text": "Retain the First 100: The Thank You Advantage"
  },
  {
    "type": "p",
    "text": "Your first 100 buyers are your founding community. Treat them like it. A handwritten note in the package, a personal WhatsApp follow-up 5 days post-delivery, a referral incentive before they've moved on — these are low-cost actions with outsized loyalty returns."
  }
],
    relatedSlugs: ['d2c-brand-launch-guide', 'retention-strategies-india', 'how-to-start-an-online-store-india'],
  },
  {
    slug: 'd2c-brand-launch-guide',
    category: 'growth',
    title: "How To Launch a D2C Brand in India (Step by Step)",
    subtitle: "From idea to your first ₹1 lakh in revenue — the D2C playbook for Indian founders.",
    description: "Complete guide to launching a Direct-to-Consumer brand in India: product, brand, store, and go-to-market strategy.",
    author: "letbuyy-team",
    publishedAt: '2026-04-10',
    updatedAt: "2026-10-30",
    tags: ['d2c', 'brand', 'launch', 'india'],
    readingTime: 14,
    body: [
  {
    "type": "p",
    "text": "India minted over 200 new D2C brands every month in 2025. The ones that survive share one trait: they went deep on a specific customer before going broad on the market. This guide shows you how.",
    "references": [
      {
        "label": "Product Page Optimization: The Complete Guide",
        "href": "/resources/ecommerce/product-page-optimization"
      },
      {
        "label": "Customer Retention Strategies That Work for Indian Brands",
        "href": "/resources/growth/retention-strategies-india"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Phase 1: Find Your Niche (Weeks 1–2)"
  },
  {
    "type": "p",
    "text": "The best Indian D2C brands in the last 5 years didn't try to be Mamaearth from day one. They started hyper-specific: only hair care for women with curly hair, only ghee sourced from Gir cows, only sneakers for people with wide feet."
  },
  {
    "type": "callout",
    "variant": "info",
    "title": "India Niche Opportunity",
    "text": "Validate a reachable customer group through interviews, demand signals and realistic costs. A large population estimate does not establish demand or guarantee revenue for your brand."
  },
  {
    "type": "h2",
    "text": "Phase 2: Build Your Brand Identity (Weeks 2–4)"
  },
  {
    "type": "p",
    "text": "Your brand is not your logo. It's the answer to: \"Why should I buy this from you instead of Amazon?\" For Indian D2C, the most powerful answers are: made in India (regional pride), direct from the maker (authenticity), better quality for less (value), or cause-driven (sustainability, artisan support)."
  },
  {
    "type": "h2",
    "text": "Phase 3: Source and Package Your Product (Weeks 4–8)"
  },
  {
    "type": "p",
    "text": "India has world-class manufacturing in textiles, ceramics, leather, pharma ingredients, and agricultural products — most of it underbranded. Your product sourcing strategy and packaging quality will determine your perceived value ceiling."
  },
  {
    "type": "ul",
    "items": [
      "Use IndiaMART and TradeIndia to find manufacturers",
      "Order samples from 3–5 suppliers and compare quality rigorously",
      "Invest in packaging before marketing — unboxing photos sell",
      "Get a FSSAI license for food products, BIS for electronics"
    ]
  },
  {
    "type": "h2",
    "text": "Phase 4: Launch Strategy (Week 8)"
  },
  {
    "type": "p",
    "text": "Your launch is not a one-day event. It's a 30-day campaign with three stages: teaser (build anticipation), launch (drive first purchases), and amplification (turn buyers into advocates)."
  },
  {
    "type": "h2",
    "text": "Financial Targets for Your First Year"
  },
  {
    "type": "table",
    "headers": [
      "Month",
      "Revenue Target",
      "Orders",
      "Key Focus"
    ],
    "rows": [
      [
        "1–2",
        "₹25,000",
        "10–30",
        "Validation"
      ],
      [
        "3–4",
        "₹75,000",
        "50–100",
        "Product-Market Fit"
      ],
      [
        "5–8",
        "₹2,00,000",
        "200–300",
        "Growth Channels"
      ],
      [
        "9–12",
        "₹5,00,000+",
        "500+",
        "Retention & Ops"
      ]
    ]
  }
],
    relatedSlugs: ['first-100-orders-guide', 'how-to-start-an-online-store-india', 'retention-strategies-india'],
  },
  {
    slug: 'email-marketing-ecommerce',
    category: 'growth',
    title: "Email Marketing for Ecommerce: Building Your List in India",
    subtitle: "Email delivers ₹42 back for every ₹1 spent. Here's how to capture and convert.",
    description: "How to build and monetize an email list for your Indian ecommerce store — from capture to automated flows.",
    author: "letbuyy-team",
    publishedAt: '2026-03-28',
    updatedAt: "2026-10-30",
    tags: ['email', 'marketing', 'automation', 'list-building'],
    readingTime: 9,
    body: [
  {
    "type": "p",
    "text": "WhatsApp gets more attention in Indian marketing circles, but email is still the highest-ROI channel for ecommerce — globally and in India. The key is building a quality list, not a large one.",
    "references": [
      {
        "label": "Product Page Optimization: The Complete Guide",
        "href": "/resources/ecommerce/product-page-optimization"
      },
      {
        "label": "Customer Retention Strategies That Work for Indian Brands",
        "href": "/resources/growth/retention-strategies-india"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Why Email Still Wins"
  },
  {
    "type": "p",
    "text": "WhatsApp has higher open rates but strict message limits and anti-spam enforcement. Email has: no per-message cost at scale, full design control, inbox deliverability signals you can optimize, and a direct channel you own (unlike social media algorithms)."
  },
  {
    "type": "h2",
    "text": "Building Your List: 5 High-Converting Entry Points"
  },
  {
    "type": "ol",
    "items": [
      "Exit-intent popup with a first-order discount (10–15%)",
      "Post-purchase email capture for warranty or order updates",
      "Contests and giveaways (email required to enter)",
      "Lead magnet: Free sizing guide, care guide, or recipe book",
      "Referral program: \"Share your referral link, earn store credit\""
    ]
  },
  {
    "type": "h2",
    "text": "The 5 Essential Email Flows"
  },
  {
    "type": "h3",
    "text": "1. Welcome Flow (Day 0, 2, 5)"
  },
  {
    "type": "p",
    "text": "Your welcome sequence is your highest-engagement window. Day 0: brand story + your best product. Day 2: social proof + reviews. Day 5: a special first-order offer."
  },
  {
    "type": "h3",
    "text": "2. Abandoned Cart Flow (1hr, 4hr, 24hr)"
  },
  {
    "type": "p",
    "text": "Test a short, consent-based reminder sequence that answers questions and explains any genuine offer. Compare recovered orders and unsubscribe rates; no fixed recovery result is promised."
  },
  {
    "type": "h3",
    "text": "3. Post-Purchase Flow (Day 1, 5, 14)"
  },
  {
    "type": "p",
    "text": "Day 1: order confirmation with tracking. Day 5: check-in, ask for feedback. Day 14: review request + cross-sell recommendation."
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "GST Invoice in Email",
    "text": "Confirm whether invoice generation and email delivery are configured for the relevant order. Do not promise an invoice attachment or claim tax-credit eligibility from an email alone. Review tax requirements with a qualified adviser."
  }
],
    relatedSlugs: ['retention-strategies-india', 'social-commerce-india', 'first-100-orders-guide'],
  },
  {
    slug: 'social-commerce-india',
    category: 'growth',
    title: "Social Commerce in India: Instagram, WhatsApp & Beyond",
    subtitle: "How Indian brands are turning social platforms into their highest-converting sales channels.",
    description: "Guide to social commerce in India — Instagram Shopping, WhatsApp Business, and building a social-first ecommerce strategy.",
    author: "letbuyy-team",
    publishedAt: '2026-04-18',
    updatedAt: "2026-10-30",
    tags: ['social-media', 'instagram', 'whatsapp', 'social-commerce'],
    readingTime: 11,
    body: [
  {
    "type": "p",
    "text": "Find the channels your actual customers use. Test discovery, consent-based follow-up and support journeys separately; a platform's audience size is not evidence of demand for your product.",
    "references": [
      {
        "label": "Product Page Optimization: The Complete Guide",
        "href": "/resources/ecommerce/product-page-optimization"
      },
      {
        "label": "Customer Retention Strategies That Work for Indian Brands",
        "href": "/resources/growth/retention-strategies-india"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Instagram Shopping: Setup and Strategy"
  },
  {
    "type": "p",
    "text": "Instagram Shopping lets you tag products directly in posts and Reels, creating a seamless path from discovery to purchase. Setup requires: Facebook Business Manager, a product catalogue, and approval from Meta."
  },
  {
    "type": "p",
    "text": "If you use Meta commerce tools, check their current country, account and catalog eligibility directly. This guide does not establish a one-click LetBuyy catalog sync or promise Instagram Shopping access. Use accurate product links and respect platform policies."
  },
  {
    "type": "h2",
    "text": "WhatsApp Business: Your Direct Sales Channel"
  },
  {
    "type": "p",
    "text": "Check current WhatsApp Business and provider capabilities before planning a messaging journey. Obtain the required consent, provide an opt-out and measure outcomes rather than assuming a universal open rate."
  },
  {
    "type": "callout",
    "variant": "info",
    "title": "WhatsApp Commerce",
    "text": "LetBuyy messaging availability depends on the supported workflow, account setup and provider approval. Confirm those prerequisites before promising an in-WhatsApp task to customers."
  },
  {
    "type": "h2",
    "text": "Content Strategy That Converts"
  },
  {
    "type": "ul",
    "items": [
      "Before/after content: before using your product vs. after",
      "Founder story content: why you started the brand",
      "Process content: how your product is made (builds premium perception)",
      "Customer story content: real buyer testimonials with permission",
      "Trend content: your product angle on a trending topic or sound"
    ]
  }
],
    relatedSlugs: ['email-marketing-ecommerce', 'first-100-orders-guide', 'd2c-brand-launch-guide'],
  },
  {
    slug: 'retention-strategies-india',
    category: 'growth',
    title: "Customer Retention Strategies That Work for Indian Brands",
    subtitle: "Build useful post-purchase journeys and measure repeat buying in your own store.",
    description: "Proven customer retention strategies for Indian ecommerce — loyalty programs, re-engagement, and lifetime value optimization.",
    author: "letbuyy-team",
    publishedAt: '2026-05-05',
    updatedAt: "2026-10-30",
    tags: ['retention', 'loyalty', 'ltv', 'repeat-purchase'],
    readingTime: 8,
    body: [
  {
    "type": "p",
    "text": "Review how repeat purchases, acquisition costs and margins differ across your customer groups. Allocate retention effort using your own evidence rather than a universal spending ratio.",
    "references": [
      {
        "label": "Product Page Optimization: The Complete Guide",
        "href": "/resources/ecommerce/product-page-optimization"
      }
    ]
  },
  {
    "type": "h2",
    "text": "The Retention Funnel: Three Stages"
  },
  {
    "type": "p",
    "text": "Retention isn't a single action — it's a funnel: Activation (did the customer have a great first experience?), Habit formation (did they buy again within 90 days?), Advocacy (did they refer someone?)."
  },
  {
    "type": "h2",
    "text": "Loyalty Programs That Actually Work in India"
  },
  {
    "type": "p",
    "text": "Points programs work when the reward is tangible and the earning is simple. The fatal mistake: making points worth ₹0.01 each so a buyer needs 100 orders to earn anything meaningful. Set your redemption rate so a typical order earns something usable in 2–3 purchases."
  },
  {
    "type": "h2",
    "text": "Re-engagement: Winning Back Lapsed Buyers"
  },
  {
    "type": "ol",
    "items": [
      "Identify customers who haven't purchased in 90+ days",
      "Send a \"We miss you\" WhatsApp with a personalized discount (15%)",
      "Follow up with email showing new products since their last purchase",
      "Final effort: \"Your discount expires in 48 hours\" — creates urgency"
    ]
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "The 90-Day Window",
    "text": "Repeat-purchase timing varies by product and customer. Use cohort data to choose a respectful re-engagement window rather than treating an uncited churn probability as a rule."
  },
  {
    "type": "h2",
    "text": "The Referral Engine"
  },
  {
    "type": "p",
    "text": "If you test referrals, define eligibility, costs and abuse controls clearly. Compare incremental orders and margins with a suitable baseline; referral results are not guaranteed."
  }
],
    relatedSlugs: ['email-marketing-ecommerce', 'first-100-orders-guide', 'how-product-reviews-increase-conversion'],
  },

  // ── PAYMENTS ──────────────────────────────────────────────────────────────
  {
    slug: 'upi-vs-cod-india',
    category: 'payments',
    title: "UPI vs COD: Which Payment Method Wins for Indian Stores",
    subtitle: "The data on India's two dominant payment methods — and how to optimize both.",
    description: "In-depth comparison of UPI and Cash on Delivery for Indian ecommerce stores — conversion rates, return rates, and revenue impact.",
    author: "letbuyy-team",
    publishedAt: '2026-04-05',
    updatedAt: "2026-10-30",
    tags: ['payments', 'upi', 'cod', 'india'],
    readingTime: 9,
    featured: true,
    body: [
  {
    "type": "p",
    "text": "No payment debate is more Indian than UPI vs COD. Both are distinctly India-first. Both are essential. And most brands get the balance wrong.",
    "references": [
      {
        "label": "Accepting Payments on LetBuyy: UPI, Cards, and COD",
        "href": "/resources/payments/razorpay-integration-guide"
      },
      {
        "label": "GST Planning for Ecommerce Sellers in India",
        "href": "/resources/payments/gst-for-ecommerce-india"
      }
    ]
  },
  {
    "type": "h2",
    "text": "The State of Indian Payments in 2026"
  },
  {
    "type": "table",
    "headers": [
      "Method",
      "Your Payment Mix",
      "Your Order Value",
      "Your RTO / Returns",
      "Best For"
    ],
    "rows": [
      [
        "UPI",
        "Measure",
        "Measure in your store",
        "Measure",
        "Confirm provider eligibility"
      ],
      [
        "COD",
        "Track",
        "Measure in your store",
        "Measure",
        "Check delivery coverage"
      ],
      [
        "Cards",
        "Compare",
        "Measure in your store",
        "Measure",
        "Confirm supported cards"
      ],
      [
        "Wallets",
        "Track",
        "Measure in your store",
        "Measure",
        "Confirm supported wallets"
      ]
    ]
  },
  {
    "type": "h2",
    "text": "UPI: The Dominant Force"
  },
  {
    "type": "p",
    "text": "UPI is a payment method, not a guarantee of successful checkout or immediate merchant settlement. Payments can fail or remain pending; confirm final status through the provider and check the applicable charges and settlement terms for your account.",
    "references": [
      {
        "label": "Razorpay — settlement prerequisites and cycles",
        "href": "https://razorpay.com/docs/payments/settlements/"
      }
    ]
  },
  {
    "type": "callout",
    "variant": "info",
    "title": "UPI Deep Links",
    "text": "Where supported, UPI intent can open a payment app from checkout. Test your supported devices, return flow and provider confirmation; this guide does not claim a measured reduction in drop-off."
  },
  {
    "type": "h2",
    "text": "COD: The Trust Bridge"
  },
  {
    "type": "p",
    "text": "COD exists because trust in online stores takes time to build. First-time buyers, buyers in markets with weak digital financial infrastructure, and high-value fashion buyers who need to \"see before they pay\" all depend on COD. The return rate is real — but so is the revenue."
  },
  {
    "type": "h2",
    "text": "Reducing COD Return Rates"
  },
  {
    "type": "ul",
    "items": [
      "Require phone number verification (OTP) for COD orders above ₹1,000",
      "Review COD eligibility using sufficient delivery history and clear published restrictions",
      "Where supported and consented, request a pre-delivery confirmation and measure its actual effect",
      "Charge a ₹50–100 COD convenience fee for orders under ₹500",
      "Use NDR automation to reattempt delivery within 24 hours"
    ]
  },
  {
    "type": "h2",
    "text": "The Optimal Payment Mix Strategy"
  },
  {
    "type": "p",
    "text": "Choose payment options using customer needs, provider eligibility and measured costs. Explain genuine incentives clearly, and compare payment confirmation, settlement, RTO and customer returns as separate outcomes."
  }
],
    relatedSlugs: ['gst-for-ecommerce-india', 'invoicing-india-merchants', 'how-to-start-an-online-store-india'],
  },
  {
    slug: 'gst-for-ecommerce-india',
    category: 'payments',
    title: "GST Planning for Ecommerce Sellers in India",
    subtitle: "A checklist for checking registration, tax classification, records and filing obligations.",
    description: "Plan the GST questions to verify for your online business using official sources and a qualified adviser, without applying blanket thresholds or old rate tables.",
    author: "letbuyy-team",
    publishedAt: '2026-03-01',
    updatedAt: "2026-10-30",
    tags: ['gst', 'tax', 'compliance', 'india'],
    readingTime: 13,
    body: [
  {
    "type": "p",
    "text": "GST obligations depend on what you supply, where you operate and how you sell. Use this checklist to gather facts and check the applicable rules; it is not a complete tax determination for your business.",
    "references": [
      {
        "label": "Accepting Payments on LetBuyy: UPI, Cards, and COD",
        "href": "/resources/payments/razorpay-integration-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Check registration before accepting orders"
  },
  {
    "type": "p",
    "text": "Record your goods or services, aggregate turnover, state or union territory, interstate activity and sales channels. Do not assume that every ecommerce seller has the same registration threshold. Notification 34/2023 describes a conditional exemption for certain goods suppliers through ecommerce operators; confirm all conditions and current amendments with your adviser.",
    "references": [
      {
        "label": "GST notification 34/2023 — conditions and commencement",
        "href": "https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-34-2023.pdf"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Verify classification and the applicable rate"
  },
  {
    "type": "p",
    "text": "Identify the correct HSN or SAC classification, product description, value and effective supply date. Look up the applicable notification and amendments instead of using a generic apparel, footwear or electronics rate table. Retain the source used for each product's tax configuration.",
    "references": [
      {
        "label": "GST portal — current taxpayer services",
        "href": "https://www.gst.gov.in/"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Check marketplace TCS separately"
  },
  {
    "type": "p",
    "text": "Establish whether the selling arrangement involves an ecommerce operator required to collect TCS. The government documented a TCS rate reduction in 2024, so an old blanket 1% instruction should not be reused. Verify the currently applicable rate, taxable base and reconciliation process for your arrangement using official records.",
    "references": [
      {
        "label": "Ministry of Finance — 2024 TCS rate change",
        "href": "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087659&lang=2&reg=48"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Keep invoice and return records"
  },
  {
    "type": "p",
    "text": "Use your applicable invoice requirements and filing scheme to prepare records, then check current due dates on the GST portal. Input tax credit, e-invoicing and return frequency have conditions; do not treat a software-generated invoice or a fixed monthly date as proof that your obligations are satisfied.",
    "references": [
      {
        "label": "GST portal — GSTR-2A and TCS records",
        "href": "https://tutorial.gst.gov.in/userguide/returns/GSTR_2A.htm"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Document your review"
  },
  {
    "type": "p",
    "text": "Keep the business facts, official source, effective date and advice used for each decision. Recheck when products, states, sales channels or rules change. This editorial correction does not claim a chartered accountant or legal review has taken place."
  }
],
    relatedSlugs: ['invoicing-india-merchants', 'upi-vs-cod-india', 'how-to-start-an-online-store-india'],
  },
  {
    slug: 'invoicing-india-merchants',
    category: 'payments',
    title: "GST Invoices for Indian Ecommerce: What Must Be Included",
    subtitle: "Every field, every format, every rule — so your invoices are always compliant.",
    description: "Complete guide to GST invoice requirements for Indian ecommerce merchants — mandatory fields, formats, and automation.",
    author: "letbuyy-team",
    publishedAt: '2026-02-20',
    updatedAt: "2026-10-30",
    tags: ['invoicing', 'gst', 'compliance', 'b2b'],
    readingTime: 7,
    body: [
  {
    "type": "p",
    "text": "The invoice you need depends on your registration, supply and transaction. Check the applicable requirements and your actual billing records with a qualified adviser; software output is not a universal compliance guarantee.",
    "references": [
      {
        "label": "Accepting Payments on LetBuyy: UPI, Cards, and COD",
        "href": "/resources/payments/razorpay-integration-guide"
      },
      {
        "label": "GST Planning for Ecommerce Sellers in India",
        "href": "/resources/payments/gst-for-ecommerce-india"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Mandatory Fields on a GST Invoice"
  },
  {
    "type": "ul",
    "items": [
      "Your business name, address, and GSTIN",
      "Invoice number (consecutive, unique, reset yearly)",
      "Invoice date",
      "Buyer's name, address, and GSTIN (for B2B)",
      "Place of supply (state)",
      "HSN/SAC code for each item",
      "Item description, quantity, and unit",
      "Taxable value per item",
      "GST rate (CGST+SGST for intra-state, IGST for inter-state)",
      "GST amount per item and total",
      "Total invoice amount in words"
    ]
  },
  {
    "type": "callout",
    "variant": "info",
    "title": "LetBuyy Auto-Invoicing",
    "text": "Configure your business and product tax details accurately, then check generated invoices against the requirements that apply to your transactions. Software output alone is not a compliance guarantee; confirm which delivery and export features are enabled for your account."
  },
  {
    "type": "h2",
    "text": "HSN Codes: Getting Them Right"
  },
  {
    "type": "p",
    "text": "Use the official GST portal and qualified advice to identify the classification for the actual goods or service. A broad product category or a software suggestion does not establish the correct HSN/SAC code or tax treatment."
  },
  {
    "type": "h2",
    "text": "E-Invoice Mandate"
  },
  {
    "type": "p",
    "text": "E-invoicing applicability depends on the current rules, transaction type and exemptions. Verify your obligations with the official portal and a qualified adviser. Do not assume that a LetBuyy-generated invoice has been registered with an IRP."
  }
],
    relatedSlugs: ['gst-for-ecommerce-india', 'upi-vs-cod-india', 'refunds-returns-policy-india'],
  },
  {
    slug: 'refunds-returns-policy-india',
    category: 'payments',
    title: "Building a Customer-Friendly Returns Policy for India",
    subtitle: "The right returns policy builds trust and reduces RTO — without killing your margins.",
    description: "How to write and implement a returns and refunds policy for Indian ecommerce that builds trust and manages costs.",
    author: "letbuyy-team",
    publishedAt: '2026-03-20',
    updatedAt: "2026-10-30",
    tags: ['returns', 'refunds', 'policy', 'customer-service'],
    readingTime: 8,
    body: [
  {
    "type": "p",
    "text": "A clear returns policy helps buyers understand the conditions before purchase. Explain eligibility, process and timing accurately; measure its effect on your own store without promising a conversion increase.",
    "references": [
      {
        "label": "Accepting Payments on LetBuyy: UPI, Cards, and COD",
        "href": "/resources/payments/razorpay-integration-guide"
      },
      {
        "label": "GST Planning for Ecommerce Sellers in India",
        "href": "/resources/payments/gst-for-ecommerce-india"
      }
    ]
  },
  {
    "type": "h2",
    "text": "What Indian Buyers Expect"
  },
  {
    "type": "ul",
    "items": [
      "7–14 day return window (14 days is competitive advantage)",
      "Free return pickup for damaged or wrong items",
      "Exchange option, not just refund",
      "Refund timeline clearly stated (7–10 working days)",
      "No questions asked for size issues in fashion"
    ]
  },
  {
    "type": "h2",
    "text": "Writing Your Policy"
  },
  {
    "type": "p",
    "text": "Write your policy in plain Hindi and English. Avoid legal jargon. Use simple language: \"If you don't love it, here's how to send it back.\" Include: what is eligible for return, what isn't, how to initiate a return, the timeline, and how the refund is issued."
  },
  {
    "type": "h2",
    "text": "Managing Return Costs"
  },
  {
    "type": "ul",
    "items": [
      "Charge a small handling fee (₹50–100) for non-defective returns",
      "Require photo evidence for damage claims before approving pickup",
      "Offer store credit at 110% value as alternative to refund",
      "Block serial returners from COD (high correlation with RTO)"
    ]
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "Quality Photography Reduces Returns",
    "text": "Accurate photos, size guidance and product descriptions can reduce uncertainty. Classify your actual return reasons before deciding which content to improve."
  }
],
    relatedSlugs: ['upi-vs-cod-india', 'invoicing-india-merchants', 'gst-for-ecommerce-india'],
  },
  {
    slug: 'razorpay-integration-guide',
    category: 'payments',
    title: "Accepting Payments on LetBuyy: UPI, Cards, and COD",
    subtitle: "Plan buyer payment setup, provider approvals and test-mode verification. Merchant subscription billing is a separate flow.",
    description: "Plan buyer payment setup, provider approvals and test-mode verification. Merchant subscription billing is a separate flow.",
    author: "letbuyy-team",
    publishedAt: '2026-04-25',
    updatedAt: "2026-10-30",
    tags: ['payments', 'razorpay', 'upi', 'setup'],
    readingTime: 7,
    body: [
  {
    "type": "p",
    "text": "Open Settings → Payments for buyer payment setup. Merchant subscription billing is separate under Money/Billing and plan selection. Use valid provider test credentials first; only switch to live service after its prerequisites and end-to-end checks are complete.",
    "references": [
      {
        "label": "GST Planning for Ecommerce Sellers in India",
        "href": "/resources/payments/gst-for-ecommerce-india"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Step 1: Create Your Razorpay Account"
  },
  {
    "type": "p",
    "text": "Obtain the provider account and approvals that apply to your business. Test and live API keys are separate; a key prefix alone does not prove that credentials work or that a live payment method is enabled. Never publish the secret key."
  },
  {
    "type": "h2",
    "text": "Step 2: Connect Razorpay to LetBuyy"
  },
  {
    "type": "p",
    "text": "In Settings → Payments, review online-payment and COD controls, saved account connection and provider mode. Verify the connection before testing buyer checkout. Provider account approval, payment methods and processing times are controlled by the provider."
  },
  {
    "type": "h2",
    "text": "Webhook Security"
  },
  {
    "type": "p",
    "text": "Complete an official test-mode Checkout payment and check server-verified status, amount and order identity. Invalid signatures and duplicate callbacks must not activate value. A mocked success callback or sandbox badge alone is not an actual provider test."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['upi-vs-cod-india', 'gst-for-ecommerce-india', 'how-to-start-an-online-store-india'],
  },

  // ── OPERATIONS ────────────────────────────────────────────────────────────
  {
    slug: 'inventory-management-guide',
    category: 'operations',
    title: "Inventory Management: From Chaos to Control",
    subtitle: "Stop running out of bestsellers and overstocking slow-movers.",
    description: "Practical inventory management guide for Indian ecommerce — reorder points, safety stock, ABC analysis, and multi-location strategy.",
    author: "letbuyy-team",
    publishedAt: '2026-04-12',
    updatedAt: "2026-10-30",
    tags: ['inventory', 'operations', 'warehouse', 'stock'],
    readingTime: 10,
    featured: true,
    body: [
  {
    "type": "p",
    "text": "Running out of your bestseller during a sale event is the most expensive mistake in ecommerce operations. Overstocking a seasonal item is the second most expensive. Inventory management is the art of avoiding both.",
    "references": [
      {
        "label": "Order Fulfillment: Processing 100 Orders Per Day Efficiently",
        "href": "/resources/operations/order-fulfillment-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "ABC Analysis: Know Your Inventory Hierarchy"
  },
  {
    "type": "p",
    "text": "ABC analysis groups products by their contribution to your business. Choose cutoffs using your own sales, margin and stockout data; the groups do not need to follow a fixed percentage split."
  },
  {
    "type": "h2",
    "text": "Setting Reorder Points"
  },
  {
    "type": "p",
    "text": "A reorder point is the stock level at which you automatically place a replenishment order. Formula: Reorder Point = (Average Daily Sales × Lead Time in Days) + Safety Stock."
  },
  {
    "type": "callout",
    "variant": "info",
    "title": "Example",
    "text": "You sell 20 units per day of a product. Your supplier takes 7 days to deliver. Safety stock = 3 days × 20 = 60 units. Reorder Point = (20 × 7) + 60 = 200 units. Order when you hit 200 units remaining."
  },
  {
    "type": "h2",
    "text": "Safety Stock: Your Buffer Against Uncertainty"
  },
  {
    "type": "p",
    "text": "Safety stock protects against demand spikes and supplier delays. For Indian supply chains — where courier delays and supplier stock-outs are common — maintain 3–7 days of safety stock for A-items."
  },
  {
    "type": "h2",
    "text": "Dead Stock: The Hidden Cost"
  },
  {
    "type": "p",
    "text": "Dead stock (inventory that hasn't moved in 90+ days) ties up capital and takes up warehouse space. Analyze your slow-movers quarterly and use bundles, discounts, or flash sales to liquidate. Better a ₹100 loss now than ₹500 in storage and eventual obsolescence."
  },
  {
    "type": "h2",
    "text": "Multi-Location Inventory"
  },
  {
    "type": "p",
    "text": "Once you're shipping more than 200 orders per day, consider splitting inventory between North (Delhi NCR), West (Mumbai), and South (Bengaluru/Hyderabad). Proximity to buyers reduces delivery time, cuts shipping costs, and improves customer experience."
  },
  {
    "type": "p",
    "text": "LetBuyy has location and stock-management screens. Check your plan limits and available fulfillment controls; unlimited locations and automatic nearest-warehouse routing are not promised."
  }
],
    relatedSlugs: ['order-fulfillment-guide', 'multi-warehouse-inventory', 'shipping-india-guide'],
  },
  {
    slug: 'order-fulfillment-guide',
    category: 'operations',
    title: "Order Fulfillment: Processing 100 Orders Per Day Efficiently",
    subtitle: "The operations playbook for scaling from 10 to 1,000 orders per day.",
    description: "How to set up efficient order fulfillment operations for your Indian ecommerce store — packing, labeling, courier integration, and tracking.",
    author: "letbuyy-team",
    publishedAt: '2026-03-25',
    updatedAt: "2026-10-30",
    tags: ['fulfillment', 'orders', 'operations', 'scaling'],
    readingTime: 9,
    body: [
  {
    "type": "p",
    "text": "The difference between a hobby store and a real business is operational consistency. Buyers forgive one bad experience. Repeat bad experiences end brands. Order fulfillment is where your brand promise meets operational reality.",
    "references": [
      {
        "label": "Inventory Management: From Chaos to Control",
        "href": "/resources/operations/inventory-management-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "The Fulfillment Workflow"
  },
  {
    "type": "ol",
    "items": [
      "Order received and payment confirmed (auto)",
      "Order routed to fulfillment location (auto)",
      "Pick: staff picks item from warehouse shelf",
      "Pack: item packaged with invoice, inserts, branding",
      "Label: shipping label generated and applied",
      "Dispatch: handed to courier for pickup or dropped at facility",
      "Track: AWB updated in system, customer notified via WhatsApp/email"
    ]
  },
  {
    "type": "h2",
    "text": "Packing Station Setup"
  },
  {
    "type": "p",
    "text": "Organize packing materials around the products you ship. Measure packing time and errors in your own operation before changing tools or layouts; no universal time saving is established."
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "Batch Processing",
    "text": "Consider batching labels, picking and packing around courier pickups. Measure time per order and error rates before adopting a batch size; the gain depends on your operation."
  },
  {
    "type": "h2",
    "text": "Courier Integration"
  },
  {
    "type": "p",
    "text": "Shipping-provider setup is separate from order confirmation. Check the configured courier, serviceable destination, shipment details and returned label or tracking status. A saved order does not establish that a carrier booking or customer message succeeded."
  },
  {
    "type": "h2",
    "text": "SLA Targets by Scale"
  },
  {
    "type": "p",
    "text": "Set a dispatch target using stock availability, pickup times, staffing and your published delivery promise. Measure actual outcomes and exceptions; no order-volume band determines a universal team size or dispatch SLA."
  }
],
    relatedSlugs: ['inventory-management-guide', 'shipping-india-guide', 'multi-warehouse-inventory'],
  },
  {
    slug: 'shipping-india-guide',
    category: 'operations',
    title: "Shipping in India: Pincode Coverage, Rates & Couriers",
    subtitle: "Compare shipment quotes, serviceability and return costs for your actual delivery needs.",
    description: "Compare shipment quotes, serviceability and return costs for your actual delivery needs.",
    author: "letbuyy-team",
    publishedAt: '2026-04-28',
    updatedAt: "2026-10-30",
    tags: ['shipping', 'logistics', 'courier', 'india'],
    readingTime: 11,
    body: [
  {
    "type": "p",
    "text": "Check courier serviceability for the PIN codes your customers use. Coverage changes by carrier, service and shipment type; a national PIN-code count does not establish your reachable market.",
    "references": [
      {
        "label": "Inventory Management: From Chaos to Control",
        "href": "/resources/operations/inventory-management-guide"
      },
      {
        "label": "Order Fulfillment: Processing 100 Orders Per Day Efficiently",
        "href": "/resources/operations/order-fulfillment-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Courier Comparison"
  },
  {
    "type": "p",
    "text": "Compare actual courier quotes, serviceable PIN codes, pickup options, insurance, tracking and return costs for your shipments. No courier is universally cheapest or best for a revenue band."
  },
  {
    "type": "h2",
    "text": "Rate Negotiation"
  },
  {
    "type": "p",
    "text": "Request comparable courier quotes for your shipment mix. Compare weight rules, remote-area charges, COD fees and return costs; a negotiated discount is not guaranteed at any shipment volume."
  },
  {
    "type": "h2",
    "text": "Weight Slabs and Volumetric Weight"
  },
  {
    "type": "callout",
    "variant": "warning",
    "title": "Volumetric Weight Billing",
    "text": "Confirm the courier contract for actual and volumetric weight, dimensional divisor, rounding and surcharges. Measure the packed parcel; do not assume every carrier uses one billing formula."
  },
  {
    "type": "h2",
    "text": "Tracking and NDR Automation"
  },
  {
    "type": "p",
    "text": "Non-Delivery Reports (NDR) occur when a delivery attempt fails. Without follow-up, NDRs become RTOs (return to origin) — you've paid shipping both ways with zero revenue. Automate NDR follow-up: WhatsApp message within 2 hours of failed delivery, offering to reschedule."
  }
],
    relatedSlugs: ['inventory-management-guide', 'order-fulfillment-guide', 'understanding-fulfillment'],
  },
  {
    slug: 'multi-warehouse-inventory',
    category: 'operations',
    title: "Multi-Warehouse Inventory Management",
    subtitle: "Evaluate warehouse locations using delivery demand, costs and operational complexity.",
    description: "How to set up multi-warehouse inventory for your Indian ecommerce store — zone allocation, stock transfers, and fulfillment routing.",
    author: "letbuyy-team",
    publishedAt: '2026-05-20',
    updatedAt: "2026-10-30",
    tags: ['inventory', 'warehouse', 'multi-location', 'operations'],
    readingTime: 8,
    body: [
  {
    "type": "p",
    "text": "A nearby warehouse may shorten some routes, but transit times depend on serviceability, stock and courier commitments. Model costs and demand before adding another location; no delivery-time reduction is guaranteed.",
    "references": [
      {
        "label": "Inventory Management: From Chaos to Control",
        "href": "/resources/operations/inventory-management-guide"
      },
      {
        "label": "Order Fulfillment: Processing 100 Orders Per Day Efficiently",
        "href": "/resources/operations/order-fulfillment-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "When to Go Multi-Warehouse"
  },
  {
    "type": "ul",
    "items": [
      "More than 200 daily orders",
      "Significant sales from more than one region",
      "Average transit time above 4 days to major cities",
      "Shipping costs that materially reduce your own order margin"
    ]
  },
  {
    "type": "h2",
    "text": "Zone Strategy for India"
  },
  {
    "type": "p",
    "text": "India's logistics network divides naturally into 4 zones. Start with 2 warehouses (North + South), then add West. North warehouse serves Delhi, UP, Rajasthan, Haryana, Punjab. South serves Karnataka, Tamil Nadu, Andhra, Kerala. West serves Maharashtra, Gujarat, Goa."
  },
  {
    "type": "h2",
    "text": "Stock Allocation by Zone"
  },
  {
    "type": "p",
    "text": "Analyze 90 days of orders by delivery state. Allocate stock proportionally: if 35% of orders go to North, keep 35% of A-item inventory there. Rebalance quarterly based on actual sales data."
  },
  {
    "type": "callout",
    "variant": "info",
    "title": "LetBuyy Multi-Location",
    "text": "LetBuyy has location and stock-management screens. Check your plan limits and available fulfillment controls; unlimited locations and automatic nearest-warehouse routing are not promised."
  },
  {
    "type": "h2",
    "text": "Inter-Warehouse Transfers"
  },
  {
    "type": "p",
    "text": "Use Purchasing → Transfers for the supported transfer workflow. Record the source, destination, quantities and receipt; verify both stock records after completion instead of assuming an immediate two-location update."
  }
],
    relatedSlugs: ['inventory-management-guide', 'order-fulfillment-guide', 'shipping-india-guide'],
  },
  {
    slug: 'understanding-fulfillment',
    category: 'operations',
    title: "Understanding Ecommerce Fulfillment in India",
    subtitle: "Self-fulfillment, 3PL, or marketplace fulfillment — which is right for your brand?",
    description: "Overview of ecommerce fulfillment models for Indian brands — self-fulfillment, third-party logistics (3PL), and FBA/FBF comparison.",
    author: "letbuyy-team",
    publishedAt: '2026-03-10',
    updatedAt: "2026-11-03",
    tags: ['fulfillment', '3pl', 'logistics', 'operations'],
    readingTime: 9,
    body: [
  {
    "type": "p",
    "text": "How you fulfill orders affects your delivery time, your cost structure, your brand experience, and how much time you spend on operations vs. growth. The right model depends on your volume, your product type, and your growth stage.",
    "references": [
      {
        "label": "Inventory Management: From Chaos to Control",
        "href": "/resources/operations/inventory-management-guide"
      },
      {
        "label": "Order Fulfillment: Processing 100 Orders Per Day Efficiently",
        "href": "/resources/operations/order-fulfillment-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Model 1: Self-Fulfillment (0–500 orders/month)"
  },
  {
    "type": "p",
    "text": "You pack and ship from your own space — home, office, or rented warehouse. Lowest cost, most control over brand experience. Ceiling: typically 500 orders/month before it consumes too much founder time."
  },
  {
    "type": "h2",
    "text": "Model 2: Third-Party Logistics / 3PL (200–5,000 orders/month)"
  },
  {
    "type": "p",
    "text": "A 3PL warehouses your inventory, picks, packs, and ships on your behalf. You integrate with their system, send a PO when stock is low, and pay per-order fulfillment fees. Indian 3PLs include Shiprocket Fulfillment, WareIQ, and Loadshare."
  },
  {
    "type": "p",
    "text": "Compare quotes for your actual storage, picking, packing, delivery and return needs. Include your own labor and overhead when evaluating self-fulfillment. No universal per-order price is established here."
  },
  {
    "type": "h2",
    "text": "Choosing a 3PL Partner"
  },
  {
    "type": "ul",
    "items": [
      "Minimum monthly volume requirement (some require 500+ orders)",
      "Per-pick and per-pack fees (compare total cost per order)",
      "WMS (Warehouse Management System) quality — can it integrate with LetBuyy?",
      "Returns handling capability and cost",
      "Locations — do they have warehouses in your target zones?"
    ]
  },
  {
    "type": "callout",
    "variant": "tip",
    "title": "Hybrid Model",
    "text": "Compare self-fulfilment, third-party fulfilment and a hybrid for the locations you can serve. Use your own order mix, operating costs, serviceability and provider commitments to choose a model. Review delivery and return outcomes before expanding it."
  }
],
    relatedSlugs: ['order-fulfillment-guide', 'shipping-india-guide', 'inventory-management-guide'],
  },

  // ── AI COMMERCE ───────────────────────────────────────────────────────────
  {
    slug: 'ai-commerce-explained',
    category: 'ai-commerce',
    title: "AI Commerce Explained: What It Means for Your Store",
    subtitle: "AI isn't coming to ecommerce — it's already here. Here's how to use it.",
    description: "A practical introduction to AI commerce for Indian merchants — what AI can do for your store, what it can't, and where to start.",
    author: "letbuyy-team",
    publishedAt: '2026-05-25',
    updatedAt: "2026-10-30",
    tags: ['ai', 'automation', 'commerce', 'future'],
    readingTime: 9,
    featured: true,
    body: [
  {
    "type": "p",
    "text": "AI can help prepare a draft or organize information, but its output needs review. This guide distinguishes a content-assistance tool from a prediction or an automated business decision.",
    "references": [
      {
        "label": "The LetBuyy AI Copilot Guide",
        "href": "/resources/ai-commerce/commerce-copilot-guide"
      },
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "The AI Commerce Stack on LetBuyy"
  },
  {
    "type": "p",
    "text": "AI Studio provides content tools and usage information. Model output depends on provider configuration and credits; sandbox output is a demonstration. Review generated text for product accuracy, pricing and unsupported claims before using it."
  },
  {
    "type": "h2",
    "text": "Product Description Generation"
  },
  {
    "type": "p",
    "text": "Use verified product facts as input. Review materials, dimensions, care instructions and any comparative claim. AI-generated copy is not evidence of a product benefit or an SEO ranking improvement."
  },
  {
    "type": "h2",
    "text": "Inventory Prediction"
  },
  {
    "type": "p",
    "text": "Do not assume a demand forecast, fraud score, dynamic price or fully autonomous customer-support agent is included. Review current account capabilities with support before designing an operating process around them."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['automating-operations-ai', 'commerce-copilot-guide', 'ai-product-recommendations'],
  },
  {
    slug: 'automating-operations-ai',
    category: 'ai-commerce',
    title: "Automating Store Operations with AI",
    subtitle: "Automate the 20 tasks that eat your day — and reclaim your time for growth.",
    description: "Practical guide to automating ecommerce operations with AI — inventory alerts, customer support, order routing, and more.",
    author: "letbuyy-team",
    publishedAt: '2026-05-12',
    updatedAt: "2026-10-30",
    tags: ['automation', 'ai', 'operations', 'efficiency'],
    readingTime: 8,
    body: [
  {
    "type": "p",
    "text": "Start with an observed recurring task, its owner and the result you need. Measure the time spent and the cost of mistakes before deciding whether automation is useful. No fixed time saving or return is promised.",
    "references": [
      {
        "label": "The LetBuyy AI Copilot Guide",
        "href": "/resources/ai-commerce/commerce-copilot-guide"
      },
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Setting Up Your First Automation"
  },
  {
    "type": "p",
    "text": "For order updates, verify the supported event, recipient consent, message template and provider mode. Test delivery and failure recovery with synthetic recipients before enabling a real customer workflow."
  },
  {
    "type": "h2",
    "text": "AI-Powered Inventory Alerts"
  },
  {
    "type": "p",
    "text": "Do not assume a demand forecast, fraud score, dynamic price or fully autonomous customer-support agent is included. Review current account capabilities with support before designing an operating process around them."
  },
  {
    "type": "p",
    "text": "AI Studio provides content tools and usage information. Model output depends on provider configuration and credits; sandbox output is a demonstration. Review generated text for product accuracy, pricing and unsupported claims before using it."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['ai-commerce-explained', 'commerce-copilot-guide', 'workflow-automation-merchants'],
  },
  {
    slug: 'commerce-copilot-guide',
    category: 'ai-commerce',
    title: "The LetBuyy AI Copilot Guide",
    subtitle: "Use supported AI content tools with provider setup, credits and review. Understand the limits before relying on an assistant.",
    description: "Use supported AI content tools with provider setup, credits and review. Understand the limits before relying on an assistant.",
    author: "letbuyy-team",
    publishedAt: '2026-06-01',
    updatedAt: "2026-10-30",
    tags: ['copilot', 'ai', 'letbuyy', 'product'],
    readingTime: 10,
    body: [
  {
    "type": "p",
    "text": "AI Studio provides content tools and usage information. Model output depends on provider configuration and credits; sandbox output is a demonstration. Review generated text for product accuracy, pricing and unsupported claims before using it.",
    "references": [
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Useful Prompts for Merchants"
  },
  {
    "type": "p",
    "text": "Supply the product facts you want used: material, size, intended use and care requirements. Ask for a draft, then compare every statement with the actual product. Never supply customer payment details or private credentials."
  },
  {
    "type": "h2",
    "text": "Copilot Across the Merchant Control Plane"
  },
  {
    "type": "p",
    "text": "Open AI Studio from the merchant workspace where available. The workspace command palette is navigation, not a guarantee that an AI assistant can read every record or perform every action. Check the actual tool, store scope and confirmation shown."
  },
  {
    "type": "p",
    "text": "Do not assume a demand forecast, fraud score, dynamic price or fully autonomous customer-support agent is included. Review current account capabilities with support before designing an operating process around them."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['ai-commerce-explained', 'automating-operations-ai', 'ai-product-recommendations'],
  },
  {
    slug: 'ai-product-recommendations',
    category: 'ai-commerce',
    title: "AI Product Recommendations That Actually Convert",
    subtitle: "Amazon built a recommendation engine. Now you have one too.",
    description: "How AI product recommendations work on LetBuyy — collaborative filtering, upsells, cross-sells, and recommendation placement strategy.",
    author: "letbuyy-team",
    publishedAt: '2026-04-30',
    updatedAt: "2026-10-30",
    tags: ['recommendations', 'ai', 'conversion', 'personalization'],
    readingTime: 7,
    body: [
  {
    "type": "p",
    "text": "Recommendations can help shoppers discover relevant products. Availability depends on the supported product and plan; evaluate suggestions and incremental outcomes with your own data rather than a claim about another company's revenue.",
    "references": [
      {
        "label": "The LetBuyy AI Copilot Guide",
        "href": "/resources/ai-commerce/commerce-copilot-guide"
      },
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "How Recommendations Work"
  },
  {
    "type": "p",
    "text": "A related-product list may be curated or generated by a rule. It should not be described as collaborative filtering or personalized AI without evidence of the actual mechanism and the data used."
  },
  {
    "type": "h2",
    "text": "Placement Strategy"
  },
  {
    "type": "p",
    "text": "Use the storefront sections available in your theme to present relevant products. Confirm availability in your account; no minimum order count unlocks a promised personalization engine. Compare useful clicks and completed orders with an appropriate baseline."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['commerce-copilot-guide', 'automating-operations-ai', 'workflow-automation-merchants'],
  },
  {
    slug: 'workflow-automation-merchants',
    category: 'ai-commerce',
    title: "Workflow Automation for Indian Merchants",
    subtitle: "Build automated workflows that run your store while you sleep.",
    description: "Guide to building ecommerce workflow automation for Indian merchants — triggers, actions, and real-world examples.",
    author: "letbuyy-team",
    publishedAt: '2026-05-08',
    updatedAt: "2026-10-30",
    tags: ['automation', 'workflows', 'operations', 'efficiency'],
    readingTime: 8,
    body: [
  {
    "type": "p",
    "text": "A workflow links an event to a permitted action with a clear owner and a recovery path. Document the trigger, required data, recipient and expected result before automating it.",
    "references": [
      {
        "label": "The LetBuyy AI Copilot Guide",
        "href": "/resources/ai-commerce/commerce-copilot-guide"
      },
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Building Workflows in LetBuyy"
  },
  {
    "type": "p",
    "text": "Order-lifecycle notifications and COD confirmation have dedicated setup paths. A general drag-and-drop workflow builder, broadcast campaigns and automatic refund approval are not established by this guide. Confirm the exact supported operation with the team."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  },
  {
    "type": "h2",
    "text": "Test Before Activating"
  },
  {
    "type": "p",
    "text": "Use synthetic orders and test recipients. Check duplicates, delayed events, denied permissions and provider failures. A test-mode payment is not a live bank debit or proof that customer messages were delivered."
  }
],
    relatedSlugs: ['automating-operations-ai', 'ai-commerce-explained', 'commerce-copilot-guide'],
  },

  // ── DEVELOPERS ────────────────────────────────────────────────────────────
  {
    slug: 'letbuyy-api-getting-started',
    category: 'developers',
    title: "Getting Started with the LetBuyy API",
    subtitle: "Understand approved API access, store permissions, pagination and safe retries without assuming public developer-key availability.",
    description: "Understand approved API access, store permissions, pagination and safe retries without assuming public developer-key availability.",
    author: "letbuyy-team",
    publishedAt: '2026-05-18',
    updatedAt: "2026-10-30",
    tags: ['api', 'developers', 'integration', 'authentication'],
    readingTime: 10,
    featured: true,
    body: [
  {
    "type": "p",
    "text": "The commerce backend uses versioned /v1 HTTP routes. Access is authorized for the actor and store; a caller-supplied store ID does not grant permission. Public self-service developer keys are not promised by this guide.",
    "references": [
      {
        "label": "Introduction to the LetBuyy App Marketplace",
        "href": "/resources/platform/introduction-to-apps"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Authentication"
  },
  {
    "type": "p",
    "text": "Use the authentication and permission contract supplied for your approved integration. Do not reuse a browser session or assume that a Bearer API key can call every merchant endpoint. Keep secrets server-side."
  },
  {
    "type": "h2",
    "text": "Core Endpoints"
  },
  {
    "type": "p",
    "text": "Product routes include reads, creation and PATCH updates; collections are nested under products. Placed-order line items are immutable. Request the supported request/response schema for the operation instead of copying a generic endpoint table."
  },
  {
    "type": "h2",
    "text": "Pagination"
  },
  {
    "type": "p",
    "text": "Read list pagination from the actual response. Products support bounded page/limit and cursor-based reads; this does not establish one pagination format or rate limit for every endpoint. Handle 429 responses and retain the same logical idempotency key when retrying a supported mutation."
  },
  {
    "type": "p",
    "text": "Public third-party app installation and marketplace submissions are deferred. These guides explain integration planning; they do not offer a currently open app store or developer submission service."
  }
],
    relatedSlugs: ['webhooks-complete-guide', 'building-first-letbuyy-app', 'custom-integrations-guide'],
  },
  {
    slug: 'webhooks-complete-guide',
    category: 'developers',
    title: "Webhooks: Real-Time Commerce Event Streaming",
    subtitle: "Plan signed event handling, duplicate protection and failure recovery. Public self-service integrations remain deferred.",
    description: "Plan signed event handling, duplicate protection and failure recovery. Public self-service integrations remain deferred.",
    author: "letbuyy-team",
    publishedAt: '2026-04-15',
    updatedAt: "2026-10-30",
    tags: ['webhooks', 'api', 'events', 'integration'],
    readingTime: 11,
    body: [
  {
    "type": "p",
    "text": "A webhook sends an event to an authorized receiver. Distinguish inbound payment-provider callbacks from outbound merchant integrations; they have different secrets, payloads and access contracts.",
    "references": [
      {
        "label": "Getting Started with the LetBuyy API",
        "href": "/resources/developers/letbuyy-api-getting-started"
      },
      {
        "label": "Introduction to the LetBuyy App Marketplace",
        "href": "/resources/platform/introduction-to-apps"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Registering a Webhook"
  },
  {
    "type": "p",
    "text": "Public third-party app installation and marketplace submissions are deferred. These guides explain integration planning; they do not offer a currently open app store or developer submission service."
  },
  {
    "type": "h2",
    "text": "Signature Verification (Critical)"
  },
  {
    "type": "p",
    "text": "Verify the raw request body with the specific provider or integration signing contract before applying changes. Reject invalid signatures, record event identity and make duplicate handling safe. Do not assume delivery order or a fixed retry schedule."
  },
  {
    "type": "h2",
    "text": "Test Before Activating"
  },
  {
    "type": "p",
    "text": "Test an authentic signed event, an invalid signature, a duplicate event and a failed local write. Keep a receipt linking the provider event to its final local result. A locally generated fixture is not evidence of real provider delivery."
  }
],
    relatedSlugs: ['letbuyy-api-getting-started', 'building-first-letbuyy-app', 'custom-integrations-guide'],
  },
  {
    slug: 'building-first-letbuyy-app',
    category: 'developers',
    title: "Planning a LetBuyy App Integration",
    subtitle: "Plan an integration while public app installation and marketplace submissions remain deferred.",
    description: "Plan an integration while public app installation and marketplace submissions remain deferred.",
    author: "letbuyy-team",
    publishedAt: '2026-05-22',
    updatedAt: "2026-10-30",
    tags: ['apps', 'oauth', 'developers', 'marketplace'],
    readingTime: 13,
    body: [
  {
    "type": "p",
    "text": "Public third-party app installation and marketplace submissions are deferred. These guides explain integration planning; they do not offer a currently open app store or developer submission service.",
    "references": [
      {
        "label": "Getting Started with the LetBuyy API",
        "href": "/resources/developers/letbuyy-api-getting-started"
      },
      {
        "label": "Introduction to the LetBuyy App Marketplace",
        "href": "/resources/platform/introduction-to-apps"
      }
    ]
  },
  {
    "type": "h2",
    "text": "App Types"
  },
  {
    "type": "p",
    "text": "Before commissioning an integration, define the store owner, required records, read/write permissions and revocation process. An internal API or OAuth seam is not a public installation contract."
  },
  {
    "type": "h2",
    "text": "Store Tokens Securely"
  },
  {
    "type": "p",
    "text": "Keep credentials on the server, request only necessary access and test revocation. Never put private API keys in storefront JavaScript. Ask support for a supported integration contract before coding against an assumed endpoint."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['letbuyy-api-getting-started', 'webhooks-complete-guide', 'custom-integrations-guide'],
  },
  {
    slug: 'liquid-theming-guide',
    category: 'developers',
    title: "How Liquid Themes Work on LetBuyy",
    subtitle: "Build powerful, merchant-customizable storefronts with the Liquid template engine.",
    description: "Developer guide to building Liquid themes on LetBuyy — syntax, objects, filters, tags, sections, and the theme architecture.",
    author: "letbuyy-team",
    publishedAt: '2026-04-08',
    updatedAt: "2026-10-30",
    tags: ['themes', 'liquid', 'developers', 'storefront'],
    readingTime: 12,
    body: [
  {
    "type": "p",
    "text": "Liquid is the portable storefront template format used by the theme system. Confirm the supported theme bundle and renderer for your store; a renderer does not certify every theme or a hybrid fallback.",
    "references": [
      {
        "label": "Getting Started with the LetBuyy API",
        "href": "/resources/developers/letbuyy-api-getting-started"
      },
      {
        "label": "Introduction to the LetBuyy App Marketplace",
        "href": "/resources/platform/introduction-to-apps"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Liquid Syntax Basics"
  },
  {
    "type": "code",
    "lang": "liquid",
    "text": "{% comment %} Output — double curly braces {% endcomment %}\n{{ product.title }}\n{{ product.price | money }}\n\n{% comment %} Tags — logic and flow control {% endcomment %}\n{% if product.available %}\n  <button>Add to Cart</button>\n{% else %}\n  <p>Out of Stock</p>\n{% endif %}\n\n{% comment %} Loops {% endcomment %}\n{% for variant in product.variants %}\n  <option value=\"{{ variant.id }}\">{{ variant.title }}</option>\n{% endfor %}"
  },
  {
    "type": "h2",
    "text": "Core Liquid Objects"
  },
  {
    "type": "ul",
    "items": [
      "product — current product with title, handle, price, variants, images, metafields",
      "collection — current collection with products and metadata",
      "cart — current cart state with items, total, item count",
      "customer — permitted customer context, or null for an unauthenticated visitor",
      "shop — store settings, currency, timezone",
      "request — URL, path, host information"
    ]
  },
  {
    "type": "h2",
    "text": "Useful Filters"
  },
  {
    "type": "code",
    "lang": "liquid",
    "text": "{{ product.price | money }}              {% comment %} ₹1,499 {% endcomment %}\n{{ product.description | truncate: 150 }}\n{{ product.title | upcase }}\n{{ image | image_url }}\n{{ product.created_at | date: \"%d %B %Y\" }}"
  },
  {
    "type": "h2",
    "text": "Theme Architecture"
  },
  {
    "type": "ul",
    "items": [
      "layout/theme.liquid: Root HTML wrapper, includes <head> and <body>",
      "templates/*.liquid: Page-specific templates (product, collection, index, cart)",
      "sections/*.liquid: Reusable, merchant-configurable page sections",
      "snippets/*.liquid: Small reusable partials (product card, price display)",
      "assets/: CSS, JS, and image files",
      "config/settings_schema.json: Defines merchant-editable theme settings"
    ]
  },
  {
    "type": "h2",
    "text": "Sections: The Merchant Customization Layer"
  },
  {
    "type": "p",
    "text": "Sections make themes merchant-customizable without code. Define settings in the section's schema — text, colors, images, booleans — and merchants can edit them in the visual theme editor without touching Liquid."
  },
  {
    "type": "p",
    "text": "Use only objects, filters and settings exposed by the supported theme contract. Render and security-test before publication. Do not assume access to all customer history or that an image URL filter resizes an asset."
  }
],
    relatedSlugs: ['building-first-letbuyy-app', 'letbuyy-api-getting-started', 'custom-integrations-guide'],
  },
  {
    slug: 'custom-integrations-guide',
    category: 'developers',
    title: "Creating Custom Integrations with LetBuyy",
    subtitle: "Connect your ERP, CRM, accounting software, or custom tools to your LetBuyy store.",
    description: "Developer guide to building custom integrations with LetBuyy — sync patterns, queue workers, and common integration recipes.",
    author: "letbuyy-team",
    publishedAt: '2026-03-18',
    updatedAt: "2026-10-30",
    tags: ['integrations', 'api', 'developers', 'erp'],
    readingTime: 10,
    body: [
  {
    "type": "p",
    "text": "Most growing Indian brands have a patchwork of systems: a LetBuyy store, a Tally ERP, a Google Sheets inventory tracker, a Razorpay dashboard, and a WhatsApp Business account. Integration connects these into one data flow.",
    "references": [
      {
        "label": "Getting Started with the LetBuyy API",
        "href": "/resources/developers/letbuyy-api-getting-started"
      },
      {
        "label": "Introduction to the LetBuyy App Marketplace",
        "href": "/resources/platform/introduction-to-apps"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Common Integration Recipes"
  },
  {
    "type": "p",
    "text": "Tally, Google Sheets and custom courier connections are integration ideas, not certified plug-and-play connectors. Define field mapping, tax ownership, duplicate handling and reconciliation before selecting a supported implementation."
  },
  {
    "type": "h2",
    "text": "Sync Patterns"
  },
  {
    "type": "p",
    "text": "Choose a bounded export or approved API contract for the data you need. Record the last confirmed result, recover interrupted work and reconcile totals before changing another system. Do not treat an illustrative code snippet as a supported connector."
  },
  {
    "type": "p",
    "text": "Public third-party app installation and marketplace submissions are deferred. These guides explain integration planning; they do not offer a currently open app store or developer submission service."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['letbuyy-api-getting-started', 'webhooks-complete-guide', 'building-first-letbuyy-app'],
  },

  // ── PLATFORM ──────────────────────────────────────────────────────────────
  {
    slug: 'building-first-letbuyy-store',
    category: 'platform',
    title: "Building Your First LetBuyy Store: A Complete Walkthrough",
    subtitle: "Create an email account and draft store, add products, review themes and complete setup before testing publication.",
    description: "Create an email account and draft store, add products, review themes and complete setup before testing publication.",
    author: "letbuyy-team",
    publishedAt: '2026-05-28',
    updatedAt: "2026-11-03",
    tags: ['getting-started', 'platform', 'store-setup', 'walkthrough'],
    readingTime: 11,
    featured: true,
    body: [
  {
    "type": "p",
    "text": "Create a draft store, complete its business settings and test the buyer journey before publishing. Account creation alone does not enable payments, shipping or customer notifications.",
    "references": [
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "1. Create Your Account"
  },
  {
    "type": "p",
    "text": "Use the email signup form, verify the email code and set your password. Continue through onboarding to choose an online store, display name, subdomain and industry. The store starts as a draft."
  },
  {
    "type": "h2",
    "id": "4-add-your-first-product",
    "text": "2. Add Your First Product"
  },
  {
    "type": "p",
    "text": "Open Products, then Add product. Enter verified descriptions, prices, variants, images and stock. Review the saved product and storefront preview before making it available to buyers."
  },
  {
    "type": "h2",
    "text": "3. Select a Theme"
  },
  {
    "type": "p",
    "text": "Use Online Store → Themes to inspect the themes actually available to your account. Open the editor, save a draft and preview it. Do not assume the concept illustrations are a catalog of purchasable themes."
  },
  {
    "type": "h2",
    "id": "5-configure-payments",
    "text": "4. Configure Payments"
  },
  {
    "type": "p",
    "text": "Open Settings → Payments for buyer payment setup. Merchant subscription billing is separate under Money/Billing and plan selection. Use valid provider test credentials first; only switch to live service after its prerequisites and end-to-end checks are complete."
  },
  {
    "type": "h2",
    "id": "8-publish-and-test",
    "text": "5. Publish and Test"
  },
  {
    "type": "p",
    "text": "Complete legal business identity, invoice address, applicable tax settings, delivery coverage and policies. Follow the dashboard setup checklist. Test the actual published journey and notification delivery separately; no fixed launch time, shipping rate or payment approval is promised."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['how-to-start-an-online-store-india', 'how-themes-work', 'introduction-to-apps'],
  },
  {
    slug: 'introduction-to-apps',
    category: 'platform',
    title: "Introduction to the LetBuyy App Marketplace",
    subtitle: "Public third-party app installation and marketplace submissions are deferred. These guides explain integration planning; they do not offer a currently open app store or developer submission service.",
    description: "Public third-party app installation and marketplace submissions are deferred. These guides explain integration planning; they do not offer a currently open app store or developer submission service.",
    author: "letbuyy-team",
    publishedAt: '2026-03-22',
    updatedAt: "2026-10-30",
    tags: ['apps', 'marketplace', 'platform', 'integrations'],
    readingTime: 7,
    body: [
  {
    "type": "p",
    "text": "Public third-party app installation and marketplace submissions are deferred. These guides explain integration planning; they do not offer a currently open app store or developer submission service.",
    "references": [
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      },
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Choosing the Right Apps"
  },
  {
    "type": "p",
    "text": "Start by checking the tools already present in your merchant workspace. A visible integration setting still needs its own account, credentials, permissions and test/live configuration where relevant."
  },
  {
    "type": "h2",
    "text": "Installing an App"
  },
  {
    "type": "p",
    "text": "There is no public install-and-submit walkthrough to follow here. For a specific business need, contact support with the system to connect, data required and intended result; confirm scope and availability before purchasing third-party services."
  }
],
    relatedSlugs: ['building-first-letbuyy-store', 'how-themes-work', 'letbuyy-platform-overview'],
  },
  {
    slug: 'how-themes-work',
    category: 'platform',
    title: "How Themes Work on LetBuyy",
    subtitle: "Inspect available themes, preview the supported editor and review saved changes before publishing.",
    description: "Inspect available themes, preview the supported editor and review saved changes before publishing.",
    author: "letbuyy-team",
    publishedAt: '2026-04-20',
    updatedAt: "2026-10-30",
    tags: ['themes', 'storefront', 'customization', 'platform'],
    readingTime: 9,
    body: [
  {
    "type": "p",
    "text": "A theme controls the storefront layout and presentation. Available themes and editor controls depend on the current catalog and your account; this guide does not announce a third-party theme marketplace.",
    "references": [
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      },
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Theme Types"
  },
  {
    "type": "p",
    "text": "Use Online Store → Themes to inspect the themes actually available to your account. Open the editor, save a draft and preview it. Do not assume the concept illustrations are a catalog of purchasable themes."
  },
  {
    "type": "h2",
    "text": "The Theme Editor"
  },
  {
    "type": "p",
    "text": "Preview the editor controls offered by the selected theme, then save your draft. Check images, navigation, product pages and mobile layout. Keep published changes separate from an unsaved or preview-only edit."
  },
  {
    "type": "h2",
    "text": "Sections: Modular Page Building"
  },
  {
    "type": "p",
    "text": "Every theme page is built from sections — modular blocks that can be reordered, duplicated, and configured. Common sections: Hero image, Product grid, Testimonials, Image with text, Video embed, Newsletter signup, FAQs."
  },
  {
    "type": "h2",
    "text": "Publishing Changes"
  },
  {
    "type": "p",
    "text": "Publish only after reviewing the saved draft and the supported recovery controls. Confirm that the live store reflects the intended revision; a concept preview is not proof that a theme is installed or published."
  }
],
    relatedSlugs: ['liquid-theming-guide', 'building-first-letbuyy-store', 'introduction-to-apps'],
  },
  {
    slug: 'letbuyy-platform-overview',
    category: 'platform',
    title: "LetBuyy Platform Overview: Everything in One Place",
    subtitle: "The full map of LetBuyy's commerce OS — what's where and how it connects.",
    description: "Complete overview of the LetBuyy platform — merchant control plane, storefront runtime, identity, developer ecosystem, and roadmap.",
    author: "letbuyy-team",
    publishedAt: '2026-05-30',
    updatedAt: "2026-10-30",
    tags: ['platform', 'overview', 'architecture', 'product'],
    readingTime: 8,
    body: [
  {
    "type": "p",
    "text": "LetBuyy combines an online storefront with a merchant workspace for products, orders, inventory, customers and business settings. Account access and buyer checkout have separate roles.",
    "references": [
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      },
      {
        "label": "The Merchant Control Plane: Your Commerce OS Dashboard",
        "href": "/resources/platform/merchant-web-guide"
      }
    ]
  },
  {
    "type": "h2",
    "text": "The Core Surfaces"
  },
  {
    "type": "p",
    "text": "Use the account sign-in link to reach your merchant workspace. The public marketing site contains guides and current pricing. A developer, theme or app guide is documentation, not proof of an independently available marketplace."
  },
  {
    "type": "h2",
    "text": "India-First Decisions in the Platform"
  },
  {
    "type": "p",
    "text": "Open Settings → Payments for buyer payment setup. Merchant subscription billing is separate under Money/Billing and plan selection. Use valid provider test credentials first; only switch to live service after its prerequisites and end-to-end checks are complete."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  },
  {
    "type": "h2",
    "text": "2026 Roadmap Highlights"
  },
  {
    "type": "p",
    "text": "Public third-party app installation and marketplace submissions are deferred. These guides explain integration planning; they do not offer a currently open app store or developer submission service."
  }
],
    relatedSlugs: ['building-first-letbuyy-store', 'introduction-to-apps', 'how-themes-work'],
  },
  {
    slug: 'merchant-web-guide',
    category: 'platform',
    title: "The Merchant Control Plane: Your Commerce OS Dashboard",
    subtitle: "Master every module — from products and orders to AI and analytics.",
    description: "Complete guide to the LetBuyy Merchant Control Plane — navigation, modules, dashboards, and power features.",
    author: "letbuyy-team",
    publishedAt: '2026-06-10',
    updatedAt: "2026-10-30",
    tags: ['merchant-dashboard', 'platform', 'getting-started', 'product'],
    readingTime: 10,
    body: [
  {
    "type": "p",
    "text": "Start from the merchant Home dashboard and its setup checklist. Menu items depend on site type and access permissions. A shortcut opens navigation; it does not grant access to an unavailable feature.",
    "references": [
      {
        "label": "Building Your First LetBuyy Store: A Complete Walkthrough",
        "href": "/resources/platform/building-first-letbuyy-store"
      }
    ]
  },
  {
    "type": "h2",
    "text": "Products Module"
  },
  {
    "type": "p",
    "text": "Products includes Add product, Collections and Export and import. Inventory includes stock, history, reservations and locations. Purchasing includes purchase orders, transfers, receipts and vendors. Use the labels shown in your workspace."
  },
  {
    "type": "h2",
    "text": "Orders Module"
  },
  {
    "type": "p",
    "text": "Orders provides the order list and detail views. Read payment and fulfillment status before acting, and use supported return or refund actions instead of changing a placed order snapshot. Provider actions may need additional permissions and setup."
  },
  {
    "type": "h2",
    "text": "Customers Module"
  },
  {
    "type": "p",
    "text": "Customers and Segments organize customer records. Use data only within your permissions and customer communication choices. Account inbox and Support are separate from customer marketing campaigns."
  },
  {
    "type": "h2",
    "text": "Analytics Module"
  },
  {
    "type": "p",
    "text": "Use the date range, filters and definitions shown on each report. Missing or restricted data is not a zero result. Check the current plan page for available limits and capabilities rather than assuming every reporting or AI tool is included."
  },
  {
    "type": "p",
    "text": "Availability depends on your plan, permissions and provider setup. A working product screen or a sandbox result does not establish live service availability."
  }
],
    relatedSlugs: ['building-first-letbuyy-store', 'letbuyy-platform-overview', 'commerce-copilot-guide'],
  },
]

export function getArticlesByCategory(category: string): Article[] {
  return ARTICLES.filter(a => a.category === category)
}

export function getArticleBySlug(category: string, slug: string): Article | undefined {
  return ARTICLES.find(a => a.category === category && a.slug === slug)
}

export function getFeaturedArticles(): Article[] {
  return ARTICLES.filter(a => a.featured)
}

export function getRelatedArticles(slugs: string[]): Article[] {
  return ARTICLES.filter(a => slugs.includes(a.slug))
}

export function getArticlesByTag(tag: string): Article[] {
  return ARTICLES.filter(a => a.tags.includes(tag))
}

export function getAllTags(): string[] {
  const tags = new Set<string>()
  ARTICLES.forEach(a => a.tags.forEach(t => tags.add(t)))
  return Array.from(tags).sort()
}

export function searchArticles(query: string): Article[] {
  return matchResourceArticles(ARTICLES, query)
}
