# Feature Classification

**Date:** 2026-06-19  
**Method:** Evidence-based classification using blocker report, capability backlog, and feature completeness scores.

---

## Classification Key

| Label | Meaning |
|---|---|
| **LAUNCH NOW** | Complete, production-ready, no blockers |
| **FINISH BEFORE LAUNCH** | Incomplete or blocked; must be finished for V1.0.0 |
| **DELAY TO V1.1** | Works but has gaps; safe to launch without, add within 60 days |
| **DELAY TO V2** | Planned feature; not started or early stage; 6–12 months |
| **REMOVE** | Broken or permanently frozen; remove from merchant-visible UI |

---

## Products

| Feature | Classification | Reason |
|---|---|---|
| Product CRUD (create/edit/delete) | **LAUNCH NOW** | Fully implemented, committed, tested |
| Product variants (matrix builder) | **LAUNCH NOW** | LB-5 committed; real variant[] → cart |
| Product inventory management | **LAUNCH NOW** | 18 RPCs, per-location levels, reservations |
| Collections | **LAUNCH NOW** | LB-6 committed; collection→products→storefront |
| Inventory adjustments | **LAUNCH NOW** | Adjust levels, transfer, receive |
| Media upload | **LAUNCH NOW** | R2 + media route |
| Basic SEO (title/description/robots) | **LAUNCH NOW** | Next.js SSR, sitemap, robots |
| Purchase orders | **LAUNCH NOW** | Full PO workflow implemented |
| Metafields | **LAUNCH NOW** | Definition + value system |
| Bulk import (CSV) | **DELAY TO V1.1** | No dedicated import route |
| Media library (centralized) | **DELAY TO V1.1** | No media library page |
| Structured data (JSON-LD) | **DELAY TO V1.1** | Not confirmed |
| Smart collection rule builder UI | **DELAY TO V1.1** | Tables exist, UI unconfirmed |
| Bulk product edit | **DELAY TO V2** | Multi-select + action not built |
| AI product description generator | **DELAY TO V1.1** | AI route exists (`/ai`), integration unverified |

---

## Orders

| Feature | Classification | Reason |
|---|---|---|
| Order creation via checkout | **LAUNCH NOW** | `create_checkout_order` RPC canonical |
| Order list + search + filter | **LAUNCH NOW** | 28 endpoints, 1414 lines |
| Order status management | **LAUNCH NOW** | Full status transitions implemented |
| Refunds (step-up protected) | **LAUNCH NOW** | LB-3 committed; Razorpay refund + ledger |
| COD order management | **LAUNCH NOW** | `set_pending_cod_order_status` + COD reconciliation |
| Draft orders | **LAUNCH NOW** | `draft_order_lines` table + API |
| Purchase orders | **LAUNCH NOW** | Full PO → receipt workflow |
| Order risk assessment | **LAUNCH NOW** | `order_risk_assessments` table + route |
| Order notes | **DELAY TO V1.1** | Not confirmed in UI |
| Order timeline UI | **DELAY TO V1.1** | Event infrastructure exists; UI gap |
| Partial refunds (line item selection) | **DELAY TO V1.1** | Full refund confirmed; partial UI unverified |
| Order editing after placement | **DELAY TO V2** | Not in V1 scope |

---

## Customers

| Feature | Classification | Reason |
|---|---|---|
| Customer login | **LAUNCH NOW** | HS256 session, Turnstile, rate limited |
| Customer account (view profile) | **LAUNCH NOW** | Account pages implemented |
| Customer orders view | **LAUNCH NOW** | Account order list + detail |
| Customer addresses | **LAUNCH NOW** | CRUD + checkout prefill |
| Customer wishlist | **LAUNCH NOW** | `wishlists` table + UI |
| Customer settings | **LAUNCH NOW** | Settings page implemented |
| **Customer registration** | **FINISH BEFORE LAUNCH** | LB-12: dead button — ~1–2 dev-days |
| **Password reset** | **FINISH BEFORE LAUNCH** | Tied to LB-12 fix |
| Guest order lookup | **LAUNCH NOW** | Order number + email lookup |
| Customer segments | **DELAY TO V1.1** | Data exists, segmentation UI not built |
| Social login (Google/Apple) | **DELAY TO V2** | Not in scope |
| Saved payment methods | **DELAY TO V2** | Not in scope |

---

## Checkout

| Feature | Classification | Reason |
|---|---|---|
| Cart (add/remove/update) | **LAUNCH NOW** | Cart context, drawer, API |
| Razorpay payment | **LAUNCH NOW** | LB-2 committed; HMAC signature verified |
| COD payment | **LAUNCH NOW** | COD path + reconciliation |
| Coupon application | **LAUNCH NOW** | Validation + server-authoritative |
| Order success page | **LAUNCH NOW** | Success page + confirmation email |
| Auto-create customer on order | **LAUNCH NOW** | `orders/set-password` path |
| **Shipping rates at checkout** | **FINISH BEFORE LAUNCH** | LB-7: validated, needs commit |
| **GST computation at checkout** | **FINISH BEFORE LAUNCH** | LB-7: validated, needs commit |
| **Appearance settings in storefront** | **FINISH BEFORE LAUNCH** | LB-9: appearance bridge dead island |
| UPI (via Razorpay modal) | **LAUNCH NOW** | Razorpay handles UPI natively |
| International payments | **DELAY TO V2** | India-first; not in V1 scope |
| One-click checkout | **DELAY TO V2** | Not in scope |
| Checkout extensions / plugins | **DELAY TO V2** | Not in scope |

---

## Shipping

| Feature | Classification | Reason |
|---|---|---|
| Shipping zones | **LAUNCH NOW** | `shipping_zones` + settings UI |
| **Shipping rates** | **FINISH BEFORE LAUNCH** | LB-7 uncommitted |
| Manual fulfillment | **LAUNCH NOW** | Mark fulfilled + tracking number |
| Tracking number entry | **LAUNCH NOW** | `shipments` table + fulfillment |
| Fulfillment workflow | **LAUNCH NOW** | `fulfillment_orders` + `create_order_fulfillment` |
| Free shipping threshold | **FINISH BEFORE LAUNCH** | Depends on LB-7 |
| Shiprocket live integration | **DELAY TO V1.1** | CAP-C16: no live carrier client |
| Automated label generation | **DELAY TO V1.1** | CAP-C16 |
| Live tracking webhooks | **DELAY TO V1.1** | CAP-C16 |
| Returns portal | **DELAY TO V2** | Not in scope |

---

## Discounts

| Feature | Classification | Reason |
|---|---|---|
| Coupons (percentage + fixed) | **LAUNCH NOW** | Full CRUD + validation + checkout |
| Usage limits | **LAUNCH NOW** | Global + per-customer |
| Minimum order value | **LAUNCH NOW** | Enforced in `evaluate_checkout_promotion` |
| Expiry dates | **LAUNCH NOW** | Enforced server-side |
| Free shipping threshold | **FINISH BEFORE LAUNCH** | Depends on LB-7 |
| Promotion rules engine | **LAUNCH NOW** | `promotions` + `promotion_rules` |
| Bulk coupon generation | **DELAY TO V1.1** | Not built |
| Marketing campaigns | **DELAY TO V1.1** | Tied to H6 (Resend) |
| BOGO rules | **DELAY TO V2** | Not confirmed in rule engine |
| Loyalty points | **DELAY TO V2** | Not in scope |

---

## Themes

| Feature | Classification | Reason |
|---|---|---|
| Urban Kicks theme (React) | **LAUNCH NOW** | Committed via mig 180-181 |
| Theme editor (section customization) | **LAUNCH NOW** | Editor page + publish flow |
| Theme preview | **LAUNCH NOW** | Live preview sessions |
| Theme publish | **LAUNCH NOW** | `publish_theme_release` RPC |
| **Announcement bar** | **FINISH BEFORE LAUNCH** | LB-8: missing, ~1 day to fix |
| **Appearance settings → storefront** | **FINISH BEFORE LAUNCH** | LB-9: dead island, ~2–3 days |
| Theme presets | **DELAY TO V1.1** | `apply_preset` API missing |
| Liquid engine (as storefront default) | **DELAY TO V1.1** | CAP-C08: canary off, ARB flip required |
| Theme marketplace | **REMOVE** | FROZEN per CLAUDE.md; remove nav links |
| Multiple themes per store | **LAUNCH NOW** | `theme_instances` table + multiple theme support |
| Mobile theme editor (Flutter) | **DELAY TO V1.1** | CAP-C12 live cert needed |

---

## Domains

| Feature | Classification | Reason |
|---|---|---|
| Subdomain routing | **LAUNCH NOW** | LB-1 committed; proxy.ts middleware |
| Custom domain assignment | **LAUNCH NOW** | `custom-domains.ts` + verification |
| DNS verification | **LAUNCH NOW** | CNAME + TXT verification |
| SSL (via Cloudflare) | **LAUNCH NOW** | Automatic, no code needed |
| Domain purchase | **DELAY TO V1.1** | Requires registrar sandbox + provider |

---

## Auth & Security

| Feature | Classification | Reason |
|---|---|---|
| Merchant auth (ES256) | **LAUNCH NOW** | Identity platform, asymmetric JWT |
| Customer auth (HS256) | **LAUNCH NOW** | Separate issuer, session separation |
| Step-up for refunds/payouts | **LAUNCH NOW** | Code complete; CAP-C06 = live cert |
| Turnstile bot protection | **LAUNCH NOW** | On all auth forms |
| Rate limiting | **LAUNCH NOW** | Upstash Redis |
| RLS tenant isolation | **LAUNCH NOW** | 651 policies, validators green |
| Session rotation | **LAUNCH NOW** | Durable revocation |
| Staff user management | **LAUNCH NOW** | Settings users page |
| OIDC partner SSO | **DELAY TO V1.1** | CAP-C07, not active in V1 |
| mTLS for internal routes | **DELAY TO V1.1** | SKIP-W4-MTLS human seam |
| Automated KYC (Signzy/HyperVerge) | **DELAY TO V1.1** | CAP-C15: sandbox only |

---

## Analytics

| Feature | Classification | Reason |
|---|---|---|
| Analytics infrastructure | **LAUNCH NOW** | Tables, RPCs, event store all built |
| Revenue dashboard | **LAUNCH NOW** | Will populate as orders flow |
| Orders analytics | **LAUNCH NOW** | Same |
| Real-time telemetry | **DELAY TO V1.1** | NOT CONNECTED; adapter-bound |
| Advanced cohort analysis | **DELAY TO V2** | Not built |
| Competitor benchmarking | **DELAY TO V2** | Not in scope |

---

## Marketing

| Feature | Classification | Reason |
|---|---|---|
| SEO (sitemap/robots/SSR) | **LAUNCH NOW** | Fully implemented |
| Product reviews | **LAUNCH NOW** | `product_reviews` + moderation |
| Blog | **LAUNCH NOW** | `blog_posts` + storefront route |
| Contact forms | **LAUNCH NOW** | `contact_submissions` + `form_submissions` |
| Order confirmation email | **LAUNCH NOW** | Template exists + works when H6 set |
| Order shipped email | **LAUNCH NOW** | Template exists + works when H6 set |
| **Cancelled/refunded lifecycle emails** | **FINISH BEFORE LAUNCH** | LB-10: ~2 dev-days |
| WhatsApp notifications | **DELAY TO V1.1** | Tables exist; no live provider |
| Abandoned cart recovery | **DELAY TO V1.1** | No trigger/template built |
| Marketing email campaigns | **DELAY TO V1.1** | Tables exist; live email + UI needed |

---

## Operations

| Feature | Classification | Reason |
|---|---|---|
| Platform console (admin) | **LAUNCH NOW** | Full internal ops tooling |
| Support ticket system | **LAUNCH NOW** | Tables + routes built |
| Review moderation | **LAUNCH NOW** | Moderation workflow |
| Order fraud signals | **LAUNCH NOW** | `order_risk_assessments` |
| Money reconciliation | **LAUNCH NOW** | Dual-control console |
| LCIS intelligence layer | **LAUNCH NOW** | Fully operational |
| KYC manual review | **LAUNCH NOW** | Manual review path works |
| Automated KYC | **DELAY TO V1.1** | CAP-C15 |
| Chargeback management UI | **DELAY TO V2** | Tables exist; no UI workflow |

---

## To Remove (from visible UI before launch)

| Item | Reason | Action |
|---|---|---|
| Gift cards nav + page | Issuance writes wrong table; codes unredeemable | Hide nav + page |
| Marketplace links in apps page | Points to frozen `apps.letbuyy.com` | Remove 3 links |
| Marketplace links in AppsSettings | Same | Remove links |
| Theme marketplace link in themes page | Points to frozen `themes.letbuyy.com` | Remove 2 links |

*Note: LB-11 covers these 5 actions. ~0.5 dev-day.*
