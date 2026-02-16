# LetBuyy Administrative Apps — App Store & Theme Marketplace

> **Part 4 of 8** | App Store Governance, Developer Management, Theme Marketplace, Review Processes
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Scope:** This document covers how the Console and Team apps manage the App Store ecosystem (developer portal, app review, billing commissions) and the Theme Marketplace (theme submissions, review, catalog management).

---

## Table of Contents

1. [App Store Administration Overview](#1-app-store-administration-overview)
2. [Developer Management](#2-developer-management)
3. [App Review Process](#3-app-review-process)
4. [App Store Billing & Commissions](#4-app-store-billing--commissions)
5. [Theme Marketplace Administration](#5-theme-marketplace-administration)
6. [Theme Review Process](#6-theme-review-process)
7. [Marketplace Analytics](#7-marketplace-analytics)
8. [Document History](#8-document-history)

---

## 1. App Store Administration Overview

### 1.1 App Store Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     APP STORE ECOSYSTEM                                 │
│                                                                         │
│  apps.letbuyy.store (consumer-facing)                                  │
│  ├── Homepage: featured apps, categories, search                       │
│  ├── App detail pages: descriptions, reviews, pricing                  │
│  ├── App installation flow: OAuth 2.0 consent                         │
│  ├── Developer portal: submit apps, manage listings                    │
│  └── Billing: app purchases, subscriptions, free trials               │
│                                                                         │
│  ADMIN RESPONSIBILITIES (Console + Team):                              │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  Console (full control):           Team (review & support):      │ │
│  │  ├── App Store policies             ├── App review queue          │ │
│  │  ├── Developer verification        ├── Developer support         │ │
│  │  ├── Commission rates               ├── Flag violations          │ │
│  │  ├── Featured apps management       ├── Review app updates       │ │
│  │  ├── Category management            └── Respond to developer     │ │
│  │  ├── Developer payouts oversight        inquiries                │ │
│  │  ├── App removal / banning          							   │ │
│  │  ├── API access management          							   │ │
│  │  └── Marketplace analytics          							   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 App Store Stats Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  App Store Overview                              Period: [February ▾]   │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Published│ │ Active   │ │ Install- │ │ Revenue  │ │ Developer│    │
│  │ Apps     │ │ Devs     │ │ ations   │ │ (commis.)│ │ Payouts  │    │
│  │ 124      │ │ 38       │ │ 8,920    │ │ ₹0.8L    │ │ ₹3.2L    │    │
│  │ ↑8       │ │ ↑3       │ │ ↑12%     │ │ ↑45%     │ │ pending 5│    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                                          │
│  PENDING ACTIONS                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📱 3 apps awaiting review (oldest: 2 days)                        │ │
│  │ 👤 2 developer verification requests                              │ │
│  │ 💰 5 pending monthly payouts                                      │ │
│  │ 🔄 1 app update needs re-review                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  TOP APPS BY INSTALLS           │  TOP CATEGORIES                      │
│  1. Smart Reviews     1,245     │  Marketing & SEO     35 apps         │
│  2. SEO Optimizer       980     │  Customer Support    22 apps         │
│  3. Live Chat           875     │  Analytics           18 apps         │
│  4. Email Marketing     720     │  Sales & Conversion  16 apps         │
│  5. Inventory Plus      650     │  Inventory           12 apps         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Developer Management

### 2.1 Developer List View

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Developers                                       Total: 38 active      │
│                                                                          │
│  [🔍 Search developer...      ]  [Status ▾] [Tier ▾] [Revenue ▾]      │
│                                                                          │
│  ┌────┬────────────────┬────────────┬─────────┬──────────┬────────────┐│
│  │    │ Developer      │ Status     │ Apps    │ Revenue  │ Payout     ││
│  ├────┼────────────────┼────────────┼─────────┼──────────┼────────────┤│
│  │ 🟢 │ AppWorks Inc   │ ✅ Verified│ 8 apps  │ ₹2.4L    │ Feb 28     ││
│  │ 🟢 │ Digital Labs   │ ✅ Verified│ 5 apps  │ ₹1.8L    │ Feb 28     ││
│  │ 🟡 │ NewDev Studio  │ ⏳ Pending │ 1 app   │ ₹0       │ —          ││
│  │ 🔴 │ SpamApps LLC   │ 🚫 Banned  │ 0 apps  │ ₹0       │ Frozen     ││
│  │ 🟢 │ TechMakers     │ ✅ Verified│ 3 apps  │ ₹0.9L    │ Feb 28     ││
│  └────┴────────────────┴────────────┴─────────┴──────────┴────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Developer Verification Flow

```
Developer applies via developer portal
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  APPLICATION RECEIVED                                         │
│  ├── Company/individual info                                 │
│  ├── Tax ID / GST number (India)                            │
│  ├── Portfolio / previous work links                        │
│  ├── Bank account for payouts                               │
│  └── Status: 'pending'                                      │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  ADMIN REVIEW (Console or Team)                               │
│  ├── Verify identity documents                               │
│  ├── Check portfolio for quality                             │
│  ├── Validate tax information                                │
│  ├── Review Razorpay payout account                          │
│  └── Actions:                                                │
│       ├── ✅ Approve → status: 'active'                      │
│       ├── 🔄 Request more info → email sent                 │
│       └── ❌ Reject → status: 'rejected' + reason           │
└──────────────────────────────────────────────────────────────┘
         │ Approved
         ▼
┌──────────────────────────────────────────────────────────────┐
│  ACTIVE DEVELOPER                                             │
│  ├── Can submit apps for review                              │
│  ├── Access to developer dashboard                           │
│  ├── Monthly payout enrollment                               │
│  └── API access for app development                          │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Developer Admin Actions

| Action | Console | Team | Permission |
|---|---|---|---|
| View developer profiles | ✅ | ✅ | `stores.read` |
| Approve/reject developer application | ✅ | ✅ | `moderation.action` |
| Suspend developer account | ✅ | ❌ | `stores.suspend` |
| Ban developer permanently | ✅ | ❌ | `stores.delete` |
| Configure payout schedules | ✅ | ❌ | `billing.override` |
| View developer analytics | ✅ | 🔍 | `analytics.read` |
| Contact developer | ✅ | ✅ | `tickets.reply` |

---

## 3. App Review Process

### 3.1 Review Pipeline

```
Developer submits app (or app update) for review
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 1: AUTOMATED CHECKS (instant)                         │
│  ├── Manifest validation (required fields present)          │
│  ├── Permission scope check (no over-requesting)            │
│  ├── API endpoint validation (all endpoints respond)        │
│  ├── OAuth callback URL verification                        │
│  ├── Security headers check (CSP, CORS configured)         │
│  ├── Size check (bundle < 50MB)                             │
│  └── Dependency audit (no known vulnerable packages)        │
│                                                              │
│  ❌ Fail → auto-rejected with specific error list           │
│  ✅ Pass → moves to Stage 2                                 │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 2: FUNCTIONAL REVIEW (Team app — 1-3 business days)  │
│  ├── Reviewer installs app in test store                    │
│  ├── Tests core functionality                                │
│  ├── Verifies billing integration (if paid app)             │
│  ├── Tests uninstall flow (clean removal)                   │
│  ├── Checks App Bridge SDK integration                      │
│  ├── Reviews UI/UX quality                                   │
│  └── Verifies description matches functionality             │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 3: SECURITY REVIEW (Console — for apps requesting    │
│  sensitive permissions: orders, customers, payments)         │
│  ├── Code review for data handling practices                │
│  ├── Privacy policy review                                   │
│  ├── Data storage verification (where is data kept?)        │
│  ├── Webhook endpoint security                               │
│  └── Super admin sign-off required                          │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  DECISION                                                     │
│  ├── ✅ Approved → published to App Store                    │
│  ├── 🔄 Revisions needed → feedback sent to developer       │
│  ├── ❌ Rejected → detailed rejection reason + appeal info  │
│  └── 🚫 Rejected + banned → policy violation too severe     │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 App Review Queue UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│  App Review Queue                                  📱 3 pending review  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📱 "Inventory Sync Pro" by AppWorks Inc                           │ │
│  │ Version: 1.0.0 │ Submitted: Feb 12, 2026 │ Wait: 2 days          │ │
│  │ Category: Inventory │ Price: ₹499/mo │ Permissions: 4             │ │
│  │                                                                    │ │
│  │ Description: Syncs inventory across multiple warehouses and       │ │
│  │ automatically updates stock levels when orders are placed...      │ │
│  │                                                                    │ │
│  │ Auto-checks: ✅ Manifest │ ✅ Endpoints │ ✅ Security │ ✅ Size   │ │
│  │                                                                    │ │
│  │ Permissions requested:                                             │ │
│  │ ├── read_products ✅                                               │ │
│  │ ├── write_products ✅                                              │ │
│  │ ├── read_orders ✅                                                 │ │
│  │ └── read_inventory ✅                                              │ │
│  │                                                                    │ │
│  │ [🧪 Install in Test Store] [📋 Full Review] [✅ Approve] [❌ Rej.]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📱 "AI Product Writer" by TechMakers                              │ │
│  │ Version: 2.1.0 (update) │ Submitted: Feb 13 │ Wait: 1 day        │ │
│  │ Category: Content │ Price: Free │ Permissions: 2                  │ │
│  │                                                                    │ │
│  │ Changes in this version:                                           │ │
│  │ • Added support for bulk product descriptions                     │ │
│  │ • New AI model option (GPT-4)                                     │ │
│  │ • Bug fixes for Hindi language support                            │ │
│  │                                                                    │ │
│  │ Auto-checks: ✅ Manifest │ ✅ Endpoints │ ⚠️ New permission       │ │
│  │                                                                    │ │
│  │ ⚠️ New permission: write_products (not in v2.0)                   │ │
│  │                                                                    │ │
│  │ [🧪 Install in Test Store] [📋 Full Review] [✅ Approve] [❌ Rej.]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 App Review Criteria

| Criterion | Score Weight | Pass Threshold | Reviewer |
|---|---|---|---|
| **Functionality** — app works as described | 30% | All core features work | Team |
| **UI/UX quality** — professional, consistent | 15% | No major UX issues | Team |
| **Performance** — fast load, no memory leaks | 15% | <3s load, <100MB memory | Automated |
| **Security** — data handling, auth, privacy | 25% | No vulnerabilities found | Console (sensitive) |
| **Compatibility** — works with all plan tiers | 10% | Works on Free + paid | Team |
| **Documentation** — setup guide, help articles | 5% | Basic docs present | Team |

---

## 4. App Store Billing & Commissions

### 4.1 Commission Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    APP STORE COMMISSION MODEL                            │
│                                                                         │
│  PAID APPS (one-time purchase)                                         │
│  ├── Merchant pays: app price                                          │
│  ├── Platform commission: 20%                                          │
│  ├── Developer receives: 80%                                           │
│  └── Example: App costs ₹999                                          │
│       ├── Platform: ₹199.80                                            │
│       └── Developer: ₹799.20                                           │
│                                                                         │
│  SUBSCRIPTION APPS (recurring monthly)                                  │
│  ├── Merchant pays: monthly fee                                        │
│  ├── Platform commission: 20%                                          │
│  ├── Developer receives: 80%                                           │
│  └── Example: App costs ₹499/mo                                       │
│       ├── Platform: ₹99.80/mo                                         │
│       └── Developer: ₹399.20/mo                                       │
│                                                                         │
│  FREE APPS                                                              │
│  ├── No commission (developer builds for ecosystem)                    │
│  └── May have premium tiers (commission on upgrades)                   │
│                                                                         │
│  PAYOUT SCHEDULE                                                        │
│  ├── Monthly on the last business day                                  │
│  ├── Minimum payout: ₹500                                              │
│  ├── Via Razorpay Route (linked accounts)                              │
│  └── Admin can hold/adjust payouts from Console                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Payout Management Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Developer Payouts                             February 2026 Cycle      │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ Gross    │ │ Platform │ │ Developer│ │ Pending  │                  │
│  │ Revenue  │ │ Share    │ │ Share    │ │ Payouts  │                  │
│  │ ₹4.0L    │ │ ₹0.8L    │ │ ₹3.2L    │ │ 5        │                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
│                                                                          │
│  UPCOMING PAYOUTS                                                       │
│  ┌────────────────┬──────────┬──────────┬──────────┬──────────────────┐│
│  │ Developer      │ Gross    │ Commiss. │ Net Pay  │ Action           ││
│  ├────────────────┼──────────┼──────────┼──────────┼──────────────────┤│
│  │ AppWorks Inc   │ ₹1.6L    │ ₹32K     │ ₹1.28L   │ [💰 Pay] [⏸ Hold]││
│  │ Digital Labs   │ ₹1.2L    │ ₹24K     │ ₹96K     │ [💰 Pay] [⏸ Hold]││
│  │ TechMakers     │ ₹0.8L    │ ₹16K     │ ₹64K     │ [💰 Pay] [⏸ Hold]││
│  │ CodeCraft      │ ₹0.3L    │ ₹6K      │ ₹24K     │ [💰 Pay] [⏸ Hold]││
│  │ StartupDev     │ ₹0.1L    │ ₹2K      │ ₹8K      │ [💰 Pay] [⏸ Hold]││
│  └────────────────┴──────────┴──────────┴──────────┴──────────────────┘│
│                                                                          │
│  [💰 Process All Payouts]  [📥 Export Payout Report]                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Theme Marketplace Administration

### 5.1 Theme Marketplace Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THEME MARKETPLACE ECOSYSTEM                          │
│                                                                         │
│  themes.letbuyy.store (consumer-facing)                                │
│  ├── Theme browsing: categories, filters, search                       │
│  ├── Theme preview: live demo with sample content                      │
│  ├── Theme purchase: free + premium (one-time)                         │
│  ├── Theme installation: one-click to merchant store                   │
│  └── Designer portal: submit themes, manage sales                     │
│                                                                         │
│  THEME TYPES BY SITE TYPE:                                             │
│  ┌────────────┬─────────────┬──────────────────────────────────────┐  │
│  │ Site Type  │ Theme Count │ Price Range                           │  │
│  ├────────────┼─────────────┼──────────────────────────────────────┤  │
│  │ Store      │ 45 themes   │ Free – ₹2,999                       │  │
│  │ Portfolio  │ 25 themes   │ Free – ₹1,999                       │  │
│  │ Resume     │ 20 themes   │ Free – ₹999                         │  │
│  │ Blog       │ 30 themes   │ Free – ₹1,499                       │  │
│  │ Landing    │ 15 themes   │ Free – ₹1,999                       │  │
│  └────────────┴─────────────┴──────────────────────────────────────┘  │
│                                                                         │
│  COMMISSION: 30% on premium theme sales                                │
│  PAYOUT: Monthly (same schedule as app store)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Theme Admin Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Theme Marketplace                                                      │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Published│ │ Active   │ │ Total    │ │ Revenue  │ │ Pending  │    │
│  │ Themes   │ │ Designers│ │ Installs │ │ (commis.)│ │ Reviews  │    │
│  │ 135      │ │ 22       │ │ 4,280    │ │ ₹0.3L    │ │ 4        │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                                          │
│  THEME CATALOG                                                          │
│  ┌────┬────────────────┬──────────┬──────────┬──────────┬────────────┐│
│  │    │ Theme          │ Type     │ Price    │ Installs │ Rating     ││
│  ├────┼────────────────┼──────────┼──────────┼──────────┼────────────┤│
│  │ 🎨 │ Aurora          │ Store    │ ₹1,499   │ 890      │ ⭐ 4.8    ││
│  │ 🎨 │ Minimal Pro    │ Portfolio│ ₹999     │ 650      │ ⭐ 4.7    ││
│  │ 🎨 │ DevCard        │ Resume   │ Free     │ 1,200    │ ⭐ 4.5    ││
│  │ 🎨 │ Newsroom       │ Blog     │ ₹799     │ 420      │ ⭐ 4.6    ││
│  │ 🎨 │ LaunchPad      │ Landing  │ ₹1,999   │ 320      │ ⭐ 4.9    ││
│  └────┴────────────────┴──────────┴──────────┴──────────┴────────────┘│
│                                                                          │
│  [➕ Add Official Theme]  [📂 Manage Categories]  [⭐ Manage Featured] │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Theme Review Process

### 6.1 Review Pipeline

```
Designer submits theme for review
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 1: AUTOMATED VALIDATION (instant)                     │
│  ├── File structure check (required files present)          │
│  │   ├── theme.json (configuration manifest)               │
│  │   ├── preview.png (1200x800 minimum)                    │
│  │   └── templates/ (required page templates)              │
│  ├── CSS validation (no syntax errors)                      │
│  ├── Responsive check (mobile breakpoints defined)          │
│  ├── Performance check (CSS < 200KB, images optimized)     │
│  ├── Accessibility check (color contrast, ARIA labels)     │
│  └── Malicious code scan (no external scripts/tracking)    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 2: VISUAL REVIEW (Team app — 3-5 business days)      │
│  ├── Reviewer loads theme in preview mode                   │
│  ├── Checks all 5 site types (if theme supports multiple)  │
│  ├── Tests customization options                             │
│  ├── Verifies mobile responsiveness                          │
│  ├── Checks dark mode (if supported)                        │
│  ├── Validates sample content rendering                     │
│  └── Confirms screenshots match actual theme                │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  DECISION                                                     │
│  ├── ✅ Approved → published to marketplace                  │
│  ├── 🔄 Changes needed → specific feedback to designer      │
│  └── ❌ Rejected → does not meet quality standards           │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Theme Review Criteria

| Criterion | Weight | Pass Criteria |
|---|---|---|
| **Visual quality** | 30% | Professional, polished, unique design |
| **Responsiveness** | 25% | Flawless on mobile, tablet, desktop |
| **Performance** | 15% | Lighthouse score > 85, CSS < 200KB |
| **Customization** | 15% | Color scheme, fonts, layout options work |
| **Accessibility** | 10% | WCAG 2.1 AA compliance |
| **Documentation** | 5% | Setup guide included |

---

## 7. Marketplace Analytics

### 7.1 Combined Marketplace Metrics

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Marketplace Analytics                          [Last 3 Months ▾]      │
│                                                                          │
│  APP STORE                          │  THEME MARKETPLACE                │
│  ┌────────────────────────────────┐ │ ┌────────────────────────────────┐│
│  │ Total installs: 24,500        │ │ │ Total installs: 12,840        ││
│  │ Unique installers: 3,200      │ │ │ Unique installers: 4,100      ││
│  │ Avg install/store: 3.2 apps   │ │ │ Avg theme changes: 1.4        ││
│  │ Uninstall rate: 12%           │ │ │ Return rate: 8%                ││
│  │ Revenue: ₹2.4L                │ │ │ Revenue: ₹0.9L                ││
│  │ Commission: ₹0.48L            │ │ │ Commission: ₹0.27L            ││
│  │ Top category: Marketing       │ │ │ Top type: Store themes         ││
│  └────────────────────────────────┘ │ └────────────────────────────────┘│
│                                                                          │
│  DEVELOPER ECOSYSTEM HEALTH                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Active developers: 38 │ New this month: 3 │ Churn: 1             │ │
│  │ Active designers: 22  │ New this month: 2 │ Churn: 0             │ │
│  │ Avg review time: 2.1 days │ Rejection rate: 15%                   │ │
│  │ Developer satisfaction: 4.2/5 (from monthly survey)               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [📥 Export Full Report] [📊 Detailed Breakdown] [📧 Send to Stakeholders]│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Feb 16, 2026 | Initial version — 7 sections covering App Store administration (stats dashboard, developer management, verification flow, 3-stage app review pipeline, review queue UI, billing with 20% commission, payout management), Theme Marketplace (overview with 5 site types, catalog, 2-stage review pipeline, quality criteria), and combined marketplace analytics |

---

> **Next:** [Part 5 — Analytics, AI Moderation & Support](./05_Analytics_AI_Support.md)

---

*[← Back to Index](./README.md)*
