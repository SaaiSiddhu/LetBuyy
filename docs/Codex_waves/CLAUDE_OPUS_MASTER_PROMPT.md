# CLAUDE OPUS 4.8 — LETBUYY CODEX MULTI-TASK MISSION GENERATOR

> **Paste this entire prompt into Claude Opus 4.8 (Max) on claude.ai in a new Project.**
> **Mode:** Co-work with Artifacts enabled.
> **Model:** Claude Opus 4.8 (Max thinking, effort: highest).
> **Attach:** The entire `docs/Codex_waves/` folder contents as project knowledge.

---

## HOW TO USE THIS PROMPT

### Step 1 — Create a Claude Project
1. Go to claude.ai → Projects → Create New Project
2. Name it: `LetBuyy Codex Mission Generator`
3. Set model to **Claude Opus 4.8** (or Opus 4.8 Max if available)

### Step 2 — Upload Project Knowledge
Upload these files from your repo as **Project Knowledge**:
- `docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT.md`
- `docs/Codex_waves/CODEX_DESIGN_SYSTEM_MISSION.md`
- `docs/Codex_waves/CODEX_MERCHANT_UX_MISSION.md`
- `docs/Codex_waves/CODEX_MARKETPLACE_UX_MISSION.md`
- `docs/Codex_waves/CODEX_STOREFRONT_MISSION.md`
- `docs/Codex_waves/CODEX_OPERATIONS_MISSION.md`
- `docs/Codex_waves/CODEX_IDENTITY_MARKETING_MISSION.md`
- `docs/Codex_waves/CODEX_MOBILE_PARITY_MISSION.md`
- `CODEX_SHOPIFY_UX_MISSION.md` (the single-task reference)
- `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md`
- `AGENTS.md`

### Step 3 — Paste the Prompt Below
Copy everything from `--- BEGIN PROMPT ---` to `--- END PROMPT ---` and paste it as your first message.

### Step 4 — Iterate on Artifacts
Claude will generate artifacts one at a time. After each artifact, say:
`"Next artifact"` to continue, or provide feedback to refine.

---

## --- BEGIN PROMPT ---

<context>
<role>
You are the Principal Architect, Principal Product Designer, Principal UX Researcher, Staff Engineer, Shopify Platform Specialist, SaaS Operations Architect, and Technical Program Manager for LetBuyy — a Shopify-class, multi-tenant commerce and site-builder SaaS platform targeting India-first merchants.

You have the deepest expertise in:
- Shopify's Polaris design system (2026: Web Components era, ~50+ composable primitives, semantic design tokens, composition-over-monoliths)
- Shopify Admin UX architecture (drill-in navigation, ~9 grouped nav items, ⌘K command palette, progressive disclosure)
- Shopify Theme Editor architecture (Parent-Child iframe pattern, postMessage API for section highlighting/scrolling, JSON templates as source of truth, section tree with drag-drop reorder)
- Shopify App Marketplace UX (OAuth install flow, consent screen with scopes, "Built for Shopify" badge, ratings weighted for recency, 21,500+ apps)
- Shopify Settings architecture (centralized Settings hub with billing/plans/domains/users/roles/security/payments/checkout/shipping/taxes/notifications)
- Multi-tenant SaaS commerce admin UX best practices (2026: "Calm Design", progressive disclosure, role-based modular interfaces, action-oriented dashboards, frictionless onboarding)
- Claude Opus 4.8 capabilities (1M-token context, extended thinking, agentic autonomy, effort control, hybrid reasoning)
- Codex multi-agent mission design (domain ownership, collision avoidance, wave scheduling, parallel execution, folder boundaries)
</role>

<project>
LetBuyy is a governed, Shopify-class, multi-tenant commerce operating system.

CRITICAL FACTS:
- Architecture is fundamentally sound (~85%). Do NOT redesign.
- Backend is robust (~80%). Do NOT rewrite.
- Commerce Engine works (~80%). Do NOT rebuild.
- The problem is UX maturity (~45%), design consistency, merchant workflows, settings architecture (~20%), and operations layer (~10%).
- Shopify feels better NOT because of backend — but because of 6 product-layer disciplines: deep design system, opinionated layout grammar, relentless feedback, designed empty states, progressive disclosure navigation, and defaults that do the work.
- LetBuyy has 9 web apps, 3 mobile apps, 21 packages, 9 services, 31 API gateway route modules.
- 128 governance validators — all must stay green.
- 57/57 typecheck, 287/287 tests, 5/5 E2E — all must stay green.
- Self-hosted fonts (Geist). No next/font/google.
- Lucide icons (centralized).
</project>

<repository_structure>
APPS (9 web + 3 mobile):
- apps/identity-platform — Auth/signup/OTP/onboarding (Next.js 15, ~12 pages, 80% mature)
- apps/merchant-control-plane — Dashboard/products/orders/themes/apps/settings (Next.js 15, ~56 pages, 65% mature)
- apps/storefront-runtime — Wildcard tenant storefronts (Next.js 15, ~30 pages, 75% mature)
- apps/marketing-site — Public landing/pricing (Next.js 15, ~8 pages, 50% mature)
- apps/app-marketplace — Extension marketplace (Next.js 15, ~10 pages, 55% mature)
- apps/theme-marketplace — Theme catalog/detail/checkout (Next.js 15, ~8 pages, 55% mature)
- apps/platform-console — Super admin scaffold (Next.js 15, ~6 pages, 20% mature)
- apps/platform-operations-portal — Employee ops scaffold (Next.js 15, ~5 pages, 15% mature)
- apps/mobile/merchant-app — Native store builder (Flutter, ~40 screens, 60% mature)
- apps/mobile/shopper-app — Reserved native shopper runtime
- apps/mobile/operator-app — Native operator scaffold

PACKAGES (21):
- packages/shared-types — Cross-runtime contracts (✅ Stable)
- packages/tenant-core — Tenant/site resolution (✅ Stable)
- packages/commerce-core — Product/catalog/inventory (✅ Stable)
- packages/checkout-core — Cart/order/checkout/tax (✅ Stable)
- packages/auth-core — Identity/session/RBAC (✅ Stable)
- packages/theme-engine — Theme registry/sections/blocks (✅ Stable)
- packages/cms-core — Pages/policies/navigation (✅ Stable)
- packages/event-core — Domain events/outbox/webhooks (✅ Stable)
- packages/billing-core — Plans/subscriptions/invoices (✅ Stable)
- packages/app-engine — App/OAuth/Bridge contracts (✅ Stable)
- packages/typescript/ui — Design system @letbuyy/ui (🟠 In Progress — ~25 components, tokens built)
- packages/typescript/utils — Supabase/API/auth utils (✅ Stable)
- packages/typescript/api-client — Typed Commerce API client (✅ Stable)
- packages/dart/core, dart/models, dart/services, dart/ui_kit — Flutter packages (Stable)
- packages/application-services, distributed-runtime, orchestration, projection-runtime, runtime-composition, infrastructure — Backend orchestration (✅ Stable)

SERVICES (9):
- services/api-gateway — Cloudflare Workers Hono, 31 route modules, ~680KB (✅ Active)
- services/webhook-service — Cloudflare Workers (✅ Active)
- services/queue-workers, checkout-runtime, event-bus, analytics-pipeline, search-service, notification-service, media-service — (🟡 Scaffold)

DATABASE:
- Supabase Postgres + RLS
- 000_baseline.sql (928KB) + migrations 073-075
- Key tables: sites, products, orders, customers, themes, apps, theme_releases, app_installs, users, subscriptions, payment_configs, shipping_zones, tax_rates, pages, blog_posts, media, coupons, reviews, categories, collections

DESIGN SYSTEM (@letbuyy/ui) CURRENT STATE:
- 25+ components already built: Button, Input, Textarea, DataTable, Badge, Page, PageHeader, Card, Section, Banner, Toast+ToastProvider, Skeleton, EmptyState, Modal, ConfirmDialog, Tabs, Select, Combobox, Tooltip, MetricCard, Avatar, Pagination, IndexTable, SaveBar, CommandPalette, DesignSystemRoot
- CSS variables token system (--lb-*) built
- TypeScript tokens exported
- Storybook configured
- globals.css still 8,885 lines (was 9,248) — ~30 pages migrated, ~26 remain

CURRENT MISSION STATUS:
- Phase 1 (Foundation): ✅ DONE
- Phase 2 (Federation): ✅ DONE (BLOCKED live)
- Phase 3 (Production Readiness): ✅ DONE (BLOCKED creds)
- Phase 4 (Shopify UX): 🟠 IN PROGRESS — UX0-UX2 done, UX3 in progress
</repository_structure>

<architecture_invariants>
ABSOLUTE DO-NOT-TOUCH LIST (zero edits — violation = mission failure):
- services/** — backend
- packages/*-core/** — domain logic
- packages/shared-types/** — contracts (consume only)
- packages/typescript/api-client/** — API client (consume only)
- packages/typescript/api-types/** — API types (consume only)
- database/** — migrations/schema
- scripts/validators/** — governance (read-only)
- docs/governance/** — governance memory (read-only)
- Any auth/session/RBAC/event/webhook/OAuth/billing LOGIC

ALLOWED:
- packages/typescript/ui/** — build/extend the design system
- apps/*/src/** — compose UI, migrate pages, wire existing api-client calls
</architecture_invariants>

<shopify_intelligence_2026>
POLARIS DESIGN SYSTEM (2026):
- Moved from React to Web Components (framework-agnostic)
- ~50+ composable primitives (composition over monoliths)
- Semantic design tokens (CSS variables) — never hardcode values
- Key components: Page, Card, Badge, Banner, Toast, Skeleton, EmptyState, Modal, IndexTable, ResourceList, Tabs, Select, Combobox, Tooltip, Avatar, Pagination, ProgressBar, Spinner, Divider, DescriptionList, Breadcrumbs
- Storybook for documentation + visual testing
- WCAG-AA accessibility baseline on every component

THEME EDITOR ARCHITECTURE:
- Parent-Child iframe pattern: Admin hosts editor sidebar, storefront renders in iframe
- postMessage API for bidirectional communication (section highlighting, scrolling, setting sync)
- JSON templates as source of truth for page structure (sections + blocks)
- Section tree: sidebar listing template sections with drag-drop reorder + add/remove
- Device toggle: Desktop/Tablet/Mobile via CSS viewport override
- Sections serialize to JSON → storefront iframe re-renders affected section
- getBoundingClientRect() for Preview Inspector coordinate communication
- Draft vs Live: themes install as drafts, publish explicitly

APP MARKETPLACE UX:
- OAuth install flow with explicit consent screen (scopes listed)
- "Built for Shopify" quality badge (from quality-gate result)
- Weighted ratings system (recency + usefulness + trustworthiness)
- Screenshot carousel + description + reviews + permissions list + pricing table
- Post-install: success toast + auto-navigate to embedded app view
- Uninstall: confirmation with data-loss note
- 21,500+ apps, AI integration trend

SETTINGS ARCHITECTURE:
- Centralized Settings hub with grouped sub-pages:
  - Store details, Business details
  - Plan & Billing
  - Users & Permissions (role-based access control)
  - Payments (Shopify Payments native, third-party gateways)
  - Checkout (locked core, customizable branding)
  - Shipping & Delivery (profiles, zones, rates, package types)
  - Taxes & Duties (auto-calculation, regional config)
  - Domains
  - Notifications (email templates, merchant alerts)
  - Languages & Localization
  - Legal Policies (auto-generated templates)
  - Apps & Sales Channels
  - Custom Data (metafields/metaobjects)
  - Security (2FA, recovery codes)

NAVIGATION (2026):
- ~9 grouped top-level items: Home, Orders, Products, Customers, Marketing, Discounts, Content, Analytics, Online Store, Settings
- Drill-in navigation (replaces double left-nav)
- ⌘K command palette: search + quick actions + entity search
- Keyboard shortcuts: g+p, g+o, g+c, n
- Progressive disclosure: show ~9, reveal depth contextually
- Admin Intents: deep-link to specific configuration areas

MERCHANT UX BEST PRACTICES (2026):
- "Calm Design": whitespace-heavy, reduce cognitive load
- Progressive disclosure: hide advanced settings until needed
- Role-based modular interfaces
- Action-oriented dashboards (not passive reporting)
- Contextual AI guidance (predictive suggestions)
- Frictionless onboarding: "early wins" within minutes
- Self-service empowerment: merchants manage own config without support
- Reduce "busywork": minimize clicks for routine operations
</shopify_intelligence_2026>

<existing_missions_reference>
You have access to the following existing documents in Project Knowledge:
1. LETBUYY_MASTER_EXECUTION_BLUEPRINT.md — the master plan with 8 workstreams, 5 waves, collision avoidance matrix
2. CODEX_DESIGN_SYSTEM_MISSION.md (WS1) — packages/typescript/ui/**
3. CODEX_MERCHANT_UX_MISSION.md (WS2) — apps/merchant-control-plane/src/**
4. CODEX_MARKETPLACE_UX_MISSION.md (WS3) — apps/app-marketplace/src/** + apps/theme-marketplace/src/**
5. CODEX_STOREFRONT_MISSION.md (WS4) — apps/storefront-runtime/src/**
6. CODEX_OPERATIONS_MISSION.md (WS5) — apps/platform-console/src/** + apps/platform-operations-portal/src/**
7. CODEX_IDENTITY_MARKETING_MISSION.md (WS6) — apps/identity-platform/src/** + apps/marketing-site/src/**
8. CODEX_MOBILE_PARITY_MISSION.md (WS8) — apps/mobile/** + packages/dart/**
9. CODEX_SHOPIFY_UX_MISSION.md — the SINGLE-TASK reference mission (UX0→UX11)

READ ALL OF THESE FIRST. They are your starting point, not your output. Your job is to DEEPLY ENHANCE them with:
- More precise task breakdowns (every task has exact file paths, exact component names, exact API endpoints)
- Shopify-quality UX specifications (not generic descriptions — specify exactly what Shopify does and how LetBuyy should match it)
- Settings architecture workstream (MISSING from current missions — this is a major gap)
- Production hardening workstream (WS7 exists but needs Codex mission format)
- Developer ecosystem workstream (MISSING — future but needs a scaffold mission)
- Cross-workstream integration tests
- Dependency graph with exact handoff points
- Per-task effort estimates (S/M/L)
- Per-task priority (P0/P1/P2/P3)
- Risk assessment per task
</existing_missions_reference>
</context>

<task>
## YOUR MISSION

Perform the following phases IN ORDER. Generate each phase as a separate Claude Artifact.

### PHASE 1: DEEP REPOSITORY ANALYSIS (Artifact: `LETBUYY_DEEP_ANALYSIS.md`)

Perform an exhaustive analysis of the LetBuyy repository. This is NOT a copy of what's in the blueprint — this is a DEEPER dive. For each app, package, and service:

1. **Per-App UX Audit** — For each of the 9 web apps:
   - Current page count and route map
   - Design system adoption percentage (how many pages use @letbuyy/ui vs bespoke CSS)
   - Empty state coverage (% of lists that have designed empty states)
   - Feedback coverage (% of mutations that fire toasts/skeletons/save-bars)
   - Navigation quality score (1-10)
   - Mobile responsiveness score (1-10)
   - Shopify UX parity score (1-10)
   - Top 3 UX gaps per app
   - Exact files that need migration

2. **Design System Gap Analysis** — Compare @letbuyy/ui against Shopify Polaris 2026:
   - Components LetBuyy has that Polaris has ✅
   - Components Polaris has that LetBuyy is missing ❌
   - Components that exist but need enhancement 🟠
   - Token coverage (color/typography/spacing/radius/shadow/motion)
   - Responsive grammar coverage
   - Accessibility compliance level

3. **Settings Architecture Analysis** — Map every settings-related route/page across all apps:
   - Current settings pages (scattered)
   - Target settings hub structure (Shopify-style)
   - Gap between current and target
   - Data sources for each settings page (which API endpoints exist)

4. **API Data Availability Audit** — For every UX feature planned:
   - Which features can be built with existing API data ✅
   - Which features need API data that doesn't exist yet ❌ → `[SKIP — NEEDS BACKEND]`
   - Exact endpoint and field requirements for missing data

5. **Collision Risk Matrix** — Verify the existing collision avoidance matrix with:
   - Exact shared files between workstreams
   - Exact shared components
   - Exact shared hooks/utils
   - Resolution strategy for each collision

---

### PHASE 2: ENHANCED MASTER EXECUTION BLUEPRINT (Artifact: `LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md`)

Re-generate the master blueprint with these enhancements:

1. **10 workstreams** (not 8) — add:
   - WS9: Settings Architecture (NEW — critical P0 gap)
   - WS10: Developer Ecosystem Scaffold (NEW — P3 but needs placeholder)

2. **Per-workstream detail:**
   - Exact folder ownership (with file-level granularity where there's collision risk)
   - Exact dependency chain (which tasks block which)
   - Estimated total effort (person-weeks)
   - Critical path identification
   - Risk register

3. **Enhanced Wave Scheduling:**
   - 6 waves (not 5) — Settings Architecture needs its own wave
   - Per-wave: expected platform maturity delta
   - Per-wave: governance checkpoint requirements
   - Per-wave: integration test requirements

4. **Cross-Workstream Handoff Protocol:**
   - WS1→WS2 handoff (design system component → page migration)
   - WS4→WS2 handoff (preview route → theme editor)
   - WS2→WS9 handoff (page migration → settings architecture)
   - WS1→WS8 handoff (web tokens → Dart tokens)

5. **Quality Gates:**
   - Per-wave quality gate checklist
   - Per-workstream completion criteria
   - Platform-wide readiness criteria

---

### PHASE 3: INDIVIDUAL MISSION DOCUMENTS (8-10 Artifacts)

Generate each workstream's mission as a separate artifact. Each mission MUST follow this EXACT structure:

```markdown
# CODEX [WORKSTREAM NAME] MISSION — LetBuyy [WS#]

**Driver:** Codex agent(s). Reasoning: `[xhigh|high|medium]`.
**Mode:** Continuous, autonomous. Never stop while unblocked work remains.
**Domain Ownership:** `[exact paths]` ONLY.
**Dependencies:** [list with WS references]
**Predecessor:** [what must be done before this starts]

---

## 0. PRIME DIRECTIVE
[One paragraph: what this workstream achieves and why it matters]

**SUCCESS CRITERIA** (COMPLETE only when ALL proven with evidence):
[Numbered list — each criterion is measurable and screenshot-provable]

---

## 1. OPERATING CONTRACT
[Numbered list of hard rules — same structure as the reference CODEX_SHOPIFY_UX_MISSION.md §1]

---

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
[Exact paths that are off-limits for this workstream]

---

## 3. THE WORK — [PHASE_PREFIX]1 → [PHASE_PREFIX]N

### [PHASE_PREFIX]1 — [Phase Name]
For EVERY task:
- **[PHASE_PREFIX]1.1** [Task description] — **Files:** `[exact paths]` — **Effort:** [S/M/L] — **Priority:** [P0-P3]
  - Shopify reference: [what Shopify does for this exact feature]
  - Exact implementation: [specific technical approach]
  - Data source: [API endpoint or [SKIP — NEEDS BACKEND] with requirements]
- **GATE [PHASE_PREFIX]1:** [completion criteria] — [validation commands] — [screenshot requirements]

[Repeat for each phase]

---

## 4. PARALLELIZATION GUIDE
[Table: which agents can run in parallel, which files each owns]

---

## 5. SHOPIFY REFERENCE SPECIFICATIONS
[For this workstream's domain: exact Shopify UX patterns to match, with specific descriptions of how each Shopify feature works and how LetBuyy should implement it]

---

## 6. LEDGER FORMAT
[Exact ledger template for this workstream]

---

## 7. LAUNCH PROMPT
[Ready-to-paste Codex /goal prompt for this workstream]
```

Generate these missions:
1. **WS1: Design System Completion** — Enhanced with Polaris 2026 component parity, responsive grammar spec, accessibility matrix, Storybook documentation plan
2. **WS2: Merchant Control Plane UX** — Enhanced with per-page migration checklist (all ~56 pages), exact file paths, Shopify parity spec per page
3. **WS3: Marketplace UX** — Enhanced with Shopify App Store + Theme Store exact UX specifications
4. **WS4: Storefront Polish** — Enhanced with theme preview route technical spec (postMessage protocol, iframe security, JSON template sync)
5. **WS5: Platform Operations** — Enhanced with exact API data audit (what exists vs needs backend)
6. **WS6: Identity & Marketing** — Enhanced with onboarding flow wireframe spec, pricing page comparison matrix
7. **WS7: Production Hardening** — NEW in Codex format (services/**, database/**, infrastructure/**)
8. **WS8: Mobile Parity** — Enhanced with exact token-for-token mapping (web CSS var → Dart constant)
9. **WS9: Settings Architecture** — BRAND NEW (the biggest gap). Full Shopify Settings hub spec.
10. **WS10: Developer Ecosystem Scaffold** — NEW placeholder mission for developers.letbuyy.store

---

### PHASE 4: INTEGRATION & DEPENDENCY MAP (Artifact: `LETBUYY_DEPENDENCY_MAP.md`)

Generate a complete dependency graph:
1. Mermaid diagram of all workstream dependencies
2. Critical path identification
3. Handoff protocol for each dependency edge
4. Risk mitigation for each blocker
5. Timeline with parallel tracks

---

### PHASE 5: CODEX LAUNCH PLAYBOOK (Artifact: `CODEX_LAUNCH_PLAYBOOK.md`)

Generate the operational playbook for launching all Codex agents:
1. Agent assignment table (which Codex agent runs which workstream)
2. Wave-by-wave launch commands (ready-to-paste /goal prompts)
3. Monitoring checklist (what to check after each wave)
4. Escalation protocol (when to intervene)
5. Success metrics dashboard spec
</task>

<constraints>
HARD RULES FOR YOUR OUTPUT:
1. Every artifact is a COMPLETE, standalone document. No "see above" or "as mentioned earlier."
2. Every task has exact file paths, not vague descriptions.
3. Every task has an effort estimate (S ≤2d, M ≤1wk, L ≤1mo).
4. Every task has a priority (P0 do-first → P3 nice-to-have).
5. Every task has a Shopify reference (what Shopify does for comparison).
6. Every task has a data source (existing API endpoint OR [SKIP — NEEDS BACKEND] with requirements).
7. No architecture changes. Frontend + workflow only for WS1-6, WS8-10. WS7 is the only one touching backend/infra.
8. Keep 128 validators green. Keep 57/57 typecheck. Keep 287/287 tests. Keep 5/5 E2E.
9. Self-hosted fonts. No next/font/google.
10. Use @letbuyy/ui for everything. No new ad-hoc CSS.
11. Read the existing missions in Project Knowledge BEFORE generating. Enhance, don't restart from scratch.
12. Use XML tags internally for your own structure if helpful.
13. Generate ONE artifact at a time. Wait for my "Next artifact" before continuing.
14. Each artifact should be 2000-5000 lines. This is a MASSIVE, COMPREHENSIVE output.
15. Include the 2026 Shopify intelligence I provided in the context. Reference specific Shopify patterns.
</constraints>

<format>
OUTPUT FORMAT:
- Each phase = one Claude Artifact (markdown)
- Use tables, checklists, mermaid diagrams, code blocks
- Use GitHub-style alerts (NOTE, TIP, IMPORTANT, WARNING, CAUTION)
- Use collapsible sections for long lists
- Include before/after UX descriptions for every page change
- Include exact Shopify screenshots/descriptions as reference points
</format>

## BEGIN NOW

Start with **PHASE 1: DEEP REPOSITORY ANALYSIS**. Generate the `LETBUYY_DEEP_ANALYSIS.md` artifact.

Read all the Project Knowledge files first. Then perform the deepest possible analysis of the repository structure, UX gaps, design system gaps, settings architecture gaps, API data availability, and collision risks.

This analysis will be the foundation for all subsequent mission documents. Make it exhaustive.

## --- END PROMPT ---
