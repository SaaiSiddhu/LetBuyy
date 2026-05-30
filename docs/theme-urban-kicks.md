# Urban Kicks Production Theme

## Identity

- Slug: `urban-kicks`
- Name: Urban Kicks
- Version: `1.0.0`
- Package status: `active`
- Pricing: free
- Site types: `store`
- Runtime renderer: `apps/storefront-runtime`

Urban Kicks is the active production storefront theme for LetBuyy stores. Database ownership remains `sites`; the theme uses `store` only in URL/UI language.

## Sections

| Section key | Renderer key | Purpose |
| --- | --- | --- |
| `header` | `core.header` | Store header with logo/name, navigation, search, account, and cart controls |
| `footer` | `core.footer` | Store footer with links, social links, newsletter, and payment affordances |
| `heroBanner` | `core.hero` | Commerce hero with headline, image, overlay, and CTA |
| `trustBadges` | `commerce.trust-badges` | Shipping, authenticity, returns, and support badges |
| `productGrid` | `core.product-grid` | Responsive product grid for home, collection, and search templates |
| `productDetail` | `core.product-detail` | Product detail media, price, availability, and cart action |
| `featuredProducts` | `core.featured-products` | Curated product rail |
| `categoryGrid` | `commerce.category-grid` | Category cards linking to collection/shop views |
| `brandMarquee` | `commerce.brand-marquee` | Scrolling brand or campaign strip |
| `newsletter` | `core.newsletter` | Email signup band |
| `testimonials` | `core.testimonials` | Customer proof carousel/grid |
| `aboutSection` | `core.about` | Brand story content |
| `portfolioGrid` | `core.portfolio-grid` | Lookbook or project grid for hybrid store types |
| `skillsSection` | `core.skills` | Capability list for portfolio/resume variants |
| `experienceTimeline` | `core.experience-timeline` | Timeline for portfolio/resume variants |
| `contactForm` | `core.contact-form` | Lead capture form |
| `ctaSection` | `core.cta` | Focused promotional CTA band |
| `servicesGrid` | `core.services-grid` | Services or value proposition grid |
| `contentPage` | `core.rich-content` | Rich content for pages and policies |

## Blocks

| Block key | Renderer key | Used by |
| --- | --- | --- |
| `navPage` | `core.nav-link` | `header` |
| `footerLink` | `core.footer-link` | `footer` |
| `socialLink` | `core.social-link` | `footer` |
| `category` | `commerce.category-card` | `categoryGrid` |
| `brand` | `commerce.brand-logo` | `brandMarquee` |
| `badge` | `commerce.trust-badge` | `trustBadges` |
| `testimonialCard` | `core.testimonial-card` | `testimonials` |
| `contentBlock` | `core.content-block` | `contentPage`, `aboutSection`, `ctaSection` |

## Default Templates

The seed defines template contracts for `index`, `product`, `collection`, `page`, `policy`, `cart`, `checkout`, `order_confirmation`, `search`, `customer_account`, and `not_found`.

The default `index` template renders:

1. `heroBanner`
2. `trustBadges`
3. `productGrid`
4. `brandMarquee`
5. `categoryGrid`
6. `newsletter`

## Installation

1. Apply migrations through `066_lock_urban_kicks_production.sql`.
2. Apply `database/supabase/seeds/urban-kicks-theme.sql`.
3. Install through the worker route `POST /v1/themes/urban-kicks/install` with a body containing the owned `store_id`.
4. Open the merchant theme editor at the merchant control-plane theme route for the store.
5. Save a draft with `PUT /v1/themes/urban-kicks/editor/draft`.
6. Publish with `POST /v1/themes/urban-kicks/publish`.

The migration keeps all non-Urban Kicks theme packages in `draft` status and keeps the legacy `themes` catalog active only for `urban-kicks`.
