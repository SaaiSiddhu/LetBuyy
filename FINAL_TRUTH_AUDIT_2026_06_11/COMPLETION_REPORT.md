# LetBuyy Final Convergence Completion Report

**Date:** 2026-06-11
**Scope:** Repository-side B/C/D/E implementation and certification after Phase A live G4 was recorded as human-owned, plus repo-side Phase F CAP-C03 through CAP-C07 and CAP-C09 through CAP-C15 capability implementation.
**Pre-report HEAD:** `fa1fcf3c` on `stepup/main`; local `main..stepup/main = 0`.

## Repository Answer

**Is LetBuyy ONE REALITY in the repository?** Yes, repository-side.

The converged branch now contains one enforced authority chain, one canonical money ledger path for local capture/refund/reconciliation work, one Liquid-forward theme runtime with React still frozen behind the required 4x100% deletion gate, and anti-recurrence validators wired into the governance gate. The final local gate passes with **105 validators**.

**Is LetBuyy ONE REALITY in production?** Not yet. Production/live certification remains human-owned and explicitly recorded. Codex did not push protected remotes, provision secrets, run production migrations, mutate DNS, deploy provider consoles, or fabricate live smoke evidence.

## Implemented Repository-Side

| Phase | Implemented |
|---|---|
| B Money | Capture/refund hub RPCs post canonical double-entry ledger rows in-transaction; hosted checkout reads actual ledger existence; reconciliation refresh is scheduled in `queue-workers`; platform-console has the read-only money break queue; gift-card and AI-credit visible balances moved to projections/deferred provider paths; money validators now scan migrations and mutation-fail on naked ledger regressions. |
| C Liquid | Liquid consumes full `layoutHtml`; header/footer chrome, `lb-*` CSS, first-party sections, settings-faithful stubs, product/cart drops, `t` filter, and web/mobile editor canary write paths are implemented locally. React stays frozen and undeleted. |
| D Duplicates | DOC-02/prompt authority retargeted; reserved stubs and manifests made non-activating; frozen app deploy shape neutralized; orphan validators wired; queue planner deduped into `@letbuyy/event-core`; `auth-core/src/legacy.ts` removed; Firebase/GCS media residue, `EMAIL_QUEUE`, stale `develop`, DNS overlay, and undeclared env/config drift removed or guarded. |
| E Certification | Final anti-recurrence validators cover prompt perimeter, DOC/stub language, frozen deploy shape, validator liveness, canonical ledger migration evidence, reserved manifest activation wording, and retired DNS overlay references. Completion evidence is recorded in this report plus the execution, change, validation, and rollback ledgers. |
| F CAP-C03 | Razorpay Route payout provider client is implemented behind `PayoutProviderClient`, wired into payout release only when the existing provider flag and credentials are present, posts idempotent provider transfer requests, maps provider references/UTRs, and records provider rejection as failed rather than released. |
| F CAP-C04 | Money reconciliation now has a repository-side dual-control operator resolve/recheck path: mismatches can be annotated as provider-explained or suspense-acknowledged without falsifying variance, or rechecked through the canonical refresh RPC. Live zero-break-or-explained-suspense evidence remains human-owned. |
| F CAP-C05 | Settlement ingest now dedupes by idempotency key and provider settlement reference, creates/reuses canonical `payout_statements` executor rows for balanced PA-split settlements, links settlement payout instructions to those executor rows, and syncs provider release status back to the instruction. Live provider settlement/payout smoke and variance-0 evidence remain human-owned. |
| F CAP-C06 | Step-up proofs are now repository-side cryptographic: active TOTP verification issues short-lived HMAC-SHA256 tokens bound to action, actor, site, challenge, and expiry, and refund/payout/DSR erase verify them with `STEP_UP_SIGNING_SECRET`. Live signing-secret provisioning, enrolled-factor proof, and production smoke remain human-owned. |
| F CAP-C07 | Identity JWKS/revocation hardening is repo-side complete: JWKS publication serves only configured public ES256/EdDSA keys and fails closed without keys, fake disabled JWKS coordinates are validator-banned, and merchant logout/logout-everywhere preserves durable `revoked_at` evidence instead of deleting session rows. Live OIDC client registration, grant smoke, key rotation evidence, and final HS256 drain remain human-owned. |
| F CAP-C09 | Mobile Turnstile no longer double-consumes one provider token: mobile-bff verifies Cloudflare once, signs a short-lived `lb-mobile-turnstile-v1` proof, Flutter sends that proof to identity, and identity verifies it locally before web direct-verification fallback. Live Turnstile secret provisioning and production mobile smoke remain human-owned. |
| F CAP-C10 | API runtime failures now emit redacted `letbuyy.alert.runtime.error` metrics and enqueue `incident.page.dry_run` jobs through the existing runtime queue/queue-worker incident command path. Mobile crash reporting already stores sanitized local reports and uses Sentry only with a real DSN. Live DSN/provider/on-call delivery drills remain human-owned. |
| F CAP-C11 | Tenant isolation now has a repository-side executable Postgres red-team proof for RT-1 through RT-9: `app_tenant` positive controls pass, missing-GUC and cross-tenant reads fail closed, raw-REST authenticated visibility matches app-tenant owner scope, anon does not inherit service-role order access, and authenticated users cannot self-add super admins. Live production-shaped DB probes remain human-owned. |
| F CAP-C12 | Store-publish convergence is repo-side done: web and mobile editors publish canonical `template_config` carrying Liquid bundle/canary state, the gateway publish contract accepts that shape, and backend release snapshots prefer the supplied publish config before draft/store fallback. Live publish/rollback/render smoke remains human-owned. |
| F CAP-C13 | Checkout Wasm/app-functions retirement is repo-side done: buyer order creation no longer imports or calls `evaluateCheckoutAppFunctions`, the checkout page no longer fetches checkout extension registrations, the checkout iframe host component is deleted, and beta-readiness now fails if the live path returns. |
| F CAP-C14 | Transactional invite/contact email delivery is repo-side done: admin and merchant employee invites plus storefront contact-owner notifications enqueue signed `NOTIFICATION_QUEUE` jobs, queue-workers dispatch those job types through the existing email sender path, and beta-readiness now fails if the stale CAP-C14 seam rows return. Live ESP dispatch evidence remains human-owned under CAP-C18. |
| F CAP-C15 | Live manual KYC review is repo-side done: the KYC adapter routes `KYC_PROVIDER=manual` in live mode to `needs_review` with manual-review metadata, while automated Signzy/HyperVerge live providers still fail closed behind the recorded provider seam. |

## Validation Evidence

| Check | Result |
|---|---|
| `CI=true pnpm install --frozen-lockfile --force` | PASS |
| `node scripts/validate-governance.mjs --lane=gate` | PASS, 105 validators |
| `node scripts/validators/whole-repo-end-state-validator.mjs` | PASS |
| `node scripts/validators/deploy-matrix-topology-validator.mjs` | PASS |
| `node scripts/validators/canonical-ledger-only-validator.mjs` | PASS |
| `node scripts/validators/prompt-perimeter-validator.mjs` | PASS |
| `npx tsx --test tests/contracts/dns-letbuyy-com-zone.test.ts` | PASS, 1/1 |
| `npx tsx --test services/api-gateway/src/__tests__/checkout-d6.test.ts` | PASS, 7/7 |
| `npx tsc --noEmit -p services/api-gateway/tsconfig.json` | PASS |
| `pnpm --filter @letbuyy/payments build` | PASS |
| `pnpm --filter @letbuyy/infrastructure typecheck` | PASS |
| `pnpm run lint` | PASS with existing warnings only |
| `pnpm run lint:css` | PASS |
| `npx tsx --test services/api-gateway/src/__tests__/settlements.test.ts` | PASS, 3/3 for CAP-C05 linkage |
| `npx tsx --test services/api-gateway/src/__tests__/money.test.ts` | PASS, 10/10 after CAP-C05 |
| `npx tsx --test services/api-gateway/src/__tests__/stepup-crypto.test.ts` | PASS, 2/2 for CAP-C06 HMAC proof |
| `npx tsx --test services/api-gateway/src/__tests__/security-v1.test.ts` | PASS, 4/4 after CAP-C06 |
| `pnpm --filter @letbuyy/identity-platform exec tsx --test src/__tests__/oidc-jwks.test.ts` | PASS, 3/3 for CAP-C07 JWKS hardening |
| `npx tsx --test services/api-gateway/src/__tests__/identity-issuer-d3.test.ts` | PASS, 6/6 after CAP-C07 durable revocation check |
| `node scripts/validators/session-security-validator.mjs` | PASS after CAP-C07; mutation-proved fake JWKS coordinates fail |
| `npx tsx --test services/mobile-bff/test/session-token.test.ts` | PASS, 8/8 for CAP-C09 proof exchange |
| `pnpm --filter @letbuyy/identity-platform exec tsx --test src/__tests__/turnstile-proof.test.ts` | PASS, 2/2 for CAP-C09 identity proof verification |
| `flutter test test/mobile_services_test.dart` | PASS, 158 tests including CAP-C09 proof handoff |
| `node scripts/validators/beta-readiness-validator.mjs` | PASS after CAP-C09; mutation-proved old direct preverify marker fails |
| `npx tsx --test services/api-gateway/src/__tests__/observability.test.ts` | PASS, 8/8 including CAP-C10 runtime alert planning and redaction |
| `node scripts/validators/beta-readiness-validator.mjs` | PASS after CAP-C10; mutation-proved missing alert enqueue hook fails |
| `node scripts/governance/foundation-ephemeral-postgres.mjs start` | PASS, Docker-backed executable Postgres fixture ready for CAP-C11 |
| `node --test tests/executable/tenant-redteam-postgres.test.mjs` | PASS, RT-1 through RT-9 executable tenant red-team proof |
| `node scripts/validators/rls-force-coverage-validator.mjs` | PASS after CAP-C11; now requires the executable red-team proof |
| `pnpm run test:foundation:wave2` | PASS after CAP-C11; tenant registry tests, executable red-team suite, and tenant-isolation validator run together |
| `node scripts/validate-governance.mjs --lane=gate` | PASS after CAP-C11, 105 validators |
| `node --test tests/theme-engine/theme-template-editor.test.mjs` | PASS, 6/6 after CAP-C12 canonical publish assertions |
| `flutter test test/mobile_services_test.dart --plain-name "ThemeService publishes canonical Liquid template config"` | PASS, focused CAP-C12 mobile publish payload test |
| `node scripts/validators/beta-readiness-validator.mjs` | PASS after CAP-C12; now requires web/mobile/backend publish fragments |
| `pnpm --filter @letbuyy/theme-engine typecheck`; `pnpm --filter @letbuyy/api-client typecheck`; `npx tsc --noEmit -p services/api-gateway/tsconfig.json`; `npx tsc --noEmit -p apps/merchant-control-plane/tsconfig.json`; `flutter analyze` | PASS after CAP-C12 |
| `node scripts/validate-governance.mjs --lane=gate` | PASS after CAP-C12, 105 validators |
| `node --test tests/app-platform/app-bridge.test.mjs tests/feature-flags/gateway-feature-gates.test.mjs` | PASS, 9/9 after CAP-C13 checkout retirement assertions |
| `node scripts/validators/beta-readiness-validator.mjs`; `node scripts/validators/meta-no-theater-validator.mjs` | PASS after CAP-C13 |
| `npx tsc --noEmit -p services/api-gateway/tsconfig.json`; `npx tsc --noEmit -p apps/storefront-runtime/tsconfig.json` | PASS after CAP-C13 |
| `npx tsx --test services/api-gateway/src/__tests__/order-confirmation-email.test.ts` | PASS, 3/3 after CAP-C14 transactional invite/contact queue assertions |
| `node scripts/validators/beta-readiness-validator.mjs` | PASS after CAP-C14; now requires route enqueue wiring, transactional helper fragments, worker job support, and absence of stale CAP-C14 seam rows |
| `npx tsc --noEmit -p services/api-gateway/tsconfig.json`; `npx tsc --noEmit -p services/queue-workers/tsconfig.json` | PASS after CAP-C14 |
| `npx tsx --test services/api-gateway/src/__tests__/kyc.test.ts` | PASS, 4/4 after CAP-C15 manual-review assertions |
| `node scripts/validators/provider-mode-badge-validator.mjs` | PASS after CAP-C15; now requires exact `manual_review_required: true` metadata |
| `pnpm --filter @letbuyy/payments build`; `npx tsc --noEmit -p packages/infrastructure/tsconfig.json`; `npx tsc --noEmit -p services/api-gateway/tsconfig.json` | PASS after CAP-C15 |

Mutation proofs added during final certification:

| Probe | Expected failure |
|---|---|
| Reintroduced `future activation requires deployment config and governance approval` into a reserved service manifest. | `whole-repo-end-state-validator` failed on reserved manifest forward-activation language. |
| Repointed an active checkout test back to `infrastructure/dns/letbuyy_com.tf`. | `whole-repo-end-state-validator` failed on the retired DNS overlay reference. |
| Renamed the validator-required `assertRawRestParity` CAP-C11 test marker. | `rls-force-coverage-validator` failed on the missing executable RT-1 through RT-9 app-tenant/raw-REST proof. |
| Renamed the CAP-C12 mobile publish body key from `template_config` to `template_config_probe`. | `beta-readiness-validator` failed on the missing canonical mobile publish payload fragment. |
| Reintroduced the forbidden `evaluateCheckoutAppFunctions` marker into buyer checkout order creation. | `beta-readiness-validator` failed on checkout app-functions/Wasm execution returning to the payment route. |
| Removed the validator-required `email.employee_invite` queue-worker fragment. | `beta-readiness-validator` failed on the missing CAP-C14 transactional email worker support. |
| Replaced `manual_review_required: true` with a probe field in the KYC adapter. | `provider-mode-badge-validator` failed after tightening the check to the exact manual-review field. |

## Remaining Human-Live Seams

The exact live seam table is `SKIPPED_HUMAN_DECISIONS.md`, now **59 rows**. The exact capability backlog is `CAPABILITY_BACKLOG.md`, now **16 rows**. These are the only remaining blockers to production/live certification.

Production certification blockers:

- `SKIP-A4-ATOMIC-GO-LIVE-G4`
- `SKIP-EG1-REMOTE-DEPLOYED-TREE-CERTIFICATION`
- `SKIP-EG1-ARB-SINGLE-REALITY-CERTIFICATION`
- `SKIP-A2-REMOTE-BRANCH-CONVERGENCE`
- `SKIP-A3-GITHUB-GOVERNANCE-STATUS-CHECK`
- `SKIP-A5-BRANCH-LAG-MONITOR-LIVE`
- `SKIP-D4-FROZEN-VERCEL-PROJECT-DELETION`
- `SKIP-D5-DNS-TERRAFORM-APPLY`

Provider/capability blockers remain in the skip and capability ledgers for live PSP credentials, payout provider credentials/enablement/smoke, capture/refund/settlement/reconciliation live variance-0 smoke, step-up signing secret/live TOTP smoke, identity keys/OIDC/drain, Liquid production canary and ARB default flip, mobile Turnstile secret/live smoke, alert-provider DSNs/on-call delivery drills, PITR, KYC, logistics, WhatsApp, live ESP dispatch, AI-credit purchases, and React deletion proof.

## Final Scores

| Dimension | Repository-side score | Evidence |
|---|---:|---|
| Architecture duplication | 10/10 | Reserved/rejected/frozen runtime validators and topology checks pass. |
| Governance authority | 9/10 | One local law chain and prompt perimeter pass; ARB signature remains `SKIP-EG1-ARB-SINGLE-REALITY-CERTIFICATION`. |
| Documentation convergence | 9/10 | Root markdown budget is 9/9 and prompt/DOC-02 drift is archived or pointed; live certification docs remain seam-backed. |
| Validator integrity | 9.5/10 | Gate passes 105 validators, orphan validators are wired, and mutation probes fail as expected. |
| Money convergence | Repository B1-B5 done; Phase F CAP-C03 payout client, CAP-C04 operator resolution, CAP-C05 settlement executor linkage, and CAP-C06 cryptographic step-up done repo-side | B6 live provider credentials, smoke, step-up signing-secret/live TOTP evidence, and variance-0 remain human/live seams. |
| Identity convergence | Merchant session issuance remains identity-platform-owned; CAP-C07 configured-public-JWKS publication and durable session revocation are repo-side done | Live identity keys, OIDC clients/grants, JWKS rotation evidence, and final HS256 drain telemetry remain human/live seams. |
| Mobile readiness | CAP-C09 Turnstile proof exchange is repo-side done and guarded by beta-readiness validation | Live Cloudflare Turnstile secret provisioning and production mobile login smoke remain human/live seams. |
| Alerting readiness | CAP-C10 API runtime alert metrics and queue-worker dry-run incident routing are repo-side done and guarded by beta-readiness validation | Live DSN/provider credentials, active on-call routing, mobile provider delivery, and production drill evidence remain human/live seams. |
| Tenant isolation readiness | CAP-C11 executable RT-1 through RT-9 Postgres proof is repo-side done and guarded by RLS FORCE validation | Live production-shaped database role probes, migration-state evidence, and queue-envelope secret proof remain human/live seams. |
| Theme convergence | Repository C0-C3 and CAP-C12 publish-path convergence done | C4 production canary, ARB flip, deployed publish/rollback smoke, and C7 React deletion proof remain blocked by live/canary and 4x100% parity evidence. |
| Checkout compatibility | CAP-C13 checkout Wasm/app-functions live path is retired repo-side and guarded by beta-readiness/app-platform tests | Hosted-checkout live cutover and provider smoke remain human/live seams, but checkout no longer depends on the rejected extension/Wasm runtime. |
| Transactional email readiness | CAP-C14 invite/contact queue wiring is repo-side done and guarded by beta-readiness plus queue payload tests | Live ESP provider dispatch, sender-domain verification, delivery webhooks, and provider smoke remain human/live seams under CAP-C18. |
| KYC readiness | CAP-C15 live manual review enters `needs_review` repo-side and is guarded by provider-mode validation/tests | Automated Signzy/HyperVerge provider clients, credentials, contract tests, and live verification evidence remain human/live seams. |

## Completion Statement

B/C/D/E repository-side implementation is complete to the current authority boundary. Every remaining item is either recorded as a live-only human seam in `SKIPPED_HUMAN_DECISIONS.md` or a capability gap in `CAPABILITY_BACKLOG.md`. No live result, ARB approval, provider success, DNS change, protected remote push, or production deployment is claimed.
