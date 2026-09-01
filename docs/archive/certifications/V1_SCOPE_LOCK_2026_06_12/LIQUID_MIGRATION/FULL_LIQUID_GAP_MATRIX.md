# FULL_LIQUID_GAP_MATRIX.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · code-cited. For each capability: backend Exists/Partial/Missing · Liquid template Exists/Partial/Missing · current owner · the phase that closes it.

**Key:** B=backend, LT=Liquid template/render, ●=exists ◐=partial ○=missing. "Owner today" = React (R) / Liquid (L) / engine-agnostic (EA).

| # | Capability | B | LT | Owner today | What's missing for Full Liquid | Phase |
|---|---|---|---|---|---|---|
| 1 | Home | ● | ◐ | R sections | bundle+CSS+real drops; index template exists | L1,L2,L5 |
| 2 | Collections | ● EA | ○ | R (composition) | `collection` template + real title/desc drop (`composition-engine.tsx:301`) | L6 |
| 3 | Products | ● EA | ○ | R island (`product-details-client.tsx`) | `product` template (orphaned `product-detail.liquid` exists); variant→price | L5 |
| 4 | Search | ◐ client-only | ○ | R | `search` template; ideally a real product-search endpoint (none today) | L7 |
| 5 | Cart | ● `cart-routes.ts` | ◐ drawer island only | EA backend / R page | full-page `cart` template; cart drop fill (`:279`) | L8 |
| 6 | Checkout handoff | ● EA | ● by design | EA (React on `checkout.` origin) | **nothing** — checkout stays React under any engine (ART per Constitution:234); Liquid links to it | — |
| 7 | Login | ● `/api/customer/login` | ○ | R sheet | `customers/login` template | L9 |
| 8 | Registration | ◐ (LB-12 gap) | ○ | R (broken set_password) | register endpoint (LB-12) + `customers/register` template | L9 |
| 9 | Customer account | ● `/api/customer/*` | ○ | R | `customers/account` template; `customer` drop (`:323`) | L10 |
| 10 | Orders (history) | ● `/api/customer/orders` | ○ | R | order-history template | L11 |
| 11 | Order details | ● | ○ | R | `customers/order` template | L11 |
| 12 | Order tracking | ● | ○ | R timeline | order-status Liquid template | L12 |
| 13 | Addresses | ● `/api/customer/addresses` | ○ | R | `customers/addresses` template | L10 |
| 14 | Wishlist | ● `/api/customer/wishlist` | ○ | R context | Liquid wishlist template/island | L10 |
| 15 | Theme settings | ● editor→JSON | ○ Liquid | R editor | portable→Liquid compiler; editor emit bundle | L3,L13 |
| 16 | Theme customization | ● section CRUD | ○ Liquid | R editor | compiler + editor preview Liquid | L13 |
| 17 | Header | ● nav data | ◐ Liquid section exists, not used | R chrome (CAP-C08) | switch layout to Liquid header + nav-menu binding | L4 |
| 18 | Footer | ● | ◐ Liquid section exists | R chrome | switch layout to Liquid footer | L4 |
| 19 | Navigation | ● `navigation_menus` (`000_baseline.sql:9855`) | ○ Liquid binding | R `dynamic-header.tsx` | bind nav menus into Liquid header | L4 |
| 20 | CMS pages | ● ContentService | ◐ `[...path]` composition-routed | EA | author Liquid `page` template; migrate policies (R) → CMS/Liquid | L5/L13 |
| 21 | 404 / Policies | ● content | ○ | R (Next not-found + bespoke policy pages) | Liquid `404` + `page` templates | L5/L13 |

## Roll-up

- **Backends:** ~95% already exist and are engine-agnostic (cart/account/orders/checkout/CMS). The only thin backend gaps: **search** (no product-search endpoint — client-filter today) and **registration** (LB-12, itself pending).
- **Liquid templates:** the dominant gap. Missing for product, collection, search, cart, login, register, account, addresses, wishlist, orders, order-detail, tracking, page, 404. Present-but-fixture-only for sections + index/header/footer.
- **Cross-cutting blockers (gate every template):** bundle persistence (L1), CSS pipeline (L2), drops fill (L5), chrome+nav (L4), parity proof (L14), canary writer (L15), ARB flip (L16).
- **Authoring:** the portable→Liquid compiler (L3) is the single largest net-new build and gates merchant customization (L16/theme-customization).

## React-owned vs Liquid-owned (target)

Everything in column "Owner today = R" that is a **page/section** must move to Liquid (templates) — except **checkout (#6)**, which the Constitution (ART, §234) keeps as the hosted React origin consuming a signed cart handoff under any renderer. Everything "EA" (backends, services, API proxies, the composition switch, template resolver, data-binding) **stays** — Liquid reuses it. So "Full Liquid storefront" = all customer-facing **render** is Liquid; the **commerce backend + the hosted checkout** remain engine-agnostic (and that is constitutional, not a hybrid compromise).
