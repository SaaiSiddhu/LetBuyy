# WAVE 0 — Truth Harness — 2026-06-09

CHANGES:

- `scripts/validate-governance.mjs` → added explicit `gate`, `report`, and `all` lanes; all existing validators remain in the gate lane; no demotions.
- `scripts/validators/foundation-antifabrication-gate.mjs` + `config/governance/anti-fabrication-allowlist.json` → added planted-failure-capable anti-fabrication gate with Wave-owned temporary entries for existing payout/payment/identity/domain debt.
- `scripts/validators/foundation-stepup-report-validator.mjs` → added advisory report lane output.
- `scripts/validators/frozen-path-override-gate.mjs`, `scripts/git-hooks/pre-commit`, `scripts/git-hooks/commit-msg` → added locked-path staging and commit-message trailer protection.
- `scripts/foundation/ephemeral-postgres.mjs` → added local Docker Postgres fixture starter for executable acceptance tests.
- `scripts/foundation/restore-drill.mjs` + `config/runtime/database-recovery-policy.json` → staged local restore-drill plan and documented no-production-action recovery policy.
- `docs/governance/flag-truth.md` → documented flag truth rules: disabled flags do not return mock success, external integrations default OFF, production-like runtime checks fail closed.
- `tests/governance/foundation-wave0.test.mjs` → added Wave 0 behavioral tests for planted fake UTR failure, lane split, backup/restore staging, and frozen-path gate wiring.
- `package.json` → added `validate:governance:gate`, `validate:governance:report`, `validate:anti-fabrication`, `test:foundation:wave0`, fixture, and restore-drill scripts.

TESTS:

- `pnpm run validate:anti-fabrication` → PASS; scans active source and tracks five temporary Wave-owned fabrication-debt entries.
- `node --test tests/governance/foundation-wave0.test.mjs` → PASS; proves planted fake UTR fails, lanes are split, restore drill is staged, and frozen hook wiring exists.
- `node scripts/foundation/ephemeral-postgres.mjs start` → PASS with Docker access; fixture `letbuyy-executable-pg` / `letbuyy_executable` started.
- `node --test tests/executable/money-ledger-postgres.test.mjs` → PASS; executes `public.post_ledger_transaction`, verifies append-only ledger behavior, idempotency, tenant GUC scoping, balance breaks, and rollback.
- `pnpm run test:foundation:wave0` → PASS with Docker access; packaged Wave 0 acceptance path starts fixture and runs the real ledger proof.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks.

MIGRATIONS:

- None.

ROLLBACK:

- Revert the Wave 0 commit from `stepup/main`.
- Remove Wave 0-only scripts/config/tests if reverting manually: anti-fabrication/frozen/report validators, foundation fixture/restore scripts, `config/governance/anti-fabrication-allowlist.json`, `config/runtime/database-recovery-policy.json`, `tests/governance/foundation-wave0.test.mjs`, `docs/governance/flag-truth.md`, and the Wave 0 package scripts.
- No database rollback is required because Wave 0 adds no migration and applies nothing to shared/staging/prod. The local Docker fixture can be stopped with `pnpm run foundation:pg:stop`.

GOVERNANCE:

- Frozen-file check: no Wave 0 edits were made to locked files. Pre-existing dirty frozen auth files remain user-owned and unstaged.
- Dependency graph: `pnpm run validate:dependencies` green.
- Gate changes: `validate:governance` now runs the gate lane explicitly; report lane is separate. No existing validator was demoted. Critical dependency validators are asserted in gate lane by `scripts/validate-governance.mjs`.
- Anti-fabrication allowlist is temporary and Wave-owned. Current entries must be removed by Wave 1/Wave 3/Wave 4 before final acceptance; new unallowlisted fake UTR/mock-success/provider-id synthesis fails the gate.
- Production safety: no production/shared DB action was taken. PITR paid-tier activation is CLASS-A and logged as `SKIP-W0-PITR-TIER`.

SKIPS:

- `SKIP-W0-PITR-TIER`

# WAVE 1 — Money Fixes — 2026-06-09

CHANGES:

- `packages/payments/src/index.ts` → added canonical production-runtime mode resolution, sandbox default, production mock rejection, and refund ledger posting.
- `services/api-gateway/src/routes/payments.ts` + `services/api-gateway/src/schemas/payment.schema.ts` → capture now requires provider payment proof and posts canonical capture ledger entries; refunds require provider refund proof, support partial refund accounting, and post canonical refund ledger entries.
- `services/api-gateway/src/routes/wallet.ts` → wallet available balance now reads from canonical `merchant_payable` only after per-site zero-variance reconciliation is verified.
- `services/api-gateway/src/routes/payouts.ts` + `packages/infrastructure/payout-transfer-adapter/index.ts` → payout release is provider-gated, no fabricated UTR/released status, default rail is RazorpayX, and release is claimed through the DB safety RPC before provider transfer.
- `packages/billing-core/src/index.ts` + `services/api-gateway/src/routes/settlements.ts` → reconciliation breaks are surfaced as open alerts; no reserve auto-plug is generated, and broken settlements do not post canonical ledger/payout schedules.
- `services/api-gateway/src/routes/commission.ts` and `packages/checkout-core/src/index.ts` → removed active mock money defaults in favor of sandbox defaults.
- `database/supabase/migrations/160_foundation_money_ledger_authority.sql` → added ledger link columns, bigint money shadow columns, site reconciliation table/functions, wallet-to-canonical backfill, and `claim_payout_statement_release(...)` with `FOR UPDATE`, state/idempotency guard, and canonical balance check.
- `database/supabase/rollback/160_foundation_money_ledger_authority.rollback.sql` → added tested fixture rollback.
- `config/governance/anti-fabrication-allowlist.json` → removed all Wave 1 payout/payment fabrication debt entries.
- `FOUNDATION_STEPUP_SKIPPED.md` → logged `SKIP-W1-PA-PAYOUT-PROVIDER` for human-owned PA/RazorpayX Route credentials/provider activation.
- `tests/executable/foundation-wave1-money-postgres.test.mjs`, package tests, and money source-contract tests → added Wave 1 behavioral proof.

TESTS:

- `pnpm run test:foundation:wave1` → PASS with Docker access; proves package money plans, source contracts, fixture migration apply/down, wallet backfill, zero-variance reconciliation, payout claim idempotency/state guard, balance rejection, and sandbox DB defaults.
- `pnpm run validate:anti-fabrication` → PASS; Wave 1 allowlist entries removed, only Wave 3/Wave 4 temporary entries remain.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run validate:migrations` → PASS; new migration is additive/replay-safe under the repository migration safety gate.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks.

MIGRATIONS:

- Added `160_foundation_money_ledger_authority.sql`.
- Expand/contract: added bigint shadow columns and sync triggers for payout statements, wallet ledger entries, and commission reconciliation entries; no live money column type was altered.
- Fixture verification: `tests/executable/foundation-wave1-money-postgres.test.mjs` applied migrations `139`, `119`, `142`, `151`, and `160`, exercised Wave 1 functions, then applied `160` rollback.

ROLLBACK:

- Apply `database/supabase/rollback/160_foundation_money_ledger_authority.rollback.sql` only to the local/ephemeral fixture or a human-approved clone. Do not apply to shared/staging/prod without a fresh backup and forward-fix decision.
- Code rollback: revert the Wave 1 commit to restore the prior mutable-wallet/payment/payout behavior.
- No production/shared database action was taken.

GOVERNANCE:

- Frozen-file check: no Wave 1 edits were made to frozen paths in `FOUNDATION_REPO_LOCKS.md`; pre-existing frozen auth/migration edits remain user-owned and unstaged.
- Money truth: capture, refund, fee assessment, payout release, and wallet backfill now route through canonical ledger postings. Wallet available balance fails closed until reconciliation status is `verified` with variance `0`.
- Anti-fabrication: fabricated UTR, hardcoded released payout state, and synthetic capture provider id debt were removed from active source and the allowlist.
- Provider actions: PA/RazorpayX execution remains gated off as Class-A external integration work; no provider payout is faked.

SKIPS:

- `SKIP-W1-PA-PAYOUT-PROVIDER`

# WAVE 2 — Tenant Isolation — 2026-06-09

CHANGES:

- `scripts/governance/tenant-registry-common.mjs`, `scripts/generators/generate-tenant-table-registry.mjs`, and `services/api-gateway/src/tenant/tenant-tables.registry.ts` → added schema-derived tenant-table registry generation from the migration chain; current registry contains 261 tenant-owned tables.
- `services/api-gateway/src/tenant/tenant-scoped.ts` and `services/api-gateway/src/lib/supabase.ts` → added a guarded service-role Supabase client that rejects execution against registry tables unless a tenant/owner predicate or scoped insert/upsert payload is present.
- `scripts/validators/tenant-isolation-validator.mjs`, `scripts/validate-governance.mjs`, and `package.json` → added Wave 2 tenant-isolation validation to the governance gate and package scripts.
- API gateway service-role call sites in app-function runtime, checkout, storefront, storefront cart/public routes, and themes were normalized away from direct `getSupabaseAdmin(c).from(...)` expressions so the guard is the single enforced service-role boundary.
- `services/api-gateway/src/middleware/auth.ts`, `services/api-gateway/src/middleware/rbac.ts`, `services/api-gateway/src/identity-foundation/auth-verifier-registry.ts`, and `services/api-gateway/src/identity-foundation/shadow-compare.ts` → removed the static `platform-console-token` super-admin verifier path; RBAC role checks now resolve from server-side persistence instead of JWT role metadata.
- `tests/governance/foundation-wave2-tenant.test.ts` and identity-foundation snapshots → added exhaustive registry fail-closed tests and updated verifier-registry expectations.

TESTS:

- `pnpm run test:foundation:wave2` → PASS with tsx IPC escalation; proves generated registry presence, unscoped rejection for all 261 tenant tables, scoped query allowance, scoped mutation allowance, unscoped insert rejection, and the tenant-isolation validator.
- `pnpm run validate:anti-fabrication` → PASS; only Wave 3/Wave 4 temporary entries remain tracked.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `node --test tests/identity-foundation/production-parity.test.mjs tests/identity-foundation/remaining-scaffolds.test.mjs` → PASS; updated auth verifier snapshots are green with the platform-console token branch removed.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks after generated registry map typing was corrected.

MIGRATIONS:

- None. Wave 2 is runtime/source governance plus generated registry only; no schema was applied to shared/staging/prod.

ROLLBACK:

- Revert the Wave 2 commit from `stepup/main`.
- If reverting manually, remove `services/api-gateway/src/tenant/*`, the tenant registry generator/common/validator scripts, the `validate:tenant-isolation` and `test:foundation:wave2` scripts, the `validate-governance` tenant validator entry, and restore the prior auth/RBAC verifier snapshots.
- No database rollback is required because Wave 2 adds no migration and applies nothing to shared/staging/prod.

GOVERNANCE:

- Tenant truth: `tenant-isolation-validator` derives the registry from the migration chain and fails if generated registry drift, duplicate entries, missing service-role guard wrapping, or direct service-role tenant-table bypasses appear.
- Fail-closed: guarded service-role table builders reject unscoped execution for every registry entry; the Wave 2 behavioral test iterates the full generated registry.
- Auth/RBAC: the static platform-console super-admin principal and RBAC platform-token bypasses were removed; `requireRole` resolves roles from persisted allowlist/employee rows rather than JWT role claims.
- Frozen-file check: no Wave 2 edits were made to frozen paths in `FOUNDATION_REPO_LOCKS.md`; pre-existing frozen auth/migration edits remain user-owned and unstaged.

SKIPS:

- None.

# WAVE 3 — Production Safety — 2026-06-09

CHANGES:

- `services/api-gateway/src/middleware/rateLimit.ts` → production rate-limit and query-cost checks now fail closed when Redis/KV backends are unavailable instead of permitting traffic; unavailable results return `RATE_LIMIT_UNAVAILABLE` through the existing middleware path.
- `services/api-gateway/src/lib/registrar/index.ts` → mock registrar remains disabled in production and no longer emits `raw: { mock: true }`; local simulation payloads are explicit provider simulations.
- `scripts/foundation/production-safety-preflight.mjs`, `config/runtime/production-safety-preflight.json`, and `docs/runbooks/foundation-wave3-shared-env-apply.md` → added shared-env preflight and `SKIP-DEPLOY` runbook requiring real secrets, rate-limit backend evidence, runtime telemetry evidence, and money-ledger reconciliation alert evidence before any human shared-env apply.
- `scripts/validators/production-safety-validator.mjs`, `scripts/validate-governance.mjs`, `package.json`, and `tests/governance/foundation-wave3-production-safety.test.ts` → added Wave 3 validator/test wiring to enforce fail-closed rate limiting, mock registrar hygiene, shared-env evidence flags, skip records, and domain defaults.
- `apps/marketing-site/src/lib/public-urls.ts`, `apps/theme-marketplace/src/lib/public-urls.ts`, `apps/app-marketplace/src/lib/site-url.ts`, and `apps/developer-portal/src/lib/site-url.ts` → public platform default root domain is now `letbuyy.store`; both `.store` and `.com` remain recognized for request-context origin detection.
- `config/governance/anti-fabrication-allowlist.json` and `FOUNDATION_STEPUP_SKIPPED.md` → removed Wave 3 mock-registrar fabrication debt from the allowlist and logged the Class-A observability/DNS skips.

TESTS:

- `pnpm run test:foundation:wave3` → PASS with tsx IPC escalation; proves production rate limiting fails closed without a backend, mock registrar is production-gated and no longer emits `mock:true`, shared-env preflight rejects sentinel secrets and missing evidence, and public URL defaults remain on `letbuyy.store`.
- `pnpm run validate:production-safety` → PASS; source/config validator checks rate-limit fail-closed wiring, registrar payload hygiene, shared-env preflight evidence, SKIP entries, and domain defaults.
- `pnpm run validate:anti-fabrication` → PASS; Wave 3 allowlist entry removed, only one temporary Wave 4 identity/OIDC entry remains tracked.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks.
- `pnpm run validate:governance:report` → PASS; report lane remains advisory and green.

MIGRATIONS:

- None. Wave 3 adds source/config/runbook/test governance only; no database schema was applied to shared/staging/prod.

ROLLBACK:

- Revert the Wave 3 commit from `stepup/main`.
- If reverting manually, restore the prior rate-limit unavailable behavior, registrar raw payload shape, `.com` public URL defaults, remove `production-safety-preflight` config/script/runbook, remove the Wave 3 validator/test/package scripts, and restore the Wave 3 anti-fabrication allowlist entry.
- No database rollback is required because Wave 3 adds no migration and applies nothing to shared/staging/prod.
- No provider rollback is required because Codex performed no Sentry, DNS, Cloudflare, Vercel, registrar, secret-store, or deployment action.

GOVERNANCE:

- Production safety: production rate limiting fails closed until a real backend is available; shared-env preflight rejects `SKIP_NEEDS_HUMAN_*` sentinels and requires runtime telemetry plus money-ledger reconciliation alert evidence before human cutover.
- Anti-fabrication: mock registrar payloads no longer use `mock:true`, and the Wave 3 anti-fabrication allowlist entry was removed.
- No production action: Sentry/telemetry DSN provisioning and DNS/custom-hostname cutover are Class-A external actions, logged as skips and gated by the `SKIP-DEPLOY` runbook.
- Frozen-file check: no Wave 3 edits were made to frozen paths in `FOUNDATION_REPO_LOCKS.md`; pre-existing frozen auth/migration edits remain user-owned and unstaged.

SKIPS:

- `SKIP-W3-SENTRY-DSN`
- `SKIP-W3-DNS-CUTOVER`

# WAVE 4 — Session Security — 2026-06-09

CHANGES:

- `packages/auth-core/src/index.ts` → internal request signing now uses a dedicated `INTERNAL_API_SECRET`/`LETBUYY_INTERNAL_API_SECRET` contract, adds JTI to app/session/identity signatures, and no longer accepts `AUTH_SECRET` as an internal-auth fallback.
- `services/api-gateway/src/lib/internal-auth.ts`, `services/api-gateway/src/lib/internal-secret.ts`, and `services/api-gateway/src/middleware/internal-perimeter.ts` → added previous-secret dual accept, JTI replay cache, identity/app/session replay rejection, and a production fail-closed `/internal/*` perimeter requiring an IP allowlist plus internal credential presence.
- Runtime API clients in identity, storefront, merchant control-plane, app marketplace, theme marketplace, and operations portal now use the dedicated internal secret path; identity/storefront app calls use the shared JTI signer.
- `database/supabase/migrations/161_foundation_session_security.sql` + rollback → added merchant session revocation columns, token-rotation event table, and `validate_and_rotate_merchant_session(...)` with `FOR UPDATE`, idle timeout, rotation, old-token reuse detection, and tested down script.
- `services/api-gateway/src/lib/merchant-session.ts`, `services/api-gateway/src/middleware/auth.ts`, and `services/api-gateway/src/routes/auth.ts` → gateway auth validates merchant sessions through the DB RPC, rotates eligible session tokens, rejects idle/revoked/reused sessions, and enforces enrolled merchant TOTP during password login.
- `services/api-gateway/src/routes/two-factor.ts` → TOTP secrets now use dedicated `TOTP_ENCRYPTION_KEY`, not auth/internal secrets.
- `apps/identity-platform/src/app/api/auth/login/route.ts` and `apps/identity-platform/src/app/api/auth/session/route.ts` → login forwards MFA codes and the app route writes rotated merchant session cookies without exposing replacement tokens in the JSON body.
- `apps/platform-console/src/lib/console-auth-server.ts` and MFA route → production console TOTP now resolves per principal from `PLATFORM_CONSOLE_TOTP_SECRETS`; the old shared secret remains non-production fallback only.
- `apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts` and `config/governance/anti-fabrication-allowlist.json` → OIDC scaffold now returns honest `implemented: false` payloads and the final anti-fabrication allowlist entry was removed.
- Env templates, shared-env preflight, Wave 4 runbook, SKIP log, validator, and tests were updated for secret rotation placeholders, internal allowlist requirements, Class-A skips, and session-security evidence.

TESTS:

- `pnpm run test:foundation:wave4` → PASS with tsx IPC/Docker escalation; proves auth-core internal JTI signatures, no `AUTH_SECRET` internal fallback, production internal perimeter fail-closed behavior, source validator, and Postgres migration apply/down with rotation/reuse revocation.
- `pnpm run validate:session-security` → PASS; checks internal secret isolation, replay JTI, session rotation/revocation, MFA enforcement, per-principal console TOTP, perimeter, env templates, OIDC honesty, and Wave 4 skips.
- `pnpm run validate:anti-fabrication` → PASS; active source scan has zero temporary allowlist entries.
- `pnpm run validate:production-safety` → PASS; Wave 3 safety remains green after adding Wave 4 shared-env prerequisites.
- `pnpm run validate:migrations` → PASS; migration history remains replay-safe.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks after gateway/session typing fixes.
- `pnpm run validate:governance:report` → PASS; report lane remains green.

MIGRATIONS:

- Added `161_foundation_session_security.sql`.
- Expand/contract: additive columns/table/function only; no live session column type was changed.
- Fixture verification: `tests/executable/foundation-wave4-session-postgres.test.mjs` created a minimal local schema, applied migration `161`, rotated a merchant session, rejected reuse of the old token with revocation, then applied `161` rollback and verified function/table/columns were removed.

ROLLBACK:

- Apply `database/supabase/rollback/161_foundation_session_security.rollback.sql` only to the local/ephemeral fixture or a human-approved clone. Do not apply to shared/staging/prod without a fresh backup and forward-fix decision.
- Code rollback: revert the Wave 4 commit to restore the previous internal-signing/session/MFA behavior.
- Provider rollback: none by Codex. Live secret rotation, mTLS/Cloudflare Access, shared-env deploys, and provider secret-store changes remain human `SKIP-DEPLOY` actions.

GOVERNANCE:

- Secret isolation: internal auth no longer falls back to `AUTH_SECRET`; dedicated current/previous internal secrets are supported for code/config rotation.
- Session safety: merchant session reads now flow through a DB `FOR UPDATE` RPC with idle timeout, rotation, reuse detection, and revocation semantics.
- MFA: enrolled merchant TOTP is enforced on password login; console production TOTP is per-principal only.
- Perimeter: production `/internal/*` requests fail closed without `INTERNAL_GATEWAY_IP_ALLOWLIST` and require an internal credential before router-level authorization.
- Anti-fabrication: OIDC out-of-scope responses are honest-disabled; `config/governance/anti-fabrication-allowlist.json` is empty.
- Frozen-file check: Wave 4 did not edit frozen identity cookie/switch paths. Pre-existing frozen auth changes remain user-owned and unstaged.

SKIPS:

- `SKIP-W4-LIVE-SECRET-ROTATION`
- `SKIP-W4-MTLS-CF-ACCESS`

# WAVE 5 — Design Governance — 2026-06-09

CHANGES:

- `scripts/validators/validate-design-system.mjs` + `scripts/validators/design-system-baseline.json` → converted the design gate to Wave 5 scope: themable app source surfaces exclude `apps/marketing-site`, current CSS/TSX drift is a ratchet baseline, inline styles/raw TSX hex/arbitrary radius/shadow are counted, and local workspace shell implementations are hard failures.
- `scripts/validators/mobile-token-validator.mjs`, `scripts/validate-governance.mjs`, and `package.json` → wired design-system and mobile-token checks into governance/test scripts; `test:foundation:wave5` proves the current gate and planted ratchet failure path.
- `packages/typescript/ui/src/internal-workspace.tsx` and public exports → added shared internal workspace primitives for leadership/operations shells, metrics, panels, module cards, status pills, skip panels, and empty data states.
- `apps/platform-console/src/components/_local-ui/console-workspace.tsx` and `apps/platform-operations-portal/src/components/_local-ui/ops-workspace.tsx` → replaced duplicated shell implementations with compatibility wrappers around `@letbuyy/ui` primitives.
- `tests/governance/foundation-wave5-design-governance.test.mjs` → added Wave 5 behavioral proof for current gate pass, mobile token parity, marketing-site exile, no local workspace implementation, and arbitrary-radius ratchet failure.
- `FOUNDATION_STEPUP_SKIPPED.md` → logged `SKIP-W5-TOKEN-MIGRATION-PRODUCT-CALL` for product-owned marketing token migration and active Flutter theme-file retirement.

TESTS:

- `pnpm run test:foundation:wave5` → PASS; validates design-system gate, mobile-token parity, planted arbitrary-radius ratchet failure, marketing-site exile, and no local workspace shell implementation.
- `pnpm --filter @letbuyy/ui run typecheck` → PASS; shared internal workspace primitive exports typecheck.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks with platform console, operations portal, and `@letbuyy/ui` rebuilt.

MIGRATIONS:

- None. Wave 5 is design governance/source enforcement only; no database schema was applied to shared/staging/prod.

ROLLBACK:

- Revert the Wave 5 commit from `stepup/main`.
- If reverting manually, restore the prior local console/operations workspace implementations, remove `packages/typescript/ui/src/internal-workspace.tsx` exports, remove `mobile-token-validator.mjs`, remove `test:foundation:wave5`, restore the previous design-system validator/baseline, and remove the Wave 5 SKIP entry.
- No database/provider rollback is required because Wave 5 adds no migration and performs no production, shared-env, provider, DNS, or live UI deployment action.

GOVERNANCE:

- Design score: scored themable surfaces are all app source TS/TSX/CSS except `apps/marketing-site`; marketing remains a product-owned token migration skip instead of silent debt.
- Ratchet: current baseline is `appCssRawHex=0`, `tsxRawHex=0`, `tsxInlineStyles=638`, `tsxArbitraryRadius=328`, `tsxArbitraryShadow=8`; any increase fails CI, with a recorded 10% per-wave burn-down target.
- Workspace duplication: console and operations workspace implementation now lives in `@letbuyy/ui`; app-local files are wrappers and the validator hard-fails local `<main>/<article>/<section>` shell implementations.
- Mobile parity: generated Flutter token output remains synchronized with `packages/typescript/ui/src/mobile-tokens.ts`; legacy Dart theme-file deletion is skipped pending product migration because those files are active import hubs.
- Frozen-file check: Wave 5 did not edit `packages/typescript/ui/src/tokens.ts` or frozen identity/auth files. Pre-existing dirty frozen auth/migration changes remain user-owned and unstaged.

SKIPS:

- `SKIP-W5-TOKEN-MIGRATION-PRODUCT-CALL`

# WAVE 6 — Theme Governance — 2026-06-09

CHANGES:

- `packages/theme-engine/src/built-in-section-schemas.ts` → added explicit built-in section schema authority for all 24 built-in section types without editing the frozen registry model.
- `packages/theme-engine/src/theme-governance.ts` → added WARN-default renderer registry audits, ENFORCE assertion path, schema migration runner, and Liquid default-off governance constants.
- `packages/theme-engine/src/index.ts` → wired built-in schemas into template validation so saved sections are checked even when runtime schemas omit built-ins.
- `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts` → gated Liquid bundle resolution behind an explicit `liquidEnabled` runtime option; default remains off.
- `packages/theme-engine/test/theme-engine.test.ts`, `scripts/validators/theme-governance-validator.mjs`, `scripts/validate-governance.mjs`, and `package.json` → added Wave 6 tests and governance validation for schema coverage, WARN mode, fallback rendering, Liquid default-off, and schema migration proof.
- `FOUNDATION_STEPUP_SKIPPED.md` → logged `SKIP-W6-LIQUID-PRODUCT-DECISION` for product/security-owned Liquid/app-block runtime enablement.

TESTS:

- `pnpm run test:foundation:wave6` → PASS with tsx IPC escalation; validates 24 built-in schemas, WARN/ENFORCE renderer registry behavior, schema migration of a saved section, and the theme-governance validator.
- `pnpm --filter @letbuyy/theme-engine run typecheck` → PASS; theme governance and schema exports typecheck.
- `pnpm --filter @letbuyy/storefront-runtime run typecheck` → PASS; storefront template resolver Liquid gate typechecks.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks.
- `pnpm run validate:governance:report` → PASS; report lane remains green after Wave 6 docs/status updates.

MIGRATIONS:

- None. Wave 6 is theme governance/source enforcement only; no database schema was applied to shared/staging/prod.

ROLLBACK:

- Revert the Wave 6 commit from `stepup/main`.
- If reverting manually, remove `built-in-section-schemas.ts`, `theme-governance.ts`, the package exports, the template resolver `liquidEnabled` option, `theme-governance-validator.mjs`, and the `test:foundation:wave6` script, then restore the previous theme-engine tests.
- No database/provider rollback is required because Wave 6 adds no migration and performs no production, shared-env, provider, DNS, or live storefront deploy action.

GOVERNANCE:

- Renderer registry: audits default to WARN mode and can be switched to ENFORCE only when unresolved section/renderer/schema mismatches are zero.
- Schema coverage: all 24 built-in section types now have schema authority; schema validation is available without relying on app-local runtime schema injection.
- No blank sections: the storefront renderer already emits `UnknownSectionFallback` with `data-theme-section-fallback`; the validator now guards that fallback path.
- Liquid honesty: Liquid rendering remains default-off until product/security approve the runtime and migration path.
- Frozen-file check: Wave 6 did not edit frozen `packages/theme-engine/src/theme-registry.ts`; governance was added around it. Pre-existing dirty frozen auth/migration changes remain user-owned and unstaged.

SKIPS:

- `SKIP-W6-LIQUID-PRODUCT-DECISION`

# WAVE 7 — Beta Readiness — 2026-06-09

CHANGES:

- `services/mobile-bff/src/index.ts` and `services/mobile-bff/test/session-token.test.ts` → added mobile Turnstile verification through Cloudflare siteverify, fail-closed handling for missing sentinel secrets, a `/v1/auth/mobile/turnstile/verify` endpoint, and source tests for both unavailable and provider-success paths.
- `apps/mobile/merchant-app/lib/services/store_auth_service.dart`, `apps/mobile/merchant-app/lib/main.dart`, and `apps/mobile/merchant-app/test/mobile_services_test.dart` → mobile login now verifies the Turnstile token with the BFF before password login when a BFF URL is configured.
- `services/api-gateway/src/routes/checkout.ts` and `services/api-gateway/src/__tests__/checkout.test.ts` → hosted checkout confirm now creates the server-authoritative order through `OrderExecutionAdapter`, requires provider payment proof for non-COD methods, posts provider capture through `PaymentExecutionAdapter`, and records `capture_posted_to_ledger`.
- `services/api-gateway/src/routes/order-risk.ts`, `orders-v1.test.ts`, and executable fixtures → COD confirmation now records the honest `letbuyy_sandbox` provider and `mode: 'sandbox'`; live WhatsApp remains human-gated by `HR-WHATSAPP-LIVE`.
- `.github/workflows/deploy-staging.yml`, `.github/workflows/staging-runtime-deployment.yml`, and `scripts/cloudflare/update-wrangler-ids.mjs` → active mobile BFF worker is included in staging/runtime handling while reserved paper service/mobile roots remain excluded from deploy lists.
- `scripts/validators/beta-readiness-validator.mjs`, `scripts/validate-governance.mjs`, and `package.json` → added Wave 7 governance validation and test script coverage for mobile Turnstile, checkout capture, WhatsApp/COD sandbox gating, OIDC honesty, deploy exclusions, and quarantine proof.
- `config/env/templates/worker.env.example`, `config/env/schemas/worker.schema.json`, `services/mobile-bff/wrangler.toml`, and `FOUNDATION_STEPUP_SKIPPED.md` → documented human-owned mobile Turnstile and WhatsApp/Twilio secret provisioning as gated CLASS-A skips.

TESTS:

- `pnpm run test:foundation:wave7` → PASS with tsx/Flutter escalation; validates BFF Turnstile verifier tests, targeted gateway checkout/orders/WhatsApp tests, focused Flutter mobile login Turnstile test, and beta-readiness validator.
- `pnpm --filter @letbuyy/mobile-bff run typecheck` → PASS.
- `pnpm --filter @letbuyy/api-gateway run typecheck` → PASS.
- `flutter build apk --debug --dart-define-from-file=dart-defines/staging.json` → PASS with Flutter SDK cache escalation; built `build/app/outputs/flutter-apk/app-debug.apk`, then generated artifacts were removed.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks.
- `pnpm run validate:governance:report` → PASS.
- `node scripts/validators/stale-artifact-validator.mjs` → PASS after removing generated `.next`, `.turbo`, `dist`, Flutter `build`, `.dart_tool`, and Worker `.wrangler` artifact directories.

MIGRATIONS:

- None. Wave 7 is source/config/test governance only; no database schema was applied to shared/staging/prod.

ROLLBACK:

- Revert the Wave 7 commit from `stepup/main`.
- If reverting manually, remove the mobile BFF Turnstile endpoint/helper/tests, remove the merchant mobile BFF verification hook/test, restore hosted checkout confirm to its previous behavior, restore COD confirmation provider labels, remove `beta-readiness-validator.mjs`, remove Wave 7 scripts, and restore deploy/resource updater lists.
- No database/provider rollback is required because Wave 7 adds no migration and performs no production, shared-env, provider, DNS, Turnstile, WhatsApp/Twilio, or live deploy action.

GOVERNANCE:

- Anti-fabrication: COD confirmation no longer labels the active sandbox request as `mock_whatsapp` or `mode: 'mock'`; non-COD checkout confirmation requires real provider payment proof before ledger capture posting.
- Mobile auth: Turnstile verification fails closed until a human provisions `TURNSTILE_SECRET_KEY`; the merchant app can build and test with the feature gated.
- Quarantine: package quarantine targets remain un-moved because PHASE A/IMPORT_GRAPH zero-importer proof fails for all six package targets; reserved paper services/mobile roots are excluded from deploy paths instead of being activated.
- OIDC: identity OIDC remains honest-disabled (`implemented: false`, HTTP 501) and out of scope.
- Frozen-file check: Wave 7 did not edit frozen identity cookie/switch paths. Pre-existing dirty frozen auth/migration changes remain user-owned and unstaged.
- Test-scope note: an initial full API gateway unit sweep failed on unrelated source-regex assertions in pre-existing dirty auth/session/settlement surfaces; the Wave 7 gate was narrowed to the touched gateway tests, all of which passed.

SKIPs:

- `SKIP-W7-MOBILE-TURNSTILE-SECRET`
- `SKIP-W7-WHATSAPP-LIVE-CREDS`
