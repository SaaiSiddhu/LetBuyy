# LETBUYY VALIDATOR COVERAGE MATRIX — Phase 7 of the Governance Hardening Program

> **Document type:** ARB governance-auditor analysis. Maps every load-bearing governance rule to its machine-enforcement status (ENFORCED / ENFORCEABLE-BUT-UNWIRED / UNENFORCEABLE) and **recommends** the validators needed to close the gap. This document **recommends, it does not implement** — no validator code is written here, no architecture is changed.
>
> **Date:** 2026-06-10 · **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · evidence pinned at `stepup/main` @ `5cf9e64e`.
>
> **Authority position:** Subordinate to the Constitution (DOC 01), `LETBUYY_AGENTS_V2.md` (DOC 02), and the canonical-systems registry (DOC 03). This is an evidence/recommendation artifact (authority tier 6 — the "why," not law). It does not declare topology or amend any rule.
>
> **One-line verdict:** **The canonical Constitution is almost entirely unenforced. Of the load-bearing canonical rules, only ~8–10% are machine-enforced by a correctly-targeted validator today; ~47% of the 187-file validator suite is governance theater that certifies the *rejected* architecture; and the single most dangerous money/identity/tenancy invariants (ledger-only, commission=0, sole-issuer, no-USING(true), provider honesty) have ZERO enforcement.** The gate is not just incomplete — it is pointed at the wrong target, and two foundational validators (`architecture-validator`, `governance-common`) actively *block* the canonical decisions by requiring the rejected packages to exist.

---

## 1. Methodology

1. **Rule corpus.** Extracted every MUST / MUST-NOT rule from:
   - `LETBUYY_CONSTITUTION.md` §13 — the **23 Constitutional Rules (R-1…R-23)** plus the 24 Articles (ART-01…ART-24) and Never-Build List (§10).
   - `LETBUYY_AGENTS_V2.md` — the **~150 numbered rules** across 16 sections (`ARCH-Rn`, `SEC-Rn`, `PAY-Rn`, `IDN-Rn`, `THEME-Rn`, `WIN-Rn`, `MIG-Rn`, `DEL-Rn`, `UI-Rn`, `DOC-Rn`, `DEPLOY-Rn`, `ANTI-Rn`, `AGENT-Rn`, `NEVER-Rn`, …), including the rules the author already tagged `[validator-gap]`.
   - `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03) §2 master registry + Rule C1 (**one system per domain**).
   This matrix focuses on the **load-bearing** subset (money/security/tenancy/identity/topology/theme/governance-integrity rules) the directive names. Pure behavioral/style rules (e.g. CODE-R5 console.log, UI-R3 dark-mode reachability) are noted where a structural lint is feasible but are not the priority.

2. **Validator inventory (the real `scripts/validators/` dir).** I listed and read the actual directory: **187 `.mjs` files** under `scripts/validators/`. I read the gate runner `scripts/validate-governance.mjs` (the `--lane=gate` array runs **187 validators** in sequence), the `package.json` validate scripts, and the two CI workflows that wire them (`.github/workflows/architecture-governance.yml`, `ci.yml`). I read the source of the canonical-safety validators (`tenant-isolation`, `session-security`, `single-writer-ownership`, `single-source-crypto`, `domain-boundary`, `theme-governance`, `production-safety`, `foundation-antifabrication-gate`, `foundation-sql-policy-residue`, `architecture-validator`, `migration-safety`, `runtime-manifest`) and the shared `governance-common.mjs` canonical-root tables.

3. **Coverage classification.** Each rule is graded:
   - **ENFORCED** — a real validator, correctly targeted, wired into the gate, that fails on a true violation.
   - **PARTIAL** — a validator covers a slice of the rule but leaves the load-bearing case open (e.g. checks the `AUTH_SECRET` fallback but not "no token signing outside identity-platform").
   - **ENFORCEABLE-BUT-UNWIRED / MISTARGETED** — a validator exists but enforces the *wrong* thing (the rejected architecture), or asserts the **inverse** of the canonical rule (e.g. requires `letbuyy.store`).
   - **UNENFORCEABLE (ZERO)** — no validator; the rule relies on agent goodwill. This is the `[validator-gap]` set plus everything the rewrite added that was never wired.

4. **Grep evidence.** Coverage calls are backed by `grep` over `scripts/validators/*.mjs`. A "(NONE)" result for a load-bearing token (`commission_bps`, `ledger_account_balance`, `ProviderModeBadge`, `RUNTIME_SECTION_SCHEMAS`, `SignJWT`, `razorpayx`, branch-lag `rev-list`) is treated as ZERO enforcement.

**Caveat.** This is a static read of the validator *source* and the gate wiring on the Linux mount. It establishes what each validator *asserts*, not whether CI is currently green. Behavioral coverage (the ephemeral-Postgres RT-1…9, the reconciliation harness) is **specified-not-built** per `TEST-R10` and is out of scope for a structural-lint coverage matrix.

---

## 2. Executive verdict

### 2.1 The headline number

The validator suite is **large, busy, and pointed at a platform LetBuyy explicitly rejected.**

| Metric | Value |
|---|---|
| Total validator files (`scripts/validators/*.mjs`) | **187** |
| Validators run in the `gate` lane (`validate-governance.mjs`) | **187** (plus theater-only lanes in `architecture-governance.yml`) |
| Validators that are **governance theater** (assert the rejected end-state: replay / projection / saga / CRDT / failover / WAL / lease / multi-region / distributed-* / durable-execution / recovery-drill / convergence / chaos / operational-certification) | **~87 by name pattern; ~70–88 net after de-duping helpers** — call it **~36–88 dead, with a hard core of ~70 pure-fiction** |
| Validators that enforce a **real canonical invariant** correctly | **~12** (tenant-isolation, session-security parts, single-writer-ownership, single-source-crypto, foundation-antifabrication-gate, foundation-sql-policy-residue, dev-auth-bypass, committed-secret-placeholder, the 5 dependency/import validators, fail-closed-internal-routes) |
| Validators that are **mistargeted or assert the INVERSE** of a canonical rule | **≥6** (`production-safety` + 3 site-url validators **require** `letbuyy.store`; `architecture-validator` + `governance-common` **require** the rejected packages/apps to exist) |
| **Canonical Constitutional Rules (R-1…R-23) with correct, wired machine enforcement** | **~2 fully + ~4 partially of 23 ≈ 8–10%** |
| Canonical money rules (R-5…R-10 / PAY) machine-enforced | **0 of 6 fully** (R-7 custody, R-9 commission, R-5/R-6 ledger-only, R-8 bigint, R-10 step-up crypto all ZERO or only table-adjacent) |
| Canonical identity rule (R-14 sole issuer) machine-enforced | **0 fully** (only the `AUTH_SECRET`-fallback slice is checked) |

> **Read this as:** the platform runs **~70 validators that prove it is a CQRS / multi-region / event-sourced distributed system it is constitutionally forbidden to be**, and runs **~0 validators that prove money posts to the ledger, the fee is 0%, only identity-platform signs tokens, no policy is `USING(true)` to PUBLIC, or that a mock never reads as `success`.** The green gate is, in the Constitution's own words (ART-02, ANTI-R3), "an active falsehood."

### 2.2 The theater-vs-real split (the META finding)

The directive's META finding is **confirmed and worse than "~36":**

- **The deny-list math:** `validate-governance.mjs` gate array = 187 entries. Of these, the rejected-architecture cluster (every `replay-*`, `projection-*`, `saga-*`, `crdt-*`, `failover-*`, `wal-*`, `lease-*`, `distributed-*`, `durable-*`, `execution-*`, `recovery-*`, `convergence-*`, `runtime-causality/memory/state-machine/transition`, `orchestration-*`, `saturation`, `compensation`, `telemetry-*`, `operational-evidence/proof/storage/lifecycle/certification`, `queue-convergence/recovery/rebuild/certification`, `benchmark-*`, `partition-recovery`, `split-brain`, `fencing-token`, `resumable`, `adaptive-throttling`, `immutable-evidence`, `persistence-certification`, `survivability`, `manifest-lineage/provenance`, `deployment-lineage/orchestration/intelligence`, `rollback-orchestration/intelligence/certification/execution`) is **~87 files**.
- Net of shared helpers (`operational-certification-common.mjs`, `production-certification-common.mjs`) and a few that do *also* do something real, the **pure-fiction count is ~70–88**, i.e. **~37–47% of the entire suite.**
- The `architecture-governance.yml` CI workflow then **re-runs them by lane** (`validate:distributed-execution`, `validate:durable-execution`, `validate:distributed-survivability`, `validate:operational-certification`, `validate:production-certification`, `validate:replay`, `validate:reconciliation`, `validate:survivability`, `validate:survivability-intelligence`, plus `distributed-runtime-validator.mjs` and `production-readiness-validator.mjs` standalone). So the theater is not dormant — **it is the bulk of the architecture-governance CI gate.**

**The two foundational drift-enforcers (worse than dead — actively obstructive):**

1. **`scripts/validators/governance-common.mjs`** is the shared truth table every topology validator imports. Its `canonicalAppRoots` still lists the **rejected 9-app set** (`app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal` are all "canonical"); its `canonicalServiceRoots` lists **all six reserved services** (`checkout-runtime`, `notification-service`, `search-service`, `media-service`, `analytics-pipeline`, `event-bus`) as "canonical"; its `executionPackageRoots` treats the **rejected packages** (`application-services`, `distributed-runtime`, `orchestration`, `projection-runtime`, `runtime-composition`) as governed workspace packages. **Every validator that reads these tables inherits the rejected topology as "canonical."**
2. **`scripts/validators/architecture-validator.mjs`** (lines 82–84) **actively asserts the rejected packages MUST exist** (`exists(relPath)` over `executionPackageRoots` + a required `AGENTS.md` per package), and (lines 87–89) **mandates ~30 rejected-architecture governance docs** (`runtime-composition-governance.md`, `application-services-governance.md`, `orchestration-governance.md`, `distributed-execution-governance.md`, `event-replay-governance.md`, `workflow-recovery-governance.md`, …). **This validator makes the rejected architecture mandatory and blocks its deletion** — it is the literal mechanism of the `DEL-R3` validator-liveness deadlock the Constitution warns about (you cannot delete the dead packages without retargeting this validator first).

**Conclusion:** the validator suite does not merely *fail to enforce* the Constitution — a load-bearing slice of it **enforces the opposite.** Retargeting is not optional cleanup; it is the act (ART-02 / R-18) that makes the Constitution enforceable for the first time.

---

## 3. Existing-validator triage — KEEP / RETARGET / DELETE

> The Constitution (ART-02) is explicit: **delete the fiction validators, keep the real-invariant validators, add the missing gates** — and the deletion must be sequenced with the dead-package deletion to avoid the liveness deadlock (`DEL-R3`).

### 3.1 KEEP (real canonical-invariant validators — already correctly targeted; wire/strengthen only)

| Validator | What it really enforces | Canonical rule served | Note |
|---|---|---|---|
| `tenant-isolation-validator.mjs` | Tenant-table registry matches schema; gateway service-role clients are tenant-guard-wrapped; no static platform-console super-admin; roles from server persistence not JWT | R-1, R-2, R-4, SEC-R9, IDN-R5 (partial) | **KEEP, strengthen.** Does not assert RLS `FORCE` on every table or ban `BYPASSRLS` connection at the DB layer — that is the live-DB gap (`RLS-FORCE` validator, VAL-G-009). |
| `session-security-validator.mjs` | Internal auth uses `INTERNAL_API_SECRET`, **never** `AUTH_SECRET` fallback; JTI replay cache; dual-accept rotation | SEC-R7 (partial of IDN-R2/R-14) | **KEEP.** Covers the shared-secret *fallback*; does NOT cover "no token *signing* outside identity-platform" (VAL-G-010). |
| `single-writer-ownership-validator.mjs` | Cross-service table-write ownership (only the owner writes `orders`/`outbox_events`/`payment_webhook_events`/…) | PAY-R6 (adjacent), R-15 (partial) | **KEEP.** Money-adjacent but does NOT assert "every capture/refund/COD posts to the ledger" (VAL-G-005). |
| `single-source-crypto-validator.mjs` | One crypto module; route modules import it, don't hand-roll HMAC | SEC (single-source), supports PAY-R7 | **KEEP.** |
| `foundation-antifabrication-gate.mjs` | No `mock:true` runtime success; no synthetic UTR; no hardcoded `status:'released'`; no synthesized provider txn ids | ANTI-R7/R9, PAY-R4 (slice), R-22 (slice) | **KEEP, strengthen.** The honesty-of-mocks core; extend to the provider-mode badge presence (VAL-G-013). |
| `foundation-sql-policy-residue-validator.mjs` | Flags `USING(true)`/`WITH CHECK(true)` policies except an allowlist | SEC-R6 / R-3 (partial) | **KEEP, tighten.** Has an allowlist and excludes the `000_baseline.sql` residue — does not assert `REVOKE … FROM anon, authenticated` and is migration-text-only, not live-grant (VAL-G-007/008). |
| `dev-auth-bypass-validator.mjs` | Bans `*_DEV_AUTH_BYPASS=true` | TEST-R9, SEC | **KEEP.** |
| `committed-secret-placeholder-validator.mjs` | No committed secrets | SEC-R2, R-21 | **KEEP.** |
| `dependency-manifest` / `undeclared-import` / `package-export` / `dependency-graph` / `circular-import` `-validator.mjs` | Import direction (`apps→packages`, no apps-import-apps), declared deps, no cycles | ARCH-R11…R15 | **KEEP.** These are the genuinely good operational rules AGENTS_V2 keeps verbatim. They are the only validators marked "critical" in the gate runner. |
| `fail-closed-internal-routes-validator.mjs` | Internal routes deny by default | SEC-R1 | **KEEP.** |
| `inr-currency-format` / `date-format` / `cms-slugify` / `raw-error-message-validator.mjs` | Formatting / `AppError` discipline | CODE-R3, UI | **KEEP** (low-stakes lints). |

**KEEP total: ~16 validators** (the 5 dependency ones + ~11 invariant ones).

### 3.2 RETARGET (validators that point at the wrong target or assert the INVERSE of a canonical rule — fix the target, keep the file)

| Validator | Current (wrong) behavior | Must become | Canonical rule |
|---|---|---|---|
| **`governance-common.mjs`** (shared table — root cause) | `canonicalAppRoots` = the rejected 9 apps; `canonicalServiceRoots` = all 6 reserved services as "canonical"; `executionPackageRoots` = the 5 rejected packages as governed | `canonicalAppRoots` = the **3 Next apps + 1 ops console**; `canonicalServiceRoots` = the **5 V1 services** with the 6 reserved marked `reserved` (not canonical); `executionPackageRoots` = **removed** (dead) | ARCH-R1, ART-04, ART-19, ART-23 |
| **`architecture-validator.mjs`** | **Requires** the rejected execution packages to exist (`exists()` + AGENTS.md each); **mandates ~30 rejected-arch governance docs** | Stop requiring rejected packages/docs; assert the **8-runtime** topology and the forbidden-package **absence** | ARCH-R1/R2/R7, ART-04/19/23 |
| **`runtime-manifest-validator.mjs`** | Validates manifests for the 9-app + reserved-service set (does correctly tag reserved-service status) | Retarget the canonical list to the **V1 8-runtime** set; keep the reserved-service tagging; add the deploy↔topology contract | ARCH-R1/R2/R5, ART-04/19 |
| **`runtime-topology-validator.mjs`** | Topology over the rejected set | Topology over the V1 8 runtimes | ARCH-R1 |
| **`production-safety-validator.mjs`** | **Asserts `DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.store'` is REQUIRED** in 4 app site-url files (the **inverse** of DEPLOY-R3) — also does real fail-closed-rate-limit + Class-A-skip checks | Keep the fail-closed-rate-limit / Class-A-skip checks; **flip** the domain assertion to require `letbuyy.com` post-Wave-3 (this is a phased cutover, so the flip is gated, but the rule's polarity must invert) | DEPLOY-R3, R-20 |
| `platform-domain-literal` / `custom-domain-target` / `environment-honesty` / `production-readiness` (`letbuyy.store` refs) | Treat `letbuyy.store` as the platform domain | Treat `letbuyy.com` as canonical; ban `letbuyy.store` literals post-cutover | DEPLOY-R3 |
| `theme-governance-validator.mjs` | Pins exactly **24** built-in section types (a brittle count-freeze) and Liquid-default-OFF | Keep Liquid-default-OFF; replace the count-pin with a **semantic** "no new React/RUNTIME section" ban + per-section Liquid parity gate | THEME-R2, ART-17 |
| `reconciliation-convergence-validator.mjs` | Asserts CRDT/convergence math (theater) over reconciliation | Either DELETE (it's convergence theater) or retarget to the **real** `recon_breaks`-no-auto-plug honesty gate | PAY-R9, ART-10 |
| `domain-boundary-validator.mjs` | Asserts package **export surfaces** (real, keep) — but is misnamed vs "domain boundary = one system per domain" | KEEP the export-surface checks; the "one system per domain" semantic is a **new** validator (VAL-G-001), not this one | C1, R-15 |

**RETARGET total: ~9–12 validators** (the 2 foundational tables/asserters + ~7 topology/domain ones).

### 3.3 DELETE (governance theater — certify a system the Constitution forbids; delete *with/just-before* the dead packages per DEL-R3)

The pure-fiction set. None of these enforces any canonical rule; each certifies a capability on the Never-Build List (§10). **They must be removed, and the lanes that run them (`validate:distributed-execution`, `validate:durable-execution`, `validate:distributed-survivability`, `validate:operational-certification`, `validate:production-certification`, `validate:replay`, `validate:reconciliation`, `validate:survivability*`) deleted from `package.json` and `architecture-governance.yml`.**

The DELETE list (representative, ~70 files): `replay-*` (×12: safety/evolution/recovery/restoration/simulation/branch/scale/throughput/certification + event-schema/versioning where event-sourced), `projection-*` (×4), `saga-recovery`, `crdt-convergence`, `convergence-math`, `convergence-proof`, `distributed-*` (×5: runtime/consistency/conflict/clock/contention), `durable-*` (×5: execution/object/object-recovery/object-certification/cloudflare-runtime), `execution-*` (×4: runtime/isolation/reconciliation/layer), `runtime-causality`, `runtime-memory`, `runtime-state-machine`, `runtime-transition`, `orchestration-idempotency`, `saturation-governance`, `compensation-governance`, `failure-domain`, `fencing-token`, `lease-*` (×3), `wal-*` (×2), `split-brain`, `resumable-execution`, `adaptive-throttling`, `partition-recovery`, `recovery-*` (×6: drill/drill-execution/slo/budget/simulation + crash-recovery), `telemetry-*` (×3), `operational-evidence*` (×2), `operational-proof`, `operational-storage`, `operational-lifecycle`, `operational-certification-common`, `production-certification-common`, `production-recovery-drill`, `queue-convergence`, `queue-recovery`, `queue-rebuild-execution`, `queue-certification`, `benchmark-*` (×2), `immutable-evidence`, `persistence-certification`, `survivability-governance`, `manifest-lineage`, `manifest-provenance`, `deployment-lineage`, `deployment-orchestration`, `deployment-intelligence`, `rollback-orchestration`, `rollback-intelligence`, `rollback-certification`, `rollback-execution`, `provider-failover-certification`, `replayable-secret-persistence` (event-replay framing), `distributed-runtime-validator`.

> **Note on a few "borderline" theater files:** `migration-safety-validator` and `rollback-integrity-validator` contain *some* real intent (DROP bans; a rollbackManifest concept), but their framing is the replay/rollback machinery. Recommendation: **extract the real assertions into the new migration-rollback-pairing validator (VAL-G-021) and delete the survivability framing.** `deployment-safety-validator` similarly has a real core (keep the fail-closed bits, delete the orchestration framing).

**DELETE total: ~70 validators** (the hard-core fiction set). After DELETE+RETARGET, a healthy suite is **~30–40 validators**: ~16 KEEP + ~10 RETARGET + **~25 NEW canonical validators recommended below.**

---

## 4. THE RULE → VALIDATOR COVERAGE MATRIX

> Columns: **Rule** (Constitution R-id and/or AGENTS_V2 rule) · **Enforced today?** · **Existing validator (if any)** · **Recommended validator** (name) · **What it asserts** · **Mechanism** · **CI lane** · **Priority (P0 = money/security/drift with zero enforcement; P1 = canonical-safety high value; P2 = topology/integrity; P3 = hygiene)**.
> Mechanism legend: **grep** = tracked-file content scan · **AST** = parse TS/SQL · **manifest** = read `runtime.manifest.json`/`package.json`/topology JSON · **migration-scan** = scan `database/supabase/migrations/*.sql` · **git** = `git rev-list`/`ls-files` · **live** = requires DB introspection (out of pure-lint scope, flagged).

### 4.1 Money (the highest-catastrophe, lowest-coverage cluster)

| Rule | Enforced today? | Existing validator | Recommended validator | Asserts | Mechanism | CI lane | Pri |
|---|---|---|---|---|---|---|---|
| **R-5 / PAY-R1/R2** — every capture/refund/COD/tender posts to the canonical ledger; balance derived | **ZERO** (`grep ledger_account_balance / double-entry` = NONE) | `single-writer-ownership` (table-adjacent only) | **`canonical-ledger-only-validator`** | No money path inserts a `payments`/capture/refund row without a same-tx ledger post; the legacy `confirm_order_payment_with_ledger` is an adapter, not a live writer | AST/grep over `services/api-gateway/src` + `packages/payments` | merge (money paths) | **P0** |
| **R-6 / PAY-R1 / ANTI-R4** — no mutable-balance-as-truth; no `UPDATE`/`DELETE` of posted ledger; one writer | **ZERO** (`grep mutable.balance` = NONE) | — | **`no-mutable-balance-read-validator`** | No read treats `wallet/gift_card/store_credit/ai_credit.balance` columns as money truth; ledger entries never `UPDATE`/`DELETE` (corrections = reversing) | grep + migration-scan (REVOKE/trigger present) | merge | **P0** |
| **R-9 / PAY-R3 / ART-12** — `commission_bps = 0`, permanent | **ZERO** (`grep commission_bps` = **NONE** across all 187 validators) | — | **`commission-bps-zero-validator`** | No default/seed/config sets `commission_bps` ≠ 0; the value is not per-merchant-configurable | grep + migration-scan over seeds/config/migrations | merge (ratchet) | **P0** |
| **R-7 / PAY-R4 / ART-11** — never custody; `razorpayx` self-custody rail dead; `no_custody` derived from rail | **ZERO** (`grep razorpayx / no_custody` = NONE) | — | **`no-self-custody-rail-validator`** | No active import/wire of a `razorpayx`/self-custody disbursement path; no hardcoded `no_custody:true` stamped on a payout | grep over `apps services packages` | merge | **P0** |
| **R-10 / PAY-R7** — second factor on refund/payout is real crypto, not a string-length check | **ZERO** | `single-source-crypto` (helpers exist, not the step-up call) | **`stepup-crypto-validator`** | Refund/payout step-up calls an HMAC/stored-challenge verifier, not `.length ===`/string compare | AST over the refund/payout routes | merge | **P0** |
| **R-8 / PAY-R5 / ART-13** — bigint paise everywhere; no int32/float/numeric money | **ZERO** (`projection-integrity` mentions bigint but is theater) | — | **`money-bigint-only-validator`** | New money columns are `bigint` minor units; bans `int`/`numeric(…,4)`/`float`/`double` on `*_amount`/`*_minor`/price columns | migration-scan (AST of `CREATE TABLE`/`ALTER`) | merge | **P1** |
| **R / PAY-R9 / ART-10** — reconcile to zero-break-or-explained-suspense; no auto-plug | **ZERO** (the only "reconciliation" validators are convergence theater) | `reconciliation-convergence` (theater → retarget/delete) | **`reconciliation-no-autoplug-validator`** | No code path silently adjusts a recon difference; differences land in `recon_breaks` (signed); `money_ledger_site_reconciliations` honesty gate present | grep/AST over settlement + reconciliation modules | deploy | **P1** |
| **PAY-R6 / MIG-R6** — append-only by trigger AND `REVOKE UPDATE/DELETE` + RESTRICT FK | **PARTIAL** | `single-writer-ownership` (writer side) | **`ledger-append-only-ddl-validator`** | Ledger/audit migrations include both an append-only trigger AND `REVOKE UPDATE, DELETE`; FKs are `RESTRICT` | migration-scan | merge | **P1** |
| **R-22 / PAY-R10 / UI-R6 / ART-20** — provider-mode honesty badge on every money/fulfillment surface; stub never `success` | **ZERO** (`grep ProviderModeBadge / provider.mode` = NONE) | `foundation-antifabrication-gate` (bans `mock:true`, not badge-presence) | **`provider-mode-badge-validator`** | Every money/fulfillment render path references `ProviderModeBadge`/mode prop; no mock adapter returns a `success`/`live` status | AST/grep over web + Flutter surfaces | merge | **P0** |

### 4.2 Identity

| Rule | Enforced today? | Existing validator | Recommended validator | Asserts | Mechanism | CI lane | Pri |
|---|---|---|---|---|---|---|---|
| **R-14 / IDN-R1/R2 / ART-05** — identity-platform is the SOLE asymmetric token issuer; everyone else verify-only; no shared symmetric secret | **PARTIAL→ZERO** (`grep SignJWT/jwt.sign/sole.issuer` = NONE; only `AUTH_SECRET` fallback checked in `session-security`) | `session-security` (fallback slice only) | **`identity-sole-issuer-validator`** | No `SignJWT`/`jwt.sign`/`new SignJWT`/token-mint outside `apps/identity-platform`+`packages/token-core`; every other runtime only *verifies*; no `HS256`/shared-`AUTH_SECRET` signer | grep/AST over `apps services packages` minus issuer | merge (auth paths) | **P0** |
| **SEC-R7 / IDN-R2** — no shared `AUTH_SECRET` across trust domains; no `\|\| AUTH_SECRET` fallback | **ENFORCED (slice)** | `session-security` (real) | (extend the above) | extend issuer validator to ban any `AUTH_SECRET` read in money/identity paths | grep | merge | P1 |
| **IDN-R4 / ARCH-R18 / R (realm)** — storefront/buyer auth never grants merchant/admin; operator auth = allowlist+TOTP | **PARTIAL** | `shopper-identity-seam`, `cookie-realm` (realm seams) | **`realm-separation-validator`** | Buyer realm code never imports/sets merchant/admin roles; operator routes require allowlist+TOTP guard | grep/AST | merge | P2 |
| **IDN-R5 / R-4 / ART-08** — tenant GUC set only from a validated claim, never a raw param | **PARTIAL** | `tenant-isolation` (asserts roles-from-persistence; not GUC-from-claim) | **`guc-from-validated-claim-validator`** | The tenant GUC setter takes its value from the authenticated principal, never `req.param`/body | AST over the `withTenantTx` wrapper + RPC GUC sets | merge | **P0** |
| **IDN-R6 / ART-07 / R-13** — DPDP consent ledger append-only, fail-closed; OIDC serves 404 not MOCK_JWKS | **ZERO** | — | **`consent-failclosed-validator`** + **`no-mock-jwks-validator`** | Consent-gated send checks a consent record (no fail-open branch); OIDC/JWKS endpoint returns 404, contains no `MOCK_JWKS` literal | grep/AST | merge | P1 |

### 4.3 Tenancy / Security (S0 prohibitions)

| Rule | Enforced today? | Existing validator | Recommended validator | Asserts | Mechanism | CI lane | Pri |
|---|---|---|---|---|---|---|---|
| **R-3 / SEC-R6 / ART-09** — no `USING(true)` to PUBLIC/anon; `REVOKE INSERT/UPDATE/DELETE FROM anon, authenticated` | **PARTIAL** (allowlisted, migration-text only) | `foundation-sql-policy-residue` | **`no-public-using-true-validator`** (tighten existing) | No new `USING(true)`/`WITH CHECK(true)` policy without a `TO`-clause + predicate; the 6 baseline PUBLIC policies are re-scoped; `REVOKE` present | migration-scan (+ **live** `\dp` probe for the managed-bootstrap grants, flagged UNVERIFIED) | merge | **P0** |
| **R-1 / ART-08** — every tenant table RLS `ENABLE`+`FORCE` + per-tx GUC policy; unset GUC ⇒ 0 rows | **PARTIAL** (registry match only) | `tenant-isolation`, `migration-safety` (`FORCE` mention) | **`rls-force-coverage-validator`** | Every table in the tenant registry has `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY` **and** a GUC-predicate policy in migrations | migration-scan cross-referenced to registry (+ **live** `pg_policies`) | merge | **P0** |
| **R-2 / SEC-R9 / ART-08 / ANTI-R5** — no tenant query under `BYPASSRLS`/blanket `service_role`; service_role is audited break-glass | **PARTIAL** | `tenant-isolation` (guard-wrap), `app-utils-service-role-edge`, `domain-boundary` (service_role refs) | **`no-blanket-service-role-validator`** (strengthen) | Gateway tenant data runs via `withTenantTx`/`app_tenant`; `service_role`/`BYPASSRLS` only inside an audited `withServiceRole(reason,fn)` | AST/grep | merge | **P0** |
| **SEC-R8 / ART-06** — no anon-writable privilege table (the `super_admin_allowlist` self-grant) | **PARTIAL** | `tenant-isolation` (no static super-admin principal) | **`no-anon-privilege-table-validator`** | No policy grants anon/authenticated INSERT to a privilege/allowlist table; privilege writes are `service_role` + audit trigger | migration-scan | merge | **P0** |
| **SEC-R10 / ART-06** — role only from `app_metadata`/DB, never `user_metadata`; `/api/auth/switch` requires session+membership | **ENFORCED (slice)** | `tenant-isolation` (roles from persistence, not `auth.user.role`) | (extend) **`auth-switch-guard-validator`** | `/api/auth/switch` returns 401 without valid session+membership; no `user_metadata.role` read | AST over the route | merge | P1 |
| **SEC-R2 / R-21** — no committed secrets; `NEXT_PUBLIC_*` never secret | **ENFORCED** | `committed-secret-placeholder`, `env-isolation`, `environment-honesty` | (keep) | — | — | merge | — |
| **SEC-R3** — no `service_role` key to a client component | **PARTIAL** | `app-utils-service-role-edge`, `provider-isolation` | (extend `no-blanket-service-role`) | service_role import never in a client/edge component | grep | merge | P2 |
| **SEC-R4** — no auth tokens in `localStorage`; cookies HTTP-only/Secure/SameSite | **ZERO** | — | **`no-localstorage-token-validator`** | No `localStorage.setItem(...token...)`; session cookies set `httpOnly+Secure+SameSite` | grep/AST | merge | P2 |
| **SEC-R5 / PAY-R8** — webhook verifies signature + replay window + idempotency BEFORE mutation | **PARTIAL** | `single-writer-ownership` (webhook owns `payment_webhook_events`), `no-orphan-webhook-delivery-queue` | **`webhook-verify-before-mutate-validator`** | Webhook handlers call signature-verify + replay-check + idempotency-record before any write | AST over webhook-service | merge | P1 |
| **SEC-R11 / THEME-R4** — render via DOMPurify/allowlist not regex; storefront stored-XSS + webhook SSRF closed | **ZERO** | — | **`sanitizer-allowlist-validator`** | Storefront/theme output goes through DOMPurify/allowlist; no regex-only "sanitizer"; SSRF guard on webhook fetch | grep/AST | merge | P1 |

### 4.4 Architecture / topology / one-system-per-domain

| Rule | Enforced today? | Existing validator | Recommended validator | Asserts | Mechanism | CI lane | Pri |
|---|---|---|---|---|---|---|---|
| **C1 / R-15 / WIN-R4 / ANTI-R1** — exactly one canonical system per domain; no parallel second system | **ZERO** | `domain-boundary` (export surfaces, not winners) | **`one-system-per-domain-validator`** | The DOC-03 loser implementations (legacy ledger RPC, React renderer beyond freeze, gateway `routes/auth.ts` as issuer, second draft system, 2nd token source, 2nd app shell, 2nd ops console) are not *grown*; a registry of (domain→winner path, loser paths frozen) holds | grep/AST against a committed winner-registry JSON | merge | **P0** |
| **ARCH-R1/R2 / ART-04** — exactly the 8 canonical runtimes; no new runtime; deploy matrix == V1 topology | **MISTARGETED** (`governance-common` lists the rejected 9 + reserved) | `runtime-manifest`, `runtime-topology`, `architecture-validator` (all assert the wrong set) | **`v1-topology-validator`** (retarget the above) + **`deploy-matrix-topology-validator`** | The deployable set == the 8 V1 runtimes; `production-deploy.yml`/Vercel matrix deploys exactly those; no 9th app/reserved service deployed | manifest + parse the deploy YAML | merge + deploy | **P0** |
| **ARCH-R7/R8 / ART-23 / NEVER-R1 / ANTI-R10** — no rejected packages (`distributed-runtime`/`orchestration`/`projection-runtime`/`runtime-composition`/`application-services`/`app-engine`/`extension-host`); no CQRS/saga/event-bus | **INVERTED** (`architecture-validator` **requires** them to exist) | `architecture-validator` (asserts presence — must flip) | **`no-rejected-package-imports-validator`** | No active runtime imports `@letbuyy/{distributed-runtime,orchestration,projection-runtime,runtime-composition,application-services,app-engine}`; those roots are scheduled-dead, not required | grep imports + manifest | merge | **P0** |
| **ARCH-R4/R5 / ART-19 / R-16 / NEVER-R6 / ANTI-R7** — six reserved services stay empty; never `environment:"production"`; topology JSON not fabricated | **PARTIAL/MISTARGETED** (`runtime-manifest` tags reserved status but `governance-common` calls them "canonical"; topology JSON anti-fabrication is `[validator-gap]`) | `runtime-manifest` (reserved tagging), `mobile-topology-honesty` | **`no-reserved-service-activation-validator`** + **`topology-json-antifabrication-validator`** | Reserved service roots have no `src/`/tests/deploy config; no manifest/topology JSON declares a reserved service `production`; `production-topology.json` is regenerated from the real deploy matrix | manifest + JSON scan | merge | **P0** |
| **ARCH-R6 / ART-19** — reserved mobile roots (`shopper-app`, `operator-app`) stay empty | **PARTIAL** | `governance-common.reservedMobileRuntimeRoots`, `mobile-topology-honesty` | (extend `no-reserved-service-activation`) | no source under reserved mobile roots | manifest | merge | P2 |
| **ARCH-R10 / ART-24** — no deprecated app aliases as active topology; one ops console survives | **ENFORCED (slice)** | `architecture-validator` (forbidden-runtime-roots check is real), `marketplace-single-source`, `marketing-dead-twin`, `settings-apps-dead-twin`, `theme-editor-dead-shell` | (keep + add ops-console-single) **`single-ops-console-validator`** | Exactly one of `platform-console`/`platform-operations-portal` is deployable (the ARB survivor); the other has no deploy config | manifest | merge | P2 |
| **ARCH-R16 / ANTI-R7** — no generated output as source authority | **ENFORCED** | `generated-artifact`, `stale-artifact` | (keep) | — | — | merge | — |
| **R-16 / ART-19** — events via same-transaction outbox, not an event bus | **ZERO** (the "event-*" validators are versioning/schema theater) | `gateway-events-client`, `contracted-domain-event-ingress` (contract shape) | **`outbox-atomic-validator`** | The outbox dual-write is in the same transaction as the domain write; no standalone event-bus client; reserved `event-bus` empty | AST over the outbox writer | merge | P1 |

### 4.5 Theme / storefront

| Rule | Enforced today? | Existing validator | Recommended validator | Asserts | Mechanism | CI lane | Pri |
|---|---|---|---|---|---|---|---|
| **THEME-R2 / ART-17** — no new React/RUNTIME sections after freeze; port to Liquid | **PARTIAL** (a brittle "==24" count-pin) | `theme-governance` (count-pin), `theme-editor-dead-shell` | **`no-new-react-section-validator`** | No new entry in `RUNTIME_SECTION_SCHEMAS`/the React section registry beyond the frozen baseline; new sections must be Liquid | grep/AST + baseline diff | merge | **P1** |
| **THEME-R3 / ART-17** — one schema source, one draft system, one compose path | **PARTIAL** | `theme-governance` (`BUILT_IN_SECTION_SCHEMAS` single source) | **`single-theme-schema-source-validator`** | No fourth schema source, no third draft system, no second compose path (`composeStorefrontTheme` only) | grep/AST | merge | P2 |
| **THEME-R4 / SEC-R11 / R-12 / ART-16** — branding is data not code; no extension/Wasm/3rd-party code in live checkout/storefront | **ZERO** | — | **`no-live-extension-runtime-validator`** | No `CheckoutExtensionHost`/Wasm/app-functions executor in the order/payment/storefront live path (seam only) | grep over the live routes | merge | **P0** |
| **THEME-R6 / ART-17** — Liquid default-flip is per-theme+canary, gated | **ENFORCED (slice)** | `theme-governance` (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) | (keep, add parity gate) | Liquid default stays OFF until parity/security/perf green | grep | merge | P2 |
| **ART-18 / TOPO-005** — one storefront runtime; `runtime-composition` unwired from the live read path | **INVERTED** (`runtime-composition` is a required governed package) | `architecture-validator` (requires it) | (covered by `no-rejected-package-imports`) | `runtime-composition` not imported in the storefront read path | grep | merge | P1 |

### 4.6 Design system / UI

| Rule | Enforced today? | Existing validator | Recommended validator | Asserts | Mechanism | CI lane | Pri |
|---|---|---|---|---|---|---|---|
| **UI-R1 / ART-20 / R-15** — one token source; no second/third token system; no bypassing mobile color class | **ENFORCED** | `validate-design-system`, `mobile-token-validator`, design-token interchange | (keep, strengthen) **`token-source-single-validator`** | DTCG tokens are the only source; Dart `ui_kit` consumes the generated bridge; no competing mobile color classes | grep/AST + token diff | merge | P2 |
| **UI-R7 / ART-20** — drift ratchet BLOCKS new drift (no naked rgb/hsl, raw px, arbitrary radius where a token exists) | **ENFORCED** | `validate-design-system` (ratchet + stylelint) | (keep) | — | — | merge | — |
| **UI-R2 / ART-20 / R-15** — one app shell (`AppNavigation`); no hand-rolled nav | **ZERO** | — | **`shell-single-validator`** | No hand-rolled navigation/sidebar shell; surfaces import `AppNavigation` | grep/AST | merge | P2 |
| **UI-R5 / CODE-R7** — web icons Lucide, Flutter icons Material | **PARTIAL** | (design-system lints) | **`icon-source-validator`** | No non-Lucide icon import on web; no non-Material icon on Flutter | grep | merge | P3 |

### 4.7 Migrations / deletion / deploy / governance integrity

| Rule | Enforced today? | Existing validator | Recommended validator | Asserts | Mechanism | CI lane | Pri |
|---|---|---|---|---|---|---|---|
| **MIG-R3 / R-23** — every migration ships a paired rollback (DOWN); the 3 unpaired (138/140/157) gain rollbacks; gate ≥138 | **ZERO** (`migration-safety` bans DROP but does NOT check DOWN pairing) | `migration-safety` (DROP bans only) | **`migration-rollback-pairing-validator`** | Every migration ≥138 has a paired DOWN/rollback artifact; merge blocked otherwise | migration-scan + paired-file check | merge | **P1** |
| **MIG-R2** — sequential numbering from max 161; no reuse/skip; fix dup prefix 129 | **ZERO** | — | **`migration-sequential-prefix-validator`** | No duplicate migration prefixes; next prefix is monotonic from 161 | migration-scan | merge | P2 |
| **MIG-R4 / ART-13** — data cutovers follow expand→backfill→verify→contract; no drop-before-parity | **PARTIAL** | `migration-safety` (DROP COLUMN banned ⇒ enforces expand/contract implicitly) | (keep) | — | migration-scan | merge | P2 |
| **DEL-R1/R3 / ART-24 / AGENT-R14** — nothing deleted until gate green; retarget asserting validator FIRST | **ZERO** (process rule; partly self-referential) | — | **`deletion-gate-manifest-validator`** | A `DELETED`-marked package has its asserting validator already retargeted/removed (no validator references a deleted root) | grep cross-ref (validator source ↔ deleted roots) | merge | P2 |
| **DEPLOY-R1 / R-20 / ART-03 / ANTI-R11** — deploy meta-blocker: `git rev-list --count main..stepup/main` == 0 | **ZERO** (`grep rev-list/branch-lag` = NONE) | — | **`branch-lag-guard-validator`** | The deploy branch is not behind the integration branch (count == 0) | git | deploy | **P1** |
| **DEPLOY-R2 / ART-04/22** — one deploy matrix == V1 8 runtimes; de-deploy app-marketplace/developer-portal | **MISTARGETED** | (deploy workflows deploy the 9-app matrix) | **`deploy-matrix-topology-validator`** (see 4.4) | the deploy YAML deploys exactly the 8 V1 runtimes; app-marketplace/developer-portal not in active matrix | parse deploy YAML | deploy | **P0** |
| **DEPLOY-R3 / ART (domain)** — one canonical domain `letbuyy.com`; ban `letbuyy.store` literals post-Wave-3 | **INVERTED** (`production-safety` **requires** `letbuyy.store`) | `production-safety`, `platform-domain-literal`, `custom-domain-target` (all `.store`) | **`letbuyy-store-ban-validator`** (retarget the above) | After cutover, no `letbuyy.store` literal in active source; canonical domain is `letbuyy.com` | grep | merge (post-Wave-3) | P1 |
| **DEPLOY-R4 / ART-23** — Cloudflare Workers + Vercel only; no k8s/Helm fantasy infra | **PARTIAL** | (cloudflare-* validators, themselves partly theater) | **`no-fantasy-infra-validator`** | No tracked k8s/Helm/firebase infra in active roots | grep/ls-files | merge | P2 |
| **DOC-R1 / R-19 / ART-21 / ANTI-R8** — governance docs are hand-authored; no scan-generated doc as authority (`<!-- GENERATED BY … -->` AGENTS.md) | **PARTIAL** | `repository-intelligence`, `tooling-governance` (generate the doc — must invert) | **`no-scan-generated-agents-validator`** | The operative `AGENTS.md` carries no `GENERATED BY scripts/generate-repository-intelligence` header; generated maps are marked subordinate, never authority | grep header | merge | **P1** |
| **R-18 / ART-02 / ANTI-R3** — the validator suite enforces THIS Constitution; no validator certifies a forbidden capability | **VIOLATED** (~70 theater validators run) | (the theater set itself) | **`no-theater-validator-meta-validator`** | No validator in the gate array references a Never-Build capability (replay/projection/saga/CRDT/failover/multi-region/WAL/lease) | grep over the gate array + validator names | merge | **P0** (meta) |
| **DOC-R5** — run `validate-governance.mjs` after topology/import/package/env/governance changes | **ENFORCED** | `architecture-governance.yml` paths trigger | (keep) | — | — | merge | — |

### 4.8 Coverage tally (load-bearing rules)

| Cluster | Rules examined | ENFORCED (correct+wired) | PARTIAL | ZERO / INVERTED |
|---|---|---|---|---|
| Money (R-5…R-10, PAY-R1…R10) | 10 | **0** | 2 | **8** |
| Identity (R-14, IDN-R1…R6) | 6 | 0 (1 slice) | 3 | 2 |
| Tenancy/Security (R-1…R-4, SEC-R5…R11) | 12 | 3 | 6 | 3 |
| Architecture/topology/one-system (C1, R-15/R-16, ARCH/ART-04/19/23) | 9 | 1 | 3 | **5 (incl. inverted)** |
| Theme (THEME-R2…R6, ART-16/17/18) | 6 | 1 (slice) | 3 | 2 |
| Design/UI (R-15, UI-R1/R2/R7) | 4 | 2 | 1 | 1 |
| Migration/deletion/deploy/doc-integrity (MIG/DEL/DEPLOY/DOC, R-18…R-23) | 12 | 2 | 4 | **6 (incl. inverted)** |
| **Total load-bearing** | **~59** | **~9 (incl. slices)** | **~22** | **~28** |

> **~9/59 ≈ 15% have *some* correct wired enforcement; only ~2–4 are *fully* enforced. The 23 Constitutional R-rules specifically: ~2 fully + ~4 partial = ~10% machine-enforced.** Every money rule and the identity sole-issuer rule are unenforced. Several topology/domain/deploy rules are not merely unenforced but **enforced in reverse.**

---

## 5. Validator Coverage Findings register

> **ID:** VAL-G-NNN · **Severity:** CRITICAL = a money/security/drift rule with ZERO (or inverted) enforcement · MAJOR = high-value canonical-safety rule unenforced/partial · MINOR = hygiene/integrity. · **Priority** P0–P3 as in §4.

| ID | Sev | Rule | Current coverage | Recommended validator (name → assertion) | Pri |
|---|---|---|---|---|---|
| **VAL-G-001** | CRITICAL | C1 / R-15 / WIN-R4 — one system per domain | ZERO (`domain-boundary` checks exports, not winners) | `one-system-per-domain-validator` → DOC-03 loser paths are frozen, not grown; winner-registry JSON holds | P0 |
| **VAL-G-002** | CRITICAL | R-5 / PAY-R1/R2 — money posts to the ledger | ZERO | `canonical-ledger-only-validator` → no capture/refund/COD writes money without a same-tx ledger post | P0 |
| **VAL-G-003** | CRITICAL | R-6 / ANTI-R4 — no mutable-balance-as-truth | ZERO | `no-mutable-balance-read-validator` → wallet/gift-card/credit balances are projections, not money truth; no UPDATE/DELETE of posted entries | P0 |
| **VAL-G-004** | CRITICAL | R-9 / PAY-R3 / ART-12 — `commission_bps = 0` | ZERO (no validator mentions it) | `commission-bps-zero-validator` → no default/seed/config sets commission ≠ 0; not per-merchant configurable | P0 |
| **VAL-G-005** | CRITICAL | R-7 / PAY-R4 / ART-11 — never custody; razorpayx dead | ZERO | `no-self-custody-rail-validator` → no active import/wire of a self-custody disbursement path; no hardcoded `no_custody:true` | P0 |
| **VAL-G-006** | CRITICAL | R-10 / PAY-R7 — real-crypto step-up | ZERO | `stepup-crypto-validator` → refund/payout step-up uses HMAC/stored-challenge, not a string-length check | P0 |
| **VAL-G-007** | CRITICAL | R-3 / SEC-R6 / ART-09 — no `USING(true)` to PUBLIC; REVOKE anon | PARTIAL (allowlisted, text-only) | `no-public-using-true-validator` → tighten: no `USING(true)` without TO+predicate; `REVOKE …FROM anon, authenticated` present (+ live `\dp` probe) | P0 |
| **VAL-G-008** | CRITICAL | SEC-R8 / ART-06 — no anon-writable privilege table | PARTIAL (`tenant-isolation` no-static-principal) | `no-anon-privilege-table-validator` → no anon/authenticated INSERT to a privilege/allowlist table | P0 |
| **VAL-G-009** | CRITICAL | R-1 / ART-08 — RLS ENABLE+FORCE + GUC on every tenant table | PARTIAL (registry match) | `rls-force-coverage-validator` → every registry table has ENABLE+FORCE+GUC policy in migrations (+ live `pg_policies`) | P0 |
| **VAL-G-010** | CRITICAL | R-14 / IDN-R1/R2 / ART-05 — identity-platform sole issuer | PARTIAL→ZERO (only AUTH_SECRET fallback) | `identity-sole-issuer-validator` → no token signing outside identity-platform+token-core; everyone else verify-only; no shared symmetric signer | P0 |
| **VAL-G-011** | CRITICAL | R-2 / SEC-R9 / ANTI-R5 — gateway off blanket service_role | PARTIAL | `no-blanket-service-role-validator` → tenant data via `withTenantTx`/`app_tenant`; service_role only in audited `withServiceRole` | P0 |
| **VAL-G-012** | CRITICAL | IDN-R5 / R-4 — tenant GUC from a validated claim only | PARTIAL | `guc-from-validated-claim-validator` → GUC value derives from authenticated principal, never a raw param | P0 |
| **VAL-G-013** | CRITICAL | R-22 / PAY-R10 / UI-R6 — provider-mode honesty badge; stub ≠ success | ZERO | `provider-mode-badge-validator` → every money/fulfillment surface renders `ProviderModeBadge`; no mock returns `success`/`live` | P0 |
| **VAL-G-014** | CRITICAL | ARCH-R1/R2 / ART-04 — exactly the 8 V1 runtimes | MISTARGETED (lists rejected 9 + reserved) | `v1-topology-validator` (retarget `runtime-manifest`/`runtime-topology`/`architecture-validator` + `governance-common` tables) → canonical set == 8 V1 runtimes | P0 |
| **VAL-G-015** | CRITICAL | ARCH-R7/R8 / ART-23 / NEVER-R1 — no rejected-package imports | INVERTED (`architecture-validator` REQUIRES them) | `no-rejected-package-imports-validator` → no import of distributed-runtime/orchestration/projection-runtime/runtime-composition/application-services/app-engine; flip `architecture-validator` to assert absence | P0 |
| **VAL-G-016** | CRITICAL | ARCH-R4/R5 / ART-19 / R-16 — reserved services empty, never `production` | PARTIAL/MISTARGETED | `no-reserved-service-activation-validator` + `topology-json-antifabrication-validator` → reserved roots have no src/deploy; no JSON marks a reserved service `production` | P0 |
| **VAL-G-017** | CRITICAL | THEME-R4 / R-12 / ART-16 — no live extension/Wasm/3rd-party code in checkout/storefront | ZERO | `no-live-extension-runtime-validator` → no CheckoutExtensionHost/Wasm/app-functions executor in the live order/payment/storefront path | P0 |
| **VAL-G-018** | CRITICAL (meta) | R-18 / ART-02 / ANTI-R3 — suite enforces THIS Constitution; no theater | VIOLATED (~70 theater validators in the gate) | `no-theater-validator-meta-validator` → no gate validator references a Never-Build capability; and DELETE the ~70 fiction validators + their lanes | P0 |
| **VAL-G-019** | MAJOR | R-8 / PAY-R5 / ART-13 — bigint paise only | ZERO | `money-bigint-only-validator` → money columns are bigint minor units; bans int/numeric/float on amount columns | P1 |
| **VAL-G-020** | MAJOR | PAY-R9 / ART-10 — reconcile zero-break, no auto-plug | ZERO (only convergence theater) | `reconciliation-no-autoplug-validator` → no silent recon adjustment; signed `recon_breaks`; honesty gate present | P1 |
| **VAL-G-021** | MAJOR | MIG-R3 / R-23 — paired rollback for every migration ≥138 | ZERO (`migration-safety` checks DROP only) | `migration-rollback-pairing-validator` → every migration ≥138 has a paired DOWN; gate blocks merge | P1 |
| **VAL-G-022** | MAJOR | DEPLOY-R1 / R-20 / ART-03 — branch-lag guard | ZERO | `branch-lag-guard-validator` → `git rev-list --count main..stepup/main` == 0 | P1 |
| **VAL-G-023** | MAJOR | DEPLOY-R2 / ART-04 — deploy matrix == V1 topology | MISTARGETED | `deploy-matrix-topology-validator` → deploy YAML deploys exactly the 8 V1 runtimes; app-marketplace/developer-portal de-deployed | P0 |
| **VAL-G-024** | MAJOR | THEME-R2 / ART-17 — no new React/RUNTIME sections | PARTIAL (brittle ==24 count) | `no-new-react-section-validator` → no new RUNTIME_SECTION_SCHEMAS entry beyond the frozen baseline; new sections are Liquid | P1 |
| **VAL-G-025** | MAJOR | PAY-R6 / MIG-R6 — append-only by trigger AND REVOKE | PARTIAL | `ledger-append-only-ddl-validator` → ledger/audit migrations include both trigger and `REVOKE UPDATE, DELETE` + RESTRICT FKs | P1 |
| **VAL-G-026** | MAJOR | IDN-R6 / ART-07 — consent fail-closed; no MOCK_JWKS | ZERO | `consent-failclosed-validator` + `no-mock-jwks-validator` → consent send checks a record (no fail-open); OIDC returns 404, no MOCK_JWKS literal | P1 |
| **VAL-G-027** | MAJOR | SEC-R5 / PAY-R8 — webhook verify+replay+idempotency before mutate | PARTIAL | `webhook-verify-before-mutate-validator` → handlers verify signature + replay window + idempotency before any write | P1 |
| **VAL-G-028** | MAJOR | SEC-R11 / THEME-R4 — DOMPurify/allowlist sanitizer; SSRF guard | ZERO | `sanitizer-allowlist-validator` → output via DOMPurify/allowlist not regex; webhook fetch SSRF-guarded | P1 |
| **VAL-G-029** | MAJOR | DOC-R1 / R-19 / ART-21 — no scan-generated AGENTS.md as law | PARTIAL (generators still emit it) | `no-scan-generated-agents-validator` → operative AGENTS.md has no `GENERATED BY …` header; generated maps marked subordinate | P1 |
| **VAL-G-030** | MAJOR | DEPLOY-R3 — `letbuyy.com` canonical; ban `letbuyy.store` | INVERTED (`production-safety` requires `.store`) | `letbuyy-store-ban-validator` (retarget `production-safety`/`platform-domain-literal`/`custom-domain-target`) → no `letbuyy.store` literal post-cutover | P1 |
| **VAL-G-031** | MINOR | R-16 / ART-19 — same-transaction outbox, not event bus | ZERO (event-* are schema theater) | `outbox-atomic-validator` → outbox dual-write is same-transaction; no standalone event-bus client | P1 |
| **VAL-G-032** | MINOR | UI-R2 / R-15 / ART-20 — one app shell (`AppNavigation`) | ZERO | `shell-single-validator` → no hand-rolled nav/sidebar shell; surfaces import `AppNavigation` | P2 |
| **VAL-G-033** | MINOR | UI-R1 / R-15 — single token source | ENFORCED (strengthen) | `token-source-single-validator` → no second/third token source; no bypassing mobile color class | P2 |
| **VAL-G-034** | MINOR | THEME-R3 — one schema/draft/compose source | PARTIAL | `single-theme-schema-source-validator` → no fourth schema source, third draft, or second compose path | P2 |
| **VAL-G-035** | MINOR | IDN-R4 / ARCH-R18 — realm separation | PARTIAL | `realm-separation-validator` → buyer realm never grants merchant/admin; operator routes require allowlist+TOTP | P2 |
| **VAL-G-036** | MINOR | SEC-R4 — no auth token in localStorage | ZERO | `no-localstorage-token-validator` → no `localStorage` token writes; cookies httpOnly+Secure+SameSite | P2 |
| **VAL-G-037** | MINOR | ARCH-R10 / ART-24 — one ops console survives | PARTIAL | `single-ops-console-validator` → exactly one of platform-console/operations-portal is deployable | P2 |
| **VAL-G-038** | MINOR | MIG-R2 — sequential migration prefixes; fix dup 129 | ZERO | `migration-sequential-prefix-validator` → no duplicate prefixes; monotonic from 161 | P2 |
| **VAL-G-039** | MINOR | DEL-R1/R3 / AGENT-R14 — retarget asserting validator before delete | ZERO | `deletion-gate-manifest-validator` → no validator references a DELETED root (liveness-deadlock guard) | P2 |
| **VAL-G-040** | MINOR | DEPLOY-R4 / ART-23 — Cloudflare+Vercel only; no k8s/Helm | PARTIAL | `no-fantasy-infra-validator` → no tracked k8s/Helm/firebase infra in active roots | P2 |
| **VAL-G-041** | MINOR | SEC-R10 / ART-06 — `/api/auth/switch` session+membership guard | ENFORCED (slice) | `auth-switch-guard-validator` → route returns 401 without valid session+membership; no `user_metadata.role` read | P1 |
| **VAL-G-042** | MINOR | UI-R5 / CODE-R7 — Lucide(web)/Material(Flutter) icons | PARTIAL | `icon-source-validator` → no non-Lucide web icon import; no non-Material Flutter icon | P3 |

**Register total: 42 findings → ≥36 recommended new/retargeted validators** (18 CRITICAL, well above the 25-validator floor the directive set).

---

## 6. Sequencing note (so the recommendations are actionable, not just enumerated)

This matrix recommends; it does not implement. But because of the `DEL-R3` validator-liveness deadlock, the *order* of the recommendations matters and is itself a finding:

1. **First, retarget the two foundational asserters** (`governance-common.mjs` tables + `architecture-validator.mjs`) so they stop *requiring* the rejected packages/apps. Until this is done, the canonical topology cannot exist and the dead packages cannot be deleted (VAL-G-014/015/016).
2. **In the same change, DELETE the ~70 theater validators** and remove their `package.json`/`architecture-governance.yml` lanes (VAL-G-018). This is what makes "green" mean "conforms to the Constitution" (R-18).
3. **Then add the P0 canonical-safety validators** (VAL-G-001…013, 017, 023) — money, identity, tenancy, one-system-per-domain, no-live-extension, deploy-matrix.
4. **Then the P1 set** (bigint, reconciliation, rollback-pairing, branch-lag, no-new-react-section, consent, webhook, sanitizer, store-ban, scan-generated-AGENTS).
5. **P2/P3** harden the remainder.

The live-DB-dependent assertions (VAL-G-007 grant probe, VAL-G-009 `pg_policies`, the `pg_stat_user_tables` write checks for safe deletion) are **not** pure static lints; they belong in the deploy lane against the ephemeral/real Postgres and are flagged UNVERIFIED in the evidence base (Constitution §14.4) — recommend them as deploy-lane gates, not merge-lane greps.

---

## 7. Undetermined / requires a live check (carried, never upgraded to fact)

- **Exact theater-validator count to delete (70 vs 88):** ~10 borderline files (`migration-safety`, `rollback-integrity`, `deployment-safety`, `reconciliation-convergence`) contain a *real* assertion wrapped in survivability framing. Whether each is DELETE-and-reauthor vs RETARGET is a per-file call for the implementing wave; I classed them RETARGET-or-extract. Net DELETE is **~70 confidently; up to ~88 if the borderline set is also cut.**
- **Whether any theater validator is *load-bearing for a real seam*** (e.g. `queue-topology` partly describes the real `queue-workers`): a few "queue"/"deployment" validators straddle the line; confirm before deleting wholesale.
- **Live grant/policy state** (VAL-G-007/009): the six anon-PUBLIC grants are reported as set by Supabase managed bootstrap, not repo SQL; the migration-text validator cannot see them — a live `\dp public.orders` / `pg_policies` probe is required (Constitution §14.4, Appendix B). The recommended validators therefore pair a migration-scan with a deploy-lane live probe.
- **The ops-console survivor** (VAL-G-037) is an ARB decision, not a code fact — the validator must read the survivor from a committed decision record, not hard-code it.
- **CI greenness today:** this is a static read of validator *source* and gate wiring; I did not execute the suite. Whether the gate currently passes (and thus whether the theater is currently *blocking* or merely *present*) was not run.

---

*End of VALIDATOR_COVERAGE_MATRIX — Phase 7. This document inventoried the real `scripts/validators/` directory (187 `.mjs` files), the `validate-governance.mjs` gate runner, the `package.json` validate lanes, and the architecture-governance/ci CI workflows, and mapped every load-bearing Constitutional Rule (R-1…R-23), Article (ART-01…24), and AGENTS_V2 numbered rule to its enforcement status. It recommends ≥36 validators (18 CRITICAL) and a KEEP/RETARGET/DELETE triage of the existing suite. It implements nothing, changes no architecture, and modified no repo code or other document.*
