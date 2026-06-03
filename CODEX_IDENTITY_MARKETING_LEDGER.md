# CODEX IDENTITY & MARKETING LEDGER

## CURRENT STATUS
- Stage: WS6 Identity & Marketing.
- Branch: `stream/master-execution`.
- Active task: ID1.4 Store selector.
- Source ownership: `apps/identity-platform/src/**` and `apps/marketing-site/src/**` only. Root ledgers are bookkeeping exceptions.

## BASELINE
- Mission read: `docs/Codex_waves/CODEX_IDENTITY_MARKETING_MISSION.md`.
- Local app contracts read: `apps/identity-platform/AGENTS.md`, `apps/marketing-site/AGENTS.md`.
- ID1.1 target page: `apps/identity-platform/src/app/signup/page.tsx`.
- Existing signup behavior confirmed in source before edits: email -> OTP -> password stages already exist, but the page used mostly local auth form classes, dot-only progress, no explicit step labels, and no inline email format validation before submitting.
- ID1.2 target page: `apps/identity-platform/src/app/onboarding/page.tsx`.
- Existing onboarding behavior confirmed in source before edits: the page already validates subdomains and creates stores through the identity API route, but the visible flow was a six-step wizard with separate type, naming, template, goal, team-size, and confirmation steps.
- ID1.3 target state: `apps/identity-platform/src/app/onboarding/page.tsx` success branch after `handleSubmit`.
- Existing success behavior confirmed in source before edits: store creation set `success`, displayed a plain confirmation, URL chip, and auto-redirect message, but did not provide an explicit dashboard CTA or celebration copy.

## PROGRESS LOG
- 2026-06-03T22:02:00Z [ID1.3] Success screen - DONE. Files: `apps/identity-platform/src/app/onboarding/page.tsx`. Reworked the existing post-create success branch into a celebration screen with localized "Your store is ready" copy, success badge, store summary, redirect banner, and immediate dashboard CTA using the same dashboard URL as the existing timed redirect. The proof exercised the real local create-store flow for desktop and mobile test stores. No auth/session/RBAC/backend/DB/contract/service/package-core/governance files changed.
- 2026-06-03T21:42:00Z [ID1.2] Store creation wizard - DONE. Files: `apps/identity-platform/src/app/onboarding/page.tsx`. Compressed the visible onboarding path into a three-step guided wizard: Type, Details, and Review. Selecting a site type now applies smart defaults for online-store goal, solo team size, and a modern store template; the details step shows India commerce defaults for INR, GST-ready setup, and COD-ready launch guidance; and the review step summarizes site type, display name, URL, and defaults before invoking the existing create-store submit handler. No auth/session/RBAC/backend/DB/contract/service/package-core/governance files changed.
- 2026-06-03T22:05:00Z [ID1.1] Signup flow polish - DONE. Files: `apps/identity-platform/src/app/signup/page.tsx` and `apps/identity-platform/src/app/globals.css`. Added shared `@letbuyy/ui` `ProgressBar`, `Badge`, `Input`, `Button`, and `Banner` composition to the existing signup flow without changing auth/session/RBAC/API behavior. The page now shows a labeled guided setup progress header, step labels for Account/Verify/Secure, inline email helper and validation states, shared disabled/loading buttons, and shared error banners for email, OTP, and password steps. Added Tailwind source coverage for `@letbuyy/ui` in the identity app so shared component classes render correctly.

## SKIP LIST
- None for ID1.1-ID1.3.

## VISUAL LEDGER
- 2026-06-03T22:05:00Z ID1.1 Signup before desktop screenshot - `.tmp/screenshots/ws6-id1-signup/before-desktop.png`.
- 2026-06-03T22:05:00Z ID1.1 Signup before mobile screenshot - `.tmp/screenshots/ws6-id1-signup/before-mobile.png`.
- 2026-06-03T22:05:00Z ID1.1 Signup after desktop screenshot - `.tmp/screenshots/ws6-id1-signup/after-desktop.png`.
- 2026-06-03T22:05:00Z ID1.1 Signup after mobile screenshot - `.tmp/screenshots/ws6-id1-signup/after-mobile.png`.
- 2026-06-03T22:05:00Z ID1.1 Signup invalid-email desktop screenshot - `.tmp/screenshots/ws6-id1-signup/after-invalid-desktop.png`.
- 2026-06-03T22:05:00Z ID1.1 Signup invalid-email mobile screenshot - `.tmp/screenshots/ws6-id1-signup/after-invalid-mobile.png`.
- 2026-06-03T21:42:00Z ID1.2 Onboarding before desktop screenshot - `.tmp/screenshots/ws6-id2-onboarding/before-desktop.png`.
- 2026-06-03T21:42:00Z ID1.2 Onboarding before mobile screenshot - `.tmp/screenshots/ws6-id2-onboarding/before-mobile.png`.
- 2026-06-03T21:42:00Z ID1.2 Onboarding after desktop step 1 screenshot - `.tmp/screenshots/ws6-id2-onboarding/after-flow-desktop-step1.png`.
- 2026-06-03T21:42:00Z ID1.2 Onboarding after desktop step 2 screenshot - `.tmp/screenshots/ws6-id2-onboarding/after-flow-desktop-step2-details.png`.
- 2026-06-03T21:42:00Z ID1.2 Onboarding after desktop step 3 screenshot - `.tmp/screenshots/ws6-id2-onboarding/after-flow-desktop-step3-review.png`.
- 2026-06-03T21:42:00Z ID1.2 Onboarding after mobile step 1 screenshot - `.tmp/screenshots/ws6-id2-onboarding/after-flow-mobile-step1.png`.
- 2026-06-03T21:42:00Z ID1.2 Onboarding after mobile step 2 screenshot - `.tmp/screenshots/ws6-id2-onboarding/after-flow-mobile-step2-details.png`.
- 2026-06-03T21:42:00Z ID1.2 Onboarding after mobile step 3 screenshot - `.tmp/screenshots/ws6-id2-onboarding/after-flow-mobile-step3-review.png`.
- 2026-06-03T22:02:00Z ID1.3 Success desktop screenshot after real local create-store - `.tmp/screenshots/ws6-id3-success/success-desktop.png`.
- 2026-06-03T22:02:00Z ID1.3 Success mobile screenshot after real local create-store - `.tmp/screenshots/ws6-id3-success/success-mobile.png`.

## VALIDATOR LEDGER
- 2026-06-03T22:04:00Z [ID1.3 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-03T22:02:00Z [ID1.3 scoped] Initial typecheck/lint after generated-artifact cleanup failed only because workspace dependency links were missing; `pnpm install --frozen-lockfile --force` restored links with lockfile unchanged and 0 downloads. Rerun `pnpm --filter @letbuyy/identity-platform typecheck` -> PASS; `pnpm --filter @letbuyy/identity-platform lint` -> PASS with 12 pre-existing warnings and no errors; `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @letbuyy/identity-platform exec next build --webpack` -> PASS, including `/onboarding`. `pnpm run federation:local:up` -> PASS; escalated `node .tmp/ws6-id3-success-proof.mjs success` -> PASS, creating local test stores `codex-success-desk-ym1wan` and `codex-success-mob-ym1xls`, then capturing desktop/mobile success screenshots before the existing redirect. Visual review completed for both screenshots; CTA/banner spacing was polished and reproven. `pnpm run federation:local:down` -> PASS.
- 2026-06-03T21:55:00Z [ID1.2 post-commit governance] Post-commit `pnpm run validate:governance` after `4879b9d4` -> PASS (128/128 validators).
- 2026-06-03T21:52:00Z [ID1.2 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-03T21:50:00Z [ID1.2 scoped] Baseline `node .tmp/ws6-id2-onboarding-proof.mjs before` -> PASS with desktop/mobile screenshots. After edits, `pnpm install --frozen-lockfile --force` restored workspace links with lockfile unchanged and 0 downloads after generated-artifact cleanup; `pnpm --filter @letbuyy/identity-platform typecheck` -> PASS; `pnpm --filter @letbuyy/identity-platform lint` -> PASS with 12 pre-existing warnings and no errors; `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @letbuyy/identity-platform exec next build --webpack` -> PASS, including `/onboarding`. `pnpm run federation:local:up` -> PASS; escalated `node .tmp/ws6-id2-onboarding-proof.mjs after-flow` -> PASS against the local gateway and identity app, capturing desktop/mobile step 1, step 2, and review screenshots without submitting the final create-store mutation. Visual review completed for desktop/mobile details and review states; the mobile display-name label/input collision and compressed review summary found during proof were fixed and reproven. `pnpm run federation:local:down` -> PASS.
- 2026-06-03T22:11:00Z [ID1.1 post-commit governance] Post-commit `pnpm run validate:governance` after `fab09ec1` -> PASS (128/128 validators).
- 2026-06-03T22:08:00Z [ID1.1 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-03T22:05:00Z [ID1.1 scoped] `pnpm install --frozen-lockfile --force` restored workspace links with lockfile unchanged and 0 downloads after prior generated-artifact cleanup. `pnpm run federation:local:up` -> PASS; baseline `node .tmp/ws6-id1-signup-proof.mjs before` -> PASS with desktop/mobile screenshots. After edits, `pnpm --filter @letbuyy/identity-platform typecheck` -> PASS; `pnpm --filter @letbuyy/identity-platform lint` -> PASS with 12 pre-existing warnings and no errors; `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @letbuyy/identity-platform exec next build --webpack` -> PASS, including `/signup`; `node .tmp/ws6-id1-signup-proof.mjs after` -> PASS; `node .tmp/ws6-id1-signup-proof.mjs after-invalid` -> PASS with inline validation screenshots. Visual review completed for desktop/mobile default and invalid-email states; no overlap or clipping found. `pnpm run federation:local:down` -> PASS.
