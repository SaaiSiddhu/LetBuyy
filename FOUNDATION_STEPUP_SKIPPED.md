# FOUNDATION_STEPUP_SKIPPED

## SKIP-W0-PITR-TIER · Wave 0 · Supabase PITR paid-tier activation · CLASS-A

BLOCKED BY: Human-owned Supabase project tier/credential decision and provider console action.

GATED AT: `config/runtime/database-recovery-policy.json` keeps `pointInTimeRecovery.defaultEnabledByCodex` false and marks shared restore execution as human `SKIP-DEPLOY`.

TO RESUME: Enable provider PITR on the intended non-production/shared project, record RPO/RTO evidence, then run `scripts/foundation/restore-drill.mjs --execute` against a non-production local/clone target and attach the restore report.
