# Ten-theme source bundle catalog

**Evidence class: LETBUYY SOURCE VERIFIED.** Generated on 2026-10-30 from `createFirstPartyCatalogBundle(slug, { customizationVersion: "2.1.0" })` in `packages/theme-engine/src/first-party-theme-catalog.ts:71-75,169`. This is a source execution only. It does not prove any catalog row, installation, draft, release, mounted UI, or buyer render.

## Circuit — `letbuyy-forge` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `header` | `announcement-bar` → `header` |
| `footer` | `footer` |
| `index` | `category-grid` → `hero-banner` → `product-grid` → `about-section` → `trust-badges` |
| `product` | `product-detail` → `featured-products` |
| `collection` | `collection-filter` → `collection-product-list` |
| `search` | `collection-filter` → `collection-product-list` |
| `cart` | `cart-summary` |
| `list-collections` | `category-grid` |
| `contact` | `contact-form` |
| `customers/login` | `customer-login` |
| `customers/register` | `customer-register` |
| `customers/account` | `customer-account` |
| `customers/orders` | `customer-orders` |
| `customers/order` | `customer-order-detail` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `customers/addresses` | `customer-addresses` |
| `policy` | `policy-content` |
| `blog` | `blog-listing` |
| `article` | `article-content` |
| `page` | `page-content` |
| `not_found` | `404-page` |
| `password` | `password-gate` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | — | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `collection`, `search` | `title:text`* | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `title:text`*, `content:text`*, `stepTitle1:text`*, `stepText1:text`*, `stepTitle2:text`*, `stepText2:text`*, `stepTitle3:text`*, `stepText3:text`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`*, `subtitle:text`*, `label1:text`*, `collection1:collection`, `label2:text`*, `collection2:collection`, `label3:text`*, `collection3:collection`, `label4:text`*, `collection4:collection` | — | 1 |
| `collection-filter` | `collection`, `search` | `eyebrow:text`*, `title:text`*, `placeholder:text`* | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `product` | `title:text`*, `subtitle:text`*, `requireSelection:toggle`*, `product1:product`, `product2:product`, `product3:product`, `productLimit:range`* | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`*, `showPersistentSearch:toggle`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `image:image`, `product1:product`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `showElectronicsFacts:toggle`*, `showBuyNow:toggle`* | — | 1 |
| `product-grid` | `index` | `title:text`*, `subtitle:text`*, `columns:range`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | `index` | `shippingText:text`*, `returnsText:text`*, `supportText:text`* | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## Threadline — `letbuyy-sense` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `article` | `article-content` |
| `blog` | `blog-listing` |
| `cart` | `cart-summary` |
| `collection` | `collection-filter` → `product-grid` |
| `contact` | `contact-form` |
| `customers/account` | `customer-account` |
| `customers/addresses` | `customer-addresses` |
| `customers/login` | `customer-login` |
| `customers/order` | `customer-order-detail` |
| `customers/orders` | `customer-orders` |
| `customers/register` | `customer-register` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `footer` | `footer` |
| `header` | `announcement-bar` → `header` |
| `index` | `hero-banner` → `category-grid` → `product-grid` → `featured-products` → `about-section` → `trust-badges` |
| `list-collections` | `category-grid` |
| `not_found` | `404-page` |
| `page` | `page-content` |
| `password` | `password-gate` |
| `policy` | `policy-content` |
| `product` | `product-detail` → `featured-products` |
| `search` | `search-box` → `collection-product-list` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | `search` | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `search` | `title:text`* | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `title:text`*, `content:text`*, `image:image`, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`*, `subtitle:text`*, `collection1:collection`, `collection2:collection`, `collection3:collection` | — | 1 |
| `collection-filter` | `collection` | — | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `index`, `product` | `requireSelection:toggle`*, `title:text`*, `subtitle:text`*, `image:image`, `product1:product`, `product2:product`, `product3:product`, `productLimit:range`* | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `ctaText:text`*, `ctaLink:url`*, `secondaryText:text`*, `secondaryLink:url`*, `image:image`, `secondImage:image`, `imageFocus:select`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `showBuyNow:toggle`*, `showGarmentFacts:toggle`* | — | 1 |
| `product-grid` | `collection`, `index` | `title:text`*, `subtitle:text`*, `columns:range`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | `index` | `fitText:text`*, `serviceText:text`*, `supportText:text`* | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## Dewdrop — `letbuyy-aura` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `header` | `announcement-bar` → `header` |
| `footer` | `footer` |
| `index` | `hero-banner` → `category-grid` → `product-grid` → `about-section` → `trust-badges` |
| `product` | `product-detail` → `featured-products` → `trust-badges` |
| `collection` | `collection-filter` → `product-grid` |
| `search` | `collection-filter` → `collection-product-list` |
| `cart` | `cart-summary` |
| `list-collections` | `category-grid` |
| `contact` | `contact-form` |
| `customers/login` | `customer-login` |
| `customers/register` | `customer-register` |
| `customers/account` | `customer-account` |
| `customers/orders` | `customer-orders` |
| `customers/order` | `customer-order-detail` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `customers/addresses` | `customer-addresses` |
| `policy` | `policy-content` |
| `blog` | `blog-listing` |
| `article` | `article-content` |
| `page` | `page-content` |
| `not_found` | `404-page` |
| `password` | `password-gate` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | — | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `search` | `title:text`* | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `title:text`*, `content:textarea`*, `image:image`, `imageAlt:text`*, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`*, `label1:text`*, `collection1:collection`, `label2:text`*, `collection2:collection`, `label3:text`*, `collection3:collection` | — | 1 |
| `collection-filter` | `collection`, `search` | `title:text`* | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `product` | `title:text`*, `subtitle:text`*, `requireSelection:toggle`*, `product1:product`, `product2:product`, `product3:product`, `productLimit:range`* | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `ctaText:text`*, `ctaLink:url`*, `image:image`, `imageAlt:text`*, `imageFocus:select`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `factsHeading:text`*, `showShadeReference:toggle`*, `showBuyNow:toggle`* | — | 1 |
| `product-grid` | `index`, `collection` | `title:text`*, `subtitle:text`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | `index`, `product` | — | `service` (limit 6), `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## Habitat — `letbuyy-craft` — source 2.1.0

Definitions: 23 templates, 46 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `article` | `article-content` |
| `blog` | `blog-listing` |
| `cart` | `cart-summary` |
| `collection` | `collection-filter` → `product-grid` |
| `contact` | `contact-form` |
| `customers/account` | `customer-account` |
| `customers/addresses` | `customer-addresses` |
| `customers/login` | `customer-login` |
| `customers/order` | `customer-order-detail` |
| `customers/orders` | `customer-orders` |
| `customers/register` | `customer-register` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `footer` | `footer` |
| `header` | `announcement-bar` → `header` |
| `index` | `hero-banner` → `product-grid` → `about-section` → `habitat-measurement-guide` → `trust-badges` |
| `list-collections` | `category-grid` |
| `not_found` | `404-page` |
| `page` | `page-content` |
| `password` | `password-gate` |
| `policy` | `policy-content` |
| `product` | `product-detail` → `featured-products` |
| `search` | `search-box` → `collection-product-list` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | `search` | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `search` | `title:text`*, `showDimensionFilters:toggle`* | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `eyebrow:text`*, `title:text`*, `content:textarea`, `image:image`, `imageAlt:text`*, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `list-collections` | `title:text`*, `subtitle:text` | — | 1 |
| `collection-filter` | `collection` | `eyebrow:text`*, `title:text`*, `showDimensionFilters:toggle`* | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `product` | `title:text`*, `subtitle:text`*, `requireSelection:toggle`*, `product1:product`, `product2:product`, `product3:product`, `productLimit:range`* | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `roomIndexLabel:text`*, `collection1:collection`, `collection2:collection`, `collection3:collection`, `collection4:collection`, `image:image`, `imageAlt:text`*, `caption:text`*, `ctaText:text`*, `ctaLink:url`*, `guideText:text`*, `guideLink:url`*, `imageFocus:select`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `showBuyNow:toggle`*, `showFurnitureFacts:toggle`*, `showDimensionDiagram:toggle`*, `showRoomContext:toggle`*, `factsHeading:text`*, `contextMediaIndex:range`* | — | 1 |
| `product-grid` | `collection`, `index` | `title:text`*, `subtitle:text`*, `collectionId:collection`, `productLimit:range`* | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | `index` | `dimensionsText:text`*, `assemblyText:text`*, `deliveryText:text`* | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |
| `habitat-measurement-guide` | `index` | `eyebrow:text`*, `title:text`*, `description:text`*, `step1Title:text`*, `step1Text:text`*, `step2Title:text`*, `step2Text:text`*, `step3Title:text`*, `step3Text:text`* | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## Pantry — `letbuyy-refresh` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `header` | `announcement-bar` → `header` |
| `footer` | `footer` |
| `index` | `hero-banner` → `category-grid` → `product-grid` → `about-section` → `featured-products` → `trust-badges` |
| `product` | `product-detail` → `featured-products` |
| `collection` | `collection-filter` → `product-grid` |
| `search` | `search-box` → `collection-product-list` |
| `cart` | `cart-summary` |
| `list-collections` | `category-grid` |
| `contact` | `contact-form` |
| `customers/login` | `customer-login` |
| `customers/register` | `customer-register` |
| `customers/account` | `customer-account` |
| `customers/orders` | `customer-orders` |
| `customers/order` | `customer-order-detail` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `customers/addresses` | `customer-addresses` |
| `policy` | `policy-content` |
| `blog` | `blog-listing` |
| `article` | `article-content` |
| `page` | `page-content` |
| `not_found` | `404-page` |
| `password` | `password-gate` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | `search` | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `search` | `title:text`*, `showHeading:toggle`* | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `title:text`*, `content:text`*, `image:image`, `imageAlt:text`*, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`*, `collection1:collection`, `collection2:collection`, `collection3:collection`, `collection4:collection` | — | 1 |
| `collection-filter` | `collection` | `title:text`*, `showSearch:toggle`* | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `index`, `product` | `title:text`*, `subtitle:text`*, `requireSelection:toggle`*, `product1:product`, `product2:product`, `product3:product`, `productLimit:range`* | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `ctaText:text`*, `ctaLink:url`*, `image:image`, `imageAlt:text`*, `focalPoint:select`* | `note` | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `showNutrition:toggle`* | — | 1 |
| `product-grid` | `index`, `collection` | `title:text`*, `subtitle:text`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | `index` | `packText:text`*, `factsText:text`*, `shippingText:text`* | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## Trailmark — `letbuyy-ride` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `header` | `announcement-bar` → `header` |
| `footer` | `footer` |
| `index` | `hero-banner` → `category-grid` → `product-grid` → `about-section` → `trust-badges` |
| `product` | `product-detail` → `featured-products` |
| `collection` | `collection-product-list` |
| `search` | `collection-product-list` |
| `cart` | `cart-summary` |
| `list-collections` | `category-grid` |
| `contact` | `contact-form` |
| `customers/login` | `customer-login` |
| `customers/register` | `customer-register` |
| `customers/account` | `customer-account` |
| `customers/orders` | `customer-orders` |
| `customers/order` | `customer-order-detail` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `customers/addresses` | `customer-addresses` |
| `policy` | `policy-content` |
| `blog` | `blog-listing` |
| `article` | `article-content` |
| `page` | `page-content` |
| `not_found` | `404-page` |
| `password` | `password-gate` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | — | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `collection`, `search` | `title:text`*, `headingOverride:text`* | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `title:text`*, `content:text`*, `image:image`, `imageAlt:text`*, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`*, `collection1:collection`, `collection2:collection`, `collection3:collection` | — | 1 |
| `collection-filter` | — | — | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `product` | `title:text`*, `subtitle:text`*, `image:image`, `imageAlt:text`*, `requireSelection:toggle`*, `product1:product`, `product2:product`, `product3:product`, `productLimit:range`* | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `ctaText:text`*, `ctaLink:url`*, `image:image`, `imageAlt:text`*, `imageFocus:select`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `showEquipmentFacts:toggle`*, `showBuyNow:toggle`* | — | 1 |
| `product-grid` | `index` | `title:text`*, `subtitle:text`*, `collectionId:collection`, `productLimit:range`*, `columns:range`* | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | `index` | `measurementsText:text`*, `contentsText:text`*, `supportText:text`* | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## Playfield — `letbuyy-bloom` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `header` | `announcement-bar` → `header` |
| `footer` | `footer` |
| `index` | `hero-banner` → `spotlight` → `category-grid` → `product-grid` → `about-section` → `trust-badges` |
| `product` | `product-detail` → `featured-products` |
| `collection` | `collection-filter` → `collection-product-list` |
| `search` | `search-box` → `collection-filter` → `collection-product-list` |
| `cart` | `cart-summary` |
| `list-collections` | `category-grid` |
| `contact` | `contact-form` |
| `customers/login` | `customer-login` |
| `customers/register` | `customer-register` |
| `customers/account` | `customer-account` |
| `customers/orders` | `customer-orders` |
| `customers/order` | `customer-order-detail` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `customers/addresses` | `customer-addresses` |
| `policy` | `policy-content` |
| `blog` | `blog-listing` |
| `article` | `article-content` |
| `page` | `page-content` |
| `not_found` | `404-page` |
| `password` | `password-gate` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | `search` | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `collection`, `search` | — | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `title:text`*, `content:text`*, `image:image`, `imageAlt:text`*, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`* | — | 1 |
| `collection-filter` | `collection`, `search` | — | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `product` | `title:text`*, `subtitle:text`*, `columns:range`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `buttonLabel:text`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `showBuyNow:toggle`*, `showToyFacts:toggle`* | — | 1 |
| `product-grid` | `index` | `title:text`*, `subtitle:text`*, `columns:range`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | `index` | `contentsText:text`*, `materialsText:text`*, `helpText:text`* | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | `index` | `heading:text`*, `eyebrow:text`*, `image:image`, `imageAlt:text`*, `link:url`*, `firstTitle:text`*, `firstImage:image`, `firstImageAlt:text`*, `firstLink:url`*, `secondTitle:text`*, `secondImage:image`, `secondImageAlt:text`*, `secondLink:url`* | — | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## MadeYours — `letbuyy-nova` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `header` | `announcement-bar` → `header` |
| `footer` | `footer` |
| `index` | `hero-banner` → `experience-timeline` → `product-grid` → `category-grid` → `about-section` |
| `product` | `product-detail` → `featured-products` |
| `collection` | `collection-filter` → `collection-product-list` |
| `search` | `search-box` → `collection-filter` → `collection-product-list` |
| `cart` | `cart-summary` |
| `list-collections` | `category-grid` |
| `contact` | `contact-form` |
| `customers/login` | `customer-login` |
| `customers/register` | `customer-register` |
| `customers/account` | `customer-account` |
| `customers/orders` | `customer-orders` |
| `customers/order` | `customer-order-detail` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `customers/addresses` | `customer-addresses` |
| `policy` | `policy-content` |
| `blog` | `blog-listing` |
| `article` | `article-content` |
| `page` | `page-content` |
| `not_found` | `404-page` |
| `password` | `password-gate` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | `search` | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `collection`, `search` | `title:text`*, `subtitle:text`*, `columns:range`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `title:text`*, `content:text`*, `image:image`, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`*, `collection1:collection`, `collection2:collection`, `collection3:collection` | — | 1 |
| `collection-filter` | `collection`, `search` | `title:text`* | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `product` | `title:text`*, `subtitle:text`*, `product1:product`, `product2:product`, `columns:range`*, `productLimit:range`* | — | 1 |
| `experience-timeline` | `index` | `title:text`* | `step` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `ctaText:text`*, `ctaLink:url`*, `image:image`, `imageFocus:select`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`* | — | 1 |
| `product-grid` | `index` | `title:text`*, `subtitle:text`*, `columns:range`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | — | `title:text` | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## Marginalia — `letbuyy-dawn` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `article` | `article-content` |
| `blog` | `blog-listing` |
| `cart` | `cart-summary` |
| `collection` | `collection-filter` → `collection-product-list` |
| `contact` | `contact-form` |
| `customers/account` | `customer-account` |
| `customers/addresses` | `customer-addresses` |
| `customers/login` | `customer-login` |
| `customers/order` | `customer-order-detail` |
| `customers/orders` | `customer-orders` |
| `customers/register` | `customer-register` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `footer` | `footer` |
| `header` | `header` |
| `index` | `hero-banner` → `category-grid` → `product-grid` → `about-section` |
| `list-collections` | `category-grid` |
| `not_found` | `404-page` |
| `page` | `page-content` |
| `password` | `password-gate` |
| `policy` | `policy-content` |
| `product` | `product-detail` → `featured-products` |
| `search` | `collection-filter` → `collection-product-list` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | — | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `collection`, `search` | `title:text`* | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | — | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `eyebrow:text`*, `title:text`*, `content:textarea`*, `image:image`, `imageAlt:text`*, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`*, `eyebrow:text`*, `product1:product`, `requireSelection:toggle`*, `emptyText:text`*, `linkLabel:text`* | `subject` (limit 12) | 1 |
| `collection-filter` | `collection`, `search` | — | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `product` | `title:text`*, `subtitle:text`*, `columns:range`*, `productLimit:range`*, `collectionId:collection`, `product1:product`, `product2:product`, `product3:product`, `requireSelection:toggle`* | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `searchLabel:text`*, `searchPlaceholder:text`*, `searchButton:text`*, `searchHint:text`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `showBookFacts:toggle`*, `showExcerpt:toggle`* | — | 1 |
| `product-grid` | `index` | `title:text`*, `subtitle:text`*, `columns:range`*, `productLimit:range`*, `collectionId:collection` | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | — | `title:text` | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.

## Kindred — `letbuyy-summit` — source 2.1.0

Definitions: 23 templates, 45 sections, 1 reusable block type(s). Settings groups: colors, typography, appearance, seo. Installed version: **NOT VERIFIED**.

### Templates and actual default composition

| Template key | Ordered section types |
| --- | --- |
| `header` | `announcement-bar` → `header` |
| `footer` | `footer` |
| `index` | `hero-banner` → `category-grid` → `product-grid` → `about-section` → `trust-badges` |
| `product` | `product-detail` → `featured-products` |
| `collection` | `collection-filter` → `collection-product-list` |
| `search` | `search-box` → `collection-filter` → `collection-product-list` |
| `cart` | `cart-summary` |
| `list-collections` | `category-grid` |
| `contact` | `contact-form` |
| `customers/login` | `customer-login` |
| `customers/register` | `customer-register` |
| `customers/account` | `customer-account` |
| `customers/orders` | `customer-orders` |
| `customers/order` | `customer-order-detail` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `customers/addresses` | `customer-addresses` |
| `policy` | `policy-content` |
| `blog` | `blog-listing` |
| `article` | `article-content` |
| `page` | `page-content` |
| `not_found` | `404-page` |
| `password` | `password-gate` |

### Section definitions, settings, and block candidates

| Section type | Used by defaults | Declared settings `id:type` | Declared direct block types | Presets |
| --- | --- | --- | --- | ---: |
| `customer-orders` | `customers/orders` | `heading:text`* | — | 1 |
| `customer-order-detail` | `customers/order` | `heading:text`* | — | 1 |
| `customer-account` | `customers/account` | `heading:text`* | — | 1 |
| `customer-login` | `customers/login` | `heading:text`* | — | 1 |
| `customer-register` | `customers/register` | `heading:text`* | — | 1 |
| `customer-settings` | `customers/settings` | `heading:text`* | — | 1 |
| `customer-wishlist` | `customers/wishlist` | `heading:text`* | — | 1 |
| `customer-addresses` | `customers/addresses` | `heading:text`* | — | 1 |
| `policy-content` | `policy` | — | — | 1 |
| `cart-summary` | `cart` | `heading:text`* | — | 1 |
| `search-box` | `search` | `placeholder:text`* | — | 1 |
| `collection-banner` | — | `showDescription:toggle`* | — | 1 |
| `collection-product-list` | `collection`, `search` | `title:text`* | — | 1 |
| `blog-listing` | `blog` | `heading:text`* | — | 1 |
| `article-content` | `article` | — | — | 1 |
| `page-content` | `page` | — | — | 1 |
| `404-page` | `not_found` | — | — | 1 |
| `password-gate` | `password` | `heading:text`* | — | 1 |
| `announcement-bar` | `header` | `text:text`*, `linkLabel:text`*, `linkHref:url`* | — | 1 |
| `about-section` | `index` | `eyebrow:text`*, `title:text`*, `content:text`*, `image:image`, `imageAlt:text`*, `linkLabel:text`*, `linkUrl:url`* | — | 1 |
| `app-block-slot` | — | `title:text`, `slot:text`* | `@app` | 1 |
| `banner-carousel` | — | `title:text`, `autoplay:toggle`* | `slide` | 1 |
| `brand-marquee` | — | `title:text`* | `brand` | 1 |
| `category-grid` | `index`, `list-collections` | `title:text`*, `collection1:collection`, `collection2:collection`, `collection3:collection`, `collection4:collection` | — | 1 |
| `collection-filter` | `collection`, `search` | `title:text`* | — | 1 |
| `contact-form` | `contact` | `title:text`*, `subtitle:text`, `showPhone:toggle`* | — | 1 |
| `cta-section` | — | `heading:text`*, `subheading:text`, `ctaText:text`*, `ctaLink:url`* | — | 1 |
| `featured-products` | `product` | `title:text`*, `subtitle:text`*, `requireSelection:toggle`*, `product1:product`, `product2:product`, `product3:product`, `productLimit:range`* | — | 1 |
| `experience-timeline` | — | `title:text`* | `experience` | 1 |
| `faq-accordion` | — | `title:text`*, `allowMultipleOpen:toggle`* | `faq-item` | 1 |
| `footer` | `footer` | `storeName:text`, `tagline:text`, `contactEmail:text`, `contactPhone:text`, `instagramUrl:url`, `facebookUrl:url`, `twitterUrl:url` | `link` | 1 |
| `header` | `header` | `storeName:text`, `showSearch:toggle`*, `showCart:toggle`*, `behavior:select`*, `menu:select`*, `layout:select`* | `link` | 1 |
| `hero-banner` | `index` | `eyebrow:text`*, `heading:text`*, `subheading:text`*, `finderHeading:text`*, `image:image`, `imageAlt:text`* | — | 1 |
| `marquee` | — | `text:text`* | — | 1 |
| `portfolio-grid` | — | `title:text`* | `project` | 1 |
| `product-detail` | `product` | `showGallery:toggle`*, `showDescription:toggle`*, `showReviews:toggle`*, `showGiftContents:toggle`*, `showPackagingViews:toggle`* | — | 1 |
| `product-grid` | `index` | `title:text`*, `subtitle:text`*, `collectionId:collection`, `columns:select`*, `productLimit:range`* | — | 1 |
| `rich-content` | — | `title:text`, `body:richtext` | — | 1 |
| `services-grid` | — | `title:text`* | `service` | 1 |
| `skills-section` | — | `title:text`* | `skill` | 1 |
| `testimonials` | — | `title:text`* | `testimonial` | 1 |
| `trust-badges` | `index` | `title:text`*, `firstTitle:text`*, `firstText:text`*, `secondTitle:text`*, `secondText:text`*, `policyLabel:text`*, `policyUrl:url`* | `badge` | 1 |
| `newsletter-signup` | — | `title:text`*, `subtitle:text`, `buttonLabel:text`* | — | 1 |
| `spotlight` | — | `heading:text`*, `subheading:text` | `badge`, `@app` | 1 |
| `video-hero` | — | `heading:text`*, `subheading:textarea`*, `videoUrl:url` | — | 1 |

`*` indicates a declared default. `@app` is a dormant/extensibility marker, not permission to activate third-party blocks. Section eligibility, occurrence limits and legal insertion still require the installed schema and server validation.

### Reusable blocks and global fields

- `badge`: `label:text`; allowed child types: unspecified; presets: 0.
- Global `colors`: `primaryColor:color`, `secondaryColor:color`, `accentColor:color`, `backgroundColor:color`, `textColor:color`, `surfaceColor:color`.
- Global `typography`: `headingFontFamily:text`, `bodyFontFamily:text`.
- Global `appearance`: `borderRadius:number`.
- Global `seo`: `metaDescription:textarea`, `socialImageUrl:url`, `faviconUrl:url`.
