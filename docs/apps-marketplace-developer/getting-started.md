# LetBuyy Apps Developer Getting Started (Frozen Seam)

This scaffold describes the retained app-marketplace developer contracts. The public third-party app marketplace remains frozen until the named merchant/developer-demand trigger and ARB approval. Hosting this documentation on a public docs domain is still a human-approved deployment step.

## Repository Scaffold Flow

1. Register at `/developers/register` with business, tax, ToS, privacy, and support contact details.
2. Wait for developer approval. The in-code approval workflow exists; final KYC policy is business/legal owned.
3. Create an app record with manifest, OAuth redirect URLs, privacy URL, pricing metadata, support SLA, data-handling disclosure, and screenshots.
4. Submit the app for automated checks and human marketplace review.
5. Use OAuth install, scoped app tokens, and webhook contracts only in approved private/sandbox flows.
6. Treat extension/function declarations as review metadata until the checkout extension/Wasm capability seam is retired or formally re-scoped.

## Required App Inputs

- App name, slug, summary, category, icon, and at least one screenshot.
- HTTPS app URL, privacy URL, and OAuth redirect URLs.
- Manifest scopes and extension/function declarations as review metadata.
- Pricing plan data for free, freemium, recurring, one-time, or usage pricing.
- Trial and usage-metering configuration when applicable.
- Support SLA, data-handling disclosure, and compatibility metadata.

## Local Verification (Not Launch Certification)

- App marketplace UI: `pnpm --filter @letbuyy/app-marketplace typecheck`, `lint`, `test`, and `build`.
- Gateway contracts: `pnpm --filter @letbuyy/api-gateway typecheck`, `build`, and targeted app-store contract tests.
- Governance: `node scripts/validate-governance.mjs`.
