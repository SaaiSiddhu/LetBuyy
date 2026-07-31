# React Dependency Inventory (V1)

**Type:** Research / certification — no code changes. **Date:** 2026-06-16.
**Purpose:** Enumerate every React dependency in the storefront render path and classify removal difficulty. Parent: [LIQUID_PARITY_AUDIT.md](LIQUID_PARITY_AUDIT.md) · [LIQUID_GAP_MATRIX.md](LIQUID_GAP_MATRIX.md) · [LIQUID_ONLY_MIGRATION_PLAN.md](LIQUID_ONLY_MIGRATION_PLAN.md).
**Classification:** **BLOCKER** = no Liquid path exists; removing React breaks the surface · **HIGH** = default render path / needs parity before removal · **MEDIUM** = has a Liquid analogue but gaps remain · **LOW** = tooling/non-storefront-output.

---

## 1. Render-path inventory (where React renders storefront output)

### 1a. Page routes (the decisive layer)

| Route | Renders via | React removal class |
|---|---|---|
| `store/[subdomain]/page.tsx` (home) | Composition engine (Liquid-capable) | HIGH (default React until Liquid on) |
| `store/[subdomain]/product/[productId]/page.tsx` | Composition engine | HIGH |
| `store/[subdomain]/products/page.tsx`, `shop/page.tsx` | Composition engine | HIGH |
| `store/[subdomain]/collections/[slug]/page.tsx` | Composition engine | HIGH |
| `store/[subdomain]/cart/page.tsx` | **React only** | **BLOCKER** |
| `store/[subdomain]/checkout/page.tsx` → `checkout-client.tsx` | **React only (Razorpay SDK)** | **BLOCKER** |
| `store/[subdomain]/checkout/success/page.tsx`, `paypal-return/page.tsx` | **React only** | **BLOCKER** |
| `store/[subdomain]/account/{settings,addresses,orders,wishlist}/page.tsx` | **React only** | **BLOCKER** |
| `store/[subdomain]/orders/page.tsx` | **React only** | **BLOCKER** |
| `store/[subdomain]/[...path]/page.tsx` (CMS) → `content-resource-renderer` | **React only** | **BLOCKER (MEDIUM if content moves to Liquid `page` template)** |
| `store/[subdomain]/blog/[slug]/page.tsx` | **React only** | **HIGH** |
| `store/[subdomain]/{privacy,terms,shipping,returns}/page.tsx` | **React only** | **MEDIUM** |

### 1b. Render engine + registry

| Dependency | File:line | Role | Class |
|---|---|---|---|
| Composition engine (React `RenderSectionList`) | `lib/theme-engine/composition-engine.tsx:17-66,426-434` | React fallback renderer | HIGH |
| Section renderer registry | `lib/theme-engine/renderer-registry.tsx:55-205` | Maps section type → React component | HIGH |
| `APPROVED_SECTION_RENDERERS` dispatch | `renderer-registry.tsx:213,268-272` | React render dispatch | HIGH |
| 19 React section components | `components/sections/*.tsx` | hero, product-grid, featured-products, product-detail, testimonials, newsletter, banner-carousel, category-grid, cta, about, contact-form, trust-badges, brand-marquee, portfolio-grid, skills, services-grid, experience-timeline, rich-content, app-block-slot | HIGH |
| React layout chrome | `app/store/[subdomain]/layout.tsx:117-119,218,245` | `liquidPage ? children : <React header/footer>` | HIGH |
| Product details client | `product/[productId]/product-details-client.tsx` | React product detail interactivity | HIGH |
| Content resource renderer | `components/content/content-resource-renderer.tsx` | CMS page + blog rendering | BLOCKER (no Liquid page route) |

### 1c. React state contexts (client interactivity)

| Dependency | File | Role | Class |
|---|---|---|---|
| Cart context | `context/cart-context.tsx` | React cart state for React pages | HIGH (Liquid uses islands instead) |
| Customer auth context | `context/customer-auth-context.tsx` | Login/session state for account/checkout | **BLOCKER** (no Liquid customer drop) |
| Wishlist context | `context/wishlist-context.tsx` | Wishlist state | HIGH |

### 1d. Liquid-path React (nuance — these *enable* Liquid, not block it)

| Dependency | File | Role | Class |
|---|---|---|---|
| Liquid hydration islands | `lib/theme-engine/liquid-hydration-islands.tsx` (`use client`) | Custom-element runtime for Liquid pages (add-to-cart, cart-drawer, search, variant) | LOW — **stays** in a Liquid-only world (it IS the Liquid interactivity layer) |
| Editor preview section frame | `lib/theme-engine/editor-preview-section-frame.tsx` (`use client`) | Editor overlay | LOW (tooling) |
| Theme editor UI | `apps/merchant-control-plane/.../editor/page.tsx` | Merchant authoring | LOW (merchant app, not storefront output) |

> **Note:** `liquid-hydration-islands.tsx` is React-authored but compiles to framework-agnostic custom elements (`window.customElements.define`, `:427-439`). It is the *runtime* a Liquid-only storefront depends on, so it is **not** a removal target — it is the bridge.

---

## 2. React dependency inventory, classified

### 🔴 BLOCKER (8) — no Liquid path; removing React breaks the surface
| # | Dependency | Evidence | Why blocker |
|---|---|---|---|
| 1 | Checkout (Razorpay client) | `checkout-client.tsx` (1160 lines, Razorpay SDK) | No Liquid checkout; payment widget is React |
| 2 | Cart page route | `cart/page.tsx` (React, not composition engine) | Full cart page never invokes Liquid |
| 3 | Account pages (login/register/profile/addresses) | `account/{settings,addresses}/page.tsx`, `customer-auth-context.tsx` | React routes; `customer:null` in Liquid drop |
| 4 | Order history pages | `account/orders/page.tsx`, `orders/page.tsx` | React routes; no orders drop for Liquid |
| 5 | Customer auth/session | `customer-auth-context.tsx`; gateway customer session | Liquid drop has no customer (`composition-engine.tsx:337`) |
| 6 | CMS page renderer | `content-resource-renderer.tsx`, `[...path]/page.tsx` | CMS pages render React, not Liquid `page` template |
| 7 | Wishlist | `account/wishlist/page.tsx`, `wishlist-context.tsx` | No Liquid wishlist section/data |
| 8 | Reviews UI | React review components + `api/reviews` | No Liquid reviews section (`type:'reviews'`=0) |

### 🟠 HIGH (5) — default render path; needs parity + Liquid-default before removal
| # | Dependency | Evidence |
|---|---|---|
| 9 | React section registry + 19 components | `renderer-registry.tsx`, `components/sections/*.tsx` |
| 10 | React composition fallback | `composition-engine.tsx:426-434` |
| 11 | React layout chrome | `layout.tsx:218,245` |
| 12 | Cart context (React pages) | `cart-context.tsx` |
| 13 | Blog rendering | `blog/[slug]/page.tsx` |

### 🟡 MEDIUM (3) — has Liquid analogue but gaps
| # | Dependency | Evidence |
|---|---|---|
| 14 | Variant handling parity | island sends `variant_id:null` `liquid-hydration-islands.tsx:81` vs React `cart-context.tsx:99` tracks variantId |
| 15 | Policy pages (privacy/terms/shipping/returns) | React pages; could become Liquid `page` templates |
| 16 | Product detail interactivity | `product-details-client.tsx` vs Liquid variant island |

### 🟢 LOW (3) — tooling / Liquid runtime (NOT removal targets)
| # | Dependency | Evidence |
|---|---|---|
| 17 | Liquid hydration islands | `liquid-hydration-islands.tsx` — the Liquid interactivity runtime (keep) |
| 18 | Editor UI + preview frame | `editor/page.tsx`, `editor-preview-section-frame.tsx` (merchant app) |
| 19 | Demo/preview React | `preview/page.tsx`, `demo/urban-kicks` |

---

## 3. Summary count

- **BLOCKER: 8** — checkout, cart page, account, orders, customer auth, CMS, wishlist, reviews.
- **HIGH: 5** — catalog React registry/components/chrome/cart-context/blog.
- **MEDIUM: 3** — variant parity, policy pages, product-detail interactivity.
- **LOW: 3** — Liquid islands (keep), editor tooling, demo.

**React cannot be removed until all 8 BLOCKERs have a working Liquid path and the 5 HIGH items reach proven parity.** The migration sequencing is in [LIQUID_ONLY_MIGRATION_PLAN.md](LIQUID_ONLY_MIGRATION_PLAN.md).
