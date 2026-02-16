# LetBuyy Administrative Apps — E-commerce Oversight

> **Part 3 of 8** | Product Moderation, Order Management, Payment Processing & Fraud Detection
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Scope:** This document covers how the Console and Team apps oversee all e-commerce operations across merchant stores, including product management, order monitoring, payment processing, shipping oversight, and fraud detection.

---

## Table of Contents

1. [E-commerce Oversight Overview](#1-e-commerce-oversight-overview)
2. [Product Management & Moderation](#2-product-management--moderation)
3. [Order Monitoring](#3-order-monitoring)
4. [Payment Processing Oversight](#4-payment-processing-oversight)
5. [Shipping & Logistics Monitoring](#5-shipping--logistics-monitoring)
6. [Coupon & Discount Oversight](#6-coupon--discount-oversight)
7. [Fraud Detection & Prevention](#7-fraud-detection--prevention)
8. [Document History](#8-document-history)

---

## 1. E-commerce Oversight Overview

### 1.1 E-commerce Scale

The admin apps oversee all store-type sites on the platform. Only **store** site types have e-commerce features; other types (portfolio, resume, blog, landing) do not process transactions.

| Metric | Description | Admin Visibility |
|---|---|---|
| **Active stores** | Store-type sites with active e-commerce | Console + Team dashboards |
| **Total products** | All products across all stores | Console: full, Team: by store |
| **Daily orders** | Platform-wide order volume | Console: aggregated, Team: per store |
| **GMV (monthly)** | Gross Merchandise Value processed | Console: revenue dashboard |
| **Failed payments** | Cross-store payment failure rate | Console: billing alerts |
| **Refund rate** | Platform-wide refund percentage | Console: billing dashboard |
| **Flagged products** | AI/manual flags for policy violations | Both: moderation queue |

### 1.2 Admin vs Merchant Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│              E-COMMERCE RESPONSIBILITY MATRIX                           │
│                                                                         │
│  MERCHANT (admin.letbuyy.store) owns:                                  │
│  ├── Creating/editing products                                         │
│  ├── Processing individual orders                                      │
│  ├── Managing inventory & variants                                     │
│  ├── Setting prices & discounts                                        │
│  ├── Configuring shipping rates                                        │
│  ├── Communicating with customers                                      │
│  └── Store-level analytics                                             │
│                                                                         │
│  ADMIN (console/team) oversees:                                        │
│  ├── Platform-wide product moderation (policy compliance)              │
│  ├── Cross-store order monitoring (anomaly detection)                  │
│  ├── Payment health (failed payments, refund patterns)                 │
│  ├── Fraud detection (suspicious activity alerts)                      │
│  ├── Content moderation (images, descriptions, reviews)                │
│  ├── Pricing policy enforcement (no predatory pricing)                 │
│  └── Aggregate analytics & reporting                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Product Management & Moderation

### 2.1 Product Moderation Queue

All new and updated products pass through an AI-powered moderation pipeline:

```
Product created or updated by merchant
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 1: AI AUTO-SCAN (Gemini 2.5 Flash — fast & cheap)    │
│  ├── Text check: product title, description, tags           │
│  │   ├── Prohibited keywords (weapons, drugs, counterfeit)  │
│  │   ├── Misleading claims ("FDA approved", "cures cancer") │
│  │   ├── 100% pricing (₹0 or suspiciously low)             │
│  │   └── Spam patterns (keyword stuffing, gibberish)        │
│  ├── Image check: all product images                        │
│  │   ├── Adult/explicit content detection                   │
│  │   ├── Watermark/copyright detection                      │
│  │   ├── Brand logo misuse (counterfeit detection)          │
│  │   └── Extremely low quality (under 200x200px)            │
│  └── Result: score 0-100                                    │
│       ├── 90-100: ✅ Auto-approved (no admin review needed) │
│       ├── 50-89:  🟡 Queued for human review                │
│       └── 0-49:   🔴 Auto-rejected (flagged immediately)    │
└──────────────────────────────────────────────────────────────┘
         │ Score 50-89
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 2: HUMAN REVIEW (Team app moderation queue)           │
│  ├── Content moderator reviews flagged product               │
│  ├── Sees: product images, title, description, price,       │
│  │   AI confidence score, specific flags                     │
│  ├── Actions:                                                │
│  │   ├── ✅ Approve (product goes live)                      │
│  │   ├── 🔄 Request edit (message sent to merchant)         │
│  │   ├── ❌ Reject (product hidden, merchant notified)      │
│  │   └── 🚫 Reject + flag store (escalate to Console)      │
│  └── Response time SLA: 4 hours                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Moderation Queue UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Content Moderation Queue                           🟡 12 items pending │
│                                                                          │
│  Filter: [All ▾] [Products ▾] [Reviews ▾] [Images ▾]  [SLA Status ▾]  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🟡 PRODUCT — "Herbal Weight Loss Supplement"                      │ │
│  │  Store: Quick Pharma (pharma-deals.letbuyy.store)                  │ │
│  │  AI Score: 42/100 │ Flags: misleading_claim, health_product        │ │
│  │  Queued: 2h 15m ago │ SLA: ⚠️ 1h 45m remaining                    │ │
│  │  ┌──────────────┬──────────────────────────────────────────────┐   │ │
│  │  │ [Product     │ Title: Herbal Weight Loss Supplement         │   │ │
│  │  │  Image       │ Price: ₹499                                  │   │ │
│  │  │  Preview]    │ Description: "Guaranteed 10kg loss in       │   │ │
│  │  │              │ 30 days with our natural formula..."        │   │ │
│  │  │              │                                              │   │ │
│  │  │              │ AI Flags:                                    │   │ │
│  │  │              │ 🔴 "Guaranteed weight loss" — misleading    │   │ │
│  │  │              │ 🟡 Health supplement — requires disclaimer  │   │ │
│  │  └──────────────┴──────────────────────────────────────────────┘   │ │
│  │  [✅ Approve] [🔄 Request Edit] [❌ Reject] [🚫 Reject + Flag]    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🟡 REVIEW — 5★ on "iPhone 15 Case"                              │ │
│  │  Store: Tech Accessories Hub                                       │ │
│  │  AI Score: 65/100 │ Flags: suspicious_pattern (5 same-IP reviews) │ │
│  │  Queued: 45m ago │ SLA: ✅ 3h 15m remaining                       │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ "Great product bought it yesterday and its amazing!!!"      │  │ │
│  │  │ — verified_purchase: false, IP: 203.0.xxx.xx (same as 4    │  │ │
│  │  │   other reviews on this product in last 24h)               │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │  [✅ Approve] [❌ Remove Review] [🚫 Remove + Warn Store Owner]   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Showing 1-5 of 12 items  │ [← Prev] [Next →]                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Product Policy Categories

| Category | Examples | Auto Action | AI Model Used |
|---|---|---|---|
| **Prohibited items** | Weapons, drugs, counterfeit goods | Auto-reject + flag store | Gemini 2.5 Flash |
| **Misleading claims** | "FDA approved", "cures disease" | Queue for review | Gemini 2.5 Flash |
| **Adult content** | Nudity, explicit material | Auto-reject | Gemini Pro (vision) |
| **Copyright violation** | Stolen images, brand misuse | Queue for review | Gemini Pro (vision) |
| **Pricing anomalies** | ₹0 products, ₹99 for ₹10K items | Queue for review | Rule-based |
| **Spam/SEO abuse** | Keyword stuffing, fake attributes | Auto-flag | Gemini 2.5 Flash |
| **Low quality** | Tiny images, empty descriptions | Merchant notified | Rule-based |
| **Fake reviews** | Same-IP patterns, bought reviews | Auto-hide + review | Gemini 2.5 Flash |

---

## 3. Order Monitoring

### 3.1 Order Overview Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Order Monitoring (Platform-Wide)                  Period: [Today ▾]    │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Total    │ │ Pending  │ │ Process- │ │ Shipped  │ │ Delivered│    │
│  │ Orders   │ │          │ │ ing      │ │          │ │          │    │
│  │ 342      │ │ 28       │ │ 15       │ │ 45       │ │ 254      │    │
│  │ ↑8% DoD  │ │ avg: 2h  │ │ avg: 4h  │ │ avg: 48h │ │ 74%      │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                                          │
│  ANOMALY ALERTS                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🔴 Fashion Hub — 12 orders from same IP in 10 minutes (fraud?)   │ │
│  │ 🟡 Tech Deals — Order #4521 amount ₹89,000 (unusually high)     │ │
│  │ 🟡 Quick Store — 3 COD orders with identical fake phone numbers  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ORDERS BY STATUS (pie chart)  │  TOP STORES BY ORDER VOLUME           │
│  ┌─────────────────────────┐   │  ┌──────────────────────────────────┐ │
│  │     ██████ Delivered    │   │  │ 1. Fashion Hub      89 orders   │ │
│  │  ███       Shipped      │   │  │ 2. Tech Deals       67 orders   │ │
│  │  ██        Processing   │   │  │ 3. Grocery Fresh    45 orders   │ │
│  │  █         Pending      │   │  │ 4. Home Decor       38 orders   │ │
│  │  ░         Cancelled    │   │  │ 5. Beauty Palace    29 orders   │ │
│  └─────────────────────────┘   │  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Admin Order Actions

Admins do **not** process orders (that's the merchant's job). Admins monitor and intervene:

| Action | Who | When | Permission |
|---|---|---|---|
| **View order details** | Console + Team | Anytime | `stores.read` |
| **Search orders cross-store** | Console + Team | Support inquiries | `stores.read` |
| **Flag suspicious order** | Console + Team | Anomaly detected | `moderation.action` |
| **Freeze store payments** | Console only | Confirmed fraud | `stores.suspend` |
| **Force refund order** | Console only | Dispute resolution | `billing.refund` |
| **View payment details** | Console only | Payment investigation | `billing.read` |
| **Export order data** | Console only | Reporting/audit | `analytics.export` |

---

## 4. Payment Processing Oversight

### 4.1 Payment Health Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Payment Health                                     [Last 7 Days ▾]     │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ Total    │ │ Success  │ │ Failed   │ │ Avg      │                  │
│  │ Attempts │ │   Rate   │ │ Amount   │ │ Ticket   │                  │
│  │ 2,450    │ │ 96.5%    │ │ ₹1.2L    │ │ ₹980     │                  │
│  │          │ │ ↑0.5pp   │ │ ↓12%     │ │ ↑8%      │                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
│                                                                          │
│  PAYMENT SUCCESS RATE (7-day trend)                                    │
│  100% ┤                                                                 │
│   98% ┤  ╭──────╮         ╭────╮       ╭──────────╮                    │
│   96% ┤──╯      ╰───╮  ╭──╯    ╰───╮╭──╯          ╰──                 │
│   94% ┤              ╰──╯           ╰╯                                 │
│   92% ┤                                                                 │
│       └─────┬─────┬─────┬─────┬─────┬─────┬─────┤                     │
│         Mon   Tue   Wed   Thu   Fri   Sat   Sun                        │
│                                                                          │
│  FAILURE BREAKDOWN                                                      │
│  ┌──────────────────────┬─────────┬─────────────────────────────────┐  │
│  │ Failure Reason       │ Count   │ Action                           │  │
│  ├──────────────────────┼─────────┼─────────────────────────────────┤  │
│  │ Insufficient funds   │ 45 (52%)│ Auto: email reminder sent       │  │
│  │ Card expired         │ 22 (25%)│ Auto: update card prompt        │  │
│  │ Bank declined        │ 12 (14%)│ Manual: contact merchant        │  │
│  │ Network timeout      │ 5 (6%)  │ Auto: retry in 1 hour          │  │
│  │ Fraud detected       │ 3 (3%)  │ Alert: review required         │  │
│  └──────────────────────┴─────────┴─────────────────────────────────┘  │
│                                                                          │
│  RAZORPAY INTEGRATION STATUS                                           │
│  API Health: 🟢 200 OK │ Webhook Latency: 145ms │ Last Error: 3d ago  │
│  [Open Razorpay Dashboard ↗] [View Webhook Logs]                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Razorpay Integration

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     RAZORPAY INTEGRATION FLOW                           │
│                                                                         │
│  CUSTOMER CHECKOUT                PLATFORM PROCESSING                  │
│  ─────────────────                ───────────────────                  │
│  Customer clicks pay  ────────▶  Razorpay API: create order            │
│                                   ├── order_id generated               │
│  Razorpay checkout        ◀──── Razorpay checkout page shown           │
│  widget opens                                                           │
│                                                                         │
│  Customer enters card ────────▶  Payment processed                     │
│  details                          ├── Razorpay handles 3DS             │
│                                   ├── Returns payment_id               │
│                                                                         │
│  SUCCESS ─────────────────────▶  Webhook: payment.captured             │
│                                   ├── Verify signature                 │
│                                   ├── UPDATE order status              │
│                                   ├── Calculate platform fee           │
│                                   │   └── GMV × fee% → platform rev   │
│                                   ├── Send confirmation email          │
│                                   └── Log transaction                  │
│                                                                         │
│  FAILURE ─────────────────────▶  Webhook: payment.failed               │
│                                   ├── Log failure reason               │
│                                   ├── Notify merchant                  │
│                                   └── Console: alert if pattern        │
│                                                                         │
│  SUBSCRIPTIONS                                                          │
│  ─────────────                                                          │
│  Razorpay Subscriptions API handles recurring billing                  │
│  ├── Plan ID mapped to LetBuyy plan tier                               │
│  ├── Webhook: subscription.charged → record payment                    │
│  ├── Webhook: subscription.pending → start retry                       │
│  └── Webhook: subscription.halted → freeze store                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Shipping & Logistics Monitoring

### 5.1 Shipping Overview

Admins monitor shipping performance across all stores but do not directly manage individual shipments:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Shipping Metrics (Platform-Wide)                 [Last 30 Days ▾]     │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ Shipped  │ │ Avg Ship │ │ Delivery │ │ Return   │                  │
│  │ Orders   │ │ Time     │ │ Rate     │ │ Rate     │                  │
│  │ 3,245    │ │ 1.8 days │ │ 94%      │ │ 4.2%     │                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
│                                                                          │
│  DELIVERY PERFORMANCE BY STORE                                         │
│  ┌────────────────┬──────────┬──────────┬───────────┬──────────────┐   │
│  │ Store          │ Shipped  │ Avg Time │ Issues    │ Fulfillment  │   │
│  ├────────────────┼──────────┼──────────┼───────────┼──────────────┤   │
│  │ Fashion Hub    │ 245      │ 1.2 days │ 3 late    │ 🟢 98.8%    │   │
│  │ Tech Deals     │ 189      │ 2.1 days │ 8 late    │ 🟡 95.8%    │   │
│  │ Grocery Fresh  │ 412      │ 0.5 days │ 2 late    │ 🟢 99.5%    │   │
│  │ Home Decor     │ 156      │ 3.4 days │ 15 late   │ 🔴 90.4%    │   │
│  └────────────────┴──────────┴──────────┴───────────┴──────────────┘   │
│                                                                          │
│  ⚠️ Home Decor flagged: 15 late deliveries (potential SLA breach)       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Coupon & Discount Oversight

### 6.1 Platform-Wide Coupon Monitoring

Admins can monitor coupon usage patterns to detect abuse:

| Monitoring Point | Description | Alert Threshold |
|---|---|---|
| **Coupon redemption rate** | % of orders using coupons | >50% = review |
| **Deep discount rate** | Coupons offering >50% off | Any = flag |
| **Repeat coupon abuse** | Same user using multiple coupons | >3 per day = alert |
| **Cross-store coupon sharing** | Coupon codes leaked publicly | Spike in unique users |
| **Free shipping abuse** | 100% shipping discount patterns | >80% of orders |
| **Revenue impact** | Total discount amount vs GMV | >15% of GMV = review |

### 6.2 Admin Coupon Actions

| Action | Console | Team |
|---|---|---|
| View all active coupons (by store) | ✅ | 🔍 |
| Disable an abused coupon | ✅ | ❌ |
| Set platform-wide coupon policies | ✅ | ❌ |
| Alert merchant about abuse patterns | ✅ | ✅ |
| View coupon analytics | ✅ | 🔍 |

---

## 7. Fraud Detection & Prevention

### 7.1 Fraud Detection System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-LAYER FRAUD DETECTION                          │
│                                                                         │
│  LAYER 1: REAL-TIME RULES ENGINE (Cloudflare Worker)                   │
│  ├── Rate limiting: Max 10 orders/min per IP                           │
│  ├── Velocity check: Max 5 orders per store per minute                 │
│  ├── Amount check: Flag orders > ₹50,000 (configurable)               │
│  ├── COD check: Max 3 COD orders per phone number per day             │
│  └── Geo check: IP country ≠ shipping country → flag                  │
│                                                                         │
│  LAYER 2: AI PATTERN DETECTION (Gemini 2.5 Flash)                      │
│  ├── Fake address detection: AI trained on real addresses              │
│  ├── Review spam: Same-IP review clusters                              │
│  ├── Account creation patterns: Bot signup detection                   │
│  ├── Price manipulation: Store owner editing prices during order       │
│  └── Collusion: Store owner ordering from own store for GMV inflation │
│                                                                         │
│  LAYER 3: IP INTELLIGENCE (Cloudflare)                                  │
│  ├── VPN/proxy detection                                                │
│  ├── Tor exit node blocking                                             │
│  ├── Known bot network IPs                                              │
│  └── Geographic anomaly detection                                       │
│                                                                         │
│  LAYER 4: HUMAN REVIEW (Console → Security Dashboard)                  │
│  ├── Manual review of high-risk alerts                                 │
│  ├── Pattern analysis across stores                                    │
│  ├── Account investigation tools                                       │
│  └── Escalation to legal if needed                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Fraud Alert Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Security — Fraud Alerts                          🔴 4 active alerts    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🔴 HIGH — Bulk Order Fraud Suspected                              │ │
│  │ Store: Tech Deals │ Detected: 15 min ago │ Auto-action: held      │ │
│  │                                                                    │ │
│  │ 12 orders from IP 203.0.xxx.xx in 10 minutes                     │ │
│  │ All COD, different names but same phone suffix                    │ │
│  │ Total value: ₹1,45,000                                            │ │
│  │ Risk score: 95/100                                                │ │
│  │                                                                    │ │
│  │ [📋 View Orders] [🔒 Hold Payments] [🚫 Block IP] [✅ Clear]      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🟡 MEDIUM — Possible Review Manipulation                          │ │
│  │ Store: Beauty Palace │ Detected: 2h ago                           │ │
│  │                                                                    │ │
│  │ 8 five-star reviews from 4 IPs in 24 hours                       │ │
│  │ None are verified purchases                                       │ │
│  │ Risk score: 72/100                                                │ │
│  │                                                                    │ │
│  │ [🔍 Investigate] [🗑️ Remove Reviews] [⚠️ Warn Store Owner]        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Anti-Fraud Action Matrix

| Alert Type | Auto Action | Console Action | Team Action | Audit |
|---|---|---|---|---|
| **Bulk orders (same IP)** | Hold payments | Block IP, freeze store | Investigate | critical |
| **Fake reviews** | Auto-hide reviews | Remove + warn merchant | Review queue | warning |
| **GMV inflation** | Flag transaction | Investigate + suspend if confirmed | Report | critical |
| **Bot signups** | CAPTCHA challenge | Block IP range, review accounts | — | warning |
| **Stolen card usage** | Razorpay auto-block | Force refund, freeze store | — | critical |
| **Counterfeit products** | Auto-flag product | Remove product, warn/suspend store | Content review | critical |

---

## 8. Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Feb 16, 2026 | Initial version — 7 sections covering e-commerce oversight scope, product moderation (AI pipeline with 3 stages, moderation queue UI, 8 policy categories), order monitoring (dashboard, 7 admin actions), payment processing (health dashboard, Razorpay integration flow), shipping monitoring, coupon oversight (6 monitoring points), fraud detection (4-layer system, alert dashboard, 6-action matrix) |

---

> **Next:** [Part 4 — App Store & Theme Marketplace Admin](./04_AppStore_ThemeMarketplace.md)

---

*[← Back to Index](./README.md)*
