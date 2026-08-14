# 20 — Final Feature Matrix

> **Date:** 2026-08-05. Status vocabulary is fixed; no other value is used.
>
> | Status | Meaning |
> |---|---|
> | **Complete and verified** | Exercised by an executed test or command whose output was inspected |
> | **Complete but not runtime-verified** | Present and unit/integration-tested, but never rendered in a browser |
> | **Partial** | Some of the capability works; a named piece does not |
> | **Blocked by ARB** | Correct fix identified; requires an ARB decision |
> | **Blocked by missing platform route** | Theme side possible, but no runtime route/contract exists |
> | **Blocked by external dependency** | Needs a credential or third party not available here |
> | **Not implemented** | Does not exist |
> | **Intentionally deferred** | Consciously out of scope |
>
> **No browser session was run.** Nothing below is marked *Complete and verified* on the basis of visual
> rendering. That is the single largest limit on this matrix.

---

## 1. Templates — all 23 in the `letbuyy-core` bundle

| # | Template | Status | Note |
|---|---|---|---|
| 1 | `index` | Complete but not runtime-verified | Renders in the engine suite |
| 2 | `product` | **Complete and verified** | L5 asserts title, images, description, money formatting — passing after the render-limit fix |
| 3 | `collection` | **Complete and verified** | L6 asserts title/description + the product loop |
| 4 | `search` | Partial | Template renders (L7 green) but **no `/search` route exists** — the header links to a 404 |
| 5 | `cart` | Complete but not runtime-verified | L8 covers rendering; cart authority is platform-side |
| 6 | `list-collections` | Complete but not runtime-verified | **Added here.** Its absence made the route silently render the homepage |
| 7 | `contact` | Partial | **Added here.** The `contact-form` section had shipped with no template routing to it; the form still posts to a non-existent `/contact` route |
| 8 | `page` | Complete but not runtime-verified | Resolves the historical `contentPage` parity question — it is **not** a gap |
| 9 | `policy` | Complete but not runtime-verified | |
| 10 | `blog` | Complete but not runtime-verified | L14 |
| 11 | `article` | Complete but not runtime-verified | |
| 12 | `not_found` | Complete but not runtime-verified | L16 |
| 13 | `password` | Partial | Renders; the store-password gate is JS-only, so no-JS shoppers cannot unlock |
| 14 | `header` | Complete but not runtime-verified | Section group, not a route |
| 15 | `footer` | Complete but not runtime-verified | Section group, not a route |
| 16 | `customers/login` | Partial | Renders; **no-JS login always 403s** — the section ships no Turnstile widget |
| 17 | `customers/register` | **Blocked by missing platform route** | No `/customers/register` route; the register POST redirects to a 404 |
| 18 | `customers/account` | Complete but not runtime-verified | L10 |
| 19 | `customers/orders` | Complete but not runtime-verified | L11 |
| 20 | `customers/order` | Complete but not runtime-verified | |
| 21 | `customers/settings` | Complete but not runtime-verified | |
| 22 | `customers/wishlist` | Complete but not runtime-verified | |
| 23 | `customers/addresses` | Complete but not runtime-verified | |
| — | `customers/reset_password` | **Blocked by missing platform route** | Gateway backend is complete; storefront route absent. See [24](24-known-limitations.md) §3 |
| — | `customers/activate_account` | **Not implemented** | No platform contract exists at all |
| — | `gift_card` | **Intentionally deferred** | Gift cards exist in the ledger; no theme surface in scope |

---

## 2. Sections — all 44

**Complete but not runtime-verified (42)** — every section renders through the engine suite:

`404-page` · `about-section` · `announcement-bar` · `app-block-slot` · `article-content` ·
`banner-carousel` · `blog-listing` · `brand-marquee` · `cart-summary` · `category-grid` ·
`collection-banner` · `collection-product-list` · `contact-form` · `cta-section` · `customer-account` ·
`customer-addresses` · `customer-login` · `customer-order-detail` · `customer-orders` ·
`customer-register` · `customer-settings` · `customer-wishlist` · `experience-timeline` ·
`featured-products` · `footer` · `header` · `hero-banner` · `marquee` · `newsletter-signup` ·
`page-content` · `password-gate` · `policy-content` · `portfolio-grid` · `product-detail` ·
`product-grid` · `rich-content` · `search-box` · `services-grid` · `skills-section` · `spotlight` ·
`testimonials` · `trust-badges`

**Added in this engagement (2)** — Complete but not runtime-verified:

| Section | Why it mattered |
|---|---|
| `collection-filter` | Referenced by the collection composition of **all 10** experiences; its absence degraded every one |
| `faq-accordion` | Referenced by craft's index, product **and** defaultSections; craft could apply no template cleanly |

**Mapped but absent (2)** — **Not implemented**: `instagramFeed` → `instagram-feed`,
`videoHero` → `video-hero`. Both have a schema and a kebab mapping but no Liquid file in either engine.
They now carry the mapped-but-absent regression coverage.

---

## 3. The 10 canonical presets

Authoritative registry: `packages/theme-engine/src/theme-presets.ts:387-398`.

| Preset | Industry | Settings validation | Token overlay | Section composition | Status |
|---|---|---|---|---|---|
| `forge` | electronics | ✅ | ✅ | now resolvable | Complete but not runtime-verified |
| `sense` | fashion | ✅ | ✅ | now resolvable | Complete but not runtime-verified |
| `aura` | beauty | ✅ | ✅ | now resolvable | Complete but not runtime-verified |
| `craft` | furniture | ✅ | ✅ | now resolvable (was 0/3 templates) | Complete but not runtime-verified |
| `refresh` | food | ✅ | ✅ | now resolvable | Complete but not runtime-verified |
| `ride` | sports | ✅ | ✅ | now resolvable | Complete but not runtime-verified |
| `dawn` | books | ✅ | ✅ | now resolvable | Complete but not runtime-verified |
| `bloom` | pet | ✅ | ✅ | now resolvable | Complete but not runtime-verified |
| `nova` | *(none — override only)* | ✅ | ✅ | now resolvable | Complete but not runtime-verified |
| `summit` | general *(fallback)* | ✅ | ✅ | now resolvable | Complete but not runtime-verified |

> **The composition apply path is still not wired to a caller.** `applyExperienceToDocument` /
> `computeExperienceApplyDiff` have no runtime consumer: the merchant editor writes only the 10-key
> colour/font/radius overlay. The two blocking sections are now present, so compositions *can* resolve —
> but a merchant applying a preset still gets tokens only. `ExperiencePicker` advertises a section count
> that applying does not produce. **Partial** at the product level; call-site wiring is
> [25-follow-up-backlog.md](25-follow-up-backlog.md) P1.
>
> `theme_presets` holds **1 row** (`Urban Kicks Default`). The 10 experiences are code-resident with
> **zero** DB representation.

---

## 4. Platform boundaries

| Capability | Status | Evidence |
|---|---|---|
| **React fallback (renderer parity)** | **Blocked by ARB** | Coerced Liquid sections carry `rendererKey: 'liquid.section.<type>'`, which never matches `COMPATIBILITY_RENDERER_KEYS` in `renderer-registry.tsx`. 22 of 44 sections fall back to a "Renderer not available" placeholder. THEME-R6 designates this switch as *the* rollback — **so Liquid has no working rollback** |
| **Liquid render pipeline** | **Complete and verified** | 1 730/1 730 engine tests |
| **Liquid ⇄ React engine selection** | **Complete and verified** | Five-step chain traced; default OFF confirmed by `theme-governance-validator` |
| **Cart (server authority)** | Partial | Server cart is canonical, but **two cart implementations share one localStorage namespace** and the Liquid one sends `variant_id: null` |
| **Guest → authenticated cart merge** | **Not implemented** | No client sets `customer_id`; `carts.customer_id` is always NULL from the storefront |
| **Cart → checkout handoff (ART-14 signed)** | **Blocked by ARB** | Correctly implemented **and orphaned** — no first-party client uses it |
| **Live order-create path** | **Blocked by ARB** | `POST /v1/storefront/:subdomain/orders` accepts raw `items[]` with no cart binding or session. Server-authoritative *pricing* does hold |
| **COD** | **Blocked by ARB** | Not ledgered at confirm (PAY-R2) |
| **Razorpay** | **Blocked by external dependency** | Server-side HMAC verification exists; no mock/sandbox adapter, so unverifiable offline |
| **GST** | **Blocked by ARB** | Computes to zero (the client never sends `address.stateCode`); invoices never issued |
| **Customer session (HS256)** | Partial | Works, but **two incompatible token shapes** under one cookie (30 min vs 7 days) |
| **Turnstile on login/register** | Partial | Enforced by the gateway; the **Liquid sections ship no widget**, so no-JS auth always 403s |
| **Tenant isolation (theme surface)** | **Complete and verified** | 6/6 two-site suite with TEST-R4 positive control; migration 196 applied and reverted cleanly |
| **Theme install / publish / rollback** | Partial | Works; but `GET …/editor` mutates state and `GET …/schema` writes unauthenticated — **Blocked by ARB** |
| **Fresh-database provisioning** | **Complete and verified** | 124 migrations replayed from zero, 0 failures; `letbuyy-core` now present via migration 197 |
| **Open Graph / favicon meta** | **Blocked by ARB** | Requires `property`/`rel` in the sanitizer `ADD_ATTR` — a THEME-R4 / SEC-R11 allowlist change |
| **Merchant theme editor** | Complete but not runtime-verified | Builds clean; not driven in a browser |
| **Design-system token adoption (bundle)** | Partial | Layout now uses `--lb-*`; `apps/storefront-runtime/.../liquid-theme.css` still has 0 `--lb-*`, 34 raw hex, 28 raw px and is desktop-first |
| **Accessibility baseline (bundle)** | Complete but not runtime-verified | Skip link, `<header>`/`<footer>` landmarks, `:focus-visible`, mobile-first CSS — **no screen-reader or contrast audit run** |
