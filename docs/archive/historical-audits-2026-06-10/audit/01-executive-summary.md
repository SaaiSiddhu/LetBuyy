# 01 — Executive Summary

**Audit date:** 2026-06-05 · **Verdict in one line:** LetBuyy has the *skeleton* of a Shopify-class platform — a real Liquid engine, a real draft/release theme pipeline, a real multi-tenant gateway — but the storefront's outer shell, data binding, editor, marketplaces, and extension surfaces are 40–70% short of Online Store 2.0, and the repo carries heavy self-generated process debt (68 orphaned root ledgers, 6 of 9 services empty, 132 self-referential validators).

---

## 1. What LetBuyy Actually Is Today

A pnpm/Turborepo monorepo deploying:

- **9 Next.js 16 web apps** (Vercel): storefront-runtime, merchant-control-plane (34.5k LOC — the admin), identity-platform, theme-marketplace, app-marketplace, platform-console, platform-operations-portal, marketing-site, developer-portal (stub).
- **3 real Cloudflare Workers** (of 9 declared services): `api-gateway` (Hono, ~35 route modules, GraphQL admin+storefront endpoints, D1/KV/R2/Queues/DO bindings), `webhook-service` (4 payment providers, HMAC-verified), `queue-workers` (queue consumer + telemetry). The other six services (`checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`, `analytics-pipeline`) are **manifest-only stubs** with zero code.
- **Supabase Postgres** as canonical store (233 tables, RLS), Cloudflare D1 for operational lineage only, Upstash Redis for rate limiting, Resend for email.
- **22 workspace package dirs** — clean domain split (commerce-core, checkout-core, theme-engine, app-engine, extension-host, tenant-core, auth-core…) plus an elaborate event-sourcing stack (distributed-runtime 74 files, orchestration, projection-runtime, runtime-composition).
- **Flutter**: merchant-app real (~35k lines, but per its own state docs still Firebase-coupled in places), operator-app = unmodified counter template, shopper-app = manifest only.
- **India-first commerce domain**: INR minor units, GSTIN/HSN/state codes first-class, Razorpay/Cashfree/PhonePe/UPI/COD + Stripe/PayPal adapters.

## 2. The Five Findings That Matter Most

**F1 — The Liquid engine is real, but it can't touch the shell.** `packages/theme-engine` ships a genuine LiquidJS 10.27 renderer (`theme-renderer.ts`), a Shopify-shaped bundle format (`layout/theme.liquid`, `templates/*.json`, `sections/*.liquid` with `{% schema %}`, `config/settings_schema.json`, `@app` blocks) and four hydration islands. But in `apps/storefront-runtime`, Liquid output is injected only into `content_for_layout`; the header, footer, cart drawer, search overlay, and ~40 CSS custom properties are **hardcoded React** (`dynamic-header.tsx`, `dynamic-footer.tsx`, `layout.tsx` lines 124–205). A theme's `layout/theme.liquid` cannot actually control the page shell. *(Doc 03 V-01, Doc 04.)*

**F2 — Two parallel theme systems are live at once.** A legacy JSON-contract engine (`2026-05-json-contract`, 20 hardcoded React section renderers in `renderer-registry.tsx`) and the Liquid bundle engine (`2026-06-liquid-sections`) coexist, with **dual draft stores in the database** (`theme_editor_drafts` vs `theme_instance_drafts` — the schema itself flags the dual-pointer migration in `theme_preview_sessions`). Data binding feeds only 2 of 20 section types (products only — no collections, menus, blog, pages). *(Docs 03, 04, 11.)*

**F3 — The platform's own status reports disagree with the code — in both directions.** `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` (Jun 4) claims "LiquidRenderer is a stub; 0 .liquid files" — false as of audit date; the renderer is implemented and a full `urban-kicks-liquid` fixture exists in `theme-bundle.ts`. Conversely `CODEX_MASTER_EXECUTION_STATUS.md` marks WS1–WS13 "DONE" — but "done" means local typecheck passes; six services are empty, no SDK/CLI exists, and live deployment evidence is explicitly absent. **Neither prior reports nor ledgers can be trusted as state; this audit supersedes them.**

**F4 — Governance theater vs. engineering reality.** 132 validators run on every PR — but they validate that JSON manifests contain expected field values, files exist, and YAML contains expected strings (`mode: "governance-contract-not-live-evidence"` is asserted as *passing*). Real k6/chaos harnesses exist but have never executed (evidence gitignored, k6 hits only `/v1/health`). Playwright E2E silently skips when staging is unreachable. This buys topology discipline (genuinely good: no deprecated aliases exist, import boundaries hold) at the cost of false confidence. *(Docs 02 §7, 17.)*

**F5 — Tenant isolation is application-enforced, not schema-enforced.** `products.store_id` and `orders.store_id` are **nullable** with no FK to `sites(id)`; dual tenant columns (`store_id` legacy + `site_id`) persist; `isInternalRequest()` in `services/api-gateway/src/routes/storefront.ts` (L1376) returns `true` in non-production when `INTERNAL_API_SECRET` is unset (unauthenticated access to payment-state endpoints in staging); `GET /storefront/customer/by-email` enables email enumeration. *(Docs 11, 12, 16.)*

## 3. Shopify OS 2.0 Compatibility: 41/100

| Area | Score /10 | One-line reason |
|---|---|---|
| Liquid rendering engine | 6 | Real LiquidJS w/ sandbox limits; missing layout control, `{% render %}`, most Shopify objects/filters |
| Theme format (sections/blocks/JSON templates) | 7 | Bundle schema mirrors Shopify; no on-disk themes, single fixture, no `{{ content_for_header }}` ownership |
| Storefront runtime | 4 | Dual engine; shell hardcoded; data binding 2/20 sections; urban-kicks fallback hardwired |
| Theme editor | 5 | Real schema-driven editor w/ undo/redo, drafts, releases, device preview; no drag-drop, single template, 2,068-line monolith |
| Theme versioning/publishing | 6 | `theme_releases` immutable snapshots, rollback chain — genuinely good; no diff, no scheduled publish |
| Theme marketplace | 3 | Browse/install real; no submission, review, signing, validation pipeline, revenue share |
| App marketplace | 3 | Catalog + installs + compliance webhook topics; no OAuth app model, no review, no billing API |
| App blocks/embeds | 4 | `@app` blocks + `appBlockSlot` + admin/checkout extension targets typed; no storefront extension targets, no sandboxed runtime, no extension registry service |
| Store data layer | 5 | 233 tables, good domain coverage; nullable tenant keys, dual draft stores, missing FKs/indexes |
| APIs (Admin/Storefront) | 4 | REST complete-ish + 2 GraphQL endpoints; no versioning, parallel customer auth paths, gaps above |

**Weighted total: 41/100.** Full scoring matrix + every violation with file paths: doc 03.

## 4. Storefront Runtime: Refactor, Don't Delete

Evidence (doc 04): the composition pipeline (`template-resolver.ts` → `data-binding-engine.ts` → `composition-engine.tsx`) is cleanly layered; Liquid path already flows through it; cache tags + preview tokens + release snapshots are production-shaped. What must die inside it: the hardcoded shell (header/footer/CSS injection), the React renderer registry as the *default* path, demo-store special cases (`urban-kicks` hardwired as universal fallback), and 10 duplicated customer-auth API routes. **Estimated salvage: ~65% of the app.** Full replacement plan: doc 06.

## 5. Top 10 Actions (Ordered)

1. **Phase 0 cleanup** — delete 68 root ledgers, `Audit/`, `memory/`, `tasks/`, `artifacts/shopify-ux/` (26 MB), `build/` (45 MB), 22 empty dirs, 8 orphaned editor components, `legacy/firebase/` (after CI check). *(Doc 05 — zero functional risk.)*
2. **Schema hardening** — `store_id NOT NULL` + FKs on `products`/`orders`, collapse `store_id`/`site_id` duality, kill `theme_editor_drafts` in favor of `theme_instance_drafts`, add the 6 missing hot-path indexes. *(Doc 11.)*
3. **Close the 5 authz gaps** — internal-secret fallback, email enumeration, console static token, nullable tenant rows, RLS `USING(true)` in stale app schema file. *(Doc 12 §4.)*
4. **Make Liquid own the shell** — render `layout/theme.liquid` end-to-end (header/footer become sections/snippets), demote React registry to legacy adapter. *(Docs 06–07.)*
5. **Extend data binding** to all section types via a declarative `data_requirements` contract in section schemas. *(Doc 07 §6.)*
6. **Theme editor v2** — decompose the monolith, add drag-drop, multi-template editing, in-canvas selection (the postMessage bridge already half-exists). *(Doc 08.)*
7. **Marketplace pipelines** — submission → automated validation (theme-check equivalent) → review → signing → publish, plus export/import (`.zip` of the bundle format that already exists). *(Doc 09.)*
8. **Extension platform v1** — extension registry service, storefront targets, sandboxed app-block runtime, OAuth app model + mandatory compliance webhooks (topics already enumerated in `app-engine`). *(Doc 10.)*
9. **Activate reserved services** with real code in priority order: `search-service`, `media-service`, `checkout-runtime`, `notification-service` — gateway is becoming a monolith. *(Doc 18.)*
10. **Replace manifest-theater with live gates** — one real smoke E2E against staging as a non-skippable CI gate; retire ~60% of validators into a single topology linter. *(Doc 17.)*

## 6. Roadmap Shape (detail: doc 14)

Phase 0 Cleanup (1 wk) → Phase 1 Legacy removal + schema hardening (2 wk) → Phase 2 Theme runtime foundation (3 wk) → Phase 3 Liquid engine completion (4 wk) → Phase 4 Theme editor v2 (5 wk) → Phase 5 Theme marketplace (4 wk) → Phase 6 App extensions (5 wk) → Phase 7 Storefront runtime cutover (4 wk) → Phase 8 Migration tooling (2 wk) → Phase 9 Production launch (3 wk). **~33 engineering weeks** single-team serial; parallelizable to ~16–20 calendar weeks with 3 streams (runtime, editor/marketplace, platform/services).

## 7. What Is Genuinely Good (Keep & Build On)

The package-layer domain modeling (Zod contracts everywhere), the theme release/rollback data model, the LiquidJS renderer with parse/render/memory limits + HTML sanitization, payment webhook idempotency (`payment_webhook_events` unique constraint), the import-boundary governance (validated, actually holds), Hono gateway middleware stack (RBAC, CSRF, rate limits), and the India-market depth (GST plumbing through orders → invoices). These are ahead of typical clone projects and should anchor the rebuild.
