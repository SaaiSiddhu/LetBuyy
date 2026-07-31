# Liquid Gap Matrix (V1)

**Type:** Research / certification — no code changes. **Date:** 2026-06-16.
**Purpose:** Map every React renderer/surface to its Liquid equivalent and define the exact gap to close. Parent: [LIQUID_PARITY_AUDIT.md](LIQUID_PARITY_AUDIT.md) · [REACT_DEPENDENCY_INVENTORY.md](REACT_DEPENDENCY_INVENTORY.md) · [LIQUID_ONLY_MIGRATION_PLAN.md](LIQUID_ONLY_MIGRATION_PLAN.md).
**Status:** **FULL** = exists + data + interactivity · **PARTIAL** = exists with gaps · **MISSING** = no Liquid path.

---

## 1. React renderer → Liquid equivalent (section level)

| React renderer (`renderer-registry.tsx`) | Liquid section (`theme-bundle.ts`) | Status | Gap to close |
|---|---|:--:|---|
| `core.header` | `header` `:965` | **FULL** | — |
| `core.footer` | `footer` `:947` | **FULL** | — |
| `core.hero` | `hero-banner` `:984` | **FULL** | — |
| `core.product-grid` | `product-grid` `:1047` | **FULL** | — |
| `core.featured-products` | `featured-products` `:906` | **FULL** | — |
| `core.product-detail` | `product-detail` `:1029` | **PARTIAL** | `variant_id` not propagated to server cart (`liquid-hydration-islands.tsx:81`) |
| `commerce.category-grid` | `category-grid` `:851` | **FULL** | — |
| `commerce.brand-marquee` | `brand-marquee` `:839` | **FULL** | — |
| `commerce.trust-badges` | `trust-badges` `:1126` | **FULL** | — |
| `core.testimonials` | `testimonials` `:1111` | **FULL** | — |
| `core.about` | `about-section` `:786` | **FULL** | — |
| `core.newsletter` | `newsletter-signup` `:1141` | **FULL** | verify submit endpoint parity |
| `core.cta` | `cta-section` `:889` | **FULL** | — |
| `core.contact-form` | `contact-form` `:873` | **FULL** | verify form submission wiring |
| `core.rich-content` | `rich-content` `:1066` | **FULL** | — |
| `core.portfolio-grid` | `portfolio-grid` `:1014` | **FULL** | — |
| `core.skills` | `skills-section` `:1096` | **FULL** | — |
| `core.experience-timeline` | `experience-timeline` `:930` | **FULL** | — |
| `core.services-grid` | `services-grid` `:1080` | **FULL** | — |
| `apps.app-block-slot` | `app-block-slot` `:803` | **FULL** | app-block HTML built in `composition-engine.tsx:100-216` |
| (no React renderer) | `announcement-bar` `:771`, `marquee` `:1004`, `banner-carousel` `:818` | Liquid-only extras | — |
| `collectionFilter` (schema only `index.ts:31`) | — | **MISSING (both)** | build filter section + data + UI in Liquid |

**Section-level parity is HIGH:** ~20/21 presentation sections have a FULL Liquid equivalent. The section renderers are **not** the blocker.

---

## 2. Surface / capability gap matrix (where Liquid-only actually breaks)

| Surface | React | Liquid status | Gap to close | Severity |
|---|---|:--:|---|:--:|
| **Checkout** | `checkout-client.tsx` + Razorpay SDK | **MISSING** | Build a Liquid checkout template + a `checkout` hydration island wrapping the Razorpay SDK + COD flow; route `checkout/page.tsx` through composition engine | 🔴 BLOCKER |
| **Cart page** | `cart/page.tsx` | **PARTIAL** | Route the cart page through composition engine using the dormant Liquid `cart` template (`theme-bundle.ts:2149`); feed a real `cart` drop (not the `browser_hydrated` shell `composition-engine.tsx:279-288`) | 🔴 BLOCKER |
| **Customer account** (login/register/profile/addresses) | `account/*` + `customer-auth-context.tsx` | **MISSING** | Build Liquid account templates + auth hydration islands; populate `customer` drop (today `null` `composition-engine.tsx:337`) | 🔴 BLOCKER |
| **Order history / detail** | `account/orders`, `orders/page.tsx` | **PARTIAL** | Wire dormant Liquid order templates (`theme-bundle.ts:2195,2209`) to a route; build an `orders`/`customer.orders` drop | 🔴 BLOCKER |
| **Search** | none (no backend) | **MISSING** | Build a search backend/endpoint + a Liquid `search` route that consumes `?search=`; today island posts to `/shop?search=` which is ignored (`liquid-hydration-islands.tsx:359`) | 🔴 BLOCKER |
| **Collection filter/sort/pagination** | none | **MISSING** | Build filter data + Liquid filter section (the `collectionFilter` type has no renderer) | 🟠 HIGH |
| **Wishlist** | `wishlist-context.tsx` + page | **MISSING** | Liquid wishlist section + island + `customer.wishlist` drop | 🟠 HIGH |
| **Reviews** | `api/reviews` + React | **MISSING** | Liquid reviews section + `product.reviews` drop | 🟠 HIGH |
| **Blog** | `blog/[slug]/page.tsx` | **MISSING** | Liquid blog templates + content drop | 🟠 HIGH |
| **CMS pages** | `content-resource-renderer.tsx` | **MISSING** | Liquid `page` template route for `[...path]` | 🟠 HIGH |
| **Recommendations / Upsells** | none | **MISSING (both)** | Net-new: recommendation engine + Liquid section + drop | 🟡 MEDIUM |
| **Policy pages** | React | **MISSING** | Liquid `page` templates (low complexity) | 🟡 MEDIUM |
| **Localization** | `localizeThemeTemplateConfig` | **FULL (Liquid stronger)** | none — `t` filter + multi-lang tables (`theme-renderer.ts:673`) | ✅ |
| **Catalog (home/product/collection)** | composition engine | **FULL** | flip default + per-theme bundles + parity tests | ✅/🟠 |

---

## 3. Data drop gap matrix (Liquid commerce context)

`composition-engine.tsx:299-339` — what Liquid receives vs needs for Liquid-only:

| Drop | Today | Needed for Liquid-only | Gap |
|---|:--:|:--:|---|
| `shop` | ✅ | ✅ | — |
| `product` / `products` | ✅ | ✅ | — |
| `collection.products` | ✅ | ✅ | — |
| `variants`/`options` | 🟡 | ✅ | propagate `variant_id` to server cart |
| `cart` | 🟡 shell | ✅ real lines/totals | build server-hydrated cart drop |
| `customer` | ❌ `null` `:337` | ✅ | build customer drop from session |
| `customer.orders` | ❌ | ✅ | build orders drop (template already references it `theme-bundle.ts:2195`) |
| `product.reviews` | ❌ | ✅ | build reviews drop |
| `recommendations` | ❌ | ✅ | build recommendations engine + drop |
| `theme settings` | ✅ | ✅ | — |

---

## 4. Gap summary

| Gap class | Count | Items |
|---|:--:|---|
| 🔴 BLOCKER | 5 | checkout, cart page wiring+data, account/auth+customer drop, order history wiring+drop, search backend |
| 🟠 HIGH | 5 | collection filter, wishlist, reviews, blog, CMS pages |
| 🟡 MEDIUM | 3 | recommendations/upsells, policy pages, variant_id propagation |
| ✅ DONE | catalog sections + localization + theme settings + editor/preview Liquid path |

**Bottom line:** the **section renderers are ~95% there**; the **gap is the transactional/account/discovery surfaces + their data drops + route wiring**, not the visual sections. Liquid-only is a *capability* and *route-wiring* problem, not a *section-template* problem.
