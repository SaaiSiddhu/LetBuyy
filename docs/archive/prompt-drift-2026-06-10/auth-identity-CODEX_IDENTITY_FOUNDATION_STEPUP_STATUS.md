# Codex Identity Foundation Step-Up Status

Status date: 2026-06-09

## Current Position

Wave: FW-13 final gate complete.

Prime directive: production auth remains legacy-authoritative. No legacy auth route, cookie name, session cookie, CSRF fallback, RBAC decision, internal HMAC header path, Supabase bearer path, storefront customer path, or console session path was cut over to the new system.

Built in this pass: six foundation packages, default-off flag registry, additive migration 159 plus rollback 159, repository/boundary contracts, dormant gateway identity-foundation modules, mock ES256 key/JWKS infrastructure, disabled OIDC route surface, legacy auth verifier registry, session/cookie/refresh/revocation abstractions, audit dual-write row/hash-chain adapter, shadow compare/counter helpers, permission engine skeleton, migration/backfill/dry-run scaffolds, token-hash/CSRF/admin-MFA quick-win scaffolds, compliance/rights/ops scaffolds, mock OTP adapters, residency config, SOC2 map, parity and executable migration tests.

Not switched on: OIDC provider, OIDC client verifier, new session engine, new permission engine, new audit engine, audit dual-write, key service, org model, MFA engine, shadow comparisons, token-hash shadow writes, new CSRF, per-user admin TOTP.

## Gate Results

| Gate | Result | Evidence |
|---|---:|---|
| `pnpm -w typecheck` | PASS | Turbo: 71 successful / 71 total. |
| `pnpm -w lint` | PASS with warnings | Turbo: 9 successful / 9 total; warnings are existing UI/token/raw-control warning debt. |
| `pnpm -w build` | PASS | Turbo: 71 successful / 71 total. |
| `pnpm -w test` | PASS | Behavioral: 535 tests, 520 pass, 15 skipped, 0 fail. Contracts: 200 pass, 0 fail. |
| Package-local tests | PASS | API gateway unit: 230/230. Identity platform: 6/6 + 6/6. Auth-core: 2/2. |
| Migration apply + rollback | PASS | `tests/identity-foundation/identity-foundation-postgres.test.mjs` applies migration 159 and rollback 159 on the executable Postgres harness. |
| `node scripts/validate-governance.mjs` | PASS | Governance validation passed: 172 validators. |

## Feature Flags

All identity-foundation flags resolve `false` unless the exact environment value is `true`.

| Flag | Default | Gates |
|---|---:|---|
| `FEATURE_IDENTITY_PROVIDER` | false | Disabled OIDC provider discovery, auth, token, userinfo, logout, callback, consent, and JWKS skeletons. |
| `FEATURE_OIDC_CLIENT` | false | Dormant gateway IdP/JWKS verifier branch. |
| `FEATURE_NEW_SESSION_ENGINE` | false | `sessions_v2` session service implementation. |
| `FEATURE_NEW_PERMISSION_ENGINE` | false | Permission engine enforcement path. |
| `FEATURE_NEW_AUDIT_ENGINE` | false | Canonical audit engine implementation. |
| `FEATURE_AUDIT_DUAL_WRITE` | false | Legacy audit plus `audit_events` dual-write adapter. |
| `FEATURE_NEW_KEY_SERVICE` | false | Mock ES256 Key/JWKS service usage by token issuance. |
| `FEATURE_ORG_MODEL` | false | Organization graph runtime reads. |
| `FEATURE_NEW_MFA_ENGINE` | false | Normalized authenticator engine. |
| `FEATURE_SHADOW_AUTH` | false | Auth shadow comparisons. |
| `FEATURE_SHADOW_PERMISSION` | false | Permission shadow comparisons. |
| `FEATURE_SHADOW_SESSION` | false | Session shadow comparisons. |
| `FEATURE_TOKEN_HASH_SHADOW` | false | Verification-token hash dual-write. |
| `FEATURE_NEW_CSRF` | false | New token-bound `__Host-letbuyy_csrf` path. |
| `FEATURE_PERUSER_ADMIN_TOTP` | false | Per-user admin TOTP scaffold. |

## Issue States

| Wave | Issues | State | Notes |
|---|---|---|---|
| FW-0 | F-001 through F-005 | DONE | Status/ledger, baseline evidence, default-off flags, parity tests, HR rows. |
| FW-1 | F-010 through F-017 | DONE | Six packages compile; auth-core subpaths added without changing root exports; workspace/manifests registered. |
| FW-2 | F-020 through F-030 | DONE | Repository contracts and dormant implementations exist; the gateway boundary is exported without broad live-route SQL rewrites. |
| FW-3 | F-040 through F-051 | DONE | Migration 159 is additive, rollback 159 exists, executable apply/rollback passes, RLS/trigger/ownership checks pass, no `stores` table. |
| FW-4 | F-070 through F-072 | DONE | All flags default off; shadow flags remain response-neutral. |
| FW-5 | F-080 through F-085 | DONE | Audit envelope, actor reconciliation, taxonomy, redaction placeholder, canonical row builder, and mock hash-chain adapter exist. |
| FW-6 | F-090 through F-097 | DONE (mock only) | Mock ES256 KeyService, realm registry, JWKS, rotation, audit anchor key, compromise runbook, legacy-secret map. Live KMS remains HR-KMS-LIVE. |
| FW-7 | F-100 through F-106 | DONE | Realm registry, session, refresh, revocation, cookie policy, device/timeout/continuity scaffolds. Legacy cookies remain authoritative. |
| FW-8 | F-120 through F-126 | DONE | OIDC endpoints compile and default to disabled; callback/consent/auth-code/token skeletons exist; verifier registry preserves legacy branch order. |
| FW-9 | F-140 through F-147 | DONE | Auth/session/permission shadow helpers, permission engine skeleton, alias catalog, decision log/counter, metrics hooks, divergence tests. |
| FW-10 | F-160 through F-165 | DONE | Reconciliation report, idempotent backfill plans, credential layer-hash dry-run, store-scoped customer mapper, continuity plan. |
| FW-11 | F-180 through F-184 | DONE | Verification token hash planner, new CSRF planner, raw-token sanitization helper, per-user admin TOTP scaffold, tests. |
| FW-12 | F-200 through F-205 | DONE | Mock WhatsApp/email/DLT adapters, residency config, rights/erasure interface, SOC2 map, ops metric hooks, HR registry. |
| FW-13 | F-220 through F-224 | DONE | Full gate suite green; production-identical proof recorded. |

## Human-Required Registry

Existing rows referenced: HR-KMS-LIVE, HR-DLT-TRAI-LIVE, HR-WHATSAPP-LIVE, HR-ESP-LIVE, HR-TURNSTILE-LIVE, HR-LEGAL-DPDP-PA, HR-PROD-MIGRATE-DEPLOY.

Rows added for this mission: HR-HYDRA-LIVE, HR-RESIDENCY-DPDP, HR-IDENTITY-DECISIONS.

## Readiness Coverage Map

| Finding area | Foundation coverage |
|---|---|
| Big-bang/cutover risk | Default-off flags, shadow helpers, disabled OIDC, legacy verifier registry, status/ledger proof. |
| Key/JWKS readiness | Mock ES256 KeyService, JWKS/rotation/runbook/audit-anchor scaffolds; live KMS deferred to HR-KMS-LIVE. |
| Data model readiness | Migration 159 creates/extends identity tables additively with rollback, executable apply/reverse proof, RLS/ownership docs. |
| Audit readiness | Canonical audit envelope, `audit_events`, dual-write adapter, actor reconciliation, mock hash-chain. |
| Session/refresh readiness | Realm registry, `sessions_v2`, refresh/revocation/cookie policy abstractions, continuity helper. |
| Permission/org readiness | Organization core, org graph migration, permission catalog/alias map, shadow-only engine. |
| Migration readiness | Reconciliation report and idempotent backfill/dry-run credential layer-hash scaffolds. |
| Compliance/ops readiness | OTP mock adapters, residency config, rights/erasure interface, SOC2 map, health/metric hooks. |

## Production-Identical Proof

Default-off dormant foundation is verified by `tests/identity-foundation/production-parity.test.mjs`: current legacy cookie names, CSRF cookie names, identity cookie attributes, auth-core root export boundary, and gateway auth verifier order are snapshotted. The identity-platform OIDC/JWKS route surface is present but disabled by `FEATURE_IDENTITY_PROVIDER=false` by default. The gateway OIDC verifier is not in the active chain unless `FEATURE_OIDC_CLIENT=true`.

Old system 100% operational; new system built and dormant; production behavior unchanged; migration readiness maximized.
