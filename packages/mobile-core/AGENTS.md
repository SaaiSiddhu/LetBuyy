# Mobile Core Package Governance

Purpose: Incubating Dart package boundary for mobile platform constants, responsive helpers, navigation contracts, and app-neutral mobile utilities.

Boundary: `packages/mobile-core`.

Status: Incubating. Existing Dart core package remains at `packages/dart/core` until migration.

Rules:

- Do not couple to a single mobile app runtime.
- Shared mobile logic must remain testable under root analyzer rules.
