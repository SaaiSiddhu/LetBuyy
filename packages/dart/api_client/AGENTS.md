# Dart API Client AGENTS.md

Purpose: typed Dart gateway client for the governed LetBuyy `/v1` API.

Canonical source boundary: `packages/dart/api_client`.

## Ownership Rules

- Own HTTP transport, gateway request options, response unwrapping, retry policy, auth/store/idempotency headers, and JSON boundary DTO helpers for Dart/mobile runtimes.
- Keep this package free of app-specific UI, routing, Firebase, Supabase SDK usage, storage provider SDK usage, payment SDK usage, and runtime-local environment files.
- Use the app/runtime to supply base URL, access-token provider, store ID provider, and public client headers.
- Return gateway JSON records unless a stable Dart model package already owns a matching API DTO.

## Dependency Rules

- May depend on `dio` and pure Dart utilities.
- Must not depend on Flutter UI packages, mobile apps, services, infrastructure, or generated output.
- Downstream mobile apps may depend on this package; this package must not import downstream app code.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, Firebase packages, Supabase packages, or payment SDKs.
- No committed secrets or service-role keys.

## Runtime Authority

- This package does not deploy independently and does not own environment values.
- Runtime manifests and app dart-define files decide which base URL and token source are used.

## Migration Notes

- App-local API clients should become compatibility exports or thin adapters around this package.
- As M2-M8 migrate legacy services, prefer package resource methods over direct Firebase, Firestore, Supabase, or ad-hoc HTTP calls.
