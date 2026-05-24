# Mobile Services Package Governance

Purpose: Incubating Dart package boundary for mobile data, payment, analytics, order, auth, storage, and notification service clients.

Boundary: `packages/mobile-services`.

Status: Incubating. Existing Dart services remain at `packages/dart/services` until migration.

Rules:

- Do not store auth tokens in insecure local storage.
- Service clients must use platform API contracts and tenant context.
