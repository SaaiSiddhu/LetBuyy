# FOUNDATION_STEPUP_SKIPPED

## SKIP-W0-PITR-TIER · Wave 0 · Supabase PITR paid-tier activation · CLASS-A

BLOCKED BY: Human-owned Supabase project tier/credential decision and provider console action.

GATED AT: `config/runtime/database-recovery-policy.json` keeps `pointInTimeRecovery.defaultEnabledByCodex` false and marks shared restore execution as human `SKIP-DEPLOY`.

TO RESUME: Enable provider PITR on the intended non-production/shared project, record RPO/RTO evidence, then run `scripts/foundation/restore-drill.mjs --execute` against a non-production local/clone target and attach the restore report.

## SKIP-W1-PA-PAYOUT-PROVIDER · Wave 1 · RazorpayX Route payout execution · CLASS-A

BLOCKED BY: Human-owned PA/RazorpayX Route credentials, fund-account setup, and provider approval.

GATED AT: `services/api-gateway/src/routes/payouts.ts` returns `PAYOUT_PROVIDER_UNAVAILABLE` unless `RAZORPAY_ROUTE_PROVIDER_ENABLED=true` and the required PA credentials are configured; `packages/infrastructure/payout-transfer-adapter/index.ts` throws `PayoutProviderUnavailable` instead of fabricating a UTR or release state.

TO RESUME: Configure PA/RazorpayX Route credentials in the target non-production provider secret store, wire the approved provider client, run a non-production payout verification with provider evidence, and record apply/verify/rollback steps before enabling the flag.
