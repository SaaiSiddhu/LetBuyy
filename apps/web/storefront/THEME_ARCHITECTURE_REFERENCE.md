# Full Theme System — Comprehensive Implementation Plan

## Overview

Build a **production-grade, Shopify-class theme marketplace** for LetBuyy. Each theme is a **fully independent, complete design** — unique headers, footers, product cards, cart, checkout, and hero sections. No two themes share the same UI.

---

## Current Codebase Analysis

The existing `[subdomain]` route has **~3,300 lines** of working UI:

| Component | Lines | Description |
|---|---|---|
| `layout.tsx` | 249 | CSS var injection + header/footer wiring |
| `page.tsx` (home) | 142 | Section renderer (12 section types) |
| `dynamic-header.tsx` | 482 | Single header with scroll/search/mobile |
| `dynamic-footer.tsx` | 229 | Single footer |
| `enhanced-shop-grid.tsx` | ~600 | Shop grid with filters/sorting |
| `cart/page.tsx` | 356 | Cart with coupons |
| `product-details-client.tsx` | 452 | Product detail with variants |
| `checkout-client.tsx` | 915 | Full checkout (3 payment gateways) |

---

## Architecture: Theme Resolver Pattern

Instead of duplicating route files per theme, we use a **theme-aware component resolver**. The `[subdomain]` route stays — but it dynamically loads the correct theme's components based on themeId.

```
src/
├── app/store/[subdomain]/          ← Existing routes (KEEP)
│   ├── layout.tsx                  ← Injects CSS vars + picks theme's header/footer
│   ├── page.tsx                    ← Picks theme's home sections
│   ├── shop/page.tsx               ← Picks theme's shop grid
│   ├── cart/page.tsx               ← Picks theme's cart
│   ├── product/[productId]/        ← Picks theme's product detail
│   └── checkout/                   ← Picks theme's checkout
│
├── components/themes/              ← NEW: Theme component sets
│   ├── resolver.ts                 ← Maps themeId → component set
│   │
│   ├── urban-kicks/                ← FREE store theme (current default)
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── hero.tsx
│   │   ├── product-card.tsx
│   │   ├── product-detail.tsx
│   │   ├── shop-grid.tsx
│   │   ├── cart.tsx
│   │   └── checkout.tsx
│   │
│   ├── luxe-atelier/               ← PREMIUM store theme
│   │   ├── header.tsx              ← Serif typography, gold accents
│   │   ├── footer.tsx              ← Luxury footer
│   │   ├── hero.tsx                ← Cinematic hero
│   │   ├── product-card.tsx        ← Elegant cards with zoom
│   │   ├── product-detail.tsx      ← Gallery-style layout
│   │   ├── shop-grid.tsx           ← 3-col luxury grid
│   │   ├── cart.tsx                ← Minimal luxury cart
│   │   └── checkout.tsx            ← Premium checkout
│   │
│   ├── neon-tech/                  ← PREMIUM store theme
│   │   └── ... (same component files)
│   │
│   ├── natures-basket/             ← FREE store theme
│   │   └── ... (same component files)
│   │
│   ├── creative-folio/             ← FREE portfolio theme
│   │   └── page.tsx                ← Single-page scroll
│   │
│   ├── dark-portfolio/             ← PREMIUM portfolio theme
│   │   └── page.tsx                ← Single-page scroll
│   │
│   ├── clean-resume/               ← FREE resume theme
│   │   └── page.tsx                ← PDF-like view
│   │
│   ├── executive-cv/               ← PREMIUM resume theme
│   │   └── page.tsx                ← PDF-like view
│   │
│   ├── saas-launch/                ← FREE landing theme
│   │   └── page.tsx                ← Single-page scroll
│   │
│   └── startup-starter/            ← PREMIUM landing theme
│       └── page.tsx                ← Single-page scroll
│
├── lib/themes/
│   ├── types.ts                    ← ThemeEntry type (DONE)
│   ├── registry.ts                 ← Central registry & lookup functions
│   └── store/                      ← Theme configs (DONE)
│       ├── urban-kicks.ts
│       ├── luxe-atelier.ts
│       ├── neon-tech.ts
│       └── natures-basket.ts
│   └── portfolio/
│       ├── creative-folio.ts
│       └── dark-portfolio.ts
│   └── resume/
│       ├── clean-resume.ts
│       └── executive-cv.ts
│   └── landing/
│       ├── saas-launch.ts
│       └── startup-starter.ts
│
├── app/themes/                     ← Theme showcase gallery
│   ├── page.tsx                    ← Grid of all themes
│   └── [slug]/page.tsx             ← Theme detail page
│
├── app/portfolio/[theme]/page.tsx  ← Portfolio demo route
├── app/resume/[theme]/page.tsx     ← Resume demo route
├── app/landing/[theme]/page.tsx    ← Landing demo route
```

### Theme Resolver (`components/themes/resolver.ts`)

```typescript
interface ThemeComponents {
    Header: React.ComponentType<HeaderProps>;
    Footer: React.ComponentType<FooterProps>;
    Hero: React.ComponentType<HeroProps>;
    ProductCard: React.ComponentType<ProductCardProps>;
    ProductDetail: React.ComponentType<ProductDetailProps>;
    ShopGrid: React.ComponentType<ShopGridProps>;
    Cart: React.ComponentType<CartProps>;
    Checkout: React.ComponentType<CheckoutProps>;
}

function resolveTheme(themeId: string): ThemeComponents;
```

The layout/pages call `resolveTheme(store.themeId)` and render the theme's components. This way:
- **Same route files** — no duplication
- **Unique UI per theme** — completely different look & feel
- **Cloudflare/Supabase compatible** — standard Next.js dynamic imports

---

## Theme Wireframes

### STORE THEME 1: Urban Kicks (FREE) — Minimal Modern

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER: Clean, transparent → solid on scroll                       │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  URBAN KICKS          Home  Shop  Cart(3)         🔍  ☰     │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ HERO: Full-screen image, centered text, single CTA                 │
│ ╔══════════════════════════════════════════════════════════════╗   │
│ ║                                                              ║   │
│ ║              S T R E E T W E A R  2 0 2 6                   ║   │
│ ║              The future of fashion is here.                  ║   │
│ ║                   [ Shop Now → ]                             ║   │
│ ║                                                              ║   │
│ ╚══════════════════════════════════════════════════════════════╝   │
│                                                                    │
│ PRODUCT GRID: 4-column, minimal cards, hover scale                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                  │
│ │  [IMG]  │ │  [IMG]  │ │  [IMG]  │ │  [IMG]  │                  │
│ │ Nike AF │ │ Jordan 1│ │ Yeezy   │ │ Dunk    │                  │
│ │ ₹8,999  │ │ ₹12,499 │ │ ₹19,999 │ │ ₹7,499  │                  │
│ │[Add▼]   │ │[Add▼]   │ │[Add▼]   │ │[Add▼]   │                  │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                  │
│                                                                    │
│ PRODUCT DETAIL: Split layout, large image left                     │
│ ┌────────────────────┐ ┌──────────────────────┐                    │
│ │                    │ │ Nike Air Force 1     │                    │
│ │    PRODUCT IMAGE   │ │ ★★★★★ (24 reviews)  │                    │
│ │    (gallery swipe) │ │                      │                    │
│ │                    │ │ ₹8,999               │                    │
│ │                    │ │ Size: [7][8][9][10]   │                    │
│ │                    │ │ Qty: [-] 1 [+]        │                    │
│ │                    │ │ [Add to Cart] [Buy Now]│                   │
│ └────────────────────┘ └──────────────────────┘                    │
│                                                                    │
│ CART: Clean list, right sidebar summary                            │
│ ┌──────────────────────────────┐ ┌────────────┐                    │
│ │ [IMG] Nike AF1    ₹8,999  ×1│ │ Subtotal   │                    │
│ │ [IMG] Jordan 1    ₹12,499 ×1│ │ ₹21,498    │                    │
│ │                              │ │ Delivery ₹40│                   │
│ │                              │ │ Total ₹21,538│                  │
│ │                              │ │ [Checkout →]│                    │
│ └──────────────────────────────┘ └────────────┘                    │
│                                                                    │
│ FOOTER: Dark, 3-column, minimal                                   │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  URBAN KICKS    │  Quick Links   │  Follow Us               │   │
│ │  Premium Street │  Home          │  Instagram                │   │
│ │  wear & Sneakers│  Shop          │  Twitter                  │   │
│ │                 │  Terms         │  Facebook                 │   │
│ │                 │  Privacy       │                           │   │
│ │──────────────────────────────────────────────────────────────│   │
│ │  © 2026 Urban Kicks • Powered by LetBuyy                    │   │
│ └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

### STORE THEME 2: Luxe Atelier (PREMIUM $49) — Luxury Dark

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER: Serif font, centered logo, dark bg, gold accents           │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  Collection  About           L U X E            🔍    Bag(2) │   │
│ │                             ATELIER                          │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ HERO: Split — left text (serif), right full-bleed image            │
│ ┌──────────────────────┐┌─────────────────────────────────────┐   │
│ │                      ││                                     │   │
│ │  The Art of          ││         HERO IMAGE                  │   │
│ │  Luxury              ││         (jewelry/watch close-up)    │   │
│ │                      ││                                     │   │
│ │  Handcrafted pieces  ││                                     │   │
│ │  for the discerning  ││                                     │   │
│ │  collector.          ││                                     │   │
│ │                      ││                                     │   │
│ │  [ EXPLORE ◆ ]       ││                                     │   │
│ └──────────────────────┘└─────────────────────────────────────┘   │
│                                                                    │
│ PRODUCT GRID: 3-column, large images, no borders, hover zoom       │
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│ │               │  │               │  │               │           │
│ │   [PRODUCT    │  │   [PRODUCT    │  │   [PRODUCT    │           │
│ │    IMAGE      │  │    IMAGE      │  │    IMAGE      │           │
│ │    large]     │  │    large]     │  │    large]     │           │
│ │               │  │               │  │               │           │
│ │ Diamond Ring  │  │ Gold Necklace │  │ Sapphire Watch│           │
│ │ $2,450        │  │ $1,890        │  │ $4,200        │           │
│ └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                    │
│ PRODUCT DETAIL: Full-width gallery, details below                  │
│ ╔══════════════════════════════════════════════════════════════╗   │
│ ║              LARGE PRODUCT IMAGE (70vh)                      ║   │
│ ║              with thumbnail strip below                      ║   │
│ ╚══════════════════════════════════════════════════════════════╝   │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ DIAMOND SOLITAIRE RING                                       │   │
│ │ $2,450.00 • Handcrafted in 18K Gold                          │   │
│ │ Size: ◇5 ◇6 ◇7 ◇8     [ADD TO BAG]    [♡ WISHLIST]          │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ CART: Minimal dark, no visual noise                                │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  YOUR BAG                                         2 items    │   │
│ │  ─────────────────────────────────────────────────────────── │   │
│ │  Diamond Ring ............ $2,450   Size 7   Qty: 1  [×]     │   │
│ │  Gold Necklace ........... $1,890   18"      Qty: 1  [×]    │   │
│ │  ─────────────────────────────────────────────────────────── │   │
│ │                                    Subtotal    $4,340        │   │
│ │                                    Shipping    Complimentary │   │
│ │                                    Total       $4,340        │   │
│ │                                                              │   │
│ │                    [ PROCEED TO CHECKOUT ◆ ]                  │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ FOOTER: Minimal luxury, thin gold line separator                   │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  ════════════════════ gold line ═════════════════════════     │   │
│ │  LUXE ATELIER • Est. 2024    Terms  Privacy  Contact         │   │
│ │  © 2026                                                      │   │
│ └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

### STORE THEME 3: Neon Tech (PREMIUM $29) — Cyberpunk Dark

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER: Glassmorphism, neon cyan border-bottom glow                │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  ⚡ NEONtech    Gadgets  Gaming  Deals    🔍     🛒(1)      │   │
│ │  ════════════ cyan glow line ═══════════════════════════════ │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ HERO: Animated grid background, glitch text effect                 │
│ ╔══════════════════════════════════════════════════════════════╗   │
│ ║  ░░░░ grid pattern background ░░░░░░░░░░░░░░░░░░░░░░░░░░   ║   │
│ ║                                                              ║   │
│ ║     N E X T - G E N   T E C H    [glitch animation]         ║   │
│ ║     Gear up for the future.                                  ║   │
│ ║     [ ⚡ BROWSE GADGETS ]         [neon glow button]         ║   │
│ ║                                                              ║   │
│ ╚══════════════════════════════════════════════════════════════╝   │
│                                                                    │
│ PRODUCT GRID: 4-col, dark cards, neon border on hover              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│ │ ┌─ ─ ─ ─ ┐ │ │ ┌─ ─ ─ ─ ┐ │ │ ┌─ ─ ─ ─ ┐ │ │ ┌─ ─ ─ ─ ┐ │  │
│ │ │  IMG    │ │ │ │  IMG    │ │ │ │  IMG    │ │ │ │  IMG    │ │  │
│ │ └─ ─ ─ ─ ┘ │ │ └─ ─ ─ ─ ┘ │ │ └─ ─ ─ ─ ┘ │ │ └─ ─ ─ ─ ┘ │  │
│ │ RTX 4090    │ │ PS5 Pro     │ │ AirPods 4   │ │ MechKB      │  │
│ │ ₹1,59,999   │ │ ₹54,999     │ │ ₹24,999     │ │ ₹12,499     │  │
│ │ ⚡IN STOCK  │ │ ⚡IN STOCK  │ │ ⚡PRE-ORDER │ │ ⚡IN STOCK  │  │
│ │ [ADD →]     │ │ [ADD →]     │ │ [NOTIFY ME] │ │ [ADD →]     │  │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│                neon cyan border glow on hover                      │
│                                                                    │
│ PRODUCT DETAIL: Dark, specs-focused, neon accents                  │
│ ┌──────────────────────┐ ┌──────────────────────────────────┐     │
│ │   PRODUCT IMAGE      │ │ RTX 4090 FOUNDERS EDITION        │     │
│ │   (dark bg, product  │ │ ⚡ In Stock • Ships in 24h        │     │
│ │    floating effect)  │ │                                   │     │
│ │                      │ │ ₹1,59,999                         │     │
│ │                      │ │ ──────────────────────────         │     │
│ │                      │ │ SPECS                              │     │
│ │                      │ │ VRAM: 24GB GDDR6X                  │     │
│ │                      │ │ Cores: 16384 CUDA                  │     │
│ │                      │ │ TDP: 450W                          │     │
│ │                      │ │ ──────────────────────────         │     │
│ │                      │ │ [ ⚡ ADD TO CART ]  [ ♡ ]           │     │
│ └──────────────────────┘ └──────────────────────────────────┘     │
│                                                                    │
│ FOOTER: Terminal-style, green-on-black                             │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  > NEONtech_                                                 │   │
│ │  > type: electronics store                                   │   │
│ │  > links: [terms] [privacy] [shipping] [returns]             │   │
│ │  > social: [twitter] [discord] [youtube]                     │   │
│ │  > © 2026 Powered by LetBuyy                                 │   │
│ └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

### STORE THEME 4: Nature's Basket (FREE) — Warm Organic

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER: Warm cream bg, green accents, leaf icon                    │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  🌿 Nature's Basket     Shop  About  Blog    🔍   🧺(2)     │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ HERO: Rounded corners, warm overlay, handwritten font              │
│ ╔══════════════════════════════════════════════════════════════╗   │
│ ║                                                              ║   │
│ ║     Farm Fresh Goodness 🌱                                   ║   │
│ ║     ~ Organic produce delivered to your door ~               ║   │
│ ║     [ 🌿 Shop Organic ]          (rounded pill button)       ║   │
│ ║                                                              ║   │
│ ╚══════════════════════════════════════════════════════════════╝   │
│   (image has warm tone, rounded 16px corners)                      │
│                                                                    │
│ PRODUCT GRID: 3-col, cards with rounded corners, earthy shadows    │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
│ │  ╭──────────╮  │ │  ╭──────────╮  │ │  ╭──────────╮  │          │
│ │  │  PRODUCT │  │ │  │  PRODUCT │  │ │  │  PRODUCT │  │          │
│ │  │  (round) │  │ │  │  (round) │  │ │  │  (round) │  │          │
│ │  ╰──────────╯  │ │  ╰──────────╯  │ │  ╰──────────╯  │          │
│ │  Organic Honey │ │  Almond Butter │ │  Herbal Tea    │          │
│ │  🌱 Organic    │ │  🌱 Organic    │ │  🌱 Organic    │          │
│ │  ₹450          │ │  ₹380          │ │  ₹220          │          │
│ │  [ Add 🧺 ]    │ │  [ Add 🧺 ]    │ │  [ Add 🧺 ]    │          │
│ └────────────────┘ └────────────────┘ └────────────────┘          │
│                                                                    │
│ FOOTER: Warm bg, botanical illustrations feel                      │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  🌿 Nature's Basket                                          │   │
│ │  Supporting local farmers since 2024                          │   │
│ │  Shop • FAQ • Contact • Sustainability                       │   │
│ │  ──────────────────────────────────────────────               │   │
│ │  © 2026 Nature's Basket • Powered by LetBuyy                 │   │
│ └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

### PORTFOLIO THEME 1: Creative Folio (FREE) — Fresh Scroll

```
┌────────────────────────────────────────────────────────────────────┐
│ SINGLE-PAGE SCROLL — no separate routes                            │
│                                                                    │
│ ┌─ STICKY NAV ───────────────────────────────────────────────┐    │
│ │  Sarah Chen         Work  Services  Contact  [Hire Me]     │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ SECTION 1: Hero (full-screen, name + title + photo)                │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │  Hi, I'm                                ╭─────────╮        │    │
│ │  Sarah Chen                             │  PHOTO  │        │    │
│ │  UI/UX Designer & Creative Director     ╰─────────╯        │    │
│ │  [ View My Work ↓ ]                                         │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ SECTION 2: Portfolio Grid (masonry, 3-col)                         │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐                        │
│ │ Project 1 │ │ Project 2 │ │ Project 3 │                        │
│ │ Branding  │ │           │ │ Web Design│                        │
│ │           │ │ UI/UX     │ │           │                        │
│ └───────────┘ │           │ └───────────┘                        │
│ ┌───────────┐ └───────────┘ ┌───────────┐                        │
│ │ Project 4 │ ┌───────────┐ │ Project 6 │                        │
│ │           │ │ Project 5 │ │           │                        │
│ └───────────┘ └───────────┘ └───────────┘                        │
│                                                                    │
│ SECTION 3: Services (3 cards)                                      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                  │
│ │ 🎨 UI/UX    │ │ ✨ Branding  │ │ 💻 Dev       │                  │
│ │ description │ │ description │ │ description │                  │
│ └─────────────┘ └─────────────┘ └─────────────┘                  │
│                                                                    │
│ SECTION 4: Contact Form                                            │
│ ┌────────────────────────────────────────┐                         │
│ │  Let's Work Together                   │                         │
│ │  [Name      ] [Email     ]             │                         │
│ │  [Message                           ]  │                         │
│ │  [ Send Message → ]                    │                         │
│ └────────────────────────────────────────┘                         │
│                                                                    │
│ FOOTER                                                             │
└────────────────────────────────────────────────────────────────────┘
```

---

### RESUME THEME: Clean Resume (FREE) — PDF View

```
┌────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [← Back]  Clean Resume  [📥 Download PDF] [✏️ Edit]      │
├────────────────────────────────────────────────────────────────────┤
│  (gray background, centered A4 paper)                              │
│                                                                    │
│     ╔══════════════════════════════════════════╗                    │
│     ║  JOHN DOE                                ║                    │
│     ║  Full Stack Developer                    ║                    │
│     ║  📧 john@email.com  📞 +91 98765...     ║                    │
│     ║  🔗 linkedin.com/in/johndoe             ║                    │
│     ║                                          ║                    │
│     ║  ────────── EXPERIENCE ───────────       ║                    │
│     ║                                          ║                    │
│     ║  Senior Developer                        ║                    │
│     ║  Google • 2023 – Present                 ║                    │
│     ║  • Led team of 8 on Cloud infra          ║                    │
│     ║  • Reduced latency by 40%                ║                    │
│     ║                                          ║                    │
│     ║  Software Engineer                       ║                    │
│     ║  Startup X • 2021 – 2023                 ║                    │
│     ║  • Built React Native mobile app         ║                    │
│     ║  • Shipped to 50K+ users                 ║                    │
│     ║                                          ║                    │
│     ║  ─────────── SKILLS ──────────────       ║                    │
│     ║                                          ║                    │
│     ║  React     ████████████░░  85%           ║                    │
│     ║  Node.js   ██████████░░░░  70%           ║                    │
│     ║  Flutter   █████████░░░░░  65%           ║                    │
│     ║  Python    ████████░░░░░░  60%           ║                    │
│     ║                                          ║                    │
│     ║  ────────── EDUCATION ────────────       ║                    │
│     ║                                          ║                    │
│     ║  B.Tech Computer Science                 ║                    │
│     ║  IIT Delhi • 2017 – 2021                 ║                    │
│     ╚══════════════════════════════════════════╝                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### LANDING THEME: SaaS Launch (FREE) — Single-Page Scroll

```
┌────────────────────────────────────────────────────────────────────┐
│ SINGLE-PAGE SCROLL — no separate routes                            │
│                                                                    │
│ ┌─ STICKY NAV ───────────────────────────────────────────────┐    │
│ │  🚀 LaunchKit    Features  Pricing  FAQ    [Get Started]   │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ SECTION 1: Hero (gradient bg, floating mockup)                     │
│ ╔════════════════════════════════════════════════════════════╗     │
│ ║  gradient: purple → blue                                   ║     │
│ ║                                                            ║     │
│ ║  Launch your SaaS          ┌──────────────┐               ║     │
│ ║  in minutes, not months.   │  APP MOCKUP  │               ║     │
│ ║                            │  (floating)  │               ║     │
│ ║  [Start Free →] [See Demo] └──────────────┘               ║     │
│ ╚════════════════════════════════════════════════════════════╝     │
│                                                                    │
│ SECTION 2: Features (icon grid)                                    │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                  │
│ │ ⚡ Fast      │ │ 🔒 Secure   │ │ 📈 Scale     │                  │
│ │ Deploy in   │ │ Built-in    │ │ Handle 10M+ │                  │
│ │ seconds     │ │ auth & SSL  │ │ requests    │                  │
│ └─────────────┘ └─────────────┘ └─────────────┘                  │
│                                                                    │
│ SECTION 3: Pricing (3 tiers)                                       │
│ ┌──────────┐ ┌──────────────┐ ┌──────────┐                       │
│ │  Starter │ │ Pro ★ POPULAR │ │ Business │                       │
│ │  $0/mo   │ │ $29/mo       │ │ $99/mo   │                       │
│ │  ✓ 1 app │ │ ✓ 5 apps     │ │ ✓ ∞ apps │                       │
│ │  ✓ 1K MAU│ │ ✓ 50K MAU    │ │ ✓ ∞ MAU  │                       │
│ └──────────┘ └──────────────┘ └──────────┘                       │
│                                                                    │
│ SECTION 4: FAQ (accordion)                                         │
│ ┌────────────────────────────────────────────┐                     │
│ │ ▾ What payment methods do you accept?      │                     │
│ │   We accept Visa, Mastercard, and UPI...   │                     │
│ │ ▸ Can I cancel my subscription?            │                     │
│ │ ▸ Do you offer custom plans?               │                     │
│ └────────────────────────────────────────────┘                     │
│                                                                    │
│ SECTION 5: CTA                                                     │
│ ┌────────────────────────────────────────────┐                     │
│ │  Ready to launch?  [Start Building Free →] │                     │
│ └────────────────────────────────────────────┘                     │
│                                                                    │
│ FOOTER                                                             │
└────────────────────────────────────────────────────────────────────┘
```

---

## Theme Engine Implementation

### Core Renderer

```typescript
// packages/typescript/theme-engine/src/renderer/server.tsx

import { ThemeComponents, ThemeConfig } from '../types/theme';
import { THEME_REGISTRY } from '../registry';

interface ThemeRendererProps {
  themeId: string;
  siteData: SiteData;
  customizations?: Record<string, any>;
}

export async function renderTheme({ themeId, siteData, customizations }: ThemeRendererProps) {
  // 1. Resolve theme from registry
  const themeEntry = THEME_REGISTRY[themeId];
  if (!themeEntry) throw new Error(`Theme "${themeId}" not found in registry`);

  // 2. Load theme components (dynamic import for code splitting)
  const components: ThemeComponents = await themeEntry.loader();

  // 3. Merge default config with user customizations
  const config = mergeConfigs(themeEntry.defaultConfig, customizations);

  // 4. Return renderable component tree
  return {
    components,
    config,
    metadata: themeEntry.metadata,
  };
}
```

### Theme Registry

```typescript
// packages/typescript/theme-engine/src/registry/index.ts

export interface ThemeRegistryEntry {
  id: string;
  slug: string;
  name: string;
  category: 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
  loader: () => Promise<ThemeComponents>;
  defaultConfig: ThemeConfig;
  metadata: ThemeMetadata;
  demoConfig?: {
    subdomain: string;
    siteId: string;
    mockData: Record<string, any>;
  };
}

export const THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
  'urban-kicks': {
    id: 'urban-kicks',
    slug: 'urban-kicks',
    name: 'Urban Kicks',
    category: 'store',
    loader: () => import('../themes/store/urban-kicks'),
    defaultConfig: {
      colors: { primary: '#000000', secondary: '#FFFFFF', accent: '#FF4500' },
      fonts: { heading: 'Oswald', body: 'Inter' },
      layout: { heroStyle: 'fullscreen', productGrid: '3-col' },
    },
    metadata: {
      version: '1.0.0',
      author: 'LetBuyy Team',
      screenshots: ['/themes/urban-kicks/hero.png', '/themes/urban-kicks/products.png'],
    },
    demoConfig: {
      subdomain: 'urban-kicks',
      siteId: 'demo-urban-kicks-uuid',
      mockData: { /* ... */ },
    },
  },
  'luxe-atelier': {
    id: 'luxe-atelier',
    slug: 'luxe-atelier',
    name: 'Luxe Atelier',
    category: 'store',
    loader: () => import('../themes/store/luxe-atelier'),
    defaultConfig: {
      colors: { primary: '#1A1A2E', secondary: '#F5F0EB', accent: '#C9A96E' },
      fonts: { heading: 'Playfair Display', body: 'Lato' },
      layout: { heroStyle: 'split', productGrid: '2-col' },
    },
    metadata: {
      version: '1.0.0',
      author: 'LetBuyy Team',
      screenshots: ['/themes/luxe-atelier/hero.png'],
    },
    demoConfig: {
      subdomain: 'luxe-atelier',
      siteId: 'demo-luxe-atelier-uuid',
      mockData: { /* ... */ },
    },
  },
  // ... additional themes registered here
};
```

### ThemeComponents Interface

```typescript
// packages/typescript/theme-engine/src/types/theme.ts

export interface ThemeComponents {
  // Layout
  Header: React.ComponentType<HeaderProps>;
  Footer: React.ComponentType<FooterProps>;
  Navigation: React.ComponentType<NavProps>;

  // Pages
  HomePage: React.ComponentType<HomePageProps>;
  ProductListPage: React.ComponentType<ProductListProps>;
  ProductDetailPage: React.ComponentType<ProductDetailProps>;
  CartPage: React.ComponentType<CartProps>;
  CheckoutPage: React.ComponentType<CheckoutProps>;

  // Shared Components
  ProductCard: React.ComponentType<ProductCardProps>;
  HeroSection: React.ComponentType<HeroProps>;
  CategoryGrid: React.ComponentType<CategoryGridProps>;
  TestimonialSection?: React.ComponentType<TestimonialProps>;
  NewsletterSignup?: React.ComponentType<NewsletterProps>;
}

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background?: string;
    text?: string;
    muted?: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono?: string;
  };
  layout: {
    heroStyle: 'fullscreen' | 'split' | 'minimal' | 'video' | 'carousel';
    productGrid: '2-col' | '3-col' | '4-col' | 'masonry';
    headerStyle?: 'transparent' | 'solid' | 'floating';
    footerStyle?: 'minimal' | 'full' | 'mega';
  };
  spacing?: {
    sectionGap: number;
    contentMaxWidth: number;
  };
  animations?: {
    pageTransition: 'fade' | 'slide' | 'none';
    scrollReveal: boolean;
    hoverEffects: boolean;
  };
}

export interface ThemeMetadata {
  version: string;
  author: string;
  screenshots: string[];
  previewUrl?: string;
  documentation?: string;
  changelog?: string;
  minAppVersion?: string;
}
```

---

## Theme Resolver Implementation

### How Themes Are Dynamically Loaded

The storefront app uses a **Theme Resolver Pattern** to dynamically load the correct theme components based on the store's `theme_id` in the database.

```
┌─────────────────────────────────────────────────────────────┐
│              THEME RESOLVER FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Request arrives at storefront                           │
│     e.g., urban-kicks.letbuyy.store/products                │
│     ↓                                                       │
│  2. middleware.ts extracts subdomain                        │
│     subdomain = 'urban-kicks'                               │
│     ↓                                                       │
│  3. Query DB: SELECT theme_id FROM sites                    │
│     WHERE subdomain = 'urban-kicks'                         │
│     → theme_id = 'urban-kicks'                              │
│     ↓                                                       │
│  4. THEME_REGISTRY['urban-kicks'].loader()                  │
│     → Dynamically imports theme components                  │
│     ↓                                                       │
│  5. Render page with resolved components                    │
│     <UrbanKicksHeader />                                    │
│     <UrbanKicksProductList products={...} />                │
│     <UrbanKicksFooter />                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Resolver Implementation

```typescript
// apps/web/storefront/src/lib/theme-resolver.ts

import { THEME_REGISTRY, ThemeComponents } from '@letbuyy/theme-engine';
import { createServerClient } from '@/lib/supabase/server';

interface ResolvedTheme {
  components: ThemeComponents;
  config: ThemeConfig;
  themeId: string;
  customizations: Record<string, any>;
}

export async function resolveThemeForSite(siteId: string): Promise<ResolvedTheme> {
  const supabase = await createServerClient();

  // 1. Get active theme installation for this site
  const { data: installation } = await supabase
    .from('theme_installations')
    .select('theme_id, customizations, version_installed')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .single();

  // 2. Fallback to default theme
  const themeId = installation?.theme_id ?? 'urban-kicks';

  // 3. Look up in registry
  const entry = THEME_REGISTRY[themeId];
  if (!entry) throw new Error(`Theme "${themeId}" not registered`);

  // 4. Load components via dynamic import
  const components = await entry.loader();

  // 5. Merge default config with user customizations
  const config = mergeConfigs(entry.defaultConfig, installation?.customizations);

  return { components, config, themeId, customizations: installation?.customizations ?? {} };
}
```

### Middleware Integration

```typescript
// apps/web/storefront/middleware.ts

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  // Skip for main domain
  if (subdomain === 'www' || subdomain === 'letbuyy') {
    return NextResponse.next();
  }

  // Check if this is a known demo subdomain
  const isDemoStore = DEMO_SUBDOMAINS.includes(subdomain);

  // Pass subdomain info via headers
  const response = NextResponse.next();
  response.headers.set('x-subdomain', subdomain);
  response.headers.set('x-is-demo', isDemoStore ? 'true' : 'false');

  return response;
}

const DEMO_SUBDOMAINS = [
  'urban-kicks',
  'luxe-atelier',
  'neon-tech',
  'natures-basket',
  'creative-folio',
  'clean-resume',
  'saas-launch',
];
```

---

## Theme Development Workflow

### Creating a New Theme (Step-by-Step)

```
┌─────────────────────────────────────────────────────────────┐
│           THEME DEVELOPMENT LIFECYCLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Scaffold                                           │
│  → pnpm create-theme --name "my-theme" --category store     │
│  → Generates: packages/typescript/theme-engine/themes/      │
│               store/my-theme/                               │
│                                                             │
│  Step 2: Implement Components                               │
│  → Header, Footer, HomePage, ProductListPage, etc.          │
│  → Must satisfy ThemeComponents interface                   │
│                                                             │
│  Step 3: Define Config                                      │
│  → colors, fonts, layout in config.ts                       │
│  → Define demoConfig with subdomain + mock data             │
│                                                             │
│  Step 4: Register in THEME_REGISTRY                         │
│  → Add entry to registry/index.ts                           │
│  → Wire dynamic import                                      │
│                                                             │
│  Step 5: Create Demo Site                                   │
│  → Seed DB with demo site (sites table)                     │
│  → Seed products, categories, hero data                     │
│  → Map subdomain in Vercel/DNS                              │
│                                                             │
│  Step 6: Create DB Record                                   │
│  → INSERT INTO themes (slug, name, category, ...)           │
│  → Set pricing, screenshots, description                    │
│                                                             │
│  Step 7: Screenshot & Media                                 │
│  → Auto-capture via screenshot-service                      │
│  → Generate scrolling GIF, thumbnails                       │
│                                                             │
│  Step 8: QA & Publish                                       │
│  → Test on all viewports                                    │
│  → Lighthouse audit (target: 90+)                           │
│  → Set is_active = true, published_at = NOW()               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Theme Scaffold Script

```typescript
// scripts/create-theme.ts

import fs from 'fs';
import path from 'path';

interface CreateThemeOptions {
  name: string;        // 'my-theme'
  displayName: string; // 'My Theme'
  category: 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
}

export function createTheme(options: CreateThemeOptions) {
  const themeDir = path.join(
    'packages/typescript/theme-engine/themes',
    options.category,
    options.name
  );

  // Create directory structure
  const dirs = [
    themeDir,
    `${themeDir}/components`,
  ];
  dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

  // Generate files from templates
  const files = {
    'index.tsx': generateMainComponent(options),
    'config.ts': generateConfig(options),
    'styles.css': generateStyles(options),
    'components/header.tsx': generateHeader(options),
    'components/footer.tsx': generateFooter(options),
    'components/hero.tsx': generateHero(options),
  };

  Object.entries(files).forEach(([file, content]) => {
    fs.writeFileSync(path.join(themeDir, file), content);
  });

  // Update registry
  appendToRegistry(options);

  console.log(`✅ Theme "${options.displayName}" created at ${themeDir}`);
}
```

---

## Theme Customizer Architecture

### Customization Options Interface

```typescript
// packages/typescript/theme-engine/src/types/customization.ts

export interface CustomizationOptions {
  // Color overrides
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    headerBg?: string;
    footerBg?: string;
  };

  // Font overrides
  fonts?: {
    heading?: string;
    body?: string;
  };

  // Layout overrides
  layout?: {
    heroStyle?: 'fullscreen' | 'split' | 'minimal' | 'video' | 'carousel';
    productGrid?: '2-col' | '3-col' | '4-col' | 'masonry';
    headerStyle?: 'transparent' | 'solid' | 'floating';
    showNewsletter?: boolean;
    showTestimonials?: boolean;
    showInstagramFeed?: boolean;
  };

  // Content overrides
  content?: {
    heroTitle?: string;
    heroSubtitle?: string;
    heroButtonText?: string;
    footerText?: string;
    announcementBar?: string;
  };

  // Custom CSS
  customCSS?: string;

  // Logo
  logoUrl?: string;
  faviconUrl?: string;
}
```

### Live Customizer Component

```typescript
// apps/web/theme-marketplace/src/components/customizer/theme-customizer.tsx

'use client';

import { useState, useCallback, useEffect } from 'react';
import { CustomizationOptions } from '@letbuyy/theme-engine';
import { debounce } from '@/lib/utils';

interface ThemeCustomizerProps {
  themeId: string;
  siteId: string;
  currentCustomizations: CustomizationOptions;
  onSave: (customizations: CustomizationOptions) => Promise<void>;
}

export function ThemeCustomizer({
  themeId,
  siteId,
  currentCustomizations,
  onSave,
}: ThemeCustomizerProps) {
  const [customizations, setCustomizations] = useState(currentCustomizations);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Build preview URL with customization params
  useEffect(() => {
    const params = new URLSearchParams({
      preview: 'true',
      customizations: JSON.stringify(customizations),
    });
    setPreviewUrl(`https://${siteId}.letbuyy.store?${params}`);
  }, [customizations, siteId]);

  // Debounced preview update via PostMessage
  const updatePreview = useCallback(
    debounce((updates: CustomizationOptions) => {
      const iframe = document.querySelector('#preview-frame') as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(
        { type: 'THEME_CUSTOMIZATION_UPDATE', payload: updates },
        '*'
      );
    }, 150),
    []
  );

  const handleColorChange = (key: string, value: string) => {
    const updated = {
      ...customizations,
      colors: { ...customizations.colors, [key]: value },
    };
    setCustomizations(updated);
    updatePreview(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(customizations);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar: Customization Controls */}
      <aside className="w-80 border-r overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="font-semibold mb-3">Colors</h3>
          {Object.entries(customizations.colors || {}).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 mb-2">
              <input
                type="color"
                value={value}
                onChange={(e) => handleColorChange(key, e.target.value)}
              />
              <label className="text-sm capitalize">{key}</label>
            </div>
          ))}
        </section>

        <section>
          <h3 className="font-semibold mb-3">Fonts</h3>
          {/* Font selection dropdowns */}
        </section>

        <section>
          <h3 className="font-semibold mb-3">Layout</h3>
          {/* Layout toggle switches */}
        </section>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-primary text-white py-2 rounded-lg"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </aside>

      {/* Main: Live Preview */}
      <main className="flex-1">
        <iframe
          id="preview-frame"
          src={previewUrl}
          className="w-full h-full border-0"
        />
      </main>
    </div>
  );
}
```

### Apply Customizations (Server-Side)

```typescript
// packages/typescript/theme-engine/src/utils/apply-customizations.ts

import { ThemeConfig, CustomizationOptions } from '../types';

export function applyCustomizations(
  baseConfig: ThemeConfig,
  customizations: CustomizationOptions
): ThemeConfig {
  return {
    colors: {
      ...baseConfig.colors,
      ...customizations.colors,
    },
    fonts: {
      ...baseConfig.fonts,
      ...customizations.fonts,
    },
    layout: {
      ...baseConfig.layout,
      ...customizations.layout,
    },
    spacing: baseConfig.spacing,
    animations: baseConfig.animations,
  };
}

export function generateCSSVariables(config: ThemeConfig): string {
  return `
    :root {
      --color-primary: ${config.colors.primary};
      --color-secondary: ${config.colors.secondary};
      --color-accent: ${config.colors.accent};
      --color-background: ${config.colors.background || '#FFFFFF'};
      --color-text: ${config.colors.text || '#111111'};
      --font-heading: '${config.fonts.heading}', sans-serif;
      --font-body: '${config.fonts.body}', sans-serif;
      --section-gap: ${config.spacing?.sectionGap || 64}px;
      --content-max-width: ${config.spacing?.contentMaxWidth || 1200}px;
    }
  `;
}
```

---

## Proposed Changes (Files)

### Phase 1: Theme System Foundation
| File | Action | Desc |
|---|---|---|
| `components/themes/resolver.ts` | NEW | Theme → component mapping |
| `components/themes/types.ts` | NEW | Shared props interfaces |
| `lib/themes/registry.ts` | NEW | Central theme registry |
| `store-service.ts` | MODIFY | Resolve theme slugs for demos |
| `middleware.ts` | MODIFY | Route `/store/{theme}`, `/portfolio/{theme}`, etc. |

### Phase 2: Store Theme Components (4 themes × 8 components = 32 files)
| Theme | Files |
|---|---|
| `components/themes/urban-kicks/` | header, footer, hero, product-card, product-detail, shop-grid, cart, checkout |
| `components/themes/luxe-atelier/` | same 8 files — luxury dark UI |
| `components/themes/neon-tech/` | same 8 files — cyberpunk UI |
| `components/themes/natures-basket/` | same 8 files — warm organic UI |

### Phase 3: Portfolio/Landing/Resume (6 files)
| Theme | Files |
|---|---|
| `components/themes/creative-folio/page.tsx` | Single-page portfolio scroll |
| `components/themes/dark-portfolio/page.tsx` | Dark single-page portfolio |
| `components/themes/saas-launch/page.tsx` | Single-page SaaS landing |
| `components/themes/startup-starter/page.tsx` | Single-page startup landing |
| `components/themes/clean-resume/page.tsx` | PDF-like resume view |
| `components/themes/executive-cv/page.tsx` | Premium resume view |

### Phase 4: Theme Gallery & Routes
| File | Action |
|---|---|
| `app/page.tsx` | MODIFY → Theme gallery |
| `app/themes/[slug]/page.tsx` | NEW — Detail page |
| `app/portfolio/[theme]/page.tsx` | NEW — Portfolio demo |
| `app/resume/[theme]/page.tsx` | NEW — Resume demo |
| `app/landing/[theme]/page.tsx` | NEW — Landing demo |

### Phase 5: Wiring (update existing routes to use resolver)
| File | Action |
|---|---|
| `app/store/[subdomain]/layout.tsx` | MODIFY — Use resolver for header/footer |
| `app/store/[subdomain]/page.tsx` | MODIFY — Use resolver for sections |
| `app/store/[subdomain]/shop/*` | MODIFY — Use resolver for shop grid |
| `app/store/[subdomain]/cart/*` | MODIFY — Use resolver for cart |
| `app/store/[subdomain]/product/*` | MODIFY — Use resolver for PDP |
| `app/store/[subdomain]/checkout/*` | MODIFY — Use resolver for checkout |

---

## Execution Order

> [!IMPORTANT]
> This is a **large project** (~40+ new files, ~15,000+ lines of new code).
> Recommended execution: **Phase-by-phase**, testing each before moving to the next.

1. **Phase 1** — Foundation (resolver, registry, middleware) — ~5 files
2. **Phase 2a** — Urban Kicks components (extract from existing code) — 8 files
3. **Phase 2b** — Luxe Atelier components — 8 files
4. **Phase 2c** — Neon Tech components — 8 files
5. **Phase 2d** — Nature's Basket components — 8 files
6. **Phase 3** — Portfolio + Resume + Landing themes — 6 files
7. **Phase 4** — Gallery page + detail page + demo routes — 5 files
8. **Phase 5** — Wire existing `[subdomain]` routes to use resolver — 6 modifications

---

## Verification Plan

### Per-Theme Verification
For each store theme, verify at 5 URLs:
- `localhost:3000/store/{theme}/home` — Home page
- `localhost:3000/store/{theme}/shop` — Shop grid
- `localhost:3000/store/{theme}/product/1` — Product detail
- `localhost:3000/store/{theme}/cart` — Cart
- `localhost:3000/store/{theme}/checkout` — Checkout

### Cross-Type Verification
- `localhost:3000/portfolio/{theme}/home` — Portfolio scrolls correctly
- `localhost:3000/resume/{theme}` — Resume renders PDF-like
- `localhost:3000/landing/{theme}/home` — Landing scrolls correctly

### Gallery Verification
- `localhost:3000/` — All 10 themes shown
- Filtering works (type + pricing)
- Theme detail pages render with screenshots & sticky footer
