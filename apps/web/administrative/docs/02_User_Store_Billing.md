# LetBuyy Administrative Apps — User & Store Management, Billing

> **Part 2 of 8** | User Account Management, Store Lifecycle, Billing Operations & Subscription Oversight
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Scope:** This document covers how the Console and Team apps manage users, stores, and all billing/subscription operations across the LetBuyy platform.

---

## Table of Contents

1. [User Management](#1-user-management)
2. [Store Lifecycle Management](#2-store-lifecycle-management)
3. [Store Impersonation](#3-store-impersonation)
4. [Billing & Subscription Oversight](#4-billing--subscription-oversight)
5. [Plan Management](#5-plan-management)
6. [Refund & Dispute Handling](#6-refund--dispute-handling)
7. [GDPR & Data Operations](#7-gdpr--data-operations)
8. [Document History](#8-document-history)

---

## 1. User Management

### 1.1 User List View

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Users                                           Total: 4,521 accounts  │
│                                                                          │
│  [🔍 Search by email, name, or ID...              ]  [Filter ▾] [Sort ▾]│
│                                                                          │
│  Filters: [Status ▾] [Role ▾] [Plan ▾] [Site Type ▾] [Created ▾]      │
│                                                                          │
│  ┌────┬────────────────┬──────────────────┬────────┬────────┬──────────┐│
│  │    │ Name           │ Email            │ Stores │ Status │ Joined   ││
│  ├────┼────────────────┼──────────────────┼────────┼────────┼──────────┤│
│  │ 👤 │ Priya Sharma   │ priya@gmail.com  │ 2      │ 🟢 Act │ Jan 15   ││
│  │ 👤 │ Amit Kumar     │ amit@yahoo.com   │ 1      │ 🟢 Act │ Jan 22   ││
│  │ 👤 │ Sarah Lee      │ sarah@outlook.com│ 3      │ 🟡 Trial│ Feb 01   ││
│  │ 👤 │ Raj Patel      │ raj@temp.com     │ 0      │ 🔴 Susp│ Feb 05   ││
│  │ 👤 │ Lisa Chen      │ lisa@company.co  │ 1      │ 🟢 Act │ Feb 10   ││
│  └────┴────────────────┴──────────────────┴────────┴────────┴──────────┘│
│                                                                          │
│  Showing 1-20 of 4,521  │  [← Prev] Page 1 of 227 [Next →]            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 User Detail View

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Users / Priya Sharma                                                 │
│                                                                          │
│  ┌────────────────────────────────────────┬──────────────────────────┐  │
│  │  PROFILE                               │  QUICK ACTIONS           │  │
│  │                                         │                          │  │
│  │  Name: Priya Sharma                    │  [🔍 View Activity Log]  │  │
│  │  Email: priya@gmail.com                │  [📧 Send Email]         │  │
│  │  Phone: +91 98765-43210                │  [🔒 Reset Password]     │  │
│  │  Status: 🟢 Active                     │  [🚫 Suspend Account]    │  │
│  │  Role: store_owner                      │  [🏪 Impersonate Store] │  │
│  │  Joined: Jan 15, 2026                  │  [📦 Export Data (GDPR)] │  │
│  │  Last login: 2 hours ago               │  [🗑️ Delete Account]     │  │
│  │  Login method: Google OAuth            │                          │  │
│  │  2FA: ✅ Enabled                        │  ACCOUNT NOTES           │  │
│  │  IP: 103.42.xx.xx (Mumbai, IN)         │  [Add internal note...]  │  │
│  └────────────────────────────────────────┴──────────────────────────┘  │
│                                                                          │
│  STORES OWNED (2)                                                       │
│  ┌──────────────────┬──────────┬──────────┬───────────┬───────────────┐ │
│  │ Store            │ Type     │ Plan     │ Status    │ Actions       │ │
│  ├──────────────────┼──────────┼──────────┼───────────┼───────────────┤ │
│  │ Fashion Hub      │ Store    │ Business │ Published │ [View] [Imp.] │ │
│  │  ↳ fashionhub    │          │ ₹1,999/m │           │               │ │
│  │ Style Blog       │ Blog     │ Starter  │ Published │ [View] [Imp.] │ │
│  │  ↳ styleblog     │          │ ₹799/m   │           │               │ │
│  └──────────────────┴──────────┴──────────┴───────────┴───────────────┘ │
│                                                                          │
│  BILLING SUMMARY                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Total spent: ₹27,988  │  Active subscriptions: 2                 │ │
│  │  AI credits used: 3,450 │  AI credits remaining: 550              │ │
│  │  Payment method: Visa •••• 4242  │  Next billing: Feb 15, 2026   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ACTIVITY LOG (recent)                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Feb 14, 14:32 — Logged in (IP: 103.42.xx.xx, Chrome/Mac)        │ │
│  │  Feb 14, 14:35 — Created product "Summer Dress Collection"       │ │
│  │  Feb 14, 15:10 — Used AI: product description (5 credits)        │ │
│  │  Feb 13, 09:45 — Published blog post "Spring Fashion Trends"     │ │
│  │  Feb 12, 11:20 — Changed plan: Starter → Business                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.3 User Actions (Console vs Team)

| Action | Console | Team | Permission | Audit Severity |
|---|---|---|---|---|
| **View user profile** | ✅ | ✅ | `users.read` | info |
| **Search / filter users** | ✅ | ✅ | `users.read` | — |
| **View activity log** | ✅ | ✅ | `users.read` | info |
| **Send email to user** | ✅ | ✅ | `users.read` | info |
| **Reset password** | ✅ | ❌ | `users.write` | warning |
| **Change user role** | ✅ | ❌ | `users.write` | warning |
| **Suspend account** | ✅ | ❌ | `users.suspend` | critical |
| **Unsuspend account** | ✅ | ❌ | `users.suspend` | critical |
| **Delete account** | ✅ | ❌ | `users.delete` | critical |
| **Export data (GDPR)** | ✅ | ❌ | `gdpr.export` | warning |
| **Add internal note** | ✅ | ✅ | `users.read` | info |
| **View billing history** | ✅ | 🔍 | `billing.read` | info |

### 1.4 User Suspension Flow

```
Admin clicks "Suspend Account" on user Raj Patel
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  CONFIRMATION DIALOG                                          │
│                                                                │
│  ⚠️ Suspend User: Raj Patel (raj@temp.com)                   │
│                                                                │
│  This will:                                                    │
│  • Immediately log the user out of all sessions               │
│  • Disable login (password + OAuth)                           │
│  • Set all owned stores to "suspended" status                 │
│  • Display "Store Temporarily Unavailable" on storefronts    │
│  • Pause all active subscriptions (no billing)               │
│  • Disable AI credit usage                                    │
│                                                                │
│  Reason (required):                                            │
│  [Terms of Service violation ▾]                               │
│  Additional notes:                                             │
│  [Multiple reports of selling counterfeit goods____________] │
│                                                                │
│  Notify user via email: [✅ Yes]                              │
│                                                                │
│  [Cancel]                         [🚫 Confirm Suspension]     │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND EXECUTION                                            │
│  ├── UPDATE profiles SET status = 'suspended'                │
│  ├── UPDATE stores SET status = 'suspended' WHERE user_id    │
│  ├── DELETE FROM sessions WHERE user_id                      │
│  ├── Send suspension email via Resend                        │
│  ├── Purge storefront CDN cache for all user stores          │
│  ├── Log: USER_SUSPENDED (severity: critical)                │
│  └── Slack: #moderation-actions alert                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Store Lifecycle Management

### 2.1 Store State Machine

```
                              Admin Actions Available at Each State
                              ═════════════════════════════════════

  ┌───────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │  CREATING │───▶│   TRIAL     │───▶│  PUBLISHED  │───▶│  SUSPENDED  │
  │           │    │  (7 days)   │    │  (active)   │    │             │
  └───────────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
                          │                   │                   │
  Admin actions:    Admin actions:       Admin actions:      Admin actions:
  • View only       • Extend trial      • View details      • Unsuspend
  • Delete          • Force activate    • Impersonate       • Delete
                    • Suspend           • Suspend           • Transfer
                    • Delete            • Force plan change    ownership
                                        • Grant AI credits
                                        • Transfer ownership
                                        • Delete

                          │                   │                   │
                          ▼                   ▼                   ▼
                    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                    │   FROZEN    │    │   ARCHIVED  │    │   DELETED   │
                    │ (trial exp.)│    │  (inactive) │    │ (30-day     │
                    │             │    │             │    │  grace)     │
                    └─────────────┘    └─────────────┘    └─────────────┘

                    Admin actions:      Admin actions:      Admin actions:
                    • Reactivate        • Reactivate        • Undo (within
                    • Extend trial      • Delete              30 days)
                    • Delete            • Export data       • Purge now
                                                            • Export data
```

### 2.2 Store List View

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Stores                                       Total: 1,247 active stores│
│                                                                          │
│  [🔍 Search by name, subdomain, or owner...  ]  [Filter ▾]  [Export ▾] │
│                                                                          │
│  Filters: [Status ▾] [Type ▾] [Plan ▾] [Region ▾] [GMV Range ▾]      │
│                                                                          │
│  ┌────┬────────────────┬──────────┬────────┬──────────┬────────┬──────┐│
│  │    │ Store          │ Type     │ Plan   │ MRR      │ Status │ GMV  ││
│  ├────┼────────────────┼──────────┼────────┼──────────┼────────┼──────┤│
│  │ 🏪 │ Fashion Hub    │ 🛍️ Store │ Biz.   │ ₹1,999   │ 🟢 Pub │₹2.1L ││
│  │    │ fashionhub     │          │        │          │        │      ││
│  │ ✍️ │ John Portfolio │ 💼 Port. │ Start. │ ₹799     │ 🟢 Pub │ —    ││
│  │    │ john-doe       │          │        │          │        │      ││
│  │ 📝 │ TechDaily Blog │ 📝 Blog │ Start. │ ₹799     │ 🟡 Trial│ —    ││
│  │    │ techdaily      │          │        │          │        │      ││
│  │ 🏪 │ Quick Pharma   │ 🛍️ Store │ Free   │ ₹0       │ 🔴 Susp│ ₹0   ││
│  │    │ pharma-deals   │          │        │          │        │      ││
│  │ 📄 │ ACME Landing   │ 🚀 Land. │ Biz.   │ ₹1,999   │ 🟢 Pub │ —    ││
│  │    │ acmeco         │          │        │          │        │      ││
│  └────┴────────────────┴──────────┴────────┴──────────┴────────┴──────┘│
│                                                                          │
│  Summary: 🟢 892 published │ 🟡 280 trial │ 🔴 15 suspended │ ❄️ 60 frzn│
│  Showing 1-20 of 1,247  │  [← Prev] Page 1 of 63 [Next →]             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Store Detail View

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Stores / Fashion Hub                                                 │
│                                                                          │
│  ┌──────────────────────────────────┬────────────────────────────────┐  │
│  │  STORE INFO                      │  ADMIN ACTIONS                  │  │
│  │                                   │                                │  │
│  │  Name: Fashion Hub               │  [👁️ View Storefront]          │  │
│  │  Subdomain: fashionhub           │  [🎭 Impersonate Store]        │  │
│  │  Type: Store (e-commerce)        │  [📝 Edit Store Details]       │  │
│  │  Status: 🟢 Published            │  [💳 Manage Subscription]      │  │
│  │  Plan: Business (₹1,999/mo)      │  [🔄 Force Plan Change]       │  │
│  │  Owner: Priya Sharma             │  [🎁 Grant AI Credits]         │  │
│  │  Created: Jan 15, 2026           │  [⏰ Extend Trial]             │  │
│  │  Published: Jan 16, 2026         │  [🔀 Transfer Ownership]       │  │
│  │  Custom domain: fashionhub.com   │  [🚫 Suspend Store]            │  │
│  │  Domain SSL: ✅ Active            │  [🗑️ Delete Store]             │  │
│  └──────────────────────────────────┴────────────────────────────────┘  │
│                                                                          │
│  METRICS (Last 30 Days)                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Orders   │ │ Revenue  │ │ GMV      │ │ Visitors │ │ AI Usage │   │
│  │ 245      │ │ ₹2.1L    │ │ ₹2.1L    │ │ 8,450    │ │ 450 cred │   │
│  │ ↑12%     │ │ ↑18%     │ │ ↑18%     │ │ ↑8%      │ │ of 2,000 │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                                          │
│  STORE CONTENT                                                          │
│  ┌─────────────┬─────────┬─────────────────────────────────────────┐   │
│  │ Entity      │ Count   │ Status                                   │   │
│  ├─────────────┼─────────┼─────────────────────────────────────────┤   │
│  │ Products    │ 156     │ 148 active, 5 draft, 3 archived         │   │
│  │ Orders      │ 1,245   │ 12 pending, 8 processing, 1,225 done   │   │
│  │ Customers   │ 892     │ 340 returning, 552 new                  │   │
│  │ Pages       │ 8       │ About, Contact, FAQ, Shipping, etc.     │   │
│  │ Blog Posts  │ 24      │ 22 published, 2 drafts                  │   │
│  │ Reviews     │ 312     │ 298 approved, 12 pending, 2 flagged     │   │
│  │ Apps        │ 4       │ Smart Reviews, SEO Pro, Chat, Analytics │   │
│  │ Theme       │ Aurora  │ v1.2, customized, dark mode enabled     │   │
│  └─────────────┴─────────┴─────────────────────────────────────────┘   │
│                                                                          │
│  SUBSCRIPTION HISTORY                                                   │
│  ┌──────────┬─────────┬──────────┬──────────────────────────────────┐  │
│  │ Date     │ Action  │ Amount   │ Details                           │  │
│  ├──────────┼─────────┼──────────┼──────────────────────────────────┤  │
│  │ Feb 15   │ Renewal │ ₹1,999   │ Business plan — auto-charged     │  │
│  │ Jan 16   │ Upgrade │ ₹1,999   │ Starter → Business (prorated)    │  │
│  │ Jan 15   │ Start   │ ₹0       │ 7-day trial started              │  │
│  └──────────┴─────────┴──────────┴──────────────────────────────────┘  │
│                                                                          │
│  MODERATION HISTORY                                                     │
│  ┌──────────┬──────────────────────────────┬────────┬────────────────┐ │
│  │ Date     │ Item                          │ Action │ By             │ │
│  ├──────────┼──────────────────────────────┼────────┼────────────────┤ │
│  │ Feb 12   │ Product: "Herbal Supplement" │ Flagged│ AI Auto        │ │
│  │ Feb 12   │ Product: "Herbal Supplement" │ Apprvd │ Sarah L.       │ │
│  │ Jan 28   │ Review: 5-star suspicious    │ Hidden │ AI Auto        │ │
│  └──────────┴──────────────────────────────┴────────┴────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Store Actions Detail

| Action | Description | Flow | Permission | Audit |
|---|---|---|---|---|
| **View storefront** | Opens store's public URL in new tab | Direct link | `stores.read` | info |
| **Impersonate** | Login as store owner to see their admin panel | See §3 | `stores.impersonate` | critical |
| **Suspend store** | Disable store + show maintenance page | Confirmation + reason | `stores.suspend` | critical |
| **Unsuspend store** | Restore store to previous state | Confirmation | `stores.suspend` | critical |
| **Delete store** | Soft delete with 30-day grace period | Double confirmation + reason | `stores.delete` | critical |
| **Force plan change** | Override plan without payment | Plan selector + reason | `billing.override` | critical |
| **Grant AI credits** | Add bonus credits to store | Amount input + reason | `billing.override` | warning |
| **Extend trial** | Add days to trial period | Days input (max 30) | `billing.override` | warning |
| **Transfer ownership** | Change store owner to different user | Target user email + confirmation | `stores.write` | critical |
| **Edit store details** | Modify store name, subdomain, settings | Edit form | `stores.write` | warning |

---

## 3. Store Impersonation

### 3.1 Impersonation Architecture

Store impersonation allows super admins to view and interact with a merchant's admin dashboard **as if they were the store owner**, for debugging and support purposes.

```
Super Admin clicks "Impersonate" on Fashion Hub
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  SAFETY CHECKS                                                │
│  ├── Verify: user has 'stores.impersonate' permission        │
│  ├── Verify: 2FA was validated within last 15 minutes        │
│  ├── Verify: target store exists and is not deleted          │
│  └── Create impersonation session:                           │
│       {                                                       │
│         admin_id: "super-admin-uuid",                        │
│         store_id: "fashion-hub-uuid",                        │
│         store_owner_id: "priya-uuid",                        │
│         started_at: "2026-02-14T14:32:00Z",                 │
│         expires_at: "2026-02-14T15:32:00Z", // 1 hour max   │
│         session_token: "imp_xxxxxxxx"                        │
│       }                                                       │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  IMPERSONATION SESSION                                        │
│  ├── Open admin.letbuyy.store/fashionhub/dashboard           │
│  │   in a new window                                          │
│  ├── Special header injected: X-Impersonation-Token          │
│  ├── Admin panel shows RED banner at top:                    │
│  │   "⚠️ IMPERSONATING: Fashion Hub (Priya Sharma)           │
│  │    Session expires in 58 min  [End Impersonation]"        │
│  ├── All actions logged with impersonation context           │
│  ├── Write operations allowed but double-logged              │
│  └── No access to: payment methods, passwords, or           │
│       other stores owned by the same user                    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  AUDIT TRAIL                                                  │
│  ├── Log: STORE_IMPERSONATION_START (severity: critical)     │
│  ├── Every action during impersonation logged with:          │
│  │   metadata: { impersonating: true, admin_id: "..." }     │
│  ├── Log: STORE_IMPERSONATION_END (severity: info)           │
│  └── Store owner notified: "An admin accessed your store     │
│       for support purposes on Feb 14 at 2:32 PM"            │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Impersonation UI Banner

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⚠️ IMPERSONATING: Fashion Hub (Priya Sharma) │ ⏱ 58 min │ [End Session]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Normal admin dashboard content appears here,                          │
│   identical to what the store owner would see]                          │
│                                                                          │
│  The admin can:                                                          │
│  ✅ View all products, orders, customers, settings                      │
│  ✅ Make changes (logged as impersonation actions)                       │
│  ✅ Test storefront as logged-in owner                                   │
│                                                                          │
│  The admin CANNOT:                                                       │
│  ❌ View/change payment methods                                          │
│  ❌ View/change passwords or auth settings                               │
│  ❌ Access other stores owned by the same user                           │
│  ❌ Delete the store                                                      │
│  ❌ Transfer ownership                                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Impersonation Security Rules

| Rule | Implementation |
|---|---|
| **Max session duration** | 1 hour (auto-expires) |
| **Console-only** | Not available on mobile Flutter app |
| **2FA freshness** | Must have verified 2FA within last 15 minutes |
| **Permissions restricted** | No access to payment/password data |
| **Full audit trail** | Every click logged with impersonation context |
| **Owner notification** | Store owner receives email after session ends |
| **Concurrent limit** | Max 1 impersonation session per admin |
| **No nesting** | Cannot impersonate while already impersonating |

---

## 4. Billing & Subscription Oversight

### 4.1 Billing Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Revenue & Billing                              Period: [February 2026 ▾]│
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Revenue  │ │ Failed   │ │ Refunds  │ │ Net      │ │ Trial →  │    │
│  │ Collected│ │ Payments │ │ Issued   │ │ Revenue  │ │ Paid     │    │
│  │ ₹12.8L   │ │ ₹45K     │ │ ₹12K     │ │ ₹12.3L   │ │ 23%      │    │
│  │ ↑18% MoM│ │ 3.5%     │ │ 0.9%     │ │ ↑17%     │ │ ↑2pp     │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                                          │
│  PLAN DISTRIBUTION                                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Free      ██████████████████████████████████████████  620 (50%) │ │
│  │ Starter   ██████████████████████████  380 (30%)                 │ │
│  │ Business  █████████████  170 (14%)                               │ │
│  │ Enterprise ████  77 (6%)                                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  REVENUE BY STREAM                                                      │
│  ┌──────────────────────┬──────────┬──────────┬─────────────────────┐  │
│  │ Stream               │ Amount   │ % Total  │ Trend               │  │
│  ├──────────────────────┼──────────┼──────────┼─────────────────────┤  │
│  │ Subscriptions        │ ₹8.2L    │ 64%      │ ████████████ ↑15%  │  │
│  │ Transaction fees     │ ₹2.1L    │ 16%      │ ██████ ↑22%        │  │
│  │ AI credit top-ups    │ ₹1.2L    │ 9%       │ █████ ↑35%         │  │
│  │ App Store commission │ ₹0.8L    │ 6%       │ ███ ↑45%           │  │
│  │ Theme sales          │ ₹0.3L    │ 2%       │ █ ↑12%             │  │
│  │ Custom domains       │ ₹0.2L    │ 2%       │ █ ↑8%              │  │
│  │ Enterprise contracts │ ₹0.1L    │ 1%       │ ▎ NEW              │  │
│  └──────────────────────┴──────────┴──────────┴─────────────────────┘  │
│                                                                          │
│  RECENT TRANSACTIONS                                                    │
│  ┌──────────┬────────────────┬──────────┬──────────┬──────────────────┐│
│  │ Date     │ Store          │ Amount   │ Type     │ Status           ││
│  ├──────────┼────────────────┼──────────┼──────────┼──────────────────┤│
│  │ Feb 14   │ Fashion Hub    │ ₹1,999   │ Renewal  │ ✅ Paid          ││
│  │ Feb 14   │ Tech Reviews   │ ₹799     │ Renewal  │ ✅ Paid          ││
│  │ Feb 13   │ Art Studio     │ ₹799     │ Renewal  │ ❌ Failed        ││
│  │ Feb 13   │ Quick Store    │ ₹1,999   │ Renewal  │ 🔄 Retry (2/3)  ││
│  │ Feb 12   │ Lisa's Port.   │ ₹99      │ AI Pack  │ ✅ Paid          ││
│  └──────────┴────────────────┴──────────┴──────────┴──────────────────┘│
│                                                                          │
│  [📊 Full Analytics]  [📥 Export Transactions]  [💳 Razorpay Dashboard] │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Billing Operations

| Operation | Description | Permission | Audit Severity |
|---|---|---|---|
| **View all transactions** | Full payment history with search/filter | `billing.read` | info |
| **View Razorpay details** | Deep link to Razorpay payment ID | `billing.read` | info |
| **Force plan upgrade** | Override plan without payment | `billing.override` | critical |
| **Grant free plan** | Assign paid features for free | `billing.override` | critical |
| **Extend trial** | Add days to trial (max 30 additional days) | `billing.override` | warning |
| **Process refund** | Issue partial/full refund via Razorpay | `billing.refund` | critical |
| **Retry payment** | Re-attempt failed payment | `billing.override` | warning |
| **Cancel subscription** | Cancel store's subscription | `billing.override` | critical |
| **Generate invoice** | Create/resend invoice PDF | `billing.read` | info |
| **Grant AI credits** | Add bonus AI credits (max 10,000 per grant) | `billing.override` | warning |
| **Export transactions** | CSV export of filtered transactions | `billing.read` | info |

### 4.3 Failed Payment Recovery Flow

```
Payment fails (Razorpay webhook: payment.failed)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  AUTO-RETRY SEQUENCE                                          │
│  ├── Retry 1: After 24 hours (auto)                          │
│  ├── Retry 2: After 72 hours (auto)                          │
│  ├── Retry 3: After 7 days (manual or auto)                  │
│  │                                                            │
│  │  Notification at each retry:                              │
│  │  └── Email to store owner: "Payment failed, please        │
│  │      update your payment method"                          │
└──────────────────────────────────────────────────────────────┘
         │ All retries failed
         ▼
┌──────────────────────────────────────────────────────────────┐
│  GRACE PERIOD (7 days)                                        │
│  ├── Store remains active during grace period                │
│  ├── Banner shown in admin: "Payment overdue"                │
│  ├── Email every 2 days reminding owner                      │
│  └── Console shows store in "payment_overdue" filter         │
└──────────────────────────────────────────────────────────────┘
         │ Grace period expires
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STORE FROZEN                                                 │
│  ├── Store downgraded to free plan features                  │
│  ├── Storefront shows "Coming Soon" page                     │
│  ├── Admin dashboard shows "Upgrade to reactivate"           │
│  ├── Data preserved (not deleted)                            │
│  └── Console alert: store frozen due to non-payment          │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Plan Management

### 5.1 Plan Configuration (Admin-Managed)

| Plan | Price (INR/mo) | Transaction Fee | AI Credits/mo | Products | Storage | Custom Domain |
|---|---|---|---|---|---|---|
| **Free** | ₹0 | — | 50 | 25 | 500 MB | ❌ |
| **Starter** | ₹799 | 1.0% | 500 | 1,000 | 5 GB | ✅ |
| **Business** | ₹1,999 | 0.5% | 2,000 | Unlimited | 25 GB | ✅ |
| **Enterprise** | Custom | Negotiable | Custom | Unlimited | Unlimited | ✅ |
| **Publisher** (Blog) | ₹499 | — | 300 | — | 10 GB | ✅ |
| **Agency** (Blog) | ₹999 | — | 1,000 | — | 50 GB | ✅ |

### 5.2 Plan Override Dialog

```
┌──────────────────────────────────────────────────────────────┐
│  Force Plan Change — Fashion Hub                              │
│                                                                │
│  Current plan: Business (₹1,999/mo)                          │
│  Current billing cycle: Feb 1 – Feb 28, 2026                 │
│                                                                │
│  New plan: [Enterprise ▾]                                     │
│                                                                │
│  Pricing:                                                      │
│  ○ Override price: [₹ _______] / month                       │
│  ○ Free (no charge)                                           │
│  ● Keep default plan price                                    │
│                                                                │
│  Effective:                                                    │
│  ● Immediately (prorate current cycle)                        │
│  ○ Next billing cycle                                         │
│                                                                │
│  Reason (required):                                            │
│  [Strategic partnership — early adopter reward_______________]│
│                                                                │
│  ⚠️ This will be logged as STORE_PLAN_OVERRIDDEN              │
│  (severity: critical) in the audit log.                       │
│                                                                │
│  [Cancel]                         [✅ Apply Plan Change]       │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Refund & Dispute Handling

### 6.1 Refund Processing Flow

```
Admin navigates to Billing → selects transaction → clicks "Refund"
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  REFUND DIALOG                                                │
│                                                                │
│  Transaction: TXN-2026-0214-1234                             │
│  Store: Fashion Hub                                           │
│  Amount: ₹1,999                                              │
│  Type: Business plan renewal                                  │
│  Paid: Feb 14, 2026                                           │
│  Payment method: Visa •••• 4242                              │
│                                                                │
│  Refund amount:                                                │
│  ● Full refund (₹1,999)                                      │
│  ○ Partial refund: [₹ _______]                               │
│                                                                │
│  Refund action:                                                │
│  ● Refund + downgrade to Free plan                           │
│  ○ Refund + keep current plan (goodwill)                     │
│  ○ Refund + cancel subscription                              │
│                                                                │
│  Notify store owner: [✅ Yes]                                 │
│  Internal notes: [Customer reported billing error. Confirmed │
│  they should be on Starter plan, not Business._____________] │
│                                                                │
│  [Cancel]                         [💰 Process Refund]         │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND EXECUTION                                            │
│  ├── Call Razorpay API: refund payment_id with amount        │
│  ├── UPDATE subscription if plan change needed               │
│  ├── Send refund confirmation email to store owner           │
│  ├── Log: REFUND_ISSUED (severity: critical)                 │
│  │   metadata: { amount, reason, transaction_id }            │
│  └── Slack: #billing-alerts "Refund ₹1,999 for Fashion Hub" │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Refund Rules

| Rule | Value |
|---|---|
| **Refund window** | 30 days from payment date |
| **Max partial refund** | Cannot exceed original payment |
| **Processing time** | 5-7 business days (Razorpay) |
| **Daily refund limit** | ₹50,000 per admin (configurable) |
| **Approval required** | Super Admin or Platform Owner only |
| **Audit logging** | Always logged as critical severity |

---

## 7. GDPR & Data Operations

### 7.1 Data Export Flow

```
Admin clicks "Export Data (GDPR)" on user profile
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  GDPR DATA EXPORT                                             │
│                                                                │
│  User: Priya Sharma (priya@gmail.com)                        │
│                                                                │
│  Data to export:                                               │
│  ✅ User profile (name, email, phone, preferences)           │
│  ✅ Store data (2 stores: products, pages, settings)         │
│  ✅ Order history (1,245 orders across all stores)           │
│  ✅ Customer data (892 customers)                             │
│  ✅ AI usage logs (3,450 credit transactions)                │
│  ✅ Login history (last 1 year)                               │
│  ✅ Support tickets (18 tickets)                              │
│  □  Analytics events (anonymized by default)                 │
│                                                                │
│  Format: JSON (structured, machine-readable)                  │
│  Estimated size: ~45 MB                                       │
│  Download expires: 7 days after generation                    │
│                                                                │
│  [Cancel]                         [📦 Generate Export]        │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  PROCESSING                                                    │
│  ├── Query all user data from 8+ tables                      │
│  ├── Bundle as JSON file with metadata                       │
│  ├── Upload to R2 with 7-day expiry: exports/gdpr-{id}.json │
│  ├── Log: USER_DATA_EXPORTED (severity: warning)             │
│  └── Generate download link → shown in console               │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Account Deletion Flow

```
Admin clicks "Delete Account" on user profile
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ ACCOUNT DELETION — DESTRUCTIVE ACTION                    │
│                                                                │
│  User: Raj Patel (raj@temp.com)                              │
│  Stores: 0 (no stores)                                        │
│                                                                │
│  This will:                                                    │
│  • Start a 30-day grace period                               │
│  • Immediately disable login                                  │
│  • Send deletion confirmation email                          │
│  • After 30 days: permanently purge all data                 │
│                                                                │
│  During grace period:                                          │
│  • User can contact support to cancel deletion               │
│  • Data remains intact but inaccessible                      │
│  • No new signups with same email                            │
│                                                                │
│  Reason (required): [Spam account — no legitimate activity__]│
│                                                                │
│  Type "DELETE" to confirm: [__________]                       │
│                                                                │
│  [Cancel]                         [🗑️ Initiate Deletion]      │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Data Retention Summary

| Data Type | Active Retention | After Deletion | Archive Location |
|---|---|---|---|
| User profiles | Indefinite | 30-day grace → purge | — |
| Store data | Indefinite | 30-day grace → purge | — |
| Orders | 3 years (tax) | 30-day grace → archive | R2 cold storage |
| Products | While store active | 30-day grace → purge | — |
| Analytics events | 2 years | Anonymized immediately | — |
| Audit logs (info) | 90 days | Retained as-is | R2 archive |
| Audit logs (critical) | 5 years | Retained as-is | R2 archive |
| Support tickets | 2 years | Anonymized immediately | — |
| AI usage logs | 1 year | Purge | — |
| Sessions | 30 days | Purge immediately | — |
| Login history | 1 year | Anonymized immediately | — |

---

## 8. Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Feb 16, 2026 | Initial version — 7 sections covering user management (list/detail views, 12 user actions, suspension flow), store lifecycle (6-state machine, list/detail views, 10 store actions), store impersonation (architecture, security rules, UI banner), billing dashboard (7 revenue streams, 11 billing operations, failed payment recovery), plan management (6 tiers, override dialog), refund handling (processing flow, 6 rules), GDPR compliance (data export, account deletion, 11-row retention table) |

---

> **Next:** [Part 3 — E-commerce Oversight, Products & Orders](./03_Ecommerce_Oversight.md)

---

*[← Back to Index](./README.md)*
