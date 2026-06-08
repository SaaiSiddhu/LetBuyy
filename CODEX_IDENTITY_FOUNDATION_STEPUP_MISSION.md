<!-- Paste this entire file to Codex as the mission. It is self-contained. -->

# CODEX MISSION — LetBuyy Identity Platform Foundation Step-Up (single-go · all foundations · zero production behavior change)

> **Frame.** You are **not** migrating LetBuyy's auth and you are **not** cutting anyone over. You are **laying every rail** the approved Identity Platform architecture needs so that *future* waves can migrate safely — and you are doing it while keeping **production behavior byte-for-byte identical**. The 26 architecture documents in `docs/auth/2026-06-08-identity-platform-transformation/` already decided the destination; they also **explicitly forbid a big-bang cutover** and mandate dual-run, shadow mode, feature flags, cohorted rollout, rollback paths, and parity verification. This mission builds all of that machinery **dormant**: packages, repositories, additive migrations, a key/JWKS service on mock signing, a disabled OIDC provider skeleton, an audit dual-write shim, a permission/session abstraction layer, and the shadow-comparison harness — every new path defaulting **off**.
>
> **The danger you are countering.** The single most common way identity migrations become unrecoverable is "fix everything in one cutover." This mission is the opposite: **maximum building, zero switching.** When you finish, the **old system still does 100% of the work**, the **new system is ~70–80% built but wired to nothing live**, **production risk is near zero**, and **migration readiness is massively higher**. That is the correct and only acceptable outcome of this phase.
>
> **One-line contract:** *Implement every foundation, every seam, every abstraction, every migration path, every dual-run capability, every rollback mechanism, every feature flag, and every shadow-comparison framework — while production login/session/permission behavior stays exactly as it is today.*

---

## 0. Non-negotiables (read first, obey always)

1. **ZERO PRODUCTION BEHAVIOR CHANGE — the prime directive.** When **all new feature flags are off (the default)**, every byte of observable behavior — merchant login, customer login, console login, mobile login, sessions, cookies, CSRF, RBAC, internal headers, redirects, error bodies — must be **identical** to `main` today. You prove this in the exit gate (§9). If you cannot add something without changing default behavior, you put it behind a flag (default off) or you mark it `SKIPPED (HUMAN-APPROVAL)` and build everything around it.
2. **ADDITIVE ONLY. DELETE NOTHING.** Do **not** remove or rewrite any existing auth flow, Supabase auth route, session cookie (`lb_session`, `lb_console_session`, `lb_customer_session`, `lb_accounts`, `lb_device`, `letbuyy_csrf`, `lb_csrf`), middleware branch, RBAC guard, internal-auth header path, or legacy table. New code lives **beside** the old, reached only when a flag is on. Legacy removal is a *future* wave and is out of scope.
3. **NEVER ENABLE THE NEW SYSTEM.** `FEATURE_IDENTITY_PROVIDER`, `FEATURE_OIDC_CLIENT`, `FEATURE_NEW_SESSION_ENGINE`, `FEATURE_NEW_PERMISSION_ENGINE`, `FEATURE_NEW_AUDIT_ENGINE`, and every other new flag default **false**. The OIDC endpoints return a disabled response when off. Shadow comparisons **log only**; they enforce nothing.
4. **GOVERNANCE IS LAW.** Obey root `AGENTS.md`, each local `AGENTS.md`, and `docs/governance/`. Run `node scripts/validate-governance.mjs` (a.k.a. `pnpm run validate:governance`) after every wave; it **must pass** (ignore only a pre-existing local `.next`/`node_modules` "stale artifact"/EPERM line, which is a local-build artifact, not a governance failure). Respect: **single-writer table ownership**, forward-only migrations, fail-closed internal routes, single-source helpers (INR/date/**crypto**/logger), route files ≤1500 lines, runtime-manifest honesty, no app→app or package→runtime imports, no tracked secrets/env, no deprecated app aliases, `site_id → public.sites` (never a new `stores` table).
5. **REUSE, DON'T DUPLICATE — reconcile with what already exists.** Several target tables already exist; you **extend** them, you do not create a second copy:
   - `consents` (migration `153_executable_identity_security.sql`) — reuse for OAuth/processing consent; do **not** create a new consents table.
   - `merchant_2fa_factors` (`121`) — the basis of `authenticators`; extend, don't replace.
   - `sessions`, `devices`, `verification_tokens`, `auth_password_set_intents` (`000_baseline`/`078`) — the basis of the new session/device/token model; wrap, don't fork.
   - `site_memberships`, `site_roles`, `site_role_permissions` — the basis of org/permission; the org graph builds **above** them.
   - `audit_logs`, `audit_activity_events` — the dual-write **sources** into `audit_events`; keep both writing.
   - The **mock KMS** in `services/api-gateway/src/lib/crypto.ts` (`KmsMode='mock'|'live'`) — the basis of the Key/JWKS service; extend its mock mode, don't add a parallel crypto.
   - `packages/tenant-core` — site/tenant resolution; the org graph reuses it, doesn't re-implement tenancy.
6. **NEVER BLOCK ON HUMANS.** No prompts, no waiting. If a step needs a secret, a provider account, a KMS, DNS/cert, a real Supabase region, a legal/business decision, or applying a migration to a real environment — mark it `SKIPPED (HUMAN-APPROVAL)` in the ledger, register it in `EXECUTABLE_HUMAN_REQUIRED.md` with an exact unblock command, **build every in-code part anyway** (behind a `SKIP_NEEDS_HUMAN_*` sentinel or mock adapter that degrades honestly), and continue. Reuse existing HR rows where they already cover it (HR-KMS-LIVE, HR-DLT-TRAI-LIVE, HR-WHATSAPP-LIVE, HR-ESP-LIVE, HR-TURNSTILE-LIVE, HR-LEGAL-DPDP-PA, HR-PROD-MIGRATE-DEPLOY).
7. **TRUTH OVER THEATER.** No fake data, no fake metrics, no unconditional "ready" badges, no internal sentinel leaking to a user. A dormant capability shows nothing to a user (it's flag-off and unreached) — it must not render `SKIP_NEEDS_HUMAN_*`, throw to a user, or print "coming soon." Mock signing/mock providers are clearly labelled mock in code and logs, never presented as live.
8. **GREEN BEFORE DONE.** Each wave ends with typecheck + lint + build + test passing for **every workspace you touched**, new migrations applying cleanly to a **local** Supabase and being reversible, and `validate-governance.mjs` green. Don't mark an issue `DONE` if anything you touched is red.
9. **EVIDENCE OR IT DIDN'T HAPPEN.** Every closed issue gets a ledger row (§6): layers touched, files changed, how you verified, the flag that gates it, and the test/validator result.
10. **SINGLE-GO, STRICT ORDER, NO SCOPE INVENTION.** Implement exactly the foundation issues in §7 (`F-001…`), in wave order `FW-0 → FW-13`, plus correctness defects you discover (log as `FOUND-###`). Do not start a wave until the prior wave's exit gate is green. Do not wander into the actual migration/cutover (that's a later mission). Do not add new top-level runtime roots (a new long-running service like ORY Hydra is `SKIPPED` → HR; build the *skeleton* inside existing runtimes).

---

## 1. Mission context — what you are completing

LetBuyy auth today (authoritative: `docs/auth/2026-06-08-auth-session-sso-cookie-architecture/AUTH_AUDIT_REPORT.md` + `CURRENT_AUTH_ARCHITECTURE.md`):
- **Topology is serverless:** frontends on **Vercel** (`apps/*`, incl. `apps/identity-platform`), services on **Cloudflare Workers** (`services/api-gateway`, `mobile-bff`, `webhook-service`, `queue-workers`; Hono; `wrangler.toml`), data on **Supabase Postgres**. Email = **Resend**; messaging = **Twilio WhatsApp**; payments = **Razorpay**.
- **The real auth authority is the API Gateway** (`services/api-gateway`), which owns `users_custom` + `sessions` and validates every request; the "Identity Platform" app is today a UI/orchestration shell. Apps read a cookie then assert identity to the gateway via a **shared-HMAC** internal header (`getLetbuyyInternalAuthSecret`).
- Three de-facto realms by cookie (`lb_session` merchant, `lb_customer_session` customer, `lb_console_session` admin); two identity stores (`users` + `users_custom`); two CSRF cookies; legacy Supabase Auth still present.
- Passwords are **bcrypt** (merchant cost 12 — `services/api-gateway/src/lib/merchant-password.ts`; customer cost 10 — `routes/storefront/customer-engagement-routes.ts`). MFA factor storage exists (`merchant_2fa_factors`, totp+passkey) but enforcement is not wired.

**The destination you are building rails toward** (authoritative — read before coding): the 26 documents in `docs/auth/2026-06-08-identity-platform-transformation/`, especially `IDENTITY_IMPLEMENTATION_MASTER_PLAN.md` (Wave 0 = this mission), `FOUNDATION_REFACTOR_PLAN.md` (the seams), `TARGET_AUTH_ARCHITECTURE.md`, `IDENTITY_DATA_MODEL.md` (tables), `SESSION_MANAGEMENT.md`, `TOKEN_STRATEGY.md`, `KEY_MANAGEMENT_ARCHITECTURE.md` (ES256/JWKS/mock), `PERMISSION_MODEL.md`, `ORGANIZATION_ARCHITECTURE.md`, `AUDIT_LOG_ARCHITECTURE.md`, `CUSTOMER_MIGRATION_ARCHITECTURE.md` (bcrypt→argon2id), `COMPLIANCE_ARCHITECTURE.md` (DPDP/DLT/residency), `IDENTITY_OPERATIONS_ARCHITECTURE.md` (HA/DR; the "Hydra breaks serverless" finding), and `IMPLEMENTATION_READINESS_REVIEW.md` (the findings A-1, P-1, D-1/2/3, AU-1, C-1…C-4, G-1…G-12 you are de-risking).

---

## 2. The insight that makes this finishable in one disciplined run

**Everything here is additive and dormant, so it cannot break production — which means it can all be built in one pass.** Three buckets:

- **Bucket A — pure additions (no wiring):** new `packages/*-core`, new repository interfaces, new additive migrations (empty tables), the mock Key/JWKS service, the disabled OIDC skeleton, the audit `audit_events` table. None of these is reachable by a production code path. Build freely.
- **Bucket B — dual-write / wrap (touch a live path, behavior preserved):** the audit dual-write shim (writes to `audit_events` *in addition to* legacy, never instead), the repository seams (callers still hit legacy tables through a new interface — same SQL, same result), the verification-token hashed shadow column (write both, read legacy). These touch live code but are **behavior-preserving by construction** and covered by parity tests.
- **Bucket C — shadow compare (observe only):** the parity harness computes the *new* decision next to the *legacy* decision, logs divergence, and **always returns the legacy result**. Pure observation.

**Rule:** when you add a capability, you also add (a) its feature flag (default off), (b) its parity/shadow hook where it shadows a live decision, and (c) a test proving "flag off ⇒ legacy path unchanged." Nothing is left half-wired or silently live.

---

## 3. Ownership discipline & boundaries (don't break governance)

1. **One writer per table.** Each **new** table (`principals`, `credentials`, `authenticators`, `recovery_codes`, `refresh_chains`, `refresh_tokens`, `account_links`, `oauth_clients`, `oauth_grants`, `authorization_codes`, `federation_tokens`, `organizations`, `org_memberships`, `teams`, `team_memberships`, `store_memberships`, `org_store_links`, `delegations`, `invitations`, `ownership_transfers`, `signing_keys`, `risk_signals`, `security_events`, `audit_events`) gets **one declared writer module** (a repository in the relevant `*-core` package or a single gateway lib). Reused tables keep their existing writer. Document ownership where the validator expects it; run the validator.
2. **Migrations are forward-only, additive, reversible.** Add `database/supabase/migrations/NNN_identity_foundation_*.sql` starting at **159** (highest today is `158`). Never edit `000_baseline.sql` or any applied migration. Every new table: PK, FKs, indexes, the **`update_updated_at()`** trigger (that exact name), `created_at/updated_at/created_by/updated_by/deleted_at`, and **real RLS** (service-role + tenant predicate via `site_id → public.sites` / `org_id`), matching the modern pattern (e.g. `153`, `076`). Tenant scope is `site_id`; "store" is UI/URL only — **no `stores` table**.
3. **Shared-package changes are additive & backwards-compatible.** `packages/auth-core` is imported by every runtime — **do not break a single export signature**. Decompose by **adding** new submodules/interfaces (`@letbuyy/auth-core/<new>`), and by creating the new `*-core` packages; keep all existing exports working unchanged. A breaking change is `SKIPPED (HUMAN-APPROVAL)` — add a new additive API instead.
4. **Single-source helpers.** Reuse the gateway `lib/crypto.ts` (extend its mock-KMS), the shared logger, `@letbuyy/ui` formatting, `@letbuyy/api-client` base-URL helpers, `packages/tenant-core` for site resolution. No duplicated crypto/logger/format. No `console.log` in source; no new `any` without a local type.
5. **No new runtime roots.** Do not stand up a new long-running service. ORY Hydra (a stateful container) is **out of code scope** → `SKIPPED (HUMAN-APPROVAL)` HR-HYDRA-LIVE; build the **OIDC provider skeleton** as gated routes inside `apps/identity-platform` and/or `services/api-gateway` only. Reserved manifest-only services (`services/event-bus`, `services/search-service`, etc.) stay placeholders.
6. **Generated files.** Never hand-edit `AGENTS.md` or generated topology/intelligence. After adding packages/routes/migrations, regenerate via the script and commit only the diff. Register new `packages/*-core` in the runtime manifests the validators check.
7. **Don't revert user-owned dirty work.** The worktree may be dirty; treat it as user-owned. Stay on the current branch if isolation would collide; log branch/PR creation as a SKIP per the established pattern.

---

## 4. Execution model (single-go, wave-based, strict order)

Work top-to-bottom `FW-0 → FW-13`. Each wave: implement every issue across all needed layers (**migration → `*-core` package → repository seam → gateway/identity wiring (dormant) → flag → shadow hook → test → ledger**), run §9 gates, commit per issue, update ledger/status. **Do not start a wave until the prior wave's exit gate is green.** Dependency order matters: packages and migrations precede the seams that use them; seams precede the shadow harness that compares through them; the OIDC skeleton precedes nothing live.

- **FW-0 — Baseline, ledger, flag registry, parity guardrails.** No new capability.
- **FW-1 — Foundation packages** (`*-core` skeletons; auth-core decomposition, additive).
- **FW-2 — Repository/boundary seams** (point at legacy tables).
- **FW-3 — Additive DB migrations** (159+, empty tables, RLS, reconciled with existing).
- **FW-4 — Feature flag + kill-switch registry** (all default off).
- **FW-5 — Audit core dual-write shim** (legacy + `audit_events`; mock hash-chain).
- **FW-6 — Key & JWKS service** (mock signing, ES256, realm key registry; HR-KMS-LIVE for real).
- **FW-7 — Realm registry + session/cookie/refresh/revocation abstractions** (wrap, don't replace).
- **FW-8 — OIDC provider skeleton** (disabled) + gateway verifier-registry refactor (dormant IdP branch).
- **FW-9 — Parity/shadow harness + permission engine skeleton** (compare-only) + decision log + legacy counters.
- **FW-10 — Migration scaffolding** (dry-run reconciliation + backfill writers + credential layer-hash design, all off).
- **FW-11 — Safe quick-wins** (additive/shadow only — token hashing shadow column, flag-gated CSRF/raw-token, per-user admin TOTP scaffold).
- **FW-12 — Compliance/ops scaffolds + human-required registry** (DLT/WhatsApp/Resend/Turnstile mock adapters, residency config, SOC2 control map, HR rows).
- **FW-13 — Final gate** (prove production-identical, all flags off, tables empty, OIDC disabled; full suite + status rollup).

**Commit discipline:** one commit per issue or tight group; message `feat(identity-foundation): #F-NNN <short> [FW-N]` / `feat(db): #F-NNN <migration> [FW-N]` / `chore(identity-foundation): …`. Regenerate topology/AGENTS after package/route/migration changes; commit only the regenerated diff.

---

## 5. Skip protocol & the human-approval catalog (reuse the repo's mechanism)

This repo already runs "local-only, mock externals, register live needs." **Reuse it.** When a step needs a human, log in the ledger **and** `EXECUTABLE_HUMAN_REQUIRED.md`, then continue:

```
- #F-NNN <title> — SKIPPED (HUMAN-APPROVAL)
  Reason: <secret / KMS / provider account / DNS / legal / prod migration / deploy / infra>
  Unblock: <exact command or decision a human must provide>
  Done anyway: <every in-code part built + mock/sentinel used + how it stays dormant/honest>
  HR: <HR-id in EXECUTABLE_HUMAN_REQUIRED.md>
```

**Pre-identified skips (build everything except the human bit; most already have an HR row):**

| Area | Build now (in code) | SKIP (needs human) | HR id |
|---|---|---|---|
| Real KMS/HSM signing | Key/JWKS service on the **existing mock KMS** (`crypto.ts`), ES256 mock keys, rotation, realm registry | provision live KMS, key IDs, envelope secrets | **HR-KMS-LIVE** (exists) |
| ORY Hydra runtime | OIDC **skeleton** routes (gated off) inside identity-platform/gateway | stand up the Hydra managed container in `ap-south-1` | **HR-HYDRA-LIVE** (add) |
| SMS DLT / OTP | DLT-SMS **mock** adapter + WhatsApp(Twilio)/email(Resend) mock adapters with honest degradation | DLT entity/header/template registration; WABA templates; Resend domain auth | **HR-DLT-TRAI-LIVE**, **HR-WHATSAPP-LIVE**, **HR-ESP-LIVE** (exist) |
| Turnstile | keep existing flow; new risk-signal hook reads it | issue live keys | **HR-TURNSTILE-LIVE** (exists) |
| Data residency | region **config placeholder** + checks | pin/verify Supabase `ap-south-1`; sign DPAs | **HR-RESIDENCY-DPDP** (add), **HR-LEGAL-DPDP-PA** (exists) |
| Prod migration/deploy | local migrations only | apply to staging/prod; deploy | **HR-PROD-MIGRATE-DEPLOY** (exists) |
| Decision-log sign-offs | implement the documented default; gate the confirmation | Hydra A/B, ES256-vs-EdDSA, authz-boundary A-1, fiduciary/processor, children's-data | **HR-IDENTITY-DECISIONS** (add) |

---

## 6. Ledger & status discipline (you own these files)

Create and maintain, in the repo-root convention:
- **`CODEX_IDENTITY_FOUNDATION_STEPUP_STATUS.md`** — live status: wave, issue states (`PENDING/DOING/DONE/SKIPPED`), gate results, the "production-identical" proof, and the flag table (every new flag + default + what it gates).
- **`CODEX_IDENTITY_FOUNDATION_STEPUP_LEDGER.md`** — one row per issue: layers, files, flag, how verified, test/validator result, any `FOUND-###`.
- Append identity rows to **`EXECUTABLE_HUMAN_REQUIRED.md`** (don't duplicate existing HR rows; reference them).

A wave is not `DONE` until its exit gate (§8) is green and the status/ledger reflect it.

---

## 7. Foundation issue register (`F-NNN`)

> Each issue: **what to build · where · gate flag · acceptance · source doc**. Unless stated, the default flag is **off** and the issue must not change production behavior. "Dormant" = compiled and tested but unreachable by a flag-off production path.

### FW-0 — Baseline, ledger, flag registry, parity guardrails
- **F-001 Mission ledger/status.** Create `CODEX_IDENTITY_FOUNDATION_STEPUP_STATUS.md` + `_LEDGER.md` (§6). *Acceptance:* both exist, list all waves/issues as PENDING.
- **F-002 Green baseline snapshot.** Run typecheck/lint/build/test + `validate-governance.mjs`; record the baseline (incl. the known `.next` EPERM line to ignore). *Acceptance:* baseline captured in STATUS.
- **F-003 Central feature-flag registry.** Extend `apps/identity-platform/src/lib/config/features.ts` **and** add a shared `packages/auth-core/src/feature-flags.ts` (or a new `@letbuyy/identity-core/flags`) enumerating every new flag, all `=== 'true'` (default off). *Acceptance:* one source of truth; flags resolve false with no env. Source: `FOUNDATION_REFACTOR_PLAN.md`.
- **F-004 Production-identity guard test.** Add a test suite `tests/identity-foundation/production-parity.test.ts` that asserts, with all flags off: cookie names/attributes, middleware branch order, and auth route responses match golden snapshots of current behavior. *Acceptance:* passes on `main` behavior. This test is the contract for Non-negotiable #1.
- **F-005 Decision-log + HR registry seed.** Append `HR-HYDRA-LIVE`, `HR-RESIDENCY-DPDP`, `HR-IDENTITY-DECISIONS` to `EXECUTABLE_HUMAN_REQUIRED.md`; cross-reference existing HR-KMS/DLT/WHATSAPP/ESP/TURNSTILE/LEGAL/PROD. *Acceptance:* registry rows present with unblock commands.

### FW-1 — Foundation packages (additive skeletons)
- **F-010 `@letbuyy/identity-core`.** New package: principal/realm/account-link types, the `ActorType`/`SessionKind` re-exports from auth-core, the subject-claims contract (`TARGET_AUTH_ARCHITECTURE.md` §5). Interfaces only.
- **F-011 `@letbuyy/token-core`.** Token type definitions + (mock) sign/verify interfaces for ID/access/refresh/auth-code/device-code/magic-link/reset/verify/federation/M2M (`TOKEN_STRATEGY.md`). No real keys (uses Key service, FW-6).
- **F-012 `@letbuyy/session-core`.** `SessionService`/`RefreshTokenService`/`RevocationService`/`CookiePolicyService` interfaces + DTOs (`SESSION_MANAGEMENT.md`). Implementations dormant.
- **F-013 `@letbuyy/permission-core`.** Permission/role/scope/resource catalog types; ReBAC/RBAC/ABAC decision interface; `resource.action` naming + legacy-alias map (`PERMISSION_MODEL.md`). Engine is shadow-only (FW-9).
- **F-014 `@letbuyy/organization-core`.** Org/team/membership/delegation/invitation/transfer types built **above** `packages/tenant-core` (reuse site resolution; do not re-implement tenancy). (`ORGANIZATION_ARCHITECTURE.md`).
- **F-015 `@letbuyy/audit-core`.** Canonical `audit_events` envelope + typed `emit()` SDK + taxonomy enums (`AUDIT_LOG_ARCHITECTURE.md`). Dual-write impl in FW-5.
- **F-016 auth-core decomposition (additive).** Add submodule interfaces in `packages/auth-core` (`/rp-sdk`, `/cookies`, `/keys`, `/session`, `/legacy`) that **re-export existing behavior unchanged**; quarantine the symmetric/HMAC helpers under `/legacy` **without removing them**. *Acceptance:* every current `auth-core` import still resolves identically; no signature change. Source: `FOUNDATION_REFACTOR_PLAN.md` §2.
- **F-017 Register packages.** Add the six packages to workspace + runtime manifests; regenerate topology/AGENTS; `validate-governance` green. *Acceptance:* no import-governance or manifest-honesty violation.

### FW-2 — Repository/boundary seams (point at legacy tables)
- **F-020 `PrincipalRepository`** → reads `users_custom` (+ `users` profile) / `store_customers` / `employees` behind one interface; same results as today.
- **F-021 `CredentialRepository`** → `users_custom.password_hash` / `customer_credentials`; verify dispatches on a hash-scheme tag (bcrypt today).
- **F-022 `SessionRepository`** → `sessions` (+ cookie readers for `lb_customer_session`/`lb_console_session`); identical lookups.
- **F-023 `AuthenticatorRepository`** → `merchant_2fa_factors` (+ `super_admin_allowlist.two_factor_secret`); read-through.
- **F-024 `ConsentRepository`** → existing `consents` table (reuse, do not create new).
- **F-025 `DeviceRepository`** → `devices`/`device_tokens`.
- **F-026 `VerificationTokenRepository`** → `verification_tokens` (+ `auth_password_set_intents`).
- **F-027 `OrgRepository` / `MembershipRepository`** → `site_memberships`/`site_roles`/`site_role_permissions` (graph read façade; org tables empty for now).
- **F-028 `OAuthClientRepository`** → `app_installations` + `site_api_clients` (read-through).
- **F-029 `AuditRepository`** → `audit_logs`/`audit_activity_events` (read) + `audit_events` (write, FW-5).
- **F-030 Wire repositories via the gateway IdentityRepository boundary** *without changing callers' results*: existing routes may call through the repo, but the SQL and outputs are identical. *Acceptance:* F-004 parity test still green. Source: `FOUNDATION_REFACTOR_PLAN.md` §4.

### FW-3 — Additive DB migrations (159+, empty, RLS, reconciled)
> One or a few coherent migrations per group; **all tables empty, no production reads**. Match the `153`/`076` RLS+trigger pattern. Reconcile: extend `consents`/`merchant_2fa_factors`/`sessions`/`devices`/`verification_tokens`/`site_memberships`; never duplicate.
- **F-040 `principals` + `account_links`.** Realm-tagged directory (seed-able later from `users_custom`/`store_customers`/`employees`). Source: `IDENTITY_DATA_MODEL.md` §2.
- **F-041 `credentials`.** Per-credential rows; `algo`/`params` scheme tag (bcrypt/argon2id(bcrypt)/argon2id). §3.
- **F-042 `authenticators` + `recovery_codes`.** Extend `merchant_2fa_factors` model to all realms (totp/passkey/hardware_key) + normalized recovery codes. §3.
- **F-043 `sessions_v2` + `refresh_chains` + `refresh_tokens`.** New revocable session + rotating refresh (reuse-detection columns). Keep legacy `sessions` untouched. §4.
- **F-044 `oauth_clients` + `oauth_grants` + `authorization_codes`.** Unify app/M2M clients + consent (reuse `consents` where the row is a processing-consent; `oauth_grants` for scope grants). §5.
- **F-045 `federation_tokens`.** Single-use cross-domain (replay store). §6.
- **F-046 `verification_tokens_v2`** (hashed) **or** add a `token_hash` shadow column to `verification_tokens` (FW-11 dual-writes it). §6.
- **F-047 Org graph:** `organizations`(+`parent_org_id`), `org_memberships`, `teams`, `team_memberships`, `store_memberships`, `org_store_links`, `delegations`, `invitations`, `ownership_transfers`. `store_id → public.sites`. `ORGANIZATION_ARCHITECTURE.md` §3.
- **F-048 `signing_keys`.** Per-realm key versions (public JWK + KMS ref). `KEY_MANAGEMENT_ARCHITECTURE.md`.
- **F-049 `risk_signals` + `security_events`.** `IDENTITY_DATA_MODEL.md` §8.
- **F-050 `audit_events`.** Canonical ledger (envelope columns + hash-chain columns `seq/prev_hash/hash`). `AUDIT_LOG_ARCHITECTURE.md` §5.
- **F-051 Single-writer + RLS verification.** Declare one writer per new table; `validate-governance` green (single-writer, RLS, trigger-name, no `stores` table). *Acceptance:* migrations apply + reverse locally.

### FW-4 — Feature-flag & kill-switch registry
- **F-070 Define all flags (default off):** `FEATURE_IDENTITY_PROVIDER`, `FEATURE_OIDC_CLIENT`, `FEATURE_NEW_SESSION_ENGINE`, `FEATURE_NEW_PERMISSION_ENGINE`, `FEATURE_NEW_AUDIT_ENGINE`, `FEATURE_AUDIT_DUAL_WRITE`, `FEATURE_NEW_KEY_SERVICE`, `FEATURE_ORG_MODEL`, `FEATURE_NEW_MFA_ENGINE`, `FEATURE_SHADOW_AUTH`, `FEATURE_SHADOW_PERMISSION`, `FEATURE_SHADOW_SESSION`, `FEATURE_TOKEN_HASH_SHADOW`, `FEATURE_NEW_CSRF`, `FEATURE_PERUSER_ADMIN_TOTP`.
- **F-071 Kill-switch semantics.** Each flag has an instant off; shadow flags never affect responses. Document in STATUS flag table.
- **F-072 Flag tests.** Prove default-off for every flag and that turning a *shadow* flag on changes no response (only logs). *Acceptance:* F-004 stays green with shadow flags on.

### FW-5 — Audit core dual-write shim
- **F-080 `audit-core` emit() + envelope** (actor/subject/target/context with `correlation_id`/`session_id`/`request_id`/device/location/risk_level). `AUDIT_LOG_ARCHITECTURE.md` §3.
- **F-081 Dual-write shim** behind `FEATURE_AUDIT_DUAL_WRITE`: existing `audit_logs`/`audit_activity_events` inserts **also** write `audit_events` (never instead). Off ⇒ legacy only. *Acceptance:* flag on ⇒ both written, identical legacy row; flag off ⇒ unchanged.
- **F-082 Hash-chain (mock-anchored).** Compute `seq/prev_hash/hash`; anchor with the mock Key service (real anchoring HR-KMS-LIVE). §6.
- **F-083 actor_type reconciliation.** Map the two legacy enums (`user/employee/super_admin/system` vs `user/customer/employee/system/webhook`) to the canonical set. §11.
- **F-084 Taxonomy + redaction.** Implement the event taxonomy enums; PII fields crypto-shred-ready (encrypted column placeholders). §2/§GDPR.
- **F-085 Audit dual-write tests + ledger.** *Acceptance:* parity of legacy rows preserved.

### FW-6 — Key & JWKS service (mock signing)
- **F-090 `KeyService`** on the existing **mock KMS** (`services/api-gateway/src/lib/crypto.ts`): generate/wrap per-realm signing keys; **ES256** in mock (note: real KMS can't HSM-sign Ed25519 — `KEY_MANAGEMENT_ARCHITECTURE.md` §1). Real KMS = HR-KMS-LIVE.
- **F-091 `RealmKeyRegistry`** (merchant/customer/admin key sets + `kid`).
- **F-092 JWKS service + endpoints** `/.well-known/jwks.json` per realm (mock public keys). Served but trusted by nothing (verifier dormant, FW-8).
- **F-093 Rotation service** (publish-ahead, overlap window, fetch-on-unknown-kid). §4.
- **F-094 Audit-anchor key** (separate custody handle). §3.
- **F-095 Compromise-runbook stub** + key-state machine (active/next/retiring/revoked).
- **F-096 Map legacy symmetric secrets → key registry** (document `AUTH_SECRET`/`CUSTOMER_SESSION_SECRET`/`PLATFORM_CONSOLE_SESSION_SECRET`/`INTERNAL_API_SECRET`/`PLATFORM_CONSOLE_TOTP_SECRET` as **future** replacements; do **not** remove). §5.
- **F-097 Key service tests** (mock sign/verify round-trip; rotation; gated by `FEATURE_NEW_KEY_SERVICE`).

### FW-7 — Realm registry + session/cookie/refresh/revocation abstractions
- **F-100 Realm registry** (merchant/customer/admin: issuer, audience, cookie name, TTLs, MFA policy — config only). `REALM_ARCHITECTURE.md`.
- **F-101 `SessionService` impl** over `sessions_v2` (create/validate/refresh/revoke), dormant behind `FEATURE_NEW_SESSION_ENGINE`. Existing `sessions` path untouched.
- **F-102 `RefreshTokenService`** (rotation + reuse-detection) on `refresh_chains/refresh_tokens`. Dormant.
- **F-103 `RevocationService`** (revoked-`sid` cache interface; in-memory/Redis-ready). Dormant.
- **F-104 `CookiePolicyService`** (realm-aware `__Host-` policy) — **does not set any cookie in production**; existing cookie setters unchanged. `SESSION_MANAGEMENT.md` §6.
- **F-105 Device-trust + idle/absolute-timeout logic** in session-core (dormant). §2/§5.
- **F-106 Session abstraction tests** (flag off ⇒ legacy `lb_session` flow byte-identical).

### FW-8 — OIDC provider skeleton (disabled) + verifier registry
- **F-120 Discovery + endpoints (gated `FEATURE_IDENTITY_PROVIDER=false`):** `/.well-known/openid-configuration`, `/jwks`, `/oauth2/authorize`, `/oauth2/token`, `/oauth2/userinfo`, `/oauth2/logout` in `apps/identity-platform` (and/or gateway). **Off ⇒ return a clean disabled response (404/501), never a half-working flow.** `OIDC_CLIENT_INVENTORY.md`/`SSO_ARCHITECTURE.md`.
- **F-121 Login/consent callback skeleton** (the Hydra-facing handlers) — mock provider only; real Hydra = HR-HYDRA-LIVE.
- **F-122 PKCE + auth-code skeleton** (single-use, ≤60s) on `authorization_codes` — dormant.
- **F-123 Token endpoint skeleton** (auth-code/refresh/client-credentials/device-code shapes) using token-core + mock Key service — dormant.
- **F-124 Gateway verifier-registry refactor** (`services/api-gateway/src/middleware/auth.ts`): convert the 4 existing branches into registered verifiers producing one `AuthContext`, **behaviorally identical**, and **add a dormant IdP-token verifier** (`FEATURE_OIDC_CLIENT`) that verifies a mock IdP JWT via JWKS but is **not** in the active chain when off. `FOUNDATION_REFACTOR_PLAN.md` §3 / `ZERO_TRUST_ARCHITECTURE.md` §5.
- **F-125 Per-route realm/aud/acr metadata scaffold** (declarations only; not enforced). `PERMISSION_MODEL.md` §11.
- **F-126 OIDC skeleton tests** (disabled returns disabled; verifier-registry parity with legacy branches; flag-off chain identical).

### FW-9 — Parity/shadow harness + permission engine (compare-only)
- **F-140 `shadow_auth_compare`** — on each real auth decision, compute the new-path decision and **log divergence**; always return legacy. Gated `FEATURE_SHADOW_AUTH`.
- **F-141 `shadow_session_compare`** — same for session validation. `FEATURE_SHADOW_SESSION`.
- **F-142 `shadow_permission_compare`** — same for authz decisions. `FEATURE_SHADOW_PERMISSION`.
- **F-143 Permission engine skeleton** (ReBAC→RBAC→ABAC, deny-overrides) over the org/role catalogs — **shadow-only**, enforces nothing. `PERMISSION_MODEL.md` §1/§6.
- **F-144 Permission catalog registry + legacy alias** (`site_role_permissions`/`employee_permissions` strings → canonical `resource.action`). §13.
- **F-145 Auth decision log** (structured: verifier, realm, sid, allow/deny) + **legacy-path counters** (per legacy verifier) — the gates for future deletions. `FOUNDATION_REFACTOR_PLAN.md` §6.
- **F-146 Parity dashboards/metrics hooks** (divergence rate, legacy traffic). `IDENTITY_OPERATIONS_ARCHITECTURE.md` §7.
- **F-147 Shadow tests** (shadow on ⇒ zero response change; divergence logged). *Acceptance:* F-004 green with all shadow flags on.

### FW-10 — Migration scaffolding (dry-run, off)
- **F-160 Reconciliation report generator** (`users` vs `users_custom`, null-password, duplicate-email, orphan stores) — **read-only**, outputs a report artifact. `CUSTOMER_MIGRATION_ARCHITECTURE.md` §6, readiness A-3.
- **F-161 Backfill writers** (principals/credentials/authenticators/org graph from legacy) — **write new empty tables only; nothing reads them**; idempotent, resumable cursor (reuse `audit_export_cursors` pattern). §4.
- **F-162 Credential layer-hash routine (DRY-RUN)** — compute `argon2id(bcrypt_hash)+pepper` for sample rows **without writing**; prove the verify path; pepper from mock KMS. §1. (Real run = future wave.)
- **F-163 Customer store-scoped mapper** (`store_customers` → customer-realm principals, no cross-store merge). §5.
- **F-164 Session/MFA continuity plan encoded as tests** (dual-accept stubs; no production session touched). §7.
- **F-165 Backfill dashboards + idempotency tests.** *Acceptance:* dry-run produces report; backfill writes only to new tables; re-run is idempotent; legacy untouched.

### FW-11 — Safe quick-wins (additive / shadow only — **no live behavior change**)
> Correction to the naive "do it now" list: these are **behavior changes**, so they ship **flag-gated/shadow**, not as live removals.
- **F-180 Verification-token hashing (shadow).** Dual-write `token_hash` alongside the existing plaintext `token` (`FEATURE_TOKEN_HASH_SHADOW`); **reads still use legacy**. No plaintext removed. (Removal is a future wave.) `TOKEN_STRATEGY.md` §5.
- **F-181 New CSRF path (flag-gated).** Implement the `__Host`/SameSite token-bound CSRF behind `FEATURE_NEW_CSRF`; **keep `letbuyy_csrf` + legacy `lb_csrf` acceptance intact** when off. `SESSION_MANAGEMENT.md` §7.
- **F-182 Raw-token-in-JSON: add a flagged sanitized path** (do **not** remove the legacy raw fields yet; future wave). Document the call-sites. Audit §Security Findings.
- **F-183 Per-user admin TOTP scaffold.** Build per-user admin factors in `authenticators` behind `FEATURE_PERUSER_ADMIN_TOTP`; **do not delete** the shared `PLATFORM_CONSOLE_TOTP_SECRET` path. `KEY_MANAGEMENT_ARCHITECTURE.md` §5 / `CUSTOMER_MIGRATION_ARCHITECTURE.md` §7.
- **F-184 Quick-win tests** (each flag off ⇒ identical legacy behavior; on ⇒ new path works in isolation).

### FW-12 — Compliance/ops scaffolds + human-required registry
- **F-200 OTP channel mock adapters** — WhatsApp(Twilio) + email(Resend) + **DLT-SMS** behind `packages/infrastructure` adapters, **mock mode**, honest degradation; selection logic (WhatsApp+email primary, SMS fallback). `COMPLIANCE_ARCHITECTURE.md` §4. Live = HR-DLT/WHATSAPP/ESP.
- **F-201 Residency config placeholder** (`ap-south-1`) + a check that flags non-region config. HR-RESIDENCY-DPDP. §6.
- **F-202 Rights/consent/erasure interfaces** over existing `consents` + crypto-shred hooks (interfaces; no production deletion). §5 / `IDENTITY_DATA_MODEL.md` §10.
- **F-203 SOC2 control-map doc** `docs/auth/.../SOC2_CONTROL_MAP.md` linking controls → code/audit evidence. §7.
- **F-204 Operations scaffolds** — health/SLO metric hooks for identity surfaces, JWKS-cache hit counter, synthetic-probe stubs (no new service). `IDENTITY_OPERATIONS_ARCHITECTURE.md` §6/§7.
- **F-205 HR registry finalize** — every deferred live dependency has a row + unblock command; nothing silently incomplete.

### FW-13 — Final gate (prove production-identical)
- **F-220 Full suite** — typecheck/lint/build/test for every touched workspace; `flutter analyze`/`test` if mobile touched; `validate-governance.mjs` green.
- **F-221 Production-identical proof** — with all flags off: F-004 golden snapshots pass; new tables are empty; OIDC endpoints return disabled; legacy auth/session/RBAC/cookies unchanged; internal-header path intact. Record the proof in STATUS.
- **F-222 Migration safety** — all new migrations apply + reverse on a clean local Supabase; single-writer/RLS validators green.
- **F-223 Shadow-on smoke** — enable shadow flags in a local/staging-style run; confirm zero response change + divergence logging works.
- **F-224 Status rollup** — STATUS shows every issue DONE/SKIPPED with the flag table, the HR registry, the readiness-finding coverage map (which F-issue closes which doc finding), and the explicit statement: *"Old system 100% operational; new system built and dormant; production behavior unchanged."*

---

## 8. Wave exit gates (do not advance until green)

| Wave | Exit gate |
|------|-----------|
| FW-0 | Ledger/status exist; baseline + parity golden test green; flag registry resolves all-false. |
| FW-1 | Six `*-core` packages build; auth-core exports unchanged; manifests/topology regenerated; governance green. |
| FW-2 | All repositories compile and return **identical** results to current SQL; parity test green. |
| FW-3 | All migrations apply+reverse locally; tables empty; single-writer/RLS/trigger validators green; no `stores` table. |
| FW-4 | Every flag defaults off; shadow-on changes no response. |
| FW-5 | Dual-write on ⇒ `audit_events` + legacy both written, legacy identical; off ⇒ legacy only. |
| FW-6 | Mock ES256 sign/verify + JWKS + rotation pass; legacy secrets untouched. |
| FW-7 | New session/cookie services dormant; `lb_session`/`lb_customer_session`/`lb_console_session` flows byte-identical. |
| FW-8 | OIDC endpoints return disabled when off; verifier-registry parity with the 4 legacy branches; dormant IdP verifier off-chain. |
| FW-9 | Shadow compares log divergence and change nothing; decision log + legacy counters emit. |
| FW-10 | Reconciliation report generates; backfill writes only new tables; dry-run hashing proven; legacy untouched. |
| FW-11 | Each quick-win flag off ⇒ identical legacy behavior. |
| FW-12 | Mock provider/residency/rights/SOC2/ops scaffolds present; HR registry complete. |
| FW-13 | Production-identical proof recorded; full gate suite green; status rollup complete. |

---

## 9. The gate suite (run after every wave)

1. `pnpm -w typecheck` (or per touched workspace) — green.
2. `pnpm -w lint` — green; no `console.log`/unjustified `any` in new source.
3. `pnpm -w build` — green for touched workspaces.
4. Tests — unit + the `tests/identity-foundation/*` parity/flag/shadow suites + `tests/contracts/*`; `flutter analyze && flutter test` if mobile touched.
5. New migrations apply + reverse on a **local** Supabase.
6. `node scripts/validate-governance.mjs` — green (ignore only the known local `.next`/`node_modules` stale-artifact/EPERM line).
7. Regenerate topology/AGENTS after structural changes; commit only the diff.
8. Update STATUS/LEDGER; commit per issue.

---

## 10. Definition of done (stop only here)

Stop when **all** are true:
1. Every `F-NNN` is `DONE` or `SKIPPED (HUMAN-APPROVAL)` with everything in-code built around the skip and an HR row.
2. **Production behavior is byte-for-byte unchanged with default flags** (F-221 proof recorded).
3. The new system is built and **dormant**: six packages, all repositories, all additive migrations (empty), the mock Key/JWKS service, the disabled OIDC skeleton, the audit dual-write shim, the session/permission/realm abstractions, the shadow harness, and the migration scaffolding — all present, tested, flag-off.
4. `validate-governance.mjs` and the full gate suite are green.
5. `CODEX_IDENTITY_FOUNDATION_STEPUP_STATUS.md` ends with the rollup: issue table, flag table, HR registry, readiness-finding→F-issue coverage map, and the sentence *"Old system 100% operational; new system built and dormant; production behavior unchanged; migration readiness maximized."*
6. **Do not** proceed to enabling any flag, cutting over any realm, migrating real credentials, or deleting any legacy path. That is the next mission. **Stop and report.**

> **Remember the shape of success:** Old system **100% works**. New system **~70–80% built**. Production risk **near zero**. Migration readiness **massively higher**. If at any point a change would alter default production behavior, that change is wrong for this phase — flag it off or skip it. Build the rails; don't switch the track.

---

*Self-contained mission. Authoritative inputs: the 26 documents in `docs/auth/2026-06-08-identity-platform-transformation/` and the audit pair in `docs/auth/2026-06-08-auth-session-sso-cookie-architecture/`. House conventions: root + local `AGENTS.md`, `docs/governance/`, `EXECUTABLE_HUMAN_REQUIRED.md`, the `CODEX_*_STATUS/LEDGER` pattern, and `scripts/validate-governance.mjs`.*
