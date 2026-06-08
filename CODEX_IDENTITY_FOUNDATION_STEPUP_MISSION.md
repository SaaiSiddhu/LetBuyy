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
