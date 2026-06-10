# LetBuyy Domain Phase Finalization Ledger

## ARCHITECTURE-DIRECTION DECISIONS

- DECISION: Shopper accounts remain per-store and host-only in this phase. `@letbuyy/auth-core` owns the `ShopperIdentityProvider` seam; `id.letbuyy.store` is reserved for a future central shopper issuer and does not grant platform sessions.
- DECISION: Merchant custom domains point at the LetBuyy-owned target `connect.letbuyy.store`; the Vercel CNAME is an internal chained target and documented fallback only.
- DECISION: Vercel custom-domain attachment is automated through env-driven gateway code. Missing Vercel token/project env fails loud.
- DECISION: Buy-a-domain is implemented behind a pluggable registrar provider. Live registrar purchase remains human-gated until reseller credentials and pricing policy exist.
- DECISION: `services/api-gateway` remains the single writer for `sites`, `site_domain_reviews`, and `domain_orders`; queue-workers trigger reconciliation only through gateway internal endpoints.

## BASELINE

Baseline inherited from `CODEX_DOMAIN_SPLIT_STATUS.md` / `CODEX_DOMAIN_SPLIT_LEDGER.md` on the dirty `stream/letbuyy-ui-v2` branch:

- `pnpm install --frozen-lockfile --force`: PASS after prior sandbox DNS escalation.
- `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`: 59/59 PASS.
- `pnpm lint`: 9/9 PASS with warnings only.
- `pnpm turbo test --output-logs=errors-only --log-order=grouped`: 67/67 PASS after prior TSX IPC escalation.
- `pnpm run test:contracts`: 181/181 PASS after prior TSX IPC escalation.
- `pnpm run test:behavioral`: 462/462 PASS.
- `flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models`: PASS.
- `pnpm run validate:governance`: 163/163 PASS.
- Branch state: still on `stream/letbuyy-ui-v2`; switching to `stream/domain-split-foundation` was blocked by dirty user-owned files. No stash, reset, or force checkout was performed.

## PROGRESS LOG

- 2026-06-06T20:10:00Z [DF-0] Branch and baseline review - DONE/BLOCKER CARRIED
  - Commands run exactly:
    - `git status --short --branch`
    - `rg -n "cname\\.vercel-dns\\.com|VERCEL_CNAME_TARGET|connect\\.letbuyy\\.store|accounts\\.letbuyy\\.store|id\\.letbuyy\\.store" services apps packages config infrastructure docs tests scripts database CODEX_DOMAIN_SPLIT_STATUS.md DOMAIN_PHASE_DECISIONS.md LETBUYY_STOREFRONT_ACCESS_V1.md -g '!**/node_modules/**'`
  - Evidence: current branch remains `stream/letbuyy-ui-v2` with large pre-existing dirty UI/domain changes; branch isolation remains human-gated.

- 2026-06-06T20:25:00Z [DF-1..DF-3] Connect target, Vercel attach, apex MX warning - DONE/SKIPPED LIVE
  - Implemented `CUSTOM_DOMAIN_CNAME_TARGET` / `NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET`, `connect` DNS record, Vercel Domains API client, gateway attach/status reads, merchant/mobile instructions, and apex MX warning surfaces.
  - Added `docs/runbooks/custom-domain-cname-smoke-test.md`.
  - Commands run exactly:
    - `node scripts/validators/custom-domain-target-validator.mjs`
    - `node scripts/validators/vercel-domain-automation-validator.mjs`
  - Evidence: both validators passed.
  - SKIPPED -- NEEDS HUMAN: Terraform apply and live chained-CNAME smoke test; Vercel token/project secret creation.

- 2026-06-06T20:34:00Z [DF-4..DF-6] Store password lockout, abuse screening, reconciler - DONE/SKIPPED LIVE
  - Gateway now records `site_gate_attempts` on verify and enforces per-site/host/IP lockout.
  - Added fail-safe abuse screening and gateway-owned `site_domain_reviews`.
  - Added internal custom-domain reconciler route and queue-worker scheduled trigger.
  - Commands run exactly:
    - `node scripts/validators/custom-domain-abuse-screening-validator.mjs`
    - `node scripts/validators/custom-domain-reconciler-validator.mjs`
  - Evidence: both validators passed.
  - SKIPPED -- NEEDS HUMAN: abuse reputation keys and review-queue staffing.

- 2026-06-06T20:40:00Z [DF-7] Shopper identity seam - DONE
  - Added `ShopperIdentityProvider` and host-only provider in `@letbuyy/auth-core`.
  - Storefront session code consumes the provider; DNS reserves `id.letbuyy.store` as a commented placeholder.
  - Commands run exactly:
    - `node scripts/validators/shopper-identity-seam-validator.mjs`
  - Evidence: validator passed.

- 2026-06-06T20:46:00Z [DF-8] Buy-a-domain path - DONE/SKIPPED LIVE
  - Added registrar provider seam with ResellerClub, OpenSRS, and non-production mock providers.
  - Added gateway search/purchase endpoints, `domain_orders`, and merchant/mobile search-purchase UI.
  - Commands run exactly:
    - `node scripts/validators/registrar-provider-validator.mjs`
  - Evidence: validator passed.
  - SKIPPED -- NEEDS HUMAN: reseller account, credentials, and markup policy.

- 2026-06-06T20:50:00Z [VERIFY] Contract, typecheck, lint, behavioral, and mobile evidence - DONE
  - Commands run exactly:
    - `pnpm run test:contracts`
    - `pnpm turbo typecheck --output-logs=errors-only --log-order=grouped`
    - `pnpm lint`
    - `pnpm turbo test --output-logs=errors-only --log-order=grouped`
    - `pnpm run test:behavioral`
    - `flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models`
    - `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart`
  - Evidence:
    - `pnpm run test:contracts`: initial sandbox run failed with TSX IPC `EPERM`; escalated rerun passed 193/193.
    - `pnpm turbo typecheck`: initial run failed on generated `.next/dev/types`; after `.next` cleanup, passed 59/59.
    - `pnpm lint`: passed 9/9 with warnings only.
    - `pnpm turbo test`: initial sandbox run failed with TSX IPC `EPERM`; escalated rerun passed 67/67.
    - `pnpm run test:behavioral`: passed 462/462.
    - `flutter analyze`: passed, no issues found.
    - `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart`: initial sandbox run failed on Flutter SDK cache permissions; escalated final rerun passed all tests.

- 2026-06-06T20:58:48Z [DF-9] Governance finalization - DONE
  - Commands run exactly:
    - `node scripts/generate-repository-intelligence.mjs`
    - `find apps services packages -type d \( -name node_modules -o -name .turbo -o -name .next -o -name .wrangler -o -name dist -o -name .dart_tool \) -prune -exec rm -rf {} +`
    - `pnpm run validate:governance`
    - `pnpm run test:contracts`
  - Evidence:
    - Intelligence regenerated.
    - Generated artifacts cleaned.
    - First governance run reached source-ledger residue after all new domain validators passed; archived residue files and updated the allowed active finalization ledger/status list.
    - Repository-intelligence expected baseline table count updated from 235 to 237 after adding gateway-owned `site_domain_reviews` and `domain_orders`.
    - Vercel attach error response sanitized so raw provider messages are not returned to clients.
    - Final `pnpm run validate:governance`: PASS, 169/169 validators.
    - Final `pnpm run test:contracts`: sandbox run failed with TSX IPC `EPERM`; escalated rerun passed 193/193.
