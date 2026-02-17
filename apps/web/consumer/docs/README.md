# LetBuyy Platform — Documentation

> **Version:** 7.0 | **Date:** February 17, 2026 | **Status:** 🟢 Active

---

## 📖 Documentation Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Overview](./00_Overview.md) | Platform vision, domain structure, tech stack, site types |
| 01 | [Architecture](./01_Architecture.md) | System architecture, infrastructure layers, project structure |
| 02 | [Authentication & Security](./02_Authentication_and_Security.md) | Auth flows, Supabase Auth, RLS, 2FA, VPN, security policies |
| 03 | [Onboarding & Trial](./03_Onboarding_and_Trial.md) | Signup → store creation → trial countdown → payment activation |
| 04 | [Admin Dashboard](./04_Admin_Dashboard.md) | Store builder UI, dynamic navigation, all site-type dashboards |
| 05 | [E-commerce Engine](./05_Ecommerce_Engine.md) | Products, orders, payments, shipping, coupons, inventory |
| 06 | [Portfolio & Resume](./06_Portfolio_and_Resume.md) | Portfolio builder, resume builder, PDF export, templates |
| 07 | [AI Features](./07_AI_Features.md) | AI-powered descriptions, content generation, credits & AI Studio |
| 08 | [Database Schema](./08_Database_Schema.md) | Complete PostgreSQL schema, RLS policies, functions & triggers |
| 09 | [API Reference](./09_API_Reference.md) | Complete REST API specification, middleware, webhooks |
| 10 | [Storefront & Themes](./10_Storefront_and_Themes.md) | Public storefront rendering, theme engine, page builder |
| 11 | [Super Admin & Team](./11_Super_Admin_and_Team.md) | Platform console, team management, RBAC, moderation |
| 12 | [Implementation Roadmap](./12_Implementation_Roadmap.md) | Phased plan, sprint breakdown, milestones, deployment & costs |
| 13 | [Plans & Pricing](./13_Plans_and_Pricing.md) | Revenue architecture, subscription tiers, billing & growth |
| 14 | [Theme Implementation](./14_Theme_Implementation.md) | Theme engine, custom CSS, code editor, uploads, marketplace |
| 15 | [App Store Implementation](./15_App_Store_Implementation.md) | App ecosystem, extensions, billing, developer portal |
| 16 | [Customer Management](./16_Customer_Management.md) | Customer accounts, auth, wishlists, order history, admin CRM |
| 17 | [Storefront Landing](./17_Storefront_Landing.md) | Root landing page, store finder, community showcase, platform stats |
| 18 | [Theme Editor](./18_Theme_Editor.md) | Theme editor UI, section customizer, marketplace integration, standalone themes |

---

## 📊 Analysis Documents

Detailed implementation analysis files covering specific subsystems:

| File | Description |
|------|-------------|
| [Part 1 — Architecture & Trial](./Part1_Architecture_and_Trial_System.md) | Architecture decisions, trial system analysis |
| [Part 2 — Onboarding Flow](./Part2_Onboarding_Flow.md) | Step-by-step onboarding flow with question mapping |
| [Part 3 — Store Management UI](./Part3_Store_Management_UI.md) | Admin store management interface analysis |
| [Part 4 — Trial & Payment UI](./Part4_Trial_and_Payment_UI.md) | Trial countdown, payment activation UI |
| [Part 5 — Database Schema](./Part5_Database_Schema.md) | Database schema deep-dive and migration notes |
| [Part 6 — Admin Dashboard Variants](./Part6_Admin_Dashboard_Variants.md) | Site-type-specific dashboard variations |
| [Part 7 — Deployment & Migration](./Part7_Deployment_and_Migration.md) | Deployment strategy and data migration |
| [Part 8 — Implementation Roadmap](./Part8_Implementation_Roadmap.md) | Detailed implementation scheduling |

---

## 🚀 Quick Start Reading Order

**For new team members:**
1. Start with [00 Overview](./00_Overview.md) for the big picture
2. Read [01 Architecture](./01_Architecture.md) to understand the stack
3. Pick the domain you're working on (03–07)

**For developers:**
1. [08 Database Schema](./08_Database_Schema.md) → [09 API Reference](./09_API_Reference.md) → [12 Implementation Roadmap](./12_Implementation_Roadmap.md)

**For AI features:**
1. [07 AI Features](./07_AI_Features.md) covers all AI capabilities and the credit system

**For business & monetization:**
1. [13 Plans & Pricing](./13_Plans_and_Pricing.md) → revenue architecture, pricing tiers, billing

**For theming & app ecosystem:**
1. [10 Storefront & Themes](./10_Storefront_and_Themes.md) → [14 Theme Implementation](./14_Theme_Implementation.md) → [15 App Store](./15_App_Store_Implementation.md)

**For storefront customer experience:**
1. [16 Customer Management](./16_Customer_Management.md) → accounts, wishlists, order history, auth gates

**For root landing page & community hub:**
1. [17 Storefront Landing](./17_Storefront_Landing.md) → store finder, community showcase, platform stats

---

## 📁 Related Files

| File | Location | Purpose |
|------|----------|---------|
| `IMPLEMENTATION_PLAN.md` | Repo root | Master implementation plan with phases & milestones |
| `pubspec.yaml` | Repo root | Flutter workspace configuration |
| `pnpm-workspace.yaml` | Repo root | TypeScript workspace configuration |
| `turbo.json` | Repo root | Turborepo build configuration |

---

*For questions or support: team@letbuyy.store*

