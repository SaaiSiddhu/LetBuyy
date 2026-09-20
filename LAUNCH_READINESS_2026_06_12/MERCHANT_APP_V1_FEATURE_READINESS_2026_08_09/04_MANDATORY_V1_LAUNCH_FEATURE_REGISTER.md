# 04 — MANDATORY V1 LAUNCH FEATURE REGISTER

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`)
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

---

## 1. The rule this register enforces

A capability is registered here if **a launch is not honest without it** — regardless of how
complete it is. Several entries are at **0%**. That is the point: a mandatory capability at 0% is a
**launch blocker**, never a reason to quietly redefine the scope.

> **A mandatory feature below 70 is still mandatory.** It is never dropped to improve a percentage.
> If it cannot be closed, the verdict stays NO-GO and this register names why.

Score bands and hard caps are defined in [`00_README_AND_AUTHORITY.md`](00_README_AND_AUTHORITY.md).
The cap that dominates this register is **"no automated happy-path integration test ⇒ maximum 69"**.

## 2. Register

`Score` is the evidence-based score at `bf35062e` (post-verification where a verifier corrected it).
`State` is one of ABSENT · SCAFFOLD · PARTIAL · BUILT-UNPROVEN · PROVEN.

### 2.1 Access and merchant identity

| # | Capability | Why mandatory | Score | State | Closure criteria |
|---|---|---|---|---|---|
| M-01 | Merchant signup → OTP → password | No merchants without it | ~62 | BUILT-UNPROVEN | An executing E2E test; `identity-platform` as sole issuer (blocked by `IDN-S0-1`) |
| M-02 | Login + session restore + logout | Daily use | ~62 | BUILT-UNPROVEN | Same |
| M-03 | **Single token issuer** | ART-05 / IDN-R1 / R-14. A second issuer is a forgery surface | — | **VIOLATED** | Remove `/v1/auth/signup` + `/v1/auth/signin` from the gateway; all issuance via `identity-platform` |
| M-04 | Turnstile bot defence | Gates registration/login; **fails closed** | 72 | PARTIAL | Production keys (H-8). Without them a **store reviewer cannot log in** |
| M-05 | Secure token storage on device | SEC-R4 | 74 | PROVEN (static) | Verified: tokens in `FlutterSecureStorage`; SharedPreferences holds only `store_user_email` |
| M-06 | Session expiry fails closed | Prevents stale-session access | — | PROVEN (DB layer) | `foundation-wave4-session-postgres`: rotates, rejects reuse, rolls back |
| M-07 | **In-app account deletion + web deletion resource** | **Apple 5.1.1(v) and Google Play User Data policy. Both stores reject without it** | **0** | **ABSENT** | In-app flow + server erasure/anonymisation respecting ledger append-only + public web resource + Play Data-safety declaration |

### 2.2 Tenancy and data safety

| # | Capability | Why mandatory | Score | State | Closure criteria |
|---|---|---|---|---|---|
| T-01 | Tenant isolation, fail-closed | ART-08 / R-1. A leak ends the company | — | **PROVEN (partial surface)** | RT-1…RT-9 pass on real Postgres under `app_tenant` + raw-REST. Remains proven only for the tables the red team covers |
| T-02 | No `USING(true)` to PUBLIC/anon | SEC-R6 / R-3 / ART-09 | — | **VIOLATED** | **22** permissive policies survive in final migration state without `TO service_role` (`DB-S0-PUBLIC-USING-TRUE`) |
| T-03 | Gateway off blanket `service_role` | ART-08 / SEC-R9 / R-2 | — | **EFFECTIVELY ABSENT** | `withTenantTx`/`withResolvedTenantTx` have **4–5 total references repo-wide**, all definition/import/re-export — the tenant-transaction boundary is essentially unused while `getSupabaseAdmin` appears ~998 times in the gateway |
| T-04 | Tenant-table registry completeness | The isolation validator only checks registered tables | — | **FIXED** | Regenerated 261 → 265; "0 direct service-role bypasses" |
| T-05 | RLS ENABLE+FORCE coverage | R-1 | — | **PARTIAL / DISPUTED** | Money ledger tables verified `relrowsecurity=t, relforcerowsecurity=t` by executed SQL. The blanket "326 tables without FORCE" claim came from a grep the same verifier proved unreliable — **must be re-measured against a live database**, not grepped |

### 2.3 Money — the highest-risk domain

| # | Capability | Why mandatory | Score | State | Closure criteria |
|---|---|---|---|---|---|
| $-01 | Canonical append-only double-entry ledger | ART-10. The only money truth | 82 | **PROVEN (kernel)** | Append-only enforced on real Postgres: `ERROR: ledger is append-only; use reversing entries` on UPDATE **and** DELETE |
| $-02 | **Every money effect posts exactly once** | ART-10 / PAY-R2 | — | **VIOLATED (S0)** | `MNY-S0-001`: **four uncoordinated writers to `merchant_payable`** — the same captured rupee credited multiple times. Single-writer discipline must be restored and proven by a reconciliation harness |
| $-03 | `commission_bps = 0`, permanent | ART-12 / PAY-R3. The competitive wedge | 74 | PROVEN (structural) | `DEFAULT 0` (migration 162) + ratchet validator. Residual: `commission.ts:292` still computes a fee if a row were non-zero |
| $-04 | Never custody / PA-split only | ART-11 / R-7 | — | BUILT | No self-custody rail found active |
| $-05 | `bigint` paise everywhere | ART-13 / R-8 | — | PARTIAL | Legacy representations remain on some paths |
| $-06 | Real-crypto step-up on refund/payout | ART-11 / PAY-R7 / R-10 | — | **PARTIAL — bypassable** | Backend HMAC is real, but `CC-S1-REFUND-NO-STEPUP` and `MNY-S1-004` confirm **both refund legs in `orders.ts` are un-gated**, and a refund path has a cross-tenant exposure "wider than claimed" |
| $-07 | Refund UI (merchant-facing) | A merchant who cannot refund cannot trade | **0** | **ABSENT** | No refund UI in web or mobile; no step-up challenge UI anywhere. Mobile's call fails at `400 VALIDATION_ERROR` (missing `idempotency_key`) before it reaches the gate |
| $-08 | Fail-closed with no provider credentials | PAY-R10 / AGENT-R11 | 80 | PROVEN (static) | Verified honest sentinels; a stub never reads as success |
| $-09 | Reconciliation to zero-or-explained | PAY-R9 | — | BUILT-UNPROVEN | No auto-plug found; harness not executed against real data |

### 2.4 Storefront reachability — the buyer must be able to see the store

| # | Capability | Why mandatory | Score | State | Closure criteria |
|---|---|---|---|---|---|
| S-01 | **Host → store routing** | Without it no storefront is reachable at `{store}.letbuyy.com` | **0** | **ABSENT** | `apps/storefront-runtime/src/middleware.ts` does not exist; nothing invokes `proxy()`, though `proxy.ts:61` exports `config.matcher` and `:300` exports `proxy()`. **Must ship with S-02 + a back-fill** |
| S-02 | `sites.published` written on publish | The access resolver gates on it | — | **FIXED** | `stores.ts:792` (PATCH, covers unpublish) and `:837` (POST publish) |
| S-03 | Product visible on the storefront | The point of the platform | — | BUILT-UNPROVEN | Unreachable until S-01 |
| S-04 | Cart → server-authoritative checkout → order | ART-14 / R-11 | — | BUILT-UNPROVEN | No executing E2E |
| S-05 | Order confirmation to buyer | Trust | — | PARTIAL | Email provider not connected |

### 2.5 Mobile app — the V1 candidate surface

| # | Capability | Why mandatory | Score | State | Closure criteria |
|---|---|---|---|---|---|
| A-01 | **An executing integration test** | Caps **every** mobile capability at 69; nothing mobile can be launch-proven without it | **0** | **ABSENT** | `integration_test/merchant_happy_path_test.dart:123` is `skip: !AppConfig.hasTurnstileToken`, and the token is a sentinel in **both** dart-define files. Make it execute (test key or injected double). **Highest-leverage fix in the program** |
| A-02 | **V1 capability policy + route-level gating** | Scenarios 19–20; prevents shipping a misleading surface | **0** | **ABSENT** | `CapabilityGate` widget exists and is good, but there is **no policy source** — both usages hardcode a value and `AppConfig` has no flags. Must gate at `AppRoutes.generateRoute` because 31 screens are reachable by 2–3 paths (`AppsScreen` by three) |
| A-03 | Crash reporting | Blind launch otherwise | 0 | ABSENT | `SENTRY_DSN` sentinel; reports go to a local outbox, no provider called |
| A-04 | **iOS privacy manifest** | Apple rejects without it; the app uses required-reason APIs (`shared_preferences`, `path_provider`) | **0** | **ABSENT** | Author `PrivacyInfo.xcprivacy` (doc 13 §3.1) |
| A-05 | **iOS signed-release pipeline** | No `.ipa` can be produced | **0** | **ABSENT** | Release workflow has only `android-signed-release`; CI builds iOS `--debug --no-codesign` only |
| A-06 | Android signed release | Play submission | — | BUILT, unprovisioned | Pipeline exists and **correctly fails closed** without keystore secrets |
| A-07 | Android launcher label | Ships as the literal string `store` | — | DEFECT | `AndroidManifest.xml:5` — branding decision (human) |
| A-08 | Mobile refund/payout calls | Merchant money operations from the app | — | **BROKEN** | `MOB-BLK-02`/`MOB-BLK-03`: the Dart client omits `idempotency_key`, so calls fail `400` before reaching the step-up gate |

### 2.6 Delivery, governance and operations

| # | Capability | Why mandatory | Score | State | Closure criteria |
|---|---|---|---|---|---|
| D-01 | **Deployable pipeline** | ART-03 / DEPLOY-R1. Nothing ships otherwise | — | **BLOCKED** | Lag 106 vs `main`, **291 vs `origin/main`**; `production-deploy.yml` fails its first gate |
| D-02 | **CI on the working branch** | Nothing protects `stepup/main` | — | **ABSENT** | `ci.yml` triggers only on `develop`/`main` |
| D-03 | Green governance gate | R-18 | — | **RED** | Fails at validator 5 of 108; **102 never execute**; `prompt-perimeter` independently fails |
| D-04 | Migration ↔ rollback pairing | R-23 | — | PARTIAL | `validate:migrations` red on the retired root `supabase/config.toml` |
| D-05 | Monitoring / alerting | Detect incidents | — | NOT CONNECTED | All live adapters NOT CONNECTED |
| D-06 | Reserved services stay empty | ART-19 / R-16 | — | **COMPLIANT** | All six are `AGENTS.md` + `runtime.manifest.json` only |
| D-07 | No third-party code in a live path | ART-16 / NEVER-R3 / R-12 | — | **VIOLATED** | App Bridge reachable in production despite `FEATURE_EXTENSIONS="false"` |

### 2.7 Legal and India-first obligations

| # | Capability | Why mandatory | Score | State |
|---|---|---|---|---|
| L-01 | Privacy policy live at the linked URL | Both stores; DPDP | 0 | ABSENT (app links `letbuyy.com/privacy`) |
| L-02 | Terms live at the linked URL | Both stores | 0 | ABSENT |
| L-03 | GST correctness (place of supply, CGST/SGST/IGST, HSN) | Indian law | PARTIAL | Engine exists; invocation at order confirm unproven |
| L-04 | Consent gate fails closed for consent-gated messaging | ART-07 / R-13 | BUILT | Design is fail-closed |

## 3. Summary — mandatory capabilities at zero

Eleven mandatory capabilities are at **0** and are genuine builds, not configuration:

**M-07** account deletion · **S-01** host routing · **A-01** executing integration test ·
**A-02** capability policy + route gating · **A-03** crash reporting · **A-04** iOS privacy manifest ·
**A-05** iOS release pipeline · **$-07** refund UI · **L-01** privacy policy · **L-02** terms ·
plus **D-02** CI on the working branch.

Four more are **actively violated** and require removal or an ARB waiver rather than construction:
**M-03** second issuer · **T-02** 22 permissive policies · **$-02** multi-writer `merchant_payable` ·
**D-07** third-party code in a live path.

**No honest V1 launch is possible while any of these stands.** This register is the reason doc 15
returns NO-GO, and it is deliberately not shortened to make the number look better.
