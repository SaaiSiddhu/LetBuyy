# LetBuyy Platform — Comprehensive Analysis & Implementation Plan

## Part 3: Admin Dashboard, Site Builders & Storefronts

> **Continued from Part 2** — Authentication, Database, Onboarding & Security

---

## 12. Admin Dashboard — The Adaptive UI Engine

The Admin Dashboard at `admin.letbuyy.store/{store}` is the heart of the platform. Its **entire navigation, widgets, and feature set morph** based on the site type selected during onboarding.

### 12.1 Sidebar Navigation — Per Site Type

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ADMIN SIDEBAR — ADAPTIVE NAVIGATION (5 VARIANTS)                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  🛒 E-COMMERCE     │ 🎨 PORTFOLIO     │ 📄 RESUME        │ ✍️ BLOG         ║
║  ───────────       │ ─────────        │ ──────           │ ────            ║
║  ⌂ Dashboard       │ ⌂ Dashboard      │ ⌂ Dashboard      │ ⌂ Dashboard     ║
║  📦 Products       │ 🏗️ Projects       │ 💼 Experience     │ 📝 Posts        ║
║    ├ All Products  │   ├ All Projects │   ├ Work History │   ├ All Posts    ║
║    ├ Add Product   │   ├ Add Project  │   ├ Add Entry    │   ├ New Post     ║
║    ├ Variants      │   └ Categories   │   └ Import CV    │   ├ Drafts      ║
║    ├ Collections   │ 🎯 Skills         │ 🎓 Education      │   └ Scheduled   ║
║    └ Tags          │ 💬 Testimonials   │ 🏆 Certifications │ 📂 Categories   ║
║  📋 Orders         │ 🧑‍🤝‍🧑 Clients        │ 🔧 Skills         │ 🏷️ Tags         ║
║    ├ All Orders    │ 🖼️ Gallery         │ 📊 ATS Score      │ 💬 Comments     ║
║    ├ Pending       │ 📋 Resume (opt)   │ 📤 Export PDF     │ 📧 Newsletter   ║
║    └ Archive       │                  │                    │ 🖼️ Media        ║
║  👥 Customers      │                  │                    │                 ║
║  💰 Coupons        │                  │                    │ 🚀 LANDING PAGE ║
║  🚚 Shipping       │                  │                    │ ───────────     ║
║  ────────────      │ ────────────     │ ────────────       │ ⌂ Dashboard     ║
║  COMMON TO ALL:    │ COMMON TO ALL:   │ COMMON TO ALL:     │ 📄 Sections     ║
║  📄 Pages          │ 📄 Pages         │ 📄 Pages           │ ✅ Forms         ║
║  🤖 AI Studio      │ 🤖 AI Studio     │ 🤖 AI Studio       │ 🎯 CTA Builder  ║
║  📈 Analytics      │ 📈 Analytics     │ 📈 Analytics       │ 📊 A/B Testing  ║
║  🎨 Themes         │ 🎨 Themes        │ 🎨 Themes          │ 🤖 AI Studio    ║
║  ⚙️ Settings       │ ⚙️ Settings      │ ⚙️ Settings        │ 📈 Analytics    ║
║  🔧 Extensions     │ 🔧 Extensions    │ 🔧 Extensions      │ ⚙️ Settings     ║
║                    │                  │                    │                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 12.2 Dashboard Home — E-Commerce Variant

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  admin.letbuyy.store/{store}/dashboard                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ SIDEBAR │  │  MAIN CONTENT                                            │  │
│  │         │  │                                                          │  │
│  │ ⌂ Dash  │  │  Good morning, {name}! 👋                                │  │
│  │ 📦 Prod  │  │  {store_name} — E-Commerce Store                        │  │
│  │ 📋 Ord   │  │                                                          │  │
│  │ 👥 Cust  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │ 💰 Coup  │  │  │  TODAY    │ │  PENDING │ │  REVENUE │ │  VISITORS│  │  │
│  │ 🚚 Ship  │  │  │  ORDERS  │ │  ORDERS  │ │  (30d)   │ │  (30d)   │  │  │
│  │ ─────── │  │  │          │ │          │ │          │ │          │  │  │
│  │ 📄 Pages │  │  │   12     │ │    3     │ │  ₹45,320 │ │  2,341   │  │  │
│  │ 🤖 AI    │  │  │  +15% ↑  │ │          │ │  +22% ↑  │ │  +8% ↑   │  │  │
│  │ 📈 Anlyt │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │ 🎨 Theme │  │                                                          │  │
│  │ ⚙️ Set  │  │  ┌────────────────────────────┐ ┌──────────────────────┐  │  │
│  │ 🔧 Ext  │  │  │  REVENUE CHART (30 Days)   │ │  RECENT ORDERS       │  │  │
│  │         │  │  │                            │ │                      │  │  │
│  │ Trial:  │  │  │  ₹50k ┤       ╱─╲         │ │  #1024 — ₹2,340      │  │  │
│  │ 5 days  │  │  │       ┤    ╱─╱   ╲        │ │  Approved ✅          │  │  │
│  │ left    │  │  │       ┤  ╱─╱       ╲──╱   │ │                      │  │  │
│  │         │  │  │  ₹10k ┤╱─╱             ╲  │ │  #1023 — ₹890        │  │  │
│  │[Upgrade]│  │  │       └────────────────────│ │  Pending 🔶           │  │  │
│  │         │  │  │      Mon  Wed  Fri  Sun    │ │                      │  │  │
│  │         │  │  └────────────────────────────┘ │  #1022 — ₹4,100      │  │  │
│  │         │  │                                  │  Shipped 📦           │  │  │
│  │         │  │  ┌────────────────────────────┐ │                      │  │  │
│  │         │  │  │  TOP PRODUCTS (THIS MONTH) │ └──────────────────────┘  │  │
│  │         │  │  │                            │                          │  │
│  │         │  │  │  1. Blue T-Shirt   │ 43 ▓▓▓▓▓▓▓▓▓▓▓▓▓░│ ₹12,900  │  │  │
│  │         │  │  │  2. Red Sneakers   │ 31 ▓▓▓▓▓▓▓▓▓░░░░░│ ₹18,600  │  │  │
│  │         │  │  │  3. Canvas Bag     │ 28 ▓▓▓▓▓▓▓▓░░░░░░│  ₹8,400  │  │  │
│  │         │  │  │  4. Phone Case     │ 22 ▓▓▓▓▓▓░░░░░░░░│  ₹4,400  │  │  │
│  │         │  │  └────────────────────────────┘                          │  │
│  └─────────┘  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.3 Dashboard Home — Portfolio Variant

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  admin.letbuyy.store/{store}/dashboard  (PORTFOLIO variant)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ SIDEBAR │  │  MAIN CONTENT                                            │  │
│  │         │  │                                                          │  │
│  │ ⌂ Dash  │  │  Good morning, {name}! 🎨                                │  │
│  │ 🏗️ Proj  │  │  {store_name} — Portfolio                                │  │
│  │ 🎯 Skill │  │                                                          │  │
│  │ 💬 Testi │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │ 🧑‍🤝‍🧑 Clnt  │  │  │ PROJECTS │ │ PROFILE  │ │ VISITORS │ │ INQUIRIES│  │  │
│  │ 🖼️ Galry │  │  │ TOTAL    │ │ VIEWS    │ │ (30d)    │ │ (30d)    │  │  │
│  │ ─────── │  │  │          │ │          │ │          │ │          │  │  │
│  │ 📄 Pages │  │  │   24     │ │   156    │ │  1,892   │ │    8     │  │  │
│  │ 🤖 AI    │  │  │          │ │  +18% ↑  │ │  +33% ↑  │ │  +2      │  │  │
│  │ 📈 Anlyt │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │ 🎨 Theme │  │                                                          │  │
│  │ ⚙️ Set  │  │  ┌──────────────────────────────┐ ┌────────────────────┐  │  │
│  │ 🔧 Ext  │  │  │  RECENT PROJECTS              │ │  SKILLS CHART      │  │  │
│  │         │  │  │                              │ │                    │  │  │
│  │         │  │  │  ┌──────┐ ┌──────┐ ┌──────┐ │ │  React    ▓▓▓▓▓▓▓ │  │  │
│  │         │  │  │  │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ │  TypeScript▓▓▓▓▓▓ │  │  │
│  │         │  │  │  │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ │  Flutter  ▓▓▓▓▓  │  │  │
│  │         │  │  │  │ img  │ │ img  │ │ img  │ │ │  Node.js  ▓▓▓▓   │  │  │
│  │         │  │  │  │      │ │      │ │      │ │ │  Python   ▓▓▓    │  │  │
│  │         │  │  │  │App   │ │ Web  │ │ Brand│ │ │  SQL      ▓▓▓▓   │  │  │
│  │         │  │  │  │ v2.0 │ │ Site │ │ Logo │ │ │                    │  │  │
│  │         │  │  │  └──────┘ └──────┘ └──────┘ │ └────────────────────┘  │  │
│  │         │  │  └──────────────────────────────┘                        │  │
│  └─────────┘  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.4 Dashboard Home — Blog Variant

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  admin.letbuyy.store/{store}/dashboard  (BLOG variant)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ SIDEBAR │  │  MAIN CONTENT                                            │  │
│  │         │  │                                                          │  │
│  │ ⌂ Dash  │  │  Welcome back, {name}! ✍️                                │  │
│  │ 📝 Posts │  │  {store_name} — Blog                                     │  │
│  │ 📂 Categ │  │                                                          │  │
│  │ 🏷️ Tags  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │ 💬 Commt │  │  │  POSTS   │ │  READERS │ │ SUBSCRBS │ │ COMMENTS │  │  │
│  │ 📧 News  │  │  │  TOTAL   │ │  (30d)   │ │          │ │  (30d)   │  │  │
│  │ 🖼️ Media │  │  │          │ │          │ │          │ │          │  │  │
│  │ ─────── │  │  │   47     │ │  8,920   │ │   234    │ │   89     │  │  │
│  │ 📄 Pages │  │  │  +3 new  │ │  +12% ↑  │ │  +15     │ │  +22% ↑  │  │  │
│  │ 🤖 AI    │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │ 📈 Anlyt │  │                                                          │  │
│  │ 🎨 Theme │  │  ┌───────────────────────────────────────────────────┐  │  │
│  │ ⚙️ Set  │  │  │  RECENT POSTS                                     │  │  │
│  │ 🔧 Ext  │  │  │                                                   │  │  │
│  │         │  │  │  📝 "10 Tips for TypeScript"    Published 2h ago   │  │  │
│  │         │  │  │     Views: 234  │  Comments: 12  │  ♥ 56           │  │  │
│  │         │  │  │                                                   │  │  │
│  │         │  │  │  📝 "Why Rust is the Future"    Draft              │  │  │
│  │         │  │  │     Last edited: Yesterday                        │  │  │
│  │         │  │  │                                                   │  │  │
│  │         │  │  │  📝 "Getting Started with AI"   Scheduled Mar 5   │  │  │
│  │         │  │  │     Preview: "In this guide..." │  ♥ 0            │  │  │
│  │         │  │  │                                                   │  │  │
│  │         │  │  │  [+ New Post]                                     │  │  │
│  │         │  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────┘  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. E-Commerce Engine

### 13.1 Product Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  admin.letbuyy.store/{store}/products/new                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ SIDEBAR │  │  Add Product                     [Save Draft] [Publish]  │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌───────────────────────────────────┐ ┌──────────────┐  │  │
│  │         │  │  │  BASIC INFO                       │ │  STATUS      │  │  │
│  │         │  │  │                                   │ │              │  │  │
│  │         │  │  │  Title *                          │ │  ○ Draft     │  │  │
│  │         │  │  │  ┌────────────────────────────┐  │ │  ● Active    │  │  │
│  │         │  │  │  │  Cotton T-Shirt            │  │ │  ○ Archived  │  │  │
│  │         │  │  │  └────────────────────────────┘  │ │              │  │  │
│  │         │  │  │                                   │ │  VISIBILITY  │  │  │
│  │         │  │  │  Slug (auto-generated):           │ │  ☑ Storefront│  │  │
│  │         │  │  │  cotton-t-shirt                   │ │  ☑ Search    │  │  │
│  │         │  │  │                                   │ └──────────────┘  │  │
│  │         │  │  │  Description (Tiptap Rich Editor) │                   │  │
│  │         │  │  │  ┌────────────────────────────┐  │ ┌──────────────┐  │  │
│  │         │  │  │  │ B I U S │ H1 H2 │ • 1. │🖼│  │ │  CATEGORY    │  │  │
│  │         │  │  │  ├────────────────────────────┤  │ │              │  │  │
│  │         │  │  │  │                            │  │ │  ☐ Clothing  │  │  │
│  │         │  │  │  │  A premium cotton t-shirt  │  │ │    ☑ T-Shirts│  │  │
│  │         │  │  │  │  with a comfortable fit    │  │ │    ☐ Hoodies │  │  │
│  │         │  │  │  │  and modern design.        │  │ │  ☐ Shoes     │  │  │
│  │         │  │  │  │                            │  │ │  ☐ Accessories│ │  │
│  │         │  │  │  └────────────────────────────┘  │ └──────────────┘  │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  [🤖 Generate with AI]            │ ┌──────────────┐  │  │
│  │         │  │  └───────────────────────────────────┘ │  TAGS        │  │  │
│  │         │  │                                         │              │  │  │
│  │         │  │  ┌───────────────────────────────────┐ │ [cotton]     │  │  │
│  │         │  │  │  IMAGES                           │ │ [casual]     │  │  │
│  │         │  │  │                                   │ │ [summer]     │  │  │
│  │         │  │  │  ┌──────┐ ┌──────┐ ┌──────┐     │ │ [+ Add Tag]  │  │  │
│  │         │  │  │  │      │ │      │ │  +   │     │ └──────────────┘  │  │
│  │         │  │  │  │ img1 │ │ img2 │ │ ADD  │     │                   │  │
│  │         │  │  │  │      │ │      │ │      │     │                   │  │
│  │         │  │  │  └──────┘ └──────┘ └──────┘     │                   │  │
│  │         │  │  │  Drag to reorder │ Max 10 images │                   │  │
│  │         │  │  └───────────────────────────────────┘                   │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌───────────────────────────────────┐                   │  │
│  │         │  │  │  PRICING                          │                   │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  Price *        Compare at Price   │                   │  │
│  │         │  │  │  ┌────────┐    ┌────────┐         │                   │  │
│  │         │  │  │  │ ₹ 599  │    │ ₹ 999  │         │                   │  │
│  │         │  │  │  └────────┘    └────────┘         │                   │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  Cost per Item   Margin            │                   │  │
│  │         │  │  │  ┌────────┐    ┌────────┐         │                   │  │
│  │         │  │  │  │ ₹ 250  │    │  58.3% │ (auto)  │                   │  │
│  │         │  │  │  └────────┘    └────────┘         │                   │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  ☑ Charge GST    GST Rate:  [18%] │                   │  │
│  │         │  │  │  ☑ Tax included in price          │                   │  │
│  │         │  │  └───────────────────────────────────┘                   │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌───────────────────────────────────┐                   │  │
│  │         │  │  │  VARIANTS                         │                   │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  ☑ This product has variants      │                   │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  Option 1: [  Size  ▼ ]           │                   │  │
│  │         │  │  │  Values:  [S] [M] [L] [XL] [+ ]  │                   │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  Option 2: [  Color ▼ ]           │                   │  │
│  │         │  │  │  Values:  [Red] [Blue] [Black][+] │                   │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  [+ Add another option]           │                   │  │
│  │         │  │  │                                   │                   │  │
│  │         │  │  │  VARIANT MATRIX (auto-generated): │                   │  │
│  │         │  │  │  ┌─────┬───────┬──────┬──────┬──┐│                   │  │
│  │         │  │  │  │Var  │ SKU   │Price │Stock │☑ ││                   │  │
│  │         │  │  │  ├─────┼───────┼──────┼──────┼──┤│                   │  │
│  │         │  │  │  │S/Red│TSR001 │ ₹599 │  50  │☑ ││                   │  │
│  │         │  │  │  │S/Blu│TSB001 │ ₹599 │  30  │☑ ││                   │  │
│  │         │  │  │  │M/Red│TMR001 │ ₹649 │  45  │☑ ││                   │  │
│  │         │  │  │  │M/Blu│TMB001 │ ₹649 │  25  │☑ ││                   │  │
│  │         │  │  │  │...  │...    │...   │...   │  ││                   │  │
│  │         │  │  │  └─────┴───────┴──────┴──────┴──┘│                   │  │
│  │         │  │  └───────────────────────────────────┘                   │  │
│  └─────────┘  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Cart & Checkout Flow (PLANNED — Not Yet Built)

```
┌─────────────── CHECKOUT FLOW ─────────────────────────────────────────────┐
│  {store}.letbuyy.store/checkout                                            │
│                                                                            │
│  STATUS: ❌ NOT IMPLEMENTED (Critical gap)                                  │
│  ESTIMATED EFFORT: 40-60 hours                                             │
│                                                                            │
│  STEP 1: CART REVIEW                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                                                                  │     │
│  │  🛒 Your Cart (3 items)                                          │     │
│  │                                                                  │     │
│  │  ┌──────┐  Cotton T-Shirt (M, Blue)      [−] 2 [+]    ₹1,298  │     │
│  │  │ img  │  SKU: TMB001                                          │     │
│  │  └──────┘                                          [🗑 Remove]  │     │
│  │                                                                  │     │
│  │  ┌──────┐  Canvas Bag                    [−] 1 [+]      ₹450  │     │
│  │  │ img  │  SKU: CB001                                           │     │
│  │  └──────┘                                          [🗑 Remove]  │     │
│  │  ──────────────────────────────────────────────────────────────  │     │
│  │  Subtotal                                           ₹1,748     │     │
│  │  Shipping (calculated at checkout)                     TBD     │     │
│  │  GST (18%)                                            ₹314     │     │
│  │  ──────────────────────────────────────────────────────────────  │     │
│  │  TOTAL                                              ₹2,062     │     │
│  │                                                                  │     │
│  │  Coupon Code: [           ] [Apply]                             │     │
│  │                                                                  │     │
│  │  ┌────────────────────────────────────┐                         │     │
│  │  │         Proceed to Checkout →       │                         │     │
│  │  └────────────────────────────────────┘                         │     │
│  │                                                                  │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                            │
│  STEP 2: SHIPPING                                                          │
│  Customer info + address selection + shipping method selection              │
│                                                                            │
│  STEP 3: PAYMENT SELECTION                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │  Choose payment method:                                          │     │
│  │                                                                  │     │
│  │  ● Razorpay (UPI, Cards, Netbanking)  — India                   │     │
│  │  ○ Stripe (Credit/Debit Card)         — International           │     │
│  │  ○ PayPal                             — International           │     │
│  │  ○ Cash on Delivery                   — Select pincodes only    │     │
│  │                                                                  │     │
│  │  ⚠️ Server-side price verification:                              │     │
│  │     Cart prices MUST be re-fetched from DB on checkout.          │     │
│  │     NEVER trust client-sent prices.                              │     │
│  │                                                                  │     │
│  │  ┌────────────────────────────────────┐                         │     │
│  │  │         Pay ₹2,062 →               │                         │     │
│  │  └────────────────────────────────────┘                         │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                            │
│  STEP 4: ORDER CONFIRMATION                                                │
│  Order number, summary, estimated delivery, email receipt                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Storefront Rendering Pipeline

### 14.1 SSR/ISR Architecture

```
┌─────────────── STOREFRONT RENDERING ──────────────────────────────────────┐
│                                                                            │
│  REQUEST: https://{store}.letbuyy.store/products/{slug}                    │
│                                                                            │
│  1. DNS: *.letbuyy.store → Vercel                                         │
│  2. Vercel routing: Next.js dynamic route [subdomain]/**                  │
│  3. Middleware extracts subdomain from hostname                           │
│  4. Database lookup (ISR cached, 60s revalidation):                       │
│     SELECT * FROM sites WHERE subdomain = $1 AND status = 'published'     │
│  5. Theme resolution:                                                      │
│     SELECT t.* FROM themes t                                              │
│     JOIN theme_installs ti ON ti.theme_id = t.id                         │
│     WHERE ti.site_id = $1 AND ti.active = true                           │
│  6. Content fetch (product, pages, navigation via RLS)                    │
│  7. SSR with theme's React components + store data                        │
│  8. Return HTML with:                                                      │
│     - <meta> tags for SEO                                                 │
│     - Open Graph tags                                                     │
│     - JSON-LD structured data                                             │
│     - Tailwind CSS (inlined critical path)                                │
│                                                                            │
│  CACHING STRATEGY:                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │  ISR Revalidation Intervals:                                     │     │
│  │  ├── Homepage:        60s (near-realtime)                       │     │
│  │  ├── Product list:    60s                                       │     │
│  │  ├── Product detail:  300s (5 min)                              │     │
│  │  ├── Blog post:       3600s (1 hour)                            │     │
│  │  ├── Static pages:    86400s (24 hours)                         │     │
│  │  └── On-demand:       webhookRevalidation() on admin changes    │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                            │
│  THEME STRUCTURE (per theme package):                                      │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │  themes/{theme-name}/                                            │     │
│  │  ├── components/                                                │     │
│  │  │   ├── Header.tsx                                             │     │
│  │  │   ├── Footer.tsx                                             │     │
│  │  │   ├── ProductCard.tsx                                        │     │
│  │  │   ├── ProductGrid.tsx                                        │     │
│  │  │   ├── CartSidebar.tsx                                        │     │
│  │  │   └── ...                                                    │     │
│  │  ├── layouts/                                                   │     │
│  │  │   ├── StoreLayout.tsx                                        │     │
│  │  │   └── BlogLayout.tsx                                         │     │
│  │  ├── styles/                                                    │     │
│  │  │   └── theme.css                                              │     │
│  │  ├── theme.json (metadata: name, version, settings schema)     │     │
│  │  └── preview.png                                                │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Resume Builder

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  admin.letbuyy.store/{store}/experience  (RESUME site type)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ SIDEBAR │  │  Resume Builder                    [Preview] [Export PDF] │  │
│  │         │  │                                                          │  │
│  │ ⌂ Dash  │  │  ┌── SECTIONS (drag to reorder) ──────────────────────┐  │  │
│  │ 💼 Exper │  │  │                                                    │  │  │
│  │ 🎓 Educa │  │  │  ≡ PERSONAL INFO                          [Edit]  │  │  │
│  │ 🏆 Certs │  │  │    Name: {Full Name}                               │  │  │
│  │ 🔧 Skill │  │  │    Title: Senior Software Engineer                 │  │  │
│  │ 📊 ATS   │  │  │    Email: user@email.com │ Phone: +91 98765 43210 │  │  │
│  │ 📤 Export│  │  │    Location: Bengaluru, India                      │  │  │
│  │ ─────── │  │  │    LinkedIn: /in/username │ GitHub: @username       │  │  │
│  │ 📄 Pages │  │  │                                                    │  │  │
│  │ 🤖 AI    │  │  │  ≡ PROFESSIONAL SUMMARY                   [Edit]  │  │  │
│  │ 📈 Anlyt │  │  │    "Experienced software engineer with 5+ years   │  │  │
│  │ ⚙️ Set  │  │  │    of expertise in full-stack development..."      │  │  │
│  │         │  │  │    [🤖 Rewrite with AI]                             │  │  │
│  │         │  │  │                                                    │  │  │
│  │         │  │  │  ≡ WORK EXPERIENCE                          [+ Add] │  │  │
│  │         │  │  │    ┌───────────────────────────────────────────┐   │  │  │
│  │         │  │  │    │ Senior Engineer — TechCorp               │   │  │  │
│  │         │  │  │    │ 2022 – Present  │  Bengaluru             │   │  │  │
│  │         │  │  │    │                                          │   │  │  │
│  │         │  │  │    │ • Led a team of 5 engineers to build...  │   │  │  │
│  │         │  │  │    │ • Reduced API latency by 40% through... │   │  │  │
│  │         │  │  │    │                                          │   │  │  │
│  │         │  │  │    │ [Edit] [Delete] [≡ Drag]                 │   │  │  │
│  │         │  │  │    └───────────────────────────────────────────┘   │  │  │
│  │         │  │  │    ┌───────────────────────────────────────────┐   │  │  │
│  │         │  │  │    │ Software Engineer — StartupXYZ            │   │  │  │
│  │         │  │  │    │ 2019 – 2022  │  Mumbai                   │   │  │  │
│  │         │  │  │    │ • Designed microservices architecture...  │   │  │  │
│  │         │  │  │    └───────────────────────────────────────────┘   │  │  │
│  │         │  │  │                                                    │  │  │
│  │         │  │  │  ≡ EDUCATION                                [+ Add] │  │  │
│  │         │  │  │    B.Tech Computer Science — IIT Delhi             │  │  │
│  │         │  │  │    2015 – 2019  │  CGPA: 8.9/10                   │  │  │
│  │         │  │  │                                                    │  │  │
│  │         │  │  │  ≡ SKILLS                                   [Edit]  │  │  │
│  │         │  │  │    [React] [TypeScript] [Node.js] [Python]        │  │  │
│  │         │  │  │    [PostgreSQL] [Redis] [Docker] [AWS]            │  │  │
│  │         │  │  │                                                    │  │  │
│  │         │  │  │  ≡ CERTIFICATIONS                           [+ Add] │  │  │
│  │         │  │  │    AWS Solutions Architect — 2023                  │  │  │
│  │         │  │  │    Google Cloud Professional — 2022                │  │  │
│  │         │  │  │                                                    │  │  │
│  │         │  │  └────────────────────────────────────────────────────┘  │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌── ATS SCORE ──────────────────────────────────────┐  │  │
│  │         │  │  │  Score: ████████████████████░░░░ 78/100            │  │  │
│  │         │  │  │                                                    │  │  │
│  │         │  │  │  ✅ Keywords matched: 12/15                        │  │  │
│  │         │  │  │  ✅ Proper formatting                              │  │  │
│  │         │  │  │  ⚠️ Missing: Quantified achievements in 2 roles    │  │  │
│  │         │  │  │  ❌ No volunteer/extracurricular section            │  │  │
│  │         │  │  │                                                    │  │  │
│  │         │  │  │  [🤖 Optimize with AI]                             │  │  │
│  │         │  │  └────────────────────────────────────────────────────┘  │  │
│  └─────────┘  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Landing Page Builder

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  admin.letbuyy.store/{store}/sections  (LANDING PAGE site type)              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ SIDEBAR │  │  Landing Page Builder              [Preview] [Publish]   │  │
│  │         │  │                                                          │  │
│  │ ⌂ Dash  │  │  PAGE SECTIONS (drag to reorder):                       │  │
│  │ 📄 Sects │  │                                                          │  │
│  │ ✅ Forms │  │  ┌── 1. HERO ────────────────────────────────── [⚙️] ──┐  │  │
│  │ 🎯 CTA  │  │  │                                                     │  │  │
│  │ 📊 A/B  │  │  │  Layout:  [Image Right ▼]   Background: [Gradient ▼]│  │  │
│  │ ─────── │  │  │                                                     │  │  │
│  │ 🤖 AI   │  │  │  Headline: "Build. Launch. Scale."                  │  │  │
│  │ 📈 Anlyt│  │  │  Subheadline: "The fastest way to go online"        │  │  │
│  │ ⚙️ Set  │  │  │  CTA 1: [Get Started →]   CTA 2: [Learn More]      │  │  │
│  │         │  │  │  Hero Image: [📷 Upload] [🤖 Generate with AI]      │  │  │
│  │         │  │  │                                                     │  │  │
│  │         │  │  └──────────────────────────────────────────────────────┘  │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌── 2. FEATURES ─────────────────────────── [⚙️] ──┐  │  │
│  │         │  │  │  Columns: [3 ▼]   Icons: [Lucide ▼]               │  │  │
│  │         │  │  │                                                     │  │  │
│  │         │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐           │  │  │
│  │         │  │  │  │ 🚀      │  │ 🔒      │  │ ⚡      │           │  │  │
│  │         │  │  │  │ Fast    │  │ Secure  │  │ Simple │           │  │  │
│  │         │  │  │  │ Deploy  │  │ by      │  │ Setup  │           │  │  │
│  │         │  │  │  │ to edge │  │ default │  │ wizard │           │  │  │
│  │         │  │  │  └─────────┘  └─────────┘  └─────────┘           │  │  │
│  │         │  │  │  [+ Add Feature]                                   │  │  │
│  │         │  │  └──────────────────────────────────────────────────────┘  │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌── 3. TESTIMONIALS ─────────────────────── [⚙️] ──┐  │  │
│  │         │  │  │  "This product changed our workflow..."             │  │  │
│  │         │  │  │  — Jane Smith, CEO @ TechCo                        │  │  │
│  │         │  │  │  [+ Add Testimonial]                               │  │  │
│  │         │  │  └──────────────────────────────────────────────────────┘  │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌── 4. PRICING ──────────────────────────── [⚙️] ──┐  │  │
│  │         │  │  │  Plans: [3 ▼]   Billing Toggle: [Monthly/Annual]   │  │  │
│  │         │  │  │  [ Configure pricing tiers... ]                     │  │  │
│  │         │  │  └──────────────────────────────────────────────────────┘  │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌── 5. CTA / FOOTER ─────────────────────── [⚙️] ──┐  │  │
│  │         │  │  │  Final CTA: "Ready to get started?"                │  │  │
│  │         │  │  │  [Sign Up Free →]                                  │  │  │
│  │         │  │  └──────────────────────────────────────────────────────┘  │  │
│  │         │  │                                                          │  │
│  │         │  │  [+ Add Section]  Available: FAQ, Stats, Logo Cloud,    │  │
│  │         │  │                   Newsletter, Contact Form, Gallery     │  │
│  └─────────┘  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. AI Studio

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  admin.letbuyy.store/{store}/ai-studio                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ SIDEBAR │  │  🤖 AI Studio              Credits: 42/500 remaining    │  │
│  │         │  │                                                          │  │
│  │         │  │  4-MODEL INTELLIGENCE ROUTING:                           │  │
│  │         │  │  ┌──────────────────────────────────────────────────┐   │  │
│  │         │  │  │  🟢 Gemini Flash  — Quick tasks: titles, tags,   │   │  │
│  │         │  │  │                    descriptions, summaries       │   │  │
│  │         │  │  │  🔵 Gemini Pro    — Complex: full posts, product │   │  │
│  │         │  │  │                    descriptions, SEO content     │   │  │
│  │         │  │  │  🟣 Claude Sonnet — Creative: marketing copy,    │   │  │
│  │         │  │  │                    brand voice, storytelling     │   │  │
│  │         │  │  │  🟡 Claude Opus   — Premium: strategy, analysis, │   │  │
│  │         │  │  │                    long-form content (3x credits)│   │  │
│  │         │  │  └──────────────────────────────────────────────────┘   │  │
│  │         │  │                                                          │  │
│  │         │  │  QUICK ACTIONS:                                          │  │
│  │         │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │  │
│  │         │  │  │ 📝 Write    │ │ 🔄 Rewrite  │ │ 🌐 Translate│       │  │
│  │         │  │  │ Blog Post   │ │ Content     │ │ to Hindi    │       │  │
│  │         │  │  └─────────────┘ └─────────────┘ └─────────────┘       │  │
│  │         │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │  │
│  │         │  │  │ 🛒 Product  │ │ 📊 SEO      │ │ ✉️ Email    │       │  │
│  │         │  │  │ Description │ │ Optimize    │ │ Campaign    │       │  │
│  │         │  │  └─────────────┘ └─────────────┘ └─────────────┘       │  │
│  │         │  │                                                          │  │
│  │         │  │  PROMPT:                                                 │  │
│  │         │  │  ┌──────────────────────────────────────────────────┐   │  │
│  │         │  │  │                                                  │   │  │
│  │         │  │  │  Write a compelling product description for a    │   │  │
│  │         │  │  │  premium cotton t-shirt targeting young adults   │   │  │
│  │         │  │  │  in India...                                     │   │  │
│  │         │  │  │                                                  │   │  │
│  │         │  │  └──────────────────────────────────────────────────┘   │  │
│  │         │  │                                                          │  │
│  │         │  │  Model: [Auto-select ▼]  Tone: [Professional ▼]        │  │
│  │         │  │  Length: [Medium ▼]      Language: [English ▼]          │  │
│  │         │  │                                                          │  │
│  │         │  │  ┌────────────────────────────────────┐                 │  │
│  │         │  │  │    Generate (costs 1 credit) →      │                 │  │
│  │         │  │  └────────────────────────────────────┘                 │  │
│  └─────────┘  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

> **Continued in Part 4:** Complete Implementation Roadmap (Phases 0-5), payment system analysis, marketplace architecture, Super Admin console, monitoring/observability plan, and cost projections.
