# LetBuyy Platform — Storefront Landing & Community Hub

> **Doc 17 of 17** | Root Landing Page, Store Finder, Community Showcase, Platform Stats & Middleware Integration
>
> **Version:** 1.0 | **Date:** February 17, 2026
>
> **Prev:** [16 Customer Management](./16_Customer_Management.md) | **Next:** —

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Current State Analysis](#2-current-state-analysis)
3. [Middleware Routing & Root Page Resolution](#3-middleware-routing--root-page-resolution)
4. [Landing Page Architecture](#4-landing-page-architecture)
5. [Store Finder — Search & Redirect Engine](#5-store-finder--search--redirect-engine)
6. [Community Showcase — Store Grid](#6-community-showcase--store-grid)
7. [Platform Statistics Engine](#7-platform-statistics-engine)
8. [Database Queries & Data Layer](#8-database-queries--data-layer)
9. [API Endpoints — Complete Reference](#9-api-endpoints--complete-reference)
10. [Component Architecture](#10-component-architecture)
11. [Server Component — Data Fetching](#11-server-component--data-fetching)
12. [Client Component — Interactive UI](#12-client-component--interactive-ui)
13. [CSS Design System — Landing Page](#13-css-design-system--landing-page)
14. [Desktop Layout Wireframe (1440px)](#14-desktop-layout-wireframe-1440px)
15. [Mobile Layout Wireframe (390px)](#15-mobile-layout-wireframe-390px)
16. [Store Card — Detailed Specification](#16-store-card--detailed-specification)
17. [Store Finder State Machine](#17-store-finder-state-machine)
18. [Animation & Micro-Interaction Specification](#18-animation--micro-interaction-specification)
19. [Theme Badge Mapping](#19-theme-badge-mapping)
20. [Email Masking Algorithm](#20-email-masking-algorithm)
21. [SEO & Open Graph](#21-seo--open-graph)
22. [Performance & Core Web Vitals](#22-performance--core-web-vitals)
23. [Accessibility (a11y)](#23-accessibility-a11y)
24. [Error Handling & Edge Cases](#24-error-handling--edge-cases)
25. [Security Considerations](#25-security-considerations)
26. [Testing Strategy](#26-testing-strategy)
27. [File Reference Index](#27-file-reference-index)
28. [Document History](#28-document-history)

---

# PART 1 — Architecture, Routing & Data Layer

---

## 1. System Architecture Overview

> **Cross-ref:** [10_Storefront_and_Themes §1 — Storefront Architecture](./10_Storefront_and_Themes.md) | [01_Architecture §2 — Infrastructure Layers](./01_Architecture.md) | [09_API_Reference §1 — API Overview](./09_API_Reference.md)

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│              LetBuyy Storefront Landing — Full Architecture                       │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          ENTRY POINTS                                        │ │
│  │                                                                               │ │
│  │  1. letbuyy-storefront.vercel.app/     → Root landing page                  │ │
│  │  2. *.letbuyy.store (no subdomain)     → Root landing page                  │ │
│  │  3. localhost:3000/                     → Root landing page (dev)            │ │
│  │                                                                               │ │
│  │  vs.                                                                          │ │
│  │                                                                               │ │
│  │  4. {store}.letbuyy.store              → Store storefront (existing)         │ │
│  │  5. localhost:3000/store/{subdomain}    → Store storefront (dev path)        │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                         │
│                                         ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          MIDDLEWARE LAYER (Edge)                              │ │
│  │                                                                               │ │
│  │  middleware.ts                                                                │ │
│  │  ┌───────────────────────────────────────────────────────────────────────┐  │ │
│  │  │ 1. Check X-Store-Subdomain / X-Forwarded-Host headers (CF Worker)  │  │ │
│  │  │ 2. Extract subdomain from *.letbuyy.store                           │  │ │
│  │  │ 3. Extract subdomain from *.localhost (dev)                         │  │ │
│  │  │ 4. Vercel direct access → show root page                           │  │ │
│  │  │                                                                     │  │ │
│  │  │ If subdomain found:  → rewrite to /store/{subdomain}/{path}        │  │ │
│  │  │ If root path (/):    → show landing page (NEW)                     │  │ │
│  │  │ If store route:      → fallback to demo store (dev only)           │  │ │
│  │  └───────────────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                         │
│                              ┌──────────┴──────────┐                             │
│                              ▼                     ▼                              │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │   ROOT LANDING PAGE (NEW)        │  │   STORE STOREFRONT (EXISTING)        │ │
│  │                                   │  │                                      │ │
│  │   page.tsx (Server Component)     │  │   /store/[subdomain]/page.tsx       │ │
│  │   ├── Fetch recent stores         │  │   ├── Theme engine                  │ │
│  │   ├── Fetch platform stats        │  │   ├── Product grid                  │ │
│  │   ├── Fetch theme metadata        │  │   ├── Cart & checkout              │ │
│  │   └── Render <StorefrontLanding>  │  │   └── Customer auth               │ │
│  │                                   │  │                                      │ │
│  │   storefront-landing.tsx (Client)│  │   (Unchanged — no modifications)    │ │
│  │   ├── Store Finder (search)       │  │                                      │ │
│  │   ├── Community Grid (cards)      │  └──────────────────────────────────────┘ │
│  │   ├── Platform Stats (counters)   │                                           │
│  │   └── Footer CTA                 │                                           │
│  └──────────────────────────────────┘                                           │
│                                         │                                         │
│                                         ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          API LAYER                                            │ │
│  │                                                                               │ │
│  │  /api/store-lookup?q={name}    GET — Search store by name/subdomain         │ │
│  │  ├── Validates input (min 3 chars, alphanumeric)                             │ │
│  │  ├── Queries sites table (subdomain OR store_name ILIKE)                    │ │
│  │  ├── Returns { status, store } or { status: "not_found" }                   │ │
│  │  └── Rate-limited (10 req/min per IP)                                       │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                         │
│                                         ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          DATA LAYER (Supabase)                                │ │
│  │                                                                               │ │
│  │  ┌──────────────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │ │
│  │  │ sites                    │  │ users_custom       │  │ products        │  │ │
│  │  │ • store_name             │  │ • full_name        │  │ • COUNT(*)      │  │ │
│  │  │ • subdomain              │  │ • email            │  │                 │  │ │
│  │  │ • name (display)         │  │ • id               │  └─────────────────┘  │ │
│  │  │ • logo_url               │  └───────────────────┘                         │ │
│  │  │ • theme_id               │  ┌───────────────────┐  ┌─────────────────┐  │ │
│  │  │ • status                 │  │ orders             │  │ online_store_   │  │ │
│  │  │ • site_type              │  │ • COUNT(*)         │  │ themes          │  │ │
│  │  │ • custom_user_id (FK)    │  │                   │  │ • COUNT(*)      │  │ │
│  │  │ • created_at             │  └───────────────────┘  └─────────────────┘  │ │
│  │  └──────────────────────────┘                                                │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Feature Scope — Landing Page vs Existing Storefront

| Aspect | Existing Store Pages | New Landing Page |
|---|---|---|
| **URL** | `{store}.letbuyy.store` | Root domain (no subdomain) |
| **Purpose** | Individual store shopping | Platform discovery & community |
| **Rendering** | ISR/SSR with theme engine | SSR server component + client interactivity |
| **Auth** | Customer auth (JWT cookie) | None required |
| **Data source** | Single store's products/config | All stores aggregated |
| **Theme** | Per-store CSS custom properties | Fixed platform dark theme |
| **Navigation** | Store header/footer/cart | Platform navbar only |
| **SEO** | Product/collection pages | Platform-level discovery page |

### 1.3 Key Design Principles

| Principle | Description |
|---|---|
| **Zero-Auth Discovery** | Landing page requires no login — fully public, SEO-optimized |
| **Community-First** | Showcases real stores built by real users — social proof for the platform |
| **Privacy-Respecting** | Store owner emails are masked (first 2 chars + dots + domain) |
| **Store-Agnostic** | Uses platform branding, not any individual store's theme |
| **Progressive Enhancement** | Server-renders the community grid; client-enhances search & animations |
| **No Demo Fallback at Root** | Middleware change ensures `/` shows landing, not demo store |
| **Draft Visibility** | Draft stores appear with a "DRAFT" badge — encourages launches |
| **Theme Attribution** | Each store card shows which LetBuyy theme powers it |

---

## 2. Current State Analysis

### 2.1 Existing Root Page

The current `storefront/src/app/page.tsx` is a 22-line placeholder:

```tsx
// CURRENT — apps/web/consumer/storefront/src/app/page.tsx
export default function Home() {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <div style={{ textAlign: 'center' }}>
                <h1>LetBuyy Storefront</h1>
                <p>Welcome to the LetBuyy storefront platform</p>
            </div>
        </div>
    );
}
```

**Problems:**
- No branding, no design system applied
- No store discovery functionality
- No community showcase
- No SEO metadata
- No links to create a store or explore themes
- Bare inline styles — no CSS architecture

### 2.2 Existing Middleware Behavior

```
localhost:3000/ (no subdomain)
      │
      ▼
middleware.ts → hostname.includes('localhost')
      │
      ├── path === `/cart`, `/checkout`, etc. → rewrite to /store/demo/...
      ├── path === `/`                        → rewrite to /store/demo (PROBLEM!)
      └── else                                → show root page

The PROBLEM: On localhost, the root path `/` is rewritten to the demo store,
meaning the new landing page would NEVER show in development.

FIX: Exclude path === '/' from the demo fallback:
- if (isStoreRoute) {
+ if (isStoreRoute && path !== '/') {
```

### 2.3 Available Data Sources

| Data | Table | Key Columns | Used For |
|---|---|---|---|
| Store list | `sites` | `store_name`, `subdomain`, `name`, `logo_url`, `theme_id`, `status`, `site_type`, `created_at`, `custom_user_id` | Community grid |
| Store owners | `users_custom` | `full_name`, `email`, `id` | Owner attribution (masked) |
| Products count | `products` | `COUNT(*)` | Platform stats |
| Orders count | `orders` | `COUNT(*)` | Platform stats |
| Themes count | `online_store_themes` | `COUNT(*)` | Platform stats |

---

## 3. Middleware Routing & Root Page Resolution

> **Cross-ref:** [10_Storefront_and_Themes §2 — URL Routing & DNS](./10_Storefront_and_Themes.md)

### 3.1 Complete Middleware Flow (Updated)

```
Request arrives at Next.js Edge Middleware
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 1: Skip /api, /_next, /_static, static files          │
│  (via matcher config)                                         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 2: Direct path access check                             │
│  if path starts with /store/ and has ≥2 segments             │
│  → Allow through (for testing: /store/dohi)                  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 3: Subdomain extraction (priority order)               │
│                                                               │
│  3a. X-Store-Subdomain header (Cloudflare Worker)            │
│  3b. X-Forwarded-Host *.letbuyy.store header                 │
│  3c. hostname *.letbuyy.store (direct subdomain)             │
│  3d. hostname *.localhost (dev subdomain)                     │
│                                                               │
│  If subdomain found → rewrite to /store/{subdomain}/{path}  │
└──────────────────────────┬───────────────────────────────────┘
                           │ (no subdomain found)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 4: Vercel direct access                                 │
│  if hostname includes 'vercel.app'                           │
│  → path === '/' → show root landing page (NextResponse.next)│
│  → else → allow through                                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 5: Localhost development fallback                       │
│  if hostname includes 'localhost'                            │
│                                                               │
│  Store routes: /cart, /checkout, /product, /products, etc.   │
│                                                               │
│  OLD: if (isStoreRoute) → rewrite to /store/demo/...        │
│  NEW: if (isStoreRoute && path !== '/') → rewrite to demo   │ ← CHANGE
│                                                               │
│  path === '/' → show root landing page (falls through)       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 6: No store found                                       │
│  → NextResponse.next() → renders root page.tsx               │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Middleware Code Change

```diff
// apps/web/consumer/storefront/src/middleware.ts

  // No store found — development fallback
  if (hostname.includes('localhost')) {
      const storeRoutes = ['/cart', '/checkout', '/product', '/products',
                           '/orders', '/shop', '/privacy', '/returns',
                           '/shipping', '/terms'];
      const isStoreRoute = path === '/' || storeRoutes.some(
          r => path === r || path.startsWith(r + '/')
      );

-     if (isStoreRoute) {
+     if (isStoreRoute && path !== '/') {
          const rewriteUrl = `/store/demo${path === '/' ? '' : path}`;
          console.log(`[Middleware] Dev fallback → ${rewriteUrl}`);
          return NextResponse.rewrite(new URL(rewriteUrl, req.url));
      }
  }
```

### 3.3 Route Resolution Matrix

| Host | Path | Result | Handler |
|---|---|---|---|
| `letbuyy-storefront.vercel.app` | `/` | Landing page | `page.tsx` (root) |
| `letbuyy-storefront.vercel.app` | `/store/dohi` | Store page | `/store/[subdomain]/page.tsx` |
| `dohi.letbuyy.store` | `/` | Store home | `/store/[subdomain]/page.tsx` |
| `dohi.letbuyy.store` | `/products` | Store products | `/store/[subdomain]/products/page.tsx` |
| `localhost:3000` | `/` | **Landing page (NEW)** | `page.tsx` (root) |
| `localhost:3000` | `/cart` | Demo store cart | `/store/demo/cart` (fallback) |
| `localhost:3000` | `/store/dohi` | Store page | `/store/[subdomain]/page.tsx` |
| `dohi.localhost:3000` | `/` | Store home | `/store/[subdomain]/page.tsx` |

---

## 4. Landing Page Architecture

### 4.1 Component Hierarchy

```
page.tsx (Server Component — RSC)
│
├── Fetches data from Supabase (service role key)
│   ├── Recent stores (sites + users_custom JOIN)
│   ├── Platform stats (COUNT queries)
│   └── Theme metadata
│
└── Renders <StorefrontLanding /> (Client Component)
    │
    ├── <Navbar />
    │   ├── LetBuyy logo (SVG)
    │   └── "Create Your Store →" CTA button
    │
    ├── <HeroSection />
    │   ├── Animated headline
    │   ├── Subheading text
    │   └── <StoreFinder />
    │       ├── Search input (debounced)
    │       ├── Status indicator (loading/found/not-found/invalid)
    │       └── "Visit Store" / "Create Your Own" CTAs
    │
    ├── <CommunityShowcase />
    │   ├── Section heading + "See All" link
    │   └── <StoreCard /> × N (4×2 grid desktop, 1-col mobile)
    │       ├── Logo or initial avatar
    │       ├── Store name + subdomain link
    │       ├── Masked owner email
    │       ├── Theme badge (color-coded)
    │       ├── Status badge (LIVE / DRAFT)
    │       ├── Relative time ("2h ago")
    │       └── "Visit Store →" link
    │
    ├── <PlatformStats />
    │   ├── Animated counter: Total Stores
    │   ├── Animated counter: Themes Available
    │   ├── Animated counter: Products Listed
    │   └── Animated counter: Orders Fulfilled
    │
    └── <FooterCTA />
        ├── "Ready to build your store?" heading
        ├── [Create Your Store →] button
        ├── [Browse Themes →] button
        └── Footer links (Terms, Privacy, © 2026)
```

### 4.2 Data Flow — Server to Client

```
┌──────────────────────────────────────────────────────────────────┐
│  page.tsx (Server Component — runs on server only)                │
│                                                                    │
│  1. Create Supabase admin client (SUPABASE_SERVICE_ROLE_KEY)     │
│                                                                    │
│  2. Fetch recent stores:                                          │
│     SELECT s.store_name, s.name, s.subdomain, s.logo_url,       │
│            s.theme_id, s.status, s.site_type, s.created_at,     │
│            u.full_name, u.email                                   │
│     FROM sites s                                                  │
│     LEFT JOIN users_custom u ON s.custom_user_id = u.id          │
│     WHERE s.status IN ('draft', 'published')                     │
│     ORDER BY s.created_at DESC                                   │
│     LIMIT 12                                                      │
│                                                                    │
│  3. Fetch platform stats:                                         │
│     a. SELECT COUNT(*) FROM sites WHERE status != 'suspended'    │
│     b. SELECT COUNT(*) FROM online_store_themes                  │
│     c. SELECT COUNT(*) FROM products                             │
│     d. SELECT COUNT(*) FROM orders                               │
│                                                                    │
│  4. Mask emails:                                                  │
│     saai.siddharth@gmail.com → sa••••••••@gmail.com              │
│                                                                    │
│  5. Pass serialized props to client component:                    │
│     <StorefrontLanding                                            │
│       stores={recentStores}                                       │
│       stats={platformStats}                                       │
│     />                                                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (serialized as JSON via RSC protocol)
┌──────────────────────────────────────────────────────────────────┐
│  storefront-landing.tsx (Client Component — hydrates on client)   │
│                                                                    │
│  1. Renders all sections with server-provided data                │
│  2. Manages store finder state (useState, useEffect)             │
│  3. Debounced search → GET /api/store-lookup?q={name}            │
│  4. Intersection Observer → trigger counter animations           │
│  5. Handles redirects to {subdomain}.letbuyy.store               │
└──────────────────────────────────────────────────────────────────┘
```


---

## 5. Store Finder — Search & Redirect Engine

> **Cross-ref:** [03_Onboarding_and_Trial §2 — Store Name Selection](./03_Onboarding_and_Trial.md)

### 5.1 Feature Overview

The Store Finder is a real-time search input that allows visitors to:
1. Type a store name or subdomain
2. See instant feedback (checking → found → not found)
3. Visit the store directly if found
4. Be directed to create a store if not found

### 5.2 Store Finder State Machine

```
                 ┌────────────────────┐
                 │       IDLE          │
                 │   Input is empty    │
                 │   No status shown   │
                 └────────┬───────────┘
                          │ user types ≥ 3 chars
                          ▼
                 ┌────────────────────┐
                 │    DEBOUNCING       │
                 │   300ms timer       │
                 │   Input has value   │
                 │   Previous results  │
                 │   cleared           │
                 └────────┬───────────┘
                          │ timer fires → API call
                          ▼
                 ┌────────────────────┐
                 │    CHECKING         │
                 │   ⏳ Spinner shown  │
                 │   "Checking..."     │
                 │   Input disabled    │
                 └────────┬───────────┘
                    ┌─────┴──────┐
                    ▼            ▼
            ┌─────────────┐ ┌──────────────────┐
            │   FOUND      │ │   NOT_FOUND       │
            │              │ │                    │
            │   ✅ Store   │ │   ❌ "xyzabc"    │
            │   is live!   │ │   not found.      │
            │              │ │                    │
            │   [Visit →]  │ │   [Create yours?] │
            │              │ │                    │
            │   Auto-      │ │   Link to         │
            │   redirect   │ │   accounts.       │
            │   in 3s      │ │   letbuyy.store   │
            └─────────────┘ └──────────────────┘
                    │            │
                    └─────┬──────┘
                          │ user clears input or types new query
                          ▼
                 ┌────────────────────┐
                 │       IDLE          │
                 └────────────────────┘

Additional states:
┌──────────────────────┐
│   INVALID             │
│   Input < 3 chars     │
│   or contains special │
│   characters          │
│   "Enter at least 3   │
│    characters"        │
└──────────────────────┘

┌──────────────────────┐
│   DRAFT_FOUND         │
│   Store exists but    │
│   is in draft status  │
│   "This store is      │
│    coming soon!"      │
│   [No visit link]     │
└──────────────────────┘
```

### 5.3 Search Logic — Client Side

```typescript
// Inside storefront-landing.tsx

type FinderStatus = 'idle' | 'debouncing' | 'checking' | 'found' | 'not_found' | 'invalid' | 'draft';

interface FinderState {
    status: FinderStatus;
    query: string;
    store: {
        name: string;
        subdomain: string;
        status: 'published' | 'draft';
    } | null;
}

// Debounce implementation
const [finderState, setFinderState] = useState<FinderState>({
    status: 'idle', query: '', store: null
});

useEffect(() => {
    if (finderState.query.length === 0) {
        setFinderState(prev => ({ ...prev, status: 'idle', store: null }));
        return;
    }

    if (finderState.query.length < 3) {
        setFinderState(prev => ({ ...prev, status: 'invalid', store: null }));
        return;
    }

    // Validate: only alphanumeric and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(finderState.query)) {
        setFinderState(prev => ({ ...prev, status: 'invalid', store: null }));
        return;
    }

    setFinderState(prev => ({ ...prev, status: 'debouncing' }));

    const timer = setTimeout(async () => {
        setFinderState(prev => ({ ...prev, status: 'checking' }));
        try {
            const res = await fetch(
                `/api/store-lookup?q=${encodeURIComponent(finderState.query)}`
            );
            const data = await res.json();

            if (data.status === 'found') {
                setFinderState(prev => ({
                    ...prev,
                    status: data.store.status === 'draft' ? 'draft' : 'found',
                    store: data.store
                }));
            } else {
                setFinderState(prev => ({
                    ...prev, status: 'not_found', store: null
                }));
            }
        } catch {
            setFinderState(prev => ({
                ...prev, status: 'not_found', store: null
            }));
        }
    }, 300);

    return () => clearTimeout(timer);
}, [finderState.query]);
```

### 5.4 Auto-Redirect Logic

```typescript
// When store is found and published, auto-redirect after 3 seconds
useEffect(() => {
    if (finderState.status === 'found' && finderState.store) {
        const redirectTimer = setTimeout(() => {
            // In production: redirect to {subdomain}.letbuyy.store
            // In development: redirect to /store/{subdomain}
            const isDev = window.location.hostname.includes('localhost');
            const url = isDev
                ? `/store/${finderState.store!.subdomain}`
                : `https://${finderState.store!.subdomain}.letbuyy.store`;
            window.location.href = url;
        }, 3000);

        return () => clearTimeout(redirectTimer);
    }
}, [finderState.status, finderState.store]);
```

---

## 6. Community Showcase — Store Grid

### 6.1 Data Structure

```typescript
interface StoreShowcase {
    storeName: string;        // s.store_name (unique subdomain identifier)
    displayName: string;      // s.name (human-readable display name)
    subdomain: string;        // s.store_name (used for URL)
    logoUrl: string | null;   // s.logo_url
    themeId: string | null;   // s.theme_id → maps to theme metadata
    status: 'draft' | 'published';
    siteType: string;         // 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'
    createdAt: string;        // ISO 8601 timestamp
    ownerName: string | null; // u.full_name (if available)
    ownerEmail: string;       // u.email → masked for display
    maskedEmail: string;      // Computed: "sa••••••••@gmail.com"
}
```

### 6.2 Grid Layout Specification

```
Desktop (≥1024px):  4 columns × 2 rows = 8 cards visible
Tablet (768-1023px): 3 columns × 2 rows = 6 cards visible
Mobile (<768px):     1 column, scrollable list = all cards visible
                     (each card is a horizontal row layout on mobile)

Gap between cards:   24px (desktop), 16px (mobile)
Card max-width:      320px (auto-fill in grid)
```

### 6.3 Grid Rendering

```tsx
<section className="landing-community">
    <div className="landing-community-header">
        <h2>Recently Launched</h2>
        <span className="landing-community-subtitle">
            See what the community is building
        </span>
    </div>
    <div className="landing-community-grid">
        {stores.map((store, index) => (
            <StoreCard
                key={store.subdomain}
                store={store}
                animationDelay={index * 0.1}
            />
        ))}
    </div>
</section>
```

### 6.4 Empty State

When no stores exist (edge case for fresh platforms):

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│        🚀                                                     │
│                                                                │
│        No stores launched yet.                                │
│        Be the first to create one!                            │
│                                                                │
│        [Create Your Store →]                                  │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Platform Statistics Engine

### 7.1 Stats Data Shape

```typescript
interface PlatformStats {
    totalStores: number;      // COUNT(*) from sites WHERE status != 'suspended'
    totalThemes: number;      // COUNT(*) from online_store_themes
    totalProducts: number;    // COUNT(*) from products
    totalOrders: number;      // COUNT(*) from orders
}
```

### 7.2 Animated Counter Implementation

```typescript
// useCountUp hook — intersection observer + requestAnimationFrame
function useCountUp(target: number, duration: number = 1500): {
    ref: RefObject<HTMLDivElement>;
    count: number;
} {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    // Animate from 0 to target
                    const startTime = performance.now();
                    const animate = (currentTime: number) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        // Ease-out cubic
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setCount(Math.floor(eased * target));
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        }
                    };
                    requestAnimationFrame(animate);
                    observer.unobserve(el);
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [target, duration]);

    return { ref, count };
}
```

### 7.3 Stats Display

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│     │     127       │  │       4       │  │    1,240     │    │
│     │   ───────     │  │   ───────     │  │   ───────    │    │
│     │   Stores      │  │   Themes      │  │   Products   │    │
│     │   Created     │  │   Available   │  │   Listed     │    │
│     └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                │
│     ┌──────────────┐                                          │
│     │      89       │                                          │
│     │   ───────     │                                          │
│     │   Orders      │                                          │
│     │   Fulfilled   │                                          │
│     └──────────────┘                                          │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 7.4 Number Formatting

```typescript
function formatNumber(n: number): string {
    if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
    if (n >= 1000) return n.toLocaleString('en-IN');
    return n.toString();
}
// 1240 → "1,240"
// 15000 → "15.0K"
// 89 → "89"
```

---

## 8. Database Queries & Data Layer

> **Cross-ref:** [08_Database_Schema §2 — Core Tables](./08_Database_Schema.md)

### 8.1 Recent Stores Query

```sql
-- Fetch recent stores with owner info for community showcase
-- Used in: page.tsx (Server Component)
-- Auth: Service role key (bypasses RLS)

SELECT
    s.store_name,                -- Unique subdomain identifier
    s.name,                      -- Human-readable display name
    s.logo_url,                  -- Store logo (R2 CDN URL or null)
    s.theme_id,                  -- e.g. 'urban-kicks', 'luxe-atelier'
    s.status,                    -- 'draft' | 'published'
    s.site_type,                 -- 'store' | 'portfolio' | 'resume' | etc.
    s.created_at,                -- ISO timestamp for relative time display
    u.full_name,                 -- Owner's name (nullable)
    u.email                      -- Owner's email (will be masked in UI)
FROM sites s
LEFT JOIN users_custom u ON s.custom_user_id = u.id
WHERE s.status IN ('draft', 'published')
  AND s.site_type = 'store'      -- Only show store-type sites on landing
ORDER BY s.created_at DESC
LIMIT 12;
```

### 8.2 Platform Stats Queries

```sql
-- Total stores (non-suspended)
SELECT COUNT(*)::int AS total_stores
FROM sites
WHERE status NOT IN ('suspended');

-- Total themes available
SELECT COUNT(*)::int AS total_themes
FROM online_store_themes;

-- Total products across all stores
SELECT COUNT(*)::int AS total_products
FROM products;

-- Total orders fulfilled
SELECT COUNT(*)::int AS total_orders
FROM orders;
```

### 8.3 Store Lookup Query (API)

```sql
-- Used by: /api/store-lookup?q={query}
-- Searches by exact subdomain match OR fuzzy store name match

SELECT
    store_name,
    name,
    status,
    site_type
FROM sites
WHERE (
    store_name = $1                     -- Exact subdomain match
    OR name ILIKE '%' || $1 || '%'      -- Fuzzy display name match
)
AND status NOT IN ('suspended')
ORDER BY
    CASE WHEN store_name = $1 THEN 0 ELSE 1 END,   -- Exact match first
    created_at DESC
LIMIT 1;
```

### 8.4 Supabase Client Usage

```typescript
// page.tsx — Server Component
import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS for aggregation queries
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Query with proper typing
const { data: stores } = await supabaseAdmin
    .from('sites')
    .select(`
        store_name,
        name,
        logo_url,
        theme_id,
        status,
        site_type,
        created_at,
        users_custom!sites_custom_user_id_fkey (
            full_name,
            email
        )
    `)
    .in('status', ['draft', 'published'])
    .eq('site_type', 'store')
    .order('created_at', { ascending: false })
    .limit(12);
```

---

## 9. API Endpoints — Complete Reference

### 9.1 GET `/api/store-lookup`

**Purpose:** Search for a store by name or subdomain. Powers the Store Finder on the landing page.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | ✅ | Store name or subdomain to search for |

**Response Schemas:**

```typescript
// Store found (published)
{
    "status": "found",
    "store": {
        "name": "Urban Kicks Store",
        "subdomain": "urbanstore",
        "status": "published",
        "siteType": "store"
    }
}

// Store found (draft)
{
    "status": "found",
    "store": {
        "name": "My New Shop",
        "subdomain": "mynewshop",
        "status": "draft",
        "siteType": "store"
    }
}

// Store not found
{
    "status": "not_found"
}

// Invalid query
{
    "status": "invalid",
    "message": "Store name must be at least 3 characters"
}
```

**Implementation:**

```typescript
// apps/web/consumer/storefront/src/app/api/store-lookup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();

    // Validation
    if (!query || query.length < 3) {
        return NextResponse.json({
            status: 'invalid',
            message: 'Store name must be at least 3 characters'
        });
    }

    if (!/^[a-zA-Z0-9-]+$/.test(query)) {
        return NextResponse.json({
            status: 'invalid',
            message: 'Store name can only contain letters, numbers, and hyphens'
        });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Search: exact subdomain match first, then fuzzy name match
    const { data } = await supabase
        .from('sites')
        .select('store_name, name, status, site_type')
        .or(`store_name.eq.${query},name.ilike.%${query}%`)
        .not('status', 'eq', 'suspended')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (data) {
        return NextResponse.json({
            status: 'found',
            store: {
                name: data.name,
                subdomain: data.store_name,
                status: data.status,
                siteType: data.site_type
            }
        });
    }

    return NextResponse.json({ status: 'not_found' });
}
```

**Rate Limiting (Future):**

| Limit | Value | Scope |
|---|---|---|
| Requests per minute | 10 | Per IP address |
| Requests per hour | 100 | Per IP address |
| Burst limit | 5 | Concurrent requests |


---

# PART 2 — Component Implementation & UI Specification

---

## 10. Component Architecture

### 10.1 File Structure

```
storefront/src/app/
├── page.tsx                          ← [REWRITE] Server component — data fetching
├── storefront-landing.tsx            ← [NEW] Client component — all landing UI
├── storefront-landing.css            ← [NEW] Complete CSS design system for landing
└── api/
    └── store-lookup/
        └── route.ts                  ← [NEW] Store search API endpoint
```

### 10.2 Component Responsibility Matrix

| Component | Type | Responsibility | Props |
|---|---|---|---|
| `page.tsx` | Server (RSC) | Fetch stores + stats from DB, mask emails, render client component | — |
| `StorefrontLanding` | Client | All interactive UI, store finder, animations | `stores`, `stats` |
| `StoreCard` | Presentational | Single store card in community grid | `store`, `animationDelay` |
| `StoreFinder` | Stateful Client | Search input, debounce, API calls, status display | — |
| `PlatformStats` | Client | Animated counters with intersection observer | `stats` |
| `Navbar` | Presentational | Logo + CTA button | — |
| `FooterCTA` | Presentational | Final call-to-action + footer links | — |

### 10.3 TypeScript Interfaces

```typescript
// ─── Data Types ───────────────────────────────────────────────

export interface StoreShowcase {
    storeName: string;
    displayName: string;
    subdomain: string;
    logoUrl: string | null;
    themeId: string | null;
    status: 'draft' | 'published';
    siteType: string;
    createdAt: string;
    ownerName: string | null;
    maskedEmail: string;
}

export interface PlatformStats {
    totalStores: number;
    totalThemes: number;
    totalProducts: number;
    totalOrders: number;
}

export interface StorefrontLandingProps {
    stores: StoreShowcase[];
    stats: PlatformStats;
}

// ─── Store Finder Types ───────────────────────────────────────

export type FinderStatus =
    | 'idle'
    | 'debouncing'
    | 'checking'
    | 'found'
    | 'not_found'
    | 'invalid'
    | 'draft';

export interface FinderResult {
    name: string;
    subdomain: string;
    status: 'published' | 'draft';
    siteType: string;
}

export interface FinderState {
    status: FinderStatus;
    query: string;
    store: FinderResult | null;
}

// ─── Theme Metadata Types ─────────────────────────────────────

export interface ThemeMeta {
    id: string;
    label: string;
    color: string;
    icon: string;
}

export const THEME_META: Record<string, ThemeMeta> = {
    'urban-kicks':    { id: 'urban-kicks',    label: 'Urban Kicks',    color: '#ef4444', icon: '👟' },
    'luxe-atelier':   { id: 'luxe-atelier',   label: 'Luxe Atelier',   color: '#d4af37', icon: '💎' },
    'natures-basket': { id: 'natures-basket', label: "Nature's Basket", color: '#22c55e', icon: '🌿' },
    'neon-tech':      { id: 'neon-tech',      label: 'Neon Tech',      color: '#06b6d4', icon: '⚡' },
    'modern':         { id: 'modern',         label: 'Modern',         color: '#6366f1', icon: '✨' },
};
```

---

## 11. Server Component — Data Fetching

### 11.1 Complete `page.tsx` Implementation

```tsx
// apps/web/consumer/storefront/src/app/page.tsx

import { createClient } from '@supabase/supabase-js';
import StorefrontLanding from './storefront-landing';

// ─── Email Masking ─────────────────────────────────────────────
function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '••••@unknown';
    const visible = local.slice(0, 2);
    const masked = '••'.repeat(Math.min(Math.max(local.length - 2, 1), 5));
    return `${visible}${masked}@${domain}`;
}

// ─── Page Component ────────────────────────────────────────────
export default async function Home() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch recent stores with owner info
    const { data: storesRaw } = await supabase
        .from('sites')
        .select(`
            store_name,
            name,
            logo_url,
            theme_id,
            status,
            site_type,
            created_at,
            users_custom!sites_custom_user_id_fkey (
                full_name,
                email
            )
        `)
        .in('status', ['draft', 'published'])
        .order('created_at', { ascending: false })
        .limit(12);

    // 2. Fetch platform stats (parallel queries)
    const [storesCount, themesCount, productsCount, ordersCount] =
        await Promise.all([
            supabase.from('sites')
                .select('*', { count: 'exact', head: true })
                .not('status', 'eq', 'suspended'),
            supabase.from('online_store_themes')
                .select('*', { count: 'exact', head: true }),
            supabase.from('products')
                .select('*', { count: 'exact', head: true }),
            supabase.from('orders')
                .select('*', { count: 'exact', head: true }),
        ]);

    // 3. Transform data
    const stores = (storesRaw || []).map((s: any) => ({
        storeName: s.store_name,
        displayName: s.name || s.store_name,
        subdomain: s.store_name,
        logoUrl: s.logo_url,
        themeId: s.theme_id,
        status: s.status,
        siteType: s.site_type,
        createdAt: s.created_at,
        ownerName: s.users_custom?.full_name || null,
        maskedEmail: maskEmail(s.users_custom?.email || 'unknown@email.com'),
    }));

    const stats = {
        totalStores: storesCount.count || 0,
        totalThemes: themesCount.count || 0,
        totalProducts: productsCount.count || 0,
        totalOrders: ordersCount.count || 0,
    };

    return <StorefrontLanding stores={stores} stats={stats} />;
}
```

### 11.2 SEO Metadata

```tsx
// apps/web/consumer/storefront/src/app/page.tsx (alongside component)

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'LetBuyy — Discover Stores Built by the Community',
    description:
        'Explore stores, portfolios, and websites built on LetBuyy. ' +
        'Find your favorite store or create your own in minutes.',
    openGraph: {
        title: 'LetBuyy — Discover Stores Built by the Community',
        description: 'Explore the LetBuyy community. Find stores or create your own.',
        url: 'https://storefront.letbuyy.store',
        siteName: 'LetBuyy',
        type: 'website',
        images: [{
            url: 'https://storefront.letbuyy.store/og-landing.png',
            width: 1200,
            height: 630,
            alt: 'LetBuyy — Community Store Platform',
        }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'LetBuyy — Discover Stores Built by the Community',
        description: 'Explore the LetBuyy community. Find stores or create your own.',
    },
    robots: {
        index: true,
        follow: true,
    },
};
```

---

## 12. Client Component — Interactive UI

### 12.1 Complete `storefront-landing.tsx` Structure

```tsx
'use client';

import { useState, useEffect, useRef, type RefObject } from 'react';
import './storefront-landing.css';

// ─── Types (see §10.3) ─────────────────────────────────────────
// ... imported from shared types file or defined inline

// ─── Theme badge metadata ──────────────────────────────────────
const THEME_META: Record<string, { label: string; color: string }> = {
    'urban-kicks':    { label: 'Urban Kicks',    color: '#ef4444' },
    'luxe-atelier':   { label: 'Luxe Atelier',   color: '#d4af37' },
    'natures-basket': { label: "Nature's Basket", color: '#22c55e' },
    'neon-tech':      { label: 'Neon Tech',      color: '#06b6d4' },
    'modern':         { label: 'Modern',         color: '#6366f1' },
};

// ─── Utility: Relative Time ────────────────────────────────────
function timeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60)   return 'just now';
    if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', {
        month: 'short', day: 'numeric'
    });
}

// ─── Utility: Number Format ───────────────────────────────────
function formatStat(n: number): string {
    if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
    if (n >= 1000) return n.toLocaleString('en-IN');
    return n.toString();
}

// ─── Hook: Animated Counter ───────────────────────────────────
function useCountUp(target: number, duration = 1500) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    const start = performance.now();
                    const tick = (now: number) => {
                        const progress = Math.min((now - start) / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setCount(Math.floor(eased * target));
                        if (progress < 1) requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                    observer.unobserve(el);
                }
            },
            { threshold: 0.5 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [target, duration]);

    return { ref, displayValue: formatStat(count) };
}

// ─── Main Component ───────────────────────────────────────────
export default function StorefrontLanding({
    stores, stats
}: StorefrontLandingProps) {
    return (
        <div className="landing">
            <Navbar />
            <HeroSection />
            <CommunityShowcase stores={stores} />
            <PlatformStatsSection stats={stats} />
            <FooterCTA />
        </div>
    );
}
```

### 12.2 Store Card Component

```tsx
function StoreCard({
    store, animationDelay
}: {
    store: StoreShowcase;
    animationDelay: number;
}) {
    const theme = THEME_META[store.themeId || 'modern'] || THEME_META['modern'];
    const isLive = store.status === 'published';
    const isDev = typeof window !== 'undefined' &&
                  window.location.hostname.includes('localhost');

    const storeUrl = isDev
        ? `/store/${store.subdomain}`
        : `https://${store.subdomain}.letbuyy.store`;

    return (
        <article
            className="store-card"
            style={{
                animationDelay: `${animationDelay}s`,
                '--theme-accent': theme.color
            } as React.CSSProperties}
        >
            {/* Logo / Initial Avatar */}
            <div className="store-card-logo">
                {store.logoUrl ? (
                    <img
                        src={store.logoUrl}
                        alt={store.displayName}
                        className="store-card-logo-img"
                    />
                ) : (
                    <div
                        className="store-card-initial"
                        style={{ backgroundColor: theme.color + '20',
                                 color: theme.color }}
                    >
                        {store.displayName.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Store Info */}
            <div className="store-card-info">
                <h3 className="store-card-name">{store.displayName}</h3>
                <p className="store-card-subdomain">
                    {store.subdomain}.letbuyy.store
                </p>
                <p className="store-card-owner">
                    by {store.maskedEmail}
                </p>
            </div>

            {/* Badges */}
            <div className="store-card-badges">
                <span
                    className="store-card-theme-badge"
                    style={{ backgroundColor: theme.color + '15',
                             color: theme.color,
                             borderColor: theme.color + '30' }}
                >
                    🎨 {theme.label}
                </span>
                <span className={`store-card-status-badge ${
                    isLive ? 'status-live' : 'status-draft'
                }`}>
                    {isLive ? '● LIVE' : '○ DRAFT'}
                </span>
            </div>

            {/* Footer */}
            <div className="store-card-footer">
                <span className="store-card-time">
                    {timeAgo(store.createdAt)}
                </span>
                {isLive && (
                    <a href={storeUrl} className="store-card-visit">
                        Visit Store →
                    </a>
                )}
            </div>
        </article>
    );
}
```


---

# PART 3 — CSS Design System, Wireframes & Visual Specification

---

## 13. CSS Design System — Landing Page

### 13.1 Design Token Reference

```css
/* ─── storefront-landing.css ─── */

/* ═══════════════════════════════════════════════════════════
   LANDING PAGE DESIGN TOKENS
   These are INDEPENDENT of individual store themes.
   The landing page uses a fixed dark platform theme.
   ═══════════════════════════════════════════════════════════ */

:root {
    /* ── Surface Colors ── */
    --landing-bg:             #09090b;     /* Page background — near-black */
    --landing-surface:        #18181b;     /* Card backgrounds */
    --landing-surface-hover:  #27272a;     /* Card hover state */
    --landing-surface-raised: #1f1f23;     /* Elevated surface */
    --landing-border:         #27272a;     /* Default borders */
    --landing-border-subtle:  #1f1f23;     /* Subtle dividers */

    /* ── Text Colors ── */
    --landing-text:           #fafafa;     /* Primary text — white */
    --landing-text-secondary: #a1a1aa;     /* Secondary — zinc-400 */
    --landing-text-muted:     #71717a;     /* Muted — zinc-500 */
    --landing-text-dim:       #52525b;     /* Very subtle — zinc-600 */

    /* ── Accent Colors ── */
    --landing-accent:         #6366f1;     /* Indigo-500 — primary CTA */
    --landing-accent-hover:   #818cf8;     /* Indigo-400 — hover */
    --landing-accent-glow:    rgba(99, 102, 241, 0.15);  /* Glow effect */
    --landing-accent-subtle:  rgba(99, 102, 241, 0.08);  /* Subtle bg tint */

    /* ── Status Colors ── */
    --landing-success:        #22c55e;     /* Green — live stores */
    --landing-success-bg:     rgba(34, 197, 94, 0.1);
    --landing-warning:        #f59e0b;     /* Amber — draft stores */
    --landing-warning-bg:     rgba(245, 158, 11, 0.1);
    --landing-error:          #ef4444;     /* Red — not found */
    --landing-error-bg:       rgba(239, 68, 68, 0.1);

    /* ── Typography ── */
    --landing-font-heading:   'Space Grotesk', system-ui, sans-serif;
    --landing-font-body:      'Inter', system-ui, sans-serif;
    --landing-font-mono:      'JetBrains Mono', monospace;

    /* ── Spacing Scale (4px base) ── */
    --space-1:  4px;
    --space-2:  8px;
    --space-3:  12px;
    --space-4:  16px;
    --space-5:  20px;
    --space-6:  24px;
    --space-8:  32px;
    --space-10: 40px;
    --space-12: 48px;
    --space-16: 64px;
    --space-20: 80px;
    --space-24: 96px;

    /* ── Border Radius ── */
    --radius-sm:  6px;
    --radius-md:  10px;
    --radius-lg:  16px;
    --radius-xl:  24px;
    --radius-full: 9999px;

    /* ── Shadows ── */
    --shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-md:   0 4px 6px -1px rgba(0, 0, 0, 0.3);
    --shadow-lg:   0 10px 15px -3px rgba(0, 0, 0, 0.3);
    --shadow-glow: 0 0 40px rgba(99, 102, 241, 0.12);

    /* ── Transitions ── */
    --transition-fast:   150ms ease;
    --transition-normal: 200ms ease;
    --transition-slow:   300ms ease;
    --transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);

    /* ── Layout ── */
    --landing-max-width: 1280px;
    --landing-content-width: 960px;
}
```

### 13.2 Base Layout Styles

```css
/* ─── Base Reset ─── */
.landing {
    background-color: var(--landing-bg);
    color: var(--landing-text);
    font-family: var(--landing-font-body);
    min-height: 100vh;
    overflow-x: hidden;
}

.landing *,
.landing *::before,
.landing *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

/* ─── Container ─── */
.landing-container {
    max-width: var(--landing-max-width);
    margin: 0 auto;
    padding: 0 var(--space-6);
}

@media (max-width: 768px) {
    .landing-container {
        padding: 0 var(--space-4);
    }
}

/* ─── Navbar ─── */
.landing-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(9, 9, 11, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--landing-border-subtle);
    padding: var(--space-4) 0;
}

.landing-nav-inner {
    max-width: var(--landing-max-width);
    margin: 0 auto;
    padding: 0 var(--space-6);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.landing-nav-logo {
    font-family: var(--landing-font-heading);
    font-size: 24px;
    font-weight: 700;
    color: var(--landing-text);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.landing-nav-cta {
    background: var(--landing-accent);
    color: white;
    border: none;
    padding: var(--space-2) var(--space-5);
    border-radius: var(--radius-full);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-normal);
    text-decoration: none;
}

.landing-nav-cta:hover {
    background: var(--landing-accent-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-glow);
}
```

### 13.3 Hero Section Styles

```css
/* ─── Hero ─── */
.landing-hero {
    text-align: center;
    padding: var(--space-24) var(--space-6) var(--space-16);
    position: relative;
}

/* Subtle grid background */
.landing-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    pointer-events: none;
}

/* Radial gradient glow */
.landing-hero::after {
    content: '';
    position: absolute;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 600px;
    background: radial-gradient(
        ellipse, rgba(99, 102, 241, 0.08) 0%, transparent 70%
    );
    pointer-events: none;
    z-index: 0;
}

.landing-hero-content {
    position: relative;
    z-index: 1;
    max-width: var(--landing-content-width);
    margin: 0 auto;
}

.landing-hero h1 {
    font-family: var(--landing-font-heading);
    font-size: 56px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin-bottom: var(--space-6);
    animation: fadeSlideUp 0.6s ease-out;
}

.landing-hero h1 .accent {
    background: linear-gradient(135deg, var(--landing-accent), #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.landing-hero-subtitle {
    font-size: 18px;
    color: var(--landing-text-secondary);
    line-height: 1.6;
    max-width: 560px;
    margin: 0 auto var(--space-10);
    animation: fadeSlideUp 0.6s ease-out 0.1s both;
}

@media (max-width: 768px) {
    .landing-hero {
        padding: var(--space-16) var(--space-4) var(--space-12);
    }
    .landing-hero h1 {
        font-size: 36px;
    }
    .landing-hero-subtitle {
        font-size: 16px;
    }
}
```

### 13.4 Store Card Styles

```css
/* ─── Store Cards ─── */
.landing-community-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-6);
    max-width: var(--landing-max-width);
    margin: 0 auto;
    padding: 0 var(--space-6);
}

@media (max-width: 1024px) {
    .landing-community-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

@media (max-width: 768px) {
    .landing-community-grid {
        grid-template-columns: 1fr;
        gap: var(--space-3);
    }
}

.store-card {
    background: var(--landing-surface);
    border: 1px solid var(--landing-border);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    transition: all var(--transition-normal);
    animation: fadeSlideUp 0.5s ease-out both;
    cursor: default;
}

.store-card:hover {
    background: var(--landing-surface-hover);
    border-color: var(--theme-accent, var(--landing-border));
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg), 0 0 0 1px var(--theme-accent, transparent);
}

/* Logo / Initial */
.store-card-logo {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex-shrink: 0;
}

.store-card-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.store-card-initial {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--landing-font-heading);
    font-size: 24px;
    font-weight: 700;
    border-radius: var(--radius-md);
}

/* Info */
.store-card-name {
    font-family: var(--landing-font-heading);
    font-size: 16px;
    font-weight: 600;
    color: var(--landing-text);
}

.store-card-subdomain {
    font-size: 13px;
    color: var(--landing-text-muted);
    font-family: var(--landing-font-mono);
}

.store-card-owner {
    font-size: 13px;
    color: var(--landing-text-dim);
}

/* Badges */
.store-card-badges {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
}

.store-card-theme-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    border: 1px solid;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.store-card-status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-full);
}

.status-live {
    background: var(--landing-success-bg);
    color: var(--landing-success);
}

.status-draft {
    background: var(--landing-warning-bg);
    color: var(--landing-warning);
}

/* Footer */
.store-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: var(--space-3);
    border-top: 1px solid var(--landing-border-subtle);
}

.store-card-time {
    font-size: 12px;
    color: var(--landing-text-dim);
}

.store-card-visit {
    font-size: 13px;
    font-weight: 600;
    color: var(--landing-accent);
    text-decoration: none;
    transition: color var(--transition-fast);
}

.store-card-visit:hover {
    color: var(--landing-accent-hover);
}
```

### 13.5 Animation Keyframes

```css
/* ─── Animations ─── */
@keyframes fadeSlideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
}

@keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
}

/* Staggered card entrance */
.store-card:nth-child(1)  { animation-delay: 0s; }
.store-card:nth-child(2)  { animation-delay: 0.05s; }
.store-card:nth-child(3)  { animation-delay: 0.1s; }
.store-card:nth-child(4)  { animation-delay: 0.15s; }
.store-card:nth-child(5)  { animation-delay: 0.2s; }
.store-card:nth-child(6)  { animation-delay: 0.25s; }
.store-card:nth-child(7)  { animation-delay: 0.3s; }
.store-card:nth-child(8)  { animation-delay: 0.35s; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
    .store-card,
    .landing-hero h1,
    .landing-hero-subtitle {
        animation: none !important;
        transition: none !important;
    }
}
```

---

## 14. Desktop Layout Wireframe (1440px)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  �� LetBuyy                                                    [CTA btn] │
│                                                          Create Store →   │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                        · · · · grid bg · · · ·                            │
│                                                                            │
│                                                                            │
│                   Discover Stores on                                       │
│                   LetBuyy ✦                                               │
│                                                                            │
│                   Find your favorite store or                              │
│                   explore what the community                               │
│                   is building.                                             │
│                                                                            │
│            ┌──────────────────────────────────────────────┐                │
│            │  🔍  Enter store name...        [Visit Store]│                │
│            └──────────────────────────────────────────────┘                │
│                                                                            │
│            ┌──────────────────────────────────────────────┐                │
│            │  ✅ "urbanstore" is live! Redirecting...      │   ← found    │
│            │  ❌ "xyzabc" was not found. Create yours? →   │   ← miss     │
│            │  ⏳ Checking...                               │   ← loading  │
│            │  ⚠️  Enter at least 3 characters              │   ← invalid  │
│            └──────────────────────────────────────────────┘                │
│                                                                            │
│                   ──── or explore the community ────                       │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│    Recently Launched                                       See All →       │
│    See what the community is building                                      │
│                                                                            │
│    ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────┐│
│    │                │  │                │  │                │  │        ││
│    │   ┌────────┐   │  │   ┌────────┐   │  │   ┌────────┐   │  │  ┌──┐  ││
│    │   │  LOGO  │   │  │   │   "L"  │   │  │   │  LOGO  │   │  │  │"N│  ││
│    │   │  IMG   │   │  │   │  init  │   │  │   │  IMG   │   │  │  │  │  ││
│    │   └────────┘   │  │   └────────┘   │  │   └────────┘   │  │  └──┘  ││
│    │                │  │                │  │                │  │        ││
│    │  Urban Kicks   │  │  Luxe Avenue   │  │  TechBay       │  │  NOLA  ││
│    │  Store         │  │  Store         │  │  Store         │  │  Store ││
│    │  urbanstore.   │  │  luxeavenue.   │  │  techbay.      │  │  nola. ││
│    │  letbuyy.store │  │  letbuyy.store │  │  letbuyy.store │  │  let.. ││
│    │                │  │                │  │                │  │        ││
│    │  by sa••@g..   │  │  by jo••@y..   │  │  by an••@o..   │  │  by .. ││
│    │                │  │                │  │                │  │        ││
│    │  ┌──────────┐  │  │  ┌──────────┐  │  │  ┌──────────┐  │  │  ┌──┐  ││
│    │  │🎨 Urban  │  │  │  │🎨 Luxe   │  │  │  │🎨 Neon   │  │  │  │🎨│  ││
│    │  │  Kicks   │  │  │  │  Atelier  │  │  │  │  Tech    │  │  │  │  │  ││
│    │  └──────────┘  │  │  └──────────┘  │  │  └──────────┘  │  │  └──┘  ││
│    │  ● LIVE        │  │  ○ DRAFT       │  │  ● LIVE        │  │  ○ DFT ││
│    │                │  │                │  │                │  │        ││
│    │  2h ago Visit→ │  │  1d ago        │  │  5m ago Visit→ │  │  3d .. ││
│    └────────────────┘  └────────────────┘  └────────────────┘  └────────┘│
│                                                                            │
│    ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────┐│
│    │   (row 2)      │  │   (repeat      │  │   card         │  │  card  ││
│    │   same pattern │  │    pattern)     │  │   pattern      │  │  ...   ││
│    └────────────────┘  └────────────────┘  └────────────────┘  └────────┘│
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│    Platform in Numbers                                                     │
│                                                                            │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│    │              │  │              │  │              │  │              ││
│    │     127      │  │       4      │  │    1,240     │  │      89      ││
│    │   ───────    │  │   ───────    │  │   ───────    │  │   ───────    ││
│    │   Stores     │  │   Themes     │  │   Products   │  │   Orders     ││
│    │   Created    │  │   Available  │  │   Listed     │  │   Fulfilled  ││
│    │              │  │              │  │              │  │              ││
│    └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                   Ready to build your store?                               │
│                                                                            │
│          [Create Your Store →]    [Browse Themes →]                        │
│                                                                            │
│    ─────────────────────────────────────────────────────────               │
│    © 2026 LetBuyy · Terms · Privacy · letbuyy.store                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Mobile Layout Wireframe (390px)

```
┌─────────────────────────────┐
│  🔲 LetBuyy    [Create →]  │
├─────────────────────────────┤
│                             │
│  Discover Stores            │
│  on LetBuyy ✦               │
│                             │
│  Find your favorite         │
│  store or explore what      │
│  the community is building. │
│                             │
│  ┌───────────────────────┐  │
│  │ 🔍 Enter store name.. │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │    Visit Store →      │  │
│  └───────────────────────┘  │
│                             │
│  ── status indicator ────  │
│                             │
├─────────────────────────────┤
│                             │
│  Recently Launched          │
│  See what the community     │
│  is building                │
│                             │
│  ┌───────────────────────┐  │
│  │  ┌──┐                │  │
│  │  │LG│ Urban Kicks     │  │
│  │  └──┘ Store           │  │
│  │  urbanstore.letbuyy   │  │
│  │  by sa••@gmail.com    │  │
│  │  🎨 Urban Kicks ●LIVE │  │
│  │  2h ago   Visit →     │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  ┌──┐                │  │
│  │  │ L │ Luxe Avenue    │  │
│  │  └──┘ Store           │  │
│  │  luxeavenue.letbuyy   │  │
│  │  by jo••@yahoo.com    │  │
│  │  🎨 Luxe Atelier ○DFT│  │
│  │  1d ago               │  │
│  └───────────────────────┘  │
│                             │
│  (scrollable — all cards)   │
│                             │
├─────────────────────────────┤
│                             │
│  ┌──────┐ ┌──────┐         │
│  │ 127  │ │   4  │         │
│  │Stores│ │Themes│         │
│  └──────┘ └──────┘         │
│  ┌──────┐ ┌──────┐         │
│  │ 1.2K │ │  89  │         │
│  │Prods │ │Orders│         │
│  └──────┘ └──────┘         │
│                             │
├─────────────────────────────┤
│                             │
│  Ready to build?            │
│  [Create Your Store →]      │
│                             │
│  © 2026 LetBuyy             │
│  Terms · Privacy            │
│                             │
└─────────────────────────────┘
```

---

## 16. Store Card — Detailed Specification

### 16.1 Desktop Card Anatomy

```
┌──────────────────────────────────────┐
│                                      │
│     ┌──────────────────┐             │   ← 56×56px, border-radius: 10px
│     │                  │             │     Gradient background if no logo
│     │     Logo or      │             │     based on theme accent color
│     │     Initial      │             │
│     │     Letter       │             │
│     │                  │             │
│     └──────────────────┘             │
│                                      │
│  ────────────────────────────────    │   ← 1px border-subtle divider
│                                      │
│  Store Display Name                  │   ← 16px, font-weight: 600, heading font
│  storename.letbuyy.store             │   ← 13px, mono font, text-muted
│                                      │
│  by sa••••••••@gmail.com             │   ← 13px, text-dim
│                                      │
│  ┌───────────────┐ ┌──────────┐     │
│  │ 🎨 Urban      │ │ ● LIVE   │     │   ← Theme badge: 11px UPPERCASE
│  │    Kicks      │ │          │     │     Status badge: success/warning
│  └───────────────┘ └──────────┘     │
│                                      │
│  ────────────────────────────────    │   ← 1px border-subtle divider
│                                      │
│  2h ago              Visit Store →  │   ← Footer: time + link
│                                      │
└──────────────────────────────────────┘

Card Properties:
├── Width: auto-fill in grid (min 260px, max 1fr)
├── Padding: 20px
├── Border: 1px solid var(--landing-border)
├── Border-radius: 16px
├── Background: var(--landing-surface)
├── Hover: translateY(-2px), border-color → theme accent
└── Animation: fadeSlideUp, staggered 0.05s per card
```

### 16.2 Mobile Card Anatomy

```
┌──────────────────────────────────────────────┐
│                                              │
│  ┌────┐  Store Display Name                  │
│  │LOGO│  storename.letbuyy.store             │
│  │ or │  by sa••@gmail.com                   │
│  │ "U"│                                      │
│  └────┘  🎨 Urban Kicks   ● LIVE   2h ago   │
│                                              │
│                          Visit Store →       │
│                                              │
└──────────────────────────────────────────────┘

Mobile card switches to horizontal layout:
├── Logo: 48×48px (slightly smaller)
├── Flex direction: row
├── Gap: 12px
└── All info stacks vertically beside logo
```


---

# PART 4 — Interactions, Security, Testing & Reference

---

## 17. Store Finder State Machine

### 17.1 Visual State Machine

```
                     ┌─────────────────────────────────┐
                     │                                   │
         ┌───────────┤         IDLE                      │
         │           │   • Input empty                   │
         │           │   • No status indicator shown     │
         │           │   • Placeholder: "Enter store..." │
         │           └──────────┬────────────────────────┘
         │                      │
         │                      │ User types (onChange)
         │                      │
         │                      ▼
         │           ┌──────────────────────────────────┐
         │           │                                    │
         │           │         INPUT_CHANGED              │
         │           │   • query.length checked          │
         │           │                                    │
         │           └──┬──────────┬──────────┬──────────┘
         │              │          │          │
         │    length<3  │  length≥3│  invalid │
         │              │  & valid │  chars   │
         │              ▼          ▼          ▼
         │    ┌──────────────┐ ┌────────┐ ┌──────────────┐
         │    │   INVALID     │ │DEBOUNCE│ │   INVALID     │
         │    │ "Enter ≥3    │ │ 300ms  │ │ "Only letters │
         │    │  characters" │ │ timer  │ │  & numbers"  │
         │    └──────────────┘ └───┬────┘ └──────────────┘
         │                         │
         │                         │ timer fires
         │                         ▼
         │              ┌──────────────────────┐
         │              │                        │
         │              │      CHECKING           │
         │              │   • Spinner shown       │
         │              │   • "Checking..."       │
         │              │   • API: GET /api/       │
         │              │     store-lookup?q=...  │
         │              │                         │
         │              └──┬──────────┬───────────┘
         │                 │          │
         │       found     │          │  not found
         │       (200)     │          │  (200, no match)
         │                 ▼          ▼
         │    ┌───────────────┐  ┌────────────────────┐
         │    │    FOUND       │  │    NOT_FOUND        │
         │    │                │  │                      │
         │    │  status=       │  │  ❌ "xyzabc" was    │
         │    │  published?    │  │  not found.          │
         │    │  ┌─────┬────┐ │  │                      │
         │    │  │ YES  │ NO │ │  │  [Create your       │
         │    │  └──┬──┘└─┬─┘ │  │   own store? →]     │
         │    │     │     │   │  │                      │
         │    │     ▼     ▼   │  └────────────────────┘
         │    │  ┌──────┐┌──┐ │
         │    │  │LIVE  ││DR│ │
         │    │  │      ││AF│ │
         │    │  │✅ is ││T │ │
         │    │  │live! │└──┘ │
         │    │  │      │     │
         │    │  │Auto- │     │
         │    │  │redir │     │
         │    │  │in 3s │     │
         │    │  └──────┘     │
         │    └───────────────┘
         │           │
         │           │ user clears / retypes
         └───────────┘
```

### 17.2 Status Indicator UI

```
State: IDLE
┌──────────────────────────────────────────────┐
│  🔍  Enter store name...        [Visit Store]│
└──────────────────────────────────────────────┘
(no indicator shown)

State: CHECKING
┌──────────────────────────────────────────────┐
│  🔍  urbanstore                  [Visit Store]│
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  ⏳  Checking availability...                 │
└──────────────────────────────────────────────┘

State: FOUND (published)
┌──────────────────────────────────────────────┐
│  🔍  urbanstore                  [Visit Store]│
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  ✅  "Urban Kicks Store" is live!             │
│      Redirecting in 3s...                     │
│      [Visit Now →]                            │
└──────────────────────────────────────────────┘

State: FOUND (draft)
┌──────────────────────────────────────────────┐
│  🔍  mynewshop                   [Visit Store]│
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  🚧  "My New Shop" is coming soon!            │
│      This store is still being set up.        │
└──────────────────────────────────────────────┘

State: NOT_FOUND
┌──────────────────────────────────────────────┐
│  🔍  xyzabcstore                 [Visit Store]│
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  ❌  "xyzabcstore" was not found.             │
│      Want to claim this name?                 │
│      [Create Your Store →]                    │
└──────────────────────────────────────────────┘

State: INVALID
┌──────────────────────────────────────────────┐
│  🔍  ab                          [Visit Store]│
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  ⚠️  Enter at least 3 characters              │
└──────────────────────────────────────────────┘
```

---

## 18. Animation & Micro-Interaction Specification

### 18.1 Animation Inventory

| Element | Animation | Duration | Easing | Trigger |
|---|---|---|---|---|
| Hero heading | fade-in + slide-up (20px) | 600ms | ease-out | Page load |
| Hero subtitle | fade-in + slide-up (20px) | 600ms | ease-out (100ms delay) | Page load |
| Search input | fade-in + slide-up | 600ms | ease-out (200ms delay) | Page load |
| Store cards | Staggered fade-in + slide-up | 500ms | ease-out (50ms × index) | Page load / scroll |
| Card hover | translate-Y(-2px) + shadow | 200ms | ease | Mouse enter |
| Card hover border | border-color → theme accent | 200ms | ease | Mouse enter |
| Stats counters | Count-up from 0 → target | 1500ms | ease-out cubic | Viewport intersection |
| Search status | fade-in + slide-down (10px) | 300ms | ease-out | State change |
| Search spinner | rotate 360° continuous | 1000ms | linear (infinite) | Checking state |
| CTA button | translateY(-1px) + glow shadow | 200ms | ease | Mouse hover |
| Visit Store link | color transition | 150ms | ease | Mouse hover |
| Navbar | backdrop-filter: blur(12px) | N/A | N/A | Sticky position |

### 18.2 Intersection Observer Configuration

```typescript
// Stats section — triggers counter animation
const statsObserver = new IntersectionObserver(
    callback,
    {
        threshold: 0.5,    // 50% of element visible
        rootMargin: '0px'  // No margin adjustment
    }
);

// Store cards — triggers staggered fade-in
const cardsObserver = new IntersectionObserver(
    callback,
    {
        threshold: 0.1,    // 10% visible triggers
        rootMargin: '50px' // Start slightly before visible
    }
);
```

### 18.3 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
    /* Disable ALL animations globally */
    .landing * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }

    /* Stats show final value immediately */
    /* Counter hook detects prefers-reduced-motion via matchMedia */
}
```

```typescript
// In useCountUp hook
const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
).matches;

if (prefersReducedMotion) {
    setCount(target); // Skip animation
    return;
}
```

---

## 19. Theme Badge Mapping

### 19.1 Complete Theme Registry

| `theme_id` (DB) | Display Label | Badge Color | Background | Border | Icon |
|---|---|---|---|---|---|
| `urban-kicks` | Urban Kicks | `#ef4444` | `rgba(239,68,68,0.1)` | `rgba(239,68,68,0.2)` | 👟 |
| `luxe-atelier` | Luxe Atelier | `#d4af37` | `rgba(212,175,55,0.1)` | `rgba(212,175,55,0.2)` | 💎 |
| `natures-basket` | Nature's Basket | `#22c55e` | `rgba(34,197,94,0.1)` | `rgba(34,197,94,0.2)` | 🌿 |
| `neon-tech` | Neon Tech | `#06b6d4` | `rgba(6,182,212,0.1)` | `rgba(6,182,212,0.2)` | ⚡ |
| `modern` (default) | Modern | `#6366f1` | `rgba(99,102,241,0.1)` | `rgba(99,102,241,0.2)` | ✨ |
| `null` / unknown | Modern | `#6366f1` | `rgba(99,102,241,0.1)` | `rgba(99,102,241,0.2)` | ✨ |

### 19.2 Badge Rendering Logic

```typescript
function getThemeBadge(themeId: string | null) {
    const meta = THEME_META[themeId || 'modern'] || THEME_META['modern'];
    return {
        label: meta.label,
        style: {
            color: meta.color,
            backgroundColor: meta.color + '15',  // 15 = ~8% opacity hex
            borderColor: meta.color + '30',       // 30 = ~19% opacity hex
        }
    };
}
```

---

## 20. Email Masking Algorithm

### 20.1 Algorithm

```
Input:  saai.siddharth@gmail.com
        ^^^^                        → 2 visible chars
            ^^^^^^^^^^              → masked with repeating "••" (max 5 pairs)
                      @gmail.com    → full domain preserved

Output: sa••••••••@gmail.com

Rules:
1. Split at '@' → local part + domain
2. Take first 2 characters of local part
3. Replace remaining with "••" repeated (min 1, max 5 times)
4. Concatenate: visible + masked + "@" + domain
5. If no '@' found → return "••••@unknown"
```

### 20.2 Implementation

```typescript
function maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return '••••@unknown';

    const local = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    const visible = local.slice(0, 2);
    const maskLength = Math.min(Math.max(local.length - 2, 1), 5);
    const masked = '••'.repeat(maskLength);

    return `${visible}${masked}${domain}`;
}

// Test cases:
// maskEmail('saai.siddharth@gmail.com') → 'sa••••••••@gmail.com'
// maskEmail('john@company.com')         → 'jo••@company.com'
// maskEmail('a@b.com')                  → 'a••@b.com'
// maskEmail('ab@c.com')                 → 'ab••@c.com'
// maskEmail('invalid-email')            → '••••@unknown'
```

---

## 21. SEO & Open Graph

### 21.1 Meta Tags

```html
<head>
    <title>LetBuyy — Discover Stores Built by the Community</title>
    <meta name="description" content="Explore stores, portfolios, and websites
        built on LetBuyy. Find your favorite store or create your own in minutes." />

    <!-- Open Graph -->
    <meta property="og:title" content="LetBuyy — Discover Stores Built by the Community" />
    <meta property="og:description" content="Explore the LetBuyy community.
        Find stores or create your own." />
    <meta property="og:url" content="https://storefront.letbuyy.store" />
    <meta property="og:site_name" content="LetBuyy" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://storefront.letbuyy.store/og-landing.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="LetBuyy — Discover Stores" />

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "LetBuyy",
        "url": "https://storefront.letbuyy.store",
        "description": "Create your online store in minutes",
        "potentialAction": {
            "@type": "SearchAction",
            "target": "https://storefront.letbuyy.store?q={search_term_string}",
            "query-input": "required name=search_term_string"
        }
    }
    </script>
</head>
```

### 21.2 Semantic HTML Structure

```html
<body>
    <nav aria-label="Main navigation">...</nav>
    <main>
        <section aria-label="Store finder">
            <h1>Discover Stores on LetBuyy</h1>
            <form role="search">
                <input type="search" aria-label="Search for a store" />
            </form>
        </section>
        <section aria-label="Recently launched stores">
            <h2>Recently Launched</h2>
            <article><!-- store card --></article>
        </section>
        <section aria-label="Platform statistics">
            <h2>Platform in Numbers</h2>
        </section>
    </main>
    <footer>...</footer>
</body>
```

---

## 22. Performance & Core Web Vitals

### 22.1 Target Metrics

| Metric | Target | Strategy |
|---|---|---|
| **LCP** (Largest Contentful Paint) | < 1.5s | Server-render hero text + community grid |
| **FID** (First Input Delay) | < 50ms | Minimal client JS — only search + counters |
| **CLS** (Cumulative Layout Shift) | < 0.05 | Fixed dimensions for cards + logos |
| **TTFB** (Time to First Byte) | < 200ms | Vercel Edge caching |
| **TTI** (Time to Interactive) | < 2.0s | Selective hydration — only interactive parts |

### 22.2 Optimization Strategies

| Strategy | Implementation |
|---|---|
| **Server Component data fetching** | DB queries run on server — zero client-side waterfalls |
| **Parallel queries** | `Promise.all()` for all 4 stats queries |
| **Image optimization** | Logo URLs served via `next/image` with CDN caching |
| **CSS-only animations** | All animations use CSS keyframes (no JS animation libraries) |
| **Font preloading** | Space Grotesk + Inter preloaded in `<head>` |
| **Lazy logo images** | `loading="lazy"` on store card logos |
| **Static shell** | Navbar + hero structure renders instantly on server |
| **ISR caching** | `revalidate: 300` — refresh landing page data every 5 minutes |

### 22.3 Bundle Size Budget

| Chunk | Target | Contents |
|---|---|---|
| Server component | 0 KB (server-only) | `page.tsx` — no client JS |
| Client component | < 8 KB gzipped | `storefront-landing.tsx` + CSS |
| External dependencies | 0 KB | No external libraries — all vanilla React |

---

## 23. Accessibility (a11y)

### 23.1 WCAG 2.1 AA Compliance

| Requirement | Implementation |
|---|---|
| **Color contrast** | All text meets 4.5:1 ratio (zinc-400 on near-black = ~6.5:1) |
| **Focus indicators** | Visible focus ring on all interactive elements (2px solid accent) |
| **Screen reader** | All sections have `aria-label`, images have `alt` text |
| **Keyboard navigation** | Tab order follows visual order, Enter activates buttons |
| **Skip navigation** | Hidden "Skip to content" link at top of page |
| **Search form** | Uses `role="search"` and `aria-label` on input |
| **Live regions** | Search status uses `aria-live="polite"` for screen reader updates |
| **Reduced motion** | `prefers-reduced-motion` media query disables all animations |
| **Semantic HTML** | Proper heading hierarchy (h1 → h2 → h3), article for cards |
| **Link purpose** | All links have descriptive text (not "click here") |

### 23.2 Focus Management

```css
/* Focus ring for keyboard users */
.landing *:focus-visible {
    outline: 2px solid var(--landing-accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
}

/* Remove for mouse users */
.landing *:focus:not(:focus-visible) {
    outline: none;
}
```

---

## 24. Error Handling & Edge Cases

### 24.1 Error Scenarios

| Scenario | Handling |
|---|---|
| **Supabase service role key missing** | Server component returns empty stores/stats; landing still renders with empty state |
| **DB query timeout** | 3-second timeout with `AbortController`; renders empty state gracefully |
| **No stores in database** | Shows empty state: "No stores launched yet. Be the first!" |
| **Store lookup API failure** | Client shows "Something went wrong. Try again." with retry button |
| **Invalid characters in search** | Shows validation message: "Only letters, numbers, and hyphens allowed" |
| **Rate limit exceeded** | API returns 429; client shows "Too many requests. Wait a moment." |
| **Logo URL returns 404** | Falls back to initial letter avatar |
| **Missing owner email** | Displays "by Unknown" |
| **Null theme_id** | Falls back to 'modern' theme badge |
| **Network timeout on search** | 5-second fetch timeout; shows error state |

### 24.2 Graceful Degradation

```typescript
// Server component — never crashes the page
export default async function Home() {
    let stores: StoreShowcase[] = [];
    let stats: PlatformStats = {
        totalStores: 0,
        totalThemes: 0,
        totalProducts: 0,
        totalOrders: 0
    };

    try {
        // ... fetch logic
    } catch (error) {
        console.error('[Landing] Data fetch failed:', error);
        // Page still renders with empty state
    }

    return <StorefrontLanding stores={stores} stats={stats} />;
}
```

---

## 25. Security Considerations

### 25.1 Data Exposure Policy

| Data | Exposed? | Detail |
|---|---|---|
| Store name / subdomain | ✅ Yes | Public information — needed for discovery |
| Store status (draft/published) | ✅ Yes | Shows ecosystem activity |
| Store logo URL | ✅ Yes | Public brand asset |
| Theme used | ✅ Yes | Platform feature showcase |
| Created at timestamp | ✅ Yes | Relative time only (not exact) |
| Owner email | ⚠️ Masked | Only first 2 chars + domain visible |
| Owner full name | ❌ No | Not exposed on landing page |
| Store configuration | ❌ No | Never included in landing data |
| Product data | ❌ No | Only aggregated count |
| Order data | ❌ No | Only aggregated count |
| Customer data | ❌ No | Never accessible |

### 25.2 API Security

```typescript
// /api/store-lookup/route.ts — security measures

// 1. Input sanitization
const query = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();
if (!query || !/^[a-zA-Z0-9-]+$/.test(query)) {
    return NextResponse.json({ status: 'invalid' });
}

// 2. Query parameterization (via Supabase client)
// All queries use parameterized inputs — no SQL injection risk

// 3. Rate limiting (via middleware or Vercel)
// 10 requests per minute per IP

// 4. No authentication required
// Landing page is fully public — no auth tokens needed

// 5. Service role key isolation
// Service role key is ONLY used in server components
// Never exposed to client-side code
```

---

## 26. Testing Strategy

### 26.1 Manual Testing Checklist

| # | Test Case | Expected Result | Priority |
|---|---|---|---|
| 1 | Visit `localhost:3000/` | Landing page shows (NOT demo store) | 🔴 Critical |
| 2 | Type valid published store name | "✅ is live! Redirecting..." + auto-redirect | 🔴 Critical |
| 3 | Type valid draft store name | "�� coming soon!" with no visit link | 🟡 High |
| 4 | Type non-existent store name | "❌ not found" with create link | 🟡 High |
| 5 | Type < 3 characters | "Enter at least 3 characters" | 🟢 Normal |
| 6 | Type special characters | "Only letters, numbers, and hyphens" | 🟢 Normal |
| 7 | Community grid shows stores | Real stores from DB with correct info | 🔴 Critical |
| 8 | Theme badges show correct colors | Each theme has its designated color | 🟡 High |
| 9 | Status badges show LIVE/DRAFT | Published = green LIVE, draft = amber DRAFT | 🟡 High |
| 10 | Emails are masked | Only first 2 chars visible + domain | 🔴 Critical |
| 11 | Stats counters animate | Count-up animation on scroll into view | 🟢 Normal |
| 12 | Responsive at 390px | Mobile layout, single-column cards | 🟡 High |
| 13 | Responsive at 768px | Tablet layout, 3-column cards | 🟢 Normal |
| 14 | Responsive at 1440px | Desktop layout, 4-column cards | 🟢 Normal |
| 15 | "Create Your Store" CTA works | Links to accounts.letbuyy.store | 🟡 High |
| 16 | Visit Store links work | Published stores are clickable | 🔴 Critical |
| 17 | Reduced motion respected | No animations when system prefers | 🟢 Normal |
| 18 | Existing subdomain routing | `dohi.localhost:3000` still works | 🔴 Critical |
| 19 | Path-based routing | `/store/dohi` still works | 🔴 Critical |
| 20 | Cart/checkout fallback | `/cart` on localhost → demo store | 🟡 High |

### 26.2 Responsive Breakpoint Matrix

| Element | 390px (Mobile) | 768px (Tablet) | 1024px (Desktop) | 1440px (Wide) |
|---|---|---|---|---|
| Grid columns | 1 | 3 | 4 | 4 |
| Hero font | 36px | 44px | 52px | 56px |
| Card layout | Horizontal row | Vertical card | Vertical card | Vertical card |
| Stats grid | 2×2 | 4×1 | 4×1 | 4×1 |
| Nav CTA | Small text | Full button | Full button | Full button |
| Padding | 16px | 24px | 24px | 24px |

---

## 27. File Reference Index

| Section | File Path | Type |
|---------|-----------|------|
| 3 | `storefront/src/middleware.ts` | MODIFY |
| 11 | `storefront/src/app/page.tsx` | REWRITE |
| 12 | `storefront/src/app/storefront-landing.tsx` | NEW |
| 13 | `storefront/src/app/storefront-landing.css` | NEW |
| 9 | `storefront/src/app/api/store-lookup/route.ts` | NEW |

---

## 28. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | February 17, 2026 | Antigravity AI | Initial comprehensive documentation |

---

## Document Series

This document is part of the LetBuyy Platform documentation series:

| # | Document |
|---|----------|
| 00 | [Overview](./00_Overview.md) |
| 01 | [Architecture](./01_Architecture.md) |
| 02 | [Authentication & Security](./02_Authentication_and_Security.md) |
| 03 | [Onboarding & Trial](./03_Onboarding_and_Trial.md) |
| 04 | [Admin Dashboard](./04_Admin_Dashboard.md) |
| 05 | [E-commerce Engine](./05_Ecommerce_Engine.md) |
| 06 | [Portfolio & Resume](./06_Portfolio_and_Resume.md) |
| 07 | [AI Features](./07_AI_Features.md) |
| 08 | [Database Schema](./08_Database_Schema.md) |
| 09 | [API Reference](./09_API_Reference.md) |
| 10 | [Storefront & Themes](./10_Storefront_and_Themes.md) |
| 11 | [Super Admin & Team](./11_Super_Admin_and_Team.md) |
| 12 | [Implementation Roadmap](./12_Implementation_Roadmap.md) |
| 13 | [Plans & Pricing](./13_Plans_and_Pricing.md) |
| 14 | [Theme Implementation](./14_Theme_Implementation.md) |
| 15 | [App Store Implementation](./15_App_Store_Implementation.md) |
| 16 | [Customer Management](./16_Customer_Management.md) |
| **17** | **[Storefront Landing & Community Hub](./17_Storefront_Landing.md)** ← You are here |

---

*End of Storefront Landing & Community Hub Documentation*
