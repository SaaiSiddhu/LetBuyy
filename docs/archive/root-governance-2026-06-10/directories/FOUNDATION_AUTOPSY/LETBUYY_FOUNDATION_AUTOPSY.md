# LETBUYY — FOUNDATION AUTOPSY
### The final pre-production CTO investigation · 2026-06-09
### Method: full-repo structural analysis + 8 parallel domain deep-dives, every claim file-cited and cross-verified against the actual code (not against prior audits, and not against the architecture documents' own claims).

> Source-of-truth contract: `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`. Companion deep-dives: `ARCHITECTURE_COMPLIANCE_REPORT.md`, `SERVICE_TOPOLOGY_REPORT.md`, `PAYMENTS_AUTOPSY_REPORT.md`, `CHECKOUT_AUTOPSY_REPORT.md`, `AUTH_AUTOPSY_REPORT.md`, `DATABASE_AUTOPSY_REPORT.md` (this folder).

---

## 1. Executive Summary

LetBuyy is **not a fake**, and it is **not production-ready**. It is a large (≈335K LOC TS/Dart, 89 forward migrations, 10 web apps, 4 real services, 27 packages), genuinely sophisticated codebase whose defining characteristic is a single repeating pattern:

> **For almost every critical capability, there exist two implementations — a correct, sophisticated, well-tested one that is NOT wired up, sitting next to a simpler one that IS wired up and is subtly unsafe. The gap between them is invisible until production.**

This pattern recurs with uncanny consistency:

| Capability | The good system (dormant) | The wired system (unsafe) |
|---|---|---|
| **Checkout** | hosted state machine + signed handoff + compensation (`checkout.ts`) — **orphaned** | "order-first, pay-later" that commits inventory before money, no cleanup |
| **Inventory** | reservation kernel w/ TTL + optimistic version (`migration 141`) — **0 callers** | direct decrement at order-create (oversell-safe but leaks on abandonment) |
| **Payouts** | no-custody settlement-ingest (Pipeline A) | sandbox adapter that **fabricates "released" + posts the canonical ledger** (Pipeline B) |
| **Tenant isolation** | fail-closed GUC + FORCE RLS on `executable_*` tables (139–159) | app runs as `service_role` (BYPASSRLS); GUC never set; baseline `USING(true)` policies |
| **Auth/session** | `session-core`/`permission-core` rotation+revocation interfaces | empty stubs; opaque 30-day token, no rotation |

Underneath this sits a **governance fault at the constitutional level**: two frozen authority documents mandate opposite architectures. `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` rejects CQRS/sagas/distributed-runtime/marketplace; `AGENTS.md` (which `CLAUDE.md:3` ranks first) *mandates* them. The code obeyed `AGENTS.md`, so ~18,000 LOC of V1-rejected CQRS/saga machinery is **load-bearing on the request hot path**, defended by 167+ validators, with an active V2 mission building the marketplace V1 defers to ~5,000 merchants. LetBuyy has ~0.

**The genuinely good news:** the hardest correctness primitives are real and DB-enforced — an append-only double-entry ledger with reject triggers, money-IN forgery/replay protection with a server-side capture re-check, oversell-proof inventory on the live path, a real enforced design-token engine, a clean single data plane, zero circular imports, genuinely empty reserved services, and a best-in-class zero-config local dev bootstrap.

**The verdict:** the engineering *talent* here is real and visible. The engineering *judgment about what to finish* is not. LetBuyy has built the 10,000-merchant machine and left the 100-merchant safety rails as scaffolding. It cannot take real money or real tenants tomorrow without losing money silently and leaking data across stores.

**Scores:** Foundation Health **2.5 / 5** · Production Readiness **1.5 / 5** · Developer Experience **3.7 / 5**.

---

## 2. What Is Actually Strong (verified real, keep and protect)

1. **The double-entry ledger is real and enforced at the database layer.** `139_executable_foundation_ledger_core.sql`: 8 named accounts (`:79-88`), append-only via `BEFORE UPDATE/DELETE` reject triggers on `ledger_entries`+`ledger_transactions` (`:360-376`), a deferred balance-invariant constraint (`:378-382`), single-writer CHECK (`:113`), idempotent posting RPC (`:223-342`). This is above typical pre-production quality.
2. **Money-IN payment safety is correct.** HMAC binds `order_id|payment_id`, fail-closed (`routes/payments.ts:1299-1325`); global unique index on `(gateway, provider_payment_id)` (`107:134`); a genuine server-side capture re-check (`payments.ts:1101-1118`).
3. **Oversell is genuinely solved on the live path.** `create_order_with_inventory_reservations` serializes on `FOR UPDATE OF il` (`000_baseline.sql:3369`) with a correct guard (`:3375`) — last-unit concurrency yields exactly one winner.
4. **The design-token engine is real *and enforced*.** `packages/typescript/ui/src/tokens.ts` (1,388 LOC) with runtime CSS injection, WCAG contrast checks, and a `no-hardcoded-hex: error` ESLint rule that drives hardcoded hex to ~16 across 9 apps (7,664 `var(--…)` refs).
5. **The ops/internal RBAC engine genuinely enforces stored scopes** — `employee_permissions` + role-tier defaults + time-boxed break-glass + dual-control SoD (`middleware/rbac.ts:273-361`). The strongest authz in the system.
6. **Clean single data plane.** No Next app holds a Supabase/service-role client (repo-wide grep = 0); apps reach data only via the gateway. Bounds the tenancy blast radius.
7. **Topology hygiene.** Reserved services genuinely empty (6/6), deprecated aliases gone (9/9), **zero circular imports** (52 governed roots), `pnpm-workspace.yaml` matches reality, dev bundles git-ignored (not committed).
8. **DevEx cold-start is excellent.** `git clone → pnpm install → pnpm dev` auto-generates env with dev-safe defaults (Turnstile test keys, demo JWTs, in-memory rate-limit fallback) — no cloud login required to boot 9 apps.
9. **Mobile is a coherent service-layer architecture** (33 ChangeNotifier services; 55 screens via `context.read<XService>`, only 1 direct API import) with real widget + E2E tests.
10. **A consolidated web ThemeProvider** adopted 9/9, replacing five forked theme controllers; token-driven dark mode at the core.

---

## 3. What Looks Strong But Is Not

1. **"Layered tenant isolation."** The `executable_*` migrations implement fail-closed GUC + FORCE RLS beautifully — but the app runs as `service_role` (BYPASSRLS), the GUC is never set on any live connection, and the `orders`/`products` GUC policies are OR-defeated by undropped `USING(true)` baseline policies (`000_baseline.sql:26690,26718`). Isolation is one forgotten `.eq()` from a breach. *(DATABASE report.)*
2. **"Real payouts via PA-split."** The default sandbox adapter fabricates `status:'released'` + a fake UTR and writes the canonical ledger as if money moved (`payout-transfer-adapter/index.ts:82-93` → `routes/payouts.ts:544-560`); the live path is a no-op. *(PAYMENTS report.)*
3. **"Idempotent checkout-session with scoped compensation."** Real — but orphaned. The live storefront never calls it; the compensation row is written and never executed. *(CHECKOUT report.)*
4. **"194-validator governance."** ~25% is provable theater — certification validators are ≤12-line string-existence checks that certify replay/failover/WAL recovery while the evidence files self-label `productionCertification:false`; and **zero validators enforce the two invariants the contract actually mandates** (rollback-per-migration, FORCE RLS) despite 79%/89% violation. The canonical gate also `rm -rf`s build caches and crashes on EPERM.
5. **"OAuth2/PKCE, refresh-token rotation, DPDP consent ledger, automated DSR."** All contract deliverables; all skeleton/stub/absent — OIDC endpoints return 501 with a mock JWKS; `session-core`/`permission-core` are empty interfaces; consent ledger doesn't exist; DSR is a manual ticket tracker.
6. **"One design-token source of truth."** True for 5 of 9 apps; `app-marketplace` maintains a 56-line shadow `--lb-color-*` palette, and mobile forks `LetbuyyColorTokens` with an incompatible API.
7. **"Observability + alerting."** Structured logging is real, but the Prometheus/Grafana/OTel configs have **no emitters** — alerting would never fire. PII/PAN redaction covers only 8 hardcoded keys.
8. **"Mobile feature coverage."** The parity catalog (`merchant_feature_screen.dart`), ordered removed, still ships — 6 routes render a placeholder shell, 4 literally render `[SKIP - NEEDS BACKEND]`.

---

## 4. What Is Completely Broken (does not work as claimed)

1. **Money-OUT.** With default config a payout records a ledger lie; in live mode it never completes. (`payout-transfer-adapter/index.ts:95-103`)
2. **Tenant isolation at the DB layer.** RLS is never evaluated for app traffic (service_role BYPASSRLS); the GUC layer is dead. (`lib/supabase.ts:13`)
3. **The auto-refund compensation flow.** Written, never executed; vacuous on the live path. (`checkout.ts:311-338`)
4. **Tested disaster recovery.** Backups are pre-migration-only (7-day retention); the only `pg_restore` is `--list`. No restore has ever been run. (`production-deploy.yml:220-237`)
5. **DB failover.** `FAILOVER_REGION=ap-southeast-1` is declared but no code routes DB/runtime to it; only email-provider failover is real.
6. **Deep linking (mobile).** `go_router` is a dependency but `AppDeepLinkRouter.router` is referenced nowhere; no `app_links`/`uni_links` entrypoint exists.
7. **OAuth2/PKCE.** 501 skeleton, mock JWKS literal `'mock-x-coordinate'`.
8. **The canonical governance gate.** Crashes on EPERM after destructively deleting build caches (`validate-governance.mjs:216-217`).

---

## 5. What Is Fake (reads as success while doing nothing real)

1. **Sandbox payout → `released` + fabricated UTR + canonical ledger posting.** The single most dangerous fake in the repo. (`payout-transfer-adapter/index.ts:87`)
2. **App-marketplace partner payouts** — `planSandboxAppPayoutTransfer` returns `released`/`settled_at` with no movement (`billing-core/src/index.ts:531`).
3. **recon breaks auto-`explained`** into the reserve account — a real shortfall self-heals on the books (`settlements.ts:266`).
4. **COD reconciliation** trusts merchant-typed amounts and bypasses the canonical ledger (`cod-reconciliation.ts:354,421`).
5. **Certification validators** that assert disaster-recovery guarantees by string-matching source files (`operational-certification-common.mjs:32-47`).
6. **The parity feature catalog** rendering `[SKIP - NEEDS BACKEND]` as if it were a feature (`merchant_feature_definitions.dart:323`).
7. **Orphaned Prometheus/Grafana dashboards** with no data source.
8. **Mobile source-string-grep "tests"** (~197 `expect(source, contains(...))`) — anti-regression theater whose very existence proves placeholder-inflation is a recurring problem.

---

## 6. What Is Scaffolded (real structure, unfinished behavior)

1. **Live PA-split transfer** — adapter shape exists, no provider call (`payout-transfer-adapter/index.ts:95-103`).
2. **Inventory reservation kernel** (reserve/commit/release + version + sweeper) — built in `migration 141`, **0 callers**.
3. **Hosted checkout System A** — full state machine, idempotency, compensation; not wired to the storefront.
4. **Live KMS** — interface exists, throws `KmsHumanRequiredError`; mock literal is the default (`crypto.ts:27,41`).
5. **DSR export/erasure** — ticket tracker + action types, no automated bundler/erasure.
6. **WhatsApp** — opt-in consent column exists; BSP/Meta adapter is mock.
7. **Shipping** — Shiprocket adapter wired; Delhivery/Pickrr mock-gated.
8. **`session-core`/`permission-core`** — interfaces with no implementation.

---

## 7. What Is Dangerous (will cause loss/breach, ranked)

1. **S0 — Fabricated payout writes canonical ledger truth.** Merchants' books record disbursements that never happened. (`routes/payouts.ts:544-560`)
2. **S0 — Tenant isolation rests on hand-discipline with no DB backstop.** One forgotten `.eq('site_id')` = cross-tenant IDOR; migration 107's header proves it already happened once (password-hash leak). (`lib/supabase.ts:13`)
3. **S0 — Forgeable staff-console session.** `getConsoleSessionSecret()` falls back to the public literal `'dev-only-console-session-secret'` whenever `NODE_ENV !== 'production'`, ignoring `VERCEL_ENV`/`APP_ENV`. (`console-session.ts:23-31`)
4. **S0 — Mock-default KMS literal.** Field-level encryption wraps PII/payment-config with `'letbuyy-local-mock-kms-envelope-secret'` unless `LETBUYY_KMS_MODE=live` (which throws). (`crypto.ts:7,41`)
5. **S0 — Inventory leaks on every abandoned paid checkout** (commit-before-pay, no release, no sweeper). (`checkout-payment-routes.ts` + `000_baseline.sql:3382`)
6. **S0 — Rate limiter fails OPEN in production** if Upstash+KV are unavailable (`middleware/rateLimit.ts:882-887`); default config ships Upstash blank.
7. **S1 — No tested restore / single-region SPOF with fake failover.**
8. **S1 — Schema drift swallowed at runtime** — soft-deleted rows can resurface; prod schema undocumented. (`routes/app-store/schema-drift.ts:29`)
9. **S1 — `ledger_entries` has no RLS** (`139:125`).
10. **S1 — Razorpay webhook skips the timestamp window** (`webhook-service/src/index.ts:712-719`).

---

## 8. What Is Over-Engineered (delete or freeze)

1. **~18,150 LOC of V1-rejected CQRS/saga/mesh runtime** (`distributed-runtime` 9,858 / `orchestration` / `projection-runtime` / `runtime-composition` / `extension-host` / `app-engine`) — and `distributed-runtime` **doubled (76→148 files) after the freeze**.
2. **~3,941 LOC of Admin+Storefront GraphQL** mounted live, absent from V1's REST-only design.
3. **A 3rd-party App Marketplace** (`apps/app-marketplace`, 21 pages) + Developer Portal (9 pages) + an active V2 build mission — for a platform with ~0 merchants.
4. **Two full internal-ops apps** (40 pages) vs V1's "thin sliver."
5. **194 governance validators**, dozens defending the rejected architecture; the count is a vanity metric.
6. **A live Durable-Object checkpoint coordinator** — distributed machinery V1 R-13 rejects.
7. **A theme-marketplace** (29 pages) beyond the theme-editor scope.

---

## 9. What Is Under-Engineered (build before launch)

1. **Real money-out** (live PA-split transfer + provider-driven status).
2. **Enforced tenant isolation** (set the GUC + FORCE RLS, or stop using service_role for tenant data).
3. **Inventory release on payment-failure/abandonment** + a stale-reservation/abandoned-order sweeper.
4. **An executed compensation path** for paid-but-order-failed.
5. **PII/PAN log redaction** + fail-closed config validation at boot.
6. **Tested backup/restore + a real DB failover or PITR story.**
7. **Wired alerting** (emit to the Prometheus/Grafana stack that already exists).
8. **Merchant-staff RBAC** (per-scope, not owner-only).
9. **Rollback-per-migration** + a fail-loud migration/prod reconciliation (kill the drift swallow).

---

## 10. What Must Be Deleted

1. The fabricated-success branch of `payout-transfer-adapter` (sandbox `released`) and `planSandboxAppPayoutTransfer`.
2. The schema-drift swallow (`routes/app-store/schema-drift.ts`) — replace with fail-loud reconciliation.
3. The baseline permissive `service_role_orders`/`service_role_products` `USING(true)` policies.
4. The parity catalog (`merchant_feature_screen.dart` + `merchant_feature_definitions.dart`) or the 6 placeholder routes at minimum.
5. The dead `go_router`/deep-link code (or wire it).
6. The ~25% theater validators (certification/convergence tier) — they create false confidence.
7. **Strategic decision required (human ARB):** either delete the V1-rejected CQRS/marketplace surfaces, or formally retire V1 and adopt `AGENTS.md`'s architecture. The contradiction itself must be deleted.
8. 43 MB of committed audit screenshots (`artifacts/shopify-ux/`, `artifacts/local-operational-proof/`) and the ~98-file root `.md` landfill.

---

## 11. What Must Be Rebuilt

1. **Money-OUT pipeline** — collapse Pipelines A/B into one no-custody PA-split with provider-driven status and an honest mode badge.
2. **Tenant-isolation enforcement** — a single middleware that sets per-request scope and is backed by FORCE RLS, replacing 60+ hand-rolled `verifySiteOwnership` calls.
3. **Checkout** — make System A the real path (reserve→pay→confirm→commit with executed compensation), or rebuild System B to reserve-then-pay.
4. **Auth platform trust layer** — implement (or formally drop) OAuth2/PKCE, refresh-token rotation, consent ledger, automated DSR; unify the six session mechanisms.
5. **COD reconciliation** onto the canonical ledger with a courier remittance feed.

---

## 12. What Must Be Stabilized (keep, harden)

1. The ledger DDL (add RLS to `ledger_entries`; add the audit-log reject trigger).
2. Money-IN safety (keep; add real-DB tests).
3. Oversell inventory (keep; extend the lock to cover release/abandonment).
4. The token engine (finish adoption: kill the `app-marketplace` shadow palette, unify mobile tokens, promote `px`/`rgba` lint warnings to errors).
5. DevEx (fix the destructive/ crashing governance gate; document the Docker/Supabase data step).
6. The ops-RBAC engine (extend the same rigor to the merchant plane).

---

## 13. Top 25 Launch Blockers

| # | Sev | Blocker | Evidence |
|---|---|---|---|
| 1 | S0 | Sandbox payout fabricates `released` + posts canonical ledger | `payout-transfer-adapter/index.ts:82-93` |
| 2 | S0 | Live payout is a no-op (money stuck in `processing`) | `payout-transfer-adapter/index.ts:95-103` |
| 3 | S0 | App runs as service_role (BYPASSRLS); tenant isolation has no DB backstop | `lib/supabase.ts:13` |
| 4 | S0 | Tenant GUC never set on any live connection | grep: 0 runtime callers of `set_current_site_id` |
| 5 | S0 | `orders`/`products` RLS OR-defeated by `USING(true)` baseline | `000_baseline.sql:26690,26718` |
| 6 | S0 | Forgeable staff-console session secret fallback | `console-session.ts:23-31` |
| 7 | S0 | KMS defaults to mock literal → PII/payment-config effectively plaintext | `crypto.ts:7,41` |
| 8 | S0 | Inventory leaks on every abandoned paid checkout (commit-before-pay) | `000_baseline.sql:3382` + no sweeper |
| 9 | S0 | Auto-refund compensation never executes | `checkout.ts:311-338` |
| 10 | S0 | Rate limiter fails OPEN in prod | `middleware/rateLimit.ts:882-887` |
| 11 | S0 | No tested restore drill (backups never restore-verified) | `production-deploy.yml:220-237` |
| 12 | S0 | COD self-attested, bypasses canonical ledger | `cod-reconciliation.ts:354,421` |
| 13 | S1 | `ledger_entries` has no RLS | `139:125` |
| 14 | S1 | Single-region DB SPOF; declared failover is decorative | `index.ts:246` |
| 15 | S1 | Schema drift swallowed → soft-deleted rows resurface | `routes/app-store/schema-drift.ts:29` |
| 16 | S1 | Mobile login fails closed without a real Turnstile site key at build | `store_auth_service.dart:364-375` |
| 17 | S1 | PII/PAN log redaction absent (8-key only) | `replayable-secret-redaction.ts` |
| 18 | S1 | Order immutability trigger dormant for all real orders | `147:125-154` |
| 19 | S1 | Admin `PATCH /line-items` oversells + desyncs totals | `orders.ts:1019-1071` |
| 20 | S1 | Razorpay webhook skips timestamp window | `webhook-service/src/index.ts:712-719` |
| 21 | S1 | Merchant-staff RBAC is owner-only (no per-scope) | `employee.ts` + `middleware/permission.ts:112` |
| 22 | S1 | Domain split-brain (`.com` BFF vs `.store` rest + cookies) | `mobile-bff/wrangler.toml:87` |
| 23 | S1 | No money-path behavioral tests (string-match only) | `__tests__/money.test.ts:17-76` |
| 24 | S2 | Parity catalog ships `[SKIP - NEEDS BACKEND]` screens | `merchant_feature_definitions.dart:323` |
| 25 | S2 | Governance gate destructive + crashes (false green) | `validate-governance.mjs:216-217` |

---

## 14. Top 25 Foundation Risks (structural/latent)

1. Two contradictory frozen constitutions (`CLAUDE.md:3` vs V1 §4 vs `AGENTS.md:168`). 2. ~18K LOC rejected CQRS/saga on the hot path. 3. `distributed-runtime` still growing post-freeze (76→148). 4. Governance defends the rejected architecture (167+ validators). 5. Active V2 marketplace mission for ~0 merchants. 6. The "two parallel systems" pattern across checkout/inventory/payouts/RLS/auth. 7. ~25% validator theater creates false confidence. 8. Migrations no longer describe prod (drift). 9. ~21% rollback coverage; critical security migrations have none. 10. Duplicate migration #129 → rebuild ambiguity. 11. `audit_logs` mutable (no trigger). 12. Three money-unit systems (`numeric(12,2)` / `bigint` / `integer`). 13. `orders` tenant keys nullable, no FK. 14. Six overlapping auth mechanisms + a live Supabase path. 15. `session-core`/`permission-core` hollow. 16. GraphQL surface (~4K LOC) ungoverned by route-size validator. 17. Design-token forks (app-marketplace shadow palette, mobile fork). 18. Shell adoption 2/9. 19. Orphaned observability stack (alerting never fires). 20. No fail-closed boot config validation. 21. Mobile god-screens (orders 2,000 lines; 34 widgets for 66 screens). 22. Dead deep-link infra. 23. 43 MB committed screenshots + root `.md` sprawl. 24. Single-writer ledger discipline depends on convention beyond the CHECK. 25. DPDP/consent/DSR mostly absent for an India data-regulated platform.

---

## 15. 90-Day Stabilization Roadmap

**Phase 0 — Decisions & Stop-the-Bleeding (Week 1–2).**
- **ARB decision: resolve the constitution conflict.** Pick one — (a) honor V1 (freeze/quarantine the CQRS/marketplace surfaces) or (b) retire V1 and adopt `AGENTS.md`. Update `CLAUDE.md` precedence. *Nothing else can be "compliant" until this is decided.*
- Kill the fakes that record false money truth: delete the sandbox `released` payout branch + `planSandboxAppPayoutTransfer`; gate every release ledger write behind a real provider `settled` event.
- Close the S0 secret gates: console-session secret (4-var prod check), KMS fail-closed.
- Flip the rate limiter to fail-closed in prod; provision Upstash.

**Phase 1 — Money & Tenancy Integrity (Week 3–7).**
- Implement live PA-split transfer + provider-driven status poller/webhook; one no-custody pipeline; honesty badge on every money surface.
- Enforce tenant isolation: set the GUC per request *or* move tenant data off service_role; drop the `USING(true)` policies; enable RLS on `ledger_entries`; convert `verifySiteOwnership` into enforced middleware.
- Reserve-before-pay checkout (or release-on-failure + abandoned-order sweeper); execute the compensation path.
- Route COD through the canonical ledger with a remittance feed.
- Add real-DB integration tests for ledger triggers, balance invariant, payout state machine, idempotency-under-concurrency.

**Phase 2 — Operability & Recovery (Week 8–11).**
- Tested restore drill + PITR; a real DB failover or documented RTO/RPO.
- Wire alerting to the existing Prometheus/Grafana stack; emit metrics.
- PII/PAN log redaction; fail-closed boot config validation.
- Replace schema-drift swallow with fail-loud reconciliation; restore rollback-per-migration; fix the #129 collision; fix the destructive governance gate.

**Phase 3 — Cleanup & Honesty (Week 12–13).**
- Delete/quarantine per the Phase-0 decision; remove the parity catalog placeholders; finish token adoption; consolidate auth/session; purge committed artifacts + root `.md` sprawl.

---

## 16. Exact Codex Execution Order (dependency-correct)

1. **[HUMAN/ARB]** Resolve V1-vs-`AGENTS.md` precedence; record in `CLAUDE.md`. *(Blocks all "compliance" work.)*
2. `payout-transfer-adapter/index.ts` — remove sandbox `released`; never post release ledger without a provider `settled` event. `billing-core/src/index.ts:525` — same.
3. `console-session.ts:23-31` — gate the secret on `VERCEL_ENV`/`APP_ENV`/`NODE_ENV`; remove the literal in any reachable-deploy path.
4. `crypto.ts:41` — make KMS fail-closed (no mock default in prod).
5. `middleware/rateLimit.ts:882-887` — fail-closed in prod; provision Upstash bindings.
6. Tenancy: add a request middleware that runs `set_config('app.site_id', …, true)` (or migrate tenant reads off service_role); migration to `DROP POLICY service_role_orders/service_role_products`; `ALTER TABLE ledger_entries ENABLE + FORCE ROW LEVEL SECURITY` + policy.
7. Checkout: release inventory on payment-failure/abandonment; add an abandoned-order + stale-reservation sweeper in `queue-workers`; wire the compensation executor.
8. Live PA-split transfer + status poller; COD → canonical ledger + remittance feed; recon breaks open-by-default with maker-checker.
9. Restore drill + PITR; alerting emitters; PII/PAN redaction; fail-closed boot config.
10. `routes/app-store/schema-drift.ts` — replace swallow with fail-loud reconciliation; backfill rollbacks; resolve duplicate #129; fix `validate-governance.mjs:216-217` (stop destructive `rm -rf`).
11. Per the Phase-0 decision: delete/quarantine CQRS/marketplace surfaces; remove parity catalog; finish token + auth consolidation; purge artifacts.
12. `route-line-count-validator.mjs:10` — extend scope to `graphql/` + `execution/`; add validators that actually enforce rollback-per-migration + FORCE RLS.

---

## 17. Estimated Foundation Health Score — **2.5 / 5**

The correctness primitives that exist are genuinely strong (ledger, money-IN, oversell, tokens, ops-RBAC, clean data plane, no cycles). But the load-bearing *safety* properties (tenant isolation, money-out, compensation, append-only coverage, auth platform-trust) are theater, broken, or unwired, and the architecture is governed by a self-contradiction. A 2.5 reflects "real talent, half-finished safety, governance incoherence." (Prior internal audits scored ~2.0; this is marginally higher because the ledger/money-IN/oversell/token strengths are more real than they were credited.)

## 18. Estimated Production Readiness Score — **1.5 / 5**

Cannot survive 100 merchants tomorrow: money-out is fabricated, tenant isolation is bypassable, secrets-at-rest are mock-wrapped, the rate limiter fails open, there is no tested restore and no real DB failover, and alerting never fires. The CI/CD pipeline and structural logging are genuinely good (which keeps it off the floor), but the system can *deploy* impressively while being unable to *operate or recover* under failure or take money honestly.

## 19. Estimated Developer Experience Score — **3.7 / 5**

Best-in-class zero-config web boot (`pnpm install → pnpm dev`, auto-env, no cloud login), excellent `LOCAL_DEV.md`, clean workspace, no cycles. Docked for: the canonical governance gate is destructive and crashes; you get an empty shell until you stand up Docker/Supabase; 194 validators (many theater) obscure which checks matter; and the two-constitution conflict means a new engineer cannot determine what "correct" is.

---

## 20. Final CTO Verdict

LetBuyy is the work of people who can clearly build hard things — a DB-enforced double-entry ledger, oversell-proof concurrency, a real token engine, a scope-enforcing RBAC kernel, a clean monorepo. That talent is not in question. **What is in question is judgment about completion and truth-telling.** The same repository that enforces ledger immutability with Postgres triggers will, by default, *write a fabricated payout into that immutable ledger.* The same team that built fail-closed RLS policies runs the app as the one role that bypasses them. The same governance apparatus with 194 validators enforces neither of the two database invariants its own architecture mandates, while certifying disaster-recovery guarantees that have never executed. And above it all, two frozen constitutions order opposite architectures, so "following the rules" actively moves the code away from its stated target.

This is not a codebase that needs more building. **It needs subtraction, reconciliation, and honesty.** Make one architecture authoritative. Make every stub *fail* instead of *succeed-quietly*. Wire the good systems that already exist and delete their unsafe twins. Until money-out stops lying, tenant isolation stops resting on a developer's memory, secrets stop defaulting to public literals, and the system can prove it can restore from a backup — **LetBuyy must not take real money or real merchants.** The foundation is salvageable, and much of it is even good. But today it is a beautifully engineered machine wired to the wrong half of itself.

*— Foundation Autopsy, 2026-06-09. Every conclusion above is traceable to a cited file. No assumptions; evidence only.*
