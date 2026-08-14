# 21 — Final Test Evidence

> Every command was executed; every exit code and count below was read from real output.
> **Environment:** macOS (darwin 25.3.0), Node v26.5.1, pnpm workspace, local Supabase
> (`supabase_db_Letbuyy_Store`, PostgreSQL 17.6) in Docker. **Branch:** `stepup/main`, baseline `ee371182`.
> **Mode:** local. **No live payment was initiated. No browser session was run.**

---

## 1. Test suites

### 1.1 Historical baseline — PRESERVED, NOT OVERWRITTEN

Recorded before the render-limit root cause was found. It is retained deliberately: it is the evidence
that the four failures were real and reproducible, not imagined.

| Command | Date | Exit | tests | pass | **fail** |
|---|---|---|---|---|---|
| `pnpm --filter @letbuyy/theme-engine test` | 2026-08-04 | 1 | **1 726** | **1 722** | **4** |

Failing: `liquid-l3-compiler` (round-trip) · `liquid-l5-product` · `liquid-l6-collection` ·
`liquid-l7-search`.

Two intermediate measurements, also preserved:

| Stage | tests | pass | fail | Note |
|---|---|---|---|---|
| After 2 sections + 2 templates added | 1 727 | 1 720 | 7 | +3 from assertions encoding the sections' *absence* |
| After those assertions were inverted | 1 727 | 1 723 | 4 | Back to exactly the pre-existing set |

### 1.2 Post-remediation — SEPARATE RESULT

| Command | Date | Exit | tests | pass | fail |
|---|---|---|---|---|---|
| `pnpm --filter @letbuyy/theme-engine test` | 2026-08-05 | **0** | **1 730** | **1 730** | **0** |

**Delta: 1 726 → 1 730 tests** (+3 render-limit contention tests, +1 mapped-but-absent test),
**4 → 0 failures**. Zero unexplained theme-system failures.

### 1.3 Focused reproduction of the four failures

| Test file | Before | After |
|---|---|---|
| `test/liquid-l3-compiler.test.ts` | fail | **pass 5 / fail 0** |
| `test/liquid-l5-product.test.ts` | fail | **pass 4 / fail 0** |
| `test/liquid-l6-collection.test.ts` | fail | **pass 7 / fail 0** |
| `test/liquid-l7-search.test.ts` | fail | **pass 4 / fail 0** |

### 1.4 Gateway, storefront and security suites

| Command | Exit | tests | pass | fail |
|---|---|---|---|---|
| `npx tsx --test services/api-gateway/src/__tests__/theme-library-q.test.ts` | 0 | 41 | **41** | 0 |
| `npx tsx --test services/api-gateway/src/__tests__/theme-persistence-p.test.ts` | 0 | 25 | **25** | 0 |
| `npx tsx --test services/api-gateway/src/__tests__/storefront-handle-resolution.test.ts` | 0 | 6 | **6** | 0 |
| `node --test tests/security/theme-tenant-isolation.test.mjs` | 0 | 6 | **6** | 0 |
| `npx tsx --test packages/theme-engine/test/liquid-render-limit-contention.test.ts` | 0 | 3 | **3** | 0 |
| `npx tsx --test tests/contracts/storefront-access-gate.test.ts` | 0 | 4 | 4 | 0 |

> The 41 theme-library tests confirm the inherited handoff's "41 tests passed" claim exactly.

---

## 2. Typecheck and real builds

`CLAUDE.md` warns the validator gate does **not** cover `next build`, so these were run explicitly.

| Command | Exit |
|---|---|
| `pnpm --filter @letbuyy/theme-engine typecheck` | **0** |
| `pnpm --filter @letbuyy/theme-engine build` | **0** |
| `pnpm --filter @letbuyy/api-gateway typecheck` | **0** |
| `pnpm --filter @letbuyy/api-gateway build` | **0** |
| `pnpm --filter @letbuyy/storefront-runtime typecheck` | **0** |
| `pnpm --filter @letbuyy/storefront-runtime build` | **0** |
| `pnpm --filter @letbuyy/merchant-control-plane typecheck` | **0** |
| `pnpm --filter @letbuyy/merchant-control-plane build` | **0** |
| `pnpm --filter @letbuyy/identity-platform typecheck` | **0** |

**8/8 real builds and typechecks pass** with all changes applied.

---

## 3. Governance — all 23 failures classified

**Counts:** clean `HEAD` **22 fail / 85 pass** · working-tree baseline **24 fail / 83 pass** ·
**now 23 fail / 84 pass**.

**Method:** the 107 gate-lane validators run **individually**. `scripts/validate-governance.mjs` was not
used as documented because it (a) `rm -rf`s `node_modules`/`.next`/`dist`/`.turbo`/`build` under `apps/`,
`packages/`, `services/` (lines 169-192; `stale-artifact-validator` is a gate member at line 86) and
(b) `process.exit`s at the first failure — which is why the inherited handoff reported "2".

| # | Validator | Failure (head line) | Now | HEAD | Changed by this task? | User-owned cause? | Affects theme production safety? | Safe remediation | Owner | Disposition |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `tenant-isolation-validator` | `tenant-tables.registry.ts` must match schema-derived registry | ❌ | ❌ | No | No | No — registry drift from migrations 176/185 | Run `scripts/generators/generate-tenant-table-registry.mjs` | platform | **Pre-existing** |
| 2 | `validate-design-system` | 2 HARD (`marketing-site`, `developer-portal` dark mode) + ratchet | ❌ | ❌ (1 HARD) | **No** | **Yes** | No | Owned by app teams | web | **User-owned** — validator scans `apps/` only, never `packages/theme-engine`; 2nd HARD is `developer-portal`, entirely uncommitted user work |
| 3 | `package-ownership-validator` | `packages/lcis-adapters/AGENTS.md` missing | ❌ | ❌ | No | No | No | Add ownership files | lcis | **Pre-existing** |
| 4 | `dependency-manifest-validator` | `${fromVersion}` parsed as a specifier | ❌ | ❌ | No | No | No — validator mis-parse of a template literal | Teach the validator about dynamic imports | platform | **Pre-existing** |
| 5 | `undeclared-import-validator` | same finding as #4 | ❌ | ❌ | No | No | No | as #4 | platform | **Pre-existing** |
| 6 | `provider-isolation-validator` | `lcis-adapters` call provider URLs directly | ❌ | ❌ | No | No | No | Route via `packages/infrastructure` | lcis | **Pre-existing** |
| 7 | `typescript-governance-validator` | `lcis-adapters/tsconfig.json` declaration maps | ❌ | ❌ | No | No | No | Fix tsconfig | lcis | **Pre-existing** |
| 8 | `custom-domain-target-validator` | merchant UI must read public target env | ❌ | ❌ | No | No | No | — | merchant | **Pre-existing** |
| 9 | `merchant-domains-settings-validator` | missing `NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET` | ❌ | ❌ | No | No | No | — | merchant | **Pre-existing** |
| 10 | `platform-domain-literal-validator` | 5 `letbuyy.store` literals in identity-platform | ❌ | ❌ | No | No | No | Migrate to `.com` (DEPLOY-R3) | identity | **Pre-existing** |
| 11 | `route-ownership-validator` | `custom-domains.ts:GET:/domains:483` ungated | ❌ | ❌ | No | No | No — outside theme surface | Add ownership gate | gateway | **Pre-existing** |
| 12 | `legacy-site-type-validator` | marketing create page exposes portfolio/resume | ❌ | ❌ | No | No | No | — | marketing | **Pre-existing** |
| 13 | `migration-safety-validator` | root `supabase/config.toml` is retired | ❌ | ✅ | No | **Yes** | No | Archive or remove the untracked file | user | **User-owned** |
| 14 | `domain-boundary-validator` | marketing-site + platform-console + route inventory | ❌ | ❌ | **Improved** | No | No | — | web | **Pre-existing — theme line REMOVED by this task** |
| 15 | `route-line-count-validator` | `routes/themes.ts` 1 870 lines > 1 500 | ❌ | ❌ | No | No | No — structural only | Split into route modules | theme | **Safe but deferred** — a 370-line extraction across every theme endpoint is not low-risk at this stage |
| 16 | `cms-slugify-validator` | local slugify in smart-collections page | ❌ | ❌ | No | No | No | Import `slugifyCmsTitle` | merchant | **Pre-existing** |
| 17 | `date-format-validator` | 3 local `formatDate` helpers | ❌ | ❌ | No | No | No | Import from `@letbuyy/ui/formatting` | web | **Pre-existing** |
| 18 | `api-client-runtime-base-validator` | marketing create page | ❌ | ❌ | No | No | No | — | marketing | **Pre-existing** |
| 19 | `marketing-dead-twin-validator` | homepage must use live Header/Hero | ❌ | ❌ | No | No | No | — | marketing | **Pre-existing** |
| 20 | `raw-error-message-validator` | `resource-search.ts` returns raw `error.message` | ❌ | ❌ | No | No | No | Add to `sanitizePublicErrorPayload` | gateway | **Pre-existing** |
| 21 | `environment-validator` | secret-like values in 2 theme-engine test files | ❌ | ❌ | No | No | **No — false positive** | None safe | theme | **Pre-existing — WILL NOT FIX.** The literals (`'sk_live_should_never…reach_liquid'`, `'whsec_must_never_render'`) are **negative-test fixtures asserting credentials never reach Liquid output**. Redacting them weakens the security tests. Correct fix is a validator test-fixture allowlist |
| 22 | `tooling-governance-validator` | unexpected root file `scripts/.DS_Store` | ❌ | ✅ | No | **Yes** | No | Delete the macOS artifact | user | **User-owned** |
| 23 | `prompt-perimeter-validator` | 3 unregistered prompt files under `V1_SCOPE_LOCK_…` | ❌ | ❌ | No | No | No | Register in `PROMPTS.md` | governance | **Pre-existing** |

**Fixed by this task:** `single-source-crypto-validator` (fail → pass) — `theme-update-route.ts` now
imports the shared `sha256Hex`, verified byte-identical.
**Regressions introduced:** **none.**

### 3.1 The three readiness states, stated separately

| Statement | Verdict |
|---|---|
| Gate green | ❌ **No** — 23 of 107 fail |
| No validator regression from this work | ✅ **Yes** — all 23 are pre-existing at clean `HEAD` or user-owned |
| Gate still red for pre-existing reasons | ✅ **Yes** — the accurate description |

---

## 4. Database

| Command | Exit | Result |
|---|---|---|
| `pg_dump` pre-reset backup | 0 | 12 813 530 bytes retained |
| Drop `public`, replay 124 migrations from zero | 0 | **124 applied, 0 failed**, 438 tables |
| Apply `001_seed.sql`, `urban-kicks-theme.sql` | 0 | clean |
| Fresh-DB theme state (before 197) | 0 | **only `urban-kicks`** — `letbuyy-core` absent, proving migration 188's no-op |
| Apply migration 196, re-apply, rollback, re-apply | 0 | idempotent; rollback restored `USING(true)` and 31 → 7 forced tables; re-apply restored 31/31 |
| Apply migration 197, re-apply, rollback, re-apply | 0 | idempotent (row md5 byte-identical); rollback **aborted** when a dependent `store_themes` row existed, as designed |
| Final state | 0 | `sites`=1, `themes`=2 (`letbuyy-core`, `urban-kicks`), no test residue |

---

## 5. The flaky benchmark — investigated, not silenced

| Field | Value |
|---|---|
| Test | `Urban Kicks fixture renders N=25 times within 30000ms budget` (`test/liquid-render-benchmark.test.ts`) |
| Isolated runtime | **711 ms**, then 1 422 ms on a second isolated run |
| Full-suite observed runtime | 1 557 ms → 2 454 ms |
| Budget | 30 000 ms |
| Reruns | 4 (2 isolated, 2 full-suite) — failed once, passed on every subsequent run |
| Shares global/process resources? | **Yes.** Node's test runner runs files concurrently in one process pool; every Liquid render competes for the same event loop, and `sanitizeRenderedHtml` runs jsdom + DOMPurify **synchronously** |
| Why contention produces the result | The benchmark measures **wall-clock**, so a sibling file's synchronous sanitize pass is charged to this test's elapsed time. Never CPU-bound: 711 ms against a 30 000 ms budget is a 42× margin |

**Budget was NOT raised.** Doing so would weaken a real performance contract to hide a harness property.
Deterministic isolation would require running this file in its own process (`--test-concurrency=1` for
this path, or a separate script), which is a **CI topology change outside this engagement's scope**.

**Disposition: test-infrastructure flakiness. Not a product pass and not a product failure.** Tracked in
[25-follow-up-backlog.md](25-follow-up-backlog.md).

Note the same wall-clock-under-contention mechanism caused the four Liquid failures (§1) — there it was
`renderLimit`, an *enforced* wall-clock budget rather than an asserted one. One mechanism, two symptoms.

---

## 6. What was NOT verified

| Not done | Why | Consequence |
|---|---|---|
| Browser/E2E across 360 px / tablet / desktop | No browser session run | Every preset is `Complete but not runtime-verified` |
| Screen-reader and contrast audit | Requires a runtime pass | Accessibility is structural only |
| Live Razorpay / COD | No sandbox adapter exists; live payments prohibited | Payment paths unverified |
| Production database probe | Out of scope, no credentials | Unknown whether `letbuyy-core` exists in production |
| Clean-checkout build | Needs a fresh `pnpm install` | HEAD-buildability **inferred, not proven** — the `node:crypto`/`jsdom` fix is in two **uncommitted** `next.config.ts` files and one **untracked** stub |
| Full `scripts/validate-governance.mjs` | Destroys `node_modules` | Equivalent signal obtained validator-by-validator |
