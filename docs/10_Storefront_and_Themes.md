# LetBuyy Platform — Storefront & Themes

> **Doc 10 of 12** | Public Storefront Rendering, Theme Engine, Page Builder, Customer Experience & Performance
>
> **Version:** 6.0 | **Date:** February 14, 2026
>
> **Prev:** [09 API Reference](./09_API_Reference.md) | **Next:** [11 Super Admin & Team](./11_Super_Admin_and_Team.md)

---

## Table of Contents

1. [Storefront Architecture](#1-storefront-architecture)
2. [URL Routing & DNS](#2-url-routing--dns)
3. [Theme Engine](#3-theme-engine)
4. [Template Gallery](#4-template-gallery)
5. [Page Builder (Craft.js)](#5-page-builder-craftjs)
6. [Component Library](#6-component-library)
7. [E-Commerce Storefront Layout](#7-e-commerce-storefront-layout)
8. [Portfolio Storefront Layout](#8-portfolio-storefront-layout)
9. [Resume Storefront Layout](#9-resume-storefront-layout)
10. [Landing Page Layout](#10-landing-page-layout)
11. [Blog Layout](#11-blog-layout)
12. [Customer-Facing Pages](#12-customer-facing-pages)
13. [Cart & Checkout Experience](#13-cart--checkout-experience)
14. [Product Detail Page](#14-product-detail-page)
15. [Search & Filtering](#15-search--filtering)
16. [SEO Engine](#16-seo-engine)
17. [Performance & Core Web Vitals](#17-performance--core-web-vitals)
18. [Image & Media Pipeline](#18-image--media-pipeline)
19. [Mobile Responsiveness & PWA](#19-mobile-responsiveness--pwa)
20. [Accessibility (a11y)](#20-accessibility-a11y)
21. [Analytics & Tracking](#21-analytics--tracking)
22. [Document History](#22-document-history)

---

## 1. Storefront Architecture

### 1.1 Rendering Pipeline

```
Customer visits: stylehub.letbuyy.store (or www.stylehub.com)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                  Cloudflare DNS + WAF                          │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ DNS       │→ │  DDoS / WAF  │→ │  Firewall Rules       │  │
│  │ Resolution│  │  Protection  │  │  (Geo / Bot / Rate)   │  │
│  └───────────┘  └──────────────┘  └───────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                  Vercel Edge Network                          │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  1. Subdomain / Custom Domain Resolution               │   │
│  │  2. Store Status Check (published? active trial?)      │   │
│  │  3. Edge Middleware — redirect frozen/suspended stores  │   │
│  └───────────────────────────────────────────────────────┘   │
│                             │                                 │
│              ┌──────────────┼──────────────┐                 │
│              ▼              ▼              ▼                  │
│      ┌─────────────┐ ┌──────────┐ ┌──────────────┐          │
│      │    ISR       │ │  SSR     │ │  Static      │          │
│      │ (Products,  │ │ (Cart,   │ │ (Legal, FAQ, │          │
│      │  Blog, etc.)│ │ Checkout)│ │  sitemap)    │          │
│      └──────┬──────┘ └────┬─────┘ └──────┬───────┘          │
│             └──────────────┼──────────────┘                  │
│                            ▼                                  │
│      ┌─────────────────────────────────────────────────┐     │
│      │  Theme Engine → CSS Custom Properties Applied    │     │
│      │  Page Builder → Craft.js JSON → React Components │     │
│      │  Data Layer → Supabase API (via Edge Cache)      │     │
│      └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Rendered Storefront (Delivered to Customer)                   │
│  ├── Fully rendered HTML (SEO-optimized SSR)                  │
│  ├── CSS Custom Properties (from theme config)                │
│  ├── Selective hydration (interactive components only)         │
│  ├── JSON-LD structured data (products, org, breadcrumbs)     │
│  └── CDN-optimized images (WebP, responsive srcset)           │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Decisions

| Decision | Rationale |
|---|---|
| **SSR-first rendering** | SEO critical for storefronts — Google must index products and content |
| **ISR with on-demand revalidation** | Cache product pages; revalidate when store owner updates content |
| **Edge Middleware** | Sub-50ms routing decisions (store status, redirects, feature flags) |
| **Selective hydration** | Ship minimal JS — only hydrate interactive components (cart, search, image gallery) |
| **CSS Custom Properties** | Theme colors/fonts applied at runtime without page rebuild |
| **Craft.js for page building** | Visual drag-and-drop editor with serializable JSON output |
| **Multi-tenant SSR** | Single Next.js deployment serves all storefronts via subdomain routing |

### 1.3 Rendering Strategy per Page Type

| Page | Strategy | Revalidation | Cache TTL |
|---|---|---|---|
| Homepage | ISR | On-demand (webhook) | 5 minutes |
| Product listing | ISR | On-demand | 1 minute |
| Product detail | ISR | On-demand | 1 minute |
| Collection page | ISR | On-demand | 5 minutes |
| Blog post | ISR | On-demand | 10 minutes |
| Portfolio project | ISR | On-demand | 10 minutes |
| Resume page | ISR | On-demand | 10 minutes |
| Cart | SSR (no cache) | Real-time | — |
| Checkout | SSR (no cache) | Real-time | — |
| About / Contact | ISR | On-demand | 30 minutes |
| Legal pages | Static | Build-time | 24 hours |
| Sitemap | Static | Hourly cron | 1 hour |
| Coming Soon | SSR | Real-time | — |

### 1.4 Multi-Tenant Architecture

```typescript
// apps/web/storefront/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Extract subdomain or resolve custom domain
  let storeSubdomain: string | null = null;

  if (hostname.endsWith('.letbuyy.store')) {
    storeSubdomain = hostname.replace('.letbuyy.store', '');
    // Skip system subdomains
    if (['www', 'admin', 'accounts', 'api', 'console'].includes(storeSubdomain)) {
      return NextResponse.next();
    }
  } else {
    // Custom domain — look up in KV/edge config
    const storeData = await lookupCustomDomain(hostname);
    if (storeData) {
      storeSubdomain = storeData.subdomain;
    }
  }

  if (!storeSubdomain) {
    return NextResponse.redirect(new URL('https://letbuyy.store'));
  }

  // Check store status via edge cache
  const storeStatus = await getStoreStatus(storeSubdomain);
  
  if (storeStatus === 'suspended') {
    return NextResponse.rewrite(new URL('/status/suspended', request.url));
  }
  if (storeStatus === 'frozen') {
    return NextResponse.rewrite(new URL('/status/coming-soon', request.url));
  }
  if (storeStatus === 'draft' || storeStatus === 'unpublished') {
    return NextResponse.rewrite(new URL('/status/coming-soon', request.url));
  }

  // Inject store subdomain into headers for downstream resolution
  const response = NextResponse.next();
  response.headers.set('x-store-subdomain', storeSubdomain);
  return response;
}
```

---

## 2. URL Routing & DNS

### 2.1 Platform URL Map

| URL Pattern | Purpose | Runtime |
|---|---|---|
| `letbuyy.store` | Marketing landing page | Vercel (Next.js) |
| `accounts.letbuyy.store` | Auth portal (login, signup, password reset) | Vercel (Next.js) |
| `admin.letbuyy.store` | Store admin dashboard | Vercel (Next.js) |
| `{store}.letbuyy.store` | Public storefront | Vercel (Next.js) |
| `api.letbuyy.store` | REST API | Cloudflare Workers (Hono) |
| `console.letbuyy.store` | Super admin panel | Vercel (Next.js) |
| `r2.letbuyy.store` | Media CDN (images, files) | Cloudflare R2 |

### 2.2 DNS Configuration (Cloudflare)

```
Zone: letbuyy.store

# Root & marketing site
@                    A       76.76.21.21            (Vercel)
@                    AAAA    2606:4700:...          (Vercel)

# Wildcard — all subdomains (stores + system)
*.letbuyy.store      CNAME   cname.vercel-dns.com   (Vercel)

# API — Cloudflare Workers
api.letbuyy.store    CNAME   workers.cloudflare.com (Workers)

# Media CDN
r2.letbuyy.store     CNAME   r2.letbuyy.store.r2.cloudflarestorage.com

# Email (optional — for transactional emails)
@                    MX      route1.mx.cloudflare.net
@                    MX      route2.mx.cloudflare.net
@                    TXT     "v=spf1 include:_spf.google.com ~all"
```

### 2.3 Custom Domains (Paid Plans)

Store owners on Starter+ plans can connect their own domains:

```
Custom Domain Setup Flow:

1. Store owner enters domain: www.stylehub.com
     │
     ▼
2. Platform generates DNS instructions:
   ┌──────────────────────────────────────────────────────┐
   │  Add this CNAME record at your DNS provider:         │
   │                                                       │
   │  Host: www                                            │
   │  Target: cname.vercel-dns.com                        │
   │  TTL: Auto                                            │
   │                                                       │
   │  For apex domain (stylehub.com), add A records:      │
   │  76.76.21.21                                          │
   └──────────────────────────────────────────────────────┘
     │
     ▼
3. Platform polls DNS every 30s for up to 48 hours
     │
     ▼
4. DNS verified → Vercel provisions SSL (Let's Encrypt)
     │
     ▼
5. stores.custom_domain = "www.stylehub.com" saved to DB
     │
     ▼
6. Edge middleware resolves www.stylehub.com → store data
```

**Custom Domain Database Schema:**

```sql
-- From 08_Database_Schema.md
ALTER TABLE stores ADD COLUMN custom_domain VARCHAR(255) UNIQUE;
ALTER TABLE stores ADD COLUMN domain_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE stores ADD COLUMN domain_ssl_status VARCHAR(20) DEFAULT 'pending';
  -- 'pending', 'provisioning', 'active', 'error'
```

### 2.4 Storefront Status Pages

| Store Status | Condition | Page Shown |
|---|---|---|
| `draft` | Just created, not yet launched | "Coming Soon" — store name, logo, "Launching soon!" message |
| `published` | Active and live | Full storefront with all content |
| `unpublished` | Owner manually unpublished | "This store is currently unavailable" |
| `suspended` | Suspended by super admin | "This store has been suspended. Contact support." |
| `frozen` | Trial expired, no subscription | "Coming Soon" with trial-expired upgrade prompt |

**Coming Soon Page:**

```typescript
// apps/web/storefront/src/app/status/coming-soon/page.tsx
export default async function ComingSoon({ store }: { store: StoreData }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
      <div className="text-center max-w-md px-4">
        {store.logo_url && (
          <Image src={store.logo_url} alt={store.name} width={120} height={120} className="mx-auto mb-6 rounded-2xl" />
        )}
        <h1 className="text-3xl font-bold text-gray-900">{store.name}</h1>
        <p className="mt-2 text-gray-500">Something amazing is coming soon</p>
        <div className="mt-8 flex gap-4 justify-center">
          {store.social?.instagram && (
            <a href={store.social.instagram} className="text-gray-400 hover:text-pink-500 transition">
              <InstagramIcon />
            </a>
          )}
          {store.social?.twitter && (
            <a href={store.social.twitter} className="text-gray-400 hover:text-blue-400 transition">
              <TwitterIcon />
            </a>
          )}
        </div>
        <p className="mt-6 text-xs text-gray-400">
          Powered by <a href="https://letbuyy.store" className="underline">LetBuyy</a>
        </p>
      </div>
    </div>
  );
}
```

---

## 3. Theme Engine

### 3.1 Theme Configuration Schema

Every storefront is driven by a JSONB theme configuration stored in the `themes` table:

```typescript
interface ThemeConfig {
  // Identity
  name: string;                         // "Aurora", "Zenith", "Craft"
  version: string;                      // "1.2.0"
  site_types: SiteType[];               // ["store", "portfolio", "landing"]

  // Colors
  colors: {
    primary: string;                    // "#6366F1" — brand primary
    primary_foreground: string;         // "#FFFFFF"
    secondary: string;                  // "#8B5CF6"
    secondary_foreground: string;       // "#FFFFFF"
    accent: string;                     // "#F59E0B"
    accent_foreground: string;          // "#1E1B4B"
    background: string;                 // "#FFFFFF"
    foreground: string;                 // "#0F172A"
    muted: string;                      // "#F1F5F9"
    muted_foreground: string;           // "#64748B"
    card: string;                       // "#FFFFFF"
    card_foreground: string;            // "#0F172A"
    border: string;                     // "#E2E8F0"
    destructive: string;               // "#EF4444"
    success: string;                    // "#22C55E"
    warning: string;                    // "#F59E0B"
  };

  // Typography
  fonts: {
    heading: string;                    // "Plus Jakarta Sans"
    body: string;                       // "Inter"
    mono: string;                       // "JetBrains Mono"
    base_size: number;                  // 16
    scale_ratio: number;               // 1.25 (major third)
    line_height: number;               // 1.6
    heading_weight: number;             // 700
  };

  // Layout
  layout: {
    max_width: number;                  // 1280
    content_width: number;              // 768
    sidebar_width: number;              // 280
    border_radius: number;              // 12
    border_radius_sm: number;           // 6
    border_radius_lg: number;           // 16
    spacing_unit: number;               // 4
    header_style: 'solid' | 'transparent' | 'sticky' | 'floating';
    header_height: number;              // 72
    footer_style: 'minimal' | 'standard' | 'full' | 'centered';
    product_grid_columns: number;       // 3 (desktop), auto-adjusts for mobile
    product_card_style: 'minimal' | 'hover' | 'detailed' | 'overlay';
    product_image_ratio: '1:1' | '3:4' | '4:3' | '16:9';
  };

  // Animations
  animations: {
    page_transition: 'fade' | 'slide' | 'none';
    hover_effect: 'lift' | 'glow' | 'border' | 'scale' | 'none';
    scroll_reveal: boolean;
    parallax: boolean;
    loading_skeleton: boolean;
  };

  // Dark Mode
  dark_mode: {
    enabled: boolean;
    default: 'light' | 'dark' | 'system';
    colors: Partial<ThemeConfig['colors']>;
  };
}
```

### 3.2 CSS Custom Properties Generation

Theme config is compiled into CSS custom properties at render time:

```typescript
// lib/theme/generate-css.ts
export function generateThemeCSS(config: ThemeConfig): string {
  return `
    :root {
      /* Colors */
      --color-primary: ${config.colors.primary};
      --color-primary-foreground: ${config.colors.primary_foreground};
      --color-secondary: ${config.colors.secondary};
      --color-accent: ${config.colors.accent};
      --color-background: ${config.colors.background};
      --color-foreground: ${config.colors.foreground};
      --color-muted: ${config.colors.muted};
      --color-muted-foreground: ${config.colors.muted_foreground};
      --color-card: ${config.colors.card};
      --color-border: ${config.colors.border};
      --color-destructive: ${config.colors.destructive};
      --color-success: ${config.colors.success};
      --color-warning: ${config.colors.warning};

      /* Typography */
      --font-heading: '${config.fonts.heading}', system-ui, sans-serif;
      --font-body: '${config.fonts.body}', system-ui, sans-serif;
      --font-mono: '${config.fonts.mono}', monospace;
      --font-base-size: ${config.fonts.base_size}px;
      --line-height: ${config.fonts.line_height};
      --heading-weight: ${config.fonts.heading_weight};

      /* Type Scale (Major Third: 1.25) */
      --text-xs: ${config.fonts.base_size * 0.75}px;
      --text-sm: ${config.fonts.base_size * 0.875}px;
      --text-base: ${config.fonts.base_size}px;
      --text-lg: ${config.fonts.base_size * 1.125}px;
      --text-xl: ${config.fonts.base_size * 1.25}px;
      --text-2xl: ${config.fonts.base_size * 1.5}px;
      --text-3xl: ${config.fonts.base_size * 1.875}px;
      --text-4xl: ${config.fonts.base_size * 2.25}px;

      /* Layout */
      --max-width: ${config.layout.max_width}px;
      --content-width: ${config.layout.content_width}px;
      --radius: ${config.layout.border_radius}px;
      --radius-sm: ${config.layout.border_radius_sm}px;
      --radius-lg: ${config.layout.border_radius_lg}px;
      --spacing: ${config.layout.spacing_unit}px;
      --header-height: ${config.layout.header_height}px;
    }

    ${config.dark_mode.enabled ? `
    [data-theme="dark"] {
      --color-primary: ${config.dark_mode.colors?.primary || config.colors.primary};
      --color-background: ${config.dark_mode.colors?.background || '#0F172A'};
      --color-foreground: ${config.dark_mode.colors?.foreground || '#F8FAFC'};
      --color-card: ${config.dark_mode.colors?.card || '#1E293B'};
      --color-muted: ${config.dark_mode.colors?.muted || '#334155'};
      --color-border: ${config.dark_mode.colors?.border || '#334155'};
    }` : ''}
  `;
}
```

### 3.3 Theme Customization Tiers

| Feature | Free | Starter | Business | Enterprise |
|---|---|---|---|---|
| Choose from template gallery | ✅ | ✅ | ✅ | ✅ |
| Color overrides (primary, accent) | ✅ | ✅ | ✅ | ✅ |
| Font selection (20 Google Fonts) | ✅ | ✅ | ✅ | ✅ |
| Layout settings (columns, width) | — | ✅ | ✅ | ✅ |
| Dark mode toggle | — | ✅ | ✅ | ✅ |
| Animation controls | — | ✅ | ✅ | ✅ |
| Custom CSS injection | — | — | ✅ | ✅ |
| Custom JavaScript | — | — | — | ✅ |
| Full Craft.js page builder | — | ✅ | ✅ | ✅ |
| Custom fonts (upload) | — | — | ✅ | ✅ |
| Remove "Powered by LetBuyy" | — | — | ✅ | ✅ |

### 3.4 Theme Live Preview

```
Admin → Theme Customizer
          │
          ├── Color Picker Panel ──→ Real-time CSS variable updates
          ├── Font Selector Panel ──→ Google Fonts API injection
          ├── Layout Controls ──→ Grid/spacing recalculation
          └── Preview Pane ──→ Iframe with storefront rendered
                │
                ├── Desktop view (default)
                ├── Tablet view (768px)
                └── Mobile view (375px)
```

---

## 4. Template Gallery

### 4.1 Available Templates

| Template | Site Types | Aesthetic | Key Features |
|---|---|---|---|
| **Aurora** | Store, Landing | Modern, gradient-based | Glassmorphism cards, animated hero, floating CTAs |
| **Zenith** | Store, Portfolio | Clean, professional | Full-width imagery, minimal typography, whitespace-heavy |
| **Craft** | Portfolio, Resume | Creative, bold | Masonry grid, case study layouts, client logo wall |
| **Ember** | Store | Luxury, dark | Dark theme, gold accents, large product imagery |
| **Blossom** | Store, Landing | Soft, organic | Rounded shapes, pastel palette, nature-inspired |
| **Slate** | Portfolio, Resume | Developer-focused | Monospace accents, terminal aesthetics, GitHub integration |
| **Nova** | Store, Landing | Vibrant, energetic | Neon gradients, animated backgrounds, bold CTAs |
| **Pebble** | Resume | Minimal, ATS-ready | Clean hierarchy, print-optimized, PDF-aligned |
| **Horizon** | Landing, Blog | Content-focused | Reading-optimized typography, magazine-style layout |
| **Summit** | Store | Premium, editorial | Large hero images, lookbook-style product showcase |
| **Bamboo** | Blog, Landing | Warm, storytelling | Serif typography, earth tones, longform content |
| **Circuit** | Portfolio | Tech-focused | Grid layout, code snippets, project spotlight |

### 4.2 Template Structure

Each template consists of:

```
templates/
├── aurora/
│   ├── template.json          # Metadata (name, preview, site_types)
│   ├── theme.json             # Default ThemeConfig
│   ├── layouts/
│   │   ├── header.tsx         # Header component
│   │   ├── footer.tsx         # Footer component
│   │   ├── hero.tsx           # Hero section
│   │   └── sidebar.tsx        # Sidebar (if applicable)
│   ├── pages/
│   │   ├── home.json          # Craft.js serialized home page
│   │   ├── about.json         # About page layout
│   │   └── contact.json       # Contact page layout
│   ├── components/
│   │   ├── ProductCard.tsx    # Product card variant
│   │   ├── BlogCard.tsx       # Blog card variant
│   │   └── TestimonialCard.tsx
│   └── preview/
│       ├── desktop.webp       # Preview for template gallery
│       ├── mobile.webp        # Mobile preview
│       └── detail.webp        # Detailed showcase
```

### 4.3 Template Selection Flow

```
1. Onboarding (Step 3: "Pick a Template")
     │
     ▼
2. Template gallery grid with live previews
     │
     ├── Filter by site type (Store, Portfolio, Resume, etc.)
     ├── Filter by style (Modern, Minimal, Bold, etc.)
     └── Search by name
     │
     ▼
3. Click template → Full-page preview (desktop + mobile)
     │
     ▼
4. "Use This Template" → Clones default ThemeConfig + Craft.js pages
     │
     ▼
5. Customize in Admin → Theme Customizer + Page Builder
```

---

## 5. Page Builder (Craft.js)

> The visual drag-and-drop page builder is available on Starter+ plans and allows store owners to customize their storefront pages without code.

### 5.1 Architecture

```
Admin Dashboard → Page Editor
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                   Craft.js Editor                              │
│  ┌───────────┐  ┌────────────────────────┐  ┌────────────┐  │
│  │ Component │  │     Canvas / Preview    │  │  Property  │  │
│  │  Sidebar  │  │                        │  │   Panel    │  │
│  │           │  │  [Rendered Page]        │  │            │  │
│  │ • Hero    │  │                        │  │ • Text     │  │
│  │ • Text    │  │  ┌──────────────────┐  │  │ • Color    │  │
│  │ • Image   │  │  │  Drag-and-drop   │  │  │ • Spacing  │  │
│  │ • Product │  │  │  components      │  │  │ • Layout   │  │
│  │ • Grid    │  │  │  here            │  │  │ • Link     │  │
│  │ • Button  │  │  └──────────────────┘  │  │ • Image    │  │
│  │ • Form    │  │                        │  │            │  │
│  │ • Video   │  │                        │  │            │  │
│  │ • Spacer  │  │                        │  │            │  │
│  └───────────┘  └────────────────────────┘  └────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  [Desktop] [Tablet] [Mobile]  │  [Undo] [Redo] [Save] │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
         │
         ▼  (on Save)
    Serialize to JSON → Store in `pages.content` (JSONB)
         │
         ▼  (on Storefront load)
    Deserialize JSON → Render React components (SSR)
```

### 5.2 Serialized Page Format

```json
{
  "ROOT": {
    "type": { "resolvedName": "Container" },
    "isCanvas": true,
    "props": { "padding": 0 },
    "nodes": ["hero-1", "features-1", "cta-1"]
  },
  "hero-1": {
    "type": { "resolvedName": "HeroSection" },
    "props": {
      "title": "Welcome to Style Hub",
      "subtitle": "Premium fashion, curated for you",
      "cta_text": "Shop Now",
      "cta_url": "/products",
      "background_image": "https://r2.letbuyy.store/...",
      "overlay_opacity": 0.4,
      "height": "70vh",
      "text_alignment": "center"
    },
    "parent": "ROOT"
  },
  "features-1": {
    "type": { "resolvedName": "FeatureGrid" },
    "isCanvas": true,
    "props": { "columns": 3, "gap": 24, "padding": 48 },
    "nodes": ["feature-card-1", "feature-card-2", "feature-card-3"],
    "parent": "ROOT"
  }
}
```

### 5.3 Available Page Builder Components

| Component | Description | Properties |
|---|---|---|
| **Container** | Layout wrapper | padding, background, max-width, flex direction |
| **HeroSection** | Full-width hero | title, subtitle, CTA, background image, overlay |
| **TextBlock** | Rich text content | content (markdown), alignment, max-width |
| **ImageBlock** | Single image | src, alt, width, height, border-radius, link |
| **ImageGallery** | Multi-image grid | images[], columns, gap, lightbox |
| **ProductGrid** | Auto-populated product grid | source (all/collection/manual), columns, count |
| **ProductCarousel** | Horizontal scrolling products | source, auto-play, speed |
| **CollectionGrid** | Collection showcase | collections[], layout (grid/list) |
| **TestimonialCarousel** | Customer testimonials | testimonials[], auto-play, style |
| **CTABanner** | Call-to-action section | title, subtitle, button text, button URL, background |
| **ButtonBlock** | Standalone button | text, url, variant (primary/outline/ghost), size |
| **VideoEmbed** | YouTube/Vimeo embed | url, autoplay, aspect-ratio |
| **Spacer** | Vertical spacing | height (px or responsive) |
| **Divider** | Horizontal line | style (solid/dashed/gradient), margin |
| **ContactForm** | Contact form | fields[], submit text, success message |
| **NewsletterSignup** | Email capture | headline, placeholder, button text |
| **SocialLinks** | Social media icons | platforms[], style (icon/button), alignment |
| **CountdownTimer** | Event countdown | target_date, expired_message |
| **LogoWall** | Client/brand logos | logos[], grayscale, columns |
| **PricingTable** | Pricing comparison | plans[], highlighted_plan |
| **FAQAccordion** | FAQ section | items[], initially_open |
| **BlogPreview** | Latest blog posts | count, layout (grid/list) |
| **MapEmbed** | Google Maps | location, zoom, height |
| **CustomHTML** | Raw HTML (Business+) | html, sandbox |

---

## 6. Component Library

> All storefront components follow a consistent design system driven by CSS Custom Properties from the theme engine.

### 6.1 Base Components

| Component | Description | Variants |
|---|---|---|
| `<Button>` | Action button | primary, secondary, outline, ghost, destructive, link |
| `<Badge>` | Status/label tag | default, success, warning, error, info |
| `<Card>` | Content container | default, hover-lift, bordered, glass |
| `<Input>` | Form text input | default, search, with-icon, error-state |
| `<Select>` | Dropdown select | native, custom, multi-select |
| `<Textarea>` | Multi-line input | default, auto-resize |
| `<Avatar>` | User/brand image | xs, sm, md, lg, xl, with-status |
| `<Toast>` | Notification popup | success, error, info, warning |
| `<Modal>` | Dialog overlay | small, medium, large, full-screen |
| `<Skeleton>` | Loading placeholder | text, image, card, product-card |
| `<Breadcrumb>` | Navigation trail | separator (slash, chevron, dot) |
| `<Tabs>` | Tab navigation | default, pill, underline |
| `<Dropdown>` | Menu dropdown | default, nested, with-icons |

### 6.2 E-Commerce Components

| Component | Description | Properties |
|---|---|---|
| `<ProductCard>` | Product grid item | image, title, price, compare_at, rating, badge |
| `<ProductGallery>` | Image viewer | images[], zoom, thumbnails, lightbox |
| `<VariantSelector>` | Size/color picker | options[], selected, style (button/dropdown/color-swatch) |
| `<PriceDisplay>` | Price + sale formatting | price, compare_at, currency, badge |
| `<QuantityPicker>` | +/- quantity input | min, max, step, value |
| `<AddToCartButton>` | Add to cart CTA | product, variant, loading, success-animation |
| `<CartDrawer>` | Slide-out cart panel | items[], subtotal, checkout-url |
| `<CartItem>` | Single cart line item | image, title, variant, price, quantity, remove |
| `<ReviewStars>` | Star rating display | rating, count, size, interactive |
| `<ReviewCard>` | Customer review | author, rating, text, date, verified |
| `<CollectionBanner>` | Collection hero | title, description, image, product-count |
| `<WishlistButton>` | Heart toggle | product_id, initial_state, requires_auth |
| `<StockBadge>` | Availability indicator | stock, threshold (In Stock, Low Stock, Out of Stock) |

### 6.3 Portfolio Components

| Component | Description | Properties |
|---|---|---|
| `<ProjectCard>` | Portfolio project | title, thumbnail, tags, link, hover-preview |
| `<ProjectDetail>` | Project case study | title, images, description, tech-stack, links |
| `<SkillBar>` | Skill proficiency | name, level (0-100), animated |
| `<SkillCloud>` | Tag cloud of skills | skills[], max_font_size |
| `<TimelineItem>` | Experience/education | title, company, dates, description, logo |
| `<TestimonialBlock>` | Client testimonial | quote, author, role, avatar, company_logo |
| `<EndorsementBadge>` | Skill endorsement | skill, endorser, count |
| `<ContactSection>` | Contact info + form | email, phone, location, social, form_fields |

### 6.4 Resume Components

| Component | Description | Properties |
|---|---|---|
| `<ResumeHeader>` | Name, title, links | name, title, location, email, phone, links[] |
| `<ResumeSection>` | Collapsible section | title, icon, children |
| `<ExperienceBlock>` | Work experience | company, role, dates, bullets[], logo |
| `<EducationBlock>` | Education entry | school, degree, dates, gpa, achievements |
| `<SkillList>` | Categorized skills | categories[{ name, skills[] }] |
| `<CertificationBadge>` | Certification | name, issuer, date, verification_url |
| `<DownloadButton>` | PDF download CTA | version_id, format, filename |
| `<ATSScoreBadge>` | ATS score display | score, grade, color |

---

## 7. E-Commerce Storefront Layout

### 7.1 Homepage Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER                                                       │
│  [Logo]    Home   Products   Collections   Blog   [🔍] [🛒3] │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    HERO SECTION                           │ │
│  │              ┌─────────────────────┐                      │ │
│  │              │  Background Image   │                      │ │
│  │              │  with overlay        │                      │ │
│  │              │                     │                      │ │
│  │              │  "New Season,       │                      │ │
│  │              │   New Style"        │                      │ │
│  │              │                     │                      │ │
│  │              │  [Shop Now →]       │                      │ │
│  │              └─────────────────────┘                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  FEATURED PRODUCTS                              [View All →]   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐│
│  │   📷       │  │   📷       │  │   📷       │  │   📷     ││
│  │            │  │            │  │   SALE     │  │          ││
│  │ Prod Name  │  │ Prod Name  │  │ Prod Name  │  │ Prod Name││
│  │ ⭐⭐⭐⭐ (24)│  │ ⭐⭐⭐⭐⭐(12)│  │ ₹599 ₹899  │  │ ₹1,499  ││
│  │ ₹999      │  │ ₹1,499    │  │ -33%      │  │          ││
│  │ [Add 🛒]  │  │ [Add 🛒]  │  │ [Add 🛒]  │  │ [Add 🛒] ││
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘│
│                                                                │
│  COLLECTIONS                                                   │
│  ┌────────────────────────────┐  ┌────────────────────────┐   │
│  │    📷 Summer Collection    │  │    📷 Basics           │   │
│  │    23 products             │  │    45 products          │   │
│  │    [Browse →]              │  │    [Browse →]           │   │
│  └────────────────────────────┘  └────────────────────────┘   │
│                                                                │
│  CUSTOMER REVIEWS                                              │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  ⭐⭐⭐⭐⭐ "Amazing quality! Will buy again"          │     │
│  │  — Priya S. | Verified Purchase                      │     │
│  └──────────────────────────────────────────────────────┘     │
│  ← auto-scrolling carousel →                                  │
│                                                                │
│  NEWSLETTER SIGNUP                                             │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Get 10% off your first order!                        │     │
│  │  [your@email.com          ] [Subscribe →]             │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                │
│  FOOTER                                                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Shop        Company       Help          Follow Us       │ │
│  │  Products    About         Shipping      Instagram       │ │
│  │  Collections Terms         Returns       Twitter         │ │
│  │  Sale        Privacy       FAQ           Facebook        │ │
│  │                                                           │ │
│  │  [Razorpay] [Visa] [Mastercard] [UPI]                    │ │
│  │  © 2026 Fashion Hub • Powered by LetBuyy                 │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Product Listing Page

```
Breadcrumb: Home > Products > Fashion

┌──────────────────────────────────────────────────────────────┐
│  SIDEBAR (Desktop)          │  PRODUCT GRID                   │
│                             │                                  │
│  Categories                 │  67 products   Sort: [Newest ▾] │
│  ☐ All (67)                │                                  │
│  ☐ T-Shirts (23)           │  ┌────────┐ ┌────────┐ ┌──────┐│
│  ☐ Jeans (15)              │  │  📷    │ │  📷    │ │  📷  ││
│  ☐ Dresses (12)            │  │ Name   │ │ Name   │ │ Name ││
│  ☐ Accessories (17)        │  │ ₹999   │ │ ₹1499  │ │ ₹599 ││
│                             │  └────────┘ └────────┘ └──────┘│
│  Price Range                │  ┌────────┐ ┌────────┐ ┌──────┐│
│  ₹0 ━━━━━●━━━━ ₹5,000     │  │  📷    │ │  📷    │ │  📷  ││
│                             │  │ Name   │ │ Name   │ │ Name ││
│  Size                       │  │ ₹1299  │ │ ₹799   │ │ ₹899 ││
│  [S] [M] [L] [XL]          │  └────────┘ └────────┘ └──────┘│
│                             │                                  │
│  Color                      │  [Load More →]                  │
│  ● ● ● ● ● ●              │                                  │
│                             │                                  │
│  Rating                     │                                  │
│  ☐ ⭐⭐⭐⭐⭐ & up           │                                  │
│  ☐ ⭐⭐⭐⭐ & up             │                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Portfolio Storefront Layout

### 8.1 Homepage Layout

```
┌──────────────────────────────────────────────────────────────┐
│  NAVIGATION                                                   │
│  [Name]      Work     About     Skills     Contact            │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  HERO SECTION                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │    👤 Avatar (round, 120px)                               │ │
│  │                                                           │ │
│  │    Hi, I'm John Doe                                       │ │
│  │    Senior Software Engineer                               │ │
│  │                                                           │ │
│  │    I build beautiful, performant web applications         │ │
│  │    with modern technologies.                              │ │
│  │                                                           │ │
│  │    [View My Work ↓]   [Contact Me →]                      │ │
│  │                                                           │ │
│  │    [ GitHub ] [ LinkedIn ] [ Twitter ] [ Dribbble ]       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  FEATURED PROJECTS                                [All Work →] │
│  ┌──────────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │                  │  │            │  │                  │  │
│  │  Project Alpha   │  │ Proj Beta  │  │  Project Gamma   │  │
│  │                  │  │            │  │                  │  │
│  │  React • Node    │  │ Flutter    │  │  Python • ML     │  │
│  │  [Case Study →]  │  │            │  │  [Live Demo →]   │  │
│  └──────────────────┘  ├────────────┤  └──────────────────┘  │
│                        │ Proj Delta │                         │
│                        │            │                         │
│                        │ Swift      │                         │
│                        └────────────┘                         │
│                                                                │
│  SKILLS                                                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Frontend                                                 │ │
│  │  React     ██████████████████████████████████████ 95%     │ │
│  │  TypeScript ████████████████████████████████████ 90%      │ │
│  │  Next.js   █████████████████████████████████ 85%          │ │
│  │                                                           │ │
│  │  Backend                                                  │ │
│  │  Node.js   █████████████████████████████████ 85%          │ │
│  │  Python    ████████████████████████████ 75%               │ │
│  │  PostgreSQL ██████████████████████████████ 80%            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  TESTIMONIALS                               ← swipe carousel → │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  "John delivered our project ahead of schedule           │ │
│  │   with exceptional quality. Highly recommended."         │ │
│  │                                                           │ │
│  │  — Sarah Chen, CTO @ TechCorp                            │ │
│  │  🏢 [TechCorp Logo]                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  CONTACT                                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Let's work together                                      │ │
│  │                                                           │ │
│  │  [Name        ]  [Email           ]                       │ │
│  │  [Message                                              ]  │ │
│  │  [                                                     ]  │ │
│  │  [Send Message →]                                         │ │
│  │                                                           │ │
│  │  📧 john@example.com  📍 San Francisco, CA               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  FOOTER (minimal)                                              │
│  © 2026 John Doe • Built with LetBuyy                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Resume Storefront Layout

### 9.1 Online Resume Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER (sticky, minimal)                                     │
│  [Name]                 [Download PDF ↓]  [Dark/Light 🌙]    │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    JOHN DOE                               │ │
│  │          Senior Software Engineer                         │ │
│  │          San Francisco, CA                                │ │
│  │                                                           │ │
│  │  📧 john@email.com  📱 +1-555-0123  🌐 johndoe.dev      │ │
│  │  [LinkedIn] [GitHub] [Portfolio]                           │ │
│  │                                                           │ │
│  │  ATS Score: 92/100  ⭐ Grade: A                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ABOUT ─────────────────────────────────────────────────────── │
│  Result-oriented software engineer with 8+ years of           │
│  experience building scalable web applications. Expertise     │
│  in React, Node.js, and cloud architecture.                   │
│                                                                │
│  EXPERIENCE ────────────────────────────────────────────────── │
│                                                                │
│  🏢 TechCorp                                                  │
│  Lead Software Engineer                     Jan 2024 – Present│
│  • Led team of 8 engineers, shipping 3 major features         │
│  • Reduced page load time by 40% through code splitting       │
│  • Architected microservices migration (monolith → k8s)       │
│                                                                │
│  🏢 StartupXYZ                                                │
│  Senior Developer                           Mar 2022 – Dec 2023
│  • Built real-time analytics dashboard (React + D3.js)        │
│  • Implemented OAuth2 + RBAC for 50k+ users                   │
│  • Mentored 4 junior developers                               │
│                                                                │
│  EDUCATION ─────────────────────────────────────────────────── │
│                                                                │
│  🎓 Massachusetts Institute of Technology                     │
│  B.S. Computer Science            GPA: 3.8/4.0   2018 – 2022 │
│                                                                │
│  SKILLS ────────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Languages:  TypeScript • Python • Go • Rust              │ │
│  │  Frontend:   React • Next.js • Vue • Tailwind CSS         │ │
│  │  Backend:    Node.js • FastAPI • PostgreSQL • Redis        │ │
│  │  DevOps:     AWS • Docker • Kubernetes • Terraform         │ │
│  │  Tools:      Git • CI/CD • Figma • Jira                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  CERTIFICATIONS ────────────────────────────────────────────── │
│  ✅ AWS Solutions Architect – Associate (2025)                 │
│  ✅ Google Cloud Professional Data Engineer (2024)             │
│                                                                │
│  FOOTER                                                        │
│  Last updated: Feb 14, 2026 • Powered by LetBuyy              │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Landing Page Layout

### 10.1 Marketing Landing Page

```
┌──────────────────────────────────────────────────────────────┐
│  NAVIGATION (transparent → solid on scroll)                   │
│  [Logo]   Features   Pricing   Testimonials   [Get Started →]│
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  HERO (full viewport, gradient background)                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │          The Future of E-Commerce                         │ │
│  │          Starts Here                                      │ │
│  │                                                           │ │
│  │  Launch your online store in 5 minutes.                   │ │
│  │  No coding required. Free to start.                       │ │
│  │                                                           │ │
│  │  [Start Free Trial →]      [Watch Demo ▶]                │ │
│  │                                                           │ │
│  │  ✓ No credit card    ✓ 14-day trial    ✓ Cancel anytime  │ │
│  │                                                           │ │
│  │          [Product Screenshot / Mockup]                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  SOCIAL PROOF BAR                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Trusted by 10,000+ store owners across India             │ │
│  │  [ Logo ] [ Logo ] [ Logo ] [ Logo ] [ Logo ] [ Logo ]   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  FEATURES (3-column grid)                                      │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐    │
│  │  🎨 Beautiful  │ │  🤖 AI-Powered  │ │  📊 Analytics  │    │
│  │  Themes        │ │  Content       │ │  Dashboard     │    │
│  │  description   │ │  description   │ │  description   │    │
│  └────────────────┘ └────────────────┘ └────────────────┘    │
│                                                                │
│  HOW IT WORKS (numbered steps)                                 │
│  1. Create your store → 2. Add products → 3. Start selling    │
│                                                                │
│  PRICING TABLE                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Free    │  │ ★Starter │  │ Business │  │Enterprise│    │
│  │  ₹0/mo   │  │  ₹799/mo │  │ ₹1,999/mo│  │ ₹4,999/mo│    │
│  │  5 prod  │  │ 500 prod │  │ Unlimited│  │ Unlimited│    │
│  │         │  │  AI tools │  │ + custom │  │ + API    │    │
│  │ [Start] │  │ [Start]  │  │ [Start]  │  │ [Contact]│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                                │
│  TESTIMONIALS (carousel)                                       │
│  ⭐⭐⭐⭐⭐  "Best platform for my fashion business!"           │
│         — Priya Sharma, Fashion Hub                            │
│                                                                │
│  FINAL CTA                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         Ready to launch your store?                       │ │
│  │         [Get Started for Free →]                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  FOOTER                                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Blog Layout

### 11.1 Blog Listing Page

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER (inherited from store theme)                          │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Blog                                                          │
│  "Latest articles, tips, and updates"                          │
│                                                                │
│  Categories: [All] [Fashion] [Tips] [Trends] [Guides]         │
│                                                                │
│  FEATURED POST (full-width)                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  📷 Cover Image                  │  Apr 12, 2026         │ │
│  │                                   │  Fashion Trends       │ │
│  │                                   │                       │ │
│  │                                   │  "10 Summer Fashion   │ │
│  │                                   │   Trends for 2026"    │ │
│  │                                   │                       │ │
│  │                                   │  Discover the hottest │ │
│  │                                   │  trends this season.. │ │
│  │                                   │  [Read More →]        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  RECENT POSTS (3-column grid)                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │  📷        │  │  📷        │  │  📷        │              │
│  │ Title      │  │ Title      │  │ Title      │              │
│  │ 5 min read │  │ 3 min read │  │ 8 min read │              │
│  │ Mar 28     │  │ Mar 15     │  │ Mar 8      │              │
│  └────────────┘  └────────────┘  └────────────┘              │
│                                                                │
│  [Load More →]                                                 │
│                                                                │
│  FOOTER                                                        │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Blog Post Page

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER                                                       │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Breadcrumb: Blog > Fashion Trends                             │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    COVER IMAGE                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────── max-w-prose ─────────────────────┐ │
│  │                                                           │ │
│  │  Fashion Trends                          5 min read       │ │
│  │                                                           │ │
│  │  10 Summer Fashion Trends for 2026                        │ │
│  │  ═══════════════════════════════════                      │ │
│  │                                                           │ │
│  │  Published: Apr 12, 2026                                  │ │
│  │                                                           │ │
│  │  [Article content with rich typography...]                 │ │
│  │                                                           │ │
│  │  ## Heading 2                                             │ │
│  │  Paragraph text with **bold** and *italic*...             │ │
│  │                                                           │ │
│  │  > Blockquote — "Fashion is architecture..."              │ │
│  │                                                           │ │
│  │  [Inline image with caption]                              │ │
│  │                                                           │ │
│  │  ## Another Heading                                       │ │
│  │  More content...                                          │ │
│  │                                                           │ │
│  │  ─── SHARE ────────────────────────────                   │ │
│  │  [Twitter] [Facebook] [LinkedIn] [Copy Link]              │ │
│  │                                                           │ │
│  │  ─── RELATED POSTS ────────────────────                   │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐            │ │
│  │  │ Related 1  │ │ Related 2  │ │ Related 3  │            │ │
│  │  └────────────┘ └────────────┘ └────────────┘            │ │
│  │                                                           │ │
│  │  ─── COMMENTS ─────────────────────────                   │ │
│  │  [Write a comment...]                [Post →]             │ │
│  │                                                           │ │
│  │  💬 "Great article! Very helpful"                         │ │
│  │     — Priya S. | Apr 12, 2026                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  FOOTER                                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 12. Customer-Facing Pages

### 12.1 Auto-Generated Pages per Site Type

| Page | Store | Portfolio | Resume | Landing | Blog |
|---|---|---|---|---|---|
| Homepage (customizable via Page Builder) | ✅ | ✅ | ✅ | ✅ | ✅ |
| About | ✅ | ✅ | — | ✅ | ✅ |
| Contact | ✅ | ✅ | — | ✅ | ✅ |
| Products / Product Detail | ✅ | — | — | — | — |
| Collections / Collection Detail | ✅ | — | — | — | — |
| Projects / Project Detail | — | ✅ | — | — | — |
| Skills | — | ✅ | ✅ | — | — |
| Experience / Education | — | — | ✅ | — | — |
| Blog Listing / Blog Post | ✅ (optional) | ✅ (optional) | — | ✅ (optional) | ✅ |
| Cart | ✅ | — | — | — | — |
| Checkout | ✅ | — | — | — | — |
| Order Confirmation | ✅ | — | — | — | — |
| Order Tracking | ✅ | — | — | — | — |
| Terms of Service | ✅ | ✅ | ✅ | ✅ | ✅ |
| Privacy Policy | ✅ | ✅ | ✅ | ✅ | ✅ |
| FAQ (optional) | ✅ | — | — | ✅ | — |
| 404 Not Found | ✅ | ✅ | ✅ | ✅ | ✅ |

### 12.2 Custom Pages (Page Builder)

Store owners can create unlimited custom pages via the Craft.js page builder:

- URL slug customizable (e.g., `/summer-sale`, `/hire-me`, `/about-the-brand`)
- Full drag-and-drop component placement
- SEO metadata per page (title, description, OG image)
- Publish/unpublish per page
- Password protection (Business+ plans)

---

## 13. Cart & Checkout Experience

> See [05 E-Commerce Engine](./05_Ecommerce_Engine.md#5-checkout-flow) for backend checkout specification.

### 13.1 Cart Architecture

```
Customer adds product to cart
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Cart State Management                                        │
│                                                                │
│  ┌────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  Zustand   │ ←→  │ localStorage │ ←→  │  Server      │    │
│  │  (Client)  │     │ (Persist)    │     │  (Supabase)  │    │
│  └────────────┘     └──────────────┘     └──────────────┘    │
│                                                                │
│  Strategy:                                                     │
│  • Guest: localStorage only (cart_id in cookie)               │
│  • Logged in: sync to server, merge on login                  │
│  • Expiry: guest carts expire after 7 days                    │
│  • Max items: 50 items per cart                                │
└──────────────────────────────────────────────────────────────┘
```

### 13.2 Cart UX Flow

```
[Add to Cart] button clicked
       │
       ├── 1. Optimistic update → Zustand store
       ├── 2. Cart icon badge animates (+1)
       ├── 3. CartDrawer slides open from right
       │       │
       │       ├── Item list (image, title, variant, qty, price)
       │       ├── Quantity +/- controls
       │       ├── Remove item (swipe on mobile)
       │       ├── Subtotal calculation
       │       ├── Coupon code input
       │       ├── AI recommendation: "Customers also bought..."
       │       └── [Checkout →] button
       │
       └── 4. Sync to server (debounced, 500ms)
```

### 13.3 Checkout Flow

```
Cart → Checkout Page
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  CHECKOUT (3-step or single-page based on theme)              │
│                                                                │
│  Step 1: Contact & Shipping                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Email: [customer@example.com]                            │ │
│  │  Full Name: [Priya Sharma]                                │ │
│  │  Phone: [+919876543210]                                   │ │
│  │                                                           │ │
│  │  Shipping Address:                                        │ │
│  │  [Address Line 1]                                         │ │
│  │  [Address Line 2]                                         │ │
│  │  [City]  [State ▾]  [PIN Code]                            │ │
│  │  [Country: India ▾]                                       │ │
│  │                                                           │ │
│  │  ☐ Save address for future orders                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Step 2: Shipping Method                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ○ Standard Delivery — ₹40 (5-7 days)                    │ │
│  │  ● Express Delivery — ₹99 (2-3 days)                     │ │
│  │  ○ Free Delivery — ₹0 (7-10 days) ← orders ≥₹500        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Step 3: Payment                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ● Razorpay (UPI, Cards, Wallets, NetBanking)            │ │
│  │  ○ Cash on Delivery                                       │ │
│  │                                                           │ │
│  │  [Review Order →]                                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ORDER SUMMARY (sidebar on desktop, collapsible on mobile)    │
│  ┌────────────────────────────────────────┐                   │
│  │  📷 Premium T-Shirt (M/Black) × 2  ₹1,198                │
│  │  📷 Summer Dress (S/Red) × 1        ₹1,299                │
│  │                                                           │ │
│  │  Subtotal:                       ₹2,497                   │ │
│  │  Shipping (Express):               ₹99                   │ │
│  │  Discount (SUMMER20):             -₹200                   │ │
│  │  ─────────────────────────────────────                    │ │
│  │  Total:                         ₹2,396                   │ │
│  │                                                           │ │
│  │  [Place Order — ₹2,396 →]                                │ │
│  └────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### 13.4 Post-Checkout

```
Payment Successful
       │
       ├── 1. Order confirmation page
       │       ├── Order number (FAS-00042)
       │       ├── Estimated delivery date
       │       ├── Order summary
       │       └── [Continue Shopping →]
       │
       ├── 2. Email confirmation
       │       ├── Receipt with line items
       │       ├── Tracking link (when shipped)
       │       └── Store contact info
       │
       └── 3. Webhooks fired
               ├── order.created → store owner
               └── payment.received → store owner
```

---

## 14. Product Detail Page

### 14.1 Layout

```
Breadcrumb: Home > Fashion > T-Shirts > Premium Cotton T-Shirt

┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌──────────────────────┐  ┌────────────────────────────────┐│
│  │                      │  │                                ││
│  │  ┌────────────────┐  │  │  Premium Cotton T-Shirt        ││
│  │  │                │  │  │  ⭐⭐⭐⭐⭐ (24 reviews)         ││
│  │  │  Main Product  │  │  │                                ││
│  │  │  Image         │  │  │  ₹599  ₹899  -33% OFF         ││
│  │  │  (Pinch-zoom)  │  │  │                                ││
│  │  │                │  │  │  Color:                        ││
│  │  └────────────────┘  │  │  [⚫] [⚪] [🔵]                ││
│  │                      │  │                                ││
│  │  Thumbnails:         │  │  Size:                         ││
│  │  [📷][📷][📷][📷]   │  │  [S] [M] [●L] [XL]            ││
│  │                      │  │                                ││
│  │                      │  │  ✅ In Stock (45 units)         ││
│  │                      │  │  🚚 Delivers by Feb 19-21      ││
│  │                      │  │                                ││
│  │                      │  │  Quantity: [-] 1 [+]           ││
│  │                      │  │                                ││
│  │                      │  │  [Add to Cart 🛒]  [Buy Now →] ││
│  │                      │  │  [♡ Add to Wishlist]           ││
│  │                      │  │                                ││
│  │                      │  │  📦 Free delivery on ₹500+     ││
│  │                      │  │  🔄 7-day easy returns         ││
│  │                      │  │  🔒 Secure payment (SSL)       ││
│  └──────────────────────┘  └────────────────────────────────┘│
│                                                                │
│  TABS                                                          │
│  [Description] [Reviews (24)] [Shipping] [Size Guide]         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Product description with rich text...                    │ │
│  │  • 100% premium combed cotton                             │ │
│  │  • 180 GSM fabric weight                                  │ │
│  │  • Pre-shrunk, soft wash finish                           │ │
│  │  • Machine washable                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  CUSTOMER REVIEWS                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Overall: ⭐⭐⭐⭐⭐ 4.7/5 (24 reviews)                    │ │
│  │                                                           │ │
│  │  ⭐⭐⭐⭐⭐ — 18  ████████████████████                     │ │
│  │  ⭐⭐⭐⭐  — 4   ████                                      │ │
│  │  ⭐⭐⭐   — 2   ██                                         │ │
│  │                                                           │ │
│  │  [Write a Review →]                                       │ │
│  │                                                           │ │
│  │  ─── Priya S. ⭐⭐⭐⭐⭐ ✅ Verified Purchase ──────────── │ │
│  │  "Amazing quality! The fabric is so soft and the fit      │ │
│  │   is perfect. Already ordered more colors."               │ │
│  │  Feb 10, 2026                                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  YOU MAY ALSO LIKE (AI-recommended)                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────┐ │
│  │ Related 1  │  │ Related 2  │  │ Related 3  │  │ Rel 4  │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 14.2 Product Image Gallery Features

| Feature | Implementation |
|---|---|
| **Main image** | Large, high-quality with zoom-on-hover (desktop) |
| **Thumbnail navigation** | Click to swap, active indicator |
| **Zoom** | Pinch-to-zoom (mobile), hover-zoom lens (desktop) |
| **Lightbox** | Full-screen image viewer on click |
| **Swipe** | Left/right swipe between images (mobile) |
| **Video** | Inline product video support in gallery |
| **3D view** | 360° product rotation (if images provided) |
| **Lazy loading** | Only load visible thumbnails initially |

---

## 15. Search & Filtering

### 15.1 Search Architecture

```
Customer types in search bar
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Instant Search (debounced 300ms)                             │
│                                                                │
│  ┌──────────────────────────────────────┐                     │
│  │  🔍 "cotton t-shirt"                 │                     │
│  └──────────────────────────────────────┘                     │
│                                                                │
│  Dropdown Results:                                             │
│  ┌──────────────────────────────────────┐                     │
│  │  Products                            │                     │
│  │  📷 Premium Cotton T-Shirt — ₹599    │                     │
│  │  📷 Organic Cotton Polo — ₹799       │                     │
│  │  📷 Cotton V-Neck — ₹499             │                     │
│  │                                      │                     │
│  │  Collections                         │                     │
│  │  🏷️ Cotton Essentials                │                     │
│  │                                      │                     │
│  │  Blog                                │                     │
│  │  📄 "Why Cotton Is the Best..."      │                     │
│  │                                      │                     │
│  │  [View all results for "cotton..." →]│                     │
│  └──────────────────────────────────────┘                     │
│                                                                │
│  Strategy:                                                     │
│  • Supabase full-text search (tsvector on title + description)│
│  • Trigram similarity for fuzzy matching                       │
│  • Results ranked by relevance + popularity                    │
│  • Search analytics → top searches, zero-result queries       │
└──────────────────────────────────────────────────────────────┘
```

### 15.2 Filter System

| Filter Type | Implementation | UX |
|---|---|---|
| **Category** | Sidebar checkboxes | Multi-select, hierarchical |
| **Price range** | Dual-handle slider | Min/max with text inputs |
| **Size** | Button group | Toggle buttons (S, M, L, XL) |
| **Color** | Color swatches | Circular color dots |
| **Rating** | Star checkboxes | "4★ & up" format |
| **In stock** | Toggle switch | Show only available items |
| **Tags** | Chips | Multi-select tags |
| **Brand** | Checkbox list | Alphabetical with search |
| **Sort by** | Dropdown | Price, newest, best-selling, rating |

### 15.3 URL-Based Filtering

Filters are reflected in the URL for shareability and SEO:

```
/products?category=fashion&min_price=500&max_price=2000&size=M,L&sort=price_asc&page=2
```

---

## 16. SEO Engine

### 16.1 SEO Feature Matrix

| Feature | Free | Starter | Business | Enterprise |
|---|---|---|---|---|
| Dynamic meta tags (title, description) | ✅ | ✅ | ✅ | ✅ |
| Auto-generated sitemap.xml | ✅ | ✅ | ✅ | ✅ |
| Robots.txt (default) | ✅ | ✅ | ✅ | ✅ |
| Canonical URLs | ✅ | ✅ | ✅ | ✅ |
| JSON-LD structured data | — | ✅ | ✅ | ✅ |
| Open Graph + Twitter Cards | — | ✅ | ✅ | ✅ |
| Custom meta per page | — | ✅ | ✅ | ✅ |
| AI-generated SEO metadata | — | ✅ | ✅ | ✅ |
| AI alt text for images | — | ✅ | ✅ | ✅ |
| Custom robots.txt | — | — | ✅ | ✅ |
| Redirect rules (301/302) | — | — | ✅ | ✅ |
| Google Search Console integration | — | — | ✅ | ✅ |

### 16.2 Structured Data (JSON-LD)

**Product Page:**

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Premium Cotton T-Shirt",
  "description": "Soft premium cotton fabric...",
  "image": ["https://r2.letbuyy.store/products/img1.webp"],
  "sku": "TCT-001",
  "brand": {
    "@type": "Brand",
    "name": "Fashion Hub"
  },
  "offers": {
    "@type": "Offer",
    "price": "599.00",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "Fashion Hub"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "24"
  }
}
```

**Organization:**

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Fashion Hub",
  "url": "https://fashionhub.letbuyy.store",
  "logo": "https://r2.letbuyy.store/logos/fashionhub.webp",
  "sameAs": [
    "https://instagram.com/fashionhub",
    "https://twitter.com/fashionhub"
  ]
}
```

**Breadcrumbs:**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://fashionhub.letbuyy.store" },
    { "@type": "ListItem", "position": 2, "name": "Fashion", "item": "https://fashionhub.letbuyy.store/categories/fashion" },
    { "@type": "ListItem", "position": 3, "name": "Premium Cotton T-Shirt" }
  ]
}
```

**Blog Post:**

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "10 Summer Fashion Trends for 2026",
  "datePublished": "2026-04-12",
  "author": { "@type": "Person", "name": "Fashion Hub" },
  "image": "https://r2.letbuyy.store/blog/cover.webp",
  "publisher": {
    "@type": "Organization",
    "name": "Fashion Hub",
    "logo": { "@type": "ImageObject", "url": "https://r2.letbuyy.store/logos/fashionhub.webp" }
  }
}
```

### 16.3 Sitemap Generation

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>https://fashionhub.letbuyy.store/</loc>
    <lastmod>2026-02-14</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- Products -->
  <url>
    <loc>https://fashionhub.letbuyy.store/products/premium-cotton-t-shirt</loc>
    <lastmod>2026-02-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- Collections -->
  <url>
    <loc>https://fashionhub.letbuyy.store/collections/summer-sale</loc>
    <lastmod>2026-02-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <!-- Blog Posts -->
  <url>
    <loc>https://fashionhub.letbuyy.store/blog/fashion-trends-summer-2026</loc>
    <lastmod>2026-04-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

### 16.4 Meta Tag Generation

```typescript
// lib/seo/generate-meta.ts
export function generateMeta(page: PageData, store: StoreData): Metadata {
  const title = page.seo_title || `${page.title} | ${store.name}`;
  const description = page.seo_description || page.excerpt || store.description;
  const url = `https://${store.custom_domain || `${store.subdomain}.letbuyy.store`}${page.path}`;
  const image = page.og_image || page.cover_image || store.banner_url;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: store.name,
      images: image ? [{ url: image, width: 1200, height: 630 }] : [],
      type: page.type === 'product' ? 'product' : 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
    robots: page.noindex ? { index: false, follow: true } : undefined,
  };
}
```

---

## 17. Performance & Core Web Vitals

### 17.1 Performance Targets

| Metric | Target | Strategy |
|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | SSR, priority image hints, preload hero image |
| **INP** (Interaction to Next Paint) | < 200ms | Selective hydration, minimal JS, web workers |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Fixed image dimensions, font-display: swap, skeleton loaders |
| **TTFB** (Time to First Byte) | < 200ms | Edge rendering, ISR cache, CDN |
| **FCP** (First Contentful Paint) | < 1.8s | Server-side rendering, inline critical CSS |
| **Lighthouse Score** | > 90 | Comprehensive optimization across all categories |

### 17.2 Performance Optimization Stack

```
┌──────────────────────────────────────────────────────────────┐
│  Optimization Layer                                            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  BUILD TIME                                               │ │
│  │  • Tree-shaking + code splitting (Next.js automatic)      │ │
│  │  • Image optimization (next/image → WebP at build)        │ │
│  │  • CSS purging (remove unused styles)                     │ │
│  │  • Font subsetting (Google Fonts optimized)               │ │
│  │  • Component lazy loading (React.lazy + Suspense)         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  EDGE NETWORK                                             │ │
│  │  • Vercel Edge Network (global PoPs)                      │ │
│  │  • ISR with on-demand revalidation                        │ │
│  │  • Stale-while-revalidate caching                         │ │
│  │  • Brotli/gzip compression                                │ │
│  │  • HTTP/3 + QUIC                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  RUNTIME                                                  │ │
│  │  • Selective hydration (only interactive components)       │ │
│  │  • Intersection Observer (lazy load below-fold sections)  │ │
│  │  • requestIdleCallback (defer non-critical work)          │ │
│  │  • Service Worker (offline product browsing — future)     │ │
│  │  • Prefetch links on hover (next/link automatic)          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  MONITORING                                               │ │
│  │  • Vercel Analytics (Core Web Vitals)                     │ │
│  │  • Real User Monitoring (RUM)                             │ │
│  │  • Lighthouse CI in deployment pipeline                   │ │
│  │  • Alerts on CWV regression                               │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 17.3 Bundle Size Budget

| Category | Budget | Enforcement |
|---|---|---|
| First-load JS | < 100 KB (gzipped) | Next.js bundle analyzer |
| Per-page JS | < 50 KB (gzipped) | Code splitting boundaries |
| CSS | < 30 KB (gzipped) | CSS custom properties + minimal framework |
| Total images (above fold) | < 200 KB | WebP + responsive srcset |
| Third-party scripts | < 50 KB | Defer all, lazy load analytics |

### 17.4 Caching Strategy

| Resource | Cache-Control | CDN TTL | Revalidation |
|---|---|---|---|
| HTML pages (ISR) | `public, s-maxage=300, stale-while-revalidate=600` | 5 min | On-demand webhook |
| CSS/JS bundles | `public, max-age=31536000, immutable` | 1 year | Content-hashed filenames |
| Product images | `public, max-age=86400` | 24 hours | On re-upload |
| Font files | `public, max-age=31536000, immutable` | 1 year | Version in URL |
| API responses | `private, no-cache` | — | Real-time |
| Sitemap | `public, max-age=3600` | 1 hour | Hourly cron |

---

## 18. Image & Media Pipeline

### 18.1 Upload-to-Delivery Pipeline

```
Store owner uploads image
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  1. Upload via API (multipart/form-data)                      │
│     └── Validation: max 10MB, jpg/png/webp/gif/svg            │
│                                                                │
│  2. Processing (Cloudflare Workers)                            │
│     ├── EXIF data extraction + stripping (privacy)            │
│     ├── Generate variants:                                     │
│     │   ├── thumbnail: 150×150 (product grid)                 │
│     │   ├── small: 400×400 (mobile product card)              │
│     │   ├── medium: 800×800 (product detail)                  │
│     │   ├── large: 1200×1200 (lightbox / hero)                │
│     │   └── og: 1200×630 (Open Graph share image)             │
│     ├── Convert to WebP (with JPEG fallback)                   │
│     └── Apply AI enhancement (optional, if enabled)           │
│                                                                │
│  3. Storage (Cloudflare R2)                                    │
│     └── Path: /{store_id}/products/{product_id}/{variant}.webp│
│                                                                │
│  4. CDN Delivery                                               │
│     └── URL: r2.letbuyy.store/{path}                          │
│     └── Cache-Control: public, max-age=86400                  │
│                                                                │
│  5. Rendering (Next.js `<Image>`)                              │
│     ├── Automatic srcset generation                           │
│     ├── Lazy loading (below fold)                              │
│     ├── Priority loading (hero/first product image)           │
│     ├── Blur placeholder (LQIP — Low Quality Image Placeholder)│
│     └── Responsive sizes attribute                             │
└──────────────────────────────────────────────────────────────┘
```

### 18.2 Image Component Usage

```tsx
// components/storefront/ProductImage.tsx
import Image from 'next/image';

interface Props {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
}

export function ProductImage({ src, alt, priority = false, sizes }: Props) {
  const r2Loader = ({ src, width, quality }: { src: string; width: number; quality?: number }) => {
    return `https://r2.letbuyy.store/${src}?w=${width}&q=${quality || 80}&format=webp`;
  };

  return (
    <Image
      loader={r2Loader}
      src={src}
      alt={alt}
      width={800}
      height={800}
      priority={priority}
      placeholder="blur"
      blurDataURL={`https://r2.letbuyy.store/${src}?w=20&q=10`}
      sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
      className="object-cover rounded-md"
    />
  );
}
```

### 18.3 AI Image Enhancement (Gemini)

| Feature | Trigger | Implementation |
|---|---|---|
| **Background removal** | Product photo upload | Remove background → transparent or solid color |
| **Auto-enhance** | Low-quality image detected | Adjust brightness, contrast, sharpness |
| **Alt text generation** | Image uploaded without alt | Gemini API → descriptive alt text |
| **OG image generation** | New page/product created | Compose branded share image from template |
| **Smart crop** | Image doesn't match aspect ratio | AI-guided crop to maintain key content |

---

## 19. Mobile Responsiveness & PWA

### 19.1 Responsive Breakpoints

| Breakpoint | Width | Target Devices |
|---|---|---|
| `xs` | < 480px | Small phones |
| `sm` | 480–639px | Large phones |
| `md` | 640–767px | Small tablets, landscape phones |
| `lg` | 768–1023px | Tablets |
| `xl` | 1024–1279px | Small laptops |
| `2xl` | ≥ 1280px | Desktops, large screens |

### 19.2 Mobile-First Design Patterns

| Pattern | Desktop | Mobile |
|---|---|---|
| **Navigation** | Horizontal nav bar | Hamburger → slide-out drawer |
| **Product grid** | 3-4 columns | 2 columns (stacked) |
| **Cart** | Drawer from right | Full-screen bottom sheet |
| **Filters** | Left sidebar | Bottom sheet with "Apply" button |
| **Image gallery** | Thumbnails below | Swipe carousel |
| **Checkout** | 2-column (form + summary) | Single column, collapsible summary |
| **Footer** | Multi-column | Accordion sections |
| **Search** | Inline search bar | Full-screen search overlay |
| **Tabs** | Horizontal tabs | Scrollable tabs / accordion |

### 19.3 Mobile-Specific Features

```
┌─────────────────────────────────────────┐
│  Mobile Navigation (Drawer)              │
│                                          │
│  [✕ Close]                               │
│                                          │
│  Home                                    │
│  Products →                              │
│     Fashion                              │
│     Electronics                          │
│     Accessories                          │
│  Collections →                           │
│  Blog                                    │
│  About                                   │
│  Contact                                 │
│                                          │
│  ─────────────────────────               │
│  [🔍 Search]                             │
│  [🛒 Cart (3)]                           │
│  [👤 Account]                            │
│                                          │
│  ─────────────────────────               │
│  [Instagram] [Twitter] [Facebook]        │
└─────────────────────────────────────────┘
```

### 19.4 PWA Configuration

```json
// apps/web/storefront/public/manifest.json
{
  "name": "Fashion Hub",
  "short_name": "FashionHub",
  "description": "Premium fashion, curated for you",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#6366F1",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/screenshots/home.webp", "sizes": "1280x720", "type": "image/webp", "form_factor": "wide" },
    { "src": "/screenshots/home-mobile.webp", "sizes": "750x1334", "type": "image/webp", "form_factor": "narrow" }
  ]
}
```

| PWA Feature | Status | Notes |
|---|---|---|
| Installable (A2HS) | ✅ Phase 1 | Manifest + service worker |
| Offline browsing | 🔮 Phase 2 | Cache product catalog for offline viewing |
| Push notifications | 🔮 Phase 2 | Order updates, sale alerts |
| Background sync | 🔮 Phase 3 | Sync cart when back online |
| Share target | 🔮 Phase 3 | Share products from other apps |

---

## 20. Accessibility (a11y)

### 20.1 WCAG 2.1 AA Compliance

| Category | Requirement | Implementation |
|---|---|---|
| **Perceivable** | Alt text for all images | AI-generated alt text fallback, required for product images |
| **Perceivable** | Color contrast ratio ≥ 4.5:1 | Theme engine validates contrast in customizer |
| **Perceivable** | Text resizable to 200% | rem/em units, fluid typography scale |
| **Perceivable** | Captions for video content | Required for media uploads |
| **Operable** | Full keyboard navigation | Focus styles, skip-to-content link, tab order |
| **Operable** | No keyboard traps | Modal focus management, Escape to close |
| **Operable** | Sufficient click/tap targets | Minimum 44×44px touch targets |
| **Operable** | Reduced motion support | `prefers-reduced-motion` media query |
| **Understandable** | Form labels + error messages | Associated labels, inline validation errors |
| **Understandable** | Consistent navigation | Same nav structure across all pages |
| **Robust** | Semantic HTML | Proper heading hierarchy, landmark regions |
| **Robust** | ARIA attributes | `aria-labels`, `role`, `aria-live` for dynamic content |

### 20.2 Accessibility Implementation

```tsx
// components/storefront/SkipToContent.tsx
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 
                 focus:z-[9999] focus:bg-white focus:px-4 focus:py-2 focus:rounded
                 focus:shadow-lg focus:text-sm focus:font-semibold"
    >
      Skip to main content
    </a>
  );
}
```

```css
/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Focus styles (never suppress) */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### 20.3 Automated Accessibility Testing

| Tool | Integration Point | Checks |
|---|---|---|
| **axe-core** | CI/CD pipeline (Lighthouse CI) | WCAG 2.1 AA violations |
| **eslint-plugin-jsx-a11y** | Build-time | Missing alt, invalid ARIA, no-autofocus |
| **Pa11y** | Post-deploy smoke test | Full page scan for violations |
| **Manual testing** | Quarterly | Keyboard-only navigation, screen reader (VoiceOver/NVDA) |

---

## 21. Analytics & Tracking

### 21.1 Built-in Analytics (Admin Dashboard)

Store owners access analytics from the admin dashboard:

| Metric | Source | Update Frequency |
|---|---|---|
| **Page views** | Server-side event logging | Real-time |
| **Unique visitors** | Session-based tracking (cookie) | Real-time |
| **Top pages** | Path aggregation | Hourly |
| **Top products (views)** | Product detail page views | Hourly |
| **Conversion rate** | Orders ÷ visitors | Daily |
| **Cart abandonment rate** | Carts created vs. orders completed | Daily |
| **Average order value** | Revenue ÷ orders | Daily |
| **Revenue** | Order totals | Real-time |
| **Search queries** | Search bar inputs | Real-time |
| **Zero-result searches** | Searches with no results | Real-time |
| **Traffic sources** | Referrer header / UTM params | Hourly |
| **Device breakdown** | User-Agent parsing | Hourly |

### 21.2 Third-Party Analytics Support

| Platform | Integration | Plans |
|---|---|---|
| **Google Analytics 4** | `<Script>` injection via store settings | Starter+ |
| **Facebook Pixel** | Standard events (ViewContent, AddToCart, Purchase) | Starter+ |
| **Google Tag Manager** | Container ID injection | Business+ |
| **Custom scripts** | `<head>` or `<body>` script injection | Business+ |

### 21.3 E-Commerce Event Tracking

```typescript
// lib/analytics/events.ts
export const trackEvent = (event: AnalyticsEvent) => {
  // Built-in analytics
  fetch('/api/analytics/event', {
    method: 'POST',
    body: JSON.stringify(event),
  });

  // Google Analytics 4
  if (typeof gtag !== 'undefined') {
    gtag('event', event.name, event.params);
  }

  // Facebook Pixel
  if (typeof fbq !== 'undefined') {
    fbq('track', event.fbEventName, event.fbParams);
  }
};

// Standard e-commerce events
type AnalyticsEvent =
  | { name: 'view_item'; params: { item_id: string; item_name: string; price: number } }
  | { name: 'add_to_cart'; params: { item_id: string; quantity: number; value: number } }
  | { name: 'begin_checkout'; params: { value: number; item_count: number } }
  | { name: 'purchase'; params: { transaction_id: string; value: number; items: CartItem[] } }
  | { name: 'search'; params: { search_term: string; results_count: number } }
  | { name: 'view_collection'; params: { collection_id: string; item_count: number } };
```

### 21.4 UTM Parameter Support

All storefront pages automatically parse and store UTM parameters:

```
https://fashionhub.letbuyy.store/products/t-shirt
  ?utm_source=instagram
  &utm_medium=social
  &utm_campaign=summer_sale
  &utm_content=story_ad
```

Stored in session → attributed to orders if purchase occurs.

---

## 22. Document History

| Version | Date | Changes |
|---|---|---|
| 6.0 | Feb 14, 2026 | Major expansion — 22 sections, theme engine schema, page builder, component library, all site-type layouts, SEO engine, performance stack, image pipeline, accessibility, analytics |
| 5.0 | Feb 14, 2026 | Initial version — 8 sections, basic architecture, wireframes, theme config |

---

> **Next:** [11 Super Admin & Team](./11_Super_Admin_and_Team.md) — Platform management, team tools, console

---

*[← Back to Index](./README.md)*
