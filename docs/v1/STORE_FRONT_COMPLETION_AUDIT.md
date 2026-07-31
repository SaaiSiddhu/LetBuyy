# Storefront Completion Audit (Post-Slice-7 Certification)

**Type:** Research / certification — **no implementation.** **Date:** 2026-06-16.
**Method:** LCIS (`graphify-out` domain intel) → grep → source verification → contract verification. Every figure is source-derived from the current tree (after slices 1–7).
**Supersedes** the pre-slice baselines ([STOREFRONT_CERTIFICATION_AUDIT.md](STOREFRONT_CERTIFICATION_AUDIT.md), [LIQUID_PARITY_AUDIT.md](LIQUID_PARITY_AUDIT.md), [LIQUID_100_PERCENT_PARITY_PLAN.md](LIQUID_100_PERCENT_PARITY_PLAN.md)).
**Companion docs:** [STORE_FRONT_ROUTE_MATRIX.md](STORE_FRONT_ROUTE_MATRIX.md) · [STORE_FRONT_REACT_DEPENDENCIES.md](STORE_FRONT_REACT_DEPENDENCIES.md) · [STORE_FRONT_LIQUID_PARITY.md](STORE_FRONT_LIQUID_PARITY.md) · [STORE_FRONT_UX_CERTIFICATION.md](STORE_FRONT_UX_CERTIFICATION.md) · [STORE_FRONT_REACT_REMOVAL_PLAN.md](STORE_FRONT_REACT_REMOVAL_PLAN.md)

---

## The 6 Success-Criteria Numbers

| # | Metric | Value | Basis |
|---|---|---|---|
| 1 | **Liquid completion** | **≈ 52%** | weighted across surfaces (table below); up from ~40% pre-slices |
| 2 | **React dependency** | **≈ 48%** | surfaces where React is the sole or fallback renderer |
| 3 | **Route coverage** (Liquid-capable / total) | **8 / 21 ≈ 38%** | route matrix |
| 4 | **Template coverage** (routed / needed) | **6 / ~18 ≈ 33%** | 10 templates exist, 6 are routed, ~8 still missing |
| 5 | **Drop coverage** (Shopify parity, avg) | **≈ 65%** | drop audit |
| 6 | **Remaining work / React removal** | **React NOT removable** — 5 blocker areas | removal plan |

> All figures are **STRUCTURAL** (source-verified). Runtime behavior is **UNVERIFIED** — the environment has **0/13 live integrations** (`connections-intel.json`) and no Liquid-enabled store + Supabase to exercise the chain.

---

## Liquid completion — weighted breakdown

| Surface | Weight | Liquid-ready | Contribution | Evidence |
|---|:--:|:--:|:--:|---|
| Catalog presentation (home/product/collection/grid) | 25% | 85% | 21.3 | composition-engine + ~20 sections |
| Product detail (+reviews +wishlist toggle) | 8% | 85% | 6.8 | slices 1,2,4 |
| Cart (page activated, backend totals) | 10% | 75% | 7.5 | slices 5,6 |
| Customer account (dashboard+orders Liquid) | 12% | 45% | 5.4 | slice 7 (settings/wishlist/addresses still React) |
| Localization | 5% | 90% | 4.5 | `t` filter + lang tables |
| Reviews (read+write) | 4% | 85% | 3.4 | slices 1,2 |
| Wishlist (toggle done; page React) | 4% | 60% | 2.4 | slice 4 |
| Orders (guest + detail) | 4% | 30% | 1.2 | order-detail template dormant |
| Checkout | 15% | 5% | 0.75 | React + Razorpay island |
| Search / filter / sort | 6% | 5% | 0.3 | absent |
| Blog / CMS / policies | 4% | 10% | 0.4 | React only |
| Analytics (client funnel) | 3% | 5% | 0.15 | not emitted |
| **Total** | **100%** | — | **≈ 54%** | |

(Rounded to **~52%** allowing for unverified runtime risk.)

---

## What slices 1–7 delivered (verified static)

| Slice | Delivered | Verified |
|---|---|---|
| 1 | `product.reviews`/`rating`/`review_count` drop + product-detail render | tsc, 56/56, render |
| 2 | `lb-review-form` island (rating/title/body, Turnstile, → `/api/reviews`) | tsc, lint, tests |
| 3 | `customer` drop (id/name/email/phone/tags/orders_count/spent/marketing/default_address), tenant-safe, null-for-anon | tsc, render #4 |
| 4 | `customer.wishlist` + `product.in_wishlist` + `lb-wishlist-toggle` | tsc, tests, governance |
| 5 | `cart.{subtotal,discount_total,shipping_total,tax_total,total,coupon_codes,item_count}` backend-authoritative; drawer totals | tsc, money-calc=NONE |
| 6 | Cart page → Liquid composition engine (signed checkout handoff preserved); **sanitizer allowlist fixed** for slices 2/4/6 islands | tsc, L8 56/56 |
| 7 | Account **dashboard + orders** → Liquid (B3 server-layout refactor; route-scoped `customer.orders`) | tsc, 56/56, lint, governance |

---

## Headline verdict

The storefront is now **~52% Liquid** (up from ~40%). The **entire catalog + cart + product reviews + wishlist toggle + account dashboard/orders** render through Liquid when a theme opts in; **React remains the sole renderer for checkout, account settings/wishlist/addresses, guest orders, blog/CMS, and policy pages**, plus the React fallback for every Liquid-branched route.

**React cannot be deleted today.** The blocker areas (ranked in [STORE_FRONT_REACT_REMOVAL_PLAN.md](STORE_FRONT_REACT_REMOVAL_PLAN.md)): **checkout (LARGE), account settings/wishlist/addresses (MEDIUM), search backend (LARGE), CMS/blog/policies (MEDIUM), analytics + Liquid-default + runtime proof (MEDIUM)**.

**Exact remaining work** is enumerated per-surface in the companion docs. The single highest-leverage next step is completing the **customer-account trio** (settings/wishlist/addresses templates — each one new template + section + page branch following the slice-7 pattern), then the **search backend** (the only net-new backend in the customer/commerce path besides recommendations + analytics).
