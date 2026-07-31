# LetBuyy Design Intelligence Repository
*Last Updated: 2026-06-19 | Version: 1.0 | Agents: 10 | Documents: 21*

---

## What Is This?

This repository is the result of a 10-agent design intelligence audit across the full LetBuyy platform. It answers the questions a designer, engineer, or PM would spend days trying to answer manually: what does the design system actually provide, where is it being violated, how consistent is each app, what debt exists, and what should be fixed in what order.

The audit scope covers all active web applications (merchant-control-plane, identity-platform, marketing-site, storefront-runtime, platform-console, platform-operations-portal), the frozen apps (app-marketplace, developer-portal, theme-marketplace), and the Flutter mobile merchant app. It is a point-in-time snapshot as of 2026-06-19.

The platform's overall design health is **7.2/10 (Yellow)**. The foundation (`@letbuyy/ui`) is production-grade. The gap is adoption: legacy violations predate the ratchet enforcer, one app runs a parallel CSS property system, and there is no deployed Storybook for the existing governance documentation to be visible.

**This repository is read-only intelligence.** The authoritative governance gate is `node scripts/validate-governance.mjs` (107 validators). The authoritative fix order is `migration-strategy/IMPLEMENTATION_ROADMAP.md`.

---

## Directory Structure

```
docs/design-intelligence/
├── README.md                          ← This file
│
├── executive-summary/
│   └── EXECUTIVE_SUMMARY.md           ← Start here. Top 10 findings, health dashboard, quick wins.
│
├── ecosystem-analysis/
│   ├── DESIGN_SYSTEM_INVENTORY.md     ← Full @letbuyy/ui inventory: components, tokens, rules, gaps.
│   └── TOKEN_INVENTORY.md             ← All ~330 --lb-* CSS custom properties with light/dark values.
│
├── application-intelligence/
│   ├── APPLICATION_TOPOLOGY.md        ← Per-app: routes, layout type, component deps, CSS notes.
│   └── ECOSYSTEM_MAP.md               ← Platform tier diagram, active/frozen/reserved map, user journeys.
│
├── visual-identity/
│   ├── VISUAL_IDENTITY_REPORT.md      ← Per-app visual analysis: color, type, radius, mood, intent.
│   └── APP_BRAND_GUIDES.md            ← Comparative matrix of all 9 apps across visual attributes.
│
├── layout-architecture/
│   ├── LAYOUT_TOPOLOGY.md             ← Global layout primitives and per-app layout trees.
│   └── PAGE_ARCHITECTURE.md           ← Page pattern library: list+detail, settings, wizard, etc.
│
├── component-intelligence/
│   ├── COMPONENT_CATALOG.md           ← All @letbuyy/ui components with props, tokens, usage notes.
│   └── COMPONENT_DUPLICATION_REPORT.md ← 7 duplications, 6 underutilizations, 6 ratchet violations.
│
├── design-debt/
│   ├── DESIGN_DEBT_REPORT.md          ← File-level violation audit with priority matrix and fix estimates.
│   └── CONSISTENCY_SCORECARD.md       ← Quantified scores (0–10) for 24 files across 3 apps.
│
├── interaction-design/
│   ├── INTERACTION_ARCHITECTURE.md    ← Nav patterns, action placement, form patterns, keyboard.
│   └── UX_PATTERN_LIBRARY.md          ← Canonical UX patterns across the platform.
│
├── theme-architecture/
│   ├── THEME_ARCHITECTURE.md          ← Token architecture, ThemeProvider, surface model, density.
│   └── THEME_GOVERNANCE.md            ← Theme governance rules, canary flags, Liquid/React model.
│
├── governance/
│   ├── LETBUYY_DESIGN_CONSTITUTION.md ← Ratified design law: 4-layer architecture, change control.
│   └── DESIGN_GOVERNANCE_MODEL.md     ← Operational model: what exists, what works, what is missing.
│
├── migration-strategy/
│   ├── DESIGN_MIGRATION_STRATEGY.md   ← Migration philosophy, baseline adoption rates, risk management.
│   └── IMPLEMENTATION_ROADMAP.md      ← 6-month phased roadmap with success criteria per phase.
│
└── evidence/                          ← (Empty) Reserved for visual snapshots and baseline captures.
```

---

## Document Index

### Executive Summary

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [EXECUTIVE_SUMMARY.md](executive-summary/EXECUTIVE_SUMMARY.md) | Platform-wide synthesis: top 10 findings, design health dashboard per dimension, application identity table, 5 quick wins, the governance gap analysis, and a full document index with per-role usage guides. | Start here. Every team member. |

---

### Ecosystem Analysis

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [DESIGN_SYSTEM_INVENTORY.md](ecosystem-analysis/DESIGN_SYSTEM_INVENTORY.md) | Full inventory of `@letbuyy/ui`: all 50+ components across 12 functional groups, the 4-tier token system, ESLint rules, ratchet validator categories, codemods, Storybook stories, Flutter mirror, and a gap list of 10 missing capabilities. | Before building anything new in @letbuyy/ui. When investigating what the design system provides vs. what it is missing. |
| [TOKEN_INVENTORY.md](ecosystem-analysis/TOKEN_INVENTORY.md) | Complete enumeration of all ~330 `--lb-*` CSS custom properties: Primitive, Semantic, Component, and Density tiers, with light and dark resolved values. Also documents the Tailwind v4 bridge utility classes. | When speccing designs or building components. When you need to know if a `--lb-*` token exists for a value before introducing a raw hardcode. |

---

### Application Intelligence

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [APPLICATION_TOPOLOGY.md](application-intelligence/APPLICATION_TOPOLOGY.md) | Per-app deep analysis covering: primary users, route structure, layout type, component dependency graph, active workflows, and CSS-level notes. Includes all active apps plus the Flutter merchant app. | When building a feature in a specific app. When you need to understand an app's constraints before designing for it. |
| [ECOSYSTEM_MAP.md](application-intelligence/ECOSYSTEM_MAP.md) | Platform-tier diagram showing active, frozen, and reserved apps. Inter-app dependency graph. User journey maps for new-merchant onboarding and shopper purchase flow. | When planning cross-app features. When a new team member needs the 30-second platform overview. When evaluating which app owns a domain. |

---

### Visual Identity

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [VISUAL_IDENTITY_REPORT.md](visual-identity/VISUAL_IDENTITY_REPORT.md) | Per-app visual analysis: palette rationale, typography choices, border-radius personality, shadow usage, dark mode implementation, mood and intent classification, and a consistency score per app. | When designing for a specific surface. When debugging visual inconsistency between apps. |
| [APP_BRAND_GUIDES.md](visual-identity/APP_BRAND_GUIDES.md) | Comparative matrix of all 9 apps across color, typography, radius, shadows, and motion. Coherence assessment — which apps share an intentional visual language vs. which diverge accidentally. Recommendations for formalizing the "ink lavender" palette. | When deciding how a new surface should look and feel relative to existing surfaces. When assessing cross-app brand coherence. |

---

### Layout Architecture

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [LAYOUT_TOPOLOGY.md](layout-architecture/LAYOUT_TOPOLOGY.md) | Global layout primitives: AppFrame, Sidebar, Page, PageHeader, PageContent, and their token-governed spacing rules. Per-app layout trees showing how each app is assembled from these primitives. | Before building a new page. When a layout is behaving unexpectedly and you need to understand the nesting hierarchy. |
| [PAGE_ARCHITECTURE.md](layout-architecture/PAGE_ARCHITECTURE.md) | Page pattern library: list+detail pattern, settings pattern, dashboard pattern, auth flow pattern, creation wizard pattern, empty state pattern. Each pattern documented with current usage, token compliance, and recommended implementation. | When scaffolding a new page type. When a PM asks how a new page should be structured. |

---

### Component Intelligence

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [COMPONENT_CATALOG.md](component-intelligence/COMPONENT_CATALOG.md) | Full catalog of all exported `@letbuyy/ui` components: props surface, token compliance, usage notes, and recommended patterns. Organized by the 12 functional groups. | Before building any UI. The reference for what exists and how to use it. |
| [COMPONENT_DUPLICATION_REPORT.md](component-intelligence/COMPONENT_DUPLICATION_REPORT.md) | 7 confirmed component duplications (inline patterns that already exist in @letbuyy/ui), 6 underutilization cases (components that exist but are bypassed), 6 active ratchet violations by named file, and 4 components that should be promoted from app-local to @letbuyy/ui. | Before building a new component — check here first. When doing a code review and suspecting a duplication. When planning Phase 2 of the migration roadmap. |

---

### Design Debt

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [DESIGN_DEBT_REPORT.md](design-debt/DESIGN_DEBT_REPORT.md) | File-level violation audit across merchant-control-plane, identity-platform, and marketing-site. Each violation entry includes: file path, violation type, specific line/pattern, severity (P0–P3), and fix time estimate. | When prioritizing debt remediation. When doing a design quality sprint. When a PM asks "how much debt do we have?" |
| [CONSISTENCY_SCORECARD.md](design-debt/CONSISTENCY_SCORECARD.md) | Quantified consistency scores (0–10) across 5 dimensions (Token Adoption, Component Usage, Layout Consistency, Typography, Locale Standards) for 24 files in 3 apps. Includes a top-10 debt items list and benchmark files for reference implementation. | When evaluating a specific file's quality before merging. When setting improvement targets per app. |

---

### Interaction Design

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [INTERACTION_ARCHITECTURE.md](interaction-design/INTERACTION_ARCHITECTURE.md) | Navigation patterns (sidebar, top nav, breadcrumbs), action placement conventions (primary/secondary/destructive), form patterns, feedback patterns (toast, dialog, inline), and keyboard interaction standards. | When designing new user flows. When debugging inconsistent interaction behavior across apps. |
| [UX_PATTERN_LIBRARY.md](interaction-design/UX_PATTERN_LIBRARY.md) | Canonical UX patterns in use across the platform. Each pattern includes its current usage status (adopted/inconsistent/missing), the recommended implementation, and the `@letbuyy/ui` component to use. | When a designer needs to know the established pattern for a common interaction. When evaluating whether to introduce a new pattern. |

---

### Theme Architecture

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [THEME_ARCHITECTURE.md](theme-architecture/THEME_ARCHITECTURE.md) | Token architecture (4-tier system), ThemeProvider system and surface model, density system (compact/comfortable/spacious), merchant theme engine, and the integration between the design system token layer and the Liquid/React theme runtime. | When working on the theme editor, the storefront runtime, or when the ThemeProvider behavior is unexpected. |
| [THEME_GOVERNANCE.md](theme-architecture/THEME_GOVERNANCE.md) | Theme governance rules, the Liquid canary flag (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED`), Liquid vs. React rendering model, theme registry governance, and the ART-17 freeze on new React-per-section patterns. | When making any change to the theme system. When onboarding onto the storefront-runtime. |

---

### Governance

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [LETBUYY_DESIGN_CONSTITUTION.md](governance/LETBUYY_DESIGN_CONSTITUTION.md) | Ratified design law for the platform: 4-layer architecture (Primitive/Semantic/Component/Density), per-surface boundaries, what is and is not permitted, and the change control process for design system modifications. | When making any change to `@letbuyy/ui`. When a design decision needs an authoritative rule reference. This is the design system equivalent of the LETBUYY_CONSTITUTION.md. |
| [DESIGN_GOVERNANCE_MODEL.md](governance/DESIGN_GOVERNANCE_MODEL.md) | Operational governance model: what currently exists and is enforced (ratchet, ESLint, codemods), what is claimed but not yet enforced (some surface boundaries), what is missing (deployed Storybook, Figma integration), and role definitions for the governance process. | When auditing what is actually enforced vs. aspirational. When onboarding a new design system contributor. |

---

### Migration Strategy

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [DESIGN_MIGRATION_STRATEGY.md](migration-strategy/DESIGN_MIGRATION_STRATEGY.md) | Migration philosophy (no big-bang rewrites), current adoption baseline per app (merchant-control-plane 39%, identity-platform 67%, marketing-site 15%), quick win candidates, and risk management principles. | Before starting any migration work. When deciding whether to migrate a file opportunistically or defer. |
| [IMPLEMENTATION_ROADMAP.md](migration-strategy/IMPLEMENTATION_ROADMAP.md) | 6-month phased roadmap: Phase 0 (audit + baseline, Week 1), Phase 1 (quick wins + P0 fixes, Weeks 2–4), Phase 2 (component migration, Weeks 5–12), Phase 3 (token adoption, Weeks 13–20), Phase 4 (governance hardening, Weeks 21–24). Each phase has explicit success criteria that must be met before the next phase begins. | When planning sprints. When a lead needs to sequence design debt work against feature development. |

---

## How to Use This Repository

### You are a designer joining the team

Read in this order:
1. [EXECUTIVE_SUMMARY.md](executive-summary/EXECUTIVE_SUMMARY.md) — understand the platform's design reality in 15 minutes
2. [LETBUYY_DESIGN_CONSTITUTION.md](governance/LETBUYY_DESIGN_CONSTITUTION.md) — understand why five different visual languages coexist
3. [TOKEN_INVENTORY.md](ecosystem-analysis/TOKEN_INVENTORY.md) — your reference for all available `--lb-*` values
4. [VISUAL_IDENTITY_REPORT.md](visual-identity/VISUAL_IDENTITY_REPORT.md) — understand each surface's mood and intent before designing for it
5. [COMPONENT_CATALOG.md](component-intelligence/COMPONENT_CATALOG.md) — check what components exist before speccing new patterns
6. [COMPONENT_DUPLICATION_REPORT.md](component-intelligence/COMPONENT_DUPLICATION_REPORT.md) — check this before speccing anything to avoid duplicating what already exists

### You are an engineer building a new component or page

Check in this order:
1. [COMPONENT_DUPLICATION_REPORT.md](component-intelligence/COMPONENT_DUPLICATION_REPORT.md) — verify no existing `@letbuyy/ui` component covers your use case
2. [COMPONENT_CATALOG.md](component-intelligence/COMPONENT_CATALOG.md) — find the right component and its correct usage
3. [TOKEN_INVENTORY.md](ecosystem-analysis/TOKEN_INVENTORY.md) — find the right `--lb-*` token before introducing any raw value
4. [CONSISTENCY_SCORECARD.md](design-debt/CONSISTENCY_SCORECARD.md) — use the benchmark files (`customers/page.tsx`, `purchase-orders/page.tsx`) as reference implementations
5. [DESIGN_DEBT_REPORT.md](design-debt/DESIGN_DEBT_REPORT.md) — avoid repeating patterns already flagged as violations
6. Run `node scripts/validate-governance.mjs` after every meaningful change

### You are a PM planning a new feature

Read:
1. [ECOSYSTEM_MAP.md](application-intelligence/ECOSYSTEM_MAP.md) — identify which app owns your domain
2. [EXECUTIVE_SUMMARY.md](executive-summary/EXECUTIVE_SUMMARY.md) — Platform Design Health Dashboard section shows which apps carry higher design complexity
3. [IMPLEMENTATION_ROADMAP.md](migration-strategy/IMPLEMENTATION_ROADMAP.md) — identify adjacent quick wins that can ship alongside your feature
4. [APPLICATION_TOPOLOGY.md](application-intelligence/APPLICATION_TOPOLOGY.md) — understand the target app's constraints before writing the spec

### You are a tech lead auditing design quality

Your workflow:
1. Run `node scripts/validate-governance.mjs` for the authoritative 107-validator gate
2. [CONSISTENCY_SCORECARD.md](design-debt/CONSISTENCY_SCORECARD.md) — file-level scores and dimension breakdowns
3. [DESIGN_DEBT_REPORT.md](design-debt/DESIGN_DEBT_REPORT.md) — prioritized violation list with fix time estimates
4. [IMPLEMENTATION_ROADMAP.md](migration-strategy/IMPLEMENTATION_ROADMAP.md) — sequenced plan with success criteria
5. For blast radius before any design system change: `pnpm graph:intel blast "@letbuyy/ui"`
6. [DESIGN_GOVERNANCE_MODEL.md](governance/DESIGN_GOVERNANCE_MODEL.md) — what is enforced vs. aspirational

### You need the answer to a specific question

| Question | Go to |
|----------|-------|
| What does @letbuyy/ui provide? | [DESIGN_SYSTEM_INVENTORY.md](ecosystem-analysis/DESIGN_SYSTEM_INVENTORY.md) |
| What token should I use for X? | [TOKEN_INVENTORY.md](ecosystem-analysis/TOKEN_INVENTORY.md) |
| Does a component exist for X? | [COMPONENT_CATALOG.md](component-intelligence/COMPONENT_CATALOG.md) |
| Is someone already duplicating X? | [COMPONENT_DUPLICATION_REPORT.md](component-intelligence/COMPONENT_DUPLICATION_REPORT.md) |
| How consistent is file F? | [CONSISTENCY_SCORECARD.md](design-debt/CONSISTENCY_SCORECARD.md) |
| What are the P0 violations right now? | [DESIGN_DEBT_REPORT.md](design-debt/DESIGN_DEBT_REPORT.md) |
| What should I fix first? | [EXECUTIVE_SUMMARY.md](executive-summary/EXECUTIVE_SUMMARY.md) → Top 5 Quick Wins |
| How does app X look and why? | [VISUAL_IDENTITY_REPORT.md](visual-identity/VISUAL_IDENTITY_REPORT.md) |
| How is app X structured? | [APPLICATION_TOPOLOGY.md](application-intelligence/APPLICATION_TOPOLOGY.md) |
| How does the theme system work? | [THEME_ARCHITECTURE.md](theme-architecture/THEME_ARCHITECTURE.md) |
| What are the design rules? | [LETBUYY_DESIGN_CONSTITUTION.md](governance/LETBUYY_DESIGN_CONSTITUTION.md) |
| What is the migration plan? | [IMPLEMENTATION_ROADMAP.md](migration-strategy/IMPLEMENTATION_ROADMAP.md) |

---

## Updating This Repository

This is a point-in-time audit snapshot. It does not auto-update. The following triggers warrant a refresh:

**Refresh after any of these events:**
- A phase of the Implementation Roadmap is completed (Phase 0 → 1 → 2 etc.)
- A new app is added to the active topology
- An app is promoted from frozen to active, or deprecated from active
- A significant batch of ratchet violations is resolved (the scorecard numbers go stale)
- A new major version of `@letbuyy/ui` is released (component catalog and token inventory go stale)
- Flutter token generation script is updated (Flutter parity section of EXECUTIVE_SUMMARY goes stale)

**To refresh:**
1. Re-run the design intelligence agents against the current codebase
2. Update the `Last Updated` date and version number in this file and in EXECUTIVE_SUMMARY.md
3. Update the Platform Design Health Dashboard scores in EXECUTIVE_SUMMARY.md
4. Update per-file scores in CONSISTENCY_SCORECARD.md for any files that changed
5. Remove resolved violations from DESIGN_DEBT_REPORT.md
6. Update adoption percentages in DESIGN_MIGRATION_STRATEGY.md (run `pnpm --filter <app> lint` counts)

**The authoritative source of truth is always the live codebase + `node scripts/validate-governance.mjs`.**
This repository is intelligence, not enforcement. When this document and the validator disagree, the validator wins.

---

*LetBuyy Design Intelligence | docs/design-intelligence/ | Generated 2026-06-19*
