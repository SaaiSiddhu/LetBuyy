# FOUNDATION_STEPUP_SKIPPED

## SKIP-W0-PITR-TIER · Wave 0 · Supabase PITR paid-tier activation · CLASS-A

BLOCKED BY: Human-owned Supabase project tier/credential decision and provider console action.

GATED AT: `config/runtime/database-recovery-policy.json` keeps `pointInTimeRecovery.defaultEnabledByCodex` false and marks shared restore execution as human `SKIP-DEPLOY`.

TO RESUME: Enable provider PITR on the intended non-production/shared project, record RPO/RTO evidence, then run `scripts/foundation/restore-drill.mjs --execute` against a non-production local/clone target and attach the restore report.

## SKIP-W1-PA-PAYOUT-PROVIDER · Wave 1 · RazorpayX Route payout execution · CLASS-A

BLOCKED BY: Human-owned PA/RazorpayX Route credentials, fund-account setup, and provider approval.

GATED AT: `services/api-gateway/src/routes/payouts.ts` returns `PAYOUT_PROVIDER_UNAVAILABLE` unless `RAZORPAY_ROUTE_PROVIDER_ENABLED=true` and the required PA credentials are configured; `packages/infrastructure/payout-transfer-adapter/index.ts` throws `PayoutProviderUnavailable` instead of fabricating a UTR or release state.

TO RESUME: Configure PA/RazorpayX Route credentials in the target non-production provider secret store, wire the approved provider client, run a non-production payout verification with provider evidence, and record apply/verify/rollback steps before enabling the flag.

## SKIP-W3-SENTRY-DSN · Wave 3 · Sentry/telemetry project DSN provisioning · CLASS-A

BLOCKED BY: Human-owned observability account/project decision, DSN provisioning, and provider secret-store action.

GATED AT: `config/runtime/production-safety-preflight.json` requires `RUNTIME_TELEMETRY_READY=true` before any shared-env apply, and `docs/runbooks/foundation-wave3-shared-env-apply.md` records `SKIP-DEPLOY` apply/verify/rollback steps for the human operator. Codex did not configure live telemetry or fake a DSN.

TO RESUME: Provision the approved Sentry or telemetry provider project, place the DSN in the target provider secret store, prove redaction and request correlation in non-production, then set `RUNTIME_TELEMETRY_READY=true` only after evidence is attached.

## SKIP-W3-DNS-CUTOVER · Wave 3 · Public .store DNS and custom-hostname cutover · CLASS-A

BLOCKED BY: Human-owned Cloudflare/Vercel DNS credentials, domain ownership approval, and live custom-hostname cutover authority.

GATED AT: public URL helpers default to `letbuyy.store` without performing DNS mutation, and `docs/runbooks/foundation-wave3-shared-env-apply.md` records `SKIP-DEPLOY` DNS/custom-hostname apply, verify, and rollback steps. Codex did not mutate Cloudflare, Vercel, or registrar state.

TO RESUME: Verify zone ownership and target records, run the human DNS/custom-hostname apply in the approved provider consoles or IaC path, confirm TLS and takeover-prevention checks, then attach rollback evidence before promoting traffic.
