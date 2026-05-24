# Mobile Governance

LetBuyy mobile surfaces are Flutter runtimes backed by shared Dart packages. Mobile apps must not duplicate business logic that belongs in shared packages or backend services.

## Canonical Mobile Runtimes

- `apps/mobile/shopper-app`: reserved shopper/customer runtime.
- `apps/mobile/merchant-app`: active merchant runtime for dashboard, builder, products, themes, preview, and store management.
- `apps/mobile/operator-app`: active platform operator scaffold.

`apps/mobile/operator-team-app` is retired and must not be recreated.

## Dart Package Layers

- `packages/dart/core`: foundation constants, config, helpers, and platform utilities. It must not depend on other internal Dart packages.
- `packages/dart/models`: typed domain models and DTOs. It may depend on core.
- `packages/dart/services`: API, auth, payment, analytics, storage, notification, and data services. It may depend on core and models, but not UI kit.
- `packages/dart/ui_kit`: Flutter visual primitives, themes, states, and widgets. It may depend on core and models.

## Forbidden Mobile Patterns

- Flutter apps importing another Flutter app.
- Dart packages importing mobile app source.
- Core/services packages depending on UI kit.
- Provider secret keys embedded in Flutter source or tracked `.env` files.
- Tracked `.dart_tool`, `build`, `ios/Pods`, `android/.gradle`, APK, AAB, IPA, `.dill`, or generated platform caches.

## Environment Rules

- Mobile environment templates live at `config/env/templates/mobile.dart-defines.example`.
- Mobile env schema lives at `config/env/schemas/mobile.schema.json`.
- Mobile CI or local dart-define values must not be committed.
- Public endpoint and anon client values may be injected; provider secrets and service-role keys must stay backend-only.

## Enforcement

- `runtime-manifest-validator` requires mobile runtime manifests.
- `dependency-graph-validator` enforces Dart package layering and circular dependency prevention.
- `stale-artifact-validator` detects local Flutter build pollution under app/package roots.
- `generated-artifact-validator` blocks tracked Flutter artifacts.
