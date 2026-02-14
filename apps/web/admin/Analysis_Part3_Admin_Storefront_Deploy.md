# LetBuyy Multi-Tenant Store Platform — Comprehensive Analysis

> **Part 3 of 7** | Admin Dashboard, Storefront, Launching Soon, Deployment & Testing
>
> **Date:** February 13, 2026 | **Version:** 3.0 (Blog-Integrated)
>
> **Prev:** [Part 2](./Analysis_Part2_Implementation_Onboarding_Email.md) (Onboarding UI) | **Next:** [Part 4](./Analysis_Part4_Blog_Database_AdminCRUD.md) (Blog System)

---

## 11. Admin Dashboard — Wireframe (Post-Onboarding)

### 11.1 Admin Dashboard Landing — `admin.letbuyy.store/{subdomain}`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  🅛  LetBuyy Admin     │  mystore.letbuyy.store  │  [👤]  [🌙] [EN]│  │
│  │  ← logo               │  ← current store        │  user  theme lang│  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────┐  ┌─────────────────────────────────────────────────────┐  │
│  │            │  │                                                     │  │
│  │  SIDEBAR   │  │              MAIN CONTENT AREA                     │  │
│  │            │  │                                                     │  │
│  │ ┌────────┐ │  │  ┌─────────────────────────────────────────────┐   │  │
│  │ │📊 Dash │ │  │  │              Welcome Back!                  │   │  │
│  │ │ board  │ │  │  │                                             │   │  │
│  │ └────────┘ │  │  │  Your E-commerce Store is in DRAFT mode    │   │  │
│  │ ┌────────┐ │  │  │                                             │   │  │
│  │ │🛍 Prods│ │  │  │  ┌──────────────────────────────────────┐  │   │  │
│  │ └────────┘ │  │  │  │  Publish your store to make it live │  │   │  │
│  │ ┌────────┐ │  │  │  └──────────────────────────────────────┘  │   │  │
│  │ │📦 Orders│ │  │  │                                             │   │  │
│  │ └────────┘ │  │  └─────────────────────────────────────────────┘   │  │
│  │ ┌────────┐ │  │                                                     │  │
│  │ │🎨 Theme│ │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │  │
│  │ └────────┘ │  │  │          │ │          │ │          │          │  │
│  │ ┌────────┐ │  │  │ Total    │ │ Total    │ │  Store   │          │  │
│  │ │⚙ Sett │ │  │  │ Products │ │ Orders   │ │ Status   │          │  │
│  │ │ -ings  │ │  │  │    0     │ │    0     │ │  Draft   │          │  │
│  │ └────────┘ │  │  │          │ │          │ │          │          │  │
│  │ ┌────────┐ │  │  └──────────┘ └──────────┘ └──────────┘          │  │
│  │ │🌐 Domain│ │  │                                                     │  │
│  │ └────────┘ │  │  Quick Actions:                                     │  │
│  │            │  │  ┌────────────────┐ ┌────────────────┐             │  │
│  │            │  │  │ + Add Product  │ │ 🎨 Customize   │             │  │
│  │            │  │  │               │ │    Theme       │             │  │
│  │            │  │  └────────────────┘ └────────────────┘             │  │
│  │            │  │                                                     │  │
│  │            │  │  ┌────────────────┐ ┌────────────────┐             │  │
│  │            │  │  │ 🌐 View Store  │ │ 📊 Analytics   │             │  │
│  │            │  │  │  (Preview)     │ │               │             │  │
│  │            │  │  └────────────────┘ └────────────────┘             │  │
│  │            │  │                                                     │  │
│  └────────────┘  └─────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Admin — Different Store Types

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN SIDEBAR VARIATIONS                                        │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────────────────────┤
│ E-COMMERCE   │ PORTFOLIO    │ RESUME / CV  │ LANDING PAGE │ BLOGGER (NEW)                │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────────────────────┤
│ 📊 Dashboard │ 📊 Dashboard │ 📊 Dashboard │ 📊 Dashboard │ 📊 Dashboard                 │
│ 🛍 Products  │ 💼 Projects  │ 👤 Profile   │ 📝 Content   │ 📝 Posts (CRUD + Rich Editor)│
│ 📦 Orders    │ 📸 Gallery   │ 💼 Experience│ 📊 Analytics │ 📁 Categories                │
│ 👥 Customers │ 📝 Blog      │ 🎓 Education │ 📧 Leads     │ 🏷 Tags                      │
│ 💰 Payments  │ 📄 About     │ 🏆 Skills    │ 🎨 Theme     │ 💬 Comments (Moderation)     │
│ 📊 Analytics │ 📊 Analytics │📄 Certif.    │ ⚙ Settings  │ 📸 Media Library             │
│ 🎨 Theme     │ 🎨 Theme     │ 📊 Analytics │ 🌐 Domain    │ 📊 Analytics                 │
│ ⚙ Settings  │ ⚙ Settings  │ 🎨 Theme     │              │ 🎨 Theme                     │
│ 🌐 Domain    │ 🌐 Domain    │ ⚙ Settings  │              │ ⚙ Settings                  │
│              │              │ 🌐 Domain    │              │ 🌐 Domain                    │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────────────────────┘
```

---

## 12. Storefront — "Launching Soon" Page Wireframe

### 12.1 Draft Store — `{subdomain}.letbuyy.store` (Not Published)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                         ┌────────┐                                          │
│                         │ LetBuyy│                                          │
│                         │  Logo  │                                          │
│                         └────────┘                                          │
│                                                                             │
│                                                                             │
│                    ╔═══════════════════════╗                                │
│                    ║                       ║                                │
│                    ║    🚀 Launching Soon   ║                                │
│                    ║                       ║                                │
│                    ╚═══════════════════════╝                                │
│                                                                             │
│                                                                             │
│                     We're building something                               │
│                     amazing. Stay tuned!                                    │
│                                                                             │
│                                                                             │
│               ┌──────────────────────────────────┐                         │
│               │                                  │                         │
│               │   Store:     mystore             │                         │
│               │   Type:      E-commerce Store    │                         │
│               │   Status:    Coming Soon         │                         │
│               │   Owner:     user@example.com    │                         │
│               │                                  │                         │
│               └──────────────────────────────────┘                         │
│                   ↑ Info card (subtle, rounded)                             │
│                                                                             │
│                                                                             │
│               ┌──────────────────────────────────┐                         │
│               │       Notify Me When Live        │                         │
│               └──────────────────────────────────┘                         │
│                   ↑ Optional: email notification signup                     │
│                                                                             │
│                                                                             │
│                     Powered by LetBuyy                                     │
│                     letbuyy.store                                          │
│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

  Background: Gradient or subtle animated pattern
  Color scheme: Uses store type color accent
  
  E-commerce → Purple accent
  Portfolio  → Blue accent
  Resume     → Green accent  
  Landing    → Orange accent
```

### 12.2 Published Store — Live Storefront (Conceptual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  🅛  MyStore           │  Shop  About  Contact   │  🛒 Cart (0)     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │                     HERO BANNER                                      │  │
│  │                                                                      │  │
│  │                Welcome to MyStore                                    │  │
│  │                Your tagline here                                     │  │
│  │                                                                      │  │
│  │                [  Shop Now  →  ]                                      │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Featured Products                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │                  │
│  │ │ IMG  │ │  │ │ IMG  │ │  │ │ IMG  │ │  │ │ IMG  │ │                  │
│  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │                  │
│  │ Product 1│  │ Product 2│  │ Product 3│  │ Product 4│                  │
│  │ ₹499     │  │ ₹799     │  │ ₹1,299   │  │ ₹299     │                  │
│  │[Add Cart]│  │[Add Cart]│  │[Add Cart]│  │[Add Cart]│                  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  © MyStore 2026  •  Powered by LetBuyy  •  Privacy  •  Terms        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Dark Mode — Full Comparison

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      LIGHT MODE vs DARK MODE                                 │
├──────────────────────────────────┬───────────────────────────────────────────┤
│         LIGHT MODE               │          DARK MODE                        │
│                                  │                                           │
│  ┌────────────────────────────┐  │  ┌────────────────────────────┐          │
│  │ bg: #FFFFFF               │  │  │ bg: #0A0F1A               │          │
│  │ card: #FFFFFF             │  │  │ card: #1E293B             │          │
│  │ text: #0F172A             │  │  │ text: #FFFFFF             │          │
│  │ border: #E2E8F0           │  │  │ border: #334155           │          │
│  │                            │  │  │                            │          │
│  │  ┌──────────────────────┐ │  │  │  ╔══════════════════════╗ │          │
│  │  │                      │ │  │  │  ║                      ║ │          │
│  │  │    [LetBuyy Logo]    │ │  │  │  ║    [LetBuyy Logo]    ║ │          │
│  │  │                      │ │  │  │  ║                      ║ │          │
│  │  │  ┌────────┐┌────────┐│ │  │  │  ║  ┌────────┐┌────────┐║ │          │
│  │  │  │████████││░░░░░░░░││ │  │  │  ║  │████████││░░░░░░░░│║ │          │
│  │  │  └────────┘└────────┘│ │  │  │  ║  └────────┘└────────┘║ │          │
│  │  │                      │ │  │  │  ║                      ║ │          │
│  │  │  What do you want    │ │  │  │  ║  What do you want    ║ │          │
│  │  │  to build?           │ │  │  │  ║  to build?           ║ │          │
│  │  │                      │ │  │  │  ║                      ║ │          │
│  │  │  ┌────────┬────────┐ │ │  │  │  ║  ┌────────┬────────┐ ║ │          │
│  │  │  │ 🛒 Card│ 💼 Card│ │ │  │  │  ║  │ 🛒 Card│ 💼 Card│ ║ │          │
│  │  │  │ White  │ White  │ │ │  │  │  ║  │ #0F172A│ #0F172A│ ║ │          │
│  │  │  │ bg     │ bg     │ │ │  │  │  ║  │ bg     │ bg     │ ║ │          │
│  │  │  └────────┴────────┘ │ │  │  │  ║  └────────┴────────┘ ║ │          │
│  │  │                      │ │  │  │  ║                      ║ │          │
│  │  │  ┌──────────────────┐│ │  │  │  ║  ┌──────────────────┐║ │          │
│  │  │  │     Next →       ││ │  │  │  ║  │     Next →       │║ │          │
│  │  │  │  #8B5CF6 (same)  ││ │  │  │  ║  │  #8B5CF6 (same)  │║ │          │
│  │  │  └──────────────────┘│ │  │  │  ║  └──────────────────┘║ │          │
│  │  └──────────────────────┘ │  │  │  ╚══════════════════════╝ │          │
│  │ bg-secondary: #F8FAFC    │  │  │ bg-secondary: #0F172A     │          │
│  └────────────────────────────┘  │  └────────────────────────────┘          │
│                                  │                                           │
│  Primary button: Always #8B5CF6  │  Primary button: Always #8B5CF6          │
│  ← Consistent purple across     │  ← Same purple accent in dark            │
│     both modes                   │     mode                                 │
└──────────────────────────────────┴───────────────────────────────────────────┘
```

---

## 14. Multi-Language Support — UI Comparison

```
┌──────────────────────────────────────────────────────────────────────────┐
│               LANGUAGE TOGGLE: EN → HI → TA → EN (cycle)               │
├──────────────────────┬────────────────────────┬─────────────────────────┤
│     ENGLISH (EN)     │      HINDI (HI)        │     TAMIL (TA)         │
├──────────────────────┼────────────────────────┼─────────────────────────┤
│                      │                        │                         │
│  What do you want    │  आप क्या बनाना          │ நீங்கள் என்ன உருவாக்க   │
│  to build?           │  चाहते हैं?              │ விரும்புகிறீர்கள்?       │
│                      │                        │                         │
│  Choose your site    │  शुरू करने के लिए       │ தொடங்க உங்கள்           │
│  type to get started │  अपनी साइट का         │ தள வகையைத்              │
│                      │  प्रकार चुनें            │ தேர்ந்தெடுக்கவும்        │
│                      │                        │                         │
│  ┌───────────────┐   │  ┌───────────────┐     │  ┌───────────────┐      │
│  │ 🛒 E-commerce │   │  │ 🛒 ई-कॉमर्स    │     │  │ 🛒 மின் வணிக  │      │
│  │    Store      │   │  │    स्टोर       │     │  │    கடை       │      │
│  │ Sell products │   │  │ ऑनलाइन उत्पाद │     │  │ ஆன்லைனில்    │      │
│  │ online        │   │  │ बेचें           │     │  │ தயாரிப்புகளை  │      │
│  └───────────────┘   │  └───────────────┘     │  │ விற்கவும்     │      │
│                      │                        │  └───────────────┘      │
│  [  Next  →  ]       │  [  आगे  →  ]          │  [  அடுத்து  →  ]       │
│                      │                        │                         │
└──────────────────────┴────────────────────────┴─────────────────────────┘
```

---

## 15. Deployment Checklist

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT CHECKLIST — FRESH SETUP                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Infrastructure Setup                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [ ] 1. Create new Cloudflare account                             │   │
│  │ [ ] 2. Add letbuyy.store domain to Cloudflare                   │   │
│  │ [ ] 3. Update nameservers at registrar                          │   │
│  │ [ ] 4. Wait for DNS propagation (5-60 min)                      │   │
│  │ [ ] 5. Configure all 8 DNS records (see Part 1, §5.1)          │   │
│  │ [ ] 6. Set SSL to Full (strict) mode                            │   │
│  │ [ ] 7. Enable HSTS, TLS 1.3, Always HTTPS                      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  PHASE 2: Vercel Setup                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [ ] 1. Create new Vercel account (or use existing)               │   │
│  │ [ ] 2. Connect GitHub repository                                │   │
│  │ [ ] 3. Create 6 Vercel projects:                                │   │
│  │ [ ]    a. letbuyy-landing     (letbuyy.store)                   │   │
│  │ [ ]    b. letbuyy-accounts    (accounts.letbuyy.store)          │   │
│  │ [ ]    c. letbuyy-admin       (admin.letbuyy.store)             │   │
│  │ [ ]    d. letbuyy-console     (console.letbuyy.store)           │   │
│  │ [ ]    e. letbuyy-team        (team.letbuyy.store)              │   │
│  │ [ ]    f. letbuyy-storefront  (*.letbuyy.store)                 │   │
│  │ [ ] 4. Add custom domains to each project                      │   │
│  │ [ ] 5. Add wildcard domain (*.letbuyy.store) to storefront     │   │
│  │ [ ] 6. Verify SSL certs for all domains                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  PHASE 3: Database Setup                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [ ] 1. Create Supabase project                                   │   │
│  │ [ ] 2. Run stores table migration                               │   │
│  │ [ ] 3. Run email_logs table migration                           │   │
│  │ [ ] 4. Run onboarding_attempts table migration                  │   │
│  │ [ ] 5. Enable RLS on all 3 tables                               │   │
│  │ [ ] 6. Create RLS policies (6 total)                            │   │
│  │ [ ] 7. Create check_subdomain_available() function              │   │
│  │ [ ] 8. Create update_updated_at_column() trigger                │   │
│  │ [ ] 9. Test RLS by inserting/reading with different users       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  PHASE 4: Environment Variables                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [ ] 1. Set NEXT_PUBLIC_SUPABASE_URL in all Vercel projects      │   │
│  │ [ ] 2. Set NEXT_PUBLIC_SUPABASE_ANON_KEY                       │   │
│  │ [ ] 3. Set SUPABASE_SERVICE_ROLE_KEY (accounts only)            │   │
│  │ [ ] 4. Set RESEND_API_KEY (accounts only)                      │   │
│  │ [ ] 5. Set NEXT_PUBLIC_ADMIN_URL=https://admin.letbuyy.store   │   │
│  │ [ ] 6. Verify Resend domain (letbuyy.store) for email sending  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  PHASE 5: CSS & Code Deployment                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [ ] 1. Add onboarding CSS extensions to globals.css             │   │
│  │ [ ] 2. Deploy onboarding page rewrite                           │   │
│  │ [ ] 3. Deploy login redirect logic (onboarding gate)            │   │
│  │ [ ] 4. Deploy email templates (4 component files)               │   │
│  │ [ ] 5. Deploy email API routes (success + failure)              │   │
│  │ [ ] 6. Deploy sendEmail utility                                 │   │
│  │ [ ] 7. Install new dependencies (react-email, resend, etc.)     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  PHASE 6: Verification                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [ ] 1. Test full signup → onboarding → store creation flow      │   │
│  │ [ ] 2. Verify success email arrives with correct data           │   │
│  │ [ ] 3. Test subdomain conflict → failure email                  │   │
│  │ [ ] 4. Visit {subdomain}.letbuyy.store → "Launching Soon"      │   │
│  │ [ ] 5. Test dark mode toggle across all onboarding states       │   │
│  │ [ ] 6. Test language toggle (EN → HI → TA)                     │   │
│  │ [ ] 7. Test mobile responsiveness (375px, 768px, 1440px)        │   │
│  │ [ ] 8. Verify DNS records with dig commands                     │   │
│  │ [ ] 9. Verify SSL with openssl commands                        │   │
│  │ [ ] 10. Test login redirect: user W/O store → /onboarding      │   │
│  │ [ ] 11. Test login redirect: user WITH store → admin dashboard  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Testing & Validation Matrix

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      TESTING MATRIX                                      │
├─────────────────┬─────────────┬───────────┬──────────────────────────────┤
│ Test Case       │ Type        │ Priority  │ Expected Result              │
├─────────────────┼─────────────┼───────────┼──────────────────────────────┤
│ New user signup │ E2E         │ P0        │ → /onboarding (not admin)    │
│ Existing user   │ E2E         │ P0        │ → admin/{subdomain}          │
│ login (w/store) │             │           │                              │
│ Select site type│ Unit        │ P0        │ Card highlights, Next active │
│ Enter store name│ Unit        │ P0        │ Auto-lowercase, sanitize     │
│ Subdomain taken │ Integration │ P0        │ Error shown, failure email   │
│ Create store OK │ Integration │ P0        │ DB row + success email       │
│ Dark mode toggle│ Visual      │ P1        │ All colors update correctly  │
│ Language toggle │ Visual      │ P1        │ All text updates correctly   │
│ Mobile layout   │ Visual      │ P1        │ 1-col grid, stacked buttons  │
│ Wildcard DNS    │ Infra       │ P0        │ dig *.letbuyy.store → CNAME  │
│ Wildcard SSL    │ Infra       │ P0        │ Valid cert for any subdomain │
│ Draft storefront│ E2E         │ P1        │ "Launching Soon" page shown  │
│ Published store │ E2E         │ P1        │ Live storefront rendered     │
│ Resend email    │ Integration │ P0        │ Email delivered, logged in DB│
│ RLS enforcement │ Security    │ P0        │ Users can't see others' data │
├─────────────────┼─────────────┼───────────┼──────────────────────────────┤
│ BLOG SYSTEM (NEW)                                                       │
├─────────────────┼─────────────┼───────────┼──────────────────────────────┤
│ Create blog post│ E2E         │ P0        │ Post saved, slug generated   │
│ Edit with Tiptap│ Unit        │ P0        │ Rich text renders correctly  │
│ Category CRUD   │ Integration │ P1        │ Create/Edit/Delete works     │
│ Tag assignment  │ Integration │ P1        │ Posts ↔ Tags many-to-many    │
│ Comment moderate│ E2E         │ P1        │ Approve/Reject/Spam works    │
│ Media upload    │ Integration │ P1        │ Image uploaded to Supabase   │
│ Blog RLS        │ Security    │ P0        │ Blog data scoped to site_id  │
│ Blog SEO meta   │ Unit        │ P1        │ Meta tags generated correctly│
└─────────────────┴─────────────┴───────────┴──────────────────────────────┘
```

---

## 17. DNS Verification Commands

```bash
# ── Verify static subdomains ──
dig accounts.letbuyy.store CNAME +short
# Expected: cname.vercel-dns.com

dig admin.letbuyy.store CNAME +short
# Expected: cname.vercel-dns.com

# ── Verify wildcard ──
dig anyrandomname.letbuyy.store CNAME +short
# Expected: cname.vercel-dns.com

# ── Verify SSL ──
echo | openssl s_client -connect accounts.letbuyy.store:443 \
  -servername accounts.letbuyy.store 2>/dev/null | \
  openssl x509 -noout -dates
# Expected: Valid dates, Let's Encrypt or Cloudflare issuer

# ── Verify wildcard SSL ──
echo | openssl s_client -connect teststore.letbuyy.store:443 \
  -servername teststore.letbuyy.store 2>/dev/null | \
  openssl x509 -noout -subject
# Expected: CN=*.letbuyy.store

# ── Verify API workers ──
curl -I https://api.letbuyy.store
# Expected: cf-ray header (Cloudflare proxied)
```

---

## 18. File Structure — All New/Modified Files

```
apps/web/accounts/
├── app/
│   ├── globals.css                      ← [MODIFY] Add onboarding CSS
│   ├── onboarding/
│   │   └── page.tsx                     ← [MODIFY] Complete rewrite
│   └── api/
│       ├── auth/
│       │   └── login/
│       │       └── route.ts             ← [MODIFY] Add store check
│       └── email/
│           ├── store-creation-success/
│           │   └── route.ts             ← [NEW] Success email API
│           └── store-creation-failure/
│               └── route.ts             ← [NEW] Failure email API
├── emails/
│   ├── templates/
│   │   ├── StoreCreatedSuccess.tsx      ← [NEW] Success template
│   │   ├── StoreCreatedFailure.tsx      ← [NEW] Failure template
│   │   └── components/
│   │       ├── EmailLayout.tsx          ← [NEW] Base email layout
│   │       ├── EmailHeader.tsx          ← [NEW] Logo + brand header
│   │       ├── EmailFooter.tsx          ← [NEW] Links + copyright
│   │       └── EmailButton.tsx          ← [NEW] CTA button component
│   └── utils/
│       └── sendEmail.ts                 ← [NEW] Resend wrapper
├── .env.local                           ← [MODIFY] Add RESEND_API_KEY
└── package.json                         ← [MODIFY] Add dependencies

apps/web/admin/
├── app/
│   ├── [subdomain]/
│   │   ├── blog/
│   │   │   ├── posts/
│   │   │   │   ├── page.tsx              ← [NEW] Blog posts list
│   │   │   │   ├── new/page.tsx          ← [NEW] New post editor
│   │   │   │   └── [id]/edit/page.tsx    ← [NEW] Edit post editor
│   │   │   ├── categories/
│   │   │   │   └── page.tsx              ← [NEW] Categories manager
│   │   │   ├── tags/
│   │   │   │   └── page.tsx              ← [NEW] Tags manager
│   │   │   ├── comments/
│   │   │   │   └── page.tsx              ← [NEW] Comment moderation
│   │   │   └── media/
│   │   │       └── page.tsx              ← [NEW] Media library
│   │   └── components/
│   │       ├── TiptapEditor.tsx          ← [NEW] Rich text editor
│   │       ├── MediaUploader.tsx         ← [NEW] Drag & drop media
│   │       ├── SEOPanel.tsx              ← [NEW] SEO metadata editor
│   │       └── CategoryTree.tsx         ← [NEW] Hierarchical categories
│   └── ...
└── package.json                         ← [MODIFY] Add blog dependencies

TOTAL: 6 new files, 4 modified files (original)
     + 11 new blog files, 1 modified file (blog system)
```

---

> **→ Continues in [Part 4](./Analysis_Part4_Blog_Database_AdminCRUD.md):**
> Blog Database Schema (SQL), Admin CRUD Wireframes for Posts, Categories, Tags, Comments, Media

---

> **Complete Series Navigation**
>
> | Part | Content |
> |------|--------|
> | [Part 1](./Analysis_Part1_Architecture_Database_DNS.md) | Architecture, Database Schema, DNS/SSL, Tech Stack |
> | [Part 2](./Analysis_Part2_Implementation_Onboarding_Email.md) | CSS System, Onboarding UI Wireframes, Email Templates |
> | **Part 3** (this) | Admin Dashboard, Storefront, Dark Mode, Deployment |
> | [Part 4](./Analysis_Part4_Blog_Database_AdminCRUD.md) | Blog Database Schema, Admin CRUD Wireframes |
> | [Part 5](./Analysis_Part5_Enhanced_Admin_Features.md) | Bulk Actions, Command Palette, Activity Logs, Notifications |
> | [Part 6](./Analysis_Part6_Ecommerce_Enhancements.md) | Inventory, Multi-Currency, Tax, Shipping, Discounts |
> | [Part 7](./Analysis_Part7_Analytics_Performance_Deploy.md) | Analytics Dashboard, CI/CD, Performance, Security, Scaling |

