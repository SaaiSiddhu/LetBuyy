# Critical Findings Summary

**Investigation date:** 2026-06-05 (second pass, post-remediation; HEAD `a8cd5fde` on `develop`)
**Purpose:** A single reconciled, severity-ranked register of the most significant findings across all 14 domain reports, now carrying a **resolution status** for every first-pass finding plus the **new findings introduced by the remediation work**. Severities were normalized across reports; where reports disagreed, the rating reflects blast radius × evidence strength. This document records facts and observed impact only — it proposes no remediation.

**What changed since the first pass:** 68 commits / 292 files / +21,140 −8,527 landed (`cd71e612..HEAD`): a Codex Foundation-Hardening run (mission phases **F0 truth/topology + F1 backend integrity**, commits `9f09cf45..f1b3253b`) plus five merged workstreams (WS1 design-system, WS5 operations-portal, WS7 hardening, WS9 settings hub, WS10 developer-portal) and an app-marketplace integrity batch. The governance suite grew **128 → 129 validators** (the new one is `single-writer-ownership-validator.mjs`) and still passes (exit 0). **The remediation closed the "governance honesty" and "backend ownership" layers; it did not touch the product-facing Critical set (app platform, theme extensibility, cart, observability, testing), and it introduced a small number of new issues — one of them on the payment path.**

**Verification:** The 10 highest-stakes second-pass claims (resolved and new) were independently re-derived from source by a separate fact-checking pass — **8 CONFIRMED, 2 PARTIALLY-CONFIRMED, 0 REFUTED**; log in [`17-evidence-appendix.md`](17-evidence-appendix.md). Items confirmed there are marked ✅.

---

## Resolution scoreboard (first-pass Critical/High set)

| Status | Count | IDs |
|---|---|---|
| **RESOLVED** (verified in code + usually validator-locked) | 6 | C‑2, C‑12, C‑13, H‑1, H‑10, H‑12 |
| **PARTIALLY RESOLVED / IMPROVED** | 3 | C‑11 (testing 12/12→10/12 no‑op), H‑9 (god‑file split started, file still grew), H‑13 (now self‑documented, still no backend) |
| **SKIPPED — NEEDS HUMAN** (correctly recorded, not faked) | 1 | H‑11 (payout rail) |
| **STILL OPEN** | 21 | C‑1, C‑3, C‑4, C‑5, C‑6, C‑7, C‑8, C‑9, C‑10, C‑14, H‑2, H‑3, H‑4, H‑5, H‑6, H‑7, H‑8, H‑14, H‑15, H‑16, H‑17 |
| **NEW (introduced by remediation)** | 6 tracked | N‑1 … N‑6 below |

**Headline:** every Critical that was about *the platform lying about itself* (C‑2 phantom services, C‑12 dead DB doc, C‑13 disagreeing inventories) is now fixed and validator‑guarded. Every Critical that was about *a missing product capability* (C‑3 app API, C‑4 compliance webhooks, C‑5 billing, C‑6 editor preview, C‑7 sections, C‑8 publish, C‑9 embeds/Liquid, C‑10 cart, C‑14 observability) remains open. Net Critical count: **14 → 11 open** (3 resolved), **+0 new Critical** but **+1 new High on the payment path**.

---

## RESOLVED (verified)

### C‑2 — Six phantom services now declare themselves honestly ✅
The six code‑free services (`checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) now carry `implementationStatus.status: "reserved-not-implemented"` + `currentActiveOwner` in their manifests, enforced by `runtime-manifest-validator.mjs`; `queue-workers` was recategorized `reserved-service` → `cloudflare-worker`. They were not built (correct per the mission's modular‑monolith default). **Source:** [03](03-application-investigation.md), [01](01-repository-inventory.md). Residue: ~50 legacy `*Ownership` prose fields per manifest are unchanged.

### C‑12 — `AGENTS.md` database section corrected ✅ (with residue)
The "65 migrations / 228 tables / migration 065" claim was hand‑corrected to the real topology (`000_baseline.sql` + `073…089`, contiguous; 233 baseline tables). **New residue (Medium, AV‑M8):** `AGENTS.md` was hand‑patched, not regenerated — it carries a false provenance header, stale `console.log/any` counts, a package list still missing `payments`/`app-engine`/`extension-host`, and line 85 still lists only 8 web apps (omits `developer-portal`). **Source:** [11](11-architecture-violations.md), [13](13-technical-debt.md).

### C‑13 — Three runtime inventories reconciled + validator‑locked ✅
`CLAUDE.md`, `docs/governance/runtime-boundaries.md`, and `repository-topology.md` now agree (21 roots incl. `developer-portal`), cross‑checked by `runtime-topology-validator.mjs`. **Source:** [01](01-repository-inventory.md), [11](11-architecture-violations.md).

### H‑1 — Single‑writer ownership enforced ✅
`webhook-service` and `queue-workers` no longer write `orders`/`products`/`subscriptions`/`sites`/`billing_history`/`outbox_events` directly; all mutations route through new gateway internal endpoints (`/v1/internal/billing/*`, `/v1/internal/events/domain`, `/v1/storefront/internal/payments/*`) over the Cloudflare service binding. `webhook-service`'s only remaining direct write is its own `payment_webhook_events`. Locked by `single-writer-ownership-validator.mjs` (107 files) + a regression test. **Caveat:** `queue-workers` still writes `notifications`/`search_documents`/`analytics_event_stream`/`partner_payout_ledger_entries`, which the validator deliberately excludes (these are not dual‑owned). **Source:** [07](07-integration.md), [11](11-architecture-violations.md).

### H‑10 — Queue producers wired ✅
`execution/cloudflare-queue-triggers.ts` now plans triggers for all five queue bindings on scheduled dispatch (a first‑pass dangling‑consumer set). **Nuance:** EVENT/RUNTIME trigger messages map to no platform drain in `queue-workers` (telemetry‑only). **Source:** [07](07-integration.md).

### H‑12 — Theme events contracted ✅
`theme.purchase.*` and `theme.draft.*` are now registered in `packages/event-core` (24 → 27 event types) with payload schemas + consumers + a contract test. **Source:** [07](07-integration.md).

### H‑11 — Payout events correctly gated (not faked) ✅
`payout.released`/`payout.failed` are marked `implementationStatus: "reserved-human-gated"` with a reason; still no emitter — the honest outcome, since there is no payout rail. **Source:** [06](06-apps-ecosystem.md), [07](07-integration.md).

---

## NEW findings introduced by the remediation

### N‑1 — Internal payment routes FAIL OPEN outside production ✅ **[High]**
`routes/storefront/internal-payment-routes.ts:71‑76` returns `true` (authorized) when `INTERNAL_API_SECRET` is unset **and** `ENVIRONMENT !== 'production'` — guarding all five new internal payment endpoints (payable read, reference, **confirm**, **failure**, event). Its siblings `internal-billing.ts:49‑53` and `internal-events.ts:20‑24` fail **closed**. Base `wrangler.toml` defaults `ENVIRONMENT = "staging"`, and `INTERNAL_API_SECRET` is a dashboard secret (in no `[vars]`), so any staging/preview deploy without that secret accepts **unauthenticated order‑payment‑confirm calls**. This is the single most consequential new finding: the H‑1 single‑writer refactor moved real payment‑state transitions behind an endpoint that is fail‑open by default off‑prod. **Source:** [08](08-error-misconfiguration.md), [14](14-risk-assessment.md), verified [17](17-evidence-appendix.md).

### N‑2 — Plaintext app secrets persisted for replay ✅ **[High]**
Keyed app installs store the full install response — including the app `access_token` and the "show‑once" webhook `signing_secret` — in `idempotency_keys.response_body` for ~24h replay (`app-store.ts:2143‑2158`, idempotency adapter `:69/:151‑156`). Ironically the install path is careful to store only `access_token_hash` in `app_installations.config`, then keeps both secrets in plaintext in the idempotency table. **Source:** [06](06-apps-ecosystem.md), verified [17](17-evidence-appendix.md).

### N‑3 — Orphaned security test that would have caught N‑1 ✅ **[High]**
The two new contract tests `tests/contracts/storefront-internal-payment-routes.test.ts` and `domain-event-contracts.test.ts` are wired into **no runner** — root globs match only `tests/*/*.test.mjs`, no workflow invokes `tsx`, and the test‑coverage validator lists only `.mjs`. The internal‑payment test asserts only the production fail‑closed branch, so even if it ran it would not catch N‑1. **Source:** [08](08-error-misconfiguration.md), [14](14-risk-assessment.md), verified [17](17-evidence-appendix.md).

### N‑4 — Uncontracted `payment.*` events through the new internal-event ingress **[Medium]**
`/v1/internal/events/domain` accepts any `eventType` ≤160 chars and skips payload validation for uncontracted types; `webhook-service` emits `payment.captured/failed`, `refund.created`, `payment.subscription.activated` through it with payloads stored raw (`event-execution.adapter.ts:54‑56`). **Source:** [06](06-apps-ecosystem.md), [07](07-integration.md).

### N‑5 — `gateway-events.ts` duplicated across two services ✅ **[Medium]**
`webhook-service/src/gateway-events.ts` and `queue-workers/src/gateway-events.ts` are functionally identical (differ only in formatting + inline‑vs‑imported binding type); the same internal‑fetch boilerplate is repeated across four client modules, with no shared package. **Source:** [10](10-duplication.md), verified [17](17-evidence-appendix.md).

### N‑6 — Agent‑ledger residue inside source trees + dead queue jobs **[Medium/Low]**
`CODEX_WS9_LEDGER.md` sits inside a Next.js route segment (`apps/merchant-control-plane/src/app/[store]/settings/`), WS10/WS1 ledgers inside their workspaces, 8 `CODEX_*.md` remain at root (2 byte‑identical to archived copies). Separately, the centralize‑outbox change now upserts `platform_queue_jobs` rows with `queue_name='webhook-deliveries'` that no consumer ever claims → permanent `queued` accumulation. **Source:** [09](09-dead-code.md), [13](13-technical-debt.md), verified [17](17-evidence-appendix.md).

---

## STILL-OPEN Criticals (product-facing — untouched by F0/F1)

| ID | Finding | Status detail | Source |
|---|---|---|---|
| C‑1 | Single‑worker monolith / SPOF | OPEN; modularization only began — `storefront.ts` **grew** 4,826 → 4,833 after a 233‑line extraction; 11 files >1,500 lines | [11](11-architecture-violations.md) |
| C‑3 | App tokens hit one GET‑only proxy; no app write API | OPEN; `verifyAppScopedAccessToken` single call site (`app-store.ts:1263`); `authMiddleware` still no app‑JWT branch | [06](06-apps-ecosystem.md) |
| C‑4 | Compliance webhooks never published | OPEN; zero emit sites — and WS10 now *advertises* the topics to developers without a producer behind them | [06](06-apps-ecosystem.md) |
| C‑5 | App billing moves no money | OPEN; `rzp_route_test_` fabrication (`:1551`), test/pending ledger; payout events honestly reserved | [06](06-apps-ecosystem.md) |
| C‑6 | Web editor preview unwired | OPEN; rewritten 2,244‑line editor still renders `PREVIEW_PRODUCTS` mock; `CenterPanel.tsx` still 0 importers | [04](04-theme-system.md) |
| C‑7 | Section vocabulary compiled into storefront | OPEN; `renderer-registry.tsx` unchanged; unknown → null | [05](05-storefront-runtime.md) |
| C‑8 | One‑step publish, last‑write‑wins | OPEN; web `PUT` still save‑then‑publish, still omits `base_version` | [04](04-theme-system.md) |
| C‑9 | No app embeds; Liquid lacks commerce objects | OPEN; `content_for_header/footer` still `''`; Liquid scope unchanged | [12](12-shopify-compatibility.md), [04](04-theme-system.md) |
| C‑10 | No server‑side cart | OPEN; cart still localStorage‑only; `public.carts` still 0 readers/writers — now **fail‑loud** (`graphql/storefront.ts` throws `CART_NOT_SUPPORTED`) | [05](05-storefront-runtime.md) |
| C‑14 | Observability has no metric producer | OPEN; `writeDataPoint` still never called; no OTel/prom‑client; `infrastructure/` untouched | [14](14-risk-assessment.md) |

## STILL-OPEN Highs (selected) + one promoted

| ID | Finding | Status | Source |
|---|---|---|---|
| H‑4 | Theme‑marketplace checkout is a fake success link | OPEN (rated **Critical** by the app report) — "Pay" still `<Link href="/checkout/success…">`, no payment intent ✅ | [03](03-application-investigation.md), [12](12-shopify-compatibility.md) |
| H‑2 | Legacy portfolio/resume surface live | OPEN; unchanged | [09](09-dead-code.md) |
| H‑3 | operator‑app counter demo / shopper‑app empty | OPEN; unchanged | [03](03-application-investigation.md) |
| H‑5 | Wasm `memory_limit_kb` unenforced | OPEN; `app-functions-runtime.ts` byte‑unchanged | [06](06-apps-ecosystem.md) |
| H‑6 | No client auth at `/oauth/token` | OPEN; no client_secret/PKCE/refresh | [06](06-apps-ecosystem.md) |
| H‑7 | Merchant password verify in Next app | OPEN; now *whitelisted* by `domain-boundary-validator.mjs:215` | [11](11-architecture-violations.md) |
| H‑8 | `@letbuyy/utils` dead service‑role edge | OPEN; 8 declared / 0 imported, package untouched | [09](09-dead-code.md), [11](11-architecture-violations.md) |
| H‑13 | No dev CLI/SDK/keys | IMPROVED → still open; WS10 is a documentation shell that exhaustively self‑declares `[SKIP — NEEDS BACKEND/SDK]` | [06](06-apps-ecosystem.md) |
| H‑15 | Racing prod deploys, no migration gate | OPEN; both workflows still race on push‑to‑main; an ops test now asserts the legacy workflow stays in sync | [14](14-risk-assessment.md) |
| H‑16 | Static bearer ops plane | OPEN; plain `!==` (not timing‑safe) at `internal-console.ts:56` | [14](14-risk-assessment.md) |
| H‑17 | Storefront login unprotected; internal endpoints trust no‑secret off‑prod | OPEN, and now intersects N‑1 (payment routes carry the same off‑prod fail‑open) | [08](08-error-misconfiguration.md), [14](14-risk-assessment.md) |

---

## Cross-cutting assessment

The remediation did exactly what its mission scoped (**F0 truth/topology + F1 backend integrity**) and did it well: verified single‑writer ownership, reconciled and validator‑locked the runtime inventory, honest service manifests, contracted events, and an app‑marketplace integrity batch (idempotent installs, server‑side webhook secrets, verified‑install reviews, honest outage states) — most of it federation‑test‑locked. Shopify parity ticked **41/90 → 43/90 (≈4.8/10)** on Theme Editor (+1, real multi‑template editing via migration 087) and App Marketplace (+1).

But three things a reader of the ledger should weigh:

1. **The hard product Criticals are all still open** — app platform, theme extensibility, cart, observability — because the mission's F2–F8 phases never ran. The platform is *more honest* and *structurally cleaner*, not *more capable*.
2. **The single‑writer refactor introduced a payment‑path auth regression (N‑1)** that is fail‑open by default off‑production, and the one test that touches that surface isn't wired into any runner (N‑3). This is the kind of issue the very "testing reality" phase (C‑11/F5) that was skipped would have caught.
3. **The governance suite is green at 129/129 and now genuinely means more than it did** (single‑writer is real, enforced) — but it still does not measure the open Criticals, N‑1's off‑prod branch, or runtime behavior. The first‑pass caution stands: a green suite certifies structure and ownership, not capability or safety.
