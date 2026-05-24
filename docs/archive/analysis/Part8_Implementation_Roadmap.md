# Part 8: Implementation Roadmap & Timeline

> **LetBuyy Platform — Shopify-Inspired Transformation**
> Comprehensive phased rollout plan synthesized from Parts 1–7

---

## Table of Contents

- [33. Executive Summary](#33-executive-summary)
- [34. Phase 1 — Foundation & Auth (Weeks 1–2)](#34-phase-1--foundation--auth-weeks-12)
- [35. Phase 2 — Onboarding & Store Creation (Weeks 3–4)](#35-phase-2--onboarding--store-creation-weeks-34)
- [36. Phase 3 — Admin Dashboards & Site-Type Features (Weeks 5–7)](#36-phase-3--admin-dashboards--site-type-features-weeks-57)
- [37. Phase 4 — Trial, Payment & Billing (Weeks 8–9)](#37-phase-4--trial-payment--billing-weeks-89)
- [38. Phase 5 — Deployment, QA & Launch (Weeks 10–12)](#38-phase-5--deployment-qa--launch-weeks-1012)
- [39. Dependency Map](#39-dependency-map)
- [40. Risk Analysis & Mitigations](#40-risk-analysis--mitigations)
- [41. Success Metrics & KPIs](#41-success-metrics--kpis)
- [42. Post-Launch Roadmap](#42-post-launch-roadmap)

---

## 33. Executive Summary

The LetBuyy Platform transformation converts the existing single-store setup into a multi-tenant, Shopify-inspired SaaS — supporting **5 site types** (E-commerce, Blog, Portfolio, Resume, Landing Page) with individual subdomains, a 14-day free trial, automated billing via Razorpay, and per-tenant admin dashboards.

**Total estimated timeline: 12 weeks (3 months)**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTATION TIMELINE                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Week  1 ──── 2 ──── 3 ──── 4 ──── 5 ──── 6 ──── 7 ──── 8 ──── 9 ──── 10 ── 11 ── 12  │
│  ┌─────────────┐                                                             │
│  │  PHASE 1    │  Foundation & Auth                                          │
│  │  Wk 1–2     │  Supabase, Schema, Auth, URL Routing                       │
│  └─────┬───────┘                                                             │
│        │  ┌─────────────┐                                                    │
│        └──│  PHASE 2    │  Onboarding & Store Creation                       │
│           │  Wk 3–4     │  Site-Type Flows, Store Switcher, Subdomain Gen   │
│           └─────┬───────┘                                                    │
│                 │  ┌───────────────────┐                                      │
│                 └──│     PHASE 3       │  Admin Dashboards & Features         │
│                    │     Wk 5–7        │  5× Dashboard Variants, CRUD        │
│                    └─────┬─────────────┘                                      │
│                          │  ┌─────────────┐                                  │
│                          └──│  PHASE 4    │  Trial, Payment & Billing        │
│                             │  Wk 8–9     │  Razorpay, Countdown, Emails    │
│                             └─────┬───────┘                                  │
│                                   │  ┌───────────────────┐                   │
│                                   └──│     PHASE 5       │  Deploy & Launch  │
│                                      │     Wk 10–12      │  QA, DNS, Go Live │
│                                      └───────────────────┘                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Deliverables per Phase

| Phase | Duration | Primary Deliverables |
|-------|----------|---------------------|
| **Phase 1** | 2 weeks | Supabase migration, database schema, auth system, URL routing |
| **Phase 2** | 2 weeks | Onboarding wizard, store creation, Store Switcher UI, subdomain provisioning |
| **Phase 3** | 3 weeks | 5 admin dashboard variants, CRUD for each site type, media management |
| **Phase 4** | 2 weeks | Trial countdown UI, Razorpay integration, automated billing, email notifications |
| **Phase 5** | 3 weeks | Vercel deployment, DNS/SSL, monitoring, QA, staging, production launch |

---

## 34. Phase 1 — Foundation & Auth (Weeks 1–2)

> **Goal:** Establish the core infrastructure — database, authentication, and URL routing — that all subsequent features depend on.

### Week 1: Database & Supabase Setup

**References:** Part 5 (§17–19), Part 7 (§28)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 1.1 | Create Supabase project, configure environment variables | 4h | 🔴 Critical | — |
| 1.2 | Execute core schema: `stores`, `users`, `user_store_roles` tables | 4h | 🔴 Critical | 1.1 |
| 1.3 | Execute payment tables: `payment_methods`, `payment_transactions`, `subscriptions` | 3h | 🔴 Critical | 1.2 |
| 1.4 | Execute site-type tables: `products`, `blog_posts`, `portfolio_projects`, `resume_profiles`, `landing_pages` | 6h | 🔴 Critical | 1.2 |
| 1.5 | Execute shared tables: `media_files`, `activity_logs`, `store_analytics` | 3h | 🟡 High | 1.2 |
| 1.6 | Apply RLS policies for all tables (per Part 5 §19) | 6h | 🔴 Critical | 1.2–1.5 |
| 1.7 | Create helper functions: `check_trial_status()`, `deactivate_expired_stores()` | 3h | 🟡 High | 1.6 |
| 1.8 | Run migration scripts and verify data integrity | 2h | 🔴 Critical | 1.2–1.7 |

**Subtotal:** ~31 hours

```
stores (core)
  ├── id, owner_id, store_name, subdomain, site_type
  ├── status: 'trial' | 'active' | 'deactivated' | 'suspended'
  ├── trial_ends_at, autopay_enabled
  ├── onboarding_responses (JSONB)
  └── store_config (JSONB)
```

### Week 2: Authentication & URL Routing

**References:** Part 1 (§2–3), Part 7 (§26)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 2.1 | Configure Supabase Auth (email + Google OAuth) | 4h | 🔴 Critical | 1.1 |
| 2.2 | Build auth pages: sign-in, sign-up, forgot password | 8h | 🔴 Critical | 2.1 |
| 2.3 | Implement session management & middleware (Next.js) | 6h | 🔴 Critical | 2.2 |
| 2.4 | Set up URL routing for multi-tenant subdomains | 6h | 🔴 Critical | 2.3 |
| 2.5 | Implement wildcard domain handling in Next.js middleware | 4h | 🔴 Critical | 2.4 |
| 2.6 | Build auth guards: redirect non-onboarded users, protect admin routes | 4h | 🟡 High | 2.3 |
| 2.7 | Test auth flows end-to-end (email, Google, session refresh) | 4h | 🟡 High | 2.1–2.6 |

**Subtotal:** ~36 hours

#### URL Routing Architecture (from Part 1)

```
┌──────────────────────────────────────────────────┐
│                DOMAIN STRUCTURE                   │
├──────────────────────────────────────────────────┤
│  letbuyy.store            → Marketing / Landing   │
│  accounts.letbuyy.store   → Auth & Onboarding     │
│  admin.letbuyy.store      → Admin Dashboard       │
│  {store}.letbuyy.store    → Live Storefront        │
└──────────────────────────────────────────────────┘
```

### Phase 1 Acceptance Criteria

- [ ] All database tables created with correct types and constraints
- [ ] RLS policies verified — users can only access their own stores
- [ ] Auth flow working: sign-up → email confirmation → sign-in
- [ ] Google OAuth functional
- [ ] Subdomain routing resolves correctly in development
- [ ] Helper functions execute without errors

---

## 35. Phase 2 — Onboarding & Store Creation (Weeks 3–4)

> **Goal:** Build the complete onboarding wizard, store creation pipeline, and the Store Switcher for multi-store management.

### Week 3: Onboarding Wizard

**References:** Part 2 (§7–8), Part 3 (§9)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 3.1 | Build onboarding layout: multi-step wizard shell with progress indicator | 6h | 🔴 Critical | Phase 1 |
| 3.2 | Implement Step 1: Store Name & Subdomain (live availability check) | 4h | 🔴 Critical | 3.1 |
| 3.3 | Implement Step 2: Site Type Selection (E-commerce, Blog, Portfolio, Resume, Landing Page) | 4h | 🔴 Critical | 3.1 |
| 3.4 | Implement Step 3: Site-type-specific questions (branching logic per Part 2 decision tree) | 8h | 🔴 Critical | 3.3 |
| 3.5 | Implement Step 4: Design preferences (theme, colors, layout) | 4h | 🟡 High | 3.4 |
| 3.6 | Implement Step 5: Review & Confirm — preview summary before creation | 4h | 🟡 High | 3.5 |
| 3.7 | Wire onboarding responses to `stores.onboarding_responses` and `stores.store_config` JSONB fields | 4h | 🔴 Critical | 3.4, 1.2 |
| 3.8 | Implement Autopay opt-in prompt during onboarding (per Part 4) | 3h | 🟡 High | 3.6 |

**Subtotal:** ~37 hours

#### Onboarding Decision Tree (from Part 2)

```
                    ┌─────────────┐
                    │ Choose Site  │
                    │    Type      │
                    └──────┬──────┘
           ┌───────┬───────┼───────┬───────┐
           ▼       ▼       ▼       ▼       ▼
      E-commerce  Blog  Portfolio Resume  Landing
           │       │       │       │       │
           ▼       ▼       ▼       ▼       ▼
     Product    Content  Project  Career  Campaign
     Questions  Questions Questions Questions Questions
           │       │       │       │       │
           └───────┴───────┴───────┴───────┘
                          │
                    ┌─────▼─────┐
                    │  Design   │
                    │ Preferences│
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │  Review   │
                    │ & Create  │
                    └───────────┘
```

### Week 4: Store Creation & Switcher UI

**References:** Part 3 (§9–12)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 4.1 | Build store creation API: insert into `stores`, generate subdomain, set trial start | 6h | 🔴 Critical | 3.7 |
| 4.2 | Implement "Launching Soon" placeholder page for new stores | 4h | 🟡 High | 4.1 |
| 4.3 | Build Landing Page Store Switcher: grid of store cards with avatars, badges, quick stats | 8h | 🔴 Critical | 4.1 |
| 4.4 | Build In-Dashboard Store Switcher dropdown (compact variant) | 4h | 🔴 Critical | 4.3 |
| 4.5 | Implement Badge System: site-type badges (color-coded) + status badges (trial/active/deactivated) | 4h | 🟡 High | 4.3 |
| 4.6 | Build "Create New Store" flow from Switcher (re-uses onboarding wizard) | 3h | 🟢 Medium | 4.3, 3.1 |
| 4.7 | Implement avatar generation (initials-based with gradient backgrounds) | 2h | 🟢 Medium | 4.3 |
| 4.8 | Test multi-store creation and switching end-to-end | 4h | 🟡 High | 4.1–4.7 |

**Subtotal:** ~35 hours

### Phase 2 Acceptance Criteria

- [ ] Complete onboarding wizard with all 5 site-type paths
- [ ] Store created in database with correct `onboarding_responses` and `store_config`
- [ ] Subdomain generated and unique
- [ ] Trial period (`trial_ends_at`) set to 14 days from creation
- [ ] Store Switcher displays all user's stores with correct badges
- [ ] Users can switch between stores seamlessly
- [ ] "Create New Store" triggers the onboarding wizard again

---

## 36. Phase 3 — Admin Dashboards & Site-Type Features (Weeks 5–7)

> **Goal:** Build the 5 distinct admin dashboard variants and all CRUD functionality for each site type.

### Week 5: Dashboard Shell & E-Commerce

**References:** Part 3 (§11–12), Part 6 (§20–21)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 5.1 | Build shared dashboard shell: sidebar nav, header with Store Switcher, main content area | 8h | 🔴 Critical | Phase 2 |
| 5.2 | Implement `DashboardConfig` — route/menu/component mapping per site type | 4h | 🔴 Critical | 5.1 |
| 5.3 | Build E-Commerce dashboard: overview cards (revenue, orders, products, conversion rate) | 6h | 🔴 Critical | 5.1 |
| 5.4 | Build E-Commerce: Product management CRUD (list, add, edit, delete, variants, inventory) | 10h | 🔴 Critical | 5.3 |
| 5.5 | Build E-Commerce: Order management (list, detail, status updates, timeline) | 8h | 🔴 Critical | 5.3 |
| 5.6 | Build E-Commerce: Analytics (sales chart, top products, customer insights) | 6h | 🟡 High | 5.3 |

**Subtotal:** ~42 hours

#### Dashboard Config Pattern (from Part 3)

```typescript
// DashboardConfig — drives menu, routes, and components per site type
const dashboardConfig: Record<SiteType, DashboardConfig> = {
  ecommerce: {
    menuItems: ['Overview', 'Products', 'Orders', 'Customers', 'Analytics', 'Settings'],
    defaultRoute: '/admin/overview',
    components: { overview: EcommerceOverview, products: ProductManager, ... }
  },
  blog: {
    menuItems: ['Overview', 'Posts', 'Categories', 'Comments', 'Analytics', 'Settings'],
    defaultRoute: '/admin/overview',
    components: { overview: BlogOverview, posts: PostEditor, ... }
  },
  // ... portfolio, resume, landing_page
};
```

### Week 6: Blog & Portfolio Dashboards

**References:** Part 6 (§22–23)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 6.1 | Build Blog dashboard: overview (posts, views, comments, subscribers) | 4h | 🔴 Critical | 5.1 |
| 6.2 | Build Blog: Post editor with rich text / markdown support | 8h | 🔴 Critical | 6.1 |
| 6.3 | Build Blog: Category & tag management | 3h | 🟡 High | 6.1 |
| 6.4 | Build Blog: Comment moderation system | 4h | 🟡 High | 6.1 |
| 6.5 | Build Portfolio dashboard: overview (projects, views, inquiries) | 4h | 🔴 Critical | 5.1 |
| 6.6 | Build Portfolio: Project management CRUD (images, descriptions, tags, links) | 8h | 🔴 Critical | 6.5 |
| 6.7 | Build Portfolio: Inquiry management (contact form submissions) | 3h | 🟡 High | 6.5 |
| 6.8 | Build shared Media Manager: upload, organize, select for all site types | 6h | 🟡 High | 5.1 |

**Subtotal:** ~40 hours

### Week 7: Resume, Landing Page & Polish

**References:** Part 6 (§24–25)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 7.1 | Build Resume dashboard: overview (profile views, downloads, interview requests) | 4h | 🔴 Critical | 5.1 |
| 7.2 | Build Resume: Section editors (experience, education, skills, certifications) | 8h | 🔴 Critical | 7.1 |
| 7.3 | Build Resume: PDF export / download functionality | 4h | 🟡 High | 7.2 |
| 7.4 | Build Landing Page dashboard: overview (visits, sign-ups, conversion rate) | 4h | 🔴 Critical | 5.1 |
| 7.5 | Build Landing Page: Section editor (hero, features, testimonials, CTA, FAQ) | 8h | 🔴 Critical | 7.4 |
| 7.6 | Build Landing Page: Lead management (sign-up/form submissions list) | 3h | 🟡 High | 7.4 |
| 7.7 | Implement Settings page (shared across all site types): store details, custom domain, danger zone | 6h | 🟡 High | 5.1 |
| 7.8 | Cross-dashboard polish: loading states, empty states, error boundaries, responsive design | 6h | 🟡 High | All above |

**Subtotal:** ~43 hours

### Phase 3 Acceptance Criteria

- [ ] Each site type renders its own dashboard variant via `DashboardConfig`
- [ ] Full CRUD working for: Products, Blog Posts, Portfolio Projects, Resume Sections, Landing Page Sections
- [ ] Media Manager functional for image/file uploads across all site types
- [ ] Settings page works for all store types
- [ ] All dashboards are responsive (desktop + tablet + mobile)
- [ ] Empty states and loading skeletons present throughout

---

## 37. Phase 4 — Trial, Payment & Billing (Weeks 8–9)

> **Goal:** Implement the complete trial lifecycle, Razorpay payment integration, automated billing, and email notification system.

### Week 8: Trial System & Razorpay Integration

**References:** Part 1 (§3–4), Part 4 (§13–16), Part 7 (§30)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 8.1 | Build Trial Countdown Banner (persistent top bar with color-coded urgency) | 4h | 🔴 Critical | Phase 3 |
| 8.2 | Build Trial Dashboard Card (days remaining, progress ring, CTA) | 4h | 🔴 Critical | 8.1 |
| 8.3 | Build Floating Reminder Button (last 3 days, animated pulse) | 3h | 🟡 High | 8.1 |
| 8.4 | Integrate Razorpay SDK: create customer, set up payment methods | 6h | 🔴 Critical | Phase 1 |
| 8.5 | Build Payment Setup Modal: UPI + Credit Card options, success/failure states | 8h | 🔴 Critical | 8.4 |
| 8.6 | Implement subscription creation via Razorpay API | 6h | 🔴 Critical | 8.4 |
| 8.7 | Build Razorpay webhook handler: payment success/failure/refund events | 6h | 🔴 Critical | 8.6 |
| 8.8 | Implement `autopay_enabled` toggle and recurring billing logic | 4h | 🟡 High | 8.6 |

**Subtotal:** ~41 hours

#### Trial Countdown UI States (from Part 4)

```
┌──────────────────────────────────────────────────────┐
│  TRIAL BANNER COLOR CODING                           │
├──────────────┬───────────────────────────────────────┤
│  Days 14–8   │  🟢 Green   — "14 days remaining"     │
│  Days 7–4    │  🟡 Yellow  — "7 days remaining"      │
│  Days 3–1    │  🟠 Orange  — "3 days left!"          │
│  Day 0       │  🔴 Red     — "Trial expires today!"  │
│  Expired     │  ⚫ Dark    — "Trial expired"          │
└──────────────┴───────────────────────────────────────┘
```

### Week 9: Billing, Emails & Reactivation

**References:** Part 4 (§15–16), Part 7 (§31)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 9.1 | Build Store Deactivation flow: auto-deactivate on trial expiry (no payment) | 6h | 🔴 Critical | 8.7 |
| 9.2 | Build Store Reactivation flow: payment → re-enable store | 6h | 🔴 Critical | 9.1 |
| 9.3 | Build deactivated store landing page ("This store is temporarily unavailable") | 3h | 🟡 High | 9.1 |
| 9.4 | Set up Resend for transactional emails | 3h | 🔴 Critical | — |
| 9.5 | Build email templates: trial reminders (7 days, 3 days, last day, expired) | 6h | 🔴 Critical | 9.4 |
| 9.6 | Build email templates: payment success, payment failure, store deactivation, reactivation | 4h | 🟡 High | 9.4 |
| 9.7 | Implement Supabase cron / Edge Function for: daily trial checks, auto-deactivation, email triggers | 6h | 🔴 Critical | 9.1, 9.5 |
| 9.8 | Build Billing History page in admin: invoices, payment status, next billing date | 4h | 🟡 High | 8.6 |
| 9.9 | End-to-end testing: trial → expiry → deactivation → payment → reactivation | 4h | 🔴 Critical | All above |

**Subtotal:** ~42 hours

#### Email Schedule (from Part 4)

```
Day  1  ─────────────── Trial starts (welcome email)
Day  7  ─────────────── "7 days remaining" reminder
Day 11  ─────────────── "3 days remaining" reminder
Day 14  ─────────────── "Trial expires today!" warning
Day 15  ─────────────── "Trial expired" — store deactivated
Day 18  ─────────────── "We miss you" — reactivation prompt
Day 25  ─────────────── Final "Come back" email
```

### Phase 4 Acceptance Criteria

- [ ] Trial countdown banner displays correctly at all stages (green → yellow → orange → red)
- [ ] Razorpay payment processes successfully (test mode)
- [ ] Subscription created and recurring billing functional
- [ ] Webhook handler processes payment events correctly
- [ ] Expired stores are automatically deactivated
- [ ] Deactivated stores show appropriate landing page
- [ ] Reactivation flow restores store to active status
- [ ] All email templates render correctly and trigger on schedule
- [ ] Billing history page shows accurate data

---

## 38. Phase 5 — Deployment, QA & Launch (Weeks 10–12)

> **Goal:** Deploy to production infrastructure, complete QA, and launch.

### Week 10: Infrastructure & Staging Deployment

**References:** Part 7 (§26–32)

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 10.1 | Configure Cloudflare DNS: A records, CNAME for subdomains, wildcard DNS | 4h | 🔴 Critical | Phase 4 |
| 10.2 | Configure SSL certificates via Cloudflare (automatic for wildcard) | 2h | 🔴 Critical | 10.1 |
| 10.3 | Set up Vercel project with monorepo config (apps/web/*) | 4h | 🔴 Critical | 10.1 |
| 10.4 | Configure Vercel environment variables (Supabase, Razorpay, Resend, Sentry keys) | 2h | 🔴 Critical | 10.3 |
| 10.5 | Set up Vercel Pro for wildcard domain support | 2h | 🔴 Critical | 10.3 |
| 10.6 | Deploy to staging environment | 4h | 🔴 Critical | 10.1–10.5 |
| 10.7 | Configure Sentry for error tracking (client + server) | 3h | 🟡 High | 10.6 |
| 10.8 | Set up Vercel Analytics & Web Vitals monitoring | 2h | 🟡 High | 10.6 |
| 10.9 | Set up UptimeRobot for critical endpoint monitoring | 2h | 🟡 High | 10.6 |

**Subtotal:** ~25 hours

### Week 11: QA & Testing

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 11.1 | Auth flow testing: sign-up, sign-in, OAuth, session management, password reset | 6h | 🔴 Critical | 10.6 |
| 11.2 | Onboarding testing: all 5 site-type paths, store creation, subdomain allocation | 6h | 🔴 Critical | 10.6 |
| 11.3 | Dashboard testing: each variant's CRUD operations, data persistence, navigation | 8h | 🔴 Critical | 10.6 |
| 11.4 | Trial & Payment testing: countdown accuracy, Razorpay test payments, webhook handling | 6h | 🔴 Critical | 10.6 |
| 11.5 | Email testing: all templates render correctly, triggered at correct intervals | 4h | 🟡 High | 10.6 |
| 11.6 | Cross-browser testing: Chrome, Firefox, Safari, Edge | 4h | 🟡 High | 10.6 |
| 11.7 | Mobile responsiveness testing: all dashboard variants on mobile/tablet | 4h | 🟡 High | 10.6 |
| 11.8 | Security audit: RLS verification, auth edge cases, input sanitization, CSRF | 6h | 🔴 Critical | 10.6 |
| 11.9 | Performance testing: page load times, Lighthouse scores, database query optimization | 4h | 🟡 High | 10.6 |

**Subtotal:** ~48 hours

### Week 12: Bug Fixes & Production Launch

| # | Task | Est. | Priority | Depends On |
|---|------|------|----------|------------|
| 12.1 | Fix critical bugs identified during QA | 12h | 🔴 Critical | Week 11 |
| 12.2 | Fix medium-priority bugs and UX polish items | 8h | 🟡 High | 12.1 |
| 12.3 | Final staging verification — complete smoke test | 4h | 🔴 Critical | 12.1 |
| 12.4 | Switch Razorpay from test mode to live mode | 2h | 🔴 Critical | 12.3 |
| 12.5 | Update DNS to production domains | 2h | 🔴 Critical | 12.3 |
| 12.6 | Deploy to production | 2h | 🔴 Critical | 12.4, 12.5 |
| 12.7 | Post-launch monitoring: watch error rates, payment flows, sign-ups for 48h | 8h | 🔴 Critical | 12.6 |
| 12.8 | Document known issues and create post-launch backlog | 2h | 🟡 High | 12.7 |

**Subtotal:** ~40 hours

### Phase 5 Acceptance Criteria

- [ ] All subdomains resolve correctly (wildcard + specific)
- [ ] SSL certificates valid and auto-renewing
- [ ] Zero critical bugs in staging
- [ ] Razorpay live mode processing real transactions
- [ ] Sentry capturing errors with proper source maps
- [ ] Uptime monitoring active for all critical endpoints
- [ ] Core Web Vitals passing (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Production deployment successful and stable for 48h

---

## 39. Dependency Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                      DEPENDENCY FLOW                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐                                                │
│  │ Supabase Setup   │◄──────────────────────────────────────┐        │
│  │ (1.1)            │                                       │        │
│  └────────┬─────────┘                                       │        │
│           │                                                  │        │
│  ┌────────▼─────────┐    ┌──────────────────┐               │        │
│  │ Database Schema  │───►│ RLS Policies     │               │        │
│  │ (1.2–1.5)        │    │ (1.6)            │               │        │
│  └────────┬─────────┘    └────────┬─────────┘               │        │
│           │                       │                          │        │
│  ┌────────▼─────────┐            │                          │        │
│  │ Auth System      │◄───────────┘                          │        │
│  │ (2.1–2.7)        │                                       │        │
│  └────────┬─────────┘                                       │        │
│           │                                                  │        │
│  ┌────────▼─────────┐                                       │        │
│  │ Onboarding       │                                       │        │
│  │ (3.1–3.8)        │                                       │        │
│  └────────┬─────────┘                                       │        │
│           │                                                  │        │
│  ┌────────▼─────────┐    ┌──────────────────┐               │        │
│  │ Store Creation   │───►│ Store Switcher   │               │        │
│  │ (4.1–4.2)        │    │ (4.3–4.7)        │               │        │
│  └────────┬─────────┘    └────────┬─────────┘               │        │
│           │                       │                          │        │
│  ┌────────▼───────────────────────▼──────┐                  │        │
│  │ Dashboard Shell + 5 Variants          │                  │        │
│  │ (5.1–7.8)                             │                  │        │
│  └────────┬──────────────────────────────┘                  │        │
│           │                                                  │        │
│  ┌────────▼─────────┐    ┌──────────────────┐               │        │
│  │ Trial System     │───►│ Razorpay         │───────────────┘        │
│  │ (8.1–8.3)        │    │ (8.4–8.8)        │                        │
│  └────────┬─────────┘    └────────┬─────────┘                        │
│           │                       │                                   │
│  ┌────────▼───────────────────────▼──────┐                           │
│  │ Billing, Emails & Deactivation        │                           │
│  │ (9.1–9.9)                             │                           │
│  └────────┬──────────────────────────────┘                           │
│           │                                                           │
│  ┌────────▼──────────────────────────────┐                           │
│  │ Deployment & Launch                   │                           │
│  │ (10.1–12.8)                           │                           │
│  └───────────────────────────────────────┘                           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Critical Path

The longest sequential chain that determines the minimum project duration:

```
Supabase Setup → Schema → Auth → Onboarding → Store Creation
→ Dashboard Shell → E-Commerce CRUD → Trial UI → Razorpay
→ Billing/Emails → Staging Deploy → QA → Production Launch
```

**Any delay on the critical path directly delays the launch date.**

### Parallelizable Work

The following workstreams can run concurrently once their dependencies are met:

| Stream A | Stream B | When |
|----------|----------|------|
| Blog Dashboard (6.1–6.4) | Portfolio Dashboard (6.5–6.7) | Week 6, after 5.1 |
| Resume Dashboard (7.1–7.3) | Landing Page Dashboard (7.4–7.6) | Week 7, after 5.1 |
| Trial UI (8.1–8.3) | Razorpay Integration (8.4–8.8) | Week 8, after Phase 3 |
| Email Templates (9.4–9.6) | Deactivation/Reactivation (9.1–9.3) | Week 9 |
| Sentry/Analytics (10.7–10.9) | QA Testing (11.1–11.9) | Weeks 10–11 |

---

## 40. Risk Analysis & Mitigations

### High-Risk Items

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Razorpay integration complexity** | Medium | 🔴 High | Start with test mode early; have webhook retry logic; fallback to manual payment tracking |
| **Wildcard DNS propagation delays** | Low | 🔴 High | Set low TTL values (300s); test with alternate DNS (Google 8.8.8.8); pre-provision known subdomains |
| **Supabase RLS misconfiguration** | Medium | 🔴 Critical | Comprehensive test suite for RLS; use Supabase's row-level test tool; security audit in Week 11 |
| **Multi-tenant data leakage** | Low | 🔴 Critical | Store isolation verified at every layer: RLS, middleware, API; penetration testing |
| **Scope creep in dashboard variants** | High | 🟡 Medium | Ship MVP features per variant; park nice-to-haves in post-launch backlog |
| **Vercel Pro plan requirement** | Low | 🟡 Medium | Budget approval before Phase 5; fallback to individual subdomain routing |

### Medium-Risk Items

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Email deliverability issues** | Medium | 🟡 Medium | Verify SPF/DKIM/DMARC records; use Resend's deliverability tools; test across providers |
| **Mobile responsiveness gaps** | Medium | 🟡 Medium | Test on real devices; use responsive design tokens from the start |
| **Performance under load** | Low | 🟡 Medium | Optimize Supabase queries with indexes; use Vercel Edge Functions; implement caching |
| **Third-party service outage** (Razorpay/Resend/Supabase) | Low | 🟡 Medium | Graceful degradation UIs; queue failed operations for retry |

---

## 41. Success Metrics & KPIs

### Launch Criteria (Go/No-Go)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Critical bugs | **0** | QA bug tracker |
| Auth success rate | **> 99%** | Supabase Auth logs |
| Page load time (LCP) | **< 2.5s** | Vercel Analytics |
| Razorpay test transactions | **100% success** | Razorpay dashboard |
| Email delivery rate | **> 95%** | Resend dashboard |
| RLS policy coverage | **100% of tables** | Security audit checklist |
| Cross-browser compatibility | **Chrome, Firefox, Safari, Edge** | Manual QA |

### Post-Launch KPIs (First 30 Days)

| KPI | Target | Tracking |
|-----|--------|----------|
| New store sign-ups | > 50 | Supabase `stores` table count |
| Onboarding completion rate | > 70% | Analytics funnel |
| Trial-to-paid conversion rate | > 15% | `subscriptions` table |
| Average session duration | > 5 min | Vercel Analytics |
| Uptime | > 99.5% | UptimeRobot |
| Error rate | < 1% | Sentry |
| Customer support tickets | < 20/week | Support inbox |
| Revenue (MRR) | > ₹25,000 | Razorpay dashboard |

---

## 42. Post-Launch Roadmap

### Month 2 — Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| Custom Domains | Allow store owners to connect their own domains (CNAME) | 🔴 High |
| Theme Marketplace | Pre-built themes for each site type | 🟡 Medium |
| Analytics Dashboard v2 | Advanced analytics with charts, funnels, cohorts | 🟡 Medium |
| Bulk Operations | Bulk edit/delete for products, posts, projects | 🟡 Medium |
| API Access | Public REST/GraphQL API for store data | 🟢 Low |

### Month 3 — Growth Features

| Feature | Description | Priority |
|---------|-------------|----------|
| SEO Tools | Per-page meta tags, sitemap, Open Graph preview | 🔴 High |
| Email Marketing | Integrated newsletter for Blog / E-Commerce | 🟡 Medium |
| Multi-Language | i18n support for admin and storefronts | 🟢 Low |
| Collaboration | Invite team members with role-based access | 🟡 Medium |
| Mobile App | React Native admin app for store management on mobile | 🟢 Low |

### Month 4+ — Scale

| Feature | Description | Priority |
|---------|-------------|----------|
| App Store / Plugins | Third-party integrations marketplace | 🟡 Medium |
| Advanced E-Commerce | Discounts, coupons, shipping rules, tax configuration | 🔴 High |
| CDN for Media | Cloudflare R2 or similar for user-uploaded media | 🟡 Medium |
| White-Label | Allow agencies to resell LetBuyy under their brand | 🟢 Low |
| AI Features | AI-generated product descriptions, blog posts, portfolio summaries | 🟡 Medium |

---

## Hour Summary

| Phase | Weeks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1 — Foundation & Auth | 1–2 | ~67h |
| Phase 2 — Onboarding & Store Creation | 3–4 | ~72h |
| Phase 3 — Admin Dashboards & Features | 5–7 | ~125h |
| Phase 4 — Trial, Payment & Billing | 8–9 | ~83h |
| Phase 5 — Deployment, QA & Launch | 10–12 | ~113h |
| **Total** | **12 weeks** | **~460h** |

> 💡 **Note:** Estimates assume a single full-stack developer. With 2 developers working in parallel, the timeline could compress to **8–9 weeks** by parallelizing dashboard variants (Phase 3) and trial/payment work (Phase 4).

---

> **← Previous:** [Part 7](./part7.md) — Deployment & Migration Strategy

---

## Document Navigation

| Part | Content |
|------|---------|
| Part 1 | Architecture & Trial System, URL Routing, Payment Requirements |
| Part 2 | Onboarding Flow — Site Type Questions & Paths |
| Part 3 | Store Management UI — Switcher, Badges, Multi-Store |
| Part 4 | Trial & Payment UI — Modals, Countdown, Reactivation |
| Part 5 | Complete Database Schema — All Tables |
| Part 6 | Admin Dashboard Variants — Per Site Type |
| Part 7 | Deployment & Migration — Step-by-Step |
| **Part 8** (this) | Implementation Roadmap — Timeline & Phases |
