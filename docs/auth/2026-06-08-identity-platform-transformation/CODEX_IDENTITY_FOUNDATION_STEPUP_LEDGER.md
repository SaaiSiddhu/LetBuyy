# Codex Identity Foundation Step-Up Ledger

Status date: 2026-06-09

## Ledger Rows

| Issue | State | Layers touched | Files / areas | Flag | Verification |
|---|---|---|---|---|---|
| F-001 | DONE | Docs | Step-up status + ledger under `docs/auth/2026-06-08-identity-platform-transformation/` | n/a | Source-ledger residue validator passes. |
| F-002 | DONE | Gates | Status file | n/a | Final gate results recorded; all current gates green. |
| F-003 | DONE | Auth-core, identity app | `packages/auth-core/src/feature-flags.ts`; `apps/identity-platform/src/lib/config/features.ts` | All new flags | Strict `env[flag] === 'true'`; defaults false; subpath export only. |
| F-004 | DONE | Tests | `tests/identity-foundation/production-parity.test.mjs` | All flags off | Cookie/auth branch/default-off golden tests pass. |
| F-005 | DONE | HR registry | `EXECUTABLE_HUMAN_REQUIRED.md` | n/a | HR-HYDRA-LIVE, HR-RESIDENCY-DPDP, HR-IDENTITY-DECISIONS added; existing HR rows referenced. |
| F-010 | DONE | Package | `packages/identity-core/*` | n/a | Interface-only principal/realm/account-link/subject claims package builds. |
| F-011 | DONE | Package | `packages/token-core/*` | `FEATURE_NEW_KEY_SERVICE` future use | Token contracts build; no live keys. |
| F-012 | DONE | Package | `packages/session-core/*` | `FEATURE_NEW_SESSION_ENGINE` | Session/refresh/revocation/cookie contracts build. |
| F-013 | DONE | Package | `packages/permission-core/*` | `FEATURE_NEW_PERMISSION_ENGINE`, shadow flags | Permission decision/catalog/alias contracts build. |
| F-014 | DONE | Package | `packages/organization-core/*` | `FEATURE_ORG_MODEL` | Org contracts reuse tenant-core and no `stores` table. |
| F-015 | DONE | Package | `packages/audit-core/*` | `FEATURE_NEW_AUDIT_ENGINE`, `FEATURE_AUDIT_DUAL_WRITE` | Canonical envelope/no-op emitter builds. |
| F-016 | DONE | Auth-core | `cookies`, `keys`, `rp-sdk`, `session`, `legacy` subpaths | n/a | Root exports preserved; auth-core tests pass. |
| F-017 | DONE | Workspace/governance | Workspace manifests, package deps, runtime manifest, validator root lists | n/a | Typecheck/build/governance pass. |
| F-020 through F-029 | DONE | Gateway boundary | `services/api-gateway/src/identity-foundation/repository-boundary.ts`; `repository-implementations.ts` | Multiple | Legacy table map, dormant implementations, no `stores` authority; tests pass. |
| F-030 | DONE | Gateway boundary | Boundary exports and verifier registry | n/a | IdentityRepository boundary is wired without broad live-route SQL conversion; parity tests preserve legacy behavior. |
| F-040 through F-050 | DONE | Database | `database/supabase/migrations/159_identity_foundation_core.sql`; rollback 159 | Multiple | Additive tables/columns, static migration tests, executable apply/rollback test, no `stores` table. |
| F-051 | DONE | Database/docs | Ownership doc under `docs/.../ownership/` | n/a | Single-writer/RLS/static validators pass; executable migration rollback passes. |
| F-070 through F-072 | DONE | Flags/tests/docs | Auth-core flags, identity config, status flag table | All flags | Default-off and shadow/quick-win tests pass. |
| F-080 through F-085 | DONE | Audit package/gateway/db | `packages/audit-core`; `audit-dual-write.ts`; migration 159 | `FEATURE_AUDIT_DUAL_WRITE` | Canonical row, actor map, redaction placeholder, mock hash-chain, dual-write executor. |
| F-090 through F-097 | DONE | Gateway key/token | `mock-key-service.ts`; `realm-registry.ts`; OIDC JWKS routes | `FEATURE_NEW_KEY_SERVICE` | Mock ES256 sign/verify, JWKS, rotate, audit anchor, compromise runbook, legacy secret map. |
| F-100 through F-106 | DONE | Gateway/session | `realm-registry.ts`; `session-services.ts` | `FEATURE_NEW_SESSION_ENGINE`, `FEATURE_SHADOW_SESSION` | Legacy cookie names preserved; session/refresh/revocation/cookie continuity helpers tested. |
| F-120 through F-126 | DONE | Identity app/gateway auth | OIDC route files; `oidc-disabled.ts`; `auth-verifier-registry.ts`; `middleware/auth.ts` | `FEATURE_IDENTITY_PROVIDER`, `FEATURE_OIDC_CLIENT` | OIDC defaults disabled; legacy verifier order preserved; dormant OIDC branch off-chain. |
| F-140 through F-147 | DONE | Gateway permission/shadow/metrics | `shadow-compare.ts`; `permission-engine.ts`; `operations-scaffold.ts` | Shadow flags | Shadow comparisons return legacy; metrics/counters and alias catalog exist; tests pass. |
| F-160 through F-165 | DONE | Gateway migration | `migration-scaffold.ts` | n/a | Reconciliation report, backfill plans, store-scoped mapper, credential layer-hash dry-run, continuity plan, dashboard snapshot. |
| F-180 through F-184 | DONE | Gateway quick wins/db | `token-shadow.ts`; `csrf-scaffold.ts`; `admin-mfa-scaffold.ts`; migration 159 | `FEATURE_TOKEN_HASH_SHADOW`, `FEATURE_NEW_CSRF`, `FEATURE_PERUSER_ADMIN_TOTP` | Legacy token/plaintext/CSRF/shared-TOTP paths preserved by helpers and tests. |
| F-200 through F-205 | DONE | Infrastructure/config/docs/gateway | OTP adapter, residency config/schema, rights/erasure, SOC2 map, ops metric hooks, HR registry | n/a | Identity compliance/ops tests pass; HR live dependencies recorded. |
| F-220 through F-224 | DONE | Final gates | All touched workspaces | All flags off/shadow | Typecheck, lint, build, root tests, package tests, executable migration rollback, governance all pass. |

## Files Changed By Identity Foundation Work

- Packages: `packages/identity-core`, `packages/token-core`, `packages/session-core`, `packages/permission-core`, `packages/organization-core`, `packages/audit-core`, auth-core subpaths, infrastructure OTP adapter.
- Gateway: `services/api-gateway/src/identity-foundation/*`, `services/api-gateway/src/middleware/auth.ts`, `services/api-gateway/src/index.ts`, package/runtime manifest/tsconfig dependency registration.
- Identity app: `apps/identity-platform/src/lib/config/features.ts`, `apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts`, `.well-known`, `jwks`, and `oauth2` route skeletons.
- Database/config/docs/tests: migration 159, rollback 159, residency config/schema, SOC2 map, ownership doc, status/ledger, HR registry, identity foundation tests.

## Found Defects

| ID | Source | Description | Status |
|---|---|---|---|
| FOUND-001 | Test sandbox | `tsx` IPC and Docker-backed tests need unsandboxed local execution. | Resolved for this run with approved escalated commands; all affected tests pass. |
| FOUND-002 | Auth-core feature flag export | Root-exporting feature flags from auth-core broke root export boundary expectations. | Fixed by exporting flags only via `@letbuyy/auth-core/feature-flags`. |
| FOUND-003 | Governance tooling residue | Tooling validator initially rejected design-system local tooling paths. | Fixed by canonicalizing the tooling paths; governance passes. |
| FOUND-004 | Domain contract | New dormant identity skeleton used hardcoded `id.letbuyy.com` literals. | Fixed by deriving issuer origins from env/request or local mock origin; domain contract passes. |
| FOUND-005 | Migration reverse proof | Migration 159 lacked an explicit rollback artifact. | Fixed with rollback 159 plus executable apply/rollback test. |
| FOUND-006 | Stale source-shape tests | Package-local internal-OS tests expected JSX `href` attributes while layouts use typed navigation objects. | Fixed by preserving link assertions while accepting `AppNavigationSection` object syntax. |

## Current Verification Summary

- `pnpm -w typecheck`: PASS, 71/71.
- `pnpm -w lint`: PASS with warnings, 9/9.
- `pnpm -w build`: PASS, 71/71.
- `pnpm -w test`: PASS, behavioral 535 tests / 520 pass / 15 skipped / 0 fail; contracts 200 pass / 0 fail.
- `pnpm --filter @letbuyy/api-gateway run test:unit`: PASS, 230/230.
- `pnpm --filter @letbuyy/identity-platform test`: PASS, 6/6 + 6/6.
- `pnpm --filter @letbuyy/auth-core test`: PASS, 2/2.
- `node --test tests/identity-foundation/identity-foundation-postgres.test.mjs`: PASS, migration 159 apply + rollback.
- `node scripts/validate-governance.mjs`: PASS, 172 validators.

## Production Behavior Statement

Old system remains authoritative. New identity foundation code is built and dormant. No identity flag is enabled by default, and no live auth/session/permission/cookie behavior has been cut over.
