# LetBuyy Platform — Plans & Pricing

> **Doc 13 of 17** | Plans & Pricing — Revenue Architecture, Subscription Tiers, Billing & Growth Strategy
>
> **Version:** 3.0 | **Date:** February 16, 2026
>
> **Prev:** [12 Implementation Roadmap](./12_Implementation_Roadmap.md) | **Next:** [14 Theme Implementation](./14_Theme_Implementation.md)
>
> **Cross-refs:**
> [03 Onboarding & Trial](./03_Onboarding_and_Trial.md) · [05 E-commerce](./05_Ecommerce_Engine.md) · [06 Portfolio & Resume](./06_Portfolio_and_Resume.md) · [07 AI Features](./07_AI_Features.md) · [08 Database Schema §15](./08_Database_Schema.md)

---

## 🎯 Executive Summary: The Profitable Model

### Core Changes from v2.0 → v3.0

| Change | v2.0 (Old) | v3.0 (Profitable) | Impact |
|---|---|---|---|
| **Free tier limits** | Too generous (25 products) | Restricted (5 products) | 3x more conversions |
| **Revenue model** | Subscription only | Hybrid (subscription + transaction + marketplace) | 5x revenue per user |
| **Resume split** | 80/20 (you get ₹20) | 70/30 (you get ₹30) | 50% more revenue |
| **AI costs** | Uncontrolled risk | Rate-limited + model tiers | 80% cost reduction |
| **Transaction fees** | Optional add-on | Built into pricing | 40% revenue increase |
| **Template marketplace** | Not included | Core revenue stream | ₹3-5L/month potential |
| **Services** | None | Premium tier | ₹2-8L/month potential |
| **Trial** | 14 days full access | 7 days limited | 2x trial conversions |

### Revenue Projections (Realistic)

| Timeframe | Monthly Revenue | Monthly Costs | Net Profit | Annual Projection |
|---|:---:|:---:|:---:|:---:|
| **Month 1** | ₹45,000 | ₹38,000 | ₹7,000 | — |
| **Month 3** | ₹1,25,000 | ₹45,000 | ₹80,000 | — |
| **Month 6** | ₹3,50,000 | ₹75,000 | ₹2,75,000 | — |
| **Month 12** | ₹8,50,000 | ₹1,50,000 | ₹7,00,000 | ₹84L profit |
| **Month 24** | ₹25,00,000 | ₹4,00,000 | ₹21,00,000 | ₹2.52 crore profit |

**Target: Profitable from Month 1 onwards**

---

## Table of Contents

**Part 1 — Revenue Architecture**
1. [Revenue Streams (7 Sources)](#1-revenue-streams-7-sources)
2. [Profit-First Pricing Philosophy](#2-profit-first-pricing-philosophy)
3. [Cost Control Strategy](#3-cost-control-strategy)

**Part 2 — Store Plans (Hybrid Model)**
4. [🛒 E-Commerce Store Plans](#4--e-commerce-store-plans)

**Part 3 — Portfolio Plans (Premium Focus)**
5. [🎨 Portfolio Plans](#5--portfolio-plans)

**Part 4 — Resume Plans (Optimized Split)**
6. [📄 Resume Plans](#6--resume-plans)

**Part 5 — Blog Plans (Content + Ads)**
7. [✍️ Blog Plans](#7--blog-plans)

**Part 6 — Landing Page Plans**
8. [🚀 Landing Page Plans](#8--landing-page-plans)

**Part 7 — High-Margin Revenue Streams**
9. [💎 Template Marketplace](#9--template-marketplace)
10. [🎨 Premium Services](#10--premium-services)
11. [🤖 AI Credit System (Profitable)](#11--ai-credit-system-profitable)

**Part 8 — Technical Implementation**
12. [Database Schema Updates](#12-database-schema-updates)
13. [API Endpoints](#13-api-endpoints)
14. [Billing Architecture & Payment Flows](#14-billing-architecture--payment-flows)
15. [Revenue Dashboard](#15-revenue-dashboard)

**Part 9 — Launch Strategy & Positioning**
16. [Plan Enforcement Middleware](#16-plan-enforcement-middleware)
17. [Plan Selection UI — Wireframes](#17-plan-selection-ui--wireframes)
18. [Month 1 Revenue Plan](#18-month-1-revenue-plan)
19. [Growth Playbook](#19-growth-playbook)
20. [Competitive Positioning](#20-competitive-positioning)
21. [FAQ](#21-faq)
22. [Final Summary: v2.0 → v3.0 Changes](#22-final-summary-v20--v30-changes)

---

# PART 1 — REVENUE ARCHITECTURE

---

## 1. Revenue Streams (7 Sources)

```
┌─────────────────────────────────────────────────────────────────┐
│  LETBUYY REVENUE ENGINE — 7 PROFIT CENTERS                       │
└─────────────────────────────────────────────────────────────────┘

1. SUBSCRIPTIONS (Base Revenue)
   ├─ Store: ₹749-8,199/month
   ├─ Portfolio: ₹349-2,999/month
   ├─ Blog: ₹599-5,999/month
   └─ Landing: ₹599-5,999/month
   Expected: ₹2-4L/month by Month 6

2. TRANSACTION FEES (Store Growth Revenue)
   ├─ Built into all Store plans
   ├─ 0.8-2% of GMV (Gross Merchandise Value)
   └─ Aligns with customer success
   Expected: ₹1-3L/month by Month 6

3. RESUME DOWNLOADS (Passive Revenue)
   ├─ ₹99 per download
   ├─ You get ₹30 (30%), owner gets ₹69 (70%)
   └─ Viral potential (10,000 resumes = ₹3L/month)
   Expected: ₹50,000-2L/month by Month 6

4. TEMPLATE MARKETPLACE (High Margin)
   ├─ Premium templates: ₹199-999
   ├─ You get 40% (designers get 60%)
   ├─ 100 templates × 50 sales/month = ₹8L gross
   └─ Your cut: ₹3.2L/month
   Expected: ₹1-5L/month by Month 6

5. AI CREDIT TOP-UPS (High Margin)
   ├─ Credits priced at 3x cost
   ├─ Micro ₹149 (10 credits) → cost ₹50 = ₹99 profit
   └─ 100 top-ups/month = ₹10,000 profit
   Expected: ₹20,000-80,000/month by Month 6

6. PREMIUM SERVICES (Highest Margin)
   ├─ Store setup: ₹15,000-35,000
   ├─ Custom theme: ₹35,000-75,000
   ├─ SEO package: ₹20,000/month
   ├─ Content writing: ₹5,000-15,000
   └─ Product photography: ₹10,000-25,000
   Expected: ₹1-8L/month (2-4 projects)

7. ADD-ONS & UPGRADES
   ├─ Extra storage: ₹199-999/month
   ├─ Priority support: ₹999/month
   ├─ White-label: ₹2,999/month
   ├─ Custom domain setup: ₹499 one-time
   └─ Advanced analytics: ₹799/month
   Expected: ₹30,000-1L/month by Month 6

═══════════════════════════════════════════════════════════════════
TOTAL PROJECTED REVENUE (Month 6):
₹2.5L + ₹1.5L + ₹1L + ₹3L + ₹40K + ₹3L + ₹50K = ₹11.4L/month

COSTS (Month 6): ₹75,000/month
NET PROFIT (Month 6): ₹10.65L/month (93% margin)
═══════════════════════════════════════════════════════════════════
```

### 1.1 Billing Model Summary (Per Site Type)

| Site Type | Billing Model | Unique Mechanic | Revenue Streams |
|---|---|---|---|
| **Store** | Monthly subscription + **% of GMV** | 0.8-2% transaction fee on all sales | Subscription + GMV% + Templates + AI |
| **Portfolio** | Monthly subscription (page-based) | Pricing scales with portfolio page count | Subscription + Templates + Services |
| **Resume** | **Completely free** + ₹99 per CV download | All editing free, visitors pay to download PDF | Downloads (30%) + Templates (40%) + Add-ons |
| **Blog** | Monthly subscription (flat) | Newsletter limits + paid newsletter revenue share | Subscription + Newsletter % + Templates |
| **Landing** | Monthly subscription (flat) | Form submission limits + A/B tests | Subscription + Templates + Services |

### 1.2 Payment Methods

| Provider | Availability | Methods |
|---|---|---|
| **Razorpay** | India (primary) | UPI, Cards, Net Banking, Wallets, EMI |
| **Stripe** | International | Cards, Apple Pay, Google Pay |

> Auto-detect: Razorpay for INR, Stripe for USD/EUR/GBP.

---

## 2. Profit-First Pricing Philosophy

### 2.1 The 3 Principles

```
PRINCIPLE 1: FREE IS A FEATURE, NOT A PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Free tier exists to:
  ✓ Let users test the product (7 days)
  ✓ Create viral loops (powered by badges)
  ✗ NOT to give away the full product

Action: Reduce free limits by 70%
Result: 40% of users upgrade within 7 days


PRINCIPLE 2: ALIGN PRICING WITH VALUE DELIVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Don't charge fixed fees for variable value:
  ✗ Store doing ₹10L/month pays same as ₹10K/month store
  ✓ Transaction % + base subscription = fair + scalable

Action: Hybrid pricing (base + % of GMV)
Result: Revenue scales with customer success


PRINCIPLE 3: MULTIPLE REVENUE STREAMS = STABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Single revenue stream = fragile business:
  ✗ Subscriptions only → churn kills you
  ✓ 7 revenue streams → one fails, others compensate

Action: Build marketplace + services immediately
Result: Revenue stability + higher lifetime value
```

### 2.2 Value Ladder (Customer Ascension Path)

```
┌────────────────────────────────────────────────────────────────┐
│  CUSTOMER VALUE LADDER (Ascension Path)                         │
└────────────────────────────────────────────────────────────────┘

Step 1: FREE TRIAL (7 days)
   └─> Captures email, shows value quickly
        │
        ▼
Step 2: STARTER PLAN (₹749/month)
   └─> Gets customer paying, builds habit
        │
        ▼
Step 3: BUSINESS PLAN (₹2,399/month)
   └─> Customer growing, needs more features
        │
        ▼
Step 4: TEMPLATE PURCHASE (₹299-999)
   └─> Upsell: Premium templates for better design
        │
        ▼
Step 5: AI CREDIT TOP-UPS (₹149-999)
   └─> Customer using AI heavily, needs more credits
        │
        ▼
Step 6: PREMIUM SERVICES (₹15,000-75,000)
   └─> Customer wants done-for-you work
        │
        ▼
Step 7: ENTERPRISE PLAN (₹8,199/month)
   └─> Full white-label, custom features
        │
        ▼
Step 8: AGENCY/RESELLER PROGRAM
   └─> Customer becomes partner, sells LetBuyy

Average Customer Lifetime Value (LTV):
- Starter only: ₹11,988/year
- With upsells: ₹45,000+/year (3.8x more)
```

### 2.3 Site-Type-Specific Billing Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    LETBUYY BILLING ENGINE                              │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  PLAN RESOLVER                                                    ││
│  │  Input: store.site_type + store.plan                             ││
│  │                                                                   ││
│  │  site_type === 'store'     → STORE_PLANS[plan]     (hybrid)      ││
│  │  site_type === 'portfolio' → PORTFOLIO_PLANS[plan] (page-based)  ││
│  │  site_type === 'resume'    → RESUME_CONFIG         (free+txn)    ││
│  │  site_type === 'blog'      → BLOG_PLANS[plan]      (flat+rev%)   ││
│  │  site_type === 'landing'   → LANDING_PLANS[plan]   (flat)        ││
│  └──────────────────────────────────────────────────────────────────┘│
│                               │                                       │
│                               ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  FEATURE GATE MIDDLEWARE                                          ││
│  │                                                                   ││
│  │  checkFeature(store, 'products.create')                          ││
│  │    → resolve plan limits for THIS site type                      ││
│  │    → enforce product count / storage / AI credits / etc.         ││
│  └──────────────────────────────────────────────────────────────────┘│
│                               │                                       │
│                               ▼                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Razorpay │  │ Stripe   │  │ Invoicing│  │ Webhooks │            │
│  │ (INR)    │  │ (USD)    │  │ (PDF)    │  │ (events) │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.4 Plan Config Type

```typescript
// packages/types/src/plans.ts

export type SiteType = 'store' | 'portfolio' | 'resume' | 'blog' | 'landing';
export type PlanTier = 'free' | 'starter' | 'growth' | 'business' | 'pro' | 'enterprise' | 'publisher' | 'agency';

export interface PlanConfig {
  id: string;                    // e.g. 'store_starter'
  site_type: SiteType;
  tier: PlanTier;
  name: string;                  // Display name
  price_inr_monthly: number;
  price_inr_annual: number;      // per month (discounted)
  price_usd_monthly: number;
  price_usd_annual: number;
  trial_days: number;            // 7 for all paid plans
  features: Record<string, number | boolean | string>;
  ai_credits_monthly: number;
  storage_mb: number;
  staff_accounts: number;
  custom_domain: boolean;
  branding_removable: boolean;
  transaction_fee_pct?: number;  // Store plans only (% of GMV)
  setup_fee_inr?: number;       // One-time (Enterprise only)
  support_level: 'community' | 'email_72h' | 'email_48h' | 'email_24h' | 'dedicated' | 'dedicated_phone';
}
```

---

## 3. Cost Control Strategy

### 3.1 Infrastructure Cost Optimization

```
┌────────────────────────────────────────────────────────────────┐
│  COST TIER SYSTEM (Scale with Revenue)                          │
└────────────────────────────────────────────────────────────────┘

TIER 1: BOOTSTRAP (0-50 paid users)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Supabase Free             ₹0
Cloudflare R2 (1GB)       ₹10
Vercel Hobby × 3          ₹0 (use hobby for 3 apps)
Vercel Pro × 4            ₹8,000 (₹2,000 each)
Workers Paid              ₹400
Resend Free (3K emails)   ₹0
AI API (Gemini Flash)     ₹2,000

Total: ₹10,410/month
Revenue (50 users × ₹999): ₹49,950/month
Profit: ₹39,540/month (79% margin)


TIER 2: GROWTH (51-200 paid users)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Supabase Pro              ₹2,000
Cloudflare R2 (10GB)      ₹80
Vercel Pro × 7            ₹14,000
Workers Paid              ₹400
Resend Pro (50K emails)   ₹1,600
AI API (Mixed models)     ₹12,000

Total: ₹30,080/month
Revenue (200 users × ₹999): ₹1,99,800/month
Profit: ₹1,69,720/month (85% margin)


TIER 3: SCALE (201-1000 paid users)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Supabase Pro + Add-ons    ₹8,000
Cloudflare R2 (100GB)     ₹800
Vercel Enterprise         ₹60,000
Workers Paid              ₹2,000
Resend Pro + Overages     ₹8,000
AI API (Optimized)        ₹40,000
Support Staff (1 person)  ₹30,000

Total: ₹1,48,800/month
Revenue (1000 users × ₹999): ₹9,99,000/month
Profit: ₹8,50,200/month (85% margin)
```

### 3.2 AI Cost Control (CRITICAL — 5-Layer Protection)

```
┌────────────────────────────────────────────────────────────────┐
│  AI COST PROTECTION SYSTEM                                      │
└────────────────────────────────────────────────────────────────┘

PROBLEM: AI costs can spiral out of control
SOLUTION: 5-Layer Protection System

Layer 1: MODEL SELECTION BY TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task                    Model           Cost/1M tokens
──────────────────────  ──────────────  ──────────────
SEO tags                Gemini Flash    $0.10
Image alt text          Gemini Flash    $0.10
Short descriptions      Gemini Flash    $0.10
Long descriptions       Claude Haiku    $0.80
Product rewrites        Claude Sonnet   $3.00
Resume rewrites         Claude Sonnet   $3.00
Resume full rewrite     Claude Opus     $15.00 (premium)

Layer 2: RATE LIMITING
━━━━━━━━━━━━━━━━━━━━━━━━━
Per user limits:
- 30 AI operations per hour (hard limit)
- 200 operations per day (all plans)
- Cooldown: 2 seconds between operations

Layer 3: CREDIT PRICING (3x Cost)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI Operation          Credits    Real Cost    You Charge
────────────────────  ─────────  ───────────  ──────────
SEO tags (Flash)      1          ₹0.50        ₹7.90
Description (Haiku)   1          ₹4.00        ₹7.90
Rewrite (Sonnet)      2          ₹12.00       ₹15.80
Full rewrite (Opus)   5          ₹60.00       ₹39.50

Profit margin: 50-90% on AI operations

Layer 4: ABUSE DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━
Trigger                           Action
────────────────────────────────  ─────────────────────
>300 operations in 24h            Flag account
>500 operations in 24h            Temporary suspension
Scripted/bot behavior detected    Permanent ban
Credit refund requests >3         Manual review

Layer 5: CACHE EVERYTHING
━━━━━━━━━━━━━━━━━━━━━━━━━
Cache AI responses for:
- SEO tags (same product) → 90 days
- Descriptions (same input) → 30 days
- Generic suggestions → Forever

Result: 60% of AI calls served from cache (₹0 cost)

═══════════════════════════════════════════════════════════════
PROJECTED AI COSTS:
Without protection: ₹3,00,000/month (1000 users)
With protection: ₹40,000/month (1000 users)
Savings: 87%
═══════════════════════════════════════════════════════════════
```

---

# PART 2 — STORE PLANS (HYBRID MODEL)

---

## 4. 🛒 E-Commerce Store Plans

### 4.1 Store Plan Comparison (Hybrid: Base + GMV%)

| | **Free Trial** | **Starter** | **Business** | **Enterprise** |
|---|:---:|:---:|:---:|:---:|
| **Duration** | 7 days | — | — | — |
| **Base (INR)** | ₹0 | ₹749/mo | ₹2,399/mo | ₹8,199/mo |
| **Base (USD)** | $0 | $9/mo | $29/mo | $99/mo |
| **Transaction %** | — | 2% of GMV | 1.2% of GMV | 0.8% of GMV |
| **Setup Fee** | ₹0 | ₹0 | ₹0 | ₹25,000 |
| **Annual Discount** | — | 20% off | 20% off | 20% off |
| **Annual (INR/mo)** | — | ₹599/mo | ₹1,919/mo | ₹6,559/mo |
| **Annual (USD/mo)** | — | $7/mo | $23/mo | $79/mo |

> **Hybrid Pricing Example:**
> - Store doing ₹2,00,000 GMV/month on Starter plan
> - You earn: ₹749 (base) + ₹4,000 (2% of ₹2L) = **₹4,749/month**
> - Store doing ₹10,00,000 GMV/month on Business plan
> - You earn: ₹2,399 (base) + ₹1,20,000 (1.2% of ₹10L) = **₹1,22,399/month**

### 4.2 Store Feature Matrix (Tightened Limits)

#### Core E-Commerce

| Feature | Free Trial | Starter | Business | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Products | **10** | 100 | 1,000 | Unlimited |
| Product variants | **2** | 10 | 50 | Unlimited |
| Product images | **3** | 5 | 15 | Unlimited |
| Categories | **2** | 10 | 50 | Unlimited |
| Collections | ❌ | 3 | 15 | Unlimited |
| Bulk import | ❌ | ✅ | ✅ | ✅ |
| Reviews | ❌ | ✅ | ✅ | ✅ |
| Wishlist | ❌ | ✅ | ✅ | ✅ |

#### Orders & Payments

| Feature | Free Trial | Starter | Business | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Orders/month | **20** | 250 | 2,500 | Unlimited |
| Payment gateways | Razorpay | Razorpay + Stripe | All | All + Custom |
| Transaction fee** | — | **2% of GMV** | **1.2% of GMV** | **0.8% of GMV** |
| Refunds | ❌ | Partial | Full | Full + Auto |
| Multi-currency | ❌ | ❌ | ✅ (5) | ✅ (135+) |
| Abandoned cart | ❌ | ❌ | ✅ | ✅ + AI |

** This is YOUR transaction fee on top of Razorpay/Stripe's fee. Example: On ₹1,000 sale, you earn ₹20 (Starter), ₹12 (Business), or ₹8 (Enterprise).

#### Inventory & Shipping

| Feature | Free Trial | Starter | Business | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Inventory tracking | Basic | ✅ | ✅ + Multi-location | ✅ + Advanced |
| Locations | 1 | 1 | 3 | Unlimited |
| Low-stock alerts | ❌ | Email only | Email + SMS | All + AI |
| AI forecast | ❌ | ❌ | ✅ | ✅ |
| Shipping zones | 1 | 3 | 10 | Unlimited |
| Real-time rates | ❌ | ❌ | ❌ | ✅ |

#### Marketing & Discounts

| Feature | Free Trial | Starter | Business | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Discount codes | **2** | 10 | Unlimited | Unlimited |
| Discount types | % off only | % + Fixed | All 5 types | All + custom |
| Coupon stacking | ❌ | ❌ | ✅ | ✅ |
| BOGO | ❌ | ❌ | ✅ | ✅ |
| Newsletter signup | ❌ | ✅ | ✅ | ✅ |
| Email campaigns | ❌ | ❌ | 5/mo | Unlimited |

#### Design & Branding

| Feature | Free Trial | Starter | Business | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Themes | 1 free | 5 free | All free | All + Custom |
| Custom domain | ❌ | ✅ | ✅ | ✅ |
| Custom CSS | ❌ | ❌ | ✅ | ✅ |
| Storage | **500 MB** | 5 GB | 25 GB | 100 GB |
| "Powered by" badge | **Always shown** | Removable ₹199/mo | Removable | White-label |

#### AI Credits (Controlled)

| Feature | Free Trial | Starter | Business | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Monthly credits | **10** | **50** | **200** | **1,000** |
| Product descriptions | ✅ (Flash) | ✅ (Flash) | ✅ (Sonnet) | ✅ (All models) |
| SEO tags | ✅ | ✅ | ✅ | ✅ |
| Smart pricing | ❌ | ❌ | ✅ | ✅ |
| Content audit | ❌ | ❌ | ❌ | ✅ |
| Top-up packs | ❌ | ✅ from ₹149 | ✅ from ₹149 | ✅ Bulk pricing |

#### Team & Support

| Feature | Free Trial | Starter | Business | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Staff accounts | 1 | 1 | 3 | Unlimited |
| Support | Email (72h) | Email (48h) | Priority (24h) | Dedicated + Phone |
| API access | ❌ | Read-only | Full REST | Full + Webhooks |
| Onboarding | Self-serve | Video guides | 1-on-1 call | Done-for-you |

### 4.3 Store Revenue Model Explained

```
OLD MODEL (v2.0):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Free: 25 products, 50 orders → Too generous, no urgency
Starter: ₹799 flat → No scaling, low revenue
Revenue per customer: ₹799/month fixed

NEW MODEL (v3.0 - Profitable):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Free Trial: 10 products, 20 orders, 7 days → Creates urgency
Starter: ₹749 + 2% GMV → Scales with customer success
Revenue per customer: ₹749 + (avg ₹1.5L GMV × 2%) = ₹3,749/month

Result: 5x revenue per store customer
```

---

# PART 3 — PORTFOLIO PLANS (VALUE FOCUS)

---

## 5. 🎨 Portfolio Plans

### 5.1 Portfolio Plan Comparison (Page-Based)

| | **Free Trial** | **Starter** | **Pro** | **Agency** |
|---|:---:|:---:|:---:|:---:|
| **Duration** | 7 days | — | — | — |
| **Portfolio pages** | 1 (trial only) | 1 page | 5 pages | Unlimited |
| **Monthly (INR)** | ₹0 | ₹349 | ₹999 | ₹2,999 |
| **Annual (INR)** | ₹0 | ₹2,799 (₹233/mo) | ₹7,999 (₹666/mo) | ₹23,999 (₹1,999/mo) |
| **Monthly (USD)** | $0 | $4 | $12 | $36 |
| **Annual (USD)** | $0 | $34 | $96 | $288 |

> **Page = a distinct portfolio page** (e.g., "Photography", "Web Design", "Branding"). Each page contains projects, galleries, case studies within that category. A single-discipline creative only needs 1 page (Starter). Multi-discipline creatives grow into Pro/Agency.

### 5.2 Portfolio Feature Matrix

#### Projects & Gallery

| Feature | Free Trial | Starter | Pro | Agency |
|---|:---:|:---:|:---:|:---:|
| Portfolio pages | 1 | 1 | 5 | Unlimited |
| Projects per page | **3** | 10 | 50 | Unlimited |
| Images per project | **3** | 10 | 30 | Unlimited |
| Gallery layouts | Grid only | Grid + Masonry | All 4 | All + Custom |
| Case studies | ❌ | 1 | 10 | Unlimited |
| Video embeds | ❌ | ✅ | ✅ | ✅ |

#### Professional Features

| Feature | Free Trial | Starter | Pro | Agency |
|---|:---:|:---:|:---:|:---:|
| Skills showcase | **5** | 15 | Unlimited | Unlimited |
| Testimonials | **1** | 5 | 20 | Unlimited |
| Client logos | ❌ | 3 | 15 | Unlimited |
| Contact form | Basic | ✅ | ✅ + Upload | ✅ + CRM |
| Booking calendar | ❌ | ❌ | ✅ | ✅ + Payments |

#### Design & AI

| Feature | Free Trial | Starter | Pro | Agency |
|---|:---:|:---:|:---:|:---:|
| Themes | 1 | 3 free | All free | All + Custom |
| Custom domain | ❌ | ✅ | ✅ | ✅ |
| Storage | **50 MB** | 500 MB | 3 GB | 15 GB |
| AI descriptions | **5** | **15** | **50** | **200** |
| "Powered by" badge | Always shown | Removable ₹99/mo | Removable | White-label |
| Priority templates | ❌ | ❌ | ✅ 3 premium | ✅ All premium |
| Support | Community | Email (48h) | Priority (24h) | Dedicated |
| Analytics | Page views | + Referrers | + Visitor flow | Full |

### 5.3 Portfolio Monetization Strategy

```
STRATEGY 1: TEMPLATE UPSELLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Free templates: Basic layouts (included)
- Premium templates: ₹299-999 one-time
- Target: 30% of Starter users buy 1 template
- Revenue: 100 Starter × 30% × ₹499 avg = ₹14,970/month

STRATEGY 2: BOOKING INTEGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Pro/Agency plans include booking calendar
- Charge ₹99/month for booking payments integration
- Target: 40% of Pro users add payments
- Revenue: 50 Pro × 40% × ₹99 = ₹1,980/month

STRATEGY 3: DONE-FOR-YOU SERVICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Portfolio in a Day" service:
- ₹4,999: We build your portfolio (4 hours)
- ₹9,999: We build + professional copywriting
- ₹19,999: Full brand + portfolio + photoshoot
- Target: 5 customers/month
- Revenue: 5 × ₹9,999 avg = ₹49,995/month
```

---

# PART 4 — RESUME PLANS (OPTIMIZED SPLIT)

---

## 6. 📄 Resume — Free to Build, Pay-Per-Download

> **🚀 Unique model:** Resume sites have **NO subscription tiers**. Everything — editing, building, customizing, AI features — is **completely free**. The only revenue comes from a **fixed ₹99 charge per CV download** paid by the visitor, with an optimized **70/30 split** (owner/platform). Premium templates are sold separately in the template marketplace.

### 6.1 Resume Pricing (Optimized for Profit)

| Item | Price | Who Pays | Your Cut | Notes |
|---|:---:|---|:---:|---|
| **Create & edit resume** | ₹0 | Owner | — | Free forever, all features |
| **Host on subdomain** | ₹0 | Owner | — | Includes public URL |
| **AI features (15 credits/mo)** | ₹0 | Owner | — | Increased from 10 to 15 |
| **Visitor downloads PDF** | **₹99** | Visitor | **₹30 (30%)** | Owner gets ₹69 (70%) |
| **Premium template** | ₹199-999 | Owner | **₹80-400 (40%)** | Designer gets 60% |
| **Custom domain** | ₹199/year | Owner | **₹199** | 100% platform revenue |
| **Remove branding** | ₹349 one-time | Owner | **₹349** | 100% platform revenue |
| **Professional review** | ₹999 one-time | Owner | **₹999** | Expert feedback service |

> **No monthly plans.** No Pro/Premium/Enterprise tiers. Resume owners pay ₹0 to build. Revenue is purely transactional.

### 6.2 Per-Download Revenue Model (Improved)

```
DOWNLOAD REVENUE MODEL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
₹99 per download:
├─ Owner gets ₹69 (70%)
├─ Platform gets ₹30 (30%)
└─ Razorpay fee ₹5 (comes from platform cut)
   Result: You get ₹25 net per download

VISITOR FLOW:
  1. Visitor lands on resume.letbuyy.store
  2. Views the public resume page (free, always)
  3. Clicks "Download CV as PDF"
  4. Payment gate: ₹99 per download (Razorpay/Stripe)
  5. On successful payment → PDF generated + delivered
  6. Revenue split applied automatically

PROJECTIONS AT SCALE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10,000 resumes × 5 downloads/month avg:
= 50,000 downloads × ₹25 net = ₹12,50,000/month

Additional revenue streams:
+ Custom domains: 1,000 × ₹199/yr ÷ 12 = ₹16,583/month
+ Premium templates: 2,000 × ₹499 × 40% = ₹3,99,200/month
+ Professional reviews: 100 × ₹999 = ₹99,900/month
+ Remove branding: 500 × ₹349 = ₹1,74,500/month (one-time)

TOTAL RESUME REVENUE (at scale):
= ₹12,50,000 + ₹16,583 + ₹3,99,200 + ₹99,900 = ₹16.66L/month
```

### 6.3 Everything-Free Feature List

> Every feature below is available to **all resume users at ₹0**. No gates, no paywalls.

#### CV Builder (All Free)

| Feature | Included |
|---|:---:|
| Resume versions | 3 |
| Free templates | 5 |
| PDF export (no watermark) | ✅ |
| DOCX export | ✅ |
| Rich text editor | ✅ |
| Drag-and-drop sections | ✅ |
| Photo/avatar upload | ✅ |
| QR code (link to resume) | ✅ |
| Public URL (subdomain.letbuyy.store) | ✅ |
| Password protection | ✅ |
| Download analytics (count + source) | ✅ |

#### Content Sections (All Free)

| Feature | Included |
|---|:---:|
| Work experience entries | Unlimited |
| Education entries | Unlimited |
| Skills | Unlimited |
| Certifications | Unlimited |
| Languages | Unlimited |
| References | Unlimited |
| Custom sections | 3 |
| LinkedIn import | ✅ |
| Social links | Unlimited |

#### AI Features (15 credits/mo, free)

| Feature | Credits | Included |
|---|:---:|:---:|
| AI bullet improvement | 1/use | ✅ |
| AI resume summary | 1/use | ✅ |
| ATS score analysis | 2/use | ✅ |
| AI full rewrite | 5/use | ✅ |
| Keyword optimization | 1/use | ✅ |
| Job-match scoring | 2/use | ✅ |
| Skill suggestions | Free | ✅ |

> Need more AI credits? Purchase top-up packs (₹149 for 10 credits, ₹1,199 for 100 credits).

### 6.4 Resume Viral Growth Features

```
┌────────────────────────────────────────────────────────────────┐
│  VIRAL LOOPS FOR RESUME GROWTH                                  │
└────────────────────────────────────────────────────────────────┘

LOOP 1: Download Badge
━━━━━━━━━━━━━━━━━━━━━━
Every downloaded PDF includes:
"📄 This resume was created using LetBuyy.store"
+ QR code linking to landing page
Result: 5% of downloaders create their own resume

LOOP 2: Sharing Incentive
━━━━━━━━━━━━━━━━━━━━━━━━
Resume owners get:
- First 3 downloads: FREE (you pay ₹0, they pay ₹99)
- After 3: Owner earns ₹69 per download
- Incentive: Share resume link everywhere to earn money
Result: Owners actively promote their resume

LOOP 3: Job Seeker Network Effect
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When recruiter downloads one resume:
"View 10 similar profiles in [Industry]" →
Shows other resumes (with download buttons)
Result: One recruiter downloads multiple resumes

LOOP 4: Template Marketplace Discovery
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Free users see: "Used by 5,234 professionals"
Premium template preview on every download
Result: 15% of resume creators buy premium template
```

### 6.5 Resume Add-Ons (Revenue Projections)

| Add-On | Price | Your Cut | Conversion | Monthly Revenue (1000 users) |
|---|:---:|:---:|:---:|:---:|
| Custom domain | ₹199/year | 100% | 10% | ₹1,658/month |
| Remove branding | ₹349 one-time | 100% | 5% | ₹1,454/month |
| Premium template | ₹499 avg | 40% | 20% | ₹3,992/month |
| Professional review | ₹999 one-time | 100% | 2% | ₹1,665/month |
| Extra AI credits (25) | ₹199 | 75% | 15% | ₹2,238/month |
| LinkedIn optimization | ₹799 one-time | 100% | 3% | ₹1,998/month |
| **TOTAL** | — | — | — | **₹13,005/month** |

---

# PART 5 — BLOG PLANS (CONTENT + ADS)

---

## 7. ✍️ Blog Plans

### 7.1 Blog Plan Comparison

| | **Free Trial** | **Starter** | **Business** | **Publisher** |
|---|:---:|:---:|:---:|:---:|
| **Duration** | 7 days | — | — | — |
| **Monthly (INR)** | ₹0 | ₹599 | ₹1,799 | ₹5,999 |
| **Annual (INR)** | ₹0 | ₹4,799 (₹399/mo) | ₹14,399 (₹1,199/mo) | ₹47,999 (₹3,999/mo) |
| **Monthly (USD)** | $0 | $7 | $22 | $72 |
| **Annual (USD)** | $0 | $58 | $173 | $576 |

### 7.2 Blog Feature Matrix

#### Content Management

| Feature | Free Trial | Starter | Business | Publisher |
|---|:---:|:---:|:---:|:---:|
| Published posts | **5** | 50 | 500 | Unlimited |
| Draft posts | **3** | 25 | 100 | Unlimited |
| Categories | **2** | 10 | 50 | Unlimited |
| Tags | **5** | 50 | 500 | Unlimited |
| Scheduled posts | ❌ | ✅ | ✅ | ✅ |
| Content versioning | ❌ | ❌ | ✅ (10 versions) | ✅ (unlimited) |
| Multi-author | ❌ | ❌ | 3 | Unlimited |

#### Comments & Engagement

| Feature | Free Trial | Starter | Business | Publisher |
|---|:---:|:---:|:---:|:---:|
| Comments | ❌ | ✅ (manual mod) | ✅ (AI mod) | ✅ (full pipeline) |
| Threaded comments | ❌ | ❌ | ✅ (depth 3) | ✅ (depth 5) |
| Spam filtering | ❌ | Basic | AI | AI + custom rules |
| Reading time auto-calc | ✅ | ✅ | ✅ | ✅ |
| Table of contents auto | ❌ | ✅ | ✅ | ✅ |

#### Newsletter & Monetization

| Feature | Free Trial | Starter | Business | Publisher |
|---|:---:|:---:|:---:|:---:|
| Newsletter | ❌ | ✅ (500 subs) | ✅ (5K subs) | ✅ (50K subs) |
| Email campaigns/mo | ❌ | 4 | 20 | Unlimited |
| **Ad placements** | ❌ | ❌ | **✅ Keep 100%** | **✅ Keep 100%** |
| **Paid newsletter** | ❌ | ❌ | **✅ 5% fee** | **✅ 3% fee** |
| Member-only content | ❌ | ❌ | ✅ | ✅ |

> **New Revenue Share Model**: Blog owners can monetize via ads or paid subscriptions. LetBuyy takes a small % only when they earn.

#### Media, AI & SEO

| Feature | Free Trial | Starter | Business | Publisher |
|---|:---:|:---:|:---:|:---:|
| Storage | **50 MB** | 1 GB | 5 GB | 25 GB |
| AI blog drafts | **3** | **15** | **60** | **300** |
| AI SEO | **5** | **20** | **80** | **400** |
| AI headlines | ❌ | 10/mo | 50/mo | Unlimited |
| Custom domain | ❌ | ✅ | ✅ | ✅ |
| Advanced SEO | ❌ | ❌ | ✅ | ✅ |
| Blog themes | 1 | 3 free | All + premium | Custom |
| "Powered by" badge | Always shown | Removable ₹99/mo | Removable | White-label |
| Support | Email (72h) | Email (48h) | Priority (24h) | Dedicated |

### 7.3 Blog Monetization Opportunity

```
NEW: REVENUE SHARE MODEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPTION 1: Ad Revenue (Business/Publisher plans)
─────────────────────────────────────────────────
Blogger enables ads on their blog:
- Uses Google AdSense or other ad networks
- Keeps 100% of ad revenue (we don't take cut)
- LetBuyy earns from subscription only
Why? Happy bloggers = long-term customers

OPTION 2: Paid Newsletter (Business/Publisher)
─────────────────────────────────────────────────
Blogger charges ₹99-499/month for premium content:
- Subscriber pays ₹199/month
- LetBuyy takes 5% (Business) or 3% (Publisher)
- You earn: ₹10-15 per subscriber
- Blogger earns: ₹184-189

Example: Blogger with 1,000 paid subs at ₹199/month
- Blogger earns: ₹1,89,000/month (95%)
- LetBuyy earns: ₹9,950/month (5%)
- + Subscription: ₹1,799/month
- Total from this blogger: ₹11,749/month

Scale: 100 bloggers with 200 paid subs each:
= 20,000 subs × ₹199 × 5% = ₹1,99,000/month
+ Subscriptions: 100 × ₹1,799 = ₹1,79,900/month
= ₹3,78,900/month from blog monetization
```

---

# PART 6 — LANDING PAGE PLANS

---

## 8. 🚀 Landing Page Plans

### 8.1 Landing Plan Comparison

| | **Free Trial** | **Starter** | **Business** | **Agency** |
|---|:---:|:---:|:---:|:---:|
| **Duration** | 7 days | — | — | — |
| **Monthly (INR)** | ₹0 | ₹599 | ₹1,799 | ₹5,999 |
| **Annual (INR)** | ₹0 | ₹4,799 (₹399/mo) | ₹14,399 (₹1,199/mo) | ₹47,999 (₹3,999/mo) |
| **Monthly (USD)** | $0 | $7 | $22 | $72 |
| **Annual (USD)** | $0 | $58 | $173 | $576 |

### 8.2 Landing Feature Matrix

#### Page Builder

| Feature | Free Trial | Starter | Business | Agency |
|---|:---:|:---:|:---:|:---:|
| Pages | **1** | 3 | 15 | Unlimited |
| Sections per page | **5** | 15 | 40 | Unlimited |
| AI sections | **2** | **10** | **40** | **200** |
| A/B testing | ❌ | ❌ | 2 tests | Unlimited |
| Custom domain | ❌ | ✅ | ✅ | ✅ |
| Hero variants | 1 | 3 | All | All + custom |
| Pricing table block | ❌ | ✅ | ✅ | ✅ |
| Testimonial carousel | ❌ | ✅ | ✅ | ✅ |

#### Forms & Lead Capture

| Feature | Free Trial | Starter | Business | Agency |
|---|:---:|:---:|:---:|:---:|
| Forms | 1 | 3 | 10 | Unlimited |
| Submissions/mo | **20** | 200 | 2,000 | 20,000 |
| File uploads | ❌ | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ❌ | ✅ | ✅ |
| Zapier | ❌ | ❌ | ❌ | ✅ |
| Lead export (CSV) | ❌ | ✅ | ✅ | ✅ |

#### Analytics & Conversion

| Feature | Free Trial | Starter | Business | Agency |
|---|:---:|:---:|:---:|:---:|
| Page views | ✅ | ✅ | ✅ | ✅ |
| Conversion tracking | ❌ | Basic | ✅ | ✅ + Funnels |
| Heatmaps | ❌ | ❌ | ❌ | ✅ |
| UTM tracking | ❌ | ✅ | ✅ | ✅ |
| Custom events | ❌ | ❌ | ✅ | ✅ |

#### Design & AI

| Feature | Free Trial | Starter | Business | Agency |
|---|:---:|:---:|:---:|:---:|
| Landing themes | 1 | 3 free | All + premium | Custom |
| Custom CSS | ❌ | ✅ | ✅ | ✅ |
| Custom fonts | ❌ | ❌ | ✅ | ✅ |
| AI landing copy | **3** | 15 | 50 | 200 |
| AI headline generator | **5** | 25 | 100 | Unlimited |
| Storage | **50 MB** | 500 MB | 3 GB | 15 GB |
| "Powered by" badge | Always shown | Removable ₹99/mo | Removable | White-label |
| Support | Email (72h) | Email (48h) | Priority (24h) | Dedicated |

---

# PART 7 — HIGH-MARGIN REVENUE STREAMS

---

## 9. 💎 Template Marketplace

### 9.1 Marketplace Business Model

```
┌────────────────────────────────────────────────────────────────┐
│  TEMPLATE MARKETPLACE — HIGHEST MARGIN REVENUE                  │
└────────────────────────────────────────────────────────────────┘

MARKETPLACE OVERVIEW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Templates for all 5 site types:
✓ Store themes (₹299-999)
✓ Portfolio templates (₹199-699)
✓ Resume templates (₹199-999) ← Highest demand
✓ Blog themes (₹249-599)
✓ Landing page templates (₹199-499)

REVENUE SPLIT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You (Platform): 40%
Designer: 60%

Why 40/60 (not 30/70)?
- More sustainable for platform
- Still attractive for designers (vs Envato's 50/50)
- Covers payment fees, hosting, support

PAYMENT PROCESSING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Template costs ₹499:
├─ Buyer pays: ₹499
├─ Razorpay fee: ₹12 (2.4%)
├─ Platform (you): ₹195 (40%)
└─ Designer: ₹292 (60%)

Designer gets paid: Monthly (net 30 days)
Minimum payout: ₹500
```

### 9.2 Marketplace Launch Strategy

```
PHASE 1: SEED TEMPLATES (Month 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Goal: Launch with 30 high-quality templates

Action Plan:
1. Create 10 in-house templates (all site types)
   - Cost: ₹50,000 (₹5K per template to designer)
   - Revenue: Yours 100% (no split)

2. Recruit 10 designers with guaranteed deal
   - Offer: ₹10,000 upfront + 70% revenue share
   - Cost: ₹1,00,000 total
   - Result: 20 more templates

3. Open to public submissions
   - Free to submit (we review/approve)
   - 60/40 split

Month 1 Investment: ₹1,50,000
Month 1 Revenue: ₹30,000 (estimated)
Breakeven: Month 3


PHASE 2: GROWTH (Month 2-6)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Goal: 100+ templates, ₹3L+ monthly revenue

Action Plan:
1. Featured designer program
   - Top 5 designers get featured placement
   - 65/35 split (better for top performers)

2. Template bundles
   - "All Resume Templates": ₹1,999 (save 40%)
   - Platform keeps 50% on bundles

3. Exclusive templates
   - Partner with known designers
   - Exclusive to LetBuyy for 6 months
   - 60/40 split + upfront payment


PHASE 3: SCALE (Month 7-12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Goal: 300+ templates, ₹8L+ monthly revenue

Action Plan:
1. Template customization service
   - Buyer pays ₹999 to customize template
   - Designer does work, keeps 70%
   - Platform earns ₹300 per customization

2. Template subscriptions
   - "Template Pass": ₹499/month
   - Unlimited downloads from free tier templates

3. Agency licensing
   - Agencies pay ₹2,999/month
   - Can use templates for unlimited client projects
   - Pure margin (100% to you)
```

### 9.3 Marketplace Revenue Projection

| Month | Templates | Sales/Template | Avg Price | Platform Cut | Monthly Revenue |
|---|:---:|:---:|:---:|:---:|:---:|
| 1 | 30 | 5 | ₹399 | 40% | ₹23,940 |
| 3 | 60 | 15 | ₹449 | 40% | ₹1,61,640 |
| 6 | 100 | 20 | ₹499 | 40% | ₹3,99,200 |
| 12 | 300 | 30 | ₹499 | 40% | ₹17,97,000 |

**Year 1 Total**: ₹50L+ from marketplace alone

---

## 10. 🎨 Premium Services

### 10.1 Service Offerings

```
┌────────────────────────────────────────────────────────────────┐
│  PREMIUM SERVICES — HIGHEST MARGIN, FASTEST REVENUE             │
└────────────────────────────────────────────────────────────────┘

WHY SERVICES?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 90%+ profit margins (your time/team)
✓ No infrastructure costs
✓ Immediate revenue (paid upfront)
✓ Upsell to existing customers
✓ Builds brand authority
```

#### Store Services

| Service | Price | Time | Margin | Details |
|---|:---:|:---:|:---:|---|
| **Store Setup** | ₹15,000 | 4h | 85% | Full store setup, 10 products added, theme customized |
| **Product Upload** | ₹5,000 | 2h | 90% | 50 products uploaded with descriptions + images |
| **Custom Theme** | ₹35,000 | 12h | 80% | Bespoke theme design + development |
| **SEO Package** | ₹20,000/mo | 5h/mo | 85% | On-page SEO, content, backlinks |
| **Photography** | ₹10,000 | 4h | 75% | 50 product photos (studio/on-location) |
| **Migration** | ₹25,000 | 8h | 80% | Migrate from Shopify/WooCommerce |

#### Portfolio Services

| Service | Price | Time | Margin | Details |
|---|:---:|:---:|:---:|---|
| **Portfolio in a Day** | ₹4,999 | 3h | 85% | Complete portfolio setup |
| **Professional Copywriting** | ₹7,999 | 4h | 90% | About, project descriptions, case studies |
| **Brand Package** | ₹19,999 | 10h | 75% | Logo, colors, fonts, brand guidelines |
| **Portfolio + Brand** | ₹24,999 | 12h | 78% | Complete brand + portfolio |

#### Resume Services

| Service | Price | Time | Margin | Details |
|---|:---:|:---:|:---:|---|
| **Professional Review** | ₹999 | 30m | 95% | Expert feedback on resume |
| **Resume Rewrite** | ₹2,999 | 2h | 85% | Complete professional rewrite |
| **LinkedIn Optimization** | ₹1,999 | 1h | 90% | LinkedIn profile optimization |
| **Interview Coaching** | ₹4,999 | 2h | 85% | 1-on-1 interview preparation |
| **Career Bundle** | ₹8,999 | 5h | 85% | Resume + LinkedIn + Interview coaching |

#### Content Services

| Service | Price | Time | Margin | Details |
|---|:---:|:---:|:---:|---|
| **Blog Post Writing** | ₹2,999 | 2h | 85% | 1,500-word SEO-optimized post |
| **Content Strategy** | ₹9,999 | 4h | 85% | 3-month content plan |
| **Landing Page Copy** | ₹5,999 | 3h | 90% | Complete landing page copywriting |
| **Email Sequence** | ₹7,999 | 4h | 85% | 5-email welcome/sales sequence |

### 10.2 Service Revenue Projection

```
CONSERVATIVE PROJECTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Month 1-2 (Building Portfolio):
- 2 Store Setups × ₹15,000 = ₹30,000
- 3 Portfolio in a Day × ₹4,999 = ₹14,997
- 5 Professional Reviews × ₹999 = ₹4,995
Total: ₹49,992/month

Month 3-6 (Word of Mouth):
- 5 Store Setups × ₹15,000 = ₹75,000
- 1 Custom Theme × ₹35,000 = ₹35,000
- 3 SEO Packages × ₹20,000 = ₹60,000
- 8 Portfolio Services × ₹6,499 avg = ₹51,992
- 10 Resume Services × ₹1,999 avg = ₹19,990
Total: ₹2,41,982/month

Month 7-12 (Established):
- 10 Store projects × ₹18,000 avg = ₹1,80,000
- 3 SEO retainers × ₹20,000 = ₹60,000
- 15 Portfolio/Resume services × ₹5,000 avg = ₹75,000
- 2 Brand packages × ₹22,000 avg = ₹44,000
- 20 Content services × ₹4,000 avg = ₹80,000
Total: ₹4,39,000/month

YEAR 1 SERVICES REVENUE: ₹30L+
PROFIT MARGIN: 85%
NET PROFIT: ₹25.5L
```

### 10.3 Service Delivery Model

```
TEAM STRUCTURE (Lean):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Month 1-3: You + Freelancers
- You: Project management + sales
- Freelancers: Execution (pay per project)
- Cost: 15% of project value
- Margin: 85%

Month 4-8: You + 1 Full-Time
- Hire: Operations Manager (₹40K/month)
- Freelancers for overflow
- Cost: ₹40K fixed + 10% variable
- Margin: 75-80%

Month 9-12: Small Team
- You: CEO + sales
- Operations Manager: ₹40K
- Designer: ₹35K
- Developer: ₹45K
- Content Writer: ₹30K (part-time)
- Freelancers for peak
- Cost: ₹1,50,000 fixed + variable
- Margin: 65-70% (still very high)

SALES FUNNEL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Free consultation (15 min)
2. Proposal + quote (same day)
3. 50% upfront payment
4. Project execution (1-2 weeks)
5. Final 50% + delivery
6. Upsell retainer/maintenance

Conversion Rate: 40% (free consult → paid project)
Close Rate: 60% (proposal → deal)
```

---

## 11. 🤖 AI Credit System (Profitable)

### 11.1 AI Credit Pricing Strategy

```
PRINCIPLE: CHARGE 3X YOUR COST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Example: Product description with Claude Sonnet
- Input: 100 tokens, Output: 300 tokens = 400 total
- Cost: 400 × $3 per 1M = $0.0012 = ₹0.10
- You charge: 1 credit = ₹7.90
- Profit: ₹7.80 per operation (7800% margin)

Why users accept this:
✓ They don't think in API costs
✓ Credits = simple, predictable pricing
✓ Saves massive time (worth the markup)
✓ Alternative (hire writer) costs ₹500-2000
```

### 11.2 Monthly Credit Allocation (Profitable Limits)

| Site Type | Free Trial | Paid Starter | Paid Business | Paid Pro/Enterprise |
|---|:---:|:---:|:---:|:---:|
| **Store** | 10 | 30 | 100 | 500 |
| **Portfolio** | 5 | 15 | 50 | 200 |
| **Resume** | 15 | — | — | — |
| **Blog** | 5 | 20 | 60 | 300 |
| **Landing** | 5 | 15 | 40 | 200 |

**Rollover**: Max 25% of monthly allocation (reduced from 50% in v2.0)

### 11.3 AI Operations Per Credit (by site type)

| Operation | Credits | Models | Site Types |
|---|:---:|---|---|
| Product description (short) | 1 | Gemini Flash | Store |
| Product description (detailed) | 2 | Claude Sonnet | Store |
| SEO meta tags | 1 | Gemini Flash | All |
| Smart pricing | 1 | Gemini Pro | Store |
| Resume bullet improvement | 1 | Claude Sonnet | Resume |
| Resume full rewrite | 5 | Claude Opus | Resume |
| ATS score analysis | 2 | Gemini Pro | Resume |
| Portfolio description | 1 | Claude Sonnet | Portfolio |
| Skill suggestions | Free | Gemini Flash | Portfolio, Resume |
| Landing page copy | 2 | Claude Sonnet | Landing |
| Blog draft | 3 | Claude Sonnet | Blog |
| Blog SEO | 1 | Gemini Flash | Blog |
| Headline generation | 1 | Claude Sonnet | Landing, Blog |
| Page section gen | 2 | Claude Sonnet | All |
| Image alt text | Free | Gemini Flash | All |
| Content moderation | Free | Gemini Flash | All |

### 11.4 Credit Top-Up Packs (Repriced for Profit)

| Pack | Credits | INR | USD | Per-Credit Cost | Your Margin |
|---|:---:|:---:|:---:|:---:|:---:|
| Micro | 10 | ₹149 | $2 | ₹14.90 | 70% |
| Small | 25 | ₹349 | $4 | ₹13.96 | 72% |
| Medium | 100 | ₹1,199 | $14 | ₹11.99 | 75% |
| Large | 500 | ₹4,999 | $60 | ₹10.00 | 78% |
| Jumbo | 1,000 | ₹8,999 | $108 | ₹9.00 | 80% |

> Increased prices by 50-100% vs v2.0 for sustainability. Top-up credits never expire.

### 11.5 AI Operation Cost vs Revenue Analysis

| Operation | Credits | Model | Real Cost | You Charge | Margin |
|---|:---:|---|:---:|:---:|:---:|
| SEO tags | 1 | Gemini Flash | ₹0.50 | ₹7.90 | 94% |
| Product desc (short) | 1 | Gemini Flash | ₹0.80 | ₹7.90 | 90% |
| Product desc (long) | 2 | Claude Haiku | ₹4.00 | ₹15.80 | 75% |
| Resume bullet | 1 | Claude Sonnet | ₹6.00 | ₹7.90 | 24% |
| Blog draft | 3 | Claude Sonnet | ₹18.00 | ₹23.70 | 24% |
| Full rewrite | 5 | Claude Opus | ₹60.00 | ₹39.50 | -34%* |

*Loss leader: Full rewrite is subsidized to create wow factor, but heavily rate-limited (max 5/month even on highest plan)

---

# PART 8 — TECHNICAL IMPLEMENTATION

---

## 12. Database Schema Updates

### 12.1 Existing Tables (Updated)

```sql
-- plans table (add transaction_fee_pct)
ALTER TABLE plans ADD COLUMN transaction_fee_pct DECIMAL(4,2) DEFAULT 0;
ALTER TABLE plans ADD COLUMN setup_fee_inr INTEGER DEFAULT 0;

-- subscriptions table (add GMV tracking)
ALTER TABLE subscriptions ADD COLUMN gmv_this_month BIGINT DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN transaction_fee_charged BIGINT DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN gmv_invoice_id TEXT;

-- resume_downloads table (update split amounts)
-- Split now: owner 70% (₹69), platform 30% (₹30)
-- No schema changes needed, just update split logic
```

### 12.2 New Tables

```sql
-- Template Marketplace
CREATE TABLE marketplace_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id     UUID NOT NULL REFERENCES auth.users(id),
  site_type       TEXT NOT NULL CHECK (site_type IN ('store', 'portfolio', 'resume', 'blog', 'landing')),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  preview_images  JSONB NOT NULL DEFAULT '[]',
  demo_url        TEXT,
  price_inr       INTEGER NOT NULL,        -- in paisa
  price_usd       INTEGER NOT NULL,        -- in cents
  category        TEXT NOT NULL,
  tags            TEXT[] DEFAULT '{}',
  is_exclusive    BOOLEAN DEFAULT false,
  is_featured     BOOLEAN DEFAULT false,
  revenue_split   JSONB NOT NULL DEFAULT '{"designer": 60, "platform": 40}',
  download_count  INTEGER DEFAULT 0,
  rating_avg      DECIMAL(3,2) DEFAULT 0,
  rating_count    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE template_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES marketplace_templates(id),
  buyer_id        UUID NOT NULL REFERENCES auth.users(id),
  store_id        UUID REFERENCES stores(id),          -- which store applied to
  price_paid_inr  INTEGER NOT NULL,
  payment_id      TEXT NOT NULL,                        -- Razorpay/Stripe ref
  designer_payout INTEGER NOT NULL,                     -- paisa
  platform_cut    INTEGER NOT NULL,                     -- paisa
  payout_status   TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  payout_date     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Premium Services
CREATE TABLE service_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES auth.users(id),
  store_id        UUID REFERENCES stores(id),
  service_type    TEXT NOT NULL,             -- 'store_setup', 'custom_theme', etc.
  service_name    TEXT NOT NULL,
  price_inr       INTEGER NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN
    ('pending', 'confirmed', 'in_progress', 'review', 'completed', 'cancelled', 'refunded')),
  assigned_to     UUID REFERENCES auth.users(id),    -- staff/freelancer
  notes           TEXT,
  deliverables    JSONB DEFAULT '[]',
  paid_amount     INTEGER DEFAULT 0,
  payment_ids     TEXT[] DEFAULT '{}',
  due_date        TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE service_payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES service_orders(id),
  payee_id        UUID NOT NULL REFERENCES auth.users(id),
  amount          INTEGER NOT NULL,
  method          TEXT DEFAULT 'bank_transfer',
  status          TEXT DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Revenue Tracking (All Sources)
CREATE TABLE revenue_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL CHECK (source IN
    ('subscription', 'transaction_fee', 'resume_download', 'template_purchase',
     'ai_topup', 'service_order', 'addon')),
  store_id        UUID REFERENCES stores(id),
  user_id         UUID REFERENCES auth.users(id),
  amount_gross    INTEGER NOT NULL,          -- total charged (paisa)
  amount_net      INTEGER NOT NULL,          -- after payment processor fees (paisa)
  platform_cut    INTEGER NOT NULL,          -- LetBuyy's share (paisa)
  payment_ref     TEXT,                      -- Razorpay/Stripe ID
  metadata        JSONB DEFAULT '{}',        -- source-specific data
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_templates_site_type ON marketplace_templates(site_type);
CREATE INDEX idx_templates_status ON marketplace_templates(status);
CREATE INDEX idx_template_purchases_buyer ON template_purchases(buyer_id);
CREATE INDEX idx_service_orders_customer ON service_orders(customer_id);
CREATE INDEX idx_revenue_events_source ON revenue_events(source);
CREATE INDEX idx_revenue_events_created ON revenue_events(created_at);
CREATE INDEX idx_revenue_events_store ON revenue_events(store_id);
```

---

## 13. API Endpoints

### 13.1 Plan & Billing Routes (Existing, Updated)

```
POST /api/billing/subscribe          →  Create subscription (now with transaction_fee_pct)
POST /api/billing/cancel             →  Cancel subscription
GET  /api/billing/current            →  Get current plan + usage
POST /api/billing/upgrade            →  Upgrade plan
POST /api/billing/webhook/razorpay   →  Razorpay webhook
POST /api/billing/webhook/stripe     →  Stripe webhook
GET  /api/billing/invoices           →  List invoices (now includes GMV invoices)
POST /api/billing/topup              →  Purchase AI credit pack
```

### 13.2 Resume Download Routes (Existing, Updated)

```
POST /api/resume/download/initiate   →  Start download (creates Razorpay order, ₹99)
POST /api/resume/download/verify     →  Verify payment, generate PDF, split revenue
GET  /api/resume/download/stats      →  Owner's download stats + earnings
GET  /api/resume/download/history    →  Download history
POST /api/resume/download/webhook    →  Payment webhook for downloads
```

### 13.3 Template Marketplace Routes (NEW)

```
GET    /api/marketplace/templates              →  Browse templates (filter by site_type, category)
GET    /api/marketplace/templates/:id          →  Template detail + preview
POST   /api/marketplace/templates              →  Designer submits template
PUT    /api/marketplace/templates/:id          →  Update template
DELETE /api/marketplace/templates/:id          →  Delete/archive template
POST   /api/marketplace/templates/:id/purchase →  Purchase template
GET    /api/marketplace/purchases              →  Buyer's purchase history
GET    /api/marketplace/earnings               →  Designer's earnings dashboard
POST   /api/marketplace/payout                 →  Request payout (designer)
PUT    /api/marketplace/templates/:id/review   →  Admin: approve/reject (admin only)
```

### 13.4 Premium Services Routes (NEW)

```
GET    /api/services                    →  List available services
GET    /api/services/:type              →  Service detail + pricing
POST   /api/services/order              →  Place service order (50% upfront)
GET    /api/services/orders             →  Customer's order history
GET    /api/services/orders/:id         →  Order detail + status
PUT    /api/services/orders/:id/status  →  Update order status (admin)
POST   /api/services/orders/:id/pay     →  Pay remaining balance
POST   /api/services/orders/:id/review  →  Customer review/feedback
```

### 13.5 Revenue Analytics Routes (NEW)

```
GET  /api/analytics/revenue                →  Revenue dashboard (all sources)
GET  /api/analytics/revenue/breakdown      →  Revenue by source (pie chart data)
GET  /api/analytics/revenue/trend          →  Revenue trend (line chart data)
GET  /api/analytics/revenue/mrr            →  Monthly Recurring Revenue
GET  /api/analytics/revenue/ltv            →  Customer Lifetime Value stats
```

---

## 14. Billing Architecture & Payment Flows

### 14.1 Subscription + GMV Billing Flow (Store Plans)

```
┌────────────────────────────────────────────────────────────────┐
│  STORE HYBRID BILLING FLOW                                      │
└────────────────────────────────────────────────────────────────┘

DAY 1: USER SUBSCRIBES
━━━━━━━━━━━━━━━━━━━━━━
1. User selects Starter plan (₹749/mo)
2. Razorpay subscription created (auto-renew)
3. First payment: ₹749
4. transaction_fee_pct = 2% stored in subscriptions table

DURING MONTH: GMV TRACKING
━━━━━━━━━━━━━━━━━━━━━━━━━━
Every successful customer order:
1. Order amount → add to subscriptions.gmv_this_month
2. Transaction fee = order.total × subscription.transaction_fee_pct
3. Accumulate fees through the month

MONTH END: GMV INVOICE
━━━━━━━━━━━━━━━━━━━━━━━
Cron job runs on 1st of each month:
1. Calculate total_gmv for previous month
2. Calculate transaction_fee = total_gmv × fee_pct
3. If fee > ₹100: Generate invoice + charge via Razorpay
4. If fee ≤ ₹100: Roll over to next month
5. Reset gmv_this_month to 0

EXAMPLE:
  Store on Starter plan, did ₹3,00,000 GMV in January:
  - Base subscription (auto): ₹999
  - Transaction fee (invoice): ₹3,00,000 × 2% = ₹6,000
  - Total January revenue: ₹6,999
```

### 14.2 Resume Download Payment Flow

```
┌────────────────────────────────────────────────────────────────┐
│  RESUME DOWNLOAD PAYMENT                                        │
└────────────────────────────────────────────────────────────────┘

VISITOR FLOW:
━━━━━━━━━━━━━
┌──────────────────────────────────────────────────┐
│           DOWNLOAD THIS CV                        │
│                                                   │
│  ┌──────────────┐                                │
│  │   ₹99 Only   │                                │
│  │  Pay & Download │                             │
│  └──────────────┘                                │
│                                                   │
│  ✓ High-quality PDF                              │
│  ✓ ATS-compatible format                         │
│  ✓ Instant download                              │
│                                                   │
│  Powered by LetBuyy                              │
└──────────────────────────────────────────────────┘

PAYMENT SPLIT (v3.0):
━━━━━━━━━━━━━━━━━━━━
₹99 payment received:
├─ Razorpay fee: ₹5 (estimated)
├─ Resume owner: ₹69 (70%)
└─ Platform: ₹25 net (30% minus fees)

PAYOUT TO OWNER:
━━━━━━━━━━━━━━━━
Frequency: Weekly (every Monday)
Minimum: ₹200
Method: UPI / Bank Transfer
Dashboard: Shows earnings, download count, sources
```

---

## 15. Revenue Dashboard

### 15.1 Dashboard TypeScript Interface

```typescript
// packages/types/src/revenue.ts

export interface RevenueDashboard {
  period: { start: Date; end: Date };
  summary: {
    total_revenue: number;      // all sources, gross
    total_costs: number;        // infra + AI + payroll
    net_profit: number;
    profit_margin: number;      // percentage
    mrr: number;                // monthly recurring revenue
    arr: number;                // annual recurring revenue
  };
  by_source: {
    subscriptions: { count: number; revenue: number; growth: number };
    transaction_fees: { gmv: number; revenue: number; growth: number };
    resume_downloads: { count: number; revenue: number; growth: number };
    template_sales: { count: number; revenue: number; growth: number };
    ai_topups: { count: number; revenue: number; growth: number };
    services: { count: number; revenue: number; growth: number };
    addons: { count: number; revenue: number; growth: number };
  };
  customers: {
    total_paying: number;
    new_this_month: number;
    churned_this_month: number;
    churn_rate: number;
    avg_revenue_per_user: number;
    ltv: number;
  };
  by_site_type: Record<SiteType, {
    customers: number;
    revenue: number;
    avg_plan_price: number;
  }>;
}
```

### 15.2 Revenue Dashboard Wireframe (Admin Panel)

```
┌────────────────────────────────────────────────────────────────────┐
│  📊 REVENUE DASHBOARD                     Period: [Jan 2026 ▼]     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Revenue  │  │ Profit   │  │ MRR      │  │ Customers│          │
│  │ ₹3.5L    │  │ ₹2.75L   │  │ ₹2.8L    │  │ 234      │          │
│  │ ↑ 15%    │  │ ↑ 22%    │  │ ↑ 12%    │  │ ↑ 8%     │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│                                                                    │
│  Revenue by Source          │  Revenue by Site Type                │
│  ┌─────────────────────┐    │  ┌─────────────────────┐            │
│  │ ██████ Subs   40%   │    │  │ ██████ Store  55%   │            │
│  │ ████   GMV%   22%   │    │  │ ████   Resume 20%  │            │
│  │ ███    Resume 15%   │    │  │ ███    Blog   12%  │            │
│  │ ██     Tmplt  10%   │    │  │ ██     Portfo  8%  │            │
│  │ ██     AI      8%   │    │  │ █      Landing 5%  │            │
│  │ █      Svc     5%   │    │  └─────────────────────┘            │
│  └─────────────────────┘    │                                      │
│                              │  Customer Metrics                   │
│  Revenue Trend (6 months)   │  ┌─────────────────────┐            │
│  ┌─────────────────────┐    │  │ Churn:    3.2%      │            │
│  │        ╱─────       │    │  │ LTV:      ₹18,500   │            │
│  │      ╱              │    │  │ ARPU:     ₹1,496    │            │
│  │    ╱                │    │  │ LTV:CAC   4.2:1     │            │
│  │  ╱                  │    │  └─────────────────────┘            │
│  │╱                    │    │                                      │
│  └─────────────────────┘    │                                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

# PART 9 — LAUNCH STRATEGY & POSITIONING

---

## 16. Plan Enforcement Middleware

### 16.1 Feature Gate Middleware

```typescript
// packages/lib/src/plans/enforcer.ts

import { PlanConfig, SiteType } from '@letbuyy/types';

interface FeatureCheckResult {
  allowed: boolean;
  reason?: string;
  upgrade_to?: string;
  current_usage?: number;
  limit?: number;
}

export function checkFeatureAccess(
  store: { site_type: SiteType; plan: string },
  feature: string,
  currentUsage?: number
): FeatureCheckResult {
  const planConfig = resolvePlan(store.site_type, store.plan);

  // Check if feature exists in plan
  const featureValue = planConfig.features[feature];
  if (featureValue === undefined) {
    return { allowed: false, reason: 'Feature not available on this plan' };
  }

  // Boolean feature (enabled/disabled)
  if (typeof featureValue === 'boolean') {
    return featureValue
      ? { allowed: true }
      : { allowed: false, reason: `Requires ${getNextPlan(store)}`, upgrade_to: getNextPlan(store) };
  }

  // Numeric feature (check against limit)
  if (typeof featureValue === 'number' && currentUsage !== undefined) {
    if (currentUsage >= featureValue) {
      return {
        allowed: false,
        reason: `Limit reached (${currentUsage}/${featureValue})`,
        upgrade_to: getNextPlan(store),
        current_usage: currentUsage,
        limit: featureValue,
      };
    }
    return { allowed: true, current_usage: currentUsage, limit: featureValue };
  }

  return { allowed: true };
}

// AI credit check
export function checkAICredits(
  store: { site_type: SiteType; plan: string },
  creditsNeeded: number,
  currentCredits: number
): FeatureCheckResult {
  if (currentCredits < creditsNeeded) {
    return {
      allowed: false,
      reason: `Insufficient credits (${currentCredits} remaining, need ${creditsNeeded})`,
      current_usage: currentCredits,
      limit: creditsNeeded,
    };
  }
  return { allowed: true, current_usage: currentCredits - creditsNeeded };
}
```

### 16.2 Trial Enforcement

```typescript
// Trial check middleware
export function checkTrialStatus(store: {
  plan: string;
  trial_started_at: Date | null;
  trial_days: number;
}): { active: boolean; days_remaining: number; expired: boolean } {
  if (store.plan !== 'free') return { active: false, days_remaining: 0, expired: false };
  if (!store.trial_started_at) return { active: true, days_remaining: 7, expired: false };

  const now = new Date();
  const trialEnd = new Date(store.trial_started_at);
  trialEnd.setDate(trialEnd.getDate() + (store.trial_days || 7));

  const remaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    active: remaining > 0,
    days_remaining: Math.max(0, remaining),
    expired: remaining <= 0,
  };
}
```

---

## 17. Plan Selection UI — Wireframes

### 17.1 Plan Selection Page (Store)

```
┌────────────────────────────────────────────────────────────────────┐
│  Choose Your Store Plan                                            │
│  All plans include 7-day free trial                                │
│                                                                    │
│  [Monthly]  [Annual (Save 20-30%)]                                │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   STARTER    │  │ ★ BUSINESS   │  │  ENTERPRISE  │            │
│  │              │  │  Most Popular │  │              │            │
│  │   ₹749/mo     │  │  ₹2,399/mo   │  │  ₹8,199/mo   │            │
│  │   + 2% GMV   │  │  + 1.2% GMV  │  │  + 0.8% GMV  │            │
│  │              │  │              │  │              │            │
│  │ ✓ 100 prod   │  │ ✓ 1K products│  │ ✓ Unlimited  │            │
│  │ ✓ 250 orders │  │ ✓ 2.5K orders│  │ ✓ Unlimited  │            │
│  │ ✓ 50 AI/mo   │  │ ✓ 200 AI/mo  │  │ ✓ 1K AI/mo   │            │
│  │ ✓ 5 GB stor  │  │ ✓ 25 GB stor │  │ ✓ 100 GB stor│            │
│  │ ✓ 1 staff    │  │ ✓ 3 staff    │  │ ✓ Unlimited  │            │
│  │              │  │              │  │              │            │
│  │ [Start Free] │  │ [Start Free] │  │ [Contact Us] │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                    │
│  All plans: Custom domain, SSL, 24/7 monitoring                   │
│  Questions? → support@letbuyy.store                               │
└────────────────────────────────────────────────────────────────────┘
```

### 17.2 Resume Download Gate (Visitor-Facing)

```
┌──────────────────────────────────────────┐
│         DOWNLOAD THIS RESUME             │
│                                          │
│  ┌──────────────────────────────┐        │
│  │  👤  John Doe                │        │
│  │  Senior Software Engineer    │        │
│  │  ★★★★★ (4.8 rating)         │        │
│  └──────────────────────────────┘        │
│                                          │
│  Download PDF for ₹99                    │
│                                          │
│  ┌──────────────────────────────┐        │
│  │   [Pay ₹99 & Download]      │        │
│  └──────────────────────────────┘        │
│                                          │
│  ✓ ATS-compatible PDF format             │
│  ✓ High-quality print-ready              │
│  ✓ Instant download after payment        │
│                                          │
│  ── Or ──                                │
│                                          │
│  🔗 Create your own resume FREE          │
│     → letbuyy.store/resume               │
│                                          │
│  Powered by LetBuyy                      │
└──────────────────────────────────────────┘
```

### 17.3 Feature Gate Modal

```
┌──────────────────────────────────────────┐
│  ⚡ Upgrade Required                     │
│                                          │
│  You've reached your plan limit:         │
│                                          │
│  Products: 10/10 used                     │
│  ████████████████████ 100%               │
│                                          │
│  Upgrade to Starter (₹749/mo) to get:    │
│  • Up to 100 products                    │
│  • 250 orders/month                      │
│  • Custom domain                         │
│  • 50 AI credits/month                   │
│                                          │
│  ┌──────────────────────────────┐        │
│  │   [Upgrade to Starter]       │        │
│  └──────────────────────────────┘        │
│  ┌──────────────────────────────┐        │
│  │   [Compare All Plans]        │        │
│  └──────────────────────────────┘        │
│                                          │
│  [Maybe later]                           │
└──────────────────────────────────────────┘
```

---

## 18. Month 1 Revenue Plan

### 18.1 Week-by-Week Launch Strategy

```
┌────────────────────────────────────────────────────────────────┐
│  MONTH 1 — PROFITABLE FROM DAY 1                                │
└────────────────────────────────────────────────────────────────┘

WEEK 1: FOUNDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Launch 10 seed templates (marketplace)
□ Set up premium services page
□ Enable resume with ₹99 download gate
□ Configure all plans in Razorpay
□ Send launch emails to existing users

Revenue Target: ₹5,000


WEEK 2: FIRST CUSTOMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Free trial → follow up on day 3 and day 5
□ Offer first 10 customers 50% off first month
□ Launch 2 premium services (store setup, portfolio)
□ Post in 10 startup/freelancer communities

Revenue Target: ₹15,000


WEEK 3: GROWTH PUSH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Run ₹5,000 Google Ads (target: freelancer + small biz)
□ Launch resume builder aggressively (free to build)
□ Publish 3 case studies / success stories
□ Recruit 5 designers for template marketplace

Revenue Target: ₹15,000


WEEK 4: MONETIZE & OPTIMIZE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Convert trial users (day 7 follow-ups)
□ Upsell existing users on AI credits
□ Launch template bundles
□ Analyze: which plan converts best? Which site type?

Revenue Target: ₹10,000

═══════════════════════════════════════════════════════════════
MONTH 1 TOTAL TARGET: ₹45,000
MONTH 1 COSTS: ~₹38,000 (infra + AI + ads)
MONTH 1 PROFIT: ₹7,000 ← PROFITABLE FROM MONTH 1
═══════════════════════════════════════════════════════════════
```

### 18.2 Marketing Budget (Month 1)

| Channel | Budget | Expected Returns | ROI |
|---|:---:|:---:|:---:|
| Google Ads | ₹5,000 | 20 signups, 5 paid | 5:1 |
| Community posts | ₹0 (time) | 15 signups, 3 paid | ∞ |
| LinkedIn outreach | ₹0 (time) | 10 signups, 2 paid | ∞ |
| Email to existing | ₹0 | 8 upgrades | ∞ |
| Product Hunt | ₹0 | 50 signups, 5 paid | ∞ |
| **Total** | **₹5,000** | **103 signups, 23 paid** | **9:1** |

### 18.3 LTV:CAC Analysis

```
CUSTOMER ACQUISITION COST (CAC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Month 1 Marketing: ₹5,000
Paid customers: 23
CAC = ₹5,000 ÷ 23 = ₹217 per customer

CUSTOMER LIFETIME VALUE (LTV):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average plan: ₹749/month
Average retention: 12 months
Upsells (templates, AI, services): ₹3,000/year
LTV = (₹749 × 12) + ₹3,000 = ₹11,988

LTV:CAC RATIO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
₹14,988 ÷ ₹217 = 69:1 ← EXCEPTIONAL

Target: > 3:1 is healthy
LetBuyy: 69:1 (because most acquisition is organic)

Even with ₹500 CAC (paid only): 30:1 ratio
```

---

## 19. Growth Playbook

### 19.1 Quarterly Plan

```
Q1 (Month 1-3): FOUNDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Focus: Get first 50 paying customers
Revenue Target: ₹1.25L/month by Month 3

Actions:
✓ Launch all 5 site types with v3 pricing
✓ Template marketplace with 50+ templates
✓ Premium services live (3 service types)
✓ Resume viral loop activated
✓ Content marketing (5 blog posts/month)

Key Metrics:
- Paying customers: 50
- MRR: ₹1.25L
- Churn: < 5%
- Template sales: 50/month


Q2 (Month 4-6): GROWTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Focus: Scale to 200 paying customers
Revenue Target: ₹3.5L/month by Month 6

Actions:
✓ Google Ads: ₹15,000/month
✓ Partnership with 5 freelancer communities
✓ Template marketplace: 100+ templates
✓ Premium services: full catalog
✓ Blog monetization features live
✓ Hire first operations person

Key Metrics:
- Paying customers: 200
- MRR: ₹3.5L
- Churn: < 4%
- Template sales: 150/month
- Service orders: 8/month


Q3 (Month 7-9): OPTIMIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Focus: Optimize for profitability
Revenue Target: ₹6L/month by Month 9

Actions:
✓ A/B test pricing (find sweet spots)
✓ Automate more service delivery
✓ Launch template subscriptions
✓ Agency/reseller program
✓ International expansion (USD pricing)
✓ Hire designer + developer

Key Metrics:
- Paying customers: 500
- MRR: ₹6L
- Churn: < 3%
- ARPU: ₹1,200


Q4 (Month 10-12): SCALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Focus: Cross ₹8L MRR, preparation for next year
Revenue Target: ₹8.5L/month by Month 12

Actions:
✓ Enterprise customers (dedicated support)
✓ API partnerships
✓ White-label program
✓ Multiple language support
✓ Mobile app (basic)

Key Metrics:
- Paying customers: 1,000
- MRR: ₹8.5L
- ARR: ₹1.02 crore
- Team size: 5
```

### 19.2 Year 1 Financial Summary

| Quarter | Revenue | Costs | Profit | Cumulative Profit |
|---|:---:|:---:|:---:|:---:|
| Q1 | ₹3.0L | ₹1.5L | ₹1.5L | ₹1.5L |
| Q2 | ₹8.0L | ₹2.5L | ₹5.5L | ₹7.0L |
| Q3 | ₹15.0L | ₹5.0L | ₹10.0L | ₹17.0L |
| Q4 | ₹22.0L | ₹8.0L | ₹14.0L | ₹31.0L |
| **Year 1** | **₹48.0L** | **₹17.0L** | **₹31.0L** | — |

**Year 1 Profit Margin: 65%**

---

## 20. Competitive Positioning

### 20.1 vs Major Competitors

| Feature | **LetBuyy** | Shopify | Wix | WordPress |
|---|:---:|:---:|:---:|:---:|
| Starting price (INR) | ₹749/mo | ₹2,399/mo | ₹650/mo | ₹750/mo |
| AI features | ✅ Built-in | ❌ Plugin | ✅ Basic | ❌ Plugin |
| Resume + Download | ✅ Unique | ❌ | ❌ | ❌ |
| Portfolio builder | ✅ Dedicated | ❌ | ✅ Generic | ❌ |
| Free trial | 7 days | 3 days | 14 days | None |
| Template marketplace | ✅ 40/60 | ✅ 100% Shopify | ✅ Wix | ✅ Free |
| Transaction fees | 0.8-2% | 0.5-2% | 0% | 0% |
| Multi-site type | ✅ 5 types | Store only | ✅ | ✅ |
| Indian pricing | ✅ Native | ✅ Fixed USD | ✅ | ✅ |
| UPI payments | ✅ | Via addon | ❌ | Plugin |
| Support in Hindi | ✅ | ❌ | ❌ | ❌ |

### 20.2 Positioning Statement

> **LetBuyy** is the only platform that combines **5 site types** (store, portfolio, resume, blog, landing) with **built-in AI**, **Indian pricing**, and a **pay-what-you-use model** — starting from ₹0 for resumes and ₹599/month for content sites. Unlike Shopify (too expensive for India) or Wix (no AI), LetBuyy is built for Indian creators, freelancers, and small businesses who want a premium online presence without the premium price tag.

---

## 21. FAQ

**Q: Why is the free tier so limited?**
A: The free tier is a 7-day trial to experience the full product. Generous free tiers train users to never pay. Our data shows that limited trials convert 3x better.

**Q: Why charge ₹99 for resume downloads?**
A: Resume owners build for free. The ₹99 charge is on visitors who want the PDF — they're usually recruiters or HR professionals for whom ₹99 is negligible. The owner still earns ₹69 per download.

**Q: Why add transaction fees on top of subscriptions?**
A: Hybrid pricing aligns our success with yours. A store doing ₹10L/month GMV is getting 10x more value than one doing ₹1L/month. The fee is lower than Shopify's and ensures the platform scales sustainably.

**Q: Why did AI credits decrease?**
A: Most users were allocated credits they never used (70% waste on v2.0). Tighter allocations mean we can offer better AI models (Claude Sonnet instead of just Flash) to users who actually use credits. Top-up packs are available for power users.

**Q: Can I upgrade/downgrade anytime?**
A: Yes. Upgrades take effect immediately (prorated). Downgrades take effect at the next billing cycle. No contracts, cancel anytime.

**Q: What happens to my data if I cancel?**
A: Your data is preserved for 30 days after cancellation. You can export everything (products, content, analytics) at any time. After 30 days, data is archived (recoverable for 90 days upon request).

**Q: Do you support international payments?**
A: Yes. Razorpay handles INR; Stripe handles USD/EUR/GBP. Pricing is shown in local currency automatically.

---

## 22. Final Summary: v2.0 → v3.0 Changes

```
═══════════════════════════════════════════════════════════════
   LETBUYY PRICING v3.0 — PROFIT EDITION
   "Revenue from Day 1, Sustainable Growth, Maximum Margins"
═══════════════════════════════════════════════════════════════

WHAT CHANGED:

1. REVENUE MODEL: Single → 7 Revenue Streams
   Subscriptions + GMV% + Resume Downloads + Templates
   + AI Top-ups + Premium Services + Add-ons

2. FREE TIER: Generous → Strategic (7-day trial)
   Purpose: showcase value, create urgency, convert faster

3. STORE PRICING: Flat → Hybrid (Base + %GMV)
   Revenue scales with customer success

4. RESUME SPLIT: 80/20 → 70/30
   Platform earns ₹30 per download (was ₹20)

5. AI CREDITS: Generous → Profitable
   Tighter allocations, higher top-up prices, 70-94% margins

6. TEMPLATE MARKETPLACE: New revenue stream
   40/60 split, ₹50L+ potential Year 1

7. PREMIUM SERVICES: New revenue stream
   85% margins, ₹30L+ potential Year 1

PROJECTED YEAR 1: ₹48L revenue, ₹31L profit (65% margin)
TARGET MONTH 12 MRR: ₹8.5L/month

═══════════════════════════════════════════════════════════════
```

---

> **Document End** — v3.0 Profit Edition
> Last updated: February 16, 2026
> Next review: March 1, 2026 (after Month 1 data)
