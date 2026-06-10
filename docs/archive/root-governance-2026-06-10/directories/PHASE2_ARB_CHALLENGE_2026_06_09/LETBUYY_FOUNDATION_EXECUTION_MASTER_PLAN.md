# LETBUYY — FOUNDATION EXECUTION MASTER PLAN

> The executable output of the ARB challenge. 11 workstreams (WS-0…WS-10), each with **Objectives · Tasks · Dependencies · Complexity · Risk · Rollback · Success criteria**. Grounded in `MISSED_FINDINGS.md`, `MONEY_SYSTEM_VERDICT.md`, `IDENTITY_GAP_ANALYSIS.md`, `FOUNDATION_STRENGTH_REPORT.md`, and `ARCHITECTURE_CONSISTENCY_MATRIX.md`. Complexity: S(≤1wk) M(≤1mo) L(≤1qtr) XL(>1qtr). “HUMAN” = needs a human-supplied secret/contract.

**Prime directive (non-negotiable):** never fabricate money, identity, or success. If a real integration is unavailable, **gate the feature OFF and surface honesty** — never simulate. A task is “done” only when a behavioral test proves it; grep/name-validators don’t count.

**Sequence (critical path):** WS-0 → WS-5.1 (backups) → WS-1 (money) → WS-2 (tenancy) → WS-3/WS-4 (identity/session) → WS-6 (observability) → WS-7/WS-8/WS-9 → WS-10 (scale). Money and tenancy are the existential gates; nothing downstream matters if they’re unsafe.

---

## WS-0 — TRUTH VALIDATION *(P0 · foundation for everything)*
**Objectives:** make “done” mean *proven*; stop theater from re-accreting.
**Tasks:** (a) ship an **anti-fabrication CI gate** that fails on synthesized financial identifiers (`UTR…`, `txn_…`), hardcoded `paid/released` without a provider ref + ledger post, `mock:true` runtime payloads, `SKIP_NEEDS_HUMAN` prod secrets, and `getSupabaseAdmin().from('<tenant table>')` outside the scoped layer; (b) split the 177 validators into **`gate`** (behavioral) vs **`report`** (decorative — ~46% are name-grep) lanes, only `gate` blocks CI; (c) replace the regex-only `money.test.ts` with a real ledger integration suite; (d) publish a **feature-flag truth report** (GraphQL/Extensions/Liquid are `false` in prod — `wrangler.toml:239-241`).
**Dependencies:** none (first). **Complexity:** M. **Risk:** Low (additive). **Rollback:** disable the gate.
**Success:** a planted fake UTR fails CI; money tests execute real `post_ledger_transaction`; validator lanes split; flag-truth doc published.

## WS-1 — MONEY TRUTH *(P0 · existential)*
**Objectives:** one ledger that reconciles; money cannot be faked, double-paid, or lost.
**Tasks:** (1) **balance source = canonical `ledger_entries`**, not the mutable `wallet_ledger_entries` (`wallet.ts:66-92`); add an invariant test wallet-sum ≡ ledger. (2) **Wire capture→ledger** atomically to `pa_clearing` (call the unused `buildPaymentCaptureLedgerPosting`, `payments/src/index.ts:420`). (3) **Payout release**: `FOR UPDATE` lock + **balance check** + idempotency key + state-guard so it can’t double-release (`payouts.ts:505-521`); attach **maker-checker to the live `payout_statements`** path (not the orphan `payouts` table). (4) **Replace the fabricating adapter** with a real PA (Razorpay Route/Cashfree) transfer; persist the real UTR; no creds ⇒ feature disabled, **no** wallet debit / ledger “release.” (5) **Refunds post to `refund_clearing`**; fix partial-refund state (`payments.ts:763-855`). (6) **Remove platform-fee/GST double-booking** (`payouts.ts:404-426` + `commission.ts:288-342`). (7) **Reconciliation stops auto-plugging** breaks into `reserve` (`billing-core:558,601-615`) — surface real breaks + alert. (8) **`integer`→`bigint`** money columns (`migrations/119`). (9) **Kill `mock` default**; reject in prod (`payments.ts:130`).
**Dependencies:** WS-0; **WS-5.1 backups before any money migration.** **Complexity:** XL. **Risk:** HIGH (money correctness + migrations) — mitigate with staging shadow-reconciliation and a per-merchant PA-live allowlist. **Rollback:** PA→sandbox; restore from PITR for the bigint migration; ledger changes are append-only/additive.
**Success:** capture→settle→payout lifecycle test green; an unfunded/duplicate payout is rejected by lock+balance+idempotency; refunds post to ledger; reconciliation reports a *planted* break instead of absorbing it; no money column is `integer`; mock rejected in prod.

## WS-2 — TENANT ISOLATION *(P0 · existential)*
**Objectives:** correct-by-construction tenancy; zero cross-tenant IDOR.
**Tasks:** introduce a **tenant-scoped data layer** that throws on unscoped tenant-table access; migrate hot routes first (`orders, customers, payouts, settlements, products, wallet, contacts, kyc`); ESLint-ban `getSupabaseAdmin().from('<tenant table>')` outside it; delete `USING(true)` policies; remove the static `super_admin` token (`middleware/auth.ts:216-231`); decide RLS+FORCE-real (route reads via `getSupabaseUser`) vs app-layer-fail-closed and commit to one.
**Dependencies:** WS-0. **Complexity:** L. **Risk:** MED (query breakage) — migrate incrementally with an IDOR test per resource. **Rollback:** per-route revert.
**Success:** parameterized IDOR test (tenant A → tenant B `:id` ⇒ 403/404) green for every resource; `tenantScoped` throws on unscoped access; god-token no longer authenticates.

## WS-3 — IDENTITY CONSOLIDATION *(P1)*
**Objectives:** one merchant auth path; verify-not-assert identity; one-secret-per-purpose.
**Tasks:** pick the canonical merchant path (opaque session) and remove dual GoTrue+custom acceptance (`auth.ts:411-480` vs `:1244-1268`); **replace app-supplied `X-LetBuyy-Internal-*` headers with gateway-issued signed tokens**, or at minimum **isolate + rotate** the internal secret away from cookie/OAuth/TOTP (`auth-core:447-452`); **lock the gateway perimeter** (mTLS/CF-Access/IP-allowlist) so headers can’t be injected externally (`wrangler.toml:212-215`); collapse 2 identity stores → `users_custom`; per-realm asymmetric keys + JWKS (target).
**Dependencies:** WS-0; co-plan with WS-4. **Complexity:** L. **Risk:** HIGH (auth migration) — dual-read + canary. **Rollback:** legacy verify path behind a flag during the window, then removed.
**Success:** only one credential type accepted; a forged internal header from outside the perimeter is rejected; secret-reuse grep = 0.

## WS-4 — SESSION CONSOLIDATION *(P1)*
**Objectives:** one session service; idle timeout + rotation; real revocation; bounded SSO blast radius.
**Tasks:** unify the 3 session systems behind one service; add idle timeout + rotation (+ reuse detection if refresh is introduced); standardize cookie realms; scope `lb_session` to reduce the parent-domain blast radius (`cookies.ts:58-67`).
**Dependencies:** WS-3. **Complexity:** L. **Risk:** MED — dual session validation during a grace window. **Rollback:** keep legacy validation during the window.
**Success:** idle session expires; a rotated token invalidates its predecessor; logout revokes across the realm; one session table of record.

## WS-5 — PRODUCTION SAFETY *(P0; 5.1 is the WS-1 prerequisite)*
**Objectives:** survivable + no placeholder secrets + fail-closed.
**Tasks:** **(5.1)** continuous backups + **PITR** + a **tested restore drill** (gates WS-1 migrations); **secret preflight** that hard-fails on `SKIP_NEEDS_HUMAN` (`wrangler.toml:253-262`) and gates dependent features off; **rate-limiting fail-closed** + deploy assertion the limiter is live (`rateLimit.ts:884-888`); unify `.com`/`.store`; R2/KV backup + documented RTO/RPO.
**Dependencies:** WS-0. **Complexity:** M. **Risk:** MED. **Rollback:** backup/preflight are additive; overrides audited.
**Success:** restore drill passes in staging; a deploy carrying a `SKIP_NEEDS_HUMAN` secret fails; a missing limiter secret fails the deploy; one canonical domain across build/deploy/cookies.

## WS-6 — OBSERVABILITY *(P1)*
**Objectives:** operable and debuggable in production.
**Tasks:** deploy the otel/metrics/logs/traces stack with **real datasources**; structured logging + **PII redaction** (raw `error.message`/bodies out of logs); error tracker (Sentry); alert set (error rate, payment failures, **reconciliation breaks**, queue depth, DB saturation); dashboards.
**Dependencies:** WS-5 (deploy plumbing). **Complexity:** M. **Risk:** Low. **Rollback:** additive.
**Success:** live dashboards from real api-gateway traffic; a synthetic error reaches the tracker; a planted reconciliation break fires an alert; sampled logs contain no PII.

## WS-7 — DESIGN GOVERNANCE *(P2)*
**Objectives:** one design authority, enforced in CI.
**Tasks:** wire the existing `design-system-baseline.json` ratchet as a **blocking** gate; lint-ban arbitrary `rounded-[`/`shadow-[`/`#hex` on themable surfaces; migrate `marketing-site` onto tokens (or formally exile); **generate mobile tokens**, delete the 5 hand-authored Dart color files (334 literals); converge `storefront`/`identity` theming onto the canonical provider; promote `ConsoleWorkspace`/`OpsWorkspace` to `@letbuyy/ui`; `developer-portal` tables → `<Table>`; burn down the 574 storefront inline styles against a cap.
**Dependencies:** WS-0. **Complexity:** M. **Risk:** Low. **Rollback:** per-app revert.
**Success:** CI fails on a planted hex/arbitrary radius; `generate-mobile-tokens --check` green; storefront inline-style count below the committed cap; no workspace duplication.

## WS-8 — MOBILE HARDENING *(P1 for login; P2 for the rest)*
**Objectives:** mobile usable on prod and free of embedded secrets.
**Tasks:** fix prod login (replace Turnstile placeholder); **no secrets/tokens in the Flutter bundle** (grep-gate); TLS cert-pinning to api/BFF; mobile tokens generated (with WS-7); `lb_session` in secure storage; resolve the ~10 `PlatformBlocked` domains.
**Dependencies:** WS-3 (auth), WS-7 (tokens). **Complexity:** M. **Risk:** MED — staged store release. **Rollback:** phased rollout / kill-switch.
**Success:** login works on a real device in prod; bundle grep finds no secret; pinned TLS verified; tokens generated, not hand-authored.

## WS-9 — ARCHITECTURE CLEANUP *(P1 · honors V1)*
**Objectives:** the build contains only code that runs.
**Tasks:** **quarantine** `distributed-runtime`/`projection-runtime`/`orchestration` out of `tsconfig.workspace.json:24,26` + build/deploy filters (V1 §4 ordered these dormant); quarantine the `identity-foundation` V2 once WS-3/4 confirm it’s unused; ensure the 6 reserved services are excluded from deploy; make OIDC return an honest 501 (no `mock:true`/mock-JWKS); demote name-grep validators to `report` (with WS-0).
**Dependencies:** WS-0; after WS-3/4 for identity-foundation. **Complexity:** M. **Risk:** Low (0 call-sites verified — re-grep before removal). **Rollback:** `git revert` (history preserved).
**Success:** build closure shrinks; 0 `apps/**`/`services/**` imports of quarantined packages; deploy excludes reserved services; `.well-known` returns honest “not enabled.”

## WS-10 — SCALE READINESS *(P2 — only after the foundation is safe)*
**Objectives:** 1k→10k headroom without re-architecture.
**Tasks:** use **Hyperdrive pooling** for the SQL path (currently bound-but-unused); add composite indexes (`products(site_id,status,created_at)` + hot tables); **uncap the outbox** (queue-driven or sub-minute drain — today 4,800/day); move circuit breakers from in-memory to KV/DO; KV rate-limit consistency; execute the partition cutover when V1’s P2 trigger hits; stand up the **search service**; document the Supabase read-replica/managed-PG exit.
**Dependencies:** WS-1/2/5/6 (never scale a broken/unsafe foundation). **Complexity:** L. **Risk:** MED. **Rollback:** per-change.
**Success:** a 1,000-merchant-profile load test holds; product listings are index-served; the outbox drains at order rate; no Worker connection exhaustion.

---

## Dependency graph (text)
```
WS-0 ──┬─> WS-1 (needs WS-5.1) ──> WS-10
       ├─> WS-2 ─────────────────> WS-10
       ├─> WS-3 ──> WS-4 ──> WS-8
       ├─> WS-5 (5.1 before WS-1) ─> WS-6 ──> WS-10
       ├─> WS-7
       └─> WS-9 (after WS-3/4 for identity-foundation)
```

## Quarter gates (exit criteria as board checkpoints)
- **Q1 exit (existential closed):** WS-0, WS-5.1, WS-1, WS-2 done → *a merchant can be paid truthfully and no tenant can read another’s data.* Evidence required at the board: money-reconciliation test + restore drill + IDOR test. **Unlocks ≤50-merchant controlled beta.**
- **Q2 exit (beta-shippable):** WS-3, WS-4, WS-5, WS-6, WS-8(login), WhatsApp wedge → **100–500 merchants.**
- **Q3 exit (GA-track):** WS-7, WS-9, WS-10 → **1,000 merchants;** 10k needs the deferred services + read replicas.

## What this plan deliberately does NOT do
No OIDC provider build, no app marketplace, no AI, no new product surfaces, no microservice extraction. Those are post-foundation and explicitly deferred by `LETBUYY_EXECUTABLE_ARCHITECTURE_V1`. **Build the road, not the destination.**

---
*Trajectory: composite ≈43 today → ≈70 at Q2 exit (production-trustworthy). The investment thesis is sound **only if** Q1’s money-and-tenancy work is contractually gated and verified by test evidence, not status docs.*
