# LetBuyy Domain Split Foundation Ledger

## ARCHITECTURE-DIRECTION DECISIONS

- DECISION: `letbuyy.com` is the platform control-plane apex; `letbuyy.store` remains storefront-only for wildcard storefronts and merchant custom domains.
- DECISION: Platform SSO and storefront shopper sessions are separate cookie realms. Platform cookies are env-scoped through `COOKIE_DOMAIN`; storefront cookies are host-only and must not set a `domain` attribute.
- DECISION: Phase-1 merchant custom domains use Vercel-direct CNAME records targeting `cname.vercel-dns.com`; Cloudflare-for-SaaS storefront routing is deferred.
- DECISION: Storefront access gating is enforced in `apps/storefront-runtime` middleware and backed by `services/api-gateway` as the single writer.
- DECISION: Live `.com` env flips are human/account actions and must happen only in the same release as DNS/Vercel host movement; setting `COOKIE_DOMAIN=.letbuyy.com` while platform apps are served on `*.letbuyy.store` breaks login.

## BASELINE

Captured with the existing dirty working tree preserved. Required target branch was `stream/domain-split-foundation`; later Git inspection found the active branch was `stream/letbuyy-ui-v2`, and switching to the existing `stream/domain-split-foundation` branch was blocked by user-owned dirty files that Git would overwrite.

- `pnpm install --frozen-lockfile --force`
  - Initial sandbox run: `FAILED` with registry DNS `ENOTFOUND` for `registry.npmjs.org`.
  - Escalated rerun: `DONE`, exit code 0, 956 packages added/reused, completed in 10.6s.
- `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`
  - `DONE`, exit code 0.
  - Pass count: 59/59 tasks successful.
- `pnpm lint`
  - `DONE`, exit code 0.
  - Pass count: 9/9 lint tasks successful, warnings only.
- `pnpm turbo test --output-logs=errors-only --log-order=grouped`
  - Initial sandbox run: `FAILED` with TSX IPC `listen EPERM` on `/tmp/tsx-501/*.pipe`.
  - Escalated rerun: `DONE`, exit code 0.
  - Pass count: 67/67 tasks successful.
- `pnpm run test:contracts`
  - Initial sandbox run: `FAILED` with TSX IPC `listen EPERM` on `/var/folders/.../tsx-501/*.pipe`.
  - Escalated rerun: `DONE`, exit code 0.
  - Pass count: 157/157 tests passed.
- `pnpm run test:behavioral`
  - `FAILED`, exit code 1.
  - Pass count: 453/459 tests passed; 6 failed.
  - Failure root: `environment-honesty` rejects existing dirty-tree hardcoded `.com` source defaults in app source files.
- `flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models`
  - `DONE`, exit code 0.
  - Result: No issues found.
- Clean generated artifacts before governance:
  - `find apps services packages -type d \( -name node_modules -o -name .turbo -o -name .next -o -name .wrangler -o -name dist -o -name .dart_tool \) -prune -exec rm -rf {} +`
  - `DONE`, exit code 0.
- `pnpm run validate:governance`
  - `FAILED`, exit code 1.
  - Baseline gate state: 57 validator scripts passed before `environment-honesty-validator.mjs` failed.
  - Failure root: active source hardcodes retired `.com` URL/email defaults in app source.

## PROGRESS LOG

- 2026-06-06T18:15:50Z [DS-0] Baseline gate capture — DONE/BASELINE FAILURES RECORDED
  - Commands run exactly:
    - `pnpm install --frozen-lockfile --force`
    - `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`
    - `pnpm lint`
    - `pnpm turbo test --output-logs=errors-only --log-order=grouped`
    - `pnpm run test:contracts`
    - `pnpm run test:behavioral`
    - `flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models`
    - `find apps services packages -type d \( -name node_modules -o -name .turbo -o -name .next -o -name .wrangler -o -name dist -o -name .dart_tool \) -prune -exec rm -rf {} +`
    - `pnpm run validate:governance`
  - Evidence:
    - Install passed after network escalation.
    - Typecheck passed 59/59 tasks.
    - Lint passed 9/9 tasks with warnings only.
    - Turbo tests passed 67/67 tasks after TSX IPC escalation.
    - Contract tests passed 157/157 after TSX IPC escalation.
    - Behavioral tests failed 453/459 because `environment-honesty` found existing hardcoded `.com` active source defaults.
    - Flutter analyze passed with no issues.
    - Governance failed after 57 validator passes at `environment-honesty-validator.mjs`.

- 2026-06-06T18:32:00Z [DS-1] DNS parallel stand-up — DONE/SKIPPED HUMAN APPLY
  - Implemented/verified `infrastructure/dns/letbuyy_com.tf` as additive Cloudflare zone config for the platform `.com` realm with Vercel CNAME targets and no provider re-declaration.
  - Commands run exactly:
    - `terraform fmt -check infrastructure/dns`
    - `terraform -chdir=infrastructure/dns init -backend=false`
    - `terraform -chdir=infrastructure/dns validate`
    - `rm -rf infrastructure/dns/.terraform infrastructure/dns/.terraform.lock.hcl`
  - Evidence:
    - `terraform fmt -check infrastructure/dns` passed.
    - `terraform init` needed network escalation because provider lookup was blocked by sandbox DNS; escalated rerun passed.
    - `terraform validate` passed after provider initialization.
    - `tests/contracts/dns-letbuyy-com-zone.test.ts` added.
  - SKIPPED — NEEDS HUMAN: Cloudflare zone creation, registrar nameserver move, `cloudflare_zone_id_com`, `terraform plan && terraform apply`.

- 2026-06-06T18:45:00Z [DS-2] Env contract target-ready — DONE
  - Added `NEXT_PUBLIC_STORE_ROOT_DOMAIN`, preview/store access signing env names, `.com` cutover comments, and active `.store` defaults in env schemas/templates.
  - Removed active source `.com` defaults from app/package source by making public URL helpers env-driven and fail-loud.
  - Commands run exactly:
    - `rg -n "letbuyy\\.com|@letbuyy\\.com" apps packages services`
  - Evidence:
    - Final source scan returned no matches in `apps`, `packages`, or `services`.
    - `tests/contracts/env-domain-contract.test.ts` added.
  - SKIPPED — NEEDS HUMAN: real `.com` values in Vercel/CI at cutover. Hazard recorded: `COOKIE_DOMAIN=.letbuyy.com` before the apps move to `.com` breaks login.

- 2026-06-06T18:52:00Z [DS-3] Cookie realm correctness — DONE
  - Added shared storefront gate/preview cookie constants and signed-token helpers in `@letbuyy/auth-core`.
  - Locked platform cookies to `process.env.COOKIE_DOMAIN` and storefront cookies to host-only `__Host-` writes.
  - Commands run exactly:
    - `node scripts/validators/cookie-realm-validator.mjs`
  - Evidence:
    - Cookie realm validator passed.
    - `tests/contracts/cookie-realm.test.ts` added.

- 2026-06-06T18:58:00Z [DS-4] Host parser and reserved-label source — DONE
  - Added `RESERVED_STOREFRONT_LABELS`, env-root host parsing, reserved-label rejection, and custom-domain classification in `@letbuyy/tenant-core`.
  - Wired gateway/storefront usage to tenant-core instead of local lists.
  - Commands run exactly:
    - `node scripts/validators/reserved-subdomain-single-source-validator.mjs`
  - Evidence:
    - Reserved-subdomain single-source validator passed.
    - `tests/contracts/reserved-subdomain.test.ts` added.

- 2026-06-06T19:05:00Z [DS-5] Custom-domain and storefront-access data model — DONE/SKIPPED HUMAN MIGRATION
  - Added migration `database/supabase/migrations/090_custom_domains_and_store_access.sql`.
  - Updated `000_baseline.sql`, shared site/store types, migration safety expectations, and single-writer owned table rules for `site_preview_links` and `site_gate_attempts`.
  - Commands run exactly:
    - `node scripts/validators/migration-safety-validator.mjs`
  - Evidence:
    - Migration safety validator passed.
    - `tests/migrations/custom-domains-store-access.test.mjs` added.
  - SKIPPED — NEEDS HUMAN: run migration against staging/production through protected DB credentials.

- 2026-06-06T19:12:00Z [DS-6] API gateway custom-domain and access endpoints — DONE
  - Added api-gateway routes for domain claim/verify/delete, merchant store access settings, preview link mint/revoke, internal storefront host resolution, and store-password verify.
  - Added Argon2id hashing via `hash-wasm`, DNS-over-HTTPS TXT/CNAME checks, takeover prevention, and Vercel CNAME target validation.
  - Commands run exactly:
    - `pnpm add --filter @letbuyy/api-gateway hash-wasm@^4.12.0`
    - `pnpm run test:contracts`
  - Evidence:
    - `pnpm run test:contracts` passed 181/181 after TSX IPC escalation.
    - `tests/contracts/custom-domains.test.ts` added.

- 2026-06-06T19:18:00Z [DS-7] Storefront middleware access gate — DONE
  - Added `apps/storefront-runtime/src/middleware.ts` and gateway client helper for host resolution, password gate, preview-only/offline handling, noindex gated responses, test-mode preview checkout, and custom-domain canonical redirects.
  - Reused existing preview/coming-soon surfaces and kept password verification in gateway.
  - Commands run exactly:
    - `node scripts/validators/storefront-access-gate-validator.mjs`
    - `node scripts/validators/storefront-seo-access-validator.mjs`
  - Evidence:
    - Storefront access gate validator passed.
    - Storefront SEO access validator passed.
    - `tests/contracts/storefront-access-gate.test.ts` and `tests/contracts/storefront-seo-access.test.ts` added.

- 2026-06-06T19:21:00Z [DS-8] Merchant domain/access settings UI — DONE
  - Rebuilt merchant settings domains page with custom-domain DNS/status workflow, access mode controls, password/message fields, and preview-link controls using existing UI primitives.
  - Removed app-local proxy routes and calls gateway endpoints directly as required.
  - Commands run exactly:
    - `node scripts/validators/merchant-domains-settings-validator.mjs`
  - Evidence:
    - Merchant domains settings validator passed.
    - `tests/contracts/merchant-domains-settings.test.ts` added.

- 2026-06-06T19:23:00Z [DS-9] Mobile parity — DONE
  - Updated Flutter merchant domain service, settings screen, and store model for custom-domain status, access modes, and preview-link controls.
  - Commands run exactly:
    - `node scripts/validators/mobile-domain-parity-validator.mjs`
    - `flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models`
    - `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart`
  - Evidence:
    - Mobile parity validator passed.
    - Flutter analyze passed with no issues.
    - Flutter service test passed all tests after SDK-cache escalation.

- 2026-06-06T19:24:00Z [DS-10] SEO and robots transitions — DONE
  - Updated storefront SEO, robots, sitemap, metadata, and middleware redirects so gated/unpublished/preview surfaces noindex and active custom domains become canonical.
  - Commands run exactly:
    - `node scripts/validators/storefront-seo-access-validator.mjs`
    - `pnpm run test:contracts`
  - Evidence:
    - Storefront SEO validator passed.
    - Contract tests passed 181/181.

- 2026-06-06T19:27:01Z [DS-11] Governance finalization evidence — DONE
  - Regenerated repository intelligence after staging new mission source files so `git ls-files` includes the new migration and route modules.
  - Commands run exactly:
    - `node scripts/generate-repository-intelligence.mjs`
    - `pnpm install --frozen-lockfile --force`
    - `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`
    - `pnpm lint`
    - `pnpm turbo test --output-logs=errors-only --log-order=grouped`
    - `pnpm run test:contracts`
    - `pnpm run test:behavioral`
    - `flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models`
    - `find apps services packages -type d \( -name node_modules -o -name .turbo -o -name .next -o -name .wrangler -o -name dist -o -name .dart_tool \) -prune -exec rm -rf {} +`
    - `pnpm run validate:governance`
  - Evidence:
    - `pnpm install` passed after sandbox DNS escalation.
    - Typecheck passed 59/59 tasks.
    - Lint passed 9/9 tasks with warnings only.
    - Turbo tests passed 67/67 tasks after TSX IPC escalation.
    - Contract tests passed 181/181 after TSX IPC escalation.
    - Behavioral tests passed 462/462.
    - Flutter analyze passed with no issues.
    - Governance validation passed 163/163 validators.
    - Branch/PR blocker: existing `stream/domain-split-foundation` has unique commit `562b1959`; switching from current dirty `stream/letbuyy-ui-v2` was refused because user-owned dirty files would be overwritten. No stash, reset, force branch update, commit, push, or PR was performed.
