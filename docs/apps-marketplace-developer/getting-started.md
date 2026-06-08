# LetBuyy Apps Developer Getting Started

This scaffold describes the built marketplace developer flow. Hosting this documentation on a public docs domain is still a human-approved deployment step.

## Current Flow

1. Register at `/developers/register` with business, tax, ToS, privacy, and support contact details.
2. Wait for developer approval. The in-code approval workflow exists; final KYC policy is business/legal owned.
3. Create an app in the Partner Console with manifest, OAuth redirect URLs, privacy URL, pricing, support SLA, data-handling disclosure, and screenshots.
4. Submit the app for automated checks and human marketplace review.
5. After approval, merchants install through OAuth, approve any paid charge, review granted scopes, and configure extensions.
6. Use Partner Console analytics, webhook management, API usage metrics, versioning, and payout status to operate the app.

## Required App Inputs

- App name, slug, summary, category, icon, and at least one screenshot.
- HTTPS app URL, privacy URL, and OAuth redirect URLs.
- Manifest scopes and extension/function declarations.
- Pricing plan data for free, freemium, recurring, one-time, or usage pricing.
- Trial and usage-metering configuration when applicable.
- Support SLA, data-handling disclosure, and compatibility metadata.

## Local Verification

- App marketplace UI: `pnpm --filter @letbuyy/app-marketplace typecheck`, `lint`, `test`, and `build`.
- Gateway contracts: `pnpm --filter @letbuyy/api-gateway typecheck`, `build`, and targeted app-store contract tests.
- Governance: `node scripts/validate-governance.mjs`.
