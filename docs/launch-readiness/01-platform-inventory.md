# LetBuyy V1.0.0 — Platform Inventory

**Date:** 2026-06-19  
**Auditor:** Production Readiness Audit  
**Method:** LCIS graph queries + direct file inspection. Every claim has a source.  
**LCIS basis:** `/api/domains` (22 domains), `/api/production-readiness-v2`, `/api/launch-command-center`

---

## Architecture Overview

| Layer | Component | Status |
|---|---|---|
| **Vercel Apps** | storefront-runtime | Live |
| | merchant-control-plane | Live |
| | identity-platform | Live |
| | platform-console | Live |
| | marketing-site | Live |
| **Cloudflare Workers** | letbuyy-api (api-gateway) | Live |
| | letbuyy-webhook (webhook-service) | Live |
| | letbuyy-queue-workers | Live |
| | letbuyy-mobile-bff (mobile-bff) | Live |
| **Database** | Supabase Postgres | 186 migrations |
| **Infrastructure** | Cloudflare R2 (media) | Live |
| | Cloudflare Hyperdrive (connection pool) | Live |
| | 5 Cloudflare Queues | Live |

**Frozen / Not Deploy Targets** (per CLAUDE.md and AGENTS.md):
- `apps/app-marketplace` — frozen
- `apps/developer-portal` — frozen  
- `apps/theme-marketplace` — frozen
- `apps/platform-operations-portal` — pending consolidation
- `apps/mobile/shopper-app` — reserved placeholder
- `apps/mobile/operator-app` — reserved placeholder

---

## 22 Business Domains (LCIS graph)

| Domain | Tables | Routes | RPCs | Policies | Queues | Apps |
|---|---|---|---|---|---|---|
| **Products** | 10 | 2 | 5 | 24 | SEARCH, EVENT | merchant-cp |
| **Orders** | 10 | 3 | 12 | 27 | RUNTIME, EVENT | merchant-cp, storefront |
| **Inventory** | 9 | 1 | 18 | 20 | EVENT | merchant-cp |
| **Collections** | 4 | 1 | 0 | 4 | SEARCH, EVENT | merchant-cp |
| **Payments** | 11 | 3 | 18 | 12 | EVENT | merchant-cp, storefront |
| **Refunds** | 7 | 1 | 2 | 11 | EVENT | merchant-cp |
| **Payouts** | 10 | 4 | 5 | 16 | EVENT | merchant-cp |
| **Gift Cards** | 5 | 2 | 7 | 7 | EVENT | merchant-cp, storefront |
| **Shipping** | 10 | 3 | 1 | 20 | EVENT | merchant-cp |
| **GST & Tax** | 6 | 1 | 1 | 3 | EVENT | merchant-cp |
| **Discounts** | 11 | 2 | 2 | 20 | EVENT | merchant-cp |
| **Storefront** | 21 | 14 | 4 | 31 | RUNTIME, SEARCH, EVENT | storefront |
| **Themes** | 32 | 1 | 4 | 28 | RUNTIME, EVENT | merchant-cp, storefront |
| **Identity** | 8 | 2 | 1 | 15 | EVENT | identity-platform |
| **Authentication** | 10 | 1 | 2 | 9 | EVENT | identity-platform |
| **Authorization** | 9 | 2 | 2 | 14 | EVENT | identity, platform-console |
| **Merchant** | 22 | 5 | 9 | 35 | EVENT | merchant-cp |
| **Notifications** | 15 | 3 | 6 | 21 | NOTIFICATION, EVENT | merchant-cp |
| **Analytics** | 36 | 4 | 14 | 54 | ANALYTICS, EVENT | merchant-cp |
| **Operations** | 34 | 12 | 20 | 45 | EVENT | platform-console |
| **Marketplace** | 46 | 14 | 4 | 112 | EVENT | app-marketplace (**FROZEN**) |
| **Developer** | 4 | 3 | 0 | 6 | EVENT | developer-portal (**FROZEN**) |

**Totals:** 414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes

---

## Merchant Control Plane — UI Pages

Evidence: `apps/merchant-control-plane/src/app/[store]/`

| Section | Pages |
|---|---|
| Dashboard | `/dashboard` |
| Products | `/products`, `/products/new`, `/products/[productId]`, `/products/inventory`, `/products/collections`, `/products/purchase-orders`, `/products/transfers`, `/products/gift-cards` |
| Orders | `/orders` |
| Customers | `/customers` |
| Marketing | `/reviews`, `/coupons`, `/posts` |
| Online Store | `/online-store`, `/online-store/themes`, `/online-store/themes/[id]/editor`, `/online-store/pages`, `/online-store/preferences` |
| Analytics | `/analytics` |
| Payouts | `/payouts` |
| Settings | `/settings/general`, `/settings/payments`, `/settings/shipping`, `/settings/taxes`, `/settings/domains`, `/settings/billing`, `/settings/users`, `/settings/security`, `/settings/notifications`, `/settings/localization`, `/settings/checkout`, `/settings/custom-data`, `/settings/policies`, `/settings/plan`, `/settings/apps` |
| Other | `/ai`, `/appearance`, `/apps`, `/categories`, `/comments`, `/gallery`, `/leads` |

**Total merchant admin pages: ~45**

---

## Storefront Runtime — Consumer Pages

Evidence: `apps/storefront-runtime/src/app/store/[subdomain]/`

| Section | Pages |
|---|---|
| Store home | `/` (landing) |
| Products | `/products`, `/product/[productId]` |
| Collections | `/collections/[slug]` |
| Cart | `/cart` |
| Checkout | `/checkout`, `/checkout/success` |
| Account | `/account`, `/account/orders`, `/account/orders/[id]`, `/account/addresses`, `/account/wishlist`, `/account/settings` |
| Orders | `/orders` (guest lookup) |
| Blog | `/blog/[slug]` |
| Info | `/privacy`, `/terms`, `/returns`, `/shipping` |
| Shop | `/shop` |

---

## API Gateway Routes

Evidence: `services/api-gateway/src/routes/` — 70+ route files

Key routes: admin, ai, analytics, app-api, app-store, auth, billing, blog, categories, checkout, cod-reconciliation, commission, contacts, coupons, custom-domains, customers, domains, email, export, form-submissions, founding, gift-cards, internal-billing, internal-console, internal-events, inventory, kyc, marketing, media, metafields, notifications, onboarding, operations, order-risk, orders, pages, payments, payouts, products, returns, reviews, security, settlements, shipping, shipping-labels, shipping-tax, storefront, whatsapp

---

## Queue Workers

Evidence: `services/queue-workers/src/`

| Worker | Queues | Purpose |
|---|---|---|
| letbuyy-queue-workers | RUNTIME_QUEUE | Storefront cache, fulfillment |
| | EVENT_QUEUE | Analytics, events |
| | ANALYTICS_QUEUE | Analytics rollups |
| | NOTIFICATION_QUEUE | Email/WhatsApp delivery |
| | SEARCH_QUEUE | Product indexing |

Dead-letter queues configured for all 5.

---

## Infrastructure

| Resource | Status | Evidence |
|---|---|---|
| Cloudflare Workers (4) | Live | `wrangler.toml` bindings |
| Cloudflare R2 (media) | Live | R2 bucket binding |
| Cloudflare Hyperdrive | Live | DB connection pooling |
| Supabase Postgres | 186 migrations | `database/supabase/migrations/` |
| 5 Cloudflare Queues | Live | DLQ + all 5 producers/consumers |
| 19 production secrets | Deploy-time | `wrangler secret put` pattern |
| Vercel (5 apps) | Deploy targets | `vercel.json` |

---

## Governance Gate

| Metric | Value | Source |
|---|---|---|
| Validators | 107 total | `scripts/validate-governance.mjs` |
| Current status | 106/107 green | 1 fails: untracked mig 170 (commit seam) |
| Architecture score | 100% | LCIS |
| Infrastructure score | 100% | LCIS |
| Commerce score | 100% | LCIS (canonical ledger) |
| Overall structural | 95% | LCIS `/api/production-readiness-v2` |
| Open blockers | 5 | LB-7, LB-8, LB-9, LB-10, LB-12 |
| Launch verdict | **NO-GO** | LCIS |

---

## Module Status Summary

| Module | Exists | Functional | Production-Ready |
|---|---|---|---|
| Storefront | ✅ | ✅ | 🟡 (LB-8, LB-9) |
| Merchant Admin | ✅ | ✅ | 🟡 (LB-11 dead surfaces) |
| Checkout | ✅ | ✅ | 🟡 (LB-7 uncommitted, LB-9) |
| Auth / Identity | ✅ | ✅ | 🟡 (CAP-C06 live cert needed) |
| Products | ✅ | ✅ | ✅ |
| Orders | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | ✅ |
| Payments (Razorpay + COD) | ✅ | ✅ | 🟡 (H2 secrets) |
| Refunds | ✅ | ✅ | 🟡 (H2 step-up secret) |
| Payouts | ✅ | ✅ | 🟡 (H8 Razorpay Route) |
| Shipping | ✅ | 🟡 | 🔴 (LB-7, CAP-C16) |
| Discounts | ✅ | ✅ | ✅ |
| Themes (React) | ✅ | ✅ | 🟡 (LB-8) |
| Themes (Liquid) | ✅ | 🟡 | 🔴 (CAP-C08, canary off) |
| Domains | ✅ | ✅ | 🟡 (H3 DNS) |
| Analytics | ✅ | 🟡 | 🔴 (live telemetry NOT CONNECTED) |
| Email | ✅ | 🟡 | 🔴 (LB-10, H6 Resend) |
| Reviews | ✅ | ✅ | ✅ |
| GST | ✅ | ✅ | 🟡 (LB-7 uncommitted) |
| Customer Registration | ✅ | 🔴 | 🔴 (LB-12 broken button) |
| Customer Login | ✅ | ✅ | ✅ |
| Gift Cards | ✅ | 🔴 | 🔴 (issuance/redemption mismatch) |
| Marketplace | ✅ | 🔴 | 🔴 (FROZEN) |
| Developer Portal | ✅ | 🔴 | 🔴 (FROZEN) |
| KYC | ✅ | 🟡 | 🔴 (CAP-C15 no live provider) |
| Shiprocket Labels | ✅ | 🟡 | 🔴 (CAP-C16 sandbox only) |
| Mobile App (Flutter) | ✅ | 🟡 | 🔴 (merchant only; shopper reserved) |
| WhatsApp | ✅ | 🟡 | 🔴 (routes exist; no live provider) |
