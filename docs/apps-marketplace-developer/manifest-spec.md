# LetBuyy App Manifest Specification (Frozen Seam)

This scaffold records the manifest fields enforced by current app submission checks. It does not activate a public third-party app marketplace or live checkout-function execution.

## Required Fields

- `name`: Human-readable app name.
- `slug`: Stable public app slug. It must match the submitted listing slug.
- `version`: App version string.
- `app_url`: HTTPS launch URL.
- `privacy_url`: HTTPS privacy policy URL.
- `oauth.redirect_urls`: HTTPS redirect URLs used by OAuth install.
- `scopes`: Requested platform scopes.
- `extensions`: Declared extension surfaces for review metadata and future approved surfaces.
- `functions`: Declared function registrations for review metadata only while live execution remains frozen.

## Validation Rules

- App URL, privacy URL, and redirect URLs must use HTTPS.
- Requested scopes must be known platform scopes and must match the declared use case.
- Redirect URLs must match the submitted manifest and listing payload.
- Function module URLs are review metadata only; the buyer checkout live path no longer executes Wasm/functions, and any future execution requires a new ARB-approved scope.
- Submission creates automated check results; hard failures block the review queue.

## Versioning

- Developer edits create app version records and can trigger re-review.
- Release notes and changelog content are sourced from `app_versions`.
- Rollout percentage and cohort metadata are captured, but cohort enforcement remains partial until production rollout policy is approved.
