# LetBuyy Platform — Shopify-Inspired Comprehensive Analysis

> **Part 1 of 8** | Architecture, Trial System, URL Routing & Payment Requirements
>
> **Date:** February 13, 2026 | **Version:** 4.0 (Shopify-Inspired Rebuild)
>
> **Next:** Part 2 (Onboarding Flow & Site Type Selection)

---

## Table of Contents — Complete Analysis Series

| Part | File | Content |
|------|------|---------|
| **1** (this) | Architecture & Trial System | Core Architecture, Trial Mechanics, URL Routing, Payment Requirements |
| 2 | Onboarding Flow | Contextual Questions, Site Type Selection, Dynamic Onboarding |
| 3 | Store Management UI | Store Switcher, Dashboard Variants, Badge System |
| 4 | Trial & Payment System | Autopay Setup, Grace Periods, Deactivation Logic |
| 5 | Database Schema | Trial Tables, Payment Tables, Store States |
| 6 | Admin Dashboard | Site-Type Specific Dashboards, Quick Actions |
| 7 | Deployment & Testing | Migration Strategy, Testing Matrix |
| 8 | Implementation Roadmap | Phase-by-Phase Plan, Timeline, Dependencies |

---

## 1. Executive Summary — Shopify-Inspired Transformation

### 1.1 Current State vs Target State

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                     CURRENT → TARGET TRANSFORMATION                           │
├──────────────────────────────────┬────────────────────────────────────────────┤
│ ❌ CURRENT                        │ ✅ TARGET (Shopify-Inspired)               │
├──────────────────────────────────┼────────────────────────────────────────────┤
│ Direct store creation            │ Contextual onboarding questions            │
│ No trial period                  │ 14-day free trial for all users            │
│ Immediate payment required       │ Optional autopay during onboarding         │
│ Generic onboarding               │ Site-type specific questions               │
│ Simple subdomain routing         │ Clean Shopify-style URL routing            │
│ No store deactivation            │ Auto-deactivate after trial if no payment  │
│ Single dashboard                 │ Site-type specific dashboards              │
│ No store switcher                │ Multi-store switcher with badges           │
│ No trial indicators              │ Trial countdown, upgrade prompts           │
├──────────────────────────────────┼────────────────────────────────────────────┤
│ URL: admin.letbuyy.store/mystore │ URL: admin.shopify.com/store/mystore       │
│                                  │      admin.letbuyy.store/store/mystore     │
└──────────────────────────────────┴────────────────────────────────────────────┘
```

### 1.2 Key Shopify Patterns to Replicate

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     SHOPIFY PATTERNS → LETBUYY ADAPTATION                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ONBOARDING QUESTIONS                                                     │
│     Shopify: "Where would you like to sell?"                                 │
│     LetBuyy:  "What type of site do you want to build?"                      │
│               → E-commerce, Portfolio, Resume, Landing, Blogger              │
│                                                                              │
│  2. CONTEXTUAL ONBOARDING                                                    │
│     Shopify: Different questions based on business type                      │
│     LetBuyy:  Different questions based on site type                         │
│               → E-commerce: "What do you plan to sell?"                      │
│               → Portfolio: "What's your profession?"                         │
│               → Blogger: "What topics will you write about?"                 │
│                                                                              │
│  3. TRIAL SYSTEM                                                             │
│     Shopify: 3-day free trial → $20/mo for 3 months                          │
│     LetBuyy:  14-day free trial → ₹499/mo (configurable)                    │
│                                                                              │
│  4. PAYMENT REQUIREMENT                                                      │
│     Shopify: Can skip payment, but limited features                          │
│     LetBuyy:  Can skip autopay, but stores deactivate after 14 days         │
│                                                                              │
│  5. URL ROUTING                                                              │
│     Shopify: admin.shopify.com/store/{store-id}                              │
│     LetBuyy:  admin.letbuyy.store/store/{subdomain}                         │
│                                                                              │
│  6. STORE SWITCHER                                                           │
│     Shopify: Dropdown with store avatars + names                             │
│     LetBuyy:  Dropdown with site-type badges + store names                  │
│                                                                              │
│  7. TRIAL AWARENESS                                                          │
│     Shopify: Persistent banner "X days left in trial"                        │
│     LetBuyy:  Same + countdown in dashboard cards                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architecture — URL Routing Strategy

### 2.1 URL Structure Comparison

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        URL ROUTING ARCHITECTURE                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SHOPIFY PATTERN (Reference):                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ admin.shopify.com/signup                        → Sign up page         │  │
│  │ admin.shopify.com/store/spbzuy-fi               → Store admin (id)     │  │
│  │ admin.shopify.com/store/spbzuy-fi/products      → Products page        │  │
│  │ admin.shopify.com/                              → Store list           │  │
│  │ accounts.shopify.com/store-login                → Account login        │  │
│  │ spbzuy-fi.myshopify.com                         → Storefront           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  LETBUYY PATTERN (New):                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ accounts.letbuyy.store/signup                   → Sign up page         │  │
│  │ accounts.letbuyy.store/login                    → Login page           │  │
│  │ accounts.letbuyy.store/onboarding               → Onboarding flow      │  │
│  │                                                                        │  │
│  │ admin.letbuyy.store/                            → Store switcher       │  │
│  │ admin.letbuyy.store/store/{subdomain}           → Store admin          │  │
│  │ admin.letbuyy.store/store/{subdomain}/products  → Products page        │  │
│  │ admin.letbuyy.store/store/{subdomain}/posts     → Blog posts (blogger) │  │
│  │ admin.letbuyy.store/store/{subdomain}/settings  → Settings             │  │
│  │                                                                        │  │
│  │ {subdomain}.letbuyy.store                       → Storefront (live)    │  │
│  │ {subdomain}.letbuyy.store (draft)               → "Launching Soon"     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ROUTING LOGIC:                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. User visits admin.letbuyy.store/                                    │  │
│  │    ├─ Has 0 stores? → Redirect: accounts.letbuyy.store/onboarding     │  │
│  │    ├─ Has 1 store?  → Redirect: admin.letbuyy.store/store/{subdomain} │  │
│  │    └─ Has 2+ stores? → Show store switcher page                       │  │
│  │                                                                        │  │
│  │ 2. User visits admin.letbuyy.store/store/mystore                       │  │
│  │    ├─ Owns "mystore"? → Show dashboard                                │  │
│  │    ├─ Doesn't own?    → 404 error                                     │  │
│  │    └─ No auth?        → Redirect: accounts.letbuyy.store/login        │  │
│  │                                                                        │  │
│  │ 3. User visits mystore.letbuyy.store                                   │  │
│  │    ├─ Store published? → Show live storefront                         │  │
│  │    ├─ Store draft?     → Show "Launching Soon" page                   │  │
│  │    └─ Store inactive?  → Show "Store Suspended" page                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Routing Implementation (Next.js)

```typescript
// apps/web/admin/app/layout.tsx
import { redirect } from 'next/navigation'
import { getStoreCount } from '@/lib/stores'

export default async function AdminLayout({ children }) {
  const storeCount = await getStoreCount()
  const currentPath = headers().get('x-pathname')
  
  // Root access logic
  if (currentPath === '/') {
    if (storeCount === 0) {
      redirect('https://accounts.letbuyy.store/onboarding')
    } else if (storeCount === 1) {
      const store = await getFirstStore()
      redirect(`/store/${store.subdomain}`)
    }
    // Otherwise, show store switcher (children renders)
  }
  
  return children
}

// apps/web/admin/app/store/[subdomain]/layout.tsx
export default async function StoreLayout({ 
  params,
  children 
}: { 
  params: { subdomain: string }
  children: React.ReactNode 
}) {
  const { subdomain } = params
  const store = await getStoreBySubdomain(subdomain)
  
  if (!store) {
    notFound() // 404
  }
  
  if (store.user_id !== auth.uid()) {
    notFound() // Not the owner
  }
  
  // Inject store context
  return (
    <StoreProvider store={store}>
      {children}
    </StoreProvider>
  )
}
```

---

## 3. Trial System Architecture

### 3.1 Trial Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        TRIAL LIFECYCLE — 14 DAYS                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DAY 0: STORE CREATION                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • User completes onboarding                                            │  │
│  │ • Store created with status: 'trial'                                   │  │
│  │ • trial_starts_at: NOW()                                               │  │
│  │ • trial_ends_at: NOW() + INTERVAL '14 days'                            │  │
│  │ • autopay_enabled: false (unless setup during onboarding)              │  │
│  │ • all_features_enabled: true                                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  DAY 1-13: ACTIVE TRIAL                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Full platform access                                                 │  │
│  │ • Persistent banner: "X days left in trial"                            │  │
│  │ • CTA buttons: "Select a plan" / "Setup payment"                       │  │
│  │ • Email reminders at: Day 7, Day 11, Day 13                            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  DAY 14 00:00 UTC: TRIAL EXPIRY                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ IF autopay_enabled = true:                                             │  │
│  │   ├─ Charge payment method                                             │  │
│  │   ├─ If success: status → 'active', subscription_starts_at = NOW()    │  │
│  │   └─ If failure: status → 'payment_failed', show retry UI             │  │
│  │                                                                        │  │
│  │ IF autopay_enabled = false:                                            │  │
│  │   ├─ status → 'inactive'                                               │  │
│  │   ├─ Store becomes inaccessible in admin                               │  │
│  │   ├─ Storefront shows "Store Suspended" page                           │  │
│  │   └─ Email: "Your trial has ended, setup payment to reactivate"       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  REACTIVATION (anytime after deactivation):                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • User visits admin → Blocked with "Setup Payment" modal               │  │
│  │ • After payment setup → status: 'active'                               │  │
│  │ • All data preserved (no deletion)                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Store Status State Machine

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        STORE STATUS STATE MACHINE                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                                                                              │
│                      ┌──────────────────┐                                    │
│                      │   trial          │  ← Initial state on creation       │
│                      │  (14 days left)  │                                    │
│                      └────────┬─────────┘                                    │
│                               │                                              │
│              ┌────────────────┴────────────────┐                             │
│              │                                 │                             │
│    Trial Expires                     Trial Expires                           │
│    + autopay ✅                      + NO autopay ❌                         │
│              │                                 │                             │
│              ▼                                 ▼                             │
│    ┌──────────────────┐              ┌──────────────────┐                   │
│    │  Payment Attempt │              │    inactive      │                   │
│    └────────┬─────────┘              │  (suspended)     │                   │
│             │                         └────────┬─────────┘                   │
│   ┌─────────┴─────────┐                       │                             │
│   │                   │                       │ User adds                   │
│ Success            Failure                    │ payment                     │
│   │                   │                       │                             │
│   ▼                   ▼                       ▼                             │
│ ┌──────────┐  ┌───────────────┐    ┌──────────────────┐                    │
│ │ active   │  │payment_failed │    │  active          │                    │
│ │(ongoing) │  │(retry prompt) │    │ (reactivated)    │                    │
│ └────┬─────┘  └───────┬───────┘    └────────┬─────────┘                    │
│      │                │                      │                              │
│      │                │ Retry Success        │                              │
│      │                └──────────────────────┘                              │
│      │                                       │                              │
│      │  User cancels subscription            │ Subscription                 │
│      │  or payment fails repeatedly          │ continues                    │
│      │                                       │                              │
│      ▼                                       ▼                              │
│ ┌──────────────────┐                ┌──────────────────┐                    │
│ │   inactive       │                │   active         │                    │
│ │ (cancelled)      │◄───────────────│  (renewed)       │                    │
│ └──────────────────┘  Non-payment   └──────────────────┘                    │
│                                                                              │
│                                                                              │
│  STATUS ENUM:                                                                │
│  • 'trial'          → 14-day trial active                                    │
│  • 'active'         → Paid subscription active                               │
│  • 'inactive'       → Trial expired without payment / Cancelled              │
│  • 'payment_failed' → Autopay attempted but failed                           │
│  • 'suspended'      → Admin action (abuse, TOS violation)                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Payment & Autopay System

### 4.1 Payment Flow During Onboarding

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                  ONBOARDING PAYMENT FLOW (SHOPIFY-STYLE)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Site Type Selection                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ "What type of site do you want to build?"                             │  │
│  │ [E-commerce] [Portfolio] [Resume] [Landing] [Blogger]                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                        ↓                                                     │
│                                                                              │
│  STEP 2: Contextual Questions (based on site type)                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ E-commerce: "What do you plan to sell?"                                │  │
│  │ Portfolio:  "What's your profession?"                                  │  │
│  │ Blogger:    "What topics will you write about?"                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                        ↓                                                     │
│                                                                              │
│  STEP 3: Store Name                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ "What should we call your store?"                                      │  │
│  │ [mystore        ] .letbuyy.store                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                        ↓                                                     │
│                                                                              │
│  STEP 4: Trial & Payment Info ⚠️ CRITICAL STEP                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  ╔════════════════════════════════════════════════════════════════╗   │  │
│  │  ║                                                                ║   │  │
│  │  ║             Start for free. Stay for ₹499.                    ║   │  │
│  │  ║                                                                ║   │  │
│  │  ║  ✓ Today – Free, 14-day trial                                 ║   │  │
│  │  ║    Explore all features immediately                           ║   │  │
│  │  ║                                                                ║   │  │
│  │  ║  ○ Next – ₹499/month after 14 days                            ║   │  │
│  │  ║    (Only if autopay is setup)                                 ║   │  │
│  │  ║                                                                ║   │  │
│  │  ║  ○ Always – No commitment, cancel anytime                     ║   │  │
│  │  ║                                                                ║   │  │
│  │  ╚════════════════════════════════════════════════════════════════╝   │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    PAYMENT METHOD                                │ │  │
│  │  │  [💳 UPI] [Credit Card] [Debit Card]                            │ │  │
│  │  │                                                                  │ │  │
│  │  │  Enter UPI ID: [username@paytm                              ]  │ │  │
│  │  │  Phone: [+91 98765 43210                                    ]  │ │  │
│  │  │                                                                  │ │  │
│  │  │  ℹ️ You won't be charged now. Payment starts after 14 days.   │ │  │
│  │  │                                                                  │ │  │
│  │  │  [Setup Autopay →]                           [Skip →]         │ │  │
│  │  │   (recommended)                              (deactivates)     │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  OUTCOME A: User clicks "Setup Autopay"                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Razorpay/Stripe creates customer + payment method                  │  │
│  │ 2. No charge yet (₹0 authorization only)                               │  │
│  │ 3. Store created with autopay_enabled = true                           │  │
│  │ 4. Redirect to admin dashboard                                         │  │
│  │ 5. Dashboard shows: "Trial active: 14 days left"                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  OUTCOME B: User clicks "Skip"                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Store created with autopay_enabled = false                          │  │
│  │ 2. Redirect to admin dashboard                                         │  │
│  │ 3. Dashboard shows: "Trial active: 14 days left"                       │  │
│  │ 4. Persistent banner: "⚠️ Setup payment to avoid deactivation"         │  │
│  │ 5. After 14 days → Store deactivates automatically                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Trial Countdown UI

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     TRIAL COUNTDOWN UI COMPONENTS                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  A. PERSISTENT TOP BANNER (Always Visible in Admin)                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ⏰ 12 days left in your trial    [Setup Payment]    [View Plans]  [✕] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  B. DASHBOARD CARD (Prominent Placement)                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │                                                                  │  │  │
│  │  │  🎉 Your trial expires in 12 days                                │  │  │
│  │  │                                                                  │  │  │
│  │  │  Trial ends on February 27, 2026                                 │  │  │
│  │  │                                                                  │  │  │
│  │  │  ⚠️ No payment method setup                                      │  │  │
│  │  │  Your store will be deactivated when trial ends.                │  │  │
│  │  │                                                                  │  │  │
│  │  │  ┌────────────────────┐  ┌────────────────────┐                 │  │  │
│  │  │  │  Setup Autopay →   │  │  View Plans →      │                 │  │  │
│  │  │  │   (Start ₹499/mo)  │  │                    │                 │  │  │
│  │  │  └────────────────────┘  └────────────────────┘                 │  │  │
│  │  │                                                                  │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  C. DAILY EMAIL REMINDERS                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Day 7:  "One week left in your trial!"                                 │  │
│  │ Day 11: "Only 3 days left – Setup payment now"                          │  │
│  │ Day 13: "⚠️ Last chance! Trial ends tomorrow"                           │  │
│  │ Day 14: "Your trial has ended" (if no autopay)                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  D. BOTTOM-RIGHT FLOATING BUTTON (Days 10-14)                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                                                  ┌──────────────────┐  │  │
│  │                                                  │  ⏰ 4 days left  │  │  │
│  │                                                  │  [Setup Payment] │  │  │
│  │                                                  └──────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Store Deactivation Logic

### 5.1 Deactivation Process

```typescript
// apps/jobs/deactivate-expired-trials.ts
// Runs daily via Vercel Cron at 00:00 UTC

export async function deactivateExpiredTrials() {
  const { data: expiredStores } = await supabase
    .from('stores')
    .select('*')
    .eq('status', 'trial')
    .lte('trial_ends_at', new Date().toISOString())
  
  for (const store of expiredStores) {
    if (store.autopay_enabled) {
      // Attempt payment
      const paymentResult = await chargePaymentMethod(
        store.payment_method_id,
        store.subscription_amount
      )
      
      if (paymentResult.success) {
        await supabase
          .from('stores')
          .update({
            status: 'active',
            subscription_starts_at: new Date().toISOString(),
            last_payment_at: new Date().toISOString()
          })
          .eq('id', store.id)
        
        await sendEmail({
          to: store.owner_email,
          template: 'trial-converted-success',
          data: { store }
        })
      } else {
        await supabase
          .from('stores')
          .update({ status: 'payment_failed' })
          .eq('id', store.id)
        
        await sendEmail({
          to: store.owner_email,
          template: 'payment-failed-retry',
          data: { store, error: paymentResult.error }
        })
      }
    } else {
      // No autopay → Deactivate
      await supabase
        .from('stores')
        .update({
          status: 'inactive',
          deactivated_at: new Date().toISOString(),
          deactivation_reason: 'trial_expired_no_payment'
        })
        .eq('id', store.id)
      
      await sendEmail({
        to: store.owner_email,
        template: 'store-deactivated-trial-expired',
        data: { store }
      })
    }
  }
}
```

### 5.2 Deactivated Store Experience

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    DEACTIVATED STORE USER EXPERIENCE                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  A. ADMIN DASHBOARD ACCESS (Blocked)                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  User visits: admin.letbuyy.store/store/mystore                        │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │                                                                  │  │  │
│  │  │  ⚠️ Store Deactivated                                            │  │  │
│  │  │                                                                  │  │  │
│  │  │  Your trial period ended on February 27, 2026.                  │  │  │
│  │  │  No payment method was setup.                                    │  │  │
│  │  │                                                                  │  │  │
│  │  │  ✅ Your data is safe and preserved.                            │  │  │
│  │  │  ✅ Reactivate anytime by setting up payment.                   │  │  │
│  │  │                                                                  │  │  │
│  │  │  ┌────────────────────────────────────────┐                     │  │  │
│  │  │  │  Setup Payment & Reactivate Store  →   │                     │  │  │
│  │  │  │         (Start at ₹499/month)          │                     │  │  │
│  │  │  └────────────────────────────────────────┘                     │  │  │
│  │  │                                                                  │  │  │
│  │  │  [View Pricing] [Contact Support]                               │  │  │
│  │  │                                                                  │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  B. STOREFRONT ACCESS (Suspended Page)                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  User/visitor visits: mystore.letbuyy.store                            │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │                                                                  │  │  │
│  │  │             ┌────────┐                                           │  │  │
│  │  │             │LetBuyy │                                           │  │  │
│  │  │             └────────┘                                           │  │  │
│  │  │                                                                  │  │  │
│  │  │                                                                  │  │  │
│  │  │          🔒 Store Temporarily Unavailable                        │  │  │
│  │  │                                                                  │  │  │
│  │  │     This store is currently inactive due to                     │  │  │
│  │  │     subscription status.                                         │  │  │
│  │  │                                                                  │  │  │
│  │  │     Store Owner: Please login to reactivate.                    │  │  │
│  │  │                                                                  │  │  │
│  │  │     ─────────────────────────────────────────                   │  │  │
│  │  │                                                                  │  │  │
│  │  │     Create your own store → letbuyy.store                       │  │  │
│  │  │                                                                  │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  C. STORE SWITCHER (Grayed Out)                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  admin.letbuyy.store/ (Store list view)                                │  │
│  │                                                                        │  │
│  │  Active Stores (2)                                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │ 🟢 myshop     E-commerce     Trial: 10 days left    [Open →]    │  │  │
│  │  │ 🟢 myblog     Blogger        Active (₹499/mo)       [Open →]    │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  Inactive Stores (1)                                                   │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │ ⚪ mystore    E-commerce     Deactivated       [Reactivate]     │  │  │
│  │  │    ⚠️ Trial expired Feb 27, 2026                                 │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Database Schema Updates

### 6.1 Stores Table (Extended)

```sql
-- MODIFY existing stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS status VARCHAR(20) 
  DEFAULT 'trial' 
  CHECK (status IN ('trial', 'active', 'inactive', 'payment_failed', 'suspended'));

ALTER TABLE stores ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_amount DECIMAL(10,2) DEFAULT 499.00;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_customer_id VARCHAR(255);

-- Update trigger to set trial dates on insert
CREATE OR REPLACE FUNCTION set_trial_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trial_starts_at IS NULL THEN
    NEW.trial_starts_at := NOW();
  END IF;
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_trial_dates
  BEFORE INSERT ON stores
  FOR EACH ROW EXECUTE FUNCTION set_trial_dates();

-- Index for daily cron job
CREATE INDEX idx_stores_trial_expiry 
  ON stores(status, trial_ends_at) 
  WHERE status = 'trial';
```

### 6.2 Payment Methods Table

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Payment Gateway
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('razorpay', 'stripe')),
  provider_customer_id VARCHAR(255) NOT NULL,
  provider_payment_method_id VARCHAR(255) NOT NULL,
  
  -- Method Details
  method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('upi', 'card', 'netbanking')),
  last_4_digits VARCHAR(4),
  card_brand VARCHAR(20),
  upi_id VARCHAR(100),
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_provider_method UNIQUE (provider, provider_payment_method_id)
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_store ON payment_methods(store_id);
```

### 6.3 Payment Transactions Table

```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES payment_methods(id),
  
  -- Transaction Details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  type VARCHAR(20) NOT NULL CHECK (type IN ('subscription', 'trial_conversion', 'addon', 'refund')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  
  -- Provider
  provider VARCHAR(20) NOT NULL,
  provider_transaction_id VARCHAR(255),
  provider_order_id VARCHAR(255),
  
  -- Failure Handling
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_provider_transaction UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX idx_payment_transactions_store ON payment_transactions(store_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_created ON payment_transactions(created_at DESC);
```

---

> **→ Continues in Part 2:** Onboarding Flow — Contextual Questions, Site Type Paths, Dynamic UI

---

## Document Navigation

| Part | Content |
|------|---------|
| **Part 1** (this) | Architecture & Trial System, URL Routing, Payment Requirements |
| Part 2 | Onboarding Flow — Site Type Questions & Paths |
| Part 3 | Store Management UI — Switcher, Badges, Multi-Store |
| Part 4 | Trial & Payment UI — Modals, Countdown, Reactivation |
| Part 5 | Complete Database Schema — All Tables |
| Part 6 | Admin Dashboard Variants — Per Site Type |
| Part 7 | Deployment & Migration — Step-by-Step |
| Part 8 | Implementation Roadmap — Timeline & Phases |