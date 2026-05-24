# App Engine Package Governance

Purpose: Incubating domain package for app marketplace contracts, install lifecycle, permissions, developer apps, reviews, callbacks, and partner integration metadata.

Boundary: `packages/app-engine`.

Status: Incubating. Extract only typed contracts and pure lifecycle rules until service runtimes are split.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- App permissions must be explicit and least-privilege.
- Webhook and callback contracts must be versioned.
