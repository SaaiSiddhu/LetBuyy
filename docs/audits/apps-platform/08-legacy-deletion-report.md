# Legacy Deletion Report & File-by-File Deletion Plan (Phase 8 · Deliverables 18–19)

Rules: deletions ordered to never break imports; every item lists Path · Purpose · Reason Unused · Deletion Risk · Dependencies · Order · Migration Impact. Execute only after `node scripts/validate-governance.mjs` passes pre/post each batch. **No deletions are performed by this audit.**

Risk scale: NONE (no inbound refs) · LOW (refs only from other deletion candidates) · MED (config/CI refs) · HIGH (uncertain consumers — verify first).

---

## Batch 1 — Dead code with zero inbound imports (Order 1, lowest risk)

| Path | Purpose | Reason unused | Risk | Dependencies | Migration impact |
|---|---|---|---|---|---|
| `packages/distributed-runtime/src/*` (~20 files: distributed-execution-runtime.ts, durable-execution-runtime.ts, compensation-saga-runtime.ts, replay-{safety,evolution,recovery,simulation,branch}-runtime.ts, saga-recovery-runtime.ts, wal-lifecycle-runtime.ts, lease-{heartbeat,fencing}-runtime.ts, crdt-convergence-runtime.ts, …) | Aspirational HA/saga/CRDT runtime | Zero imports from any app/service/package (grep-verified by scan) | NONE→LOW | Governance validators reference concepts (see Batch 4 coupling) | None at runtime; large cognitive-load win (~5K LOC) |
| `packages/orchestration/src/{index.ts,event-runtime.ts}` | Workflow coordination | Never imported | NONE | tests/contracts may name it — re-run contract suite | None |
| `packages/projection-runtime/src/*` (2 files) | CQRS read models | Never imported; mostly comments | NONE | none | None |
| `apps/app-marketplace/src/lib/marketplace-display.ts` | Display helpers | No inbound imports | NONE | none | None |
| `apps/app-marketplace/src/proxy.ts` | Old proxy middleware | Not referenced | NONE | none | None |

Note: if the platform intends to keep distributed-runtime as a future bet, the alternative to deletion is moving to `docs/archive/research/` as design docs and deleting the code — code-as-aspiration violates the repo's own "no topology theater" stance.

## Batch 2 — Stub runtimes (Order 2; governance updates required)

| Path | Purpose | Reason | Risk | Dependencies | Migration impact |
|---|---|---|---|---|---|
| `services/{event-bus,checkout-runtime,notification-service,media-service,search-service,analytics-pipeline}/` (each: AGENTS.md + runtime.manifest.json only) | Reserved service roots | No src/; responsibilities executing in api-gateway/queue-workers | MED | `docs/governance/runtime-boundaries.md`, `config/cloudflare/resource-names.json` (worker names already provisioned), CI deploy workflows | **Decision per root:** (a) keep as reserved-with-charter if target architecture (doc 19) assigns it real scope within 2 quarters — event-bus, checkout-runtime, media-service, notification-service stay; (b) delete root + manifest for search-service/analytics-pipeline only if doc 19 ownership lands in gateway/queue-workers; update runtime-boundaries.md "Reserved service roots" section in same PR; never recreate names casually (deprecation policy) |
| `apps/mobile/operator-app/lib/*` (stock Flutter counter) | Operator mobile | Default template, zero business code | LOW | runtime.manifest.json stays (canonical map lists operator-app) | Replace `lib/` with honest placeholder screen or implement; do not delete app root (canonical topology) |
| `apps/mobile/shopper-app` (manifest-only) | Shopper mobile | No source | LOW | canonical map | Keep root, add charter & milestone or mark incubating in manifest |

## Batch 3 — Redundant database structures (Order 3; data migration first)

| Object | Purpose | Reason | Risk | Deletion order & migration impact |
|---|---|---|---|---|
| `marketplace_review_records` (baseline:9736) | Review audit copy | Duplicates `app_reviews` (8368) | MED | 1) Backfill any rows missing in app_reviews 2) repoint readers (none found) 3) drop in migration `079_drop_marketplace_review_records.sql` |
| `app_webhooks` (8391) | App-level webhook **definitions** (expanded at install into per-store `webhook_subscriptions` by `planAppWebhookSubscriptions`, app-engine:1420-1445) | Not pure duplication — but stores `secret` redundantly and its role is undocumented | MED | Keep as definitions table; rename-or-document role, drop its `secret` column (subscriptions own secrets, hashed per doc 16), add FK to marketplace_apps; do **not** drop the table |
| Orphaned ops tables (~15–20): `purchase_orders`(5117), `purchase_order_lines`(5089), `purchase_order_receipts`(10938), `restock_events`(11233), `regional_routing_overrides`(6328), `provider_health_snapshots`(10891), `provider_outage_events`, `query_snapshots`(10963), `deployment_*` (10+), `event_store_integrity_checks`(7954), region* | Telemetry/ops experiments | Defined, never queried in app/service code | MED | Two-step: mark deprecated (comment + monitoring for 30 days via pg_stat_user_tables) → drop in single migration; keep `deployment_*` if CI certification scripts write them (verify `infrastructure/scripts/*certif*` first — HIGH until checked) |

## Batch 4 — Validator & config pruning (Order 4)

| Path | Reason | Risk | Notes |
|---|---|---|---|
| `scripts/validators/*` subset tied to deleted runtimes (replay-*, wal-*, crdt-, saga-, lease-, projection-* — ~40 of 98 validators) | Validate code deleted in Batch 1 | MED | Delete in same PR as Batch 1 or governance gate breaks; keep architecture/import/env/cloudflare validators |
| `tests/{replay,projections,survivability}` subsets referencing deleted runtimes | Same | MED | Keep contract tests for live services |
| Env template entries: `PLATFORM_CONSOLE_TOTP_SECRET` (if console TOTP unbuilt), `PAYMENT_CONFIG_ENCRYPTION_KEY` (no encryption code) | Unreferenced | LOW | Either implement the feature or remove the var; document in CODEX_ENV_CLEANUP_LEDGER successor |
| Queue bindings for consumers that don't exist (ANALYTICS/SEARCH/NOTIFICATION queues) | No consumer code | MED | Prefer building consumers (doc 19); deleting bindings is the fallback |

## Batch 5 — Documentation archive sweep (Order 5; zero code risk)

Move to `docs/archive/` (historical references allowed there per CLAUDE.md):
- Wave reports: `WAVE1_REPORT.md` … `WAVE7_REPORT.md`, `WAVE4_FULL_FLUTTER_REPORT.md`, `WAVE4_PILOT_REPORT.md`
- Superseded status/ledgers: `FOUNDATION_STATUS.md`, `CODEX_FOUNDATION_STATUS_V2.md`, `CODEX_FEDERATION_{LEDGER,STATUS}.md`, `CODEX_MISSION_LEDGER.md`, `CODEX_PRODUCTION_{LEDGER,STATUS}.md`, WS ledgers WS1–WS13 already superseded by `CODEX_MASTER_EXECUTION_LEDGER.md`
- Brand exploration: `LETBUYY_BRAND_*`, `LETBUYY_COLOR_*`, `BRANDING_RECOMMENDATIONS.md`, `TOKEN_*`, `UI_POLISH_*`, `STORYBOOK_PREVIEW_REPORT.md`, `DESIGN_SYSTEM_V2.md`, `EMPTY_STATE_SYSTEM.md`
- **Stale-claims docs (must be corrected or archived, not left live):** `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` (Liquid claims false — doc 02 §11), `SHOPIFY_GAP_ANALYSIS.md` (superseded by this audit set)
- Keep at root: `AGENTS.md`, `CLAUDE.md`, `README.md`, `LETBUYY_STATE.md` (update), `CODEX_MASTER_EXECUTION_{LEDGER,STATUS}.md`, `CODEX_REMEDIATION_LEDGER.md`

Risk NONE · Dependencies: any doc cross-links · Impact: root shrinks from 73 .md to ~8.

## Batch 6 — legacy/ (Order 6, already isolated)
`legacy/firebase/**` (~35K LOC, 28 function files): zero active imports (verified). Keep 1 release cycle post-roadmap-Phase-2 as reference for settlement/wallet semantics, then delete entirely; its AGENTS.md already forbids new behavior. Risk NONE · Impact: repo size only.

## Deletion-Order Summary
1→2→3→4 must ship in this sequence (validators after code; DB after dual-write). 5 and 6 anytime. Total estimated removal: ~140 files / ~45K LOC / ~20 tables / ~40 validators, with **zero feature regression** if order respected.
