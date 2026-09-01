# LETBUYY — TESTING & VALIDATION MASTER PLAN

> **Document type:** The testing and validation master plan that **gates** the wave-by-wave roadmap — the full test taxonomy (9 classes) for every migration/winner, the high-rigor suites, the CI gating, the coverage targets, and the validation-gates→wave-exit matrix. Architecture Review Board (ARB) program-lead deliverable; the companion gate to `IMPLEMENTATION_EXECUTION_ROADMAP.md`.
> **Date:** 2026-06-10
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` (working tree, evidence pinned at `stepup/main` @ `5cf9e64e`, dirty, 2026-06-10).
> **Constitution:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md`.
> **Authoritative inputs (read in full):** `PRODUCTION_READINESS_GAP_REPORT.md §5` (test-coverage reality — the honest current state), `MONEY_SYSTEM_CANONICALIZATION_PLAN.md` (the reconciliation harness + money-rigor rule + deletion-validation ladder), `TENANT_ISOLATION_CANONICALIZATION_PLAN.md §9` (the RT-1…RT-9 cross-tenant red-team suite), `THEME_MIGRATION_MASTER_PLAN.md` (render-parity + Security suite), `IDENTITY_MIGRATION_MASTER_PLAN.md` (the asymmetric-cutover contract + AUTH §12 walkthroughs), `UI_UX_UNIFICATION_MASTER_PLAN.md` (screenshot-diff + ratchet), `SAFE_DELETION_PLAN.md §2` (the deletion-validation taxonomy V-IMPORT/BUILD/TEST/GOV/SMOKE), and the forensic `LETBUYY_MASTER_EXECUTION_PLAN.md` + `TOP_250_PLATFORM_ISSUES.md`.

---

## 0. The two hard rules (non-negotiable, program-wide)

> **RULE 1 — No system is deleted until its deletion-validation is green.** Every `SAFE_DELETE` / `DELETE_AFTER_MIGRATION` is gated by a Deletion-Validation suite (V-IMPORT + V-BUILD + V-TEST + V-GOV, plus the winner-serving + zero-drift proof for bridges). A deletion that is not deletion-validation-green is a regression, not a cleanup. *(SAFE_DELETION_PLAN §1/§2; MONEY §deletion ladder.)*

> **RULE 2 — No wave exits until its validation gate is green.** Each wave names a validation gate (the suites that must pass to exit). A wave whose gate is red has not exited, regardless of how much code merged. The validation-gates→wave-exit matrix (§13) is the contract. *(Anchor spine §65–66; forensic Phases A–E entry/exit/DoD.)*

These two rules are the spine of this plan. Everything below operationalizes them.

### 0.1 The current test reality (what we are starting from — gap report §5)

The honest baseline: **the 181-validator gate is governance theater, not test coverage.** It enforces the rejected architecture (CQRS/replay/projection/saga/multi-region), references V1 zero times, and **certifies the platform green while 9 S0s ship live.** Validators are *structural lints* (file-presence, line-count, import hygiene), not behavioral tests. Real automated coverage is concentrated in exactly two kernels:

| Area | What actually exists today | Reality |
|---|---|---|
| **Money kernel** | ~20 Postgres test files (`tests/executable/money-ledger-postgres.test.mjs`, `settlement-postgres.test.mjs`, `foundation-wave1-money-postgres.test.mjs`) replay migrations against an ephemeral PG, `SET ROLE`, assert balanced/append-only/fail-closed | Med — files exist, claim PASS, **not executed in-audit** (UNVERIFIED depth); cover the *V1* paths, not the legacy paths carrying live volume |
| **Tenancy** | `security-rls-hardening-postgres.test.mjs` + `money-ledger-postgres.test.mjs:257-264` prove unset-GUC→0-rows under `executable_app_user` | Med — fail-closed proven for a non-bypass role; the **production** `service_role`-bypass path is exactly what's untested; the RT-1…9 red-team is **specified, not built** |
| **Checkout/cart** | `inventory-postgres.test.mjs` last-unit concurrency (depth UNVERIFIED); idempotency adapter tests | Med — core has tests; the cart-bound-signature + hosted-origin E2E **don't exist** |
| **Identity** | the switch S0 regression test is **untracked**; AUTH §12 walkthroughs are the *target*, **not built**; asymmetric-cutover contracts specified | Low — the single most important auth test is not in the tree |
| **Theme** | validation logic is real + tested-by-use; render-parity + Liquid Security suite **specified as Wave-6 gates, not built** | Low for the migration |
| **Storefront / Mobile / Observability** | implicit / thin / none | Low |
| **webhook/outbox** | replay-safety via provider ids; outbox claim/complete RPCs | Med happy-path; crash-between-writes + replay-window **untested** (the defects) |

**The mandate this plan enforces:** *every go-live-gating winner needs its security/concurrency suite **built**, not just its happy path.* The most urgent gaps are the switch regression test (untracked), the cross-tenant red-team suite (specified), the capture↔settlement reconciliation E2E (specified), and the Liquid Security suite (the flip gate).

---

## 1. The 9-class test taxonomy (the directive's full set)

Every migration/winner is tested across these nine classes. Each class has a fixed question it must answer.

| # | Class | What it asserts (the question) |
|---|---|---|
| 1 | **Unit** | Does each pure function / RPC / component behave correctly in isolation (logic, branches, boundaries)? |
| 2 | **Integration** | Do the wired components work together against a real dependency (ephemeral Postgres, service binding, mock provider)? |
| 3 | **Contract** | Does the cross-boundary interface hold (token claims, API payload shape, schema registry==policy coverage, BFF composite shape)? |
| 4 | **E2E** | Does the full user journey work end-to-end (signed handoff → hosted origin → confirm; capture → ledger → settlement → payout → refund → reconcile)? |
| 5 | **Security** | Does the system deny the adversary (forgery/replay/escalation; cross-tenant; XSS/SSRF/SSTI/sandbox-escape)? Positive control first, then negative. |
| 6 | **Performance** | Is the hot path within budget at envelope volume (p50/p95, round-trip count, cache-hit, no N+1)? |
| 7 | **Regression** | Does the change avoid breaking what worked (existing routes 200; a11y not regressed; reconciliation byte-identical pre/post)? |
| 8 | **Rollback Validation** | Can the change be reverted safely (DOWN migration restores; staged cutover reverts; the per-theme/per-route switch flips back)? |
| 9 | **Deletion Validation** | Is it safe to delete the thing this winner replaces (zero importers; winner serving; zero-drift)? — gated by RULE 1. |

**The rigor escalation (which winners get the heaviest suites):**
- **Money** → property-based **Σdebit=Σcredit** + concurrency (double-webhook/double-verify) + the **reconciliation harness** (book ties to provider+COD fixtures).
- **Tenancy** → the **cross-tenant red-team** (RT-1…RT-9), positive-control-first, real denial.
- **Auth** → **forgery / replay / escalation** (forge-with-public-key fails; JTI replay rejected; `user_metadata.role` escalation blocked; the AUTH §12 walkthroughs A–E all fail).
- **Theme** → **sandbox-escape + render-parity** (SSTI/XSS/sandbox as a HARD gate; screenshot/DOM-diff Liquid≡React per section).

### 1.1 Coverage targets per winner

> "Coverage target" is the *required* depth before that winner's wave exits — not a vanity line-coverage number, but the named suites that must exist and pass. **Full 9-class** = all nine classes built and green.

| Winner / domain | Coverage requirement | 9-class? |
|---|---|---|
| **Money — ledger capture/refund/COD (W-13)** | Unit (per-RPC posting) + Integration (ephemeral PG replay) + Contract (capture↔settlement) + E2E (capture→…→reconcile) + Security (mode≠live blocked; in-RPC tenant) + Performance (hot-path posting) + Regression (recon byte-identical) + Rollback (append-only reversing entry) + Deletion (legacy RPC retired on zero-drift) | **FULL 9-class** |
| **Money — PA-split payout / step-up (W-14/17)** | + Security (forged/replayed step-up; maker≠checker; payout double-release under `FOR UPDATE`) | **FULL 9-class** |
| **Money — reconciliation (W-15)** | + the reconciliation harness as the E2E gate; fault-injection (PA-success+local-fail) | **FULL 9-class** |
| **Money — bigint cutover (W-16)** | + per-row equality job (zero mismatch) + overflow test + Rollback (expand/contract DOWN) + Deletion (drop int32 after parity) | **FULL 9-class** |
| **Tenancy — RLS+GUC engage (W-08) / FORCE×261 (W-10)** | the RT-1…RT-9 red-team is the Security spine; Unit (guard) + Integration (`withTenantTx`) + Contract (registry==policy) + E2E (money/checkout under `app_tenant`) + Performance (p95 under new role) + Regression (policies never return to PUBLIC) + Rollback (staged per-route) + Deletion (PUBLIC policies) | **FULL 9-class** |
| **Auth — identity issuer + asymmetric token (W-04/05)** | Unit + Integration + Contract (cross-service token fixtures) + E2E (cross-realm session/logout) + Security (forgery/replay/escalation; AUTH §12 A–E) + Performance (verify latency) + Regression (cookie-bleed stays green) + Rollback (dual-verify; verifier-pin revert) + Deletion (shadow stack / Supabase `/auth/*`) | **FULL 9-class** |
| **Checkout — server cart + hosted origin (W-19/20)** | Unit + Integration + Contract (signed-handoff shape) + E2E (handoff→origin→confirm) + Security (forgery/oversell/mutated-cart) + Performance (checkout-step round-trips) + Regression (route smoke) + Rollback (deploy/undeploy origin; unsigned-path gate) + Deletion (client cart→thin view) | **FULL 9-class** |
| **Theme — Liquid renderer flip (W-22)** | Unit (per-section render) + Integration (engine compose) + Contract (schema parity) + E2E (editor on react|liquid) + Security (SSTI/XSS/sandbox HARD gate) + Performance (Liquid p50/p95) + Regression (parity screenshot/DOM-diff) + Rollback (per-theme `renderer.engine` switch) + Deletion (React at parity W6) | **FULL 9-class** |
| **Design-system unification (W-30)** | Unit (token snapshot) + Integration (shell adoption metric) + E2E (screenshot-diff per app) + Regression (a11y floor) + Rollback (per-app shell revert) + Deletion (hand-rolled navs) — *Contract/Security/Performance N/A or light* | **6-class (DS-appropriate)** |
| **Legacy deletion (W-37 + DEL-*)** | Deletion Validation is the whole point: V-IMPORT + V-BUILD + V-TEST + V-GOV (+ winner-serving + zero-drift for bridges) | **Deletion-class (by design)** |
| **Deploy / governance (W-00/01)** | Integration (pipeline deploys) + Contract (deploy matrix == V1 §6) + Regression (V-SMOKE) + Deletion (fiction validators) + the validator-liveness ordering (V-GOV after retarget) | **gate-class** |
| **Observability (W-35)** | Integration (alert-fires) + E2E (restore-drill executed) + Regression (redaction holds) | **gate-class** |
| **mobile-bff composites (W-29)** | Contract (composite payload shape) + E2E (one-round-trip dashboard) + Performance (vs ~7-call baseline) + Regression | **4-class (perf-focused)** |

**Winners with the full 9-class suite (the go-live-gating + ecosystem-critical set):** Money (W-13/14/15/16/17), Tenancy (W-08/10), Auth (W-04/05), Checkout (W-19/20), Theme-Liquid (W-22). The rest get the class-appropriate subset (DS = 6-class, deletion = deletion-class, deploy/observability = gate-class, BFF = perf-class). This is deliberate: the directive's rigor escalation lands on money, tenancy, auth, and theme.

---

## 2. CI gating model (what blocks merge vs what blocks deploy)

> Two gates. **Merge gate** blocks a PR from landing on the integration branch. **Deploy gate** blocks promotion `develop`→`main`→prod. The validator-liveness rule (retarget before delete) is enforced by ordering V-GOV *after* the paired validator edit.

| Gate | Blocks | Suites that must be green |
|---|---|---|
| **Merge gate (per PR)** | merge to `develop` | Unit + Contract for touched code; the relevant Security/red-team suite if the PR touches money/tenancy/auth/theme; the **isolation validator** (fails a PR adding an unscoped query); the **money single-writer / Σ-balance** lint if it touches a ledger path; stylelint + the DS ratchet (must not raise drift); `commission_bps=0` ratchet; the `letbuyy.store`-ban lint (post-Wave-3); V-BUILD. |
| **Deploy gate (`develop`→`main`→prod)** | production promotion | the full ephemeral-PG Integration suites (money + tenancy + checkout); the reconciliation harness; the cross-tenant red-team RT-1…9; the auth Security suite (AUTH §12 A–E); V-GOV (retargeted suite, post-Wave-4); V-SMOKE (route smoke + canonical-path-only); the branch-lag guard (`main..stepup/main`=0). |
| **Deletion gate (any SAFE_DELETE/DELETE_AFTER)** | the delete commit | V-IMPORT(0) + V-BUILD + V-TEST + V-GOV (after the paired validator edit); for bridges also the winner-serving V-SMOKE + the domain zero-drift proof. |
| **Wave-exit gate (ARB)** | claiming a wave is done | the wave's named validation gate (§13 matrix) — a wave is not exited until every suite in its row is green. |

**Hard CI rules:**
- The **isolation validator** must *fail the build* (not warn) and must prove the positive control first so an empty schema cannot green it (TEN §9).
- The **reconciliation harness** gates every money-path merge and is the deploy gate for the money cluster: no money system is deleted until it proves zero drift on the path it replaces (MNY money-rigor rule).
- The **Liquid Security suite** (SSTI/XSS/sandbox-escape) is a **HARD entry gate** — Liquid does not reach a real buyer until green (THEME).
- CI **bans** `*_DEV_AUTH_BYPASS=true`, secret-shaped vars in deploy config, `USING(true)`-to-PUBLIC without `TO`+predicate, and (post-Wave-3) `letbuyy.store` literals.

---

## 3. Money winner — ledger / capture / refund / COD / PA-split / reconciliation / bigint

**Strategic role:** the canonical append-only double-entry ledger is the single money source of truth; balance always derived; bigint paise; one writer; PA-split (never custody); reconcile to zero-break. *(A3; W-12…18; ISSUE-010…040.)*

| Class | What it must assert | Specific suites / files |
|---|---|---|
| **Unit** | each posting RPC debits/credits the right accounts; `ledger_account_balance_minor` derives correctly; commission=0 produces no fee leg | per-RPC unit tests around `post_ledger_transaction`, capture/refund/COD adapters |
| **Integration** | migrations replay against ephemeral PG; postings land balanced under `SET ROLE`; settlement ingest posts only when balanced | `money-ledger-postgres.test.mjs`, `settlement-postgres.test.mjs`, `foundation-wave1-money-postgres.test.mjs` — **must be executed**, not asserted by file presence |
| **Contract** | capture↔settlement amounts reconcile; `payments` row is the single payment truth; the `capture_posted_to_ledger` flag is true only with a real txn id | capture↔settlement contract fixtures; `source_order_ids` reconciliation |
| **E2E** | full chain **capture → ledger → settlement → payout → refund → reconcile** ties out | the capture↔settlement reconciliation E2E (specified, must be built) |
| **Security** | forged/replayed/wrong-actor step-up **rejected**; payout double-release blocked under `FOR UPDATE`; `mode!=live` cannot post; in-RPC tenant derivation (no GUC-from-param) | step-up forgery suite; `claim_payout_statement_release` double-release; RT-6 (GUC-from-param cross-store post) |
| **Performance** | hot-path posting within budget; no N+1 on the settlement/recon jobs | posting-latency + worker-batch metrics |
| **Regression** | reconciliation balance **byte-identical** pre/post any change; no `numeric`/`int32` on a money path post-cutover | recon byte-identical contract |
| **Rollback Validation** | a wrong adapter is corrected by a **reversing entry, never a mutation** (append-only); expand/contract migrations DOWN-restore; razorpayx→PA-split is feature-gated until live keys | reversing-entry test; expand/contract DOWN; rail feature-flag revert |
| **Deletion Validation** | no compat table / mutable column is dropped until (a) row-count parity, (b) `variance_minor=0` for every site, (c) reconciliation harness zero-drift | MNY-010/011/015; DEL-031…043/054 gates |

**The three high-rigor suites (the money gate):**
1. **Property-based Σdebit=Σcredit** — for *every* posting on *every* path, generated over randomized amounts/tenders/accounts, the transaction balances to zero. This is the invariant the whole ledger rests on.
2. **Concurrency** — a double-submitted capture/refund/payout (double-webhook, double-verify, double-settle) produces **exactly one** effect; last-unit and `FOR UPDATE` contention proven.
3. **The reconciliation harness** — replay PSP + COD remittance fixtures and assert the book ties to provider reality: **zero break or aged-and-explained suspense**; wallet GET returns `verified` zero-variance for a fully-ledgered store; a fault-injected PA-success+local-fail resolves to suspense/break (never strands). **This harness is the deploy gate for the money cluster and the deletion gate for every legacy money path.**

**Coverage target:** FULL 9-class. **CI gating:** the Σ-balance + concurrency suites are merge-gate for any ledger-touching PR; the reconciliation harness is the money-cluster deploy gate; the overflow + per-row-equality jobs gate the bigint contract step.

---

## 4. Tenancy winner — RLS + GUC engagement + FORCE×261

**Strategic role:** three-layer fail-closed (app-guard + ownership + RLS ENABLE+FORCE+per-tx GUC) on all 261 tables; gateway off blanket `service_role`. *(A2; W-08/09/10/11; FND-001…027.)*

| Class | What it must assert | Specific suites |
|---|---|---|
| **Unit** | the L1 query-lint guard rejects a registered-table query lacking a tenant predicate; ownership resolution proves the `site_id` *value* | `tenant-scoped.ts` guard unit tests |
| **Integration** | `withTenantTx(siteId, fn)` sets `SET LOCAL app.site_id` and rows are scoped; the worker client is wrapped | ephemeral-PG `withTenantTx` integration |
| **Contract** | the table registry == the policy coverage == the guard coverage (no table is scoped by one layer but not another) | registry==policy + registry==guard contract tests |
| **E2E** | money/checkout flows run green under the new `app_tenant` role (the production-shaped, non-bypass role) | E2E under `app_tenant` |
| **Security** | the **cross-tenant red-team RT-1…RT-9** (the spine — see below) | `tests/security/cross-tenant-redteam-postgres.test.mjs` |
| **Performance** | p95 read/write within budget under the pooled transactional connection | p95 under `withTenantTx` |
| **Regression** | the PUBLIC policies **never return**; no raw `service_role` client on a tenant route | policy-lint + raw-client CI assertion |
| **Rollback Validation** | the `service_role`→GUC cutover is staged with a per-route fallback; FORCE added table-by-table fails **closed** (surfaces, never silently leaks); DOWN restores dropped objects | staged-cutover revert; per-table fail-closed |
| **Deletion Validation** | the 6 PUBLIC policies are deleted, validated by RT-1 returning 0 rows/denied + `\dp` showing `{service_role}` not `{public}` | DEL gate on the PUBLIC policies |

**The cross-tenant red-team suite (the tenancy gate — TEN §9.2):** a standing CI job (`tests/security/cross-tenant-redteam-postgres.test.mjs`) seeds **two tenants A and B** in an ephemeral PG with the full migration chain, proves the **positive** (A sees A's row) first so an empty DB cannot green it, then proves the **negative** for every attack class:

| ID | Attack | Asserts | Anchor |
|---|---|---|---|
| **RT-1** | Anon PostgREST probe (orders/customers/sites/subscriptions/billing; `POST super_admin_allowlist`; `PATCH sites`) | **0 rows / denied** everywhere | FND-001…006 |
| **RT-2** | Forged `site_id`/`store_id` (right column, wrong value) | RLS returns **0 rows** despite the predicate (proves L3 load-bearing) | FND-012 |
| **RT-3** | Missing-predicate query on a registered table | L1 guard **rejects** AND L3 returns 0 | FND-013 |
| **RT-4** | Worker payload forgery (`site_id=B` while the row is A's) | worker **asserts payload vs FK → refuses**; GUC-scoped write fails closed | FND-010 |
| **RT-5** | `service_role` escape-hatch abuse | no raw service client on tenant routes; every `withServiceRole` call audited | FND-015 |
| **RT-6** | GUC-from-param cross-store post (`post_settlement_ledger_transaction(p_site_id=B)`) | **denied** once the RPC derives site from the principal | DB-011 |
| **RT-7** | Unset GUC → zero rows (the fail-closed invariant) | **0 rows** every time under `app_tenant` | `money-ledger-postgres.test.mjs:257-264` |
| **RT-8** | Non-registry / misclassified table | default-deny (unknown tables guarded, not passed through) | FND-013/024 |
| **RT-9** | Ownership-column confusion (`.eq('user_id', x)`) | not accepted as a *tenant* predicate; requires `site_id` | FND-023 |

**Permanence:** RT-1, RT-2, RT-7 must *never* be removed or weakened — they are the load-bearing assertions that the layered stack denies. The suite **fails the build** (not warn).

**Coverage target:** FULL 9-class. **CI gating:** RT-1/2/7 are merge-gate for any isolation-touching PR; the full RT-1…9 + the registry==policy contract is the tenancy deploy gate; a live anon-key probe confirms closure before final S0 sign-off.

---

## 5. Auth winner — identity issuer + asymmetric token cutover

**Strategic role:** identity-platform as the sole asymmetric token issuer for all 3 realms; all others verify-only; per-audience claims. *(A1; W-04/05; AUTH-001…025; ISSUE-001/027.)*

| Class | What it must assert | Specific suites |
|---|---|---|
| **Unit** | OTP single-use; bcrypt-12; session rotation/reuse-detection; claim→GUC mapping | per-flow unit tests |
| **Integration** | login/OTP/reset route through identity-platform; sessions/cookies/logout unified | identity-platform integration |
| **Contract** | the cross-service token contract holds across identity-platform + api-gateway + webhook-service + platform-console + auth-core (the only cross-service contract change in identity) | sign/verify cross-service fixtures |
| **E2E** | cross-realm session/logout; MFA enroll→login→recovery | cross-realm E2E |
| **Security** | **forgery / replay / escalation** — the heavy suite (below) | the AUTH §12 walkthroughs A–E (the target security suite, must be built) |
| **Performance** | verify latency under the public-key path | verify-latency metric |
| **Regression** | the cross-realm cookie-bleed test stays green; the `aud`-pinning test green | cookie-bleed + aud-pinning |
| **Rollback Validation** | dual-verify: D0/D1/D2 revert is a config change with no token invalidation; **D3 rollback = re-widen the verifier (revert the pin), never revert the issuer**; rollback drill mandatory before D3 | dual-verify revert drill |
| **Deletion Validation** | the identity-foundation shadow stack / Supabase `/auth/*` / second reset pipeline deleted once identity-platform serves (V-SMOKE) | DEL-024…030 gate |

**The forgery/replay/escalation suite (the auth gate):**
- **Forgery:** sign a high-value token, then **forge-with-public-key must FAIL**; alg-pinning rejects `none` and (post-D3) HS256; SSTI/forgery negatives on the OIDC surface.
- **Replay:** a replayed JTI is rejected by a **durable** replay cache (today a per-isolate `Map` — AUTH-021); an old-body webhook is rejected by the timestamp window.
- **Escalation:** `user_metadata.role` cannot escalate (role only from `app_metadata`/DB); the anon `super_admin_allowlist` self-grant is blocked; the `/api/auth/switch` takeover returns 401 without a valid session + `lb_accounts` membership (the untracked `auth-switch-guard.test.ts` must land); the `/lookup` enumeration oracle is closed.
- **The dual-verify drain gate:** telemetry shows **zero** legacy-HS256 verifications before D3 (the drop gate) — this is a *data* gate, not just a test.

**Coverage target:** FULL 9-class. **CI gating:** the switch regression + escalation suite is merge-gate; the AUTH §12 A–E + the cross-service token contract is the auth deploy gate; D3 (drop HS256) is gated on the zero-legacy-verification telemetry.

---

## 6. Checkout winner — server cart + hosted origin + signed handoff + inventory

**Strategic role:** hosted `checkout.letbuyy.com` origin + server-authoritative checkout-session state machine + cart-bound signed handoff; one reserve→commit inventory path. *(A4; W-19/20/21; CHK-001…024.)*

| Class | What it must assert | Specific suites |
|---|---|---|
| **Unit** | the checkout-session state machine is forward-only; server-priced lines (no client price); discount `combines_with` matrix | state-machine + pricing unit tests |
| **Integration** | the order RPC creates orders only via `create_checkout_order`; reserve→commit row-locks | `inventory-postgres.test.mjs` (last-unit; depth must be raised) |
| **Contract** | the signed-handoff shape; the signature binds a hash of (sorted lines + coupons + subtotal_minor) | signed-handoff contract |
| **E2E** | **signed handoff → hosted origin → confirm** (the journey that does not exist today) | hosted-origin E2E (must be built) |
| **Security** | order forgery blocked (RPC reads DB price); oversell closed under `FOR UPDATE`; the signed URL **rejects a mutated cart**; public order-create rejects an unsigned request; no third-party code in the live checkout route | forgery + mutated-cart + unsigned-request suite |
| **Performance** | checkout-step round-trip tax within budget | checkout round-trip metric |
| **Regression** | store-route smoke (`/`, `/shop`, `/product/[id]`, `/store/[subdomain]`, `checkout.letbuyy.com/checkout`) stays 200 | route smoke |
| **Rollback Validation** | the hosted origin is greenfield (deploy/undeploy, no migration revert); the cart-bind is additive (old unsigned path gated off, revertible); the sweeper is a pausable job | origin deploy/undeploy; unsigned-path gate revert |
| **Deletion Validation** | the client React cart → thin view; the direct-decrement side doors; the Wasm checkout-extensions runtime (DEAD-now) — each gated on its winner serving | DEL gate on cart/side-doors |

**Coverage target:** FULL 9-class. **CI gating:** the forgery + oversell + mutated-cart suite is merge-gate; the hosted-origin E2E is the checkout deploy gate.

---

## 7. Theme winner — Liquid renderer + sandbox + render-parity

**Strategic role:** Liquid / portable-theme (OS-2.0) renderer as the ecosystem winner; React frozen (not deleted for completeness) until W6 by data. *(A5; W-22/23/24; THEME DEC-1…10.)*

| Class | What it must assert | Specific suites |
|---|---|---|
| **Unit** | per-section render correctness; `{% schema %}` parity per section | per-section render unit tests |
| **Integration** | the engine `composeStorefrontTheme` is the one compose path; one `ThemeRenderer` interface | engine compose integration |
| **Contract** | one generated schema source (engine `BUILT_IN_SECTION_SCHEMAS`); storefront + DB schema generated from it | golden-schema snapshot + parity CI gate |
| **E2E** | the editor runs **identically** on `renderer.engine=react|liquid`; draft→patch→publish→rollback round-trip | editor E2E on both engines |
| **Security** | **SSTI / XSS / sandbox-escape** — the HARD gate (below) | the Liquid Security suite (must be built; the flip gate) |
| **Performance** | Liquid p50/p95 within budget — the data that decides the React delete-or-freeze | Liquid render-latency |
| **Regression** | render-parity (screenshot/DOM-diff **Liquid≡React per section**); de-silenced schema-degradation warnings | screenshot/DOM-diff harness |
| **Rollback Validation** | the per-theme `renderer.engine` switch **IS** the rollback (flip any theme back to React instantly); the canary contains blast radius to one store | per-theme switch flip test |
| **Deletion Validation** | the React renderer is **FROZEN, not deleted** in early waves; DELETE_AFTER at W6 only with the full suite green per-section, else frozen; storefront schema/compose forks + `theme_editor_drafts` delete at W4–6 once the engine serves | DEL-045…047 gate |

**The sandbox-escape + render-parity suites (the theme gate):**
1. **Security suite (HARD gate)** — SSTI (template-injection in section settings), stored XSS (rendered theme HTML), sandbox-escape (the data-only sandbox: `ownPropertyOnly`, drop scrub, parse/render/memory limits, upload-time `{% render %}` forbidding). **Liquid does not reach a real buyer until this is green.** The regex output-sanitizer is replaced by DOMPurify/allowlist *as the entry gate*.
2. **Render-parity harness** — screenshot + DOM-diff, Liquid≡React per section within tolerance; gates each section port; the canary store renders identically before any cohort flip.

**Coverage target:** FULL 9-class. **CI gating:** the Security suite is a HARD gate (blocks any Liquid traffic); the render-parity harness gates each section; the schema-parity CI gate blocks a schema-source divergence.

---

## 8. Storefront, Merchant-OS / Mobile, Design-system

**Storefront runtime (W-26).** Regression: store-route smoke stays 200 after the `runtime-composition` unwire and the Liquid hosting. Contract: zero importers of `runtime-composition` after unwire (V-IMPORT). Security: the stored-XSS pair on the storefront (ISSUE-016/017) is gated under the Wave-0 security cluster. Performance: cache hit-rate + storefront p95. *(A6; TOPO-005.)*

**Merchant-OS + Mobile (W-27/28/29/31).** Contract: the `mobile-bff` composite payload shape; E2E: one-round-trip dashboard vs the ~7-call baseline (PERF-001/002). Security: the honesty badge renders `mock/sandbox/live` truthfully and the validator **fires** if a money screen lacks it (W-31). Regression: `flutter analyze` green after the TD-5 parity-catalog deletion; signed release artifact builds (debug-keystore is a release blocker). Rollback: per-app shell revert; the token-bridge re-point reverts to `AppColors`. *(A7; MOB-001…022.)*

**Design-system unification (W-30) — 6-class (DS-appropriate).** Unit: token snapshot. Integration: shell-adoption count → 9/9 asserted by a new validator metric. E2E: screenshot-diff per migrated app (storefront per-store theming intact; editor undo/redo/device-preview intact). Regression: **no migration regresses accessibility** (the floor); dark-mode reachable. Rollback: per-app layout revert. Deletion: each hand-rolled nav deleted only after its layout renders `AppNavigation` and screenshot-diff passes. **The ratchet must BLOCK new drift (fail the PR), not baseline it** — this is the behavioral change the DS suite enforces. *(A8; UIUX-001…033.)*

| Winner | Coverage target | Notes |
|---|---|---|
| Storefront (W-26) | Regression + Contract (V-IMPORT) + Security (XSS pair) + Performance | XSS gated in Wave 0 |
| Merchant-OS / Mobile (W-27/28/29/31) | Contract + E2E + Security (badge) + Regression + Rollback | release-sign is a build gate |
| Design-system (W-30) | 6-class (Unit/Integration/E2E/Regression/Rollback/Deletion) | ratchet BLOCKS drift |

---

## 9. Deploy / governance winner — pipeline, validators, domain

**Strategic role:** a pipeline that deploys the integration branch to the V1 8-runtime topology; a validator suite that enforces V1; one generated AGENTS.md. *(A0; W-00/01/02/03; TOPO-001…041.)*

| Class | What it must assert | Specific gate |
|---|---|---|
| **Integration** | the pipeline deploys remediation to staging+prod from `main`; CI replays 000→161 + runs `verification/*.sql` | V-DEPLOY |
| **Contract** | the deploy matrix **equals** the V1 §6 production list; reserved services marked `reserved` not `production` | deploy↔V1-topology contract |
| **Regression** | `node scripts/validate-governance.mjs` passes the **retargeted** suite (**V-GOV — run AFTER the validator edit, never before** — the validator-liveness loop); a `letbuyy.store` literal fails CI; `commission_bps=0` ratchet | V-GOV + the new validators |
| **Rollback Validation** | standard Cloudflare/Vercel previous-deployment rollback; the governance retarget is additive-then-subtractive (retarget *before* deleting the asserted code); the domain migration is a single PR with `.store` 301s as the fallback | deploy rollback + 301 fallback |
| **Deletion Validation** | the ~36 fiction validators deleted **with** the dead packages they assert; the duplicate staging workflow; k8s/Helm + Firebase archived | V-GOV after retarget |
| **Smoke (V-SMOKE)** | waves 0–7 code is live; the canonical paths (server cart / canonical ledger / identity issuer) carry traffic | V-SMOKE |

**The branch-lag guard:** `git rev-list --count main..stepup/main` **= 0** is a CI assertion so the meta-blocker can never silently re-accumulate. **The validator-liveness loop** is the single most error-prone ordering: V-GOV must run *after* the paired validator edit — deleting a dead package before retargeting its asserting validator fails CI.

**Coverage target:** gate-class (Integration/Contract/Regression/Rollback/Deletion/Smoke). **CI gating:** the branch-lag guard + V-SMOKE are the deploy gate; V-GOV is the deletion gate for governance/packages.

---

## 10. Observability winner — logs / alerting / restore drill / tracing

**Strategic role:** structured logs + PII redaction, audit relay (atomic), alerting, tracing, **backups + a tested restore drill** (the V1 P0 hole). *(X-cut; W-35; ARCH-035/037; SEC-017/A09.)*

| Class | What it must assert | Specific gate |
|---|---|---|
| **Integration** | a security/abuse event **fires an alert** + ingress-blocks clear-cut payloads (today `console.warn`'d only); the audit dual-write is atomic (same defect as the outbox) | alert-fires test |
| **E2E** | the restore drill is **executed** against a staging fixture with recorded evidence; PITR activated (`SKIP-W0-PITR-TIER` removed) | restore-drill evidence |
| **Regression** | `replayable-secret-redaction` holds across all services; `debugPrint` does not surface error bodies (AUTH-025) | redaction regression |
| **Performance / monitoring** | distributed trace IDs span BFF→gateway→PostgREST; hot-path latency/cache-hit surfaced; `pa_clearing` drift / `variance≠0` / stranded-payout / stale-reservation monitors alert | tracing + money-drift monitors |

**The decisive gaps (gap report §4, ranked):** (1) no tested restore drill / PITR off — a single-region money platform with unproven recovery (a V1 P0; the beta gate); (2) no alerting on security/abuse events; (3) no money-correctness monitoring (the honesty gates exist but nothing runs or alerts on them); (4) non-atomic audit relay; (5) no distributed tracing. **Coverage target:** gate-class. **CI/wave gating:** the restore-drill evidence + the alert-fires test are the Wave-7 beta-gate items.

---

## 11. Legacy deletion — the Deletion-Validation taxonomy

**Strategic role:** SAFE_DELETE the dead packages, DELETE_AFTER_MIGRATION the bridges, drop orphan tables — each gated by RULE 1. *(W-37 + DEL-001…062; SAFE_DELETION §2.)*

**The deletion-validation taxonomy (every deletion is gated by a subset):**

| Gate | Name | Asserts | Command |
|---|---|---|---|
| **V-IMPORT** | Zero importers | no app/service imports the thing being deleted | `grep @letbuyy/<pkg>` = 0; workspace + tsconfig references removed |
| **V-BUILD** | Build green | the workspace still typechecks + builds after removal | `pnpm turbo build` (or scoped); `flutter analyze` |
| **V-TEST** | Test-suite green | unit/contract/behavioral suites still pass | `pnpm test` / `ci.yml` merge-safety-gate; `flutter test` |
| **V-GOV** | Governance green (after retarget) | `validate-governance.mjs` passes once the asserting validators are removed/retargeted — **run AFTER the paired validator edit, never before** | `node scripts/validate-governance.mjs` |
| **V-SMOKE** | Winner serving | the replacement winner serves live before the bridge is deleted | route/flow smoke |
| **Zero-drift** | Domain proof | money: reconciliation harness zero-drift + row-count parity + `variance_minor=0`; identity: sole-issuer; theme: engine; tables: `pg_stat_user_tables` zero recent writes | per-domain |

**The ordered deletion gates (SAFE_DELETION §3, mapped to roadmap waves):**

| Roadmap wave | Deletion batch | DEL blocks | Gate to enter |
|---|---|---|---|
| **Wave 0** | Deploy/security unblock | DEL-0, 028, 067, 069a | none (prerequisite) |
| **Wave 5 (SAFE_DELETE)** | zero-importer packages | DEL-001…006, 009, 073 | Wave 4 done; `pnpm turbo build` green; V-IMPORT(0) |
| **Wave 5 (gov/infra/doc)** | fiction validators + archive | DEL-063…078, 007, 077 | Wave-4 retarget (validators cut so V-GOV passes) |
| **Wave 5 (runtime-composition)** | unwire+delete | DEL-008 | A6 query-layer moved; V-IMPORT(0) post-unwire |
| **Wave 5 (identity)** | legacy auth | DEL-024…030, 053, 068 | A1 sole-issuer live (V-SMOKE) |
| **Wave 5 (money)** | legacy money paths | DEL-031…043, 054 | A3 canonical ledger + PA-split live & smoked; **zero-drift** |
| **Wave 5 (theme)** | schema/compose forks | DEL-045…047 | A5 engine serves; React stays FROZEN |
| **Wave 5 (schema canon)** | orphan tables + dup index | DEL-050…062, 034…038 | schema-canon migrations live; `pg_stat` zero-write |

**The hard rule, restated:** **no system is deleted until its deletion-validation is green.** A `DELETE_AFTER_MIGRATION` block that has not proven (winner-serving + zero-drift) is blocked at the deletion gate. **Coverage target:** deletion-class (V-IMPORT + V-BUILD + V-TEST + V-GOV + V-SMOKE + zero-drift as applicable).

---

## 12. Per-winner validation summary (the 9-class matrix at a glance)

> ✓ = required and built for that winner's wave exit · ◐ = class-appropriate subset / light · — = N/A. Money/Tenancy/Auth/Checkout/Theme are the **full-9-class** winners (the directive's rigor escalation).

| Winner (wave) | Unit | Integ | Contract | E2E | Security | Perf | Regress | Rollback | Deletion |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Money capture/refund/COD (W1)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Money PA-split/step-up (W1)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Money reconciliation (W2)** | ✓ | ✓ | ✓ | ✓ (harness) | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Money bigint cutover (W6)** | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ |
| **Tenancy RLS+GUC / FORCE×261 (W1/W2)** | ✓ | ✓ | ✓ | ✓ | ✓ (RT-1…9) | ✓ | ✓ | ✓ | ✓ |
| **Auth issuer + asymmetric token (W1/W2)** | ✓ | ✓ | ✓ | ✓ | ✓ (forge/replay/escalate) | ✓ | ✓ | ✓ | ✓ |
| **Checkout cart + hosted origin (W2)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Theme Liquid renderer (W6)** | ✓ | ✓ | ✓ | ✓ | ✓ (SSTI/sandbox + parity) | ✓ | ✓ | ✓ | ✓ |
| **Design-system (W6)** | ✓ | ✓ | — | ✓ | — | ◐ | ✓ | ✓ | ✓ |
| **Storefront (W5/W6)** | ◐ | ✓ | ✓ (V-IMPORT) | — | ✓ (XSS) | ✓ | ✓ | ✓ | ✓ |
| **mobile-bff composites (W2)** | ◐ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ◐ | — |
| **Deploy/governance (W0/W4)** | — | ✓ | ✓ | — | — | — | ✓ (V-GOV) | ✓ | ✓ |
| **Observability (W6/W7)** | — | ✓ | — | ✓ (restore) | ◐ | ✓ | ✓ | — | — |
| **DPDP consent/DSR (W7)** | ✓ | ✓ | ✓ | ✓ | ✓ (fail-closed) | — | ✓ | ◐ | — |
| **Legacy deletion (W5)** | — | — | — | — | — | — | ✓ | ✓ | ✓ (the point) |

---

## 13. Validation gates → wave exit matrix (RULE 2 made concrete)

> A wave **does not exit** until every suite in its row is green. This is the contract that gates the roadmap.

| Wave | Exit gate (the suites that must be green to exit) |
|---|---|
| **0 — Decisions + Stabilization** | V-DEPLOY (`main..stepup/main`=0; pipeline ships) · V-SMOKE (waves-0 code live) · the switch 401-without-session test · **RT-1** anon probe + live `\dp` probe · stored-XSS suite · SSRF suite · `commission_bps=0` ratchet · CI policy-lint (no `USING(true)`-to-PUBLIC) |
| **1 — Winner Foundations** | **RT-2/RT-7** under `app_tenant` (forged→0, unset-GUC→0) · money **Σdebit=Σcredit** property + concurrency suite · capture posts balanced + idempotent-replay · step-up forgery rejected + double-release blocked · token dual-verify (forge-with-pubkey fails; aud-pinning) · outbox crash-loses-no-event + compensation auto-refund |
| **2 — Winner Completion** | **the reconciliation harness** (zero-break-or-suspense; wallet `verified`; fault-injection resolves) · **RT-1…RT-9** full red-team ×261 · AUTH §12 A–E all fail + zero-HS256-verify-pre-D3 · checkout E2E (signed-handoff→origin→confirm; mutated-cart rejected) · mobile composite one-round-trip + honesty-badge validator · GST place-of-supply + immutable invoice · Shiprocket AWB round-trip |
| **3 — Traffic Migration** | `letbuyy.store`-ban CI · route smoke 200 (incl. `checkout.letbuyy.com`) · `.store`→`.com` 301s · V-SMOKE canonical-path-only (server cart / canonical ledger / identity issuer) · no cross-app cookie reuse · parity-harness baseline captured |
| **4 — Legacy Freeze** | **V-GOV** on the retargeted suite (references V1; no CQRS/saga mandate) · deploy matrix == V1 §6 · reserved=`reserved` · CI-ban on new work on losers · AGENTS = map of V1 · V-SMOKE (no regression post-freeze) |
| **5 — Legacy Removal** | for every code deletion: **V-IMPORT(0) + V-BUILD + V-TEST + V-GOV** · for bridges: winner-serving V-SMOKE + domain **zero-drift** (recon harness for money; sole-issuer for identity; engine for theme) · for tables: `pg_stat` zero-write + paired rollback |
| **6 — Hardening** | Liquid **render-parity** (screenshot/DOM-diff) + the **Security suite HARD gate** (SSTI/XSS/sandbox) + Liquid p50/p95 in budget · dashboards within target + no worker N+1 + `EXPLAIN`-verified indexes · the DS ratchet **fails** a new-drift PR + shell 9/9 + dark-mode reachable + a11y floor · alert-fires + atomic audit + tracing |
| **7 — Production Readiness (BETA GATE)** | restore drill **executed** + evidence + PITR active · money+security monitors dashboarded · load target met + full Security regression + chaos recovers (PA-success+local-fail, double-webhook, crash-between-writes, region-loss) · DSR export+erasure E2E + withdrawn-consent blocks send · **beta-gate checklist signed (0 open S0/S1)** |
| **8 — Shopify-Class (deferred)** | OIDC conformance + rotating JWKS · passkey + MFA enroll/login/recovery · full theme suite green across the seeded catalog + React delete-or-freeze decision recorded with perf evidence · WhatsApp broadcasts consent-gated + reseller posts canonical |

---

## 14. Test infrastructure & how the suites run

- **Ephemeral Postgres harness (the backbone).** The money, tenancy, and inventory suites replay the full migration chain (000→161) against an ephemeral PG container, `SET ROLE` to the production-shaped role (`app_tenant` / `executable_app_user`), and assert behavioral invariants. This is the single most important harness — it is what makes "RLS is load-bearing" and "the ledger balances" *behaviorally* provable rather than asserted by file presence. **The audit's open item is that these were not executed in-audit; Wave 1/2 must run them in CI**, not trust the file presence.
- **The reconciliation harness** replays PSP + COD remittance fixtures and ties the book to provider reality — the money deploy gate and the deletion gate for every legacy money path.
- **The cross-tenant red-team** (`tests/security/cross-tenant-redteam-postgres.test.mjs`) seeds two tenants, proves the positive control, then proves denial for RT-1…RT-9 — failing the build on any leak.
- **The render-parity harness** (screenshot + DOM-diff) and the **Liquid Security suite** are the theme-flip gates; the per-theme `renderer.engine` switch is both the canary control and the rollback.
- **Screenshot-diff per app** + the **DS ratchet** (stylelint wired to CI, auto-lowering 10%/release) gate the design-system migration; the ratchet must BLOCK new drift, not baseline it.
- **Contract fixtures** pin the cross-service token contract, the BFF composite shape, the signed-handoff shape, and registry==policy==guard coverage.
- **The deletion gates** (V-IMPORT/BUILD/TEST/GOV/SMOKE + zero-drift) run on the delete commit; the live anon-key probe and the `pg_stat` write-count probe are the two **live** (not tree) checks that gate final sign-off.

---

## 15. UNVERIFIED (testing-specific — carried forward, never silently upgraded)

1. **Money-kernel test depth** — the ~20 Postgres test files exist and claim PASS but were **not executed in-audit**; their property/concurrency rigor is asserted by file presence. *Required:* execute them in CI (Wave 1/2) before trusting the money gate.
2. **The RT-1…RT-9 red-team is specified, not built** — `cross-tenant-redteam-postgres.test.mjs` is the target file; it must be authored and made build-failing (Wave 1/2).
3. **The switch regression test is untracked** — `auth-switch-guard.test.ts` exists only in the dirty tree; it must land in Wave 0.
4. **The render-parity + Liquid Security harnesses are specified as Wave-6 gates, not built** — they gate the flip; they do not exist yet.
5. **Live anon-GRANT state** — the 6 anon RLS-to-PUBLIC GRANTs are set by Supabase's managed bootstrap; the RT-1 *test* proves the policy, but a **live anon-key probe** (`\dp public.orders`) is required before final S0 sign-off.
6. **Live-DB writers for the ~37 product-dead tables** — `pg_stat_user_tables` write-count is the live gate before any DROP; cannot be confirmed code-only.
7. **Performance figures** are code-estimated, not measured — the Wave-6 tracing/metrics make them real; no perf suite can pass on estimates.
8. **`pnpm turbo build` green baseline** across the workspaces is assumed by the deletion V-BUILD gate but was not executed in-audit (runtime > sandbox timeout).
9. **Restore-drill evidence** does not exist — the drill is staged (`SKIP-W0-PITR-TIER`) but never executed; the Wave-7 beta gate requires the executed evidence.

*End of Testing & Validation Master Plan. The two hard rules — no system deleted until deletion-validation green, no wave exits until its validation gate green — are the spine. The 9-class taxonomy, the high-rigor suites (money Σ-balance + concurrency + reconciliation harness; tenancy RT-1…9; auth forgery/replay/escalation; theme sandbox-escape + render-parity), the CI gating, the coverage targets, and the validation-gates→wave-exit matrix operationalize them. No repo code was modified. Companion: `IMPLEMENTATION_EXECUTION_ROADMAP.md`.*
