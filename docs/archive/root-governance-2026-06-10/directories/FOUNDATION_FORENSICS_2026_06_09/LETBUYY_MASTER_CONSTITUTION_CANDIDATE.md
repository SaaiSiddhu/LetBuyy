# LETBUYY MASTER CONSTITUTION — CANDIDATE

**Status:** CANDIDATE for human ratification · **Date:** 2026-06-09 · **Authority:** supersedes ad-hoc CODEX_*/LETBUYY_* ledgers; sits above the four domain constitutions (Auth, Design, Platform, Monorepo).

This constitution freezes the **true, code-verified** shape of LetBuyy and the non-negotiable laws that protect it. It is written against what the repository *is*, not what its documentation *claims*. Where a rule contradicts an existing `*.md` status doc, the rule wins until a human amends it.

---

## Preamble — the one fact everything else follows from

LetBuyy is a **Supabase-backed modular monolith** (`services/api-gateway`, ~62 routes) that renders multi-tenant section/block storefronts, fronted by 9 Next.js apps and a Flutter merchant app. It is **not** the event-sourced microservice mesh its package tree advertises. Every law below exists because the gap between those two descriptions is where the risk lives.

---

## Article I — Truth in topology (anti-theater)

1. **Code is the source of truth.** No architecture decision may cite a `*.md` ledger, comment, or AGENTS.md as evidence that a capability exists. A capability exists only if a runtime path executes it.
2. **No paper services in the deployable manifest.** A directory under `services/` MUST contain executable source or be removed from the runtime map. The six manifest-only services (`analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`) are **reserved placeholders only** and MUST NOT be presented as live topology, deployed, or counted toward platform capability.
3. **No theater in the build closure.** Packages that execute in **zero** product paths (`distributed-runtime`, `projection-runtime`, and their dead consumers) MUST be either (a) wired into a real path within one quarter, or (b) quarantined out of `tsconfig.workspace.json` and the gateway build. Dead code that compiles on every CI run is prohibited from masquerading as platform surface area.
4. **Validators must test behavior, not names.** A validator that asserts a capability by grepping for a function-name string is classified as **decorative** and may not gate a release. (≈46% of the 177 validators currently do this — see Monorepo Forensics.)

## Article II — Money is sacred

1. **The ledger is the system of record.** Every money event — capture, refund, payout, commission, COD reconciliation, wallet movement — MUST post to the append-only double-entry ledger (`migrations/139`) *synchronously and atomically* with the state change. The ledger MUST NOT be a downstream projection of in-memory math.
2. **No fabricated money movement, ever.** A money-out path (payout, refund, transfer) MUST make a verified provider call and persist the provider's real reference. Synthesizing identifiers (e.g. `UTR${token}`) without a provider transfer is a **constitutional violation** and a release blocker.
3. **All money is integer minor-units, `bigint`.** No `integer`, `float`, or `numeric`-without-scale money columns. (See `migrations/119` overflow bug — to be migrated to `bigint`.)
4. **Inbound = outbound truth.** Captured payments MUST debit the clearing account in the same ledger the payouts draw from. A merchant balance the platform cannot truthfully fund MUST NOT be displayed as available.

## Article III — Tenancy is fail-closed

1. **Every tenant-scoped query is scoped at the source.** Because the request path runs as `service_role` (RLS inert), isolation MUST be enforced by a query layer that *refuses* to read/write a tenant table without a `store_id`/`site_id`/owner predicate. Hand-remembered `.eq('store_id', …)` is correct-by-convention and is hereby deprecated as the *sole* boundary.
2. **No cross-realm cookie bleed.** Platform (merchant/staff/partner) sessions and storefront (customer) sessions live in separate cookie realms forever. A storefront cookie MUST NOT carry a parent-domain attribute.

## Article IV — One of each thing

1. **One identity runtime, one ledger, one design-token source, one section registry.** Parallel/shadow implementations (e.g. live `routes/auth.ts` vs dormant `identity-foundation/` V2) MUST converge or the dormant one MUST be deleted. Two systems that could both be "the real one" are prohibited.
2. **No deprecated aliases resurrected.** The nine deprecated app aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/storefront-runtime/consumer-storefront`, `apps/mobile/operator-team-app`) stay dead. Historical references live only under `docs/archive/`.

## Article V — Production is observable and recoverable

1. **No release without backups.** Continuous database backup with PITR MUST exist before the next production deploy. A 7-day CI artifact is not a backup strategy.
2. **No release with placeholder secrets.** A `SKIP_NEEDS_HUMAN` (or equivalent) value in a production secret file is a hard release blocker (currently includes `WHATSAPP_WEBHOOK_SECRET`).
3. **Observability is deployed, not configured.** Metrics/logs/traces/alerts MUST be running in production, not present only as unapplied YAML.
4. **Self-certification is not certification.** A script that records its own `"status":"passed"` does not gate a release.

## Article VI — Amendment

This document and the four domain constitutions are amended only by an explicit human decision recorded in `docs/governance/`. AI agents (Claude, Codex, others) MAY propose amendments but MUST NOT self-ratify. Until ratified, these are candidates; once ratified, violations fail CI.

---

## What is hereby FROZEN (do not redesign without amendment)

- The modular-monolith + Supabase persistence model (it works; stop pretending otherwise).
- The double-entry ledger kernel schema (`migrations/139`) as the money primitive.
- The section/block theme model and draft→publish lifecycle.
- The four-layer design-token hierarchy as the single styling source.
- The cross-realm cookie isolation model.
- The acyclic package-boundary discipline (genuinely clean — protect it).

## What is hereby CONDEMNED (must change before GA)

- Fabricated payouts; ledger-as-projection; `integer` money columns.
- Service-role-only data path without a fail-closed tenant backstop.
- The OIDC 501 skeleton presented as an identity platform.
- The distributed-runtime theater in the build closure.
- Undeployed observability and absent DB backups.
