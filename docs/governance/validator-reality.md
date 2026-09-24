# Validator Reality

Generated governance validators are useful repository memory, but the raw count is not a production-readiness metric.

## Current Classification

- Real executable gates: full-repo `pnpm turbo typecheck`, `pnpm run test:unit:gateway`, `pnpm run test:behavioral`, `pnpm run test:contracts`, `scripts/validators/route-ownership-validator.mjs`, `scripts/validators/platform-domain-literal-validator.mjs`, and `scripts/validators/cycle-budget-validator.mjs`.
- Structural validators: import boundaries, dependency declarations, package exports, runtime manifests, migration safety, Cloudflare topology, and generated artifact checks. These can fail for real repository facts, but many still inspect source/config shape instead of executing business behavior.
- Plan-mode / not-live validators: certification, recovery, and provider-evidence validators currently prove that evidence contracts exist. They are not live production certification until provider-backed execute-mode evidence is recorded fresh through the operations control plane.
- String-presence validators: several historical validators still match docs/config phrases. They remain as residue detectors, not readiness proof.

## Readiness Signal

Foundation readiness must be reported from the executable and structural gates above, not from the number of validators in `scripts/validate-governance.mjs`.

The file-level cycle budget is currently `3` strongly connected components across `services/api-gateway/src` and `packages/*/src`. The budget may only ratchet down unless a ledger entry documents an intentional, temporary increase.

## Merchant Mobile Product Gate

Merchant-mobile readiness is tracked by executable Flutter tests, current governance validators, `CAPABILITY_BACKLOG.md`, and `SKIPPED_HUMAN_DECISIONS.md`. Historical Codex ledgers and the merchant-mobile master report are archived evidence only.

Wave gates must include the product-facing checks, not only repository governance:

- `flutter analyze apps/merchant/mobile`
- `flutter test apps/merchant/mobile`
- the touched TypeScript/service gates from the active wave
- `node scripts/validate-governance.mjs`
- a leak audit proving no merchant-visible screen renders `SKIP_NEEDS_HUMAN_*`, `SKIP-NEEDS-BACKEND`, `S-0NN`, or backend-contract wording

The live blockers are recorded as `SKIP-W7-MOBILE-TURNSTILE-SECRET`, `SKIP-CAP-MOBILE-TURNSTILE-DOUBLE-SPEND`, `SKIP-CAP-STORE-PUBLISH-PIPELINE`, `SKIP-MOBILE-EDITOR-ARB`, and `SKIP-D8-MOBILE-RELEASE-SIGNING-SECRETS`. Older mobile-readiness notes are archive context only and must not be cited as current launch authority.
