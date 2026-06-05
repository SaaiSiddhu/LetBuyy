# Evidence Appendix

**Investigation date:** 2026-06-05
**Purpose:** Consolidated proof layer for the forensic report set: (a) the independent fact-check log for the highest-stakes claims, (b) reproducible commands and their captured output, and (c) corrections/refinements made during verification. Per-finding evidence lives in each domain report's own "Evidence Index"; this appendix records the *cross-checking* done on top of those reports.

**Verification method:** A separate fact-checking pass re-derived each claim below from source (file reads + greps) without relying on the originating report. Verdicts: **CONFIRMED**, **PARTIALLY-CONFIRMED**, **REFUTED**, **CANNOT-VERIFY**. All paths are relative to the repository root (`/Users/saai_sidd/Git/Letbuyy_Store`).

---

## A. Independent fact-check log (14 high-stakes claims)

| # | Claim (abbreviated) | Verdict | Evidence found |
|---|---|---|---|
| 1 | Web theme editor live preview is unwired; editor previews a hardcoded mock | **CONFIRMED** | `components/theme-editor/CenterPanel.tsx` (iframe + postMessage, L44-50) has **0 importers** in merchant-control-plane; active editor `themes/[themeId]/editor/page.tsx:174` `const PREVIEW_PRODUCTS = [`, used in `PreviewCanvas` (L1665, L1903/1927); no `/preview-session` caller in that app. |
| 2 | App-scoped tokens accepted at exactly one GET-only endpoint | **CONFIRMED** | `verifyAppScopedAccessToken` single call site `services/api-gateway/src/routes/app-store.ts:1253`; general `authMiddleware` (`middleware/auth.ts:164-202`) accepts only Supabase Bearer/internal session — no app-JWT branch. |
| 3 | Compliance webhooks subscribed but never published | **CONFIRMED** | `customers/data_request|redact`, `shop/redact` defined once `packages/app-engine/src/index.ts:151-153`, injected into subscription insert (L1428-1434); **zero emit sites** repo-wide (only def + `developer-portal/src/lib/reference.ts:215-217` docs). |
| 4 | App billing moves no real money | **CONFIRMED** | Fake ref `rzp_route_test_${…}` `app-store.ts:1541`, status flip only (L1543-1545), no PSP call; payout ledger `payout_provider_mode:'test'`, `status:'pending'` `queue-workers/src/platform-queue-consumer.ts:657-664`; only `'released'` ref is a read-side aggregation (`app-store.ts:2527`). |
| 5 | No server-side cart (localStorage only) | **PARTIALLY-CONFIRMED** | `context/cart-context.tsx:28/43` `localStorage.getItem/setItem('lb_cart')`; no `/cart` persistence route. **Refinement:** a `public.carts` table exists (`database/supabase/migrations/000_baseline.sql:8633`) but is **unwired** — no route reads/writes it. Active cart is client-only as claimed. |
| 6 | `operator-app` is the unmodified Flutter counter demo | **CONFIRMED** | `apps/mobile/operator-app/lib/` = one file `main.dart`; L15 `title:'Flutter Demo'`, L57 `int _counter = 0`, L107 `'You have pushed the button this many times:'`, L115 `FloatingActionButton`. |
| 7 | theme-marketplace checkout "Pay" is a non-functional link | **CONFIRMED** | `apps/theme-marketplace/src/app/checkout/page.tsx:206-217` "Pay" = `<Link href={\`/checkout/success?theme=${theme.slug}\`}>` with only a toast `onClick`; no payment intent; `paymentMethod` state cosmetic. |
| 8 | 6 of 9 services are manifest-only (stronger: no package.json) | **CONFIRMED** | Implemented: `api-gateway` (93 .ts + pkg), `queue-workers`, `webhook-service`. The other 6 (`analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`) hold only `AGENTS.md` + `runtime.manifest.json` — no `src/`, no `package.json`. |
| 9 | Dual write-ownership of `orders`/`products` by api-gateway + webhook-service | **CONFIRMED** (grep-method corrected) | api-gateway: `product-execution.adapter.ts:147/182/234/295`, `order-execution.adapter.ts:328/444`. webhook-service writes via REST helper not `.from()`: `src/index.ts:412` `patchRows(env,"products",…)`, L430/468/503/1010 `patchRows(env,"orders",…)` setting `payment_status:"paid"`,`status:"confirmed"`. A `.from('orders')` grep misses these. |
| 10 | All deployable workspaces' `test` script is a no-op | **CONFIRMED** (exact string) | All 12 (9 apps + api-gateway/queue-workers/webhook-service) `package.json` `test` = `echo 'No tests yet' && exit 0` (note trailing `&& exit 0`). |
| 11 | `storefront.ts` is a ~4,800+ line god file | **CONFIRMED** | `wc -l services/api-gateway/src/routes/storefront.ts` → **4,993** at final measurement (was reported 4,320/4,826 earlier in the audit window — the file was being edited concurrently; see §C). |
| 12 | `@letbuyy/utils` declared by apps, imported by zero source files | **CONFIRMED** (count nuance) | `@letbuyy/utils` in 9 `package.json` (one is its own self-definition at `packages/typescript/utils`), → **8 consumer apps**; source imports across repo = **0**. |
| 13 | No live secrets in tracked source | **CONFIRMED** | No `sk_live_`, `rzp_live_`, `service_role` + `eyJ…` JWT literals, or `-----BEGIN … PRIVATE KEY-----` in apps/services/packages/scripts/config/database/supabase/infrastructure/tests. `@letbuyy/utils` strings in manifests are dependency names, not secrets. |
| 14 | Wasm function `memory_limit_kb` stored but not enforced | **CONFIRMED** | `services/api-gateway/src/extensions/app-functions-runtime.ts`: `memory_limit_kb` typed (L42) + SELECTed (L233) but `WebAssembly.instantiate(module, {})` (L203) passes empty imports; no `WebAssembly.Memory({maximum})` built; only `timeout_ms` (L200/204) + 64 KB output cap (L188) enforced. |

**Score:** 13 CONFIRMED, 1 PARTIALLY-CONFIRMED, 0 REFUTED. No headline claim was overturned; refinements strengthen the findings.

## B. Reproducible commands & captured output

These commands were run read-only during the investigation. Results are reproducible from a clean checkout.

**B-1. Governance suite — passes all gates.**
```
$ node scripts/validate-governance.mjs   # (run from repo root)
…
Domain boundary validator passed (13 domain packages and 17 schema facades checked).
Environment validator passed (2934 tracked files scanned).
Generated artifact validator passed (2934 tracked files scanned).
Stale artifact validator passed (10 untracked non-ignored files and 2539 workspace files scanned).
Tooling governance validator passed (9 canonical tooling directories checked).
Governance validation passed (128 validators).
EXIT: 0
```
This is the central evidentiary fact for the "governance-vs-reality gap": the suite is green while every Critical finding stands. It validates manifests, boundaries, RLS coverage, secret hygiene, and topology rules — not runtime behavior, tests, or telemetry.

**B-2. Service code presence (monolith proof).**
```
services/api-gateway        → src/ (90+ .ts), package.json, wrangler  [IMPLEMENTED]
services/webhook-service     → src/, package.json, wrangler           [IMPLEMENTED]
services/queue-workers       → src/, package.json, wrangler           [IMPLEMENTED]
services/analytics-pipeline  → AGENTS.md + runtime.manifest.json only [CONTRACT-ONLY]
services/checkout-runtime    → AGENTS.md + runtime.manifest.json only [CONTRACT-ONLY]
services/event-bus           → AGENTS.md + runtime.manifest.json only [CONTRACT-ONLY]
services/media-service       → AGENTS.md + runtime.manifest.json only [CONTRACT-ONLY]
services/notification-service→ AGENTS.md + runtime.manifest.json only [CONTRACT-ONLY]
services/search-service      → AGENTS.md + runtime.manifest.json only [CONTRACT-ONLY]
```

**B-3. Test-script reality.**
```
$ grep -h '"test"' apps/*/package.json apps/mobile/*/package.json services/*/package.json
"test": "echo 'No tests yet' && exit 0"   # × all 12 deployable workspaces
```

**B-4. God-file size.**
```
$ wc -l services/api-gateway/src/routes/storefront.ts
4993 services/api-gateway/src/routes/storefront.ts
```

**B-5. Dead dependency edge.**
```
$ grep -rl "@letbuyy/utils" --include=package.json .    →  9 files (1 self-definition + 8 consumers)
$ grep -rl "from ['\"]@letbuyy/utils" --include=*.ts --include=*.tsx apps services packages  →  0 files
```

## C. Corrections, caveats & investigation conditions

1. **The repository was being edited during the audit.** Multiple files (notably `services/api-gateway/src/routes/analytics.ts`, `storefront.ts`) changed mtime mid-investigation, and `validate-governance.mjs` produced a transient FAILURE on an execution-authority check before passing on re-run ([07](07-integration.md), [08](08-error-misconfiguration.md)). Line numbers for the largest gateway files are therefore accurate as of capture but may drift by a few lines. The governance suite's final state at the close of investigation was **PASS (exit 0)**.

2. **Workspace/bash backend was intermittently unavailable**; affected agents cross-executed via the Read/Grep/Glob file tools, so all cited counts are independently file-tool-verified, not bash-only.

3. **`pnpm install` could not complete cleanly** in this environment (corepack EACCES, partial `node_modules`), so standalone per-workspace `tsc --noEmit` could not be run for every workspace; import-integrity claims rely on path/grep analysis where typecheck was infeasible ([08](08-error-misconfiguration.md), [14](14-risk-assessment.md)).

4. **Severity normalization.** Source reports used independent severity scales; [16](16-critical-findings-summary.md) re-rates findings by blast radius × evidence strength, which in a few cases promotes or demotes an item relative to its originating report. Both the normalized rating and the source are shown there.

5. **Stale prior-run files retained.** Eight short report stubs dated earlier the same day (e.g. `03-application-reports.md`, `08-dead-code.md`, `09-duplication.md`, `10-architecture-violations.md`, `11-shopify-gap-analysis.md`, `12-technical-debt.md`, `13-risk-assessment.md`, `14-evidence-appendix.md`) are from an earlier partial pass and were **left untouched** at the user's instruction (delete was declined). They are **superseded** by the canonical numbered set in [README.md](README.md) and should be disregarded; their content was not used as evidence here.

6. **Prior-doc corrections surfaced during verification.** Several claims in the repo's *own* older audit ledgers were independently disproven and should not be carried forward: outbox dispatch *is* now cron-wired; the search consumer and magic-link paths *are* wired; and `tasks/todo.md` / `memory/lessons.md` (both dated 2026-03-01) still list ≥5 already-resolved CRITICAL security items as open ([07](07-integration.md), [13](13-technical-debt.md), [14](14-risk-assessment.md)).

---

### How to reproduce the full investigation
Each domain report (`01`–`14`) contains a "Method" section listing its commands and an "Evidence Index" listing every cited path. This appendix records only the cross-cutting verification performed on top of them. No command in this investigation modified, created, deleted, moved, or renamed any file in the platform under investigation; the only writes were the report files in `FORENSIC_REPORT/`.
