# Stream F — Store Creation Integration — Report

**Status:** 📋 SPEC-READY (engine done; wiring deferred — see rationale)

## Why deferred (not fabricated)
The three integration targets — `services/api-gateway/src/routes/stores.ts`, `apps/identity-platform/src/app/api/auth/create-store/route.ts`, and `packages/tenant-core/src/index.ts` (`CreateStoreSchema`) — are **all pre-existing WIP-modified** (` M`), and `tenant-core` is a high-blast-radius **domain package**. The onboarding wizard (`onboarding/page.tsx`) is design-system-ratcheted `apps/` TSX. Editing these would bundle unrelated WIP and cannot be verified end-to-end without the stack. The **engine is complete and tested**; only the wiring remains.

## Ready-to-apply integration (no `tenant-core` change required)
`CreateStoreSchema` already accepts `template_config: Record<string,unknown>`. So the experience can be applied **without a schema change** by embedding it into `template_config` at creation:

1. **Onboarding (`onboarding/page.tsx`)** — add an industry step using `INDUSTRY_OPTIONS` from `@letbuyy/theme-engine`. On selection, `const { experience } = resolveExperienceForIndustry(industryId)`.
2. **Build the template_config** with the experience applied:
   ```ts
   import { applyExperienceToTemplateConfig, resolveExperienceForIndustry } from '@letbuyy/theme-engine';
   const { experience } = resolveExperienceForIndustry(industryId, chosenOverride);
   const template_config = applyExperienceToTemplateConfig({ themeId: site.theme_id }, experience);
   ```
   Pass `template_config` in the existing create-store body (already forwarded to `POST /stores` and stored verbatim on `sites.template_config`).
3. **Storefront reads it for free** — `store-service.ts` already maps `templateConfig.themeSettings` (React) and `config.settings_data.current` (Liquid) into `:root` tokens (the LB-9 bridge from Phase 1 + the experience overlay). Zero storefront change.

## Target flow
`Create Store → Select Industry → (resolveExperienceForIndustry recommends) → Apply Experience (embedded in template_config) → Store Ready`

Fallback: no industry → Summit (zero-regression General default). Override: merchant may pick any experience.

## Acceptance the wiring must meet
- New store created with an industry carries that experience's tokens in `sites.template_config` (verifiable by reading the row / a gateway contract test).
- First storefront render shows the experience colors (no extra publish step).
- Closes the audit gap "onboarding does not auto-assign themes".

## Lighter alternative (avoids touching the onboarding TSX)
Resolve + embed the experience **server-side** in the gateway `POST /stores` handler from an optional `industry` field — but that requires adding `industry` to `CreateStoreSchema` (tenant-core). The `template_config` route above is preferred because it needs no domain-package change.
