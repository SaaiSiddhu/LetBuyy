# 14 — Implementation Roadmap (Phase 12)

Ten phases, 0–9. Effort = focused engineer-weeks (ew); calendar assumes 3 parallel streams after Phase 1 (A: runtime/engine, B: editor+marketplace, C: platform/services/API). Every phase ends with **deletions executed** + `validate:governance`, `turbo typecheck`, staging smoke green. Rollback strategy stated per phase.

---

## Phase 0 — Repository Cleanup (1 ew)
**Goals:** repo hygiene; truthful baseline. **Tasks:** doc 05 Wave D0 (68 ledgers, scaffold dirs, 22 empty dirs, archives, build/, .DS_Store policy); consolidate dup prod deploy workflow; remove turbo stale env inputs; AGENTS.md edit (memory/tasks refs). **Risks:** none material. **Blockers:** none. **Dependencies:** none. **Rollback:** git revert (pure deletions). **Exit:** tree clean; CI green.

## Phase 1 — Legacy Removal + Hardening (3 ew)
**Goals:** kill known-dead code; close P0 security; tenancy backfill. **Tasks:** doc 05 Wave D1 (orphan editor components, unused dep, env template vars, legacy/firebase, operator-app lib, seed route); doc 12 §4.1 (internal-secret fail-closed, email-enum fix); doc 11 079–080 (site_id backfill + NOT NULL + FKs), 082 (draft backfill), 084–086 (editor cols, indexes, themes soft-delete); delete identity-platform schema.sql. **Risks:** NOT NULL on legacy rows (mitigate: orphan scan gate); index build load (CONCURRENTLY). **Blockers:** staging DB access. **Dependencies:** P0. **Rollback:** down-migrations (new policy) + revert; FKs added NOT VALID first. **Exit:** 0 nullable-tenant rows; authz tests for fixed endpoints; D1 deletions merged.

## Phase 2 — Theme Runtime Foundation (4 ew, stream A)
**Goals:** theme owns the document on staging. **Tasks:** `ThemeResolver` + KV bundle cache; route→template map (all 9 keys); layout rendering (`content_for_*`, section groups) per doc 07 §3; settings_data→CSS compiler replacing inline vars; default-theme-as-seed (kill `getDefaultStorefrontThemeTemplate` fallback path behind flag); header/footer authored as sections in default theme. **Risks:** visual regressions (mitigate: screenshot diff suite on fixture store); SEO meta parity (content_for_header checklist). **Blockers:** none. **Dependencies:** Phase 1 schema. **Rollback:** per-store `engine_version` flag — old path retained. **Exit:** staging store renders fully theme-owned with React shell OFF; SLO parity captured.

## Phase 3 — LiquidJS Engine Completion (5 ew, stream A)
**Goals:** doc 07 complete. **Tasks:** snippets + `{% render %}` (+unblock in forbidden list); filter pack (money/media/url/text/color/t); drops (product, collection, cart, customer, linklists, paginate, search); `data_requirements` contract + resolver in runtime-composition; new settings field types (server side); parsed-template LRU; render telemetry; conformance suite; json-contract→liquid converter built + validated on urban-kicks. **Risks:** Shopify-semantics mismatches (golden tests vs documented divergence list); perf (budget gate 120ms). **Blockers:** none. **Dependencies:** Phase 2. **Rollback:** engine flag per release. **Exit:** default theme rewritten in pure Liquid passes conformance; converter round-trips all 20 legacy section types (parity table doc 15 §3).

## Phase 4 — Theme Editor v2 (5 ew, stream B; starts after Phase 2)
**Goals:** doc 08. **Tasks:** decompose monolith; patch-based state+sync (If-Match); drag-drop sections/blocks; template switcher; in-canvas selection (storefront listener + overlays) + incremental `preview-render`; resource pickers; release diff; scheduled publish; draft lock; migrate editor writes to instance-drafts then **DB 083** (drop `theme_editor_drafts`); delete `PREVIEW_PRODUCTS`/`REQUIRED_URBAN_KICKS_SECTIONS`; retire `[store]/appearance` into theme settings. **Risks:** concurrent-edit conflicts (single-writer lock v1); editor regression (Playwright editor suite NEW — real gate). **Blockers:** Phase 2 preview-render endpoint. **Dependencies:** Phases 2–3 APIs. **Rollback:** old editor page kept behind route flag one phase. **Exit:** editor parity checklist (doc 08 §1 table all ✓ except LATER rows); legacy draft table dropped.

## Phase 5 — Theme Marketplace (4 ew, stream B)
**Goals:** doc 09 supply+lifecycle. **Tasks:** package zip format + `theme.json`; letbuyy-theme-check validation worker; review queue UI (console) on existing ops decision route; Ed25519 signing + install/load verification; export/import/duplicate/upgrade (+`theme_migrations` wiring) /fork; payouts schema 090 + accrual on purchase; developer area (portal); marketplace listing upgrades. **Risks:** payout compliance (GST invoices — reuse order invoice plumbing; legal review checkpoint); malicious bundles (validation+signing+sandbox already layered). **Blockers:** media-service for package/asset storage (build minimal in this phase if Phase 8C not landed: direct R2 from gateway acceptable interim). **Dependencies:** Phase 3 (validation renders). **Rollback:** feature-flag marketplace supply endpoints; consumer side unaffected. **Exit:** acceptance scenario doc 09 §9 passes on staging end-to-end.

## Phase 6 — App Extensions (5 ew, stream C after Phase 1 API work)
**Goals:** doc 10. **Tasks:** unify registries into extension-host; OAuth + scoped tokens + appTokenAuth + per-app limits; extension submit/review (shares Phase 5 pipeline); editor Apps panel + embeds panel (B assists); storefront embed injection w/ CSP+SRI; checkout 4 targets mount; admin widget mounts; compliance-webhook enforcement + uninstall cascade; `site_app_embeds` 092; functions runtime **6.5 stretch** (WASM extension-runtime). **Risks:** sandbox escapes (pen-test checklist; iframe-default posture); token sprawl (hashing+rotation runbook). **Blockers:** none hard. **Dependencies:** Phases 4–5 for editor/review reuse. **Rollback:** extensions feature-flagged per store. **Exit:** doc 10 §10 acceptance passes with a reference partner app.

## Phase 7 — Storefront Runtime Cutover (4 ew, stream A)
**Goals:** one engine in production; doc 04 conditions met. **Tasks:** run converter for all stores (batched, dry-run diff report per store); flip default `engine_version=liquid-v2`; collapse customer-auth onto gateway (cookie adapter) and delete 10 app routes; delete react `sections/` (20), `renderer-registry.tsx`, dynamic-header/footer, demo/urban-kicks module, alias map, `JsonContractThemeRenderer`; `sites.template_config` demoted; doc 05 Wave D3 executed. **Risks:** long-tail stores with exotic legacy configs (converter report gates each batch; manual-fix queue); customer session migration (dual-accept window 2 weeks). **Blockers:** Phases 3,4 complete. **Dependencies:** converter maturity. **Rollback:** per-store release rollback to last json-contract release renders via retained legacy path **until final deletion commit** — schedule deletion 2 weeks after 100% conversion soak. **Exit:** doc 06 §9 success criteria; gap V-01/03/12/13/14/15/16/17 closed.

## Phase 8 — Migration & Platform Tooling (2 ew, stream C)
**Goals:** developer/ops toolchain. **Tasks:** `letbuyy` CLI (theme pull/push/dev with local render against staging data; app scaffold) — fills the SDK gap status docs admit; OpenAPI/SDK pipeline (doc 12 §5) feeding developer-portal (replace `[SKIP]` panels); service extractions begin: search-service + media-service real (doc 18) with gateway bindings; store import (CSV products) hardening. **Risks:** CLI auth UX (device-code flow via identity-platform). **Dependencies:** stable APIs from Phases 3–6. **Rollback:** tooling is additive. **Exit:** third-party dev completes theme+app lifecycle using only CLI+portal docs.

## Phase 9 — Production Launch Hardening (3 ew, all streams)
**Goals:** doc 17 readiness = GO. **Tasks:** real gates replace manifest theater (smoke E2E non-skippable, contract tests, k6 commerce-flow scenarios executed with thresholds, restore drill); validator descope (~60% retired into topology linter); single prod workflow + worker gradual rollout; alerting wired to SLO catalog; secret rotation + incident runbooks exercised (game day); checkout-runtime + notification-service extractions if not landed; `081` store_id column drop + `template_config` drop; load soak on staging at 5× peak. **Risks:** discovering real-infra gaps late (that's the point — schedule 1 ew buffer). **Blockers:** Cloudflare/Vercel/Supabase prod credentials & quotas. **Rollback:** launch gate is reversible by definition (staged rollout %, worker versions, Vercel instant rollback, DB migrations all down-scripted ≥079). **Exit:** doc 17 checklist 100%; 2-week error-budget soak; sign-off.

---

## Summary Table

| Ph | Name | ew | Stream | Hard gate |
|---|---|---|---|---|
| 0 | Cleanup | 1 | — | CI green post-delete |
| 1 | Legacy+hardening | 3 | — | 0 nullable tenants; P0 authz tests |
| 2 | Runtime foundation | 4 | A | theme-owned staging render |
| 3 | Liquid completion | 5 | A | conformance + converter |
| 4 | Editor v2 | 5 | B | editor E2E; legacy drafts dropped |
| 5 | Theme marketplace | 4 | B | doc 09 §9 scenario |
| 6 | App extensions | 5 | C | doc 10 §10 scenario |
| 7 | Cutover | 4 | A | one engine; Wave D3 deleted |
| 8 | Tooling/services | 2 | C | CLI lifecycle run |
| 9 | Launch | 3 | all | doc 17 GO |
| **Σ** | | **36 ew** | ≈16–20 cal-wk @3 streams | |

**Cross-phase rules:** no phase adds a parallel system without a dated deletion task for its predecessor (anti-pattern observed in repo history: engines ×2, drafts ×2, workflows ×2); every schema change ships up+down+verification; status ledgers are banned — progress tracked only by these gates in CI.
