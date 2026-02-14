# LetBuyy Platform — Shopify-Inspired Comprehensive Analysis

> **Part 3 of 8** | Store Management UI — Multi-Store Switcher, Badge System & Dashboard Variants
>
> **Date:** February 13, 2026 | **Version:** 4.0 (Shopify-Inspired Rebuild)
>
> **Prev:** [Part 2](./Shopify_Inspired_Analysis_Part2_Onboarding.md) | **Next:** Part 4 (Trial & Payment UI)

---

## 9. Store Switcher Interface

### 9.1 Store Switcher — Landing Page (`admin.letbuyy.store/`)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         admin.letbuyy.store/                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  🅛 LetBuyy Admin              john@example.com  [🔔 3] [⚙️] [👤] │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │                     Your Stores (3)                  [+ Create Store]  │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │ Active Stores (2)                                                │ │  │
│  │  ├──────────────────────────────────────────────────────────────────┤ │  │
│  │  │                                                                  │ │  │
│  │  │  ┌─────────┐                                                     │ │  │
│  │  │  │   MS    │  myshop                          🛒 E-commerce     │ │  │
│  │  │  │ (green) │  myshop.letbuyy.store            Trial: 10 days    │ │  │
│  │  │  └─────────┘  Created: Jan 15, 2026            📊 45 products    │ │  │
│  │  │                                                 [Open Admin →]   │ │  │
│  │  │              ─────────────────────────────────────────────────   │ │  │
│  │  │                                                                  │ │  │
│  │  │  ┌─────────┐                                                     │ │  │
│  │  │  │   TI    │  tech-insights-daily             📝 Blogger        │ │  │
│  │  │  │ (blue)  │  tech-insights-daily.letbuyy.store                 │ │  │
│  │  │  └─────────┘  Created: Feb 1, 2026             Active (₹499/mo) │ │  │
│  │  │               Last post: 2 days ago            📝 23 posts       │ │  │
│  │  │                                                 [Open Admin →]   │ │  │
│  │  │                                                                  │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │ Inactive Stores (1)                                              │ │  │
│  │  ├──────────────────────────────────────────────────────────────────┤ │  │
│  │  │                                                                  │ │  │
│  │  │  ┌─────────┐                                                     │ │  │
│  │  │  │   PF    │  portfolio-site                  💼 Portfolio      │ │  │
│  │  │  │ (gray)  │  portfolio-site.letbuyy.store                      │ │  │
│  │  │  └─────────┘  Created: Dec 10, 2025            ⚠️ Deactivated    │ │  │
│  │  │               Trial expired: Jan 24, 2026                        │ │  │
│  │  │               Reason: No payment method setup                    │ │  │
│  │  │                                                 [Reactivate]     │ │  │
│  │  │                                                                  │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Quick Actions                                                          │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │  [📊 View All Analytics]  [💳 Payment Methods]  [🎓 Help Center]      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Store Card Component Anatomy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    STORE CARD COMPONENT BREAKDOWN                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │  ┌─────────┐  ← Avatar (2-letter initials, colored by site type)      │  │
│  │  │   MS    │                                                           │  │
│  │  │ #8B5CF6 │  E-commerce: Purple (#8B5CF6)                             │  │
│  │  └─────────┘  Portfolio:  Blue (#3B82F6)                               │  │
│  │               Resume:     Green (#10B981)                              │  │
│  │  myshop       Landing:    Orange (#F59E0B)                             │  │
│  │  myshop.letbuyy.store     Blogger:    Indigo (#6366F1)                │  │
│  │  ↑ Store name & URL                                                    │  │
│  │                                                                        │  │
│  │  Created: Jan 15, 2026  ← Metadata row                                │  │
│  │                                                                        │  │
│  │  ┌────────────────┐  ← Badge row                                      │  │
│  │  │ 🛒 E-commerce  │     Site type badge                                │  │
│  │  └────────────────┘                                                    │  │
│  │                                                                        │  │
│  │  ┌──────────────────┐  ← Status badge (conditional)                   │  │
│  │  │ Trial: 10 days   │     Green if active, amber if trial,            │  │
│  │  └──────────────────┘     red if deactivated                          │  │
│  │                                                                        │  │
│  │  📊 45 products  ← Quick stats (site-type specific)                    │  │
│  │                                                                        │  │
│  │  ┌──────────────────┐                                                  │  │
│  │  │  Open Admin →    │  ← Primary CTA                                   │  │
│  │  └──────────────────┘                                                  │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  QUICK STATS BY SITE TYPE:                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ E-commerce: 📊 45 products • 💰 ₹12,450 revenue (30d)                  │  │
│  │ Portfolio:  🖼️ 12 projects • 👁️ 2,341 views (30d)                      │  │
│  │ Resume:     💼 Updated 5 days ago • 👁️ 234 views (30d)                 │  │
│  │ Landing:    📧 123 leads • 🔗 1,234 clicks (30d)                        │  │
│  │ Blogger:    📝 23 posts • 👁️ 12,450 views (30d)                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Store Switcher Dropdown (In-Dashboard)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    IN-DASHBOARD STORE SWITCHER                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Header location: Top-left of admin dashboard                                │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  ┌─────────────────────────────────────────────┐                       │  │
│  │  │  MS  myshop                            ▼   │  ← Current store       │  │
│  │  └──────────────────────┬──────────────────────┘                       │  │
│  │                         │                                               │  │
│  │  Click to expand:       ▼                                               │  │
│  │                                                                         │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │ Switch Store                                          [+ New]    │  │  │
│  │  ├──────────────────────────────────────────────────────────────────┤  │  │
│  │  │                                                                  │  │  │
│  │  │  ✓ MS  myshop                           🛒 E-commerce           │  │  │
│  │  │        myshop.letbuyy.store              Trial: 10 days         │  │  │
│  │  │        ↑ Currently active                                       │  │  │
│  │  │                                                                  │  │  │
│  │  │  ───────────────────────────────────────────────────────────────│  │  │
│  │  │                                                                  │  │  │
│  │  │    TI  tech-insights-daily              📝 Blogger              │  │  │
│  │  │        tech-insights-daily.letbuyy.store                        │  │  │
│  │  │                                          Active (₹499/mo)       │  │  │
│  │  │                                                                  │  │  │
│  │  │  ───────────────────────────────────────────────────────────────│  │  │
│  │  │                                                                  │  │  │
│  │  │    PF  portfolio-site                   💼 Portfolio            │  │  │
│  │  │        portfolio-site.letbuyy.store                             │  │  │
│  │  │                                          ⚠️ Deactivated          │  │  │
│  │  │                                          [Reactivate]           │  │  │
│  │  │                                                                  │  │  │
│  │  ├──────────────────────────────────────────────────────────────────┤  │  │
│  │  │ [View All Stores →]                      [Account Settings]     │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  BEHAVIOR:                                                                   │
│  • Click on store row → Switch to that store (reload dashboard)             │
│  • Click "View All Stores" → Navigate to admin.letbuyy.store/               │
│  • Click "+ New" → Navigate to accounts.letbuyy.store/onboarding            │
│  • Max height: 400px, scroll if more than 5 stores                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Badge System

### 10.1 Site Type Badges

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SITE TYPE BADGE SYSTEM                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BADGE VARIANTS:                                                             │
│                                                                              │
│  ┌────────────────┐   ← E-commerce                                          │
│  │ 🛒 E-commerce  │      Background: #F3E8FF (light purple)                 │
│  └────────────────┘      Text: #7C3AED (dark purple)                        │
│                          Border: #C4B5FD (medium purple)                    │
│                                                                              │
│  ┌────────────────┐   ← Portfolio                                           │
│  │ 💼 Portfolio   │      Background: #DBEAFE (light blue)                   │
│  └────────────────┘      Text: #1D4ED8 (dark blue)                          │
│                          Border: #93C5FD (medium blue)                      │
│                                                                              │
│  ┌────────────────┐   ← Resume                                              │
│  │ 📄 Resume      │      Background: #D1FAE5 (light green)                  │
│  └────────────────┘      Text: #047857 (dark green)                         │
│                          Border: #6EE7B7 (medium green)                     │
│                                                                              │
│  ┌────────────────┐   ← Landing Page                                        │
│  │ 🚀 Landing     │      Background: #FEF3C7 (light amber)                  │
│  └────────────────┘      Text: #B45309 (dark amber)                         │
│                          Border: #FCD34D (medium amber)                     │
│                                                                              │
│  ┌────────────────┐   ← Blogger                                             │
│  │ 📝 Blogger     │      Background: #E0E7FF (light indigo)                 │
│  └────────────────┘      Text: #4338CA (dark indigo)                        │
│                          Border: #A5B4FC (medium indigo)                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Status Badges

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         STATUS BADGE SYSTEM                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRIAL STATUS:                                                               │
│  ┌──────────────────┐   Days 14-8:  Green background                        │
│  │ Trial: 10 days   │   Days 7-4:   Amber background                        │
│  └──────────────────┘   Days 3-1:   Red background                          │
│                         Urgent pulse animation on last 3 days               │
│                                                                              │
│  ACTIVE STATUS:                                                              │
│  ┌──────────────────┐   Green background                                    │
│  │ Active (₹499/mo) │   Checkmark icon                                      │
│  └──────────────────┘   Shows billing amount                                │
│                                                                              │
│  INACTIVE STATUS:                                                            │
│  ┌──────────────────┐   Red background                                      │
│  │ ⚠️ Deactivated    │   Warning icon                                       │
│  └──────────────────┘   Gray text                                           │
│                                                                              │
│  PAYMENT FAILED:                                                             │
│  ┌──────────────────┐   Amber background                                    │
│  │ ⚠️ Payment Failed │   Shows retry CTA                                    │
│  └──────────────────┘   Pulsing animation                                   │
│                                                                              │
│  SUSPENDED (Admin):                                                          │
│  ┌──────────────────┐   Dark red background                                 │
│  │ 🚫 Suspended      │   Lock icon                                          │
│  └──────────────────┘   Contact support message                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Dashboard Variants by Site Type

### 11.1 E-commerce Dashboard

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                  E-COMMERCE DASHBOARD                                        ║
║  admin.letbuyy.store/store/myshop                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  MS myshop ▼        Search (⌘K)       [🔔 3] [⚙️] [👤 John]         │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────┐ ┌─────────────────────────────────────────────────────────────┐ │
│  │        │ │                                                             │ │
│  │  📊    │ │  ⏰ 10 days left in your trial         [Setup Payment →]   │ │
│  │  Dash  │ │  Your trial expires on February 27, 2026                   │ │
│  │        │ │  ⚠️ No payment method setup — Store will deactivate        │ │
│  │  🛍️    │ └─────────────────────────────────────────────────────────────┘ │
│  │  Prods │                                                                 │
│  │        │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  📦    │ │ Revenue  │ │ Orders   │ │ Products │ │ Visitors │          │
│  │  Orders│ │ ₹12,450  │ │ 45       │ │ 23       │ │ 1,234    │          │
│  │        │ │ ↑24% ██  │ │ ↑18% █   │ │ +2 new   │ │ ↑15% █   │          │
│  │  👥    │ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  │  Cust  │                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  💰    │ │ Quick Actions                                           │   │
│  │  Pay   │ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ [+ Add Product]  [📦 Process Orders]  [🎨 Customize]   │   │
│  │  📊    │ └─────────────────────────────────────────────────────────┘   │
│  │  Analyt│                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  🎨    │ │ Recent Orders                              [View All →] │   │
│  │  Theme │ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ #1045  John Doe      ₹1,299  Completed   2 min ago    │   │
│  │  ⚙️    │ │ #1044  Sarah Smith   ₹2,450  Processing  15 min ago   │   │
│  │  Sett  │ │ #1043  Mike Johnson  ₹899    Shipped     1 hour ago   │   │
│  │        │ └─────────────────────────────────────────────────────────┘   │
│  │  🌐    │                                                                 │
│  │  Domain│ ┌─────────────────────────────────────────────────────────┐   │
│  │        │ │ Top Products                               [View All →] │   │
│  └────────┘ ├─────────────────────────────────────────────────────────┤   │
│             │ Classic T-Shirt    45 sold   ₹22,455   ████████ 62%    │   │
│             │ Premium Hoodie     28 sold   ₹41,972   █████ 38%       │   │
│             └─────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Portfolio Dashboard

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    PORTFOLIO DASHBOARD                                       ║
║  admin.letbuyy.store/store/johnsmith-design                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  JS johnsmith-design ▼    Search (⌘K)    [🔔 1] [⚙️] [👤 John]      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────┐ ┌─────────────────────────────────────────────────────────────┐ │
│  │        │ │                                                             │ │
│  │  📊    │ │  ✅ Your portfolio is active (₹499/mo)                      │ │
│  │  Dash  │ │  Next billing: March 1, 2026                               │ │
│  │        │ │  [Manage Subscription]                                     │ │
│  │  💼    │ └─────────────────────────────────────────────────────────────┘ │
│  │  Proj  │                                                                 │
│  │        │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  🖼️    │ │ Projects │ │ Views    │ │ Inquiries│ │ Downloads│          │
│  │  Gall  │ │ 12       │ │ 2,341    │ │ 8        │ │ 45       │          │
│  │        │ │ +1 new   │ │ ↑32% ██  │ │ 3 new    │ │ ↑12% █   │          │
│  │  📝    │ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  │  Blog  │                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  📄    │ │ Quick Actions                                           │   │
│  │  About │ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ [+ Add Project]  [✏️ Edit About]  [🎨 Update Theme]    │   │
│  │  📊    │ └─────────────────────────────────────────────────────────┘   │
│  │  Analyt│                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  🎨    │ │ Recent Inquiries                       [View All →]     │   │
│  │  Theme │ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ Sarah K.     "Interested in logo design"   2 hours ago │   │
│  │  ⚙️    │ │ Mike T.      "Website project quote"       1 day ago   │   │
│  │  Sett  │ │ Lisa M.      "Collaboration opportunity"   3 days ago  │   │
│  │        │ └─────────────────────────────────────────────────────────┘   │
│  │  🌐    │                                                                 │
│  │  Domain│ ┌─────────────────────────────────────────────────────────┐   │
│  │        │ │ Top Projects (by views)                [View All →]     │   │
│  └────────┘ ├─────────────────────────────────────────────────────────┤   │
│             │ Brand Redesign: TechCo    845 views   ████████ 36%     │   │
│             │ E-commerce UI/UX          623 views   ██████ 27%        │   │
│             │ Mobile App Design         512 views   █████ 22%         │   │
│             └─────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Blogger Dashboard

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                      BLOGGER DASHBOARD                                       ║
║  admin.letbuyy.store/store/tech-insights-daily                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  TI tech-insights-daily ▼   Search (⌘K)   [🔔 8] [⚙️] [👤 John]     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────┐ ┌─────────────────────────────────────────────────────────────┐ │
│  │        │ │                                                             │ │
│  │  📊    │ │  ⏰ 12 days left in your trial         [Setup Payment →]   │ │
│  │  Dash  │ │  Your blog is growing! Setup payment to keep it live.      │ │
│  │        │ │                                                             │ │
│  │  📝    │ └─────────────────────────────────────────────────────────────┘ │
│  │  Posts │                                                                 │
│  │        │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  📁    │ │ Posts    │ │ Views    │ │ Comments │ │ Subscribe│          │
│  │  Categ │ │ 23       │ │ 12,450   │ │ 234      │ │ 89       │          │
│  │        │ │ 2 drafts │ │ ↑24% ██  │ │ 8 pending│ │ +12 new  │          │
│  │  🏷️    │ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  │  Tags  │                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  💬    │ │ Quick Actions                                           │   │
│  │  Comm  │ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ [+ New Post]  [💬 Moderate (8)]  [📧 Send Newsletter]  │   │
│  │  🖼️    │ └─────────────────────────────────────────────────────────┘   │
│  │  Media │                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  📊    │ │ Top Posts (last 30 days)               [View All →]     │   │
│  │  Analyt│ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ 10 Tips for Better UX      2,341 views   45 comments  │   │
│  │  🎨    │ │ Getting Started Next.js    1,876 views   32 comments  │   │
│  │  Theme │ │ React Best Practices       1,543 views   28 comments  │   │
│  │        │ └─────────────────────────────────────────────────────────┘   │
│  │  ⚙️    │                                                                 │
│  │  Sett  │ ┌─────────────────────────────────────────────────────────┐   │
│  │        │ │ Recent Activity                        [View All →]     │   │
│  │  🌐    │ ├─────────────────────────────────────────────────────────┤   │
│  │  Domain│ │ Sarah K. commented on "10 Tips..."       2 min ago     │   │
│  │        │ │ New subscriber: mike@example.com         15 min ago    │   │
│  └────────┘ │ John published "TypeScript Deep Dive"    1 hour ago    │   │
│             └─────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 11.4 Resume Dashboard

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                       RESUME DASHBOARD                                       ║
║  admin.letbuyy.store/store/sarah-johnson-cv                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  SJ sarah-johnson-cv ▼    Search (⌘K)    [🔔 2] [⚙️] [👤 Sarah]     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────┐ ┌─────────────────────────────────────────────────────────────┐ │
│  │        │ │                                                             │ │
│  │  📊    │ │  ✅ Your resume is live and active!                         │ │
│  │  Dash  │ │  Last updated: 5 days ago                                  │ │
│  │        │ │  [Update Resume →]                                         │ │
│  │  👤    │ └─────────────────────────────────────────────────────────────┘ │
│  │  Prof  │                                                                 │
│  │        │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  💼    │ │ Views    │ │ Downloads│ │ Messages │ │ Shares   │          │
│  │  Exp   │ │ 234      │ │ 45       │ │ 8        │ │ 23       │          │
│  │        │ │ ↑18% ██  │ │ ↑12% █   │ │ 3 new    │ │ ↑8% █    │          │
│  │  🎓    │ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  │  Educ  │                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  🏆    │ │ Quick Actions                                           │   │
│  │  Skills│ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ [✏️ Edit Profile]  [💼 Add Experience]  [📥 Download]  │   │
│  │  🏅    │ └─────────────────────────────────────────────────────────┘   │
│  │  Achiev│                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  📝    │ │ Recent Messages                        [View All →]     │   │
│  │  Publi │ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ TechCorp Recruiter  "Senior role inquiry"  2 days ago  │   │
│  │  💭    │ │ StartupXYZ          "Interview request"    4 days ago  │   │
│  │  Recom │ │ Design Agency       "Freelance project"    1 week ago  │   │
│  │        │ └─────────────────────────────────────────────────────────┘   │
│  │  📊    │                                                                 │
│  │  Analyt│ ┌─────────────────────────────────────────────────────────┐   │
│  │        │ │ Profile Completeness                                    │   │
│  │  🎨    │ ├─────────────────────────────────────────────────────────┤   │
│  │  Theme │ │ ████████████████████░░░░░ 85%                          │   │
│  │        │ │                                                         │   │
│  │  ⚙️    │ │ Missing: Publications, Awards                           │   │
│  │  Sett  │ │ [Complete Profile →]                                    │   │
│  │        │ └─────────────────────────────────────────────────────────┘   │
│  │  🌐    │                                                                 │
│  │  Domain│                                                                 │
│  └────────┘                                                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 11.5 Landing Page Dashboard

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    LANDING PAGE DASHBOARD                                    ║
║  admin.letbuyy.store/store/product-launch-2026                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  PL product-launch-2026 ▼   Search (⌘K)   [🔔 5] [⚙️] [👤 Mark]     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────┐ ┌─────────────────────────────────────────────────────────────┐ │
│  │        │ │                                                             │ │
│  │  📊    │ │  ⏰ 7 days left in your trial          [Setup Payment →]   │ │
│  │  Dash  │ │  Campaign performing well! Keep it live with autopay.      │ │
│  │        │ │                                                             │ │
│  │  📝    │ └─────────────────────────────────────────────────────────────┘ │
│  │  Content│                                                                │
│  │        │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  📧    │ │ Visitors │ │ Leads    │ │ Conv Rate│ │ Clicks   │          │
│  │  Leads │ │ 1,234    │ │ 123      │ │ 9.97%    │ │ 456      │          │
│  │        │ │ ↑42% ███ │ │ +45 new  │ │ ↑2.1%    │ │ ↑35% ██  │          │
│  │  📊    │ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  │  Analyt│                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  🎨    │ │ Quick Actions                                           │   │
│  │  Theme │ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ [✏️ Edit Content]  [📧 Export Leads]  [🎨 Update CTA]  │   │
│  │  ⚙️    │ └─────────────────────────────────────────────────────────┘   │
│  │  Sett  │                                                                 │
│  │        │ ┌─────────────────────────────────────────────────────────┐   │
│  │  🌐    │ │ Recent Leads                           [View All →]     │   │
│  │  Domain│ ├─────────────────────────────────────────────────────────┤   │
│  │        │ │ sarah@example.com      Submitted form    5 min ago     │   │
│  └────────┘ │ mike.t@company.com     Downloaded PDF    2 hours ago   │   │
│             │ lisa.m@startup.io      Clicked CTA       5 hours ago   │   │
│             └─────────────────────────────────────────────────────────┘   │
│                                                                              │
│             ┌─────────────────────────────────────────────────────────┐   │
│             │ Traffic Sources                        [View All →]     │   │
│             ├─────────────────────────────────────────────────────────┤   │
│             │ 🔵 Direct       425 visits (34%)   |██████████       │   │
│             │ 🟣 Social       345 visits (28%)   |████████         │   │
│             │ 🟢 Organic      289 visits (23%)   |███████          │   │
│             │ 🟡 Referral     175 visits (14%)   |████             │   │
│             └─────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Implementation Details

### 12.1 Store Switcher Component

```typescript
// components/StoreSwitcher.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus } from 'lucide-react'

interface Store {
  id: string
  subdomain: string
  store_name: string
  store_type: 'ecommerce' | 'portfolio' | 'resume' | 'landing' | 'blogger'
  status: 'trial' | 'active' | 'inactive' | 'payment_failed'
  trial_days_left?: number
  avatar_color: string
  quick_stat: string
}

export function StoreSwitcher({ 
  stores, 
  currentStore 
}: { 
  stores: Store[]
  currentStore: Store 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  
  const switchStore = (subdomain: string) => {
    router.push(`/store/${subdomain}`)
    setIsOpen(false)
  }
  
  const getInitials = (name: string) => {
    return name.split('-').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }
  
  const getSiteTypeIcon = (type: string) => {
    const icons = {
      ecommerce: '🛒',
      portfolio: '💼',
      resume: '📄',
      landing: '🚀',
      blogger: '📝'
    }
    return icons[type] || '📦'
  }
  
  const getStatusBadge = (store: Store) => {
    if (store.status === 'trial') {
      const color = store.trial_days_left! > 7 ? 'green' : 
                   store.trial_days_left! > 3 ? 'amber' : 'red'
      return (
        <span className={`badge-${color}`}>
          Trial: {store.trial_days_left} days
        </span>
      )
    }
    if (store.status === 'active') {
      return <span className="badge-green">Active (₹499/mo)</span>
    }
    if (store.status === 'inactive') {
      return <span className="badge-red">⚠️ Deactivated</span>
    }
    return null
  }
  
  return (
    <div className="relative">
      {/* Current Store Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="store-switcher-trigger"
      >
        <div 
          className="avatar" 
          style={{ backgroundColor: currentStore.avatar_color }}
        >
          {getInitials(currentStore.store_name)}
        </div>
        <span className="store-name">{currentStore.store_name}</span>
        <ChevronDown className={`icon ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="store-switcher-dropdown">
          <div className="dropdown-header">
            <span>Switch Store</span>
            <button onClick={() => router.push('/onboarding')}>
              <Plus size={16} /> New
            </button>
          </div>
          
          <div className="dropdown-content">
            {stores.map(store => (
              <button
                key={store.id}
                onClick={() => switchStore(store.subdomain)}
                className={`store-item ${store.id === currentStore.id ? 'active' : ''}`}
              >
                <div 
                  className="avatar-sm" 
                  style={{ backgroundColor: store.avatar_color }}
                >
                  {getInitials(store.store_name)}
                </div>
                
                <div className="store-info">
                  <div className="store-header">
                    <span className="name">{store.store_name}</span>
                    {store.id === currentStore.id && (
                      <span className="checkmark">✓</span>
                    )}
                  </div>
                  <span className="subdomain">{store.subdomain}.letbuyy.store</span>
                  
                  <div className="badges">
                    <span className="site-type-badge">
                      {getSiteTypeIcon(store.store_type)} {store.store_type}
                    </span>
                    {getStatusBadge(store)}
                  </div>
                  
                  <span className="quick-stat">{store.quick_stat}</span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="dropdown-footer">
            <button onClick={() => router.push('/')}>
              View All Stores →
            </button>
            <button onClick={() => router.push('/settings')}>
              Account Settings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 12.2 Dashboard Config Loader

```typescript
// lib/dashboard-config.ts
import { StoreConfig } from '@/types'

export function getDashboardConfig(store: Store): DashboardConfig {
  const baseConfig = {
    quickActions: [],
    widgets: [],
    sidebarMenu: []
  }
  
  switch (store.store_type) {
    case 'ecommerce':
      return {
        ...baseConfig,
        quickActions: [
          { label: 'Add Product', icon: 'Plus', action: '/products/new' },
          { label: 'Process Orders', icon: 'Package', action: '/orders?status=pending' },
          { label: 'Customize Theme', icon: 'Palette', action: '/theme' }
        ],
        widgets: [
          { type: 'revenue', size: 'medium' },
          { type: 'orders', size: 'medium' },
          { type: 'products', size: 'medium' },
          { type: 'visitors', size: 'medium' },
          { type: 'recent-orders', size: 'large' },
          { type: 'top-products', size: 'large' }
        ],
        sidebarMenu: [
          { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
          { icon: 'ShoppingBag', label: 'Products', path: '/products' },
          { icon: 'Package', label: 'Orders', path: '/orders' },
          { icon: 'Users', label: 'Customers', path: '/customers' },
          { icon: 'CreditCard', label: 'Payments', path: '/payments' },
          { icon: 'BarChart', label: 'Analytics', path: '/analytics' },
          { icon: 'Palette', label: 'Theme', path: '/theme' },
          { icon: 'Settings', label: 'Settings', path: '/settings' },
          { icon: 'Globe', label: 'Domain', path: '/domain' }
        ]
      }
    
    case 'blogger':
      return {
        ...baseConfig,
        quickActions: [
          { label: 'New Post', icon: 'Plus', action: '/posts/new' },
          { label: 'Moderate Comments', icon: 'MessageCircle', action: '/comments?status=pending', badge: store.pendingComments },
          { label: 'Send Newsletter', icon: 'Mail', action: '/newsletter' }
        ],
        widgets: [
          { type: 'posts', size: 'medium' },
          { type: 'views', size: 'medium' },
          { type: 'comments', size: 'medium' },
          { type: 'subscribers', size: 'medium' },
          { type: 'top-posts', size: 'large' },
          { type: 'recent-activity', size: 'large' }
        ],
        sidebarMenu: [
          { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
          { icon: 'FileText', label: 'Posts', path: '/posts' },
          { icon: 'Folder', label: 'Categories', path: '/categories' },
          { icon: 'Tag', label: 'Tags', path: '/tags' },
          { icon: 'MessageCircle', label: 'Comments', path: '/comments', badge: store.pendingComments },
          { icon: 'Image', label: 'Media', path: '/media' },
          { icon: 'BarChart', label: 'Analytics', path: '/analytics' },
          { icon: 'Palette', label: 'Theme', path: '/theme' },
          { icon: 'Settings', label: 'Settings', path: '/settings' },
          { icon: 'Globe', label: 'Domain', path: '/domain' }
        ]
      }
    
    // ... similar configs for portfolio, resume, landing
    
    default:
      return baseConfig
  }
}
```

---

> **→ Continues in Part 4:** Trial & Payment UI — Countdown Banners, Payment Modals, Reactivation Flow

---

## Document Navigation

| Part | Content |
|------|---------|
| [Part 1](./Shopify_Inspired_Analysis_Part1_Architecture.md) | Architecture & Trial System, URL Routing |
| [Part 2](./Shopify_Inspired_Analysis_Part2_Onboarding.md) | Onboarding Flow — Site Type Questions |
| **Part 3** (this) | Store Management UI — Switcher, Badges, Dashboards |
| Part 4 | Trial & Payment UI — Modals, Countdown, Reactivation |
| Part 5 | Complete Database Schema — All Tables |
| Part 6 | Admin Dashboard Variants — Per Site Type |
| Part 7 | Deployment & Migration — Step-by-Step |
| Part 8 | Implementation Roadmap — Timeline & Phases |