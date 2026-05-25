# Feature Flag Governance

Feature flags are operational controls, not hidden deployment shortcuts.

## Runtime Contract

- SDK and schemas live in `packages/shared-types/src/index.ts`.
- Evaluation supports tenant, percentage, internal, region, and environment scopes.
- `killSwitch` disables a flag immediately before any rollout rule is evaluated.
- Exposure telemetry is emitted as structured data through `featureFlagExposureTelemetry`.

## Persistence Contract

Migration `database/supabase/migrations/065_enterprise_sdlc_lifecycle.sql` owns:

- `operational_feature_flags`
- `operational_feature_flag_audit_events`
- `operational_feature_flag_exposures`

Feature flag records must be environment-scoped, auditable, and safe for instant rollback.
