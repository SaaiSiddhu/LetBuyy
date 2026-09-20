# LetBuyy Unified Commerce Platform — Discovery and Unification Set

- **Date:** 2026-09-19 · **Phase:** 0, read-only discovery. No application code, schema, configuration, credential or git history was changed to produce these documents; they are untracked files.
- **Produced by:** the `/letbuyy` operating-skill session (Claude Fable 5.1), single agent, no subagents, no delegation.
- **Companion evidence:** the same-day audit in `docs/evidence/audits/2026-09-19-unified-commerce/` (main report + handoff), which holds the test runs, the 20-shirts custody scenario and the founder-decision register these documents build on.

## Snapshots every path resolves against

| System | Location | Snapshot | Notes |
|---|---|---|---|
| **System 1 — LetBuyy Store Builder / Merchant Platform** (canonical commerce OS) | this repository | `develop` = `bda7f7f8` (2026-09-12) in the `LetBuyy-develop` worktree; the workspace checkout `Projects/Start_Up/LetBuyy` is a stale branch at `823aa5ee`, 611 commits behind | file:line references are to `develop` unless stated |
| **System 2 — LetBuyy Marketplace (Firebase)** | `apps/customer_app`, `packages/dart/marketplace_{core,models,services,ui_kit}`; archived Cloud Functions at `services/compatibility/firebase_bridge` (present only in the `823aa5ee` checkout — deleted on `develop` by phase FB-1); rules at `docs/archive/firebase-legacy/` | same | the shipped Play Store app `com.letbuyy.letbuyy`, Firebase project `letbuy-y` |
| **System 3 — AgriMore (Supabase + Cloudflare)** | `Projects/Start_Up/Agrimore_Supabase` (identical 2.2 GB copy at `apps/phase_2/Agrimore_Supabase`); donor UI already inside this repo at `apps/phase_2/{rider_app,store_ops_app}` and `packages/dart/quickcommerce_*` | branch `foundation-rebuild` @ `6a33bf8`, index state (1,225 staged deletions of `legacy_archive_v2/` in flight) | paths prefixed `Agrimore_Supabase:` |
| Out of scope | `Projects/Clients/Agrimore*` (the separate Firebase agricultural marketplace, live project `agrimore-66a4e`); AgriMore's own `legacy_archive_v2` Firebase-era apps | — | different programme (`D-AGRIMORE-STANDALONE`); only referenced where their old map/tracking screens explain a feature memory |

## Documents

| # | File | Answers |
|---|---|---|
| 01 | [01-CURRENT-SYSTEM-MAP.md](./01-CURRENT-SYSTEM-MAP.md) | what exists, stacks, relationships, diagrams |
| 02 | [02-FEATURE-INVENTORY.md](./02-FEATURE-INVENTORY.md) | feature matrix across the three systems with status and target |
| 03 | [03-ROUTE-SCREEN-MAP.md](./03-ROUTE-SCREEN-MAP.md) | customer, merchant, admin, delivery screens and routes |
| 04 | [04-API-INVENTORY.md](./04-API-INVENTORY.md) | REST, RPC, Workers, Edge/Cloud Functions, webhooks, crons, realtime |
| 05 | [05-DATABASE-MAP.md](./05-DATABASE-MAP.md) | tables, Firestore collections, ownership boundaries, ER diagrams |
| 06 | [06-AUTH-IDENTITY-MAP.md](./06-AUTH-IDENTITY-MAP.md) | every auth system and the canonical identity model |
| 07 | [07-DUPLICATION-ANALYSIS.md](./07-DUPLICATION-ANALYSIS.md) | duplicated domains, A vs B, canonical choice |
| 08 | [08-TARGET-DOMAIN-MODEL.md](./08-TARGET-DOMAIN-MODEL.md) | future domains and the glossary |
| 09 | [09-TARGET-ARCHITECTURE.md](./09-TARGET-ARCHITECTURE.md) | application and backend boundaries, diagrams |
| 10 | [10-FIREBASE-MIGRATION.md](./10-FIREBASE-MIGRATION.md) | what Firebase provides, what moves, what stays |
| 11 | [11-CUSTOMER-APP-MERGE.md](./11-CUSTOMER-APP-MERGE.md) | screen-by-screen merge of Marketplace + AgriMore customer app |
| 12 | [12-MERCHANT-CONTROL-PLANE.md](./12-MERCHANT-CONTROL-PLANE.md) | the merchant app as the command centre for three channels |
| 13 | [13-QUICK-COMMERCE-ARCHITECTURE.md](./13-QUICK-COMMERCE-ARCHITECTURE.md) | serviceability, zones, nodes, inventory, riders, realtime |
| 14 | [14-ORDER-FULFILMENT-ARCHITECTURE.md](./14-ORDER-FULFILMENT-ARCHITECTURE.md) | order types, status vocabularies, state machines |
| 15 | [15-DATA-MIGRATION-PLAN.md](./15-DATA-MIGRATION-PLAN.md) | Firebase → canonical database, with rollback |
| 16 | [16-SECURITY-REVIEW.md](./16-SECURITY-REVIEW.md) | boundaries and discovered issues, all three systems |
| 17 | [17-UNIFICATION-ROADMAP.md](./17-UNIFICATION-ROADMAP.md) | phased sequence with checkpoints |
| 18 | [18-IMPLEMENTATION-BACKLOG.md](./18-IMPLEMENTATION-BACKLOG.md) | actionable tasks with dependencies, risk, complexity, DoD |

## The twenty critical questions

Answered in one place at the end of [09-TARGET-ARCHITECTURE.md](./09-TARGET-ARCHITECTURE.md#the-twenty-critical-questions).

## Evidence discipline used throughout

- `inspected source` = read in the repository at the snapshot above.
- `reproduced locally` = executed in this session (unit lanes, isolated-container Postgres suites; see the audit report §18).
- `historical` = recorded by an earlier phase in the ledgers; not re-run.
- `UNKNOWN_LIVE_STATE` = cannot be established from this machine (no cloud access; the GitHub remote is unreadable). The founder has separately stated that staging and production Cloudflare/Supabase deployments exist; nothing here contradicts or confirms it.
- Decisions carry their register status: `OWNER_DECISION` (recorded in `.claude/skills/letbuyy/references/decisions.md`), `FOUNDER-STATED 2026-09-19` (said in chat this session, not yet recorded), `OPEN`.
