# LetBuyy App Manifest Specification

This scaffold records the manifest fields enforced by the current app submission checks.

## Required Fields

- `name`: Human-readable app name.
- `slug`: Stable public app slug. It must match the submitted listing slug.
- `version`: App version string.
- `app_url`: HTTPS launch URL.
- `privacy_url`: HTTPS privacy policy URL.
- `oauth.redirect_urls`: HTTPS redirect URLs used by OAuth install.
- `scopes`: Requested platform scopes.
- `extensions`: Declared extension surfaces when the app provides merchant configuration or embedded/admin surfaces.
- `functions`: Declared function registrations when the app provides executable platform functions.

## Validation Rules

- App URL, privacy URL, and redirect URLs must use HTTPS.
- Requested scopes must be known platform scopes and must match the declared use case.
- Redirect URLs must match the submitted manifest and listing payload.
- Wasm/function module URLs are checked by the in-house static security scan before review.
- Submission creates automated check results; hard failures block the review queue.

## Versioning

- Developer edits create app version records and can trigger re-review.
- Release notes and changelog content are sourced from `app_versions`.
- Rollout percentage and cohort metadata are captured, but cohort enforcement remains partial until production rollout policy is approved.
