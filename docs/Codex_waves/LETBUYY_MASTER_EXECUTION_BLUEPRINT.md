# LETBUYY MASTER EXECUTION BLUEPRINT

> **Generated:** 2026-06-02 · **Version:** 1.0
> **North Star:** Transform LetBuyy from "collection of powerful features" into a "Unified Commerce Operating System"
> **Governance:** AGENTS.md is law. 128 validators green at all times. Architecture is fundamentally correct — do NOT redesign.

---

## PHASE A — REPOSITORY INTELLIGENCE

### A.1 — Application Map (9 apps)

| App | Path | Type | Pages | Status | Maturity |
|-----|------|------|-------|--------|----------|
| **Identity Platform** | `apps/identity-platform` | Next.js 15 | ~12 | Auth/signup/OTP/onboarding | 80% |
| **Merchant Control Plane** | `apps/merchant-control-plane` | Next.js 15 | ~56 | Dashboard/products/orders/themes/apps/settings | 65% |
| **Storefront Runtime** | `apps/storefront-runtime` | Next.js 15 | ~30 | Wildcard tenant storefronts | 75% |
| **Marketing Site** | `apps/marketing-site` | Next.js 15 | ~8 | Public landing/pricing | 50% |
| **App Marketplace** | `apps/app-marketplace` | Next.js 15 | ~10 | Extension marketplace | 55% |
| **Theme Marketplace** | `apps/theme-marketplace` | Next.js 15 | ~8 | Theme catalog/detail/checkout | 55% |
| **Platform Console** | `apps/platform-console` | Next.js 15 | ~6 | Super admin scaffold | 20% |
| **Platform Ops Portal** | `apps/platform-operations-portal` | Next.js 15 | ~5 | Employee ops scaffold | 15% |
| **Mobile Merchant** | `apps/mobile/merchant-app` | Flutter | ~40 screens | Native store builder | 60% |

### A.2 — Package Map (21 packages)

| Package | Path | Domain | Status |
|---------|------|--------|--------|
| `shared-types` | `packages/shared-types` | Cross-runtime contracts | ✅ Stable |
| `tenant-core` | `packages/tenant-core` | Tenant/site resolution | ✅ Stable |
| `commerce-core` | `packages/commerce-core` | Product/catalog/inventory | ✅ Stable |
| `checkout-core` | `packages/checkout-core` | Cart/order/checkout/tax | ✅ Stable |
| `auth-core` | `packages/auth-core` | Identity/session/RBAC | ✅ Stable |
| `theme-engine` | `packages/theme-engine` | Theme registry/sections/blocks | ✅ Stable |
| `cms-core` | `packages/cms-core` | Pages/policies/navigation | ✅ Stable |
| `event-core` | `packages/event-core` | Domain events/outbox/webhooks | ✅ Stable |
| `notification-core` | `packages/notification-core` | Notification templates/channels | 🟡 Scaffold |
| `search-core` | `packages/search-core` | Search documents/indexing | 🟡 Scaffold |
| `billing-core` | `packages/billing-core` | Plans/subscriptions/invoices | ✅ Stable |
| `app-engine` | `packages/app-engine` | App/OAuth/Bridge contracts | ✅ Stable |
| `application-services` | `packages/application-services` | Workflow orchestration | ✅ Stable |
| `distributed-runtime` | `packages/distributed-runtime` | CQRS/events/workers | ✅ Stable |
| `orchestration` | `packages/orchestration` | Saga/retry/coordination | ✅ Stable |
| `projection-runtime` | `packages/projection-runtime` | Read models/snapshots | ✅ Stable |
| `runtime-composition` | `packages/runtime-composition` | Query aggregation/cache | ✅ Stable |
| `infrastructure` | `packages/infrastructure` | Provider SDKs/adapters | ✅ Stable |
| `@letbuyy/ui` | `packages/typescript/ui` | Design system (16 files) | 🟠 In Progress |
| `@letbuyy/utils` | `packages/typescript/utils` | Supabase/API/auth utils | ✅ Stable |
| `@letbuyy/api-client` | `packages/typescript/api-client` | Typed Commerce API client | ✅ Stable |

### A.3 — Service Map (9 services)

| Service | Path | Runtime | Status |
|---------|------|---------|--------|
| **API Gateway** | `services/api-gateway` | Cloudflare Workers (Hono) | ✅ Active — 31 route modules |
| **Webhook Service** | `services/webhook-service` | Cloudflare Workers | ✅ Active |
| **Queue Workers** | `services/queue-workers` | Cloudflare Workers | 🟡 Partial |
| **Checkout Runtime** | `services/checkout-runtime` | Cloudflare Workers | 🟡 Scaffold |
| **Event Bus** | `services/event-bus` | Cloudflare Workers | 🟡 Scaffold |
| **Analytics Pipeline** | `services/analytics-pipeline` | Cloudflare Workers | 🟡 Scaffold |
| **Search Service** | `services/search-service` | Cloudflare Workers | 🟡 Scaffold |
| **Notification Service** | `services/notification-service` | Cloudflare Workers | 🟡 Scaffold |
| **Media Service** | `services/media-service` | Cloudflare Workers | 🟡 Scaffold |

### A.4 — API Gateway Route Map (31 modules, ~680KB total)

| Module | Size | Domain |
|--------|------|--------|
| `storefront.ts` | 136KB | Theme rendering, sections, blocks, storefront data |
| `app-store.ts` | 82KB | Apps, OAuth, Bridge, billing, permissions, install |
| `operations.ts` | 56KB | Platform operations, admin, support |
| `payments.ts` | 32KB | Payment providers, Razorpay, COD, Cashfree |
| `inventory.ts` | 32KB | Stock, adjustments, warehouse |
| `pages.ts` | 31KB | CMS pages, policies |
| `themes.ts` | 31KB | Theme CRUD, releases, settings |
| `auth.ts` | 24KB | Login, signup, OTP, session |
| `blog.ts` | 22KB | Blog posts, comments |
| `stores.ts` | 22KB | Store CRUD, settings |
| `orders.ts` | 22KB | Orders, fulfillment, timeline |
| `products.ts` | 18KB | Product CRUD, variants |
| `shipping-tax.ts` | 17KB | Shipping zones, tax rules |
| `resume.ts` | 15KB | Resume builder |
| `employee.ts` | 15KB | Staff, permissions |
| `internal-console.ts` | 14KB | Platform console API |
| `customers.ts` | 12KB | Customer CRUD, profiles |
| `export.ts` | 11KB | CSV export/import |
| `onboarding.ts` | 11KB | Store setup |
| `admin.ts` | 11KB | Admin management |
| `reviews.ts` | 10KB | Product reviews |
| `categories.ts` | 10KB | Categories |
| `coupons.ts` | 9KB | Discounts/coupons |
| `notifications.ts` | 7KB | Notification prefs |
| `ai.ts` | 7KB | AI features |
| `form-submissions.ts` | 7KB | Contact/lead forms |
| `media.ts` | 7KB | Media upload/gallery |
| `analytics.ts` | 6KB | Analytics data |
| `portfolio.ts` | 5KB | Portfolio |
| `upload.ts` | 5KB | File upload |
| `contacts.ts` | 3KB | Contact info |

### A.5 — Database Map

| Item | Detail |
|------|--------|
| **Engine** | Supabase Postgres + RLS |
| **Active migrations** | `000_baseline.sql` (928KB) + `073`, `074`, `075` |
| **Archived migrations** | 72 historical (in `docs/archive/`) |
| **Provisioning** | ✅ Fresh DB from baseline proven |
| **Key tables** | `sites`, `products`, `orders`, `customers`, `themes`, `apps`, `theme_releases`, `app_installs`, `users`, `subscriptions`, `payment_configs`, `shipping_zones`, `tax_rates`, `pages`, `blog_posts`, `media`, `coupons`, `reviews`, `categories`, `collections` |

### A.6 — Infrastructure Map

| Layer | Tech | Status |
|-------|------|--------|
| **Hosting (Web)** | Vercel | Configured |
| **API Workers** | Cloudflare Workers | Active |
| **Durable Objects** | Cloudflare | Configured |
| **Database** | Supabase Postgres | Active |
| **Storage** | Cloudflare R2 / Supabase Storage | Active |
| **Cache** | Upstash Redis (intent) | Scaffold |
| **DNS** | Cloudflare | Configured |
| **CI/CD** | GitHub Actions | Partial |
| **Monitoring** | Planned | Scaffold |
| **Fonts** | Self-hosted (Geist) | ✅ Done |
| **Icons** | Lucide (centralized) | ✅ Done |

### A.7 — Governance & Validation

- **128 governance validators** — all green
- **131 validation scripts** in `scripts/validators/`
- **57/57 turbo typecheck** packages pass
- **287/287 node tests** pass
- **5/5 J1-J5 Playwright E2E** pass on real stack
- **8/8 lint targets** pass

### A.8 — Mission Completion Status

| Mission | Status | Key Result |
|---------|--------|------------|
| Foundation (Phase 1) | ✅ DONE | 7 apps thin-client, governance framework |
| Federation (Phase 2) | ✅ DONE (BLOCKED live) | Identity/app/theme federation; J1-J5 specs |
| Production Readiness (Phase 3) | ✅ DONE (BLOCKED creds) | Fresh DB, real E2E, COD/GST, self-hosted fonts |
| Shopify UX (Phase 4) | 🟠 IN PROGRESS | UX0-UX2 done, UX3 in progress (~30 pages migrated) |

---

## PHASE B — MASTER GAP ANALYSIS

### B.1 — Maturity Dimension Scoring (Current → Target)

| Dimension | Current | Target | Gap | Impact | Risk | Complexity | ROI | Priority |
|-----------|---------|--------|-----|--------|------|------------|-----|----------|
| **Design System** | 45% | 95% | 50% | 🔴 Critical | Low | Medium | 🟢 Highest | P0 |
| **Merchant UX** | 40% | 90% | 50% | 🔴 Critical | Low | Large | 🟢 High | P0 |
| **Navigation** | 30% | 90% | 60% | 🔴 Critical | Low | Medium | 🟢 Highest | P0 |
| **Theme Experience** | 35% | 90% | 55% | 🔴 Critical | Medium | Large | 🟢 High | P0 |
| **Settings Architecture** | 20% | 85% | 65% | 🟠 High | Low | Medium | 🟢 High | P1 |
| **App Experience** | 50% | 90% | 40% | 🟠 High | Low | Medium | 🟡 Medium | P1 |
| **Analytics** | 30% | 80% | 50% | 🟡 Medium | Low | Medium | 🟡 Medium | P2 |
| **Operations Layer** | 10% | 70% | 60% | 🟡 Medium | Medium | Large | 🟡 Medium | P2 |
| **Developer Ecosystem** | 5% | 60% | 55% | 🟡 Medium | Low | Large | 🔴 Lower | P3 |
| **Production Readiness** | 60% | 95% | 35% | 🔴 Critical | High | Medium | 🟢 High | P0 |
| **Mobile Parity** | 55% | 85% | 30% | 🟡 Medium | Low | Large | 🟡 Medium | P2 |
| **Commerce Engine** | 80% | 95% | 15% | 🟠 High | Medium | Small | 🟢 High | P1 |

### B.2 — Critical Gap Details

#### Gap 1: Design System (45% → 95%)
- **Current:** 16 files in `@letbuyy/ui`, tokens built, ~25 components, Storybook configured
- **Done:** Tokens, Page, PageHeader, Card, Section, Badge, Banner, Toast, Skeleton, EmptyState, Modal, ConfirmDialog, Tabs, Select, Combobox, Tooltip, MetricCard, Avatar, Pagination, IndexTable, SaveBar, CommandPalette, DesignSystemRoot
- **Remaining:** Globals.css still 8,885 lines (was 9,248), ~30 pages migrated but ~26 remain, responsive grammar incomplete
- **Root cause:** Migration in progress — components built, adoption ongoing

#### Gap 2: Theme Editor (35% → 90%)
- **Current:** Schema-generated settings form (correct foundation), no live preview canvas
- **Missing:** iframe preview pane, section tree with drag-drop, visual canvas selection, device toggle, draft/live library
- **Root cause:** This is the marquee Shopify experience gap — highest-priority UX work

#### Gap 3: Navigation (30% → 90%)
- **Current:** ~40 flat sidebar items, app-local CommandPalette exists but not shared
- **Missing:** Grouped ~9-item sidebar, ⌘K entity search, keyboard shortcuts
- **Root cause:** UX5 phase not yet started

#### Gap 4: Settings Architecture (20% → 85%)
- **Current:** Settings scattered across routes, partially migrated to shared components
- **Missing:** Unified hub shell, consistent pane grammar, plan/billing clarity
- **Root cause:** UX phase dependency — settings migration ongoing in UX3

#### Gap 5: Operations Layer (10% → 70%)
- **Current:** Platform Console and Ops Portal are scaffolds (~6 and ~5 pages)
- **Missing:** Merchant directory, revenue dashboard, subscription management, CRM, tickets, health monitoring
- **Root cause:** Deprioritized behind merchant-facing UX; depends on API data availability

---

## PHASE C — PARALLEL EXECUTION PLAN

### C.1 — Domain-Owned Workstreams

> [!IMPORTANT]
> Each workstream owns specific folders. Two workstreams NEVER edit the same file. Collision risk is eliminated by folder ownership boundaries.

---

#### Workstream 1: DESIGN SYSTEM COMPLETION
- **Objective:** Complete `@letbuyy/ui` to Polaris-class depth; eliminate remaining bespoke CSS
- **Folder Ownership:** `packages/typescript/ui/**`
- **Dependencies:** None (foundation)
- **Blockers:** None
- **Parallelization Safety:** 🟢 Safe — isolated package
- **Agent Count:** 1
- **Key Deliverables:**
  - Responsive layout grammar (mobile breakpoints baked into Page/Card/Section)
  - Chart component for analytics
  - DateRangePicker component
  - Density toggle (comfortable/compact)
  - Storybook documentation complete
  - Accessibility audit pass

---

#### Workstream 2: MERCHANT CONTROL PLANE UX
- **Objective:** Complete page migrations, feedback system, empty states, navigation restructure
- **Folder Ownership:** `apps/merchant-control-plane/src/**`
- **Dependencies:** Workstream 1 (design system)
- **Blockers:** Design system components must exist before page migration
- **Parallelization Safety:** 🟢 Safe — single app, no cross-app collision
- **Agent Count:** 2-3 (one per sub-domain: pages/navigation/theme-editor)
- **Key Deliverables:**
  - UX3 completion (remaining feedback migrations)
  - UX4: Empty states on all lists
  - UX5: Navigation restructure (grouped sidebar + ⌘K)
  - UX6: Dashboard redesign (setup guide + metrics)
  - UX7: Theme editor (live preview + section tree)
  - UX9: Productivity (IndexTable adoption, bulk actions)
  - UX10: Responsive mobile
  - UX11: Visual polish + globals.css elimination

---

#### Workstream 3: MARKETPLACE UX (Apps + Themes)
- **Objective:** Make app/theme marketplaces feel trustworthy and premium
- **Folder Ownership:** `apps/app-marketplace/src/**`, `apps/theme-marketplace/src/**`
- **Dependencies:** Workstream 1 (design system)
- **Blockers:** None
- **Parallelization Safety:** 🟢 Safe — separate apps
- **Agent Count:** 1
- **Key Deliverables:**
  - App cards with ratings/screenshots/pricing/badges
  - App detail page with screenshot carousel + permissions
  - App consent screen + install confirmation
  - Theme preview cards (16:9) + filter rail
  - Theme detail with preview-in-store
  - "Built for LetBuyy" badge

---

#### Workstream 4: STOREFRONT POLISH
- **Objective:** Polish storefront rendering, customer account, checkout UX
- **Folder Ownership:** `apps/storefront-runtime/src/**`
- **Dependencies:** Workstream 1 (design system)
- **Blockers:** None
- **Parallelization Safety:** 🟢 Safe — separate app
- **Agent Count:** 1
- **Key Deliverables:**
  - Consistent storefront component grammar
  - Customer account polish
  - Cart/checkout UX improvements
  - Theme preview route for editor iframe
  - Mobile responsive storefront

---

#### Workstream 5: PLATFORM OPERATIONS
- **Objective:** Build operational substance in Console and Ops Portal
- **Folder Ownership:** `apps/platform-console/src/**`, `apps/platform-operations-portal/src/**`
- **Dependencies:** Workstream 1 (design system), API data availability
- **Blockers:** 🟠 Partially blocked — many views need API endpoints that may not exist
- **Parallelization Safety:** 🟢 Safe — separate apps
- **Agent Count:** 1
- **Key Deliverables:**
  - Console: Merchant directory, revenue dashboard, subscription management
  - Console: Trust & Safety, audit logs
  - Ops Portal: CRM, ticket system, merchant health
  - Ops Portal: Onboarding support, communications
  - [SKIP — NEEDS BACKEND] items logged for missing API data

---

#### Workstream 6: IDENTITY & MARKETING
- **Objective:** Polish auth flows and marketing site
- **Folder Ownership:** `apps/identity-platform/src/**`, `apps/marketing-site/src/**`
- **Dependencies:** Workstream 1 (design system)
- **Blockers:** None
- **Parallelization Safety:** 🟢 Safe — separate apps
- **Agent Count:** 1
- **Key Deliverables:**
  - Identity: Onboarding wizard polish, success states, guided flows
  - Identity: Store selection UX
  - Marketing: Pricing page, feature comparison, conversion flow
  - Marketing: Premium landing page design

---

#### Workstream 7: PRODUCTION HARDENING
- **Objective:** Close remaining production readiness gaps
- **Folder Ownership:** `services/**`, `database/**`, `infrastructure/**`, `config/**`
- **Dependencies:** None (independent)
- **Blockers:** 🔴 Live credentials for Cashfree/Resend/social OAuth
- **Parallelization Safety:** 🟢 Safe — no UI overlap
- **Agent Count:** 1
- **Key Deliverables:**
  - Cashfree sandbox proof (when credentials available)
  - Resend email integration (when API key available)
  - Social OAuth configuration
  - CI/CD pipeline completion
  - Monitoring/observability setup
  - Staging deployment runbook

---

#### Workstream 8: MOBILE PARITY
- **Objective:** Align Flutter mobile app with web design language
- **Folder Ownership:** `apps/mobile/**`, `packages/dart/**`
- **Dependencies:** Workstream 1 (design tokens)
- **Blockers:** None
- **Parallelization Safety:** 🟢 Safe — separate runtime (Dart)
- **Agent Count:** 1
- **Key Deliverables:**
  - Shared design tokens (colors, typography, spacing) from @letbuyy/ui → Dart
  - Component parity audit
  - Navigation alignment
  - Theme editor mobile experience

---

### C.2 — Wave Scheduling

#### Wave 1 (Week 1-2) — Foundation + Parallel Starts
| Workstream | Tasks | Agents | Collision Risk |
|------------|-------|--------|----------------|
| WS1: Design System | Responsive grammar, Chart, DateRangePicker | 1 | None |
| WS2: Merchant UX | Complete UX3 (remaining pages), Start UX4 | 2 | None |
| WS7: Production | CI/CD, monitoring scaffold | 1 | None |

> **Why together:** WS1 is a dependency for everything but already has ~25 components. WS2 continues the in-progress UX3 migration. WS7 is fully independent.

---

#### Wave 2 (Week 3-4) — UX Acceleration
| Workstream | Tasks | Agents | Collision Risk |
|------------|-------|--------|----------------|
| WS2: Merchant UX | UX4 (empty states), UX5 (navigation) | 2 | None |
| WS3: Marketplace UX | App/Theme marketplace redesign | 1 | None |
| WS6: Identity & Marketing | Auth flow polish, marketing site | 1 | None |

> **Why together:** UX4+UX5 are merchant-only. WS3 and WS6 touch completely different apps. Zero collision.

---

#### Wave 3 (Week 5-8) — Flagship Features
| Workstream | Tasks | Agents | Collision Risk |
|------------|-------|--------|----------------|
| WS2: Merchant UX | UX6 (dashboard), UX7 (theme editor) | 2-3 | None |
| WS4: Storefront | Preview route, customer account, checkout | 1 | 🟡 Low — WS2 theme editor uses storefront preview |
| WS5: Operations | Console + Ops Portal build-out | 1 | None |

> **Why together:** Theme editor (WS2) needs a storefront preview route (WS4), but they touch different files. WS5 is fully independent.

---

#### Wave 4 (Week 9-10) — Productivity + Mobile
| Workstream | Tasks | Agents | Collision Risk |
|------------|-------|--------|----------------|
| WS2: Merchant UX | UX9 (productivity), UX10 (mobile responsive) | 2 | None |
| WS8: Mobile Parity | Design token sync, component audit | 1 | None |

> **Why together:** Web responsive (WS2) and native mobile (WS8) are parallel paths to the same goal. Zero collision.

---

#### Wave 5 (Week 11-13) — Polish + Launch Prep
| Workstream | Tasks | Agents | Collision Risk |
|------------|-------|--------|----------------|
| WS2: Merchant UX | UX11 (visual polish, globals.css elimination) | 1 | None |
| WS1: Design System | Storybook docs, accessibility audit | 1 | None |
| WS7: Production | Staging deploy, credential integration | 1 | None |
| All | Final governance + cross-app verification | 1 | None |

---

## PHASE D — CODEX MISSION REFERENCES

> Each workstream has a dedicated mission document. See companion artifacts.

| Workstream | Mission Document | Mode |
|------------|-----------------|------|
| WS1: Design System | `CODEX_DESIGN_SYSTEM_MISSION.md` | Autonomous, continuous |
| WS2: Merchant UX | `CODEX_SHOPIFY_UX_MISSION.md` (existing, in-progress) | Autonomous, continuous |
| WS3: Marketplace UX | `CODEX_MARKETPLACE_UX_MISSION.md` | Autonomous, continuous |
| WS4: Storefront | `CODEX_STOREFRONT_MISSION.md` | Autonomous, continuous |
| WS5: Operations | `CODEX_OPERATIONS_MISSION.md` | Autonomous, continuous |
| WS6: Identity & Marketing | `CODEX_IDENTITY_MARKETING_MISSION.md` | Autonomous, continuous |
| WS7: Production | `CODEX_PRODUCTION_READINESS_MISSION.md` (existing, blocked-human) | Human-gated |
| WS8: Mobile Parity | `CODEX_MOBILE_PARITY_MISSION.md` | Autonomous, continuous |

---

## PHASE E — 90-DAY EXECUTION ROADMAP

### Week 1-2: Foundation Sprint
```
Expected state after Week 2:
├── Design system: 60% → 80% (responsive grammar, Chart, DateRangePicker)
├── Merchant UX: 40% → 55% (UX3 complete, UX4 started)
├── Production: 60% → 65% (CI/CD, monitoring scaffold)
├── Governance: 128/128 maintained
└── Milestone: Every page has toasts, skeletons, save bars, confirm dialogs
```

### Week 3-4: UX Acceleration
```
Expected state after Week 4:
├── Merchant UX: 55% → 70% (UX4 + UX5 complete)
├── App Marketplace: 55% → 75% (redesigned cards, consent, install)
├── Theme Marketplace: 55% → 70% (preview cards, filters)
├── Identity: 80% → 85% (onboarding polish)
├── Marketing: 50% → 65% (pricing page, conversion flow)
└── Milestone: Grouped navigation, ⌘K palette, empty states everywhere
```

### Month 2: Flagship Features
```
Expected state after Month 2:
├── Merchant UX: 70% → 85% (dashboard, theme editor)
├── Theme Editor: 35% → 75% (live preview, section tree, device toggle)
├── Storefront: 75% → 85% (preview route, checkout polish)
├── Operations: 10% → 40% (console + ops portal build-out)
├── Design System: 80% → 90% (full component coverage)
└── Milestone: Live theme editor is functional, dashboard is Shopify-grade
```

### Month 3: Productivity + Polish
```
Expected state after Month 3:
├── Merchant UX: 85% → 92% (productivity, mobile responsive, visual polish)
├── Design System: 90% → 95% (accessibility, docs, globals.css < 1000 lines)
├── Mobile Parity: 55% → 70% (design token sync)
├── Production: 65% → 80% (staging ready, credentials integrated)
├── Operations: 40% → 55% (CRM, tickets functional)
└── Milestone: Platform feels like a unified commerce OS; launch-ready for beta
```

### Platform Maturity Trajectory

```
Week 0  ████████░░░░░░░░  ~50% (functional but fragmented)
Week 2  ██████████░░░░░░  ~60% (feedback everywhere, consistency growing)
Week 4  ████████████░░░░  ~72% (navigation, empty states, marketplaces)
Week 8  ██████████████░░  ~83% (theme editor, dashboard, storefront)
Week 13 ███████████████░  ~90% (productivity, mobile, polish)
```

---

## COLLISION AVOIDANCE MATRIX

| | WS1 | WS2 | WS3 | WS4 | WS5 | WS6 | WS7 | WS8 |
|---|---|---|---|---|---|---|---|---|
| **WS1** (UI pkg) | — | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **WS2** (Merchant) | 🟢 | — | 🟢 | 🟡¹ | 🟢 | 🟢 | 🟢 | 🟢 |
| **WS3** (Marketplace) | 🟢 | 🟢 | — | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **WS4** (Storefront) | 🟢 | 🟡¹ | 🟢 | — | 🟢 | 🟢 | 🟢 | 🟢 |
| **WS5** (Operations) | 🟢 | 🟢 | 🟢 | 🟢 | — | 🟢 | 🟢 | 🟢 |
| **WS6** (Identity) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | — | 🟢 | 🟢 |
| **WS7** (Production) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | — | 🟢 |
| **WS8** (Mobile) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | — |

¹ WS2 theme editor uses a storefront preview route from WS4. Coordinate: WS4 builds the preview route first, WS2 consumes it.

---

## UNIVERSAL OPERATING RULES (all missions)

1. **KEEP 128 VALIDATORS GREEN** at every commit. No exceptions.
2. **Architecture is DO NOT TOUCH.** No edits to: `services/**`, `packages/*-core/**`, `shared-types`, `api-client`, `api-types`, `database/**`, `scripts/validators/**`, `docs/governance/**`.
3. **One design system.** Every screen composes from `@letbuyy/ui`. No new ad-hoc CSS.
4. **Visual proof.** Every UX change needs before/after screenshots.
5. **Small reversible commits.** One component or one page per commit.
6. **Human-skip ledger.** Backend-gated items → `[SKIP — NEEDS BACKEND]` with exact requirements.
7. **Build is network-free.** Self-hosted fonts. No `next/font/google`.
8. **Accessibility baseline.** Keyboard, focus, ARIA, AA contrast on every new component.
9. **Max 3 attempts** per task → log BLOCKED → next task.
10. **No fabrication.** Every DONE needs command + result + screenshot evidence.

---

## SINGLE SOURCE OF TRUTH

This document is the master execution plan. Individual mission documents derive from it. When this document and a mission document conflict, this document wins.

**Last updated:** 2026-06-02T17:24:00Z
**Governance state:** 128/128 green
**Build state:** 57/57 typecheck, 287/287 tests, 5/5 E2E
