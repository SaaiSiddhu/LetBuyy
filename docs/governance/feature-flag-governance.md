# Feature Flag Governance

Feature flags are operational controls, not hidden deployment shortcuts.

## Runtime Contract

- SDK and schemas live in `packages/shared-types/src/index.ts`.
- Evaluation supports tenant, percentage, internal, region, and environment scopes.
- `killSwitch` disables a flag immediately before any rollout rule is evaluated.
- Exposure telemetry is emitted as structured data through `featureFlagExposureTelemetry`.

## Gateway Subsystem Flags

The Hono gateway also has three environment flags in `services/api-gateway/wrangler.toml`. They default to enabled outside production and are explicitly disabled in production until a human-controlled rollout flips them.

| Flag | Current production state | Current non-production state | Active code surface | Enable path |
|---|---|---|---|---|
| `FEATURE_GRAPHQL` | disabled | enabled | Admin and Storefront GraphQL mounts plus generated API client GraphQL SDK | Set the production worker secret/var to `true`, deploy `services/api-gateway`, then run the GraphQL smoke tests and governance validation. |
| `FEATURE_EXTENSIONS` | disabled | enabled | App extension registry, checkout/admin UI extension lookup, and app function evaluation gates | Set the production worker secret/var to `true`, deploy `services/api-gateway`, then verify installed-app extension reads and checkout function execution against staging/production credentials. |
| `FEATURE_LIQUID` | disabled | enabled | Liquid theme bundle upload/rendering and Liquid-backed storefront composition | Set the production worker secret/var to `true`, deploy `services/api-gateway`, then verify theme package upload, preview, publish, and storefront render paths. |
| `LETBUYY_ENABLE_LEGACY_SITE_TYPES` | disabled | disabled | New `portfolio` and `resume` site creation through onboarding/store creation | Requires human product approval for a named legacy cohort. Existing portfolio/resume records and schema remain readable; this flag must not be enabled as a general acquisition surface. |

These flags are staged rollout controls. They must not be described as production-live behavior while the production value is `false`.

`NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES` mirrors the legacy site-type acquisition flag in public Next.js screens. It may expose the hidden UI choices only when the gateway worker flag is also enabled for the same environment.

## Persistence Contract

Active baseline migration `database/supabase/migrations/000_baseline.sql` owns:

- `operational_feature_flags`
- `operational_feature_flag_audit_events`
- `operational_feature_flag_exposures`

Feature flag records must be environment-scoped, auditable, and safe for instant rollback.
