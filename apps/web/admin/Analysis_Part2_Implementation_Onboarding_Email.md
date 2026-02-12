# LetBuyy Multi-Tenant Store Platform — Comprehensive Analysis

> **Part 2 of 3** | Implementation Flow, Onboarding UI Wireframes & Email System
>
> **Date:** February 12, 2026 | **Prev:** Part 1 (Architecture) | **Next:** Part 3 (Admin, Storefront, Deploy)

---

## 7. CSS Design System Analysis

### 7.1 Theme Variable Map

```
┌───────────────────────────────────────────────────────────────────────┐
│                    AUTH DESIGN SYSTEM VARIABLES                       │
├─────────────────────┬──────────────────┬─────────────────────────────┤
│ Variable            │ Light Mode       │ Dark Mode                   │
├─────────────────────┼──────────────────┼─────────────────────────────┤
│ --bg                │ #FFFFFF          │ #0A0F1A                     │
│ --bg-secondary      │ #F8FAFC          │ #0F172A                     │
│ --text-primary      │ #0F172A          │ #FFFFFF                     │
│ --text-secondary    │ #64748B          │ #94A3B8                     │
│ --text-hint         │ #94A3B8          │ #64748B                     │
│ --primary           │ #8B5CF6          │ #8B5CF6 (same)              │
│ --primary-light     │ #A78BFA          │ #A78BFA (same)              │
│ --border            │ #E2E8F0          │ #1E293B                     │
│ --input-bg          │ #FFFFFF          │ #0F172A                     │
│ --error-bg          │ #FEF2F2          │ #7F1D1D/20%                 │
│ --error-text        │ #DC2626          │ #FCA5A5                     │
└─────────────────────┴──────────────────┴─────────────────────────────┘
```

### 7.2 New CSS Classes Added for Onboarding

```
┌────────────────────────────────────────────────────────────────────────┐
│              ONBOARDING CSS EXTENSIONS (added to globals.css)          │
├──────────────────────────┬─────────────────────────────────────────────┤
│ Class                    │ Purpose                                    │
├──────────────────────────┼─────────────────────────────────────────────┤
│ .onboarding-progress     │ Flex container for step indicator (gap 8px)│
│ .onboarding-progress-step│ Step bar (4px height, rounded, bg: border)│
│ .onboarding-progress-    │ Active step: bg changed to --primary      │
│  step.active             │                                            │
│ .onboarding-grid         │ 2×2 grid layout (12px gap)                │
│ .onboarding-type-card    │ Card with border, rounded, hover effects  │
│ .onboarding-type-card    │ Purple ring + tinted bg when selected     │
│  .selected               │                                            │
│ .onboarding-type-icon    │ 24px emoji icon block                     │
│ .onboarding-type-name    │ 14px bold card title                      │
│ .onboarding-type-desc    │ 12px muted description text               │
│ .onboarding-url-display  │ Compound input: text + .letbuyy.store     │
│ .onboarding-url-suffix   │ Monospace suffix badge (Fira Code font)   │
│ .onboarding-btn-row      │ Back + Create button row (flex, 12px gap) │
│ .onboarding-spinner      │ 16px rotating purple border spinner       │
│ .onboarding-success-icon │ 64px green circle with checkmark          │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 8. Onboarding UI — Complete Wireframes (All States)

### 8.1 Loading State

```
╔═══════════════════════════════════════════════════════════════════════╗
║                     accounts.letbuyy.store/onboarding                ║
╚═══════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│                                                    [EN]  [🌙]      │
│                                                 lang   theme       │
│                                                 toggle  toggle     │
│                                                                     │
│                                                                     │
│                ┌─────────────────────────────────┐                  │
│                │                                 │                  │
│                │                                 │                  │
│                │                                 │                  │
│                │          Loading...              │                  │
│                │       (--text-hint color)        │                  │
│                │                                 │                  │
│                │                                 │                  │
│                │                                 │                  │
│                └─────────────────────────────────┘                  │
│                        ↑ auth-card (centered)                       │
│                                                                     │
│              ↑ auth-container (full viewport, centered)             │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Step 1 — Site Type Selection (No Selection)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                    [EN]  [🌙]      │
│                                                                     │
│                ┌─────────────────────────────────┐                  │
│                │                                 │                  │
│                │          ┌────────┐             │                  │
│                │          │ LetBuyy│  ← 56×56   │                  │
│                │          │  Logo  │    app_icon │                  │
│                │          └────────┘             │                  │
│                │                                 │                  │
│                │     ┌────────┐ ┌────────┐      │ ← Progress bar  │
│                │     │████████│ │░░░░░░░░│      │   Step 1 active  │
│                │     └────────┘ └────────┘      │   Step 2 inactive│
│                │                                 │                  │
│                │  What do you want to build?     │ ← auth-title    │
│                │  Choose your site type          │ ← auth-subtitle │
│                │  to get started                 │                  │
│                │                                 │                  │
│                │  ┌──────────────┬──────────────┐│                  │
│                │  │              │              ││                  │
│                │  │  🛒           │  💼           ││                  │
│                │  │  E-commerce  │  Portfolio   ││                  │
│                │  │  Store       │              ││                  │
│                │  │              │  Showcase    ││                  │
│                │  │  Sell        │  your work   ││                  │
│                │  │  products    │              ││                  │
│                │  │  online      │              ││                  │
│                │  │              │              ││                  │
│                │  ├──────────────┼──────────────┤│                  │
│                │  │              │              ││                  │
│                │  │  📄           │  🚀           ││                  │
│                │  │  Resume      │  Landing     ││                  │
│                │  │  / CV        │  Page        ││                  │
│                │  │              │              ││                  │
│                │  │  Professional│  Marketing   ││                  │
│                │  │  profile     │  campaign    ││                  │
│                │  │              │              ││                  │
│                │  └──────────────┴──────────────┘│                  │
│                │                                 │                  │
│                │  ┌─────────────────────────────┐│                  │
│                │  │          Next  →             ││ ← DISABLED      │
│                │  │   (disabled — no selection)  ││   (opacity 0.5) │
│                │  └─────────────────────────────┘│                  │
│                │                                 │                  │
│                └─────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Step 1 — Card Interaction States

```
  DEFAULT STATE                  HOVER STATE                  SELECTED STATE
┌────────────────┐           ┌────────────────┐           ╔════════════════╗
│                │           │                │           ║  ──── purple   ║
│  🛒             │           │  🛒             │           ║  🛒   focus    ║
│  E-commerce    │           │  E-commerce    │           ║  E-commerce   ║
│  Store         │           │  Store         │           ║  Store  ring   ║
│                │           │                │           ║                ║
│  Sell products │           │  Sell products │           ║  Sell products ║
│  online        │           │  online        │           ║  online        ║
│                │           │                │           ║                ║
│  border: gray  │           │  border: purple│           ║  border: vivid ║
│  bg: white     │           │  bg: secondary │           ║  bg: purple/6% ║
│                │           │  ↑ translateY  │           ║  shadow: 0 0 0 ║
│                │           │    (-2px)      │           ║  2px primary   ║
└────────────────┘           └────────────────┘           ╚════════════════╝
```

### 8.4 Step 2 — Store Name Input

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                    [EN]  [🌙]      │
│                                                                     │
│                ┌─────────────────────────────────┐                  │
│                │          ┌────────┐             │                  │
│                │          │ LetBuyy│             │                  │
│                │          └────────┘             │                  │
│                │                                 │                  │
│                │     ┌────────┐ ┌────────┐      │ ← Both active   │
│                │     │████████│ │████████│      │                  │
│                │     └────────┘ └────────┘      │                  │
│                │                                 │                  │
│                │  Name your store                │ ← auth-title    │
│                │  This will be your URL          │ ← auth-subtitle │
│                │                                 │                  │
│                │  Store Name                     │ ← label         │
│                │  ┌──────────────────────────────┐                  │
│                │  │                    │          │                  │
│                │  │  myawesomestore    │.letbuyy  │                  │
│                │  │                    │.store    │                  │
│                │  │   ← editable      │← suffix  │                  │
│                │  │     input field   │  (mono   │                  │
│                │  │     (auto-focus)  │   font)  │                  │
│                │  │                    │          │                  │
│                │  └──────────────────────────────┘                  │
│                │                                 │                  │
│                │  ┌───────────┐ ┌───────────────┐│                  │
│                │  │           │ │               ││                  │
│                │  │   Back    │ │  Create Store ││                  │
│                │  │           │ │               ││                  │
│                │  │ secondary │ │   primary     ││                  │
│                │  │  button   │ │   button      ││                  │
│                │  │           │ │               ││                  │
│                │  └───────────┘ └───────────────┘│                  │
│                │                                 │                  │
│                └─────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘

  URL Input Focus State:
  ┌─────────────────────────┬──────────────┐
  │  myawesomestore         │ .letbuyy     │  border: --primary (purple)
  │  ← cursor blinking     │ .store       │  shadow: 0 0 0 3px purple/10%
  └─────────────────────────┴──────────────┘

  Creating State (button):
  ┌────────────────────────────────┐
  │  ◌  Creating...               │  ← spinner + disabled
  │     (all inputs disabled)     │     opacity reduced
  └────────────────────────────────┘
```

### 8.5 Error State

```
┌─────────────────────────────────────────────────────────────────────┐
│                ┌─────────────────────────────────┐                  │
│                │          ┌────────┐             │                  │
│                │          │ LetBuyy│             │                  │
│                │          └────────┘             │                  │
│                │                                 │                  │
│                │  ┌─────────────────────────────┐│                  │
│                │  │  ⚠ Error: This store name   ││ ← auth-error   │
│                │  │  is already taken.  Please  ││   red bg/border │
│                │  │  choose another.            ││   red text      │
│                │  └─────────────────────────────┘│                  │
│                │                                 │                  │
│                │  Name your store                │                  │
│                │  ┌──────────────────────────────┐                  │
│                │  │  takenname      │.letbuyy    │ ← red border   │
│                │  │                 │.store      │   on error      │
│                │  └──────────────────────────────┘                  │
│                │                                 │                  │
│                │  ┌───────────┐ ┌───────────────┐│                  │
│                │  │   Back    │ │  Create Store ││                  │
│                │  └───────────┘ └───────────────┘│                  │
│                └─────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.6 Success State

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                    [EN]  [🌙]      │
│                                                                     │
│                ┌─────────────────────────────────┐                  │
│                │                                 │                  │
│                │           ┌─────────┐           │                  │
│                │           │         │           │                  │
│                │           │    ✓    │           │ ← Green circle  │
│                │           │         │           │   64×64          │
│                │           └─────────┘           │   animated       │
│                │          (scale-in anim)        │   scaleIn 0.4s  │
│                │                                 │                  │
│                │       Store Created! 🎉         │ ← auth-title    │
│                │                                 │                  │
│                │    Redirecting to your          │ ← auth-subtitle │
│                │    dashboard                    │                  │
│                │                                 │                  │
│                │             ◌                   │ ← Spinner        │
│                │       Redirecting...            │   (2s delay     │
│                │                                 │    then redirect)│
│                │                                 │                  │
│                └─────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.7 Responsive Comparison

```
 MOBILE (≤480px)                        DESKTOP (1440px)
┌──────────────────┐                   ┌───────────────────────────────────┐
│                  │                   │                                   │
│ ┌──────────────┐ │                   │          ┌──────────────────┐     │
│ │  🛒           │ │  Single          │          │ 🛒     │  💼       │     │
│ │  E-commerce  │ │  column          │          │ E-comm │ Portfolio│     │
│ │  Sell...     │ │  (grid: 1fr)     │          │        │          │     │
│ ├──────────────┤ │                   │          ├────────┼──────────┤     │
│ │  💼           │ │ Buttons          │          │ 📄     │  🚀       │     │
│ │  Portfolio   │ │ stacked          │          │ Resume │ Landing  │     │
│ ├──────────────┤ │ vertically       │          │        │          │     │
│ │  📄           │ │                   │          └──────────────────┘     │
│ │  Resume      │ │ Full-width       │                                   │
│ ├──────────────┤ │ card (no         │   Background: --bg-secondary      │
│ │  🚀           │ │ shadow)          │   Card: box-shadow + elevation   │
│ │  Landing     │ │                   │   Padding: 36px                   │
│ └──────────────┘ │ Padding: 20px    │                                   │
│                  │                   │                                   │
│ ┌──────────────┐ │                   │   ┌──────────┐ ┌──────────────┐  │
│ │     Back     │ │                   │   │   Back   │ │ Create Store │  │
│ ├──────────────┤ │                   │   └──────────┘ └──────────────┘  │
│ │ Create Store │ │                   │         Side by side              │
│ └──────────────┘ │                   │                                   │
└──────────────────┘                   └───────────────────────────────────┘
```

---

## 9. Email Template Wireframes

### 9.1 Success Email — Store Created

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                        ┌────────┐                                │
│                        │LetBuyy │  ← 48×48 logo                 │
│                        │  Logo  │                                │
│                        └────────┘                                │
│                         LetBuyy     ← #8B5CF6 purple            │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│                        ┌────────┐                                │
│                        │   ✓    │   ← Green circle (#22C55E)    │
│                        └────────┘                                │
│                                                                  │
│                  Your Store is Ready! 🎉                         │
│                    (28px, bold, #0f172a)                          │
│                                                                  │
│     Congratulations! Your E-commerce Store has been              │
│     successfully created and is ready to customize.              │
│                    (16px, #475569)                                │
│                                                                  │
│     ┌──────────────────────────────────────────────────────┐    │
│     │                                                      │    │
│     │  🛒  mystore                                          │    │
│     │      E-commerce Store         (#64748b subtitle)     │    │
│     │                                                      │    │
│     │  ────────────────────────────────────────────────    │    │
│     │                                                      │    │
│     │  Store URL:         mystore.letbuyy.store (purple)   │    │
│     │  Admin Dashboard:   admin.letbuyy.store/mystore      │    │
│     │  Owner:             user@example.com                 │    │
│     │  Status:            ┌────────┐                       │    │
│     │                     │ Draft  │ ← amber badge         │    │
│     │                     └────────┘   (#fef3c7 bg)        │    │
│     │                                                      │    │
│     └──────────────────────────────────────────────────────┘    │
│                   ↑ Details card (#f8fafc bg, 12px rounded)      │
│                                                                  │
│     Next Steps:                                                  │
│     • Customize your store: Add branding, colors, content       │
│     • Add your first product: Start building                    │
│     • Publish when ready: Make your store live                  │
│                                                                  │
│               ┌──────────────────────────┐                       │
│               │    Open Dashboard →      │  ← Purple CTA button │
│               │    (#8B5CF6, 14px pad)   │    (280px max-width) │
│               └──────────────────────────┘                       │
│                                                                  │
│     Need help? Check out our documentation or contact support.  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│     © 2026 LetBuyy. All rights reserved.                        │
│     Home • Help Center • Privacy                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 Failure Email — Store Creation Failed

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                        ┌────────┐                                │
│                        │LetBuyy │                                │
│                        └────────┘                                │
│                         LetBuyy                                  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│                        ┌────────┐                                │
│                        │   ✕    │   ← Red circle (#EF4444)      │
│                        └────────┘                                │
│                                                                  │
│                  Store Creation Failed                            │
│                    (28px, bold)                                   │
│                                                                  │
│     We encountered an issue while creating your E-commerce      │
│     Store. Don't worry — you can try again.                     │
│                                                                  │
│     ┌──────────────────────────────────────────────────────┐    │
│     │  ↑ Red tinted card (#fef2f2 bg, #fecaca border)      │    │
│     │                                                      │    │
│     │  Store Name Already Taken                            │    │
│     │  (18px, bold, #991b1b)                               │    │
│     │                                                      │    │
│     │  The store name you requested is already in use.     │    │
│     │  (14px, #7f1d1d)                                     │    │
│     │                                                      │    │
│     │  ────────────────────────────────────────────────    │    │
│     │                                                      │    │
│     │  Requested Name:  ┌──────────────────────┐           │    │
│     │                   │coolshop.letbuyy.store│           │    │
│     │                   └──────────────────────┘           │    │
│     │                     ↑ monospace code badge            │    │
│     │  Store Type:      E-commerce Store                   │    │
│     │  User Email:      user@example.com                   │    │
│     │                                                      │    │
│     └──────────────────────────────────────────────────────┘    │
│                                                                  │
│     How to Fix This:                                             │
│     ┌──────────────────────────────────────────────────────┐    │
│     │ Please try again with a different store name. We     │    │
│     │ recommend adding your name, brand, or a unique       │    │
│     │ identifier.                                          │    │
│     └──────────────────────────────────────────────────────┘    │
│              ↑ Solution card (#f8fafc bg)                        │
│                                                                  │
│               ┌──────────────────────────┐                       │
│               │      Try Again →         │  ← Purple CTA        │
│               └──────────────────────────┘                       │
│                                                                  │
│                    Contact Support                               │
│                  ↑ Secondary link (#8B5CF6)                      │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│     © 2026 LetBuyy. All rights reserved.                        │
│     Home • Help Center • Privacy                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. Implementation Code — Logic Flow Analysis

### 10.1 Onboarding Page Component Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    ONBOARDING PAGE — STATE MACHINE                       │
└──────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐
  │  PAGE LOAD  │
  └──────┬──────┘
         │
         ├── 1. checkAuth()
         │    ├── No session? → redirect /login
         │    ├── Has store?  → redirect admin/{subdomain}
         │    └── No store?   → setLoading(false) → show UI
         │
         └── 2. initializeTheme()
              ├── Read localStorage('theme')  → setIsDark
              └── Read localStorage('lang')   → setLang

  STATE: loading=true  →  RENDER: "Loading..." (auth-card)
  STATE: loading=false →  RENDER: Step 1 or Step 2

  ┌─────────────────────────────────────────────────────────────────┐
  │  Step 1: Site Type Selection                                    │
  │                                                                 │
  │  State: step=1, selectedType=null|StoreType                    │
  │                                                                 │
  │  User Action:                                                   │
  │  • Click card → setSelectedType(type)                          │
  │  • Click "Next" → setStep(2) (only if selectedType !== null)   │
  └─────────────────────────────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  Step 2: Store Name Input                                       │
  │                                                                 │
  │  State: step=2, storeName='', creating=false                   │
  │                                                                 │
  │  Input: auto-sanitized (lowercase, alphanumeric+hyphen only)   │
  │  Regex: storeName.toLowerCase().replace(/[^a-z0-9-]/g, '')     │
  │                                                                 │
  │  User Actions:                                                  │
  │  • "Back" → setStep(1), clearError                             │
  │  • "Create Store" → handleCreate()                             │
  │    1. Validate: non-empty, regex check                         │
  │    2. Check: subdomain available? (SELECT from stores)         │
  │       ├── Taken → setError, log attempt, send failure email    │
  │       └── Available → INSERT store, log success, send email    │
  │    3. Success → setSuccess(true), setTimeout redirect (2s)     │
  │    4. Failure → setError(message), log attempt, send email     │
  └─────────────────────────────────────────────────────────────────┘

  STATE: success=true → RENDER: Success screen (checkmark + redirect)
```

### 10.2 Login Redirect Logic

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   LOGIN API ROUTE — REDIRECT DECISION                    │
└──────────────────────────────────────────────────────────────────────────┘

  POST /api/auth/login  { email, password }
        │
        ▼
  ┌──────────────────┐
  │ signInWithPassword│
  └────────┬─────────┘
           │
      ┌────┴────┐
      │         │
   ERROR     SUCCESS
      │         │
      ▼         ▼
  401 JSON   ┌─────────────────────────┐
             │ Query: stores WHERE     │
             │ user_id = auth.user.id  │
             │ LIMIT 1                 │
             └───────────┬─────────────┘
                         │
                    ┌────┴────┐
                    │         │
               HAS STORE   NO STORE
                    │         │
                    ▼         ▼
              ┌──────────┐  ┌──────────┐
              │ redirect │  │ redirect │
              │ admin.*/ │  │ /onboard │
              │{subdomain}  │ -ing     │
              └──────────┘  └──────────┘
```

### 10.3 Email API Flow

```
  POST /api/email/store-creation-success
  { email, storeName, storeType, storeUrl, adminUrl }
        │
        ▼
  ┌──────────────────────────────┐
  │ Validate required fields     │  → 400 if missing
  └──────────────┬───────────────┘
                 │
                 ▼
  ┌──────────────────────────────┐
  │ resend.emails.send({         │
  │   from: noreply@letbuyy...   │
  │   to: email                  │
  │   subject: "🎉 Your ..."     │
  │   react: <StoreCreatedSucc>  │
  │ })                           │
  └──────────────┬───────────────┘
                 │
            ┌────┴────┐
            │         │
         ERROR     SUCCESS
            │         │
            ▼         ▼
   Log to email_logs  Log to email_logs
   status: 'failed'   status: 'sent'
   Return 500         Return { messageId }
```

---

> **→ Continues in [Part 3](./Analysis_Part3_Admin_Storefront_Deploy.md):**
> Admin Dashboard Wireframes, Storefront / "Launching Soon" Page, Dark Mode, Deployment Checklist & Testing Plan

