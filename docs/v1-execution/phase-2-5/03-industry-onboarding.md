# Stream C — Industry Onboarding — Report

**Status:** ✅ WIRED (typecheck + contract tests; visual UX unverified)

## Flow
`Create Store → Choose Industry → Recommended Experience (shown) → store created with the experience auto-applied`.

## Architecture (server-authoritative)
Chosen to avoid a new cross-package dependency and any `tenant-core` schema change:
1. **Onboarding (`apps/identity-platform/.../onboarding/page.tsx`, client):** a new industry `<select>` in step 3 (9 options) + a "Recommended experience" line. `handleSubmit` sends `survey: { industry }`. The client uses a small UI-only industry list; it does **not** import theme-engine (keeps the client bundle clean — no jsdom/liquidjs).
2. **create-store route (identity-platform):** already forwards `survey` into `template_config.survey` — **unchanged**.
3. **Gateway `POST /stores` (`services/api-gateway/src/routes/stores.ts`):** the canonical mapping lives here (the gateway already depends on `@letbuyy/theme-engine`). On creation it reads `template_config.survey.industry` (or an explicit `experienceId`), calls `resolveExperienceForIndustry(industry, override)`, and merges the experience into `template_config` via `applyExperienceToTemplateConfig` before the `sites` insert. The storefront then renders it for free (the LB-9 appearance bridge + the overlay).

## Requirements coverage
- **Industry selector** ✅ (onboarding step 3).
- **Experience recommendation** ✅ (shown in onboarding; canonical resolution server-side).
- **Manual override** ✅ (`experienceId` honored by the gateway resolver; merchant can also re-pick in the editor).
- **Fallback experience** ✅ (unknown/absent industry → Summit, the zero-regression General default).
- **Store-creation compatibility** ✅ **additive** — when no industry is present, `template_config` is unchanged (no behaviour change for other callers; verified by the contract test).

## Evidence
`lb-experience-flow.test.mjs` C-tests: onboarding captures industry + sends `survey.industry` + surfaces the recommendation; the gateway handler resolves + applies + is additive. `api-gateway` + `identity-platform` typechecks clean. Full launch suite 163/163.

## Honest boundary
The onboarding UI step + the created-store styling were **not visually verified** (needs the stack). The server logic is contract-tested.
